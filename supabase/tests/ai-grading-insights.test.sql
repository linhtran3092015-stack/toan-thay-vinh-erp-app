begin;
select plan(30);

-- Fixtures: owner, TA. Grade-7 class, session S1 started, students A..G present. Key: question 1
-- (answer 42) and question 2 (answer 10). AI marks question 1 wrong for A..E (four of them wrote 41),
-- right for F; G handed in a blank form (did the test on paper).
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3e200000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ai-ins-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3e200000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ai-ins-ta@example.test', '{"provider":"email"}', '{}', now(), now());
update public.profiles set display_name = 'Cô Lan' where id = '3e200000-0000-4000-8000-000000000002';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3e200000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3e200000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
select set_config('request.jwt.claim.sub', '3e200000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3e200000-0000-4000-8000-000000000010', '2014-2015', 'Năm học thống kê AI', date '2014-08-01', date '2015-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('3e200000-0000-4000-8000-000000000011', '3e200000-0000-4000-8000-000000000010', 'AI-7A', 'Insights 7A', 7, 'A', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status)
values ('3e200000-0000-4000-8000-000000000031', '3e200000-0000-4000-8000-000000000011', date '2014-10-22', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status)
select ('3e200000-0000-4000-8000-00000000004' || n)::uuid, 'TV-2014-7004' || n, 'Thống Kê ' || chr(64 + n), 2014, 7, 'active'
from generate_series(1, 7) as n;
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to)
select gen_random_uuid(), s.id, '3e200000-0000-4000-8000-000000000011', 'offline', 'active', date '2014-08-01', null
from public.students as s where s.id::text like '3e200000-0000-4000-8000-00000000004%';
select public.start_class_session('3e200000-0000-4000-8000-000000000031');
select public.mark_session_attendance('3e200000-0000-4000-8000-000000000031', s.id, 'present', 'offline', null)
from public.students as s where s.id::text like '3e200000-0000-4000-8000-00000000004%';

create temporary table ids (name text primary key, id uuid) on commit drop;
insert into ids select 'test', public.create_session_test('3e200000-0000-4000-8000-000000000031');
select public.confirm_session_test_key((select id from ids where name = 'test'), 'Đề lớp 7', '',
  '{"questions": [{"label": "1", "max_points": 5, "final_answer": "42"}, {"label": "2", "max_points": 5, "final_answer": "10"}]}'::jsonb, 0);

insert into ids
select 'sub' || chr(64 + n), (
  select submission_id from public.record_grading_submission(
    'ai-ins-' || n, timestamptz '2014-10-22 19:20+07' + make_interval(mins => n), '1. 41 2. 10', false, 'TV-2014-7004' || n,
    'Thống Kê ' || chr(64 + n), 2014::smallint, '3e200000-0000-4000-8000-000000000031', null, null, null,
    ('3e200000-0000-4000-8000-00000000004' || n)::uuid, '3e200000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}'))
from generate_series(1, 7) as n;

update public.grading_submissions as submission
set ai_color = case when ids.name in ('subA', 'subG') then 'yellow' else 'green' end,
    ai_raw_score = case when ids.name = 'subF' then 10 else 5 end,
    ai_answer_key_version = 1,
    ai_graded_at = now(),
    ai_flags = case when ids.name = 'subG' then array['empty'] else '{}' end,
    ai_question_results = case
      when ids.name = 'subF' then '[{"label": "1", "verdict": "correct", "extracted_final_answer": "42"}, {"label": "2", "verdict": "correct", "extracted_final_answer": "10"}]'::jsonb
      when ids.name = 'subE' then '[{"label": "1", "verdict": "incorrect", "extracted_final_answer": "40"}, {"label": "2", "verdict": "correct", "extracted_final_answer": "10"}]'::jsonb
      when ids.name = 'subG' then '[{"label": "1", "verdict": "incorrect", "extracted_final_answer": null}, {"label": "2", "verdict": "missing", "extracted_final_answer": null}]'::jsonb
      else '[{"label": "1", "verdict": "incorrect", "extracted_final_answer": " 41 "}, {"label": "2", "verdict": "correct", "extracted_final_answer": "10"}]'::jsonb
    end
from ids
where submission.id = ids.id and ids.name like 'sub_';
delete from public.grading_runs where submission_id in (select id from ids where name like 'sub_');

-- 1. Questions most papers got wrong --------------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'public.session_test_key_warnings(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.session_test_key_warnings(uuid)', 'execute'),
  'the warning helper is internal');
create temporary table warnings on commit drop as
select public.get_session_test('3e200000-0000-4000-8000-000000000031') -> 'key_warnings' as value;
select is(jsonb_array_length((select value from warnings)), 1, 'one question is flagged');
select is(
  (select value -> 0 from warnings),
  '{"label": "1", "key_answer": "42", "papers": 6, "wrong": 5, "common_answer": "41", "common_answer_count": 4}'::jsonb,
  'question 1: 5 of 6 papers wrong (the blank paper is left out), four wrote 41');
select is(
  (select suspect_questions from public.list_ai_grading_sessions(date '2014-10-22', date '2014-10-22')),
  1, 'the queue page counts the flagged question');

-- Fewer than five graded papers never raise a warning, even when all of them are wrong.
update public.grading_submissions set ai_flags = array['empty'] where id in (select id from ids where name in ('subE', 'subF'));
select is(jsonb_array_length(public.get_session_test('3e200000-0000-4000-8000-000000000031') -> 'key_warnings'), 0,
  'no warning below five papers');
update public.grading_submissions set ai_flags = '{}' where id in (select id from ids where name in ('subE', 'subF'));

-- The TA marks A right on question 1: approved papers count with the TA verdicts, 4 of 6 is not over 70%.
select set_config('request.jwt.claim.sub', '3e200000-0000-4000-8000-000000000002', true);
select is(
  (select final_score from public.approve_grading_submission((select id from ids where name = 'subA'), '{"1": "correct", "2": "correct"}', false, 'Con làm tốt.', 1)),
  10, 'the TA approves A with question 1 changed to right');
select is(jsonb_array_length(public.get_session_test('3e200000-0000-4000-8000-000000000031') -> 'key_warnings'), 0,
  'the warning clears once at most 70% of papers are wrong');
select is(
  (select suspect_questions from public.list_ai_grading_sessions(date '2014-10-22', date '2014-10-22')),
  0, 'the queue page count follows');

-- 2. Stats per reviewer ------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '3e200000-0000-4000-8000-000000000001', true);
select is(
  (select final_score from public.approve_grading_submission((select id from ids where name = 'subB'), '{"1": "incorrect", "2": "correct"}', false, 'Con cố gắng.', 1)),
  5, 'the owner approves B as the AI graded it');
select is(
  (select final_score from public.approve_grading_submission((select id from ids where name = 'subC'), '{"1": "missing", "2": "correct"}', true, 'Con cố gắng.', 1)),
  6, 'the owner approves C, "missing" instead of "wrong", with the +1');
select is(
  (select final_score from public.approve_grading_submission((select id from ids where name = 'subG'), '{"1": "correct", "2": "correct"}', false, 'Con làm bài trên giấy.', 1)),
  10, 'the owner ticks the blank paper by hand');

select set_config('request.jwt.claim.sub', '3e200000-0000-4000-8000-000000000002', true);
select throws_ok($$select * from public.get_ai_grading_review_stats(30)$$, '42501', 'SYSTEM_SETTINGS_PERMISSION_DENIED', 'a TA cannot see the stats');
select set_config('request.jwt.claim.sub', '3e200000-0000-4000-8000-000000000001', true);
select throws_ok($$select * from public.get_ai_grading_review_stats(0)$$, '22023', 'AI_GRADING_RANGE_INVALID', 'the window is 1 to 90 days');
create temporary table stats on commit drop as select * from public.get_ai_grading_review_stats(30);
select is((select count(*)::integer from stats), 2, 'one row per reviewer');
select is(
  (select array[approved, green, yellow, red, blank, compared, changed_papers, changed_green, changed_questions, praise_bonus] from stats
   where reviewer_id = '3e200000-0000-4000-8000-000000000001'),
  array[3, 2, 1, 0, 1, 2, 0, 0, 0, 1],
  'owner: 3 approved, the blank paper counted apart, "missing" vs "wrong" is not a change');
select is(
  (select array[approved, yellow, compared, changed_papers, changed_green, changed_questions] from stats
   where reviewer_id = '3e200000-0000-4000-8000-000000000002'),
  array[1, 1, 1, 1, 0, 1], 'TA: 1 approved (yellow) with one question changed');
select is((select reviewer_name from stats where reviewer_id = '3e200000-0000-4000-8000-000000000002'), 'Cô Lan', 'the reviewer is named');
select ok(
  has_function_privilege('authenticated', 'public.get_ai_grading_review_stats(integer)', 'execute')
  and not has_function_privilege('anon', 'public.get_ai_grading_review_stats(integer)', 'execute'),
  'signed-in users can call the stats (the function checks settings.view)');

-- 3. Handing in again after approval ---------------------------------------------------
select is(
  (select count(*)::integer from public.notifications where event_code = 'ai_grading.resubmitted_after_review'),
  0, 'no resubmission notice yet');
insert into ids select 'subA2', submission_id from public.record_grading_submission(
  'ai-ins-1-again', timestamptz '2014-10-22 19:40+07', '1. 42 2. 10', false, 'TV-2014-70041', 'Thống Kê A', 2014::smallint,
  '3e200000-0000-4000-8000-000000000031', null, null, null, '3e200000-0000-4000-8000-000000000041',
  '3e200000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
select is(
  (select array[counts_for_score::text, review_status] from public.grading_submissions where id = (select id from ids where name = 'subA')),
  array['false', 'approved'], 'the approved paper no longer counts');
select is(
  (select test_score from public.session_results
   where class_session_id = '3e200000-0000-4000-8000-000000000031' and student_id = '3e200000-0000-4000-8000-000000000041'),
  10::numeric, 'the score stays until the new paper is reviewed');
select is(
  (select recipient_user_id from public.notifications where event_code = 'ai_grading.resubmitted_after_review'),
  '3e200000-0000-4000-8000-000000000002'::uuid, 'the TA who approved the first paper is told');
select is(
  (select message from public.notifications where event_code = 'ai_grading.resubmitted_after_review'),
  'Buổi AI-7A ngày 22/10/2014 có một em nộp lại bài sau khi bài trước đã được duyệt. Điểm đang ghi chưa đổi; mở buổi để xem bài mới và duyệt lại nếu cần.',
  'the notice names the session, not the student');
create temporary table rows_a on commit drop as
select * from public.get_session_grading_submissions('3e200000-0000-4000-8000-000000000031')
where student_id = '3e200000-0000-4000-8000-000000000041';
select is(
  (select array[counts_for_score::text, prior_approved_attempt_no::text, result_from_prior_approval::text, (prior_approved_at is not null)::text]
   from rows_a where submission_id = (select id from ids where name = 'subA2')),
  array['true', '1', 'true', 'true'], 'the new paper is flagged: attempt 1 was approved and the result comes from it');
select is(
  (select array[prior_approved_attempt_no::text, result_from_prior_approval::text] from rows_a where submission_id = (select id from ids where name = 'subA')),
  array[null, 'false'], 'the old paper carries no flag');
select is(
  (select resubmitted_pending from public.list_ai_grading_sessions(date '2014-10-22', date '2014-10-22')),
  1, 'the queue page counts the paper handed in again');

-- A third attempt: one more notice; a resubmission from a student never approved sends none.
insert into ids select 'subA3', submission_id from public.record_grading_submission(
  'ai-ins-1-third', timestamptz '2014-10-22 19:45+07', '1. 42 2. 10', false, 'TV-2014-70041', 'Thống Kê A', 2014::smallint,
  '3e200000-0000-4000-8000-000000000031', null, null, null, '3e200000-0000-4000-8000-000000000041',
  '3e200000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
insert into ids select 'subD2', submission_id from public.record_grading_submission(
  'ai-ins-4-again', timestamptz '2014-10-22 19:46+07', '1. 42 2. 10', false, 'TV-2014-70044', 'Thống Kê D', 2014::smallint,
  '3e200000-0000-4000-8000-000000000031', null, null, null, '3e200000-0000-4000-8000-000000000044',
  '3e200000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
select is(
  (select count(*)::integer from public.notifications where event_code = 'ai_grading.resubmitted_after_review'),
  2, 'each new paper after approval sends one notice');
select is(
  (select prior_approved_attempt_no from public.get_session_grading_submissions('3e200000-0000-4000-8000-000000000031')
   where submission_id = (select id from ids where name = 'subA3')),
  1, 'the latest paper still points at the approved attempt');
select is(
  (select prior_approved_attempt_no from public.get_session_grading_submissions('3e200000-0000-4000-8000-000000000031')
   where submission_id = (select id from ids where name = 'subD2')),
  null, 'a plain resubmission is not flagged');

-- Approving the new paper replaces the score and clears the flag on the session result.
select set_config('request.jwt.claim.sub', '3e200000-0000-4000-8000-000000000002', true);
update public.grading_submissions
set ai_color = 'green', ai_raw_score = 10, ai_answer_key_version = 1, ai_graded_at = now(),
    ai_question_results = '[{"label": "1", "verdict": "correct", "extracted_final_answer": "42"}, {"label": "2", "verdict": "correct", "extracted_final_answer": "10"}]'
where id = (select id from ids where name = 'subA3');
select public.approve_grading_submission((select id from ids where name = 'subA3'), '{"1": "correct", "2": "correct"}', false, 'Con làm lại tốt.', 1, 'Em nộp lại');
select is(
  (select result_from_prior_approval from public.get_session_grading_submissions('3e200000-0000-4000-8000-000000000031')
   where submission_id = (select id from ids where name = 'subA3')),
  false, 'after approving the new paper the result comes from it');

select * from finish();
rollback;
