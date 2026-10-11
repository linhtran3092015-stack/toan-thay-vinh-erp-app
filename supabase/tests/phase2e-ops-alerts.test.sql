begin;
select plan(9);

select ok(to_regprocedure('public.raise_ops_alert(text,text,text,text,text)') is not null, 'raise_ops_alert exists');
select ok(not has_function_privilege('authenticated', 'public.raise_ops_alert(text,text,text,text,text)', 'execute'), 'signed-in users cannot raise ops alerts');
select ok(has_function_privilege('service_role', 'public.raise_ops_alert(text,text,text,text,text)', 'execute'), 'the service role can raise ops alerts');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('2e000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ops-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('2e000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ops-ta@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '2e000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '2e000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';

select throws_ok(
  $$select public.raise_ops_alert('Bad Code', 'x', 'y', null, null)$$,
  '22023', 'OPS_ALERT_CODE_INVALID', 'alert codes are snake_case');

select is(public.raise_ops_alert('cron_job_failed', 'Tác vụ nền thất bại', 'student-care-worker lỗi', 'ops.test:1', '/settings') >= 1, true, 'an alert reaches at least the fixture owner');
select is(
  (select count(*) from public.notifications where dedupe_key = 'ops.test:1' and recipient_user_id = '2e000000-0000-4000-8000-000000000001'),
  1::bigint, 'the owner receives the alert');
select is(
  (select count(*) from public.notifications where dedupe_key = 'ops.test:1' and recipient_user_id = '2e000000-0000-4000-8000-000000000002'),
  0::bigint, 'staff without settings.manage are not alerted');
select is(public.raise_ops_alert('cron_job_failed', 'Tác vụ nền thất bại', 'student-care-worker lỗi', 'ops.test:1', '/settings'), 0, 'the same incident is not delivered twice');

-- A failed webhook in the last 30 minutes produces one alert for the window.
insert into public.sepay_webhooks (sepay_id, gateway, transaction_date, account_number, content, transfer_type, amount_in, amount_out, body_raw, processing_status, error_message)
values (2900000001, 'TESTBANK', now(), '0100123456', 'x', 'in', 100000, 0, '{}'::jsonb, 'failed', 'fixture failure');
select is(public.run_ops_health_check() >= 1, true, 'the health check reports the failed webhook');

select * from finish();
rollback;
