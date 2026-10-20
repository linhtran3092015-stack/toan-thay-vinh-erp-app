begin;
select plan(90);

-- Fixtures: owner, TA, accountant. On 2018-10-05: grade-6 sessions S1 (6A 18:00), S2 (6B 15:00),
-- S4 (6A 08:00), S6 (6B 19:00, cancelled later), S7 (6B 20:00, locked later); a grade-7 session S3
-- (7A 15:00); S5 (6B, cancelled) and a grade-6 session on another day S8.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3d000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'st-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3d000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'st-ta@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3d000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'st-accountant@example.test', '{"provider":"email"}', '{}', now(), now());
update public.profiles set display_name = 'Cô Ngọc' where id = '3d000000-0000-4000-8000-000000000002';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3d000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3d000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3d000000-0000-4000-8000-000000000003', id, 'fixture' from public.roles where code = 'accountant';
select set_config('request.jwt.claim.sub', '3d000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3d000000-0000-4000-8000-000000000010', '2018-2019', 'Năm học session tests', date '2018-08-01', date '2019-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count) values
  ('3d000000-0000-4000-8000-000000000011', '3d000000-0000-4000-8000-000000000010', 'ST-6A', 'Tests 6A', 6, 'A', 'active', 1),
  ('3d000000-0000-4000-8000-000000000012', '3d000000-0000-4000-8000-000000000010', 'ST-6B', 'Tests 6B', 6, 'B', 'active', 1),
  ('3d000000-0000-4000-8000-000000000013', '3d000000-0000-4000-8000-000000000010', 'ST-7A', 'Tests 7A', 7, 'A', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status) values
  ('3d000000-0000-4000-8000-000000000031', '3d000000-0000-4000-8000-000000000011', date '2018-10-05', 'additional', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('3d000000-0000-4000-8000-000000000032', '3d000000-0000-4000-8000-000000000012', date '2018-10-05', 'additional', time '15:00', time '16:30', 'offline', 'scheduled'),
  ('3d000000-0000-4000-8000-000000000033', '3d000000-0000-4000-8000-000000000013', date '2018-10-05', 'additional', time '15:00', time '16:30', 'offline', 'scheduled'),
  ('3d000000-0000-4000-8000-000000000034', '3d000000-0000-4000-8000-000000000011', date '2018-10-05', 'additional', time '08:00', time '09:30', 'offline', 'scheduled'),
  ('3d000000-0000-4000-8000-000000000035', '3d000000-0000-4000-8000-000000000012', date '2018-10-05', 'additional', time '10:00', time '11:30', 'offline', 'scheduled'),
  ('3d000000-0000-4000-8000-000000000036', '3d000000-0000-4000-8000-000000000012', date '2018-10-05', 'additional', time '19:00', time '20:30', 'offline', 'scheduled'),
  ('3d000000-0000-4000-8000-000000000037', '3d000000-0000-4000-8000-000000000012', date '2018-10-05', 'additional', time '20:00', time '21:30', 'offline', 'scheduled'),
  ('3d000000-0000-4000-8000-000000000038', '3d000000-0000-4000-8000-000000000011', date '2018-10-06', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');
select public.cancel_class_session('3d000000-0000-4000-8000-000000000035', 'Nghỉ lễ');

-- A valid key (2 + 2 + 2 + 2 + 2) and helpers to build variants.
create temporary table keys (name text primary key, key jsonb) on commit drop;
insert into keys values
  ('valid', '{"questions": [
    {"label": "13", "prompt_text": "Tìm x", "max_points": 2, "final_answer": "54", "accepted_equivalents": ["x = 54"], "solution_steps": ["x = 6 . 9", "x = 54"]},
    {"label": "14", "prompt_text": "", "max_points": 2, "final_answer": "8", "accepted_equivalents": [], "solution_steps": []},
    {"label": "15", "prompt_text": "", "max_points": 2, "final_answer": "257", "accepted_equivalents": [], "solution_steps": []},
    {"label": "16", "prompt_text": "", "max_points": 2, "final_answer": "7 cm", "accepted_equivalents": ["7"], "solution_steps": ["BM = 14 : 2 = 7 (cm)"]},
    {"label": "17", "prompt_text": "", "max_points": 2, "final_answer": "12 cm", "accepted_equivalents": ["12"], "solution_steps": []}
  ]}'),
  ('nine', '{"questions": [
    {"label": "1", "max_points": 4.5, "final_answer": "a"}, {"label": "2", "max_points": 4.5, "final_answer": "b"}
  ]}'),
  ('quarters', '{"questions": [
    {"label": "1", "max_points": 2.25, "final_answer": "a"}, {"label": "2", "max_points": 2.75, "final_answer": "b"},
    {"label": "3", "max_points": 5, "final_answer": "c"}
  ]}'),
  ('draft', '{"questions": [
    {"label": " 1 ", "prompt_text": "  Đề câu 1 ", "max_points": null, "final_answer": "", "accepted_equivalents": ["  ", " 1/2 "], "solution_steps": ["", " Bước 1 "], "extra": true},
    {"label": "2"}
  ]}');

-- 1. Structure and grants ----------------------------------------------------------------
select has_table('public', 'session_tests', 'session_tests exists');
select has_table('public', 'session_test_assets', 'session_test_assets exists');
select has_table('public', 'grading_runs', 'grading_runs exists');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.session_tests'::regclass, 'public.session_test_assets'::regclass, 'public.grading_runs'::regclass)),
  'RLS is on for all three tables');
select is(
  (select array[public::text, file_size_limit::text, array_to_string(allowed_mime_types, ',')] from storage.buckets where id = 'session-tests'),
  array['false', '10485760', 'image/jpeg,image/png,image/webp,image/gif'],
  'the session-tests bucket is private and image-only');
select is(
  (select array_agg(role.code || ':' || permission.code order by role.code, permission.code)
   from public.role_permissions as grant_row
   join public.roles as role on role.id = grant_row.role_id
   join public.permissions as permission on permission.id = grant_row.permission_id
   where permission.code in ('ai_grading.manage_tests', 'ai_grading.confirm_key')),
  array[
    'assistant_manager:ai_grading.confirm_key', 'assistant_manager:ai_grading.manage_tests',
    'operations_manager:ai_grading.confirm_key', 'operations_manager:ai_grading.manage_tests',
    'owner:ai_grading.confirm_key', 'owner:ai_grading.manage_tests',
    'teaching_assistant:ai_grading.confirm_key', 'teaching_assistant:ai_grading.manage_tests'
  ],
  'manage_tests and confirm_key go to owner, both managers and TAs only');
select is(
  (select count(*)::integer from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in (
       'get_session_test', 'list_session_test_sources', 'create_session_test', 'add_session_test_assets',
       'remove_session_test_asset', 'reorder_session_test_assets', 'save_session_test_draft', 'confirm_session_test_key',
       'copy_session_test_key', 'request_session_test_key_extraction', 'cancel_session_test_key_extraction',
       'session_test_object_insert_allowed', 'session_test_object_delete_allowed', 'lock_open_session_test',
       'require_session_test_permission', 'session_test_actor_name', 'cancel_queued_key_extractions')
     and prosecdef and proconfig @> array['search_path=""']),
  17, 'every definer function pins search_path to empty');
select ok(
  not has_function_privilege('anon', 'public.get_session_test(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.list_session_test_sources(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.create_session_test(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.add_session_test_assets(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.remove_session_test_asset(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.reorder_session_test_assets(uuid, uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.save_session_test_draft(uuid, text, text, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.confirm_session_test_key(uuid, text, text, jsonb, integer, text)', 'execute')
  and not has_function_privilege('anon', 'public.copy_session_test_key(uuid, uuid, integer, text)', 'execute')
  and not has_function_privilege('anon', 'public.request_session_test_key_extraction(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.cancel_session_test_key_extraction(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.session_test_object_insert_allowed(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.session_test_object_delete_allowed(text, text)', 'execute'),
  'anon cannot call any session test function');
select ok(
  has_function_privilege('authenticated', 'public.get_session_test(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.confirm_session_test_key(uuid, text, text, jsonb, integer, text)', 'execute')
  and has_function_privilege('authenticated', 'public.copy_session_test_key(uuid, uuid, integer, text)', 'execute')
  and has_function_privilege('authenticated', 'public.session_test_object_insert_allowed(text, text)', 'execute'),
  'signed-in staff can call the RPCs (each checks its own permission)');
select ok(
  not has_function_privilege('authenticated', 'public.normalize_session_test_answer_key(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.lock_open_session_test(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.require_session_test_permission(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.cancel_queued_key_extractions(uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.lock_open_session_test(uuid)', 'execute'),
  'internal helpers are not callable directly');
select ok(
  not has_table_privilege('authenticated', 'public.session_tests', 'insert')
  and not has_table_privilege('authenticated', 'public.session_tests', 'update')
  and not has_table_privilege('authenticated', 'public.session_test_assets', 'delete')
  and not has_table_privilege('authenticated', 'public.grading_runs', 'insert')
  and not has_table_privilege('anon', 'public.session_tests', 'select'),
  'tables are read-only for staff and closed to anon');

-- 2. Guards ------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.create_session_test('3d000000-0000-4000-8000-000000000031')$$,
  '28000', 'AUTHENTICATION_REQUIRED', 'creating a test needs a signed-in user');

select set_config('request.jwt.claim.sub', '3d000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.create_session_test('3d000000-0000-4000-8000-000000000031')$$,
  '42501', 'AI_GRADING_MANAGE_TESTS_PERMISSION_DENIED', 'an accountant cannot create a test');
select throws_ok(
  $$select public.get_session_test('3d000000-0000-4000-8000-000000000031')$$,
  '42501', 'AI_GRADING_VIEW_PERMISSION_DENIED', 'an accountant cannot read a test');

-- Everything below runs as the TA unless it says otherwise.
select set_config('request.jwt.claim.sub', '3d000000-0000-4000-8000-000000000002', true);
select is(public.get_session_test('3d000000-0000-4000-8000-000000000031'), null::jsonb, 'a session without a test reads as null');
select set_config('test.s1', public.create_session_test('3d000000-0000-4000-8000-000000000031')::text, true);
select is(public.create_session_test('3d000000-0000-4000-8000-000000000031')::text, current_setting('test.s1'), 'creating twice returns the same draft test');
select is(
  (select status || ':' || answer_key_version || ':' || (answer_key = '{"questions": []}'::jsonb)::text from public.session_tests where id = current_setting('test.s1')::uuid),
  'draft:0:true', 'a new test is an empty draft at version 0');
select throws_ok(
  $$select public.create_session_test('3d000000-0000-4000-8000-000000000035')$$,
  '55000', 'SESSION_TEST_SESSION_CLOSED', 'a cancelled session cannot get a test');

-- 3. Storage policies --------------------------------------------------------------------
select set_config('test.s1_a', current_setting('test.s1') || '/3d000000-0000-4000-8000-0000000000a1.jpg', true);
select set_config('test.s1_b', current_setting('test.s1') || '/3d000000-0000-4000-8000-0000000000a2.jpg', true);
select set_config('test.s1_c', current_setting('test.s1') || '/3d000000-0000-4000-8000-0000000000a3.jpg', true);

set local role authenticated;
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata) values
    ('session-tests', current_setting('test.s1_a'), auth.uid()::text, '{"mimetype": "image/jpeg", "size": 1000}'),
    ('session-tests', current_setting('test.s1_b'), auth.uid()::text, '{"mimetype": "image/jpeg", "size": 1000}'),
    ('session-tests', current_setting('test.s1_c'), auth.uid()::text, '{"mimetype": "image/jpeg", "size": 1000}')$$,
  'a TA can upload pages into the folder of an open test');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('session-tests', 'loose/photo.jpg', auth.uid()::text)$$,
  '42501', null, 'uploads outside {test_id}/{uuid}.ext are refused');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values
    ('session-tests', '3d000000-0000-4000-8000-0000000000ff/3d000000-0000-4000-8000-0000000000a9.jpg', auth.uid()::text)$$,
  '42501', null, 'uploads into the folder of a test that does not exist are refused');
select is((select count(*)::integer from storage.objects where bucket_id = 'session-tests'), 3, 'the TA sees the uploaded pages');
reset role;

select set_config('request.jwt.claim.sub', '3d000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values
    ('session-tests', current_setting('test.s1') || '/3d000000-0000-4000-8000-0000000000a8.jpg', auth.uid()::text)$$,
  '42501', null, 'an accountant cannot upload test photos');
select is((select count(*)::integer from storage.objects where bucket_id = 'session-tests'), 0, 'an accountant cannot see test photos');
select is((select count(*)::integer from public.session_tests), 0, 'RLS hides tests from an accountant');
reset role;
select set_config('request.jwt.claim.sub', '3d000000-0000-4000-8000-000000000002', true);

-- 4. Pages -------------------------------------------------------------------------------
select is(
  (select array_agg(page_no || ':' || added::text order by page_no) from public.add_session_test_assets(
    current_setting('test.s1')::uuid,
    jsonb_build_array(
      jsonb_build_object('storage_path', current_setting('test.s1_a'), 'mime_type', 'image/jpeg', 'sha256', repeat('a', 64), 'width', 2576, 'height', 1932),
      jsonb_build_object('storage_path', current_setting('test.s1_b'), 'mime_type', 'image/jpeg', 'sha256', repeat('b', 64), 'width', 1932, 'height', 2576)))),
  array['1:true', '2:true'], 'uploaded pages are appended in order');
select is(
  (select array_agg(page_no || ':' || added::text) from public.add_session_test_assets(
    current_setting('test.s1')::uuid,
    jsonb_build_array(jsonb_build_object('storage_path', current_setting('test.s1_c'), 'mime_type', 'image/jpeg', 'sha256', repeat('B', 64), 'width', 10, 'height', 10)))),
  array['2:false'], 'the same photo again (same sha256) is not added twice');
select throws_ok(
  format($$select * from public.add_session_test_assets(%L::uuid, jsonb_build_array(jsonb_build_object(
    'storage_path', %L, 'mime_type', 'image/jpeg', 'sha256', repeat('c', 64), 'width', 10, 'height', 10)))$$,
    current_setting('test.s1'), current_setting('test.s1') || '/3d000000-0000-4000-8000-0000000000a7.jpg'),
  'P0002', 'SESSION_TEST_ASSET_OBJECT_MISSING', 'a page must be uploaded to Storage first');
select throws_ok(
  format($$select * from public.add_session_test_assets(%L::uuid, jsonb_build_array(jsonb_build_object(
    'storage_path', '3d000000-0000-4000-8000-0000000000ff/3d000000-0000-4000-8000-0000000000a7.jpg', 'mime_type', 'image/jpeg', 'sha256', repeat('c', 64), 'width', 10, 'height', 10)))$$,
    current_setting('test.s1')),
  '22023', 'SESSION_TEST_ASSETS_INVALID', 'a page must live in its own test folder');
select throws_ok(
  format($$select * from public.add_session_test_assets(%L::uuid, jsonb_build_array(jsonb_build_object(
    'storage_path', %L, 'mime_type', 'image/heic', 'sha256', repeat('c', 64), 'width', 10, 'height', 10)))$$,
    current_setting('test.s1'), current_setting('test.s1_c')),
  '22023', 'SESSION_TEST_ASSETS_INVALID', 'HEIC is not an accepted page type');

select lives_ok(
  format($$select public.reorder_session_test_assets(%L::uuid, array[
    (select id from public.session_test_assets where storage_path = %L),
    (select id from public.session_test_assets where storage_path = %L)])$$,
    current_setting('test.s1'), current_setting('test.s1_b'), current_setting('test.s1_a')),
  'pages can be swapped');
select is(
  (select array_agg(sha256 order by page_no) from public.session_test_assets where test_id = current_setting('test.s1')::uuid),
  array[repeat('b', 64), repeat('a', 64)], 'the swap is saved');
select throws_ok(
  format($$select public.reorder_session_test_assets(%L::uuid, array[(select id from public.session_test_assets where storage_path = %L)])$$,
    current_setting('test.s1'), current_setting('test.s1_a')),
  '22023', 'SESSION_TEST_PAGE_ORDER_INVALID', 'a reorder must list every page exactly once');

-- Page 3 (sha c), then remove page 1: the rest move up.
select is(
  (select array_agg(page_no) from public.add_session_test_assets(
    current_setting('test.s1')::uuid,
    jsonb_build_array(jsonb_build_object('storage_path', current_setting('test.s1_c'), 'mime_type', 'image/jpeg', 'sha256', repeat('c', 64), 'width', 10, 'height', 10)))),
  array[3], 'a third page is added at the end');
select is(
  (select storage_path || ':' || still_referenced::text from public.remove_session_test_asset(
    (select id from public.session_test_assets where storage_path = current_setting('test.s1_b')))),
  current_setting('test.s1_b') || ':false', 'removing a page reports that nothing else uses the photo');
select is(
  (select array_agg(sha256 || ':' || page_no order by page_no) from public.session_test_assets where test_id = current_setting('test.s1')::uuid),
  array[repeat('a', 64) || ':1', repeat('c', 64) || ':2'], 'later pages move up after a removal');

select set_config('storage.allow_delete_query', 'true', true);
set local role authenticated;
delete from storage.objects where bucket_id = 'session-tests' and name in (current_setting('test.s1_a'), current_setting('test.s1_b'));
reset role;
select ok(
  exists (select 1 from storage.objects where bucket_id = 'session-tests' and name = current_setting('test.s1_a')),
  'a photo still used by a page cannot be deleted');
select ok(
  not exists (select 1 from storage.objects where bucket_id = 'session-tests' and name = current_setting('test.s1_b')),
  'a photo no page uses any more can be deleted');

-- 5. Drafts and key validation -----------------------------------------------------------
select is(
  public.save_session_test_draft(current_setting('test.s1')::uuid, '  ', null, '{"questions": []}'),
  'draft', 'an empty key stays a draft');
select is(
  public.save_session_test_draft(current_setting('test.s1')::uuid, ' Đề lớp 6 ', ' Chấp nhận thiếu đơn vị ', (select key from keys where name = 'draft')),
  'key_review', 'a key with questions waits for confirmation');
select is(
  (select answer_key from public.session_tests where id = current_setting('test.s1')::uuid),
  '{"questions": [
    {"label": "1", "prompt_text": "Đề câu 1", "max_points": null, "final_answer": "", "accepted_equivalents": ["1/2"], "solution_steps": ["Bước 1"]},
    {"label": "2", "prompt_text": "", "max_points": null, "final_answer": "", "accepted_equivalents": [], "solution_steps": []}
  ]}'::jsonb,
  'the saved key is trimmed, empty lines and unknown fields dropped');
select is(
  (select title || ' | ' || marking_guide from public.session_tests where id = current_setting('test.s1')::uuid),
  'Đề lớp 6 | Chấp nhận thiếu đơn vị', 'title and marking guide are trimmed');
select throws_ok(
  format($$select public.save_session_test_draft(%L::uuid, null, null, '{"questions": [{"label": "1"}, {"label": " 1 "}]}')$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_LABEL_DUPLICATE', 'question labels must be unique');
select throws_ok(
  format($$select public.save_session_test_draft(%L::uuid, null, null, '{"questions": [{"label": "1", "max_points": 0.3}]}')$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_POINTS_INVALID', 'points go in steps of 0.25');
select throws_ok(
  format($$select public.save_session_test_draft(%L::uuid, null, null, '{"questions": [{"label": "1", "max_points": "2"}]}')$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_INVALID', 'points must be a number');
select throws_ok(
  format($$select public.save_session_test_draft(%L::uuid, null, null, '{"questions": [{"label": ""}]}')$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_LABEL_INVALID', 'every question needs a label');
select throws_ok(
  format($$select public.save_session_test_draft(%L::uuid, null, null, '[]')$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_INVALID', 'the key must be an object with questions');

-- 6. Confirm -----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '3d000000-0000-4000-8000-000000000003', true);
select throws_ok(
  format($$select * from public.confirm_session_test_key(%L::uuid, null, null, (select key from keys where name = 'valid'), 0)$$, current_setting('test.s1')),
  '42501', 'AI_GRADING_CONFIRM_KEY_PERMISSION_DENIED', 'an accountant cannot confirm a key');
select set_config('request.jwt.claim.sub', '3d000000-0000-4000-8000-000000000002', true);

select throws_ok(
  format($$select * from public.confirm_session_test_key(%L::uuid, null, null, (select key from keys where name = 'nine'), 0)$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_TOTAL_NOT_TEN', 'points must add up to exactly 10');
select throws_ok(
  format($$select * from public.confirm_session_test_key(%L::uuid, null, null, (select key from keys where name = 'draft'), 0)$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_POINTS_MISSING', 'every question needs points before confirming');
select throws_ok(
  format($$select * from public.confirm_session_test_key(%L::uuid, null, null, '{"questions": [{"label": "1", "max_points": 10, "final_answer": "  "}]}', 0)$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_FINAL_ANSWER_MISSING', 'every question needs a final answer before confirming');
select throws_ok(
  format($$select * from public.confirm_session_test_key(%L::uuid, null, null, '{"questions": []}', 0)$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_EMPTY', 'an empty key cannot be confirmed');
select throws_ok(
  format($$select * from public.confirm_session_test_key(%L::uuid, null, null, (select key from keys where name = 'valid'), 1)$$, current_setting('test.s1')),
  '40001', 'SESSION_TEST_VERSION_CONFLICT', 'confirming checks the version the user was editing');
select is(
  (select answer_key_version from public.confirm_session_test_key(current_setting('test.s1')::uuid, 'Đề lớp 6', null, (select key from keys where name = 'quarters'), 0)),
  1, 'a key of 2.25 + 2.75 + 5 confirms as version 1');
select is(
  (select status || ':' || answer_key_version || ':' || confirmed_by::text || ':' || coalesce(marking_guide, '-') from public.session_tests where id = current_setting('test.s1')::uuid),
  'key_confirmed:1:3d000000-0000-4000-8000-000000000002:-', 'the TA is recorded as the confirmer');
select is(
  (select action || ':' || actor_user_id::text || ':' || (new_data ->> 'answer_key_version') || ':' || (new_data ->> 'question_count')
   from public.audit_logs where entity_type = 'session_test' and entity_id = current_setting('test.s1')),
  'session_test_key_confirmed:3d000000-0000-4000-8000-000000000002:1:3', 'confirming writes an audit row');
select throws_ok(
  format($$select public.save_session_test_draft(%L::uuid, null, null, '{"questions": []}')$$, current_setting('test.s1')),
  '55000', 'SESSION_TEST_ALREADY_CONFIRMED', 'a confirmed key is not edited as a draft');

-- Editing after confirm: reason required, must change something, new version.
select throws_ok(
  format($$select * from public.confirm_session_test_key(%L::uuid, 'Đề lớp 6', null, (select key from keys where name = 'valid'), 1)$$, current_setting('test.s1')),
  '22023', 'REASON_REQUIRED', 'editing a confirmed key needs a reason');
select throws_ok(
  format($$select * from public.confirm_session_test_key(%L::uuid, 'Đề lớp 6', null, (select key from keys where name = 'quarters'), 1, 'Sửa lại')$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_UNCHANGED', 'an edit that changes nothing is refused');
select throws_ok(
  format($$select * from public.confirm_session_test_key(%L::uuid, 'Đề lớp 6', null, (select key from keys where name = 'valid'), 0, 'Sửa lại')$$, current_setting('test.s1')),
  '40001', 'SESSION_TEST_VERSION_CONFLICT', 'an edit based on an old version is refused');
select is(
  (select answer_key_version from public.confirm_session_test_key(current_setting('test.s1')::uuid, 'Đề lớp 6', null, (select key from keys where name = 'valid'), 1, 'Nhập lại theo đề in')),
  2, 'editing a confirmed key creates version 2');
select is(
  (select (old_data ->> 'answer_key_version') || ':' || (new_data ->> 'answer_key_version') || ':' || reason
   from public.audit_logs where entity_id = current_setting('test.s1') and action = 'session_test_key_revised'),
  '1:2:Nhập lại theo đề in', 'the edit is audited with the old version and the reason');

-- 7. AI key reading queue ----------------------------------------------------------------
select throws_ok(
  format($$select public.request_session_test_key_extraction(%L::uuid)$$, current_setting('test.s1')),
  '55000', 'SESSION_TEST_ALREADY_CONFIRMED', 'AI reading is not offered once the key is confirmed');
select set_config('test.s2', public.create_session_test('3d000000-0000-4000-8000-000000000032')::text, true);
select throws_ok(
  format($$select public.request_session_test_key_extraction(%L::uuid)$$, current_setting('test.s2')),
  '55000', 'SESSION_TEST_NO_PAGES', 'AI reading needs at least one page');
insert into storage.objects (bucket_id, name, owner_id) values
  ('session-tests', current_setting('test.s2') || '/3d000000-0000-4000-8000-0000000000b1.jpg', '3d000000-0000-4000-8000-000000000002');
select is(
  (select count(*)::integer from public.add_session_test_assets(current_setting('test.s2')::uuid, jsonb_build_array(jsonb_build_object(
    'storage_path', current_setting('test.s2') || '/3d000000-0000-4000-8000-0000000000b1.jpg', 'mime_type', 'image/jpeg', 'sha256', repeat('d', 64), 'width', 800, 'height', 600)))),
  1, 'S2 gets its own page');
select set_config('test.run1', public.request_session_test_key_extraction(current_setting('test.s2')::uuid)::text, true);
select is(
  (select run_type || ':' || status || ':' || model || ':' || effort || ':' || prompt_version || ':' || requested_by::text from public.grading_runs where id = current_setting('test.run1')::uuid),
  'extract_key:queued:claude-opus-5-5:high:key-v1:3d000000-0000-4000-8000-000000000002', 'AI reading queues one extract_key run on Opus 5.5 at high effort');
select throws_ok(
  format($$select public.request_session_test_key_extraction(%L::uuid)$$, current_setting('test.s2')),
  '55000', 'SESSION_TEST_EXTRACTION_ACTIVE', 'only one AI reading can wait per test');
select is(
  public.get_session_test('3d000000-0000-4000-8000-000000000032') -> 'extraction' ->> 'status', 'queued', 'the test shows the waiting run');
select is(public.cancel_session_test_key_extraction(current_setting('test.s2')::uuid), 1, 'a waiting run can be cancelled');
select throws_ok(
  format($$select public.cancel_session_test_key_extraction(%L::uuid)$$, current_setting('test.s2')),
  '55000', 'SESSION_TEST_EXTRACTION_NOT_QUEUED', 'there is nothing left to cancel');
select set_config('test.run2', public.request_session_test_key_extraction(current_setting('test.s2')::uuid)::text, true);

-- 8. Reuse a confirmed test ("Dùng đề có sẵn") --------------------------------------------
select is(
  (select array_agg(class_code || ':' || answer_key_version || ':' || page_count || ':' || confirmed_by_name) from public.list_session_test_sources('3d000000-0000-4000-8000-000000000032')),
  array['ST-6A:2:2:Cô Ngọc'], 'a grade-6 session sees the confirmed grade-6 test of the same day');
select is(
  (select count(*)::integer from public.list_session_test_sources('3d000000-0000-4000-8000-000000000033')),
  0, 'a grade-7 session sees nothing');
select is(
  (select count(*)::integer from public.list_session_test_sources('3d000000-0000-4000-8000-000000000038')),
  0, 'a session on another day sees nothing');
select throws_ok(
  format($$select * from public.copy_session_test_key('3d000000-0000-4000-8000-000000000033', %L::uuid, 0)$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_SOURCE_NOT_ELIGIBLE', 'a test of another grade cannot be reused');
select throws_ok(
  format($$select * from public.copy_session_test_key('3d000000-0000-4000-8000-000000000031', %L::uuid, 0)$$, current_setting('test.s2')),
  'P0002', 'SESSION_TEST_SOURCE_NOT_FOUND', 'an unconfirmed test cannot be reused');
select is(
  (select answer_key_version || ':' || copied_pages from public.copy_session_test_key('3d000000-0000-4000-8000-000000000032', current_setting('test.s1')::uuid, 0)),
  '1:0', 'S2 reuses the S1 key at version 1 and keeps its own page');
select is(
  (select status || ':' || (answer_key = (select answer_key from public.session_tests where id = current_setting('test.s1')::uuid))::text || ':' || source_test_id::text || ':' || title
   from public.session_tests where id = current_setting('test.s2')::uuid),
  'key_confirmed:true:' || current_setting('test.s1') || ':Đề lớp 6', 'the copy is confirmed with the same key and remembers its source');
select is(
  (select status || ':' || error_code from public.grading_runs where id = current_setting('test.run2')::uuid),
  'cancelled:cancelled_by_confirm', 'confirming cancels the waiting AI reading');
select is(
  (select answer_key_version || ':' || copied_pages from public.copy_session_test_key('3d000000-0000-4000-8000-000000000034', current_setting('test.s1')::uuid, 0)),
  '1:2', 'a session without a test gets one, with the source pages');
select is(
  (select array_agg(asset.storage_path order by asset.page_no) from public.session_test_assets as asset
   join public.session_tests as test on test.id = asset.test_id where test.class_session_id = '3d000000-0000-4000-8000-000000000034'),
  array[current_setting('test.s1_a'), current_setting('test.s1_c')], 'copied pages point at the same photos');
select is(
  (select (new_data ->> 'source_test_id') || ':' || (new_data ->> 'copied_pages') || ':' || actor_user_id::text
   from public.audit_logs as log join public.session_tests as test on log.entity_id = test.id::text
   where test.class_session_id = '3d000000-0000-4000-8000-000000000034' and log.action = 'session_test_key_copied'),
  current_setting('test.s1') || ':2:3d000000-0000-4000-8000-000000000002', 'reusing a test is audited');
select throws_ok(
  format($$select * from public.copy_session_test_key('3d000000-0000-4000-8000-000000000034', %L::uuid, 1)$$, current_setting('test.s1')),
  '22023', 'REASON_REQUIRED', 'reusing over a confirmed key needs a reason');
select throws_ok(
  format($$select * from public.copy_session_test_key('3d000000-0000-4000-8000-000000000034', %L::uuid, 1, 'Dùng lại')$$, current_setting('test.s1')),
  '22023', 'SESSION_TEST_KEY_UNCHANGED', 'reusing the same key again changes nothing');
select is(
  (select storage_path || ':' || still_referenced::text from public.remove_session_test_asset(
    (select asset.id from public.session_test_assets as asset join public.session_tests as test on test.id = asset.test_id
     where test.class_session_id = '3d000000-0000-4000-8000-000000000034' and asset.page_no = 1))),
  current_setting('test.s1_a') || ':true', 'removing a shared page keeps the photo for the source test');

-- 9. Closed sessions are read-only --------------------------------------------------------
select set_config('test.s6', public.create_session_test('3d000000-0000-4000-8000-000000000036')::text, true);
select set_config('test.s7', public.create_session_test('3d000000-0000-4000-8000-000000000037')::text, true);
select set_config('request.jwt.claim.sub', '3d000000-0000-4000-8000-000000000001', true);
select public.cancel_class_session('3d000000-0000-4000-8000-000000000036', 'Mất điện');
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status)
values ('3d000000-0000-4000-8000-000000000041', 'TV-2018-60041', 'Học sinh buổi khóa', 2012, 6, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to)
values ('3d000000-0000-4000-8000-000000000051', '3d000000-0000-4000-8000-000000000041', '3d000000-0000-4000-8000-000000000012', 'offline', 'active', date '2018-08-01', null);
select public.start_class_session('3d000000-0000-4000-8000-000000000037');
insert into public.session_attendance (class_session_id, student_id, student_enrollment_id, attendance_status, actual_learning_mode, marked_at, marked_by)
values ('3d000000-0000-4000-8000-000000000037', '3d000000-0000-4000-8000-000000000041', '3d000000-0000-4000-8000-000000000051', 'excused_absence', 'offline', now(), '3d000000-0000-4000-8000-000000000001');
select public.complete_class_session('3d000000-0000-4000-8000-000000000037');
select public.lock_class_session('3d000000-0000-4000-8000-000000000037', 'Đã đối soát điểm danh');
select set_config('request.jwt.claim.sub', '3d000000-0000-4000-8000-000000000002', true);
select throws_ok(
  format($$select public.save_session_test_draft(%L::uuid, null, null, '{"questions": []}')$$, current_setting('test.s6')),
  '55000', 'SESSION_TEST_SESSION_CLOSED', 'a cancelled session''s test cannot be edited');
select throws_ok(
  format($$select * from public.confirm_session_test_key(%L::uuid, null, null, (select key from keys where name = 'valid'), 0)$$, current_setting('test.s7')),
  '55000', 'SESSION_TEST_SESSION_CLOSED', 'a locked session''s key cannot be confirmed');
set local role authenticated;
select throws_ok(
  format($$insert into storage.objects (bucket_id, name, owner_id) values ('session-tests', %L, auth.uid()::text)$$,
    current_setting('test.s7') || '/3d000000-0000-4000-8000-0000000000c1.jpg'),
  '42501', null, 'photos cannot be uploaded to a locked session''s test');
reset role;

-- 10. Reading ----------------------------------------------------------------------------
select is(
  (select array[t ->> 'status', t ->> 'answer_key_version', t ->> 'confirmed_by_name', jsonb_array_length(t -> 'assets')::text, (t -> 'source' ->> 'class_code')]
   from (select public.get_session_test('3d000000-0000-4000-8000-000000000032') as t) as read),
  array['key_confirmed', '1', 'Cô Ngọc', '1', 'ST-6A'], 'the session view returns the key, confirmer, pages and source');
set local role authenticated;
select is((select count(*)::integer from public.session_tests), 5, 'RLS lets a TA read tests');
select is((select count(*)::integer from public.grading_runs), 2, 'RLS lets a TA read AI runs');
reset role;

select * from finish();
rollback;
