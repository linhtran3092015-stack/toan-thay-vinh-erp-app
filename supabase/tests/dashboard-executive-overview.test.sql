begin;
select plan(17);

select ok(to_regprocedure('public.get_dashboard_executive_overview(date)') is not null, 'dashboard overview RPC exists');
select ok(not has_function_privilege('anon', 'public.get_dashboard_executive_overview(date)', 'execute'), 'anon cannot call the dashboard RPC');

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'dash-owner@example.test', '{}', '{}', now(), now()),
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'dash-ta@example.test', '{}', '{}', now(), now());
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'a1000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'a1000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';

insert into public.guardians (id, full_name, phone)
values ('a3000000-0000-4000-8000-000000000001', 'Phụ huynh Dashboard', '0922222222');
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status) values
  ('a4000000-0000-4000-8000-000000000001', 'TV-2026-97001', 'Dashboard Một', 2014, 6, 'active'),
  ('a4000000-0000-4000-8000-000000000002', 'TV-2026-97002', 'Dashboard Hai', 2015, 5, 'resumed'),
  ('a4000000-0000-4000-8000-000000000003', 'TV-2026-97003', 'Dashboard Ba', 2013, 7, 'reserved');
insert into public.student_guardians (student_id, guardian_id, relationship, is_primary)
values ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'mother', true);

-- Revenue is attributed by effective_on (bank date), not created_at.
insert into public.finance_cashflow_records (record_type, category, amount_vnd, student_id, reference_code, note, created_by, created_at, effective_on) values
  ('receipt', 'tuition_fee', 1000000, 'a4000000-0000-4000-8000-000000000001', 'DASH-1', 'fixture', 'a1000000-0000-4000-8000-000000000001', '2026-10-03 09:00:00+07', date '2026-09-15'),
  ('receipt', 'other', 250000, 'a4000000-0000-4000-8000-000000000001', 'DASH-2', 'fixture', 'a1000000-0000-4000-8000-000000000001', '2026-09-10 09:00:00+07', date '2026-09-10'),
  ('receipt', 'tuition_fee', 500000, 'a4000000-0000-4000-8000-000000000001', 'DASH-3', 'fixture', 'a1000000-0000-4000-8000-000000000001', '2026-08-20 09:00:00+07', date '2026-08-20'),
  ('disbursement', 'other', 200000, null, 'DASH-4', 'fixture', 'a1000000-0000-4000-8000-000000000001', '2026-09-12 09:00:00+07', date '2026-09-12');

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select public.create_student_payment_request('a4000000-0000-4000-8000-000000000001', 1400000, 10, 0, 140000, 'renewal', null);

create temp table dash as select public.get_dashboard_executive_overview(date '2026-09-01') as payload;

select is((select payload->>'month' from dash), '2026-09', 'the payload echoes the selected month');
select is((select (payload->'kpis'->'cashflow'->>'revenue_vnd')::bigint from dash), 1250000::bigint, 'september revenue sums receipts by bank date');
select is((select (payload->'kpis'->'cashflow'->>'prev_revenue_vnd')::bigint from dash), 500000::bigint, 'previous month revenue is reported for the change rate');
select is((select (payload->'kpis'->'cashflow'->>'disbursement_vnd')::bigint from dash), 200000::bigint, 'september disbursements are summed');
select is((select (payload->'kpis'->'cashflow'->>'receivables_vnd')::bigint from dash), 1400000::bigint, 'open payment requests form the receivables');
select is((select (payload->'kpis'->'students'->>'active_count')::int from dash), 2, 'active and resumed students count as active');
select is((select jsonb_array_length(payload->'revenue_trend') from dash), 12, 'the revenue trend covers twelve months');
select is(
  (select (item->>'revenue_vnd')::bigint from dash, jsonb_array_elements(payload->'revenue_trend') as item where item->>'month' = '2026-09'),
  1250000::bigint, 'the trend month matches the KPI revenue');
select is(
  (select item->>'category' from dash, jsonb_array_elements(payload->'revenue_composition') as item limit 1),
  'tuition_fee', 'revenue composition lists the largest category first');
select is((select (payload->'student_status'->>'reserved')::int from dash), 1, 'student status counts reserved students');
select is((select (payload->'receivables_aging'->>'under_30_vnd')::bigint from dash), 1400000::bigint, 'a request created today is under 30 days old');
select is((select (payload->'payroll_summary'->>'statement_count')::int from dash), 0, 'owner sees the payroll summary even without statements');

-- A teaching assistant sees only what their permissions allow.
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
create temp table dash_ta as select public.get_dashboard_executive_overview(date '2026-09-01') as payload;
select is((select payload->'kpis' from dash_ta), 'null'::jsonb, 'without finance or student permissions the KPI block is hidden');
select is((select payload->'payroll_summary' from dash_ta), 'null'::jsonb, 'payroll.view alone does not expose the payroll fund');

select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.get_dashboard_executive_overview(date '2026-09-01')$$, '28000', 'AUTHENTICATION_REQUIRED', 'unauthenticated calls are refused');

select * from finish();
rollback;
