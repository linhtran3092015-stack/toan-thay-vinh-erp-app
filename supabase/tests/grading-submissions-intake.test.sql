begin;
select plan(34);

-- Fixtures: owner, TA, accountant; one 2012 class with two sessions on 2018-09-03 (one
-- cancelled), another class where Bình is a walk-in (additional study).
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'gs-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'gs-ta@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3a000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'gs-accountant@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3a000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3a000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3a000000-0000-4000-8000-000000000003', id, 'fixture' from public.roles where code = 'accountant';
select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3a000000-0000-4000-8000-000000000010', '2018-2019', 'Năm học grading intake', date '2018-08-01', date '2019-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count) values
  ('3a000000-0000-4000-8000-000000000011', '3a000000-0000-4000-8000-000000000010', 'GS-6CLC1', 'Grading 6CLC1', 6, 'CLC', 'active', 1),
  ('3a000000-0000-4000-8000-000000000012', '3a000000-0000-4000-8000-000000000010', 'GS-6B', 'Grading 6B', 6, 'B', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status) values
  ('3a000000-0000-4000-8000-000000000031', '3a000000-0000-4000-8000-000000000011', date '2018-09-03', 'additional', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('3a000000-0000-4000-8000-000000000032', '3a000000-0000-4000-8000-000000000011', date '2018-09-03', 'additional', time '08:00', time '09:30', 'offline', 'scheduled'),
  ('3a000000-0000-4000-8000-000000000033', '3a000000-0000-4000-8000-000000000012', date '2018-09-03', 'additional', time '15:00', time '16:30', 'offline', 'scheduled');
do $$
begin
  perform public.start_class_session('3a000000-0000-4000-8000-000000000031');
  perform public.start_class_session('3a000000-0000-4000-8000-000000000033');
  perform public.cancel_class_session('3a000000-0000-4000-8000-000000000032', 'Nghỉ lễ');
end;
$$;
insert into public.students (id, public_code, full_name, nickname, birth_year, current_grade, lifecycle_status) values
  ('3a000000-0000-4000-8000-000000000041', 'TV-2018-40041', 'Nguyễn Minh Anh', null, 2012, 6, 'active'),
  ('3a000000-0000-4000-8000-000000000042', 'TV-2018-40042', 'Nguyễn Minh Anh', 'Bông', 2012, 6, 'active'),
  ('3a000000-0000-4000-8000-000000000043', 'TV-2018-40043', 'Trần Văn Cường', null, 2012, 6, 'withdrawn'),
  ('3a000000-0000-4000-8000-000000000044', 'TV-2018-40044', 'Lê Thị Dung', null, 2013, 5, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to) values
  ('3a000000-0000-4000-8000-000000000051', '3a000000-0000-4000-8000-000000000041', '3a000000-0000-4000-8000-000000000011', 'offline', 'active', date '2018-08-01', null),
  ('3a000000-0000-4000-8000-000000000052', '3a000000-0000-4000-8000-000000000042', '3a000000-0000-4000-8000-000000000011', 'offline', 'active', date '2018-08-01', null),
  ('3a000000-0000-4000-8000-000000000054', '3a000000-0000-4000-8000-000000000044', '3a000000-0000-4000-8000-000000000012', 'offline', 'active', date '2018-08-01', null);
insert into public.guardians (id, full_name, phone) values
  ('3a000000-0000-4000-8000-000000000061', 'Phụ huynh Anh', '0912 344 828'),
  ('3a000000-0000-4000-8000-000000000062', 'Phụ huynh Bông', '0987654321');
insert into public.student_guardians (student_id, guardian_id, relationship, is_primary) values
  ('3a000000-0000-4000-8000-000000000041', '3a000000-0000-4000-8000-000000000061', 'mother', true),
  ('3a000000-0000-4000-8000-000000000042', '3a000000-0000-4000-8000-000000000062', 'father', true);
-- Bông studies in the 6B session today as a walk-in.
insert into public.session_attendance (class_session_id, student_id, student_enrollment_id, attendance_status, actual_learning_mode, marked_at, marked_by)
values ('3a000000-0000-4000-8000-000000000033', '3a000000-0000-4000-8000-000000000042', null, 'additional_study', 'offline', now(), '3a000000-0000-4000-8000-000000000001');

-- 1. Grants, RLS, permission -------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.grading_submissions'::regclass), 'RLS is on');
select ok(not has_table_privilege('anon', 'public.grading_submissions', 'select'), 'anon cannot read submissions');
select ok(not has_table_privilege('authenticated', 'public.grading_submissions', 'insert'), 'staff cannot insert directly');
select ok(
  has_function_privilege('service_role', 'public.record_grading_submission(text, timestamptz, text, boolean, text, text, smallint, uuid, text, text, jsonb, uuid, uuid, text, text, text, text[], text)', 'execute')
  and has_function_privilege('service_role', 'public.get_grading_form_roster(smallint, date)', 'execute'),
  'service_role runs the webhook and roster functions');
select ok(
  not has_function_privilege('authenticated', 'public.record_grading_submission(text, timestamptz, text, boolean, text, text, smallint, uuid, text, text, jsonb, uuid, uuid, text, text, text, text[], text)', 'execute')
  and not has_function_privilege('anon', 'public.get_grading_form_roster(smallint, date)', 'execute')
  and not has_function_privilege('authenticated', 'public.get_grading_form_roster(smallint, date)', 'execute')
  and not has_function_privilege('authenticated', 'public.get_grading_session_candidates(uuid, date)', 'execute'),
  'staff and anon cannot call the webhook or roster functions');
select ok(
  not has_function_privilege('anon', 'public.list_unmatched_grading_submissions(integer)', 'execute')
  and has_function_privilege('authenticated', 'public.get_session_grading_submissions(uuid)', 'execute'),
  'screen readers are for signed-in staff only');
select is(
  (select array_agg(role.code order by role.code) from public.role_permissions as grant_row
   join public.roles as role on role.id = grant_row.role_id
   join public.permissions as permission on permission.id = grant_row.permission_id
   where permission.code = 'ai_grading.view'),
  array['assistant_manager', 'operations_manager', 'owner', 'teaching_assistant']::text[],
  'ai_grading.view goes to owner, both managers and TAs');

-- 2. Roster for the form --------------------------------------------------------
select is(
  (select array_agg(birth_year::text || ':' || student_count::text order by birth_year desc) from public.get_grading_form_birth_years(date '2018-09-03')),
  array['2013:1', '2012:2']::text[], 'birth years count only actively enrolled students');
select is(
  (select array_agg(public_code order by public_code) from public.get_grading_form_roster(2012::smallint, date '2018-09-03')),
  array['TV-2018-40041', 'TV-2018-40042']::text[], 'the roster lists active enrollments of the birth year only');
select is(
  (select guardian_phone_last4 from public.get_grading_form_roster(2012::smallint, date '2018-09-03') where public_code = 'TV-2018-40041'),
  '4828', 'only the last 4 digits of the primary parent phone leave the database');
select is(
  (select jsonb_path_query_array(sessions, '$[*].class_code') from public.get_grading_form_roster(2012::smallint, date '2018-09-03') where public_code = 'TV-2018-40041'),
  '["GS-6CLC1"]'::jsonb, 'today''s sessions skip cancelled ones');
select is(
  (select jsonb_path_query_array(sessions, '$[*].class_code') from public.get_grading_form_roster(2012::smallint, date '2018-09-03') where public_code = 'TV-2018-40042'),
  '["GS-6B", "GS-6CLC1"]'::jsonb, 'a walk-in session (attendance) also shows, ordered by start time');

-- 3. Match candidates ------------------------------------------------------------
select is(
  (select array_agg(public_code || ':' || candidate_source order by candidate_source, public_code) from public.get_grading_student_candidates('tv-2018-40043', 2012::smallint, date '2018-09-03')),
  array['TV-2018-40041:birth_year', 'TV-2018-40042:birth_year', 'TV-2018-40043:code']::text[],
  'the code finds any student (case-insensitive); name candidates are active enrollments of the birth year');
select is(
  (select array_agg(class_code || ':' || on_roster::text || ':' || coalesce(attendance_status, '-') order by start_time) from public.get_grading_session_candidates('3a000000-0000-4000-8000-000000000042', date '2018-09-03')),
  array['GS-6B:false:additional_study', 'GS-6CLC1:true:-']::text[],
  'session candidates: roster sessions plus attendance-only sessions, never cancelled ones');

-- 4. Recording submissions --------------------------------------------------------
select is(
  (select inserted::text || ':' || match_status || ':' || counts_for_score::text from public.record_grading_submission(
    'ext-anh-0001', timestamptz '2018-09-03 19:25+07', E'13. x=18\n14. 8', false, 'TV-2018-40041', 'Nguyễn Minh Anh', 2012::smallint,
    '3a000000-0000-4000-8000-000000000031', null, null, '{"v":1}', '3a000000-0000-4000-8000-000000000041',
    '3a000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}')),
  'true:matched:true', 'a matched submission counts');
select is(
  (select inserted::text || ':' || match_status from public.record_grading_submission(
    'ext-anh-0001', timestamptz '2018-09-03 19:25+07', 'changed text', false, 'TV-2018-40041', 'Nguyễn Minh Anh', 2012::smallint,
    null, null, null, null, null, null, 'needs_review', null, null, '{}')),
  'false:matched', 'a resend with the same external_id returns the existing row');
select is(
  (select answer_text from public.grading_submissions where external_id = 'ext-anh-0001'),
  E'13. x=18\n14. 8', 'a resend does not overwrite the stored answer');
select lives_ok(
  $$select public.record_grading_submission(
    'ext-anh-0002', timestamptz '2018-09-03 19:28+07', '13. 18 14. 8 15. 257', false, 'TV-2018-40041', 'Nguyễn Minh Anh', 2012::smallint,
    '3a000000-0000-4000-8000-000000000031', null, null, null, '3a000000-0000-4000-8000-000000000041',
    '3a000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'claimed_session', '{}')$$,
  'a second attempt is recorded');
select is(
  (select array_agg(external_id || ':' || attempt_no || ':' || counts_for_score::text order by attempt_no) from public.grading_submissions where student_id = '3a000000-0000-4000-8000-000000000041'),
  array['ext-anh-0001:1:false', 'ext-anh-0002:2:true']::text[], 'the latest attempt counts');
select is(
  (select superseded_by from public.grading_submissions where external_id = 'ext-anh-0001'),
  (select id from public.grading_submissions where external_id = 'ext-anh-0002'), 'the older attempt points at the latest');
-- A resend of an even earlier attempt arrives late: it becomes attempt 1 and does not count.
select lives_ok(
  $$select public.record_grading_submission(
    'ext-anh-0000', timestamptz '2018-09-03 19:20+07', '13. 17', false, 'TV-2018-40041', 'Nguyễn Minh Anh', 2012::smallint,
    null, 'CLC1 - Từ cơ bản đến nâng cao - Thầy Vinh', null, null, '3a000000-0000-4000-8000-000000000041',
    '3a000000-0000-4000-8000-000000000031', 'matched', 'student_code', 'time_window', '{}')$$,
  'a late resend of an older attempt is recorded');
select is(
  (select array_agg(external_id || ':' || attempt_no || ':' || counts_for_score::text order by attempt_no) from public.grading_submissions where student_id = '3a000000-0000-4000-8000-000000000041'),
  array['ext-anh-0000:1:false', 'ext-anh-0001:2:false', 'ext-anh-0002:3:true']::text[], 'a late older attempt never displaces the latest');
select throws_ok(
  $$select public.record_grading_submission(
    'ext-bad-0001', timestamptz '2018-09-03 19:28+07', 'x', false, null, 'Nguyễn Minh Anh', 2012::smallint,
    null, null, null, null, '3a000000-0000-4000-8000-000000000041', null, 'matched', 'name_birth_year', null, '{}')$$,
  '23514', null, 'matched needs both a student and a session');
select throws_ok(
  $$select public.record_grading_submission(
    'ext-bad-0002', timestamptz '2018-09-03 19:28+07', 'x', false, null, 'Nguyễn Minh Anh', 2012::smallint,
    null, null, null, null, null, null, 'ignored', null, null, '{}')$$,
  '22023', 'GRADING_SUBMISSION_MATCH_STATUS_INVALID', 'the webhook cannot mark a submission ignored');
select lives_ok(
  $$select public.record_grading_submission(
    'ext-anh-dup1', timestamptz '2018-09-03 19:30+07', '13. 18', false, null, 'Nguyen Minh  Anh', 2012::smallint,
    null, 'Khác', 'Lớp cô Hương', '{"v":1}', null, null, 'needs_review', null, null, array['student_ambiguous'])$$,
  'an ambiguous name is recorded for review');
select is(
  (select claimed_class_option || ' / ' || claimed_class_option_other || ' / ' || counts_for_score::text || ' / ' || coalesce(attempt_no::text, '-') from public.grading_submissions where external_id = 'ext-anh-dup1'),
  'Khác / Lớp cô Hương / false / -', 'the "Khác" text is kept and an unmatched row never counts');

-- 5. Screen readers -----------------------------------------------------------------
select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000002', true);
select is(
  (select array_agg(claimed_full_name || ':' || array_to_string(match_issues, ',')) from public.list_unmatched_grading_submissions(50)),
  array['Nguyen Minh  Anh:student_ambiguous']::text[], 'a TA sees the submission waiting for review');
select is(
  (select array_agg(student_public_code || ':' || attempt_no || ':' || counts_for_score::text order by attempt_no) from public.get_session_grading_submissions('3a000000-0000-4000-8000-000000000031')),
  array['TV-2018-40041:1:false', 'TV-2018-40041:2:false', 'TV-2018-40041:3:true']::text[], 'the session view lists every attempt');
set local role authenticated;
select is((select count(*) from public.grading_submissions), 4::bigint, 'RLS lets a TA read submissions');
reset role;

select set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select * from public.list_unmatched_grading_submissions(50)$$,
  '42501', 'AI_GRADING_VIEW_PERMISSION_DENIED', 'an accountant cannot list submissions');
select throws_ok(
  $$select * from public.get_session_grading_submissions('3a000000-0000-4000-8000-000000000031')$$,
  '42501', 'AI_GRADING_VIEW_PERMISSION_DENIED', 'an accountant cannot read a session''s submissions');
set local role authenticated;
select is((select count(*) from public.grading_submissions), 0::bigint, 'RLS hides submissions from an accountant');
reset role;

-- 6. raw_payload purge ----------------------------------------------------------------
update public.grading_submissions set received_at = now() - interval '31 days' where external_id = 'ext-anh-0001';
select is(public.purge_grading_submission_payloads(), 1, 'payloads older than 30 days are purged');
select is(
  (select array_agg(external_id || ':' || (raw_payload is null)::text order by external_id) from public.grading_submissions where external_id in ('ext-anh-0001', 'ext-anh-dup1')),
  array['ext-anh-0001:true', 'ext-anh-dup1:false']::text[], 'only the old payload is cleared');

select * from finish();
rollback;
