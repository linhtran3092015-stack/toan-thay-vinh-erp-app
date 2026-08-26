begin;

select plan(22);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'payroll-engine-owner@example.test', '{"provider":"email"}', '{"full_name":"Payroll Engine Owner"}', now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'payroll-engine-ops@example.test', '{"provider":"email"}', '{"full_name":"Payroll Engine Ops"}', now(), now()),
  ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'payroll-engine-admissions@example.test', '{"provider":"email"}', '{"full_name":"Payroll Engine Admissions"}', now(), now()),
  ('91000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'payroll-engine-ta-a@example.test', '{"provider":"email"}', '{"full_name":"Payroll Engine TA A"}', now(), now()),
  ('91000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'payroll-engine-ta-b@example.test', '{"provider":"email"}', '{"full_name":"Payroll Engine TA B"}', now(), now()),
  ('91000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'payroll-engine-admissions-20m@example.test', '{"provider":"email"}', '{"full_name":"Payroll Engine Admissions 20M"}', now(), now()),
  ('91000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'payroll-engine-admissions-30m@example.test', '{"provider":"email"}', '{"full_name":"Payroll Engine Admissions 30M"}', now(), now()),
  ('91000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'payroll-engine-admissions-40m@example.test', '{"provider":"email"}', '{"full_name":"Payroll Engine Admissions 40M"}', now(), now());

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '91000000-0000-4000-8000-000000000001', role.id, 'Payroll engine test owner'
from public.roles as role where role.code = 'owner';

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

insert into public.staff_payroll_position_versions (
  staff_id, position_code, effective_from, reason, created_by
)
values
  ('91000000-0000-4000-8000-000000000002', 'operations_assistant', '2026-01-01', 'Payroll test', '91000000-0000-4000-8000-000000000001'),
  ('91000000-0000-4000-8000-000000000003', 'admissions_manager', '2026-01-01', 'Payroll test', '91000000-0000-4000-8000-000000000001'),
  ('91000000-0000-4000-8000-000000000004', 'teaching_assistant', '2026-01-01', 'Payroll test', '91000000-0000-4000-8000-000000000001'),
  ('91000000-0000-4000-8000-000000000005', 'teaching_assistant', '2026-01-01', 'Payroll test', '91000000-0000-4000-8000-000000000001'),
  ('91000000-0000-4000-8000-000000000006', 'admissions_manager', '2026-01-01', 'Payroll test', '91000000-0000-4000-8000-000000000001'),
  ('91000000-0000-4000-8000-000000000007', 'admissions_manager', '2026-01-01', 'Payroll test', '91000000-0000-4000-8000-000000000001'),
  ('91000000-0000-4000-8000-000000000008', 'admissions_manager', '2026-01-01', 'Payroll test', '91000000-0000-4000-8000-000000000001');

insert into public.staff_daily_rate_versions (
  staff_id, effective_from, offline_daily_rate_vnd, note, reason, created_by
)
select id, '2026-01-01', 300000, 'Payroll test', 'Payroll test', '91000000-0000-4000-8000-000000000001'
from public.profiles
where id in (
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004',
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000006',
  '91000000-0000-4000-8000-000000000007',
  '91000000-0000-4000-8000-000000000008'
);

insert into public.staff_grade_assignments (
  staff_id, grade, effective_from, effective_to, reason, created_by
)
values (
  '91000000-0000-4000-8000-000000000002', 10, '2026-01-01', null,
  'Payroll test grade assignment', '91000000-0000-4000-8000-000000000001'
);

insert into public.payroll_source_facts (
  fact_type, source_key, source_origin, event_date, staff_id, grade, amount_vnd,
  quantity, source_code, metadata
)
values
  ('timekeeping', 'engine-ops-539', 'system', '2026-07-01', '91000000-0000-4000-8000-000000000002', null, null, 539, null, '{"work_mode":"offline"}'),
  ('timekeeping', 'engine-ops-540', 'system', '2026-07-02', '91000000-0000-4000-8000-000000000002', null, null, 540, null, '{"work_mode":"offline"}'),
  ('timekeeping', 'engine-ops-online-540', 'system', '2026-07-03', '91000000-0000-4000-8000-000000000002', null, null, 540, null, '{"work_mode":"online"}'),
  ('timekeeping', 'engine-admissions-540', 'system', '2026-07-01', '91000000-0000-4000-8000-000000000003', null, null, 540, null, '{"work_mode":"offline"}'),
  ('grading', 'engine-grade-a', 'system', '2026-07-10', '91000000-0000-4000-8000-000000000004', null, null, 20, null, '{}'),
  ('grading', 'engine-grade-b', 'system', '2026-07-10', '91000000-0000-4000-8000-000000000005', null, null, 80, null, '{}'),
  ('renewal_order', 'engine-ops-grade-10-renewal', 'system', '2026-07-12', '91000000-0000-4000-8000-000000000002', 10, 50000000, 1, null, '{"grade_assignment_id":"payroll-test-grade-10"}'),
  ('new_enrollment_order', 'engine-admissions-order', 'system', '2026-07-15', '91000000-0000-4000-8000-000000000003', null, 29000000, 1, 'school_telesales_ads', '{}'),
  ('new_enrollment_order', 'engine-admissions-threshold-20m', 'system', '2026-07-15', '91000000-0000-4000-8000-000000000006', null, 20000000, 1, 'school_telesales_ads', '{}'),
  ('new_enrollment_order', 'engine-admissions-threshold-30m', 'system', '2026-07-15', '91000000-0000-4000-8000-000000000007', null, 30000000, 1, 'school_telesales_ads', '{}'),
  ('new_enrollment_order', 'engine-admissions-threshold-40m', 'system', '2026-07-15', '91000000-0000-4000-8000-000000000008', null, 40000000, 1, 'school_telesales_ads', '{}');

do $$
begin
  perform public.create_manual_payroll_source_fact(
    'teaching_allowance', 'engine-ta-allowance-1', '2026-07-08',
    '91000000-0000-4000-8000-000000000004', null, null, null, 1, null,
    '{"reason":"Approved teaching allowance occurrence 1","evidence_url":"https://example.test/allowance-1"}'
  );
  perform public.create_manual_payroll_source_fact(
    'teaching_allowance', 'engine-ta-allowance-2', '2026-07-18',
    '91000000-0000-4000-8000-000000000004', null, null, null, 1, null,
    '{"reason":"Approved teaching allowance occurrence 2","evidence_url":"https://example.test/allowance-2"}'
  );
end;
$$;

insert into public.salary_advances (
  staff_id, amount_vnd, request_note, deduction_period_month, status,
  requested_by, reviewed_by, reviewed_at, review_note,
  approved_by, approved_at, approval_note
)
values (
  '91000000-0000-4000-8000-000000000002', 100000, 'Payroll test advance',
  '2026-07-01', 'approved',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000001', now(), 'Reviewed for payroll test',
  '91000000-0000-4000-8000-000000000001', now(), 'Approved for payroll test'
);

select lives_ok(
  $$ select public.create_payroll_draft('2026-07-01') $$,
  'a closed month can be calculated from immutable facts'
);

select is(
  (
    select work_minutes
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000002'
  ),
  1619,
  'worked minutes preserve exact 539 + 540 + 540 duration'
);

select results_eq(
  $$
    select line.work_minutes, line.line_type, line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000002'
      and line.line_type in ('base_offline', 'base_online')
    order by line.work_minutes, line.line_type
  $$,
  $$ values
    (539, 'base_offline'::text, 299444::bigint),
    (540, 'base_offline'::text, 300000::bigint),
    (540, 'base_online'::text, 150000::bigint)
  $$,
  'daily salary uses exact minutes and online receives 50 percent'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000004'
      and line.line_type = 'grading_bonus'
  ),
  200000::bigint,
  '20 of 100 grading credits receives 20 percent of the pool'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000005'
      and line.line_type = 'grading_bonus'
  ),
  800000::bigint,
  '80 of 100 grading credits receives the remainder of the pool'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000003'
      and line.line_type = 'admissions_revenue_tier_bonus'
  ),
  1160000::bigint,
  '29 million applies the highest reached 4 percent admissions tier to full revenue'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000003'
      and line.line_type = 'new_student_fixed_bonus'
  ),
  200000::bigint,
  'school telesales order receives the configured fixed admissions bonus'
);

select is(
  (
    select sum(case when line.direction = 'earning' then line.amount_vnd else -line.amount_vnd end)::bigint
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000003'
  ),
  1360000::bigint,
  'admissions total equals the larger piecework amount after the hard-salary offset'
);

select is(
  (
    select sum(line.amount_vnd)::bigint
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000004'
      and line.line_type = 'teaching_allowance'
  ),
  80000::bigint,
  'two separately approved teaching allowance occurrences pay 40,000 VND each'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000002'
      and line.line_type = 'operations_grade_renewal_bonus'
  ),
  1000000::bigint,
  'operations assistant receives 2 percent of renewal revenue for the assigned grade'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000006'
      and line.line_type = 'admissions_revenue_tier_bonus'
  ),
  800000::bigint,
  'exactly 20 million applies the 4 percent admissions tier'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000007'
      and line.line_type = 'admissions_revenue_tier_bonus'
  ),
  1800000::bigint,
  'exactly 30 million applies the 6 percent admissions tier'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000008'
      and line.line_type = 'admissions_revenue_tier_bonus'
  ),
  3200000::bigint,
  'exactly 40 million applies the 8 percent admissions tier'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000002'
      and line.line_type = 'piecework_offset'
  ),
  637027::bigint,
  'operations piecework deducts exactly 85 percent of the 749,444 VND hard salary'
);

select is(
  (
    select sum(case when line.direction = 'earning' then line.amount_vnd else -line.amount_vnd end)::bigint
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000002'
  ),
  1012417::bigint,
  'operations total keeps only piecework above 85 percent of hard salary and deducts the advance'
);

select results_eq(
  $$
    select count(*)::integer, sum(line.amount_vnd)::bigint
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-07-01'
      and statement.staff_id = '91000000-0000-4000-8000-000000000002'
      and line.line_type = 'advance_deduction'
  $$,
  $$ values (1, 100000::bigint) $$,
  'the initial calculation deducts the approved salary advance exactly once'
);

select is(
  (
    select count(*)
    from public.payroll_periods as period
    join public.payroll_calculation_issues as issue on issue.calculation_run_id = period.current_calculation_run_id
    where period.period_month = '2026-07-01'
  ),
  0::bigint,
  'fully configured fixtures produce no blocking calculation issue'
);

select throws_ok(
  $$ select public.create_staff_daily_rate_version(
    '91000000-0000-4000-8000-000000000001', '2026-08-01', 999999, null, 'Self change'
  ) $$,
  '42501',
  'STAFF_DAILY_RATE_SELF_CHANGE_FORBIDDEN',
  'a privileged user cannot set their own salary rate'
);

select throws_ok(
  $$ select public.create_manual_payroll_source_fact(
    'teaching_allowance', 'self-allowance', '2026-07-01',
    '91000000-0000-4000-8000-000000000001', null, null, null, 1, null,
    '{"reason":"Self allowance","evidence_url":"https://example.test/evidence"}'
  ) $$,
  '42501',
  'PAYROLL_MANUAL_FACT_SELF_APPROVAL_FORBIDDEN',
  'a privileged user cannot approve their own manual payroll fact'
);

select is(
  (
    select count(*) from public.payroll_source_facts
    where fact_type = 'grading' and source_key like 'engine-grade-%'
  ),
  2::bigint,
  'calculation never mutates immutable source facts'
);

select lives_ok(
  $$
    select public.generate_payroll_calculation_run(
      (select id from public.payroll_periods where period_month = '2026-07-01'),
      'Payroll test recalculation'
    )
  $$,
  'recalculating a draft with a deducted advance creates a new immutable revision'
);

select results_eq(
  $$
    select run.revision, count(line.id)::integer, coalesce(sum(line.amount_vnd), 0)::bigint
    from public.payroll_periods as period
    join public.payroll_calculation_runs as run on run.id = period.current_calculation_run_id
    join public.payroll_statements as statement
      on statement.calculation_run_id = run.id
      and statement.staff_id = '91000000-0000-4000-8000-000000000002'
    left join public.payroll_line_items as line
      on line.payroll_statement_id = statement.id
      and line.line_type = 'advance_deduction'
    where period.period_month = '2026-07-01'
    group by run.revision
  $$,
  $$ values (2, 1, 100000::bigint) $$,
  'the current recalculation revision contains one copy of the same advance deduction'
);

select * from finish();
rollback;
