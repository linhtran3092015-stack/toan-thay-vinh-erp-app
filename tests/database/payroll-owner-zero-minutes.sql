-- Regression test:
-- 1. Zero-minute (under 1 minute) entries do not trigger missing_daily_rate or missing_payroll_position
-- 2. Profiles with owner role and no staff payroll position do not trigger missing_daily_rate or missing_payroll_position
-- 3. Regular employees who actually worked > 0 minutes and lack position/rate still trigger issues

create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

-- 1. Setup owner profile
insert into profiles(id, display_name, email) values ('00000000-0000-4000-8000-000000000099', 'Center Owner', 'owner@example.com');
insert into roles(id, code) values ('00000000-0000-4000-8000-0000000000aa', 'owner');
insert into user_role_assignments(user_id, role_id, revoked_at) values ('00000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-0000000000aa', null);

-- 2. Owner has a 25-second test time entry on 2026-08-18 (worked_minutes = 0)
insert into time_entries(id, staff_id, work_date, check_in_mode, check_in_at, check_out_at, status)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000099', '2026-08-18', 'offline', '2026-08-18 02:00:00Z', '2026-08-18 02:00:25Z', 'checked_out');

-- Owner has a 7-hour entry on 2026-08-28 (worked_minutes > 0, but is owner)
insert into time_entries(id, staff_id, work_date, check_in_mode, check_in_at, check_out_at, status)
values ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000099', '2026-08-28', 'offline', '2026-08-28 08:00:00Z', '2026-08-28 15:00:00Z', 'checked_out');

create temp table owner_proj as
select public.compute_payroll_projection('2026-08-01', '2026-09-01', 'final') as data;

select pg_temp.assert_true(
  (select count(*) = 0 from owner_proj, jsonb_array_elements(data->'issues') i
   where i->>'staffId' = '00000000-0000-4000-8000-000000000099'),
  'owner entries produce zero blocking issues'
);

-- 3. Regular employee with 0-minute entry (under 1 min) produces NO issue
insert into profiles(id, display_name, email) values ('00000000-0000-4000-8000-000000000088', 'Regular Staff', 'staff@example.com');
insert into time_entries(id, staff_id, work_date, check_in_mode, check_in_at, check_out_at, status)
values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000088', '2026-08-19', 'offline', '2026-08-19 03:00:00Z', '2026-08-19 03:00:20Z', 'checked_out');

create temp table zero_min_proj as
select public.compute_payroll_projection('2026-08-01', '2026-09-01', 'final') as data;

select pg_temp.assert_true(
  (select count(*) = 0 from zero_min_proj, jsonb_array_elements(data->'issues') i
   where i->>'staffId' = '00000000-0000-4000-8000-000000000088'),
  'zero-minute entry for regular staff produces zero blocking issues'
);

-- 4. Regular employee who actually worked 120 minutes without position/rate DOES trigger issues
insert into time_entries(id, staff_id, work_date, check_in_mode, check_in_at, check_out_at, status)
values ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000088', '2026-08-20', 'offline', '2026-08-20 08:00:00Z', '2026-08-20 10:00:00Z', 'checked_out');

create temp table actual_work_proj as
select public.compute_payroll_projection('2026-08-01', '2026-09-01', 'final') as data;

select pg_temp.assert_true(
  (select count(*) = 2 from actual_work_proj, jsonb_array_elements(data->'issues') i
   where i->>'staffId' = '00000000-0000-4000-8000-000000000088'),
  'actual worked entry without config triggers missing_daily_rate and missing_payroll_position'
);
