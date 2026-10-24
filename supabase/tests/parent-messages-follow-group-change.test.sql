begin;
select plan(5);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('2f200000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'zalo-follow-owner@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '2f200000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
select set_config('request.jwt.claim.sub', '2f200000-0000-4000-8000-000000000001', true);

insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status) values
  ('2f200000-0000-4000-8000-000000000041', 'TV-2018-32041', 'Vũ Ngọc Mai', 2013, 5, 'active');
select public.link_student_zalo_group('2f200000-0000-4000-8000-000000000041', 'g-old', 'nick-center', 'SLL nhầm');

insert into public.parent_messages (student_id, event_code, source_type, source_id, dedupe_key, thread_id, zalo_account_id, content, status, sent_at) values
  ('2f200000-0000-4000-8000-000000000041', 'session.comment', 'session_result', gen_random_uuid(), 'follow-1', 'g-old', 'nick-center', 'Tin chờ gửi', 'queued', null),
  ('2f200000-0000-4000-8000-000000000041', 'session.comment', 'session_result', gen_random_uuid(), 'follow-2', 'g-old', 'nick-center', 'Tin gửi lỗi', 'failed', null),
  ('2f200000-0000-4000-8000-000000000041', 'session.comment', 'session_result', gen_random_uuid(), 'follow-3', 'g-old', 'nick-center', 'Tin đã gửi', 'sent', now());

select lives_ok(
  $$select public.link_student_zalo_group('2f200000-0000-4000-8000-000000000041', 'g-right', 'nick-center', 'SLL Mai')$$,
  'staff fix the wrong link');
select is(
  (select count(*)::int from public.parent_messages where student_id = '2f200000-0000-4000-8000-000000000041' and status in ('queued', 'failed')),
  0, 'queued and failed messages for the old group are not sent there');
select is(
  (select pg_catalog.array_agg(status order by dedupe_key) from public.parent_messages where student_id = '2f200000-0000-4000-8000-000000000041'),
  array['skipped', 'skipped', 'sent']::text[], 'sent history is kept');

insert into public.parent_messages (student_id, event_code, source_type, source_id, dedupe_key, thread_id, zalo_account_id, content) values
  ('2f200000-0000-4000-8000-000000000041', 'session.comment', 'session_result', gen_random_uuid(), 'follow-4', 'g-right', 'nick-center', 'Tin vào nhóm đúng');
select lives_ok(
  $$update public.students set zalo_group_name_snapshot = 'SLL Mai (đổi tên)' where id = '2f200000-0000-4000-8000-000000000041'$$,
  'renaming the snapshot keeps the group');
select is(
  (select status from public.parent_messages where dedupe_key = 'follow-4'),
  'queued', 'a message for the current group stays queued');

select * from finish();
rollback;
