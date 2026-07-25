begin;

-- =========================================================
-- RECORD SESSION RESULT
-- =========================================================

create or replace function public.record_session_result(
  p_class_session_id uuid,
  p_student_id uuid,
  p_test_score numeric default null,
  p_notebook_score numeric default null,
  p_notebook_status text default 'not_submitted',
  p_comment text default null
)
returns public.session_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_notebook_status text :=
    pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(
          p_notebook_status,
          ''
        )
      )
    );

  normalized_comment text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_comment, '')
      ),
      ''
    );

  target_session
    public.class_sessions%rowtype;

  target_attendance
    public.session_attendance%rowtype;

  existing_result_id uuid;

  created_result
    public.session_results%rowtype;

  action_at timestamptz :=
    pg_catalog.now();

  result_graded_at timestamptz;
  result_graded_by uuid;
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'results.manage'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'RESULTS_MANAGE_PERMISSION_DENIED';
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

  if normalized_notebook_status not in (
    'submitted',
    'not_submitted',
    'not_required'
  ) then
    raise exception using
      errcode = '22023',
      message = 'NOTEBOOK_STATUS_INVALID';
  end if;

  if p_test_score is not null
    and (
      p_test_score < 0
      or p_test_score > 10
    )
  then
    raise exception using
      errcode = '22023',
      message = 'TEST_SCORE_INVALID';
  end if;

  if p_notebook_score is not null
    and (
      p_notebook_score < 0
      or p_notebook_score > 10
    )
  then
    raise exception using
      errcode = '22023',
      message = 'NOTEBOOK_SCORE_INVALID';
  end if;

  if normalized_notebook_status =
      'submitted'
    and p_notebook_score is null
  then
    raise exception using
      errcode = '22023',
      message =
        'SUBMITTED_NOTEBOOK_REQUIRES_SCORE';
  end if;

  if normalized_notebook_status in (
      'not_submitted',
      'not_required'
    )
    and p_notebook_score is not null
  then
    raise exception using
      errcode = '22023',
      message =
        'NOTEBOOK_SCORE_NOT_ALLOWED';
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

  if target_session.status not in (
    'in_progress',
    'completed'
  ) then
    raise exception using
      errcode = '23514',
      message =
        'RESULT_REQUIRES_STARTED_SESSION';
  end if;

  select attendance_row.*
  into target_attendance
  from public.session_attendance
    as attendance_row
  where attendance_row.class_session_id =
    p_class_session_id
    and attendance_row.student_id =
      p_student_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'SESSION_ATTENDANCE_NOT_FOUND';
  end if;

  if target_attendance.attendance_status
    not in (
      'present',
      'additional_study'
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'ABSENT_STUDENT_CANNOT_HAVE_SESSION_RESULT';
  end if;

  select result_row.id
  into existing_result_id
  from public.session_results
    as result_row
  where result_row.class_session_id =
    p_class_session_id
    and result_row.student_id =
      p_student_id
  for update;

  if existing_result_id is not null then
    raise exception using
      errcode = '23505',
      message =
        'SESSION_RESULT_ALREADY_EXISTS';
  end if;

  if p_test_score is not null
    or p_notebook_score is not null
  then
    result_graded_at := action_at;
    result_graded_by := actor_id;
  else
    result_graded_at := null;
    result_graded_by := null;
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    '',
    true
  );

  begin
    insert into public.session_results (
      class_session_id,
      student_id,
      test_score,
      notebook_score,
      notebook_status,
      comment,
      graded_at,
      graded_by,
      created_by
    )
    values (
      p_class_session_id,
      p_student_id,
      p_test_score,
      p_notebook_score,
      normalized_notebook_status,
      normalized_comment,
      result_graded_at,
      result_graded_by,
      actor_id
    )
    returning *
    into created_result;

  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message =
          'SESSION_RESULT_ALREADY_EXISTS';
  end;

  return created_result;
end;
$$;


-- =========================================================
-- UPDATE SESSION RESULT
-- =========================================================

create or replace function public.update_session_result(
  p_session_result_id uuid,
  p_test_score numeric,
  p_notebook_score numeric,
  p_notebook_status text,
  p_comment text,
  p_reason text
)
returns public.session_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_notebook_status text :=
    pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(
          p_notebook_status,
          ''
        )
      )
    );

  normalized_comment text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_comment, '')
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

  target_result
    public.session_results%rowtype;

  target_session
    public.class_sessions%rowtype;

  target_attendance
    public.session_attendance%rowtype;

  updated_result
    public.session_results%rowtype;

  action_at timestamptz :=
    pg_catalog.now();

  result_graded_at timestamptz;
  result_graded_by uuid;
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'results.manage'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'RESULTS_MANAGE_PERMISSION_DENIED';
  end if;

  if p_session_result_id is null then
    raise exception using
      errcode = '22023',
      message =
        'SESSION_RESULT_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message =
        'SESSION_RESULT_UPDATE_REASON_REQUIRED';
  end if;

  if normalized_notebook_status not in (
    'submitted',
    'not_submitted',
    'not_required'
  ) then
    raise exception using
      errcode = '22023',
      message = 'NOTEBOOK_STATUS_INVALID';
  end if;

  if p_test_score is not null
    and (
      p_test_score < 0
      or p_test_score > 10
    )
  then
    raise exception using
      errcode = '22023',
      message = 'TEST_SCORE_INVALID';
  end if;

  if p_notebook_score is not null
    and (
      p_notebook_score < 0
      or p_notebook_score > 10
    )
  then
    raise exception using
      errcode = '22023',
      message = 'NOTEBOOK_SCORE_INVALID';
  end if;

  if normalized_notebook_status =
      'submitted'
    and p_notebook_score is null
  then
    raise exception using
      errcode = '22023',
      message =
        'SUBMITTED_NOTEBOOK_REQUIRES_SCORE';
  end if;

  if normalized_notebook_status in (
      'not_submitted',
      'not_required'
    )
    and p_notebook_score is not null
  then
    raise exception using
      errcode = '22023',
      message =
        'NOTEBOOK_SCORE_NOT_ALLOWED';
  end if;

  select result_row.*
  into target_result
  from public.session_results
    as result_row
  where result_row.id =
    p_session_result_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'SESSION_RESULT_NOT_FOUND';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions
    as session_row
  where session_row.id =
    target_result.class_session_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_SESSION_NOT_FOUND';
  end if;

  select result_row.*
  into target_result
  from public.session_results
    as result_row
  where result_row.id =
    p_session_result_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'SESSION_RESULT_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_IS_LOCKED';
  end if;

  if target_session.status not in (
    'in_progress',
    'completed'
  ) then
    raise exception using
      errcode = '23514',
      message =
        'RESULT_REQUIRES_STARTED_SESSION';
  end if;

  select attendance_row.*
  into target_attendance
  from public.session_attendance
    as attendance_row
  where attendance_row.class_session_id =
    target_result.class_session_id
    and attendance_row.student_id =
      target_result.student_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'SESSION_ATTENDANCE_NOT_FOUND';
  end if;

  if target_attendance.attendance_status
    not in (
      'present',
      'additional_study'
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'ABSENT_STUDENT_CANNOT_HAVE_SESSION_RESULT';
  end if;

  if target_result.test_score
      is not distinct from p_test_score
    and target_result.notebook_score
      is not distinct from p_notebook_score
    and target_result.notebook_status =
      normalized_notebook_status
    and target_result.comment
      is not distinct from normalized_comment
  then
    raise exception using
      errcode = '22023',
      message =
        'SESSION_RESULT_NO_CHANGES';
  end if;

  if p_test_score is not null
    or p_notebook_score is not null
  then
    result_graded_at := action_at;
    result_graded_by := actor_id;
  else
    result_graded_at := null;
    result_graded_by := null;
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.session_results
  set
    test_score = p_test_score,
    notebook_score = p_notebook_score,
    notebook_status =
      normalized_notebook_status,
    comment = normalized_comment,
    graded_at = result_graded_at,
    graded_by = result_graded_by
  where id = p_session_result_id
  returning *
  into updated_result;

  return updated_result;
end;
$$;


-- =========================================================
-- LOCK CLASS SESSION
--
-- The foundation validation trigger enforces:
--   - completed session only
--   - at least one attendance record
--   - full roster attendance for regular/makeup sessions
--   - results for present/additional-study attendance
--   - lock is irreversible
-- =========================================================

create or replace function public.lock_class_session(
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

  locked_session
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
    'sessions.lock'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'SESSION_LOCK_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SESSION_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message =
        'SESSION_LOCK_REASON_REQUIRED';
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
      message =
        'CLASS_SESSION_ALREADY_LOCKED';
  end if;

  if target_session.status <> 'completed' then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.class_sessions
  set
    locked_at = action_at,
    locked_by = actor_id,
    lock_reason = normalized_reason
  where id = p_class_session_id
  returning *
  into locked_session;

  return locked_session;
end;
$$;


-- =========================================================
-- FUNCTION PRIVILEGES
-- =========================================================

revoke all on function public.record_session_result(
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.record_session_result(
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text
)
to authenticated;


revoke all on function public.update_session_result(
  uuid,
  numeric,
  numeric,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.update_session_result(
  uuid,
  numeric,
  numeric,
  text,
  text,
  text
)
to authenticated;


revoke all on function public.lock_class_session(
  uuid,
  text
)
from public, anon, authenticated;

grant execute on function public.lock_class_session(
  uuid,
  text
)
to authenticated;


comment on function public.record_session_result(
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text
)
is
  'Records a student result for a started and unlocked class session through the authorized results workflow.';


comment on function public.update_session_result(
  uuid,
  numeric,
  numeric,
  text,
  text,
  text
)
is
  'Updates mutable result fields before session locking and records the workflow reason in audit history.';


comment on function public.lock_class_session(
  uuid,
  text
)
is
  'Irreversibly locks a completed class session after foundation roster, attendance, and result validation succeeds.';

commit;
