begin;
select plan(24);

-- Fixtures: owner, TA. Grade-3 class with session S1 (completed, with a confirmed key and papers)
-- and S2 (a test only, no papers) on 2015-10-17, and S3 on another day outside the range.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3c100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'aq-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3c100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'aq-ta@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3c100000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3c100000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
select set_config('request.jwt.claim.sub', '3c100000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3c100000-0000-4000-8000-000000000010', '2015-2016', 'Năm học hàng chờ AI', date '2015-08-01', date '2016-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('3c100000-0000-4000-8000-000000000011', '3c100000-0000-4000-8000-000000000010', 'AQ-3A', 'Queue 3A', 3, 'A', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status) values
  ('3c100000-0000-4000-8000-000000000031', '3c100000-0000-4000-8000-000000000011', date '2015-10-17', 'additional', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('3c100000-0000-4000-8000-000000000032', '3c100000-0000-4000-8000-000000000011', date '2015-10-17', 'additional', time '20:00', time '21:30', 'offline', 'scheduled'),
  ('3c100000-0000-4000-8000-000000000033', '3c100000-0000-4000-8000-000000000011', date '2015-11-30', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status) values
  ('3c100000-0000-4000-8000-000000000041', 'TV-2015-90041', 'Hàng Chờ A', 2018, 3, 'active'),
  ('3c100000-0000-4000-8000-000000000042', 'TV-2015-90042', 'Hàng Chờ B', 2018, 3, 'active'),
  ('3c100000-0000-4000-8000-000000000043', 'TV-2015-90043', 'Hàng Chờ C', 2018, 3, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to)
select gen_random_uuid(), s.id, '3c100000-0000-4000-8000-000000000011', 'offline', 'active', date '2015-08-01', null
from public.students as s where s.id::text like '3c100000-0000-4000-8000-00000000004%';

create temporary table ids (name text primary key, id uuid) on commit drop;
insert into ids select 'test1', public.create_session_test('3c100000-0000-4000-8000-000000000031');
insert into ids select 'test2', public.create_session_test('3c100000-0000-4000-8000-000000000032');
select public.confirm_session_test_key((select id from ids where name = 'test1'), 'Đề', '',
  '{"questions": [{"label": "1", "max_points": 10, "final_answer": "5"}]}'::jsonb, 0);

insert into ids select 'subA', submission_id from public.record_grading_submission(
  'aq-a-0001', timestamptz '2015-10-17 19:20+07', '1. 5', false, 'TV-2015-90041', 'Hàng Chờ A', 2018::smallint,
  '3c100000-0000-4000-8000-000000000031', null, null, null, '3c100000-0000-4000-8000-000000000041',
  '3c100000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
insert into ids select 'subB', submission_id from public.record_grading_submission(
  'aq-b-0001', timestamptz '2015-10-17 19:21+07', '1. 4', false, 'TV-2015-90042', 'Hàng Chờ B', 2018::smallint,
  '3c100000-0000-4000-8000-000000000031', null, null, null, '3c100000-0000-4000-8000-000000000042',
  '3c100000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
insert into ids select 'subC', submission_id from public.record_grading_submission(
  'aq-c-0001', timestamptz '2015-10-17 19:22+07', '1. 5', false, 'TV-2015-90043', 'Hàng Chờ C', 2018::smallint,
  '3c100000-0000-4000-8000-000000000031', null, null, null, '3c100000-0000-4000-8000-000000000043',
  '3c100000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
-- A green and B yellow (graded today), C still queued.
update public.grading_submissions set ai_color = 'green', ai_raw_score = 10, ai_answer_key_version = 1, ai_graded_at = now(), ai_question_results = '[]'
where id = (select id from ids where name = 'subA');
update public.grading_submissions set ai_color = 'yellow', ai_raw_score = 0, ai_answer_key_version = 1, ai_graded_at = now(), ai_question_results = '[]'
where id = (select id from ids where name = 'subB');
delete from public.grading_runs where submission_id in (select id from ids where name in ('subA', 'subB'));

-- 1. Phrase library ----------------------------------------------------------------------
create temporary table library on commit drop as
select coalesce(jsonb_agg(jsonb_build_object('slot', slot, 'text', text) order by slot, sort_order), '[]'::jsonb) as phrases
from public.grading_comment_phrases where active;

select set_config('request.jwt.claim.sub', '3c100000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.set_grading_comment_phrases((select phrases from library))$$, '42501', 'SYSTEM_SETTINGS_PERMISSION_DENIED', 'a TA cannot change the phrases');
select set_config('request.jwt.claim.sub', '3c100000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.set_grading_comment_phrases((select phrases from library) || '[{"slot": "y9", "text": "x"}]'::jsonb)$$,
  '22023', 'GRADING_PHRASES_INVALID', 'unknown slots are refused');
select throws_ok(
  $$select public.set_grading_comment_phrases((select phrases from library) || '[{"slot": "y4", "text": "   "}]'::jsonb)$$,
  '22023', 'GRADING_PHRASES_INVALID', 'empty phrases are refused');
select throws_ok(
  $$select public.set_grading_comment_phrases((select jsonb_agg(item) from jsonb_array_elements((select phrases from library)) as item where item ->> 'slot' <> 'y4'))$$,
  '22023', 'GRADING_PHRASES_SLOT_COUNT', 'every slot keeps at least one phrase');
select is(
  public.set_grading_comment_phrases((select phrases from library) || '[{"slot": "y4", "text": "  Thầy chúc con một tuần học vui.  "}]'::jsonb),
  17, 'the owner saves the library with one more closing wish');
select is(
  (select array_agg(text order by sort_order) from public.grading_comment_phrases where slot = 'y4'),
  array['Cố gắng phát huy kết quả này, thầy tin con sẽ ngày càng tiến bộ.', 'Thầy luôn theo sát và tin rằng con sẽ tiến bộ hơn nữa trong những buổi tới.',
        'Chúc con giữ vững tinh thần học tập, thầy tin con sẽ ngày càng vững vàng hơn.', 'Thầy chúc con một tuần học vui.'],
  'phrases keep their order and are trimmed');
select ok(exists (select 1 from public.audit_logs where action = 'grading_comment_phrases_updated'), 'the change is audited');
select is(
  (select count(*)::integer from public.list_grading_comment_phrases() where slot = 'y4'), 4, 'the draft comment reads the new library');

-- 2. Queue -------------------------------------------------------------------------------
select throws_ok($$select * from public.list_ai_grading_sessions(date '2015-10-20', date '2015-10-01')$$, '22023', 'AI_GRADING_RANGE_INVALID', 'the range must be ordered');
select throws_ok($$select * from public.list_ai_grading_sessions(date '2015-01-01', date '2015-10-01')$$, '22023', 'AI_GRADING_RANGE_INVALID', 'the range is at most 62 days');
create temporary table queue on commit drop as select * from public.list_ai_grading_sessions(date '2015-10-11', date '2015-10-17');
select is((select count(*)::integer from queue), 2, 'sessions with a test or papers in the range are listed');
select is(
  (select array[test_status, submissions::text, grading::text, green_pending::text, yellow_pending::text, red_pending::text, approved::text]
   from queue where class_session_id = '3c100000-0000-4000-8000-000000000031'),
  array['key_confirmed', '3', '1', '1', '1', '0', '0'], 'S1 shows 3 papers: one grading, one green and one yellow to review');
select is(
  (select array[test_status, submissions::text] from queue where class_session_id = '3c100000-0000-4000-8000-000000000032'),
  array['draft', '0'], 'S2 shows its draft test and no papers');
select is(
  (select array[graded, green, yellow, red]::integer[] from (
     select (t ->> 'graded')::integer as graded, (t ->> 'green')::integer as green, (t ->> 'yellow')::integer as yellow, (t ->> 'red')::integer as red
     from public.get_ai_grading_today() as t) as x),
  array[2, 1, 1, 0], 'today''s tiles count AI results by colour');

-- 3. Spend history -----------------------------------------------------------------------
insert into public.ai_grading_daily_spend (spend_date, cost_usd, runs) values (public.ai_grading_today() - 1, 1.25, 90);
select is(jsonb_array_length(public.get_ai_grading_overview() -> 'daily_spend'), 30, 'the overview lists 30 days');
select is(
  (select (day ->> 'cost_usd')::numeric from jsonb_array_elements(public.get_ai_grading_overview() -> 'daily_spend') as day
   where day ->> 'date' = (public.ai_grading_today() - 1)::text),
  1.25::numeric, 'yesterday''s spend is in the history');

-- 4. Reminder before auto-lock -----------------------------------------------------------
select public.update_system_settings('{"sessions.auto_lock_after_days": 3}'::jsonb);
select public.start_class_session('3c100000-0000-4000-8000-000000000031');
select public.mark_session_attendance('3c100000-0000-4000-8000-000000000031', s.id, 'present', 'offline', null)
from public.students as s where s.id::text like '3c100000-0000-4000-8000-00000000004%';
select public.complete_class_session('3c100000-0000-4000-8000-000000000031');
-- Backdate the completion (history triggers would refuse it), as the lock-queue tests do.
alter table public.class_sessions disable trigger class_sessions_protect_history;
alter table public.class_sessions disable trigger class_sessions_validate_business_rules;
update public.class_sessions set started_at = now() - interval '3 hours', completed_at = now() - interval '1 hour'
where id = '3c100000-0000-4000-8000-000000000031';
select is(public.run_ai_grading_review_reminders(), 0, 'no reminder while the session is more than a day from locking');

update public.class_sessions set started_at = now() - interval '2 days 3 hours', completed_at = now() - interval '2 days 1 hour'
where id = '3c100000-0000-4000-8000-000000000031';
select is(
  (select auto_lock_at > now() and auto_lock_at <= now() + interval '24 hours' from public.list_ai_grading_sessions(date '2015-10-17', date '2015-10-17')
   where class_session_id = '3c100000-0000-4000-8000-000000000031'),
  true, 'the queue shows when the session locks itself');
select cmp_ok(public.run_ai_grading_review_reminders(), '>=', 2, 'the reminder job notifies once the lock is less than a day away');
select is(
  (select message from public.notifications where recipient_user_id = '3c100000-0000-4000-8000-000000000001' and event_code = 'ai_grading.review_due'),
  'Buổi AQ-3A ngày 17/10/2015 còn 3 bài chưa duyệt và sẽ tự khóa trong 24 giờ. Sau khi khóa không ghi điểm được nữa.',
  'the person who completed the session hears about it');
select ok(
  exists (select 1 from public.notifications where recipient_user_id = '3c100000-0000-4000-8000-000000000001' and event_code = 'ops.ai_grading_review_due'),
  'the owner gets the daily digest');
select is(public.run_ai_grading_review_reminders(), 0, 'reminders are sent once');
select public.update_system_settings('{"sessions.auto_lock_after_days": 0}'::jsonb);
select is(public.run_ai_grading_review_reminders(), 0, 'no reminder when auto-lock is off');
select ok(
  not has_function_privilege('authenticated', 'public.run_ai_grading_review_reminders()', 'execute')
  and has_function_privilege('authenticated', 'public.list_ai_grading_sessions(date, date)', 'execute')
  and not has_function_privilege('anon', 'public.set_grading_comment_phrases(jsonb)', 'execute'),
  'the reminder job is internal; the queue and the phrase editor are for signed-in staff');

select * from finish();
rollback;
