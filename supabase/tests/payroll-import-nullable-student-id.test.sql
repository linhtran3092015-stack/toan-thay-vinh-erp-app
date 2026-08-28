begin;

select plan(10);

select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payroll_source_facts'
      and column_name = 'student_id'
  ),
  'YES',
  'payroll_source_facts.student_id remains nullable'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.payroll_source_facts'::regclass
      and conname = 'payroll_source_facts_student_id_fkey'
      and contype = 'f'
  ),
  'the foreign key from payroll_source_facts.student_id to students remains in place'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '8d000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'payroll-student-uploader@example.test',
    '{"provider":"email"}',
    '{"full_name":"Payroll Student Uploader"}',
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '8d000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'payroll-student-reviewer@example.test',
    '{"provider":"email"}',
    '{"full_name":"Payroll Student Reviewer"}',
    pg_catalog.now(),
    pg_catalog.now()
  );

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select test_user.id, role.id, 'Payroll nullable student regression test'
from (
  values
    ('8d000000-0000-4000-8000-000000000001'::uuid),
    ('8d000000-0000-4000-8000-000000000002'::uuid)
) as test_user(id)
cross join public.roles as role
where role.code = 'owner';

insert into public.students (
  id, public_code, full_name, birth_year, current_grade, lifecycle_status
)
values (
  '8d000000-0000-4000-8000-000000000010',
  'TV-2026-99001',
  'Học sinh kiểm thử payroll',
  2016,
  4,
  'interested'
);

select set_config(
  'request.jwt.claim.sub',
  '8d000000-0000-4000-8000-000000000001',
  true
);

create temporary table test_payroll_import_batches (
  test_case text primary key,
  batch_id uuid not null
);

select lives_ok(
  $$
    insert into test_payroll_import_batches (test_case, batch_id)
    select
      'blank',
      (public.create_payroll_import_batch(
        'new_enrollment_orders',
        '2026-07-01',
        'payroll-null-student.test.xlsx',
        repeat('1', 64),
        jsonb_build_array(jsonb_build_object(
          'row_number', 2,
          'source_key', 'payroll-null-student-row',
          'raw_payload', jsonb_build_object('student_id', '   '),
          'normalized_payload', jsonb_build_object(
            'event_date', '2026-07-02',
            'staff_id', '8d000000-0000-4000-8000-000000000001',
            'student_id', '   ',
            'grade', 4,
            'amount_vnd', 1400000,
            'source_code', 'school_telesales_ads',
            'metadata', jsonb_build_object('evidence_url', 'https://example.com/evidence/null-student')
          ),
          'validation_status', 'valid',
          'validation_errors', '[]'::jsonb
        ))
      )).id
  $$,
  'blank student_id is accepted by create_payroll_import_batch'
);

select is(
  (
    select import_row.normalized_payload -> 'student_id'
    from public.payroll_import_rows as import_row
    join test_payroll_import_batches as test_batch on test_batch.batch_id = import_row.batch_id
    where test_batch.test_case = 'blank'
  ),
  'null'::jsonb,
  'blank student_id is persisted as JSON null in normalized_payload'
);

select set_config(
  'request.jwt.claim.sub',
  '8d000000-0000-4000-8000-000000000002',
  true
);

select lives_ok(
  $$
    select public.decide_payroll_import_batch(
      (select batch_id from test_payroll_import_batches where test_case = 'blank'),
      'approved',
      'Duyệt dữ liệu kiểm thử student_id trống'
    )
  $$,
  'a batch with blank student_id can be approved'
);

select is(
  (
    select student_id
    from public.payroll_source_facts
    where fact_type = 'new_enrollment_order'
      and source_key = 'payroll-null-student-row'
  ),
  null::uuid,
  'approved payroll fact stores a SQL NULL student_id'
);

select set_config(
  'request.jwt.claim.sub',
  '8d000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$
    insert into test_payroll_import_batches (test_case, batch_id)
    select
      'existing',
      (public.create_payroll_import_batch(
        'new_enrollment_orders',
        '2026-07-01',
        'payroll-existing-student.test.xlsx',
        repeat('2', 64),
        jsonb_build_array(jsonb_build_object(
          'row_number', 2,
          'source_key', 'payroll-existing-student-row',
          'raw_payload', '{}'::jsonb,
          'normalized_payload', jsonb_build_object(
            'event_date', '2026-07-03',
            'staff_id', '8d000000-0000-4000-8000-000000000001',
            'student_id', '8d000000-0000-4000-8000-000000000010',
            'grade', 4,
            'amount_vnd', 1400000,
            'source_code', 'school_telesales_ads',
            'metadata', jsonb_build_object('evidence_url', 'https://example.com/evidence/existing-student')
          ),
          'validation_status', 'valid',
          'validation_errors', '[]'::jsonb
        ))
      )).id
  $$,
  'an existing student UUID is accepted'
);

select is(
  (
    select import_row.normalized_payload ->> 'student_id'
    from public.payroll_import_rows as import_row
    join test_payroll_import_batches as test_batch on test_batch.batch_id = import_row.batch_id
    where test_batch.test_case = 'existing'
  ),
  '8d000000-0000-4000-8000-000000000010',
  'an existing student UUID is preserved in normalized_payload'
);

select throws_ok(
  $$
    select public.create_payroll_import_batch(
      'new_enrollment_orders',
      '2026-07-01',
      'payroll-missing-student.test.xlsx',
      repeat('3', 64),
      jsonb_build_array(jsonb_build_object(
        'row_number', 2,
        'source_key', 'payroll-missing-student-row',
        'raw_payload', '{}'::jsonb,
        'normalized_payload', jsonb_build_object(
          'event_date', '2026-07-04',
          'staff_id', '8d000000-0000-4000-8000-000000000001',
          'student_id', '8d000000-0000-4000-8000-000000000099',
          'grade', 4,
          'amount_vnd', 1400000,
          'source_code', 'school_telesales_ads',
          'metadata', jsonb_build_object('evidence_url', 'https://example.com/evidence/missing-student')
        ),
        'validation_status', 'valid',
        'validation_errors', '[]'::jsonb
      ))
    )
  $$,
  '22023',
  'PAYROLL_IMPORT_STUDENT_INVALID',
  'a syntactically valid UUID that is absent from public.students is rejected'
);

select is(
  (
    select pg_catalog.count(*)
    from public.payroll_import_batches
    where file_name = 'payroll-missing-student.test.xlsx'
  ),
  0::bigint,
  'the rejected missing-student batch is rolled back'
);

select * from finish();
rollback;
