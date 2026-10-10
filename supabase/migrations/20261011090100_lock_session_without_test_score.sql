-- Khóa buổi học không còn bắt buộc có điểm kiểm tra.
--
-- Theo hợp đồng nghiệp vụ (docs/redesign/WORKFLOW_CONTRACTS_A_E.md), điểm
-- kiểm tra không phải điều kiện khóa buổi. Trigger cũ chặn khóa khi bất kỳ
-- học sinh có mặt nào chưa có điểm, khiến buổi không khóa được, không trừ
-- buổi và không ghi tín dụng chấm bài. Điều kiện điểm danh đầy đủ giữ nguyên.
-- Nội dung hàm giữ nguyên so với 20260817090000, chỉ bỏ kiểm tra kết quả.

begin;

create or replace function public.validate_class_session_foundation()
returns trigger language plpgsql set search_path='' as $$
declare c public.classes%rowtype; y public.academic_years%rowtype; t public.class_schedule_templates%rowtype; src public.class_sessions%rowtype; active_context boolean:=false; attendance_count integer; missing_count integer;
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
  end if;
  return new;
end;
$$;

commit;
