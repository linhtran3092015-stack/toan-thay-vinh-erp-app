begin;

-- =========================================================
-- ACADEMIC YEARS
-- =========================================================

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft',
  is_current boolean not null default false,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint academic_years_code_check
    check (
      code = pg_catalog.btrim(code)
      and code ~ '^[0-9]{4}-[0-9]{4}$'
    ),

  constraint academic_years_name_check
    check (
      name = pg_catalog.btrim(name)
      and name <> ''
    ),

  constraint academic_years_date_check
    check (ends_on >= starts_on),

  constraint academic_years_status_check
    check (status in ('draft', 'active', 'closed', 'archived')),

  constraint academic_years_current_status_check
    check (
      not is_current
      or status = 'active'
    )
);

create unique index academic_years_code_unique_idx
on public.academic_years (code);

create unique index academic_years_one_current_idx
on public.academic_years (is_current)
where is_current;

create index academic_years_dates_idx
on public.academic_years (starts_on desc, ends_on desc);

create trigger academic_years_set_updated_at
before update on public.academic_years
for each row execute function public.set_updated_at();


-- =========================================================
-- CLASSES
-- =========================================================

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null
    references public.academic_years(id) on delete restrict,
  code text not null,
  name text not null,
  grade smallint not null,
  level text not null,
  weekly_session_count smallint not null default 2,
  default_learning_mode text not null default 'hybrid',
  classin_url text,
  status text not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint classes_code_check
    check (
      code = pg_catalog.upper(pg_catalog.btrim(code))
      and code ~ '^[A-Z0-9._-]+$'
    ),

  constraint classes_name_check
    check (
      name = pg_catalog.btrim(name)
      and name <> ''
    ),

  constraint classes_grade_check
    check (grade between 1 and 12),

  constraint classes_level_check
    check (level in ('A', 'B', 'CLC')),

  constraint classes_weekly_session_count_check
    check (weekly_session_count between 1 and 7),

  constraint classes_default_learning_mode_check
    check (
      default_learning_mode in ('online', 'offline', 'hybrid')
    ),

  constraint classes_classin_url_check
    check (
      classin_url is null
      or (
        classin_url = pg_catalog.btrim(classin_url)
        and classin_url <> ''
      )
    ),

  constraint classes_status_check
    check (status in ('draft', 'active', 'closed', 'archived')),

  constraint classes_notes_check
    check (
      notes is null
      or pg_catalog.btrim(notes) <> ''
    )
);

create unique index classes_academic_year_code_unique_idx
on public.classes (academic_year_id, code);

create index classes_academic_year_status_idx
on public.classes (academic_year_id, status, grade, level);

create index classes_grade_status_idx
on public.classes (grade, status, code);

create index classes_created_at_idx
on public.classes (created_at desc);

create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();


-- =========================================================
-- RECURRING CLASS SCHEDULES
-- =========================================================

create table public.class_schedule_templates (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null
    references public.classes(id) on delete restrict,
  component_code text,
  weekday smallint not null,
  start_time time not null,
  end_time time not null,
  learning_mode text not null,
  room_name text,
  meeting_url text,
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true,
  supersedes_schedule_template_id uuid
    references public.class_schedule_templates(id) on delete restrict,
  ended_by uuid references public.profiles(id) on delete restrict,
  end_reason text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint class_schedule_templates_component_code_check
    check (
      component_code is null
      or (
        component_code = pg_catalog.upper(pg_catalog.btrim(component_code))
        and component_code <> ''
        and component_code ~ '^[A-Z0-9._-]+$'
      )
    ),

  constraint class_schedule_templates_weekday_check
    check (weekday between 1 and 7),

  constraint class_schedule_templates_time_check
    check (end_time > start_time),

  constraint class_schedule_templates_learning_mode_check
    check (learning_mode in ('online', 'offline', 'hybrid')),

  constraint class_schedule_templates_room_name_check
    check (
      room_name is null
      or (
        room_name = pg_catalog.btrim(room_name)
        and room_name <> ''
      )
    ),

  constraint class_schedule_templates_meeting_url_check
    check (
      meeting_url is null
      or (
        meeting_url = pg_catalog.btrim(meeting_url)
        and meeting_url <> ''
      )
    ),

  constraint class_schedule_templates_effective_dates_check
    check (
      effective_to is null
      or effective_to >= effective_from
    ),

  constraint class_schedule_templates_supersedes_check
    check (
      supersedes_schedule_template_id is null
      or supersedes_schedule_template_id <> id
    ),

  constraint class_schedule_templates_end_state_check
    check (
      (
        is_active
        and effective_to is null
        and ended_by is null
        and end_reason is null
      )
      or
      (
        not is_active
        and effective_to is not null
        and ended_by is not null
        and end_reason is not null
        and pg_catalog.btrim(end_reason) <> ''
      )
    )
);

create unique index class_schedule_templates_active_slot_unique_idx
on public.class_schedule_templates (
  class_id,
  coalesce(component_code, ''),
  weekday
)
where is_active;

create index class_schedule_templates_class_active_idx
on public.class_schedule_templates (
  class_id,
  weekday,
  start_time
)
where is_active;

create index class_schedule_templates_effective_idx
on public.class_schedule_templates (
  effective_from,
  effective_to
);

create unique index class_schedule_templates_supersedes_unique_idx
on public.class_schedule_templates (
  supersedes_schedule_template_id
)
where supersedes_schedule_template_id is not null;

create trigger class_schedule_templates_set_updated_at
before update on public.class_schedule_templates
for each row execute function public.set_updated_at();


-- =========================================================
-- HISTORY PROTECTION
-- =========================================================

create or replace function public.protect_academic_year_identity_after_use()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.classes
    where academic_year_id = old.id
  )
  and (
    new.code is distinct from old.code
    or new.starts_on is distinct from old.starts_on
    or new.ends_on is distinct from old.ends_on
  )
  then
    raise exception using
      errcode = '23514',
      message = 'ACADEMIC_YEAR_IDENTITY_IMMUTABLE_AFTER_USE';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_academic_year_identity_after_use()
from public, anon, authenticated;

create trigger academic_years_protect_identity
before update on public.academic_years
for each row execute function public.protect_academic_year_identity_after_use();


create or replace function public.protect_class_identity_after_schedule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.class_schedule_templates
    where class_id = old.id
  )
  and (
    new.academic_year_id is distinct from old.academic_year_id
    or new.code is distinct from old.code
    or new.grade is distinct from old.grade
    or new.level is distinct from old.level
  )
  then
    raise exception using
      errcode = '23514',
      message = 'CLASS_IDENTITY_IMMUTABLE_AFTER_SCHEDULE';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_class_identity_after_schedule()
from public, anon, authenticated;

create trigger classes_protect_identity
before update on public.classes
for each row execute function public.protect_class_identity_after_schedule();


create or replace function public.validate_class_schedule_supersession()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  previous_schedule public.class_schedule_templates%rowtype;
begin
  if new.supersedes_schedule_template_id is null then
    return new;
  end if;

  select *
  into previous_schedule
  from public.class_schedule_templates
  where id = new.supersedes_schedule_template_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'SUPERSEDED_CLASS_SCHEDULE_NOT_FOUND';
  end if;

  if previous_schedule.class_id is distinct from new.class_id then
    raise exception using
      errcode = '23514',
      message = 'SUPERSEDED_CLASS_SCHEDULE_MUST_BELONG_TO_SAME_CLASS';
  end if;

  if previous_schedule.component_code
    is distinct from new.component_code
  then
    raise exception using
      errcode = '23514',
      message = 'SUPERSEDED_CLASS_SCHEDULE_COMPONENT_MISMATCH';
  end if;

  if previous_schedule.is_active then
    raise exception using
      errcode = '23514',
      message = 'SUPERSEDED_CLASS_SCHEDULE_MUST_BE_ENDED';
  end if;

  if previous_schedule.effective_to is null
    or new.effective_from <= previous_schedule.effective_to
  then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SCHEDULE_SUCCESSOR_DATE_INVALID';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_class_schedule_supersession()
from public, anon, authenticated;

create trigger class_schedule_templates_validate_supersession
before insert or update of supersedes_schedule_template_id
on public.class_schedule_templates
for each row execute function public.validate_class_schedule_supersession();


create or replace function public.protect_class_schedule_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not old.is_active then
    raise exception using
      errcode = '23514',
      message = 'ENDED_CLASS_SCHEDULE_IS_IMMUTABLE';
  end if;

  if new.id is distinct from old.id
    or new.class_id is distinct from old.class_id
    or new.component_code is distinct from old.component_code
    or new.weekday is distinct from old.weekday
    or new.start_time is distinct from old.start_time
    or new.end_time is distinct from old.end_time
    or new.learning_mode is distinct from old.learning_mode
    or new.room_name is distinct from old.room_name
    or new.meeting_url is distinct from old.meeting_url
    or new.effective_from is distinct from old.effective_from
    or new.supersedes_schedule_template_id
      is distinct from old.supersedes_schedule_template_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SCHEDULE_HISTORY_IS_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_class_schedule_history()
from public, anon, authenticated;

create trigger class_schedule_templates_protect_history
before update on public.class_schedule_templates
for each row execute function public.protect_class_schedule_history();


create or replace function public.prevent_class_foundation_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'CLASS_FOUNDATION_HARD_DELETE_FORBIDDEN';
end;
$$;

revoke all on function public.prevent_class_foundation_delete()
from public, anon, authenticated;

create trigger academic_years_prevent_delete
before delete on public.academic_years
for each row execute function public.prevent_class_foundation_delete();

create trigger classes_prevent_delete
before delete on public.classes
for each row execute function public.prevent_class_foundation_delete();

create trigger class_schedule_templates_prevent_delete
before delete on public.class_schedule_templates
for each row execute function public.prevent_class_foundation_delete();


-- =========================================================
-- AUDIT
-- =========================================================

create or replace function public.audit_class_foundation_change()
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
    audit_entity_id := audit_new_data ->> 'id';
    audit_action := case
      when tg_op = 'INSERT' then 'academic_year_created'
      else 'academic_year_updated'
    end;

  elsif tg_table_name = 'classes' then
    audit_entity_type := 'class';
    audit_entity_id := audit_new_data ->> 'id';
    audit_action := case
      when tg_op = 'INSERT' then 'class_created'
      else 'class_updated'
    end;

  elsif tg_table_name = 'class_schedule_templates' then
    audit_entity_type := 'class_schedule_template';
    audit_entity_id := audit_new_data ->> 'id';

    if tg_op = 'INSERT' then
      audit_action := 'class_schedule_created';
    elsif old.is_active and not new.is_active then
      audit_action := 'class_schedule_ended';
    else
      audit_action := 'class_schedule_updated';
    end if;

  else
    raise exception using
      errcode = '22023',
      message = 'UNSUPPORTED_CLASS_AUDIT_TABLE';
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
      when audit_action = 'class_schedule_ended'
        then audit_new_data ->> 'end_reason'
      else null
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

revoke all on function public.audit_class_foundation_change()
from public, anon, authenticated;

create trigger academic_years_audit_changes
after insert or update on public.academic_years
for each row execute function public.audit_class_foundation_change();

create trigger classes_audit_changes
after insert or update on public.classes
for each row execute function public.audit_class_foundation_change();

create trigger class_schedule_templates_audit_changes
after insert or update on public.class_schedule_templates
for each row execute function public.audit_class_foundation_change();


-- =========================================================
-- PERMISSIONS
-- =========================================================

insert into public.permissions (
  code,
  module,
  name,
  description
)
values
  (
    'classes.view',
    'classes',
    'Xem lớp học',
    'Xem danh sách lớp, năm học và lịch cố định.'
  ),
  (
    'classes.create',
    'classes',
    'Tạo lớp học',
    'Tạo năm học và lớp học qua workflow được phê duyệt.'
  ),
  (
    'classes.manage_schedule',
    'classes',
    'Quản lý lịch học',
    'Tạo và thay đổi lịch cố định qua workflow được phê duyệt.'
  )
on conflict (code) do update
set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (
  role_id,
  permission_id,
  granted_by
)
select
  role.id,
  permission.id,
  null
from public.roles as role
cross join public.permissions as permission
where role.code = 'owner'
  and permission.code in (
    'classes.view',
    'classes.create',
    'classes.manage_schedule'
  )
on conflict (role_id, permission_id) do nothing;


-- =========================================================
-- RLS AND GRANTS
-- =========================================================

alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.class_schedule_templates enable row level security;

create policy academic_years_select_authorized
on public.academic_years
for select
to authenticated
using (public.has_permission('classes.view'));

create policy classes_select_authorized
on public.classes
for select
to authenticated
using (public.has_permission('classes.view'));

create policy class_schedule_templates_select_authorized
on public.class_schedule_templates
for select
to authenticated
using (public.has_permission('classes.view'));

revoke all privileges on table
  public.academic_years,
  public.classes,
  public.class_schedule_templates
from public, anon, authenticated;

grant select on table
  public.academic_years,
  public.classes,
  public.class_schedule_templates
to authenticated;

commit;
