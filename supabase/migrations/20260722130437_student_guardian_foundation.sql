begin;

-- =========================================================
-- NORMALIZATION AND PUBLIC CODE
-- =========================================================

create or replace function public.normalize_vietnam_phone(
  phone_value text
)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  digits text;
begin
  digits := pg_catalog.regexp_replace(
    phone_value,
    '[^0-9]',
    '',
    'g'
  );

  if digits ~ '^84[0-9]{9,10}$' then
    return '0' || pg_catalog.substr(digits, 3);
  end if;

  if digits ~ '^0[0-9]{9,10}$' then
    return digits;
  end if;

  if digits ~ '^[0-9]{9,10}$' then
    return '0' || digits;
  end if;

  return digits;
end;
$$;

revoke all on function public.normalize_vietnam_phone(text)
from public, anon, authenticated;


create sequence public.student_public_code_seq
as bigint
start with 1
increment by 1
minvalue 1
no maxvalue
cache 1;

revoke all on sequence public.student_public_code_seq
from public, anon, authenticated;


create or replace function public.next_student_public_code()
returns text
language sql
volatile
set search_path = ''
as $$
  with sequence_value as (
    select pg_catalog.nextval(
      'public.student_public_code_seq'::pg_catalog.regclass
    ) as value
  )
  select
    'TV-'
    || pg_catalog.to_char(current_date, 'YYYY')
    || '-'
    || case
      when pg_catalog.length(value::text) < 5
        then pg_catalog.lpad(value::text, 5, '0')
      else value::text
    end
  from sequence_value;
$$;

revoke all on function public.next_student_public_code()
from public, anon, authenticated;


-- =========================================================
-- GUARDIANS
-- =========================================================

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  normalized_phone text generated always as (
    public.normalize_vietnam_phone(phone)
  ) stored,
  zalo text,
  email text,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint guardians_full_name_check
    check (
      full_name = pg_catalog.btrim(full_name)
      and full_name <> ''
    ),

  constraint guardians_phone_check
    check (
      phone = pg_catalog.btrim(phone)
      and phone <> ''
    ),

  constraint guardians_normalized_phone_check
    check (normalized_phone ~ '^0[0-9]{9,10}$'),

  constraint guardians_zalo_check
    check (
      zalo is null
      or (
        zalo = pg_catalog.btrim(zalo)
        and zalo <> ''
      )
    ),

  constraint guardians_email_check
    check (
      email is null
      or (
        email = pg_catalog.lower(pg_catalog.btrim(email))
        and email <> ''
      )
    ),

  constraint guardians_notes_check
    check (
      notes is null
      or pg_catalog.btrim(notes) <> ''
    )
);

create unique index guardians_normalized_phone_unique_idx
on public.guardians (normalized_phone);

create index guardians_created_at_idx
on public.guardians (created_at desc);

create trigger guardians_set_updated_at
before update on public.guardians
for each row execute function public.set_updated_at();


-- =========================================================
-- STUDENTS
-- =========================================================

create table public.students (
  id uuid primary key default gen_random_uuid(),
  public_code text not null default public.next_student_public_code(),
  full_name text not null,
  nickname text,
  birth_year smallint not null,
  province_city text,
  current_grade smallint not null,
  lifecycle_status text not null default 'interested',
  learning_level text,
  registered_mode text,
  official_start_date date,
  learning_goal text,
  internal_notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint students_public_code_format_check
    check (public_code ~ '^TV-[0-9]{4}-[0-9]{5,}$'),

  constraint students_full_name_check
    check (
      full_name = pg_catalog.btrim(full_name)
      and full_name <> ''
    ),

  constraint students_nickname_check
    check (
      nickname is null
      or (
        nickname = pg_catalog.btrim(nickname)
        and nickname <> ''
      )
    ),

  constraint students_birth_year_check
    check (birth_year between 1990 and 2100),

  constraint students_province_city_check
    check (
      province_city is null
      or (
        province_city = pg_catalog.btrim(province_city)
        and province_city <> ''
      )
    ),

  constraint students_current_grade_check
    check (current_grade between 1 and 12),

  constraint students_lifecycle_status_check
    check (
      lifecycle_status in (
        'interested',
        'trial_booked',
        'trial_completed',
        'pending_enrollment_confirmation',
        'active',
        'reserved',
        'resumed',
        'waiting_class',
        'completed'
      )
    ),

  constraint students_learning_level_check
    check (
      learning_level is null
      or learning_level in ('A', 'B', 'CLC')
    ),

  constraint students_registered_mode_check
    check (
      registered_mode is null
      or registered_mode in ('online', 'offline')
    ),

  constraint students_learning_goal_check
    check (
      learning_goal is null
      or pg_catalog.btrim(learning_goal) <> ''
    ),

  constraint students_internal_notes_check
    check (
      internal_notes is null
      or pg_catalog.btrim(internal_notes) <> ''
    )
);

create unique index students_public_code_unique_idx
on public.students (public_code);

create index students_lifecycle_status_idx
on public.students (lifecycle_status, created_at desc);

create index students_grade_idx
on public.students (current_grade, lifecycle_status);

create index students_created_at_idx
on public.students (created_at desc);

alter sequence public.student_public_code_seq
owned by public.students.public_code;

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();


-- =========================================================
-- STUDENT / GUARDIAN LINKS
-- =========================================================

create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.students(id) on delete restrict,
  guardian_id uuid not null
    references public.guardians(id) on delete restrict,
  relationship text not null,
  is_primary boolean not null default false,
  linked_at timestamptz not null default pg_catalog.now(),
  linked_by uuid references public.profiles(id) on delete restrict,
  ended_at timestamptz,
  ended_by uuid references public.profiles(id) on delete restrict,
  end_reason text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint student_guardians_relationship_check
    check (
      relationship = pg_catalog.btrim(relationship)
      and relationship <> ''
    ),

  constraint student_guardians_end_time_check
    check (
      ended_at is null
      or ended_at >= linked_at
    ),

  constraint student_guardians_end_state_check
    check (
      (
        ended_at is null
        and ended_by is null
        and end_reason is null
      )
      or
      (
        ended_at is not null
        and end_reason is not null
        and pg_catalog.btrim(end_reason) <> ''
      )
    )
);

create unique index student_guardians_active_unique_idx
on public.student_guardians (student_id, guardian_id)
where ended_at is null;

create unique index student_guardians_one_primary_idx
on public.student_guardians (student_id)
where is_primary and ended_at is null;

create index student_guardians_guardian_active_idx
on public.student_guardians (guardian_id, student_id)
where ended_at is null;

create index student_guardians_student_history_idx
on public.student_guardians (student_id, linked_at desc);

create trigger student_guardians_set_updated_at
before update on public.student_guardians
for each row execute function public.set_updated_at();


-- =========================================================
-- HISTORY PROTECTION
-- =========================================================

create or replace function public.protect_student_public_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.public_code is distinct from old.public_code then
    raise exception using
      errcode = '23514',
      message = 'STUDENT_PUBLIC_CODE_IS_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_student_public_code()
from public, anon, authenticated;

create trigger students_protect_public_code
before update of public_code on public.students
for each row execute function public.protect_student_public_code();


create or replace function public.protect_student_guardian_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.ended_at is not null then
    raise exception using
      errcode = '23514',
      message = 'ENDED_STUDENT_GUARDIAN_LINK_IS_IMMUTABLE';
  end if;

  if new.id is distinct from old.id
    or new.student_id is distinct from old.student_id
    or new.guardian_id is distinct from old.guardian_id
    or new.linked_at is distinct from old.linked_at
    or new.linked_by is distinct from old.linked_by
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'STUDENT_GUARDIAN_LINK_HISTORY_IS_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_student_guardian_history()
from public, anon, authenticated;

create trigger student_guardians_protect_history
before update on public.student_guardians
for each row execute function public.protect_student_guardian_history();


create or replace function public.prevent_student_foundation_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'STUDENT_FOUNDATION_HARD_DELETE_FORBIDDEN';
end;
$$;

revoke all on function public.prevent_student_foundation_delete()
from public, anon, authenticated;

create trigger guardians_prevent_delete
before delete on public.guardians
for each row execute function public.prevent_student_foundation_delete();

create trigger students_prevent_delete
before delete on public.students
for each row execute function public.prevent_student_foundation_delete();

create trigger student_guardians_prevent_delete
before delete on public.student_guardians
for each row execute function public.prevent_student_foundation_delete();


-- =========================================================
-- AUDIT
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

revoke all on function public.audit_student_foundation_change()
from public, anon, authenticated;

create trigger guardians_audit_changes
after insert or update on public.guardians
for each row execute function public.audit_student_foundation_change();

create trigger students_audit_changes
after insert or update on public.students
for each row execute function public.audit_student_foundation_change();

create trigger student_guardians_audit_changes
after insert or update on public.student_guardians
for each row execute function public.audit_student_foundation_change();


-- =========================================================
-- PERMISSIONS
-- =========================================================

insert into public.permissions (
  code,
  module,
  name,
  description
)
values (
  'guardians.view',
  'guardians',
  'Xem phụ huynh',
  'Xem hồ sơ phụ huynh và liên kết học viên.'
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
join public.permissions as permission
  on permission.code = 'guardians.view'
where role.code = 'owner'
on conflict (role_id, permission_id) do nothing;


-- =========================================================
-- RLS AND GRANTS
-- =========================================================

alter table public.guardians enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;

create policy guardians_select_authorized
on public.guardians
for select
to authenticated
using (
  public.has_permission('guardians.view')
  or public.has_permission('students.view')
);

create policy students_select_authorized
on public.students
for select
to authenticated
using (public.has_permission('students.view'));

create policy student_guardians_select_authorized
on public.student_guardians
for select
to authenticated
using (
  public.has_permission('guardians.view')
  or public.has_permission('students.view')
);

revoke all privileges on table
  public.guardians,
  public.students,
  public.student_guardians
from public, anon, authenticated;

grant select on table
  public.guardians,
  public.students,
  public.student_guardians
to authenticated;

commit;
