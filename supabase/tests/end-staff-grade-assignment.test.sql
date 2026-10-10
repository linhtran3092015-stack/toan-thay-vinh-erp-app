begin;
select plan(11);

select ok(to_regprocedure('public.end_staff_grade_assignment(uuid, date, text)') is not null, 'end_staff_grade_assignment exists');
select ok(not has_function_privilege('anon', 'public.end_staff_grade_assignment(uuid, date, text)', 'execute'), 'anon cannot end grade assignments');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('a7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'grade-end-owner@example.test', '{}', '{"full_name":"Grade End Owner"}', now(), now()),
  ('a7000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'grade-end-ops@example.test', '{}', '{"full_name":"Grade End Ops"}', now(), now()),
  ('a7000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'grade-end-ops2@example.test', '{}', '{"full_name":"Grade End Ops Two"}', now(), now()),
  ('a7000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'grade-end-ta@example.test', '{}', '{"full_name":"Grade End TA"}', now(), now());

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select 'a7000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select 'a7000000-0000-4000-8000-000000000004', id, 'fixture' from public.roles where code = 'teaching_assistant';

insert into public.staff_payroll_position_versions (staff_id, position_code, effective_from, reason, created_by) values
  ('a7000000-0000-4000-8000-000000000002', 'operations_assistant', '2026-07-01', 'fixture', 'a7000000-0000-4000-8000-000000000001'),
  ('a7000000-0000-4000-8000-000000000003', 'operations_assistant', '2026-07-01', 'fixture', 'a7000000-0000-4000-8000-000000000001');

insert into public.staff_grade_assignments (id, staff_id, grade, effective_from, effective_to, reason, created_by) values
  ('a8000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002', 5, '2026-07-01', null, 'fixture open', 'a7000000-0000-4000-8000-000000000001'),
  ('a8000000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-000000000002', 6, '2026-07-01', '2026-08-31', 'fixture closed', 'a7000000-0000-4000-8000-000000000001');

-- Staff without staff.manage_payroll_profile is refused.
select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.end_staff_grade_assignment('a8000000-0000-4000-8000-000000000001', date '2030-01-31', 'no rights')$$,
  '42501', 'STAFF_PAYROLL_PROFILE_PERMISSION_REQUIRED', 'ending requires the payroll profile permission');

select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.end_staff_grade_assignment('a8000000-0000-4000-8000-000000000001', date '2030-01-31', '  ')$$,
  '22023', 'STAFF_GRADE_ASSIGNMENT_REASON_REQUIRED', 'a reason is required');
select throws_ok(
  $$select public.end_staff_grade_assignment('a8000000-0000-4000-8000-000000000001', date '2026-06-30', 'too early')$$,
  '22023', 'STAFF_GRADE_ASSIGNMENT_DATES_INVALID', 'end date cannot precede the start date');
select throws_ok(
  $$select public.end_staff_grade_assignment('a8000000-0000-4000-8000-000000000002', date '2030-01-31', 'already closed')$$,
  '23514', 'STAFF_GRADE_ASSIGNMENT_ALREADY_ENDED', 'a closed assignment cannot be ended again');
select throws_ok(
  $$select public.end_staff_grade_assignment('a8000000-0000-4000-8000-000000000099', date '2030-01-31', 'missing')$$,
  'P0002', 'STAFF_GRADE_ASSIGNMENT_NOT_FOUND', 'unknown assignments are reported');

-- Happy path: the open assignment closes on the chosen day and is audited.
select is(
  (select effective_to from public.end_staff_grade_assignment('a8000000-0000-4000-8000-000000000001', date '2030-01-31', 'Chuyển khối cho người khác')),
  date '2030-01-31', 'open assignment is closed on the requested date');
select is(
  (select effective_to from public.staff_grade_assignments where id = 'a8000000-0000-4000-8000-000000000001'),
  date '2030-01-31', 'end date is persisted');
select ok(
  exists(select 1 from public.audit_logs where action = 'staff_grade_assignment_ended' and entity_id = 'a8000000-0000-4000-8000-000000000001' and reason = 'Chuyển khối cho người khác'),
  'ending is audited with the reason');

-- The grade is free from the next day, so another staff member can take it over.
select lives_ok(
  $$select public.create_staff_grade_assignment('a7000000-0000-4000-8000-000000000003', 5::smallint, date '2030-02-01', null, 'Nhận khối 5')$$,
  'the freed grade can be assigned to someone else from the next day');

select * from finish();
rollback;
