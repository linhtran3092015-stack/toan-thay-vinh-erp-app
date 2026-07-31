begin;

-- Task 9F v1 is limited to student import.
--
-- This migration adds only the authorization contract.
-- Import batches, staging rows, validation and commit workflows
-- are introduced in later migrations after their contracts are locked.

do $$
declare
  existing_permission_count integer;
  active_owner_count integer;
begin
  select pg_catalog.count(*)
  into existing_permission_count
  from public.permissions
  where code = 'imports.students';

  if existing_permission_count <> 0 then
    raise exception
      'IMPORTS_STUDENTS_PERMISSION_ALREADY_EXISTS';
  end if;

  select pg_catalog.count(*)
  into active_owner_count
  from public.roles
  where code = 'owner'
    and is_active = true;

  if active_owner_count <> 1 then
    raise exception
      'EXACTLY_ONE_ACTIVE_OWNER_ROLE_REQUIRED';
  end if;
end;
$$;

insert into public.permissions (
  code,
  module,
  name,
  description,
  is_active
)
values (
  'imports.students',
  'imports',
  'Import học viên',
  'Tải file, kiểm tra dry-run và xác nhận import hồ sơ học viên cùng phụ huynh chính.',
  true
);

-- Task 9F starts with least privilege.
-- Only the Owner role receives student-import access initially.
-- Additional role grants must be reviewed separately.
insert into public.role_permissions (
  role_id,
  permission_id,
  granted_by
)
select
  role_definition.id,
  permission.id,
  null
from public.roles as role_definition
join public.permissions as permission
  on permission.code = 'imports.students'
where role_definition.code = 'owner'
  and role_definition.is_active = true;

do $$
declare
  owner_grant_count integer;
begin
  select pg_catalog.count(*)
  into owner_grant_count
  from public.role_permissions as role_permission
  join public.roles as role_definition
    on role_definition.id = role_permission.role_id
  join public.permissions as permission
    on permission.id = role_permission.permission_id
  where role_definition.code = 'owner'
    and role_definition.is_active = true
    and permission.code = 'imports.students'
    and permission.is_active = true;

  if owner_grant_count <> 1 then
    raise exception
      'OWNER_IMPORTS_STUDENTS_GRANT_NOT_CREATED';
  end if;
end;
$$;

commit;
