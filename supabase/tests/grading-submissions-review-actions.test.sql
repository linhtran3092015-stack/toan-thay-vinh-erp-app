begin;
select plan(44);

-- Fixtures: owner, TA, accountant; on 2018-09-03 a 6CLC1 session at 18:00 (and a cancelled
-- one at 08:00) and a 6B session at 15:00 where Bông is a walk-in. Two namesakes "Nguyễn Minh
-- Anh" born 2012, a withdrawn 2012 student without enrollment, a 2013 student in 6B.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3b000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'gr-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3b000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'gr-ta@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3b000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'gr-accountant@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3b000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3b000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3b000000-0000-4000-8000-000000000003', id, 'fixture' from public.roles where code = 'accountant';
select set_config('request.jwt.claim.sub', '3b000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3b000000-0000-4000-8000-000000000010', '2018-2019', 'Năm học grading review', date '2018-08-01', date '2019-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count) values
  ('3b000000-0000-4000-8000-000000000011', '3b000000-0000-4000-8000-000000000010', 'GR-6CLC1', 'Review 6CLC1', 6, 'CLC', 'active', 1),
  ('3b000000-0000-4000-8000-000000000012', '3b000000-0000-4000-8000-000000000010', 'GR-6B', 'Review 6B', 6, 'B', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status) values
  ('3b000000-0000-4000-8000-000000000031', '3b000000-0000-4000-8000-000000000011', date '2018-09-03', 'additional', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('3b000000-0000-4000-8000-000000000032', '3b000000-0000-4000-8000-000000000011', date '2018-09-03', 'additional', time '08:00', time '09:30', 'offline', 'scheduled'),
  ('3b000000-0000-4000-8000-000000000033', '3b000000-0000-4000-8000-000000000012', date '2018-09-03', 'additional', time '15:00', time '16:30', 'offline', 'scheduled');
do $$
begin
  perform public.start_class_session('3b000000-0000-4000-8000-000000000031');
  perform public.start_class_session('3b000000-0000-4000-8000-000000000033');
  perform public.cancel_class_session('3b000000-0000-4000-8000-000000000032', 'Nghỉ lễ');
end;
$$;
insert into public.students (id, public_code, full_name, nickname, birth_year, current_grade, lifecycle_status) values
  ('3b000000-0000-4000-8000-000000000041', 'TV-2018-50041', 'Nguyễn Minh Anh', null, 2012, 6, 'active'),
  ('3b000000-0000-4000-8000-000000000042', 'TV-2018-50042', 'Nguyễn Minh Anh', 'Bông', 2012, 6, 'active'),
  ('3b000000-0000-4000-8000-000000000043', 'TV-2018-50043', 'Trần Văn Cường', null, 2012, 6, 'withdrawn'),
  ('3b000000-0000-4000-8000-000000000044', 'TV-2018-50044', 'Lê Thị Dung', null, 2013, 5, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to) values
  ('3b000000-0000-4000-8000-000000000051', '3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000011', 'offline', 'active', date '2018-08-01', null),
  ('3b000000-0000-4000-8000-000000000052', '3b000000-0000-4000-8000-000000000042', '3b000000-0000-4000-8000-000000000011', 'offline', 'active', date '2018-08-01', null),
  ('3b000000-0000-4000-8000-000000000054', '3b000000-0000-4000-8000-000000000044', '3b000000-0000-4000-8000-000000000012', 'offline', 'active', date '2018-08-01', null);
insert into public.session_attendance (class_session_id, student_id, student_enrollment_id, attendance_status, actual_learning_mode, marked_at, marked_by)
values ('3b000000-0000-4000-8000-000000000033', '3b000000-0000-4000-8000-000000000042', null, 'additional_study', 'offline', now(), '3b000000-0000-4000-8000-000000000001');

-- Submissions (as the webhook records them).
select public.record_grading_submission(
  'ext-anh-0001', timestamptz '2018-09-03 19:20+07', '13. 17', false, 'TV-2018-50041', 'Nguyễn Minh Anh', 2012::smallint,
  '3b000000-0000-4000-8000-000000000031', null, null, null, '3b000000-0000-4000-8000-000000000041',
  '3b000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}');
select public.record_grading_submission(
  'ext-amb-0001', timestamptz '2018-09-03 19:25+07', '13. 18', false, null, 'Nguyen Minh  Anh', 2012::smallint,
  null, 'CLC1 - Từ cơ bản đến nâng cao', null, null, null, null, 'needs_review', null, null, array['student_ambiguous']);
select public.record_grading_submission(
  'ext-amb-0002', timestamptz '2018-09-03 19:28+07', '13. 18 14. 8', false, null, 'Nguyễn Minh Anh', 2012::smallint,
  null, null, null, null, null, null, 'needs_review', null, null, array['student_ambiguous']);
select public.record_grading_submission(
  'ext-junk-0001', timestamptz '2018-09-03 19:31+07', 'asdfgh', false, null, 'Ai đó', 2012::smallint,
  null, null, null, null, null, null, 'needs_review', null, null, array['student_not_found']);
select public.record_grading_submission(
  'ext-late-0001', timestamptz '2018-09-03 23:55+07', '13. 18', false, 'TV-2018-50041', 'Nguyễn Minh Anh', 2012::smallint,
  null, null, null, null, '3b000000-0000-4000-8000-000000000041', null, 'needs_review', 'student_code', null, array['outside_window']);
select public.record_grading_submission(
  'ext-new-0001', timestamptz '2018-09-03 19:10+07', '13. 18', false, null, 'Phạm Gia Huy', 2012::smallint,
  null, null, null, null, null, null, 'needs_review', null, null, array['student_not_found']);
select public.record_grading_submission(
  'ext-new-0002', timestamptz '2018-09-03 19:12+07', '13. 18', false, null, 'Phạm Gia Huy', 2012::smallint,
  '3b000000-0000-4000-8000-000000000033', null, null, null, null, null, 'needs_review', null, null, array['student_not_found']);
select public.record_grading_submission(
  'ext-dung-0001', timestamptz '2018-09-03 19:40+07', '13. 18', false, 'TV-2018-50044', 'Lê Thị Dung', 2013::smallint,
  null, null, null, null, null, null, 'needs_review', null, null, array['student_code_unknown', 'student_not_found']);

create temporary table ids on commit drop as
select external_id, id from public.grading_submissions where external_id like 'ext-%';

-- 1. Grants and guards ------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.match_grading_submission(uuid, uuid, uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.ignore_grading_submission(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.rematch_grading_submissions(jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.list_grading_match_candidates(uuid, text, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.list_unmatched_grading_submissions(integer)', 'execute'),
  'signed-in staff can call the review functions (each checks ai_grading.view)');
select ok(
  not has_function_privilege('anon', 'public.match_grading_submission(uuid, uuid, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.ignore_grading_submission(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.rematch_grading_submissions(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.list_grading_match_candidates(uuid, text, integer)', 'execute')
  and not has_function_privilege('anon', 'public.list_unmatched_grading_submissions(integer)', 'execute'),
  'anon cannot call the review functions');
select ok(
  not has_function_privilege('authenticated', 'public.grading_session_is_eligible(timestamptz, uuid, uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.grading_session_is_eligible(timestamptz, uuid, uuid)', 'execute'),
  'the eligibility helper is internal');

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select * from public.match_grading_submission((select id from ids where external_id = 'ext-amb-0001'), '3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000031', null)$$,
  '28000', 'AUTHENTICATION_REQUIRED', 'matching needs a signed-in user');

select set_config('request.jwt.claim.sub', '3b000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select * from public.match_grading_submission((select id from ids where external_id = 'ext-amb-0001'), '3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000031', null)$$,
  '42501', 'AI_GRADING_VIEW_PERMISSION_DENIED', 'an accountant cannot match');
select throws_ok(
  $$select * from public.ignore_grading_submission((select id from ids where external_id = 'ext-junk-0001'), 'rác')$$,
  '42501', 'AI_GRADING_VIEW_PERMISSION_DENIED', 'an accountant cannot ignore');
select throws_ok(
  $$select * from public.rematch_grading_submissions('[]'::jsonb)$$,
  '42501', 'AI_GRADING_VIEW_PERMISSION_DENIED', 'an accountant cannot rematch');
select throws_ok(
  $$select * from public.list_grading_match_candidates((select id from ids where external_id = 'ext-amb-0001'), null, 100)$$,
  '42501', 'AI_GRADING_VIEW_PERMISSION_DENIED', 'an accountant cannot list match candidates');

-- Everything below runs as the TA.
select set_config('request.jwt.claim.sub', '3b000000-0000-4000-8000-000000000002', true);

-- 2. Match candidates ----------------------------------------------------------------
select is(
  (select array_agg(public_code order by public_code) from public.list_grading_match_candidates((select id from ids where external_id = 'ext-amb-0001'), null, 100)),
  array['TV-2018-50041', 'TV-2018-50042']::text[],
  'by default: students of the claimed birth year enrolled or scheduled that day (not the withdrawn one)');
select is(
  (select jsonb_path_query_array(sessions, '$[*].class_code') || jsonb_path_query_array(sessions, '$[*].attendance_status')
   from public.list_grading_match_candidates((select id from ids where external_id = 'ext-amb-0001'), null, 100) where public_code = 'TV-2018-50042'),
  '["GR-6B", "GR-6CLC1", "additional_study", null]'::jsonb,
  'each candidate carries that day''s sessions (walk-in included, cancelled skipped), by start time');
select is(
  (select array_agg(public_code order by public_code) from public.list_grading_match_candidates((select id from ids where external_id = 'ext-late-0001'), null, 100)),
  array['TV-2018-50041', 'TV-2018-50042']::text[],
  'the student already recognised by code is part of the list');
select is(
  (select array_agg(public_code || ':' || enrolled_on_day::text) from public.list_grading_match_candidates((select id from ids where external_id = 'ext-amb-0001'), 'dung', 30)),
  array['TV-2018-50044:true']::text[], 'typing searches other birth years too (ilike on name)');
select is(
  (select count(*) from public.list_grading_match_candidates((select id from ids where external_id = 'ext-amb-0001'), 'Cường', 30)),
  0::bigint, 'a name search never reaches students without an enrollment or session that day');
select is(
  (select array_agg(public_code || ':' || lifecycle_status) from public.list_grading_match_candidates((select id from ids where external_id = 'ext-amb-0001'), 'tv-2018-50043', 30)),
  array['TV-2018-50043:withdrawn']::text[], 'an exact student code finds any student');
select is(
  (select count(*) from public.list_grading_match_candidates((select id from ids where external_id = 'ext-amb-0001'), '%', 30)),
  0::bigint, 'LIKE wildcards in the search are literal');

-- 3. Manual match ----------------------------------------------------------------------
select throws_ok(
  $$select * from public.match_grading_submission((select id from ids where external_id = 'ext-amb-0001'), '3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000033', null)$$,
  '22023', 'GRADING_SESSION_NOT_ELIGIBLE', 'a session the student is not in (roster or attendance) is refused');
select throws_ok(
  $$select * from public.match_grading_submission((select id from ids where external_id = 'ext-amb-0001'), '3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000032', null)$$,
  '22023', 'GRADING_SESSION_NOT_ELIGIBLE', 'a cancelled session is refused');
select throws_ok(
  $$select * from public.match_grading_submission((select id from ids where external_id = 'ext-amb-0001'), '3b000000-0000-4000-8000-000000000041', null, null)$$,
  '22023', 'GRADING_MATCH_TARGET_REQUIRED', 'a student and a session are both required');
select throws_ok(
  $$select * from public.match_grading_submission((select id from ids where external_id = 'ext-amb-0001'), '3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000031', repeat('x', 501))$$,
  '22023', 'REASON_TOO_LONG', 'the note is at most 500 characters');

select is(
  (select match_status || ':' || attempt_no || ':' || counts_for_score::text from public.match_grading_submission(
    (select id from ids where external_id = 'ext-amb-0002'), '3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000031', 'Hỏi lại trợ giảng lớp')),
  'matched:2:true', 'a later manual match becomes the latest attempt and counts');
select is(
  (select array_agg(external_id || ':' || attempt_no || ':' || counts_for_score::text order by attempt_no)
   from public.grading_submissions where student_id = '3b000000-0000-4000-8000-000000000041' and class_session_id = '3b000000-0000-4000-8000-000000000031'),
  array['ext-anh-0001:1:false', 'ext-amb-0002:2:true']::text[], 'attempts are recomputed: the earlier automatic one stops counting');
select is(
  (select superseded_by from public.grading_submissions where external_id = 'ext-anh-0001'),
  (select id from ids where external_id = 'ext-amb-0002'), 'the earlier attempt points at the manual one');
select is(
  (select student_match_method || '/' || session_match_method || '/' || (matched_at is not null)::text || '/' || cardinality(match_issues)
   from public.grading_submissions where external_id = 'ext-amb-0002'),
  'manual/manual/true/0', 'a manual match records both methods as manual, a match time and no review issues');
select is(
  (select actor_user_id::text || ':' || action || ':' || reason || ':' || (old_data -> 'match_issues')::text || ':' || (new_data ->> 'counts_for_score')
   from public.audit_logs where entity_type = 'grading_submission' and entity_id = (select id::text from ids where external_id = 'ext-amb-0002')),
  '3b000000-0000-4000-8000-000000000002:grading_submission_matched:Hỏi lại trợ giảng lớp:["student_ambiguous"]:true',
  'the manual match is audited with the actor, the note and the old issues');
select throws_ok(
  $$select * from public.match_grading_submission((select id from ids where external_id = 'ext-amb-0002'), '3b000000-0000-4000-8000-000000000042', '3b000000-0000-4000-8000-000000000031', null)$$,
  '55000', 'GRADING_SUBMISSION_NOT_PENDING', 'a matched submission cannot be matched again');
select is(
  (select match_status || ':' || attempt_no || ':' || counts_for_score::text from public.match_grading_submission(
    (select id from ids where external_id = 'ext-amb-0001'), '3b000000-0000-4000-8000-000000000042', '3b000000-0000-4000-8000-000000000033', null)),
  'matched:1:true', 'a walk-in session (attendance only) can be chosen, even outside its time window');

-- 4. Ignore (bài rác) --------------------------------------------------------------------
select throws_ok(
  $$select * from public.ignore_grading_submission((select id from ids where external_id = 'ext-junk-0001'), '   ')$$,
  '22023', 'REASON_REQUIRED', 'ignoring needs a reason');
select is(
  (select match_status from public.ignore_grading_submission((select id from ids where external_id = 'ext-junk-0001'), 'Gõ linh tinh')),
  'ignored', 'a junk submission is marked ignored');
select is(
  (select reason || ':' || action from public.audit_logs where entity_type = 'grading_submission' and entity_id = (select id::text from ids where external_id = 'ext-junk-0001')),
  'Gõ linh tinh:grading_submission_ignored', 'ignoring is audited with the reason');
select is(
  (select count(*) from public.list_unmatched_grading_submissions(100) where submission_id in (select id from ids where external_id in ('ext-junk-0001', 'ext-amb-0001', 'ext-amb-0002'))),
  0::bigint, 'matched and ignored submissions leave "Bài nộp chưa ghép"');
select throws_ok(
  $$select * from public.ignore_grading_submission((select id from ids where external_id = 'ext-junk-0001'), 'lần nữa')$$,
  '55000', 'GRADING_SUBMISSION_NOT_PENDING', 'an ignored submission cannot be ignored again');
select throws_ok(
  $$select * from public.match_grading_submission((select id from ids where external_id = 'ext-junk-0001'), '3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000031', null)$$,
  '55000', 'GRADING_SUBMISSION_NOT_PENDING', 'an ignored submission cannot be matched');
select lives_ok(
  $$select * from public.ignore_grading_submission((select id from ids where external_id = 'ext-late-0001'), 'Nộp nhầm buổi')$$,
  'a submission with a recognised student can be ignored too');
select set_config('request.jwt.claim.sub', '3b000000-0000-4000-8000-000000000001', true);
select public.refresh_grading_submission_attempts('3b000000-0000-4000-8000-000000000041', '3b000000-0000-4000-8000-000000000031');
select is(
  (select array_agg(external_id || ':' || match_status || ':' || coalesce(attempt_no::text, '-') || ':' || counts_for_score::text order by external_id)
   from public.grading_submissions where student_id = '3b000000-0000-4000-8000-000000000041'),
  array['ext-amb-0002:matched:2:true', 'ext-anh-0001:matched:1:false', 'ext-late-0001:ignored:-:false']::text[],
  'recomputing attempts never counts an ignored submission');
select throws_ok(
  $$update public.grading_submissions set counts_for_score = true where external_id = 'ext-late-0001'$$,
  '23514', null, 'an ignored submission can never be made to count');
select set_config('request.jwt.claim.sub', '3b000000-0000-4000-8000-000000000002', true);

-- 5. Ghép lại tự động ----------------------------------------------------------------------
-- Huy's profile and enrollment are created after his submissions arrived.
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status)
values ('3b000000-0000-4000-8000-000000000045', 'TV-2018-50045', 'Phạm Gia Huy', 2012, 6, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to)
values ('3b000000-0000-4000-8000-000000000055', '3b000000-0000-4000-8000-000000000045', '3b000000-0000-4000-8000-000000000011', 'offline', 'active', date '2018-08-01', null);

select throws_ok(
  $$select * from public.rematch_grading_submissions('{"submission_id": null}'::jsonb)$$,
  '22023', 'GRADING_REMATCH_DECISIONS_INVALID', 'decisions must be a JSON array');
select is(
  (select array_agg(result.outcome order by result.ord)
   from public.rematch_grading_submissions(jsonb_build_array(
      jsonb_build_object('submission_id', (select id from ids where external_id = 'ext-new-0001'), 'student_id', '3b000000-0000-4000-8000-000000000045',
        'class_session_id', '3b000000-0000-4000-8000-000000000031', 'student_match_method', 'manual', 'session_match_method', 'manual', 'match_issues', '[]'::jsonb),
      jsonb_build_object('submission_id', (select id from ids where external_id = 'ext-new-0001'), 'student_id', '3b000000-0000-4000-8000-000000000045',
        'class_session_id', '3b000000-0000-4000-8000-000000000031', 'student_match_method', 'student_code', 'session_match_method', 'time_window', 'match_issues', '[]'::jsonb),
      jsonb_build_object('submission_id', (select id from ids where external_id = 'ext-new-0002'), 'student_id', '3b000000-0000-4000-8000-000000000045',
        'class_session_id', '3b000000-0000-4000-8000-000000000031', 'student_match_method', 'name_birth_year', 'session_match_method', 'claimed_session', 'match_issues', '[]'::jsonb),
      jsonb_build_object('submission_id', (select id from ids where external_id = 'ext-new-0002'), 'student_id', '3b000000-0000-4000-8000-000000000045',
        'class_session_id', '3b000000-0000-4000-8000-000000000033', 'student_match_method', 'name_birth_year', 'session_match_method', 'claimed_session', 'match_issues', '[]'::jsonb),
      jsonb_build_object('submission_id', (select id from ids where external_id = 'ext-amb-0001'), 'student_id', '3b000000-0000-4000-8000-000000000041',
        'class_session_id', '3b000000-0000-4000-8000-000000000031', 'student_match_method', 'name_birth_year', 'session_match_method', 'time_window', 'match_issues', '[]'::jsonb)
    )) with ordinality as result(submission_id, outcome, match_status, counts_for_score, ord)),
  array['invalid', 'invalid', 'invalid', 'invalid', 'skipped']::text[],
  'manual methods, a code that is not the one on the form, a claimed session that differs, an ineligible session and a row no longer pending are refused');
select is(
  (select outcome || ':' || match_status || ':' || counts_for_score::text from public.rematch_grading_submissions(jsonb_build_array(
    jsonb_build_object('submission_id', (select id from ids where external_id = 'ext-new-0001'), 'student_id', '3b000000-0000-4000-8000-000000000045',
      'class_session_id', '3b000000-0000-4000-8000-000000000031', 'student_match_method', 'name_birth_year', 'session_match_method', 'time_window', 'match_issues', '[]'::jsonb)))),
  'matched:matched:true', 'a student created after the submission is matched by the rerun');
select is(
  (select student_match_method || '/' || session_match_method || '/' || (matched_at is not null)::text || '/' || attempt_no
   from public.grading_submissions where external_id = 'ext-new-0001'),
  'name_birth_year/time_window/true/1', 'the rerun keeps the automatic methods');
select is(
  (select action || ':' || (metadata ->> 'session_match_method') from public.audit_logs where entity_type = 'grading_submission' and entity_id = (select id::text from ids where external_id = 'ext-new-0001')),
  'grading_submission_rematched:time_window', 'the rerun is audited');
select is(
  (select outcome from public.rematch_grading_submissions(jsonb_build_array(
    jsonb_build_object('submission_id', (select id from ids where external_id = 'ext-dung-0001'), 'student_id', '3b000000-0000-4000-8000-000000000044',
      'class_session_id', null, 'student_match_method', 'student_code', 'session_match_method', null, 'match_issues', '["no_session_today"]'::jsonb)))),
  'updated', 'a student found without a session stays for review with new issues');
select is(
  (select student_id::text || ':' || student_match_method || ':' || array_to_string(match_issues, ',') || ':' || match_status
   from public.grading_submissions where external_id = 'ext-dung-0001'),
  '3b000000-0000-4000-8000-000000000044:student_code:no_session_today:needs_review', 'the recognised student and the new issue are stored');
select is(
  (select outcome from public.rematch_grading_submissions(jsonb_build_array(
    jsonb_build_object('submission_id', (select id from ids where external_id = 'ext-dung-0001'), 'student_id', '3b000000-0000-4000-8000-000000000044',
      'class_session_id', null, 'student_match_method', 'student_code', 'session_match_method', null, 'match_issues', '["no_session_today"]'::jsonb)))),
  'unchanged', 'the same result again changes nothing');
select is(
  (select claimed_class_session_id from public.list_unmatched_grading_submissions(100) where submission_id = (select id from ids where external_id = 'ext-new-0002')),
  '3b000000-0000-4000-8000-000000000033'::uuid, 'the unmatched list exposes the session claimed on the form (the matcher needs it)');

select * from finish();
rollback;
