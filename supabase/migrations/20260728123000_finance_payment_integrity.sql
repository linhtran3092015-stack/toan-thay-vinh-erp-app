-- Strengthen payment-request, SePay matching, and split-allocation integrity.
-- This is a forward-only migration. Existing finance migrations remain unchanged.

begin;

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
      'amount_mismatch'
    )
  );

create or replace function public.create_student_payment_request(
  p_student_id uuid,
  p_expected_amount_vnd bigint,
  p_purchased_sessions integer,
  p_bonus_sessions integer default 0,
  p_calculated_unit_price_vnd bigint default 0,
  p_topup_type text default 'new',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_student public.students%rowtype;
  v_guardian_id uuid;
  v_public_code text;
  v_transfer_code text;
  v_request_id uuid;
  v_unit_price bigint;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED: Vui long dang nhap.';
  end if;

  if not (
    public.has_permission('payments.create_request')
    or public.has_permission('payments.manage')
  ) then
    raise exception 'PAYMENTS_CREATE_REQUEST_PERMISSION_DENIED: Khong co quyen tao yeu cau nap tien.';
  end if;

  if p_student_id is null then
    raise exception 'STUDENT_ID_REQUIRED: Thieu ma hoc vien.';
  end if;

  select *
  into v_student
  from public.students
  where id = p_student_id;

  if not found then
    raise exception 'STUDENT_NOT_FOUND: Hoc vien khong ton tai.';
  end if;

  select link.guardian_id
  into v_guardian_id
  from public.student_guardians as link
  where link.student_id = p_student_id
    and link.is_primary
    and link.ended_at is null;

  if v_guardian_id is null then
    raise exception 'STUDENT_PRIMARY_GUARDIAN_NOT_FOUND: Hoc vien chua co phu huynh chinh dang hoat dong.';
  end if;

  if p_expected_amount_vnd is null or p_expected_amount_vnd <= 0 then
    raise exception 'INVALID_EXPECTED_AMOUNT: So tien du kien nap phai lon hon 0.';
  end if;

  if p_purchased_sessions is null or p_purchased_sessions <= 0 then
    raise exception 'INVALID_PURCHASED_SESSIONS: So buoi mua phai lon hon 0.';
  end if;

  if coalesce(p_bonus_sessions, 0) < 0 then
    raise exception 'INVALID_BONUS_SESSIONS: So buoi tang khong duoc am.';
  end if;

  if coalesce(p_topup_type, 'new') not in ('new', 'renewal') then
    raise exception 'INVALID_TOPUP_TYPE: Loai nap khong hop le.';
  end if;

  v_unit_price := coalesce(
    nullif(p_calculated_unit_price_vnd, 0),
    p_expected_amount_vnd / p_purchased_sessions
  );

  if v_unit_price <= 0 then
    raise exception 'INVALID_UNIT_PRICE: Don gia phai lon hon 0.';
  end if;

  -- The transfer reference identifies this request, not the student.
  v_public_code := 'PAY-'
    || pg_catalog.to_char(pg_catalog.now(), 'YYMMDD')
    || '-'
    || pg_catalog.upper(
      pg_catalog.substr(
        pg_catalog.md5(pg_catalog.random()::text),
        1,
        12
      )
    );
  v_transfer_code := 'TTV ' || v_public_code;

  insert into public.student_payment_requests (
    public_code,
    student_id,
    guardian_id,
    expected_amount_vnd,
    purchased_sessions,
    bonus_sessions,
    calculated_unit_price_vnd,
    topup_type,
    transfer_code,
    notes,
    created_by
  )
  values (
    v_public_code,
    p_student_id,
    v_guardian_id,
    p_expected_amount_vnd,
    p_purchased_sessions,
    coalesce(p_bonus_sessions, 0),
    v_unit_price,
    coalesce(p_topup_type, 'new'),
    v_transfer_code,
    p_notes,
    v_actor_id
  )
  returning id into v_request_id;

  return pg_catalog.jsonb_build_object(
    'id', v_request_id,
    'public_code', v_public_code,
    'transfer_code', v_transfer_code,
    'expected_amount_vnd', p_expected_amount_vnd,
    'purchased_sessions', p_purchased_sessions,
    'bonus_sessions', coalesce(p_bonus_sessions, 0),
    'status', 'pending'
  );
end;
$$;

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
          'sepay_transaction_id', v_tx_id
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
            'sepay_transaction_id', v_tx_id
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

  -- Validate every item before creating any credit lot or ledger entry.
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
      'new',
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
      pg_catalog.current_date,
      'sepay-split-payment-credit:' || p_sepay_transaction_id::text || ':' || v_student_id::text,
      v_ref_code,
      v_unit_price,
      'Nap hoc phi phan bo nhieu con',
      pg_catalog.jsonb_build_object(
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
        pg_catalog.current_date,
        'sepay-split-bonus-credit:' || p_sepay_transaction_id::text || ':' || v_student_id::text,
        v_ref_code,
        null,
        'Tang buoi hoc kem phan bo nhieu con',
        pg_catalog.jsonb_build_object(
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

commit;
