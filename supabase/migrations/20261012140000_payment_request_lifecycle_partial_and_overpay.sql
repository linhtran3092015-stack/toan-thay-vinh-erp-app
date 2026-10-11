-- Vòng đời phiếu thu: hủy phiếu, thanh toán một phần, thanh toán dư.
--
-- Trước đây phân bổ gắn phiếu bắt buộc số tiền, số buổi, buổi tặng phải
-- trùng khớp tuyệt đối; phiếu không bao giờ chuyển sang `partially_paid` dù
-- trạng thái tồn tại; không có cách hủy phiếu. Phụ huynh chuyển dư hay thiếu
-- so với phiếu khiến cả giao dịch lẫn phiếu kẹt mãi.
-- Quyết định chủ trung tâm 11/10/2026: tiền chuyển dư → kế toán tự xác định
-- số buổi cộng thêm (không quy đổi tự động).
--
-- 1. cancel_payment_request: hủy phiếu đang chờ (chưa thu đồng nào), có lý
--    do và audit. Phiếu đã gắn vào phiếu học phí kỳ thu thì phải tái phát
--    hành thay vì hủy.
-- 2. allocate_sepay_tuition_manually với dòng gắn phiếu:
--    - số tiền phân bổ >= phần còn thiếu của phiếu → phiếu `paid`; số buổi do
--      kế toán nhập nhưng không ít hơn số buổi phiếu (khi là lần thu đầu);
--    - số tiền < phần còn thiếu → phiếu `partially_paid`, cộng dồn số đã thu,
--      vẫn mở để nhận lần chuyển sau;
--    - đơn giá lô = số tiền / số buổi thực nhận, trừ khi đúng bằng phiếu.
--    Mọi kiểm soát khác (tổng = giao dịch, khóa giao dịch, chặn trùng, audit)
--    giữ nguyên so với 20260928010000.

begin;

create or replace function public.cancel_payment_request(p_request_id uuid, p_reason text)
returns public.student_payment_requests
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_request public.student_payment_requests; v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('payments.manage') then raise exception 'PAYMENTS_MANAGE_PERMISSION_DENIED'; end if;
 if v_reason is null or length(v_reason)>1000 then raise exception 'REASON_REQUIRED'; end if;
 select * into v_request from public.student_payment_requests where id=p_request_id for update;
 if not found then raise exception 'PAYMENT_REQUEST_NOT_FOUND'; end if;
 if v_request.status<>'pending' or v_request.paid_amount_vnd<>0 then raise exception 'PAYMENT_REQUEST_NOT_PENDING'; end if;
 if exists(select 1 from public.tuition_collection_items where payment_request_id=v_request.id) then
  raise exception 'PAYMENT_REQUEST_LINKED_TO_TUITION_ITEM';
 end if;
 update public.student_payment_requests
 set status='cancelled', cancelled_at=now(), cancelled_by=v_actor, cancellation_reason=v_reason
 where id=v_request.id returning * into v_request;
 insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,old_data,new_data,reason)
 values(v_actor,'finance','payment_request_cancelled','student_payment_request',v_request.id::text,
  jsonb_build_object('status','pending','expected_amount_vnd',v_request.expected_amount_vnd),
  jsonb_build_object('status','cancelled'),v_reason);
 return v_request;
end;$$;
revoke all on function public.cancel_payment_request(uuid,text) from public,anon;
grant execute on function public.cancel_payment_request(uuid,text) to authenticated;

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
  values(v_student,'payment_credit',v_sessions,v_date,'sepay-manual-allocation:'||v_tx.id||':'||v_student,
   v_ref,v_price,btrim(p_reason),jsonb_build_object('sepay_transaction_id',v_tx.id,'credit_lot_id',v_lot,
   'payment_request_id',v_request_id,'allocation_amount_vnd',v_amount,'account_purpose',v_tx.account_purpose,'settlement',v_settle),v_actor);
  if v_bonus>0 then
   insert into public.student_session_ledger_entries(student_id,entry_type,delta_sessions,effective_on,event_key,
    reference_code,note,metadata,created_by)
   values(v_student,'bonus_credit',v_bonus,v_date,'sepay-manual-allocation-bonus:'||v_tx.id||':'||v_student,
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

commit;
