begin;

select plan(44);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a1000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'sepay-history-owner@example.test',
  '{"provider":"email"}',
  '{"full_name":"SePay History Owner"}',
  now(),
  now()
);

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select 'a1000000-0000-0000-0000-000000000001', role.id, 'SePay history workflow test'
from public.roles as role
where role.code = 'owner';

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a1000000-0000-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'sepay-allocator@example.test',
  '{"provider":"email"}',
  '{"full_name":"SePay Allocator"}',
  now(),
  now()
);

insert into public.roles (id, code, name, description)
values (
  'a1100000-0000-0000-0000-000000000001',
  'sepay_test_allocator',
  'SePay test allocator',
  'Test-only role with the granular allocation permission'
);

insert into public.role_permissions (role_id, permission_id)
select 'a1100000-0000-0000-0000-000000000001', permission.id
from public.permissions as permission
where permission.code = 'sepay.allocate';

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values (
  'a1000000-0000-0000-0000-000000000002',
  'a1100000-0000-0000-0000-000000000001',
  'Granular candidate RPC test'
);

select ok(
  exists (
    select 1
    from public.role_permissions as role_permission
    join public.roles as role on role.id = role_permission.role_id
    join public.permissions as permission on permission.id = role_permission.permission_id
    where role.code = 'owner'
      and permission.code = 'sepay.sync_history.manage'
  ),
  'owner receives the dedicated history-sync permission'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.ingest_sepay_api_v2_transactions_batch(jsonb)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.ingest_sepay_api_v2_transactions_batch(jsonb)',
    'execute'
  ),
  'only service role can call the batch ingestion boundary'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.ingest_sepay_api_v2_sync_page(uuid,integer,integer,boolean,jsonb)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.ingest_sepay_api_v2_sync_page(uuid,integer,integer,boolean,jsonb)',
    'execute'
  ),
  'only service role can atomically ingest and checkpoint a history page'
);

select has_function(
  'public',
  'search_sepay_reconciliation_candidates',
  array['uuid', 'text', 'integer'],
  'the minimal reconciliation-candidate search RPC exists'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.search_sepay_reconciliation_candidates(uuid,text,integer)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.search_sepay_reconciliation_candidates(uuid,text,integer)',
    'execute'
  ),
  'candidate search is available only to authenticated callers and checks permission internally'
);

insert into public.sepay_receiving_account_versions (
  id, purpose, bank_code, account_number, account_display_name, effective_from
)
values
  (
    'a2000000-0000-0000-0000-000000000001', 'new_enrollment', 'TESTBANK',
    '1000000001', 'New account', date '2026-01-01'
  ),
  (
    'a2000000-0000-0000-0000-000000000002', 'renewal', 'TESTBANK',
    '1000000002', 'Renewal account', date '2026-01-01'
  );

select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.set_sepay_receiving_account_api_identity(
    'a2000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001',
    'Gắn tài khoản tuyển mới'
  )$$,
  'owner can attach an API v2 identity to the new-enrollment account'
);

select lives_ok(
  $$select public.set_sepay_receiving_account_api_identity(
    'a2000000-0000-0000-0000-000000000002',
    'a3000000-0000-0000-0000-000000000002',
    'Gắn tài khoản tái phí'
  )$$,
  'owner can attach a different API v2 identity to the renewal account'
);

select is(
  (
    select pg_catalog.count(distinct sepay_bank_account_id)
    from public.sepay_receiving_account_versions
    where id in (
      'a2000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000002'
    )
  ),
  2::bigint,
  'new-enrollment and renewal keep separate SePay API account identities'
);

insert into public.sepay_sync_runs (
  id, sync_session_id, requested_by, account_version_id, date_from, date_to
)
values (
  'a8000000-0000-0000-0000-000000000001',
  'a8100000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  date '2026-08-01',
  date '2026-08-31'
);

-- A malformed upstream page must not capture another account or live transfer.
select throws_ok(
  pg_catalog.format(
    'select public.ingest_sepay_api_v2_sync_page(''a8000000-0000-0000-0000-000000000001'',1,1,false,%L::jsonb)',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'bank_account_id', invalid.bank_id,
      'account_number', invalid.account_number,
      'transaction_date', invalid.transaction_date
    ))::text
  ),
  'P0001', 'SEPAY_SYNC_SCOPE_MISMATCH', invalid.description
)
from (values
  ('a3000000-0000-0000-0000-000000000002', '1000000002', '2026-08-14T02:00:00Z', 'rejects another configured account'),
  ('a3000000-0000-0000-0000-000000000001', '1000000002', '2026-08-14T02:00:00Z', 'rejects a mismatched account number'),
  ('a3000000-0000-0000-0000-000000000001', '1000000001', '2026-07-31T16:59:59Z', 'rejects before the Vietnam date window'),
  ('a3000000-0000-0000-0000-000000000001', '1000000001', '2026-08-31T17:00:00Z', 'rejects after the Vietnam date window'),
  ('a3000000-0000-0000-0000-000000000001', '1000000001', pg_catalog.now()::text, 'rejects current-day live transfers'),
  ('a3000000-0000-0000-0000-000000000001', '1000000001', null, 'rejects missing transaction dates')
) as invalid(bank_id, account_number, transaction_date, description);

select throws_ok(
  $$select public.ingest_sepay_api_v2_sync_page('a8000000-0000-0000-0000-000000000001',null,1,false,'[]'::jsonb)$$,
  'P0001', 'SEPAY_SYNC_PAGE_INVALID', 'rejects null page numbers'
);
select throws_ok(
  $$select public.ingest_sepay_api_v2_sync_page('a8000000-0000-0000-0000-000000000001',1,null,false,'[]'::jsonb)$$,
  'P0001', 'SEPAY_SYNC_PAGE_INVALID', 'rejects null totals'
);
select is(
  (select pages_processed from public.sepay_sync_runs where id = 'a8000000-0000-0000-0000-000000000001'),
  0, 'rejected pages never advance the checkpoint'
);

select throws_ok(
  $$select public.ingest_sepay_api_v2_sync_page('a8000000-0000-0000-0000-000000000001',1,5,false,'[]'::jsonb)$$,
  'P0001', 'SEPAY_SYNC_TOTAL_MISMATCH', 'an incomplete empty final page is not reported as success'
);

select is(
  public.ingest_sepay_api_v2_sync_page(
    'a8000000-0000-0000-0000-000000000001',
    1,
    1,
    false,
    '[{
      "id":"a7000000-0000-0000-0000-000000000003",
      "bank_account_id":"a3000000-0000-0000-0000-000000000001",
      "bank_brand_name":"TESTBANK",
      "transaction_date":"2026-08-14T02:00:00.000Z",
      "account_number":"1000000001",
      "code":"SYNC PAGE TEST",
      "transaction_content":"SYNC PAGE TEST",
      "transfer_type":"in",
      "amount_in":500000,
      "amount_out":0,
      "reference_number":"SYNC-PAGE-TEST"
    }]'::jsonb
  ) ->> 'completed',
  'true',
  'one fetched page is ingested and completed atomically'
);

select is(
  public.ingest_sepay_api_v2_sync_page(
    'a8000000-0000-0000-0000-000000000001',
    1,
    1,
    false,
    '[]'::jsonb
  ) ->> 'already_processed',
  'true',
  'repeating a completed page is an idempotent checkpoint lookup'
);

select is(
  (
    select pg_catalog.count(*)
    from public.sepay_transactions
    where sepay_v2_id = 'a7000000-0000-0000-0000-000000000003'
  ),
  1::bigint,
  'a repeated page creates only one canonical transaction'
);

select is(
  (
    select status || ':' || pages_processed::text || ':' || total_seen::text
    from public.sepay_sync_runs
    where id = 'a8000000-0000-0000-0000-000000000001'
  ),
  'completed:1:1',
  'the sync run keeps its durable page checkpoint and cumulative count'
);

select throws_ok(
  $$insert into public.sepay_receiving_account_versions (
    purpose, bank_code, account_number, account_display_name, effective_from, sepay_bank_account_id
  ) values (
    'new_enrollment', 'TESTBANK', '1000000003', 'Duplicate API account', date '2026-06-01',
    'a3000000-0000-0000-0000-000000000001'
  )$$,
  '23P01',
  null,
  'one API account identity cannot point to overlapping receiving-account versions'
);

insert into public.guardians (id, full_name, phone)
values ('a4000000-0000-0000-0000-000000000001', 'History Guardian', '0900010001');

insert into public.students (
  id, public_code, full_name, birth_year, current_grade, lifecycle_status
)
values (
  'a5000000-0000-0000-0000-000000000001', 'TV-2026-95001',
  'History Student', 2014, 6, 'active'
);

insert into public.student_guardians (student_id, guardian_id, relationship, is_primary)
values (
  'a5000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000001',
  'parent',
  true
);

insert into public.student_payment_requests (
  id, public_code, student_id, guardian_id, expected_amount_vnd,
  purchased_sessions, bonus_sessions, calculated_unit_price_vnd,
  topup_type, transfer_code, status
)
values (
  'a6000000-0000-0000-0000-000000000001', 'PAY-HISTORY-NEW',
  'a5000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000001',
  1000000, 10, 1, 100000, 'new', 'TTV HISTORY NEW', 'pending'
);

select is(
  public.ingest_sepay_api_v2_transactions_batch(
    '[
      {
        "id":"a7000000-0000-0000-0000-000000000001",
        "bank_account_id":"a3000000-0000-0000-0000-000000000001",
        "bank_brand_name":"TESTBANK",
        "transaction_date":"2026-08-15T02:00:00.000Z",
        "account_number":"1000000001",
        "code":"TTV HISTORY NEW",
        "transaction_content":"TTV HISTORY NEW",
        "transfer_type":"in",
        "amount_in":1000000,
        "amount_out":0,
        "reference_number":"HISTORY-NEW"
      },
      {
        "id":"a7000000-0000-0000-0000-000000000002",
        "bank_account_id":"a3000000-0000-0000-0000-000000000002",
        "bank_brand_name":"TESTBANK",
        "transaction_date":"2026-08-16T02:00:00.000Z",
        "account_number":"1000000002",
        "code":"",
        "transaction_content":"OLD RENEWAL",
        "transfer_type":"in",
        "amount_in":750000,
        "amount_out":0,
        "reference_number":"HISTORY-RENEWAL"
      }
    ]'::jsonb
  ) ->> 'seen',
  '2',
  'one batch ingests both configured account purposes'
);

select is(
  (
    select pg_catalog.count(*)
    from public.sepay_transactions
    where sepay_v2_id in (
      'a7000000-0000-0000-0000-000000000001',
      'a7000000-0000-0000-0000-000000000002'
    )
  ),
  2::bigint,
  'batch ingestion creates two canonical transaction records'
);

select is(
  (
    select pg_catalog.count(*)
    from public.search_sepay_reconciliation_candidates(
      (select id from public.sepay_transactions where sepay_v2_id = 'a7000000-0000-0000-0000-000000000001'),
      'PAY-HISTORY',
      50
    )
  ),
  1::bigint,
  'owner candidate search returns the matching pending request'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000002', true);

select is(
  (
    select pg_catalog.count(*)
    from public.search_sepay_reconciliation_candidates(
      (select id from public.sepay_transactions where sepay_v2_id = 'a7000000-0000-0000-0000-000000000001'),
      'History Student',
      50
    )
  ),
  1::bigint,
  'a role with only sepay.allocate can search the minimal candidate projection'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);

select is(
  (select account_purpose from public.sepay_transactions where sepay_v2_id = 'a7000000-0000-0000-0000-000000000001'),
  'new_enrollment',
  'the first API account maps to new enrollment'
);

select is(
  (select account_purpose from public.sepay_transactions where sepay_v2_id = 'a7000000-0000-0000-0000-000000000002'),
  'renewal',
  'the second API account maps to renewal'
);

select is(
  (select pg_catalog.count(*) from public.finance_cashflow_records where sepay_transaction_id in (
    select id from public.sepay_transactions where sepay_v2_id::text like 'a7000000-%'
  )),
  0::bigint,
  'history ingestion creates no cashflow before reconciliation'
);

select is(
  public.resolve_sepay_historical_transaction(
    (select id from public.sepay_transactions where sepay_v2_id = 'a7000000-0000-0000-0000-000000000002'),
    'already_accounted',
    'Đã nhập sổ trước khi kết nối SePay'
  ) ->> 'match_status',
  'historical_accounted',
  'owner can mark a renewal transaction as previously accounted without effects'
);

select is(
  (select pg_catalog.count(*) from public.finance_cashflow_records where sepay_transaction_id = (
    select id from public.sepay_transactions where sepay_v2_id = 'a7000000-0000-0000-0000-000000000002'
  )),
  0::bigint,
  'marking previously accounted creates no cashflow'
);

insert into public.sepay_transactions (
  id, sepay_v2_id, bank_transaction_id, bank_brand, account_number,
  account_purpose, amount_vnd, transfer_content, transaction_at,
  transfer_type, ingestion_source, source_payloads, match_status
)
values (
  'a7100000-0000-0000-0000-000000000001',
  'a7200000-0000-0000-0000-000000000001',
  'a7200000-0000-0000-0000-000000000001',
  'TESTBANK',
  '1000000001',
  'new_enrollment',
  1000000,
  'AMBIGUOUS HISTORY RECORD',
  '2026-08-14T02:00:00.000Z',
  'in',
  'api_v2',
  '{"api_v2":{"recorded":true}}'::jsonb,
  'identity_conflict'
);

select is(
  public.resolve_sepay_historical_transaction(
    'a7100000-0000-0000-0000-000000000001',
    'ignored',
    'Bản ghi API trùng nhận diện với giao dịch đã có'
  ) ->> 'match_status',
  'ignored',
  'owner can close an identity conflict without creating financial effects'
);

select is(
  public.match_sepay_historical_transaction_to_payment_request(
    (select id from public.sepay_transactions where sepay_v2_id = 'a7000000-0000-0000-0000-000000000001'),
    'a6000000-0000-0000-0000-000000000001',
    'Đối chiếu sao kê và mã thanh toán'
  ) ->> 'match_status',
  'manual_matched',
  'owner explicitly matches a historical new-enrollment transfer'
);

select is(
  (select status from public.student_payment_requests where id = 'a6000000-0000-0000-0000-000000000001'),
  'paid',
  'explicit matching marks the selected payment request paid'
);

select is(
  (select pg_catalog.count(*) from public.student_credit_lots where payment_request_id = 'a6000000-0000-0000-0000-000000000001'),
  1::bigint,
  'explicit matching creates exactly one credit lot'
);

select is(
  (select pg_catalog.count(*) from public.finance_cashflow_records where reference_code = 'PAY-HISTORY-NEW'),
  1::bigint,
  'explicit matching creates exactly one tuition cashflow record'
);

select is(
  (
    select effective_on
    from public.student_session_ledger_entries
    where event_key like 'sepay-manual-payment-credit:%'
  ),
  date '2026-08-15',
  'historical credit uses the Vietnam bank transaction date'
);

select throws_ok(
  $$select public.match_sepay_historical_transaction_to_payment_request(
    (select id from public.sepay_transactions where sepay_v2_id = 'a7000000-0000-0000-0000-000000000001'),
    'a6000000-0000-0000-0000-000000000001',
    'Thử ghi nhận lần hai'
  )$$,
  'P0001',
  'TRANSACTION_ALREADY_RECONCILED',
  'a reconciled transaction cannot be posted a second time'
);

select is(
  (
    select pg_catalog.count(*)
    from public.audit_logs
    where actor_user_id = 'a1000000-0000-0000-0000-000000000001'
      and action in (
        'sepay_receiving_account_api_identity_set',
        'sepay_historical_transaction_already_accounted',
        'sepay_historical_transaction_matched'
      )
  ),
  4::bigint,
  'account setup and both reconciliation decisions are append-only audited'
);

select is(
  (
    select pg_catalog.count(*)
    from public.student_session_ledger_entries
    where metadata ->> 'sepay_transaction_id' = (
      select id::text from public.sepay_transactions where sepay_v2_id = 'a7000000-0000-0000-0000-000000000001'
    )
  ),
  2::bigint,
  'the matched request records one purchased-session entry and one bonus entry'
);

select is(
  (select created_at from public.finance_cashflow_records where reference_code = 'PAY-HISTORY-NEW'),
  (select transaction_at from public.sepay_transactions where sepay_v2_id = 'a7000000-0000-0000-0000-000000000001'),
  'historical receipt uses bank time for payroll and commission, not reconciliation time'
);

select public.sync_payroll_order_facts(date '2026-09-01');
select is(
  (select count(*) from public.payroll_source_facts where source_key in (
    select id::text from public.finance_cashflow_records where reference_code = 'PAY-HISTORY-NEW'
  )),
  0::bigint, 'an August receipt reconciled later is not attributed to September payroll'
);
select public.sync_payroll_order_facts(date '2026-08-01');
select is(
  (select event_date from public.payroll_source_facts where source_key in (
    select id::text from public.finance_cashflow_records where reference_code = 'PAY-HISTORY-NEW'
  )),
  date '2026-08-15', 'the old receipt enters the August payroll source facts'
);

select * from finish();

rollback;
