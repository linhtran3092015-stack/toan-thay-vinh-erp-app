begin;

-- =========================================================
-- INITIAL ENROLLMENT
-- Permission: students.manage_status
-- =========================================================

create or replace function public.enroll_student_in_class(
  p_student_id uuid,
  p_class_id uuid,
  p_registered_mode text,
  p_effective_from date,
  p_reason text
)
returns public.student_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  locked_student_id uuid;
  normalized_reason text;
  result_enrollment public.student_enrollments%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('students.manage_status') then
    raise exception using
      errcode = '42501',
      message = 'STUDENT_ENROLLMENT_PERMISSION_DENIED';
  end if;

  if p_student_id is null then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ID_REQUIRED';
  end if;

  if p_class_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_ID_REQUIRED';
  end if;

  if p_registered_mode is null
    or p_registered_mode not in ('online', 'offline')
  then
    raise exception using
      errcode = '22023',
      message = 'REGISTERED_MODE_INVALID';
  end if;

  if p_effective_from is null then
    raise exception using
      errcode = '22023',
      message = 'ENROLLMENT_EFFECTIVE_DATE_REQUIRED';
  end if;

  normalized_reason := pg_catalog.btrim(p_reason);

  if normalized_reason is null or normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'ENROLLMENT_REASON_REQUIRED';
  end if;

  select student.id
  into locked_student_id
  from public.students as student
  where student.id = p_student_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STUDENT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.student_enrollments as enrollment
    where enrollment.student_id = p_student_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'STUDENT_ENROLLMENT_HISTORY_ALREADY_EXISTS';
  end if;

  insert into public.student_enrollments (
    student_id,
    class_id,
    registered_mode,
    transition_kind,
    status,
    effective_from,
    effective_to,
    supersedes_enrollment_id,
    start_reason,
    started_by,
    ended_by,
    end_reason
  )
  values (
    p_student_id,
    p_class_id,
    p_registered_mode,
    'initial',
    'active',
    p_effective_from,
    null,
    null,
    normalized_reason,
    actor_id,
    null,
    null
  )
  returning *
  into result_enrollment;

  update public.students
  set
    lifecycle_status = 'active',
    registered_mode = p_registered_mode,
    official_start_date = coalesce(
      official_start_date,
      p_effective_from
    )
  where id = p_student_id;

  return result_enrollment;
end;
$$;

revoke all on function public.enroll_student_in_class(
  uuid,
  uuid,
  text,
  date,
  text
)
from public, anon, authenticated;

grant execute on function public.enroll_student_in_class(
  uuid,
  uuid,
  text,
  date,
  text
)
to authenticated;


-- =========================================================
-- TRANSFER CLASS
-- Permission: students.transfer_class
--
-- p_effective_from is the first day in the new class.
-- The old enrollment therefore ends one day earlier.
-- =========================================================

create or replace function public.transfer_student_class(
  p_student_id uuid,
  p_target_class_id uuid,
  p_registered_mode text,
  p_effective_from date,
  p_reason text
)
returns public.student_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date :=
    pg_catalog.timezone(
      'Asia/Ho_Chi_Minh',
      pg_catalog.now()
    )::date;
  locked_student_id uuid;
  normalized_reason text;
  active_enrollment public.student_enrollments%rowtype;
  result_enrollment public.student_enrollments%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('students.transfer_class') then
    raise exception using
      errcode = '42501',
      message = 'STUDENT_TRANSFER_PERMISSION_DENIED';
  end if;

  if p_student_id is null then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ID_REQUIRED';
  end if;

  if p_target_class_id is null then
    raise exception using
      errcode = '22023',
      message = 'TARGET_CLASS_ID_REQUIRED';
  end if;

  if p_registered_mode is null
    or p_registered_mode not in ('online', 'offline')
  then
    raise exception using
      errcode = '22023',
      message = 'REGISTERED_MODE_INVALID';
  end if;

  if p_effective_from is null then
    raise exception using
      errcode = '22023',
      message = 'TRANSFER_EFFECTIVE_DATE_REQUIRED';
  end if;

  if p_effective_from <> business_date then
    raise exception using
      errcode = '23514',
      message = 'TRANSFER_MUST_TAKE_EFFECT_TODAY';
  end if;

  normalized_reason := pg_catalog.btrim(p_reason);

  if normalized_reason is null or normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'TRANSFER_REASON_REQUIRED';
  end if;

  select student.id
  into locked_student_id
  from public.students as student
  where student.id = p_student_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STUDENT_NOT_FOUND';
  end if;

  select enrollment.*
  into active_enrollment
  from public.student_enrollments as enrollment
  where enrollment.student_id = p_student_id
    and enrollment.status = 'active'
    and enrollment.effective_to is null
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACTIVE_STUDENT_ENROLLMENT_NOT_FOUND';
  end if;

  if active_enrollment.class_id = p_target_class_id then
    raise exception using
      errcode = '23514',
      message = 'TRANSFER_TARGET_CLASS_MUST_DIFFER';
  end if;

  if p_effective_from <= active_enrollment.effective_from then
    raise exception using
      errcode = '23514',
      message = 'TRANSFER_EFFECTIVE_DATE_INVALID';
  end if;

  update public.student_enrollments
  set
    status = 'transferred',
    effective_to = p_effective_from - 1,
    ended_by = actor_id,
    end_reason = normalized_reason
  where id = active_enrollment.id;

  insert into public.student_enrollments (
    student_id,
    class_id,
    registered_mode,
    transition_kind,
    status,
    effective_from,
    effective_to,
    supersedes_enrollment_id,
    start_reason,
    started_by,
    ended_by,
    end_reason
  )
  values (
    p_student_id,
    p_target_class_id,
    p_registered_mode,
    'transfer',
    'active',
    p_effective_from,
    null,
    active_enrollment.id,
    normalized_reason,
    actor_id,
    null,
    null
  )
  returning *
  into result_enrollment;

  update public.students
  set
    lifecycle_status = 'active',
    registered_mode = p_registered_mode
  where id = p_student_id;

  return result_enrollment;
end;
$$;

revoke all on function public.transfer_student_class(
  uuid,
  uuid,
  text,
  date,
  text
)
from public, anon, authenticated;

grant execute on function public.transfer_student_class(
  uuid,
  uuid,
  text,
  date,
  text
)
to authenticated;


-- =========================================================
-- RESERVE STUDENT
-- Permission: students.reserve
--
-- p_reserved_from is the first day the student is reserved.
-- The active enrollment ends one day earlier.
-- =========================================================

create or replace function public.reserve_student_enrollment(
  p_student_id uuid,
  p_reserved_from date,
  p_reason text
)
returns public.student_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date :=
    pg_catalog.timezone(
      'Asia/Ho_Chi_Minh',
      pg_catalog.now()
    )::date;
  locked_student_id uuid;
  normalized_reason text;
  active_enrollment public.student_enrollments%rowtype;
  result_enrollment public.student_enrollments%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('students.reserve') then
    raise exception using
      errcode = '42501',
      message = 'STUDENT_RESERVE_PERMISSION_DENIED';
  end if;

  if p_student_id is null then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ID_REQUIRED';
  end if;

  if p_reserved_from is null then
    raise exception using
      errcode = '22023',
      message = 'RESERVATION_EFFECTIVE_DATE_REQUIRED';
  end if;

  if p_reserved_from <> business_date then
    raise exception using
      errcode = '23514',
      message = 'RESERVATION_MUST_TAKE_EFFECT_TODAY';
  end if;

  normalized_reason := pg_catalog.btrim(p_reason);

  if normalized_reason is null or normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'RESERVATION_REASON_REQUIRED';
  end if;

  select student.id
  into locked_student_id
  from public.students as student
  where student.id = p_student_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STUDENT_NOT_FOUND';
  end if;

  select enrollment.*
  into active_enrollment
  from public.student_enrollments as enrollment
  where enrollment.student_id = p_student_id
    and enrollment.status = 'active'
    and enrollment.effective_to is null
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACTIVE_STUDENT_ENROLLMENT_NOT_FOUND';
  end if;

  if p_reserved_from <= active_enrollment.effective_from then
    raise exception using
      errcode = '23514',
      message = 'RESERVATION_EFFECTIVE_DATE_INVALID';
  end if;

  update public.student_enrollments
  set
    status = 'reserved',
    effective_to = p_reserved_from - 1,
    ended_by = actor_id,
    end_reason = normalized_reason
  where id = active_enrollment.id
  returning *
  into result_enrollment;

  update public.students
  set lifecycle_status = 'reserved'
  where id = p_student_id;

  return result_enrollment;
end;
$$;

revoke all on function public.reserve_student_enrollment(
  uuid,
  date,
  text
)
from public, anon, authenticated;

grant execute on function public.reserve_student_enrollment(
  uuid,
  date,
  text
)
to authenticated;


-- =========================================================
-- RESUME STUDENT
-- Permission: students.reserve
--
-- Resume may return the student to the old class or place the
-- student into another active class.
-- =========================================================

create or replace function public.resume_student_enrollment(
  p_student_id uuid,
  p_target_class_id uuid,
  p_registered_mode text,
  p_effective_from date,
  p_reason text
)
returns public.student_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  locked_student_id uuid;
  normalized_reason text;
  previous_enrollment public.student_enrollments%rowtype;
  result_enrollment public.student_enrollments%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('students.reserve') then
    raise exception using
      errcode = '42501',
      message = 'STUDENT_RESUME_PERMISSION_DENIED';
  end if;

  if p_student_id is null then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ID_REQUIRED';
  end if;

  if p_target_class_id is null then
    raise exception using
      errcode = '22023',
      message = 'TARGET_CLASS_ID_REQUIRED';
  end if;

  if p_registered_mode is null
    or p_registered_mode not in ('online', 'offline')
  then
    raise exception using
      errcode = '22023',
      message = 'REGISTERED_MODE_INVALID';
  end if;

  if p_effective_from is null then
    raise exception using
      errcode = '22023',
      message = 'RESUME_EFFECTIVE_DATE_REQUIRED';
  end if;

  normalized_reason := pg_catalog.btrim(p_reason);

  if normalized_reason is null or normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'RESUME_REASON_REQUIRED';
  end if;

  select student.id
  into locked_student_id
  from public.students as student
  where student.id = p_student_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STUDENT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.student_enrollments as enrollment
    where enrollment.student_id = p_student_id
      and enrollment.status = 'active'
      and enrollment.effective_to is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'STUDENT_ALREADY_HAS_ACTIVE_ENROLLMENT';
  end if;

  select enrollment.*
  into previous_enrollment
  from public.student_enrollments as enrollment
  where enrollment.student_id = p_student_id
  order by
    enrollment.effective_from desc,
    enrollment.created_at desc
  limit 1
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STUDENT_ENROLLMENT_HISTORY_NOT_FOUND';
  end if;

  if previous_enrollment.status <> 'reserved'
    or previous_enrollment.effective_to is null
  then
    raise exception using
      errcode = '23514',
      message = 'LATEST_STUDENT_ENROLLMENT_IS_NOT_RESERVED';
  end if;

  if exists (
    select 1
    from public.student_enrollments as successor
    where successor.supersedes_enrollment_id = previous_enrollment.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'RESERVED_ENROLLMENT_ALREADY_HAS_SUCCESSOR';
  end if;

  if p_effective_from <= previous_enrollment.effective_to then
    raise exception using
      errcode = '23514',
      message = 'RESUME_EFFECTIVE_DATE_INVALID';
  end if;

  insert into public.student_enrollments (
    student_id,
    class_id,
    registered_mode,
    transition_kind,
    status,
    effective_from,
    effective_to,
    supersedes_enrollment_id,
    start_reason,
    started_by,
    ended_by,
    end_reason
  )
  values (
    p_student_id,
    p_target_class_id,
    p_registered_mode,
    'resume',
    'active',
    p_effective_from,
    null,
    previous_enrollment.id,
    normalized_reason,
    actor_id,
    null,
    null
  )
  returning *
  into result_enrollment;

  update public.students
  set
    lifecycle_status = 'active',
    registered_mode = p_registered_mode
  where id = p_student_id;

  return result_enrollment;
end;
$$;

revoke all on function public.resume_student_enrollment(
  uuid,
  uuid,
  text,
  date,
  text
)
from public, anon, authenticated;

grant execute on function public.resume_student_enrollment(
  uuid,
  uuid,
  text,
  date,
  text
)
to authenticated;

commit;
