begin;

select plan(13);

-- Test Fixture Setup: Users & Profiles
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'biz-owner@example.test', '{"provider":"email"}', '{"full_name":"Biz Owner"}', now(), now()),
  ('81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'biz-ops-a@example.test', '{"provider":"email"}', '{"full_name":"Biz Ops A"}', now(), now()),
  ('81000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'biz-ops-b@example.test', '{"provider":"email"}', '{"full_name":"Biz Ops B"}', now(), now()),
  ('81000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'biz-adm-20m@example.test', '{"provider":"email"}', '{"full_name":"Biz Admissions 20M"}', now(), now()),
  ('81000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'biz-adm-30m@example.test', '{"provider":"email"}', '{"full_name":"Biz Admissions 30M"}', now(), now()),
  ('81000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'biz-adm-40m@example.test', '{"provider":"email"}', '{"full_name":"Biz Admissions 40M"}', now(), now()),
  ('81000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'biz-ta@example.test', '{"provider":"email"}', '{"full_name":"Biz TA"}', now(), now()),
  ('81000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'biz-reconcile@example.test', '{"provider":"email"}', '{"full_name":"Biz Reconciler"}', now(), now());

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '81000000-0000-4000-8000-000000000001', role.id, 'Biz test owner'
from public.roles as role where role.code = 'owner';

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '81000000-0000-4000-8000-000000000008', role.id, 'Biz test accountant'
from public.roles as role where role.code = 'accountant';

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

-- Positions
insert into public.staff_payroll_position_versions (staff_id, position_code, effective_from, reason, created_by)
values
  ('81000000-0000-4000-8000-000000000002', 'operations_assistant', '2026-01-01', 'Biz test', '81000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000003', 'operations_assistant', '2026-01-01', 'Biz test', '81000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000004', 'admissions_manager', '2026-01-01', 'Biz test', '81000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000005', 'admissions_manager', '2026-01-01', 'Biz test', '81000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000006', 'admissions_manager', '2026-01-01', 'Biz test', '81000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000007', 'teaching_assistant', '2026-01-01', 'Biz test', '81000000-0000-4000-8000-000000000001');

-- Daily Rates (300,000 VND/day)
insert into public.staff_daily_rate_versions (staff_id, effective_from, offline_daily_rate_vnd, note, reason, created_by)
select id, '2026-01-01', 300000, 'Biz test rate', 'Biz test rate', '81000000-0000-4000-8000-000000000001'
from public.profiles
where id between '81000000-0000-4000-8000-000000000002' and '81000000-0000-4000-8000-000000000007';

-- Mid-Month Grade Assignment Transfer:
-- Grade 11: Ops A (2026-05-01 to 2026-05-15), Ops B (2026-05-16 onwards)
insert into public.staff_grade_assignments (staff_id, grade, effective_from, effective_to, reason, created_by)
values
  ('81000000-0000-4000-8000-000000000002', 11, '2026-05-01', '2026-05-15', 'Ops A Grade 11 first half', '81000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000003', 11, '2026-05-16', null, 'Ops B Grade 11 second half', '81000000-0000-4000-8000-000000000001');

-- Source Facts for May 2026 (2026-05-01):
insert into public.payroll_source_facts (
  fact_type, source_key, source_origin, event_date, staff_id, grade, amount_vnd, quantity, source_code, metadata
)
values
  -- P0-2: Ops A gets 10M renewal in Grade 11 on May 10 (within May 1-15) -> 2% = 200,000 VND
  ('renewal_order', 'biz-ops-a-10m-renewal', 'system', '2026-05-10', '81000000-0000-4000-8000-000000000002', 11, 10000000, 1, null, '{"grade":11}'),
  -- P1-8: Ops B gets 20M renewal in Grade 11 on May 20 (within May 16-31) -> 2% = 400,000 VND
  ('renewal_order', 'biz-ops-b-20m-renewal', 'system', '2026-05-20', '81000000-0000-4000-8000-000000000003', 11, 20000000, 1, null, '{"grade":11}'),
  -- P0-3: Admissions 20M revenue tier -> 4% = 800,000 VND
  ('new_enrollment_order', 'biz-adm-tier-20m', 'system', '2026-05-10', '81000000-0000-4000-8000-000000000004', null, 20000000, 1, 'school_telesales_ads', '{}'),
  -- P0-4: Admissions 30M revenue tier -> 6% = 1,800,000 VND
  ('new_enrollment_order', 'biz-adm-tier-30m', 'system', '2026-05-10', '81000000-0000-4000-8000-000000000005', null, 30000000, 1, 'school_telesales_ads', '{}'),
  -- P0-5: Admissions 40M revenue tier -> 8% = 3,200,000 VND
  ('new_enrollment_order', 'biz-adm-tier-40m', 'system', '2026-05-10', '81000000-0000-4000-8000-000000000006', null, 40000000, 1, 'school_telesales_ads', '{}'),
  -- Base timekeeping for Ops A: 1 full day (540 mins = 300,000 VND base salary)
  ('timekeeping', 'biz-ops-a-tk-540', 'system', '2026-05-01', '81000000-0000-4000-8000-000000000002', null, null, 540, null, '{"work_mode":"offline"}');

-- P0-1: 2 Teaching Allowance Occurrences (40,000 VND each) for TA
do $$
begin
  perform public.create_manual_payroll_source_fact(
    'teaching_allowance', 'biz-ta-allowance-1', '2026-05-05',
    '81000000-0000-4000-8000-000000000007', null, null, null, 1, null,
    '{"reason":"TA allowance 1","evidence_url":"https://example.test/ta1"}'
  );
  perform public.create_manual_payroll_source_fact(
    'teaching_allowance', 'biz-ta-allowance-2', '2026-05-15',
    '81000000-0000-4000-8000-000000000007', null, null, null, 1, null,
    '{"reason":"TA allowance 2","evidence_url":"https://example.test/ta2"}'
  );
end;
$$;

-- P0-6: Salary Advance for Ops A (50,000 VND)
insert into public.salary_advances (
  staff_id, amount_vnd, request_note, deduction_period_month, status,
  requested_by, reviewed_by, reviewed_at, review_note,
  approved_by, approved_at, approval_note
)
values (
  '81000000-0000-4000-8000-000000000002', 50000, 'Advance for Ops A',
  '2026-05-01', 'approved',
  '81000000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000001', now(), 'Reviewed',
  '81000000-0000-4000-8000-000000000001', now(), 'Approved'
);

-- Initial Draft Calculation for May 2026
select lives_ok(
  $$ select public.create_payroll_draft('2026-05-01') $$,
  'create_payroll_draft succeeds for May 2026'
);

-- ========================================================
-- P0-1: Teaching Allowance (2 x 40,000 VND = 80,000 VND)
-- ========================================================
select is(
  (
    select sum(line.amount_vnd)::bigint
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-05-01'
      and statement.staff_id = '81000000-0000-4000-8000-000000000007'
      and line.line_type = 'teaching_allowance'
  ),
  80000::bigint,
  'P0-1: Teaching allowance of 2 approved sessions pays exactly 80,000 VND'
);

-- ========================================================
-- P0-2: Operations Grade Renewal (10M x 2% = 200,000 VND)
-- ========================================================
select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-05-01'
      and statement.staff_id = '81000000-0000-4000-8000-000000000002'
      and line.line_type = 'operations_grade_renewal_bonus'
  ),
  200000::bigint,
  'P0-2: Operations assistant receives 2% (200,000 VND) on 10,000,000 VND renewal'
);

-- ========================================================
-- P0-3, P0-4, P0-5: Admissions Revenue Tier Bonuses
-- ========================================================
select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-05-01'
      and statement.staff_id = '81000000-0000-4000-8000-000000000004'
      and line.line_type = 'admissions_revenue_tier_bonus'
  ),
  800000::bigint,
  'P0-3: 20M revenue tier receives 4% = 800,000 VND'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-05-01'
      and statement.staff_id = '81000000-0000-4000-8000-000000000005'
      and line.line_type = 'admissions_revenue_tier_bonus'
  ),
  1800000::bigint,
  'P0-4: 30M revenue tier receives 6% = 1,800,000 VND'
);

select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-05-01'
      and statement.staff_id = '81000000-0000-4000-8000-000000000006'
      and line.line_type = 'admissions_revenue_tier_bonus'
  ),
  3200000::bigint,
  'P0-5: 40M revenue tier receives 8% = 3,200,000 VND'
);

-- ========================================================
-- P0-7: Operations Piecework Floor Offset (85% Threshold)
-- Base salary = 300,000 VND. 85% threshold = 255,000 VND.
-- Piecework = 200,000 VND (renewal). Since 200,000 <= 255,000, offset = 200,000 VND.
-- ========================================================
select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-05-01'
      and statement.staff_id = '81000000-0000-4000-8000-000000000002'
      and line.line_type = 'piecework_offset'
  ),
  200000::bigint,
  'P0-7: Operations piecework offset absorbs piecework up to 85% floor'
);

-- ========================================================
-- P1-8: Mid-Month Grade Assignment Transfer
-- Ops B receives 2% of 20M = 400,000 VND for order on May 20 (effective from May 16)
-- ========================================================
select is(
  (
    select line.amount_vnd
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-05-01'
      and statement.staff_id = '81000000-0000-4000-8000-000000000003'
      and line.line_type = 'operations_grade_renewal_bonus'
  ),
  400000::bigint,
  'P1-8: Mid-month assignment transfer correctly credits Ops B with post-transfer orders'
);

-- ========================================================
-- P1-9: Excel Import Deduplication (source_key uniqueness)
-- Inserting same source_key with ON CONFLICT DO NOTHING does not duplicate fact or statement amounts
-- ========================================================
insert into public.payroll_source_facts (
  fact_type, source_key, source_origin, event_date, staff_id, grade, amount_vnd, quantity, source_code, metadata
)
values
  ('renewal_order', 'biz-ops-a-10m-renewal', 'system', '2026-05-10', '81000000-0000-4000-8000-000000000002', 11, 10000000, 1, null, '{"grade":11}')
on conflict (fact_type, source_key) do nothing;

select is(
  (
    select count(*)
    from public.payroll_source_facts
    where source_key = 'biz-ops-a-10m-renewal'
  ),
  1::bigint,
  'P1-9: Duplicate source_key is deduplicated and not inserted twice'
);

-- ========================================================
-- P0-6: Salary Advance Single Deduction & Recalculation Safety
-- ========================================================
select lives_ok(
  $$
    select public.generate_payroll_calculation_run(
      (select id from public.payroll_periods where period_month = '2026-05-01'),
      'Biz test recalculation run'
    )
  $$,
  'P0-6: Recalculating draft with advance deduction creates revision 2 cleanly'
);

select results_eq(
  $$
    select count(line.id)::integer, sum(line.amount_vnd)::bigint
    from public.payroll_periods as period
    join public.payroll_statements as statement on statement.calculation_run_id = period.current_calculation_run_id
    join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where period.period_month = '2026-05-01'
      and statement.staff_id = '81000000-0000-4000-8000-000000000002'
      and line.line_type = 'advance_deduction'
  $$,
  $$ values (1, 50000::bigint) $$,
  'P0-6: Current recalculation revision contains exactly one 50,000 VND advance deduction'
);

-- ========================================================
-- P1-10: Feedback Lifecycle & Recalculation Gate
-- Staff submits correction -> resolver accepts -> close_payroll_feedback is blocked until recalculation
-- ========================================================
do $$
declare
  target_statement_id uuid;
  target_period_id uuid;
  created_req public.payroll_correction_requests;
begin
  select statement.id, statement.payroll_period_id
  into target_statement_id, target_period_id
  from public.payroll_statements as statement
  join public.payroll_periods as period on period.id = statement.payroll_period_id
  where period.period_month = '2026-05-01'
    and statement.calculation_run_id = period.current_calculation_run_id
    and statement.staff_id = '81000000-0000-4000-8000-000000000002';

  -- Staff submits correction request
  perform set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
  select * into created_req from public.submit_payroll_correction_request(
    target_statement_id,
    'Need adjustment for missed offline shift',
    jsonb_build_array(jsonb_build_object('item_label', 'Missed shift', 'requested_change', 'Add 540 mins'))
  );

  -- Existing calculation runs happened at T-10m
  set local session_replication_role = 'replica';
  update public.payroll_calculation_runs
  set generated_at = now() - interval '10 minutes'
  where payroll_period_id = target_period_id;
  set local session_replication_role = 'origin';

  -- Resolver accepts the correction at T-5m (after run 2, requiring run 3 recalculation)
  perform set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
  update public.payroll_correction_requests
  set status = 'accepted', resolved_by = '81000000-0000-4000-8000-000000000001',
      resolved_at = now() - interval '5 minutes', response_message = 'Accepted and will recalculate'
  where id = created_req.id;
end;
$$;

-- Attempting to close feedback before recalculation must fail:
select throws_ok(
  $$
    select public.close_payroll_feedback(
      (select id from public.payroll_periods where period_month = '2026-05-01')
    )
  $$,
  '23514',
  'PAYROLL_ACCEPTED_CORRECTION_RECALCULATION_REQUIRED',
  'P1-10: Closing feedback is blocked after accepted correction until recalculated'
);

-- Recalculate, then close feedback and submit for review:
select lives_ok(
  $$
    do $block$
    begin
      perform public.generate_payroll_calculation_run(
        (select id from public.payroll_periods where period_month = '2026-05-01'),
        'Recalculation after accepted correction'
      );
      perform public.close_payroll_feedback(
        (select id from public.payroll_periods where period_month = '2026-05-01')
      );
      -- Accountant (81000000-0000-4000-8000-000000000008) submits for review
      perform set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000008', true);
      perform public.submit_payroll_for_review(
        (select id from public.payroll_periods where period_month = '2026-05-01')
      );
    end;
    $block$;
  $$,
  'P1-10: After recalculation, closing feedback and submitting for review succeed'
);

select * from finish();
rollback;
