begin;

select plan(7);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '61000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'finance-unit-price@example.test',
  '{"provider":"email"}',
  '{"full_name":"Finance Unit Price"}',
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
);

insert into public.roles (id, code, name)
values (
  '62000000-0000-0000-0000-000000000001',
  'financea1create',
  'Finance A1 create requests'
);

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
join public.permissions as permission
  on permission.code = 'payments.create_request'
where role.code = 'financea1create';

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values (
  '61000000-0000-0000-0000-000000000001',
  '62000000-0000-0000-0000-000000000001',
  'Finance A1 unit-price authority fixture'
);

insert into public.guardians (id, full_name, phone)
values (
  '63000000-0000-0000-0000-000000000001',
  'Finance A1 Guardian',
  '0900009999'
);

insert into public.students (
  id,
  public_code,
  full_name,
  birth_year,
  current_grade,
  lifecycle_status
)
values (
  '64000000-0000-0000-0000-000000000001',
  'TV-2026-90001',
  'Finance A1 Student',
  2014,
  6,
  'active'
);

insert into public.student_guardians (
  student_id,
  guardian_id,
  relationship,
  is_primary
)
values (
  '64000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000001',
  'parent',
  true
);

select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000001',
  true
);

create temporary table finance_a1_requests (
  request_key text primary key,
  id uuid not null
);

insert into finance_a1_requests (request_key, id)
values
  (
    'forged_low',
    (
      public.create_student_payment_request(
        '64000000-0000-0000-0000-000000000001',
        1400000,
        10,
        0,
        1,
        'new',
        'forged low fixture'
      ) ->> 'id'
    )::uuid
  ),
  (
    'forged_high',
    (
      public.create_student_payment_request(
        '64000000-0000-0000-0000-000000000001',
        1400000,
        10,
        0,
        999999999,
        'new',
        'forged high fixture'
      ) ->> 'id'
    )::uuid
  ),
  (
    'non_even',
    (
      public.create_student_payment_request(
        '64000000-0000-0000-0000-000000000001',
        1400005,
        10,
        0,
        1,
        'new',
        'non-even rounding fixture'
      ) ->> 'id'
    )::uuid
  );

select is(
  (select count(*) from finance_a1_requests),
  3::bigint,
  'an authenticated payments.create_request identity can invoke the real RPC'
);

select is(
  (
    select request.calculated_unit_price_vnd
    from finance_a1_requests as fixture
    join public.student_payment_requests as request on request.id = fixture.id
    where fixture.request_key = 'forged_low'
  ),
  140000::bigint,
  'a forged low caller unit price is ignored'
);

select is(
  (
    select request.calculated_unit_price_vnd
    from finance_a1_requests as fixture
    join public.student_payment_requests as request on request.id = fixture.id
    where fixture.request_key = 'forged_high'
  ),
  140000::bigint,
  'a forged high caller unit price is ignored'
);

select is(
  (
    select request.calculated_unit_price_vnd
    from finance_a1_requests as fixture
    join public.student_payment_requests as request on request.id = fixture.id
    where fixture.request_key = 'non_even'
  ),
  140001::bigint,
  'non-even positive division preserves Math.round semantics'
);

select public.process_sepay_webhook_transaction(
  610000001,
  'TESTBANK',
  '2026-08-11 00:00:00+00',
  '0123456789',
  null,
  (
    select request.transfer_code
    from finance_a1_requests as fixture
    join public.student_payment_requests as request on request.id = fixture.id
    where fixture.request_key = 'forged_high'
  ),
  'in',
  1400000,
  0,
  null,
  '{}'::jsonb
);

select is(
  (
    select credit_lot.unit_price_vnd
    from finance_a1_requests as fixture
    join public.student_credit_lots as credit_lot on credit_lot.payment_request_id = fixture.id
    where fixture.request_key = 'forged_high'
  ),
  140000::bigint,
  'SePay finalization copies the server-derived request price to the credit lot'
);

select is(
  (
    select ledger.unit_price_vnd
    from finance_a1_requests as fixture
    join public.student_session_ledger_entries as ledger
      on ledger.reference_code = (
        select request.public_code
        from public.student_payment_requests as request
        where request.id = fixture.id
      )
    where fixture.request_key = 'forged_high'
      and ledger.entry_type = 'payment_credit'
  ),
  140000::bigint,
  'SePay finalization writes the same server-derived price to the session ledger'
);

select is(
  (
    select pg_typeof(ledger.delta_sessions)::text
    from finance_a1_requests as fixture
    join public.student_session_ledger_entries as ledger
      on ledger.reference_code = (
        select request.public_code
        from public.student_payment_requests as request
        where request.id = fixture.id
      )
    where fixture.request_key = 'forged_high'
      and ledger.entry_type = 'payment_credit'
  ),
  'integer',
  'SePay finalization preserves the integer session-ledger invariant'
);

select * from finish();

rollback;
