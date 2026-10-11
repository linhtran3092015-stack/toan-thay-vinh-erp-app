begin;
select plan(18);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('2b000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase2b-manager@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.roles (id, code, name) values ('2b000000-0000-4000-8000-000000000003', 'phase2b_students', 'Phase 2b students test');
insert into public.role_permissions (role_id, permission_id)
select '2b000000-0000-4000-8000-000000000003', id from public.permissions
where code in ('classes.create', 'sessions.manage', 'students.manage_status', 'students.reserve');
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values ('2b000000-0000-4000-8000-000000000001', '2b000000-0000-4000-8000-000000000003', 'fixture');
select set_config('request.jwt.claim.sub', '2b000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('2b000000-0000-4000-8000-000000000010', '2020-2021', 'Năm học phase 2b', date '2024-08-01', date '2025-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count) values
  ('2b000000-0000-4000-8000-000000000011', '2b000000-0000-4000-8000-000000000010', 'P2B-8A', 'Phase 2b 8A', 8, 'A', 'active', 1),
  ('2b000000-0000-4000-8000-000000000012', '2b000000-0000-4000-8000-000000000010', 'P2B-8B', 'Phase 2b 8B', 8, 'B', 'active', 1),
  ('2b000000-0000-4000-8000-000000000013', '2b000000-0000-4000-8000-000000000010', 'P2B-8C', 'Phase 2b 8C', 8, 'A', 'active', 1),
  ('2b000000-0000-4000-8000-000000000014', '2b000000-0000-4000-8000-000000000010', 'P2B-8D', 'Phase 2b 8D', 8, 'A', 'active', 1);
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status) values
  ('2b000000-0000-4000-8000-000000000041', 'TV-2024-21041', 'Học sinh nghỉ', 2011, 8, 'active'),
  ('2b000000-0000-4000-8000-000000000042', 'TV-2024-21042', 'Lead quan tâm', 2011, 8, 'interested');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to)
values ('2b000000-0000-4000-8000-000000000051', '2b000000-0000-4000-8000-000000000041', '2b000000-0000-4000-8000-000000000011', 'offline', 'active', date '2024-08-01', null);

-- 1. End enrollment ---------------------------------------------------------
select throws_ok(
  $$select public.end_student_enrollment('2b000000-0000-4000-8000-000000000041', (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1, 'nghỉ từ mai')$$,
  '23514', 'END_ENROLLMENT_DATE_CANNOT_BE_FUTURE', 'the end date cannot be in the future');
select throws_ok(
  $$select public.end_student_enrollment('2b000000-0000-4000-8000-000000000041', (now() at time zone 'Asia/Ho_Chi_Minh')::date, '')$$,
  '22023', 'END_ENROLLMENT_REASON_REQUIRED', 'a reason is required');
select lives_ok(
  $$select public.end_student_enrollment('2b000000-0000-4000-8000-000000000041', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'Phụ huynh báo nghỉ hẳn')$$,
  'an active enrollment can be ended');
select is(
  (select status || ':' || effective_to::text || ':' || end_reason from public.student_enrollments where id = '2b000000-0000-4000-8000-000000000051'),
  'completed:' || (now() at time zone 'Asia/Ho_Chi_Minh')::date::text || ':Phụ huynh báo nghỉ hẳn', 'the enrollment is closed with the reason');
select is(
  (select lifecycle_status from public.students where id = '2b000000-0000-4000-8000-000000000041'),
  'withdrawn', 'the student becomes withdrawn');
select is(
  (select count(*) from public.audit_logs where action = 'student_enrollment_ended' and entity_id = '2b000000-0000-4000-8000-000000000041'),
  1::bigint, 'ending is audited per student');
select throws_ok(
  $$select public.end_student_enrollment('2b000000-0000-4000-8000-000000000041', (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'lại nghỉ')$$,
  'P0002', 'ACTIVE_STUDENT_ENROLLMENT_NOT_FOUND', 'a withdrawn student has nothing to end');

-- 2. Coming back after withdrawal uses the resume flow ------------------------
select lives_ok(
  $$select public.resume_student_enrollment('2b000000-0000-4000-8000-000000000041', '2b000000-0000-4000-8000-000000000012', 'offline', (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1, 'Quay lại học lớp 8B')$$,
  'a withdrawn student can resume in a class');
select is(
  (select lifecycle_status from public.students where id = '2b000000-0000-4000-8000-000000000041'),
  'active', 'resuming makes the student active again');
select is(
  (select transition_kind || ':' || status from public.student_enrollments where student_id = '2b000000-0000-4000-8000-000000000041' and effective_to is null),
  'resume:active', 'the new enrollment is a resume transition');

-- 3. Bulk transitions stay within pre-enrollment statuses ---------------------
select throws_ok(
  $$select public.bulk_transition_student_lifecycle_status('active', 'completed', 1, array['2b000000-0000-4000-8000-000000000041']::uuid[], 'ép hoàn thành')$$,
  '23514', 'BULK_TRANSITION_REQUIRES_ENROLLMENT_WORKFLOW', 'enrollment-bound statuses cannot be bulk-changed');
select is(
  (public.bulk_transition_student_lifecycle_status('interested', 'trial_booked', 1, array['2b000000-0000-4000-8000-000000000042']::uuid[], 'đặt lịch học thử')->>'affected_count')::integer,
  1, 'pre-enrollment statuses can be bulk-changed');
select is(
  (select count(*) from public.audit_logs where action = 'student_status_changed_in_bulk' and entity_id = '2b000000-0000-4000-8000-000000000042'),
  1::bigint, 'bulk changes are audited per student');

-- 4. Closing a class cancels its scheduled sessions ---------------------------
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status) values
  ('2b000000-0000-4000-8000-000000000061', '2b000000-0000-4000-8000-000000000013', date '2024-09-02', 'additional', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('2b000000-0000-4000-8000-000000000062', '2b000000-0000-4000-8000-000000000013', date '2024-09-09', 'additional', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('2b000000-0000-4000-8000-000000000063', '2b000000-0000-4000-8000-000000000014', date '2024-09-02', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');
select lives_ok($$select public.change_class_status('2b000000-0000-4000-8000-000000000013', 'closed', 'Kết thúc khóa')$$, 'a class without live sessions can close');
select is(
  (select count(*) from public.class_sessions where class_id = '2b000000-0000-4000-8000-000000000013' and status = 'cancelled' and cancellation_reason like 'Lớp P2B-8C đóng:%'),
  2::bigint, 'closing cancels every scheduled session with the close reason');
select is(
  (select (metadata->>'cancelled_session_count')::integer from public.audit_logs where action = 'class_scheduled_sessions_cancelled_on_close' and entity_id = '2b000000-0000-4000-8000-000000000013'),
  2, 'the cancellation count is audited');

select lives_ok($$select public.start_class_session('2b000000-0000-4000-8000-000000000063')$$, 'start a session in the other class');
select throws_ok(
  $$select public.change_class_status('2b000000-0000-4000-8000-000000000014', 'closed', 'Đóng khi đang học')$$,
  '23514', 'CLASS_HAS_SESSION_IN_PROGRESS', 'a class with a session in progress cannot close');

select * from finish();
rollback;
