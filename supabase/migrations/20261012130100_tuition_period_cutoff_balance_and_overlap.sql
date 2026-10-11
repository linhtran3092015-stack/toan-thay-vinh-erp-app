-- Toán kỳ thu học phí: số dư tại ngày bắt đầu kỳ, nợ cũ không tính hai lần,
-- kỳ không được chồng nhau.
--
-- 1. preview_tuition_collection_period lấy số dư đầu kỳ = tổng sổ buổi, loại
--    riêng các lần trừ buổi (session_charge) có ngày trong kỳ — đó chính là
--    các buổi đang được lập phiếu. Trước đây lấy số dư *hiện tại*, nên khóa
--    kỳ sau khi kỳ đã bắt đầu sẽ tính trùng các buổi đã trừ trong kỳ. Tiền
--    nạp / điều chỉnh tay trong kỳ vẫn được tính vào số dư đầu kỳ.
-- 2. lock_tuition_collection_period trừ khỏi phần "nợ đầu kỳ" số buổi đã nằm
--    trên phiếu chờ thanh toán của kỳ trước (chưa bị thay thế), để một khoản
--    nợ không xuất hiện trên hai phiếu.
-- 3. Kỳ mới không được chồng ngày với kỳ đã khóa (kiểm tra khi tạo và khi
--    khóa): mã lỗi TUITION_PERIOD_OVERLAPS.
-- Ngoài ba điểm trên, nội dung hàm giữ nguyên so với 20260923010000 và
-- 20260814100000.

begin;

create or replace function public.preview_tuition_collection_period(p_period_id uuid)
returns table(student_id uuid,enrollment_id uuid,class_id uuid,class_session_id uuid,session_date date,session_kind text,unit_price_vnd bigint,acquisition_source_id uuid,opening_balance_sessions bigint,blocker_code text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='28000',message='AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('tuition_periods.view') then raise exception using errcode='42501',message='TUITION_PERIOD_VIEW_PERMISSION_DENIED'; end if;
  return query
  with period as (
    select * from public.tuition_collection_periods where id=p_period_id
  ), sessions as (
    select session_row.id
    from public.class_sessions session_row
    join period on session_row.session_date between period.starts_on and period.ends_on
    left join public.class_sessions source_session on source_session.id=session_row.makeup_for_session_id
    where (session_row.session_kind='regular' and session_row.status<>'cancelled')
       or (session_row.session_kind='makeup' and session_row.status<>'cancelled' and source_session.status='cancelled')
  ), candidates as (
    select
      roster.student_id,
      roster.student_enrollment_id as enrollment_id,
      roster.enrollment_class_id as class_id,
      session_row.id as class_session_id,
      session_row.session_date,
      session_row.session_kind,
      rate.unit_price_vnd,
      coalesce(source_assignment.lead_source_id, crm_case.lead_source_id) as acquisition_source_id,
      coalesce(balance.balance_sessions,0)::bigint as opening_balance_sessions
    from sessions
    join public.class_sessions session_row on session_row.id=sessions.id
    join public.resolve_class_session_rosters_for_tuition(array(select id from sessions)) roster
      on roster.class_session_id=session_row.id
    left join lateral (
      select version.unit_price_vnd
      from public.student_tuition_rate_versions version
      where version.student_id=roster.student_id and version.effective_from<=session_row.session_date
      order by version.effective_from desc
      limit 1
    ) rate on true
    left join lateral (
      select assignment.lead_source_id
      from public.student_acquisition_source_assignments assignment
      where assignment.student_id=roster.student_id and assignment.is_current
      order by assignment.assigned_at desc
      limit 1
    ) source_assignment on true
    left join lateral (
      select crm.lead_source_id
      from public.crm_cases crm
      where crm.student_id=roster.student_id
      order by crm.updated_at desc,crm.created_at desc
      limit 1
    ) crm_case on true
    -- Opening balance excludes the period's own session charges (those are the
    -- sessions being billed), so a late lock cannot bill them twice. Payments
    -- and manual credits dated inside the period still count.
    left join lateral (
      select sum(ledger.delta_sessions)::bigint as balance_sessions
      from public.student_session_ledger_entries ledger
      cross join period
      where ledger.student_id=roster.student_id
        and not (ledger.entry_type='session_charge' and ledger.effective_on between period.starts_on and period.ends_on)
    ) balance on true
  )
  select
    candidates.student_id,
    candidates.enrollment_id,
    candidates.class_id,
    candidates.class_session_id,
    candidates.session_date,
    candidates.session_kind,
    candidates.unit_price_vnd,
    candidates.acquisition_source_id,
    candidates.opening_balance_sessions,
    case
      when candidates.unit_price_vnd is null then 'MISSING_EFFECTIVE_TUITION_RATE'
      when candidates.acquisition_source_id is null then 'MISSING_ACQUISITION_SOURCE'
      when not exists(select 1 from public.student_guardians guardian where guardian.student_id=candidates.student_id and guardian.is_primary and guardian.ended_at is null) then 'MISSING_PRIMARY_GUARDIAN'
      else null
    end
  from candidates;
end;
$$;

create or replace function public.tuition_period_overlaps_locked(p_period_id uuid, p_starts_on date, p_ends_on date)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.tuition_collection_periods other
    where other.status='locked'
      and (p_period_id is null or other.id<>p_period_id)
      and daterange(other.starts_on, other.ends_on, '[]') && daterange(p_starts_on, p_ends_on, '[]')
  );
$$;
revoke all on function public.tuition_period_overlaps_locked(uuid, date, date) from public, anon, authenticated;

create or replace function public.create_tuition_collection_period(p_name text, p_starts_on date, p_ends_on date, p_due_on date default null, p_receipt_template_version_id uuid default null)
returns public.tuition_collection_periods
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_row public.tuition_collection_periods;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('tuition_periods.manage') then raise exception 'TUITION_PERIOD_MANAGE_PERMISSION_DENIED'; end if;
  if nullif(trim(p_name),'') is null or p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on or (p_due_on is not null and p_due_on < p_starts_on) then raise exception 'TUITION_PERIOD_INPUT_INVALID'; end if;
  if public.tuition_period_overlaps_locked(null, p_starts_on, p_ends_on) then raise exception 'TUITION_PERIOD_OVERLAPS'; end if;
  insert into public.tuition_collection_periods(name,starts_on,ends_on,due_on,receipt_template_version_id,created_by)
  values(trim(p_name),p_starts_on,p_ends_on,p_due_on,p_receipt_template_version_id,v_actor) returning * into v_row;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data)
  values(v_actor,'finance','tuition_period_created','tuition_collection_period',v_row.id::text,to_jsonb(v_row));
  return v_row;
end; $$;

create or replace function public.lock_tuition_collection_period(p_period_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_period public.tuition_collection_periods; v_template jsonb:='{}'::jsonb; v_template_id uuid; v_account public.sepay_receiving_account_versions%rowtype;
  v_student record; v_line record; v_item uuid; v_balance bigint; v_credit integer; v_debit integer; v_outstanding integer; v_payable integer; v_amount bigint; v_sessions integer; v_first_rate bigint; v_request uuid; v_public text; v_transfer text;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('tuition_periods.lock') then raise exception 'TUITION_PERIOD_LOCK_PERMISSION_DENIED'; end if;
  select * into v_period from public.tuition_collection_periods where id=p_period_id for update;
  if not found then raise exception 'TUITION_PERIOD_NOT_FOUND'; end if;
  if v_period.status='locked' then return jsonb_build_object('period_id',v_period.id,'status','locked','idempotent',true); end if;
  if public.tuition_period_overlaps_locked(v_period.id, v_period.starts_on, v_period.ends_on) then raise exception 'TUITION_PERIOD_OVERLAPS'; end if;
  if exists(select 1 from public.preview_tuition_collection_period(p_period_id) where blocker_code is not null) then raise exception 'TUITION_PERIOD_BLOCKERS'; end if;
  select * into v_account from public.sepay_receiving_account_versions
  where purpose='renewal' and status='active' and effective_from <= v_period.ends_on and coalesce(effective_to,v_period.ends_on) >= v_period.ends_on
  order by effective_from desc limit 1;
  if v_account.id is null or exists(select 1 from public.sepay_receiving_account_versions where purpose='renewal' and status='active' and effective_from <= v_period.ends_on and coalesce(effective_to,v_period.ends_on) >= v_period.ends_on and id<>v_account.id) then raise exception 'RENEWAL_RECEIVING_ACCOUNT_BLOCKER'; end if;
  if not exists(select 1 from public.preview_tuition_collection_period(p_period_id)) then raise exception 'TUITION_PERIOD_EMPTY'; end if;
  select tv.id,tv.content into v_template_id,v_template from public.tuition_receipt_template_versions tv where tv.id=coalesce(v_period.receipt_template_version_id,(select id from public.tuition_receipt_template_versions order by published_at desc limit 1));
  if v_template_id is null then raise exception 'RECEIPT_TEMPLATE_REQUIRED'; end if;
  for v_student in select student_id,(array_agg(enrollment_id order by session_date))[1] enrollment_id,(array_agg(class_id order by session_date))[1] class_id,(array_agg(acquisition_source_id order by session_date))[1] source_id,min(opening_balance_sessions) balance from public.preview_tuition_collection_period(p_period_id) group by student_id loop
    v_balance:=v_student.balance; v_credit:=greatest(v_balance,0)::integer; v_debit:=greatest(-v_balance,0)::integer; v_payable:=0; v_amount:=0; v_sessions:=0; v_first_rate:=null;
    -- Debt already billed on a still-pending notice of another period is not
    -- billed again here; it stays collectable through that notice.
    if v_debit>0 then
      select coalesce(sum(item.payable_sessions),0)::integer into v_outstanding
      from public.tuition_collection_items item
      join public.student_payment_requests request on request.id=item.payment_request_id
      where item.student_id=v_student.student_id and item.period_id<>p_period_id
        and item.status='pending_payment' and request.status='pending'
        and not exists(select 1 from public.tuition_collection_item_adjustments adj where adj.original_item_id=item.id);
      v_debit:=greatest(v_debit-v_outstanding,0);
    end if;
    insert into public.tuition_collection_items(period_id,student_id,enrollment_id,class_id,acquisition_source_id,student_snapshot,source_snapshot,opening_balance_sessions,scheduled_chargeable_sessions,credit_offset_sessions,debit_carry_sessions,payable_sessions,payable_amount_vnd,status,receipt_template_snapshot,receipt_template_version_id,created_by)
    select p_period_id,v_student.student_id,v_student.enrollment_id,v_student.class_id,v_student.source_id,jsonb_build_object('student_id',s.id,'full_name',s.full_name,'public_code',s.public_code,'current_grade',s.current_grade,'class_id',c.id,'class_name',c.name,'class_code',c.code,'class_grade',c.grade),jsonb_build_object('source_id',ls.id,'code',ls.code,'name',ls.name),v_balance,0,0,v_debit,0,0,'no_payment',v_template,v_template_id,v_actor from public.students s join public.classes c on c.id=v_student.class_id join public.crm_lead_sources ls on ls.id=v_student.source_id where s.id=v_student.student_id returning id into v_item;
    for v_line in select * from public.preview_tuition_collection_period(p_period_id) where student_id=v_student.student_id order by session_date,class_session_id loop
      v_sessions:=v_sessions+1; v_first_rate:=coalesce(v_first_rate,v_line.unit_price_vnd);
      if v_credit>0 then v_credit:=v_credit-1; else v_payable:=v_payable+1; v_amount:=v_amount+v_line.unit_price_vnd; end if;
      insert into public.tuition_collection_item_lines(item_id,class_session_id,line_kind,session_date,session_kind,unit_price_vnd,session_count,payable_session_count,amount_vnd,snapshot)
      values(v_item,v_line.class_session_id,'session',v_line.session_date,v_line.session_kind,v_line.unit_price_vnd,1,case when v_sessions <= greatest(v_balance,0) then 0 else 1 end,case when v_sessions <= greatest(v_balance,0) then 0 else v_line.unit_price_vnd end,jsonb_build_object('session_id',v_line.class_session_id,'session_date',v_line.session_date,'session_kind',v_line.session_kind,'rate_vnd',v_line.unit_price_vnd));
    end loop;
    if v_debit>0 then v_payable:=v_payable+v_debit; v_amount:=v_amount+(v_debit*v_first_rate); insert into public.tuition_collection_item_lines(item_id,line_kind,unit_price_vnd,session_count,payable_session_count,amount_vnd,snapshot) values(v_item,'opening_debit',v_first_rate,v_debit,v_debit,v_debit*v_first_rate,jsonb_build_object('reason','opening_negative_session_balance')) ; end if;
    update public.tuition_collection_items set scheduled_chargeable_sessions=v_sessions,credit_offset_sessions=greatest(v_balance,0)::integer,payable_sessions=v_payable,payable_amount_vnd=v_amount,status=case when v_amount=0 then 'no_payment' else 'pending_payment' end where id=v_item;
    if v_amount>0 then
      select guardian_id into strict v_request from public.student_guardians where student_id=v_student.student_id and is_primary and ended_at is null limit 1;
      v_public:='PAY-'||to_char(now(),'YYMMDD')||'-'||upper(substr(md5(random()::text),1,12)); v_transfer:=public.format_student_payment_transfer_code(v_student.student_id,v_request,v_public);
      insert into public.student_payment_requests(public_code,student_id,guardian_id,expected_amount_vnd,purchased_sessions,bonus_sessions,calculated_unit_price_vnd,topup_type,transfer_code,notes,created_by)
      values(v_public,v_student.student_id,v_request,v_amount,v_payable,0,round(v_amount::numeric/v_payable)::bigint,'renewal',v_transfer,'Tuition collection item '||v_item::text,v_actor) returning id into v_request;
      update public.tuition_collection_items set payment_request_id=v_request, payment_contract_snapshot=jsonb_build_object('version',1,'receiving_account_version_id',v_account.id,'purpose','renewal','bank_code',v_account.bank_code,'account_number',v_account.account_number,'account_display_name',v_account.account_display_name,'amount_vnd',v_amount,'payment_request_id',v_request,'public_code',v_public,'transfer_code',v_transfer,'qr_format','vietqr.app') where id=v_item;
      insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data) values(v_actor,'finance','tuition_payment_request_created','student_payment_request',v_request::text,jsonb_build_object('tuition_collection_item_id',v_item,'purpose','renewal','amount_vnd',v_amount,'transfer_code',v_transfer));
    end if;
  end loop;
  update public.tuition_collection_periods set status='locked',locked_by=v_actor,locked_at=now(),receipt_template_version_id=v_template_id where id=p_period_id;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data) values(v_actor,'finance','tuition_period_locked','tuition_collection_period',p_period_id::text,jsonb_build_object('template_version_id',v_template_id));
  return jsonb_build_object('period_id',p_period_id,'status','locked','idempotent',false);
end; $$;

commit;
