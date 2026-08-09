-- Migration: 20260809044500_session_reset_before_start_foundation.sql
-- Description: Add reset_unlocked_class_session_before_start RPC and update foundation triggers to allow safe reset of premature future session starts

create or replace function public.prevent_session_foundation_delete()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if pg_catalog.current_setting('app.allow_session_foundation_delete', true) = 'true' then
    return old;
  end if;

  raise exception using
    errcode = '23514',
    message = 'SESSION_FOUNDATION_DELETE_NOT_ALLOWED';
end;
$function$;

create or replace function public.validate_class_session_foundation()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;
  target_schedule public.class_schedule_templates%rowtype;
  source_session public.class_sessions%rowtype;
  requires_active_context boolean := false;
  attendance_count integer;
  missing_attendance_count integer;
  missing_result_count integer;
begin
  select class.*
  into target_class
  from public.classes as class
  where class.id = new.class_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_NOT_FOUND';
  end if;

  select year.*
  into target_year
  from public.academic_years as year
  where year.id = target_class.academic_year_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'scheduled' then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_MUST_START_SCHEDULED';
    end if;

    requires_active_context := true;

  elsif old.status = 'scheduled'
    and new.status = 'in_progress'
  then
    requires_active_context := true;
  end if;

  if requires_active_context
    and target_class.status <> 'active'
  then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_REQUIRES_ACTIVE_CLASS';
  end if;

  if requires_active_context
    and target_year.status <> 'active'
  then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_REQUIRES_ACTIVE_ACADEMIC_YEAR';
  end if;

  if new.session_kind = 'regular' then
    select schedule.*
    into target_schedule
    from public.class_schedule_templates as schedule
    where schedule.id = new.schedule_template_id
    for share;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'CLASS_SCHEDULE_TEMPLATE_NOT_FOUND';
    end if;

    if target_schedule.class_id <> new.class_id then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_SCHEDULE_CLASS_MISMATCH';
    end if;

    if new.session_date < target_schedule.effective_from
      or (
        target_schedule.effective_to is not null
        and new.session_date > target_schedule.effective_to
      )
    then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_SCHEDULE_NOT_EFFECTIVE';
    end if;

    if pg_catalog.date_part('isodow', new.session_date)::smallint <> target_schedule.weekday then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_WEEKDAY_MISMATCH';
    end if;

  elsif new.session_kind = 'makeup' then
    select session_row.*
    into source_session
    from public.class_sessions as session_row
    where session_row.id = new.makeup_for_session_id
    for share;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'MAKEUP_SOURCE_SESSION_NOT_FOUND';
    end if;

    if source_session.class_id <> new.class_id then
      raise exception using
        errcode = '23514',
        message = 'MAKEUP_SESSION_CLASS_MISMATCH';
    end if;

    if source_session.session_kind = 'additional' then
      raise exception using
        errcode = '23514',
        message = 'ADDITIONAL_SESSION_CANNOT_HAVE_MAKEUP';
    end if;

    if source_session.status <> 'cancelled' then
      raise exception using
        errcode = '23514',
        message = 'MAKEUP_SOURCE_SESSION_MUST_BE_CANCELLED';
    end if;

    if new.session_date <= source_session.session_date then
      raise exception using
        errcode = '23514',
        message = 'MAKEUP_SESSION_DATE_INVALID';
    end if;
  end if;

  if tg_op = 'INSERT'
    and new.locked_at is not null
  then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_CANNOT_START_LOCKED';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'scheduled'
      and new.status not in (
        'scheduled',
        'in_progress',
        'cancelled'
      )
    then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_STATUS_TRANSITION_INVALID';
    end if;

    if old.status = 'in_progress'
      and new.status not in (
        'in_progress',
        'completed',
        'cancelled'
      )
      and not (
        new.status = 'scheduled'
        and pg_catalog.current_setting('app.allow_session_reset', true) = 'true'
      )
    then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_STATUS_TRANSITION_INVALID';
    end if;

    if old.status in (
      'completed',
      'cancelled'
    )
      and new.status <> old.status
    then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_TERMINAL_STATUS_IMMUTABLE';
    end if;

    if old.status = 'in_progress'
      and new.status = 'cancelled'
      and (
        new.started_at is distinct from old.started_at
        or new.started_by is distinct from old.started_by
      )
    then
      raise exception using
        errcode = '23514',
        message = 'CANCELLED_SESSION_MUST_PRESERVE_START';
    end if;

    if old.started_at is not null
      and new.started_at < old.started_at
      and pg_catalog.current_setting('app.allow_session_reset', true) <> 'true'
    then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_STARTED_AT_CANNOT_MOVE_BACK';
    end if;

    if new.completed_at is not null
      and new.started_at is not null
      and new.completed_at < new.started_at
    then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_COMPLETION_TIME_INVALID';
    end if;

    if old.locked_at is not null
      and new.locked_at is null
    then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_CANNOT_BE_UNLOCKED';
    end if;

    if old.locked_at is not null
      and (
        pg_catalog.to_jsonb(new) - 'updated_at'
      ) is distinct from (
        pg_catalog.to_jsonb(old) - 'updated_at'
      )
    then
      raise exception using
        errcode = '23514',
        message = 'LOCKED_CLASS_SESSION_IS_IMMUTABLE';
    end if;
  end if;

  if new.locked_at is not null
    and (
      tg_op = 'INSERT'
      or old.locked_at is null
    )
  then
    if new.status <> 'completed' then
      raise exception using
        errcode = '23514',
        message = 'ONLY_COMPLETED_SESSION_CAN_BE_LOCKED';
    end if;

    if tg_op <> 'UPDATE'
      or old.status <> 'completed'
    then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK';
    end if;

    select count(*)
    into attendance_count
    from public.session_attendance as attendance
    where attendance.class_session_id = new.id;

    if attendance_count = 0 then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_LOCK_REQUIRES_ATTENDANCE';
    end if;

    if new.session_kind in (
      'regular',
      'makeup'
    )
    then
      select count(*)
      into missing_attendance_count
      from public.student_enrollments as enrollment
      where enrollment.class_id = new.class_id
        and new.session_date >= enrollment.effective_from
        and (
          enrollment.effective_to is null
          or new.session_date <= enrollment.effective_to
        )
        and not exists (
          select 1
          from public.session_attendance as attendance
          where attendance.class_session_id = new.id
            and attendance.student_id = enrollment.student_id
            and attendance.student_enrollment_id = enrollment.id
            and attendance.attendance_status in (
              'present',
              'excused_absence',
              'unexcused_absence'
            )
        );

      if missing_attendance_count > 0 then
        raise exception using
          errcode = '23514',
          message = 'CLASS_SESSION_LOCK_REQUIRES_FULL_ATTENDANCE';
      end if;
    end if;

    select count(*)
    into missing_result_count
    from public.session_attendance as attendance
    left join public.session_results as result
      on result.class_session_id = attendance.class_session_id
      and result.student_id = attendance.student_id
    where attendance.class_session_id = new.id
      and attendance.attendance_status in (
        'present',
        'additional_study'
      )
      and (
        result.id is null
        or result.test_score is null
      );

    if missing_result_count > 0 then
      raise exception using
        errcode = '23514',
        message = 'CLASS_SESSION_LOCK_REQUIRES_RESULTS';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.reset_unlocked_class_session_before_start(
  p_class_session_id uuid,
  p_reason text
)
 returns class_sessions
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  target_session public.class_sessions%rowtype;
  reset_session public.class_sessions%rowtype;
  deleted_attendance_count integer := 0;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('sessions.manage') then
    raise exception using errcode = '42501', message = 'SESSION_MANAGE_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using errcode = '22023', message = 'CLASS_SESSION_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using errcode = '22023', message = 'SESSION_RESET_REASON_REQUIRED';
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
    raise exception using errcode = '23514', message = 'CLASS_SESSION_IS_LOCKED';
  end if;

  if target_session.status <> 'in_progress' then
    raise exception using errcode = '23514', message = 'SESSION_RESET_STATUS_INVALID';
  end if;

  if exists (
    select 1
    from public.student_session_ledger_entries as ledger
    where ledger.class_session_id = p_class_session_id
  ) then
    raise exception using errcode = '23514', message = 'SESSION_HAS_FINANCIAL_LEDGER_ENTRIES';
  end if;

  if target_session.session_date < current_date then
    raise exception using errcode = '23514', message = 'SESSION_DATE_IS_IN_PAST';
  end if;

  -- Enable session reset and foundation delete session settings
  perform pg_catalog.set_config('app.allow_session_reset', 'true', true);
  perform pg_catalog.set_config('app.allow_session_foundation_delete', 'true', true);

  -- Remove unposted premature attendance rows
  delete from public.session_attendance
  where class_session_id = p_class_session_id;

  get diagnostics deleted_attendance_count = row_count;

  perform pg_catalog.set_config('app.workflow_reason', normalized_reason, true);

  -- Reset operational start state to scheduled
  update public.class_sessions
  set
    status = 'scheduled',
    started_at = null,
    started_by = null
  where id = p_class_session_id
  returning * into reset_session;

  -- Reset app configs
  perform pg_catalog.set_config('app.allow_session_reset', 'false', true);
  perform pg_catalog.set_config('app.allow_session_foundation_delete', 'false', true);

  -- Record audit log event for the corrective reset while preserving original incident audit logs
  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    metadata
  )
  values (
    actor_id,
    'sessions',
    'class_session_reset_to_scheduled',
    'class_session',
    p_class_session_id::text,
    pg_catalog.jsonb_build_object(
      'status', target_session.status,
      'started_at', target_session.started_at,
      'started_by', target_session.started_by
    ),
    pg_catalog.jsonb_build_object(
      'status', reset_session.status,
      'deleted_attendance_count', deleted_attendance_count
    ),
    normalized_reason,
    pg_catalog.jsonb_build_object(
      'class_id', target_session.class_id,
      'session_date', target_session.session_date,
      'source', 'corrective_repair'
    )
  );

  return reset_session;
end;
$function$;
