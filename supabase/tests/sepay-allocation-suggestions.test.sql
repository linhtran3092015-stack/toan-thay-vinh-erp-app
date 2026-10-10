begin;
select plan(12);

select ok(to_regprocedure('public.suggest_sepay_allocation_matches(integer)') is not null, 'suggestion RPC exists');
select ok(not has_function_privilege('anon', 'public.suggest_sepay_allocation_matches(integer)', 'execute'), 'anon cannot call the suggestion RPC');

-- Owner (has sepay.allocate through owner role) and a staff member without it.
insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('f1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'suggest-owner@example.test', '{}', '{}', now(), now()),
  ('f1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'suggest-ta@example.test', '{}', '{}', now(), now());
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'f1000000-0000-0000-0000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'f1000000-0000-0000-0000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';

insert into public.guardians (id, full_name, phone) values
  ('f3000000-0000-0000-0000-000000000001', 'Phụ huynh Phú', '0912345678'),
  ('f3000000-0000-0000-0000-000000000002', 'Phụ huynh Lan', '0987654321'),
  ('f3000000-0000-0000-0000-000000000003', 'Phụ huynh Bảo', '0900000003');

insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status) values
  ('f4000000-0000-0000-0000-000000000001', 'TV-2026-93001', 'Phạm Khánh Phú', 2013, 7, 'active'),
  ('f4000000-0000-0000-0000-000000000002', 'TV-2026-93002', 'Trần Ngọc Lan', 2017, 3, 'active'),
  ('f4000000-0000-0000-0000-000000000003', 'TV-2026-93003', 'Nguyễn Gia Bảo', 2014, 6, 'active'),
  ('f4000000-0000-0000-0000-000000000004', 'TV-2026-93004', 'Nguyễn Gia Bảo', 2016, 4, 'active');

insert into public.student_guardians (student_id, guardian_id, relationship, is_primary) values
  ('f4000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001', 'mother', true),
  ('f4000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000002', 'mother', true),
  ('f4000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-000000000003', 'father', true),
  ('f4000000-0000-0000-0000-000000000004', 'f3000000-0000-0000-0000-000000000003', 'father', true);

insert into public.student_tuition_rate_versions (student_id, effective_from, unit_price_vnd, reason)
values ('f4000000-0000-0000-0000-000000000001', '2026-08-01', 140000, 'fixture');

insert into public.sepay_webhooks (id, sepay_id, gateway, transaction_date, account_number, content, transfer_type, amount_in, amount_out, body_raw, processing_status) values
  ('f5000000-0000-0000-0000-000000000001', 930000001, 'TESTBANK', '2026-09-20 10:00:00+07', '0100123456', 'x', 'in', 1400000, 0, '{}'::jsonb, 'processed'),
  ('f5000000-0000-0000-0000-000000000002', 930000002, 'TESTBANK', '2026-09-21 10:00:00+07', '0100123456', 'x', 'in', 2000000, 0, '{}'::jsonb, 'processed'),
  ('f5000000-0000-0000-0000-000000000003', 930000003, 'TESTBANK', '2026-09-22 10:00:00+07', '0100123456', 'x', 'in', 2800000, 0, '{}'::jsonb, 'processed'),
  ('f5000000-0000-0000-0000-000000000004', 930000004, 'TESTBANK', '2026-09-23 10:00:00+07', '0100123456', 'x', 'in', 500000, 0, '{}'::jsonb, 'processed'),
  ('f5000000-0000-0000-0000-000000000005', 930000005, 'TESTBANK', '2026-09-24 10:00:00+07', '0100123456', 'x', 'in', 700000, 0, '{}'::jsonb, 'processed');

insert into public.sepay_transactions (id, sepay_webhook_id, bank_transaction_id, bank_brand, account_number, account_purpose, amount_vnd, transfer_content, transaction_at, match_status, transfer_type) values
  -- name + birth year → high, 10 sessions at 140k
  ('f6000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001', '930000001', 'TESTBANK', '0100123456', 'renewal', 1400000, 'MB Pham Khanh Phu 2013 nop hoc phi- Ma GD ACSP/abc', '2026-09-20 10:00:00+07', 'unmatched', 'in'),
  -- guardian phone only → high
  ('f6000000-0000-0000-0000-000000000002', 'f5000000-0000-0000-0000-000000000002', '930000002', 'TESTBANK', '0100123456', 'renewal', 2000000, 'chuyen tien hoc 0987654321', '2026-09-21 10:00:00+07', 'unmatched', 'in'),
  -- ambiguous name without year → two medium candidates
  ('f6000000-0000-0000-0000-000000000003', 'f5000000-0000-0000-0000-000000000003', '930000003', 'TESTBANK', '0100123456', 'renewal', 2800000, 'nguyen gia bao hoc phi', '2026-09-22 10:00:00+07', 'unmatched', 'in'),
  -- nothing recognisable → no suggestion
  ('f6000000-0000-0000-0000-000000000004', 'f5000000-0000-0000-0000-000000000004', '930000004', 'TESTBANK', '0100123456', 'renewal', 500000, 'chuyen khoan', '2026-09-23 10:00:00+07', 'unmatched', 'in'),
  -- already matched → never suggested even if the name is present
  ('f6000000-0000-0000-0000-000000000005', 'f5000000-0000-0000-0000-000000000005', '930000005', 'TESTBANK', '0100123456', 'renewal', 700000, 'Pham Khanh Phu 2013', '2026-09-24 10:00:00+07', 'manual_matched', 'in');

select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
select throws_ok($$select * from public.suggest_sepay_allocation_matches()$$, '42501', 'SEPAY_ALLOCATE_PERMISSION_DENIED', 'staff without allocation rights cannot read suggestions');

select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);

select is(
  (select confidence from public.suggest_sepay_allocation_matches() where transaction_id = 'f6000000-0000-0000-0000-000000000001'),
  'high', 'name plus birth year is a high-confidence match');
select is(
  (select student_id from public.suggest_sepay_allocation_matches() where transaction_id = 'f6000000-0000-0000-0000-000000000001'),
  'f4000000-0000-0000-0000-000000000001'::uuid, 'the matched student is the right one');
select is(
  (select suggested_sessions from public.suggest_sepay_allocation_matches() where transaction_id = 'f6000000-0000-0000-0000-000000000001'),
  10, 'suggested sessions = amount / current unit price');
select is(
  (select match_reasons from public.suggest_sepay_allocation_matches() where transaction_id = 'f6000000-0000-0000-0000-000000000001'),
  array['student_name', 'birth_year'], 'reasons list why the student matched');

select is(
  (select student_id from public.suggest_sepay_allocation_matches() where transaction_id = 'f6000000-0000-0000-0000-000000000002'),
  'f4000000-0000-0000-0000-000000000002'::uuid, 'guardian phone in the content matches the student');
select is(
  (select suggested_sessions from public.suggest_sepay_allocation_matches() where transaction_id = 'f6000000-0000-0000-0000-000000000002'),
  null, 'no tuition rate yields no session suggestion');

select is(
  (select candidate_count from public.suggest_sepay_allocation_matches() where transaction_id = 'f6000000-0000-0000-0000-000000000003' limit 1),
  2, 'same name without a birth year lists both students');
select is(
  (select count(distinct confidence) from public.suggest_sepay_allocation_matches() where transaction_id = 'f6000000-0000-0000-0000-000000000003'),
  1::bigint, 'ambiguous name-only candidates are all medium');

select is(
  (select count(*) from public.suggest_sepay_allocation_matches() where transaction_id in ('f6000000-0000-0000-0000-000000000004', 'f6000000-0000-0000-0000-000000000005')),
  0::bigint, 'unrecognisable and already-matched transactions get no suggestions');

select * from finish();
rollback;
