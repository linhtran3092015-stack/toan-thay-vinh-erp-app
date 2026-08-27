begin;

select plan(7);

select ok(
  exists(select 1 from public.permissions where code = 'payroll.dashboard.view'),
  'owner payroll dashboard permission exists'
);

select ok(
  exists(
    select 1
    from public.role_permissions as assignment
    join public.roles as role on role.id = assignment.role_id
    join public.permissions as permission on permission.id = assignment.permission_id
    where role.code = 'owner' and permission.code = 'payroll.dashboard.view'
  ),
  'owner receives the dashboard permission through existing RBAC'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_owner_payroll_dashboard(date,text)',
    'execute'
  ),
  'authenticated can invoke the permission-gated RPC'
);

select throws_ok(
  $$ select public.get_owner_payroll_dashboard('2026-08-01', null) $$,
  '42501',
  'AUTHENTICATED_USER_REQUIRED',
  'anonymous callers cannot read owner payroll analytics'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('98000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'dashboard-owner@example.test', '{"provider":"email"}', '{"full_name":"Dashboard Owner"}', now(), now()),
  ('98000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'dashboard-staff@example.test', '{"provider":"email"}', '{"full_name":"Dashboard Staff"}', now(), now());

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '98000000-0000-4000-8000-000000000001', id, 'Owner payroll dashboard test'
from public.roles where code = 'owner';

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '98000000-0000-4000-8000-000000000002', id, 'Owner payroll dashboard denial test'
from public.roles where code = 'teaching_assistant';

select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000002', true);

select throws_ok(
  $$ select public.get_owner_payroll_dashboard('2026-08-01', null) $$,
  '42501',
  'PAYROLL_DASHBOARD_VIEW_PERMISSION_REQUIRED',
  'ordinary payroll viewers cannot read center-wide analytics'
);

select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true);

select is(
  public.get_owner_payroll_dashboard('2026-08-01', null)->>'selectedMonth',
  '2026-08-01',
  'owner receives the requested normalized month'
);

select throws_ok(
  $$ select public.get_owner_payroll_dashboard('2026-08-09', null) $$,
  '22023',
  'PAYROLL_DASHBOARD_MONTH_INVALID',
  'RPC rejects a date that is not the first day of a month'
);

select * from finish();

rollback;
