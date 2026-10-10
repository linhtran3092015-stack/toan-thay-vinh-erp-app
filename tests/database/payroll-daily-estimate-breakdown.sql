-- Regression: daily payroll breakdown inputs (shifts + per-line workDate) for staff and owner views.
-- Run after tests/database/payroll-projection-fixture.sql and the production compute_payroll_projection,
-- then supabase/migrations/20261010100000_payroll_daily_estimate_breakdown.sql.
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

alter table payroll_periods add column if not exists approved_at timestamptz;
alter table payroll_line_items add column if not exists source_time_entry_id uuid;

insert into profiles(id, display_name, email, employee_code) values
  ('00000000-0000-4000-8000-000000000001', 'Trợ lý một', 'one@example.com', 'NV01'),
  ('00000000-0000-4000-8000-000000000002', 'Trợ lý hai', 'two@example.com', 'NV02');
insert into staff_payroll_position_versions values
  ('00000000-0000-4000-8000-000000000001', 'teaching_assistant', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000002', 'teaching_assistant', '2026-01-01');
insert into staff_daily_rate_versions(staff_id, effective_from, offline_daily_rate_vnd, online_rate_basis_points) values
  ('00000000-0000-4000-8000-000000000001', '2026-01-01', 300000, 5000),
  ('00000000-0000-4000-8000-000000000002', '2026-01-01', 300000, 5000);
insert into payroll_policy_versions(policy_code, parameters, effective_from) values
  ('teaching_allowance', '{"amount_vnd": 50000}', '2026-01-01');

-- Staff 1: full offline day on 02/10, online half-shift on 03/10, open shift on 05/10.
insert into time_entries(id, staff_id, work_date, check_in_mode, check_in_at, check_out_at, status) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '2026-10-02', 'offline', '2026-10-02 08:00+07', '2026-10-02 17:00+07', 'checked_out'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '2026-10-03', 'online',  '2026-10-03 13:00+07', '2026-10-03 17:30+07', 'checked_out'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '2026-10-05', 'offline', '2026-10-05 08:00+07', null, 'open'),
  -- Staff 2 must never leak into staff 1 output
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '2026-10-02', 'offline', '2026-10-02 08:00+07', '2026-10-02 12:00+07', 'checked_out');
insert into payroll_source_facts(fact_type, event_date, staff_id, quantity) values
  ('teaching_allowance', '2026-10-03', '00000000-0000-4000-8000-000000000001', 1);

-- ---------------------------------------------------------------------------
-- Live estimate for the current actor (staff 1)
-- ---------------------------------------------------------------------------
create temp table mine as select public.get_my_payroll_estimate('2026-10-01') as data;

select pg_temp.assert_true((select jsonb_array_length(data->'shifts') from mine) = 3, 'shifts include every entry of the month (2 closed + 1 open), only for the actor');
select pg_temp.assert_true(
  (select bool_and(line ? 'workDate' and line ? 'sourceKind') from mine, jsonb_array_elements(data->'lines') as line),
  'every live line carries workDate and sourceKind');
select pg_temp.assert_true(
  (select coalesce(sum((line->>'amountVnd')::bigint), 0) from mine, jsonb_array_elements(data->'lines') as line where line->>'workDate' = '2026-10-02') = 300000,
  'offline full day on 02/10 earns the daily rate');
select pg_temp.assert_true(
  (select coalesce(sum((line->>'amountVnd')::bigint), 0) from mine, jsonb_array_elements(data->'lines') as line where line->>'workDate' = '2026-10-03') = 75000 + 50000,
  'online 270 minutes (50%) plus teaching allowance both land on 03/10');
select pg_temp.assert_true(
  (select (data->'statement'->>'totalEarningsVnd')::bigint from mine)
    = (select sum((line->>'amountVnd')::bigint) from mine, jsonb_array_elements(data->'lines') as line where line->>'direction' = 'earning'),
  'daily lines add up to the statement total');
select pg_temp.assert_true(
  (select count(*) from mine, jsonb_array_elements(data->'shifts') as shift where shift->>'status' = 'open' and (shift->>'workedMinutes')::int = 0) = 1,
  'open shift is reported with zero paid minutes');
select pg_temp.assert_true((select jsonb_array_length(data->'recentShifts') from mine) = 2, 'recentShifts keeps only closed shifts');
select pg_temp.assert_true((select jsonb_array_length(data->'openShifts') from mine) = 1, 'openShifts still lists the running shift');

-- ---------------------------------------------------------------------------
-- Owner view of another staff member
-- ---------------------------------------------------------------------------
create temp table owner_view as select public.get_staff_payroll_estimate('00000000-0000-4000-8000-000000000002', '2026-10-01') as data;
select pg_temp.assert_true((select data->>'staffDisplayName' from owner_view) = 'Trợ lý hai', 'owner view returns the target staff display name');
select pg_temp.assert_true((select data->>'staffId' from owner_view) = '00000000-0000-4000-8000-000000000002', 'owner view echoes staffId');
select pg_temp.assert_true((select jsonb_array_length(data->'shifts') from owner_view) = 1, 'owner view only lists the target staff shifts');
select pg_temp.assert_true(
  (select (data->'statement'->>'totalEarningsVnd')::bigint from owner_view) = 300000 * 240 / 540,
  'owner view computes the target staff pay (4h offline)');

-- Unknown staff raises
do $$
begin
  perform public.get_staff_payroll_estimate('00000000-0000-4000-8000-00000000dead', '2026-10-01');
  raise exception 'FAIL: unknown staff should raise';
exception when others then
  if sqlerrm <> 'STAFF_PROFILE_NOT_FOUND' then raise; end if;
  raise notice 'PASS: unknown staff raises STAFF_PROFILE_NOT_FOUND';
end $$;

-- Non-normalised month raises
do $$
begin
  perform public.get_staff_payroll_estimate('00000000-0000-4000-8000-000000000002', '2026-10-15');
  raise exception 'FAIL: mid-month date should raise';
exception when others then
  if sqlerrm <> 'PAYROLL_MONTH_INVALID' then raise; end if;
  raise notice 'PASS: mid-month date raises PAYROLL_MONTH_INVALID';
end $$;

-- Permission: a plain staff (no payroll.dashboard.view) cannot read another staff member
create or replace function has_permission(text) returns boolean language sql as $$select $1 <> 'payroll.dashboard.view'$$;
do $$
begin
  perform public.get_staff_payroll_estimate('00000000-0000-4000-8000-000000000002', '2026-10-01');
  raise exception 'FAIL: dashboard permission should be required for other staff';
exception when others then
  if sqlerrm <> 'PAYROLL_DASHBOARD_VIEW_PERMISSION_REQUIRED' then raise; end if;
  raise notice 'PASS: other staff requires payroll.dashboard.view';
end $$;
select pg_temp.assert_true(
  (public.get_staff_payroll_estimate('00000000-0000-4000-8000-000000000001', '2026-10-01')->>'staffId') = '00000000-0000-4000-8000-000000000001',
  'staff can still read their own breakdown without dashboard permission');
create or replace function has_permission(text) returns boolean language sql as $$select true$$;

-- ---------------------------------------------------------------------------
-- Approved period: workDate derived from the snapshot's source references
-- ---------------------------------------------------------------------------
insert into payroll_periods(id, period_month, status, current_calculation_run_id, approved_at)
values ('20000000-0000-4000-8000-000000000001', '2026-09-01', 'approved', '20000000-0000-4000-8000-000000000002', '2026-10-01 09:00+07');
insert into payroll_statements(id, payroll_period_id, calculation_run_id, staff_id, staff_display_name_snapshot, staff_employee_code_snapshot, work_units, work_hours, work_minutes)
values ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Trợ lý một', 'NV01', 1, 9, 540);
insert into time_entries(id, staff_id, work_date, check_in_mode, check_in_at, check_out_at, status) values
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', '2026-09-12', 'offline', '2026-09-12 08:00+07', '2026-09-12 17:00+07', 'checked_out');
insert into payroll_source_facts(id, fact_type, event_date, staff_id, quantity) values
  ('30000000-0000-4000-8000-000000000001', 'teaching_allowance', '2026-09-20', '00000000-0000-4000-8000-000000000001', 1);
insert into payroll_line_items(payroll_statement_id, line_type, direction, amount_vnd, work_minutes, source_kind, source_id, source_time_entry_id) values
  ('20000000-0000-4000-8000-000000000003', 'base_offline', 'earning', 300000, 540, 'time_entry', '10000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000009'),
  ('20000000-0000-4000-8000-000000000003', 'teaching_allowance', 'earning', 50000, null, 'payroll_source_fact', '30000000-0000-4000-8000-000000000001', null),
  ('20000000-0000-4000-8000-000000000003', 'manual_reward', 'earning', 20000, null, 'manual_adjustment', null, null);

create temp table approved as select public.get_my_payroll_estimate('2026-09-01') as data;
select pg_temp.assert_true((select data->>'status' from approved) = 'approved', 'approved period is read from the snapshot');
select pg_temp.assert_true(
  (select line->>'workDate' from approved, jsonb_array_elements(data->'lines') as line where line->>'lineType' = 'base_offline') = '2026-09-12',
  'approved base line resolves workDate from its time entry');
select pg_temp.assert_true(
  (select line->>'workDate' from approved, jsonb_array_elements(data->'lines') as line where line->>'lineType' = 'teaching_allowance') = '2026-09-20',
  'approved allowance line resolves workDate from its source fact');
select pg_temp.assert_true(
  (select line->>'workDate' from approved, jsonb_array_elements(data->'lines') as line where line->>'lineType' = 'manual_reward') = '2026-09-01',
  'approved manual line falls back to the period month (monthly item)');
select pg_temp.assert_true((select jsonb_array_length(data->'shifts') from approved) = 1, 'approved period still returns the month shifts for display');
select pg_temp.assert_true((select (data->'statement'->>'payableVnd')::bigint from approved) = 370000, 'approved payable is the snapshot total');
