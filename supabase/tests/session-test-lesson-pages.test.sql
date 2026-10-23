begin;
select plan(28);

-- Fixtures: owner, TA, accountant. Grade-4 classes LP-4A and LP-4C, grade-5 class LP-5A.
-- S1 4A 21/10, S2 4C 22/10 (same week), S3 5A 22/10 (other grade), S4 4A 04/11 (two weeks later).
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3e400000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'lp-owner@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3e400000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'lp-ta@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('3e400000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'lp-accountant@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3e400000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3e400000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3e400000-0000-4000-8000-000000000003', id, 'fixture' from public.roles where code = 'accountant';
select set_config('request.jwt.claim.sub', '3e400000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3e400000-0000-4000-8000-000000000010', '2012-2013', 'Năm học slide', date '2012-08-01', date '2013-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count) values
  ('3e400000-0000-4000-8000-000000000011', '3e400000-0000-4000-8000-000000000010', 'LP-4A', 'Slide 4A', 4, 'A', 'active', 1),
  ('3e400000-0000-4000-8000-000000000012', '3e400000-0000-4000-8000-000000000010', 'LP-4C', 'Slide 4C', 4, 'A', 'active', 1),
  ('3e400000-0000-4000-8000-000000000013', '3e400000-0000-4000-8000-000000000010', 'LP-5A', 'Slide 5A', 5, 'A', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status) values
  ('3e400000-0000-4000-8000-000000000031', '3e400000-0000-4000-8000-000000000011', date '2012-10-21', 'additional', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('3e400000-0000-4000-8000-000000000032', '3e400000-0000-4000-8000-000000000012', date '2012-10-22', 'additional', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('3e400000-0000-4000-8000-000000000033', '3e400000-0000-4000-8000-000000000013', date '2012-10-22', 'additional', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('3e400000-0000-4000-8000-000000000034', '3e400000-0000-4000-8000-000000000011', date '2012-11-04', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');

select set_config('request.jwt.claim.sub', '3e400000-0000-4000-8000-000000000002', true);
create temporary table ids (name text primary key, id uuid) on commit drop;
insert into ids select 't1', public.create_session_test('3e400000-0000-4000-8000-000000000031');
insert into ids select 't2', public.create_session_test('3e400000-0000-4000-8000-000000000032');
insert into ids select 't3', public.create_session_test('3e400000-0000-4000-8000-000000000033');
insert into ids select 't4', public.create_session_test('3e400000-0000-4000-8000-000000000034');
select set_config('test.p1', (select id from ids where name = 't1') || '/11111111-1111-4111-8111-111111111111.jpg', true);
select set_config('test.p2', (select id from ids where name = 't1') || '/22222222-2222-4222-8222-222222222222.jpg', true);
insert into storage.objects (bucket_id, name, owner_id) values
  ('session-tests', current_setting('test.p1'), auth.uid()::text),
  ('session-tests', current_setting('test.p2'), auth.uid()::text);
create temporary table pages on commit drop as
select pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('storage_path', current_setting('test.p1'), 'mime_type', 'image/jpeg', 'sha256', repeat('a', 64), 'width', 1280, 'height', 1390),
  pg_catalog.jsonb_build_object('storage_path', current_setting('test.p2'), 'mime_type', 'image/jpeg', 'sha256', repeat('b', 64), 'width', 702, 'height', 2000)
) as value;

-- 1. Access ------------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.add_session_test_lesson_pages(uuid, jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.remove_session_test_lesson_page(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.list_session_lesson_sources(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.copy_session_test_lesson_pages(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.add_session_test_lesson_pages(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.copy_session_test_lesson_pages(uuid, uuid)', 'execute'),
  'signed-in users call the slide RPCs (each checks ai_grading.manage_tests), anonymous users cannot');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.session_test_lesson_pages'::regclass)
  and not has_table_privilege('authenticated', 'public.session_test_lesson_pages', 'insert'),
  'the slide table has RLS and no direct writes');
select set_config('request.jwt.claim.sub', '3e400000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select * from public.add_session_test_lesson_pages((select id from ids where name = 't1'), (select value from pages))$$,
  '42501', 'AI_GRADING_MANAGE_TESTS_PERMISSION_DENIED', 'an accountant cannot add slides');
select set_config('request.jwt.claim.sub', '3e400000-0000-4000-8000-000000000002', true);

-- 2. Adding slides -----------------------------------------------------------------------
select is(
  (select array_agg(page_no || ':' || added::text order by page_no) from public.add_session_test_lesson_pages((select id from ids where name = 't1'), (select value from pages))),
  array['1:true', '2:true'], 'the TA adds two slides in order');
select is(
  (select array_agg(added::text) from public.add_session_test_lesson_pages((select id from ids where name = 't1'), (select value from pages))),
  array['false', 'false'], 'the same slides again add nothing');
select throws_ok(
  $$select * from public.add_session_test_lesson_pages((select id from ids where name = 't1'),
     jsonb_build_array(jsonb_build_object('storage_path', (select id from ids where name = 't1') || '/33333333-3333-4333-8333-333333333333.jpg',
       'mime_type', 'image/jpeg', 'sha256', repeat('c', 64), 'width', 10, 'height', 10)))$$,
  'P0002', 'SESSION_TEST_ASSET_OBJECT_MISSING', 'a slide that was not uploaded is refused');
select throws_ok(
  $$select * from public.add_session_test_lesson_pages((select id from ids where name = 't2'), (select value from pages))$$,
  '22023', 'SESSION_TEST_LESSON_PAGES_INVALID', 'a slide stored under another test is refused');
select is(
  (select array_agg(page ->> 'page_no' || ':' || (page ->> 'width') order by (page ->> 'page_no')::integer)
   from jsonb_array_elements(public.get_session_test('3e400000-0000-4000-8000-000000000031') -> 'lesson_pages') as page),
  array['1:1280', '2:702'], 'the session test lists its slides');
select is(
  public.get_session_test('3e400000-0000-4000-8000-000000000032') -> 'lesson_pages', '[]'::jsonb, 'a test without slides lists none');

-- 3. Reusing slides within the week ------------------------------------------------------
select is(
  (select array_agg(class_code || ' ' || session_date::text || ' ' || page_count::text) from public.list_session_lesson_sources('3e400000-0000-4000-8000-000000000032')),
  array['LP-4A 2012-10-21 2'], 'a same-grade session one day later sees the slides');
select is((select count(*)::integer from public.list_session_lesson_sources('3e400000-0000-4000-8000-000000000033')), 0, 'another grade does not');
select is((select count(*)::integer from public.list_session_lesson_sources('3e400000-0000-4000-8000-000000000034')), 0, 'two weeks later does not');
select is(
  public.copy_session_test_lesson_pages((select id from ids where name = 't2'), (select id from ids where name = 't1')),
  2, 'the 4C session reuses both slides');
select is(
  public.copy_session_test_lesson_pages((select id from ids where name = 't2'), (select id from ids where name = 't1')),
  0, 'copying again adds nothing');
select is(
  (select count(distinct storage_path)::integer from public.session_test_lesson_pages
   where test_id in (select id from ids where name in ('t1', 't2'))),
  2, 'both tests point at the same two photos');
select throws_ok(
  $$select public.copy_session_test_lesson_pages((select id from ids where name = 't3'), (select id from ids where name = 't1'))$$,
  '22023', 'SESSION_TEST_LESSON_SOURCE_NOT_ELIGIBLE', 'another grade cannot copy them');
select throws_ok(
  $$select public.copy_session_test_lesson_pages((select id from ids where name = 't4'), (select id from ids where name = 't1'))$$,
  '22023', 'SESSION_TEST_LESSON_SOURCE_NOT_ELIGIBLE', 'a session two weeks later cannot copy them');

-- 4. Removing slides and deleting photos -------------------------------------------------
select is(
  (select still_referenced from public.remove_session_test_lesson_page(
     (select id from public.session_test_lesson_pages where test_id = (select id from ids where name = 't1') and page_no = 1))),
  true, 'removing a slide another test still uses keeps the photo');
select set_config('storage.allow_delete_query', 'true', true);
select is(
  (select array_agg(page_no::text || ':' || width::text) from public.session_test_lesson_pages where test_id = (select id from ids where name = 't1')),
  array['1:702'], 'the remaining slide moves up');
set local role authenticated;
delete from storage.objects where bucket_id = 'session-tests' and name = current_setting('test.p1');
reset role;
select is((select count(*)::integer from storage.objects where name = current_setting('test.p1')), 1, 'a photo another test still shows cannot be deleted');
select is(
  (select still_referenced from public.remove_session_test_lesson_page(
     (select id from public.session_test_lesson_pages where test_id = (select id from ids where name = 't2') and page_no = 1))),
  false, 'removing the last slide that uses the photo frees it');
set local role authenticated;
delete from storage.objects where bucket_id = 'session-tests' and name = current_setting('test.p1');
reset role;
select is((select count(*)::integer from storage.objects where name = current_setting('test.p1')), 0, 'then the photo can be deleted');

-- 5. Closed sessions ---------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '3e400000-0000-4000-8000-000000000001', true);
select public.cancel_class_session('3e400000-0000-4000-8000-000000000032', 'Nghỉ đột xuất');
select set_config('request.jwt.claim.sub', '3e400000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.remove_session_test_lesson_page((select id from public.session_test_lesson_pages where test_id = (select id from ids where name = 't2') limit 1))$$,
  '55000', 'SESSION_TEST_SESSION_CLOSED', 'slides of a cancelled session cannot change');

-- 6. Teacher's methods inside the key ----------------------------------------------------
select is(
  public.normalize_session_test_answer_key('{"questions": [], "methods": "  Dạng Tổng – Hiệu: Bé = (T − H) : 2  "}'::jsonb),
  '{"questions": [], "methods": "Dạng Tổng – Hiệu: Bé = (T − H) : 2"}'::jsonb, 'the key keeps the teacher''s methods, trimmed');
select is(
  public.normalize_session_test_answer_key('{"questions": [], "methods": "   "}'::jsonb), '{"questions": []}'::jsonb, 'blank methods are dropped');
select throws_ok(
  $$select public.normalize_session_test_answer_key('{"questions": [], "methods": ["x"]}'::jsonb)$$,
  '22023', 'SESSION_TEST_KEY_INVALID', 'methods must be text');
select throws_ok(
  format($$select public.normalize_session_test_answer_key(jsonb_build_object('questions', '[]'::jsonb, 'methods', %L))$$, repeat('x', 4001)),
  '22023', 'SESSION_TEST_KEY_TEXT_TOO_LONG', 'methods are at most 4,000 characters');
select public.save_session_test_draft((select id from ids where name = 't1'), 'Đề', null,
  '{"questions": [{"label": "1", "max_points": 10, "final_answer": "60"}], "methods": "Dạng Tổng – Hiệu: Bé = (T − H) : 2"}'::jsonb);
select is(
  (select answer_key ->> 'methods' from public.session_tests where id = (select id from ids where name = 't1')),
  'Dạng Tổng – Hiệu: Bé = (T − H) : 2', 'saving a draft stores the methods with the key');

select * from finish();
rollback;
