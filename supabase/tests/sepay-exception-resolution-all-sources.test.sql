begin;
select plan(6);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d3000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'exception-owner@example.test', '{}', '{"full_name":"Exception Owner"}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select 'd3000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
select set_config('request.jwt.claim.sub', 'd3000000-0000-4000-8000-000000000001', true);

insert into public.sepay_webhooks (id, sepay_id, gateway, transaction_date, account_number, content, transfer_type, amount_in, amount_out, body_raw, processing_status) values
  ('d4000000-0000-4000-8000-000000000001', 940000001, 'TESTBANK', '2026-09-24 10:00:00+07', '0100123456', 'x', 'in', 63000, 0, '{}'::jsonb, 'processed'),
  ('d4000000-0000-4000-8000-000000000002', 940000002, 'TESTBANK', '2026-09-24 11:00:00+07', '0100123456', 'x', 'in', 1500000, 0, '{}'::jsonb, 'processed');

-- Webhook-sourced (no api_v2 payload): a small personal transfer and an amount-mismatch case.
insert into public.sepay_transactions (id, sepay_webhook_id, bank_transaction_id, bank_brand, account_number, account_purpose, amount_vnd, transfer_content, transaction_at, match_status, transfer_type, ingestion_source) values
  ('d5000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001', '940000001', 'TESTBANK', '0100123456', 'renewal', 63000, 'QR chuyen khoan nham', '2026-09-24 10:00:00+07', 'unmatched', 'in', 'webhook'),
  ('d5000000-0000-4000-8000-000000000002', 'd4000000-0000-4000-8000-000000000002', '940000002', 'TESTBANK', '0100123456', 'renewal', 1500000, 'hoc phi', '2026-09-24 11:00:00+07', 'amount_mismatch', 'in', 'webhook');

select is(
  (select public.resolve_sepay_historical_transaction('d5000000-0000-4000-8000-000000000001', 'ignored', 'Chuyển nhầm, đã hoàn lại tiền mặt') ->> 'match_status'),
  'ignored', 'a webhook-sourced transfer can be ignored with a reason');
select is(
  (select match_status from public.sepay_transactions where id = 'd5000000-0000-4000-8000-000000000001'),
  'ignored', 'ignored status is persisted');
select ok(
  exists(select 1 from public.audit_logs where action = 'sepay_historical_transaction_ignored' and entity_id = 'd5000000-0000-4000-8000-000000000001'),
  'resolution is audited');

select is(
  (select public.resolve_sepay_historical_transaction('d5000000-0000-4000-8000-000000000002', 'already_accounted', 'Đã thu tiền mặt, phụ huynh chuyển lại cho đủ') ->> 'match_status'),
  'historical_accounted', 'an amount-mismatch transfer can be marked already accounted');

select throws_ok(
  $$select public.resolve_sepay_historical_transaction('d5000000-0000-4000-8000-000000000001', 'ignored', 'again')$$,
  'TRANSACTION_ALREADY_RECONCILED', 'a resolved transaction cannot be resolved twice');
select throws_ok(
  $$select public.resolve_sepay_historical_transaction('d5000000-0000-4000-8000-000000000002', 'ignored', '   ')$$,
  'SEPAY_RECONCILIATION_INPUT_INVALID', 'a reason is required');

select * from finish();
rollback;
