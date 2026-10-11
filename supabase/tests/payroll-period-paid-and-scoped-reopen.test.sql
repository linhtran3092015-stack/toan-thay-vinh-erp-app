begin;
select plan(12);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('e2000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'paid-owner@example.test', '{}', '{"full_name":"Paid Owner"}', now(), now()),
  ('e2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'paid-ta@example.test', '{}', '{"full_name":"Paid TA"}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select 'e2000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select 'e2000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';

-- An approved period for a month far in the past so no live data collides.
insert into public.payroll_periods (id, period_month, pay_date, status, generated_by, generated_at, reviewed_by, reviewed_at, approved_by, approved_at, feedback_opened_at, feedback_closed_at, feedback_closed_by)
values ('e3000000-0000-4000-8000-000000000001', date '2024-01-01', (date '2024-01-01' + interval '1 month' + interval '27 days')::date, 'approved',
  'e2000000-0000-4000-8000-000000000001', now(), 'e2000000-0000-4000-8000-000000000001', now(), 'e2000000-0000-4000-8000-000000000001', now(), now(), now(), 'e2000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', 'e2000000-0000-4000-8000-000000000001', true);

-- Reopen works without touching session_replication_role.
select is((select status from public.reopen_payroll_period('e3000000-0000-4000-8000-000000000001', 'Sửa lại ca của trợ giảng')), 'review', 'approved period reopens to review through the scoped flag');
select is((select current_setting('app.payroll_reopen', true)), 'off', 'the reopen flag is switched off again inside the transaction');
select is((select status from public.reopen_payroll_to_draft('e3000000-0000-4000-8000-000000000001', 'Nhập bổ sung dữ liệu')), 'draft', 'review period reopens to draft');
select throws_ok(
  $$update public.payroll_periods set status = 'approved', reviewed_by = 'e2000000-0000-4000-8000-000000000001', reviewed_at = now(), approved_by = 'e2000000-0000-4000-8000-000000000001', approved_at = now() where id = 'e3000000-0000-4000-8000-000000000001'$$,
  '23514', 'PAYROLL_PERIOD_HISTORY_IS_IMMUTABLE', 'direct status jumps are still refused by the history trigger');

-- Walk the period forward again (draft → review → approved) with the official steps.
update public.payroll_periods set feedback_closed_at = now(), feedback_closed_by = 'e2000000-0000-4000-8000-000000000001' where id = 'e3000000-0000-4000-8000-000000000001';
update public.payroll_periods set status = 'review', reviewed_by = 'e2000000-0000-4000-8000-000000000001', reviewed_at = now() where id = 'e3000000-0000-4000-8000-000000000001';
select is((select status from public.approve_payroll_period('e3000000-0000-4000-8000-000000000001')), 'approved', 'period is approved again');

-- Paying.
select throws_ok(
  $$select public.mark_payroll_period_paid('e3000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1, 'FT-1', null)$$,
  '22023', 'PAYROLL_PAID_ON_INVALID', 'a future payment date is refused');
select set_config('request.jwt.claim.sub', 'e2000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.mark_payroll_period_paid('e3000000-0000-4000-8000-000000000001', date '2024-02-28', 'FT-1', null)$$,
  '42501', 'PAYROLL_PAYMENT_PERMISSION_REQUIRED', 'staff without payroll rights cannot mark a period paid');
select set_config('request.jwt.claim.sub', 'e2000000-0000-4000-8000-000000000001', true);
select is((select paid_on from public.mark_payroll_period_paid('e3000000-0000-4000-8000-000000000001', date '2024-02-28', 'FT-20240228-001', 'Chuyển khoản lô 12 người')), date '2024-02-28', 'approved period is marked paid');
select is((select status || '/' || payment_reference from public.payroll_periods where id = 'e3000000-0000-4000-8000-000000000001'), 'approved/FT-20240228-001', 'status stays approved so payroll snapshots keep working; reference is stored');
select ok(exists(select 1 from public.audit_logs where action = 'payroll_period_paid' and entity_id = 'e3000000-0000-4000-8000-000000000001'), 'payment is audited');

-- Paid is final.
select throws_ok(
  $$select public.reopen_payroll_period('e3000000-0000-4000-8000-000000000001', 'Muốn sửa sau khi đã trả')$$,
  '23514', 'PAYROLL_PERIOD_ALREADY_PAID', 'a paid period cannot be reopened');
select throws_ok(
  $$select public.mark_payroll_period_paid('e3000000-0000-4000-8000-000000000001', date '2024-02-28', null, null)$$,
  '23514', 'PAYROLL_PERIOD_ALREADY_PAID', 'a paid period cannot be paid twice');

select * from finish();
rollback;
