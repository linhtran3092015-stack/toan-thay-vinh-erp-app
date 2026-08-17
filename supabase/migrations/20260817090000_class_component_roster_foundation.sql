begin;

create extension if not exists btree_gist;

create table public.class_component_links (
  id uuid primary key default gen_random_uuid(),
  parent_class_id uuid not null references public.classes(id) on delete restrict,
  component_class_id uuid not null references public.classes(id) on delete restrict,
  component_order smallint not null check (component_order in (1, 2)),
  effective_from date not null,
  effective_to date,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  constraint class_component_links_distinct_check check (parent_class_id <> component_class_id),
  constraint class_component_links_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint class_component_links_mapping_overlap_excl exclude using gist (
    parent_class_id with =, component_class_id with =,
    daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&
  ),
  constraint class_component_links_order_overlap_excl exclude using gist (
    parent_class_id with =, component_order with =,
    daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&
  )
);

create index class_component_links_component_effective_idx
  on public.class_component_links (component_class_id, effective_from, effective_to);

create or replace function public.validate_class_component_link_foundation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.classes%rowtype; c public.classes%rowtype; n integer;
begin
  select * into p from public.classes where id = new.parent_class_id for share;
  select * into c from public.classes where id = new.component_class_id for share;
  if p.id is null or c.id is null then raise exception 'CLASS_COMPONENT_LINK_CLASS_NOT_FOUND'; end if;
  if p.academic_year_id <> c.academic_year_id then raise exception 'CLASS_COMPONENT_LINK_ACADEMIC_YEAR_MISMATCH'; end if;
  if p.grade <> c.grade then raise exception 'CLASS_COMPONENT_LINK_GRADE_MISMATCH'; end if;
  if p.weekly_session_count <> 2 then raise exception 'CLASS_COMPONENT_LINK_PARENT_WEEKLY_SESSION_COUNT_INVALID'; end if;
  if c.weekly_session_count <> 1 then raise exception 'CLASS_COMPONENT_LINK_COMPONENT_WEEKLY_SESSION_COUNT_INVALID'; end if;
  if exists (
    select 1
    from public.class_schedule_templates template
    where template.class_id = new.parent_class_id
      and template.effective_from <= coalesce(new.effective_to, 'infinity'::date)
      and coalesce(template.effective_to, 'infinity'::date) >= new.effective_from
  ) then
    raise exception 'COMPOSITE_PARENT_CANNOT_HAVE_SCHEDULE_TEMPLATE';
  end if;
  if exists (select 1 from public.class_component_links x where x.component_class_id = new.parent_class_id and x.id is distinct from new.id)
    or exists (select 1 from public.class_component_links x where x.parent_class_id = new.component_class_id and x.id is distinct from new.id) then
    raise exception 'CLASS_COMPONENT_LINK_NESTING_NOT_ALLOWED';
  end if;
  select count(distinct x.component_class_id) into n from public.class_component_links x
  where x.parent_class_id = new.parent_class_id and x.id is distinct from new.id
    and daterange(x.effective_from, coalesce(x.effective_to + 1, 'infinity'::date), '[)')
      && daterange(new.effective_from, coalesce(new.effective_to + 1, 'infinity'::date), '[)');
  if n >= 2 then raise exception 'CLASS_COMPONENT_LINK_MAXIMUM_TWO_EFFECTIVE_COMPONENTS'; end if;
  return new;
end;
$$;

create trigger class_component_links_validate_business_rules
before insert or update on public.class_component_links
for each row execute function public.validate_class_component_link_foundation();

create or replace function public.protect_linked_class_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.academic_year_id, new.grade, new.weekly_session_count) is distinct from (old.academic_year_id, old.grade, old.weekly_session_count)
    and exists (select 1 from public.class_component_links x where x.parent_class_id = old.id or x.component_class_id = old.id) then
    raise exception 'CLASS_COMPONENT_LINKED_CLASS_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger classes_protect_component_link_identity
before update of academic_year_id, grade, weekly_session_count on public.classes
for each row execute function public.protect_linked_class_identity();

create or replace function public.validate_component_parent_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.class_component_links x where x.parent_class_id = new.class_id
    and x.effective_from <= coalesce(new.effective_to, 'infinity'::date)
    and coalesce(x.effective_to, 'infinity'::date) >= new.effective_from) then
    raise exception 'COMPOSITE_PARENT_CANNOT_HAVE_SCHEDULE_TEMPLATE';
  end if;
  return new;
end;
$$;

create trigger class_schedule_templates_reject_composite_parent
before insert or update of class_id, effective_from, effective_to on public.class_schedule_templates
for each row execute function public.validate_component_parent_schedule();

create or replace function public.audit_class_component_link_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_user_id,module,action,entity_type,entity_id,old_data,new_data,reason,metadata)
  values (auth.uid(),'classes',case when tg_op='INSERT' then 'class_component_link_created' when old.effective_to is distinct from new.effective_to then 'class_component_link_ended' else 'class_component_link_updated' end,
    'class_component_link',new.id::text,case when tg_op='INSERT' then null else pg_catalog.to_jsonb(old) end,pg_catalog.to_jsonb(new),
    nullif(pg_catalog.current_setting('app.workflow_reason',true),''),pg_catalog.jsonb_build_object('source','database_trigger'));
  return new;
end;
$$;

create trigger class_component_links_audit_changes after insert or update on public.class_component_links
for each row execute function public.audit_class_component_link_change();

create or replace function public.resolve_class_session_rosters(p_class_session_ids uuid[])
returns table (class_session_id uuid, student_id uuid, student_enrollment_id uuid, enrollment_class_id uuid, session_class_id uuid, registered_mode text)
language sql stable security definer set search_path = '' as $$
  select distinct on (s.id, e.id)
    s.id, e.student_id, e.id, e.class_id, s.class_id, e.registered_mode
  from public.class_sessions s
  join public.student_enrollments e on e.status = 'active'
    and e.effective_from <= s.session_date and (e.effective_to is null or e.effective_to >= s.session_date)
  left join public.class_component_links x on x.parent_class_id = e.class_id and x.component_class_id = s.class_id
    and x.effective_from <= s.session_date and (x.effective_to is null or x.effective_to >= s.session_date)
  where s.id = any(p_class_session_ids) and (e.class_id = s.class_id or x.id is not null)
  order by s.id, e.id, x.component_order nulls first;
$$;

create or replace function public.resolve_class_session_roster(p_class_session_id uuid)
returns table (student_id uuid, student_enrollment_id uuid, enrollment_class_id uuid, session_class_id uuid, registered_mode text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('sessions.view') then raise exception using errcode = '42501', message = 'SESSION_ROSTER_VIEW_PERMISSION_DENIED'; end if;
  if not exists (select 1 from public.class_sessions where id = p_class_session_id) then raise exception using errcode = 'P0002', message = 'CLASS_SESSION_NOT_FOUND'; end if;
  return query select r.student_id,r.student_enrollment_id,r.enrollment_class_id,r.session_class_id,r.registered_mode
    from public.resolve_class_session_rosters(array[p_class_session_id]) r;
end;
$$;

create or replace function public.create_class_component_link(p_parent_class_id uuid,p_component_class_id uuid,p_component_order smallint,p_effective_from date,p_effective_to date,p_reason text)
returns public.class_component_links language plpgsql security definer set search_path = '' as $$
declare result_row public.class_component_links%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('classes.manage_schedule') then raise exception 'CLASS_COMPONENT_LINK_PERMISSION_DENIED'; end if;
  if p_parent_class_id is null or p_component_class_id is null or p_effective_from is null then raise exception 'CLASS_COMPONENT_LINK_REQUIRED_FIELDS_MISSING'; end if;
  perform 1 from public.classes where id in (p_parent_class_id,p_component_class_id) order by id for update;
  if (select count(*) from public.classes where id in (p_parent_class_id,p_component_class_id)) <> 2 then raise exception 'CLASS_COMPONENT_LINK_CLASS_NOT_FOUND'; end if;
  perform pg_catalog.set_config('app.workflow_reason',nullif(pg_catalog.btrim(coalesce(p_reason,'')),''),true);
  insert into public.class_component_links(parent_class_id,component_class_id,component_order,effective_from,effective_to,created_by)
  values(p_parent_class_id,p_component_class_id,p_component_order,p_effective_from,p_effective_to,auth.uid()) returning * into result_row;
  return result_row;
end;
$$;

create or replace function public.end_class_component_link(p_link_id uuid,p_effective_to date,p_reason text)
returns public.class_component_links language plpgsql security definer set search_path = '' as $$
declare result_row public.class_component_links%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('classes.manage_schedule') then raise exception 'CLASS_COMPONENT_LINK_PERMISSION_DENIED'; end if;
  select * into result_row from public.class_component_links where id=p_link_id for update;
  if not found then raise exception 'CLASS_COMPONENT_LINK_NOT_FOUND'; end if;
  if p_effective_to is null or p_effective_to < result_row.effective_from then raise exception 'CLASS_COMPONENT_LINK_EFFECTIVE_TO_INVALID'; end if;
  perform pg_catalog.set_config('app.workflow_reason',nullif(pg_catalog.btrim(coalesce(p_reason,'')),''),true);
  update public.class_component_links set effective_to=p_effective_to where id=p_link_id returning * into result_row;
  return result_row;
end;
$$;

alter table public.class_component_links enable row level security;
create policy class_component_links_select_authorized on public.class_component_links for select to authenticated using (public.has_permission('classes.view'));
revoke all on table public.class_component_links from public, anon, authenticated;
grant select on table public.class_component_links to authenticated;
revoke all on function public.resolve_class_session_rosters(uuid[]), public.resolve_class_session_roster(uuid), public.create_class_component_link(uuid,uuid,smallint,date,date,text), public.end_class_component_link(uuid,date,text) from public, anon, authenticated;
grant execute on function public.resolve_class_session_roster(uuid), public.create_class_component_link(uuid,uuid,smallint,date,date,text), public.end_class_component_link(uuid,date,text) to authenticated;

create or replace function public.mark_session_attendance(p_class_session_id uuid,p_student_id uuid,p_attendance_status text,p_actual_learning_mode text,p_notes text default null)
returns public.session_attendance language plpgsql security definer set search_path='' as $$
declare s public.class_sessions%rowtype; target_student public.students%rowtype; enrollment_id uuid; result_row public.session_attendance%rowtype; v_status text:=lower(btrim(coalesce(p_attendance_status,''))); v_mode text:=lower(btrim(coalesce(p_actual_learning_mode,'')));
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('attendance.mark') then raise exception 'ATTENDANCE_MARK_PERMISSION_DENIED'; end if;
  if p_class_session_id is null then raise exception 'CLASS_SESSION_ID_REQUIRED'; end if;
  if p_student_id is null then raise exception 'STUDENT_ID_REQUIRED'; end if;
  if v_status not in ('present','excused_absence','unexcused_absence','additional_study') then raise exception 'ATTENDANCE_STATUS_INVALID'; end if;
  if v_mode not in ('online','offline') then raise exception 'ATTENDANCE_LEARNING_MODE_INVALID'; end if;
  select * into s from public.class_sessions where id=p_class_session_id for share;
  if not found then raise exception 'CLASS_SESSION_NOT_FOUND'; end if;
  if s.locked_at is not null then raise exception 'CLASS_SESSION_IS_LOCKED'; end if;
  if s.status='cancelled' then raise exception 'CANCELLED_SESSION_CANNOT_HAVE_ATTENDANCE'; end if;
  if s.status not in ('in_progress','completed') then raise exception 'ATTENDANCE_REQUIRES_STARTED_SESSION'; end if;
  select * into target_student from public.students where id=p_student_id for share;
  if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
  if target_student.lifecycle_status in ('interested','trial_booked','trial_completed','pending_enrollment_confirmation','waiting_class') then raise exception 'TRIAL_OR_UNCONFIRMED_STUDENT_CANNOT_BE_MARKED'; end if;
  if exists(select 1 from public.session_attendance where class_session_id=p_class_session_id and student_id=p_student_id) then raise exception 'SESSION_ATTENDANCE_ALREADY_EXISTS'; end if;
  select r.student_enrollment_id into enrollment_id from public.resolve_class_session_rosters(array[p_class_session_id]) r where r.student_id=p_student_id limit 1;
  if v_status <> 'additional_study' and enrollment_id is null then raise exception 'MAIN_ATTENDANCE_REQUIRES_EFFECTIVE_ENROLLMENT'; end if;
  insert into public.session_attendance(class_session_id,student_id,student_enrollment_id,attendance_status,actual_learning_mode,marked_at,marked_by,notes)
  values(p_class_session_id,p_student_id,enrollment_id,v_status,v_mode,now(),auth.uid(),nullif(btrim(coalesce(p_notes,'')),'')) returning * into result_row;
  return result_row;
end;
$$;

create or replace function public.validate_session_attendance_foundation()
returns trigger language plpgsql security definer set search_path='' as $$
declare s public.class_sessions%rowtype; student_row public.students%rowtype; e public.student_enrollments%rowtype; d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  select * into s from public.class_sessions where id=new.class_session_id for share;
  if not found then raise exception 'CLASS_SESSION_NOT_FOUND'; end if;
  if s.locked_at is not null then raise exception 'CLASS_SESSION_IS_LOCKED'; end if;
  if s.status='cancelled' then raise exception 'CANCELLED_SESSION_CANNOT_HAVE_ATTENDANCE'; end if;
  if s.status not in ('in_progress','completed') then raise exception 'ATTENDANCE_REQUIRES_STARTED_SESSION'; end if;
  select * into student_row from public.students where id=new.student_id for share;
  if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
  if student_row.lifecycle_status in ('interested','trial_booked','trial_completed','pending_enrollment_confirmation','waiting_class') then raise exception 'TRIAL_OR_UNCONFIRMED_STUDENT_CANNOT_BE_MARKED'; end if;
  if new.student_enrollment_id is not null then select * into e from public.student_enrollments where id=new.student_enrollment_id for share; if not found then raise exception 'STUDENT_ENROLLMENT_NOT_FOUND'; end if; if e.student_id<>new.student_id then raise exception 'ATTENDANCE_ENROLLMENT_STUDENT_MISMATCH'; end if; end if;
  if new.attendance_status <> 'additional_study' then
    if new.student_enrollment_id is null or not exists(select 1 from public.resolve_class_session_rosters(array[new.class_session_id]) r where r.student_id=new.student_id and r.student_enrollment_id=new.student_enrollment_id) then raise exception 'ATTENDANCE_ENROLLMENT_CLASS_MISMATCH'; end if;
  elsif new.student_enrollment_id is not null and (s.session_date<e.effective_from or (e.effective_to is not null and s.session_date>e.effective_to)) then raise exception 'ATTENDANCE_ENROLLMENT_NOT_EFFECTIVE'; end if;
  if s.status='completed' or s.session_date<d or (tg_op='UPDATE' and old.is_late_update) then new.is_late_update:=true; end if;
  return new;
end;
$$;

create or replace function public.lock_class_session(p_class_session_id uuid,p_reason text)
returns public.class_sessions language plpgsql security definer set search_path='' as $$
declare s public.class_sessions%rowtype; result_row public.class_sessions%rowtype; required_count integer; recorded_count integer; reason text:=nullif(btrim(coalesce(p_reason,'')), ''); action_at timestamptz:=pg_catalog.now();
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('sessions.lock') then raise exception 'SESSION_LOCK_PERMISSION_DENIED'; end if;
  if p_class_session_id is null then raise exception 'CLASS_SESSION_ID_REQUIRED'; end if;
  if reason is null then raise exception 'SESSION_LOCK_REASON_REQUIRED'; end if;
  select * into s from public.class_sessions where id=p_class_session_id for update;
  if not found then raise exception 'CLASS_SESSION_NOT_FOUND'; end if;
  if s.locked_at is not null then raise exception 'CLASS_SESSION_ALREADY_LOCKED'; end if;
  if s.status<>'completed' then raise exception 'CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK'; end if;
  select count(*) into required_count from public.resolve_class_session_rosters(array[p_class_session_id]);
  if required_count=0 then raise exception 'SESSION_HAS_NO_ELIGIBLE_ROSTER'; end if;
  select count(*) into recorded_count from public.resolve_class_session_rosters(array[p_class_session_id]) r join public.session_attendance a on a.class_session_id=p_class_session_id and a.student_id=r.student_id and a.student_enrollment_id=r.student_enrollment_id where a.attendance_status in ('present','excused_absence','unexcused_absence');
  if recorded_count<>required_count then raise exception 'SESSION_ATTENDANCE_INCOMPLETE_FOR_LOCK'; end if;
  perform pg_catalog.set_config('app.workflow_reason',reason,true);
  update public.class_sessions set locked_at=action_at,locked_by=auth.uid(),lock_reason=reason where id=p_class_session_id returning * into result_row;
  insert into public.grading_credits(session_result_id,class_session_id,student_id,grader_id,credit_units,credited_at,credited_by)
  select result.id,result.class_session_id,result.student_id,result.graded_by,1,action_at,auth.uid()
  from public.session_results result
  where result.class_session_id=p_class_session_id and result.graded_at is not null and result.graded_by is not null;
  if s.session_kind in ('regular','makeup') then
    insert into public.student_session_ledger_entries(student_id,student_enrollment_id,class_session_id,session_attendance_id,entry_type,delta_sessions,effective_on,event_key,unit_price_vnd,note,created_by)
    select a.student_id,a.student_enrollment_id,a.class_session_id,a.id,'session_charge',-1,s.session_date,'session-charge:'||a.id::text,null,'Tru 1 buoi cho buoi hoc ('||s.session_kind||')',auth.uid() from public.session_attendance a where a.class_session_id=p_class_session_id and a.attendance_status in ('present','excused_absence','unexcused_absence');
  end if;
  return result_row;
end;
$$;

create or replace function public.validate_class_session_foundation()
returns trigger language plpgsql set search_path='' as $$
declare c public.classes%rowtype; y public.academic_years%rowtype; t public.class_schedule_templates%rowtype; src public.class_sessions%rowtype; active_context boolean:=false; attendance_count integer; missing_count integer; missing_results integer;
begin
  select * into c from public.classes where id=new.class_id for share; if not found then raise exception 'CLASS_NOT_FOUND'; end if;
  select * into y from public.academic_years where id=c.academic_year_id for share; if not found then raise exception 'ACADEMIC_YEAR_NOT_FOUND'; end if;
  if exists(select 1 from public.class_component_links x where x.parent_class_id=new.class_id and x.effective_from<=new.session_date and (x.effective_to is null or x.effective_to>=new.session_date)) then raise exception 'COMPOSITE_PARENT_CANNOT_HAVE_CLASS_SESSION'; end if;
  if tg_op='INSERT' then if new.status<>'scheduled' then raise exception 'CLASS_SESSION_MUST_START_SCHEDULED'; end if; active_context:=true; elsif old.status='scheduled' and new.status='in_progress' then active_context:=true; end if;
  if active_context and c.status<>'active' then raise exception 'CLASS_SESSION_REQUIRES_ACTIVE_CLASS'; end if;
  if active_context and y.status<>'active' then raise exception 'CLASS_SESSION_REQUIRES_ACTIVE_ACADEMIC_YEAR'; end if;
  if new.session_kind='regular' then
    select * into t from public.class_schedule_templates where id=new.schedule_template_id for share;
    if not found then raise exception 'CLASS_SCHEDULE_TEMPLATE_NOT_FOUND'; end if;
    if t.class_id<>new.class_id then raise exception 'CLASS_SESSION_SCHEDULE_CLASS_MISMATCH'; end if;
    if new.session_date<t.effective_from or (t.effective_to is not null and new.session_date>t.effective_to) then raise exception 'CLASS_SESSION_SCHEDULE_NOT_EFFECTIVE'; end if;
    if date_part('isodow',new.session_date)::smallint<>t.weekday then raise exception 'CLASS_SESSION_WEEKDAY_MISMATCH'; end if;
  elsif new.session_kind='makeup' then
    select * into src from public.class_sessions where id=new.makeup_for_session_id for share;
    if not found then raise exception 'MAKEUP_SOURCE_SESSION_NOT_FOUND'; end if;
    if src.class_id<>new.class_id then raise exception 'MAKEUP_SESSION_CLASS_MISMATCH'; end if;
    if src.session_kind='additional' then raise exception 'ADDITIONAL_SESSION_CANNOT_HAVE_MAKEUP'; end if;
    if src.status<>'cancelled' then raise exception 'MAKEUP_SOURCE_SESSION_MUST_BE_CANCELLED'; end if;
    if new.session_date<=src.session_date then raise exception 'MAKEUP_SESSION_DATE_INVALID'; end if;
  end if;
  if tg_op='INSERT' and new.locked_at is not null then raise exception 'CLASS_SESSION_CANNOT_START_LOCKED'; end if;
  if tg_op='UPDATE' then
    if old.status='scheduled' and new.status not in ('scheduled','in_progress','cancelled') then raise exception 'CLASS_SESSION_STATUS_TRANSITION_INVALID'; end if;
    if old.status='in_progress' and new.status not in ('in_progress','completed','cancelled') and not (new.status='scheduled' and pg_catalog.current_setting('app.allow_session_reset',true)='true') then raise exception 'CLASS_SESSION_STATUS_TRANSITION_INVALID'; end if;
    if old.status in ('completed','cancelled') and new.status<>old.status then raise exception 'CLASS_SESSION_TERMINAL_STATUS_IMMUTABLE'; end if;
    if old.status='in_progress' and new.status='cancelled' and (new.started_at is distinct from old.started_at or new.started_by is distinct from old.started_by) then raise exception 'CANCELLED_SESSION_MUST_PRESERVE_START'; end if;
    if old.started_at is not null and new.started_at<old.started_at and pg_catalog.current_setting('app.allow_session_reset',true)<>'true' then raise exception 'CLASS_SESSION_STARTED_AT_CANNOT_MOVE_BACK'; end if;
    if new.completed_at is not null and new.started_at is not null and new.completed_at<new.started_at then raise exception 'CLASS_SESSION_COMPLETION_TIME_INVALID'; end if;
    if old.locked_at is not null and new.locked_at is null then raise exception 'CLASS_SESSION_CANNOT_BE_UNLOCKED'; end if;
    if old.locked_at is not null and (pg_catalog.to_jsonb(new)-'updated_at') is distinct from (pg_catalog.to_jsonb(old)-'updated_at') then raise exception 'LOCKED_CLASS_SESSION_IS_IMMUTABLE'; end if;
  end if;
  if new.locked_at is not null and old.locked_at is null then
    if new.status<>'completed' then raise exception 'ONLY_COMPLETED_SESSION_CAN_BE_LOCKED'; end if;
    if tg_op<>'UPDATE' or old.status<>'completed' then raise exception 'CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK'; end if;
    select count(*) into attendance_count from public.session_attendance where class_session_id=new.id; if attendance_count=0 then raise exception 'CLASS_SESSION_LOCK_REQUIRES_ATTENDANCE'; end if;
    if new.session_kind in ('regular','makeup') then
      select count(*) into missing_count from public.resolve_class_session_rosters(array[new.id]) r where not exists(select 1 from public.session_attendance a where a.class_session_id=new.id and a.student_id=r.student_id and a.student_enrollment_id=r.student_enrollment_id and a.attendance_status in ('present','excused_absence','unexcused_absence'));
      if missing_count>0 then raise exception 'CLASS_SESSION_LOCK_REQUIRES_FULL_ATTENDANCE'; end if;
    end if;
    select count(*) into missing_results from public.session_attendance a left join public.session_results r on r.class_session_id=a.class_session_id and r.student_id=a.student_id where a.class_session_id=new.id and a.attendance_status in ('present','additional_study') and (r.id is null or r.test_score is null);
    if missing_results>0 then raise exception 'CLASS_SESSION_LOCK_REQUIRES_RESULTS'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.preview_tuition_collection_period(p_period_id uuid)
returns table(student_id uuid,enrollment_id uuid,class_id uuid,class_session_id uuid,session_date date,session_kind text,unit_price_vnd bigint,acquisition_source_id uuid,opening_balance_sessions bigint,blocker_code text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='28000',message='AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('tuition_periods.view') then raise exception using errcode='42501',message='TUITION_PERIOD_VIEW_PERMISSION_DENIED'; end if;
  return query with p as (select * from public.tuition_collection_periods where id=p_period_id), ss as (select s.id from public.class_sessions s join p on s.session_date between p.starts_on and p.ends_on left join public.class_sessions src on src.id=s.makeup_for_session_id where (s.session_kind='regular' and s.status<>'cancelled') or (s.session_kind='makeup' and s.status<>'cancelled' and src.status='cancelled')), c as (
    select r.student_id,r.student_enrollment_id,r.enrollment_class_id,s.id,s.session_date,s.session_kind,rv.unit_price_vnd,coalesce(a.lead_source_id,cc.lead_source_id) as acquisition_source_id,coalesce(b.balance_sessions,0) from ss ids join public.class_sessions s on s.id=ids.id join public.resolve_class_session_rosters(array(select id from ss)) r on r.class_session_id=s.id left join lateral(select x.unit_price_vnd from public.student_tuition_rate_versions x where x.student_id=r.student_id and x.effective_from<=s.session_date order by x.effective_from desc limit 1) rv on true left join lateral(select x.lead_source_id from public.student_acquisition_source_assignments x where x.student_id=r.student_id and x.is_current order by x.assigned_at desc limit 1) a on true left join lateral(select x.lead_source_id from public.crm_cases x where x.student_id=r.student_id order by x.updated_at desc,x.created_at desc limit 1) cc on true left join public.student_session_balances b on b.student_id=r.student_id)
  select *,case when unit_price_vnd is null then 'MISSING_EFFECTIVE_TUITION_RATE' when acquisition_source_id is null then 'MISSING_ACQUISITION_SOURCE' else null end from c;
end;
$$;

create or replace function public.dry_run_class_session_generation(p_academic_year_id uuid,p_start_date date,p_end_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d date:=p_start_date; rec record; existing_session public.class_sessions%rowtype; items jsonb:='[]'::jsonb; n integer:=0; created integer:=0; matching integer:=0; conflicts integer:=0; classes_count integer:=0; classification text; today date:=pg_catalog.now()::date;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATED_USER_REQUIRED'; end if;
  if not public.has_permission('sessions.manage') then raise exception 'SESSIONS_MANAGE_PERMISSION_REQUIRED'; end if;
  if p_academic_year_id is null then raise exception 'ACADEMIC_YEAR_ID_REQUIRED'; end if;
  if p_start_date is null or p_end_date is null then raise exception 'START_AND_END_DATE_REQUIRED'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'END_DATE_MUST_BE_ON_OR_AFTER_START_DATE'; end if;
  if p_end_date-p_start_date>62 then raise exception 'GENERATION_HORIZON_EXCEEDS_MAXIMUM_62_DAYS'; end if;
  select count(*) into classes_count from public.classes c where c.academic_year_id=p_academic_year_id and c.status='active' and c.code<>'6AC1' and c.weekly_session_count=1;
  while d<=p_end_date loop
    for rec in select t.id template_id,t.class_id,c.code class_code,c.name class_name,t.component_code,t.weekday,t.start_time,t.end_time,t.learning_mode,t.room_name,t.meeting_url from public.class_schedule_templates t join public.classes c on c.id=t.class_id where c.academic_year_id=p_academic_year_id and c.status='active' and c.code<>'6AC1' and t.is_active and t.weekday=extract(isodow from d)::smallint and t.effective_from<=d and (t.effective_to is null or t.effective_to>=d) and c.weekly_session_count=1 order by c.code,t.start_time loop
      n:=n+1; select * into existing_session from public.class_sessions s where s.schedule_template_id=rec.template_id and s.session_date=d;
      if not found then classification:='new'; created:=created+1;
      elsif existing_session.start_time=rec.start_time and existing_session.end_time=rec.end_time and existing_session.learning_mode=rec.learning_mode then classification:='existing_matching'; matching:=matching+1;
      else classification:='existing_conflict'; conflicts:=conflicts+1; end if;
      items:=items||jsonb_build_array(jsonb_build_object('template_id',rec.template_id,'class_id',rec.class_id,'class_code',rec.class_code,'class_name',rec.class_name,'component_code',rec.component_code,'session_date',d,'weekday',rec.weekday,'start_time',rec.start_time,'end_time',rec.end_time,'learning_mode',rec.learning_mode,'room_name',rec.room_name,'meeting_url',rec.meeting_url,'classification',classification,'is_past',d<today));
    end loop; d:=d+1;
  end loop;
  return jsonb_build_object('academic_year_id',p_academic_year_id,'start_date',p_start_date,'end_date',p_end_date,'official_classes_count',classes_count,'total_occurrences',n,'new_count',created,'existing_matching_count',matching,'existing_conflict_count',conflicts,'invalid_count',0,'occurrences',items);
end;
$$;

create or replace function public.materialize_class_sessions(p_academic_year_id uuid,p_start_date date,p_end_date date,p_allow_backfill boolean default false,p_reason text default 'Bulk class session generation')
returns jsonb language plpgsql security definer set search_path='' as $$
declare d date:=p_start_date; rec record; made integer:=0; skipped integer:=0; today date:=now()::date;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATED_USER_REQUIRED'; end if;
  if not public.has_permission('sessions.manage') then raise exception 'SESSIONS_MANAGE_PERMISSION_REQUIRED'; end if;
  if p_academic_year_id is null then raise exception 'ACADEMIC_YEAR_ID_REQUIRED'; end if;
  if p_start_date is null or p_end_date is null then raise exception 'START_AND_END_DATE_REQUIRED'; end if;
  if p_end_date<p_start_date then raise exception 'END_DATE_MUST_BE_ON_OR_AFTER_START_DATE'; end if;
  if p_end_date-p_start_date>62 then raise exception 'GENERATION_HORIZON_EXCEEDS_MAXIMUM_62_DAYS'; end if;
  if p_start_date<today and not p_allow_backfill then raise exception 'BACKFILL_MATERIALIZATION_NOT_ALLOWED_WITHOUT_EXPLICIT_FLAG'; end if;
  while d<=p_end_date loop
    for rec in select t.id,t.class_id,t.component_code,t.start_time,t.end_time,t.learning_mode,t.room_name,t.meeting_url from public.class_schedule_templates t join public.classes c on c.id=t.class_id where c.academic_year_id=p_academic_year_id and c.status='active' and c.code<>'6AC1' and t.is_active and t.weekday=extract(isodow from d)::smallint and t.effective_from<=d and (t.effective_to is null or t.effective_to>=d) and c.weekly_session_count=1 order by c.code,t.start_time loop
      insert into public.class_sessions(class_id,schedule_template_id,session_date,session_kind,component_code,start_time,end_time,learning_mode,room_name,meeting_url,status,created_by) values(rec.class_id,rec.id,d,'regular',rec.component_code,rec.start_time,rec.end_time,rec.learning_mode,rec.room_name,rec.meeting_url,'scheduled',auth.uid()) on conflict(schedule_template_id,session_date) where schedule_template_id is not null do nothing;
      if found then made:=made+1; else skipped:=skipped+1; end if;
    end loop; d:=d+1;
  end loop;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data,reason,metadata) values(auth.uid(),'sessions','class_session_batch_materialized','academic_year',p_academic_year_id::text,jsonb_build_object('created_count',made,'skipped_count',skipped),coalesce(p_reason,'Bulk class session generation'),jsonb_build_object('source','authenticated_user'));
  return jsonb_build_object('academic_year_id',p_academic_year_id,'start_date',p_start_date,'end_date',p_end_date,'created_count',made,'skipped_count',skipped,'total_count',made+skipped);
end;
$$;

revoke all on function public.preview_tuition_collection_period(uuid) from public, anon;
grant execute on function public.preview_tuition_collection_period(uuid) to authenticated;

commit;
