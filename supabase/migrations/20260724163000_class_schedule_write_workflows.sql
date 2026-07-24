begin;

-- =========================================================
-- TASK 5.0.4A
-- Class schedule template write workflows.
--
-- Browser remains read-only.
-- All writes use SECURITY DEFINER RPCs.
--
-- The current schema models only one active schedule version
-- per slot. Therefore creation and replacement take effect
-- on the current Vietnam business date.
-- =========================================================


-- =========================================================
-- CREATE CLASS SCHEDULE TEMPLATE
-- Permission: classes.manage_schedule
--
-- Rules:
-- - Class and academic year must both be active.
-- - Effective date must be today's Vietnam business date.
-- - Effective date must fall inside the academic year.
-- - Active schedule count cannot exceed the configured
--   weekly session count.
-- - Same component and weekday cannot have two active rows.
-- =========================================================

create or replace function public.create_class_schedule_template(
  p_class_id uuid,
  p_component_code text,
  p_weekday smallint,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_learning_mode text,
  p_room_name text,
  p_meeting_url text,
  p_effective_from date
)
returns public.class_schedule_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date :=
    (
      pg_catalog.now()
        at time zone 'Asia/Ho_Chi_Minh'
    )::date;

  normalized_component_code text;
  normalized_learning_mode text;
  normalized_room_name text;
  normalized_meeting_url text;

  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;
  result_schedule
    public.class_schedule_templates%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'classes.manage_schedule'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'CLASS_SCHEDULE_PERMISSION_DENIED';
  end if;

  if p_class_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_ID_REQUIRED';
  end if;

  normalized_component_code := nullif(
    pg_catalog.upper(
      pg_catalog.btrim(p_component_code)
    ),
    ''
  );

  normalized_learning_mode :=
    pg_catalog.lower(
      pg_catalog.btrim(p_learning_mode)
    );

  normalized_room_name := nullif(
    pg_catalog.btrim(p_room_name),
    ''
  );

  normalized_meeting_url := nullif(
    pg_catalog.btrim(p_meeting_url),
    ''
  );

  if normalized_component_code is not null
    and normalized_component_code
      !~ '^[A-Z0-9._-]+$'
  then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SCHEDULE_COMPONENT_CODE_INVALID';
  end if;

  if p_weekday is null
    or p_weekday < 1
    or p_weekday > 7
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SCHEDULE_WEEKDAY_INVALID';
  end if;

  if p_start_time is null
    or p_end_time is null
    or p_end_time <= p_start_time
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SCHEDULE_TIME_INVALID';
  end if;

  if normalized_learning_mode not in (
    'online',
    'offline',
    'hybrid'
  ) then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SCHEDULE_LEARNING_MODE_INVALID';
  end if;

  if p_effective_from is null then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SCHEDULE_EFFECTIVE_FROM_REQUIRED';
  end if;

  if p_effective_from <> business_date then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_MUST_START_ON_BUSINESS_DATE';
  end if;

  -- Lock the class row so concurrent schedule creation
  -- cannot both pass the weekly schedule count check.
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

  if target_class.status <> 'active' then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_REQUIRES_ACTIVE_CLASS';
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

  if target_year.status <> 'active' then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_REQUIRES_ACTIVE_ACADEMIC_YEAR';
  end if;

  if p_effective_from < target_year.starts_on
    or p_effective_from > target_year.ends_on
  then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_DATE_OUTSIDE_ACADEMIC_YEAR';
  end if;

  if (
    select count(*)
    from public.class_schedule_templates
      as schedule
    where schedule.class_id = target_class.id
      and schedule.is_active
  ) >= target_class.weekly_session_count
  then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_ACTIVE_SCHEDULE_LIMIT_REACHED';
  end if;

  if exists (
    select 1
    from public.class_schedule_templates
      as schedule
    where schedule.class_id = target_class.id
      and schedule.is_active
      and coalesce(
        schedule.component_code,
        ''
      ) = coalesce(
        normalized_component_code,
        ''
      )
      and schedule.weekday = p_weekday
  ) then
    raise exception using
      errcode = '23505',
      message =
        'CLASS_ACTIVE_SCHEDULE_SLOT_ALREADY_EXISTS';
  end if;

  insert into public.class_schedule_templates (
    class_id,
    component_code,
    weekday,
    start_time,
    end_time,
    learning_mode,
    room_name,
    meeting_url,
    effective_from,
    effective_to,
    is_active,
    supersedes_schedule_template_id,
    ended_by,
    end_reason,
    created_by
  )
  values (
    target_class.id,
    normalized_component_code,
    p_weekday,
    p_start_time,
    p_end_time,
    normalized_learning_mode,
    normalized_room_name,
    normalized_meeting_url,
    p_effective_from,
    null,
    true,
    null,
    null,
    null,
    actor_id
  )
  returning *
  into result_schedule;

  return result_schedule;
end;
$$;

revoke all on function
  public.create_class_schedule_template(
    uuid,
    text,
    smallint,
    time without time zone,
    time without time zone,
    text,
    text,
    text,
    date
  )
from public, anon, authenticated;

grant execute on function
  public.create_class_schedule_template(
    uuid,
    text,
    smallint,
    time without time zone,
    time without time zone,
    text,
    text,
    text,
    date
  )
to authenticated;


-- =========================================================
-- REPLACE CLASS SCHEDULE TEMPLATE
-- Permission: classes.manage_schedule
--
-- The old active schedule ends on the day before the new
-- schedule starts. The new row references the old row through
-- supersedes_schedule_template_id.
--
-- component_code remains unchanged across the chain.
-- =========================================================

create or replace function public.replace_class_schedule_template(
  p_schedule_template_id uuid,
  p_weekday smallint,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_learning_mode text,
  p_room_name text,
  p_meeting_url text,
  p_effective_from date,
  p_reason text
)
returns public.class_schedule_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date :=
    (
      pg_catalog.now()
        at time zone 'Asia/Ho_Chi_Minh'
    )::date;

  normalized_learning_mode text;
  normalized_room_name text;
  normalized_meeting_url text;
  normalized_reason text;

  previous_schedule
    public.class_schedule_templates%rowtype;

  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;

  result_schedule
    public.class_schedule_templates%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'classes.manage_schedule'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'CLASS_SCHEDULE_PERMISSION_DENIED';
  end if;

  if p_schedule_template_id is null then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SCHEDULE_TEMPLATE_ID_REQUIRED';
  end if;

  normalized_learning_mode :=
    pg_catalog.lower(
      pg_catalog.btrim(p_learning_mode)
    );

  normalized_room_name := nullif(
    pg_catalog.btrim(p_room_name),
    ''
  );

  normalized_meeting_url := nullif(
    pg_catalog.btrim(p_meeting_url),
    ''
  );

  normalized_reason :=
    pg_catalog.btrim(p_reason);

  if p_weekday is null
    or p_weekday < 1
    or p_weekday > 7
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SCHEDULE_WEEKDAY_INVALID';
  end if;

  if p_start_time is null
    or p_end_time is null
    or p_end_time <= p_start_time
  then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SCHEDULE_TIME_INVALID';
  end if;

  if normalized_learning_mode not in (
    'online',
    'offline',
    'hybrid'
  ) then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SCHEDULE_LEARNING_MODE_INVALID';
  end if;

  if p_effective_from is null then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SCHEDULE_EFFECTIVE_FROM_REQUIRED';
  end if;

  if p_effective_from <> business_date then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_REPLACEMENT_MUST_START_TODAY';
  end if;

  if normalized_reason is null
    or normalized_reason = ''
  then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SCHEDULE_REPLACEMENT_REASON_REQUIRED';
  end if;

  select schedule.*
  into previous_schedule
  from public.class_schedule_templates
    as schedule
  where schedule.id = p_schedule_template_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'CLASS_SCHEDULE_TEMPLATE_NOT_FOUND';
  end if;

  if not previous_schedule.is_active then
    raise exception using
      errcode = '23514',
      message =
        'ONLY_ACTIVE_CLASS_SCHEDULE_CAN_BE_REPLACED';
  end if;

  if previous_schedule.effective_from
    >= p_effective_from
  then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_CANNOT_BE_REPLACED_ON_START_DATE';
  end if;

  select class_row.*
  into target_class
  from public.classes as class_row
  where
    class_row.id =
      previous_schedule.class_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_NOT_FOUND';
  end if;

  if target_class.status <> 'active' then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_REQUIRES_ACTIVE_CLASS';
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

  if target_year.status <> 'active' then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_REQUIRES_ACTIVE_ACADEMIC_YEAR';
  end if;

  if p_effective_from < target_year.starts_on
    or p_effective_from > target_year.ends_on
  then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_DATE_OUTSIDE_ACADEMIC_YEAR';
  end if;

  if exists (
    select 1
    from public.class_schedule_templates
      as schedule
    where
      schedule.class_id = target_class.id
      and schedule.id <> previous_schedule.id
      and schedule.is_active
      and coalesce(
        schedule.component_code,
        ''
      ) = coalesce(
        previous_schedule.component_code,
        ''
      )
      and schedule.weekday = p_weekday
  ) then
    raise exception using
      errcode = '23505',
      message =
        'CLASS_ACTIVE_SCHEDULE_SLOT_ALREADY_EXISTS';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.class_schedule_templates
  set
    is_active = false,
    effective_to = p_effective_from - 1,
    ended_by = actor_id,
    end_reason = normalized_reason,
    updated_at = pg_catalog.now()
  where id = previous_schedule.id;

  insert into public.class_schedule_templates (
    class_id,
    component_code,
    weekday,
    start_time,
    end_time,
    learning_mode,
    room_name,
    meeting_url,
    effective_from,
    effective_to,
    is_active,
    supersedes_schedule_template_id,
    ended_by,
    end_reason,
    created_by
  )
  values (
    target_class.id,
    previous_schedule.component_code,
    p_weekday,
    p_start_time,
    p_end_time,
    normalized_learning_mode,
    normalized_room_name,
    normalized_meeting_url,
    p_effective_from,
    null,
    true,
    previous_schedule.id,
    null,
    null,
    actor_id
  )
  returning *
  into result_schedule;

  return result_schedule;
end;
$$;

revoke all on function
  public.replace_class_schedule_template(
    uuid,
    smallint,
    time without time zone,
    time without time zone,
    text,
    text,
    text,
    date,
    text
  )
from public, anon, authenticated;

grant execute on function
  public.replace_class_schedule_template(
    uuid,
    smallint,
    time without time zone,
    time without time zone,
    text,
    text,
    text,
    date,
    text
  )
to authenticated;


-- =========================================================
-- END CLASS SCHEDULE TEMPLATE
-- Permission: classes.manage_schedule
--
-- Ends an active schedule without creating a successor.
-- The final effective date cannot be in the future.
-- =========================================================

create or replace function public.end_class_schedule_template(
  p_schedule_template_id uuid,
  p_effective_to date,
  p_reason text
)
returns public.class_schedule_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date :=
    (
      pg_catalog.now()
        at time zone 'Asia/Ho_Chi_Minh'
    )::date;

  normalized_reason text;

  target_schedule
    public.class_schedule_templates%rowtype;

  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;

  result_schedule
    public.class_schedule_templates%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'classes.manage_schedule'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'CLASS_SCHEDULE_PERMISSION_DENIED';
  end if;

  if p_schedule_template_id is null then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SCHEDULE_TEMPLATE_ID_REQUIRED';
  end if;

  if p_effective_to is null then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SCHEDULE_EFFECTIVE_TO_REQUIRED';
  end if;

  normalized_reason :=
    pg_catalog.btrim(p_reason);

  if normalized_reason is null
    or normalized_reason = ''
  then
    raise exception using
      errcode = '22023',
      message =
        'CLASS_SCHEDULE_END_REASON_REQUIRED';
  end if;

  select schedule.*
  into target_schedule
  from public.class_schedule_templates
    as schedule
  where schedule.id = p_schedule_template_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'CLASS_SCHEDULE_TEMPLATE_NOT_FOUND';
  end if;

  if not target_schedule.is_active then
    raise exception using
      errcode = '23514',
      message =
        'ONLY_ACTIVE_CLASS_SCHEDULE_CAN_BE_ENDED';
  end if;

  if p_effective_to <
    target_schedule.effective_from
  then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_END_DATE_INVALID';
  end if;

  if p_effective_to > business_date then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_END_DATE_CANNOT_BE_FUTURE';
  end if;

  select class_row.*
  into target_class
  from public.classes as class_row
  where class_row.id = target_schedule.class_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_NOT_FOUND';
  end if;

  if target_class.status <> 'active' then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_REQUIRES_ACTIVE_CLASS';
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

  if target_year.status <> 'active' then
    raise exception using
      errcode = '23514',
      message =
        'CLASS_SCHEDULE_REQUIRES_ACTIVE_ACADEMIC_YEAR';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.class_schedule_templates
  set
    is_active = false,
    effective_to = p_effective_to,
    ended_by = actor_id,
    end_reason = normalized_reason,
    updated_at = pg_catalog.now()
  where id = target_schedule.id
  returning *
  into result_schedule;

  return result_schedule;
end;
$$;

revoke all on function
  public.end_class_schedule_template(
    uuid,
    date,
    text
  )
from public, anon, authenticated;

grant execute on function
  public.end_class_schedule_template(
    uuid,
    date,
    text
  )
to authenticated;


-- Browser remains read-only.
-- No table INSERT, UPDATE, DELETE or ALL grant is added.

commit;
