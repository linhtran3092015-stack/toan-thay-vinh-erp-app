insert into public.permissions (
  code,
  module,
  name,
  description
)
values (
  'reports.view',
  'reports',
  'Xem trung tâm Báo cáo',
  'Cho phép truy cập trang Báo cáo; dữ liệu của từng báo cáo vẫn yêu cầu quyền module nghiệp vụ tương ứng.'
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
  role_record.id,
  reports_permission.id
from public.roles as role_record
cross join public.permissions as reports_permission
where role_record.is_active = true
  and reports_permission.code = 'reports.view'
  and exists (
    select 1
    from public.role_permissions as app_role_permission
    join public.permissions as app_permission
      on app_permission.id = app_role_permission.permission_id
    where app_role_permission.role_id = role_record.id
      and app_permission.code = 'app.access'
  )
  and exists (
    select 1
    from public.role_permissions as domain_role_permission
    join public.permissions as domain_permission
      on domain_permission.id = domain_role_permission.permission_id
    where domain_role_permission.role_id = role_record.id
      and domain_permission.code in (
        'students.view',
        'classes.view',
        'sessions.view',
        'finance.view',
        'sepay.view',
        'session_ledger.view',
        'crm.view',
        'staff.view',
        'timekeeping.view',
        'payroll.view',
        'advances.view',
        'grading_credits.view',
        'commissions.view',
        'coaching.view'
      )
  )
on conflict (role_id, permission_id) do nothing;
