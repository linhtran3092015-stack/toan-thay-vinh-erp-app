-- Migration: 20260809050000_harden_class_session_start_and_reset_time_guards.sql
-- Description: Harden start_class_session and reset_unlocked_class_session_before_start with exact Asia/Ho_Chi_Minh scheduled datetime guards

create or replace function public.start_class_session(p_class_session_id uuid)
 returns class_sessions
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  actor_id uuid := auth.uid();
  target_session public.class_sessions%rowtype;
  action_at timestamptz := pg_catalog.now();
  v_scheduled_start_ts timestamptz;
  v_current_ts timestamptz := pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh';
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('sessions.manage') then
    raise exception using
      errcode = '42501',
      message = 'SESSION_MANAGE_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SESSION_ID_REQUIRED';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions as session_row
  where session_row.id = p_class_session_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_SESSION_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_ALREADY_LOCKED';
  end if;

  if target_session.status <> 'scheduled' then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_START_STATUS_INVALID';
  end if;

  -- Temporal safety check: prevent starting a session before its scheduled datetime in Asia/Ho_Chi_Minh timezone
  v_scheduled_start_ts := (target_session.session_date + target_session.start_time) at time zone 'Asia/Ho_Chi_Minh';

  if v_current_ts < v_scheduled_start_ts then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_NOT_STARTED_YET';
  end if;

  perform pg_catalog.set_config('app.workflow_reason', '', true);

  update public.class_sessions
  set
    status = 'in_progress',
    started_at = action_at,
    started_by = actor_id
  where id = p_class_session_id
  returning * into target_session;

  return target_session;
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
  v_scheduled_start_ts timestamptz;
  v_current_ts timestamptz := pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh';
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

  -- Datetime guard: reset is allowed only while current Asia/Ho_Chi_Minh time is before scheduled start time
  v_scheduled_start_ts := (target_session.session_date + target_session.start_time) at time zone 'Asia/Ho_Chi_Minh';

  if v_current_ts >= v_scheduled_start_ts then
    raise exception using errcode = '23514', message = 'SESSION_RESET_WINDOW_CLOSED';
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
