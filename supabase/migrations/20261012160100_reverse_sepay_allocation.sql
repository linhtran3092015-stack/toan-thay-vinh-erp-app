-- Đảo phân bổ giao dịch SePay đã khớp sai (khớp tự động, khớp lịch sử thủ
-- công hoặc phân bổ thủ công nhiều học sinh).
--
-- Trước đây giao dịch đã khớp là vĩnh viễn: không có cách rút lại khi kế toán
-- chọn nhầm học sinh / phiếu thu. Mọi hiệu ứng tài chính của một giao dịch đều
-- tra được theo sepay_transaction_id (dòng tiền, lô buổi, dòng chia, sổ buổi
-- qua metadata), nên RPC này đảo chung cho cả ba luồng:
--   - sổ buổi là append-only → ghi bút toán manual_adjustment âm đối ứng từng
--     dòng payment_credit / bonus_credit, ngày hiệu lực = ngày đảo (giờ VN);
--   - phiếu thu trả về trạng thái trước khi thu phần tiền này (pending /
--     partially_paid / paid tuỳ số đã thu còn lại);
--   - xoá lô buổi, dòng chia, dòng tiền, đánh dấu đối soát đơn hàng;
--   - xoá fact lương hệ thống (renewal_order / new_enrollment_order) và issue
--     tính lương sinh từ dòng tiền đó; kỳ lương nháp/đang duyệt của tháng liên
--     quan phải "Tính lại" (RPC trả danh sách tháng);
--   - xoá accrual doanh thu hoa hồng của dòng tiền;
--   - giao dịch trở về `unmatched` để phân bổ lại.
-- Từ chối khi tháng tiền về (hoặc tháng fact) đã có kỳ lương duyệt:
-- ALLOCATION_LOCKED_BY_APPROVED_PAYROLL — phải mở lại kỳ lương trước.
-- Quyền: payments.manage. Audit đầy đủ snapshot các dòng bị xoá.
--
-- Vì sổ buổi giữ nguyên các dòng cũ, phân bổ lại cùng giao dịch cho cùng học
-- sinh cần event_key mới: hai RPC phân bổ dùng next_student_ledger_event_key.

begin;

create or replace function public.next_student_ledger_event_key(p_base text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from public.student_session_ledger_entries where event_key = p_base
    ) then p_base
    else p_base || ':r' || (
      select count(*)
      from public.student_session_ledger_entries
      where event_key = p_base or event_key like p_base || ':r%'
    )::text
  end;
$$;

revoke all on function public.next_student_ledger_event_key(text) from public, anon, authenticated;

-- Fact lương và issue tính lương chỉ được xoá bởi RPC đảo phân bổ (GUC đặt
-- trong cùng giao dịch); các bảng cấu hình lương khác vẫn bất biến.
create or replace function public.prevent_payroll_configuration_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and tg_table_name in ('payroll_source_facts', 'payroll_calculation_issues')
    and pg_catalog.current_setting('app.payroll_fact_reversal', true) = 'on'
  then
    return old;
  end if;

  raise exception using errcode = '23514', message = 'PAYROLL_CONFIGURATION_HISTORY_IMMUTABLE';
end;
$$;

create or replace function public.reverse_sepay_allocation(
  p_sepay_transaction_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_tx public.sepay_transactions;
  v_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_cashflow_ids uuid[];
  v_cashflows jsonb;
  v_lots jsonb;
  v_splits jsonb;
  v_facts jsonb;
  v_accruals jsonb;
  v_requests jsonb := '[]'::jsonb;
  v_ledger_entry_ids uuid[] := '{}';
  v_reversal_ids uuid[] := '{}';
  v_locked_months date[];
  v_recalc_months date[];
  v_entry public.student_session_ledger_entries;
  v_lot public.student_credit_lots;
  v_request public.student_payment_requests;
  v_accrual public.sales_commission_accruals;
  v_amount bigint;
  v_new_paid bigint;
  v_new_status text;
  v_reversal_id uuid;
  v_reversed_total bigint;
  v_student_count integer;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('payments.manage') then
    raise exception using errcode = '42501', message = 'PAYMENTS_MANAGE_PERMISSION_DENIED';
  end if;
  if v_reason is null or pg_catalog.length(v_reason) < 3 or pg_catalog.length(v_reason) > 1000 then
    raise exception using errcode = '22023', message = 'REASON_REQUIRED';
  end if;

  select * into v_tx
  from public.sepay_transactions
  where id = p_sepay_transaction_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TRANSACTION_NOT_FOUND';
  end if;
  if v_tx.match_status not in ('auto_matched', 'manual_matched', 'split_allocated') then
    raise exception using errcode = '23514', message = 'TRANSACTION_NOT_ALLOCATED';
  end if;

  select coalesce(pg_catalog.array_agg(cashflow.id), '{}')
  into v_cashflow_ids
  from public.finance_cashflow_records as cashflow
  where cashflow.sepay_transaction_id = v_tx.id;

  if pg_catalog.cardinality(v_cashflow_ids) = 0
    and not exists (
      select 1 from public.student_credit_lots where sepay_transaction_id = v_tx.id
    )
  then
    raise exception using errcode = 'P0002', message = 'ALLOCATION_NOT_FOUND';
  end if;

  -- Tháng đã có kỳ lương duyệt thì doanh thu đã nằm trong lương: không đảo.
  with months as (
    select pg_catalog.date_trunc('month', cashflow.effective_on)::date as period_month
    from public.finance_cashflow_records as cashflow
    where cashflow.id = any(v_cashflow_ids)
    union
    select pg_catalog.date_trunc('month', fact.event_date)::date
    from public.payroll_source_facts as fact
    where fact.source_origin = 'system'
      and fact.fact_type in ('renewal_order', 'new_enrollment_order')
      and fact.source_key in (select id::text from pg_catalog.unnest(v_cashflow_ids) as id)
  )
  select
    pg_catalog.array_agg(distinct period.period_month) filter (where period.status = 'approved'),
    pg_catalog.array_agg(distinct period.period_month) filter (where period.status in ('draft', 'review'))
  into v_locked_months, v_recalc_months
  from public.payroll_periods as period
  join months on months.period_month = period.period_month;

  if v_locked_months is not null then
    raise exception using
      errcode = '23514',
      message = 'ALLOCATION_LOCKED_BY_APPROVED_PAYROLL',
      detail = pg_catalog.array_to_string(v_locked_months, ',');
  end if;

  -- Snapshot trước khi xoá để audit giữ được toàn bộ lịch sử.
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(cashflow)), '[]'::jsonb)
  into v_cashflows
  from public.finance_cashflow_records as cashflow
  where cashflow.id = any(v_cashflow_ids);

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(lot)), '[]'::jsonb)
  into v_lots
  from public.student_credit_lots as lot
  where lot.sepay_transaction_id = v_tx.id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(split)), '[]'::jsonb)
  into v_splits
  from public.payment_split_allocations as split
  where split.sepay_transaction_id = v_tx.id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(fact)), '[]'::jsonb)
  into v_facts
  from public.payroll_source_facts as fact
  where fact.source_origin = 'system'
    and fact.fact_type in ('renewal_order', 'new_enrollment_order')
    and fact.source_key in (select id::text from pg_catalog.unnest(v_cashflow_ids) as id);

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(accrual)), '[]'::jsonb)
  into v_accruals
  from public.sales_commission_accruals as accrual
  where accrual.source_cashflow_record_id = any(v_cashflow_ids);

  -- 1. Sổ buổi: bút toán đối ứng cho từng dòng ghi có của giao dịch.
  for v_entry in
    select entry.*
    from public.student_session_ledger_entries as entry
    where entry.entry_type in ('payment_credit', 'bonus_credit')
      and (
        entry.metadata->>'sepay_transaction_id' = v_tx.id::text
        or entry.metadata->>'credit_lot_id' in (
          select lot.id::text from public.student_credit_lots as lot
          where lot.sepay_transaction_id = v_tx.id
        )
      )
    order by entry.created_at, entry.id
  loop
    insert into public.student_session_ledger_entries (
      student_id, entry_type, delta_sessions, effective_on, event_key, reference_code,
      unit_price_vnd, note, metadata, created_by
    )
    values (
      v_entry.student_id,
      'manual_adjustment',
      -v_entry.delta_sessions,
      v_today,
      'sepay-allocation-reversal:' || v_entry.id::text,
      'REV-' || v_tx.id::text,
      v_entry.unit_price_vnd,
      'Đảo phân bổ SePay: ' || v_reason,
      pg_catalog.jsonb_build_object(
        'reversal_of_entry_id', v_entry.id,
        'reversed_entry_type', v_entry.entry_type,
        'reversed_event_key', v_entry.event_key,
        'sepay_transaction_id', v_tx.id,
        'credit_lot_id', v_entry.metadata->'credit_lot_id',
        'payment_request_id', v_entry.metadata->'payment_request_id',
        'reason', v_reason
      ),
      v_actor
    )
    returning id into v_reversal_id;

    v_ledger_entry_ids := pg_catalog.array_append(v_ledger_entry_ids, v_entry.id);
    v_reversal_ids := pg_catalog.array_append(v_reversal_ids, v_reversal_id);
  end loop;

  -- 2. Phiếu thu: trừ lại phần đã thu từ giao dịch này.
  for v_lot in
    select lot.*
    from public.student_credit_lots as lot
    where lot.sepay_transaction_id = v_tx.id
      and lot.payment_request_id is not null
    order by lot.created_at, lot.id
  loop
    select * into v_request
    from public.student_payment_requests
    where id = v_lot.payment_request_id
    for update;

    if not found or v_request.status not in ('paid', 'partially_paid') then
      continue;
    end if;

    select coalesce(pg_catalog.sum(cashflow.amount_vnd), 0)
    into v_amount
    from public.finance_cashflow_records as cashflow
    where cashflow.id = any(v_cashflow_ids)
      and cashflow.student_id = v_lot.student_id;

    v_new_paid := greatest(0, v_request.paid_amount_vnd - v_amount);
    v_new_status := case
      when v_new_paid = 0 then 'pending'
      when v_new_paid >= v_request.expected_amount_vnd then 'paid'
      else 'partially_paid'
    end;

    update public.student_payment_requests
    set
      status = v_new_status,
      paid_amount_vnd = v_new_paid,
      paid_at = case when v_new_status = 'paid' then paid_at else null end,
      calculated_unit_price_vnd = case
        when v_new_status = 'pending' and purchased_sessions > 0
          then expected_amount_vnd / purchased_sessions
        else calculated_unit_price_vnd
      end,
      updated_at = pg_catalog.now()
    where id = v_request.id;

    v_requests := v_requests || pg_catalog.jsonb_build_object(
      'payment_request_id', v_request.id,
      'public_code', v_request.public_code,
      'status_before', v_request.status,
      'paid_amount_before_vnd', v_request.paid_amount_vnd,
      'status_after', v_new_status,
      'paid_amount_after_vnd', v_new_paid
    );
  end loop;

  -- 3. Fact lương và issue tính lương sinh từ dòng tiền (kỳ nháp phải tính lại).
  perform pg_catalog.set_config('app.payroll_fact_reversal', 'on', true);
  delete from public.payroll_calculation_issues as issue
  where issue.source_fact_id in (
    select fact.id
    from public.payroll_source_facts as fact
    where fact.source_origin = 'system'
      and fact.fact_type in ('renewal_order', 'new_enrollment_order')
      and fact.source_key in (select id::text from pg_catalog.unnest(v_cashflow_ids) as id)
  );
  delete from public.payroll_source_facts as fact
  where fact.source_origin = 'system'
    and fact.fact_type in ('renewal_order', 'new_enrollment_order')
    and fact.source_key in (select id::text from pg_catalog.unnest(v_cashflow_ids) as id);
  perform pg_catalog.set_config('app.payroll_fact_reversal', 'off', true);

  -- 4. Accrual hoa hồng của dòng tiền.
  perform pg_catalog.set_config('app.sepay_allocation_reversal', 'on', true);
  for v_accrual in
    select accrual.*
    from public.sales_commission_accruals as accrual
    where accrual.source_cashflow_record_id = any(v_cashflow_ids)
  loop
    delete from public.sales_commission_accruals where id = v_accrual.id;
    insert into public.audit_logs (
      actor_user_id, module, action, entity_type, entity_id, old_data, metadata, reason
    )
    values (
      v_actor,
      'commissions',
      'sales_commission_accrual_reversed',
      'sales_commission_accrual',
      v_accrual.id::text,
      pg_catalog.to_jsonb(v_accrual),
      pg_catalog.jsonb_build_object(
        'source', 'sepay_allocation_reversal',
        'sepay_transaction_id', v_tx.id,
        'source_cashflow_record_id', v_accrual.source_cashflow_record_id,
        'sale_owner_id', v_accrual.sale_owner_id,
        'recognized_revenue_vnd', v_accrual.recognized_revenue_vnd
      ),
      v_reason
    );
  end loop;
  perform pg_catalog.set_config('app.sepay_allocation_reversal', 'off', true);

  -- 5. Dòng tiền, đối soát đơn hàng, dòng chia, lô buổi.
  delete from public.finance_order_reviews where source_cashflow_record_id = any(v_cashflow_ids);
  delete from public.finance_cashflow_records where id = any(v_cashflow_ids);
  delete from public.payment_split_allocations where sepay_transaction_id = v_tx.id;
  delete from public.student_credit_lots where sepay_transaction_id = v_tx.id;

  -- 6. Giao dịch quay về hàng đợi đối soát.
  update public.sepay_transactions
  set
    match_status = 'unmatched',
    matched_by = null,
    matched_at = null,
    matched_student_id = null,
    matched_payment_request_id = null
  where id = v_tx.id;

  select
    coalesce(pg_catalog.sum((item->>'amount_vnd')::bigint), 0),
    pg_catalog.count(distinct item->>'student_id')
  into v_reversed_total, v_student_count
  from pg_catalog.jsonb_array_elements(v_cashflows) as item;

  insert into public.audit_logs (
    actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason
  )
  values (
    v_actor,
    'finance',
    'sepay_allocation_reversed',
    'sepay_transaction',
    v_tx.id::text,
    pg_catalog.jsonb_build_object(
      'match_status', v_tx.match_status,
      'matched_student_id', v_tx.matched_student_id,
      'matched_payment_request_id', v_tx.matched_payment_request_id,
      'cashflow_records', v_cashflows,
      'credit_lots', v_lots,
      'split_allocations', v_splits,
      'ledger_entry_ids', pg_catalog.to_jsonb(v_ledger_entry_ids),
      'payroll_source_facts', v_facts,
      'commission_accruals', v_accruals
    ),
    pg_catalog.jsonb_build_object(
      'match_status', 'unmatched',
      'reversal_effective_on', v_today,
      'reversal_ledger_entry_ids', pg_catalog.to_jsonb(v_reversal_ids),
      'payment_requests', v_requests,
      'reversed_amount_vnd', v_reversed_total,
      'payroll_months_to_recalculate', pg_catalog.to_jsonb(coalesce(v_recalc_months, '{}'))
    ),
    v_reason
  );

  return pg_catalog.jsonb_build_object(
    'status', 'success',
    'transaction_id', v_tx.id,
    'reversed_amount_vnd', v_reversed_total,
    'student_count', v_student_count,
    'ledger_reversal_count', pg_catalog.cardinality(v_reversal_ids),
    'payment_requests', v_requests,
    'payroll_months_to_recalculate', pg_catalog.to_jsonb(coalesce(v_recalc_months, '{}'))
  );
end;
$$;

revoke all on function public.reverse_sepay_allocation(uuid, text) from public, anon;
grant execute on function public.reverse_sepay_allocation(uuid, text) to authenticated;

comment on function public.reverse_sepay_allocation(uuid, text)
is 'Đảo toàn bộ hiệu ứng tài chính của một giao dịch SePay đã khớp (sổ buổi đối ứng, phiếu thu, lô buổi, dòng tiền, fact lương, accrual hoa hồng) và trả giao dịch về unmatched. Từ chối khi tháng liên quan đã có kỳ lương duyệt.';

-- Phân bổ thủ công: giống 20261012140000, chỉ đổi event_key qua
-- next_student_ledger_event_key để phân bổ lại được sau khi đảo.
create or replace function public.allocate_sepay_tuition_manually(
 p_sepay_transaction_id uuid, p_allocations jsonb, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid:=auth.uid(); v_tx public.sepay_transactions; v_item jsonb;
 v_student uuid; v_guardian uuid; v_request_id uuid; v_request public.student_payment_requests;
 v_amount bigint; v_sessions integer; v_bonus integer; v_price bigint; v_remaining bigint; v_settle text;
 v_total bigint:=0; v_seen uuid[]:='{}'; v_rows jsonb:='[]';
 v_lot uuid; v_ref text; v_type text; v_date date;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not (public.has_permission('sepay.allocate') or public.has_permission('payments.manage')) then
  raise exception 'SEPAY_ALLOCATE_PERMISSION_DENIED';
 end if;
 if p_reason is null or length(btrim(p_reason))<3 or length(p_reason)>1000 then raise exception 'REASON_REQUIRED'; end if;
 if p_allocations is null or jsonb_typeof(p_allocations)<>'array' then raise exception 'INVALID_ALLOCATIONS'; end if;
 if jsonb_array_length(p_allocations) not between 1 and 50 then raise exception 'INVALID_ALLOCATIONS'; end if;
 select * into v_tx from public.sepay_transactions where id=p_sepay_transaction_id for update;
 if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if;
 if v_tx.transfer_type is distinct from 'in' then raise exception 'TRANSACTION_NOT_INBOUND'; end if;
 if v_tx.match_status not in ('unmatched','amount_mismatch','account_purpose_mismatch') then
  raise exception 'TRANSACTION_ALREADY_RECONCILED';
 end if;
 if v_tx.account_purpose not in ('new_enrollment','renewal') then raise exception 'SEPAY_ACCOUNT_PURPOSE_UNRESOLVED'; end if;
 if exists(select 1 from public.finance_cashflow_records where sepay_transaction_id=v_tx.id)
 or exists(select 1 from public.student_credit_lots where sepay_transaction_id=v_tx.id)
 or exists(select 1 from public.payment_split_allocations where sepay_transaction_id=v_tx.id) then
  raise exception 'TRANSACTION_HAS_FINANCIAL_EFFECTS';
 end if;
 v_type:=case v_tx.account_purpose when 'renewal' then 'renewal' else 'new' end;
 v_date:=(v_tx.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date;
 -- Stable ordering prevents deadlocks between batches sharing students/requests.
 for v_item in select value from jsonb_array_elements(p_allocations) order by value->>'student_id'
 loop
  begin
   if jsonb_typeof(v_item)<>'object' or coalesce(v_item->>'allocated_amount_vnd','') !~ '^[0-9]+$'
    or coalesce(v_item->>'allocated_sessions','') !~ '^[0-9]+$'
    or coalesce(v_item->>'bonus_sessions','0') !~ '^[0-9]+$' then raise exception 'invalid'; end if;
   v_student:=(v_item->>'student_id')::uuid;
   v_request_id:=nullif(v_item->>'payment_request_id','')::uuid;
   v_amount:=(v_item->>'allocated_amount_vnd')::bigint;
   v_sessions:=(v_item->>'allocated_sessions')::integer;
   v_bonus:=coalesce((v_item->>'bonus_sessions')::integer,0);
  exception when others then raise exception 'INVALID_ALLOCATION_ITEM'; end;
  if v_student is null or v_amount not between 1 and 1000000000000
   or v_sessions not between 1 and 100000 or v_bonus not between 0 and 100000 then raise exception 'INVALID_ALLOCATION_ITEM'; end if;
  if v_student=any(v_seen) then raise exception 'DUPLICATE_ALLOCATION_STUDENT'; end if;
  perform 1 from public.students where id=v_student and lifecycle_status='active' for no key update;
  if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
  select guardian_id into v_guardian from public.student_guardians
   where student_id=v_student and is_primary and ended_at is null for share;
  if not found then raise exception 'STUDENT_PRIMARY_GUARDIAN_NOT_FOUND'; end if;
  v_settle:=null;
  if v_request_id is not null then
   select * into v_request from public.student_payment_requests where id=v_request_id for update;
   if not found or v_request.student_id is distinct from v_student or v_request.status not in ('pending','partially_paid')
    then raise exception 'PAYMENT_REQUEST_NOT_AVAILABLE'; end if;
   if v_request.topup_type<>v_type then raise exception 'ACCOUNT_PURPOSE_TOPUP_TYPE_MISMATCH'; end if;
   v_remaining:=v_request.expected_amount_vnd-v_request.paid_amount_vnd;
   if v_amount=v_remaining then
    -- Exact settlement keeps the request's own sessions and bonus; extra
    -- sessions for an exact payment are a discount and belong in a reissue.
    if v_request.status='pending' and (v_sessions<>v_request.purchased_sessions or v_bonus<>v_request.bonus_sessions) then raise exception 'PAYMENT_REQUEST_ALLOCATION_MISMATCH'; end if;
    v_settle:='paid';
   elsif v_amount>v_remaining then
    -- Surplus: the accountant decides the session count, but a first full
    -- payment cannot grant fewer sessions than the request promised.
    if v_request.status='pending' and v_sessions<v_request.purchased_sessions then raise exception 'PAYMENT_REQUEST_SESSIONS_BELOW_REQUEST'; end if;
    v_settle:='paid';
   else
    v_settle:='partially_paid';
   end if;
   if v_settle='paid' and v_request.status='pending' and v_amount=v_remaining and v_sessions=v_request.purchased_sessions then
    v_price:=coalesce(nullif(v_request.calculated_unit_price_vnd,0),v_amount/v_sessions);
   else
    v_price:=v_amount/v_sessions;
   end if;
  else
   if exists(select 1 from public.student_payment_requests where student_id=v_student and status in ('pending','partially_paid')) then
    raise exception 'STUDENT_HAS_OPEN_PAYMENT_REQUEST';
   end if;
   -- Match the existing bigint unit-price convention; preserve full money on
   -- allocation/receipt, never reconstruct receipt value from rounded unit price.
   v_price:=v_amount/v_sessions;
  end if;
  if v_price<=0 then raise exception 'INVALID_UNIT_PRICE'; end if;
  v_seen:=array_append(v_seen,v_student); v_total:=v_total+v_amount;
  v_rows:=v_rows||jsonb_build_array(jsonb_build_object('student',v_student,'guardian',v_guardian,
   'request',v_request_id,'amount',v_amount,'sessions',v_sessions,'bonus',v_bonus,'price',v_price,'settle',v_settle));
 end loop;
 if v_total<>v_tx.amount_vnd then raise exception 'ALLOCATION_TOTAL_MUST_MATCH_TRANSACTION'; end if;
 v_ref:='ALLOC-'||v_tx.id::text;
 for v_item in select value from jsonb_array_elements(v_rows)
 loop
  v_student:=(v_item->>'student')::uuid; v_guardian:=(v_item->>'guardian')::uuid;
  v_request_id:=(v_item->>'request')::uuid; v_amount:=(v_item->>'amount')::bigint;
  v_sessions:=(v_item->>'sessions')::integer; v_bonus:=(v_item->>'bonus')::integer; v_price:=(v_item->>'price')::bigint;
  v_settle:=v_item->>'settle';
  if v_request_id is not null then
   update public.student_payment_requests
   set status=v_settle,
       paid_amount_vnd=paid_amount_vnd+v_amount,
       paid_at=case when v_settle='paid' then v_tx.transaction_at else paid_at end,
       calculated_unit_price_vnd=case when v_settle='paid' then v_price else calculated_unit_price_vnd end,
       updated_at=now()
   where id=v_request_id;
  end if;
  insert into public.student_credit_lots(student_id,payment_request_id,sepay_transaction_id,total_purchased_sessions,
   total_bonus_sessions,total_sessions,remaining_sessions,unit_price_vnd,topup_type,status,created_by)
  values(v_student,v_request_id,v_tx.id,v_sessions,v_bonus,v_sessions+v_bonus,v_sessions+v_bonus,v_price,v_type,'active',v_actor)
  returning id into v_lot;
  insert into public.payment_split_allocations(sepay_transaction_id,guardian_id,student_id,allocated_amount_vnd,
   allocated_sessions,bonus_sessions,unit_price_vnd,credit_lot_id,notes,allocated_by)
  values(v_tx.id,v_guardian,v_student,v_amount,v_sessions,v_bonus,v_price,v_lot,btrim(p_reason),v_actor);
  insert into public.student_session_ledger_entries(student_id,entry_type,delta_sessions,effective_on,event_key,
   reference_code,unit_price_vnd,note,metadata,created_by)
  values(v_student,'payment_credit',v_sessions,v_date,
   public.next_student_ledger_event_key('sepay-manual-allocation:'||v_tx.id||':'||v_student),
   v_ref,v_price,btrim(p_reason),jsonb_build_object('sepay_transaction_id',v_tx.id,'credit_lot_id',v_lot,
   'payment_request_id',v_request_id,'allocation_amount_vnd',v_amount,'account_purpose',v_tx.account_purpose,'settlement',v_settle),v_actor);
  if v_bonus>0 then
   insert into public.student_session_ledger_entries(student_id,entry_type,delta_sessions,effective_on,event_key,
    reference_code,note,metadata,created_by)
   values(v_student,'bonus_credit',v_bonus,v_date,
    public.next_student_ledger_event_key('sepay-manual-allocation-bonus:'||v_tx.id||':'||v_student),
    v_ref,btrim(p_reason),jsonb_build_object('sepay_transaction_id',v_tx.id,'credit_lot_id',v_lot),v_actor);
  end if;
  insert into public.finance_cashflow_records(record_type,category,amount_vnd,student_id,sepay_transaction_id,reference_code,note,created_by)
  values('receipt','tuition_fee',v_amount,v_student,v_tx.id,v_ref,btrim(p_reason),v_actor);
 end loop;
 update public.sepay_transactions set match_status='split_allocated',matched_by=v_actor,matched_at=now(),
  matched_student_id=case when cardinality(v_seen)=1 then v_seen[1] else null end,
  matched_payment_request_id=case when cardinality(v_seen)=1 then (v_rows->0->>'request')::uuid else null end
 where id=v_tx.id;
 if v_tx.sepay_webhook_id is not null then
  update public.sepay_webhooks set processing_status='processed',error_message=null,processed_at=now() where id=v_tx.sepay_webhook_id;
 end if;
 insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,old_data,new_data,reason)
 values(v_actor,'finance','sepay_tuition_manually_allocated','sepay_transaction',v_tx.id::text,
  jsonb_build_object('match_status',v_tx.match_status),jsonb_build_object('allocations',v_rows,'total_allocated_vnd',v_total,'effective_on',v_date),btrim(p_reason));
 return jsonb_build_object('status','success','transaction_id',v_tx.id,'total_allocated_vnd',v_total);
end;$$;

-- Khớp lịch sử thủ công: giống 20260928010000, chỉ đổi event_key.
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
  if v_tx.match_status = 'identity_conflict' then
    raise exception 'TRANSACTION_IDENTITY_CONFLICT_LOCKED';
  end if;
  if v_tx.match_status not in ('unmatched', 'amount_mismatch', 'account_purpose_mismatch') then
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
    public.next_student_ledger_event_key('sepay-manual-payment-credit:' || v_tx.id::text),
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
      public.next_student_ledger_event_key('sepay-manual-bonus-credit:' || v_tx.id::text),
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

commit;
