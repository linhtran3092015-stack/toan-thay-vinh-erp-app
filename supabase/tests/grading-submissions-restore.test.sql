begin;
select plan(30);

-- Fixtures: owner (no display name), TA, accountant; one 6CLC1 session at 18:00 on 2018-09-03
-- with one enrolled student. Submissions: one matched, three waiting for review, one ignored
-- long ago (two ignore audit rows), one ignored by SQL without any audit row.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3c000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rs-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3c000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rs-ta@example.test', '{"provider":"email"}', '{"full_name":"Trợ Giảng Thử"}', now(), now()),
  ('3c000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rs-accountant@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3c000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3c000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3c000000-0000-4000-8000-000000000003', id, 'fixture' from public.roles where code = 'accountant';
select set_config('request.jwt.claim.sub', '3c000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3c000000-0000-4000-8000-000000000010', '2018-2019', 'Năm học grading restore', date '2018-08-01', date '2019-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('3c000000-0000-4000-8000-000000000011', '3c000000-0000-4000-8000-000000000010', 'RS-6CLC1', 'Restore 6CLC1', 6, 'CLC', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status)
values ('3c000000-0000-4000-8000-000000000031', '3c000000-0000-4000-8000-000000000011', date '2018-09-03', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');
select public.start_class_session('3c000000-0000-4000-8000-000000000031');
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status)
values ('3c000000-0000-4000-8000-000000000041', 'TV-2018-60041', 'Học Sinh Thử', 2012, 6, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to)
values ('3c000000-0000-4000-8000-000000000051', '3c000000-0000-4000-8000-000000000041', '3c000000-0000-4000-8000-000000000011', 'offline', 'active', date '2018-08-01', null);

select public.record_grading_submission(
  'rs-match-0001', timestamptz '2018-09-03 19:20+07', '13. 17', false, 'TV-2018-60041', 'Học Sinh Thử', 2012::smallint,
  '3c000000-0000-4000-8000-000000000031', null, null, null, '3c000000-0000-4000-8000-000000000041',
  '3c000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
select public.record_grading_submission(
  'rs-late-0001', timestamptz '2018-09-03 23:55+07', '13. 18', false, 'TV-2018-60041', 'Học Sinh Thử', 2012::smallint,
  null, null, null, null, '3c000000-0000-4000-8000-000000000041', null, 'needs_review', 'student_code', null, array['outside_window']);
select public.record_grading_submission(
  'rs-junk-0001', timestamptz '2018-09-03 19:31+07', 'asdfgh', false, null, 'Ai Đó', 2012::smallint,
  null, null, null, null, null, null, 'needs_review', null, null, array['student_not_found']);
select public.record_grading_submission(
  'rs-open-0001', timestamptz '2018-09-03 19:33+07', '13. 18', false, null, 'Người Lạ', 2012::smallint,
  null, null, null, null, null, null, 'needs_review', null, null, array['student_not_found']);
select public.record_grading_submission(
  'rs-old-0001', timestamptz '2018-09-03 19:00+07', 'test', false, null, 'Nộp Thử', 2012::smallint,
  null, null, null, null, null, null, 'needs_review', null, null, array['student_not_found']);
select public.record_grading_submission(
  'rs-sql-0001', timestamptz '2018-09-03 19:05+07', 'xyz', false, null, 'Bài Cũ', 2012::smallint,
  null, null, null, null, null, null, 'needs_review', null, null, array['student_not_found']);

create temporary table ids on commit drop as
select external_id, id from public.grading_submissions where external_id like 'rs-%';

-- Ignored before this feature: rs-old ignored twice by the owner (the later audit row wins),
-- rs-sql fixed by hand in SQL without an audit row.
update public.grading_submissions set match_status = 'ignored' where external_id in ('rs-old-0001', 'rs-sql-0001');
insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, occurred_at, reason) values
  ('3c000000-0000-4000-8000-000000000001', 'ai_grading', 'grading_submission_ignored', 'grading_submission',
    (select id::text from ids where external_id = 'rs-old-0001'), timestamptz '2018-09-03 20:00+07', 'Lý do cũ'),
  ('3c000000-0000-4000-8000-000000000001', 'ai_grading', 'grading_submission_ignored', 'grading_submission',
    (select id::text from ids where external_id = 'rs-old-0001'), timestamptz '2018-09-04 08:00+07', 'Nộp thử form'),
  ('3c000000-0000-4000-8000-000000000002', 'ai_grading', 'grading_submission_matched', 'grading_submission',
    (select id::text from ids where external_id = 'rs-old-0001'), timestamptz '2018-09-05 08:00+07', 'không phải bỏ qua');

-- 1. Grants and guards ------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.list_ignored_grading_submissions(integer)', 'execute')
  and has_function_privilege('authenticated', 'public.restore_grading_submission(uuid, text)', 'execute'),
  'signed-in staff can call the functions (each checks ai_grading.view)');
select ok(
  not has_function_privilege('anon', 'public.list_ignored_grading_submissions(integer)', 'execute')
  and not has_function_privilege('anon', 'public.restore_grading_submission(uuid, text)', 'execute'),
  'anon cannot call them');

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select * from public.list_ignored_grading_submissions(100)$$,
  '28000', 'AUTHENTICATION_REQUIRED', 'listing ignored submissions needs a signed-in user');
select throws_ok(
  $$select * from public.restore_grading_submission((select id from ids where external_id = 'rs-old-0001'), null)$$,
  '28000', 'AUTHENTICATION_REQUIRED', 'restoring needs a signed-in user');

select set_config('request.jwt.claim.sub', '3c000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select * from public.list_ignored_grading_submissions(100)$$,
  '42501', 'AI_GRADING_VIEW_PERMISSION_DENIED', 'an accountant cannot list ignored submissions');
select throws_ok(
  $$select * from public.restore_grading_submission((select id from ids where external_id = 'rs-old-0001'), null)$$,
  '42501', 'AI_GRADING_VIEW_PERMISSION_DENIED', 'an accountant cannot restore');
select is(
  (select match_status from public.grading_submissions where external_id = 'rs-old-0001'),
  'ignored', 'a refused restore changes nothing');

-- Everything below runs as the TA.
select set_config('request.jwt.claim.sub', '3c000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select * from public.ignore_grading_submission((select id from ids where external_id = 'rs-late-0001'), 'Nộp nhầm buổi')$$,
  'the TA marks the late submission as junk (by mistake)');

-- 2. List of ignored submissions ---------------------------------------------------------
select is(
  (select array_agg(external_id order by external_id) from public.list_ignored_grading_submissions(100) as listed
   join ids on ids.id = listed.submission_id),
  array['rs-late-0001', 'rs-old-0001', 'rs-sql-0001']::text[],
  'only ignored submissions are listed (not matched or waiting ones)');
select is(
  (select ignored_by_name || ':' || ignore_reason || ':' || (ignored_at = now())::text || ':' || student_public_code || ':' || array_to_string(match_issues, ',')
   from public.list_ignored_grading_submissions(100) where submission_id = (select id from ids where external_id = 'rs-late-0001')),
  'Trợ Giảng Thử:Nộp nhầm buổi:true:TV-2018-60041:outside_window',
  'a row shows who ignored it, when, why, and the student and issues it had');
select is(
  (select ignored_by::text || ':' || ignored_by_name || ':' || ignore_reason || ':' || ignored_at::text
   from public.list_ignored_grading_submissions(100) where submission_id = (select id from ids where external_id = 'rs-old-0001')),
  '3c000000-0000-4000-8000-000000000001:rs-owner:Nộp thử form:' || (timestamptz '2018-09-04 08:00+07')::text,
  'the latest ignore audit row wins; an actor without a display name shows the email name');
select is(
  (select row(ignored_at, ignored_by, ignored_by_name, ignore_reason)::text
   from public.list_ignored_grading_submissions(100) where submission_id = (select id from ids where external_id = 'rs-sql-0001')),
  '(,,,)', 'a submission ignored without an audit row is listed with empty who/when/why');
select is(
  (select external_id from public.list_ignored_grading_submissions(100) with ordinality as listed
   join ids on ids.id = listed.submission_id order by ordinality desc limit 1),
  'rs-old-0001', 'most recently ignored first: the one ignored in 2018 comes last');
select is(
  (select count(*) from public.list_ignored_grading_submissions(1)), 1::bigint, 'the limit is applied');

-- 3. Restore -------------------------------------------------------------------------------
select throws_ok(
  $$select * from public.restore_grading_submission((select id from ids where external_id = 'rs-open-0001'), null)$$,
  '55000', 'GRADING_SUBMISSION_NOT_IGNORED', 'a submission still waiting for review cannot be restored');
select throws_ok(
  $$select * from public.restore_grading_submission((select id from ids where external_id = 'rs-match-0001'), null)$$,
  '55000', 'GRADING_SUBMISSION_NOT_IGNORED', 'a matched submission cannot be restored');
select throws_ok(
  $$select * from public.restore_grading_submission('3c000000-0000-4000-8000-0000000000ff', null)$$,
  'P0002', 'GRADING_SUBMISSION_NOT_FOUND', 'an unknown submission is reported');
select throws_ok(
  $$select * from public.restore_grading_submission((select id from ids where external_id = 'rs-late-0001'), repeat('x', 501))$$,
  '22023', 'REASON_TOO_LONG', 'the note is at most 500 characters');

select is(
  (select match_status from public.restore_grading_submission((select id from ids where external_id = 'rs-late-0001'), '  Bỏ qua nhầm  ')),
  'needs_review', 'an ignored submission goes back to the review queue');
select is(
  (select match_status || ':' || student_id::text || ':' || student_match_method || ':' || array_to_string(match_issues, ',') || ':'
     || coalesce(attempt_no::text, '-') || ':' || counts_for_score::text || ':' || (matched_at is null)::text
   from public.grading_submissions where external_id = 'rs-late-0001'),
  'needs_review:3c000000-0000-4000-8000-000000000041:student_code:outside_window:-:false:true',
  'it keeps the recognised student and the issues it had, and never counts');
select is(
  (select actor_user_id::text || ':' || reason || ':' || (old_data ->> 'match_status') || ':' || (new_data ->> 'match_status') || ':' || (new_data -> 'match_issues')::text
   from public.audit_logs where entity_type = 'grading_submission' and action = 'grading_submission_restored'
     and entity_id = (select id::text from ids where external_id = 'rs-late-0001')),
  '3c000000-0000-4000-8000-000000000002:Bỏ qua nhầm:ignored:needs_review:["outside_window"]',
  'the restore is audited with the actor and the trimmed note');
select is(
  (select count(*) from public.list_unmatched_grading_submissions(100) where submission_id = (select id from ids where external_id = 'rs-late-0001')),
  1::bigint, 'the restored submission is back on "Bài nộp chưa ghép"');
select is(
  (select count(*) from public.list_ignored_grading_submissions(100) where submission_id = (select id from ids where external_id = 'rs-late-0001')),
  0::bigint, 'and no longer on the ignored list');
select throws_ok(
  $$select * from public.restore_grading_submission((select id from ids where external_id = 'rs-late-0001'), null)$$,
  '55000', 'GRADING_SUBMISSION_NOT_IGNORED', 'restoring twice is refused');

select is(
  (select match_status from public.restore_grading_submission((select id from ids where external_id = 'rs-sql-0001'), '   ')),
  'needs_review', 'a submission ignored without an audit row can be restored too');
select ok(
  (select reason is null from public.audit_logs where action = 'grading_submission_restored'
     and entity_id = (select id::text from ids where external_id = 'rs-sql-0001')),
  'the note is optional (blank is stored as no note)');

-- 4. A restored submission is an ordinary one waiting for review ---------------------------
select is(
  (select match_status || ':' || attempt_no || ':' || counts_for_score::text from public.match_grading_submission(
    (select id from ids where external_id = 'rs-late-0001'), '3c000000-0000-4000-8000-000000000041', '3c000000-0000-4000-8000-000000000031', null)),
  'matched:2:true', 'it can be matched by hand and becomes the latest attempt');
select is(
  (select array_agg(external_id || ':' || attempt_no || ':' || counts_for_score::text order by attempt_no)
   from public.grading_submissions where student_id = '3c000000-0000-4000-8000-000000000041' and class_session_id = '3c000000-0000-4000-8000-000000000031'),
  array['rs-match-0001:1:false', 'rs-late-0001:2:true']::text[], 'attempts are recomputed after the match');
select is(
  (select match_status from public.ignore_grading_submission((select id from ids where external_id = 'rs-sql-0001'), 'Bỏ qua lại')),
  'ignored', 'it can be ignored again');
select is(
  (select ignore_reason from public.list_ignored_grading_submissions(100) where submission_id = (select id from ids where external_id = 'rs-sql-0001')),
  'Bỏ qua lại', 'the list shows the new ignore reason');

select * from finish();
rollback;
