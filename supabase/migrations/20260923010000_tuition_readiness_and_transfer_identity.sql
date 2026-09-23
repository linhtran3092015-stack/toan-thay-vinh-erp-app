-- Readiness and human-readable payment references. Existing issued references
-- and locked payment snapshots are deliberately preserved.
begin;

create function public.normalize_payment_reference(p_value text)
returns text language sql immutable strict set search_path='' as $$
  select pg_catalog.upper(pg_catalog.regexp_replace(pg_catalog.translate(p_value,
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD'),
    '[^a-zA-Z0-9]+','','g'));
$$;
revoke all on function public.normalize_payment_reference(text) from public,anon,authenticated;

create function public.student_payment_transfer_identity(p_student_id uuid,p_guardian_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select pg_catalog.concat_ws(' ',
    pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.upper(pg_catalog.translate(student.full_name,
      'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',
      'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD')), '[^A-Z0-9]+',' ','g')),
    student.birth_year::text,public.normalize_vietnam_phone(guardian.phone))
  from public.students student join public.student_guardians link on link.student_id=student.id
    and link.guardian_id=p_guardian_id and link.ended_at is null
  join public.guardians guardian on guardian.id=link.guardian_id
  where student.id=p_student_id;
$$;
revoke all on function public.student_payment_transfer_identity(uuid,uuid) from public,anon,authenticated;

create function public.format_student_payment_transfer_code(p_student_id uuid,p_guardian_id uuid,p_public_code text)
returns text language plpgsql stable security definer set search_path='' as $$
declare identity_text text;
begin
  identity_text:=public.student_payment_transfer_identity(p_student_id,p_guardian_id);
  if nullif(identity_text,'') is null or nullif(p_public_code,'') is null then
    raise exception 'PAYMENT_TRANSFER_IDENTITY_REQUIRED';
  end if;
  return identity_text || ' ' || p_public_code;
end; $$;
revoke all on function public.format_student_payment_transfer_code(uuid,uuid,text) from public,anon,authenticated;

-- A known exact reference always wins over a demographic identity. In particular,
-- an old/cancelled reference must never fall through to a new pending request.
create function public.find_sepay_payment_candidates(p_content text,p_code text)
returns setof uuid language plpgsql stable security definer set search_path='' as $$
declare content_key text:=public.normalize_payment_reference(coalesce(p_content,''));
  code_key text:=public.normalize_payment_reference(coalesce(p_code,''));
  explicit_reference boolean;
begin
  select exists(select 1 from public.student_payment_requests request
    where position(public.normalize_payment_reference(request.public_code) in content_key)>0
       or public.normalize_payment_reference(request.public_code)=code_key
       or public.normalize_payment_reference(request.transfer_code)=code_key)
  into explicit_reference;
  if explicit_reference or content_key ~ 'PAY[0-9]{6}[A-F0-9]{12}' then
    return query select request.id from public.student_payment_requests request
      where request.status='pending' and (
        position(public.normalize_payment_reference(request.public_code) in content_key)>0
        or public.normalize_payment_reference(request.public_code)=code_key
        or public.normalize_payment_reference(request.transfer_code)=code_key);
  else
    -- Only the complete identity or the fixed HOC PHI prefix is accepted; arbitrary
    -- text can contain another student's longer name. Multiple pending requests
    -- return multiple candidates so the existing webhook ambiguity guard stops.
    return query select request.id from public.student_payment_requests request
      cross join lateral (select public.normalize_payment_reference(
        public.student_payment_transfer_identity(request.student_id,request.guardian_id)) as identity_key) identity
      where request.status='pending' and length(identity.identity_key)>10
        and content_key in (identity.identity_key, 'HOCPHI' || identity.identity_key);
  end if;
end; $$;
revoke all on function public.find_sepay_payment_candidates(text,text) from public,anon,authenticated;

create function public.set_tuition_period_student_rates(
  p_period_id uuid,p_student_ids uuid[],p_unit_price_vnd bigint,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare period public.tuition_collection_periods; v_student_id uuid; first_missing date; saved integer:=0;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('students.manage_tuition_rates') or not public.has_permission('tuition_periods.view') then raise exception 'TUITION_RATE_PERMISSION_DENIED'; end if;
  if p_unit_price_vnd is null or p_unit_price_vnd<=0 or p_unit_price_vnd>9007199254740991
    or nullif(trim(p_reason),'') is null or length(trim(p_reason))<3
    or coalesce(cardinality(p_student_ids),0) not between 1 and 500
    or array_position(p_student_ids,null) is not null then raise exception 'TUITION_RATE_INPUT_INVALID'; end if;
  select * into period from public.tuition_collection_periods where id=p_period_id for update;
  if not found or period.status<>'draft' then raise exception 'TUITION_PERIOD_MUST_BE_DRAFT'; end if;
  for v_student_id in select distinct id from unnest(p_student_ids) id order by id loop
    perform 1 from public.students where id=v_student_id for update;
    select min(preview.session_date) into first_missing from public.preview_tuition_collection_period(p_period_id) preview
      where preview.student_id=v_student_id and preview.unit_price_vnd is null;
    if first_missing is null then raise exception 'TUITION_RATE_SELECTION_STALE'; end if;
    perform public.create_student_tuition_rate_version(v_student_id,first_missing,p_unit_price_vnd,trim(p_reason));
    saved:=saved+1;
  end loop;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data,reason)
    values(auth.uid(),'finance','tuition_period_rates_prepared','tuition_collection_period',p_period_id::text,
      jsonb_build_object('student_ids',p_student_ids,'unit_price_vnd',p_unit_price_vnd,'saved_count',saved),trim(p_reason));
  return jsonb_build_object('saved_count',saved);
end; $$;
revoke all on function public.set_tuition_period_student_rates(uuid,uuid[],bigint,text) from public,anon;
grant execute on function public.set_tuition_period_student_rates(uuid,uuid[],bigint,text) to authenticated;

-- Prepare only missing sources in this draft; one failed row rolls back the batch.
create function public.set_tuition_period_student_sources(
  p_period_id uuid,p_student_ids uuid[],p_lead_source_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare period public.tuition_collection_periods; v_student_id uuid; saved integer:=0;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('students.correct_acquisition_source') or not public.has_permission('tuition_periods.view') then raise exception 'STUDENT_SOURCE_PERMISSION_DENIED'; end if;
  if p_lead_source_id is null or nullif(trim(p_reason),'') is null or length(trim(p_reason))<3
    or coalesce(cardinality(p_student_ids),0) not between 1 and 500
    or array_position(p_student_ids,null) is not null then raise exception 'STUDENT_SOURCE_INPUT_INVALID'; end if;
  if not exists(select 1 from public.crm_lead_sources where id=p_lead_source_id and is_active) then raise exception 'STUDENT_SOURCE_INPUT_INVALID'; end if;
  select * into period from public.tuition_collection_periods where id=p_period_id for update;
  if not found or period.status<>'draft' then raise exception 'TUITION_PERIOD_MUST_BE_DRAFT'; end if;
  for v_student_id in select distinct id from unnest(p_student_ids) id order by id loop
    perform 1 from public.students where id=v_student_id for update;
    if not exists(select 1 from public.preview_tuition_collection_period(p_period_id) preview
      where preview.student_id=v_student_id and preview.acquisition_source_id is null) then
      raise exception 'TUITION_SOURCE_SELECTION_STALE';
    end if;
    perform public.correct_student_acquisition_source(v_student_id,p_lead_source_id,trim(p_reason));
    saved:=saved+1;
  end loop;
  return jsonb_build_object('saved_count',saved);
end; $$;
revoke all on function public.set_tuition_period_student_sources(uuid,uuid[],uuid,text) from public,anon;
grant execute on function public.set_tuition_period_student_sources(uuid,uuid[],uuid,text) to authenticated;

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
    left join public.student_session_balances balance on balance.student_id=roster.student_id
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

  -- JavaScript's existing positive Math.round(amount / sessions) behavior is
  -- reproduced with PostgreSQL numeric rounding. The legacy caller argument is
  -- deliberately ignored.
  v_unit_price := pg_catalog.round(
    p_expected_amount_vnd::numeric / p_purchased_sessions::numeric
  )::bigint;

  if v_unit_price <= 0 then
    raise exception 'INVALID_UNIT_PRICE: Don gia phai lon hon 0.';
  end if;

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
  v_transfer_code := public.format_student_payment_transfer_code(p_student_id,v_guardian_id,v_public_code);

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

create or replace function public.lock_tuition_collection_period(p_period_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_period public.tuition_collection_periods; v_template jsonb:='{}'::jsonb; v_template_id uuid; v_account public.sepay_receiving_account_versions%rowtype;
  v_student record; v_line record; v_item uuid; v_balance bigint; v_credit integer; v_debit integer; v_payable integer; v_amount bigint; v_sessions integer; v_first_rate bigint; v_request uuid; v_public text; v_transfer text;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('tuition_periods.lock') then raise exception 'TUITION_PERIOD_LOCK_PERMISSION_DENIED'; end if;
  select * into v_period from public.tuition_collection_periods where id=p_period_id for update;
  if not found then raise exception 'TUITION_PERIOD_NOT_FOUND'; end if;
  if v_period.status='locked' then return jsonb_build_object('period_id',v_period.id,'status','locked','idempotent',true); end if;
  if not exists(select 1 from public.preview_tuition_collection_period(p_period_id)) then raise exception 'TUITION_PERIOD_EMPTY'; end if;
  if exists(select 1 from public.preview_tuition_collection_period(p_period_id) where blocker_code is not null) then raise exception 'TUITION_PERIOD_BLOCKERS'; end if;
  select * into v_account from public.sepay_receiving_account_versions
  where purpose='renewal' and status='active' and effective_from <= v_period.ends_on and coalesce(effective_to,v_period.ends_on) >= v_period.ends_on
  order by effective_from desc limit 1;
  if v_account.id is null or exists(select 1 from public.sepay_receiving_account_versions where purpose='renewal' and status='active' and effective_from <= v_period.ends_on and coalesce(effective_to,v_period.ends_on) >= v_period.ends_on and id<>v_account.id) then raise exception 'RENEWAL_RECEIVING_ACCOUNT_BLOCKER'; end if;
  select tv.id,tv.content into v_template_id,v_template from public.tuition_receipt_template_versions tv where tv.id=coalesce(v_period.receipt_template_version_id,(select id from public.tuition_receipt_template_versions order by published_at desc limit 1));
  if v_template_id is null then raise exception 'RECEIPT_TEMPLATE_REQUIRED'; end if;
  for v_student in select student_id,(array_agg(enrollment_id order by session_date))[1] enrollment_id,(array_agg(class_id order by session_date))[1] class_id,(array_agg(acquisition_source_id order by session_date))[1] source_id,min(opening_balance_sessions) balance from public.preview_tuition_collection_period(p_period_id) group by student_id loop
    v_balance:=v_student.balance; v_credit:=greatest(v_balance,0)::integer; v_debit:=greatest(-v_balance,0)::integer; v_payable:=0; v_amount:=0; v_sessions:=0; v_first_rate:=null;
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

create or replace function public.reissue_tuition_collection_item(p_original_item_id uuid, p_payable_amount_vnd bigint, p_reason text)
returns public.tuition_collection_items language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_original public.tuition_collection_items; v_new public.tuition_collection_items; v_period public.tuition_collection_periods; v_account public.sepay_receiving_account_versions; v_guardian uuid; v_request uuid; v_public text; v_transfer text; v_new_id uuid:=gen_random_uuid(); v_contract jsonb:='{}'::jsonb;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('tuition_periods.adjust') then raise exception 'TUITION_PERIOD_ADJUST_PERMISSION_DENIED'; end if;
 if p_payable_amount_vnd is null or p_payable_amount_vnd<0 or nullif(trim(p_reason),'') is null then raise exception 'TUITION_REISSUE_INPUT_INVALID'; end if;
 select * into v_original from public.tuition_collection_items where id=p_original_item_id for update;
 if not found then raise exception 'TUITION_ITEM_NOT_FOUND'; end if;
 if exists (select 1 from public.tuition_collection_item_adjustments where original_item_id=v_original.id) then raise exception 'TUITION_ITEM_ALREADY_REISSUED'; end if;
 if p_payable_amount_vnd>0 then
   select * into v_period from public.tuition_collection_periods where id=v_original.period_id;
   select * into v_account from public.sepay_receiving_account_versions where purpose='renewal' and status='active' and effective_from<=current_date and coalesce(effective_to,current_date)>=current_date order by effective_from desc limit 1;
   if v_account.id is null then raise exception 'RENEWAL_RECEIVING_ACCOUNT_BLOCKER'; end if;
   select guardian_id into v_guardian from public.student_guardians where student_id=v_original.student_id and is_primary and ended_at is null limit 1;
   if v_guardian is null then raise exception 'STUDENT_PRIMARY_GUARDIAN_NOT_FOUND'; end if;
   v_public:='PAY-'||to_char(now(),'YYMMDD')||'-'||upper(substr(md5(random()::text),1,12)); v_transfer:=public.format_student_payment_transfer_code(v_original.student_id,v_guardian,v_public);
   insert into public.student_payment_requests(public_code,student_id,guardian_id,expected_amount_vnd,purchased_sessions,bonus_sessions,calculated_unit_price_vnd,topup_type,transfer_code,notes,created_by) values(v_public,v_original.student_id,v_guardian,p_payable_amount_vnd,greatest(v_original.payable_sessions,1),0,round(p_payable_amount_vnd::numeric/greatest(v_original.payable_sessions,1))::bigint,'renewal',v_transfer,'Tuition reissue '||v_new_id::text,v_actor) returning id into v_request;
   v_contract:=jsonb_build_object('version',1,'receiving_account_version_id',v_account.id,'purpose','renewal','bank_code',v_account.bank_code,'account_number',v_account.account_number,'account_display_name',v_account.account_display_name,'amount_vnd',p_payable_amount_vnd,'payment_request_id',v_request,'public_code',v_public,'transfer_code',v_transfer,'qr_format','vietqr.app');
 end if;
 insert into public.tuition_collection_items(id,period_id,student_id,enrollment_id,class_id,acquisition_source_id,student_snapshot,source_snapshot,opening_balance_sessions,scheduled_chargeable_sessions,credit_offset_sessions,debit_carry_sessions,payable_sessions,payable_amount_vnd,status,receipt_template_snapshot,receipt_template_version_id,payment_request_id,payment_contract_snapshot,reissued_from_item_id,created_by)
 values(v_new_id,v_original.period_id,v_original.student_id,v_original.enrollment_id,v_original.class_id,v_original.acquisition_source_id,v_original.student_snapshot,v_original.source_snapshot,v_original.opening_balance_sessions,v_original.scheduled_chargeable_sessions,v_original.credit_offset_sessions,v_original.debit_carry_sessions,case when p_payable_amount_vnd=0 then 0 else v_original.payable_sessions end,p_payable_amount_vnd,case when p_payable_amount_vnd=0 then 'no_payment' else 'pending_payment' end,v_original.receipt_template_snapshot,v_original.receipt_template_version_id,v_request,v_contract,v_original.id,v_actor) returning * into v_new;
 insert into public.tuition_collection_item_adjustments(original_item_id,replacement_item_id,reason,created_by) values(v_original.id,v_new.id,trim(p_reason),v_actor);
 insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data,reason) values(v_actor,'finance','tuition_item_reissued','tuition_collection_item',v_new.id::text,to_jsonb(v_new),trim(p_reason));
 return v_new;
end; $$;

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
    and request.id in (select public.find_sepay_payment_candidates(p_content,p_code));

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
    and request.id in (select public.find_sepay_payment_candidates(p_content,p_code))
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

commit;
