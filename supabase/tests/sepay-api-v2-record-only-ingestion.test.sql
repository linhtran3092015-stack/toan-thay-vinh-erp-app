begin;

select plan(24);

select has_function(
  'public',
  'ingest_sepay_api_v2_transaction',
  array[
    'uuid', 'text', 'timestamp with time zone', 'text', 'text', 'text',
    'text', 'bigint', 'bigint', 'text', 'jsonb'
  ],
  'the SePay API v2 record-only RPC exists with a UUID transaction identity'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.ingest_sepay_api_v2_transaction(uuid,text,timestamptz,text,text,text,text,bigint,bigint,text,jsonb)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.ingest_sepay_api_v2_transaction(uuid,text,timestamptz,text,text,text,text,bigint,bigint,text,jsonb)',
    'execute'
  ),
  'only service_role can invoke the SePay API v2 ingestion RPC'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '91000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'sepay-v2-ingestion@example.test',
  '{"provider":"email"}',
  '{"full_name":"SePay V2 Ingestion"}',
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
);

insert into public.guardians (id, full_name, phone)
values (
  '92000000-0000-0000-0000-000000000001',
  'SePay V2 Guardian',
  '0900099001'
);

insert into public.students (
  id, public_code, full_name, birth_year, current_grade, lifecycle_status
)
values (
  '93000000-0000-0000-0000-000000000001',
  'TV-2026-99001',
  'SePay V2 Student',
  2014,
  6,
  'active'
);

insert into public.student_guardians (
  student_id, guardian_id, relationship, is_primary
)
values (
  '93000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  'parent',
  true
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
values
  (
    '94000000-0000-0000-0000-000000000001',
    'PAY-V2-HISTORY',
    '93000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    1000000,
    10,
    0,
    100000,
    'new',
    'TTV V2 HISTORY',
    'pending'
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    'PAY-V2-LIVE',
    '93000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    1200000,
    12,
    0,
    100000,
    'new',
    'TTV V2 LIVE',
    'pending'
  );

insert into public.sepay_receiving_account_versions (
  purpose, bank_code, account_number, account_display_name, effective_from
)
values
  (
    'new_enrollment',
    'TESTBANK',
    '0657000001',
    'SePay V2 New Enrollment Account',
    '2026-01-01'
  ),
  (
    'renewal',
    'TESTBANK',
    '0657000002',
    'SePay V2 Renewal Account',
    '2026-01-01'
  );

select is(
  public.ingest_sepay_api_v2_transaction(
    '95000000-0000-0000-0000-000000000001',
    'TESTBANK',
    '2026-09-01 01:00:00+00',
    '0657000001',
    'TTV V2 HISTORY',
    'TTV V2 HISTORY',
    'in',
    1000000,
    0,
    'REF-V2-HISTORY',
    '{"source":"api_v2","case":"history"}'::jsonb
  ) ->> 'mode',
  'record_only',
  'API v2 ingestion is explicitly record-only'
);

select is(
  (
    select transaction.sepay_v2_id
    from public.sepay_transactions as transaction
    where transaction.sepay_v2_id = '95000000-0000-0000-0000-000000000001'
  ),
  '95000000-0000-0000-0000-000000000001'::uuid,
  'the UUID identity from SePay API v2 is stored without bigint conversion'
);

select is(
  (
    select transaction.account_purpose
    from public.sepay_transactions as transaction
    where transaction.sepay_v2_id = '95000000-0000-0000-0000-000000000001'
  ),
  'new_enrollment',
  'historical API ingestion resolves the account purpose at transaction time'
);

select public.ingest_sepay_api_v2_transaction(
  '95000000-0000-0000-0000-000000000004',
  'TESTBANK',
  '2026-09-01 01:30:00+00',
  '0657000002',
  null,
  'RENEWAL ACCOUNT HISTORY',
  'in',
  750000,
  0,
  'REF-V2-RENEWAL',
  '{"source":"api_v2","case":"renewal-account"}'::jsonb
);

select is(
  (
    select transaction.account_purpose
    from public.sepay_transactions as transaction
    where transaction.sepay_v2_id = '95000000-0000-0000-0000-000000000004'
  ),
  'renewal',
  'the renewal account is classified separately and remains record-only'
);

select is(
  (
    select transaction.match_status
    from public.sepay_transactions as transaction
    where transaction.sepay_v2_id = '95000000-0000-0000-0000-000000000001'
  ),
  'unmatched',
  'a matching historical transfer remains unmatched pending explicit review'
);

select is(
  (
    select request.status
    from public.student_payment_requests as request
    where request.id = '94000000-0000-0000-0000-000000000001'
  ),
  'pending',
  'record-only ingestion does not mark a matching payment request paid'
);

select is(
  (
    select pg_catalog.count(*)
    from public.student_credit_lots as credit_lot
    where credit_lot.payment_request_id = '94000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'record-only ingestion creates no student credit lot'
);

select is(
  (
    select pg_catalog.count(*)
    from public.finance_cashflow_records as cashflow
    join public.sepay_transactions as transaction
      on transaction.id = cashflow.sepay_transaction_id
    where transaction.sepay_v2_id = '95000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'record-only ingestion creates no finance cashflow record'
);

select is(
  public.ingest_sepay_api_v2_transaction(
    '95000000-0000-0000-0000-000000000001',
    'TESTBANK',
    '2026-09-01 01:00:00+00',
    '0657000001',
    'TTV V2 HISTORY',
    'TTV V2 HISTORY',
    'in',
    1000000,
    0,
    'REF-V2-HISTORY',
    '{"source":"api_v2","case":"history-retry"}'::jsonb
  ) ->> 'status',
  'ignored',
  'replaying the same API v2 UUID is idempotent'
);

select is(
  (
    select pg_catalog.count(*)
    from public.sepay_transactions as transaction
    where transaction.sepay_v2_id = '95000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'an API v2 retry leaves one canonical transaction'
);

select public.process_sepay_webhook_transaction(
  960000001,
  'TESTBANK',
  '2026-09-01 02:00:00+00',
  '0657000001',
  null,
  'UNMATCHED WEBHOOK FIRST',
  'in',
  500000,
  0,
  'new_enrollment',
  'REF-WEBHOOK-FIRST',
  '{"source":"webhook"}'::jsonb
);

select public.ingest_sepay_api_v2_transaction(
  '95000000-0000-0000-0000-000000000002',
  'TESTBANK',
  '2026-09-01 02:00:02+00',
  '0657000001',
  null,
  'API NORMALIZED CONTENT',
  'in',
  500000,
  0,
  'REF-WEBHOOK-FIRST',
  '{"source":"api_v2"}'::jsonb
);

select is(
  (
    select pg_catalog.count(*)
    from public.sepay_transactions as transaction
    where transaction.reference_number = 'REF-WEBHOOK-FIRST'
  ),
  1::bigint,
  'API v2 links to a prior webhook transaction by bank reference without duplicating it'
);

select is(
  (
    select transaction.ingestion_source
    from public.sepay_transactions as transaction
    where transaction.reference_number = 'REF-WEBHOOK-FIRST'
  ),
  'reconciled',
  'a webhook-first transaction records that both delivery sources confirmed it'
);

select public.ingest_sepay_api_v2_transaction(
  '95000000-0000-0000-0000-000000000003',
  'TESTBANK',
  '2026-09-01 03:00:00+00',
  '0657000001',
  'TTV V2 LIVE',
  'TTV V2 LIVE',
  'in',
  1200000,
  0,
  'REF-API-FIRST',
  '{"source":"api_v2"}'::jsonb
);

select is(
  (
    select request.status
    from public.student_payment_requests as request
    where request.id = '94000000-0000-0000-0000-000000000002'
  ),
  'pending',
  'an API-first transaction remains record-only before its live webhook arrives'
);

select public.process_sepay_webhook_transaction(
  960000002,
  'TESTBANK',
  '2026-09-01 03:00:01+00',
  '0657000001',
  'TTV V2 LIVE',
  'WEBHOOK NORMALIZED CONTENT',
  'in',
  1200000,
  0,
  'new_enrollment',
  'REF-API-FIRST',
  '{"source":"webhook"}'::jsonb
);

select is(
  (
    select pg_catalog.count(*)
    from public.sepay_transactions as transaction
    where transaction.reference_number = 'REF-API-FIRST'
  ),
  1::bigint,
  'a webhook links to an API-first transaction instead of creating a second row'
);

select is(
  (
    select request.status
    from public.student_payment_requests as request
    where request.id = '94000000-0000-0000-0000-000000000002'
  ),
  'pending',
  'a delayed webhook cannot settle a transaction that was imported from history'
);

select is(
  (
    select pg_catalog.count(*)
    from public.student_credit_lots as credit_lot
    where credit_lot.payment_request_id = '94000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'the API-first then webhook flow creates no credit lot before manual review'
);

select is(
  (
    select pg_catalog.count(*)
    from public.finance_cashflow_records as cashflow
    where cashflow.reference_code = 'PAY-V2-LIVE'
  ),
  0::bigint,
  'the API-first then webhook flow creates no cashflow record before manual review'
);

select is(
  (
    select transaction.sepay_webhook_id is not null
      and transaction.sepay_v2_id = '95000000-0000-0000-0000-000000000003'
      and transaction.ingestion_source = 'reconciled'
    from public.sepay_transactions as transaction
    where transaction.reference_number = 'REF-API-FIRST'
  ),
  true,
  'the canonical API-first row retains both external identities after reconciliation'
);

select public.ingest_sepay_api_v2_transaction(
  '95000000-0000-0000-0000-000000000005',
  'TESTBANK',
  '2026-09-01 04:00:00+00',
  '0657000001',
  null,
  'REFERENCE DRIFT SAME TRANSFER',
  'in',
  650000,
  0,
  'REF-API-DIFFERENT',
  '{"source":"api_v2","case":"reference-drift"}'::jsonb
);

select public.process_sepay_webhook_transaction(
  960000003,
  'TESTBANK',
  '2026-09-01 04:00:00+00',
  '0657000001',
  null,
  'REFERENCE DRIFT SAME TRANSFER',
  'in',
  650000,
  0,
  'new_enrollment',
  'REF-WEBHOOK-DIFFERENT',
  '{"source":"webhook","case":"reference-drift"}'::jsonb
);

select is(
  (
    select pg_catalog.count(*)
    from public.sepay_transactions as transaction
    where transaction.amount_vnd = 650000
      and transaction.transaction_at = '2026-09-01 04:00:00+00'
  ),
  1::bigint,
  'matching timestamp and content reconcile API and webhook even when reference values differ'
);

select is(
  (
    select webhook.error_message
    from public.sepay_webhooks as webhook
    where webhook.sepay_id = 960000003
  ),
  'HISTORICAL_TRANSACTION_REQUIRES_REVIEW',
  'reference drift still keeps a delayed webhook behind manual review'
);

select is(
  (
    select transaction.source_payloads
    from public.sepay_transactions as transaction
    where transaction.sepay_v2_id = '95000000-0000-0000-0000-000000000005'
  ),
  '{"api_v2":{"recorded":true},"webhook":{"recorded":true}}'::jsonb,
  'canonical transaction rows keep only source-presence markers, not raw provider payloads'
);

select throws_ok(
  $$select public.ingest_sepay_api_v2_transaction(
    '95000000-0000-0000-0000-000000000006',
    'TESTBANK',
    '2026-09-01 05:00:00+00',
    '0657000001',
    null,
    'INVALID AMOUNT DIRECTION',
    'in',
    0,
    100000,
    'REF-INVALID-AMOUNT',
    '{"source":"api_v2"}'::jsonb
  )$$,
  'P0001',
  'INVALID_SEPAY_AMOUNT_DIRECTION: So tien khong khop loai giao dich.',
  'record-only ingestion rejects amounts that contradict the transfer direction'
);

select * from finish();

rollback;
