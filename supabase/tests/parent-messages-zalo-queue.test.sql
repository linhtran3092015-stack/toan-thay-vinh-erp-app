begin;
select plan(18);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('2f000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pm-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('2f000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pm-ta@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '2f000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '2f000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
select set_config('request.jwt.claim.sub', '2f000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('2f000000-0000-4000-8000-000000000010', '2018-2019', 'Năm học parent messages', date '2018-08-01', date '2019-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('2f000000-0000-4000-8000-000000000011', '2f000000-0000-4000-8000-000000000010', 'PM-6A', 'Parent messages 6A', 6, 'A', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status)
values ('2f000000-0000-4000-8000-000000000031', '2f000000-0000-4000-8000-000000000011', date '2018-09-03', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');
insert into public.students (id, public_code, full_name, nickname, birth_year, current_grade, lifecycle_status) values
  ('2f000000-0000-4000-8000-000000000041', 'TV-2018-30041', 'Nguyễn Văn An', 'An', 2012, 6, 'active'),
  ('2f000000-0000-4000-8000-000000000042', 'TV-2018-30042', 'Nguyễn Văn Bình', null, 2012, 6, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to) values
  ('2f000000-0000-4000-8000-000000000051', '2f000000-0000-4000-8000-000000000041', '2f000000-0000-4000-8000-000000000011', 'offline', 'active', date '2018-08-01', null),
  ('2f000000-0000-4000-8000-000000000052', '2f000000-0000-4000-8000-000000000042', '2f000000-0000-4000-8000-000000000011', 'offline', 'active', date '2018-08-01', null);

-- Settings: center nick configured, both message types on.
select lives_ok($$select public.update_system_settings('{"zalo.center_account_id":"nick-center","zalo.center_account_name":"Nick trung tâm"}'::jsonb)$$, 'owner can store the center nick');

-- 1. Linking the group -----------------------------------------------------
select set_config('request.jwt.claim.sub', '2f000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.link_student_zalo_group('2f000000-0000-4000-8000-000000000041', 'g-123', 'nick-center', 'SLL An')$$,
  '42501', 'STUDENT_UPDATE_PERMISSION_DENIED', 'linking needs students.update');
select set_config('request.jwt.claim.sub', '2f000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.link_student_zalo_group('2f000000-0000-4000-8000-000000000041', 'g-123', 'nick-center', 'SLL An')$$, 'owner links the group by thread id');
select throws_ok(
  $$select public.link_student_zalo_group('2f000000-0000-4000-8000-000000000042', 'g-123', 'nick-center', 'SLL An')$$,
  '23505', 'ZALO_GROUP_ALREADY_LINKED_TO_ANOTHER_STUDENT', 'one group cannot belong to two students');

-- 2. Attendance → absence message ------------------------------------------
select lives_ok($$select public.start_class_session('2f000000-0000-4000-8000-000000000031')$$, 'start the session');
select lives_ok($$select public.mark_session_attendance('2f000000-0000-4000-8000-000000000031', '2f000000-0000-4000-8000-000000000041', 'unexcused_absence', 'offline', null)$$, 'mark An absent');
select lives_ok($$select public.mark_session_attendance('2f000000-0000-4000-8000-000000000031', '2f000000-0000-4000-8000-000000000042', 'unexcused_absence', 'offline', null)$$, 'mark Bình absent (no group linked)');
select is(
  (select count(*) from public.parent_messages where status = 'queued' and event_code = 'attendance.unexcused_absence'),
  1::bigint, 'only the linked student gets a queued absence message');
select is(
  (select content like '%An vắng buổi học PM-6A (Parent messages 6A) ngày 03/09/2018 (18:00-19:30) không phép%' from public.parent_messages where event_code = 'attendance.unexcused_absence'),
  true, 'the absence message is rendered from the template with the nickname');
select is(
  (select thread_id || '|' || zalo_account_id from public.parent_messages where event_code = 'attendance.unexcused_absence'),
  'g-123|nick-center', 'the message targets the linked group from the center nick');

-- Fixing attendance skips the queued message.
select lives_ok($$select public.update_session_attendance((select id from public.session_attendance where student_id = '2f000000-0000-4000-8000-000000000041'), 'present', 'offline', null, 'nhầm, em có đi học')$$, 'attendance corrected to present');
select is(
  (select status from public.parent_messages where event_code = 'attendance.unexcused_absence'),
  'skipped', 'a corrected attendance skips the queued absence message');

-- 3. Session result comment → message, TA edits and sends --------------------
select lives_ok($$select public.record_session_result('2f000000-0000-4000-8000-000000000031', '2f000000-0000-4000-8000-000000000041', 8.5, null, 'not_required', 'Làm bài tốt, cần cẩn thận phép chia')$$, 'record a result with a comment');
select is(
  (select content like E'THẦY VINH VÀ THẦY CÔ CỘNG SỰ KÍNH GỬI PHỤ HUYNH NHẬN XÉT TÌNH HÌNH CỦA CON BUỔI HỌC NGÀY 03/09/2018\n\n- Tên học sinh: Nguyễn Văn An\n- Kết quả: Điểm luyện tập cuối buổi: 8,5 - Xếp hạng: Tiến bộ\n\n- Nhận xét cho học sinh:\nLàm bài tốt, cần cẩn thận phép chia\n\nChủ nhiệm CLB:%' from public.parent_messages where event_code = 'session.comment'),
  true,
  'the comment message uses the 17/10/2026 template with the comment and score');

select set_config('request.jwt.claim.sub', '2f000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.update_parent_message_content((select id from public.parent_messages where event_code = 'session.comment'), 'Nhận xét đã sửa bởi trợ giảng')$$, 'the TA can edit a queued message');
select lives_ok($$select public.record_parent_message_result((select id from public.parent_messages where event_code = 'session.comment'), true, 'zmsg-1', null)$$, 'the TA records a successful send');
select is(
  (select status || ':' || provider_message_id || ':' || attempts::text from public.parent_messages where event_code = 'session.comment'),
  'sent:zmsg-1:1', 'the message is marked sent with the provider id');
select is(
  (select count(*) from public.get_parent_message_queue('all', 50)),
  2::bigint, 'the queue reader lists both messages');

select * from finish();
rollback;
