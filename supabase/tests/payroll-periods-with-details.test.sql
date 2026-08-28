begin;

select plan(18);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'payroll-ordinary@example.test', '{"provider":"email"}', '{"full_name":"Mina Ordinary"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'payroll-manager@example.test', '{"provider":"email"}', '{"full_name":"Payroll Manager"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'payroll-reconcile@example.test', '{"provider":"email"}', '{"full_name":"Payroll Reconcile"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'payroll-owner@example.test', '{"provider":"email"}', '{"full_name":"Payroll Owner"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'payroll-other@example.test', '{"provider":"email"}', '{"full_name":"Ada Other"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'payroll-no-lines@example.test', '{"provider":"email"}', '{"full_name":"No Lines"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'payroll-no-access@example.test', '{"provider":"email"}', '{"full_name":"No Access"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00');

update public.profiles
set employee_code = case id
  when '10000000-0000-0000-0000-000000000001'::uuid then 'EMP-ORD'
  when '10000000-0000-0000-0000-000000000005'::uuid then 'EMP-OTHER'
  when '10000000-0000-0000-0000-000000000006'::uuid then 'EMP-NOLINES'
  else null
end
where id between '10000000-0000-0000-0000-000000000001'::uuid
  and '10000000-0000-0000-0000-000000000007'::uuid;

insert into public.roles (id, code, name)
values
  ('20000000-0000-0000-0000-000000000001', 'payroll0ordinary', 'Payroll 0 ordinary'),
  ('20000000-0000-0000-0000-000000000002', 'payroll0manage', 'Payroll 0 manage'),
  ('20000000-0000-0000-0000-000000000003', 'payroll0reconcile', 'Payroll 0 reconcile'),
  ('20000000-0000-0000-0000-000000000004', 'payroll0owner', 'Payroll 0 owner');

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
join public.permissions as permission
  on permission.code = any (
    case role.code
      when 'payroll0ordinary' then array['payroll.view']
      when 'payroll0manage' then array['payroll.view', 'payroll.manage']
      when 'payroll0reconcile' then array['payroll.view', 'payroll.accountant_reconcile']
      when 'payroll0owner' then array['payroll.view', 'payroll.owner_approve']
    end
  )
where role.code like 'payroll0%';

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Payroll 0 read contract fixture'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Payroll 0 read contract fixture'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Payroll 0 read contract fixture'),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'Payroll 0 read contract fixture');

insert into public.payroll_periods (
  id,
  period_month,
  pay_date,
  status,
  generated_by,
  generated_at,
  reviewed_by,
  reviewed_at,
  approved_by,
  approved_at,
  feedback_opened_at,
  feedback_closed_at,
  feedback_closed_by
)
values
  ('30000000-0000-0000-0000-000000000001', '2026-03-01', '2026-04-28', 'approved', '10000000-0000-0000-0000-000000000002', '2026-04-28 00:00:00+00', '10000000-0000-0000-0000-000000000003', '2026-04-28 00:01:00+00', '10000000-0000-0000-0000-000000000004', '2026-04-28 00:02:00+00', '2026-04-28 00:00:00+00', '2026-04-28 00:01:00+00', '10000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000002', '2026-04-01', '2026-05-28', 'review',   '10000000-0000-0000-0000-000000000002', '2026-05-28 00:00:00+00', '10000000-0000-0000-0000-000000000003', '2026-05-28 00:01:00+00', null, null,                                           '2026-05-28 00:00:00+00', '2026-05-28 00:01:00+00', '10000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000003', '2026-05-01', '2026-06-28', 'draft',    '10000000-0000-0000-0000-000000000002', '2026-06-28 00:00:00+00', null, null, null, null,                                                                                                '2026-06-28 00:00:00+00', null, null);

insert into public.payroll_calculation_runs (
  id,
  payroll_period_id,
  revision,
  status,
  reason,
  generated_by,
  generated_at
)
values
  ('35000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'current', 'Kỳ lương tháng 3 - dữ liệu fixture test.', '10000000-0000-0000-0000-000000000002', '2026-04-28 00:00:00+00'),
  ('35000000-0000-0000-0000-000000000099', '30000000-0000-0000-0000-000000000002', 1, 'superseded', 'Kỳ lương tháng 4 - revision 1 stale.', '10000000-0000-0000-0000-000000000002', '2026-05-27 00:00:00+00'),
  ('35000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 2, 'current', 'Kỳ lương tháng 4 - revision 2 current.', '10000000-0000-0000-0000-000000000002', '2026-05-28 00:00:00+00'),
  ('35000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 1, 'current', 'Kỳ lương tháng 5 - dữ liệu fixture test.', '10000000-0000-0000-0000-000000000002', '2026-06-28 00:00:00+00');

-- Set current_calculation_run_id on fixture periods.
-- Bypass protect trigger which only allows draft→draft run-id transitions;
-- these are approved/review/draft fixture periods not going through the normal workflow.
set local session_replication_role = 'replica';
update public.payroll_periods
set current_calculation_run_id = case id
  when '30000000-0000-0000-0000-000000000001' then '35000000-0000-0000-0000-000000000001'::uuid
  when '30000000-0000-0000-0000-000000000002' then '35000000-0000-0000-0000-000000000002'::uuid
  when '30000000-0000-0000-0000-000000000003' then '35000000-0000-0000-0000-000000000003'::uuid
end
where id in (
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000003'
);
set local session_replication_role = 'origin';

insert into public.payroll_statements (
  id,
  payroll_period_id,
  calculation_run_id,
  staff_id,
  staff_display_name_snapshot,
  staff_employee_code_snapshot,
  work_units,
  work_hours,
  work_minutes,
  created_at
)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Ada Other', 'EMP-OTHER', 1, 9, 540, '2026-04-28 00:03:00+00'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'No Lines', 'EMP-NOLINES', 0, 0, 0, '2026-04-28 00:04:00+00'),
  ('40000000-0000-0000-0000-000000000099', '30000000-0000-0000-0000-000000000002', '35000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000001', 'Mina Ordinary', 'EMP-ORD', 1, 9, 540, '2026-05-27 00:03:00+00'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '35000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'Ada Other', 'EMP-OTHER', 1, 9, 540, '2026-05-28 00:03:00+00'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '35000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Mina Ordinary', 'EMP-ORD', 2, 18, 1080, '2026-05-28 00:04:00+00');

insert into public.payroll_line_items (
  id,
  payroll_statement_id,
  line_type,
  direction,
  amount_vnd,
  note,
  created_at
)
values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'manual_reward', 'earning', 400000, 'Other March reward', '2026-04-28 00:05:00+00'),
  ('50000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000099', 'manual_reward', 'earning', 999999, 'Ordinary Stale reward', '2026-05-27 00:05:00+00'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', 'manual_reward', 'earning', 500000, 'Other April reward', '2026-05-28 00:05:00+00'),
  ('50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000004', 'manual_reward', 'earning', 1000000, 'Ordinary April reward', '2026-05-28 00:06:00+00'),
  ('50000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000004', 'manual_deduction', 'deduction', 100000, 'Ordinary April deduction', '2026-05-28 00:06:00+00');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000007', true);

select throws_ok(
  $$ select * from public.get_payroll_periods_with_details() $$,
  '42501',
  'PAYROLL_VIEW_PERMISSION_REQUIRED',
  'payroll.view is mandatory'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*) from public.get_payroll_periods_with_details()),
  2::bigint,
  'ordinary viewer sees only rows from their own visible statement'
);

select is(
  (select count(*) from public.get_payroll_periods_with_details() where payroll_period_id = '30000000-0000-0000-0000-000000000001'),
  0::bigint,
  'ordinary viewer cannot learn an unrelated period'
);

select is(
  (select count(*) from public.get_payroll_periods_with_details() where payroll_statement_id = '40000000-0000-0000-0000-000000000003'),
  0::bigint,
  'ordinary viewer cannot see another staff statement'
);

select is(
  (select count(*) from public.get_payroll_periods_with_details() where payroll_line_item_id = '50000000-0000-0000-0000-000000000002'),
  0::bigint,
  'ordinary viewer cannot see another staff line'
);

select results_eq(
  $$
    select
      period_month,
      period_status,
      staff_display_name,
      staff_employee_code,
      work_units,
      work_hours,
      total_earnings_vnd,
      total_deductions_vnd,
      payable_amount_vnd,
      line_type,
      line_direction,
      line_amount_vnd,
      unit_count,
      unit_rate_vnd,
      note
    from public.get_payroll_periods_with_details()
  $$,
  $$
    values
      ('2026-04-01'::date, 'review'::text, 'Mina Ordinary'::text, 'EMP-ORD'::text, 2, 18, 1000000::bigint, 100000::bigint, 900000::bigint, 'manual_reward'::text, 'earning'::text, 1000000::bigint, null::integer, null::bigint, 'Ordinary April reward'::text),
      ('2026-04-01'::date, 'review'::text, 'Mina Ordinary'::text, 'EMP-ORD'::text, 2, 18, 1000000::bigint, 100000::bigint, 900000::bigint, 'manual_deduction'::text, 'deduction'::text, 100000::bigint, null::integer, null::bigint, 'Ordinary April deduction'::text)
  $$,
  'ordinary viewer receives their stored statement totals and immutable line values unchanged'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.get_payroll_periods_with_details() where payroll_period_id = '30000000-0000-0000-0000-000000000003' and payroll_statement_id is null),
  1::bigint,
  'payroll.manage viewer sees the zero-statement draft period as a null-statement row'
);

select is(
  (select period_status from public.get_payroll_periods_with_details() where payroll_period_id = '30000000-0000-0000-0000-000000000003'),
  'draft',
  'stored draft status is not normalized'
);

select is(
  (select count(*) from public.get_payroll_periods_with_details() where payroll_statement_id = '40000000-0000-0000-0000-000000000002' and payroll_line_item_id is null),
  1::bigint,
  'a real statement with zero lines remains a null-line row'
);

select results_eq(
  $$
    select period_month, payroll_statement_id, payroll_line_item_id
    from public.get_payroll_periods_with_details()
  $$,
  $$
    values
      ('2026-05-01'::date, null::uuid, null::uuid),
      ('2026-04-01'::date, '40000000-0000-0000-0000-000000000003'::uuid, '50000000-0000-0000-0000-000000000002'::uuid),
      ('2026-04-01'::date, '40000000-0000-0000-0000-000000000004'::uuid, '50000000-0000-0000-0000-000000000010'::uuid),
      ('2026-04-01'::date, '40000000-0000-0000-0000-000000000004'::uuid, '50000000-0000-0000-0000-000000000011'::uuid),
      ('2026-03-01'::date, '40000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid),
      ('2026-03-01'::date, '40000000-0000-0000-0000-000000000002'::uuid, null::uuid)
  $$,
  'rows use deterministic period, staff, statement, line-created-at, and line-id ordering'
);

select results_eq(
  $$
    select total_earnings_vnd, total_deductions_vnd, payable_amount_vnd
    from public.get_payroll_periods_with_details()
    where payroll_statement_id = '40000000-0000-0000-0000-000000000004'
    order by payroll_line_item_id
    limit 1
  $$,
  $$
    select total_earnings_vnd, total_deductions_vnd, payable_amount_vnd
    from public.get_payroll_dashboard()
    where payroll_statement_id = '40000000-0000-0000-0000-000000000004'
  $$,
  'new reader totals exactly match get_payroll_dashboard for the same statement'
);

create temporary table payroll_read_audit_count as
select count(*) as count_before from public.audit_logs;

select is(
  (select count(*) from public.get_payroll_periods_with_details()),
  6::bigint,
  'payroll.manage viewer sees all periods, statements, and lines'
);

select is(
  (select count(*) from public.audit_logs),
  (select count_before from payroll_read_audit_count),
  'reader invocation has no audit or accounting side effect'
);

select is(
  (select count(*) from public.get_payroll_periods_with_details() where payroll_statement_id = '40000000-0000-0000-0000-000000000099'),
  0::bigint,
  'stale calculation run statements from earlier revisions are never returned'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);

select is(
  (select count(*) from public.get_payroll_periods_with_details()),
  6::bigint,
  'payroll.accountant_reconcile viewer has elevated all-period visibility'
);

select is(
  (select distinct period_status from public.get_payroll_periods_with_details() where payroll_period_id = '30000000-0000-0000-0000-000000000002'),
  'review',
  'stored review status is returned unchanged'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);

select is(
  (select count(*) from public.get_payroll_periods_with_details()),
  6::bigint,
  'payroll.owner_approve viewer has elevated all-period visibility'
);

select is(
  (select distinct period_status from public.get_payroll_periods_with_details() where payroll_period_id = '30000000-0000-0000-0000-000000000001'),
  'approved',
  'stored approved status is returned unchanged'
);

select * from finish();

rollback;
