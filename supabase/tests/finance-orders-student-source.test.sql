begin;

select plan(28);

-- Orders resolve Nguồn from the student's current acquisition source first,
-- then the receipt's CRM accrual, then the student's CRM case. All receipts
-- are bank-dated 2026-11-05 (settlement period 1); every acquisition source is
-- assigned explicitly on 2026-11-19/20, after the bank date, like the
-- 2026-10-12 import that post-dates earlier receipts. Fixed timestamps keep
-- this true regardless of the wall clock.

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
  (
    '91000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'orders-source-manager@example.test',
    '{"provider":"email"}',
    '{"full_name":"Orders Source Manager"}',
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'orders-source-viewer@example.test',
    '{"provider":"email"}',
    '{"full_name":"Orders Source Viewer"}',
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'orders-source-sale@example.test',
    '{"provider":"email"}',
    '{"full_name":"Orders Source Sale"}',
    now(),
    now()
  );

insert into public.roles (id, code, name)
values
  ('92000000-0000-0000-0000-000000000001', 'orders_source_manager_test', 'Orders source manager test'),
  ('92000000-0000-0000-0000-000000000002', 'orders_source_viewer_test', 'Orders source viewer test');

insert into public.role_permissions (role_id, permission_id)
select '92000000-0000-0000-0000-000000000001', permission.id
from public.permissions as permission
where permission.code in ('finance.view', 'payments.manage');

insert into public.role_permissions (role_id, permission_id)
select '92000000-0000-0000-0000-000000000002', permission.id
from public.permissions as permission
where permission.code = 'finance.view';

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values
  ('91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'Orders source manager fixture'),
  ('91000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', 'Orders source viewer fixture');

insert into public.guardians (id, full_name, phone)
values ('93000000-0000-0000-0000-000000000001', 'Orders Source Guardian', '0900009101');

-- S1 sandbox assignment (superseded MMA row) · S2 MMA assignment · S3 "other"
-- assignment · S4 MMA assignment + converted SB CRM case (accrual) · S5 SB CRM
-- case only, not converted · S6 no source · S7 SB F1 assignment.
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status)
values
  ('94000000-0000-0000-0000-000000000001', 'TV-2026-91001', 'Orders Source Student One', 2014, 6, 'active'),
  ('94000000-0000-0000-0000-000000000002', 'TV-2026-91002', 'Orders Source Student Two', 2014, 6, 'active'),
  ('94000000-0000-0000-0000-000000000003', 'TV-2026-91003', 'Orders Source Student Three', 2014, 6, 'active'),
  ('94000000-0000-0000-0000-000000000004', 'TV-2026-91004', 'Orders Source Student Four', 2014, 6, 'active'),
  ('94000000-0000-0000-0000-000000000005', 'TV-2026-91005', 'Orders Source Student Five', 2014, 6, 'active'),
  ('94000000-0000-0000-0000-000000000006', 'TV-2026-91006', 'Orders Source Student Six', 2014, 6, 'active'),
  ('94000000-0000-0000-0000-000000000007', 'TV-2026-91007', 'Orders Source Student Seven', 2014, 6, 'active');

insert into public.student_guardians (student_id, guardian_id, relationship, is_primary, linked_at)
select student.id, '93000000-0000-0000-0000-000000000001', 'parent', true, '2026-01-01 00:00:00+00'
from public.students as student
where student.id::text like '94000000-%';

insert into public.crm_lead_sources (id, code, name, group_code)
values ('93100000-0000-0000-0000-000000000001', 'orders_source_sb_f1', 'Orders Source SB F1', 'sandbox');

insert into public.student_acquisition_source_assignments (
  student_id,
  lead_source_id,
  reason,
  assigned_by,
  assigned_at,
  is_current
)
select fixture.student_id::uuid, lead_source.id, 'Orders source fixture', '91000000-0000-0000-0000-000000000001', fixture.assigned_at, fixture.is_current
from (
  values
    ('94000000-0000-0000-0000-000000000001', 'mma_zalo', timestamptz '2026-11-19 00:00:00+00', false),
    ('94000000-0000-0000-0000-000000000001', 'sandbox_partner', timestamptz '2026-11-20 00:00:00+00', true),
    ('94000000-0000-0000-0000-000000000002', 'mma_zalo', timestamptz '2026-11-20 00:00:00+00', true),
    ('94000000-0000-0000-0000-000000000003', 'direct_walkin', timestamptz '2026-11-20 00:00:00+00', true),
    ('94000000-0000-0000-0000-000000000004', 'mma_zalo', timestamptz '2026-11-20 00:00:00+00', true),
    ('94000000-0000-0000-0000-000000000007', 'orders_source_sb_f1', timestamptz '2026-11-20 00:00:00+00', true)
) as fixture(student_id, source_code, assigned_at, is_current)
join public.crm_lead_sources as lead_source
  on lead_source.code = fixture.source_code;

insert into public.crm_cases (
  id,
  public_code,
  full_name,
  birth_year,
  expected_grade,
  guardian_id,
  guardian_phone,
  guardian_full_name,
  lead_source_id,
  sale_owner_id,
  status,
  student_id,
  created_by
)
select
  fixture.case_id::uuid,
  fixture.public_code,
  fixture.full_name,
  2014,
  6,
  '93000000-0000-0000-0000-000000000001',
  '0900009101',
  'Orders Source Guardian',
  lead_source.id,
  '91000000-0000-0000-0000-000000000003',
  fixture.status,
  fixture.student_id::uuid,
  '91000000-0000-0000-0000-000000000001'
from (
  values
    ('93200000-0000-0000-0000-000000000004', 'CRM-ORDERS-SOURCE-4', 'Orders Source Student Four', 'converted', '94000000-0000-0000-0000-000000000004'),
    ('93200000-0000-0000-0000-000000000005', 'CRM-ORDERS-SOURCE-5', 'Orders Source Student Five', 'pending_enrollment_confirmation', '94000000-0000-0000-0000-000000000005')
) as fixture(case_id, public_code, full_name, status, student_id)
join public.crm_lead_sources as lead_source
  on lead_source.code = 'sandbox_partner';

-- Class fallback: S1 enrolls only after paying; S2 pays while in class A and
-- transfers to class B later in the month.
insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('93300000-0000-0000-0000-000000000001', '2091-2092', 'Năm học orders source', date '2026-08-01', date '2027-05-31', 'active', false);

insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values
  ('93400000-0000-0000-0000-000000000001', '93300000-0000-0000-0000-000000000001', 'OS-6A', 'Orders source 6A', 6, 'A', 'active', 1),
  ('93400000-0000-0000-0000-000000000002', '93300000-0000-0000-0000-000000000001', 'OS-6B', 'Orders source 6B', 6, 'B', 'active', 1);

-- Enrollments are inserted active and ended by update, as the transition
-- trigger requires.
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to)
values
  ('93500000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', '93400000-0000-0000-0000-000000000002', 'online', 'active', date '2026-11-12', null),
  ('93500000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000002', '93400000-0000-0000-0000-000000000001', 'online', 'active', date '2026-10-01', null);

update public.student_enrollments
set status = 'transferred',
  effective_to = date '2026-11-20',
  ended_by = '91000000-0000-0000-0000-000000000001',
  end_reason = 'Chuyển lớp fixture'
where id = '93500000-0000-0000-0000-000000000002';

insert into public.student_enrollments (
  id,
  student_id,
  class_id,
  registered_mode,
  status,
  effective_from,
  transition_kind,
  supersedes_enrollment_id,
  start_reason
)
values (
  '93500000-0000-0000-0000-000000000003',
  '94000000-0000-0000-0000-000000000002',
  '93400000-0000-0000-0000-000000000002',
  'online',
  'active',
  date '2026-11-21',
  'transfer',
  '93500000-0000-0000-0000-000000000002',
  'Chuyển lớp fixture'
);

insert into public.sepay_webhooks (
  id,
  sepay_id,
  gateway,
  transaction_date,
  account_number,
  content,
  transfer_type,
  amount_in,
  amount_out,
  body_raw,
  processing_status
)
select
  ('95000000-0000-0000-0000-00000000000' || fixture.n)::uuid,
  910000000 + fixture.n,
  'TESTBANK',
  '2026-11-05 03:00:00+00',
  '0100123456',
  'ORDERS-SOURCE-' || fixture.n,
  'in',
  fixture.amount,
  0,
  '{}'::jsonb,
  'processed'
from (
  values (1, 1000000), (2, 500000), (3, 400000), (4, 600000), (5, 1000000), (6, 300000), (7, 700000)
) as fixture(n, amount);

insert into public.sepay_transactions (
  id,
  sepay_webhook_id,
  bank_transaction_id,
  bank_brand,
  account_number,
  account_purpose,
  amount_vnd,
  transfer_content,
  transaction_at,
  match_status
)
select
  ('96000000-0000-0000-0000-00000000000' || fixture.n)::uuid,
  ('95000000-0000-0000-0000-00000000000' || fixture.n)::uuid,
  (910000000 + fixture.n)::text,
  'TESTBANK',
  '0100123456',
  fixture.purpose,
  fixture.amount,
  'ORDERS-SOURCE-' || fixture.n,
  '2026-11-05 03:00:00+00',
  'split_allocated'
from (
  values
    (1, 1000000, 'renewal'),
    (2, 500000, 'renewal'),
    (3, 400000, 'renewal'),
    (4, 600000, 'renewal'),
    (5, 1000000, 'new_enrollment'),
    (6, 300000, 'renewal'),
    (7, 700000, 'renewal')
) as fixture(n, amount, purpose);

insert into public.finance_cashflow_records (
  id,
  record_type,
  category,
  amount_vnd,
  student_id,
  sepay_transaction_id,
  reference_code,
  note,
  created_by
)
select
  ('97000000-0000-0000-0000-00000000000' || fixture.n)::uuid,
  'receipt',
  'tuition_fee',
  fixture.amount,
  ('94000000-0000-0000-0000-00000000000' || fixture.n)::uuid,
  ('96000000-0000-0000-0000-00000000000' || fixture.n)::uuid,
  'ORDERS-SOURCE-' || fixture.n,
  'Orders source fixture receipt',
  '91000000-0000-0000-0000-000000000001'
from (
  values (1, 1000000), (2, 500000), (3, 400000), (4, 600000), (5, 1000000), (6, 300000), (7, 700000)
) as fixture(n, amount);

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);

create temp table orders_source_rows on commit drop as
select order_row.value ->> 'studentPublicCode' as student_code, order_row.value as order_json
from pg_catalog.jsonb_array_elements(
  public.get_finance_orders_dashboard('2026-11-01', null, null, null) -> 'orders'
) as order_row(value);

create temp table orders_source_dashboard on commit drop as
select public.get_finance_orders_dashboard('2026-11-01', null, null, null) as payload;

select is(
  (select pg_catalog.count(*) from orders_source_rows),
  7::bigint,
  'every November fixture receipt is an order'
);

-- Guards the core regression: no "assigned before the bank date" filter.
select is(
  (
    select pg_catalog.count(*)
    from orders_source_rows as order_row
    join public.student_acquisition_source_assignments as assignment
      on assignment.student_id = (order_row.order_json ->> 'studentId')::uuid
      and assignment.is_current
      and assignment.assigned_at > (order_row.order_json ->> 'transactionAt')::timestamptz
    where order_row.order_json ->> 'leadSourceCode' is not distinct from (
      select lead_source.code
      from public.crm_lead_sources as lead_source
      where lead_source.id = assignment.lead_source_id
    )
  ),
  5::bigint,
  'a source assigned after the bank date still applies to the earlier order'
);

-- S1: current assignment wins over the superseded one; no sale without CRM.
select ok(
  (select order_json from orders_source_rows where student_code = 'TV-2026-91001')
    @> '{"sourceCode":"sb","sourceLabel":"SB","leadSourceCode":"sandbox_partner","leadSourceName":"Đối tác Sandbox"}'::jsonb,
  'an assignment-only Sandbox student resolves to SB from the current acquisition source'
);

select ok(
  (select order_json from orders_source_rows where student_code = 'TV-2026-91001')
    @> '{"operatingCostStatus":"configured","mechanismCode":"renewal_sb_20_percent","operatingCostVnd":200000}'::jsonb,
  'the SB renewal mechanism applies 20% to an assignment-sourced order'
);

select is(
  (select order_json -> 'saleOwnerId' from orders_source_rows where student_code = 'TV-2026-91001'),
  'null'::jsonb,
  'sale stays empty when the student has no CRM accrual'
);

select is(
  (select order_json ->> 'classCode' from orders_source_rows where student_code = 'TV-2026-91001'),
  'OS-6B',
  'a student enrolled after paying shows the first class that starts after the bank date'
);

-- S2
select ok(
  (select order_json from orders_source_rows where student_code = 'TV-2026-91002')
    @> '{"sourceCode":"mma","sourceLabel":"MMA","leadSourceCode":"mma_zalo","mechanismCode":"renewal_mma_zero","operatingCostStatus":"configured","operatingCostVnd":0}'::jsonb,
  'an assignment-only MMA renewal resolves to MMA at 0 VND'
);

select is(
  (select order_json ->> 'classCode' from orders_source_rows where student_code = 'TV-2026-91002'),
  'OS-6A',
  'the enrollment in force on the bank date wins over a later one'
);

-- S3
select ok(
  (select order_json from orders_source_rows where student_code = 'TV-2026-91003')
    @> '{"sourceCode":null,"sourceLabel":null,"leadSourceCode":"direct_walkin","leadSourceName":"Đến trực tiếp trung tâm","operatingCostStatus":"unconfigured","operatingCostVnd":null}'::jsonb,
  'an "other" group source is named but stays outside MMA/SB and unconfigured'
);

-- S4
select is(
  (
    select accrual.lead_source_group
    from public.sales_commission_accruals as accrual
    where accrual.source_cashflow_record_id = '97000000-0000-0000-0000-000000000004'
  ),
  'sandbox',
  'the converted CRM case produced a Sandbox accrual for S4'
);

select ok(
  (select order_json from orders_source_rows where student_code = 'TV-2026-91004')
    @> '{"sourceCode":"mma","leadSourceCode":"mma_zalo","mechanismCode":"renewal_mma_zero","operatingCostVnd":0}'::jsonb,
  'a current acquisition source correction wins over the accrual snapshot'
);

select is(
  (select order_json ->> 'saleOwnerId' from orders_source_rows where student_code = 'TV-2026-91004'),
  '91000000-0000-0000-0000-000000000003',
  'sale still comes from the CRM accrual'
);

-- S5
select is(
  (select pg_catalog.count(*) from public.sales_commission_accruals where student_id = '94000000-0000-0000-0000-000000000005'),
  0::bigint,
  'a non-converted CRM case has no accrual'
);

select ok(
  (select order_json from orders_source_rows where student_code = 'TV-2026-91005')
    @> '{"sourceCode":"sb","leadSourceCode":"sandbox_partner","mechanismCode":"new_enrollment_sb_fixed_plus_25_percent","operatingCostStatus":"configured","operatingCostVnd":950000,"saleOwnerId":null}'::jsonb,
  'without assignment or accrual the CRM case source is used'
);

-- S6
select ok(
  (select order_json from orders_source_rows where student_code = 'TV-2026-91006')
    @> '{"sourceCode":null,"leadSourceCode":null,"leadSourceName":null,"operatingCostStatus":"unconfigured","operatingCostVnd":null}'::jsonb,
  'a student with no source at all stays unresolved and unconfigured'
);

-- S7
select ok(
  (select order_json from orders_source_rows where student_code = 'TV-2026-91007')
    @> '{"sourceCode":"sb_f1","sourceLabel":"SB F1","operatingCostStatus":"unconfigured","operatingCostVnd":null}'::jsonb,
  'an SB F1 acquisition source stays explicitly unconfigured'
);

-- Summary, filters and SB settlement follow the resolved source.
select ok(
  (select payload -> 'summary' from orders_source_dashboard)
    @> '{"orderCount":7,"tuitionAmountVnd":4500000,"operatingCostVnd":1150000,"unconfiguredCount":3}'::jsonb,
  'summary totals use the resolved operating cost'
);

select is(
  (public.get_finance_orders_dashboard('2026-11-01', null, 'sb', null) -> 'summary' ->> 'orderCount')::integer,
  2,
  'the SB filter includes assignment- and CRM-case-sourced orders'
);

select is(
  (public.get_finance_orders_dashboard('2026-11-01', null, 'mma', null) -> 'summary' ->> 'orderCount')::integer,
  2,
  'the MMA filter includes assignment-sourced orders'
);

select is(
  (public.get_finance_orders_dashboard('2026-11-01', null, 'sb_f1', null) -> 'summary' ->> 'orderCount')::integer,
  1,
  'the SB F1 filter includes the F1 acquisition source'
);

select is(
  (select pg_catalog.jsonb_array_length(payload -> 'settlement') from orders_source_dashboard),
  1,
  'SB settlement has one period row'
);

select ok(
  (select payload -> 'settlement' -> 0 from orders_source_dashboard)
    @> '{"period":1,"newEnrollmentCount":1,"renewalCount":1,"tuitionAmountVnd":2000000,"operatingCostVnd":1150000,"unconfiguredCount":0}'::jsonb,
  'SB settlement counts plain SB orders only (not SB F1, MMA or unresolved)'
);

select is(
  (public.get_finance_orders_dashboard('2026-11-01', 'renewal', 'sb', null) -> 'summary' ->> 'operatingCostVnd')::bigint,
  200000::bigint,
  'order type and source filters combine on the resolved source'
);

-- A finance.view-only viewer calling through PostgREST's role sees the same
-- resolved source (the RPC is SECURITY DEFINER; the viewer has no students.view).
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);

select ok(
  not public.has_permission('students.view'),
  'the viewer fixture has no students.view'
);

set local role authenticated;

create temp table orders_source_viewer on commit drop as
select public.get_finance_orders_dashboard('2026-11-01', null, 'sb', null) as payload;

reset role;

select is(
  (select (payload -> 'summary' ->> 'orderCount')::integer from orders_source_viewer),
  2,
  'a finance.view-only caller gets assignment-sourced SB orders'
);

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);

-- Contract guard: the replacement keeps the single signature, definer mode and grants.
select is(
  (
    select pg_catalog.count(*)
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'get_finance_orders_dashboard'
      and procedure_row.prosecdef
      and procedure_row.proconfig @> array['search_path=""']
  ),
  1::bigint,
  'get_finance_orders_dashboard stays a single SECURITY DEFINER function with an empty search_path'
);

select ok(
  has_function_privilege('authenticated', 'public.get_finance_orders_dashboard(date,text,text,smallint)', 'execute')
  and not has_function_privilege('anon', 'public.get_finance_orders_dashboard(date,text,text,smallint)', 'execute'),
  'authenticated can execute the orders RPC and anon cannot'
);

select throws_ok(
  $$ select public.get_finance_orders_dashboard('2026-11-01', null, 'other', null) $$,
  '22023',
  'INVALID_FINANCE_ORDER_SOURCE',
  'the source filter still only accepts mma, sb and sb_f1'
);

select * from finish();

rollback;
