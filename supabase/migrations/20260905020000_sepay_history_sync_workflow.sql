-- Owner-managed SePay API v2 account identities, audited history sync runs,
-- and explicit reconciliation for record-only historical transactions.

begin;

insert into public.permissions (code, module, name, description)
values (
  'sepay.sync_history.manage',
  'sepay',
  'Đồng bộ lịch sử SePay',
  'Xem trước, nhập và đối soát giao dịch lịch sử từ SePay API v2'
)
on conflict (code) do update
set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
join public.permissions as permission
  on permission.code = 'sepay.sync_history.manage'
where role.code = 'owner'
on conflict (role_id, permission_id) do nothing;

alter table public.sepay_receiving_account_versions
  add column if not exists sepay_bank_account_id uuid;

alter table public.sepay_receiving_account_versions
  add constraint sepay_receiving_account_versions_no_active_api_identity_overlap
  exclude using gist (
    sepay_bank_account_id with =,
    daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&
  )
  where (status = 'active' and sepay_bank_account_id is not null);

drop function if exists public.create_sepay_receiving_account_version(
  text, text, text, text, date, text
);

create function public.create_sepay_receiving_account_version(
  p_purpose text,
  p_bank_code text,
  p_account_number text,
  p_account_display_name text,
  p_effective_from date,
  p_reason text,
  p_sepay_bank_account_id uuid default null
)
returns public.sepay_receiving_account_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.sepay_receiving_account_versions;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('settings.sepay_receiving_accounts.manage') then
    raise exception 'SEPAY_RECEIVING_ACCOUNT_PERMISSION_DENIED';
  end if;
  if p_purpose not in ('new_enrollment', 'renewal')
    or p_effective_from is null
    or nullif(pg_catalog.btrim(p_bank_code), '') is null
    or nullif(pg_catalog.btrim(p_account_number), '') is null
    or nullif(pg_catalog.btrim(p_account_display_name), '') is null
    or nullif(pg_catalog.btrim(p_reason), '') is null
  then
    raise exception 'SEPAY_RECEIVING_ACCOUNT_INPUT_INVALID';
  end if;

  insert into public.sepay_receiving_account_versions (
    purpose,
    bank_code,
    account_number,
    account_display_name,
    effective_from,
    sepay_bank_account_id,
    created_by,
    audit_metadata
  )
  values (
    p_purpose,
    pg_catalog.btrim(p_bank_code),
    pg_catalog.btrim(p_account_number),
    pg_catalog.btrim(p_account_display_name),
    p_effective_from,
    p_sepay_bank_account_id,
    v_actor,
    pg_catalog.jsonb_build_object('reason', pg_catalog.btrim(p_reason))
  )
  returning * into v_row;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    new_data,
    reason
  )
  values (
    v_actor,
    'finance',
    'sepay_receiving_account_version_created',
    'sepay_receiving_account_version',
    v_row.id::text,
    pg_catalog.to_jsonb(v_row),
    pg_catalog.btrim(p_reason)
  );

  return v_row;
end;
$$;

revoke all on function public.create_sepay_receiving_account_version(
  text, text, text, text, date, text, uuid
) from public, anon;
grant execute on function public.create_sepay_receiving_account_version(
  text, text, text, text, date, text, uuid
) to authenticated;

create or replace function public.set_sepay_receiving_account_api_identity(
  p_account_version_id uuid,
  p_sepay_bank_account_id uuid,
  p_reason text
)
returns public.sepay_receiving_account_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.sepay_receiving_account_versions;
  v_row public.sepay_receiving_account_versions;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('settings.sepay_receiving_accounts.manage') then
    raise exception 'SEPAY_RECEIVING_ACCOUNT_PERMISSION_DENIED';
  end if;
  if p_account_version_id is null
    or p_sepay_bank_account_id is null
    or nullif(pg_catalog.btrim(p_reason), '') is null
  then
    raise exception 'SEPAY_RECEIVING_ACCOUNT_API_IDENTITY_INPUT_INVALID';
  end if;

  select * into v_old
  from public.sepay_receiving_account_versions
  where id = p_account_version_id
  for update;

  if not found then
    raise exception 'SEPAY_RECEIVING_ACCOUNT_NOT_FOUND';
  end if;

  update public.sepay_receiving_account_versions
  set
    sepay_bank_account_id = p_sepay_bank_account_id,
    changed_by = v_actor,
    changed_at = pg_catalog.now(),
    audit_metadata = audit_metadata || pg_catalog.jsonb_build_object(
      'api_identity_changed_reason', pg_catalog.btrim(p_reason)
    )
  where id = p_account_version_id
  returning * into v_row;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason
  )
  values (
    v_actor,
    'finance',
    'sepay_receiving_account_api_identity_set',
    'sepay_receiving_account_version',
    v_row.id::text,
    pg_catalog.to_jsonb(v_old),
    pg_catalog.to_jsonb(v_row),
    pg_catalog.btrim(p_reason)
  );

  return v_row;
end;
$$;

revoke all on function public.set_sepay_receiving_account_api_identity(uuid, uuid, text)
from public, anon;
grant execute on function public.set_sepay_receiving_account_api_identity(uuid, uuid, text)
to authenticated;

create table public.sepay_sync_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  account_version_id uuid not null references public.sepay_receiving_account_versions(id) on delete restrict,
  date_from date not null,
  date_to date not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  total_available integer not null default 0 check (total_available >= 0),
  total_seen integer not null default 0 check (total_seen >= 0),
  recorded_count integer not null default 0 check (recorded_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  linked_count integer not null default 0 check (linked_count >= 0),
  manual_review_count integer not null default 0 check (manual_review_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  pages_processed integer not null default 0 check (pages_processed >= 0),
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (date_to >= date_from),
  check (date_to - date_from <= 30)
);

create index sepay_sync_runs_requested_at_idx
  on public.sepay_sync_runs (started_at desc);
create index sepay_sync_runs_account_idx
  on public.sepay_sync_runs (account_version_id, started_at desc);
create unique index sepay_sync_runs_one_active_account_idx
  on public.sepay_sync_runs (account_version_id)
  where status = 'running';

alter table public.sepay_sync_runs enable row level security;

create policy sepay_sync_runs_select
on public.sepay_sync_runs
for select
to authenticated
using (public.has_permission('sepay.sync_history.manage'));

create or replace function public.ingest_sepay_api_v2_transactions_batch(
  p_transactions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_result jsonb;
  v_recorded integer := 0;
  v_duplicates integer := 0;
  v_linked integer := 0;
  v_manual_review integer := 0;
begin
  if p_transactions is null
    or pg_catalog.jsonb_typeof(p_transactions) <> 'array'
    or pg_catalog.jsonb_array_length(p_transactions) = 0
    or pg_catalog.jsonb_array_length(p_transactions) > 100
  then
    raise exception 'SEPAY_SYNC_BATCH_INVALID';
  end if;

  for v_item in
    select item.value
    from pg_catalog.jsonb_array_elements(p_transactions) as item(value)
  loop
    if not exists (
      select 1
      from public.sepay_receiving_account_versions as account
      where account.sepay_bank_account_id = (v_item ->> 'bank_account_id')::uuid
        and account.status = 'active'
        and account.signed_account_number = public.normalize_sepay_receiving_account_number(
          v_item ->> 'account_number'
        )
        and account.effective_from <= (
          (v_item ->> 'transaction_date')::timestamptz at time zone 'Asia/Ho_Chi_Minh'
        )::date
        and coalesce(
          account.effective_to,
          ((v_item ->> 'transaction_date')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date
        ) >= ((v_item ->> 'transaction_date')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date
    ) then
      raise exception 'SEPAY_API_ACCOUNT_BINDING_MISMATCH';
    end if;

    v_result := public.ingest_sepay_api_v2_transaction(
      (v_item ->> 'id')::uuid,
      v_item ->> 'bank_brand_name',
      (v_item ->> 'transaction_date')::timestamptz,
      v_item ->> 'account_number',
      coalesce(v_item ->> 'code', ''),
      v_item ->> 'transaction_content',
      v_item ->> 'transfer_type',
      coalesce((v_item ->> 'amount_in')::bigint, 0),
      coalesce((v_item ->> 'amount_out')::bigint, 0),
      nullif(v_item ->> 'reference_number', ''),
      '{}'::jsonb
    );

    case v_result ->> 'identity_status'
      when 'duplicate' then v_duplicates := v_duplicates + 1;
      when 'linked' then v_linked := v_linked + 1;
      when 'ambiguous' then v_manual_review := v_manual_review + 1;
      else v_recorded := v_recorded + 1;
    end case;
  end loop;

  return pg_catalog.jsonb_build_object(
    'seen', pg_catalog.jsonb_array_length(p_transactions),
    'recorded', v_recorded,
    'duplicates', v_duplicates,
    'linked', v_linked,
    'manual_review', v_manual_review
  );
end;
$$;

revoke all on function public.ingest_sepay_api_v2_transactions_batch(jsonb)
from public, anon, authenticated;
grant execute on function public.ingest_sepay_api_v2_transactions_batch(jsonb)
to service_role;

alter table public.sepay_transactions
  drop constraint if exists sepay_transactions_match_status_check;
alter table public.sepay_transactions
  add constraint sepay_transactions_match_status_check
  check (
    match_status in (
      'unmatched',
      'auto_matched',
      'manual_matched',
      'split_allocated',
      'amount_mismatch',
      'account_purpose_mismatch',
      'identity_conflict',
      'historical_accounted',
      'ignored'
    )
  );

create unique index finance_cashflow_records_sepay_student_kind_unique_idx
  on public.finance_cashflow_records (
    sepay_transaction_id,
    coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid),
    record_type,
    category
  )
  where sepay_transaction_id is not null;

create unique index student_credit_lots_sepay_student_unique_idx
  on public.student_credit_lots (sepay_transaction_id, student_id)
  where sepay_transaction_id is not null;

create unique index student_credit_lots_payment_request_unique_idx
  on public.student_credit_lots (payment_request_id)
  where payment_request_id is not null;

-- Expose only the minimum payment-request fields needed by the SePay
-- reconciliation picker. This keeps the granular sepay.allocate permission
-- useful without granting broad SELECT access to student_payment_requests.
create or replace function public.search_sepay_reconciliation_candidates(
  p_sepay_transaction_id uuid,
  p_search text default null,
  p_limit integer default 50
)
returns table (
  request_id uuid,
  public_code text,
  expected_amount_vnd bigint,
  topup_type text,
  student_full_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.sepay_transactions;
  v_expected_topup_type text;
  v_search text := nullif(pg_catalog.btrim(p_search), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    public.has_permission('sepay.sync_history.manage')
    or public.has_permission('sepay.allocate')
    or public.has_permission('payments.manage')
  ) then
    raise exception 'SEPAY_RECONCILIATION_PERMISSION_DENIED';
  end if;

  select * into v_tx
  from public.sepay_transactions
  where id = p_sepay_transaction_id;

  if not found
    or not (v_tx.source_payloads ? 'api_v2')
    or v_tx.transfer_type is distinct from 'in'
    or v_tx.match_status <> 'unmatched'
  then
    raise exception 'TRANSACTION_NOT_AVAILABLE_FOR_RECONCILIATION';
  end if;

  v_expected_topup_type := case v_tx.account_purpose
    when 'new_enrollment' then 'new'
    when 'renewal' then 'renewal'
    else null
  end;
  if v_expected_topup_type is null then
    raise exception 'SEPAY_ACCOUNT_PURPOSE_UNRESOLVED';
  end if;

  return query
  select
    request.id,
    request.public_code,
    request.expected_amount_vnd,
    request.topup_type,
    student.full_name
  from public.student_payment_requests as request
  join public.students as student on student.id = request.student_id
  where request.status = 'pending'
    and request.expected_amount_vnd = v_tx.amount_vnd
    and request.topup_type = v_expected_topup_type
    and (
      v_search is null
      or request.public_code ilike '%' || v_search || '%'
      or request.transfer_code ilike '%' || v_search || '%'
      or student.public_code ilike '%' || v_search || '%'
      or student.full_name ilike '%' || v_search || '%'
    )
  order by request.created_at desc, request.id desc
  limit v_limit;
end;
$$;

revoke all on function public.search_sepay_reconciliation_candidates(uuid, text, integer)
from public, anon;
grant execute on function public.search_sepay_reconciliation_candidates(uuid, text, integer)
to authenticated;

create or replace function public.resolve_sepay_historical_transaction(
  p_sepay_transaction_id uuid,
  p_resolution text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tx public.sepay_transactions;
  v_status text;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    public.has_permission('sepay.sync_history.manage')
    or public.has_permission('sepay.allocate')
    or public.has_permission('payments.manage')
  ) then
    raise exception 'SEPAY_RECONCILIATION_PERMISSION_DENIED';
  end if;
  if p_resolution not in ('already_accounted', 'ignored')
    or nullif(pg_catalog.btrim(p_reason), '') is null
  then
    raise exception 'SEPAY_RECONCILIATION_INPUT_INVALID';
  end if;

  select * into v_tx
  from public.sepay_transactions
  where id = p_sepay_transaction_id
  for update;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;
  if not (v_tx.source_payloads ? 'api_v2') then
    raise exception 'TRANSACTION_NOT_HISTORICAL';
  end if;
  if v_tx.match_status = 'identity_conflict'
    and not public.has_permission('sepay.sync_history.manage')
  then
    raise exception 'TRANSACTION_IDENTITY_CONFLICT_OWNER_REQUIRED';
  end if;
  if v_tx.match_status not in ('unmatched', 'identity_conflict') then
    raise exception 'TRANSACTION_ALREADY_RECONCILED';
  end if;
  if exists (
    select 1 from public.finance_cashflow_records
    where sepay_transaction_id = p_sepay_transaction_id
  ) or exists (
    select 1 from public.student_credit_lots
    where sepay_transaction_id = p_sepay_transaction_id
  ) then
    raise exception 'TRANSACTION_HAS_FINANCIAL_EFFECTS';
  end if;

  v_status := case p_resolution
    when 'already_accounted' then 'historical_accounted'
    else 'ignored'
  end;

  update public.sepay_transactions
  set
    match_status = v_status,
    matched_by = v_actor,
    matched_at = pg_catalog.now()
  where id = p_sepay_transaction_id;

  if v_tx.sepay_webhook_id is not null then
    update public.sepay_webhooks
    set
      processing_status = 'processed',
      error_message = null,
      processed_at = pg_catalog.now()
    where id = v_tx.sepay_webhook_id;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason
  )
  values (
    v_actor,
    'finance',
    'sepay_historical_transaction_' || p_resolution,
    'sepay_transaction',
    p_sepay_transaction_id::text,
    pg_catalog.to_jsonb(v_tx),
    pg_catalog.jsonb_build_object('match_status', v_status),
    pg_catalog.btrim(p_reason)
  );

  return pg_catalog.jsonb_build_object(
    'status', 'success',
    'match_status', v_status,
    'transaction_id', p_sepay_transaction_id
  );
end;
$$;

revoke all on function public.resolve_sepay_historical_transaction(uuid, text, text)
from public, anon;
grant execute on function public.resolve_sepay_historical_transaction(uuid, text, text)
to authenticated;

create or replace function public.match_sepay_historical_transaction_to_payment_request(
  p_sepay_transaction_id uuid,
  p_payment_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tx public.sepay_transactions;
  v_request public.student_payment_requests;
  v_credit_lot_id uuid;
  v_expected_topup_type text;
  v_unit_price bigint;
  v_effective_on date;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    public.has_permission('sepay.sync_history.manage')
    or public.has_permission('sepay.allocate')
    or public.has_permission('payments.manage')
  ) then
    raise exception 'SEPAY_RECONCILIATION_PERMISSION_DENIED';
  end if;
  if p_sepay_transaction_id is null
    or p_payment_request_id is null
    or nullif(pg_catalog.btrim(p_reason), '') is null
  then
    raise exception 'SEPAY_RECONCILIATION_INPUT_INVALID';
  end if;

  select * into v_tx
  from public.sepay_transactions
  where id = p_sepay_transaction_id
  for update;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;
  if not (v_tx.source_payloads ? 'api_v2') then
    raise exception 'TRANSACTION_NOT_HISTORICAL';
  end if;
  if v_tx.match_status = 'identity_conflict' then
    raise exception 'TRANSACTION_IDENTITY_CONFLICT_LOCKED';
  end if;
  if v_tx.match_status <> 'unmatched' then
    raise exception 'TRANSACTION_ALREADY_RECONCILED';
  end if;
  if v_tx.transfer_type is distinct from 'in' then
    raise exception 'TRANSACTION_NOT_INBOUND';
  end if;
  if v_tx.account_purpose = 'unknown' then
    raise exception 'SEPAY_ACCOUNT_PURPOSE_UNRESOLVED';
  end if;
  if exists (
    select 1 from public.finance_cashflow_records
    where sepay_transaction_id = p_sepay_transaction_id
  ) or exists (
    select 1 from public.student_credit_lots
    where sepay_transaction_id = p_sepay_transaction_id
  ) then
    raise exception 'TRANSACTION_HAS_FINANCIAL_EFFECTS';
  end if;

  select * into v_request
  from public.student_payment_requests
  where id = p_payment_request_id
  for update;

  if not found or v_request.status <> 'pending' or v_request.student_id is null then
    raise exception 'PAYMENT_REQUEST_NOT_AVAILABLE';
  end if;

  v_expected_topup_type := case v_tx.account_purpose
    when 'new_enrollment' then 'new'
    when 'renewal' then 'renewal'
  end;

  if v_request.topup_type is distinct from v_expected_topup_type then
    raise exception 'ACCOUNT_PURPOSE_TOPUP_TYPE_MISMATCH';
  end if;
  if v_request.expected_amount_vnd <> v_tx.amount_vnd then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  v_unit_price := coalesce(
    nullif(v_request.calculated_unit_price_vnd, 0),
    v_tx.amount_vnd / v_request.purchased_sessions
  );
  if v_unit_price <= 0 then
    raise exception 'INVALID_UNIT_PRICE';
  end if;

  v_effective_on := (v_tx.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date;

  update public.student_payment_requests
  set
    status = 'paid',
    paid_amount_vnd = v_tx.amount_vnd,
    paid_at = v_tx.transaction_at,
    calculated_unit_price_vnd = v_unit_price,
    updated_at = pg_catalog.now()
  where id = v_request.id;

  insert into public.student_credit_lots (
    student_id,
    payment_request_id,
    sepay_transaction_id,
    total_purchased_sessions,
    total_bonus_sessions,
    total_sessions,
    remaining_sessions,
    unit_price_vnd,
    topup_type,
    status,
    created_by
  )
  values (
    v_request.student_id,
    v_request.id,
    v_tx.id,
    v_request.purchased_sessions,
    v_request.bonus_sessions,
    v_request.purchased_sessions + v_request.bonus_sessions,
    v_request.purchased_sessions + v_request.bonus_sessions,
    v_unit_price,
    v_request.topup_type,
    'active',
    v_actor
  )
  returning id into v_credit_lot_id;

  insert into public.student_session_ledger_entries (
    student_id,
    entry_type,
    delta_sessions,
    effective_on,
    event_key,
    reference_code,
    unit_price_vnd,
    note,
    metadata,
    created_by
  )
  values (
    v_request.student_id,
    'payment_credit',
    v_request.purchased_sessions,
    v_effective_on,
    'sepay-manual-payment-credit:' || v_tx.id::text,
    v_request.public_code,
    v_unit_price,
    'Nạp học phí từ giao dịch lịch sử SePay đã đối soát',
    pg_catalog.jsonb_build_object(
      'credit_lot_id', v_credit_lot_id,
      'payment_request_id', v_request.id,
      'sepay_transaction_id', v_tx.id,
      'account_purpose', v_tx.account_purpose,
      'reconciliation', 'manual_history'
    ),
    v_actor
  );

  if v_request.bonus_sessions > 0 then
    insert into public.student_session_ledger_entries (
      student_id,
      entry_type,
      delta_sessions,
      effective_on,
      event_key,
      reference_code,
      unit_price_vnd,
      note,
      metadata,
      created_by
    )
    values (
      v_request.student_id,
      'bonus_credit',
      v_request.bonus_sessions,
      v_effective_on,
      'sepay-manual-bonus-credit:' || v_tx.id::text,
      v_request.public_code,
      null,
      'Tặng buổi học kèm giao dịch lịch sử SePay đã đối soát',
      pg_catalog.jsonb_build_object(
        'credit_lot_id', v_credit_lot_id,
        'payment_request_id', v_request.id,
        'sepay_transaction_id', v_tx.id,
        'account_purpose', v_tx.account_purpose,
        'reconciliation', 'manual_history'
      ),
      v_actor
    );
  end if;

  insert into public.finance_cashflow_records (
    record_type,
    category,
    amount_vnd,
    student_id,
    sepay_transaction_id,
    reference_code,
    note,
    created_by
  )
  values (
    'receipt',
    'tuition_fee',
    v_tx.amount_vnd,
    v_request.student_id,
    v_tx.id,
    v_request.public_code,
    'Thu học phí từ giao dịch lịch sử SePay đã đối soát',
    v_actor
  );

  update public.sepay_transactions
  set
    matched_payment_request_id = v_request.id,
    matched_student_id = v_request.student_id,
    match_status = 'manual_matched',
    matched_by = v_actor,
    matched_at = pg_catalog.now()
  where id = v_tx.id;

  if v_tx.sepay_webhook_id is not null then
    update public.sepay_webhooks
    set
      processing_status = 'processed',
      error_message = null,
      processed_at = pg_catalog.now()
    where id = v_tx.sepay_webhook_id;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason
  )
  values (
    v_actor,
    'finance',
    'sepay_historical_transaction_matched',
    'sepay_transaction',
    v_tx.id::text,
    pg_catalog.to_jsonb(v_tx),
    pg_catalog.jsonb_build_object(
      'match_status', 'manual_matched',
      'payment_request_id', v_request.id,
      'student_id', v_request.student_id,
      'credit_lot_id', v_credit_lot_id
    ),
    pg_catalog.btrim(p_reason)
  );

  return pg_catalog.jsonb_build_object(
    'status', 'success',
    'match_status', 'manual_matched',
    'transaction_id', v_tx.id,
    'payment_request_id', v_request.id
  );
end;
$$;

revoke all on function public.match_sepay_historical_transaction_to_payment_request(
  uuid, uuid, text
) from public, anon;
grant execute on function public.match_sepay_historical_transaction_to_payment_request(
  uuid, uuid, text
) to authenticated;

-- Existing split allocation becomes safe for API-only history records and uses
-- the bank transaction date instead of the day an operator reconciles it.
create or replace function public.allocate_payment_to_students(
  p_sepay_transaction_id uuid,
  p_guardian_id uuid,
  p_allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_tx record;
  v_total_allocated bigint := 0;
  v_item jsonb;
  v_student_id uuid;
  v_amount_vnd bigint;
  v_purchased_sessions integer;
  v_bonus_sessions integer;
  v_unit_price bigint;
  v_credit_lot_id uuid;
  v_ref_code text;
  v_topup_type text;
  v_seen_student_ids uuid[] := array[]::uuid[];
  v_effective_on date;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then raise exception 'AUTHENTICATION_REQUIRED: Vui long dang nhap.'; end if;
  if not (public.has_permission('sepay.allocate') or public.has_permission('payments.manage')) then
    raise exception 'SEPAY_ALLOCATE_PERMISSION_DENIED: Khong co quyen phan bo hoc phi.';
  end if;
  if p_sepay_transaction_id is null then raise exception 'TRANSACTION_NOT_FOUND: Giao dich SePay khong ton tai.'; end if;
  if p_guardian_id is null then raise exception 'GUARDIAN_ID_REQUIRED: Thieu phu huynh phan bo.'; end if;
  if p_allocations is null
    or pg_catalog.jsonb_typeof(p_allocations) <> 'array'
    or pg_catalog.jsonb_array_length(p_allocations) = 0
  then
    raise exception 'EMPTY_ALLOCATIONS: Can phan bo it nhat 1 hoc vien.';
  end if;

  select tx.*, webhook.transfer_type as webhook_transfer_type
  into v_tx
  from public.sepay_transactions as tx
  left join public.sepay_webhooks as webhook on webhook.id = tx.sepay_webhook_id
  where tx.id = p_sepay_transaction_id
  for update of tx;

  if not found then raise exception 'TRANSACTION_NOT_FOUND: Giao dich SePay khong ton tai.'; end if;
  if coalesce(v_tx.transfer_type, v_tx.webhook_transfer_type) is distinct from 'in' then
    raise exception 'TRANSACTION_NOT_INBOUND: Chi giao dich chuyen vao moi duoc phan bo.';
  end if;
  if v_tx.account_purpose = 'unknown' then raise exception 'SEPAY_ACCOUNT_PURPOSE_UNRESOLVED: Tai khoan nhan cua giao dich chua duoc cau hinh.'; end if;
  if v_tx.match_status <> 'unmatched' then raise exception 'TRANSACTION_NOT_AVAILABLE_FOR_ALLOCATION: Giao dich da duoc xu ly hoac dang can doi soat.'; end if;
  if exists (select 1 from public.payment_split_allocations where sepay_transaction_id = p_sepay_transaction_id) then
    raise exception 'ALLOCATION_ALREADY_EXISTS: Giao dich da co phan bo.';
  end if;

  v_topup_type := case v_tx.account_purpose when 'new_enrollment' then 'new' when 'renewal' then 'renewal' end;
  v_effective_on := (v_tx.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date;

  for v_item in select item.value from pg_catalog.jsonb_array_elements(p_allocations) as item(value)
  loop
    begin
      v_student_id := (v_item ->> 'student_id')::uuid;
      v_amount_vnd := (v_item ->> 'allocated_amount_vnd')::bigint;
      v_purchased_sessions := (v_item ->> 'allocated_sessions')::integer;
      v_bonus_sessions := coalesce((v_item ->> 'bonus_sessions')::integer, 0);
      v_unit_price := coalesce(nullif((v_item ->> 'unit_price_vnd')::bigint, 0), v_amount_vnd / v_purchased_sessions);
    exception when others then raise exception 'INVALID_ALLOCATION_ITEM: Du lieu phan bo khong hop le.'; end;
    if v_amount_vnd <= 0 or v_purchased_sessions <= 0 or v_bonus_sessions < 0 or v_unit_price <= 0 then
      raise exception 'INVALID_ALLOCATION_ITEM: Gia tri phan bo phai lon hon 0.';
    end if;
    if v_student_id = any(v_seen_student_ids) then raise exception 'DUPLICATE_ALLOCATION_STUDENT: Moi hoc vien chi duoc phan bo mot lan trong giao dich.'; end if;
    if not exists (
      select 1 from public.student_guardians
      where student_id = v_student_id and guardian_id = p_guardian_id and ended_at is null
    ) then raise exception 'STUDENT_GUARDIAN_MISMATCH: Hoc vien khong thuoc phu huynh da chon.'; end if;
    v_seen_student_ids := pg_catalog.array_append(v_seen_student_ids, v_student_id);
    v_total_allocated := v_total_allocated + v_amount_vnd;
  end loop;

  if v_total_allocated <> v_tx.amount_vnd then
    raise exception 'ALLOCATION_TOTAL_MUST_MATCH_TRANSACTION: Tong tien phan bo (%) phai bang so tien giao dich (%).', v_total_allocated, v_tx.amount_vnd;
  end if;
  v_ref_code := 'SPLIT-' || pg_catalog.substr(p_sepay_transaction_id::text, 1, 8);

  for v_item in select item.value from pg_catalog.jsonb_array_elements(p_allocations) as item(value)
  loop
    v_student_id := (v_item ->> 'student_id')::uuid;
    v_amount_vnd := (v_item ->> 'allocated_amount_vnd')::bigint;
    v_purchased_sessions := (v_item ->> 'allocated_sessions')::integer;
    v_bonus_sessions := coalesce((v_item ->> 'bonus_sessions')::integer, 0);
    v_unit_price := coalesce(nullif((v_item ->> 'unit_price_vnd')::bigint, 0), v_amount_vnd / v_purchased_sessions);

    insert into public.student_credit_lots (
      student_id, sepay_transaction_id, total_purchased_sessions, total_bonus_sessions,
      total_sessions, remaining_sessions, unit_price_vnd, topup_type, status, created_by
    ) values (
      v_student_id, p_sepay_transaction_id, v_purchased_sessions, v_bonus_sessions,
      v_purchased_sessions + v_bonus_sessions, v_purchased_sessions + v_bonus_sessions,
      v_unit_price, v_topup_type, 'active', v_actor_id
    ) returning id into v_credit_lot_id;

    insert into public.payment_split_allocations (
      sepay_transaction_id, guardian_id, student_id, allocated_amount_vnd,
      allocated_sessions, bonus_sessions, unit_price_vnd, credit_lot_id, notes, allocated_by
    ) values (
      p_sepay_transaction_id, p_guardian_id, v_student_id, v_amount_vnd,
      v_purchased_sessions, v_bonus_sessions, v_unit_price, v_credit_lot_id,
      nullif(pg_catalog.btrim(v_item ->> 'notes'), ''), v_actor_id
    );

    insert into public.student_session_ledger_entries (
      student_id, entry_type, delta_sessions, effective_on, event_key,
      reference_code, unit_price_vnd, note, metadata, created_by
    ) values (
      v_student_id, 'payment_credit', v_purchased_sessions, v_effective_on,
      'sepay-split-payment-credit:' || p_sepay_transaction_id::text || ':' || v_student_id::text,
      v_ref_code, v_unit_price, 'Nạp học phí phân bổ nhiều học viên',
      pg_catalog.jsonb_build_object('account_purpose', v_tx.account_purpose, 'allocation_amount_vnd', v_amount_vnd, 'credit_lot_id', v_credit_lot_id, 'guardian_id', p_guardian_id, 'sepay_transaction_id', p_sepay_transaction_id),
      v_actor_id
    );

    if v_bonus_sessions > 0 then
      insert into public.student_session_ledger_entries (
        student_id, entry_type, delta_sessions, effective_on, event_key,
        reference_code, unit_price_vnd, note, metadata, created_by
      ) values (
        v_student_id, 'bonus_credit', v_bonus_sessions, v_effective_on,
        'sepay-split-bonus-credit:' || p_sepay_transaction_id::text || ':' || v_student_id::text,
        v_ref_code, null, 'Tặng buổi học kèm phân bổ nhiều học viên',
        pg_catalog.jsonb_build_object('account_purpose', v_tx.account_purpose, 'credit_lot_id', v_credit_lot_id, 'guardian_id', p_guardian_id, 'sepay_transaction_id', p_sepay_transaction_id),
        v_actor_id
      );
    end if;

    insert into public.finance_cashflow_records (
      record_type, category, amount_vnd, student_id, sepay_transaction_id,
      reference_code, note, created_by
    ) values (
      'receipt', 'tuition_fee', v_amount_vnd, v_student_id, p_sepay_transaction_id,
      v_ref_code, 'Phân bổ học phí cho học viên', v_actor_id
    );
  end loop;

  update public.sepay_transactions
  set match_status = 'split_allocated', matched_by = v_actor_id, matched_at = pg_catalog.now()
  where id = p_sepay_transaction_id;

  insert into public.audit_logs (
    actor_user_id, module, action, entity_type, entity_id, new_data, reason
  ) values (
    v_actor_id, 'finance', 'sepay_transaction_split_allocated', 'sepay_transaction',
    p_sepay_transaction_id::text,
    pg_catalog.jsonb_build_object('student_ids', v_seen_student_ids, 'total_allocated_vnd', v_total_allocated, 'effective_on', v_effective_on),
    'Phân bổ thủ công giao dịch SePay'
  );

  return pg_catalog.jsonb_build_object(
    'status', 'success',
    'sepay_transaction_id', p_sepay_transaction_id,
    'total_allocated_vnd', v_total_allocated
  );
end;
$$;

revoke all on function public.allocate_payment_to_students(uuid, uuid, jsonb)
from public, anon;
grant execute on function public.allocate_payment_to_students(uuid, uuid, jsonb)
to authenticated;

commit;
