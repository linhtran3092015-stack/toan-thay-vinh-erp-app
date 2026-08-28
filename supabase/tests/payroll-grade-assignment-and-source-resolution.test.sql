begin;

select plan(18);

-- 1. Setup test users and roles
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('93000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'resolution-owner@example.test', '{"provider":"email"}', '{"full_name":"Resolution Owner"}', now(), now()),
  ('93000000-0000-4000-8000-000000000017', 'authenticated', 'authenticated', 'resolution-nv17@example.test', '{"provider":"email"}', '{"full_name":"Resolution NV17"}', now(), now()),
  ('93000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'resolution-nv13@example.test', '{"provider":"email"}', '{"full_name":"Resolution NV13"}', now(), now()),
  ('93000000-0000-4000-8000-000000000016', 'authenticated', 'authenticated', 'resolution-nv16@example.test', '{"provider":"email"}', '{"full_name":"Resolution NV16"}', now(), now());

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '93000000-0000-4000-8000-000000000001', role.id, 'Resolution test owner'
from public.roles as role where role.code = 'owner';

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);

-- 2. Setup position versions
-- NV17: teaching_assistant from 2026-07-01, operations_assistant from 2026-07-02
-- NV13: teaching_assistant from 2026-07-01, operations_assistant from 2026-07-02
-- NV16: operations_assistant from 2026-07-01
insert into public.staff_payroll_position_versions (
  staff_id, position_code, effective_from, reason, created_by
)
values
  ('93000000-0000-4000-8000-000000000017', 'teaching_assistant', '2026-07-01', 'TA phase', '93000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000017', 'operations_assistant', '2026-07-02', 'Ops phase', '93000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000013', 'teaching_assistant', '2026-07-01', 'TA phase', '93000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000013', 'operations_assistant', '2026-07-02', 'Ops phase', '93000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000016', 'operations_assistant', '2026-07-01', 'Ops full', '93000000-0000-4000-8000-000000000001');

-- 3. Daily rate versions
insert into public.staff_daily_rate_versions (
  staff_id, effective_from, offline_daily_rate_vnd, note, reason, created_by
)
select id, '2026-07-01', 300000, 'Test rate', 'Test rate', '93000000-0000-4000-8000-000000000001'
from public.profiles
where id in (
  '93000000-0000-4000-8000-000000000017',
  '93000000-0000-4000-8000-000000000013',
  '93000000-0000-4000-8000-000000000016'
);

-- 4. Grade assignments
-- NV16: Grade 2,3,4,5 from 2026-07-01
-- NV17: Grade 6,7 from 2026-07-02
-- NV13: Grade 8,9,10,11,12 from 2026-07-02
insert into public.staff_grade_assignments (
  staff_id, grade, effective_from, effective_to, reason, created_by
)
values
  ('93000000-0000-4000-8000-000000000016', 2, '2026-07-01', null, 'Grade 2', '93000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000017', 6, '2026-07-02', null, 'Grade 6', '93000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000017', 7, '2026-07-02', null, 'Grade 7', '93000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000013', 8, '2026-07-02', null, 'Grade 8', '93000000-0000-4000-8000-000000000001');

-- 5. Test Facts in payroll_source_facts
-- Case A: Renewal order on 2026-07-02, grade 7, fact.staff_id is NULL (simulating pre-existing fact before assignment)
-- Case B: Renewal order on 2026-07-01, grade 7, (before NV17 assignment & ops position) -> should produce missing_grade_assignment
-- Case C: New enrollment on 2026-07-05 for NV13 with source_code = teacher_vinh_zalo_direct_referral
-- Case D: New enrollment on 2026-07-06 for NV13 with unsupported source_code = unmapped_random_source
insert into public.payroll_source_facts (
  fact_type, source_key, source_origin, event_date, staff_id, grade, amount_vnd, quantity, source_code, metadata
)
values
  -- Test A: Renewal order on 2026-07-02 for grade 7 (50,000,000 VND) -> NV17
  ('renewal_order', 'res-order-a-g7-jul02', 'system', '2026-07-02', null, 7, 50000000, 1, null, '{"test":"A"}'),
  -- Test A: Renewal order on 2026-07-10 for grade 6 (30,000,000 VND) -> NV17
  ('renewal_order', 'res-order-a-g6-jul10', 'system', '2026-07-10', null, 6, 30000000, 1, null, '{"test":"A"}'),
  -- Test B: Renewal order on 2026-07-01 for grade 7 (20,000,000 VND) -> before NV17 assignment
  ('renewal_order', 'res-order-b-g7-jul01', 'system', '2026-07-01', null, 7, 20000000, 1, null, '{"test":"B"}'),
  -- Test C: New enrollment for NV13 with mapped source teacher_vinh_zalo_direct_referral (10,000,000 VND)
  ('new_enrollment_order', 'res-order-c-nv13-mapped', 'system', '2026-07-05', '93000000-0000-4000-8000-000000000013', null, 10000000, 1, 'teacher_vinh_zalo_direct_referral', '{"test":"C"}'),
  -- Test D: New enrollment for NV13 with unsupported source
  ('new_enrollment_order', 'res-order-d-nv13-unmapped', 'system', '2026-07-06', '93000000-0000-4000-8000-000000000013', null, 15000000, 1, 'unmapped_random_source', '{"test":"D"}');

-- 6. Create payroll draft period for 2026-07-01
select public.create_payroll_draft('2026-07-01'::date);

-- Verify period exists
select is(
  (select count(*)::integer from public.payroll_periods where period_month = '2026-07-01'),
  1,
  'Payroll period for 2026-07-01 created'
);

-- Check calculation run
select is(
  (select count(*)::integer from public.payroll_calculation_runs where status = 'current'),
  1,
  'Current calculation run exists'
);

-- =========================================================================
-- TEST A: Renewal orders on 2026-07-02 and 2026-07-10 for Grade 7 & 6 (NV17)
-- =========================================================================
-- Assert renewal bonus lines created for NV17 (2% of 50M = 1,000,000 VND; 2% of 30M = 600,000 VND)
select is(
  (
    select count(*)::integer
    from public.payroll_line_items as item
    join public.payroll_statements as statement on statement.id = item.payroll_statement_id
    where statement.staff_id = '93000000-0000-4000-8000-000000000017'
      and item.line_type = 'operations_grade_renewal_bonus'
      and item.source_id = (select id::text from public.payroll_source_facts where source_key = 'res-order-a-g7-jul02')
  ),
  1,
  'Test A: NV17 receives 2% renewal bonus for Grade 7 on 2026-07-02'
);

select is(
  (
    select item.amount_vnd
    from public.payroll_line_items as item
    join public.payroll_statements as statement on statement.id = item.payroll_statement_id
    where statement.staff_id = '93000000-0000-4000-8000-000000000017'
      and item.line_type = 'operations_grade_renewal_bonus'
      and item.source_id = (select id::text from public.payroll_source_facts where source_key = 'res-order-a-g7-jul02')
  ),
  1000000::bigint,
  'Test A: Grade 7 renewal bonus amount is exactly 1,000,000 VND (2% of 50M)'
);

select is(
  (
    select item.amount_vnd
    from public.payroll_line_items as item
    join public.payroll_statements as statement on statement.id = item.payroll_statement_id
    where statement.staff_id = '93000000-0000-4000-8000-000000000017'
      and item.line_type = 'operations_grade_renewal_bonus'
      and item.source_id = (select id::text from public.payroll_source_facts where source_key = 'res-order-a-g6-jul10')
  ),
  600000::bigint,
  'Test A: Grade 6 renewal bonus amount is exactly 600,000 VND (2% of 30M)'
);

-- Assert NO missing_grade_assignment issue generated for Test A facts
select is(
  (
    select count(*)::integer
    from public.payroll_calculation_issues as issue
    where issue.source_fact_id in (
      select id from public.payroll_source_facts where source_key in ('res-order-a-g7-jul02', 'res-order-a-g6-jul10')
    )
  ),
  0,
  'Test A: No calculation issues for valid assigned renewal orders'
);

-- =========================================================================
-- TEST B: Renewal order on 2026-07-01 (before effective_from of assignment)
-- =========================================================================
select is(
  (
    select count(*)::integer
    from public.payroll_calculation_issues as issue
    where issue.source_fact_id = (select id from public.payroll_source_facts where source_key = 'res-order-b-g7-jul01')
      and issue.issue_code = 'missing_grade_assignment'
  ),
  1,
  'Test B: Renewal order on 2026-07-01 correctly flags missing_grade_assignment'
);

select is(
  (
    select (issue.details->>'grade')::integer
    from public.payroll_calculation_issues as issue
    where issue.source_fact_id = (select id from public.payroll_source_facts where source_key = 'res-order-b-g7-jul01')
  ),
  7,
  'Test B: Issue details contain grade 7 context'
);

-- =========================================================================
-- TEST C: New enrollment with teacher_vinh_zalo_direct_referral (NV13)
-- =========================================================================
-- Fixed bonus: 50,000 VND; Revenue bonus: 5% of 10M = 500,000 VND
select is(
  (
    select item.amount_vnd
    from public.payroll_line_items as item
    join public.payroll_statements as statement on statement.id = item.payroll_statement_id
    where statement.staff_id = '93000000-0000-4000-8000-000000000013'
      and item.line_type = 'new_student_fixed_bonus'
      and item.source_id = (select id::text from public.payroll_source_facts where source_key = 'res-order-c-nv13-mapped')
  ),
  50000::bigint,
  'Test C: NV13 receives 50,000 VND fixed bonus for teacher_vinh_zalo_direct_referral'
);

select is(
  (
    select item.amount_vnd
    from public.payroll_line_items as item
    join public.payroll_statements as statement on statement.id = item.payroll_statement_id
    where statement.staff_id = '93000000-0000-4000-8000-000000000013'
      and item.line_type = 'new_student_revenue_bonus'
      and item.source_id = (select id::text from public.payroll_source_facts where source_key = 'res-order-c-nv13-mapped')
  ),
  500000::bigint,
  'Test C: NV13 receives 500,000 VND revenue bonus (5% of 10M)'
);

select is(
  (
    select count(*)::integer
    from public.payroll_calculation_issues as issue
    where issue.source_fact_id = (select id from public.payroll_source_facts where source_key = 'res-order-c-nv13-mapped')
  ),
  0,
  'Test C: No calculation issue for mapped source teacher_vinh_zalo_direct_referral'
);

-- =========================================================================
-- TEST D: New enrollment with unmapped source
-- =========================================================================
select is(
  (
    select count(*)::integer
    from public.payroll_calculation_issues as issue
    where issue.source_fact_id = (select id from public.payroll_source_facts where source_key = 'res-order-d-nv13-unmapped')
      and issue.issue_code = 'missing_source_mapping'
  ),
  1,
  'Test D: Unmapped source correctly generates missing_source_mapping issue'
);

select is(
  (
    select issue.details->>'source_code'
    from public.payroll_calculation_issues as issue
    where issue.source_fact_id = (select id from public.payroll_source_facts where source_key = 'res-order-d-nv13-unmapped')
  ),
  'unmapped_random_source',
  'Test D: Issue details contain unmapped source_code context'
);

-- =========================================================================
-- TEST E: Version selection with reassignment & transfer
-- =========================================================================
-- Reassign Grade 7 from NV17 to NV16 starting 2026-07-20
select public.create_staff_grade_assignment(
  '93000000-0000-4000-8000-000000000016',
  7::smallint,
  '2026-07-20'::date,
  null,
  'Transfer grade 7 to NV16 on July 20'
);

-- Add fact on 2026-07-15 (should resolve NV17) and fact on 2026-07-25 (should resolve NV16)
insert into public.payroll_source_facts (
  fact_type, source_key, source_origin, event_date, staff_id, grade, amount_vnd, quantity, source_code, metadata
)
values
  ('renewal_order', 'res-order-e-g7-jul15', 'system', '2026-07-15', null, 7, 40000000, 1, null, '{"test":"E-NV17"}'),
  ('renewal_order', 'res-order-e-g7-jul25', 'system', '2026-07-25', null, 7, 40000000, 1, null, '{"test":"E-NV16"}');

-- Recalculate draft period
select public.generate_payroll_calculation_run(
  (select id from public.payroll_periods where period_month = '2026-07-01'),
  'Recalculate after grade 7 transfer to NV16'
);

-- Current run is revision 2
select is(
  (select revision from public.payroll_calculation_runs where status = 'current'),
  2,
  'Test E: Recalculation creates revision 2'
);

-- Jul 15 order (before transfer) goes to NV17
select is(
  (
    select count(*)::integer
    from public.payroll_line_items as item
    join public.payroll_statements as statement on statement.id = item.payroll_statement_id
    where statement.calculation_run_id = (select id from public.payroll_calculation_runs where status = 'current')
      and statement.staff_id = '93000000-0000-4000-8000-000000000017'
      and item.line_type = 'operations_grade_renewal_bonus'
      and item.source_id = (select id::text from public.payroll_source_facts where source_key = 'res-order-e-g7-jul15')
  ),
  1,
  'Test E: July 15 renewal order resolved to NV17 (prior to transfer)'
);

-- Jul 25 order (after transfer) goes to NV16
select is(
  (
    select count(*)::integer
    from public.payroll_line_items as item
    join public.payroll_statements as statement on statement.id = item.payroll_statement_id
    where statement.calculation_run_id = (select id from public.payroll_calculation_runs where status = 'current')
      and statement.staff_id = '93000000-0000-4000-8000-000000000016'
      and item.line_type = 'operations_grade_renewal_bonus'
      and item.source_id = (select id::text from public.payroll_source_facts where source_key = 'res-order-e-g7-jul25')
  ),
  1,
  'Test E: July 25 renewal order resolved to NV16 (after transfer)'
);

-- Total issues on revision 2 should only be 2: Test B (res-order-b-g7-jul01) and Test D (res-order-d-nv13-unmapped)
select is(
  (
    select count(*)::integer
    from public.payroll_calculation_issues as issue
    where issue.calculation_run_id = (select id from public.payroll_calculation_runs where status = 'current')
  ),
  2,
  'Test E: Current run only has exactly the 2 expected issues (Test B and Test D)'
);

-- Lead source mapping lookup check
select is(
  (
    select mapping.payroll_source_code
    from public.crm_lead_sources as source
    join public.payroll_lead_source_mapping_versions as mapping on mapping.lead_source_id = source.id
    where source.code = 'referral_teacher'
      and mapping.effective_from <= '2026-07-01'::date
    order by mapping.effective_from desc limit 1
  ),
  'teacher_vinh_zalo_direct_referral',
  'Lead source mapping referral_teacher maps to teacher_vinh_zalo_direct_referral'
);

select * from finish();
rollback;
