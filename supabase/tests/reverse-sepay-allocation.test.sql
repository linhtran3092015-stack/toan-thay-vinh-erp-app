begin;
select plan(21);

select ok(to_regprocedure('public.reverse_sepay_allocation(uuid, text)') is not null, 'reversal RPC exists');
select ok(not has_function_privilege('anon', 'public.reverse_sepay_allocation(uuid, text)', 'execute'), 'anon cannot call the reversal RPC');

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'reverse-owner@example.test', '{}', '{}', now(), now()),
  ('d1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'reverse-ta@example.test', '{}', '{}', now(), now());
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'd1000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'd1000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';

insert into public.guardians (id, full_name, phone)
values ('d3000000-0000-4000-8000-000000000001', 'Phụ huynh Đảo', '0911111111');
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status) values
  ('d4000000-0000-4000-8000-000000000001', 'TV-2026-96001', 'Học sinh Đảo Một', 2014, 6, 'active'),
  ('d4000000-0000-4000-8000-000000000002', 'TV-2026-96002', 'Học sinh Đảo Hai', 2015, 5, 'active');
insert into public.student_guardians (student_id, guardian_id, relationship, is_primary) values
  ('d4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'mother', true),
  ('d4000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000001', 'mother', true);

insert into public.sepay_webhooks (id, sepay_id, gateway, transaction_date, account_number, content, transfer_type, amount_in, amount_out, body_raw, processing_status) values
  ('d5000000-0000-4000-8000-000000000001', 960000001, 'TESTBANK', '2026-09-20 10:00:00+07', '0100123456', 'REV1', 'in', 1400000, 0, '{}'::jsonb, 'processed'),
  ('d5000000-0000-4000-8000-000000000002', 960000002, 'TESTBANK', '2026-09-21 10:00:00+07', '0100123456', 'REV2', 'in', 500000, 0, '{}'::jsonb, 'processed'),
  ('d5000000-0000-4000-8000-000000000003', 960000003, 'TESTBANK', '2026-10-02 10:00:00+07', '0100123456', 'REV3', 'in', 700000, 0, '{}'::jsonb, 'processed');
insert into public.sepay_transactions (id, sepay_webhook_id, bank_transaction_id, bank_brand, account_number, account_purpose, amount_vnd, transfer_content, transaction_at, match_status, transfer_type) values
  ('d6000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', '960000001', 'TESTBANK', '0100123456', 'renewal', 1400000, 'REV1', '2026-09-20 10:00:00+07', 'unmatched', 'in'),
  ('d6000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000002', '960000002', 'TESTBANK', '0100123456', 'renewal', 500000, 'REV2', '2026-09-21 10:00:00+07', 'unmatched', 'in'),
  ('d6000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000003', '960000003', 'TESTBANK', '0100123456', 'renewal', 700000, 'REV3', '2026-10-02 10:00:00+07', 'unmatched', 'in');

-- September has a draft payroll period; October is already approved.
insert into public.payroll_periods (id, period_month, pay_date, status, generated_by, generated_at)
values ('d8000000-0000-4000-8000-000000000001', date '2026-09-01', date '2026-10-28', 'draft', 'd1000000-0000-4000-8000-000000000001', now());
insert into public.payroll_periods (id, period_month, pay_date, status, generated_by, generated_at, reviewed_by, reviewed_at, approved_by, approved_at, feedback_opened_at, feedback_closed_at, feedback_closed_by)
values ('d8000000-0000-4000-8000-000000000002', date '2026-10-01', date '2026-11-28', 'approved',
  'd1000000-0000-4000-8000-000000000001', now(), 'd1000000-0000-4000-8000-000000000001', now(), 'd1000000-0000-4000-8000-000000000001', now(), now(), now(), 'd1000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);

create temp table fx (key text primary key, id uuid);
insert into fx select 'request', (public.create_student_payment_request('d4000000-0000-4000-8000-000000000001', 1400000, 10, 0, 140000, 'renewal', null)->>'id')::uuid;

-- Allocate the September transfer against the request, then sync payroll facts.
select lives_ok(
  $$select public.allocate_sepay_tuition_manually('d6000000-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object('student_id', 'd4000000-0000-4000-8000-000000000001',
        'payment_request_id', (select id from fx where key = 'request'),
        'allocated_amount_vnd', 1400000, 'allocated_sessions', 10, 'bonus_sessions', 0)),
      'fixture allocation')$$,
  'manual allocation succeeds');
select is(public.sync_payroll_order_facts(date '2026-09-01'), 1, 'the allocation produces one payroll fact');
select is(
  (select status from public.student_payment_requests where id = (select id from fx where key = 'request')),
  'paid', 'the request is paid after allocation');

-- Guards.
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.reverse_sepay_allocation('d6000000-0000-4000-8000-000000000001', 'không phải việc của tôi')$$,
  '42501', 'PAYMENTS_MANAGE_PERMISSION_DENIED', 'staff without payments.manage cannot reverse');
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.reverse_sepay_allocation('d6000000-0000-4000-8000-000000000002', 'chưa phân bổ')$$,
  '23514', 'TRANSACTION_NOT_ALLOCATED', 'an unmatched transaction has nothing to reverse');
select throws_ok(
  $$select public.reverse_sepay_allocation('d6000000-0000-4000-8000-000000000001', 'x')$$,
  '22023', 'REASON_REQUIRED', 'a reason is mandatory');

-- Reverse the September allocation.
select is(
  (public.reverse_sepay_allocation('d6000000-0000-4000-8000-000000000001', 'Chọn nhầm học sinh')->>'status'),
  'success', 'reversal succeeds');
select is(
  (select match_status from public.sepay_transactions where id = 'd6000000-0000-4000-8000-000000000001'),
  'unmatched', 'the transaction returns to the reconciliation queue');
select is(
  (select coalesce(sum(delta_sessions), 0) from public.student_session_ledger_entries where student_id = 'd4000000-0000-4000-8000-000000000001'),
  0::bigint, 'the student session balance nets to zero');
select is(
  (select count(*) from public.student_session_ledger_entries where entry_type = 'manual_adjustment' and delta_sessions = -10 and metadata->>'sepay_transaction_id' = 'd6000000-0000-4000-8000-000000000001'),
  1::bigint, 'a compensating ledger entry is appended instead of deleting history');
select is(
  (select status || ':' || paid_amount_vnd::text || ':' || coalesce(paid_at::text, 'null') from public.student_payment_requests where id = (select id from fx where key = 'request')),
  'pending:0:null', 'the request is pending again with nothing paid');
select is(
  (select count(*) from public.finance_cashflow_records where sepay_transaction_id = 'd6000000-0000-4000-8000-000000000001')
  + (select count(*) from public.student_credit_lots where sepay_transaction_id = 'd6000000-0000-4000-8000-000000000001')
  + (select count(*) from public.payment_split_allocations where sepay_transaction_id = 'd6000000-0000-4000-8000-000000000001'),
  0::bigint, 'cashflow, credit lots and split allocations are removed');
select is(
  (select count(*) from public.payroll_source_facts where fact_type = 'renewal_order' and metadata->>'sepay_transaction_id' = 'd6000000-0000-4000-8000-000000000001'),
  0::bigint, 'the system payroll fact is removed');
select is(
  (select new_data->'payroll_months_to_recalculate' from public.audit_logs where action = 'sepay_allocation_reversed' and entity_id = 'd6000000-0000-4000-8000-000000000001'),
  '["2026-09-01"]'::jsonb, 'the audit entry names the draft payroll month to recalculate');
select is(
  (select jsonb_array_length(old_data->'cashflow_records') from public.audit_logs where action = 'sepay_allocation_reversed' and entity_id = 'd6000000-0000-4000-8000-000000000001'),
  1, 'the audit entry snapshots the removed cashflow');

-- The same transfer can be allocated again to the same student.
select lives_ok(
  $$select public.allocate_sepay_tuition_manually('d6000000-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object('student_id', 'd4000000-0000-4000-8000-000000000001',
        'payment_request_id', (select id from fx where key = 'request'),
        'allocated_amount_vnd', 1400000, 'allocated_sessions', 10, 'bonus_sessions', 0)),
      'fixture re-allocation')$$,
  're-allocation after reversal succeeds');
select is(
  (select count(*) from public.student_session_ledger_entries where event_key = 'sepay-manual-allocation:d6000000-0000-4000-8000-000000000001:d4000000-0000-4000-8000-000000000001:r1'),
  1::bigint, 're-allocation uses a suffixed ledger event key');

-- An allocation in a month whose payroll is approved cannot be reversed.
select lives_ok(
  $$select public.allocate_sepay_tuition_manually('d6000000-0000-4000-8000-000000000003',
      jsonb_build_array(jsonb_build_object('student_id', 'd4000000-0000-4000-8000-000000000002',
        'allocated_amount_vnd', 700000, 'allocated_sessions', 5, 'bonus_sessions', 0)),
      'fixture october allocation')$$,
  'october allocation succeeds');
select throws_ok(
  $$select public.reverse_sepay_allocation('d6000000-0000-4000-8000-000000000003', 'muốn đảo tháng đã chốt lương')$$,
  '23514', 'ALLOCATION_LOCKED_BY_APPROVED_PAYROLL', 'approved payroll months lock their allocations');

select * from finish();
rollback;
