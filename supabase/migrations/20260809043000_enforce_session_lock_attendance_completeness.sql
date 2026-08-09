-- Migration: 20260809043000_enforce_session_lock_attendance_completeness.sql
-- Description: Enforce attendance completeness and non-zero roster validation in lock_class_session

create or replace function public.lock_class_session(p_class_session_id uuid, p_reason text)
 returns class_sessions
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  target_session public.class_sessions%rowtype;
  locked_session public.class_sessions%rowtype;
  action_at timestamptz := pg_catalog.now();
  v_eligible_roster_count integer := 0;
  v_roster_attendance_count integer := 0;
  v_missing_count integer := 0;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('sessions.lock') then
    raise exception using errcode = '42501', message = 'SESSION_LOCK_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using errcode = '22023', message = 'CLASS_SESSION_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using errcode = '22023', message = 'SESSION_LOCK_REASON_REQUIRED';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions as session_row
  where session_row.id = p_class_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CLASS_SESSION_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using errcode = '23514', message = 'CLASS_SESSION_ALREADY_LOCKED';
  end if;

  if target_session.status <> 'completed' then
    raise exception using errcode = '23514', message = 'CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK';
  end if;

  -- 1. Calculate eligible roster count for the session
  select count(distinct enrollment_row.student_id)
  into v_eligible_roster_count
  from public.student_enrollments as enrollment_row
  where enrollment_row.class_id = target_session.class_id
    and enrollment_row.status = 'active'
    and target_session.session_date >= enrollment_row.effective_from
    and (
      enrollment_row.effective_to is null
      or target_session.session_date <= enrollment_row.effective_to
    );

  if v_eligible_roster_count = 0 then
    raise exception using
      errcode = '23514',
      message = 'SESSION_HAS_NO_ELIGIBLE_ROSTER';
  end if;

  -- 2. Calculate distinct roster students with recorded attendance decision
  select count(distinct attendance_row.student_id)
  into v_roster_attendance_count
  from public.session_attendance as attendance_row
  join public.student_enrollments as enrollment_row
    on enrollment_row.student_id = attendance_row.student_id
   and enrollment_row.class_id = target_session.class_id
   and enrollment_row.status = 'active'
   and target_session.session_date >= enrollment_row.effective_from
   and (
     enrollment_row.effective_to is null
     or target_session.session_date <= enrollment_row.effective_to
   )
  where attendance_row.class_session_id = p_class_session_id
    and attendance_row.attendance_status in (
      'present',
      'excused_absence',
      'unexcused_absence',
      'additional_study'
    );

  v_missing_count := v_eligible_roster_count - v_roster_attendance_count;

  if v_missing_count > 0 then
    raise exception using
      errcode = '23514',
      message = 'SESSION_ATTENDANCE_INCOMPLETE_FOR_LOCK';
  end if;

  perform pg_catalog.set_config('app.workflow_reason', normalized_reason, true);

  update public.class_sessions
  set
    locked_at = action_at,
    locked_by = actor_id,
    lock_reason = normalized_reason
  where id = p_class_session_id
  returning * into locked_session;

  -- The lock and credits are one transaction. Foundation validation ensures
  -- every present/additional-study attendee has a scored, assigned result.
  insert into public.grading_credits (
    session_result_id,
    class_session_id,
    student_id,
    grader_id,
    credit_units,
    credited_at,
    credited_by
  )
  select
    result.id,
    result.class_session_id,
    result.student_id,
    result.graded_by,
    1,
    action_at,
    actor_id
  from public.session_results as result
  where result.class_session_id = p_class_session_id
    and result.graded_at is not null
    and result.graded_by is not null;

  if target_session.session_kind in ('regular', 'makeup') then
    insert into public.student_session_ledger_entries (
      student_id,
      student_enrollment_id,
      class_session_id,
      session_attendance_id,
      entry_type,
      delta_sessions,
      effective_on,
      event_key,
      unit_price_vnd,
      note,
      created_by
    )
    select
      attendance.student_id,
      attendance.student_enrollment_id,
      attendance.class_session_id,
      attendance.id,
      'session_charge',
      -1,
      target_session.session_date,
      'session-charge:' || attendance.id::text,
      null,
      'Tru 1 buoi cho buoi hoc (' || target_session.session_kind || ')',
      actor_id
    from public.session_attendance as attendance
    where attendance.class_session_id = p_class_session_id
      and attendance.attendance_status in ('present', 'excused_absence', 'unexcused_absence');
  end if;

  return locked_session;
end;
$function$;
