-- Classify SePay receipts by the configured receiving account and expose
-- auditable, student-grain Finance Orders from canonical tuition receipts.
--
-- This is deliberately forward-only. Historical transactions do not contain a
-- trusted account-purpose snapshot, so they remain `unknown` rather than being
-- inferred from transfer content, a payment request, or a student record.

begin;

alter table public.sepay_transactions
  add column if not exists account_purpose text not null default 'unknown';

alter table public.sepay_transactions
  drop constraint if exists sepay_transactions_account_purpose_check;

alter table public.sepay_transactions
  add constraint sepay_transactions_account_purpose_check
  check (account_purpose in ('new_enrollment', 'renewal', 'unknown'));

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
      'account_purpose_mismatch'
    )
  );

create index if not exists sepay_transactions_account_purpose_time_idx
  on public.sepay_transactions (account_purpose, transaction_at desc);

create index if not exists finance_cashflow_records_tuition_sepay_idx
  on public.finance_cashflow_records (sepay_transaction_id)
  where record_type = 'receipt'
    and category = 'tuition_fee';

-- The prior eleven-argument webhook RPC cannot carry the trusted purpose that
-- was resolved from the receiving account. Remove it so PostgREST cannot select
-- a stale signature. The replacement below remains service-role only.
drop function if exists public.process_sepay_webhook_transaction(
  bigint,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  bigint,
  bigint,
  text,
  jsonb
);

create function public.process_sepay_webhook_transaction(
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

  insert into public.sepay_transactions (
    sepay_webhook_id,
    bank_transaction_id,
    bank_brand,
    account_number,
    account_purpose,
    amount_vnd,
    transfer_content,
    transaction_at,
    match_status
  )
  values (
    v_webhook_id,
    p_sepay_id::text,
    pg_catalog.btrim(p_gateway),
    pg_catalog.btrim(p_account_number),
    coalesce(p_account_purpose, 'unknown'),
    case
      when p_transfer_type = 'in' then greatest(coalesce(p_amount_in, 0), 1)
      else greatest(coalesce(p_amount_out, 0), 1)
    end,
    p_content,
    p_transaction_date,
    'unmatched'
  )
  returning id into v_tx_id;

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
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED: Vui long dang nhap.';
  end if;

  if not (
    public.has_permission('sepay.allocate')
    or public.has_permission('payments.manage')
  ) then
    raise exception 'SEPAY_ALLOCATE_PERMISSION_DENIED: Khong co quyen phan bo hoc phi.';
  end if;

  if p_sepay_transaction_id is null then
    raise exception 'TRANSACTION_NOT_FOUND: Giao dich SePay khong ton tai.';
  end if;

  if p_guardian_id is null then
    raise exception 'GUARDIAN_ID_REQUIRED: Thieu phu huynh phan bo.';
  end if;

  if p_allocations is null
    or pg_catalog.jsonb_typeof(p_allocations) <> 'array'
    or pg_catalog.jsonb_array_length(p_allocations) = 0
  then
    raise exception 'EMPTY_ALLOCATIONS: Can phan bo it nhat 1 hoc vien.';
  end if;

  select
    tx.*,
    webhook.transfer_type as webhook_transfer_type
  into v_tx
  from public.sepay_transactions as tx
  left join public.sepay_webhooks as webhook
    on webhook.id = tx.sepay_webhook_id
  where tx.id = p_sepay_transaction_id
  for update of tx;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND: Giao dich SePay khong ton tai.';
  end if;

  if v_tx.webhook_transfer_type is distinct from 'in' then
    raise exception 'TRANSACTION_NOT_INBOUND: Chi giao dich chuyen vao moi duoc phan bo.';
  end if;

  if v_tx.account_purpose = 'unknown' then
    raise exception 'SEPAY_ACCOUNT_PURPOSE_UNRESOLVED: Tai khoan nhan cua giao dich chua duoc cau hinh.';
  end if;

  if v_tx.match_status <> 'unmatched' then
    raise exception 'TRANSACTION_NOT_AVAILABLE_FOR_ALLOCATION: Giao dich da duoc xu ly hoac dang can doi soat.';
  end if;

  if exists (
    select 1
    from public.payment_split_allocations as allocation
    where allocation.sepay_transaction_id = p_sepay_transaction_id
  ) then
    raise exception 'ALLOCATION_ALREADY_EXISTS: Giao dich da co phan bo.';
  end if;

  v_topup_type := case v_tx.account_purpose
    when 'new_enrollment' then 'new'
    when 'renewal' then 'renewal'
  end;

  for v_item in
    select item.value
    from pg_catalog.jsonb_array_elements(p_allocations) as item(value)
  loop
    begin
      v_student_id := (v_item ->> 'student_id')::uuid;
      v_amount_vnd := (v_item ->> 'allocated_amount_vnd')::bigint;
      v_purchased_sessions := (v_item ->> 'allocated_sessions')::integer;
      v_bonus_sessions := coalesce((v_item ->> 'bonus_sessions')::integer, 0);
      v_unit_price := coalesce(
        nullif((v_item ->> 'unit_price_vnd')::bigint, 0),
        v_amount_vnd / v_purchased_sessions
      );
    exception
      when others then
        raise exception 'INVALID_ALLOCATION_ITEM: Du lieu phan bo khong hop le.';
    end;

    if v_amount_vnd <= 0
      or v_purchased_sessions <= 0
      or v_bonus_sessions < 0
      or v_unit_price <= 0
    then
      raise exception 'INVALID_ALLOCATION_ITEM: Gia tri phan bo phai lon hon 0.';
    end if;

    if v_student_id = any(v_seen_student_ids) then
      raise exception 'DUPLICATE_ALLOCATION_STUDENT: Moi hoc vien chi duoc phan bo mot lan trong giao dich.';
    end if;

    if not exists (
      select 1
      from public.student_guardians as link
      where link.student_id = v_student_id
        and link.guardian_id = p_guardian_id
        and link.ended_at is null
    ) then
      raise exception 'STUDENT_GUARDIAN_MISMATCH: Hoc vien khong thuoc phu huynh da chon.';
    end if;

    v_seen_student_ids := pg_catalog.array_append(v_seen_student_ids, v_student_id);
    v_total_allocated := v_total_allocated + v_amount_vnd;
  end loop;

  if v_total_allocated <> v_tx.amount_vnd then
    raise exception 'ALLOCATION_TOTAL_MUST_MATCH_TRANSACTION: Tong tien phan bo (%) phai bang so tien giao dich (%).', v_total_allocated, v_tx.amount_vnd;
  end if;

  v_ref_code := 'SPLIT-' || pg_catalog.substr(p_sepay_transaction_id::text, 1, 8);

  for v_item in
    select item.value
    from pg_catalog.jsonb_array_elements(p_allocations) as item(value)
  loop
    v_student_id := (v_item ->> 'student_id')::uuid;
    v_amount_vnd := (v_item ->> 'allocated_amount_vnd')::bigint;
    v_purchased_sessions := (v_item ->> 'allocated_sessions')::integer;
    v_bonus_sessions := coalesce((v_item ->> 'bonus_sessions')::integer, 0);
    v_unit_price := coalesce(
      nullif((v_item ->> 'unit_price_vnd')::bigint, 0),
      v_amount_vnd / v_purchased_sessions
    );

    insert into public.student_credit_lots (
      student_id,
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
      v_student_id,
      p_sepay_transaction_id,
      v_purchased_sessions,
      v_bonus_sessions,
      v_purchased_sessions + v_bonus_sessions,
      v_purchased_sessions + v_bonus_sessions,
      v_unit_price,
      v_topup_type,
      'active',
      v_actor_id
    )
    returning id into v_credit_lot_id;

    insert into public.payment_split_allocations (
      sepay_transaction_id,
      guardian_id,
      student_id,
      allocated_amount_vnd,
      allocated_sessions,
      bonus_sessions,
      unit_price_vnd,
      credit_lot_id,
      notes,
      allocated_by
    )
    values (
      p_sepay_transaction_id,
      p_guardian_id,
      v_student_id,
      v_amount_vnd,
      v_purchased_sessions,
      v_bonus_sessions,
      v_unit_price,
      v_credit_lot_id,
      nullif(pg_catalog.btrim(v_item ->> 'notes'), ''),
      v_actor_id
    );

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
      v_student_id,
      'payment_credit',
      v_purchased_sessions,
      current_date,
      'sepay-split-payment-credit:' || p_sepay_transaction_id::text || ':' || v_student_id::text,
      v_ref_code,
      v_unit_price,
      'Nap hoc phi phan bo nhieu con',
      pg_catalog.jsonb_build_object(
        'account_purpose', v_tx.account_purpose,
        'allocation_amount_vnd', v_amount_vnd,
        'credit_lot_id', v_credit_lot_id,
        'guardian_id', p_guardian_id,
        'sepay_transaction_id', p_sepay_transaction_id
      ),
      v_actor_id
    );

    if v_bonus_sessions > 0 then
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
        v_student_id,
        'bonus_credit',
        v_bonus_sessions,
        current_date,
        'sepay-split-bonus-credit:' || p_sepay_transaction_id::text || ':' || v_student_id::text,
        v_ref_code,
        null,
        'Tang buoi hoc kem phan bo nhieu con',
        pg_catalog.jsonb_build_object(
          'account_purpose', v_tx.account_purpose,
          'credit_lot_id', v_credit_lot_id,
          'guardian_id', p_guardian_id,
          'sepay_transaction_id', p_sepay_transaction_id
        ),
        v_actor_id
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
      v_amount_vnd,
      v_student_id,
      p_sepay_transaction_id,
      v_ref_code,
      'Phan bo hoc phi cho hoc vien',
      v_actor_id
    );
  end loop;

  update public.sepay_transactions
  set
    match_status = 'split_allocated',
    matched_by = v_actor_id,
    matched_at = pg_catalog.now()
  where id = p_sepay_transaction_id;

  return pg_catalog.jsonb_build_object(
    'status', 'success',
    'sepay_transaction_id', p_sepay_transaction_id,
    'total_allocated_vnd', v_total_allocated
  );
end;
$$;

-- The calculation is SQL-only and intentionally returns NULL (not zero) for
-- policies that the product has not configured. Integer arithmetic truncates
-- fractional VND toward zero, i.e. rounds down for these positive values.
create function public.get_finance_order_operating_cost(
  p_order_type text,
  p_source_group text,
  p_source_code text,
  p_tuition_amount_vnd bigint
)
returns table (
  status text,
  mechanism_code text,
  operating_cost_vnd bigint
)
language sql
immutable
set search_path = ''
as $$
  select
    case
      when p_tuition_amount_vnd <= 0 then 'unconfigured'
      when p_source_group = 'sandbox'
        and lower(coalesce(p_source_code, '')) ~ '(^|[_-])f1([_-]|$)'
        then 'unconfigured'
      when p_order_type = 'renewal' and p_source_group in ('sandbox', 'mma') then 'configured'
      when p_order_type = 'new_enrollment' and p_source_group = 'sandbox' then 'configured'
      else 'unconfigured'
    end as status,
    case
      when p_source_group = 'sandbox'
        and lower(coalesce(p_source_code, '')) ~ '(^|[_-])f1([_-]|$)'
        then 'unconfigured'
      when p_order_type = 'renewal' and p_source_group = 'sandbox' then 'renewal_sb_20_percent'
      when p_order_type = 'renewal' and p_source_group = 'mma' then 'renewal_mma_zero'
      when p_order_type = 'new_enrollment' and p_source_group = 'sandbox' then 'new_enrollment_sb_fixed_plus_25_percent'
      else 'unconfigured'
    end as mechanism_code,
    case
      when p_tuition_amount_vnd <= 0 then null
      when p_source_group = 'sandbox'
        and lower(coalesce(p_source_code, '')) ~ '(^|[_-])f1([_-]|$)'
        then null
      when p_order_type = 'renewal' and p_source_group = 'sandbox'
        then (p_tuition_amount_vnd * 20) / 100
      when p_order_type = 'renewal' and p_source_group = 'mma' then 0
      when p_order_type = 'new_enrollment' and p_source_group = 'sandbox'
        then 700000 + ((p_tuition_amount_vnd * 25) / 100)
      else null
    end as operating_cost_vnd;
$$;

revoke all on function public.get_finance_order_operating_cost(text, text, text, bigint)
from public, anon, authenticated;

create function public.get_finance_order_settlement_period(p_at timestamptz)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(day from (p_at at time zone 'Asia/Ho_Chi_Minh')) <= 10 then 1
    when extract(day from (p_at at time zone 'Asia/Ho_Chi_Minh')) <= 20 then 2
    else 3
  end::smallint;
$$;

revoke all on function public.get_finance_order_settlement_period(timestamptz)
from public, anon, authenticated;

create table public.finance_order_reviews (
  source_cashflow_record_id uuid primary key
    references public.finance_cashflow_records(id) on delete restrict,
  is_checked boolean not null default false,
  checked_at timestamptz,
  checked_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint finance_order_reviews_checked_state_check
    check (
      (is_checked and checked_at is not null and checked_by is not null)
      or (not is_checked and checked_at is null and checked_by is null)
    )
);

create trigger finance_order_reviews_touch_updated_at
before update on public.finance_order_reviews
for each row execute function public.touch_finance_updated_at();

alter table public.finance_order_reviews enable row level security;
revoke all privileges on public.finance_order_reviews from public, anon, authenticated;

create function public.set_finance_order_review(
  p_source_cashflow_record_id uuid,
  p_is_checked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_cashflow public.finance_cashflow_records%rowtype;
  v_previous_checked boolean := false;
  v_previous_checked_at timestamptz;
  v_previous_checked_by uuid;
  v_previous jsonb;
  v_current jsonb;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if p_is_checked is null then
    raise exception using errcode = '22004', message = 'FINANCE_ORDER_REVIEW_STATE_REQUIRED';
  end if;

  if not public.has_permission('payments.manage') then
    raise exception using errcode = '42501', message = 'PAYMENTS_MANAGE_PERMISSION_DENIED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_source_cashflow_record_id::text, 0)
  );

  select *
  into v_cashflow
  from public.finance_cashflow_records
  where id = p_source_cashflow_record_id
  for share;

  if not found
    or v_cashflow.record_type <> 'receipt'
    or v_cashflow.category <> 'tuition_fee'
    or v_cashflow.student_id is null
    or v_cashflow.sepay_transaction_id is null
  then
    raise exception using errcode = 'P0002', message = 'FINANCE_ORDER_NOT_FOUND';
  end if;

  select is_checked, checked_at, checked_by
  into v_previous_checked, v_previous_checked_at, v_previous_checked_by
  from public.finance_order_reviews
  where source_cashflow_record_id = p_source_cashflow_record_id
  for update;

  v_previous := pg_catalog.jsonb_build_object(
    'is_checked', coalesce(v_previous_checked, false),
    'checked_at', v_previous_checked_at,
    'checked_by', v_previous_checked_by
  );

  if coalesce(v_previous_checked, false) is distinct from p_is_checked then
    insert into public.finance_order_reviews (
      source_cashflow_record_id,
      is_checked,
      checked_at,
      checked_by
    )
    values (
      p_source_cashflow_record_id,
      p_is_checked,
      case when p_is_checked then pg_catalog.now() else null end,
      case when p_is_checked then v_actor_id else null end
    )
    on conflict (source_cashflow_record_id) do update
    set
      is_checked = excluded.is_checked,
      checked_at = excluded.checked_at,
      checked_by = excluded.checked_by;

    v_current := pg_catalog.jsonb_build_object(
      'is_checked', p_is_checked,
      'checked_at', case when p_is_checked then pg_catalog.now() else null end,
      'checked_by', case when p_is_checked then v_actor_id else null end,
      'source_cashflow_record_id', p_source_cashflow_record_id
    );

    insert into public.audit_logs (
      actor_user_id,
      module,
      action,
      entity_type,
      entity_id,
      old_data,
      new_data,
      metadata
    )
    values (
      v_actor_id,
      'finance',
      case when p_is_checked then 'finance_order_checked' else 'finance_order_unchecked' end,
      'finance_order_review',
      p_source_cashflow_record_id::text,
      v_previous,
      v_current,
      pg_catalog.jsonb_build_object(
        'source_cashflow_record_id', p_source_cashflow_record_id,
        'source_sepay_transaction_id', v_cashflow.sepay_transaction_id
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'source_cashflow_record_id', p_source_cashflow_record_id,
    'is_checked', p_is_checked
  );
end;
$$;

revoke all on function public.set_finance_order_review(uuid, boolean)
from public, anon;
grant execute on function public.set_finance_order_review(uuid, boolean)
to authenticated;

create function public.get_finance_orders_dashboard(
  p_month date,
  p_order_type text default null,
  p_source text default null,
  p_period smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month_end date;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('finance.view') then
    raise exception using errcode = '42501', message = 'FINANCE_VIEW_PERMISSION_DENIED';
  end if;

  if p_month is null
    or p_month <> pg_catalog.date_trunc('month', p_month::timestamp)::date
  then
    raise exception using errcode = '22007', message = 'INVALID_FINANCE_ORDER_MONTH';
  end if;

  if p_order_type is not null and p_order_type not in ('new_enrollment', 'renewal') then
    raise exception using errcode = '22023', message = 'INVALID_FINANCE_ORDER_TYPE';
  end if;

  if p_source is not null and p_source not in ('mma', 'sb') then
    raise exception using errcode = '22023', message = 'INVALID_FINANCE_ORDER_SOURCE';
  end if;

  if p_period is not null and p_period not in (1, 2, 3) then
    raise exception using errcode = '22023', message = 'INVALID_FINANCE_ORDER_PERIOD';
  end if;

  v_month_end := (p_month + interval '1 month')::date;

  with base_orders as materialized (
    select
      cashflow.id as source_cashflow_record_id,
      transaction.id as sepay_transaction_id,
      transaction.bank_transaction_id,
      transaction.transaction_at,
      transaction.account_purpose as order_type,
      cashflow.amount_vnd as tuition_amount_vnd,
      cashflow.reference_code,
      student.id as student_id,
      student.public_code as student_public_code,
      student.full_name as student_full_name,
      guardian.full_name as guardian_full_name,
      accrual.sale_owner_id,
      sale.display_name as sale_owner_full_name,
      accrual.lead_source_code,
      accrual.lead_source_name,
      accrual.lead_source_group,
      case accrual.lead_source_group
        when 'mma' then 'mma'
        when 'sandbox' then 'sb'
        else null
      end as source_code,
      case
        when accrual.lead_source_group = 'sandbox'
          and lower(coalesce(accrual.lead_source_code, '')) ~ '(^|[_-])f1([_-]|$)'
          then 'SB F1'
        when accrual.lead_source_group = 'mma' then 'MMA'
        when accrual.lead_source_group = 'sandbox' then 'SB'
        else null
      end as source_label,
      (
        accrual.lead_source_group = 'sandbox'
        and lower(coalesce(accrual.lead_source_code, '')) ~ '(^|[_-])f1([_-]|$)'
      ) as is_sb_f1,
      class_row.code as class_code,
      class_row.name as class_name,
      public.get_finance_order_settlement_period(transaction.transaction_at) as settlement_period,
      review.is_checked,
      review.checked_at,
      review.checked_by,
      cost.status as operating_cost_status,
      cost.mechanism_code,
      cost.operating_cost_vnd
    from public.sepay_transactions as transaction
    join public.finance_cashflow_records as cashflow
      on cashflow.sepay_transaction_id = transaction.id
      and cashflow.record_type = 'receipt'
      and cashflow.category = 'tuition_fee'
      and cashflow.student_id is not null
    join public.students as student
      on student.id = cashflow.student_id
    left join public.sales_commission_accruals as accrual
      on accrual.source_cashflow_record_id = cashflow.id
    left join public.profiles as sale
      on sale.id = accrual.sale_owner_id
    left join lateral (
      select guardian_row.full_name
      from public.student_guardians as link
      join public.guardians as guardian_row
        on guardian_row.id = link.guardian_id
      where link.student_id = cashflow.student_id
        and link.is_primary
        and link.linked_at <= transaction.transaction_at
        and (link.ended_at is null or link.ended_at >= transaction.transaction_at)
      order by link.linked_at desc, link.id desc
      limit 1
    ) as guardian on true
    left join lateral (
      select class_value.code, class_value.name
      from public.student_enrollments as enrollment
      join public.classes as class_value
        on class_value.id = enrollment.class_id
      where enrollment.student_id = cashflow.student_id
        and enrollment.effective_from <= (transaction.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date
        and (
          enrollment.effective_to is null
          or enrollment.effective_to >= (transaction.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date
        )
      order by enrollment.effective_from desc, enrollment.id desc
      limit 1
    ) as class_row on true
    left join public.finance_order_reviews as review
      on review.source_cashflow_record_id = cashflow.id
    cross join lateral public.get_finance_order_operating_cost(
      transaction.account_purpose,
      accrual.lead_source_group,
      accrual.lead_source_code,
      cashflow.amount_vnd
    ) as cost
    where (transaction.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_month
      and (transaction.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month_end
  ), filtered_orders as materialized (
    select *
    from base_orders
    where (p_order_type is null or order_type = p_order_type)
      and (p_source is null or source_code = p_source)
      and (p_period is null or settlement_period = p_period)
  ), summary as (
    select
      pg_catalog.count(*)::integer as order_count,
      coalesce(pg_catalog.sum(tuition_amount_vnd), 0)::bigint as tuition_amount_vnd,
      coalesce(pg_catalog.sum(operating_cost_vnd) filter (where operating_cost_vnd is not null), 0)::bigint as operating_cost_vnd,
      pg_catalog.count(*) filter (where operating_cost_status = 'unconfigured')::integer as unconfigured_count,
      pg_catalog.count(*) filter (where coalesce(is_checked, false))::integer as checked_count,
      pg_catalog.count(*) filter (where not coalesce(is_checked, false))::integer as unchecked_count
    from filtered_orders
  ), settlement as (
    select
      settlement_period,
      pg_catalog.count(*) filter (where order_type = 'new_enrollment')::integer as new_enrollment_count,
      pg_catalog.count(*) filter (where order_type = 'renewal')::integer as renewal_count,
      coalesce(pg_catalog.sum(tuition_amount_vnd), 0)::bigint as tuition_amount_vnd,
      coalesce(pg_catalog.sum(operating_cost_vnd) filter (where operating_cost_vnd is not null), 0)::bigint as operating_cost_vnd,
      pg_catalog.count(*) filter (where operating_cost_status = 'unconfigured')::integer as unconfigured_count,
      pg_catalog.count(*) filter (where coalesce(is_checked, false))::integer as checked_count,
      pg_catalog.count(*) filter (where not coalesce(is_checked, false))::integer as unchecked_count
    from filtered_orders
    where source_code = 'sb'
      and not is_sb_f1
    group by settlement_period
  )
  select pg_catalog.jsonb_build_object(
    'month', p_month,
    'summary', (
      select pg_catalog.jsonb_build_object(
        'orderCount', order_count,
        'tuitionAmountVnd', tuition_amount_vnd,
        'operatingCostVnd', operating_cost_vnd,
        'unconfiguredCount', unconfigured_count,
        'checkedCount', checked_count,
        'uncheckedCount', unchecked_count
      )
      from summary
    ),
    'settlementEligible', p_source is distinct from 'mma',
    'settlement', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'period', settlement_period,
          'newEnrollmentCount', new_enrollment_count,
          'renewalCount', renewal_count,
          'tuitionAmountVnd', tuition_amount_vnd,
          'operatingCostVnd', operating_cost_vnd,
          'unconfiguredCount', unconfigured_count,
          'checkedCount', checked_count,
          'uncheckedCount', unchecked_count
        )
        order by settlement_period
      )
      from settlement
    ), '[]'::jsonb),
    'orders', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'sourceCashflowRecordId', source_cashflow_record_id,
          'sepayTransactionId', sepay_transaction_id,
          'bankTransactionId', bank_transaction_id,
          'transactionAt', transaction_at,
          'orderType', order_type,
          'tuitionAmountVnd', tuition_amount_vnd,
          'referenceCode', reference_code,
          'studentId', student_id,
          'studentPublicCode', student_public_code,
          'studentFullName', student_full_name,
          'guardianFullName', guardian_full_name,
          'saleOwnerId', sale_owner_id,
          'saleOwnerFullName', sale_owner_full_name,
          'leadSourceCode', lead_source_code,
          'leadSourceName', lead_source_name,
          'sourceCode', source_code,
          'sourceLabel', source_label,
          'classCode', class_code,
          'className', class_name,
          'settlementPeriod', settlement_period,
          'isChecked', coalesce(is_checked, false),
          'checkedAt', checked_at,
          'checkedBy', checked_by,
          'operatingCostStatus', operating_cost_status,
          'mechanismCode', mechanism_code,
          'operatingCostVnd', operating_cost_vnd
        )
        order by transaction_at desc, source_cashflow_record_id desc
      )
      from filtered_orders
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_finance_orders_dashboard(date, text, text, smallint)
from public, anon;
grant execute on function public.get_finance_orders_dashboard(date, text, text, smallint)
to authenticated;

commit;
