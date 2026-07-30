-- TASK 9B: Role-aware Dashboard permission foundation.
--
-- This migration only adds the dashboard.view permission and grants it to
-- active ERP roles that already receive app.access. Dashboard widgets must
-- still be filtered by each underlying domain permission; dashboard.view
-- alone does not grant access to Finance, Staff, Payroll, Coaching or other
-- protected domain data.

insert into public.permissions (
  code,
  module,
  name,
  description
)
values (
  'dashboard.view',
  'dashboard',
  'Xem Dashboard',
  'Cho phép truy cập trang tổng quan; nội dung từng khối tiếp tục được giới hạn theo quyền nghiệp vụ tương ứng.'
)
on conflict (code) do update
set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  role.id,
  permission.id
from public.roles as role
cross join public.permissions as permission
where permission.code = 'dashboard.view'
  and role.is_active = true
  and exists (
    select 1
    from public.role_permissions as existing_assignment
    join public.permissions as existing_permission
      on existing_permission.id = existing_assignment.permission_id
    where existing_assignment.role_id = role.id
      and existing_permission.code = 'app.access'
  )
on conflict (role_id, permission_id) do nothing;
