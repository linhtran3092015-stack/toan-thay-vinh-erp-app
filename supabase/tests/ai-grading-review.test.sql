begin;
select plan(46);

-- Fixtures: owner, TA, accountant (no AI review). Grade-3 class, session S1 started; students
-- A and B present, C absent; every student has a Zalo group so comment messages are queued.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3f000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ar-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3f000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ar-ta@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3f000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'ar-accountant@example.test', '{"provider":"email"}', '{}', now(), now());
update public.profiles set display_name = 'Cô Ngọc' where id = '3f000000-0000-4000-8000-000000000002';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3f000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3f000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3f000000-0000-4000-8000-000000000003', id, 'fixture' from public.roles where code = 'accountant';
select set_config('request.jwt.claim.sub', '3f000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3f000000-0000-4000-8000-000000000010', '2016-2017', 'Năm học duyệt AI', date '2016-08-01', date '2017-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('3f000000-0000-4000-8000-000000000011', '3f000000-0000-4000-8000-000000000010', 'AR-3A', 'Review 3A', 3, 'A', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status)
values ('3f000000-0000-4000-8000-000000000031', '3f000000-0000-4000-8000-000000000011', date '2016-10-17', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');
insert into public.students (id, public_code, full_name, nickname, birth_year, current_grade, lifecycle_status) values
  ('3f000000-0000-4000-8000-000000000041', 'TV-2016-80041', 'Học Sinh A', null, 2018, 3, 'active'),
  ('3f000000-0000-4000-8000-000000000042', 'TV-2016-80042', 'Học Sinh B', null, 2018, 3, 'active'),
  ('3f000000-0000-4000-8000-000000000043', 'TV-2016-80043', 'Học Sinh C', null, 2018, 3, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to)
select gen_random_uuid(), s.id, '3f000000-0000-4000-8000-000000000011', 'offline', 'active', date '2016-08-01', null
from public.students as s where s.id::text like '3f000000-0000-4000-8000-00000000004%';

select public.update_system_settings('{"zalo.center_account_id":"nick-center","zalo.center_account_name":"Nick trung tâm"}'::jsonb);
select public.link_student_zalo_group(s.id, 'g-' || s.public_code, 'nick-center', 'SLL ' || s.full_name)
from public.students as s where s.id::text like '3f000000-0000-4000-8000-00000000004%';
select public.start_class_session('3f000000-0000-4000-8000-000000000031');
select public.mark_session_attendance('3f000000-0000-4000-8000-000000000031', '3f000000-0000-4000-8000-000000000041', 'present', 'offline', null);
select public.mark_session_attendance('3f000000-0000-4000-8000-000000000031', '3f000000-0000-4000-8000-000000000042', 'present', 'offline', null);
select public.mark_session_attendance('3f000000-0000-4000-8000-000000000031', '3f000000-0000-4000-8000-000000000043', 'unexcused_absence', 'offline', null);

create temporary table keys (name text primary key, key jsonb) on commit drop;
insert into keys values ('valid', '{"questions": [
  {"label": "13", "prompt_text": "x - 18 = 36", "max_points": 2, "final_answer": "x = 54", "accepted_equivalents": [], "solution_steps": ["x = 36 + 18", "x = 54"]},
  {"label": "14", "prompt_text": "", "max_points": 2, "final_answer": "x = 8", "accepted_equivalents": [], "solution_steps": []},
  {"label": "15", "prompt_text": "", "max_points": 2, "final_answer": "x = 257", "accepted_equivalents": [], "solution_steps": []},
  {"label": "16", "prompt_text": "", "max_points": 2, "final_answer": "7 cm", "accepted_equivalents": [], "solution_steps": []},
  {"label": "17", "prompt_text": "", "max_points": 2, "final_answer": "12 cm", "accepted_equivalents": [], "solution_steps": []}
]}');
create temporary table ids (name text primary key, id uuid) on commit drop;

insert into ids select 'test', public.create_session_test('3f000000-0000-4000-8000-000000000031');
select public.confirm_session_test_key((select id from ids where name = 'test'), 'Đề lớp 3', '', (select key from keys where name = 'valid'), 0);

-- Submissions: A twice (the second counts), B once, C once.
insert into ids select 'subA1', submission_id from public.record_grading_submission(
  'ar-a1-0001', timestamptz '2016-10-17 19:20+07', '13. 17', false, 'TV-2016-80041', 'Học Sinh A', 2018::smallint,
  '3f000000-0000-4000-8000-000000000031', null, null, null, '3f000000-0000-4000-8000-000000000041',
  '3f000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
insert into ids select 'subA', submission_id from public.record_grading_submission(
  'ar-a2-0001', timestamptz '2016-10-17 19:25+07', E'13. 18\n14. 8\n15. 257\n16. 7cm\n17. 12cm', false, 'TV-2016-80041', 'Học Sinh A', 2018::smallint,
  '3f000000-0000-4000-8000-000000000031', null, null, null, '3f000000-0000-4000-8000-000000000041',
  '3f000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
insert into ids select 'subB', submission_id from public.record_grading_submission(
  'ar-b1-0001', timestamptz '2016-10-17 19:21+07', '13. 54 14. 8 15. 257 16. 7 17. 12', false, 'TV-2016-80042', 'Học Sinh B', 2018::smallint,
  '3f000000-0000-4000-8000-000000000031', null, null, null, '3f000000-0000-4000-8000-000000000042',
  '3f000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
insert into ids select 'subC', submission_id from public.record_grading_submission(
  'ar-c1-0001', timestamptz '2016-10-17 19:22+07', '13. 54', false, 'TV-2016-80043', 'Học Sinh C', 2018::smallint,
  '3f000000-0000-4000-8000-000000000031', null, null, null, '3f000000-0000-4000-8000-000000000043',
  '3f000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');

-- AI results (as the worker would write them): A green with question 13 wrong.
update public.grading_submissions
set ai_color = 'green', ai_raw_score = 8, ai_answer_key_version = 1, ai_graded_at = now(), ai_confidence = 'high',
    ai_question_results = '[{"label": "13", "verdict": "incorrect", "extracted_final_answer": "18"}]'
where id = (select id from ids where name = 'subA');

-- B already has a notebook score typed by the owner.
select public.record_session_result('3f000000-0000-4000-8000-000000000031', '3f000000-0000-4000-8000-000000000042', null, 8, 'submitted', null);

-- 1. Structure ---------------------------------------------------------------------------
select is(
  (select array_agg(role.code order by role.code) from public.role_permissions as grant_row
   join public.roles as role on role.id = grant_row.role_id
   join public.permissions as permission on permission.id = grant_row.permission_id
   where permission.code = 'ai_grading.review'),
  array['assistant_manager', 'operations_manager', 'owner', 'teaching_assistant'],
  'ai_grading.review goes to owner, both managers and TAs');
select is((select count(*)::integer from public.grading_comment_phrases where active), 16, 'the demo phrases are seeded (appendix A)');
select ok((select relrowsecurity from pg_class where oid = 'public.grading_comment_phrases'::regclass), 'RLS is on for the phrases');
select ok(
  has_function_privilege('authenticated', 'public.approve_grading_submission(uuid, jsonb, boolean, text, integer, text)', 'execute')
  and has_function_privilege('authenticated', 'public.set_grading_praise_bonus(uuid, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.skip_grading_submission(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.regrade_grading_submission(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.approve_grading_submission(uuid, jsonb, boolean, text, integer, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.lock_reviewable_submission(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.enqueue_submission_grading(uuid, boolean)', 'execute'),
  'review RPCs are for signed-in staff; helpers are internal');
select is(
  array[public.grading_round_half_up(7.5), public.grading_round_half_up(7.25), public.grading_round_half_up(4.5), public.grading_round_half_up(0)],
  array[8, 7, 5, 0], 'scores round to a whole number, .5 up');
select is(
  public.session_test_solution_text((select key from keys where name = 'valid')),
  E'Câu 13 (đáp án x = 54):\nx = 36 + 18\nx = 54\nCâu 14 (đáp án x = 8)\nCâu 15 (đáp án x = 257)\nCâu 16 (đáp án 7 cm)\nCâu 17 (đáp án 12 cm)',
  'the solution lists every question with its answer and steps');

-- 2. Guards ------------------------------------------------------------------------------
create temporary table verdicts (name text primary key, value jsonb) on commit drop;
insert into verdicts values
  ('a', '{"13": "incorrect", "14": "correct", "15": "correct", "16": "correct", "17": "correct"}'),
  ('all', '{"13": "correct", "14": "correct", "15": "correct", "16": "correct", "17": "correct"}'),
  ('short', '{"13": "correct", "14": "correct"}');

select set_config('request.jwt.claim.sub', '3f000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select * from public.approve_grading_submission((select id from ids where name = 'subA'), (select value from verdicts where name = 'a'), false, 'Nhận xét', 1)$$,
  '42501', 'AI_GRADING_REVIEW_PERMISSION_DENIED', 'an accountant cannot approve');
select set_config('request.jwt.claim.sub', '3f000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select * from public.approve_grading_submission((select id from ids where name = 'subA'), (select value from verdicts where name = 'a'), false, 'Nhận xét', 2)$$,
  '40001', 'GRADING_KEY_VERSION_CHANGED', 'approving against another key version is refused');
select throws_ok(
  $$select * from public.approve_grading_submission((select id from ids where name = 'subA'), (select value from verdicts where name = 'short'), false, 'Nhận xét', 1)$$,
  '22023', 'GRADING_VERDICTS_INVALID', 'every question needs a verdict');
select throws_ok(
  $$select * from public.approve_grading_submission((select id from ids where name = 'subA'), (select value from verdicts where name = 'a'), false, '   ', 1)$$,
  '22023', 'GRADING_FEEDBACK_INVALID', 'the comment cannot be empty');
select throws_ok(
  $$select * from public.approve_grading_submission((select id from ids where name = 'subA1'), (select value from verdicts where name = 'a'), false, 'Nhận xét', 1)$$,
  '55000', 'GRADING_SUBMISSION_NOT_CURRENT', 'an earlier attempt cannot be approved');
select throws_ok(
  $$select * from public.approve_grading_submission((select id from ids where name = 'subC'), (select value from verdicts where name = 'all'), false, 'Nhận xét', 1)$$,
  '23514', 'ABSENT_STUDENT_CANNOT_HAVE_SESSION_RESULT', 'an absent student cannot get a result (fix attendance first)');

-- 3. Approving ---------------------------------------------------------------------------
select is(
  (select array[paper_score, final_score]::text[] || rank_label from public.approve_grading_submission(
    (select id from ids where name = 'subA'), (select value from verdicts where name = 'a'), true,
    E'Hôm nay con được cộng 1 điểm vì tích cực tương tác (điểm bài làm 8, sau khi cộng là 9).\nCon làm đúng 4/5 câu.', 1)),
  array['8', '9', 'Tiến bộ nhiều'], 'A: 8 points, +1 for participation, final 9 ranked "Tiến bộ nhiều"');
select is(
  (select array[test_score::text, test_bonus_points::text, notebook_status, (graded_by = '3f000000-0000-4000-8000-000000000002')::text, (ai_submission_id = (select id from ids where name = 'subA'))::text]
   from public.session_results where class_session_id = '3f000000-0000-4000-8000-000000000031' and student_id = '3f000000-0000-4000-8000-000000000041'),
  array['9.00', '1', 'pending', 'true', 'true'], 'the session result gets the final score, the bonus mark and the reviewer as grader');
select is(
  (select array[review_status, final_score::text, paper_score::text, (session_result_id is not null)::text, review_answer_key_version::text]
   from public.grading_submissions where id = (select id from ids where name = 'subA')),
  array['approved', '9', '8', 'true', '1'], 'the submission is approved and linked to the result');
select ok(
  exists (select 1 from public.audit_logs where action = 'grading_submission_approved' and entity_id = (select id::text from ids where name = 'subA')
          and (new_data ->> 'changed_from_ai') = 'false'),
  'approval is audited (AI verdicts kept)');
select ok(
  exists (select 1 from public.audit_logs where module = 'results' and action = 'session_result_recorded' and reason = 'Duyệt chấm AI'),
  'the result row is audited with the reason "Duyệt chấm AI"');

-- The Zalo comment message carries the bonus suffix, the answer and the solution.
create temporary table message on commit drop as
select content from public.parent_messages
where dedupe_key = 'session.comment:' || (select id::text from public.session_results
  where class_session_id = '3f000000-0000-4000-8000-000000000031' and student_id = '3f000000-0000-4000-8000-000000000041');
select ok((select content like '%Điểm luyện tập cuối buổi: 9 (đã cộng 1) - Xếp hạng: Tiến bộ nhiều%' from message), 'the message shows "9 (đã cộng 1)" and the rank');
select ok((select content like E'%- Bài làm của học sinh:\n13. 18\n14. 8\n15. 257\n16. 7cm\n17. 12cm%' from message), 'the message carries the student''s answer');
select ok((select content like E'%- Bài chữa chi tiết của thầy cô:\nCâu 13 (đáp án x = 54):\nx = 36 + 18%' from message), 'the message carries the solution of the whole test');
select ok((select content like E'%- Nhận xét cho học sinh:\nHôm nay con được cộng 1 điểm%' from message), 'the message carries the approved comment');

-- B: the notebook score typed earlier stays; the reviewer becomes the grader.
select is(
  (select final_score from public.approve_grading_submission((select id from ids where name = 'subB'), (select value from verdicts where name = 'all'), true, 'Con làm bài rất tốt.', 1)),
  10, 'a full paper with the bonus ticked stays at 10');
select is(
  (select array[test_score::text, notebook_score::text, notebook_status, test_bonus_points::text, (graded_by = '3f000000-0000-4000-8000-000000000002')::text]
   from public.session_results where class_session_id = '3f000000-0000-4000-8000-000000000031' and student_id = '3f000000-0000-4000-8000-000000000042'),
  array['10.00', '8.00', 'submitted', '0', 'true'], 'B keeps its notebook score; no bonus suffix at 10');

-- 4. After approval ----------------------------------------------------------------------
select throws_ok(
  $$select public.set_grading_praise_bonus((select id from ids where name = 'subA'), false)$$,
  '55000', 'GRADING_SUBMISSION_ALREADY_APPROVED', 'the bonus of an approved paper changes only by approving again');
select lives_ok($$select public.set_grading_praise_bonus((select id from ids where name = 'subC'), true)$$, 'a pending paper can be ticked');
select is((select praise_bonus from public.grading_submissions where id = (select id from ids where name = 'subC')), true, 'the tick is stored');

-- A hand-typed score afterwards drops the "(đã cộng 1)" suffix.
select lives_ok(
  $$select public.update_session_result(
      (select id from public.session_results where class_session_id = '3f000000-0000-4000-8000-000000000031' and student_id = '3f000000-0000-4000-8000-000000000041'),
      7, null, 'pending', 'Thầy chấm lại tay.', 'Chấm lại tay')$$,
  'a TA overrides the score by hand');
select is(
  (select test_bonus_points from public.session_results where class_session_id = '3f000000-0000-4000-8000-000000000031' and student_id = '3f000000-0000-4000-8000-000000000041'),
  0::smallint, 'the bonus mark is cleared');
select ok(
  (select content like '%Điểm luyện tập cuối buổi: 7 - Xếp hạng: Tiến bộ vừa%' from public.parent_messages
   where dedupe_key = 'session.comment:' || (select id::text from public.session_results
     where class_session_id = '3f000000-0000-4000-8000-000000000031' and student_id = '3f000000-0000-4000-8000-000000000041')),
  'the queued message follows the hand-typed score');

-- A key revision does not re-grade approved papers; pending ones are queued again.
delete from public.grading_runs where run_type = 'grade';
select lives_ok(
  $$select public.confirm_session_test_key((select id from ids where name = 'test'), 'Đề lớp 3', '',
     jsonb_set((select key from keys where name = 'valid'), '{questions,4,final_answer}', '"12 (cm)"'), 1, 'Sửa đáp án câu 17')$$,
  'the key is revised to version 2');
select is(
  (select array_agg(submission_id order by submission_id) from public.grading_runs where run_type = 'grade' and status = 'queued'),
  array[(select id from ids where name = 'subC')], 'only the pending paper is queued again');
select throws_ok(
  $$select * from public.approve_grading_submission((select id from ids where name = 'subA'), (select value from verdicts where name = 'a'), false, 'x', 1)$$,
  '40001', 'GRADING_KEY_VERSION_CHANGED', 'approving with the old version is refused after the revision');

-- "Chấm lại" queues even an approved paper; "Bỏ qua" needs a reason and cancels the queued run.
select isnt(public.regrade_grading_submission((select id from ids where name = 'subA')), null, 'regrade queues an approved paper');
select is(
  (select array[status, answer_key_version::text] from public.grading_runs where submission_id = (select id from ids where name = 'subA') and run_type = 'grade'),
  array['queued', '2'], 'on the current key');
select is(
  (select review_status from public.grading_submissions where id = (select id from ids where name = 'subA')),
  'approved', 'the approval stays until the paper is approved again');
select throws_ok(
  $$select public.skip_grading_submission((select id from ids where name = 'subC'), '  ')$$,
  '22023', 'GRADING_SKIP_REASON_REQUIRED', 'skipping needs a reason');
select lives_ok($$select public.skip_grading_submission((select id from ids where name = 'subC'), 'Em làm trên giấy')$$, 'the TA skips C');
select is(
  (select array[review_status, review_note] from public.grading_submissions where id = (select id from ids where name = 'subC')),
  array['skipped', 'Em làm trên giấy'], 'C is skipped with the reason');
select is(
  (select array[status, error_code] from public.grading_runs where submission_id = (select id from ids where name = 'subC') and run_type = 'grade'),
  array['cancelled', 'skipped_by_reviewer'], 'its queued run is cancelled');
select lives_ok($$select public.regrade_grading_submission((select id from ids where name = 'subC'))$$, 'a skipped paper can be graded again');
select is(
  (select review_status from public.grading_submissions where id = (select id from ids where name = 'subC')),
  'pending', 'which puts it back to pending');

-- 5. Session view and phrases ------------------------------------------------------------
select is(
  (select array[review_status, final_score::text, attendance_status, (result_from_this_submission)::text, message_status, reviewed_by_name]
   from public.get_session_grading_submissions('3f000000-0000-4000-8000-000000000031') where submission_id = (select id from ids where name = 'subB')),
  array['approved', '10', 'present', 'true', 'queued', 'Cô Ngọc'], 'the session list shows the review, attendance, result and message');
select is(
  (select array[review_status, attendance_status, coalesce(result_id::text, 'none')]
   from public.get_session_grading_submissions('3f000000-0000-4000-8000-000000000031') where submission_id = (select id from ids where name = 'subC')),
  array['pending', 'unexcused_absence', 'none'], 'an absent student shows the attendance and no result');
select is((select count(*)::integer from public.list_grading_comment_phrases()), 16, 'a TA reads the phrases');
select is(
  (select text from public.list_grading_comment_phrases() where slot = 'y1_correct'),
  'Con làm bài đạt kết quả rất tốt, rất đáng được khen ngợi.', 'with the demo wording');

select set_config('request.jwt.claim.sub', '3f000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.list_grading_comment_phrases()), 0, 'staff without AI grading or settings access read no phrases');

select * from finish();
rollback;
