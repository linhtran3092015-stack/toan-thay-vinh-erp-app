begin;
select plan(68);

-- Fixtures: owner, TA, accountant. Grade-3 class with sessions S1 (2018-10-05 18:00) and S2 (same
-- day 20:00, locked later); students A and B enrolled. now() is fixed inside this transaction, so
-- time-based steps move timestamps by hand.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3e000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'aw-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3e000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'aw-ta@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3e000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'aw-accountant@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3e000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3e000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3e000000-0000-4000-8000-000000000003', id, 'fixture' from public.roles where code = 'accountant';
select set_config('request.jwt.claim.sub', '3e000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3e000000-0000-4000-8000-000000000010', '2018-2019', 'Năm học AI worker', date '2018-08-01', date '2019-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('3e000000-0000-4000-8000-000000000011', '3e000000-0000-4000-8000-000000000010', 'AW-3A', 'Worker 3A', 3, 'A', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status) values
  ('3e000000-0000-4000-8000-000000000031', '3e000000-0000-4000-8000-000000000011', date '2018-10-05', 'additional', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('3e000000-0000-4000-8000-000000000032', '3e000000-0000-4000-8000-000000000011', date '2018-10-05', 'additional', time '20:00', time '21:30', 'offline', 'scheduled');
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status) values
  ('3e000000-0000-4000-8000-000000000041', 'TV-2018-70041', 'Học Sinh A', 2018, 3, 'active'),
  ('3e000000-0000-4000-8000-000000000042', 'TV-2018-70042', 'Học Sinh B', 2018, 3, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to) values
  ('3e000000-0000-4000-8000-000000000051', '3e000000-0000-4000-8000-000000000041', '3e000000-0000-4000-8000-000000000011', 'offline', 'active', date '2018-08-01', null),
  ('3e000000-0000-4000-8000-000000000052', '3e000000-0000-4000-8000-000000000042', '3e000000-0000-4000-8000-000000000011', 'offline', 'active', date '2018-08-01', null);

create temporary table keys (name text primary key, key jsonb) on commit drop;
insert into keys values ('valid', '{"questions": [
  {"label": "13", "prompt_text": "x - 18 = 36", "max_points": 2, "final_answer": "x = 54", "accepted_equivalents": ["54"], "solution_steps": ["x = 36 + 18", "x = 54"]},
  {"label": "14", "prompt_text": "x × 6 = 48", "max_points": 2, "final_answer": "x = 8", "accepted_equivalents": [], "solution_steps": []},
  {"label": "15", "prompt_text": "385 - x = 128", "max_points": 2, "final_answer": "x = 257", "accepted_equivalents": [], "solution_steps": []},
  {"label": "16", "prompt_text": "BM = ?", "max_points": 2, "final_answer": "7 cm", "accepted_equivalents": ["7"], "solution_steps": []},
  {"label": "17", "prompt_text": "AD = ?", "max_points": 2, "final_answer": "12 cm", "accepted_equivalents": ["12"], "solution_steps": []}
]}');

create temporary table ids (name text primary key, id uuid) on commit drop;

-- 1. Structure and grants ----------------------------------------------------------------
select has_table('public', 'ai_grading_worker_state', 'worker state table exists');
select has_table('public', 'ai_grading_daily_spend', 'daily spend table exists');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.ai_grading_worker_state'::regclass, 'public.ai_grading_daily_spend'::regclass)),
  'RLS is on for the worker tables');
select ok(
  not has_table_privilege('authenticated', 'public.ai_grading_worker_state', 'select')
  and not has_table_privilege('authenticated', 'public.ai_grading_daily_spend', 'select')
  and not has_table_privilege('anon', 'public.ai_grading_daily_spend', 'select'),
  'staff and anon cannot read the worker tables directly');
select ok(
  has_function_privilege('service_role', 'public.claim_grading_runs(integer, integer)', 'execute')
  and has_function_privilege('service_role', 'public.complete_grading_run(uuid, text, jsonb, jsonb, text, text, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.claim_grading_runs(integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.complete_grading_run(uuid, text, jsonb, jsonb, text, text, integer)', 'execute')
  and not has_function_privilege('anon', 'public.claim_grading_runs(integer, integer)', 'execute'),
  'only service_role claims and completes runs');
select ok(
  not has_function_privilege('authenticated', 'public.enqueue_submission_grading(uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.enqueue_submission_grading(uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.record_submission_ai_failure(public.grading_runs)', 'execute')
  and not has_function_privilege('authenticated', 'public.ai_grading_settings()', 'execute')
  and not has_function_privilege('service_role', 'public.run_ai_grading_health_check()', 'execute'),
  'internal helpers are not callable directly');
select ok(
  has_function_privilege('authenticated', 'public.get_ai_grading_overview()', 'execute')
  and has_function_privilege('authenticated', 'public.resume_ai_grading()', 'execute')
  and not has_function_privilege('anon', 'public.get_ai_grading_overview()', 'execute')
  and not has_function_privilege('anon', 'public.get_session_grading_submissions(uuid)', 'execute'),
  'overview and resume are for signed-in staff only (each checks settings permissions)');
select is(
  (select count(*)::integer from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('claim_grading_runs', 'complete_grading_run', 'enqueue_submission_grading', 'cancel_submission_grading',
       'record_submission_ai_failure', 'grading_submissions_queue_ai', 'session_tests_queue_ai', 'run_ai_grading_health_check',
       'get_ai_grading_overview', 'resume_ai_grading', 'ai_grading_settings')
     and prosecdef and proconfig @> array['search_path=""']),
  11, 'every new definer function pins search_path to empty');
select is(
  (select schedule from cron.job where jobname = 'ai-grading-health-check'),
  '*/10 * * * *', 'the health check runs every 10 minutes');

-- 2. Settings ----------------------------------------------------------------------------
select is(
  public.ai_grading_settings(),
  '{"enabled": false, "grade_model": "claude-haiku-5-5", "grade_effort": "medium", "double_check": true, "tiebreak_model": "claude-sonnet-5-5", "key_model": "claude-opus-5-5", "daily_budget_usd": 20}'::jsonb,
  'defaults: off, Haiku 5.5 at medium, double check with a Sonnet 5.5 tiebreak, Opus 5.5 reads keys, 20 USD/day');
select throws_ok(
  $$select public.update_system_settings('{"ai_grading.grade_model": "claude-opus-5-5"}')$$,
  '22023', 'SYSTEM_SETTINGS_INVALID_VALUE', 'Opus cannot be the grading model');
select throws_ok(
  $$select public.update_system_settings('{"ai_grading.daily_budget_usd": 0}')$$,
  '22023', 'SYSTEM_SETTINGS_INVALID_AI_BUDGET', 'the daily budget is 1–200 USD');
select throws_ok(
  $$select public.update_system_settings('{"ai_grading.daily_budget_usd": 12.5}')$$,
  '22023', 'SYSTEM_SETTINGS_INVALID_AI_BUDGET', 'the daily budget is a whole number');
select throws_ok(
  $$select public.update_system_settings('{"ai_grading.enabled": "yes"}')$$,
  '22023', 'SYSTEM_SETTINGS_INVALID_VALUE', 'on/off only');
select set_config('request.jwt.claim.sub', '3e000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.update_system_settings('{"ai_grading.enabled": "on"}')$$,
  '42501', 'SYSTEM_SETTINGS_PERMISSION_DENIED', 'a TA cannot change AI grading settings');
select throws_ok(
  $$select public.get_ai_grading_overview()$$,
  '42501', 'SYSTEM_SETTINGS_PERMISSION_DENIED', 'a TA cannot read the cost overview');

-- 3. Queueing ----------------------------------------------------------------------------
-- Student A submits before the key exists: nothing to grade yet.
insert into ids select 'subA1', submission_id from public.record_grading_submission(
  'aw-a1-0001', timestamptz '2018-10-05 19:20+07', '13. 18  14. 8  15. 257  16. 7cm  17. 12cm', false, 'TV-2018-70041', 'Học Sinh A', 2018::smallint,
  '3e000000-0000-4000-8000-000000000031', null, null, null, '3e000000-0000-4000-8000-000000000041',
  '3e000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
select is(
  (select count(*)::integer from public.grading_runs where submission_id = (select id from ids where name = 'subA1')),
  0, 'no grading run while the session has no confirmed key');

insert into ids select 'test1', public.create_session_test('3e000000-0000-4000-8000-000000000031');
select lives_ok(
  $$select public.confirm_session_test_key((select id from ids where name = 'test1'), 'Đề lớp 3', '', (select key from keys where name = 'valid'), 0)$$,
  'the TA confirms the key');
select is(
  (select array[status, model, effort, prompt_version, answer_key_version::text] from public.grading_runs
   where submission_id = (select id from ids where name = 'subA1') and run_type = 'grade'),
  array['queued', 'claude-haiku-5-5', 'medium', 'grade-v2', '1'],
  'confirming the key queues the counted submission with the settings model');

insert into ids select 'subB', submission_id from public.record_grading_submission(
  'aw-b1-0001', timestamptz '2018-10-05 19:21+07', '13. 54 14. 8 15. 257 16. 7 17. 12', false, 'TV-2018-70042', 'Học Sinh B', 2018::smallint,
  '3e000000-0000-4000-8000-000000000031', null, null, null, '3e000000-0000-4000-8000-000000000042',
  '3e000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
select is(
  (select count(*)::integer from public.grading_runs where submission_id = (select id from ids where name = 'subB') and status = 'queued'),
  1, 'a submission that arrives after the key is queued at once');

-- A resubmits: the old attempt stops counting and its queued run is cancelled.
insert into ids select 'subA2', submission_id from public.record_grading_submission(
  'aw-a2-0001', timestamptz '2018-10-05 19:25+07', '13. 54 14. 8 15. 257 16. 7cm 17. 12cm', false, 'TV-2018-70041', 'Học Sinh A', 2018::smallint,
  '3e000000-0000-4000-8000-000000000031', null, null, null, '3e000000-0000-4000-8000-000000000041',
  '3e000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
select is(
  (select array[status, error_code] from public.grading_runs where submission_id = (select id from ids where name = 'subA1')),
  array['cancelled', 'superseded_submission'], 'the earlier attempt''s queued run is cancelled');
select is(
  (select count(*)::integer from public.grading_runs where submission_id = (select id from ids where name = 'subA2') and status = 'queued'),
  1, 'the latest attempt is queued');
select throws_ok(
  $$insert into public.grading_runs (run_type, test_id, submission_id, answer_key_version, model, prompt_version, effort)
    values ('grade', (select id from ids where name = 'test1'), (select id from ids where name = 'subA2'), 1, 'claude-haiku-5-5', 'grade-v2', 'medium')$$,
  '23505', null, 'one active grading run per submission');

-- 4. Claiming ----------------------------------------------------------------------------
select is((select count(*)::integer from public.claim_grading_runs(10)), 0, 'nothing is claimed while AI grading is off');

select set_config('request.jwt.claim.sub', '3e000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.update_system_settings('{"ai_grading.enabled": "on"}')$$, 'the owner turns AI grading on');

create temporary table claimed on commit drop as select * from public.claim_grading_runs(10);
select is((select count(*)::integer from claimed), 2, 'two runs are claimed');
select is(
  (select array_agg(status || ':' || attempt_count::text order by submission_id) from public.grading_runs where id in (select run_id from claimed)),
  array['running:1', 'running:1'], 'claimed runs are running, first attempt');
select is(
  (select payload ->> 'answer_text' from claimed where submission_id = (select id from ids where name = 'subA2')),
  '13. 54 14. 8 15. 257 16. 7cm 17. 12cm', 'the payload carries the answer');
select is(
  (select array[jsonb_array_length(payload -> 'answer_key' -> 'questions')::text, payload ->> 'double_check', payload ->> 'tiebreak_model', (payload ->> 'current_key_version')]
   from claimed where submission_id = (select id from ids where name = 'subA2')),
  array['5', 'true', 'claude-sonnet-5-5', '1'], 'the payload carries the key, double check and tiebreak model');
select ok(
  not exists (select 1 from claimed where payload::text like '%Học Sinh%' or payload::text like '%TV-2018%'),
  'no student name or code reaches the worker payload');
select is((select count(*)::integer from public.claim_grading_runs(10)), 0, 'a running run is not claimed twice');

-- 5. Completing --------------------------------------------------------------------------
select is(
  public.complete_grading_run(
    (select run_id from claimed where submission_id = (select id from ids where name = 'subA2')),
    'succeeded',
    '{"color": "green", "verdicts": {"13": "correct", "14": "correct", "15": "correct", "16": "correct", "17": "incorrect"},
      "questions": [{"label": "17", "verdict": "incorrect", "reason_for_teacher": "Sai đơn vị"}], "flags": [], "confidence": "high"}',
    '{"input_tokens": 1200, "output_tokens": 800, "cache_read_tokens": 3000, "cost_usd": 0.0012, "request_id": "req_1", "model": "claude-haiku-5-5", "stop_reason": "end_turn"}'
  ),
  'applied', 'a green result is applied');
select is(
  (select array[ai_color, ai_raw_score::text, ai_answer_key_version::text, ai_confidence] from public.grading_submissions where id = (select id from ids where name = 'subA2')),
  array['green', '8.00', '1', 'high'], 'the submission keeps colour, raw score (sum of correct points) and key version');
select is(
  (select array[status, input_tokens::text, output_tokens::text, cost_usd_est::text, request_id] from public.grading_runs
   where id = (select run_id from claimed where submission_id = (select id from ids where name = 'subA2'))),
  array['succeeded', '1200', '800', '0.0012', 'req_1'], 'the run records tokens, cost and request id');
select is(
  (select array[cost_usd::text, runs::text] from public.ai_grading_daily_spend where spend_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date),
  array['0.0012', '1'], 'the cost lands in today''s spend');
select is(
  public.complete_grading_run((select run_id from claimed where submission_id = (select id from ids where name = 'subA2')), 'succeeded', '{}'),
  'not_running', 'a finished run cannot be completed twice');
select throws_ok(
  $$select public.complete_grading_run((select run_id from claimed limit 1), 'done')$$,
  '22023', 'GRADING_RUN_INVALID_OUTCOME', 'unknown outcomes are refused');

-- B: a temporary error is retried later without counting as a failure.
select is(
  public.complete_grading_run((select run_id from claimed where submission_id = (select id from ids where name = 'subB')), 'retry', null, null, 'overloaded', 'Overloaded', 60),
  'retry_scheduled', 'a temporary error is rescheduled');
select is(
  (select array[status, error_code, (next_attempt_at > now())::text] from public.grading_runs
   where id = (select run_id from claimed where submission_id = (select id from ids where name = 'subB'))),
  array['queued', 'overloaded', 'true'], 'the run waits in the queue');
select is((select count(*)::integer from public.claim_grading_runs(10)), 0, 'a run is not claimed before its retry time');

-- Claimed again, B comes back with a label missing: the SQL check turns it red.
update public.grading_runs set next_attempt_at = now() - interval '1 second' where submission_id = (select id from ids where name = 'subB') and status = 'queued';
delete from claimed;
insert into claimed select * from public.claim_grading_runs(10);
select is((select attempt_count from claimed), 2, 'the retry is the second attempt');
select is(
  public.complete_grading_run((select run_id from claimed), 'succeeded',
    '{"color": "green", "verdicts": {"13": "correct", "14": "correct"}, "questions": [], "flags": [], "confidence": "high"}'),
  'applied', 'a result with missing questions is still recorded');
select is(
  (select array[ai_color, coalesce(ai_raw_score::text, 'null')] from public.grading_submissions where id = (select id from ids where name = 'subB')),
  array['red', 'null'], 'missing questions make the paper red (grade by hand)');

-- 6. Pausing and the daily budget --------------------------------------------------------
-- The key is revised: every counted paper is graded again on version 2.
select lives_ok(
  $$select public.confirm_session_test_key((select id from ids where name = 'test1'), 'Đề lớp 3', '',
     jsonb_set((select key from keys where name = 'valid'), '{questions,4,final_answer}', '"12 (cm)"'), 1, 'Sửa đáp án câu 17')$$,
  'the key is revised to version 2');
select is(
  (select array_agg(answer_key_version::text order by submission_id) from public.grading_runs where status = 'queued' and run_type = 'grade'),
  array['2', '2'], 'both counted papers are queued again on version 2');

delete from claimed;
insert into claimed select * from public.claim_grading_runs(1);
select is(
  public.complete_grading_run((select run_id from claimed), 'paused', null, null, 'credit_exhausted', 'Your credit balance is too low'),
  'paused', 'running out of credit pauses the queue');
select is(
  (select array[pause_reason, (paused_until > now())::text] from public.ai_grading_worker_state),
  array['credit_exhausted', 'true'], 'the worker state records the pause');
select is(
  (select array[status, attempt_count::text] from public.grading_runs where id = (select run_id from claimed)),
  array['queued', '0'], 'the paused run goes back to the queue without using an attempt');
select ok(
  exists (select 1 from public.notifications where recipient_user_id = '3e000000-0000-4000-8000-000000000001' and event_code = 'ops.ai_grading_paused'),
  'the owner is alerted');
select is((select count(*)::integer from public.claim_grading_runs(10)), 0, 'nothing is claimed while paused');

select set_config('request.jwt.claim.sub', '3e000000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.resume_ai_grading()$$, '42501', 'SYSTEM_SETTINGS_PERMISSION_DENIED', 'a TA cannot resume');
select set_config('request.jwt.claim.sub', '3e000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.resume_ai_grading()$$, 'the owner resumes');
select is((select paused_until from public.ai_grading_worker_state), null, 'the pause is cleared');

update public.ai_grading_daily_spend set cost_usd = 20 where spend_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date;
select is((select count(*)::integer from public.claim_grading_runs(10)), 0, 'nothing is claimed once today''s spend reaches the budget');
select is(
  (select array[pause_reason, (paused_until = ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')::text] from public.ai_grading_worker_state),
  array['daily_budget', 'true'], 'the queue waits until midnight Vietnam time');
select is(
  (select (get_ai_grading_overview ->> 'spent_today_usd')::numeric from public.get_ai_grading_overview()),
  20::numeric, 'the owner sees today''s spend');

-- 7. Stale results and closed sessions ---------------------------------------------------
update public.ai_grading_daily_spend set cost_usd = 0;
select public.resume_ai_grading();
delete from claimed;
insert into claimed select * from public.claim_grading_runs(10) where submission_id = (select id from ids where name = 'subA2');
select lives_ok(
  $$select public.confirm_session_test_key((select id from ids where name = 'test1'), 'Đề lớp 3', '',
     jsonb_set((select key from keys where name = 'valid'), '{questions,4,final_answer}', '"AD = 12 cm"'), 2, 'Sửa lại câu 17')$$,
  'the key changes again (version 3) while a run is still running');
select is(
  public.complete_grading_run((select run_id from claimed), 'succeeded',
    '{"color": "green", "verdicts": {"13": "correct", "14": "correct", "15": "correct", "16": "correct", "17": "correct"}, "questions": [], "flags": [], "confidence": "high"}'),
  'stale', 'a result graded on an old key is not applied');
select is(
  (select array[ai_answer_key_version::text, (select answer_key_version::text from public.grading_runs where submission_id = (select id from ids where name = 'subA2') and status = 'queued')]
   from public.grading_submissions where id = (select id from ids where name = 'subA2')),
  array['1', '3'], 'the paper keeps its old AI result and is queued on version 3');

select public.cancel_class_session('3e000000-0000-4000-8000-000000000031', 'Nghỉ đột xuất');
select is((select count(*)::integer from public.claim_grading_runs(10)), 0, 'runs of a cancelled session are not claimed');
select is(
  (select array_agg(distinct error_code) from public.grading_runs where run_type = 'grade' and status = 'cancelled' and submission_id = (select id from ids where name = 'subA2')),
  array['session_closed'], 'they are cancelled instead (scores cannot be written to a closed session)');

-- 8. Reading a key -----------------------------------------------------------------------
insert into ids select 'test2', public.create_session_test('3e000000-0000-4000-8000-000000000032');
insert into public.session_test_assets (test_id, storage_path, mime_type, page_no, sha256, width, height, uploaded_by)
select id, id::text || '/3e000000-0000-4000-8000-0000000000a1.jpg', 'image/jpeg', 1, repeat('a', 64), 2576, 1932, '3e000000-0000-4000-8000-000000000002'
from ids where name = 'test2';
select set_config('request.jwt.claim.sub', '3e000000-0000-4000-8000-000000000002', true);
insert into ids select 'run_key', public.request_session_test_key_extraction((select id from ids where name = 'test2'));
delete from claimed;
insert into claimed select * from public.claim_grading_runs(10);
select is(
  (select array[run_type, model, jsonb_array_length(payload -> 'pages')::text] from claimed),
  array['extract_key', 'claude-opus-5-5', '1'], 'a key-reading run is claimed with its pages');
select is(
  public.complete_grading_run((select id from ids where name = 'run_key'), 'succeeded',
    jsonb_build_object('answer_key', (select key from keys where name = 'valid'), 'title', 'LT 20''', 'transcription_warnings', '["Câu 14 khó đọc"]'::jsonb)),
  'applied', 'the AI draft is written into an empty draft');
select is(
  (select array[status, title, jsonb_array_length(answer_key -> 'questions')::text] from public.session_tests where id = (select id from ids where name = 'test2')),
  array['key_review', 'LT 20''', '5'], 'the test waits for a TA to check and confirm');
select is(
  (select public.get_session_test('3e000000-0000-4000-8000-000000000032') -> 'extraction' ->> 'outcome')
    || '|' || (select public.get_session_test('3e000000-0000-4000-8000-000000000032') -> 'extraction' -> 'warnings' ->> 0),
  'applied|Câu 14 khó đọc', 'the session test shows the outcome and the AI warnings');

-- A second reading after the TA edited the draft keeps the TA's draft.
insert into ids select 'run_key2', public.request_session_test_key_extraction((select id from ids where name = 'test2'));
update public.grading_runs set created_at = now() - interval '5 minutes' where id = (select id from ids where name = 'run_key2');
delete from claimed;
insert into claimed select * from public.claim_grading_runs(10);
select is(
  public.complete_grading_run((select id from ids where name = 'run_key2'), 'succeeded',
    jsonb_build_object('answer_key', '{"questions": [{"label": "1", "max_points": 10, "final_answer": "x"}]}'::jsonb, 'title', 'Khác')),
  'draft_changed', 'a draft edited after the request is not overwritten');
select is(
  (select jsonb_array_length(answer_key -> 'questions') from public.session_tests where id = (select id from ids where name = 'test2')),
  5, 'the draft is unchanged');

-- 9. Session view ------------------------------------------------------------------------
select is(
  (select array_agg(ai_state order by submitted_at) from public.get_session_grading_submissions('3e000000-0000-4000-8000-000000000031')),
  array['not_counted', 'grading', 'waiting_key'],
  'the session list shows the AI state of each attempt (old attempt, a run still running, a paper not graded on the current key)');

select * from finish();
rollback;
