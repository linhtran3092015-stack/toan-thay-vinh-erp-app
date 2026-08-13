begin;

select plan(31);

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
    '81000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'finance-orders-manager@example.test',
    '{"provider":"email"}',
    '{"full_name":"Finance Orders Manager"}',
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'finance-orders-viewer@example.test',
    '{"provider":"email"}',
    '{"full_name":"Finance Orders Viewer"}',
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'finance-orders-unprivileged@example.test',
    '{"provider":"email"}',
    '{"full_name":"Finance Orders Unprivileged"}',
    now(),
    now()
  );

insert into public.roles (id, code, name)
values
  (
    '82000000-0000-0000-0000-000000000001',
    'finance_orders_manager_test',
    'Finance orders manager test'
  ),
  (
    '82000000-0000-0000-0000-000000000002',
    'finance_orders_viewer_test',
    'Finance orders viewer test'
  );

insert into public.role_permissions (role_id, permission_id)
select
  '82000000-0000-0000-0000-000000000001',
  permission.id
from public.permissions as permission
where permission.code in ('finance.view', 'payments.manage');

insert into public.role_permissions (role_id, permission_id)
select
  '82000000-0000-0000-0000-000000000002',
  permission.id
from public.permissions as permission
where permission.code = 'finance.view';

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values
  (
    '81000000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000001',
    'Finance orders manager fixture'
  ),
  (
    '81000000-0000-0000-0000-000000000002',
    '82000000-0000-0000-0000-000000000002',
    'Finance orders viewer fixture'
  );

insert into public.guardians (id, full_name, phone)
values ('83000000-0000-0000-0000-000000000001', 'Finance Orders Guardian', '0900008101');

insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status)
values
  (
    '84000000-0000-0000-0000-000000000001',
    'TV-2026-81001',
    'Finance Orders Student One',
    2014,
    6,
    'active'
  ),
  (
    '84000000-0000-0000-0000-000000000002',
    'TV-2026-81002',
    'Finance Orders Student Two',
    2015,
    5,
    'active'
  ),
  (
    '84000000-0000-0000-0000-000000000003',
    'TV-2026-81003',
    'Finance Orders Student Three',
    2013,
    7,
    'active'
  );

insert into public.student_guardians (student_id, guardian_id, relationship, is_primary, linked_at)
values
  (
    '84000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    'parent',
    true,
    '2026-01-01 00:00:00+00'
  ),
  (
    '84000000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000001',
    'parent',
    true,
    '2026-01-01 00:00:00+00'
  ),
  (
    '84000000-0000-0000-0000-000000000003',
    '83000000-0000-0000-0000-000000000001',
    'parent',
    true,
    '2026-01-01 00:00:00+00'
  );

insert into public.crm_lead_sources (id, code, name, group_code)
values
  ('83100000-0000-0000-0000-000000000001', 'fixture_sb', 'Fixture SB', 'sandbox'),
  ('83100000-0000-0000-0000-000000000002', 'fixture_sb_f1', 'Fixture SB F1', 'sandbox'),
  ('83100000-0000-0000-0000-000000000003', 'fixture_mma', 'Fixture MMA', 'mma');

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
values
  (
    '83200000-0000-0000-0000-000000000001',
    'CRM-FINANCE-ORDERS-SB',
    'Finance Orders Student One',
    2014,
    6,
    '83000000-0000-0000-0000-000000000001',
    '0900008101',
    'Finance Orders Guardian',
    '83100000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    'converted',
    '84000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001'
  ),
  (
    '83200000-0000-0000-0000-000000000002',
    'CRM-FINANCE-ORDERS-SB-F1',
    'Finance Orders Student Two',
    2015,
    5,
    '83000000-0000-0000-0000-000000000001',
    '0900008101',
    'Finance Orders Guardian',
    '83100000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000001',
    'converted',
    '84000000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000001'
  ),
  (
    '83200000-0000-0000-0000-000000000003',
    'CRM-FINANCE-ORDERS-MMA',
    'Finance Orders Student Three',
    2013,
    7,
    '83000000-0000-0000-0000-000000000001',
    '0900008101',
    'Finance Orders Guardian',
    '83100000-0000-0000-0000-000000000003',
    '81000000-0000-0000-0000-000000000001',
    'converted',
    '84000000-0000-0000-0000-000000000003',
    '81000000-0000-0000-0000-000000000001'
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
values (
  '85000000-0000-0000-0000-000000000001',
  810000001,
  'TESTBANK',
  '2026-08-05 12:00:00+00',
  '0100123456',
  'FINANCE-ORDERS-SPLIT',
  'in',
  1000000,
  0,
  '{}'::jsonb,
  'processed'
);

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
values (
  '86000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001',
  '810000001',
  'TESTBANK',
  '0100123456',
  'new_enrollment',
  1000000,
  'FINANCE-ORDERS-SPLIT',
  '2026-08-05 12:00:00+00',
  'unmatched'
);

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);

select has_function(
  'public',
  'process_sepay_webhook_transaction',
  array['bigint', 'text', 'timestamp with time zone', 'text', 'text', 'text', 'text', 'bigint', 'bigint', 'text', 'text', 'jsonb'],
  'the exact twelve-argument SePay webhook RPC signature resolves'
);

select is(
  (
    select count(*)
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'process_sepay_webhook_transaction'
  ),
  1::bigint,
  'no stale SePay webhook overload remains for PostgREST to select'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.process_sepay_webhook_transaction(bigint,text,timestamptz,text,text,text,text,bigint,bigint,text,text,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.process_sepay_webhook_transaction(bigint,text,timestamptz,text,text,text,text,bigint,bigint,text,text,jsonb)',
    'execute'
  ),
  'only service_role can execute the SePay webhook RPC'
);

select lives_ok(
  $$
    select public.allocate_payment_to_students(
      '86000000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000001',
      '[
        {
          "student_id": "84000000-0000-0000-0000-000000000001",
          "allocated_amount_vnd": 600000,
          "allocated_sessions": 6,
          "bonus_sessions": 0,
          "unit_price_vnd": 100000
        },
        {
          "student_id": "84000000-0000-0000-0000-000000000002",
          "allocated_amount_vnd": 400000,
          "allocated_sessions": 4,
          "bonus_sessions": 0,
          "unit_price_vnd": 100000
        }
      ]'::jsonb
    )
  $$,
  'a permitted finance manager can allocate one inbound SePay transaction to two students'
);

select is(
  (
    select count(*)
    from public.finance_cashflow_records
    where sepay_transaction_id = '86000000-0000-0000-0000-000000000001'
      and record_type = 'receipt'
      and category = 'tuition_fee'
  ),
  2::bigint,
  'one split transaction produces two student-grain tuition cashflow orders'
);

select is(
  (
    select sum(amount_vnd)::bigint
    from public.finance_cashflow_records
    where sepay_transaction_id = '86000000-0000-0000-0000-000000000001'
      and record_type = 'receipt'
      and category = 'tuition_fee'
  ),
  1000000::bigint,
  'student-grain split orders sum to the transaction exactly without double counting'
);

select is(
  (
    select count(distinct student_id)
    from public.finance_cashflow_records
    where sepay_transaction_id = '86000000-0000-0000-0000-000000000001'
  ),
  2::bigint,
  'the two split orders retain two distinct students'
);

select is(
  (
    select count(*)
    from public.student_credit_lots
    where sepay_transaction_id = '86000000-0000-0000-0000-000000000001'
      and topup_type = 'new'
  ),
  2::bigint,
  'new-enrollment account purpose is carried into both split credit lots'
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
values (
  '85000000-0000-0000-0000-000000000003',
  810000004,
  'TESTBANK',
  '2026-08-06 12:00:00+00',
  '0123987654',
  'FINANCE-ORDERS-MMA',
  'in',
  500000,
  0,
  '{}'::jsonb,
  'processed'
);

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
values (
  '86000000-0000-0000-0000-000000000003',
  '85000000-0000-0000-0000-000000000003',
  '810000004',
  'TESTBANK',
  '0123987654',
  'renewal',
  500000,
  'FINANCE-ORDERS-MMA',
  '2026-08-06 12:00:00+00',
  'auto_matched'
);

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
values (
  '87000000-0000-0000-0000-000000000003',
  'receipt',
  'tuition_fee',
  500000,
  '84000000-0000-0000-0000-000000000003',
  '86000000-0000-0000-0000-000000000003',
  'MMA-810000004',
  'Fixture MMA tuition receipt',
  '81000000-0000-0000-0000-000000000001'
);

select is(
  (
    select (public.get_finance_orders_dashboard('2026-08-01', null, null, null) -> 'summary' ->> 'orderCount')::integer
  ),
  3,
  'the dashboard adds one MMA order while retaining the two split student-grain orders'
);

select is(
  (
    select jsonb_array_length(public.get_finance_orders_dashboard('2026-08-01', null, null, null) -> 'orders')
  ),
  3,
  'the dashboard detail contains the same three orders as its summary'
);

select is(
  (
    select public.get_finance_orders_dashboard('2026-08-01', null, null, null)
      -> 'orders' -> 0 ->> 'guardianPhone'
  ),
  '0900008101',
  'the dashboard exposes the primary guardian phone for the student-grain order'
);

select is(
  (
    select min(order_row.value ->> 'transferContent')
    from jsonb_array_elements(
      public.get_finance_orders_dashboard('2026-08-01', null, null, null) -> 'orders'
    ) as order_row(value)
    where order_row.value ->> 'bankTransactionId' = '810000001'
  ),
  'FINANCE-ORDERS-SPLIT',
  'the dashboard exposes the canonical SePay transfer content'
);

select ok(
  (
    select (dashboard.value -> 'summary' ->> 'orderCount')::integer = 1
      and dashboard.value -> 'orders' -> 0 ->> 'sourceCode' = 'sb'
    from (
      select public.get_finance_orders_dashboard('2026-08-01', null, 'sb', null) as value
    ) as dashboard
  ),
  'the SB source filter returns only SB orders'
);

select ok(
  (
    select (dashboard.value -> 'summary' ->> 'orderCount')::integer = 1
      and dashboard.value -> 'orders' -> 0 ->> 'sourceCode' = 'sb_f1'
    from (
      select public.get_finance_orders_dashboard('2026-08-01', null, 'sb_f1', null) as value
    ) as dashboard
  ),
  'the SB F1 source filter returns only SB F1 orders'
);

select ok(
  (
    select (dashboard.value -> 'summary' ->> 'orderCount')::integer = 1
      and dashboard.value -> 'orders' -> 0 ->> 'sourceCode' = 'mma'
    from (
      select public.get_finance_orders_dashboard('2026-08-01', null, 'mma', null) as value
    ) as dashboard
  ),
  'the MMA source filter returns only MMA orders'
);

select is(
  (
    select sum((public.get_finance_orders_dashboard('2026-08-01', null, source_code, null) -> 'summary' ->> 'orderCount')::integer)
    from unnest(array['mma', 'sb', 'sb_f1']) as source_filter(source_code)
  ),
  3::bigint,
  'MMA, SB, and SB F1 remain three distinct source-filter values'
);

select is(
  (
    select public.get_finance_orders_dashboard('2026-08-01', null, 'sb_f1', null)
      ->> 'settlementEligible'
  ),
  'false',
  'SB F1 is not included in the SB settlement table'
);

select is(
  (
    select coalesce((public.get_finance_orders_dashboard('2026-08-01', null, null, null)
      -> 'settlement' -> 0 ->> 'tuitionAmountVnd')::bigint, 0)
  ),
  600000::bigint,
  'the SB settlement includes SB but excludes the 400000 VND SB F1 allocation'
);

select is(
  (
    with dashboard as (
      select public.get_finance_orders_dashboard('2026-08-01', 'new_enrollment', null, 1::smallint) as value
    )
    select coalesce(sum((item.value ->> 'tuitionAmountVnd')::bigint), 0)::bigint
    from dashboard
    cross join lateral jsonb_array_elements(dashboard.value -> 'orders') as item(value)
  ),
  (
    select (public.get_finance_orders_dashboard('2026-08-01', 'new_enrollment', null, 1::smallint) -> 'summary' ->> 'tuitionAmountVnd')::bigint
  ),
  'filtered dashboard totals and filtered detailed orders use the same data set'
);

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ select public.get_finance_orders_dashboard('2026-08-01', null, null, null) $$,
  'finance.view is sufficient to read the finance orders dashboard'
);

select throws_ok(
  $$ select public.set_finance_order_review('87000000-0000-0000-0000-000000000001', true) $$,
  '42501',
  'PAYMENTS_MANAGE_PERMISSION_DENIED',
  'a finance.view-only user cannot mutate order review state'
);

select ok(
  not has_table_privilege('authenticated', 'public.finance_order_reviews', 'select')
  and (select relrowsecurity from pg_class where oid = 'public.finance_order_reviews'::regclass),
  'direct finance-order review access is denied by revoked privileges and RLS'
);

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$
    select public.set_finance_order_review(
      (
        select id
        from public.finance_cashflow_records
        where sepay_transaction_id = '86000000-0000-0000-0000-000000000001'
          and student_id = '84000000-0000-0000-0000-000000000001'
      ),
      true
    )
  $$,
  'payments.manage can review a valid student-grain finance order'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'finance_order_checked'
      and entity_type = 'finance_order_review'
  ),
  1::bigint,
  'a review change creates exactly one audit entry'
);

select lives_ok(
  $$
    select public.set_finance_order_review(
      (
        select id
        from public.finance_cashflow_records
        where sepay_transaction_id = '86000000-0000-0000-0000-000000000001'
          and student_id = '84000000-0000-0000-0000-000000000001'
      ),
      true
    )
  $$,
  'a repeated review request succeeds without another state transition'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'finance_order_checked'
      and entity_type = 'finance_order_review'
  ),
  1::bigint,
  'the idempotent repeat creates no duplicate review audit entry'
);

select ok(
  position(
    'pg_advisory_xact_lock'
    in pg_get_functiondef('public.set_finance_order_review(uuid,boolean)'::regprocedure)
  ) > 0,
  'the review mutation serializes concurrent state transitions with an advisory transaction lock'
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
values (
  '85000000-0000-0000-0000-000000000002',
  810000002,
  'TESTBANK',
  '2026-08-05 12:00:00+00',
  '0999999999',
  'FINANCE-ORDERS-UNKNOWN',
  'in',
  1000000,
  0,
  '{}'::jsonb,
  'ignored'
);

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
values (
  '86000000-0000-0000-0000-000000000002',
  '85000000-0000-0000-0000-000000000002',
  '810000002',
  'TESTBANK',
  '0999999999',
  'unknown',
  1000000,
  'FINANCE-ORDERS-UNKNOWN',
  '2026-08-05 12:00:00+00',
  'unmatched'
);

select throws_ok(
  $$
    select public.allocate_payment_to_students(
      '86000000-0000-0000-0000-000000000002',
      '83000000-0000-0000-0000-000000000001',
      '[
        {
          "student_id": "84000000-0000-0000-0000-000000000001",
          "allocated_amount_vnd": 1000000,
          "allocated_sessions": 10,
          "bonus_sessions": 0,
          "unit_price_vnd": 100000
        }
      ]'::jsonb
    )
  $$,
  'P0001',
  'SEPAY_ACCOUNT_PURPOSE_UNRESOLVED: Tai khoan nhan cua giao dich chua duoc cau hinh.',
  'an unknown receiving account cannot be manually allocated'
);

select is(
  (
    select count(*)
    from public.finance_cashflow_records
    where sepay_transaction_id = '86000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'unknown-account transactions create no allocation cashflow or finance order'
);

insert into public.student_payment_requests (
  id,
  public_code,
  student_id,
  guardian_id,
  expected_amount_vnd,
  purchased_sessions,
  bonus_sessions,
  calculated_unit_price_vnd,
  topup_type,
  transfer_code,
  status
)
values (
  '88000000-0000-0000-0000-000000000001',
  'PR-RENEWAL-81001',
  '84000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',
  1000000,
  10,
  0,
  100000,
  'renewal',
  'RENEWAL-81001',
  'pending'
);

select public.process_sepay_webhook_transaction(
  810000003,
  'TESTBANK',
  '2026-07-05 12:00:00+00',
  '0123987654',
  null,
  'RENEWAL-81001',
  'in',
  1000000,
  0,
  'renewal',
  null,
  '{}'::jsonb
);

select is(
  (
    select account_purpose
    from public.sepay_transactions
    where bank_transaction_id = '810000003'
  ),
  'renewal',
  'a renewal receiving account purpose is persisted by the webhook RPC'
);

select is(
  (
    select status
    from public.student_payment_requests
    where id = '88000000-0000-0000-0000-000000000001'
  ),
  'paid',
  'a matching renewal payment request is credited through the renewal purpose path'
);

select * from finish();

rollback;
