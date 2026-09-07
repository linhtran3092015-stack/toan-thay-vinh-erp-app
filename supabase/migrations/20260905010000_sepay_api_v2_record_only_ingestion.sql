-- Support SePay API v2 UUID identities without reusing the live webhook
-- settlement path for historical imports.
--
-- Historical/API records are always record-only. The live webhook remains the
-- only automatic settlement entry point, and both paths share the same
-- canonical transaction identity resolver.

begin;

alter table public.sepay_transactions
  add column if not exists sepay_v2_id uuid,
  add column if not exists transfer_type text,
  add column if not exists reference_number text,
  add column if not exists ingestion_source text not null default 'webhook',
  add column if not exists source_payloads jsonb not null default '{}'::jsonb;

alter table public.sepay_transactions
  drop constraint if exists sepay_transactions_transfer_type_check;
alter table public.sepay_transactions
  add constraint sepay_transactions_transfer_type_check
  check (transfer_type is null or transfer_type in ('in', 'out'));

alter table public.sepay_transactions
  drop constraint if exists sepay_transactions_ingestion_source_check;
alter table public.sepay_transactions
  add constraint sepay_transactions_ingestion_source_check
  check (ingestion_source in ('webhook', 'api_v2', 'reconciled'));

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
      'identity_conflict'
    )
  );

create unique index if not exists sepay_transactions_v2_id_unique_idx
  on public.sepay_transactions (sepay_v2_id)
  where sepay_v2_id is not null;

update public.sepay_transactions as transaction
set
  transfer_type = webhook.transfer_type,
  reference_number = webhook.reference_number,
  source_payloads = pg_catalog.jsonb_build_object(
    'webhook',
    pg_catalog.jsonb_build_object('recorded', true)
  )
from public.sepay_webhooks as webhook
where webhook.id = transaction.sepay_webhook_id
  and (
    transaction.transfer_type is null
    or transaction.reference_number is null
    or transaction.source_payloads = '{}'::jsonb
  );

create index if not exists sepay_transactions_identity_lookup_idx
  on public.sepay_transactions (
    public.normalize_sepay_receiving_account_number(account_number),
    transaction_at,
    transfer_type,
    amount_vnd
  );

create index if not exists sepay_transactions_reference_identity_idx
  on public.sepay_transactions (
    public.normalize_sepay_receiving_account_number(account_number),
    reference_number,
    transfer_type,
    amount_vnd
  )
  where reference_number is not null;

create or replace function public.ingest_sepay_transaction_record(
  p_sepay_webhook_id uuid,
  p_sepay_v2_id uuid,
  p_external_transaction_id text,
  p_gateway text,
  p_transaction_date timestamptz,
  p_account_number text,
  p_account_purpose text,
  p_code text,
  p_content text,
  p_transfer_type text,
  p_amount_in bigint,
  p_amount_out bigint,
  p_reference_number text,
  p_ingestion_source text,
  p_source_payload jsonb
)
returns table(
  transaction_id uuid,
  identity_status text,
  current_match_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount bigint;
  v_candidate_count integer;
  v_candidate_id uuid;
  v_existing public.sepay_transactions%rowtype;
  v_fingerprint text;
  v_reference_fingerprint text;
  v_source_key text;
begin
  if p_sepay_webhook_id is null and p_sepay_v2_id is null then
    raise exception 'SEPAY_EXTERNAL_ID_REQUIRED: Can it nhat mot dinh danh SePay.';
  end if;
  if nullif(pg_catalog.btrim(p_external_transaction_id), '') is null then
    raise exception 'SEPAY_EXTERNAL_ID_INVALID: Dinh danh SePay khong hop le.';
  end if;
  if p_gateway is null or pg_catalog.btrim(p_gateway) = '' then
    raise exception 'INVALID_GATEWAY: Ngan hang khong hop le.';
  end if;
  if p_transaction_date is null then
    raise exception 'INVALID_TRANSACTION_DATE: Thoi gian giao dich khong hop le.';
  end if;
  if p_account_number is null or pg_catalog.btrim(p_account_number) = '' then
    raise exception 'INVALID_ACCOUNT_NUMBER: Tai khoan nhan khong hop le.';
  end if;
  if p_content is null or pg_catalog.btrim(p_content) = '' then
    raise exception 'INVALID_TRANSFER_CONTENT: Noi dung chuyen khoan khong hop le.';
  end if;
  if p_transfer_type is null or p_transfer_type not in ('in', 'out') then
    raise exception 'INVALID_TRANSFER_TYPE: Loai giao dich khong hop le.';
  end if;
  if p_amount_in is null or p_amount_out is null or p_amount_in < 0 or p_amount_out < 0 then
    raise exception 'INVALID_SEPAY_AMOUNT: So tien SePay khong hop le.';
  end if;
  if (p_transfer_type = 'in' and (p_amount_in <= 0 or p_amount_out <> 0))
    or (p_transfer_type = 'out' and (p_amount_out <= 0 or p_amount_in <> 0))
  then
    raise exception 'INVALID_SEPAY_AMOUNT_DIRECTION: So tien khong khop loai giao dich.';
  end if;
  if coalesce(p_account_purpose, 'unknown') not in ('new_enrollment', 'renewal', 'unknown') then
    raise exception 'INVALID_ACCOUNT_PURPOSE: Muc dich tai khoan nhan khong hop le.';
  end if;
  if p_ingestion_source not in ('webhook', 'api_v2') then
    raise exception 'INVALID_INGESTION_SOURCE: Nguon giao dich khong hop le.';
  end if;

  v_amount := case when p_transfer_type = 'in' then p_amount_in else p_amount_out end;
  v_source_key := case p_ingestion_source when 'api_v2' then 'api_v2' else 'webhook' end;
  v_fingerprint := pg_catalog.concat_ws(
    '|',
    public.normalize_sepay_receiving_account_number(p_account_number),
    p_transfer_type,
    v_amount::text,
    p_transaction_date::text,
    pg_catalog.btrim(p_content)
  );

  if nullif(pg_catalog.btrim(p_reference_number), '') is not null then
    v_reference_fingerprint := pg_catalog.concat_ws(
      '|',
      public.normalize_sepay_receiving_account_number(p_account_number),
      p_transfer_type,
      v_amount::text,
      pg_catalog.btrim(p_reference_number)
    );
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_reference_fingerprint, 0)
    );
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_fingerprint, 0));

  if p_sepay_v2_id is not null then
    select transaction.*
    into v_existing
    from public.sepay_transactions as transaction
    where transaction.sepay_v2_id = p_sepay_v2_id
    for update;

    if found then
      update public.sepay_transactions
      set
        sepay_webhook_id = coalesce(sepay_webhook_id, p_sepay_webhook_id),
        account_purpose = case
          when account_purpose = 'unknown' and p_account_purpose in ('new_enrollment', 'renewal')
            then p_account_purpose
          else account_purpose
        end,
        ingestion_source = case
          when sepay_webhook_id is distinct from p_sepay_webhook_id and p_sepay_webhook_id is not null
            then 'reconciled'
          else ingestion_source
        end,
        source_payloads = source_payloads
          || pg_catalog.jsonb_build_object(
            v_source_key,
            pg_catalog.jsonb_build_object('recorded', true)
          )
      where id = v_existing.id
      returning * into v_existing;

      return query select v_existing.id, 'duplicate'::text, v_existing.match_status;
      return;
    end if;
  end if;

  select pg_catalog.count(*)
  into v_candidate_count
  from public.sepay_transactions as transaction
  where public.normalize_sepay_receiving_account_number(transaction.account_number)
      = public.normalize_sepay_receiving_account_number(p_account_number)
    and transaction.transfer_type = p_transfer_type
    and transaction.amount_vnd = v_amount
    and (
      (
        nullif(pg_catalog.btrim(p_reference_number), '') is not null
        and nullif(pg_catalog.btrim(transaction.reference_number), '')
          = nullif(pg_catalog.btrim(p_reference_number), '')
      )
      or (
        transaction.transaction_at = p_transaction_date
        and pg_catalog.btrim(transaction.transfer_content) = pg_catalog.btrim(p_content)
      )
    )
    and (
      (p_sepay_v2_id is not null and transaction.sepay_v2_id is null)
      or (p_sepay_webhook_id is not null and transaction.sepay_webhook_id is null)
    );

  if v_candidate_count = 1 then
    select transaction.id
    into v_candidate_id
    from public.sepay_transactions as transaction
    where public.normalize_sepay_receiving_account_number(transaction.account_number)
        = public.normalize_sepay_receiving_account_number(p_account_number)
      and transaction.transfer_type = p_transfer_type
      and transaction.amount_vnd = v_amount
      and (
        (
          nullif(pg_catalog.btrim(p_reference_number), '') is not null
          and nullif(pg_catalog.btrim(transaction.reference_number), '')
            = nullif(pg_catalog.btrim(p_reference_number), '')
        )
        or (
          transaction.transaction_at = p_transaction_date
          and pg_catalog.btrim(transaction.transfer_content) = pg_catalog.btrim(p_content)
        )
      )
      and (
        (p_sepay_v2_id is not null and transaction.sepay_v2_id is null)
        or (p_sepay_webhook_id is not null and transaction.sepay_webhook_id is null)
      )
    for update;

    update public.sepay_transactions
    set
      sepay_webhook_id = coalesce(sepay_webhook_id, p_sepay_webhook_id),
      sepay_v2_id = coalesce(sepay_v2_id, p_sepay_v2_id),
      account_purpose = case
        when account_purpose = 'unknown' and p_account_purpose in ('new_enrollment', 'renewal')
          then p_account_purpose
        else account_purpose
      end,
      reference_number = coalesce(reference_number, nullif(pg_catalog.btrim(p_reference_number), '')),
      ingestion_source = 'reconciled',
      source_payloads = source_payloads
        || pg_catalog.jsonb_build_object(
          v_source_key,
          pg_catalog.jsonb_build_object('recorded', true)
        )
    where id = v_candidate_id
    returning * into v_existing;

    return query select v_existing.id, 'linked'::text, v_existing.match_status;
    return;
  end if;

  insert into public.sepay_transactions (
    sepay_webhook_id,
    sepay_v2_id,
    bank_transaction_id,
    bank_brand,
    account_number,
    account_purpose,
    amount_vnd,
    transfer_content,
    transaction_at,
    transfer_type,
    reference_number,
    ingestion_source,
    source_payloads,
    match_status
  )
  values (
    p_sepay_webhook_id,
    p_sepay_v2_id,
    pg_catalog.btrim(p_external_transaction_id),
    pg_catalog.btrim(p_gateway),
    pg_catalog.btrim(p_account_number),
    coalesce(p_account_purpose, 'unknown'),
    v_amount,
    p_content,
    p_transaction_date,
    p_transfer_type,
    nullif(pg_catalog.btrim(p_reference_number), ''),
    p_ingestion_source,
    pg_catalog.jsonb_build_object(
      v_source_key,
      pg_catalog.jsonb_build_object('recorded', true)
    ),
    case when v_candidate_count > 1 then 'identity_conflict' else 'unmatched' end
  )
  returning * into v_existing;

  return query
  select
    v_existing.id,
    case when v_candidate_count > 1 then 'ambiguous' else 'new' end,
    v_existing.match_status;
end;
$$;

revoke all on function public.ingest_sepay_transaction_record(
  uuid, uuid, text, text, timestamptz, text, text, text, text, text,
  bigint, bigint, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.ingest_sepay_transaction_record(
  uuid, uuid, text, text, timestamptz, text, text, text, text, text,
  bigint, bigint, text, text, jsonb
) to service_role;

create or replace function public.ingest_sepay_api_v2_transaction(
  p_sepay_v2_id uuid,
  p_gateway text,
  p_transaction_date timestamptz,
  p_account_number text,
  p_code text,
  p_content text,
  p_transfer_type text,
  p_amount_in bigint,
  p_amount_out bigint,
  p_reference_number text default null,
  p_body_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_purpose text := 'unknown';
  v_ingestion record;
begin
  if p_sepay_v2_id is null then
    raise exception 'INVALID_SEPAY_V2_ID: UUID giao dich SePay khong hop le.';
  end if;

  select resolution.purpose
  into v_account_purpose
  from public.resolve_sepay_receiving_account(
    p_account_number,
    p_transaction_date
  ) as resolution;

  select *
  into v_ingestion
  from public.ingest_sepay_transaction_record(
    p_sepay_webhook_id => null,
    p_sepay_v2_id => p_sepay_v2_id,
    p_external_transaction_id => p_sepay_v2_id::text,
    p_gateway => p_gateway,
    p_transaction_date => p_transaction_date,
    p_account_number => p_account_number,
    p_account_purpose => coalesce(v_account_purpose, 'unknown'),
    p_code => p_code,
    p_content => p_content,
    p_transfer_type => p_transfer_type,
    p_amount_in => p_amount_in,
    p_amount_out => p_amount_out,
    p_reference_number => p_reference_number,
    p_ingestion_source => 'api_v2',
    p_source_payload => p_body_raw
  );

  return pg_catalog.jsonb_build_object(
    'status', case
      when v_ingestion.identity_status = 'duplicate' then 'ignored'
      when v_ingestion.identity_status = 'ambiguous' then 'manual_review'
      else 'recorded'
    end,
    'mode', 'record_only',
    'identity_status', v_ingestion.identity_status,
    'sepay_v2_id', p_sepay_v2_id,
    'transaction_id', v_ingestion.transaction_id,
    'match_status', v_ingestion.current_match_status
  );
end;
$$;

revoke all on function public.ingest_sepay_api_v2_transaction(
  uuid, text, timestamptz, text, text, text, text, bigint, bigint, text, jsonb
) from public, anon, authenticated;
grant execute on function public.ingest_sepay_api_v2_transaction(
  uuid, text, timestamptz, text, text, text, text, bigint, bigint, text, jsonb
) to service_role;

create or replace function public.process_sepay_webhook_transaction(
  p_sepay_id bigint,
  p_gateway text,
  p_transaction_date timestamptz,
  p_account_number text,
  p_code text,
  p_content text,
  p_transfer_type text,
  p_amount_in bigint,
  p_amount_out bigint,
  p_account_purpose text,
  p_reference_number text default null,
  p_body_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook_id uuid;
  v_tx_id uuid;
  v_payment_request public.student_payment_requests%rowtype;
  v_credit_lot_id uuid;
  v_unit_price bigint;
  v_matching_request_count integer;
  v_expected_topup_type text;
  v_ingestion record;
  v_was_imported_from_history boolean := false;
begin
  if p_sepay_id is null or p_sepay_id <= 0 then
    raise exception 'INVALID_SEPAY_ID: Ma giao dich SePay khong hop le.';
  end if;

  if p_gateway is null or pg_catalog.btrim(p_gateway) = '' then
    raise exception 'INVALID_GATEWAY: Ngan hang khong hop le.';
  end if;

  if p_transaction_date is null then
    raise exception 'INVALID_TRANSACTION_DATE: Thoi gian giao dich khong hop le.';
  end if;

  if p_account_number is null or pg_catalog.btrim(p_account_number) = '' then
    raise exception 'INVALID_ACCOUNT_NUMBER: Tai khoan nhan khong hop le.';
  end if;

  if p_content is null or pg_catalog.btrim(p_content) = '' then
    raise exception 'INVALID_TRANSFER_CONTENT: Noi dung chuyen khoan khong hop le.';
  end if;

  if p_transfer_type is null or p_transfer_type not in ('in', 'out') then
    raise exception 'INVALID_TRANSFER_TYPE: Loai giao dich khong hop le.';
  end if;

  if p_amount_in is null
    or p_amount_out is null
    or p_amount_in < 0
    or p_amount_out < 0
  then
    raise exception 'INVALID_SEPAY_AMOUNT: So tien SePay khong hop le.';
  end if;

  if coalesce(p_account_purpose, 'unknown') not in (
    'new_enrollment',
    'renewal',
    'unknown'
  ) then
    raise exception 'INVALID_ACCOUNT_PURPOSE: Muc dich tai khoan nhan khong hop le.';
  end if;

  insert into public.sepay_webhooks (
    sepay_id,
    gateway,
    transaction_date,
    account_number,
    code,
    content,
    transfer_type,
    amount_in,
    amount_out,
    reference_number,
    body_raw,
    processing_status
  )
  values (
    p_sepay_id,
    pg_catalog.btrim(p_gateway),
    p_transaction_date,
    pg_catalog.btrim(p_account_number),
    nullif(pg_catalog.btrim(p_code), ''),
    p_content,
    p_transfer_type,
    coalesce(p_amount_in, 0),
    coalesce(p_amount_out, 0),
    nullif(pg_catalog.btrim(p_reference_number), ''),
    coalesce(p_body_raw, '{}'::jsonb),
    'pending'
  )
  on conflict (sepay_id) do nothing
  returning id into v_webhook_id;

  if v_webhook_id is null then
    return pg_catalog.jsonb_build_object(
      'status', 'ignored',
      'reason', 'ALREADY_PROCESSED',
      'sepay_id', p_sepay_id
    );
  end if;

  select *
  into v_ingestion
  from public.ingest_sepay_transaction_record(
    p_sepay_webhook_id => v_webhook_id,
    p_sepay_v2_id => null,
    p_external_transaction_id => p_sepay_id::text,
    p_gateway => p_gateway,
    p_transaction_date => p_transaction_date,
    p_account_number => p_account_number,
    p_account_purpose => p_account_purpose,
    p_code => p_code,
    p_content => p_content,
    p_transfer_type => p_transfer_type,
    p_amount_in => p_amount_in,
    p_amount_out => p_amount_out,
    p_reference_number => p_reference_number,
    p_ingestion_source => 'webhook',
    p_source_payload => p_body_raw
  );

  v_tx_id := v_ingestion.transaction_id;

  select transaction.source_payloads ? 'api_v2'
  into v_was_imported_from_history
  from public.sepay_transactions as transaction
  where transaction.id = v_tx_id;

  if v_ingestion.identity_status = 'ambiguous' then
    update public.sepay_webhooks
    set
      processing_status = 'failed',
      error_message = 'AMBIGUOUS_TRANSACTION_IDENTITY',
      processed_at = pg_catalog.now()
    where id = v_webhook_id;

    return pg_catalog.jsonb_build_object(
      'status', 'manual_review',
      'reason', 'AMBIGUOUS_TRANSACTION_IDENTITY',
      'sepay_id', p_sepay_id,
      'webhook_id', v_webhook_id,
      'transaction_id', v_tx_id
    );
  end if;

  if v_ingestion.current_match_status <> 'unmatched' then
    update public.sepay_webhooks
    set
      processing_status = 'processed',
      processed_at = pg_catalog.now()
    where id = v_webhook_id;

    return pg_catalog.jsonb_build_object(
      'status', 'ignored',
      'reason', 'TRANSACTION_ALREADY_RECONCILED',
      'sepay_id', p_sepay_id,
      'webhook_id', v_webhook_id,
      'transaction_id', v_tx_id
    );
  end if;

  -- A transaction first recorded by the history import is never allowed to
  -- settle through a delayed or replayed webhook. It must remain visible for
  -- an explicit, audited reconciliation decision.
  if v_was_imported_from_history then
    update public.sepay_webhooks
    set
      processing_status = 'failed',
      error_message = 'HISTORICAL_TRANSACTION_REQUIRES_REVIEW',
      processed_at = pg_catalog.now()
    where id = v_webhook_id;

    return pg_catalog.jsonb_build_object(
      'status', 'manual_review',
      'reason', 'HISTORICAL_TRANSACTION_REQUIRES_REVIEW',
      'sepay_id', p_sepay_id,
      'webhook_id', v_webhook_id,
      'transaction_id', v_tx_id
    );
  end if;

  if p_transfer_type = 'out' or coalesce(p_amount_in, 0) <= 0 then
    update public.sepay_webhooks
    set
      processing_status = 'ignored',
      processed_at = pg_catalog.now()
    where id = v_webhook_id;

    return pg_catalog.jsonb_build_object(
      'status', 'ignored',
      'reason', 'OUTGOING_TRANSACTION',
      'sepay_id', p_sepay_id,
      'webhook_id', v_webhook_id,
      'transaction_id', v_tx_id
    );
  end if;

  -- Keep an unrecognised account in the raw/parsed history, but do not let it
  -- create payment credits, allocations, or cashflow automatically.
  if coalesce(p_account_purpose, 'unknown') = 'unknown' then
    update public.sepay_webhooks
    set
      processing_status = 'ignored',
      error_message = 'UNCONFIGURED_RECEIVING_ACCOUNT',
      processed_at = pg_catalog.now()
    where id = v_webhook_id;

    return pg_catalog.jsonb_build_object(
      'status', 'ignored',
      'reason', 'UNCONFIGURED_RECEIVING_ACCOUNT',
      'sepay_id', p_sepay_id,
      'webhook_id', v_webhook_id,
      'transaction_id', v_tx_id
    );
  end if;

  select pg_catalog.count(*)
  into v_matching_request_count
  from public.student_payment_requests as request
  where request.status = 'pending'
    and (
      p_content ilike '%' || request.transfer_code || '%'
      or p_content ilike '%' || request.public_code || '%'
      or (
        p_code is not null
        and pg_catalog.btrim(p_code) <> ''
        and (
          request.transfer_code = pg_catalog.btrim(p_code)
          or request.public_code = pg_catalog.btrim(p_code)
        )
      )
    );

  if v_matching_request_count > 1 then
    update public.sepay_webhooks
    set
      processing_status = 'failed',
      error_message = 'AMBIGUOUS_PAYMENT_REFERENCE',
      processed_at = pg_catalog.now()
    where id = v_webhook_id;

    return pg_catalog.jsonb_build_object(
      'status', 'manual_review',
      'reason', 'AMBIGUOUS_PAYMENT_REFERENCE',
      'sepay_id', p_sepay_id,
      'webhook_id', v_webhook_id,
      'transaction_id', v_tx_id
    );
  end if;

  if v_matching_request_count = 1 then
    select request.*
    into v_payment_request
    from public.student_payment_requests as request
    where request.status = 'pending'
      and (
        p_content ilike '%' || request.transfer_code || '%'
        or p_content ilike '%' || request.public_code || '%'
        or (
          p_code is not null
          and pg_catalog.btrim(p_code) <> ''
          and (
            request.transfer_code = pg_catalog.btrim(p_code)
            or request.public_code = pg_catalog.btrim(p_code)
          )
        )
      )
    for update;

    if found then
      if v_payment_request.student_id is null then
        update public.sepay_webhooks
        set
          processing_status = 'failed',
          error_message = 'PAYMENT_REQUEST_STUDENT_REQUIRED',
          processed_at = pg_catalog.now()
        where id = v_webhook_id;

        return pg_catalog.jsonb_build_object(
          'status', 'manual_review',
          'reason', 'PAYMENT_REQUEST_STUDENT_REQUIRED',
          'sepay_id', p_sepay_id,
          'webhook_id', v_webhook_id,
          'transaction_id', v_tx_id
        );
      end if;

      v_expected_topup_type := case p_account_purpose
        when 'new_enrollment' then 'new'
        when 'renewal' then 'renewal'
      end;

      if v_payment_request.topup_type is distinct from v_expected_topup_type then
        update public.sepay_transactions
        set
          matched_payment_request_id = v_payment_request.id,
          matched_student_id = v_payment_request.student_id,
          match_status = 'account_purpose_mismatch',
          matched_at = pg_catalog.now()
        where id = v_tx_id;

        update public.sepay_webhooks
        set
          processing_status = 'failed',
          error_message = 'ACCOUNT_PURPOSE_TOPUP_TYPE_MISMATCH',
          processed_at = pg_catalog.now()
        where id = v_webhook_id;

        return pg_catalog.jsonb_build_object(
          'status', 'manual_review',
          'reason', 'ACCOUNT_PURPOSE_TOPUP_TYPE_MISMATCH',
          'sepay_id', p_sepay_id,
          'webhook_id', v_webhook_id,
          'transaction_id', v_tx_id,
          'matched_payment_request_id', v_payment_request.id
        );
      end if;

      if p_amount_in <> v_payment_request.expected_amount_vnd then
        update public.sepay_transactions
        set
          matched_payment_request_id = v_payment_request.id,
          matched_student_id = v_payment_request.student_id,
          match_status = 'amount_mismatch',
          matched_at = pg_catalog.now()
        where id = v_tx_id;

        update public.sepay_webhooks
        set
          processing_status = 'processed',
          error_message = 'AMOUNT_MISMATCH',
          processed_at = pg_catalog.now()
        where id = v_webhook_id;

        return pg_catalog.jsonb_build_object(
          'status', 'manual_review',
          'reason', 'AMOUNT_MISMATCH',
          'sepay_id', p_sepay_id,
          'webhook_id', v_webhook_id,
          'transaction_id', v_tx_id,
          'matched_payment_request_id', v_payment_request.id
        );
      end if;

      v_unit_price := coalesce(
        nullif(v_payment_request.calculated_unit_price_vnd, 0),
        p_amount_in / v_payment_request.purchased_sessions
      );

      if v_unit_price <= 0 then
        raise exception 'INVALID_UNIT_PRICE: Don gia cua yeu cau nap tien khong hop le.';
      end if;

      update public.student_payment_requests
      set
        status = 'paid',
        paid_amount_vnd = p_amount_in,
        paid_at = p_transaction_date,
        calculated_unit_price_vnd = v_unit_price,
        updated_at = pg_catalog.now()
      where id = v_payment_request.id;

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
        status
      )
      values (
        v_payment_request.student_id,
        v_payment_request.id,
        v_tx_id,
        v_payment_request.purchased_sessions,
        v_payment_request.bonus_sessions,
        v_payment_request.purchased_sessions + v_payment_request.bonus_sessions,
        v_payment_request.purchased_sessions + v_payment_request.bonus_sessions,
        v_unit_price,
        v_payment_request.topup_type,
        'active'
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
        metadata
      )
      values (
        v_payment_request.student_id,
        'payment_credit',
        v_payment_request.purchased_sessions,
        p_transaction_date::date,
        'sepay-payment-credit:' || p_sepay_id::text,
        v_payment_request.public_code,
        v_unit_price,
        'Nap hoc phi tu dong qua SePay (' || pg_catalog.btrim(p_gateway) || ')',
        pg_catalog.jsonb_build_object(
          'credit_lot_id', v_credit_lot_id,
          'payment_request_id', v_payment_request.id,
          'sepay_id', p_sepay_id,
          'sepay_transaction_id', v_tx_id,
          'account_purpose', p_account_purpose
        )
      );

      if v_payment_request.bonus_sessions > 0 then
        insert into public.student_session_ledger_entries (
          student_id,
          entry_type,
          delta_sessions,
          effective_on,
          event_key,
          reference_code,
          unit_price_vnd,
          note,
          metadata
        )
        values (
          v_payment_request.student_id,
          'bonus_credit',
          v_payment_request.bonus_sessions,
          p_transaction_date::date,
          'sepay-bonus-credit:' || p_sepay_id::text,
          v_payment_request.public_code,
          null,
          'Tang buoi hoc kem goi nap SePay',
          pg_catalog.jsonb_build_object(
            'credit_lot_id', v_credit_lot_id,
            'payment_request_id', v_payment_request.id,
            'sepay_id', p_sepay_id,
            'sepay_transaction_id', v_tx_id,
            'account_purpose', p_account_purpose
          )
        );
      end if;

      insert into public.finance_cashflow_records (
        record_type,
        category,
        amount_vnd,
        student_id,
        sepay_transaction_id,
        reference_code,
        note
      )
      values (
        'receipt',
        'tuition_fee',
        p_amount_in,
        v_payment_request.student_id,
        v_tx_id,
        v_payment_request.public_code,
        'Thu hoc phi chuyen khoan SePay'
      );

      update public.sepay_transactions
      set
        matched_payment_request_id = v_payment_request.id,
        matched_student_id = v_payment_request.student_id,
        match_status = 'auto_matched',
        matched_at = pg_catalog.now()
      where id = v_tx_id;
    end if;
  end if;

  update public.sepay_webhooks
  set
    processing_status = 'processed',
    processed_at = pg_catalog.now()
  where id = v_webhook_id;

  return pg_catalog.jsonb_build_object(
    'status', 'success',
    'sepay_id', p_sepay_id,
    'webhook_id', v_webhook_id,
    'transaction_id', v_tx_id,
    'auto_matched', v_payment_request.id is not null,
    'matched_payment_request_id', v_payment_request.id
  );
end;
$$;


revoke all on function public.process_sepay_webhook_transaction(
  bigint, text, timestamptz, text, text, text, text, bigint, bigint, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.process_sepay_webhook_transaction(
  bigint, text, timestamptz, text, text, text, text, bigint, bigint, text, text, jsonb
) to service_role;

commit;
