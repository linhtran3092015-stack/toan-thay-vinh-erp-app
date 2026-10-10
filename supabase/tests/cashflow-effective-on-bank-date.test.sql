begin;
select plan(8);

select has_column('public', 'finance_cashflow_records', 'effective_on', 'cashflow records carry a business date');

-- Owner with payroll.manage runs the fact sync.
insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('e1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'effective-on-owner@example.test', '{}', '{}', now(), now());
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'e1000000-0000-0000-0000-000000000001', id, 'fixture' from public.roles where code = 'owner';
select set_config('request.jwt.claim.sub', 'e1000000-0000-0000-0000-000000000001', true);

insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status)
values ('e4000000-0000-0000-0000-000000000001', 'TV-2026-91001', 'Effective On Student', 2014, 6, 'active');

insert into public.sepay_webhooks (id, sepay_id, gateway, transaction_date, account_number, content, transfer_type, amount_in, amount_out, body_raw, processing_status)
values ('e5000000-0000-0000-0000-000000000001', 910000001, 'TESTBANK', '2026-09-27 15:30:00+07', '0100123456', 'EFFECTIVE-ON', 'in', 1400000, 0, '{}'::jsonb, 'processed');

-- Bank transfer on 27/09 (Vietnam time) ...
insert into public.sepay_transactions (id, sepay_webhook_id, bank_transaction_id, bank_brand, account_number, account_purpose, amount_vnd, transfer_content, transaction_at, match_status)
values ('e6000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', '910000001', 'TESTBANK', '0100123456', 'renewal', 1400000, 'EFFECTIVE-ON', '2026-09-27 15:30:00+07', 'unmatched');

-- ... allocated by the accountant on 03/10.
insert into public.finance_cashflow_records (id, record_type, category, amount_vnd, student_id, sepay_transaction_id, reference_code, note, created_by, created_at)
values ('e7000000-0000-0000-0000-000000000001', 'receipt', 'tuition_fee', 1400000, 'e4000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', 'EFFECTIVE-ON', 'fixture', 'e1000000-0000-0000-0000-000000000001', '2026-10-03 09:00:00+07');

select is(
  (select effective_on from public.finance_cashflow_records where id = 'e7000000-0000-0000-0000-000000000001'),
  date '2026-09-27', 'trigger sets effective_on from the bank transaction date');

-- A receipt without a bank transaction falls back to its own creation date.
insert into public.finance_cashflow_records (id, record_type, category, amount_vnd, student_id, reference_code, note, created_by, created_at)
values ('e7000000-0000-0000-0000-000000000002', 'receipt', 'other', 50000, 'e4000000-0000-0000-0000-000000000001', 'EFFECTIVE-ON-CASH', 'fixture', 'e1000000-0000-0000-0000-000000000001', '2026-10-03 23:30:00+07');
select is(
  (select effective_on from public.finance_cashflow_records where id = 'e7000000-0000-0000-0000-000000000002'),
  date '2026-10-03', 'receipts without a bank transaction use their Vietnam-time creation date');

-- Syncing September picks the transfer up even though it was allocated in October.
select is(public.sync_payroll_order_facts(date '2026-09-01'), 1, 'september sync inserts the late-allocated receipt');
select is(
  (select event_date from public.payroll_source_facts where fact_type = 'renewal_order' and source_key = 'e7000000-0000-0000-0000-000000000001'),
  date '2026-09-27', 'fact event_date is the bank date');
select is(
  (select metadata ->> 'allocated_at' is not null from public.payroll_source_facts where source_key = 'e7000000-0000-0000-0000-000000000001'),
  true, 'fact keeps the allocation timestamp for audit');

-- Syncing October must not count it again.
select is(public.sync_payroll_order_facts(date '2026-10-01'), 0, 'october sync does not double count the september transfer');
select is(
  (select count(*) from public.payroll_source_facts where source_key = 'e7000000-0000-0000-0000-000000000001'),
  1::bigint, 'exactly one fact per receipt');

select * from finish();
rollback;
