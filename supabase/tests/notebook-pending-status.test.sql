begin;
select plan(16);

-- "Chờ chấm vở" (pending) is the default notebook status; only it locks the Zalo
-- comment message. "Chưa nộp" can be sent and says so in the message.

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3b000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'np-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3b000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'np-ta@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3b000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3b000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
select set_config('request.jwt.claim.sub', '3b000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3b000000-0000-4000-8000-000000000010', '2016-2017', 'Năm học vở chờ chấm', date '2016-08-01', date '2017-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('3b000000-0000-4000-8000-000000000011', '3b000000-0000-4000-8000-000000000010', 'NP-8A', 'Vở chờ chấm 8A', 8, 'A', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status)
values ('3b000000-0000-4000-8000-000000000031', '3b000000-0000-4000-8000-000000000011', date '2016-10-17', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');
insert into public.students (id, public_code, full_name, nickname, birth_year, current_grade, lifecycle_status) values
  ('3b000000-0000-4000-8000-000000000041', 'TV-2016-30041', 'Phạm Thu Trang', null, 2010, 8, 'active'),
  ('3b000000-0000-4000-8000-000000000042', 'TV-2016-30042', 'Đỗ Quốc Bảo', null, 2010, 8, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to)
select gen_random_uuid(), s.id, '3b000000-0000-4000-8000-000000000011', 'offline', 'active', date '2016-08-01', null
from public.students as s where s.id in ('3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000042');

select public.update_system_settings('{"zalo.center_account_id":"nick-center","zalo.center_account_name":"Nick trung tâm"}'::jsonb);
select public.link_student_zalo_group('3b000000-0000-4000-8000-000000000041', 'g-trang', 'nick-center', 'SLL Trang');
select public.link_student_zalo_group('3b000000-0000-4000-8000-000000000042', 'g-bao', 'nick-center', 'SLL Bảo');
select public.start_class_session('3b000000-0000-4000-8000-000000000031');
select public.mark_session_attendance('3b000000-0000-4000-8000-000000000031', s.id, 'present', 'offline', null)
from public.students as s where s.id in ('3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000042');

-- 1. Schema ---------------------------------------------------------------------
select col_default_is('public', 'session_results', 'notebook_status', 'pending'::text, 'new results default to "Chờ chấm vở"');

-- 2. Result RPCs ----------------------------------------------------------------
select throws_ok(
  $$select public.record_session_result(p_class_session_id => '3b000000-0000-4000-8000-000000000031', p_student_id => '3b000000-0000-4000-8000-000000000041', p_test_score => 8, p_notebook_score => 9, p_notebook_status => 'pending', p_comment => null)$$,
  '22023', 'NOTEBOOK_SCORE_NOT_ALLOWED', 'a notebook waiting to be graded cannot carry a score');
select throws_ok(
  $$select public.record_session_result(p_class_session_id => '3b000000-0000-4000-8000-000000000031', p_student_id => '3b000000-0000-4000-8000-000000000041', p_notebook_status => 'graded')$$,
  '22023', 'NOTEBOOK_STATUS_INVALID', 'unknown notebook statuses are still rejected');
select lives_ok(
  $$select public.record_session_result(p_class_session_id => '3b000000-0000-4000-8000-000000000031', p_student_id => '3b000000-0000-4000-8000-000000000041', p_test_score => 8, p_comment => 'Con làm bài cẩn thận.')$$,
  'recording a result without a notebook status is accepted');
select is(
  (select notebook_status from public.session_results where student_id = '3b000000-0000-4000-8000-000000000041'),
  'pending', 'the RPC default is "Chờ chấm vở"');
select throws_ok(
  $$update public.session_results set notebook_score = 9 where student_id = '3b000000-0000-4000-8000-000000000041'$$,
  '23514', null, 'the table rejects a score on a pending notebook');

-- 3. Message and send lock ----------------------------------------------------
select set_config('request.jwt.claim.sub', '3b000000-0000-4000-8000-000000000002', true);
select public.set_session_message_contact('3b000000-0000-4000-8000-000000000031', 'Cô Lan', '0912 345 678');
select is(
  (select send_block_reason from public.get_parent_message_queue('queued', 50) where student_id = '3b000000-0000-4000-8000-000000000041'),
  'Chưa chấm vở', 'a pending notebook locks Gửi');
select is(
  (select content like E'%- Kết quả: Điểm luyện tập cuối buổi: 8 - Xếp hạng: Tiến bộ\n%' from public.parent_messages where student_id = '3b000000-0000-4000-8000-000000000041' and event_code = 'session.comment'),
  true, 'a pending notebook hides the notebook part of the message');

select set_config('request.jwt.claim.sub', '3b000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.update_session_result((select id from public.session_results where student_id = '3b000000-0000-4000-8000-000000000041'), 8, null, 'not_submitted', 'Con làm bài cẩn thận.', 'con không nộp vở')$$,
  'a result can move from pending to "Chưa nộp"');
select is(
  (select content like E'%- Kết quả: Điểm luyện tập cuối buổi: 8 - Điểm vở: Chưa nộp vở - Xếp hạng: Tiến bộ\n%' from public.parent_messages where student_id = '3b000000-0000-4000-8000-000000000041' and event_code = 'session.comment'),
  true, 'a notebook that was not handed in reads "Điểm vở: Chưa nộp vở"');
select is(
  (select send_block_reason from public.get_parent_message_queue('queued', 50) where student_id = '3b000000-0000-4000-8000-000000000041'),
  null, '"Chưa nộp" can be sent');

select lives_ok(
  $$select public.update_session_result((select id from public.session_results where student_id = '3b000000-0000-4000-8000-000000000041'), 8, null, 'pending', 'Con làm bài cẩn thận.', 'tìm thấy vở, chờ chấm')$$,
  'update_session_result accepts "Chờ chấm vở"');
select is(
  (select send_block_reason from public.get_parent_message_queue('queued', 50) where student_id = '3b000000-0000-4000-8000-000000000041'),
  'Chưa chấm vở', 'moving back to pending locks Gửi again');

select public.record_session_result('3b000000-0000-4000-8000-000000000031', '3b000000-0000-4000-8000-000000000042', 6, 7.5, 'submitted', 'Con cần luyện thêm.');
select is(
  (select content like E'%- Kết quả: Điểm luyện tập cuối buổi: 6 - Điểm vở: 7,5 - Xếp hạng: Tiến bộ vừa\n%' from public.parent_messages where student_id = '3b000000-0000-4000-8000-000000000042' and event_code = 'session.comment'),
  true, 'a graded notebook shows its score');
select is(
  (select send_block_reason from public.get_parent_message_queue('queued', 50) where student_id = '3b000000-0000-4000-8000-000000000042'),
  null, 'a graded notebook can be sent');

-- 4. The parent-message trigger is back on after the data migration ------------
select is(
  (select tgenabled::text from pg_catalog.pg_trigger where tgname = 'session_results_parent_message'),
  'O', 'the session_results parent-message trigger is enabled');

select * from finish();
rollback;
