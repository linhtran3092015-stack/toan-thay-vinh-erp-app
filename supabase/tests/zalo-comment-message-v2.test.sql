begin;
select plan(59);

-- Fixtures: owner, teaching assistant, a signed-in account with no role.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'zt-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'zt-ta@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3a000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'zt-norole@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3a000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'zt-ta2@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3a000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select user_id::uuid, id, 'fixture' from public.roles cross join (values ('3a000000-0000-4000-8000-000000000002'), ('3a000000-0000-4000-8000-000000000004')) as t(user_id)
where code = 'teaching_assistant';
select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3a000000-0000-4000-8000-000000000010', '2017-2018', 'Năm học tin Zalo mới', date '2017-08-01', date '2018-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('3a000000-0000-4000-8000-000000000011', '3a000000-0000-4000-8000-000000000010', 'ZT-8A', 'Zalo template 8A', 8, 'A', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status)
values ('3a000000-0000-4000-8000-000000000031', '3a000000-0000-4000-8000-000000000011', date '2017-10-17', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');
insert into public.students (id, public_code, full_name, nickname, birth_year, current_grade, lifecycle_status) values
  ('3a000000-0000-4000-8000-000000000041', 'TV-2017-30041', 'Nguyễn Minh Anh', 'Anh', 2010, 8, 'active'),
  ('3a000000-0000-4000-8000-000000000042', 'TV-2017-30042', 'Trần Bảo Châu', null, 2010, 8, 'active'),
  ('3a000000-0000-4000-8000-000000000043', 'TV-2017-30043', 'Lê Gia Huy', null, 2010, 8, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to)
select gen_random_uuid(), s.id, '3a000000-0000-4000-8000-000000000011', 'offline', 'active', date '2017-08-01', null
from public.students as s where s.id in ('3a000000-0000-4000-8000-000000000041', '3a000000-0000-4000-8000-000000000042', '3a000000-0000-4000-8000-000000000043');

select public.update_system_settings('{"zalo.center_account_id":"nick-center","zalo.center_account_name":"Nick trung tâm"}'::jsonb);
select public.link_student_zalo_group('3a000000-0000-4000-8000-000000000041', 'g-anh', 'nick-center', 'SLL Anh');
select public.link_student_zalo_group('3a000000-0000-4000-8000-000000000042', 'g-chau', 'nick-center', 'SLL Châu');
select public.link_student_zalo_group('3a000000-0000-4000-8000-000000000043', 'g-huy', 'nick-center', 'SLL Huy');
select public.start_class_session('3a000000-0000-4000-8000-000000000031');
select public.mark_session_attendance('3a000000-0000-4000-8000-000000000031', s.id, 'present', 'offline', null)
from public.students as s where s.id in ('3a000000-0000-4000-8000-000000000041', '3a000000-0000-4000-8000-000000000042', '3a000000-0000-4000-8000-000000000043');

-- 1. Default template and renderer -------------------------------------------
select is(
  (select value #>> '{}' from public.system_settings where key = 'zalo.comment_template'),
  E'THẦY VINH VÀ THẦY CÔ CỘNG SỰ KÍNH GỬI PHỤ HUYNH NHẬN XÉT TÌNH HÌNH CỦA CON BUỔI HỌC NGÀY {date}\n\n- Tên học sinh: {student_full_name}\n- Kết quả: Điểm luyện tập cuối buổi: {test_score} - Điểm vở: {notebook_score} - Xếp hạng: {rank}\n\n- Bài làm của học sinh:\n{answer_text}\n\n- Bài chữa chi tiết của thầy cô:\n{solution}\n\n- Nhận xét cho học sinh:\n{comment}\n\n{footer}',
  'the 17/10/2026 template replaces the one-line comment template');
select is(
  (select pg_catalog.length(value #>> '{}') from public.system_settings where key = 'zalo.comment_footer') > 0
    and (select value #>> '{}' from public.system_settings where key = 'zalo.comment_footer') like E'Chủ nhiệm CLB: Thầy Lã Quang Vinh\nTrợ giảng Giám thị: {supervisor_name}\nSĐT thắc mắc bài chấm: {grading_contact_phone}\n%',
  true, 'the default footer is seeded with the supervisor placeholders');
-- Same input and expected text as "hides the answer and solution sections…" in tests/unit/zalo-comment-message.test.ts.
select is(
  public.render_comment_message(
    public.system_setting_text('zalo.comment_template', ''),
    public.system_setting_text('zalo.comment_footer', ''),
    '{"answer_text":"","center":"Trung tâm Toán Thầy Vinh","class":"8A1 (Lớp 8 nâng cao)","comment":"Con làm bài cẩn thận, cần trình bày rõ hơn.","date":"17/10/2026","grading_contact_phone":"0912 345 678","notebook_score":"9","rank":"Tiến bộ","scores":"","solution":"","student":"Anh","student_full_name":"Nguyễn Minh Anh","supervisor_name":"Cô Lan","test_score":"8,5","time":"18:00-19:30"}'::jsonb),
  E'THẦY VINH VÀ THẦY CÔ CỘNG SỰ KÍNH GỬI PHỤ HUYNH NHẬN XÉT TÌNH HÌNH CỦA CON BUỔI HỌC NGÀY 17/10/2026\n\n- Tên học sinh: Nguyễn Minh Anh\n- Kết quả: Điểm luyện tập cuối buổi: 8,5 - Điểm vở: 9 - Xếp hạng: Tiến bộ\n\n- Nhận xét cho học sinh:\nCon làm bài cẩn thận, cần trình bày rõ hơn.\n\nChủ nhiệm CLB: Thầy Lã Quang Vinh\nTrợ giảng Giám thị: Cô Lan\nSĐT thắc mắc bài chấm: 0912 345 678\nSĐT các thầy cô hỗ trợ:\n   Thầy Linh: 077 88878 64\n   Thầy Phương: 093 698 4828\n   Cô Huyền: 036 356 0088\n   Thầy Cô Trực Văn Phòng (18h-22h30 hàng ngày): 086 989 0233\n\n- SĐT phản ánh nếu PH,HS không được hỗ trợ: Thầy Vinh 09666 49198',
  'the SQL renderer hides empty sections exactly like the TypeScript copy');
select is(
  public.render_comment_message(E'Ngày {date} - {unknown}\n- Nhận xét:\n{comment}\n\n{footer}', '', '{"date":"17/10/2026","comment":"Con viết {date} - chưa đúng"}'::jsonb),
  E'Ngày 17/10/2026 - {unknown}\n- Nhận xét:\nCon viết {date} - chưa đúng',
  'values are substituted once; unknown placeholders stay as typed');

-- 2. Rank bands ---------------------------------------------------------------
select is(
  (select pg_catalog.string_agg(min_score::text || '=' || label, ', ' order by min_score) from public.grading_rank_bands),
  '0.00=Tiến bộ ít, 5.00=Tiến bộ vừa, 8.00=Tiến bộ, 9.00=Tiến bộ nhiều, 10.00=Rất tiến bộ',
  'the default rank bands are seeded');
select is(
  pg_catalog.array_to_string(array[public.grading_rank_label(8.5), public.grading_rank_label(4.99), public.grading_rank_label(5), public.grading_rank_label(10)], '|'),
  'Tiến bộ|Tiến bộ ít|Tiến bộ vừa|Rất tiến bộ',
  'decimal manual scores rank by range');
select is(public.grading_rank_label(null), null, 'no score, no rank');

select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.set_grading_rank_bands('[{"min_score":0,"label":"Ít"}]'::jsonb)$$,
  '42501', 'SYSTEM_SETTINGS_PERMISSION_DENIED', 'a teaching assistant cannot change the rank bands');
set local role authenticated;
select is((select count(*) from public.grading_rank_bands), 5::bigint, 'a teaching assistant (results.view) can read the rank bands');
select throws_ok($$insert into public.grading_rank_bands (min_score, label) values (7, 'Khá')$$, '42501', null, 'rank bands have no direct writes');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.grading_rank_bands$$, '42501', null, 'anon cannot read the rank bands');
reset role;

select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.set_grading_rank_bands('[{"min_score":5,"label":"Vừa"}]'::jsonb)$$,
  '22023', 'GRADING_RANK_BANDS_NEED_ZERO', 'the scale must start at 0');
select throws_ok(
  $$select public.set_grading_rank_bands('[{"min_score":0,"label":"Ít"},{"min_score":0,"label":"Trùng"}]'::jsonb)$$,
  '22023', 'GRADING_RANK_BANDS_INVALID', 'duplicate band starts are rejected');
select throws_ok(
  $$select public.set_grading_rank_bands('[{"min_score":0,"label":"Ít"},{"min_score":11,"label":"Quá"}]'::jsonb)$$,
  '22023', 'GRADING_RANK_BANDS_INVALID', 'a band above 10 is rejected');

-- 3. Owner-only template settings --------------------------------------------
select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.update_system_settings('{"zalo.comment_footer":"Liên hệ"}'::jsonb)$$,
  '42501', 'SYSTEM_SETTINGS_PERMISSION_DENIED', 'a teaching assistant cannot edit the footer');
select throws_ok(
  $$select public.update_system_settings('{"zalo.comment_template":"{comment}"}'::jsonb)$$,
  '42501', 'SYSTEM_SETTINGS_PERMISSION_DENIED', 'a teaching assistant cannot edit the comment template');
select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000001', true);
select throws_ok(
  format($$select public.update_system_settings(%L::jsonb)$$, pg_catalog.jsonb_build_object('zalo.comment_template', pg_catalog.repeat('a', 3001))),
  '22023', 'SYSTEM_SETTINGS_INVALID_VALUE', 'the comment template is capped at 3.000 characters');
select throws_ok(
  format($$select public.update_system_settings(%L::jsonb)$$, pg_catalog.jsonb_build_object('zalo.comment_footer', pg_catalog.repeat('a', 1501))),
  '22023', 'SYSTEM_SETTINGS_INVALID_VALUE', 'the footer is capped at 1.500 characters');
select lives_ok(
  format($$select public.update_system_settings(%L::jsonb)$$, pg_catalog.jsonb_build_object('zalo.comment_template', pg_catalog.repeat('a', 2990) || ' {comment}')),
  'a long template within the cap is accepted');
-- Back to the default template for the flow below.
select public.update_system_settings(pg_catalog.jsonb_build_object('zalo.comment_template',
  E'THẦY VINH VÀ THẦY CÔ CỘNG SỰ KÍNH GỬI PHỤ HUYNH NHẬN XÉT TÌNH HÌNH CỦA CON BUỔI HỌC NGÀY {date}\n\n- Tên học sinh: {student_full_name}\n- Kết quả: Điểm luyện tập cuối buổi: {test_score} - Điểm vở: {notebook_score} - Xếp hạng: {rank}\n\n- Bài làm của học sinh:\n{answer_text}\n\n- Bài chữa chi tiết của thầy cô:\n{solution}\n\n- Nhận xét cho học sinh:\n{comment}\n\n{footer}'));

-- 4. Session result → message, send lock -------------------------------------
select public.record_session_result('3a000000-0000-4000-8000-000000000031', '3a000000-0000-4000-8000-000000000041', 8.5, null, 'pending', 'Con làm bài cẩn thận.');
select is(
  (select content like E'%- Kết quả: Điểm luyện tập cuối buổi: 8,5 - Xếp hạng: Tiến bộ\n\n- Nhận xét cho học sinh:\nCon làm bài cẩn thận.\n\nChủ nhiệm CLB: Thầy Lã Quang Vinh\nSĐT các thầy cô hỗ trợ:%'
   from public.parent_messages where dedupe_key like 'session.comment:%' and student_id = '3a000000-0000-4000-8000-000000000041'),
  true, 'without notebook score and supervisor the message hides those parts');
select is(
  (select send_block_reason from public.get_parent_message_queue('queued', 50) where student_id = '3a000000-0000-4000-8000-000000000041'),
  'Chưa chấm vở; Chưa điền trợ giảng giám thị', 'the queue explains why sending is locked');

select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.begin_parent_message_send((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 1)$$,
  '23514', 'PARENT_MESSAGE_SEND_BLOCKED', 'sending is blocked until the notebook score and supervisor exist');

-- Contacts RPC.
select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.set_session_message_contact('3a000000-0000-4000-8000-000000000031', 'Cô Lan', '0912 345 678')$$,
  '42501', 'ATTENDANCE_MARK_PERMISSION_DENIED', 'an account without attendance.mark cannot fill the supervisor');
select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.set_session_message_contact('3a000000-0000-4000-8000-000000000031', 'Cô Lan', '12ab')$$,
  '22023', 'SESSION_MESSAGE_CONTACT_PHONE_INVALID', 'a phone needs 8–15 digits');
select throws_ok(
  $$select public.set_session_message_contact('3a000000-0000-4000-8000-000000000031', '   ', '0912 345 678')$$,
  '22023', 'SESSION_MESSAGE_CONTACT_NAME_INVALID', 'the supervisor name is required');
select throws_ok(
  $$select public.set_session_message_contact('3a000000-0000-4000-8000-0000000000ff', 'Cô Lan', '0912 345 678')$$,
  'P0002', 'SESSION_NOT_FOUND', 'the session must exist');
select lives_ok(
  $$select public.set_session_message_contact('3a000000-0000-4000-8000-000000000031', '  Cô   Lan ', ' 0912 345 678 ')$$,
  'a teaching assistant fills the supervisor and phone');
select is(
  (select supervisor_name || '|' || grading_contact_phone || '|' || updated_by::text from public.session_message_contacts where class_session_id = '3a000000-0000-4000-8000-000000000031'),
  'Cô Lan|0912 345 678|3a000000-0000-4000-8000-000000000002', 'the contact is normalised and records who filled it');
set local role authenticated;
select is((select count(*) from public.session_message_contacts), 1::bigint, 'staff with attendance.mark read the contacts (prefill)');
select throws_ok($$delete from public.session_message_contacts$$, '42501', null, 'contacts have no direct writes');
reset role;
select is(
  (select content like E'%Trợ giảng Giám thị: Cô Lan\nSĐT thắc mắc bài chấm: 0912 345 678\n%' from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'),
  true, 'filling the supervisor re-renders the queued message');
select is(
  (select send_block_reason from public.get_parent_message_queue('queued', 50) where student_id = '3a000000-0000-4000-8000-000000000041'),
  'Chưa chấm vở', 'only the notebook score is still missing');

-- Notebook score arrives later: the queued message updates and unlocks.
select public.update_session_result((select id from public.session_results where student_id = '3a000000-0000-4000-8000-000000000041'), 8.5, 9, 'submitted', 'Con làm bài cẩn thận.', 'chấm vở xong');
select is(
  (select content like E'%- Kết quả: Điểm luyện tập cuối buổi: 8,5 - Điểm vở: 9 - Xếp hạng: Tiến bộ\n%' from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'),
  true, 'a later notebook score updates the queued message');
select is(
  (select send_block_reason from public.get_parent_message_queue('queued', 50) where student_id = '3a000000-0000-4000-8000-000000000041'),
  null, 'the message can be sent once the notebook score and supervisor exist');

-- 5. Multi-part send and resume ----------------------------------------------
select throws_ok(
  $$select public.begin_parent_message_send((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 4)$$,
  '22023', 'PARENT_MESSAGE_TOO_LONG', 'more than three parts cannot be sent');
select throws_ok(
  $$select public.begin_parent_message_send((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 2, md5('văn bản cũ'))$$,
  '40001', 'PARENT_MESSAGE_CONTENT_CHANGED', 'a send split from text that changed since is refused');
select is(
  (select status || '|' || (sending_until is null)::text from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'),
  'queued|true', 'a refused start leaves the message queued and unlocked');
select lives_ok(
  $$select public.begin_parent_message_send(m.id, 2, md5(m.content)) from public.parent_messages as m where m.student_id = '3a000000-0000-4000-8000-000000000041' and m.event_code = 'session.comment'$$,
  'the teaching assistant starts a two-part send');
select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.begin_parent_message_send((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 2)$$,
  '55P03', 'PARENT_MESSAGE_SENDING', 'a second sender cannot start while the first is sending');
select throws_ok(
  $$select public.record_parent_message_part((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 1, true, 'z-x', null)$$,
  '55P03', 'PARENT_MESSAGE_NOT_SENDING', 'only the sender records parts');
select throws_ok(
  $$select public.update_parent_message_content((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 'Sửa giữa chừng')$$,
  '55P03', 'PARENT_MESSAGE_SENDING', 'the text cannot change while it is being sent');
select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.record_parent_message_part((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 2, true, 'z-2', null)$$,
  '22023', 'PARENT_MESSAGE_PART_OUT_OF_ORDER', 'parts are recorded in order');
select lives_ok(
  $$select public.record_parent_message_part((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 1, true, 'z-1', null)$$,
  'part 1 is recorded');
select lives_ok(
  $$select public.record_parent_message_part((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 2, false, null, 'ZaloCRM 502')$$,
  'part 2 fails');
select is(
  (select status || '|' || parts_sent || '/' || parts_total || '|' || pg_catalog.array_to_string(provider_message_ids, ',') || '|' || error_message || '|' || (sending_until is null)::text
   from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'),
  'failed|1/2|z-1|Phần 2/2: ZaloCRM 502|true', 'a failed part keeps the parts already sent');
select throws_ok(
  $$select public.record_parent_message_result((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), true, 'z-legacy', null)$$,
  '23514', 'PARENT_MESSAGE_USE_PARTS', 'the pre-0.21 RPC cannot mark a multi-part send as sent');

-- A partly sent message is frozen: result edits no longer change it.
select public.update_session_result((select id from public.session_results where student_id = '3a000000-0000-4000-8000-000000000041'), 8.5, 9, 'submitted', 'Nhận xét đã đổi.', 'sửa nhận xét');
select is(
  (select content like '%Con làm bài cẩn thận.%' from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'),
  true, 'a partly sent message keeps the text its first part came from');
select throws_ok(
  $$select public.begin_parent_message_send((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 3)$$,
  '23514', 'PARENT_MESSAGE_PARTS_CHANGED', 'a resume must use the same split');
select lives_ok(
  $$select public.begin_parent_message_send((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 2)$$,
  'the retry resumes the send');
select is(
  (select parts_sent from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'),
  1, 'the retry starts after the part already sent');
select lives_ok(
  $$select public.record_parent_message_part((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'), 2, true, 'z-2', null)$$,
  'part 2 is recorded on retry');
select is(
  (select status || '|' || parts_sent || '/' || parts_total || '|' || pg_catalog.array_to_string(provider_message_ids, ',') || '|' || provider_message_id || '|' || attempts || '|' || (error_message is null)::text
   from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000041' and event_code = 'session.comment'),
  'sent|2/2|z-1,z-2|z-1|2|true', 'the message is sent once with both provider ids in order');

-- 6. Other rules ---------------------------------------------------------------
-- "Không yêu cầu vở" does not lock the message; content limit is 6.000 characters.
select public.record_session_result('3a000000-0000-4000-8000-000000000031', '3a000000-0000-4000-8000-000000000042', 7, null, 'not_required', 'Con cần luyện thêm.');
select is(
  (select send_block_reason from public.get_parent_message_queue('queued', 50) where student_id = '3a000000-0000-4000-8000-000000000042'),
  null, 'a result whose notebook is not required can be sent');
select lives_ok(
  format($$select public.update_parent_message_content((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000042'), %L)$$, pg_catalog.repeat('a', 6000)),
  'a teaching assistant can save a 6.000-character message');
select throws_ok(
  format($$select public.update_parent_message_content((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000042'), %L)$$, pg_catalog.repeat('a', 6001)),
  '22023', 'PARENT_MESSAGE_CONTENT_INVALID', 'more than 6.000 characters is rejected');

-- An owner template change re-renders queued messages that nobody edited by hand.
select public.record_session_result('3a000000-0000-4000-8000-000000000031', '3a000000-0000-4000-8000-000000000043', 10, 10, 'submitted', 'Con làm tốt.');
-- A send that failed before any part went out stays refreshable and editable.
select public.begin_parent_message_send((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000043'), 1);
select public.record_parent_message_part((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000043'), 1, false, null, 'ZaloCRM 503');
select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000001', true);
select public.update_system_settings('{"zalo.comment_template":"Nhận xét {date} cho {student_full_name}: {comment} ({rank})"}'::jsonb);
select is(
  (select content from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000043'),
  'Nhận xét 17/10/2017 cho Lê Gia Huy: Con làm tốt. (Rất tiến bộ)', 'a template change updates unedited messages not yet sent, including a failed one');
select is(
  (select status from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000043'),
  'failed', 'the refreshed message keeps its failed status for Gửi lại');
select lives_ok(
  $$select public.update_parent_message_content((select id from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000043'), 'Sửa trước khi gửi lại')$$,
  'a failed message with nothing sent can still be edited');
select is(
  (select content from public.parent_messages where student_id = '3a000000-0000-4000-8000-000000000042'),
  pg_catalog.repeat('a', 6000), 'a hand-edited message keeps its text');

select * from finish();
rollback;
