begin;

-- =========================================================
-- MARK SESSION ATTENDANCE
--
-- Main attendance statuses automatically resolve the
-- enrollment covering the session date and class.
--
-- Additional study may exist without an enrollment. When a
-- matching enrollment exists, it is retained for provenance.
-- =========================================================

create or replace function public.mark_session_attendance(
  p_class_session_id uuid,
  p_student_id uuid,
  p_attendance_status text,
  p_actual_learning_mode text,
  p_notes text default null
)
returns public.session_attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_status text :=
    pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(p_attendance_status, '')
      )
    );

  normalized_mode text :=
    pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(p_actual_learning_mode, '')
      )
    );

  normalized_notes text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_notes, '')
      ),
      ''
    );

  target_session
    public.class_sessions%rowtype;

  target_student
    public.students%rowtype;

  target_enrollment
    public.student_enrollments%rowtype;

  existing_attendance_id uuid;

  created_attendance
    public.session_attendance%rowtype;

  action_at timestamptz :=
    pg_catalog.now();
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'attendance.mark'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'ATTENDANCE_MARK_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SESSION_ID_REQUIRED';
  end if;

  if p_student_id is null then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ID_REQUIRED';
  end if;

  if normalized_status not in (
    'present',
    'excused_absence',
    'unexcused_absence',
    'additional_study'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ATTENDANCE_STATUS_INVALID';
  end if;

  if normalized_mode not in (
    'online',
    'offline'
  ) then
    raise exception using
      errcode = '22023',
      message =
        'ATTENDANCE_LEARNING_MODE_INVALID';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions
    as session_row
  where session_row.id =
    p_class_session_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_SESSION_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_IS_LOCKED';
  end if;

  if target_session.status = 'cancelled' then
    raise exception using
      errcode = '23514',
      message =
        'CANCELLED_SESSION_CANNOT_HAVE_ATTENDANCE';
  end if;

  if target_session.status not in (
    'in_progress',
    'completed'
  ) then
    raise exception using
      errcode = '23514',
      message =
        'ATTENDANCE_REQUIRES_STARTED_SESSION';
  end if;

  select student_row.*
  into target_student
  from public.students as student_row
  where student_row.id = p_student_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STUDENT_NOT_FOUND';
  end if;

  if target_student.lifecycle_status in (
    'interested',
    'trial_booked',
    'trial_completed',
    'pending_enrollment_confirmation',
    'waiting_class'
  ) then
    raise exception using
      errcode = '23514',
      message =
        'TRIAL_OR_UNCONFIRMED_STUDENT_CANNOT_BE_MARKED';
  end if;

  select attendance_row.id
  into existing_attendance_id
  from public.session_attendance
    as attendance_row
  where attendance_row.class_session_id =
    p_class_session_id
    and attendance_row.student_id =
      p_student_id
  for update;

  if existing_attendance_id is not null then
    raise exception using
      errcode = '23505',
      message =
        'SESSION_ATTENDANCE_ALREADY_EXISTS';
  end if;

  select enrollment_row.*
  into target_enrollment
  from public.student_enrollments
    as enrollment_row
  where enrollment_row.student_id =
    p_student_id
    and enrollment_row.class_id =
      target_session.class_id
    and target_session.session_date >=
      enrollment_row.effective_from
    and (
      enrollment_row.effective_to is null
      or target_session.session_date <=
        enrollment_row.effective_to
    )
  order by
    enrollment_row.effective_from desc,
    enrollment_row.created_at desc
  limit 1
  for share;

  if normalized_status <>
    'additional_study'
    and target_enrollment.id is null
  then
    raise exception using
      errcode = '23514',
      message =
        'MAIN_ATTENDANCE_REQUIRES_EFFECTIVE_ENROLLMENT';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    '',
    true
  );

  begin
    insert into public.session_attendance (
      class_session_id,
      student_id,
      student_enrollment_id,
      attendance_status,
      actual_learning_mode,
      marked_at,
      marked_by,
      notes
    )
    values (
      p_class_session_id,
      p_student_id,
      target_enrollment.id,
      normalized_status,
      normalized_mode,
      action_at,
      actor_id,
      normalized_notes
    )
    returning *
    into created_attendance;

  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message =
          'SESSION_ATTENDANCE_ALREADY_EXISTS';
  end;

  return created_attendance;
end;
$$;


-- =========================================================
-- UPDATE SESSION ATTENDANCE
--
-- Session, student and original enrollment are immutable.
-- Updating a completed or past session is automatically
-- marked late by the foundation validation trigger.
-- =========================================================

create or replace function public.update_session_attendance(
  p_session_attendance_id uuid,
  p_attendance_status text,
  p_actual_learning_mode text,
  p_notes text,
  p_reason text
)
returns public.session_attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_status text :=
    pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(p_attendance_status, '')
      )
    );

  normalized_mode text :=
    pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(p_actual_learning_mode, '')
      )
    );

  normalized_notes text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_notes, '')
      ),
      ''
    );

  normalized_reason text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_reason, '')
      ),
      ''
    );

  target_attendance
    public.session_attendance%rowtype;

  target_session
    public.class_sessions%rowtype;

  updated_attendance
    public.session_attendance%rowtype;

  action_at timestamptz :=
    pg_catalog.now();
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'attendance.mark'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'ATTENDANCE_MARK_PERMISSION_DENIED';
  end if;

  if p_session_attendance_id is null then
    raise exception using
      errcode = '22023',
      message =
        'SESSION_ATTENDANCE_ID_REQUIRED';
  end if;

  if normalized_status not in (
    'present',
    'excused_absence',
    'unexcused_absence',
    'additional_study'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ATTENDANCE_STATUS_INVALID';
  end if;

  if normalized_mode not in (
    'online',
    'offline'
  ) then
    raise exception using
      errcode = '22023',
      message =
        'ATTENDANCE_LEARNING_MODE_INVALID';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message =
        'ATTENDANCE_UPDATE_REASON_REQUIRED';
  end if;

  select attendance_row.*
  into target_attendance
  from public.session_attendance
    as attendance_row
  where attendance_row.id =
    p_session_attendance_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'SESSION_ATTENDANCE_NOT_FOUND';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions
    as session_row
  where session_row.id =
    target_attendance.class_session_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_SESSION_NOT_FOUND';
  end if;

  select attendance_row.*
  into target_attendance
  from public.session_attendance
    as attendance_row
  where attendance_row.id =
    p_session_attendance_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'SESSION_ATTENDANCE_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_IS_LOCKED';
  end if;

  if target_session.status = 'cancelled' then
    raise exception using
      errcode = '23514',
      message =
        'CANCELLED_SESSION_CANNOT_HAVE_ATTENDANCE';
  end if;

  if target_session.status not in (
    'in_progress',
    'completed'
  ) then
    raise exception using
      errcode = '23514',
      message =
        'ATTENDANCE_REQUIRES_STARTED_SESSION';
  end if;

  if normalized_status <>
    'additional_study'
    and target_attendance.student_enrollment_id
      is null
  then
    raise exception using
      errcode = '23514',
      message =
        'MAIN_ATTENDANCE_REQUIRES_EXISTING_ENROLLMENT';
  end if;

  if target_attendance.attendance_status =
      normalized_status
    and target_attendance.actual_learning_mode =
      normalized_mode
    and target_attendance.notes
      is not distinct from normalized_notes
  then
    raise exception using
      errcode = '22023',
      message =
        'SESSION_ATTENDANCE_NO_CHANGES';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.session_attendance
  set
    attendance_status = normalized_status,
    actual_learning_mode = normalized_mode,
    marked_at = action_at,
    marked_by = actor_id,
    notes = normalized_notes
  where id = p_session_attendance_id
  returning *
  into updated_attendance;

  return updated_attendance;
end;
$$;


-- =========================================================
-- FUNCTION PRIVILEGES
-- =========================================================

revoke all on function public.mark_session_attendance(
  uuid,
  uuid,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.mark_session_attendance(
  uuid,
  uuid,
  text,
  text,
  text
)
to authenticated;


revoke all on function public.update_session_attendance(
  uuid,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.update_session_attendance(
  uuid,
  text,
  text,
  text,
  text
)
to authenticated;


comment on function public.mark_session_attendance(
  uuid,
  uuid,
  text,
  text,
  text
)
is
  'Marks attendance through an authorized workflow and resolves the effective enrollment automatically.';


comment on function public.update_session_attendance(
  uuid,
  text,
  text,
  text,
  text
)
is
  'Updates an unlocked attendance record while retaining immutable session, student, and enrollment identity.';

commit;
