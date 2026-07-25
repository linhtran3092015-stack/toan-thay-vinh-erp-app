begin;

-- =========================================================
-- CREATE CLASS SESSION
--
-- regular:
--   Snapshot is copied from a schedule template.
--
-- makeup:
--   Component code is copied from the cancelled source
--   session. Time and learning mode are supplied explicitly.
--
-- additional:
--   No schedule template or source session is required.
-- =========================================================

create or replace function public.create_class_session(
  p_class_id uuid,
  p_session_date date,
  p_session_kind text,

  p_schedule_template_id uuid default null,
  p_makeup_for_session_id uuid default null,

  p_start_time time without time zone default null,
  p_end_time time without time zone default null,
  p_learning_mode text default null,

  p_component_code text default null,
  p_room_name text default null,
  p_meeting_url text default null,
  p_notes text default null
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_kind text :=
    pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(p_session_kind, '')
      )
    );

  normalized_learning_mode text :=
    nullif(
      pg_catalog.lower(
        pg_catalog.btrim(
          coalesce(p_learning_mode, '')
        )
      ),
      ''
    );

  normalized_component_code text :=
    nullif(
      pg_catalog.upper(
        pg_catalog.btrim(
          coalesce(p_component_code, '')
        )
      ),
      ''
    );

  normalized_room_name text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_room_name, '')
      ),
      ''
    );

  normalized_meeting_url text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_meeting_url, '')
      ),
      ''
    );

  normalized_notes text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_notes, '')
      ),
      ''
    );

  target_schedule
    public.class_schedule_templates%rowtype;

  source_session
    public.class_sessions%rowtype;

  created_session
    public.class_sessions%rowtype;

  session_start_time time without time zone;
  session_end_time time without time zone;
  session_learning_mode text;
  session_component_code text;
  session_room_name text;
  session_meeting_url text;
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'sessions.manage'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'SESSION_MANAGE_PERMISSION_DENIED';
  end if;

  if p_class_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_ID_REQUIRED';
  end if;

  if p_session_date is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SESSION_DATE_REQUIRED';
  end if;

  if normalized_kind not in (
    'regular',
    'makeup',
    'additional'
  ) then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SESSION_KIND_INVALID';
  end if;

  if normalized_kind = 'regular' then
    if p_schedule_template_id is null then
      raise exception using
        errcode = '22023',
        message =
          'REGULAR_SESSION_SCHEDULE_REQUIRED';
    end if;

    if p_makeup_for_session_id is not null then
      raise exception using
        errcode = '22023',
        message =
          'REGULAR_SESSION_MAKEUP_SOURCE_NOT_ALLOWED';
    end if;

    select schedule_row.*
    into target_schedule
    from public.class_schedule_templates
      as schedule_row
    where schedule_row.id =
      p_schedule_template_id
    for share;

    if not found then
      raise exception using
        errcode = 'P0002',
        message =
          'CLASS_SCHEDULE_TEMPLATE_NOT_FOUND';
    end if;

    if target_schedule.class_id <>
      p_class_id
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_SCHEDULE_CLASS_MISMATCH';
    end if;

    session_start_time :=
      target_schedule.start_time;

    session_end_time :=
      target_schedule.end_time;

    session_learning_mode :=
      target_schedule.learning_mode;

    session_component_code :=
      target_schedule.component_code;

    session_room_name :=
      target_schedule.room_name;

    session_meeting_url :=
      target_schedule.meeting_url;

  elsif normalized_kind = 'makeup' then
    if p_schedule_template_id is not null then
      raise exception using
        errcode = '22023',
        message =
          'MAKEUP_SESSION_SCHEDULE_NOT_ALLOWED';
    end if;

    if p_makeup_for_session_id is null then
      raise exception using
        errcode = '22023',
        message =
          'MAKEUP_SOURCE_SESSION_REQUIRED';
    end if;

    select session_row.*
    into source_session
    from public.class_sessions
      as session_row
    where session_row.id =
      p_makeup_for_session_id
    for share;

    if not found then
      raise exception using
        errcode = 'P0002',
        message =
          'MAKEUP_SOURCE_SESSION_NOT_FOUND';
    end if;

    if source_session.class_id <>
      p_class_id
    then
      raise exception using
        errcode = '23514',
        message =
          'MAKEUP_SESSION_CLASS_MISMATCH';
    end if;

    if p_start_time is null
      or p_end_time is null
    then
      raise exception using
        errcode = '22023',
        message =
          'MAKEUP_SESSION_TIME_REQUIRED';
    end if;

    if normalized_learning_mode is null then
      raise exception using
        errcode = '22023',
        message =
          'MAKEUP_SESSION_LEARNING_MODE_REQUIRED';
    end if;

    session_start_time := p_start_time;
    session_end_time := p_end_time;

    session_learning_mode :=
      normalized_learning_mode;

    session_component_code :=
      source_session.component_code;

    session_room_name :=
      normalized_room_name;

    session_meeting_url :=
      normalized_meeting_url;

  else
    if p_schedule_template_id is not null
      or p_makeup_for_session_id is not null
    then
      raise exception using
        errcode = '22023',
        message =
          'ADDITIONAL_SESSION_SOURCE_NOT_ALLOWED';
    end if;

    if p_start_time is null
      or p_end_time is null
    then
      raise exception using
        errcode = '22023',
        message =
          'ADDITIONAL_SESSION_TIME_REQUIRED';
    end if;

    if normalized_learning_mode is null then
      raise exception using
        errcode = '22023',
        message =
          'ADDITIONAL_SESSION_LEARNING_MODE_REQUIRED';
    end if;

    session_start_time := p_start_time;
    session_end_time := p_end_time;

    session_learning_mode :=
      normalized_learning_mode;

    session_component_code :=
      normalized_component_code;

    session_room_name :=
      normalized_room_name;

    session_meeting_url :=
      normalized_meeting_url;
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    '',
    true
  );

  insert into public.class_sessions (
    class_id,
    schedule_template_id,
    makeup_for_session_id,
    session_date,
    session_kind,
    component_code,
    start_time,
    end_time,
    learning_mode,
    room_name,
    meeting_url,
    status,
    notes,
    created_by
  )
  values (
    p_class_id,
    case
      when normalized_kind = 'regular'
        then p_schedule_template_id
      else null
    end,
    case
      when normalized_kind = 'makeup'
        then p_makeup_for_session_id
      else null
    end,
    p_session_date,
    normalized_kind,
    session_component_code,
    session_start_time,
    session_end_time,
    session_learning_mode,
    session_room_name,
    session_meeting_url,
    'scheduled',
    normalized_notes,
    actor_id
  )
  returning *
  into created_session;

  return created_session;
end;
$$;


-- =========================================================
-- START CLASS SESSION
-- =========================================================

create or replace function public.start_class_session(
  p_class_session_id uuid
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  target_session
    public.class_sessions%rowtype;

  action_at timestamptz :=
    pg_catalog.now();
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'sessions.manage'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'SESSION_MANAGE_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SESSION_ID_REQUIRED';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions
    as session_row
  where session_row.id =
    p_class_session_id
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

  if target_session.status <>
    'scheduled'
  then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SESSION_START_STATUS_INVALID';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    '',
    true
  );

  update public.class_sessions
  set
    status = 'in_progress',
    started_at = action_at,
    started_by = actor_id
  where id = p_class_session_id
  returning *
  into target_session;

  return target_session;
end;
$$;


-- =========================================================
-- COMPLETE CLASS SESSION
--
-- Completion and locking are deliberately separate.
-- Attendance and result corrections remain possible until
-- the later lock workflow is executed.
-- =========================================================

create or replace function public.complete_class_session(
  p_class_session_id uuid
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  target_session
    public.class_sessions%rowtype;

  action_at timestamptz :=
    pg_catalog.now();
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'sessions.manage'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'SESSION_MANAGE_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SESSION_ID_REQUIRED';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions
    as session_row
  where session_row.id =
    p_class_session_id
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

  if target_session.status <>
    'in_progress'
  then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SESSION_COMPLETE_STATUS_INVALID';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    '',
    true
  );

  update public.class_sessions
  set
    status = 'completed',
    completed_at = action_at,
    completed_by = actor_id
  where id = p_class_session_id
  returning *
  into target_session;

  return target_session;
end;
$$;


-- =========================================================
-- CANCEL CLASS SESSION
--
-- scheduled:
--   Cancellation has no start information.
--
-- in_progress:
--   Existing started_at and started_by are retained.
-- =========================================================

create or replace function public.cancel_class_session(
  p_class_session_id uuid,
  p_reason text
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_reason text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_reason, '')
      ),
      ''
    );

  target_session
    public.class_sessions%rowtype;

  action_at timestamptz :=
    pg_catalog.now();
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'sessions.manage'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'SESSION_MANAGE_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SESSION_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SESSION_CANCELLATION_REASON_REQUIRED';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions
    as session_row
  where session_row.id =
    p_class_session_id
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

  if target_session.status not in (
    'scheduled',
    'in_progress'
  ) then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SESSION_CANCEL_STATUS_INVALID';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.class_sessions
  set
    status = 'cancelled',
    cancelled_at = action_at,
    cancelled_by = actor_id,
    cancellation_reason =
      normalized_reason
  where id = p_class_session_id
  returning *
  into target_session;

  return target_session;
end;
$$;


-- =========================================================
-- FUNCTION PRIVILEGES
-- =========================================================

revoke all on function public.create_class_session(
  uuid,
  date,
  text,
  uuid,
  uuid,
  time without time zone,
  time without time zone,
  text,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.create_class_session(
  uuid,
  date,
  text,
  uuid,
  uuid,
  time without time zone,
  time without time zone,
  text,
  text,
  text,
  text,
  text
)
to authenticated;


revoke all on function public.start_class_session(
  uuid
)
from public, anon, authenticated;

grant execute on function public.start_class_session(
  uuid
)
to authenticated;


revoke all on function public.complete_class_session(
  uuid
)
from public, anon, authenticated;

grant execute on function public.complete_class_session(
  uuid
)
to authenticated;


revoke all on function public.cancel_class_session(
  uuid,
  text
)
from public, anon, authenticated;

grant execute on function public.cancel_class_session(
  uuid,
  text
)
to authenticated;


comment on function public.create_class_session(
  uuid,
  date,
  text,
  uuid,
  uuid,
  time without time zone,
  time without time zone,
  text,
  text,
  text,
  text,
  text
)
is
  'Creates a scheduled regular, makeup, or additional class session through an authorized workflow.';


comment on function public.start_class_session(
  uuid
)
is
  'Transitions a scheduled class session to in_progress.';


comment on function public.complete_class_session(
  uuid
)
is
  'Transitions an in_progress class session to completed without locking it.';


comment on function public.cancel_class_session(
  uuid,
  text
)
is
  'Cancels a scheduled or in-progress class session while preserving immutable history.';

commit;
