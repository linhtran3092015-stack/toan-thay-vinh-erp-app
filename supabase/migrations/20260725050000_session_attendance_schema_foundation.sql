begin;

-- =========================================================
-- TASK 5.2 — SESSION AND ATTENDANCE SCHEMA FOUNDATION
--
-- Tables:
--   class_sessions
--   session_attendance
--   session_results
--
-- This migration will remain local until validation,
-- audit, RLS and grants are added in the following steps.
-- =========================================================


-- =========================================================
-- CLASS SESSIONS
--
-- A class session is one real teaching occurrence.
-- Schedule details are copied as historical snapshots.
-- =========================================================

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),

  class_id uuid not null
    references public.classes(id) on delete restrict,

  schedule_template_id uuid
    references public.class_schedule_templates(id)
    on delete restrict,

  makeup_for_session_id uuid
    references public.class_sessions(id)
    on delete restrict,

  session_date date not null,

  session_kind text not null default 'regular',

  component_code text,

  start_time time not null,
  end_time time not null,

  learning_mode text not null,

  room_name text,
  meeting_url text,

  status text not null default 'scheduled',

  started_at timestamptz,
  started_by uuid
    references public.profiles(id) on delete restrict,

  completed_at timestamptz,
  completed_by uuid
    references public.profiles(id) on delete restrict,

  cancelled_at timestamptz,
  cancelled_by uuid
    references public.profiles(id) on delete restrict,
  cancellation_reason text,

  locked_at timestamptz,
  locked_by uuid
    references public.profiles(id) on delete restrict,
  lock_reason text,

  notes text,

  created_by uuid
    references public.profiles(id) on delete restrict,

  created_at timestamptz not null
    default pg_catalog.now(),

  updated_at timestamptz not null
    default pg_catalog.now(),

  constraint class_sessions_kind_check
    check (
      session_kind in (
        'regular',
        'makeup',
        'additional'
      )
    ),

  constraint class_sessions_source_check
    check (
      (
        session_kind = 'regular'
        and schedule_template_id is not null
        and makeup_for_session_id is null
      )
      or
      (
        session_kind = 'makeup'
        and schedule_template_id is null
        and makeup_for_session_id is not null
      )
      or
      (
        session_kind = 'additional'
        and schedule_template_id is null
        and makeup_for_session_id is null
      )
    ),

  constraint class_sessions_makeup_self_check
    check (
      makeup_for_session_id is null
      or makeup_for_session_id <> id
    ),

  constraint class_sessions_component_code_check
    check (
      component_code is null
      or (
        component_code =
          pg_catalog.upper(
            pg_catalog.btrim(component_code)
          )
        and component_code <> ''
        and component_code ~ '^[A-Z0-9._-]+$'
      )
    ),

  constraint class_sessions_time_check
    check (end_time > start_time),

  constraint class_sessions_learning_mode_check
    check (
      learning_mode in (
        'online',
        'offline',
        'hybrid'
      )
    ),

  constraint class_sessions_room_name_check
    check (
      room_name is null
      or (
        room_name = pg_catalog.btrim(room_name)
        and room_name <> ''
      )
    ),

  constraint class_sessions_meeting_url_check
    check (
      meeting_url is null
      or (
        meeting_url =
          pg_catalog.btrim(meeting_url)
        and meeting_url <> ''
      )
    ),

  constraint class_sessions_status_check
    check (
      status in (
        'scheduled',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  constraint class_sessions_started_state_check
    check (
      (
        started_at is null
        and started_by is null
      )
      or
      (
        started_at is not null
        and started_by is not null
      )
    ),

  constraint class_sessions_status_state_check
    check (
      (
        status = 'scheduled'
        and started_at is null
        and started_by is null
        and completed_at is null
        and completed_by is null
        and cancelled_at is null
        and cancelled_by is null
        and cancellation_reason is null
      )
      or
      (
        status = 'in_progress'
        and started_at is not null
        and started_by is not null
        and completed_at is null
        and completed_by is null
        and cancelled_at is null
        and cancelled_by is null
        and cancellation_reason is null
      )
      or
      (
        status = 'completed'
        and started_at is not null
        and started_by is not null
        and completed_at is not null
        and completed_by is not null
        and cancelled_at is null
        and cancelled_by is null
        and cancellation_reason is null
      )
      or
      (
        status = 'cancelled'
        and completed_at is null
        and completed_by is null
        and cancelled_at is not null
        and cancelled_by is not null
        and cancellation_reason is not null
        and pg_catalog.btrim(
          cancellation_reason
        ) <> ''
      )
    ),

  constraint class_sessions_lock_state_check
    check (
      (
        locked_at is null
        and locked_by is null
        and lock_reason is null
      )
      or
      (
        status = 'completed'
        and locked_at is not null
        and locked_by is not null
        and lock_reason is not null
        and pg_catalog.btrim(lock_reason) <> ''
      )
    ),

  constraint class_sessions_notes_check
    check (
      notes is null
      or pg_catalog.btrim(notes) <> ''
    )
);

create unique index
  class_sessions_template_date_unique_idx
on public.class_sessions (
  schedule_template_id,
  session_date
)
where schedule_template_id is not null;

create unique index
  class_sessions_makeup_source_unique_idx
on public.class_sessions (
  makeup_for_session_id
)
where makeup_for_session_id is not null;

create index class_sessions_class_date_idx
on public.class_sessions (
  class_id,
  session_date desc,
  start_time
);

create index class_sessions_status_date_idx
on public.class_sessions (
  status,
  session_date,
  start_time
);

create index class_sessions_schedule_history_idx
on public.class_sessions (
  schedule_template_id,
  session_date desc
)
where schedule_template_id is not null;

create trigger class_sessions_set_updated_at
before update on public.class_sessions
for each row execute function public.set_updated_at();


-- =========================================================
-- SESSION ATTENDANCE
--
-- One attendance row per student per class session.
-- Additional study does not require an enrollment in the
-- session's class.
-- =========================================================

create table public.session_attendance (
  id uuid primary key default gen_random_uuid(),

  class_session_id uuid not null
    references public.class_sessions(id)
    on delete restrict,

  student_id uuid not null
    references public.students(id)
    on delete restrict,

  student_enrollment_id uuid
    references public.student_enrollments(id)
    on delete restrict,

  attendance_status text not null,

  actual_learning_mode text not null,

  marked_at timestamptz not null
    default pg_catalog.now(),

  marked_by uuid not null
    references public.profiles(id)
    on delete restrict,

  is_late_update boolean not null default false,

  notes text,

  created_at timestamptz not null
    default pg_catalog.now(),

  updated_at timestamptz not null
    default pg_catalog.now(),

  constraint session_attendance_session_student_unique
    unique (
      class_session_id,
      student_id
    ),

  constraint session_attendance_status_check
    check (
      attendance_status in (
        'present',
        'excused_absence',
        'unexcused_absence',
        'additional_study'
      )
    ),

  constraint session_attendance_mode_check
    check (
      actual_learning_mode in (
        'online',
        'offline'
      )
    ),

  constraint session_attendance_enrollment_check
    check (
      attendance_status = 'additional_study'
      or student_enrollment_id is not null
    ),

  constraint session_attendance_notes_check
    check (
      notes is null
      or pg_catalog.btrim(notes) <> ''
    )
);

create index session_attendance_session_status_idx
on public.session_attendance (
  class_session_id,
  attendance_status
);

create index session_attendance_student_history_idx
on public.session_attendance (
  student_id,
  class_session_id
);

create index session_attendance_enrollment_idx
on public.session_attendance (
  student_enrollment_id
)
where student_enrollment_id is not null;

create trigger session_attendance_set_updated_at
before update on public.session_attendance
for each row execute function public.set_updated_at();


-- =========================================================
-- SESSION RESULTS
--
-- A student can have at most one result record per session.
-- The composite foreign key guarantees that a corresponding
-- attendance record already exists.
-- =========================================================

create table public.session_results (
  id uuid primary key default gen_random_uuid(),

  class_session_id uuid not null,

  student_id uuid not null,

  test_score numeric(4, 2),

  notebook_score numeric(4, 2),

  notebook_status text not null
    default 'not_submitted',

  comment text,

  graded_at timestamptz,

  graded_by uuid
    references public.profiles(id)
    on delete restrict,

  created_by uuid not null
    references public.profiles(id)
    on delete restrict,

  created_at timestamptz not null
    default pg_catalog.now(),

  updated_at timestamptz not null
    default pg_catalog.now(),

  constraint session_results_session_student_unique
    unique (
      class_session_id,
      student_id
    ),

  constraint session_results_attendance_fk
    foreign key (
      class_session_id,
      student_id
    )
    references public.session_attendance (
      class_session_id,
      student_id
    )
    on delete restrict,

  constraint session_results_test_score_check
    check (
      test_score is null
      or test_score between 0 and 10
    ),

  constraint session_results_notebook_score_check
    check (
      notebook_score is null
      or notebook_score between 0 and 10
    ),

  constraint session_results_notebook_status_check
    check (
      notebook_status in (
        'submitted',
        'not_submitted',
        'not_required'
      )
    ),

  constraint session_results_notebook_submission_check
    check (
      (
        notebook_status = 'submitted'
        and notebook_score is not null
      )
      or
      (
        notebook_status in (
          'not_submitted',
          'not_required'
        )
        and notebook_score is null
      )
    ),

  constraint session_results_comment_check
    check (
      comment is null
      or pg_catalog.btrim(comment) <> ''
    ),

  constraint session_results_graded_state_check
    check (
      (
        graded_at is null
        and graded_by is null
      )
      or
      (
        graded_at is not null
        and graded_by is not null
      )
    ),

  constraint session_results_score_grader_check
    check (
      (
        test_score is null
        and notebook_score is null
      )
      or
      (
        graded_at is not null
        and graded_by is not null
      )
    )
);

create index session_results_session_idx
on public.session_results (
  class_session_id
);

create index session_results_student_history_idx
on public.session_results (
  student_id,
  class_session_id
);

create trigger session_results_set_updated_at
before update on public.session_results
for each row execute function public.set_updated_at();



-- =========================================================
-- CLASS SESSION CROSS-TABLE VALIDATION
-- =========================================================

create or replace function
  public.validate_class_session_foundation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;
  target_schedule
    public.class_schedule_templates%rowtype;
  source_session public.class_sessions%rowtype;

  attendance_count bigint;
  missing_attendance_count bigint;
  missing_result_count bigint;

  requires_active_context boolean := false;
begin
  select class_row.*
  into target_class
  from public.classes as class_row
  where class_row.id = new.class_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_NOT_FOUND';
  end if;

  select academic_year.*
  into target_year
  from public.academic_years as academic_year
  where academic_year.id =
    target_class.academic_year_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if new.session_date < target_year.starts_on
    or new.session_date > target_year.ends_on
  then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SESSION_DATE_OUTSIDE_ACADEMIC_YEAR';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'scheduled' then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_MUST_START_SCHEDULED';
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
      message =
        'CLASS_SESSION_REQUIRES_ACTIVE_CLASS';
  end if;

  if requires_active_context
    and target_year.status <> 'active'
  then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SESSION_REQUIRES_ACTIVE_ACADEMIC_YEAR';
  end if;

  if new.session_kind = 'regular' then
    select schedule.*
    into target_schedule
    from public.class_schedule_templates
      as schedule
    where schedule.id =
      new.schedule_template_id
    for share;

    if not found then
      raise exception using
        errcode = 'P0002',
        message =
          'CLASS_SCHEDULE_TEMPLATE_NOT_FOUND';
    end if;

    if target_schedule.class_id <>
      new.class_id
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_SCHEDULE_CLASS_MISMATCH';
    end if;

    if new.session_date <
      target_schedule.effective_from
      or (
        target_schedule.effective_to
          is not null
        and new.session_date >
          target_schedule.effective_to
      )
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_SCHEDULE_NOT_EFFECTIVE';
    end if;

    if pg_catalog.date_part(
      'isodow',
      new.session_date
    )::smallint <> target_schedule.weekday
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_WEEKDAY_MISMATCH';
    end if;

  elsif new.session_kind = 'makeup' then
    select session_row.*
    into source_session
    from public.class_sessions
      as session_row
    where session_row.id =
      new.makeup_for_session_id
    for share;

    if not found then
      raise exception using
        errcode = 'P0002',
        message =
          'MAKEUP_SOURCE_SESSION_NOT_FOUND';
    end if;

    if source_session.class_id <>
      new.class_id
    then
      raise exception using
        errcode = '23514',
        message =
          'MAKEUP_SESSION_CLASS_MISMATCH';
    end if;

    if source_session.session_kind =
      'additional'
    then
      raise exception using
        errcode = '23514',
        message =
          'ADDITIONAL_SESSION_CANNOT_HAVE_MAKEUP';
    end if;

    if source_session.status <>
      'cancelled'
    then
      raise exception using
        errcode = '23514',
        message =
          'MAKEUP_SOURCE_SESSION_MUST_BE_CANCELLED';
    end if;

    if new.session_date <=
      source_session.session_date
    then
      raise exception using
        errcode = '23514',
        message =
          'MAKEUP_SESSION_DATE_INVALID';
    end if;
  end if;

  if tg_op = 'INSERT'
    and new.locked_at is not null
  then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SESSION_CANNOT_START_LOCKED';
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
        message =
          'CLASS_SESSION_STATUS_TRANSITION_INVALID';
    end if;

    if old.status = 'in_progress'
      and new.status not in (
        'in_progress',
        'completed',
        'cancelled'
      )
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_STATUS_TRANSITION_INVALID';
    end if;

    if old.status in (
      'completed',
      'cancelled'
    )
      and new.status <> old.status
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_TERMINAL_STATUS_IMMUTABLE';
    end if;

    if old.status = 'in_progress'
      and new.status = 'cancelled'
      and (
        new.started_at
          is distinct from old.started_at
        or new.started_by
          is distinct from old.started_by
      )
    then
      raise exception using
        errcode = '23514',
        message =
          'CANCELLED_SESSION_MUST_PRESERVE_START';
    end if;

    if old.started_at is not null
      and new.started_at <
        old.started_at
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_STARTED_AT_CANNOT_MOVE_BACK';
    end if;

    if new.completed_at is not null
      and new.started_at is not null
      and new.completed_at <
        new.started_at
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_COMPLETION_TIME_INVALID';
    end if;

    if old.locked_at is not null
      and new.locked_at is null
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_CANNOT_BE_UNLOCKED';
    end if;

    if old.locked_at is not null
      and (
        pg_catalog.to_jsonb(new)
          - 'updated_at'
      ) is distinct from (
        pg_catalog.to_jsonb(old)
          - 'updated_at'
      )
    then
      raise exception using
        errcode = '23514',
        message =
          'LOCKED_CLASS_SESSION_IS_IMMUTABLE';
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
        message =
          'ONLY_COMPLETED_SESSION_CAN_BE_LOCKED';
    end if;

    if tg_op <> 'UPDATE'
      or old.status <> 'completed'
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK';
    end if;

    select count(*)
    into attendance_count
    from public.session_attendance
      as attendance
    where attendance.class_session_id =
      new.id;

    if attendance_count = 0 then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_LOCK_REQUIRES_ATTENDANCE';
    end if;

    if new.session_kind in (
      'regular',
      'makeup'
    )
    then
      select count(*)
      into missing_attendance_count
      from public.student_enrollments
        as enrollment
      where enrollment.class_id =
        new.class_id
        and new.session_date >=
          enrollment.effective_from
        and (
          enrollment.effective_to is null
          or new.session_date <=
            enrollment.effective_to
        )
        and not exists (
          select 1
          from public.session_attendance
            as attendance
          where attendance.class_session_id =
            new.id
            and attendance.student_id =
              enrollment.student_id
            and attendance.student_enrollment_id =
              enrollment.id
            and attendance.attendance_status in (
              'present',
              'excused_absence',
              'unexcused_absence'
            )
        );

      if missing_attendance_count > 0 then
        raise exception using
          errcode = '23514',
          message =
            'CLASS_SESSION_LOCK_REQUIRES_FULL_ATTENDANCE';
      end if;
    end if;

    select count(*)
    into missing_result_count
    from public.session_attendance
      as attendance
    left join public.session_results
      as result
      on result.class_session_id =
        attendance.class_session_id
      and result.student_id =
        attendance.student_id
    where attendance.class_session_id =
      new.id
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
        message =
          'CLASS_SESSION_LOCK_REQUIRES_RESULTS';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function
  public.validate_class_session_foundation()
from public, anon, authenticated;

create trigger
  class_sessions_validate_business_rules
before insert or update
on public.class_sessions
for each row execute function
  public.validate_class_session_foundation();


-- =========================================================
-- SESSION ATTENDANCE CROSS-TABLE VALIDATION
-- =========================================================

create or replace function
  public.validate_session_attendance_foundation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.class_sessions%rowtype;
  target_student public.students%rowtype;
  target_enrollment
    public.student_enrollments%rowtype;

  business_date date := (
    pg_catalog.now()
      at time zone 'Asia/Ho_Chi_Minh'
  )::date;
begin
  select session_row.*
  into target_session
  from public.class_sessions as session_row
  where session_row.id =
    new.class_session_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'CLASS_SESSION_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SESSION_IS_LOCKED';
  end if;

  if target_session.status =
    'cancelled'
  then
    raise exception using
      errcode = '23514',
      message =
        'CANCELLED_SESSION_CANNOT_HAVE_ATTENDANCE';
  end if;

  if target_session.status not in (
    'in_progress',
    'completed'
  )
  then
    raise exception using
      errcode = '23514',
      message =
        'ATTENDANCE_REQUIRES_STARTED_SESSION';
  end if;

  select student.*
  into target_student
  from public.students as student
  where student.id = new.student_id
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
  )
  then
    raise exception using
      errcode = '23514',
      message =
        'TRIAL_OR_UNCONFIRMED_STUDENT_CANNOT_BE_MARKED';
  end if;

  if new.student_enrollment_id
    is not null
  then
    select enrollment.*
    into target_enrollment
    from public.student_enrollments
      as enrollment
    where enrollment.id =
      new.student_enrollment_id
    for share;

    if not found then
      raise exception using
        errcode = 'P0002',
        message =
          'STUDENT_ENROLLMENT_NOT_FOUND';
    end if;

    if target_enrollment.student_id <>
      new.student_id
    then
      raise exception using
        errcode = '23514',
        message =
          'ATTENDANCE_ENROLLMENT_STUDENT_MISMATCH';
    end if;

    if target_session.session_date <
      target_enrollment.effective_from
      or (
        target_enrollment.effective_to
          is not null
        and target_session.session_date >
          target_enrollment.effective_to
      )
    then
      raise exception using
        errcode = '23514',
        message =
          'ATTENDANCE_ENROLLMENT_NOT_EFFECTIVE';
    end if;
  end if;

  if new.attendance_status <>
    'additional_study'
  then
    if new.student_enrollment_id
      is null
    then
      raise exception using
        errcode = '23514',
        message =
          'MAIN_ATTENDANCE_REQUIRES_ENROLLMENT';
    end if;

    if target_enrollment.class_id <>
      target_session.class_id
    then
      raise exception using
        errcode = '23514',
        message =
          'ATTENDANCE_ENROLLMENT_CLASS_MISMATCH';
    end if;
  end if;

  if target_session.status =
    'completed'
    or target_session.session_date <
      business_date
    or (
      tg_op = 'UPDATE'
      and old.is_late_update
    )
  then
    new.is_late_update := true;
  end if;

  return new;
end;
$$;

revoke all on function
  public.validate_session_attendance_foundation()
from public, anon, authenticated;

create trigger
  session_attendance_validate_business_rules
before insert or update
on public.session_attendance
for each row execute function
  public.validate_session_attendance_foundation();


-- =========================================================
-- SESSION RESULT CROSS-TABLE VALIDATION
-- =========================================================

create or replace function
  public.validate_session_result_foundation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.class_sessions%rowtype;
  target_attendance
    public.session_attendance%rowtype;
begin
  select session_row.*
  into target_session
  from public.class_sessions as session_row
  where session_row.id =
    new.class_session_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'CLASS_SESSION_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SESSION_IS_LOCKED';
  end if;

  if target_session.status not in (
    'in_progress',
    'completed'
  )
  then
    raise exception using
      errcode = '23514',
      message =
        'RESULT_REQUIRES_STARTED_SESSION';
  end if;

  select attendance.*
  into target_attendance
  from public.session_attendance
    as attendance
  where attendance.class_session_id =
    new.class_session_id
    and attendance.student_id =
      new.student_id
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

  return new;
end;
$$;

revoke all on function
  public.validate_session_result_foundation()
from public, anon, authenticated;

create trigger
  session_results_validate_business_rules
before insert or update
on public.session_results
for each row execute function
  public.validate_session_result_foundation();


-- =========================================================
-- IMMUTABLE IDENTITY AND TERMINAL HISTORY
--
-- Business identity cannot be rewritten after creation.
-- Completed sessions may only receive their first lock.
-- Cancelled sessions are fully immutable.
-- =========================================================

create or replace function
  public.protect_session_foundation_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'class_sessions' then
    if new.id is distinct from old.id
      or new.class_id is distinct from old.class_id
      or new.schedule_template_id
        is distinct from old.schedule_template_id
      or new.makeup_for_session_id
        is distinct from old.makeup_for_session_id
      or new.session_date
        is distinct from old.session_date
      or new.session_kind
        is distinct from old.session_kind
      or new.component_code
        is distinct from old.component_code
      or new.start_time
        is distinct from old.start_time
      or new.end_time
        is distinct from old.end_time
      or new.learning_mode
        is distinct from old.learning_mode
      or new.room_name
        is distinct from old.room_name
      or new.meeting_url
        is distinct from old.meeting_url
      or new.created_by
        is distinct from old.created_by
      or new.created_at
        is distinct from old.created_at
    then
      raise exception using
        errcode = '23514',
        message =
          'CLASS_SESSION_IDENTITY_IS_IMMUTABLE';
    end if;

    if old.status = 'cancelled'
      and (
        pg_catalog.to_jsonb(new)
          - 'updated_at'
      ) is distinct from (
        pg_catalog.to_jsonb(old)
          - 'updated_at'
      )
    then
      raise exception using
        errcode = '23514',
        message =
          'CANCELLED_CLASS_SESSION_IS_IMMUTABLE';
    end if;

    if old.status = 'completed'
      and (
        pg_catalog.to_jsonb(new)
          - 'updated_at'
          - 'locked_at'
          - 'locked_by'
          - 'lock_reason'
      ) is distinct from (
        pg_catalog.to_jsonb(old)
          - 'updated_at'
          - 'locked_at'
          - 'locked_by'
          - 'lock_reason'
      )
    then
      raise exception using
        errcode = '23514',
        message =
          'COMPLETED_CLASS_SESSION_HISTORY_IS_IMMUTABLE';
    end if;

  elsif tg_table_name = 'session_attendance' then
    if new.id is distinct from old.id
      or new.class_session_id
        is distinct from old.class_session_id
      or new.student_id
        is distinct from old.student_id
      or new.student_enrollment_id
        is distinct from old.student_enrollment_id
      or new.created_at
        is distinct from old.created_at
    then
      raise exception using
        errcode = '23514',
        message =
          'SESSION_ATTENDANCE_IDENTITY_IS_IMMUTABLE';
    end if;

  elsif tg_table_name = 'session_results' then
    if new.id is distinct from old.id
      or new.class_session_id
        is distinct from old.class_session_id
      or new.student_id
        is distinct from old.student_id
      or new.created_by
        is distinct from old.created_by
      or new.created_at
        is distinct from old.created_at
    then
      raise exception using
        errcode = '23514',
        message =
          'SESSION_RESULT_IDENTITY_IS_IMMUTABLE';
    end if;

  else
    raise exception using
      errcode = '22023',
      message =
        'UNSUPPORTED_SESSION_HISTORY_TABLE';
  end if;

  return new;
end;
$$;

revoke all on function
  public.protect_session_foundation_history()
from public, anon, authenticated;

create trigger
  class_sessions_protect_history
before update on public.class_sessions
for each row execute function
  public.protect_session_foundation_history();

create trigger
  session_attendance_protect_history
before update on public.session_attendance
for each row execute function
  public.protect_session_foundation_history();

create trigger
  session_results_protect_history
before update on public.session_results
for each row execute function
  public.protect_session_foundation_history();


-- =========================================================
-- PREVENT PHYSICAL DELETE
--
-- Session, attendance and result history is retained.
-- Corrections must use approved update workflows.
-- =========================================================

create or replace function
  public.prevent_session_foundation_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message =
      'SESSION_FOUNDATION_DELETE_NOT_ALLOWED';
end;
$$;

revoke all on function
  public.prevent_session_foundation_delete()
from public, anon, authenticated;

create trigger class_sessions_prevent_delete
before delete on public.class_sessions
for each row execute function
  public.prevent_session_foundation_delete();

create trigger session_attendance_prevent_delete
before delete on public.session_attendance
for each row execute function
  public.prevent_session_foundation_delete();

create trigger session_results_prevent_delete
before delete on public.session_results
for each row execute function
  public.prevent_session_foundation_delete();


-- =========================================================
-- AUDIT
--
-- Uses the existing append-only audit_logs table.
-- RPC workflows may set app.workflow_reason.
-- =========================================================

create or replace function
  public.audit_session_foundation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  workflow_reason text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting(
        'app.workflow_reason',
        true
      )
    ),
    ''
  );

  audit_module text;
  audit_action text;
  audit_entity_type text;
  audit_entity_id text;
  audit_reason text;
  audit_old_data jsonb;
  audit_new_data jsonb;
  audit_metadata jsonb;
begin
  if tg_op = 'INSERT' then
    audit_old_data := null;
    audit_new_data :=
      pg_catalog.to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    audit_old_data :=
      pg_catalog.to_jsonb(old);
    audit_new_data :=
      pg_catalog.to_jsonb(new);
  else
    return old;
  end if;

  if tg_table_name = 'class_sessions' then
    audit_module := 'sessions';
    audit_entity_type := 'class_session';
    audit_entity_id := new.id::text;

    if tg_op = 'INSERT' then
      audit_action :=
        'class_session_created';

    elsif old.status is distinct
      from new.status
    then
      audit_action := case new.status
        when 'in_progress'
          then 'class_session_started'
        when 'completed'
          then 'class_session_completed'
        when 'cancelled'
          then 'class_session_cancelled'
        else 'class_session_status_changed'
      end;

      audit_reason := case
        when new.status = 'cancelled'
          then new.cancellation_reason
        else workflow_reason
      end;

    elsif old.locked_at is null
      and new.locked_at is not null
    then
      audit_action :=
        'class_session_locked';
      audit_reason := new.lock_reason;

    else
      audit_action :=
        'class_session_updated';
      audit_reason := workflow_reason;
    end if;

    audit_metadata :=
      pg_catalog.jsonb_build_object(
        'source',
        case
          when actor_id is null
            then 'database'
          else 'authenticated_user'
        end,
        'class_id',
        new.class_id,
        'session_date',
        new.session_date
      );

  elsif tg_table_name = 'session_attendance' then
    audit_module := 'attendance';
    audit_entity_type :=
      'session_attendance';
    audit_entity_id := new.id::text;

    audit_action := case
      when tg_op = 'INSERT'
        then 'session_attendance_marked'
      else 'session_attendance_updated'
    end;

    audit_reason := workflow_reason;

    audit_metadata :=
      pg_catalog.jsonb_build_object(
        'source',
        case
          when actor_id is null
            then 'database'
          else 'authenticated_user'
        end,
        'class_session_id',
        new.class_session_id,
        'student_id',
        new.student_id
      );

  elsif tg_table_name = 'session_results' then
    audit_module := 'results';
    audit_entity_type :=
      'session_result';
    audit_entity_id := new.id::text;

    audit_action := case
      when tg_op = 'INSERT'
        then 'session_result_recorded'
      else 'session_result_updated'
    end;

    audit_reason := workflow_reason;

    audit_metadata :=
      pg_catalog.jsonb_build_object(
        'source',
        case
          when actor_id is null
            then 'database'
          else 'authenticated_user'
        end,
        'class_session_id',
        new.class_session_id,
        'student_id',
        new.student_id
      );

  else
    raise exception using
      errcode = '22023',
      message =
        'UNSUPPORTED_SESSION_AUDIT_TABLE';
  end if;

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
    audit_module,
    audit_action,
    audit_entity_type,
    audit_entity_id,
    audit_old_data,
    audit_new_data,
    audit_reason,
    audit_metadata
  );

  return new;
end;
$$;

revoke all on function
  public.audit_session_foundation_change()
from public, anon, authenticated;

create trigger class_sessions_audit_changes
after insert or update on public.class_sessions
for each row execute function
  public.audit_session_foundation_change();

create trigger session_attendance_audit_changes
after insert or update on public.session_attendance
for each row execute function
  public.audit_session_foundation_change();

create trigger session_results_audit_changes
after insert or update on public.session_results
for each row execute function
  public.audit_session_foundation_change();


-- =========================================================
-- ROW LEVEL SECURITY
--
-- Authenticated browser clients may only read data when the
-- current user has the corresponding database permission.
-- No INSERT, UPDATE or DELETE policy is created.
-- =========================================================

alter table public.class_sessions
enable row level security;

alter table public.session_attendance
enable row level security;

alter table public.session_results
enable row level security;


create policy class_sessions_select_authorized
on public.class_sessions
for select
to authenticated
using (
  public.has_permission('sessions.view')
);


create policy session_attendance_select_authorized
on public.session_attendance
for select
to authenticated
using (
  public.has_permission('attendance.view')
);


create policy session_results_select_authorized
on public.session_results
for select
to authenticated
using (
  public.has_permission('results.view')
);


-- =========================================================
-- TABLE PRIVILEGES
--
-- Browser clients receive SELECT only.
-- All writes must go through approved SECURITY DEFINER RPCs
-- added in later workflow migrations.
-- =========================================================

revoke all privileges on table
  public.class_sessions,
  public.session_attendance,
  public.session_results
from public, anon, authenticated;

grant select on table
  public.class_sessions,
  public.session_attendance,
  public.session_results
to authenticated;


commit;
