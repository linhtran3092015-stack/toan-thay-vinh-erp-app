begin;

select plan(10);

select ok(
  to_regprocedure('public.bulk_transition_student_lifecycle_status(text,text,integer,uuid[],text)') is not null,
  'bulk student status transition RPC exists'
);
select is(
  (select pg_catalog.array_to_string(proconfig, ',') from pg_proc where oid = 'public.bulk_transition_student_lifecycle_status(text,text,integer,uuid[],text)'::regprocedure),
  'search_path=""',
  'bulk transition RPC keeps its hardened search path'
);

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('c2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'bulk-status-owner@example.test', '{}', '{}', now(), now());
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'c2000000-0000-0000-0000-000000000001', id, 'bulk status transition test'
from public.roles
where code = 'owner';
select set_config('request.jwt.claim.sub', 'c2000000-0000-0000-0000-000000000001', true);

insert into public.students(id, public_code, full_name, birth_year, current_grade, lifecycle_status) values
  ('c2000000-0000-0000-0000-000000000011', 'TV-2030-20011', 'Bulk status one', 2020, 5, 'interested'),
  ('c2000000-0000-0000-0000-000000000012', 'TV-2030-20012', 'Bulk status two', 2020, 5, 'interested'),
  ('c2000000-0000-0000-0000-000000000013', 'TV-2030-20013', 'Bulk status untouched', 2020, 5, 'interested');

select lives_ok(
  $$select public.bulk_transition_student_lifecycle_status('interested', 'active', 2, array['c2000000-0000-0000-0000-000000000011'::uuid, 'c2000000-0000-0000-0000-000000000012'::uuid], 'Regression test')$$,
  'selected rows can be locked, counted, and transitioned without an aggregate FOR UPDATE error'
);
select is(
  (select count(*) from public.students where id in ('c2000000-0000-0000-0000-000000000011', 'c2000000-0000-0000-0000-000000000012') and lifecycle_status = 'active')::integer,
  2,
  'both selected students are transitioned'
);
select is(
  (select lifecycle_status from public.students where id = 'c2000000-0000-0000-0000-000000000013'),
  'interested',
  'unselected students are not transitioned'
);
select is(
  (select metadata ->> 'affected_count' from public.audit_logs where action = 'bulk_student_status_changed' order by occurred_at desc limit 1),
  '2',
  'the successful transition is audited with its affected count'
);
select throws_ok(
  $$select public.bulk_transition_student_lifecycle_status('interested', 'active', 2, array['c2000000-0000-0000-0000-000000000013'::uuid], 'Stale preview')$$,
  '23514',
  'Dữ liệu đã thay đổi kể từ lúc preview. Vui lòng thực hiện preview lại.',
  'stale previews still abort atomically'
);
select is(
  (select lifecycle_status from public.students where id = 'c2000000-0000-0000-0000-000000000013'),
  'interested',
  'the stale-preview abort leaves the student unchanged'
);
select is(
  (select count(*) from public.audit_logs where action = 'bulk_student_status_changed')::integer,
  1,
  'a failed transition does not create an audit record'
);
select is(
  (select count(*) from public.students where lifecycle_status = 'active')::integer,
  2,
  'only the successfully transitioned students are active'
);

select * from finish();
rollback;
