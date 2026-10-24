begin;
select plan(5);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('2f100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'zalo-unique-owner@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '2f100000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
select set_config('request.jwt.claim.sub', '2f100000-0000-4000-8000-000000000001', true);

insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status) values
  ('2f100000-0000-4000-8000-000000000041', 'TV-2018-31041', 'Trần Minh Khoa', 2013, 5, 'active'),
  ('2f100000-0000-4000-8000-000000000042', 'TV-2018-31042', 'Trần Minh Khang', 2013, 5, 'active');

select ok(
  (select i.indisunique from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid = i.indexrelid
   where c.relname = 'students_zalo_group_thread_key'),
  'the group thread index on students is unique');

select lives_ok(
  $$select public.link_student_zalo_group('2f100000-0000-4000-8000-000000000041', 'g-unique-1', 'nick-center', 'SLL Khoa')$$,
  'the first student links the group');

-- A save that slipped past the RPC's check (two tabs at once) reaches the update directly.
select throws_ok(
  $$update public.students set zalo_group_thread_id = 'g-unique-1' where id = '2f100000-0000-4000-8000-000000000042'$$,
  '23505', null, 'the database refuses a second student on the same group');

select lives_ok(
  $$select public.unlink_student_zalo_group('2f100000-0000-4000-8000-000000000041', 'Nhóm của em Khang')$$,
  'unlinking frees the group');
select lives_ok(
  $$select public.link_student_zalo_group('2f100000-0000-4000-8000-000000000042', 'g-unique-1', 'nick-center', 'SLL Khang')$$,
  'a freed group can be linked to another student');

select * from finish();
rollback;
