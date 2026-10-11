begin;

select plan(9);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('13000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'timekeeping-unscheduled@example.test', '{"provider":"email"}', '{"full_name":"Unscheduled Staff"}', now(), now()),
  ('13000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'timekeeping-assigned@example.test', '{"provider":"email"}', '{"full_name":"Assigned Staff"}', now(), now());

insert into public.roles (id, code, name)
values ('23000000-0000-0000-0000-000000000001', 'timekeeping_optional_shift_test', 'Timekeeping optional-shift test');

insert into public.role_permissions (role_id, permission_id)
select '23000000-0000-0000-0000-000000000001', permission.id
from public.permissions as permission
where permission.code in ('timekeeping.check', 'timekeeping.view');

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values
  ('13000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', 'Optional shift attendance test'),
  ('13000000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-000000000001', 'Optional shift attendance test');

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);

-- Since 20261012120000 online attendance requires an assigned shift; an
-- unscheduled entry can still exist (on-site or admin-created), so seed one.
select throws_ok(
  $$ select * from public.check_in_time_entry('online', null, null, null, null, null) $$,
  '23514',
  'TIME_ENTRY_ONLINE_REQUIRES_SCHEDULED_SHIFT',
  'a non-TA without an effective shift cannot check in online'
);

insert into public.time_entries (staff_id, work_date, check_in_at, check_in_mode, status)
values ('13000000-0000-0000-0000-000000000001', (now() at time zone 'Asia/Ho_Chi_Minh')::date, now(), 'offline', 'open');

select ok(
  (
    select entry.staff_shift_assignment_id is null
    from public.time_entries as entry
    where entry.staff_id = '13000000-0000-0000-0000-000000000001'
      and entry.status = 'open'
  ),
  'the unscheduled check-in stores a NULL assignment'
);

select throws_ok(
  $$ select * from public.check_in_time_entry('online', null, null, null, null, null) $$,
  '23505',
  'TIME_ENTRY_OPEN_ENTRY_ALREADY_EXISTS',
  'the one-open-entry guard remains active for unscheduled attendance'
);

select lives_ok(
  $$ select * from public.check_out_time_entry('online', null, null, null, null, null) $$,
  'an unscheduled non-TA entry supports normal manual checkout'
);

select ok(
  (
    select exists (
      select 1
      from public.get_my_timekeeping_adjustable_entries() as entry
      where entry.work_shift_code is null
        and entry.work_shift_name is null
    )
  ),
  'closed unscheduled attendance remains visible to the adjustment read model'
);

select ok(
  (
    select exists (
      select 1
      from public.get_timekeeping_day_entries() as entry
      where entry.staff_id = '13000000-0000-0000-0000-000000000001'
        and entry.work_shift_code is null
        and entry.work_shift_name is null
    )
  ),
  'unscheduled attendance remains visible to the day-audit read model'
);

select ok(
  (
    select exists (
      select 1
      from public.time_entries as entry
      where entry.staff_id = '13000000-0000-0000-0000-000000000001'
        and entry.staff_shift_assignment_id is null
        and entry.status in ('checked_out', 'auto_ended')
        and entry.work_date >= date_trunc('month', entry.work_date)::date
        and entry.work_date < (date_trunc('month', entry.work_date) + interval '1 month')::date
    )
  ),
  'the closed unscheduled entry satisfies the payroll draft source-entry predicate'
);

insert into public.work_shifts (id, code, name, start_time, end_time)
values ('33000000-0000-0000-0000-000000000001', 'OPTTEST', 'Optional shift test', '00:00', '23:59');

insert into public.staff_shift_assignments (id, staff_id, work_shift_id, weekday, effective_from)
values (
  '43000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000002',
  '33000000-0000-0000-0000-000000000001',
  extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh'))::smallint,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date
);

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ select * from public.check_in_time_entry('online', null, null, null, null, null) $$,
  'a permitted active non-TA can check in with an effective shift'
);

select is(
  (
    select entry.staff_shift_assignment_id
    from public.time_entries as entry
    where entry.staff_id = '13000000-0000-0000-0000-000000000002'
      and entry.status = 'open'
  ),
  '43000000-0000-0000-0000-000000000001'::uuid,
  'an effective assignment is attached when present'
);

select * from finish();

rollback;
