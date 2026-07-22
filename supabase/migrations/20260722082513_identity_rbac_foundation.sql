begin;

-- Shared timestamp trigger. The empty search path keeps name resolution explicit.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  display_name text,
  avatar_url text,
  phone text,
  employee_code text,
  employment_status text not null default 'active',
  joined_at date,
  left_at date,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_normalized_check
    check (email = pg_catalog.lower(pg_catalog.btrim(email)) and email <> ''),
  constraint profiles_employee_code_trimmed_check
    check (
      employee_code is null
      or (employee_code = pg_catalog.btrim(employee_code) and employee_code <> '')
    ),
  constraint profiles_employment_status_check
    check (employment_status in ('active', 'inactive', 'suspended')),
  constraint profiles_left_at_status_check
    check (left_at is null or employment_status = 'inactive'),
  constraint profiles_employment_dates_check
    check (left_at is null or joined_at is null or left_at >= joined_at)
);

create unique index profiles_email_lower_unique_idx
on public.profiles (pg_catalog.lower(email));

create unique index profiles_employee_code_lower_unique_idx
on public.profiles (pg_catalog.lower(employee_code))
where employee_code is not null;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  initial_display_name text;
  initial_avatar_url text;
begin
  normalized_email := pg_catalog.lower(pg_catalog.btrim(new.email));

  if normalized_email is null or normalized_email = '' then
    raise exception using
      errcode = '23502',
      message = 'AUTH_USER_EMAIL_REQUIRED';
  end if;

  initial_display_name := coalesce(
    nullif(
      pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'),
      ''
    ),
    nullif(
      pg_catalog.btrim(new.raw_user_meta_data ->> 'name'),
      ''
    )
  );
  initial_avatar_url := nullif(
    pg_catalog.btrim(new.raw_user_meta_data ->> 'avatar_url'),
    ''
  );

  insert into public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    employment_status
  )
  values (
    new.id,
    normalized_email,
    initial_display_name,
    initial_avatar_url,
    'active'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = pg_catalog.now();

  return new;
end;
$$;

revoke all on function public.handle_auth_user_created()
from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

-- Backfill profiles for Auth users created before this migration.
insert into public.profiles (
  id,
  email,
  display_name,
  avatar_url,
  employment_status
)
select
  auth_user.id,
  pg_catalog.lower(pg_catalog.btrim(auth_user.email)),
  coalesce(
    nullif(
      pg_catalog.btrim(auth_user.raw_user_meta_data ->> 'full_name'),
      ''
    ),
    nullif(
      pg_catalog.btrim(auth_user.raw_user_meta_data ->> 'name'),
      ''
    )
  ),
  nullif(
    pg_catalog.btrim(auth_user.raw_user_meta_data ->> 'avatar_url'),
    ''
  ),
  'active'
from auth.users as auth_user
where auth_user.email is not null
  and pg_catalog.btrim(auth_user.email) <> ''
on conflict (id) do update
set
  email = excluded.email,
  updated_at = pg_catalog.now();

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_code_format_check
    check (code ~ '^[a-z][a-z0-9_]*$')
);

create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  module text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permissions_code_format_check
    check (code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint permissions_module_format_check
    check (module ~ '^[a-z][a-z0-9_]*$'),
  constraint permissions_module_matches_code_check
    check (pg_catalog.split_part(code, '.', 1) = module)
);

create trigger permissions_set_updated_at
before update on public.permissions
for each row execute function public.set_updated_at();

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete restrict,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete restrict,
  primary key (role_id, permission_id)
);

create table public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id) on delete restrict,
  assignment_reason text,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default now(),
  constraint user_role_assignments_assignment_reason_check
    check (
      assignment_reason is null
      or pg_catalog.btrim(assignment_reason) <> ''
    ),
  constraint user_role_assignments_revoked_at_check
    check (revoked_at is null or revoked_at >= assigned_at),
  constraint user_role_assignments_revocation_check
    check (
      (
        revoked_at is null
        and revoked_by is null
        and revocation_reason is null
      )
      or
      (
        revoked_at is not null
        and revocation_reason is not null
        and pg_catalog.btrim(revocation_reason) <> ''
      )
    )
);

create unique index user_role_assignments_active_unique_idx
on public.user_role_assignments (user_id, role_id)
where revoked_at is null;

create index user_role_assignments_role_active_idx
on public.user_role_assignments (role_id, user_id)
where revoked_at is null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references public.profiles(id) on delete restrict,
  module text not null,
  action text not null,
  entity_type text,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  reason text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index audit_logs_occurred_at_idx
on public.audit_logs (occurred_at desc);

create index audit_logs_actor_time_idx
on public.audit_logs (actor_user_id, occurred_at desc)
where actor_user_id is not null;

create index audit_logs_entity_idx
on public.audit_logs (entity_type, entity_id)
where entity_type is not null and entity_id is not null;

create or replace function public.protect_role_code_after_use()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code
    and (
      exists (
        select 1
        from public.role_permissions
        where role_id = old.id
      )
      or exists (
        select 1
        from public.user_role_assignments
        where role_id = old.id
      )
    )
  then
    raise exception using
      errcode = '23514',
      message = 'ROLE_CODE_IMMUTABLE_AFTER_USE';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_role_code_after_use()
from public, anon, authenticated;

create trigger roles_protect_code_after_use
before update of code on public.roles
for each row execute function public.protect_role_code_after_use();

create or replace function public.protect_user_role_assignment_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is not null then
    raise exception using
      errcode = '23514',
      message = 'REVOKED_ROLE_ASSIGNMENT_IS_IMMUTABLE';
  end if;

  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.role_id is distinct from old.role_id
    or new.assigned_at is distinct from old.assigned_at
    or new.assigned_by is distinct from old.assigned_by
    or new.assignment_reason is distinct from old.assignment_reason
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'ROLE_ASSIGNMENT_HISTORY_IS_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_user_role_assignment_history()
from public, anon, authenticated;

create trigger user_role_assignments_protect_history
before update on public.user_role_assignments
for each row execute function public.protect_user_role_assignment_history();

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'AUDIT_LOGS_ARE_APPEND_ONLY';
end;
$$;

revoke all on function public.prevent_audit_log_mutation()
from public, anon, authenticated;

create trigger audit_logs_prevent_mutation
before update or delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

create or replace function public.audit_role_permission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  audit_action text;
  audit_entity_id text;
  audit_old_data jsonb;
  audit_new_data jsonb;
begin
  if tg_op = 'INSERT' then
    audit_action := 'role_permission_granted';
    audit_entity_id := new.role_id::text || ':' || new.permission_id::text;
    audit_old_data := null;
    audit_new_data := pg_catalog.to_jsonb(new);
  elsif tg_op = 'DELETE' then
    audit_action := 'role_permission_revoked';
    audit_entity_id := old.role_id::text || ':' || old.permission_id::text;
    audit_old_data := pg_catalog.to_jsonb(old);
    audit_new_data := null;
  else
    audit_action := 'role_permission_updated';
    audit_entity_id := new.role_id::text || ':' || new.permission_id::text;
    audit_old_data := pg_catalog.to_jsonb(old);
    audit_new_data := pg_catalog.to_jsonb(new);
  end if;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    actor_id,
    'rbac',
    audit_action,
    'role_permission',
    audit_entity_id,
    audit_old_data,
    audit_new_data,
    pg_catalog.jsonb_build_object(
      'source',
      case when actor_id is null then 'database' else 'authenticated_user' end
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.audit_role_permission_change()
from public, anon, authenticated;

create trigger role_permissions_audit_changes
after insert or update or delete on public.role_permissions
for each row execute function public.audit_role_permission_change();

create or replace function public.audit_user_role_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  audit_action text;
  audit_old_data jsonb;
begin
  if tg_op = 'INSERT' then
    audit_action := 'user_role_assigned';
    audit_old_data := null;
  elsif old.revoked_at is null and new.revoked_at is not null then
    audit_action := 'user_role_revoked';
    audit_old_data := pg_catalog.to_jsonb(old);
  else
    return new;
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
    'rbac',
    audit_action,
    'user_role_assignment',
    new.id::text,
    audit_old_data,
    pg_catalog.to_jsonb(new),
    case
      when audit_action = 'user_role_revoked' then new.revocation_reason
      else new.assignment_reason
    end,
    pg_catalog.jsonb_build_object(
      'source',
      case when actor_id is null then 'database' else 'authenticated_user' end
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_user_role_assignment_change()
from public, anon, authenticated;

create trigger user_role_assignments_audit_changes
after insert or update on public.user_role_assignments
for each row execute function public.audit_user_role_assignment_change();

create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    join public.user_role_assignments as assignment
      on assignment.user_id = profile.id
      and assignment.revoked_at is null
    join public.roles as role
      on role.id = assignment.role_id
      and role.is_active
    join public.role_permissions as role_permission
      on role_permission.role_id = role.id
    join public.permissions as permission
      on permission.id = role_permission.permission_id
      and permission.is_active
    where profile.id = (select auth.uid())
      and profile.employment_status = 'active'
      and permission.code = required_permission
  );
$$;

revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated;

create or replace function public.get_my_permissions()
returns table(permission_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct permission.code as permission_code
  from public.profiles as profile
  join public.user_role_assignments as assignment
    on assignment.user_id = profile.id
    and assignment.revoked_at is null
  join public.roles as role
    on role.id = assignment.role_id
    and role.is_active
  join public.role_permissions as role_permission
    on role_permission.role_id = role.id
  join public.permissions as permission
    on permission.id = role_permission.permission_id
    and permission.is_active
  where profile.id = (select auth.uid())
    and profile.employment_status = 'active'
  order by permission.code;
$$;

revoke all on function public.get_my_permissions() from public, anon;
grant execute on function public.get_my_permissions() to authenticated;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_role_assignments enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own_or_staff
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.has_permission('staff.view')
);

create policy roles_select_authorized
on public.roles
for select
to authenticated
using (
  public.has_permission('app.access')
  or public.has_permission('staff.roles.view')
);

create policy permissions_select_authorized
on public.permissions
for select
to authenticated
using (
  public.has_permission('app.access')
  or public.has_permission('staff.roles.view')
);

create policy role_permissions_select_managers
on public.role_permissions
for select
to authenticated
using (public.has_permission('staff.roles.view'));

create policy user_role_assignments_select_own_or_managers
on public.user_role_assignments
for select
to authenticated
using (
  (user_id = (select auth.uid()) and revoked_at is null)
  or public.has_permission('staff.roles.view')
);

create policy audit_logs_select_auditors
on public.audit_logs
for select
to authenticated
using (public.has_permission('audit.view'));

revoke all privileges on table
  public.profiles,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_role_assignments,
  public.audit_logs
from public, anon, authenticated;

grant select on table
  public.profiles,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_role_assignments,
  public.audit_logs
to authenticated;

insert into public.roles (
  code,
  name,
  description,
  is_system
)
values
  ('owner', 'Chủ trung tâm', 'Quyền quản trị cao nhất của trung tâm.', true),
  ('accountant', 'Kế toán', 'Phụ trách nghiệp vụ kế toán được cấp riêng.', true),
  ('operations_manager', 'Quản lý vận hành', 'Điều phối hoạt động vận hành trung tâm.', true),
  ('assistant_manager', 'Quản lý trợ lý', 'Quản lý nhóm trợ lý của trung tâm.', true),
  ('teaching_assistant', 'Trợ giảng', 'Hỗ trợ hoạt động giảng dạy.', true),
  ('admissions_specialist', 'Chuyên viên tuyển sinh', 'Thực hiện công việc tuyển sinh.', true),
  ('admissions_leader', 'Trưởng nhóm tuyển sinh', 'Điều phối nhóm tuyển sinh.', true),
  ('admissions_manager', 'Quản lý tuyển sinh', 'Quản lý hoạt động tuyển sinh.', true),
  ('collaborator', 'Cộng tác viên', 'Vai trò cộng tác theo phạm vi được cấp.', true)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system;

insert into public.permissions (
  code,
  module,
  name,
  description
)
values
  ('app.access', 'app', 'Truy cập hệ thống', 'Cho phép truy cập khu vực ứng dụng sau khi xác thực.'),
  ('students.view', 'students', 'Xem học viên', 'Xem danh sách và hồ sơ học viên.'),
  ('students.create', 'students', 'Tạo học viên', 'Tạo hồ sơ học viên mới.'),
  ('students.update', 'students', 'Cập nhật học viên', 'Cập nhật thông tin hồ sơ học viên.'),
  ('students.manage_status', 'students', 'Quản lý trạng thái học viên', 'Thay đổi trạng thái vòng đời học viên.'),
  ('coaching.view', 'coaching', 'Xem coaching', 'Xem hồ sơ coaching được phép.'),
  ('session_ledger.view', 'session_ledger', 'Xem sổ buổi học', 'Xem sổ cái và số dư buổi học.'),
  ('audit.view', 'audit', 'Xem nhật ký hệ thống', 'Xem audit log theo phạm vi được cấp.'),
  ('staff.view', 'staff', 'Xem nhân sự', 'Xem hồ sơ nhân sự.'),
  ('staff.roles.view', 'staff', 'Xem vai trò và quyền', 'Xem danh mục vai trò, quyền và assignment.'),
  ('staff.roles.manage', 'staff', 'Quản lý vai trò và quyền', 'Quản lý role-permission và assignment qua luồng server được duyệt.')
on conflict (code) do update
set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

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
on conflict (role_id, permission_id) do nothing;

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
  on permission.code = 'app.access'
where role.code in (
  'accountant',
  'operations_manager',
  'assistant_manager',
  'teaching_assistant',
  'admissions_specialist',
  'admissions_leader',
  'admissions_manager',
  'collaborator'
)
on conflict (role_id, permission_id) do nothing;

commit;
