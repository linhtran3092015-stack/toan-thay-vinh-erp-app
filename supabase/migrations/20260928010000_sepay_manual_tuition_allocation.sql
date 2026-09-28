-- Manual reconciliation applies to both webhook and imported transactions.
-- Existing exact-request settlement remains authoritative for sessions and price.
begin;

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
    or v_tx.transfer_type is distinct from 'in'
    or v_tx.match_status not in ('unmatched', 'amount_mismatch', 'account_purpose_mismatch')
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

-- Narrow student lookup: no broad students/guardians table privileges required.
create or replace function public.search_sepay_allocation_students(p_search text)
returns table(student_id uuid, student_name text, student_code text, birth_year smallint,
 guardian_id uuid, guardian_name text, guardian_phone text, pending_requests jsonb)
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not (public.has_permission('sepay.allocate') or public.has_permission('payments.manage')) then
  raise exception 'SEPAY_ALLOCATE_PERMISSION_DENIED';
 end if;
 if p_search is null or length(btrim(p_search)) < 2 or length(p_search)>100 or public.normalize_payment_reference(p_search)='' then
  raise exception 'INVALID_SEARCH';
 end if;
 return query
 select s.id,s.full_name,s.public_code,s.birth_year,g.id,g.full_name,g.phone,
 coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'code',r.public_code,'amountVnd',r.expected_amount_vnd,
  'sessions',r.purchased_sessions,'bonusSessions',r.bonus_sessions,'topupType',r.topup_type,'status',r.status) order by r.created_at desc)
  from public.student_payment_requests r where r.student_id=s.id and r.status in ('pending','partially_paid')), '[]'::jsonb)
 from public.students s
 join public.student_guardians sg on sg.student_id=s.id and sg.is_primary and sg.ended_at is null
 join public.guardians g on g.id=sg.guardian_id
 where s.lifecycle_status='active' and (
  position(public.normalize_payment_reference(p_search) in public.normalize_payment_reference(s.full_name))>0
  or position(lower(btrim(p_search)) in lower(s.public_code))>0
  or position(btrim(p_search) in g.phone)>0)
 order by s.full_name,s.id limit 30;
end;$$;

-- One transaction, one atomic allocation batch. Request-linked rows settle the
-- original obligation; direct rows must not silently leave an existing debt open.
create or replace function public.allocate_sepay_tuition_manually(
 p_sepay_transaction_id uuid, p_allocations jsonb, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid:=auth.uid(); v_tx public.sepay_transactions; v_item jsonb;
 v_student uuid; v_guardian uuid; v_request_id uuid; v_request public.student_payment_requests;
 v_amount bigint; v_sessions integer; v_bonus integer; v_price bigint;
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
  if v_request_id is not null then
   select * into v_request from public.student_payment_requests where id=v_request_id for update;
   if not found or v_request.student_id is distinct from v_student or v_request.status<>'pending'
    or v_request.paid_amount_vnd<>0 then raise exception 'PAYMENT_REQUEST_NOT_AVAILABLE'; end if;
   if v_request.topup_type<>v_type then raise exception 'ACCOUNT_PURPOSE_TOPUP_TYPE_MISMATCH'; end if;
   if v_request.expected_amount_vnd<>v_amount or v_request.purchased_sessions<>v_sessions
    or v_request.bonus_sessions<>v_bonus then raise exception 'PAYMENT_REQUEST_ALLOCATION_MISMATCH'; end if;
   v_price:=coalesce(nullif(v_request.calculated_unit_price_vnd,0),v_amount/v_sessions);
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
   'request',v_request_id,'amount',v_amount,'sessions',v_sessions,'bonus',v_bonus,'price',v_price));
 end loop;
 if v_total<>v_tx.amount_vnd then raise exception 'ALLOCATION_TOTAL_MUST_MATCH_TRANSACTION'; end if;
 v_ref:='ALLOC-'||v_tx.id::text;
 for v_item in select value from jsonb_array_elements(v_rows)
 loop
  v_student:=(v_item->>'student')::uuid; v_guardian:=(v_item->>'guardian')::uuid;
  v_request_id:=(v_item->>'request')::uuid; v_amount:=(v_item->>'amount')::bigint;
  v_sessions:=(v_item->>'sessions')::integer; v_bonus:=(v_item->>'bonus')::integer; v_price:=(v_item->>'price')::bigint;
  if v_request_id is not null then
   update public.student_payment_requests set status='paid',paid_amount_vnd=v_amount,paid_at=v_tx.transaction_at,
    calculated_unit_price_vnd=v_price,updated_at=now() where id=v_request_id;
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
   'payment_request_id',v_request_id,'allocation_amount_vnd',v_amount,'account_purpose',v_tx.account_purpose),v_actor);
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

create or replace function public.get_sepay_allocation_details(p_sepay_transaction_id uuid)
returns table(student_name text, student_code text, allocated_amount_vnd bigint, allocated_sessions integer,
 bonus_sessions integer, unit_price_vnd bigint, notes text, allocated_at timestamptz, allocated_by_name text, payment_request_code text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('sepay.view') then raise exception 'SEPAY_VIEW_PERMISSION_DENIED'; end if;
 return query select s.full_name,s.public_code,a.allocated_amount_vnd,a.allocated_sessions,a.bonus_sessions,
  a.unit_price_vnd,a.notes,a.created_at,p.display_name,r.public_code
 from public.payment_split_allocations a join public.students s on s.id=a.student_id
 left join public.profiles p on p.id=a.allocated_by
 left join public.student_credit_lots l on l.id=a.credit_lot_id
 left join public.student_payment_requests r on r.id=l.payment_request_id
 where a.sepay_transaction_id=p_sepay_transaction_id order by s.full_name,a.id;
end;$$;
revoke all on function public.search_sepay_allocation_students(text) from public,anon;
revoke all on function public.allocate_sepay_tuition_manually(uuid,jsonb,text) from public,anon;
revoke all on function public.get_sepay_allocation_details(uuid) from public,anon;
grant execute on function public.search_sepay_allocation_students(text) to authenticated;
grant execute on function public.allocate_sepay_tuition_manually(uuid,jsonb,text) to authenticated;
grant execute on function public.get_sepay_allocation_details(uuid) to authenticated;
revoke all on function public.search_sepay_reconciliation_candidates(uuid,text,integer) from public,anon;
grant execute on function public.search_sepay_reconciliation_candidates(uuid,text,integer) to authenticated;
revoke all on function public.match_sepay_historical_transaction_to_payment_request(uuid,uuid,text) from public,anon;
grant execute on function public.match_sepay_historical_transaction_to_payment_request(uuid,uuid,text) to authenticated;
commit;
