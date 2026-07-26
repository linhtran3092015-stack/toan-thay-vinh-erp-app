-- Migration: 20260726163000_finance_sepay_workflows.sql
-- Description: RPC Workflows for Payment Requests, SePay Webhook Idempotent Processing, Multi-child Allocations, and Refunds

begin;

-- 1. RPC: Create Payment Request (VietQR Payload Generator)
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
  v_student record;
  v_public_code text;
  v_transfer_code text;
  v_request_id uuid;
  v_unit_price bigint;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED: Vui lòng đăng nhập.';
  end if;

  if not public.has_permission('payments.manage') then
    raise exception 'PAYMENTS_MANAGE_PERMISSION_DENIED: Không có quyền tạo yêu cầu nạp tiền.';
  end if;

  if p_student_id is null then
    raise exception 'STUDENT_ID_REQUIRED: Thiếu mã học viên.';
  end if;

  select * into v_student
  from public.students
  where id = p_student_id;

  if not found then
    raise exception 'STUDENT_NOT_FOUND: Học viên không tồn tại.';
  end if;

  if p_expected_amount_vnd is null or p_expected_amount_vnd <= 0 then
    raise exception 'INVALID_EXPECTED_AMOUNT: Số tiền dự kiến nạp phải lớn hơn 0.';
  end if;

  if p_purchased_sessions is null or p_purchased_sessions <= 0 then
    raise exception 'INVALID_PURCHASED_SESSIONS: Số buổi mua phải lớn hơn 0.';
  end if;

  v_unit_price := coalesce(p_calculated_unit_price_vnd, p_expected_amount_vnd / p_purchased_sessions);

  -- Generate Codes
  v_public_code := 'PAY-' || to_char(pg_catalog.now(), 'YYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 4));
  v_transfer_code := 'TTV ' || replace(v_student.public_code, 'STUDENT-', 'HV-');

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
  ) values (
    v_public_code,
    p_student_id,
    v_student.guardian_id,
    p_expected_amount_vnd,
    p_purchased_sessions,
    coalesce(p_bonus_sessions, 0),
    v_unit_price,
    coalesce(p_topup_type, 'new'),
    v_transfer_code,
    p_notes,
    v_actor_id
  ) returning id into v_request_id;

  return jsonb_build_object(
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

-- 2. RPC: Process SePay Webhook Transaction (Idempotent Automated Processing)
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
  v_existing_webhook record;
  v_webhook_id uuid;
  v_tx_id uuid;
  v_payment_request record;
  v_credit_lot_id uuid;
  v_student record;
  v_matched boolean := false;
begin
  -- 1. Idempotency Check
  select * into v_existing_webhook
  from public.sepay_webhooks
  where sepay_id = p_sepay_id;

  if found then
    return jsonb_build_object(
      'status', 'ignored',
      'reason', 'ALREADY_PROCESSED',
      'sepay_id', p_sepay_id,
      'webhook_id', v_existing_webhook.id
    );
  end if;

  -- 2. Save Raw Webhook Payload
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
    processing_status,
    processed_at
  ) values (
    p_sepay_id,
    p_gateway,
    p_transaction_date,
    p_account_number,
    p_code,
    p_content,
    p_transfer_type,
    p_amount_in,
    p_amount_out,
    p_reference_number,
    p_body_raw,
    'processed',
    pg_catalog.now()
  ) returning id into v_webhook_id;

  -- Ignore outgoing transactions for automated credit
  if p_transfer_type = 'out' or p_amount_in <= 0 then
    insert into public.sepay_transactions (
      sepay_webhook_id,
      bank_transaction_id,
      bank_brand,
      account_number,
      amount_vnd,
      transfer_content,
      transaction_at,
      match_status
    ) values (
      v_webhook_id,
      p_sepay_id::text,
      p_gateway,
      p_account_number,
      greatest(p_amount_out, 1),
      p_content,
      p_transaction_date,
      'unmatched'
    );

    return jsonb_build_object('status', 'ignored', 'reason', 'OUTGOING_TRANSACTION', 'webhook_id', v_webhook_id);
  end if;

  -- Insert parsed transaction record
  insert into public.sepay_transactions (
    sepay_webhook_id,
    bank_transaction_id,
    bank_brand,
    account_number,
    amount_vnd,
    transfer_content,
    transaction_at,
    match_status
  ) values (
    v_webhook_id,
    p_sepay_id::text,
    p_gateway,
    p_account_number,
    p_amount_in,
    p_content,
    p_transaction_date,
    'unmatched'
  ) returning id into v_tx_id;

  -- 3. Automatic Pattern Matching with Payment Request Transfer Code
  select * into v_payment_request
  from public.student_payment_requests
  where status = 'pending'
    and (
      p_content ilike '%' || transfer_code || '%'
      or p_content ilike '%' || public_code || '%'
      or (p_code is not null and p_code <> '' and (transfer_code ilike '%' || p_code || '%' or public_code ilike '%' || p_code || '%'))
    )
  order by created_at desc
  limit 1;

  if found then
    v_matched := true;

    -- Update Payment Request
    update public.student_payment_requests
    set
      status = 'paid',
      paid_amount_vnd = p_amount_in,
      paid_at = p_transaction_date,
      updated_at = pg_catalog.now()
    where id = v_payment_request.id;

    -- Create Credit Lot
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
    ) values (
      v_payment_request.student_id,
      v_payment_request.id,
      v_tx_id,
      v_payment_request.purchased_sessions,
      v_payment_request.bonus_sessions,
      v_payment_request.purchased_sessions + v_payment_request.bonus_sessions,
      v_payment_request.purchased_sessions + v_payment_request.bonus_sessions,
      v_payment_request.calculated_unit_price_vnd,
      v_payment_request.topup_type,
      'active'
    ) returning id into v_credit_lot_id;

    -- Insert Ledger Entries (+N purchased sessions, +M bonus sessions)
    insert into public.student_session_ledger_entries (
      student_id,
      entry_type,
      delta_sessions,
      effective_on,
      reference_code,
      unit_price_vnd,
      note
    ) values (
      v_payment_request.student_id,
      'payment_credit',
      v_payment_request.purchased_sessions,
      p_transaction_date::date,
      v_payment_request.public_code,
      v_payment_request.calculated_unit_price_vnd,
      'Nạp học phí tự động qua SePay (' || p_gateway || ')'
    );

    if v_payment_request.bonus_sessions > 0 then
      insert into public.student_session_ledger_entries (
        student_id,
        entry_type,
        delta_sessions,
        effective_on,
        reference_code,
        unit_price_vnd,
        note
      ) values (
        v_payment_request.student_id,
        'bonus_credit',
        v_payment_request.bonus_sessions,
        p_transaction_date::date,
        v_payment_request.public_code,
        0,
        'Tặng buổi học kèm gói nạp SePay'
      );
    end if;

    -- Record Cashflow
    insert into public.finance_cashflow_records (
      record_type,
      category,
      amount_vnd,
      student_id,
      sepay_transaction_id,
      reference_code,
      note
    ) values (
      'receipt',
      'tuition_fee',
      p_amount_in,
      v_payment_request.student_id,
      v_tx_id,
      v_payment_request.public_code,
      'Thu học phí chuyển khoản SePay'
    );

    -- Update SePay Transaction Match Status
    update public.sepay_transactions
    set
      matched_payment_request_id = v_payment_request.id,
      matched_student_id = v_payment_request.student_id,
      match_status = 'auto_matched',
      matched_at = pg_catalog.now()
    where id = v_tx_id;
  end if;

  return jsonb_build_object(
    'status', 'success',
    'sepay_id', p_sepay_id,
    'webhook_id', v_webhook_id,
    'transaction_id', v_tx_id,
    'auto_matched', v_matched,
    'matched_payment_request_id', case when v_matched then v_payment_request.id else null end
  );
end;
$$;

-- 3. RPC: Allocate Payment to Multiple Students (Multi-child Split Allocation)
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
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED: Vui lòng đăng nhập.';
  end if;

  if not public.has_permission('payments.manage') then
    raise exception 'PAYMENTS_MANAGE_PERMISSION_DENIED: Không có quyền phân bổ học phí.';
  end if;

  select * into v_tx
  from public.sepay_transactions
  where id = p_sepay_transaction_id;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND: Giao dịch SePay không tồn tại.';
  end if;

  if jsonb_array_length(p_allocations) = 0 then
    raise exception 'EMPTY_ALLOCATIONS: Cần phân bổ ít nhất 1 học viên.';
  end if;

  -- Validate total amount
  for v_item in select * from jsonb_array_elements(p_allocations) loop
    v_total_allocated := v_total_allocated + (v_item->>'allocated_amount_vnd')::bigint;
  end loop;

  if v_total_allocated > v_tx.amount_vnd then
    raise exception 'ALLOCATION_EXCEEDS_TRANSACTION: Tổng tiền phân bổ (%) vượt quá số tiền giao dịch (%).', v_total_allocated, v_tx.amount_vnd;
  end if;

  -- Execute allocation per student
  for v_item in select * from jsonb_array_elements(p_allocations) loop
    v_student_id := (v_item->>'student_id')::uuid;
    v_amount_vnd := (v_item->>'allocated_amount_vnd')::bigint;
    v_purchased_sessions := (v_item->>'allocated_sessions')::integer;
    v_bonus_sessions := coalesce((v_item->>'bonus_sessions')::integer, 0);
    v_unit_price := coalesce((v_item->>'unit_price_vnd')::bigint, v_amount_vnd / greatest(v_purchased_sessions, 1));
    v_ref_code := 'SPLIT-' || substring(p_sepay_transaction_id::text from 1 for 8);

    -- Create Credit Lot
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
    ) values (
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
    ) returning id into v_credit_lot_id;

    -- Record Allocation
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
    ) values (
      p_sepay_transaction_id,
      p_guardian_id,
      v_student_id,
      v_amount_vnd,
      v_purchased_sessions,
      v_bonus_sessions,
      v_unit_price,
      v_credit_lot_id,
      v_item->>'notes',
      v_actor_id
    );

    -- Insert Ledger Entries
    insert into public.student_session_ledger_entries (
      student_id,
      entry_type,
      delta_sessions,
      effective_on,
      reference_code,
      unit_price_vnd,
      note
    ) values (
      v_student_id,
      'payment_credit',
      v_purchased_sessions,
      pg_catalog.current_date,
      v_ref_code,
      v_unit_price,
      'Nạp học phí phân bổ nhiều con'
    );

    if v_bonus_sessions > 0 then
      insert into public.student_session_ledger_entries (
        student_id,
        entry_type,
        delta_sessions,
        effective_on,
        reference_code,
        unit_price_vnd,
        note
      ) values (
        v_student_id,
        'bonus_credit',
        v_bonus_sessions,
        pg_catalog.current_date,
        v_ref_code,
        0,
        'Tặng buổi học kèm phân bổ'
      );
    end if;

    -- Cashflow Record
    insert into public.finance_cashflow_records (
      record_type,
      category,
      amount_vnd,
      student_id,
      sepay_transaction_id,
      reference_code,
      note,
      created_by
    ) values (
      'receipt',
      'tuition_fee',
      v_amount_vnd,
      v_student_id,
      p_sepay_transaction_id,
      v_ref_code,
      'Phân bổ học phí cho học viên',
      v_actor_id
    );
  end loop;

  -- Update Transaction Match Status
  update public.sepay_transactions
  set
    match_status = 'split_allocated',
    matched_by = v_actor_id,
    matched_at = pg_catalog.now()
  where id = p_sepay_transaction_id;

  return jsonb_build_object(
    'status', 'success',
    'sepay_transaction_id', p_sepay_transaction_id,
    'total_allocated_vnd', v_total_allocated
  );
end;
$$;

-- 4. RPC: Process Student Refund (Hoàn Phí Học Viên)
create or replace function public.process_student_refund(
  p_student_id uuid,
  p_refund_amount_vnd bigint,
  p_refund_sessions integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_student record;
  v_ref_code text;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED: Vui lòng đăng nhập.';
  end if;

  if not public.has_permission('refunds.manage') then
    raise exception 'REFUNDS_MANAGE_PERMISSION_DENIED: Không có quyền duyệt hoàn phí.';
  end if;

  select * into v_student
  from public.students
  where id = p_student_id;

  if not found then
    raise exception 'STUDENT_NOT_FOUND: Học viên không tồn tại.';
  end if;

  if p_refund_amount_vnd is null or p_refund_amount_vnd <= 0 then
    raise exception 'INVALID_REFUND_AMOUNT: Số tiền hoàn trả phải lớn hơn 0.';
  end if;

  if p_refund_sessions is null or p_refund_sessions <= 0 then
    raise exception 'INVALID_REFUND_SESSIONS: Số buổi hoàn trả phải lớn hơn 0.';
  end if;

  v_ref_code := 'REFUND-' || to_char(pg_catalog.now(), 'YYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 4));

  -- Insert Ledger Refund Entry (-N sessions)
  insert into public.student_session_ledger_entries (
    student_id,
    entry_type,
    delta_sessions,
    effective_on,
    reference_code,
    unit_price_vnd,
    note
  ) values (
    p_student_id,
    'refund_debit',
    -p_refund_sessions,
    pg_catalog.current_date,
    v_ref_code,
    p_refund_amount_vnd / p_refund_sessions,
    'Hoàn phí học viên: ' || coalesce(p_reason, 'Theo yêu cầu phụ huynh')
  );

  -- Insert Cashflow Disbursement Record
  insert into public.finance_cashflow_records (
    record_type,
    category,
    amount_vnd,
    student_id,
    reference_code,
    note,
    created_by
  ) values (
    'refund',
    'refund',
    p_refund_amount_vnd,
    p_student_id,
    v_ref_code,
    'Chi hoàn phí học viên: ' || coalesce(p_reason, 'Theo yêu cầu phụ huynh'),
    v_actor_id
  );

  return jsonb_build_object(
    'status', 'success',
    'reference_code', v_ref_code,
    'student_id', p_student_id,
    'refund_amount_vnd', p_refund_amount_vnd,
    'refund_sessions', p_refund_sessions
  );
end;
$$;

commit;
