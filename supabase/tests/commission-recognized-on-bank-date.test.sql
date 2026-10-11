begin;
select plan(11);

select has_column('public', 'sales_commission_accruals', 'recognized_on', 'accruals carry the bank business date');

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'commission-owner@example.test', '{}', '{}', now(), now()),
  ('c1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'commission-sale@example.test', '{}', '{}', now(), now());
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'c1000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'c1000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'admissions_specialist';

insert into public.crm_lead_sources (id, code, name, group_code, is_active)
values ('c2000000-0000-4000-8000-000000000001', 'mma_commission_fixture', 'MMA Commission Fixture', 'mma', true);

insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status)
values ('c4000000-0000-4000-8000-000000000001', 'TV-2026-95001', 'Commission Student', 2014, 6, 'active');

insert into public.crm_cases (id, public_code, full_name, birth_year, expected_grade, guardian_phone, guardian_full_name, lead_source_id, sale_owner_id, status, student_id)
values ('c3000000-0000-4000-8000-000000000001', 'CRM-COMM-001', 'Commission Student', 2014, 6, '0900000001', 'Phụ huynh', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'converted', 'c4000000-0000-4000-8000-000000000001');

insert into public.sepay_webhooks (id, sepay_id, gateway, transaction_date, account_number, content, transfer_type, amount_in, amount_out, body_raw, processing_status)
values ('c5000000-0000-4000-8000-000000000001', 950000001, 'TESTBANK', '2026-09-30 23:30:00+07', '0100123456', 'COMM', 'in', 1400000, 0, '{}'::jsonb, 'processed');
insert into public.sepay_transactions (id, sepay_webhook_id, bank_transaction_id, bank_brand, account_number, account_purpose, amount_vnd, transfer_content, transaction_at, match_status, transfer_type)
values ('c6000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', '950000001', 'TESTBANK', '0100123456', 'new_enrollment', 1400000, 'COMM', '2026-09-30 23:30:00+07', 'unmatched', 'in');

-- Transfer landed on 30/09 (Vietnam time), allocated by the accountant on 03/10.
insert into public.finance_cashflow_records (id, record_type, category, amount_vnd, student_id, sepay_transaction_id, reference_code, note, created_by, created_at)
values ('c7000000-0000-4000-8000-000000000001', 'receipt', 'tuition_fee', 1400000, 'c4000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'COMM', 'fixture', 'c1000000-0000-4000-8000-000000000001', '2026-10-03 09:00:00+07');

select is(
  (select recognized_on from public.sales_commission_accruals where source_cashflow_record_id = 'c7000000-0000-4000-8000-000000000001'),
  date '2026-09-30', 'accrual is recognised on the bank date, not the allocation date');
select is(
  (select recognized_at from public.sales_commission_accruals where source_cashflow_record_id = 'c7000000-0000-4000-8000-000000000001'),
  timestamptz '2026-09-30 23:30:00+07', 'recognized_at is the bank timestamp');

-- A receipt without a bank transaction keeps its own creation moment.
insert into public.finance_cashflow_records (id, record_type, category, amount_vnd, student_id, reference_code, note, created_by, created_at)
values ('c7000000-0000-4000-8000-000000000002', 'receipt', 'tuition_fee', 300000, 'c4000000-0000-4000-8000-000000000001', 'COMM-CASH', 'fixture', 'c1000000-0000-4000-8000-000000000001', '2026-10-05 10:00:00+07');
select is(
  (select recognized_on from public.sales_commission_accruals where source_cashflow_record_id = 'c7000000-0000-4000-8000-000000000002'),
  date '2026-10-05', 'cash receipts fall back to their creation date');
select is(
  (select recognized_at from public.sales_commission_accruals where source_cashflow_record_id = 'c7000000-0000-4000-8000-000000000002'),
  timestamptz '2026-10-05 10:00:00+07', 'cash receipts keep created_at as recognized_at');

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select is(
  (select source_cashflow_record_id from public.get_sales_commission_accruals_dashboard(10) limit 1),
  'c7000000-0000-4000-8000-000000000002'::uuid, 'dashboard orders by bank date, newest first');
select is(
  (select recognized_on from public.get_sales_commission_accruals_dashboard(10) where source_cashflow_record_id = 'c7000000-0000-4000-8000-000000000001'),
  date '2026-09-30', 'dashboard exposes recognized_on');

-- The ledger stays immutable for everyone except the SePay reversal RPC.
select throws_ok(
  $$delete from public.sales_commission_accruals where source_cashflow_record_id = 'c7000000-0000-4000-8000-000000000001'$$,
  '23514', 'SALES_COMMISSION_ACCRUAL_IMMUTABLE', 'direct deletes are refused');
select set_config('app.sepay_allocation_reversal', 'on', true);
select lives_ok(
  $$delete from public.sales_commission_accruals where source_cashflow_record_id = 'c7000000-0000-4000-8000-000000000001'$$,
  'the reversal GUC allows the delete');
select set_config('app.sepay_allocation_reversal', 'off', true);

-- Re-inserting must follow the bank-date convention.
select throws_ok(
  $$insert into public.sales_commission_accruals (source_cashflow_record_id, crm_case_id, student_id, sale_owner_id, lead_source_code, lead_source_name, lead_source_group, recognized_revenue_vnd, recognized_at, recognized_on, recognized_by)
    values ('c7000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'mma_commission_fixture', 'MMA Commission Fixture', 'mma', 1400000, timestamptz '2026-10-03 09:00:00+07', date '2026-10-03', 'c1000000-0000-4000-8000-000000000001')$$,
  '23514', 'COMMISSION_CASHFLOW_SOURCE_MISMATCH', 'allocation-date accruals are rejected');
select lives_ok(
  $$insert into public.sales_commission_accruals (source_cashflow_record_id, crm_case_id, student_id, sale_owner_id, lead_source_code, lead_source_name, lead_source_group, recognized_revenue_vnd, recognized_at, recognized_on, recognized_by)
    values ('c7000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'mma_commission_fixture', 'MMA Commission Fixture', 'mma', 1400000, timestamptz '2026-09-30 23:30:00+07', date '2026-09-30', 'c1000000-0000-4000-8000-000000000001')$$,
  'bank-date accruals are accepted');

select * from finish();
rollback;
