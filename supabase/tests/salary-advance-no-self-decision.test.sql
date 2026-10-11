begin;
select plan(5);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('c2000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'advance-owner@example.test', '{}', '{"full_name":"Advance Owner"}', now(), now()),
  ('c2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'advance-owner-two@example.test', '{}', '{"full_name":"Advance Owner Two"}', now(), now());

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select u.id, r.id, 'fixture'
from (values ('c2000000-0000-4000-8000-000000000001'::uuid), ('c2000000-0000-4000-8000-000000000002'::uuid)) as u(id)
cross join public.roles r where r.code = 'owner';

-- Owner one has an advance of their own waiting for review.
insert into public.salary_advances (id, staff_id, amount_vnd, request_note, deduction_period_month, status, requested_by)
values ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 2000000, 'fixture', date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date + interval '1 month', 'requested', 'c2000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.review_salary_advance('c3000000-0000-4000-8000-000000000001', 'review', 'tự đối soát')$$,
  '42501', 'SALARY_ADVANCE_SELF_DECISION_FORBIDDEN', 'the requester cannot review their own advance');

-- Another owner reviews it, then the requester still cannot approve it.
select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.review_salary_advance('c3000000-0000-4000-8000-000000000001', 'review', 'đã đối chiếu')$$,
  'another person can review the advance');
select is((select status from public.salary_advances where id = 'c3000000-0000-4000-8000-000000000001'), 'review', 'advance moves to review');

select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.approve_salary_advance('c3000000-0000-4000-8000-000000000001', 'approved', 'tự duyệt')$$,
  '42501', 'SALARY_ADVANCE_SELF_DECISION_FORBIDDEN', 'the requester cannot approve their own advance');

select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.approve_salary_advance('c3000000-0000-4000-8000-000000000001', 'approved', 'duyệt')$$,
  'another owner can approve the advance');

select * from finish();
rollback;
