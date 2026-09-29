-- Regression: live estimates must include manual lines from the current run only.
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
alter table payroll_periods add approved_at timestamptz;
alter table finance_cashflow_records add amount_vnd bigint, add record_type text,
  add category text, add student_id uuid, add created_at timestamptz;
create temp table revision_events(month date, scope text, staff_id uuid);
create or replace function public.bump_payroll_live_revision(date,text,uuid)
returns void language sql as $$insert into pg_temp.revision_events values ($1,$2,$3)$$;
insert into profiles(id,display_name) values
('00000000-0000-4000-8000-000000000001','Assistant one'),
('00000000-0000-4000-8000-000000000002','Assistant two');
insert into staff_payroll_position_versions values
('00000000-0000-4000-8000-000000000001','teaching_assistant','2026-01-01'),
('00000000-0000-4000-8000-000000000002','teaching_assistant','2026-01-01');
insert into staff_daily_rate_versions(staff_id,effective_from,offline_daily_rate_vnd,online_rate_basis_points)
values ('00000000-0000-4000-8000-000000000001','2026-01-01',320000,5000),
       ('00000000-0000-4000-8000-000000000002','2026-01-01',300000,5000);
insert into payroll_source_facts(fact_type,event_date,staff_id,quantity)
values ('timekeeping','2026-08-10','00000000-0000-4000-8000-000000000001',4210),
       ('timekeeping','2026-08-10','00000000-0000-4000-8000-000000000002',3670);
insert into payroll_periods(id,period_month,status)
values ('00000000-0000-4000-8000-000000000010','2026-08-01','draft');
select public.generate_payroll_calculation_run('00000000-0000-4000-8000-000000000010','Initial run');
create temp table baseline as
select value as data from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','estimate')->'statements');
insert into payroll_line_items(payroll_statement_id,line_type,direction,amount_vnd,note)
select id,'manual_reward','earning',350000,'Monthly reward' from payroll_statements;
insert into payroll_line_items(payroll_statement_id,line_type,direction,amount_vnd,note)
select id,'manual_deduction','deduction',500000,'Manual deduction' from payroll_statements
where staff_id='00000000-0000-4000-8000-000000000001';


create temp table estimated as
select value as data from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','estimate')->'statements');
select pg_temp.assert_true(
  (select bool_and((e.data->>'totalEarningsVnd')::bigint=(b.data->>'totalEarningsVnd')::bigint+350000)
   from estimated e join baseline b on e.data->>'staffId'=b.data->>'staffId'),
  'both employees receive the missing 350000 reward');
select pg_temp.assert_true((select count(*)=7 from revision_events),
  'writer refresh plus three manual inserts notify both scopes');
select pg_temp.assert_true(
  (select data->>'totalDeductionsVnd'='500000' and
    (data->>'payableVnd')::bigint=(data->>'totalEarningsVnd')::bigint-500000
   from estimated where data->>'staffId'='00000000-0000-4000-8000-000000000001'),
  '500000 manual deduction changes net pay');
select pg_temp.assert_true(
  (select bool_and(e.data->>'workedMinutes'=b.data->>'workedMinutes')
   from estimated e join baseline b on e.data->>'staffId'=b.data->>'staffId'),
  'manual adjustments do not add working time');
select pg_temp.assert_true(
  (select count(*)=1 and sum((l->>'amountVnd')::bigint)=350000
   from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','estimate','00000000-0000-4000-8000-000000000002')->'lines') l
   where l->>'lineType' in ('manual_reward','manual_deduction')),
  'staff estimate includes only own adjustment');
select pg_temp.assert_true(
  (select count(*)=0 from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','final')->'lines') l
   where l->>'lineType' in ('manual_reward','manual_deduction')),
  'final projection leaves manual carry-forward to writer');
select pg_temp.assert_true(
  (select count(*)=0 from jsonb_array_elements(public.compute_payroll_projection('2026-09-01','2026-10-01','estimate')->'lines') l
   where l->>'lineType' in ('manual_reward','manual_deduction')),
  'adjustments do not leak into another month');

-- Recalculate twice: historical lines must not enter the estimate or be duplicated.
select public.generate_payroll_calculation_run('00000000-0000-4000-8000-000000000010','Second run');
select public.generate_payroll_calculation_run('00000000-0000-4000-8000-000000000010','Third run');
select pg_temp.assert_true(
  (select count(*)=3 from payroll_line_items l
   join payroll_statements s on s.id=l.payroll_statement_id
   join payroll_periods p on p.current_calculation_run_id=s.calculation_run_id
   where l.line_type in ('manual_reward','manual_deduction')),
  'recalculation carries each adjustment exactly once');
select pg_temp.assert_true(
  (select count(*)=3 from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','estimate')->'lines') l
   where l->>'lineType' in ('manual_reward','manual_deduction')),
  'estimate excludes superseded runs');
select pg_temp.assert_true(
  (select bool_and((e->>'totalEarningsVnd')::bigint=s.earnings and
                  (e->>'totalDeductionsVnd')::bigint=s.deductions and
                  (e->>'payableVnd')::bigint=s.earnings-s.deductions)
   from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','estimate')->'statements') e
   join (
     select s.staff_id,
       coalesce(sum(l.amount_vnd) filter(where l.direction='earning'),0) as earnings,
       coalesce(sum(l.amount_vnd) filter(where l.direction='deduction'),0) as deductions
     from payroll_statements s join payroll_periods p on p.current_calculation_run_id=s.calculation_run_id
     left join payroll_line_items l on l.payroll_statement_id=s.id group by s.staff_id
   ) s on s.staff_id::text=e->>'staffId'),
  'live gross, deductions and net match the saved payroll after recalculation');
-- Exercise the actual API read functions, including totals and staff visibility.
select pg_temp.assert_true(
  (select (r->'summary'->>'totalEarningsVnd')::bigint=(select sum((data->>'totalEarningsVnd')::bigint) from estimated)
    and r->'summary'->>'totalDeductionsVnd'='500000'
   from (select public.get_owner_payroll_estimate('2026-08-01') r) q),
  'owner API totals include rewards and deductions');
select pg_temp.assert_true(
  (select r->'statement'->>'totalDeductionsVnd'='500000'
    and r->'statement'->>'payableVnd'=(select data->>'payableVnd' from estimated
      where data->>'staffId'='00000000-0000-4000-8000-000000000001')
   from (select public.get_my_payroll_estimate('2026-08-01') r) q),
  'staff API agrees with owner and saved payroll');
select pg_temp.assert_true(
  public.get_owner_payroll_estimate('2026-08-01','admissions_manager')->'summary'->>'totalEarningsVnd'='0',
  'owner position filter excludes unrelated adjustments');

-- Confirm immutable approved snapshots still win over newly changed source data.
update payroll_periods set status='approved',approved_at=now();
update payroll_source_facts set quantity=quantity+540;
select pg_temp.assert_true(
  (select r->>'status'='approved' and
    (r->'summary'->>'totalEarningsVnd')::bigint=(select sum((data->>'totalEarningsVnd')::bigint) from estimated)
   from (select public.get_owner_payroll_estimate('2026-08-01') r) q),
  'approved owner snapshot is unchanged by new source data');
select pg_temp.assert_true(
  (select r->>'status'='approved' and r->'statement'->>'payableVnd'=(select data->>'payableVnd' from estimated
    where data->>'staffId'='00000000-0000-4000-8000-000000000001')
   from (select public.get_my_payroll_estimate('2026-08-01') r) q),
  'approved staff snapshot remains unchanged');
update payroll_periods set status='draft';

-- Inserts, edits and deletes notify both scopes; obsolete runs do not notify.
truncate revision_events;
update payroll_line_items l set amount_vnd=360000
from payroll_statements s join payroll_periods p on p.current_calculation_run_id=s.calculation_run_id
where l.payroll_statement_id=s.id and l.line_type='manual_reward';
select pg_temp.assert_true((select count(*)=4 from revision_events), 'current manual edits notify owner and both staff');
select pg_temp.assert_true(
  (select count(*)=2 from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','estimate')->'lines') l
   where l->>'lineType'='manual_reward' and l->>'amountVnd'='360000'),
  'edited manual amounts appear in estimate');
truncate revision_events;
update payroll_line_items l set amount_vnd=999999
from payroll_statements s join payroll_periods p on p.id=s.payroll_period_id
where l.payroll_statement_id=s.id and s.calculation_run_id<>p.current_calculation_run_id and l.line_type='manual_reward';
select pg_temp.assert_true((select count(*)=0 from revision_events),'obsolete adjustments do not notify');
delete from payroll_line_items l using payroll_statements s,payroll_periods p
where l.payroll_statement_id=s.id and p.current_calculation_run_id=s.calculation_run_id and l.line_type='manual_deduction';
select pg_temp.assert_true((select count(*)=2 from revision_events),'manual deletion notifies owner and staff');
select pg_temp.assert_true(
  (select count(*)=0 from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','estimate')->'lines') l
   where l->>'lineType'='manual_deduction'), 'deleted deduction disappears from estimate');

-- Resetting a draft clears the current run: old adjustments must disappear too.
update payroll_periods set current_calculation_run_id=null;
select pg_temp.assert_true(
  (select count(*)=0 from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','estimate')->'lines') l
   where l->>'lineType' in ('manual_reward','manual_deduction')),
  'reset draft excludes historical manual lines');
