begin;

select plan(6);

select is(
  (
    select namespace.nspname
    from pg_catalog.pg_extension as extension
    join pg_catalog.pg_namespace as namespace on namespace.oid = extension.extnamespace
    where extension.extname = 'pgcrypto'
  ),
  'extensions',
  'pgcrypto is installed in the extensions schema'
);

select ok(
  to_regprocedure('public.digest(bytea,text)') is null,
  'public.digest(bytea,text) is intentionally unavailable'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.create_payroll_import_batch(text,date,text,text,jsonb)'::regprocedure
  ) like '%extensions.digest(%',
  'create_payroll_import_batch resolves digest from the extensions schema'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '8f000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'payroll-import-pgcrypto@example.test',
  '{"provider":"email"}',
  '{"full_name":"Payroll Import Pgcrypto Test"}',
  now(),
  now()
);

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select
  '8f000000-0000-4000-8000-000000000001',
  role.id,
  'Payroll import pgcrypto regression test'
from public.roles as role
where role.code = 'owner';

select set_config(
  'request.jwt.claim.sub',
  '8f000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$
    select public.create_payroll_import_batch(
      'timekeeping',
      '2026-07-01',
      'payroll-import-pgcrypto.test.xlsx',
      repeat('0', 64),
      jsonb_build_array(
        jsonb_build_object(
          'row_number', 2,
          'source_key', 'payroll-import-pgcrypto-row-2',
          'raw_payload', jsonb_build_object('employee_code', 'PGCRYPTO-TEST'),
          'normalized_payload', jsonb_build_object(
            'event_date', '2026-07-15',
            'staff_id', '8f000000-0000-4000-8000-000000000001',
            'quantity', 1,
            'metadata', jsonb_build_object('work_mode', 'offline')
          ),
          'validation_status', 'valid',
          'validation_errors', '[]'::jsonb
        )
      )
    )
  $$,
  'create_payroll_import_batch succeeds when pgcrypto only exposes extensions.digest'
);

select is(
  (
    select pg_catalog.count(*)
    from public.payroll_import_batches
    where file_name = 'payroll-import-pgcrypto.test.xlsx'
      and total_rows = 1
      and valid_rows = 1
  ),
  1::bigint,
  'the payroll import batch is persisted with the expected counts'
);

select is(
  (
    select pg_catalog.count(*)
    from public.payroll_import_rows as import_row
    join public.payroll_import_batches as batch on batch.id = import_row.batch_id
    where batch.file_name = 'payroll-import-pgcrypto.test.xlsx'
      and import_row.source_key = 'payroll-import-pgcrypto-row-2'
  ),
  1::bigint,
  'the validated payroll import row is persisted'
);

select * from finish();
rollback;
