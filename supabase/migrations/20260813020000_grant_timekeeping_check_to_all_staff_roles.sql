-- Grant timekeeping.check permission to all active staff roles
-- Migration: 20260813020000_grant_timekeeping_check_to_all_staff_roles.sql

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
where permission.code = 'timekeeping.check'
  and role.is_active = true
on conflict (role_id, permission_id) do nothing;
