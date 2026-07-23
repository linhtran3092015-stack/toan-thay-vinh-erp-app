begin;

-- =========================================================
-- NORMALIZED STUDENT NAME
-- Used only for conservative exact-duplicate detection.
-- =========================================================

create or replace function public.normalize_student_name(
  name_value text
)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(name_value),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

revoke all on function public.normalize_student_name(text)
from public, anon, authenticated;


-- =========================================================
-- AUDIT REASON SUPPORT
--
-- RPC workflows set app.audit_reason for the current
-- transaction. Existing audit triggers then persist it.
-- =========================================================

create or replace function public.audit_student_foundation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  audit_action text;
  audit_entity_type text;
  audit_entity_id text;
  audit_old_data jsonb;
  audit_new_data jsonb;
  workflow_reason text := nullif(
    pg_catalog.btrim(
      pg_catalog.current_setting(
        'app.audit_reason',
        true
      )
    ),
    ''
  );
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

  if tg_table_name = 'guardians' then
    audit_entity_type := 'guardian';
    audit_entity_id := audit_new_data ->> 'id';

    audit_action := case
      when tg_op = 'INSERT' then 'guardian_created'
      else 'guardian_updated'
    end;

  elsif tg_table_name = 'students' then
    audit_entity_type := 'student';
    audit_entity_id := audit_new_data ->> 'id';

    audit_action := case
      when tg_op = 'INSERT' then 'student_created'
      else 'student_updated'
    end;

  elsif tg_table_name = 'student_guardians' then
    audit_entity_type := 'student_guardian';
    audit_entity_id := audit_new_data ->> 'id';

    if tg_op = 'INSERT' then
      audit_action := 'student_guardian_linked';
    elsif
      audit_old_data ->> 'ended_at' is null
      and audit_new_data ->> 'ended_at' is not null
    then
      audit_action := 'student_guardian_unlinked';
    else
      audit_action := 'student_guardian_updated';
    end if;

  else
    raise exception using
      errcode = '22023',
      message = 'UNSUPPORTED_STUDENT_AUDIT_TABLE';
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
    'students',
    audit_action,
    audit_entity_type,
    audit_entity_id,
    audit_old_data,
    audit_new_data,
    case
      when audit_action = 'student_guardian_unlinked'
        then audit_new_data ->> 'end_reason'
      else workflow_reason
    end,
    pg_catalog.jsonb_build_object(
      'source',
      case
        when actor_id is null then 'database'
        else 'authenticated_user'
      end
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_student_foundation_change()
from public, anon, authenticated;


-- =========================================================
-- DUPLICATE LOOKUP
--
-- Returns the guardian using the submitted phone and all
-- students actively linked to that guardian.
--
-- Exact duplicate means:
-- - same normalized name
-- - same birth year
-- - same guardian phone
-- =========================================================

create or replace function public.find_student_form_duplicates(
  p_student_id uuid,
  p_full_name text,
  p_birth_year integer,
  p_guardian_phone text
)
returns table (
  guardian_id uuid,
  guardian_full_name text,
  guardian_phone text,
  linked_student_id uuid,
  linked_student_public_code text,
  linked_student_full_name text,
  linked_student_birth_year smallint,
  linked_student_lifecycle_status text,
  is_exact_student_duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_phone text;
  normalized_name text;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not (
    public.has_permission('students.create')
    or public.has_permission('students.update')
  ) then
    raise exception using
      errcode = '42501',
      message = 'STUDENT_FORM_PERMISSION_DENIED';
  end if;

  normalized_phone := public.normalize_vietnam_phone(
    coalesce(p_guardian_phone, '')
  );

  if normalized_phone !~ '^0[0-9]{9,10}$' then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_PHONE_INVALID';
  end if;

  normalized_name := public.normalize_student_name(
    coalesce(p_full_name, '')
  );

  return query
  select
    guardian.id,
    guardian.full_name,
    guardian.phone,
    student.id,
    student.public_code,
    student.full_name,
    student.birth_year,
    student.lifecycle_status,
    (
      student.id is not null
      and student.id is distinct from p_student_id
      and public.normalize_student_name(
        student.full_name
      ) = normalized_name
      and student.birth_year = p_birth_year
    ) as is_exact_student_duplicate
  from public.guardians as guardian
  left join public.student_guardians as link
    on link.guardian_id = guardian.id
    and link.ended_at is null
  left join public.students as student
    on student.id = link.student_id
  where guardian.normalized_phone = normalized_phone
  order by
    student.full_name nulls last,
    student.id nulls last;
end;
$$;

revoke all on function public.find_student_form_duplicates(
  uuid,
  text,
  integer,
  text
)
from public, anon, authenticated;

grant execute on function public.find_student_form_duplicates(
  uuid,
  text,
  integer,
  text
)
to authenticated;


-- =========================================================
-- CREATE STUDENT WITH PRIMARY GUARDIAN
--
-- Scope:
-- - Creates student as interested.
-- - Creates or reuses guardian by normalized phone.
-- - Creates one primary guardian link.
-- - Does not enroll the student in a class.
-- - Does not set official_start_date.
-- =========================================================

create or replace function public.create_student_with_primary_guardian(
  p_full_name text,
  p_nickname text,
  p_birth_year integer,
  p_province_city text,
  p_current_grade integer,
  p_learning_level text,
  p_registered_mode text,
  p_learning_goal text,
  p_internal_notes text,
  p_guardian_full_name text,
  p_guardian_phone text,
  p_guardian_relationship text,
  p_guardian_zalo text,
  p_guardian_email text,
  p_guardian_notes text,
  p_duplicate_override_reason text,
  p_reason text
)
returns table (
  student_id uuid,
  student_public_code text,
  guardian_id uuid,
  guardian_reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_full_name text :=
    pg_catalog.btrim(p_full_name);

  normalized_nickname text :=
    nullif(
      pg_catalog.btrim(p_nickname),
      ''
    );

  normalized_province_city text :=
    nullif(
      pg_catalog.btrim(p_province_city),
      ''
    );

  normalized_learning_goal text :=
    nullif(
      pg_catalog.btrim(p_learning_goal),
      ''
    );

  normalized_internal_notes text :=
    nullif(
      pg_catalog.btrim(p_internal_notes),
      ''
    );

  normalized_guardian_full_name text :=
    pg_catalog.btrim(p_guardian_full_name);

  normalized_guardian_phone text :=
    public.normalize_vietnam_phone(
      coalesce(p_guardian_phone, '')
    );

  normalized_guardian_relationship text :=
    pg_catalog.btrim(p_guardian_relationship);

  normalized_guardian_zalo text :=
    nullif(
      pg_catalog.btrim(p_guardian_zalo),
      ''
    );

  normalized_guardian_email text :=
    nullif(
      pg_catalog.lower(
        pg_catalog.btrim(p_guardian_email)
      ),
      ''
    );

  normalized_guardian_notes text :=
    nullif(
      pg_catalog.btrim(p_guardian_notes),
      ''
    );

  normalized_duplicate_reason text :=
    nullif(
      pg_catalog.btrim(
        p_duplicate_override_reason
      ),
      ''
    );

  normalized_reason text :=
    nullif(
      pg_catalog.btrim(p_reason),
      ''
    );

  audit_reason text;
  duplicate_found boolean := false;
  result_student_id uuid;
  result_public_code text;
  result_guardian_id uuid;
  reused_guardian boolean := false;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('students.create') then
    raise exception using
      errcode = '42501',
      message = 'STUDENT_CREATE_PERMISSION_DENIED';
  end if;

  if normalized_full_name is null
    or normalized_full_name = ''
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_FULL_NAME_REQUIRED';
  end if;

  if p_birth_year is null
    or p_birth_year < 1990
    or p_birth_year > 2100
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_BIRTH_YEAR_INVALID';
  end if;

  if p_current_grade is null
    or p_current_grade < 1
    or p_current_grade > 12
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_CURRENT_GRADE_INVALID';
  end if;

  if p_learning_level is not null
    and p_learning_level not in ('A', 'B', 'CLC')
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_LEARNING_LEVEL_INVALID';
  end if;

  if p_registered_mode is not null
    and p_registered_mode not in (
      'online',
      'offline'
    )
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_REGISTERED_MODE_INVALID';
  end if;

  if normalized_guardian_full_name is null
    or normalized_guardian_full_name = ''
  then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_FULL_NAME_REQUIRED';
  end if;

  if normalized_guardian_phone
    !~ '^0[0-9]{9,10}$'
  then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_PHONE_INVALID';
  end if;

  if normalized_guardian_relationship is null
    or normalized_guardian_relationship = ''
  then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_RELATIONSHIP_REQUIRED';
  end if;

  if normalized_guardian_email is not null
    and normalized_guardian_email
      !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_EMAIL_INVALID';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_CREATE_REASON_REQUIRED';
  end if;

  select exists (
    select 1
    from public.students as student
    join public.student_guardians as link
      on link.student_id = student.id
      and link.ended_at is null
    join public.guardians as guardian
      on guardian.id = link.guardian_id
    where public.normalize_student_name(
      student.full_name
    ) = public.normalize_student_name(
      normalized_full_name
    )
      and student.birth_year = p_birth_year
      and guardian.normalized_phone =
        normalized_guardian_phone
  )
  into duplicate_found;

  if duplicate_found
    and normalized_duplicate_reason is null
  then
    raise exception using
      errcode = '23514',
      message =
        'STUDENT_DUPLICATE_OVERRIDE_REASON_REQUIRED';
  end if;

  audit_reason := normalized_reason;

  if duplicate_found then
    audit_reason :=
      audit_reason
      || ' | Duplicate override: '
      || normalized_duplicate_reason;
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    audit_reason,
    true
  );

  select guardian.id
  into result_guardian_id
  from public.guardians as guardian
  where guardian.normalized_phone =
    normalized_guardian_phone
  for update;

  if found then
    reused_guardian := true;
  else
    insert into public.guardians (
      full_name,
      phone,
      zalo,
      email,
      notes,
      created_by
    )
    values (
      normalized_guardian_full_name,
      normalized_guardian_phone,
      normalized_guardian_zalo,
      normalized_guardian_email,
      normalized_guardian_notes,
      actor_id
    )
    returning id
    into result_guardian_id;
  end if;

  insert into public.students (
    full_name,
    nickname,
    birth_year,
    province_city,
    current_grade,
    lifecycle_status,
    learning_level,
    registered_mode,
    official_start_date,
    learning_goal,
    internal_notes,
    created_by
  )
  values (
    normalized_full_name,
    normalized_nickname,
    p_birth_year,
    normalized_province_city,
    p_current_grade,
    'interested',
    p_learning_level,
    p_registered_mode,
    null,
    normalized_learning_goal,
    normalized_internal_notes,
    actor_id
  )
  returning
    id,
    public_code
  into
    result_student_id,
    result_public_code;

  insert into public.student_guardians (
    student_id,
    guardian_id,
    relationship,
    is_primary,
    linked_by
  )
  values (
    result_student_id,
    result_guardian_id,
    normalized_guardian_relationship,
    true,
    actor_id
  );

  return query
  select
    result_student_id,
    result_public_code,
    result_guardian_id,
    reused_guardian;
end;
$$;

revoke all on function public.create_student_with_primary_guardian(
  text,
  text,
  integer,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.create_student_with_primary_guardian(
  text,
  text,
  integer,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;


-- =========================================================
-- UPDATE STUDENT WITH PRIMARY GUARDIAN
--
-- Does not change:
-- - public_code
-- - lifecycle_status
-- - official_start_date
-- - enrollment history
--
-- If an active enrollment exists, registered_mode must remain
-- equal to that enrollment. Mode changes for active students
-- belong to the enrollment workflows.
-- =========================================================

create or replace function public.update_student_with_primary_guardian(
  p_student_id uuid,
  p_full_name text,
  p_nickname text,
  p_birth_year integer,
  p_province_city text,
  p_current_grade integer,
  p_learning_level text,
  p_registered_mode text,
  p_learning_goal text,
  p_internal_notes text,
  p_guardian_full_name text,
  p_guardian_phone text,
  p_guardian_relationship text,
  p_guardian_zalo text,
  p_guardian_email text,
  p_guardian_notes text,
  p_duplicate_override_reason text,
  p_reason text
)
returns table (
  student_id uuid,
  student_public_code text,
  guardian_id uuid,
  guardian_reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  locked_student public.students%rowtype;
  current_primary_link public.student_guardians%rowtype;
  existing_target_link public.student_guardians%rowtype;

  active_enrollment_mode text;

  normalized_full_name text :=
    pg_catalog.btrim(p_full_name);

  normalized_nickname text :=
    nullif(
      pg_catalog.btrim(p_nickname),
      ''
    );

  normalized_province_city text :=
    nullif(
      pg_catalog.btrim(p_province_city),
      ''
    );

  normalized_learning_goal text :=
    nullif(
      pg_catalog.btrim(p_learning_goal),
      ''
    );

  normalized_internal_notes text :=
    nullif(
      pg_catalog.btrim(p_internal_notes),
      ''
    );

  normalized_guardian_full_name text :=
    pg_catalog.btrim(p_guardian_full_name);

  normalized_guardian_phone text :=
    public.normalize_vietnam_phone(
      coalesce(p_guardian_phone, '')
    );

  normalized_guardian_relationship text :=
    pg_catalog.btrim(p_guardian_relationship);

  normalized_guardian_zalo text :=
    nullif(
      pg_catalog.btrim(p_guardian_zalo),
      ''
    );

  normalized_guardian_email text :=
    nullif(
      pg_catalog.lower(
        pg_catalog.btrim(p_guardian_email)
      ),
      ''
    );

  normalized_guardian_notes text :=
    nullif(
      pg_catalog.btrim(p_guardian_notes),
      ''
    );

  normalized_duplicate_reason text :=
    nullif(
      pg_catalog.btrim(
        p_duplicate_override_reason
      ),
      ''
    );

  normalized_reason text :=
    nullif(
      pg_catalog.btrim(p_reason),
      ''
    );

  audit_reason text;
  duplicate_found boolean := false;
  target_guardian_id uuid;
  reused_guardian boolean := false;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('students.update') then
    raise exception using
      errcode = '42501',
      message = 'STUDENT_UPDATE_PERMISSION_DENIED';
  end if;

  if p_student_id is null then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ID_REQUIRED';
  end if;

  if normalized_full_name is null
    or normalized_full_name = ''
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_FULL_NAME_REQUIRED';
  end if;

  if p_birth_year is null
    or p_birth_year < 1990
    or p_birth_year > 2100
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_BIRTH_YEAR_INVALID';
  end if;

  if p_current_grade is null
    or p_current_grade < 1
    or p_current_grade > 12
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_CURRENT_GRADE_INVALID';
  end if;

  if p_learning_level is not null
    and p_learning_level not in ('A', 'B', 'CLC')
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_LEARNING_LEVEL_INVALID';
  end if;

  if p_registered_mode is not null
    and p_registered_mode not in (
      'online',
      'offline'
    )
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_REGISTERED_MODE_INVALID';
  end if;

  if normalized_guardian_full_name is null
    or normalized_guardian_full_name = ''
  then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_FULL_NAME_REQUIRED';
  end if;

  if normalized_guardian_phone
    !~ '^0[0-9]{9,10}$'
  then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_PHONE_INVALID';
  end if;

  if normalized_guardian_relationship is null
    or normalized_guardian_relationship = ''
  then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_RELATIONSHIP_REQUIRED';
  end if;

  if normalized_guardian_email is not null
    and normalized_guardian_email
      !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_EMAIL_INVALID';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_UPDATE_REASON_REQUIRED';
  end if;

  select student.*
  into locked_student
  from public.students as student
  where student.id = p_student_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STUDENT_NOT_FOUND';
  end if;

  select enrollment.registered_mode
  into active_enrollment_mode
  from public.student_enrollments as enrollment
  where enrollment.student_id = p_student_id
    and enrollment.status = 'active'
    and enrollment.effective_to is null
  for update;

  if found
    and p_registered_mode
      is distinct from active_enrollment_mode
  then
    raise exception using
      errcode = '23514',
      message =
        'ACTIVE_STUDENT_REGISTERED_MODE_MANAGED_BY_ENROLLMENT';
  end if;

  select exists (
    select 1
    from public.students as student
    join public.student_guardians as link
      on link.student_id = student.id
      and link.ended_at is null
    join public.guardians as guardian
      on guardian.id = link.guardian_id
    where student.id <> p_student_id
      and public.normalize_student_name(
        student.full_name
      ) = public.normalize_student_name(
        normalized_full_name
      )
      and student.birth_year = p_birth_year
      and guardian.normalized_phone =
        normalized_guardian_phone
  )
  into duplicate_found;

  if duplicate_found
    and normalized_duplicate_reason is null
  then
    raise exception using
      errcode = '23514',
      message =
        'STUDENT_DUPLICATE_OVERRIDE_REASON_REQUIRED';
  end if;

  audit_reason := normalized_reason;

  if duplicate_found then
    audit_reason :=
      audit_reason
      || ' | Duplicate override: '
      || normalized_duplicate_reason;
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    audit_reason,
    true
  );

  select link.*
  into current_primary_link
  from public.student_guardians as link
  where link.student_id = p_student_id
    and link.is_primary
    and link.ended_at is null
  for update;

  select guardian.id
  into target_guardian_id
  from public.guardians as guardian
  where guardian.normalized_phone =
    normalized_guardian_phone
  for update;

  if found then
    reused_guardian := true;
  else
    insert into public.guardians (
      full_name,
      phone,
      zalo,
      email,
      notes,
      created_by
    )
    values (
      normalized_guardian_full_name,
      normalized_guardian_phone,
      normalized_guardian_zalo,
      normalized_guardian_email,
      normalized_guardian_notes,
      actor_id
    )
    returning id
    into target_guardian_id;
  end if;

  update public.students
  set
    full_name = normalized_full_name,
    nickname = normalized_nickname,
    birth_year = p_birth_year,
    province_city = normalized_province_city,
    current_grade = p_current_grade,
    learning_level = p_learning_level,
    registered_mode = p_registered_mode,
    learning_goal = normalized_learning_goal,
    internal_notes = normalized_internal_notes
  where id = p_student_id;

  if current_primary_link.id is not null
    and current_primary_link.guardian_id =
      target_guardian_id
  then
    update public.guardians
    set
      full_name = normalized_guardian_full_name,
      phone = normalized_guardian_phone,
      zalo = normalized_guardian_zalo,
      email = normalized_guardian_email,
      notes = normalized_guardian_notes
    where id = target_guardian_id;

    update public.student_guardians
    set
      relationship =
        normalized_guardian_relationship,
      is_primary = true
    where id = current_primary_link.id;

  else
    if current_primary_link.id is not null then
      update public.student_guardians
      set
        ended_at = pg_catalog.now(),
        ended_by = actor_id,
        end_reason = normalized_reason
      where id = current_primary_link.id;
    end if;

    select link.*
    into existing_target_link
    from public.student_guardians as link
    where link.student_id = p_student_id
      and link.guardian_id = target_guardian_id
      and link.ended_at is null
    for update;

    if existing_target_link.id is not null then
      update public.student_guardians
      set
        relationship =
          normalized_guardian_relationship,
        is_primary = true
      where id = existing_target_link.id;
    else
      insert into public.student_guardians (
        student_id,
        guardian_id,
        relationship,
        is_primary,
        linked_by
      )
      values (
        p_student_id,
        target_guardian_id,
        normalized_guardian_relationship,
        true,
        actor_id
      );
    end if;
  end if;

  return query
  select
    locked_student.id,
    locked_student.public_code,
    target_guardian_id,
    reused_guardian;
end;
$$;

revoke all on function public.update_student_with_primary_guardian(
  uuid,
  text,
  text,
  integer,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.update_student_with_primary_guardian(
  uuid,
  text,
  text,
  integer,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;

commit;
