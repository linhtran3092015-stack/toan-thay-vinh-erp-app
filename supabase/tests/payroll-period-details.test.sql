begin;

select plan(40);

-- Same fixture shape as payroll-periods-with-details.test.sql: three periods
-- (Mar approved, Apr review with a superseded run, May draft without
-- statements), plus an older approved February without a calculation run so
-- the default list of three has something to leave out. Fictional staff and
-- amounts.
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
  ('11000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'scoped-ordinary@example.test', '{"provider":"email"}', '{"full_name":"Mina Ordinary"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('11000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'scoped-manager@example.test', '{"provider":"email"}', '{"full_name":"Payroll Manager"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('11000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'scoped-other@example.test', '{"provider":"email"}', '{"full_name":"Ada Other"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('11000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'scoped-no-lines@example.test', '{"provider":"email"}', '{"full_name":"No Lines"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('11000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'scoped-no-access@example.test', '{"provider":"email"}', '{"full_name":"No Access"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('11000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'scoped-reconcile@example.test', '{"provider":"email"}', '{"full_name":"Payroll Reconcile"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('11000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'scoped-owner@example.test', '{"provider":"email"}', '{"full_name":"Payroll Owner"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00');

insert into public.roles (id, code, name)
values
  ('21000000-0000-0000-0000-000000000001', 'payrollscopedordinary', 'Payroll scoped ordinary'),
  ('21000000-0000-0000-0000-000000000002', 'payrollscopedmanage', 'Payroll scoped manage'),
  ('21000000-0000-0000-0000-000000000003', 'payrollscopedreconcile', 'Payroll scoped reconcile'),
  ('21000000-0000-0000-0000-000000000004', 'payrollscopedowner', 'Payroll scoped owner');

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
join public.permissions as permission
  on permission.code = any (
    case role.code
      when 'payrollscopedordinary' then array['payroll.view']
      when 'payrollscopedmanage' then array['payroll.view', 'payroll.manage']
      when 'payrollscopedreconcile' then array['payroll.view', 'payroll.accountant_reconcile']
      when 'payrollscopedowner' then array['payroll.view', 'payroll.owner_approve']
    end
  )
where role.code like 'payrollscoped%';

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values
  ('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'Scoped payroll read fixture'),
  ('11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'Scoped payroll read fixture'),
  ('11000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-000000000001', 'Scoped payroll read fixture'),
  ('11000000-0000-0000-0000-000000000008', '21000000-0000-0000-0000-000000000003', 'Scoped payroll read fixture'),
  ('11000000-0000-0000-0000-000000000009', '21000000-0000-0000-0000-000000000004', 'Scoped payroll read fixture');

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
  ('31000000-0000-0000-0000-000000000004', '2026-02-01', '2026-03-28', 'approved', '11000000-0000-0000-0000-000000000002', '2026-03-28 00:00:00+00', '11000000-0000-0000-0000-000000000002', '2026-03-28 00:01:00+00', '11000000-0000-0000-0000-000000000002', '2026-03-28 00:02:00+00', '2026-03-28 00:00:00+00', '2026-03-28 00:01:00+00', '11000000-0000-0000-0000-000000000002'),
  ('31000000-0000-0000-0000-000000000001', '2026-03-01', '2026-04-28', 'approved', '11000000-0000-0000-0000-000000000002', '2026-04-28 00:00:00+00', '11000000-0000-0000-0000-000000000002', '2026-04-28 00:01:00+00', '11000000-0000-0000-0000-000000000002', '2026-04-28 00:02:00+00', '2026-04-28 00:00:00+00', '2026-04-28 00:01:00+00', '11000000-0000-0000-0000-000000000002'),
  ('31000000-0000-0000-0000-000000000002', '2026-04-01', '2026-05-28', 'review',   '11000000-0000-0000-0000-000000000002', '2026-05-28 00:00:00+00', '11000000-0000-0000-0000-000000000002', '2026-05-28 00:01:00+00', null, null, '2026-05-28 00:00:00+00', '2026-05-28 00:01:00+00', '11000000-0000-0000-0000-000000000002'),
  ('31000000-0000-0000-0000-000000000003', '2026-05-01', '2026-06-28', 'draft',    '11000000-0000-0000-0000-000000000002', '2026-06-28 00:00:00+00', null, null, null, null, '2026-06-28 00:00:00+00', null, null);

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
  ('36000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 1, 'current', 'Kỳ lương tháng 3 - fixture.', '11000000-0000-0000-0000-000000000002', '2026-04-28 00:00:00+00'),
  ('36000000-0000-0000-0000-000000000099', '31000000-0000-0000-0000-000000000002', 1, 'superseded', 'Kỳ lương tháng 4 - revision 1 cũ.', '11000000-0000-0000-0000-000000000002', '2026-05-27 00:00:00+00'),
  ('36000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 2, 'current', 'Kỳ lương tháng 4 - revision 2.', '11000000-0000-0000-0000-000000000002', '2026-05-28 00:00:00+00'),
  ('36000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000003', 1, 'current', 'Kỳ lương tháng 5 - fixture.', '11000000-0000-0000-0000-000000000002', '2026-06-28 00:00:00+00');

-- Fixture periods skip the normal workflow; bypass the run-id protect trigger.
set local session_replication_role = 'replica';
update public.payroll_periods
set current_calculation_run_id = case id
  when '31000000-0000-0000-0000-000000000001' then '36000000-0000-0000-0000-000000000001'::uuid
  when '31000000-0000-0000-0000-000000000002' then '36000000-0000-0000-0000-000000000002'::uuid
  when '31000000-0000-0000-0000-000000000003' then '36000000-0000-0000-0000-000000000003'::uuid
end
where id in (
  '31000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000002',
  '31000000-0000-0000-0000-000000000003'
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
  ('41000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000005', 'Ada Other', 'EMP-OTHER', 1, 9, 540, '2026-04-28 00:03:00+00'),
  ('41000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000006', 'No Lines', 'EMP-NOLINES', 0, 0, 0, '2026-04-28 00:04:00+00'),
  ('41000000-0000-0000-0000-000000000099', '31000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000099', '11000000-0000-0000-0000-000000000001', 'Mina Ordinary', 'EMP-ORD', 1, 9, 540, '2026-05-27 00:03:00+00'),
  ('41000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000005', 'Ada Other', 'EMP-OTHER', 1, 9, 540, '2026-05-28 00:03:00+00'),
  ('41000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'Mina Ordinary', 'EMP-ORD', 2, 18, 1080, '2026-05-28 00:04:00+00');

insert into public.payroll_line_items (
  id,
  payroll_statement_id,
  line_type,
  direction,
  amount_vnd,
  note,
  formula_snapshot,
  created_at
)
values
  ('51000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'manual_reward', 'earning', 400000, 'Other March reward', '{}', '2026-04-28 00:05:00+00'),
  ('51000000-0000-0000-0000-000000000099', '41000000-0000-0000-0000-000000000099', 'manual_reward', 'earning', 999999, 'Ordinary stale reward', '{}', '2026-05-27 00:05:00+00'),
  ('51000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000003', 'manual_reward', 'earning', 500000, 'Other April reward', '{}', '2026-05-28 00:05:00+00'),
  ('51000000-0000-0000-0000-000000000010', '41000000-0000-0000-0000-000000000004', 'manual_reward', 'earning', 1000000, 'Ordinary April reward', '{}', '2026-05-28 00:06:00+00'),
  ('51000000-0000-0000-0000-000000000011', '41000000-0000-0000-0000-000000000004', 'manual_deduction', 'deduction', 100000, 'Ordinary April deduction', '{}', '2026-05-28 00:06:00+00'),
  ('51000000-0000-0000-0000-000000000012', '41000000-0000-0000-0000-000000000004', 'piecework_offset', 'deduction', 300000, null, '{"base_salary_vnd": 2000000, "basis_points": 8500, "piecework_vnd": 700000}', '2026-05-28 00:07:00+00');

-- April: one blocking and one warning issue on the current run, one blocking
-- issue on the superseded run; one pending and one rejected correction request.
insert into public.payroll_calculation_issues (id, calculation_run_id, issue_code, severity)
values
  ('61000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000002', 'missing_grade', 'blocking'),
  ('61000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000002', 'missing_daily_rate', 'warning'),
  ('61000000-0000-0000-0000-000000000099', '36000000-0000-0000-0000-000000000099', 'missing_grade', 'blocking');

-- Fixture requests skip the feedback workflow; bypass the current-revision insert trigger.
set local session_replication_role = 'replica';
insert into public.payroll_correction_requests (
  id,
  payroll_period_id,
  payroll_statement_id,
  requested_by,
  request_message,
  status,
  resolved_by,
  resolved_at,
  response_message
)
values
  ('71000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000001', 'Pending fixture request', 'pending', null, null, null),
  ('71000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000005', 'Rejected fixture request', 'rejected', '11000000-0000-0000-0000-000000000002', '2026-05-28 00:08:00+00', 'Rejected in fixture');
set local session_replication_role = 'origin';

-- Value: protects=anonymous callers cannot read staff pay: execute is granted to authenticated only and a call without a user is refused;
-- fails_when=a later create or replace re-grants anon/public, or the AUTHENTICATED_USER_REQUIRED guard is dropped;
-- why_new=only the payroll.view denial was asserted; the other payroll readers' pgTAP files check both;
-- seam=none; no_claim=does not exercise PostgREST's own anon role mapping
select ok(
  pg_catalog.has_function_privilege('authenticated', 'public.get_payroll_period_details(uuid,uuid,integer,uuid)', 'execute'),
  'authenticated can invoke the scoped payroll reader'
);

select ok(
  not pg_catalog.has_function_privilege('anon', 'public.get_payroll_period_details(uuid,uuid,integer,uuid)', 'execute'),
  'anon cannot invoke the scoped payroll reader'
);

select throws_ok(
  $$ select public.get_payroll_period_details() $$,
  '42501',
  'AUTHENTICATED_USER_REQUIRED',
  'a call without a user is refused'
);

-- No payroll.view.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000007', true);

select throws_ok(
  $$ select public.get_payroll_period_details() $$,
  '42501',
  'PAYROLL_VIEW_PERMISSION_REQUIRED',
  'payroll.view is mandatory'
);

-- Ordinary viewer: own current-run statement only.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ select public.get_payroll_period_details(p_payroll_statement_id => '41000000-0000-0000-0000-000000000004') $$,
  '22023',
  'PAYROLL_PERIOD_REQUIRED',
  'a statement read names its period'
);

select throws_ok(
  $$ select public.get_payroll_period_details(p_period_limit => 0) $$,
  '22023',
  'PAYROLL_PERIOD_LIMIT_INVALID',
  'a list read asks for at least one period'
);

select throws_ok(
  $$ select public.get_payroll_period_details(p_period_limit => 61) $$,
  '22023',
  'PAYROLL_PERIOD_LIMIT_INVALID',
  'a list read asks for at most 60 periods'
);

select throws_ok(
  $$ select public.get_payroll_period_details(p_payroll_period_id => '31000000-0000-0000-0000-000000000002', p_period_limit => 3) $$,
  '22023',
  'PAYROLL_PERIOD_LIMIT_INVALID',
  'a single-period read takes no list limit'
);

select is(
  (
    select pg_catalog.jsonb_agg(period ->> 'id')
    from pg_catalog.jsonb_array_elements(public.get_payroll_period_details() -> 'periods') as period
  ),
  '["31000000-0000-0000-0000-000000000002"]'::jsonb,
  'ordinary viewer lists only the period that holds their current statement'
);

select is(
  (
    select pg_catalog.jsonb_agg(statement ->> 'id')
    from pg_catalog.jsonb_array_elements(public.get_payroll_period_details() -> 'periods') as period,
      pg_catalog.jsonb_array_elements(period -> 'statements') as statement
  ),
  '["41000000-0000-0000-0000-000000000004"]'::jsonb,
  'ordinary viewer sees no other staff statement and no superseded statement'
);

select is(
  (public.get_payroll_period_details(
    p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
    p_payroll_statement_id => '41000000-0000-0000-0000-000000000004'
  ) #> '{periods,0,statements,0}') - 'lines',
  '{
    "id": "41000000-0000-0000-0000-000000000004",
    "payrollPeriodId": "31000000-0000-0000-0000-000000000002",
    "staffId": "11000000-0000-0000-0000-000000000001",
    "staffDisplayName": "Mina Ordinary",
    "staffEmployeeCode": "EMP-ORD",
    "workUnits": 2,
    "workHours": 18,
    "workMinutes": 1080,
    "totalEarningsVnd": 1000000,
    "totalDeductionsVnd": 400000,
    "payableAmountVnd": 600000
  }'::jsonb,
  'statement read returns the stored snapshot fields and totals summed from the lines'
);

select is(
  (
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(line ->> 'id', line ->> 'lineType', line ->> 'direction', (line ->> 'amountVnd')::bigint) order by ordinality)
    from pg_catalog.jsonb_array_elements(public.get_payroll_period_details(
      p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
      p_payroll_statement_id => '41000000-0000-0000-0000-000000000004'
    ) #> '{periods,0,statements,0,lines}') with ordinality as entry(line, ordinality)
  ),
  '[
    ["51000000-0000-0000-0000-000000000010", "manual_reward", "earning", 1000000],
    ["51000000-0000-0000-0000-000000000011", "manual_deduction", "deduction", 100000],
    ["51000000-0000-0000-0000-000000000012", "piecework_offset", "deduction", 300000]
  ]'::jsonb,
  'statement lines come in created_at, id order'
);

select is(
  public.get_payroll_period_details(
    p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
    p_payroll_statement_id => '41000000-0000-0000-0000-000000000004'
  ) #> '{periods,0,statements,0,lines,2,formulaSnapshot}',
  '{"base_salary_vnd": 2000000, "basis_points": 8500, "piecework_vnd": 700000}'::jsonb,
  'the offset line carries its formula snapshot (lương khoán đạt for the payslip)'
);

select is(
  (
    select (
      select pg_catalog.sum((line ->> 'amountVnd')::bigint) filter (where line ->> 'direction' = 'earning')
      from pg_catalog.jsonb_array_elements(statement -> 'lines') as line
    ) = (statement ->> 'totalEarningsVnd')::bigint
    and (
      select pg_catalog.sum((line ->> 'amountVnd')::bigint) filter (where line ->> 'direction' = 'deduction')
      from pg_catalog.jsonb_array_elements(statement -> 'lines') as line
    ) = (statement ->> 'totalDeductionsVnd')::bigint
    from pg_catalog.jsonb_array_elements(public.get_payroll_period_details(
      p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
      p_payroll_statement_id => '41000000-0000-0000-0000-000000000004'
    ) #> '{periods,0,statements}') as statement
  ),
  true,
  'a statement read reconciles: earning and deduction lines add up to the totals'
);

select is(
  public.get_payroll_period_details(
    p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
    p_payroll_statement_id => '41000000-0000-0000-0000-000000000003'
  ) -> 'staleStatement',
  'null'::jsonb,
  'another staff statement is neither returned nor reported as stale'
);

select is(
  (public.get_payroll_period_details(
    p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
    p_payroll_statement_id => '41000000-0000-0000-0000-000000000003'
  ) #> '{periods,0,statements}'),
  '[]'::jsonb,
  'ordinary viewer cannot read another staff statement'
);

select is(
  public.get_payroll_period_details(
    p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
    p_payroll_statement_id => '41000000-0000-0000-0000-000000000099'
  ) -> 'staleStatement',
  '{"currentStatementId": "41000000-0000-0000-0000-000000000004"}'::jsonb,
  'a superseded statement is reported stale with the current statement of the same staff'
);

select is(
  (public.get_payroll_period_details(
    p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
    p_payroll_statement_id => '41000000-0000-0000-0000-000000000099'
  ) #> '{periods,0,statements}'),
  '[]'::jsonb,
  'a superseded statement is never returned'
);

select is(
  public.get_payroll_period_details(p_payroll_period_id => '31000000-0000-0000-0000-000000000001') -> 'periods',
  '[]'::jsonb,
  'ordinary viewer cannot read a period without their statement'
);

-- Generated by /ship test coverage audit (pass 1).
-- Value: protects=olderPeriodCount counts only periods the viewer can open, so staff get no "Xem thêm" link to (or count of) periods they cannot see;
-- fails_when=olderPeriodCount is counted from payroll_periods instead of visible_periods (this viewer would get 2);
-- why_new=olderPeriodCount is asserted only for payroll.manage, who sees every period;
-- seam=none; no_claim=does not check the /payroll control itself (payroll-management.test covers it)
select is(
  public.get_payroll_period_details(p_period_limit => 1) -> 'olderPeriodCount',
  '0'::jsonb,
  'ordinary viewer older-period count covers only the periods they can open'
);

select is(
  (
    select pg_catalog.jsonb_agg(period ->> 'periodMonth')
    from pg_catalog.jsonb_array_elements(
      public.get_payroll_period_details(p_include_payroll_period_id => '31000000-0000-0000-0000-000000000001') -> 'periods'
    ) as period
  ),
  '["2026-04-01"]'::jsonb,
  'an included period without the viewer''s statement stays hidden'
);

-- Value: protects=staff see only their own blocking issues and pending correction requests in a period's counts, not colleagues';
-- fails_when=the counts drop the viewer filter (Mina would see 1 blocking issue that is not hers);
-- why_new=the readers this replaces counted everyone's issues and requests for every viewer;
-- seam=none; no_claim=fixture issue has no staff; does not cover the /payroll banner wording
select is(
  (
    select pg_catalog.jsonb_build_object('blocking', period -> 'blockingIssueCount', 'pending', period -> 'pendingCorrectionCount')
    from pg_catalog.jsonb_array_elements(
      public.get_payroll_period_details(p_payroll_period_id => '31000000-0000-0000-0000-000000000002') -> 'periods'
    ) as period
  ),
  '{"blocking": 0, "pending": 1}'::jsonb,
  'a staff member counts only their own blocking issues and pending requests'
);

-- payroll.manage: every period and current-run statement.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);

create temporary table scoped_read_audit_count as
select pg_catalog.count(*) as count_before from public.audit_logs;

select is(
  (
    select pg_catalog.jsonb_agg(period ->> 'periodMonth')
    from pg_catalog.jsonb_array_elements(public.get_payroll_period_details() -> 'periods') as period
  ),
  '["2026-05-01", "2026-04-01", "2026-03-01"]'::jsonb,
  'default list read returns the latest three periods, newest first'
);

select is(
  public.get_payroll_period_details() -> 'olderPeriodCount',
  '1'::jsonb,
  'the default list leaves the fourth, oldest period out and counts it'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'months', (select pg_catalog.jsonb_agg(period ->> 'periodMonth') from pg_catalog.jsonb_array_elements(result -> 'periods') as period),
      'older', result -> 'olderPeriodCount'
    )
    from (select public.get_payroll_period_details(p_period_limit => 1) as result) as read
  ),
  '{"months": ["2026-05-01", "2026-04-01"], "older": 2}'::jsonb,
  'a list limit returns the newest periods plus every period still in draft or review, and counts the rest'
);

-- Value: protects=a link to a named period (Tạm ứng → /payroll?period=…) shows that period even outside the recent window, and only to viewers who may see it;
-- fails_when=p_include_payroll_period_id is ignored, bypasses visibility, or is accepted next to a single-period read;
-- why_new=the include argument is new;
-- seam=none; no_claim=does not prove the page passes ?period= through (payroll-route.test does)
select is(
  (
    select pg_catalog.jsonb_build_object(
      'months', (select pg_catalog.jsonb_agg(period ->> 'periodMonth') from pg_catalog.jsonb_array_elements(result -> 'periods') as period),
      'older', result -> 'olderPeriodCount'
    )
    from (select public.get_payroll_period_details(p_period_limit => 1, p_include_payroll_period_id => '31000000-0000-0000-0000-000000000004') as result) as read
  ),
  '{"months": ["2026-05-01", "2026-04-01", "2026-02-01"], "older": 1}'::jsonb,
  'a list read also returns the period it is asked to include'
);

select throws_ok(
  $$ select public.get_payroll_period_details(p_payroll_period_id => '31000000-0000-0000-0000-000000000002', p_include_payroll_period_id => '31000000-0000-0000-0000-000000000004') $$,
  '22023',
  'PAYROLL_PERIOD_INCLUDE_INVALID',
  'a single-period read takes no included period'
);

select is(
  public.get_payroll_period_details(p_period_limit => 1) #> '{periods,0,statements}',
  '[]'::jsonb,
  'a period without statements is returned with an empty statement list'
);

select is(
  (
    select pg_catalog.jsonb_agg(statement ->> 'id')
    from pg_catalog.jsonb_array_elements(
      public.get_payroll_period_details(p_payroll_period_id => '31000000-0000-0000-0000-000000000002') #> '{periods,0,statements}'
    ) as statement
  ),
  '["41000000-0000-0000-0000-000000000003", "41000000-0000-0000-0000-000000000004"]'::jsonb,
  'a period read returns its current-run statements by staff name, without the superseded run'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'currentRevision', period -> 'currentRevision',
      'lastCalculatedAt', (period ->> 'lastCalculatedAt')::timestamptz = '2026-05-28 00:00:00+00'::timestamptz,
      'paidAt', period -> 'paidAt',
      'status', period -> 'status'
    )
    from pg_catalog.jsonb_array_elements(
      public.get_payroll_period_details(p_payroll_period_id => '31000000-0000-0000-0000-000000000002') -> 'periods'
    ) as period
  ),
  '{"currentRevision": 2, "lastCalculatedAt": true, "paidAt": null, "status": "review"}'::jsonb,
  'period fields come from the current run and the stored period row'
);

-- Generated by /ship test coverage audit (pass 1).
-- Value: protects=/payroll's "N lỗi dữ liệu đang chặn đối soát" and pending-request counts reflect the current run's blocking issues and pending requests only;
-- fails_when=blockingIssueCount counts warnings or superseded-run issues, or pendingCorrectionCount counts resolved requests (either count would be 2 here);
-- why_new=no pgTAP asserts these counts in this reader or in get_payroll_explanations, which computed them before;
-- seam=none; no_claim=fixture issues and requests are inserted directly (correction trigger bypassed); does not cover approval gating
select is(
  (
    select pg_catalog.jsonb_build_object(
      'blocking', period -> 'blockingIssueCount',
      'pending', period -> 'pendingCorrectionCount'
    )
    from pg_catalog.jsonb_array_elements(
      public.get_payroll_period_details(p_payroll_period_id => '31000000-0000-0000-0000-000000000002') -> 'periods'
    ) as period
  ),
  '{"blocking": 1, "pending": 1}'::jsonb,
  'period counts take blocking issues of the current run and pending correction requests only'
);

select is(
  public.get_payroll_period_details(
    p_payroll_period_id => '31000000-0000-0000-0000-000000000001',
    p_payroll_statement_id => '41000000-0000-0000-0000-000000000002'
  ) #> '{periods,0,statements,0}',
  '{
    "id": "41000000-0000-0000-0000-000000000002",
    "payrollPeriodId": "31000000-0000-0000-0000-000000000001",
    "staffId": "11000000-0000-0000-0000-000000000006",
    "staffDisplayName": "No Lines",
    "staffEmployeeCode": "EMP-NOLINES",
    "workUnits": 0,
    "workHours": 0,
    "workMinutes": 0,
    "totalEarningsVnd": 0,
    "totalDeductionsVnd": 0,
    "payableAmountVnd": 0,
    "lines": []
  }'::jsonb,
  'a statement without lines has zero totals and an empty line list'
);

select results_eq(
  $$
    select (line ->> 'id')::uuid
    from pg_catalog.jsonb_array_elements(public.get_payroll_period_details() -> 'periods') as period,
      pg_catalog.jsonb_array_elements(period -> 'statements') as statement,
      pg_catalog.jsonb_array_elements(statement -> 'lines') as line
    order by 1
  $$,
  $$
    select payroll_line_item_id
    from public.get_payroll_periods_with_details()
    where payroll_line_item_id is not null
    order by 1
  $$,
  'the scoped reader returns the same current-run lines as the reader it replaces'
);

select results_eq(
  $$
    select (statement ->> 'totalEarningsVnd')::bigint, (statement ->> 'totalDeductionsVnd')::bigint, (statement ->> 'payableAmountVnd')::bigint
    from pg_catalog.jsonb_array_elements(public.get_payroll_period_details(
      p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
      p_payroll_statement_id => '41000000-0000-0000-0000-000000000004'
    ) #> '{periods,0,statements}') as statement
  $$,
  $$
    select total_earnings_vnd, total_deductions_vnd, payable_amount_vnd
    from public.get_payroll_dashboard()
    where payroll_statement_id = '41000000-0000-0000-0000-000000000004'
  $$,
  'statement totals match get_payroll_dashboard'
);

select is(
  public.get_payroll_period_details(
    p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
    p_payroll_statement_id => '41000000-0000-0000-0000-000000000099'
  ) -> 'staleStatement',
  '{"currentStatementId": "41000000-0000-0000-0000-000000000004"}'::jsonb,
  'a manager opening a superseded statement is pointed at the current one'
);

-- Generated by /ship test coverage audit (pass 1).
-- Value: protects=payroll.accountant_reconcile and payroll.owner_approve still read every staff member's current-run statement, as in the reader this replaces;
-- fails_when=can_see_all drops either permission (that viewer would see no statements: they have none of their own);
-- why_new=only payroll.manage is asserted here; payroll-periods-with-details.test.sql checks these two roles against the old reader only;
-- seam=none; no_claim=does not prove the app passes these permissions through (payroll-route.test does)
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000008', true);

select is(
  (
    select pg_catalog.jsonb_agg(statement ->> 'id' order by statement ->> 'id')
    from pg_catalog.jsonb_array_elements(public.get_payroll_period_details() -> 'periods') as period,
      pg_catalog.jsonb_array_elements(period -> 'statements') as statement
  ),
  '["41000000-0000-0000-0000-000000000001", "41000000-0000-0000-0000-000000000002", "41000000-0000-0000-0000-000000000003", "41000000-0000-0000-0000-000000000004"]'::jsonb,
  'payroll.accountant_reconcile reads every current-run statement'
);

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000009', true);

select is(
  (
    select pg_catalog.jsonb_agg(statement ->> 'id' order by statement ->> 'id')
    from pg_catalog.jsonb_array_elements(public.get_payroll_period_details() -> 'periods') as period,
      pg_catalog.jsonb_array_elements(period -> 'statements') as statement
  ),
  '["41000000-0000-0000-0000-000000000001", "41000000-0000-0000-0000-000000000002", "41000000-0000-0000-0000-000000000003", "41000000-0000-0000-0000-000000000004"]'::jsonb,
  'payroll.owner_approve reads every current-run statement'
);

-- Value: protects=a staff member who opens a colleague's superseded statement id learns nothing: no stale pointer to the colleague's current statement;
-- fails_when=the visibility guard on the stale lookup is removed (this viewer would get {"currentStatementId": "41..04"}, and the payslip page would redirect to it);
-- why_new=the stale cases covered only the viewer's own superseded statement and a manager; a colleague's current statement is excluded by the run check alone;
-- seam=none; no_claim=does not cover the payslip page redirect itself (payroll-payslip-routes.test does)
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000005', true);

select is(
  public.get_payroll_period_details(
    p_payroll_period_id => '31000000-0000-0000-0000-000000000002',
    p_payroll_statement_id => '41000000-0000-0000-0000-000000000099'
  ) -> 'staleStatement',
  'null'::jsonb,
  'a staff member opening a colleague''s superseded statement gets no stale pointer'
);

select is(
  (
    select pg_catalog.jsonb_build_object('blocking', period -> 'blockingIssueCount', 'pending', period -> 'pendingCorrectionCount')
    from pg_catalog.jsonb_array_elements(
      public.get_payroll_period_details(p_payroll_period_id => '31000000-0000-0000-0000-000000000002') -> 'periods'
    ) as period
  ),
  '{"blocking": 0, "pending": 0}'::jsonb,
  'a colleague''s pending request is not counted for another staff member'
);

select is(
  (select pg_catalog.count(*) from public.audit_logs),
  (select count_before from scoped_read_audit_count),
  'the reader has no audit or accounting side effect'
);

select * from finish();

rollback;
