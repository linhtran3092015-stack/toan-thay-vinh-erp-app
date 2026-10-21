begin;

select plan(14);

select is(
  (select pg_catalog.array_to_string(proconfig, ',') from pg_proc where oid = 'public.commit_student_enrollment_import_batch(uuid,text)'::regprocedure),
  'search_path=""',
  'commit RPC keeps its hardened search path'
);
select ok(
  not has_function_privilege('anon', 'public.commit_student_enrollment_import_batch(uuid,text)', 'execute'),
  'anon cannot execute the commit RPC'
);

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('c3000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'enrollment-import-owner@example.test', '{}', '{}', now(), now());
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'c3000000-0000-0000-0000-000000000001', id, 'enrollment import commit test'
from public.roles
where code = 'owner';
select set_config('request.jwt.claim.sub', 'c3000000-0000-0000-0000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('c3000000-0000-0000-0000-000000000010', '2040-2041', 'Năm học test import ghi danh', date '2040-08-01', date '2041-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count) values
  ('c3000000-0000-0000-0000-000000000011', 'c3000000-0000-0000-0000-000000000010', 'EI-8B2', 'Import 8B2', 8, 'B', 'active', 1);

insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status, registered_mode, official_start_date) values
  -- new row, never enrolled
  ('c3000000-0000-0000-0000-000000000021', 'TV-2040-31021', 'Import mới', 2027, 8, 'interested', null, null),
  -- new row, start date already known
  ('c3000000-0000-0000-0000-000000000022', 'TV-2040-31022', 'Import có ngày bắt đầu', 2027, 8, 'trial_completed', 'online', date '2040-09-01'),
  -- matching row, enrolled by an import before the fix and still 'interested'
  ('c3000000-0000-0000-0000-000000000023', 'TV-2040-31023', 'Import cũ chưa kích hoạt', 2027, 8, 'interested', null, null);

insert into public.student_enrollments (student_id, class_id, registered_mode, transition_kind, status, effective_from, start_reason, started_by)
values ('c3000000-0000-0000-0000-000000000023', 'c3000000-0000-0000-0000-000000000011', 'online', 'initial', 'active', date '2040-10-01', 'Import trước bản sửa', 'c3000000-0000-0000-0000-000000000001');

select lives_ok(
  $$select public.create_student_enrollment_import_batch(
    'ghi-danh-test.xlsx',
    repeat('a', 64),
    'Tạo batch test',
    '2040-2041',
    '[
      {"source_row": 2, "student_public_code": "TV-2040-31021", "class_code": "EI-8B2", "registered_mode": "offline", "effective_from": "2040-10-21"},
      {"source_row": 3, "student_public_code": "TV-2040-31022", "class_code": "EI-8B2", "registered_mode": "online", "effective_from": "2040-10-21"},
      {"source_row": 4, "student_public_code": "TV-2040-31023", "class_code": "EI-8B2", "registered_mode": "online", "effective_from": "2040-10-01"}
    ]'::jsonb
  )$$,
  'staging batch is created'
);
select is(
  (select status || ' ' || new_count || '/' || matching_count from public.student_enrollment_import_batches where source_sha256 = repeat('a', 64)),
  'ready_to_commit 2/1',
  'batch is ready with two new rows and one matching row'
);

create temp table commit_result on commit drop as
select public.commit_student_enrollment_import_batch(
  (select id from public.student_enrollment_import_batches where source_sha256 = repeat('a', 64)),
  'Commit test'
) as result;

select is(
  (select result ->> 'committed_new_count' || '/' || (result ->> 'reused_matching_count') || '/' || (result ->> 'activated_student_count') from commit_result),
  '2/1/3',
  'commit reports new, reused and activated counts'
);

select is(
  (select lifecycle_status || ' ' || registered_mode || ' ' || official_start_date::text from public.students where id = 'c3000000-0000-0000-0000-000000000021'),
  'active offline 2040-10-21',
  'a newly enrolled student becomes active with the import mode and start date'
);
select is(
  (select lifecycle_status || ' ' || official_start_date::text from public.students where id = 'c3000000-0000-0000-0000-000000000022'),
  'active 2040-09-01',
  'an existing official start date is kept'
);
select is(
  (select lifecycle_status || ' ' || official_start_date::text from public.students where id = 'c3000000-0000-0000-0000-000000000023'),
  'active 2040-10-01',
  'a matching row heals a student left inactive by an earlier import'
);
select is(
  (select count(*) from public.student_enrollments where student_id = 'c3000000-0000-0000-0000-000000000023')::integer,
  1,
  'a matching row does not create a second enrollment'
);
select is(
  (select count(*) from public.student_enrollments where student_id in ('c3000000-0000-0000-0000-000000000021', 'c3000000-0000-0000-0000-000000000022') and status = 'active' and effective_to is null)::integer,
  2,
  'new rows get one active enrollment each'
);
select is(
  (select new_data ->> 'activated_student_count' from public.audit_logs where action = 'student_enrollment_import_batch_committed' and entity_id = (select result ->> 'batch_id' from commit_result)),
  '3',
  'the batch commit audit records how many students were activated'
);

select throws_ok(
  $$select public.commit_student_enrollment_import_batch((select id from public.student_enrollment_import_batches where source_sha256 = repeat('a', 64)), 'Commit lần hai')$$,
  '23505',
  'STUDENT_ENROLLMENT_IMPORT_BATCH_ALREADY_COMMITTED',
  'a committed batch cannot be committed again'
);
select throws_ok(
  $$select public.commit_student_enrollment_import_batch('36be8c0e-2787-4d88-ab21-61e1a43baccb', 'Batch không tồn tại')$$,
  '22023',
  'STUDENT_ENROLLMENT_IMPORT_BATCH_NOT_FOUND',
  'an unknown batch id is rejected'
);

-- A student who already holds an active enrollment elsewhere stays a conflict and is never touched
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status)
values ('c3000000-0000-0000-0000-000000000024', 'TV-2040-31024', 'Đang học lớp khác', 2027, 8, 'reserved');
insert into public.student_enrollments (student_id, class_id, registered_mode, transition_kind, status, effective_from, start_reason, started_by)
values ('c3000000-0000-0000-0000-000000000024', 'c3000000-0000-0000-0000-000000000011', 'online', 'initial', 'active', date '2040-09-15', 'Có sẵn', 'c3000000-0000-0000-0000-000000000001');
select public.create_student_enrollment_import_batch(
  'ghi-danh-xung-dot.xlsx', repeat('b', 64), 'Batch xung đột', '2040-2041',
  '[{"source_row": 2, "student_public_code": "TV-2040-31024", "class_code": "EI-8B2", "registered_mode": "offline", "effective_from": "2040-10-21"}]'::jsonb
);
select is(
  (select b.status || ' ' || s.lifecycle_status
   from public.student_enrollment_import_batches b, public.students s
   where b.source_sha256 = repeat('b', 64) and s.id = 'c3000000-0000-0000-0000-000000000024'),
  'rejected reserved',
  'a conflicting row rejects the batch and leaves the student untouched'
);

select * from finish();
rollback;
