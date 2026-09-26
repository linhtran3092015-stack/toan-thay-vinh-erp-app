insert into profiles(id,display_name) values ('00000000-0000-4000-8000-000000000001','Operations'),('00000000-0000-4000-8000-000000000002','Teacher');
insert into staff_payroll_position_versions values ('00000000-0000-4000-8000-000000000001','operations_assistant','2026-01-01'),('00000000-0000-4000-8000-000000000002','teaching_assistant','2026-01-01');
insert into staff_daily_rate_versions(staff_id,effective_from,offline_daily_rate_vnd,online_rate_basis_points) values ('00000000-0000-4000-8000-000000000001','2026-01-01',400000,5000);
insert into payroll_policy_versions(policy_code,effective_from,parameters) values
('operations_center_renewal_duty','2026-01-01','{"rate_basis_points":50}'),
('operations_record_excess','2026-01-01','{"rate_basis_points":500,"record_revenue_vnd":310040000}'),
('operations_payroll_processing','2026-01-01','{"amount_per_staff_vnd":25000,"include_self":true}'),
('operations_daily_admin_reporting','2026-01-01','{"amount_per_day_vnd":30000}'),
('operations_addon_product_sales','2026-01-01','{"rate_basis_points":500}'),
('operations_staff_recruitment_care','2026-01-01','{"rate_basis_points":500}'),
('operations_grade_renewal','2026-01-01','{"rate_basis_points":200}'),
('operations_piecework_floor','2026-01-01','{"base_salary_basis_points":8500}');
insert into staff_payroll_task_versions select '00000000-0000-4000-8000-000000000001',t,true,'2026-01-01' from unnest(array['center_renewal_duty','record_excess','payroll_processing','daily_admin_reporting','addon_product_sales','staff_recruitment_care']) t;
insert into payroll_source_facts(fact_type,event_date,staff_id,amount_vnd,quantity,grade) values
('renewal_order','2026-08-10','00000000-0000-4000-8000-000000000001',320040000,1,7),
('daily_admin_reporting','2026-08-10','00000000-0000-4000-8000-000000000001',null,2,null),
('addon_product_order','2026-08-10','00000000-0000-4000-8000-000000000001',1000000,1,null),
('staff_recruitment_salary','2026-08-10','00000000-0000-4000-8000-000000000001',4000000,1,null),
('timekeeping','2026-08-10','00000000-0000-4000-8000-000000000001',null,540,null);
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end$$;
create temp table projection as select public.compute_payroll_projection('2026-08-01','2026-09-01','final') as data;
select pg_temp.assert_true((select count(*)=6 from projection,jsonb_array_elements(data->'lines') l where l->>'lineType' in ('center_renewal_duty_bonus','record_excess_bonus','payroll_processing_bonus','daily_admin_reporting_bonus','addon_product_sales_bonus','staff_recruitment_care_bonus')), 'all six optional bonus groups restored');
select pg_temp.assert_true((select (l->>'amountVnd')::bigint=expected.amount from projection,jsonb_array_elements(data->'lines') l where l->>'lineType'=expected.kind),expected.kind) from (values ('center_renewal_duty_bonus',1600200),('record_excess_bonus',500000),('payroll_processing_bonus',50000),('daily_admin_reporting_bonus',60000),('addon_product_sales_bonus',50000),('staff_recruitment_care_bonus',200000),('piecework_offset',340000)) expected(kind,amount);
select pg_temp.assert_true((select l->'evidenceSnapshot'->>'order_value_vnd'='320040000' and l->'evidenceSnapshot'->>'grade'='7' and l->>'workedMinutes'='0' from projection,jsonb_array_elements(data->'lines') l where l->>'lineType'='operations_grade_renewal_bonus'),'renewal evidence and no fake work minutes');
select pg_temp.assert_true((select l->>'quantity'='2' from projection,jsonb_array_elements(data->'lines') l where l->>'lineType'='daily_admin_reporting_bonus'),'report quantity preserved');
select pg_temp.assert_true((select l->>'amountVnd'='50000' from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','estimate','00000000-0000-4000-8000-000000000001')->'lines') l where l->>'lineType'='payroll_processing_bonus'),'single staff estimate keeps global headcount');
select pg_temp.assert_true((select count(*)=0 from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-08-05','estimate')->'lines') l where l->>'lineType' in ('center_renewal_duty_bonus','daily_admin_reporting_bonus')),'cutoff excludes future facts');
insert into staff_payroll_task_versions values ('00000000-0000-4000-8000-000000000001','daily_admin_reporting',false,'2026-08-11');
insert into payroll_source_facts(fact_type,event_date,staff_id,quantity) values ('daily_admin_reporting','2026-08-12','00000000-0000-4000-8000-000000000001',5);
select pg_temp.assert_true((select sum((l->>'amountVnd')::bigint)=60000 from jsonb_array_elements(public.compute_payroll_projection('2026-08-01','2026-09-01','final')->'lines') l where l->>'lineType'='daily_admin_reporting_bonus'),'disabled task respects event date');
update payroll_source_facts set event_date=event_date+interval '1 month';
select pg_temp.assert_true((select l->>'amountVnd'='1600200' from jsonb_array_elements(public.compute_payroll_projection('2026-09-01','2026-10-01','final')->'lines') l where l->>'lineType'='center_renewal_duty_bonus'),'next period repeats monthly bonus');
select pg_temp.assert_true((select count(*)=0 from jsonb_array_elements(public.compute_payroll_projection('2026-09-01','2026-10-01','final')->'lines') l where l->>'lineType'='daily_admin_reporting_bonus'),'disabled task stays disabled next period');
insert into payroll_policy_versions(policy_code,effective_from,parameters) values ('operations_payroll_processing','2026-09-01','{"amount_per_staff_vnd":30000,"include_self":false}');
select pg_temp.assert_true((select l->>'amountVnd'='30000' from jsonb_array_elements(public.compute_payroll_projection('2026-09-01','2026-10-01','final','00000000-0000-4000-8000-000000000001')->'lines') l where l->>'lineType'='payroll_processing_bonus'),'next period policy and exclude self');
-- Writer integration: use a past month so the real clock cannot truncate fixture facts.
update payroll_source_facts set event_date='2026-08-10';
insert into payroll_periods(id,period_month,status) values ('00000000-0000-4000-8000-000000000010','2026-08-01','draft');
select public.generate_payroll_calculation_run('00000000-0000-4000-8000-000000000010','Regression verification');
select pg_temp.assert_true((select evidence_snapshot->>'order_value_vnd'='320040000' and work_minutes=0 and quantity=1 from payroll_line_items where line_type='operations_grade_renewal_bonus'),'writer persists evidence and quantity');
select pg_temp.assert_true((select count(distinct line_type)=6 from payroll_line_items where line_type in ('center_renewal_duty_bonus','record_excess_bonus','payroll_processing_bonus','daily_admin_reporting_bonus','addon_product_sales_bonus','staff_recruitment_care_bonus') group by true::boolean),'writer persists all bonus groups');
update payroll_periods set status='locked';
do $$begin
  begin
    perform public.generate_payroll_calculation_run('00000000-0000-4000-8000-000000000010','Must reject locked period');
    raise exception 'FAIL: locked period accepted';
  exception when check_violation then
    if sqlerrm <> 'PAYROLL_PERIOD_NOT_DRAFT' then raise; end if;
  end;
end$$;
select pg_temp.assert_true((select count(*)=1 from payroll_calculation_runs),'locked period has no new run');
-- Admissions contract: all source rates, exact tier boundaries, and full base floor.
insert into profiles(id,display_name) values ('00000000-0000-4000-8000-000000000003','Admissions');
insert into staff_payroll_position_versions values ('00000000-0000-4000-8000-000000000003','admissions_manager','2026-01-01');
insert into staff_daily_rate_versions(staff_id,effective_from,offline_daily_rate_vnd,online_rate_basis_points) values ('00000000-0000-4000-8000-000000000003','2026-01-01',400000,5000);
insert into payroll_policy_versions(policy_code,effective_from,parameters) values
('admissions_new_enrollment','2026-01-01','{"fixed_by_source":{"self_sourced":500000,"school_telesales_ads":200000,"teacher_vinh_zalo_direct_referral":50000,"math_to_english":100000}}'),
('admissions_revenue_tiers','2026-01-01','{"tiers":[{"minimum_vnd":0,"rate_basis_points":0},{"minimum_vnd":20000000,"rate_basis_points":400},{"minimum_vnd":30000000,"rate_basis_points":600},{"minimum_vnd":40000000,"rate_basis_points":800}]}'),
('admissions_piecework_floor','2026-01-01','{"base_salary_basis_points":10000}');
insert into payroll_source_facts(fact_type,event_date,staff_id,amount_vnd,quantity,source_code) select 'new_enrollment_order','2026-08-10','00000000-0000-4000-8000-000000000003',1000000,1,s from unnest(array['self_sourced','school_telesales_ads','teacher_vinh_zalo_direct_referral','math_to_english']) s;
insert into payroll_source_facts(fact_type,event_date,staff_id,quantity) values ('timekeeping','2026-08-10','00000000-0000-4000-8000-000000000003',540);
do $$
declare result jsonb; revenue bigint; expected bigint;
begin
 result:=public.compute_payroll_projection('2026-08-01','2026-09-01','final','00000000-0000-4000-8000-000000000003');
 perform pg_temp.assert_true((select sum((l->>'amountVnd')::bigint)=850000 from jsonb_array_elements(result->'lines') l where l->>'lineType'='new_student_fixed_bonus'),'admissions four fixed source bonuses');
 perform pg_temp.assert_true((select (l->>'amountVnd')::bigint=400000 from jsonb_array_elements(result->'lines') l where l->>'lineType'='piecework_offset'),'admissions floor offsets 100 percent of base');
 for revenue,expected in select * from (values (19999996::bigint,0::bigint),(20000000,800000),(29999996,1200000),(30000000,1800000),(40000000,3200000)) t(r,a) loop
   update payroll_source_facts set amount_vnd=revenue/4 where staff_id='00000000-0000-4000-8000-000000000003' and fact_type='new_enrollment_order';
   result:=public.compute_payroll_projection('2026-08-01','2026-09-01','final','00000000-0000-4000-8000-000000000003');
   perform pg_temp.assert_true((select coalesce(sum((l->>'amountVnd')::bigint),0)=expected from jsonb_array_elements(result->'lines') l where l->>'lineType'='admissions_revenue_tier_bonus'),'admissions full-revenue tier at '||revenue);
 end loop;
end$$;
