begin;

-- =========================================================
-- TASK 5.0.3A
-- Academic year and class write workflows.
--
-- Browser remains read-only.
-- All writes are performed through SECURITY DEFINER RPCs.
-- =========================================================


-- =========================================================
-- CREATE ACADEMIC YEAR
-- Permission: classes.create
-- New academic years always begin as draft and non-current.
-- =========================================================

create or replace function public.create_academic_year(
  p_code text,
  p_name text,
  p_starts_on date,
  p_ends_on date
)
returns public.academic_years
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_code text;
  normalized_name text;
  result_year public.academic_years%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('classes.create') then
    raise exception using
      errcode = '42501',
      message = 'CLASS_CREATE_PERMISSION_DENIED';
  end if;

  normalized_code := pg_catalog.btrim(p_code);
  normalized_name := pg_catalog.btrim(p_name);

  if normalized_code is null
    or normalized_code = ''
  then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_CODE_REQUIRED';
  end if;

  if normalized_code !~ '^[0-9]{4}-[0-9]{4}$' then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_CODE_INVALID';
  end if;

  if normalized_name is null
    or normalized_name = ''
  then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_NAME_REQUIRED';
  end if;

  if p_starts_on is null then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_START_DATE_REQUIRED';
  end if;

  if p_ends_on is null then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_END_DATE_REQUIRED';
  end if;

  if p_ends_on < p_starts_on then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_DATE_RANGE_INVALID';
  end if;

  if exists (
    select 1
    from public.academic_years as academic_year
    where academic_year.code = normalized_code
  ) then
    raise exception using
      errcode = '23505',
      message = 'ACADEMIC_YEAR_CODE_ALREADY_EXISTS';
  end if;

  insert into public.academic_years (
    code,
    name,
    starts_on,
    ends_on,
    status,
    is_current,
    created_by
  )
  values (
    normalized_code,
    normalized_name,
    p_starts_on,
    p_ends_on,
    'draft',
    false,
    actor_id
  )
  returning *
  into result_year;

  return result_year;
end;
$$;

revoke all on function public.create_academic_year(
  text,
  text,
  date,
  date
)
from public, anon, authenticated;

grant execute on function public.create_academic_year(
  text,
  text,
  date,
  date
)
to authenticated;


-- =========================================================
-- ACTIVATE ACADEMIC YEAR
-- Permission: classes.create
--
-- Activating a year also makes it the only current year.
-- Draft -> active is allowed.
-- An active non-current year may be made current again.
-- Closed and archived years cannot be reactivated.
-- =========================================================

create or replace function public.activate_academic_year(
  p_academic_year_id uuid,
  p_reason text
)
returns public.academic_years
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text;
  target_year public.academic_years%rowtype;
  result_year public.academic_years%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('classes.create') then
    raise exception using
      errcode = '42501',
      message = 'CLASS_CREATE_PERMISSION_DENIED';
  end if;

  if p_academic_year_id is null then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_ID_REQUIRED';
  end if;

  normalized_reason := pg_catalog.btrim(p_reason);

  if normalized_reason is null
    or normalized_reason = ''
  then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_ACTIVATION_REASON_REQUIRED';
  end if;

  lock table public.academic_years
  in share row exclusive mode;

  select academic_year.*
  into target_year
  from public.academic_years as academic_year
  where academic_year.id = p_academic_year_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if target_year.status not in (
    'draft',
    'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'ACADEMIC_YEAR_CANNOT_BE_ACTIVATED';
  end if;

  if target_year.status = 'active'
    and target_year.is_current
  then
    return target_year;
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.academic_years
  set
    is_current = false,
    updated_at = pg_catalog.now()
  where is_current
    and id <> target_year.id;

  update public.academic_years
  set
    status = 'active',
    is_current = true,
    updated_at = pg_catalog.now()
  where id = target_year.id
  returning *
  into result_year;

  return result_year;
end;
$$;

revoke all on function public.activate_academic_year(
  uuid,
  text
)
from public, anon, authenticated;

grant execute on function public.activate_academic_year(
  uuid,
  text
)
to authenticated;


-- =========================================================
-- CHANGE ACADEMIC YEAR STATUS
-- Permission: classes.create
--
-- Supported target statuses:
--   closed
--   archived
--
-- An academic year cannot be closed while it still contains
-- draft or active classes.
--
-- An academic year cannot be archived until every class in
-- that year has also been archived.
-- =========================================================

create or replace function public.change_academic_year_status(
  p_academic_year_id uuid,
  p_target_status text,
  p_reason text
)
returns public.academic_years
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_status text;
  normalized_reason text;
  target_year public.academic_years%rowtype;
  result_year public.academic_years%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('classes.create') then
    raise exception using
      errcode = '42501',
      message = 'CLASS_CREATE_PERMISSION_DENIED';
  end if;

  if p_academic_year_id is null then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_ID_REQUIRED';
  end if;

  normalized_status := pg_catalog.lower(
    pg_catalog.btrim(p_target_status)
  );

  normalized_reason := pg_catalog.btrim(p_reason);

  if normalized_status not in (
    'closed',
    'archived'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_TARGET_STATUS_INVALID';
  end if;

  if normalized_reason is null
    or normalized_reason = ''
  then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_STATUS_REASON_REQUIRED';
  end if;

  select academic_year.*
  into target_year
  from public.academic_years as academic_year
  where academic_year.id = p_academic_year_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if target_year.status = normalized_status
    and not target_year.is_current
  then
    return target_year;
  end if;

  if target_year.status = 'archived' then
    raise exception using
      errcode = '23514',
      message = 'ARCHIVED_ACADEMIC_YEAR_IS_IMMUTABLE';
  end if;

  if normalized_status = 'closed' then
    if target_year.status not in (
      'draft',
      'active',
      'closed'
    ) then
      raise exception using
        errcode = '23514',
        message = 'ACADEMIC_YEAR_CLOSE_TRANSITION_INVALID';
    end if;

    if exists (
      select 1
      from public.classes as class_row
      where
        class_row.academic_year_id =
          target_year.id
        and class_row.status in (
          'draft',
          'active'
        )
    ) then
      raise exception using
        errcode = '23514',
        message = 'ACADEMIC_YEAR_HAS_OPEN_CLASSES';
    end if;
  end if;

  if normalized_status = 'archived' then
    if target_year.status not in (
      'draft',
      'closed',
      'archived'
    ) then
      raise exception using
        errcode = '23514',
        message = 'ACADEMIC_YEAR_ARCHIVE_TRANSITION_INVALID';
    end if;

    if exists (
      select 1
      from public.classes as class_row
      where
        class_row.academic_year_id =
          target_year.id
        and class_row.status <> 'archived'
    ) then
      raise exception using
        errcode = '23514',
        message = 'ACADEMIC_YEAR_HAS_NON_ARCHIVED_CLASSES';
    end if;
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.academic_years
  set
    status = normalized_status,
    is_current = false,
    updated_at = pg_catalog.now()
  where id = target_year.id
  returning *
  into result_year;

  return result_year;
end;
$$;

revoke all on function public.change_academic_year_status(
  uuid,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.change_academic_year_status(
  uuid,
  text,
  text
)
to authenticated;


-- =========================================================
-- CREATE CLASS
-- Permission: classes.create
--
-- New classes always begin in draft status.
-- Classes may be created in a draft or active academic year.
-- =========================================================

create or replace function public.create_class(
  p_academic_year_id uuid,
  p_code text,
  p_name text,
  p_grade smallint,
  p_level text,
  p_weekly_session_count smallint,
  p_default_learning_mode text,
  p_classin_url text,
  p_notes text
)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_code text;
  normalized_name text;
  normalized_level text;
  normalized_mode text;
  normalized_classin_url text;
  normalized_notes text;
  target_year public.academic_years%rowtype;
  result_class public.classes%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('classes.create') then
    raise exception using
      errcode = '42501',
      message = 'CLASS_CREATE_PERMISSION_DENIED';
  end if;

  if p_academic_year_id is null then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_ID_REQUIRED';
  end if;

  normalized_code := pg_catalog.upper(
    pg_catalog.btrim(p_code)
  );

  normalized_name := pg_catalog.btrim(p_name);

  normalized_level := pg_catalog.upper(
    pg_catalog.btrim(p_level)
  );

  normalized_mode := pg_catalog.lower(
    pg_catalog.btrim(p_default_learning_mode)
  );

  normalized_classin_url := nullif(
    pg_catalog.btrim(p_classin_url),
    ''
  );

  normalized_notes := nullif(
    pg_catalog.btrim(p_notes),
    ''
  );

  if normalized_code is null
    or normalized_code = ''
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_CODE_REQUIRED';
  end if;

  if normalized_code !~ '^[A-Z0-9._-]+$' then
    raise exception using
      errcode = '22023',
      message = 'CLASS_CODE_INVALID';
  end if;

  if normalized_name is null
    or normalized_name = ''
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_NAME_REQUIRED';
  end if;

  if p_grade is null
    or p_grade < 1
    or p_grade > 12
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_GRADE_INVALID';
  end if;

  if normalized_level not in (
    'A',
    'B',
    'CLC'
  ) then
    raise exception using
      errcode = '22023',
      message = 'CLASS_LEVEL_INVALID';
  end if;

  if p_weekly_session_count is null
    or p_weekly_session_count < 1
    or p_weekly_session_count > 7
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_WEEKLY_SESSION_COUNT_INVALID';
  end if;

  if normalized_mode not in (
    'online',
    'offline',
    'hybrid'
  ) then
    raise exception using
      errcode = '22023',
      message = 'CLASS_DEFAULT_LEARNING_MODE_INVALID';
  end if;

  select academic_year.*
  into target_year
  from public.academic_years as academic_year
  where academic_year.id = p_academic_year_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if target_year.status not in (
    'draft',
    'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'CLASS_ACADEMIC_YEAR_MUST_BE_OPEN';
  end if;

  if exists (
    select 1
    from public.classes as class_row
    where
      class_row.academic_year_id =
        target_year.id
      and class_row.code = normalized_code
  ) then
    raise exception using
      errcode = '23505',
      message = 'CLASS_CODE_ALREADY_EXISTS_IN_ACADEMIC_YEAR';
  end if;

  insert into public.classes (
    academic_year_id,
    code,
    name,
    grade,
    level,
    weekly_session_count,
    default_learning_mode,
    classin_url,
    status,
    notes,
    created_by
  )
  values (
    target_year.id,
    normalized_code,
    normalized_name,
    p_grade,
    normalized_level,
    p_weekly_session_count,
    normalized_mode,
    normalized_classin_url,
    'draft',
    normalized_notes,
    actor_id
  )
  returning *
  into result_class;

  return result_class;
end;
$$;

revoke all on function public.create_class(
  uuid,
  text,
  text,
  smallint,
  text,
  smallint,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.create_class(
  uuid,
  text,
  text,
  smallint,
  text,
  smallint,
  text,
  text,
  text
)
to authenticated;


-- =========================================================
-- UPDATE CLASS
-- Permission: classes.create
--
-- Draft and active classes may be edited.
--
-- Academic year, code, grade and level become immutable once
-- a schedule or enrollment has used the class.
-- =========================================================

create or replace function public.update_class(
  p_class_id uuid,
  p_academic_year_id uuid,
  p_code text,
  p_name text,
  p_grade smallint,
  p_level text,
  p_weekly_session_count smallint,
  p_default_learning_mode text,
  p_classin_url text,
  p_notes text,
  p_reason text
)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_code text;
  normalized_name text;
  normalized_level text;
  normalized_mode text;
  normalized_classin_url text;
  normalized_notes text;
  normalized_reason text;
  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;
  result_class public.classes%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('classes.create') then
    raise exception using
      errcode = '42501',
      message = 'CLASS_CREATE_PERMISSION_DENIED';
  end if;

  if p_class_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_ID_REQUIRED';
  end if;

  if p_academic_year_id is null then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_ID_REQUIRED';
  end if;

  normalized_code := pg_catalog.upper(
    pg_catalog.btrim(p_code)
  );

  normalized_name := pg_catalog.btrim(p_name);

  normalized_level := pg_catalog.upper(
    pg_catalog.btrim(p_level)
  );

  normalized_mode := pg_catalog.lower(
    pg_catalog.btrim(p_default_learning_mode)
  );

  normalized_classin_url := nullif(
    pg_catalog.btrim(p_classin_url),
    ''
  );

  normalized_notes := nullif(
    pg_catalog.btrim(p_notes),
    ''
  );

  normalized_reason := pg_catalog.btrim(p_reason);

  if normalized_code is null
    or normalized_code = ''
    or normalized_code !~ '^[A-Z0-9._-]+$'
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_CODE_INVALID';
  end if;

  if normalized_name is null
    or normalized_name = ''
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_NAME_REQUIRED';
  end if;

  if p_grade is null
    or p_grade < 1
    or p_grade > 12
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_GRADE_INVALID';
  end if;

  if normalized_level not in (
    'A',
    'B',
    'CLC'
  ) then
    raise exception using
      errcode = '22023',
      message = 'CLASS_LEVEL_INVALID';
  end if;

  if p_weekly_session_count is null
    or p_weekly_session_count < 1
    or p_weekly_session_count > 7
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_WEEKLY_SESSION_COUNT_INVALID';
  end if;

  if normalized_mode not in (
    'online',
    'offline',
    'hybrid'
  ) then
    raise exception using
      errcode = '22023',
      message = 'CLASS_DEFAULT_LEARNING_MODE_INVALID';
  end if;

  if normalized_reason is null
    or normalized_reason = ''
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_UPDATE_REASON_REQUIRED';
  end if;

  select class_row.*
  into target_class
  from public.classes as class_row
  where class_row.id = p_class_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_NOT_FOUND';
  end if;

  if target_class.status not in (
    'draft',
    'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'CLOSED_OR_ARCHIVED_CLASS_CANNOT_BE_EDITED';
  end if;

  select academic_year.*
  into target_year
  from public.academic_years as academic_year
  where academic_year.id = p_academic_year_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if target_year.status not in (
    'draft',
    'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'CLASS_ACADEMIC_YEAR_MUST_BE_OPEN';
  end if;

  if target_class.status = 'active'
    and target_year.status <> 'active'
  then
    raise exception using
      errcode = '23514',
      message = 'ACTIVE_CLASS_REQUIRES_ACTIVE_ACADEMIC_YEAR';
  end if;

  if (
    target_class.academic_year_id
      is distinct from target_year.id
    or target_class.code
      is distinct from normalized_code
    or target_class.grade
      is distinct from p_grade
    or target_class.level
      is distinct from normalized_level
  )
  and (
    exists (
      select 1
      from public.class_schedule_templates
        as schedule
      where schedule.class_id = target_class.id
    )
    or exists (
      select 1
      from public.student_enrollments
        as enrollment
      where enrollment.class_id = target_class.id
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'CLASS_IDENTITY_IMMUTABLE_AFTER_USE';
  end if;

  if exists (
    select 1
    from public.classes as class_row
    where
      class_row.academic_year_id =
        target_year.id
      and class_row.code = normalized_code
      and class_row.id <> target_class.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'CLASS_CODE_ALREADY_EXISTS_IN_ACADEMIC_YEAR';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.classes
  set
    academic_year_id = target_year.id,
    code = normalized_code,
    name = normalized_name,
    grade = p_grade,
    level = normalized_level,
    weekly_session_count =
      p_weekly_session_count,
    default_learning_mode =
      normalized_mode,
    classin_url = normalized_classin_url,
    notes = normalized_notes,
    updated_at = pg_catalog.now()
  where id = target_class.id
  returning *
  into result_class;

  return result_class;
end;
$$;

revoke all on function public.update_class(
  uuid,
  uuid,
  text,
  text,
  smallint,
  text,
  smallint,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.update_class(
  uuid,
  uuid,
  text,
  text,
  smallint,
  text,
  smallint,
  text,
  text,
  text,
  text
)
to authenticated;


-- =========================================================
-- CHANGE CLASS STATUS
-- Permission: classes.create
--
-- Allowed transitions:
--   draft  -> active
--   active -> closed
--   draft  -> archived
--   closed -> archived
--
-- Closing or archiving requires no active schedules and no
-- active student enrollments.
-- =========================================================

create or replace function public.change_class_status(
  p_class_id uuid,
  p_target_status text,
  p_reason text
)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_status text;
  normalized_reason text;
  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;
  result_class public.classes%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('classes.create') then
    raise exception using
      errcode = '42501',
      message = 'CLASS_CREATE_PERMISSION_DENIED';
  end if;

  if p_class_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_ID_REQUIRED';
  end if;

  normalized_status := pg_catalog.lower(
    pg_catalog.btrim(p_target_status)
  );

  normalized_reason := pg_catalog.btrim(p_reason);

  if normalized_status not in (
    'active',
    'closed',
    'archived'
  ) then
    raise exception using
      errcode = '22023',
      message = 'CLASS_TARGET_STATUS_INVALID';
  end if;

  if normalized_reason is null
    or normalized_reason = ''
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_STATUS_REASON_REQUIRED';
  end if;

  select class_row.*
  into target_class
  from public.classes as class_row
  where class_row.id = p_class_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_NOT_FOUND';
  end if;

  if target_class.status = normalized_status then
    return target_class;
  end if;

  if target_class.status = 'archived' then
    raise exception using
      errcode = '23514',
      message = 'ARCHIVED_CLASS_IS_IMMUTABLE';
  end if;

  select academic_year.*
  into target_year
  from public.academic_years as academic_year
  where
    academic_year.id =
      target_class.academic_year_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if normalized_status = 'active' then
    if target_class.status <> 'draft' then
      raise exception using
        errcode = '23514',
        message = 'CLASS_ACTIVATION_TRANSITION_INVALID';
    end if;

    if target_year.status <> 'active' then
      raise exception using
        errcode = '23514',
        message = 'ACTIVE_CLASS_REQUIRES_ACTIVE_ACADEMIC_YEAR';
    end if;
  end if;

  if normalized_status = 'closed' then
    if target_class.status <> 'active' then
      raise exception using
        errcode = '23514',
        message = 'CLASS_CLOSE_TRANSITION_INVALID';
    end if;

    if exists (
      select 1
      from public.class_schedule_templates
        as schedule
      where
        schedule.class_id =
          target_class.id
        and schedule.is_active
    ) then
      raise exception using
        errcode = '23514',
        message = 'CLASS_HAS_ACTIVE_SCHEDULES';
    end if;

    if exists (
      select 1
      from public.student_enrollments
        as enrollment
      where
        enrollment.class_id =
          target_class.id
        and enrollment.status = 'active'
        and enrollment.effective_to is null
    ) then
      raise exception using
        errcode = '23514',
        message = 'CLASS_HAS_ACTIVE_STUDENT_ENROLLMENTS';
    end if;
  end if;

  if normalized_status = 'archived' then
    if target_class.status not in (
      'draft',
      'closed'
    ) then
      raise exception using
        errcode = '23514',
        message = 'CLASS_ARCHIVE_TRANSITION_INVALID';
    end if;

    if exists (
      select 1
      from public.class_schedule_templates
        as schedule
      where
        schedule.class_id =
          target_class.id
        and schedule.is_active
    ) then
      raise exception using
        errcode = '23514',
        message = 'CLASS_HAS_ACTIVE_SCHEDULES';
    end if;

    if exists (
      select 1
      from public.student_enrollments
        as enrollment
      where
        enrollment.class_id =
          target_class.id
        and enrollment.status = 'active'
        and enrollment.effective_to is null
    ) then
      raise exception using
        errcode = '23514',
        message = 'CLASS_HAS_ACTIVE_STUDENT_ENROLLMENTS';
    end if;
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.classes
  set
    status = normalized_status,
    updated_at = pg_catalog.now()
  where id = target_class.id
  returning *
  into result_class;

  return result_class;
end;
$$;

revoke all on function public.change_class_status(
  uuid,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.change_class_status(
  uuid,
  text,
  text
)
to authenticated;


-- =========================================================
-- AUDIT WORKFLOW REASONS
--
-- The existing audit trigger already captures every INSERT
-- and UPDATE. This replacement additionally stores the
-- workflow reason supplied by RPCs.
--
-- INSERT actions intentionally keep reason null so a reason
-- from another RPC in the same SQL transaction cannot leak
-- into a create audit row.
-- =========================================================

create or replace function public.audit_class_foundation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  workflow_reason text := nullif(
    pg_catalog.current_setting(
      'app.workflow_reason',
      true
    ),
    ''
  );
  audit_action text;
  audit_entity_type text;
  audit_entity_id text;
  audit_old_data jsonb;
  audit_new_data jsonb;
begin
  if tg_op = 'INSERT' then
    audit_old_data := null;
    audit_new_data := pg_catalog.to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    audit_old_data := pg_catalog.to_jsonb(old);
    audit_new_data := pg_catalog.to_jsonb(new);
  else
    return old;
  end if;

  if tg_table_name = 'academic_years' then
    audit_entity_type := 'academic_year';
    audit_entity_id :=
      audit_new_data ->> 'id';

    audit_action := case
      when tg_op = 'INSERT'
        then 'academic_year_created'
      else 'academic_year_updated'
    end;

  elsif tg_table_name = 'classes' then
    audit_entity_type := 'class';
    audit_entity_id :=
      audit_new_data ->> 'id';

    audit_action := case
      when tg_op = 'INSERT'
        then 'class_created'
      else 'class_updated'
    end;

  elsif tg_table_name =
    'class_schedule_templates'
  then
    audit_entity_type :=
      'class_schedule_template';

    audit_entity_id :=
      audit_new_data ->> 'id';

    if tg_op = 'INSERT' then
      audit_action :=
        'class_schedule_created';
    elsif old.is_active
      and not new.is_active
    then
      audit_action :=
        'class_schedule_ended';
    else
      audit_action :=
        'class_schedule_updated';
    end if;

  else
    raise exception using
      errcode = '22023',
      message =
        'UNSUPPORTED_CLASS_AUDIT_TABLE';
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
    'classes',
    audit_action,
    audit_entity_type,
    audit_entity_id,
    audit_old_data,
    audit_new_data,
    case
      when tg_op = 'INSERT'
        then null
      when audit_action =
        'class_schedule_ended'
        then audit_new_data ->> 'end_reason'
      else workflow_reason
    end,
    pg_catalog.jsonb_build_object(
      'source',
      case
        when actor_id is null
          then 'database'
        else 'authenticated_user'
      end
    )
  );

  return new;
end;
$$;


-- Browser continues to have read-only table access.
-- No INSERT, UPDATE, DELETE or ALL table grant is added.

commit;
