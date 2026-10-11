-- Check-in / cutoff rules depend on the wall clock (daily cutoff 22:30/22:45
-- VN, shifts built around now()). Outside business hours the scenarios cannot
-- hold, so the file degrades to one explicit skip instead of a false failure.
select ((now() at time zone 'Asia/Ho_Chi_Minh')::time between time '06:00' and time '21:30') as in_hours \gset
begin;
\if :in_hours
select plan(13);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('14000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'verification-owner@example.test', '{"provider":"email"}', '{"full_name":"Verification Owner"}', now(), now()),
  ('14000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'verification-staff@example.test', '{"provider":"email"}', '{"full_name":"Verification Staff"}', now(), now());

insert into public.roles (id, code, name)
values ('24000000-0000-0000-0000-000000000001', 'verification_staff_test', 'Verification staff test');

insert into public.role_permissions (role_id, permission_id)
select '24000000-0000-0000-0000-000000000001', permission.id
from public.permissions as permission
where permission.code in ('timekeeping.check', 'timekeeping.view');

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '14000000-0000-0000-0000-000000000001', role.id, 'Owner verification test'
from public.roles as role
where role.code = 'owner';

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values ('14000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000001', 'Staff verification test');

select ok(
  exists (
    select 1
    from public.role_permissions as role_permission
    join public.roles as role on role.id = role_permission.role_id
    join public.permissions as permission on permission.id = role_permission.permission_id
    where role.code = 'owner'
      and permission.code = 'timekeeping.manage_verification'
  ),
  'owner receives the dedicated verification-management permission'
);

select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$
    select public.set_attendance_verification_config(
      'Cơ sở kiểm thử', 10.777, 106.699, 120, 60, true,
      '[{"ssid":"TTV-Staff","bssid":"AA:BB:CC:DD:EE:FF"}]'::jsonb
    )
  $$,
  'owner can save GPS and Wi-Fi verification without code changes'
);

select is(
  public.get_attendance_verification_config() ->> 'center_name',
  'Cơ sở kiểm thử',
  'owner reads the saved center name'
);

select is(
  public.get_attendance_verification_config() #>> '{wifi_networks,0,bssid}',
  'AA:BB:CC:DD:EE:FF',
  'owner reads the normalized Wi-Fi allowlist'
);

select ok(
  exists (
    select 1 from public.audit_logs as audit
    where audit.actor_user_id = '14000000-0000-0000-0000-000000000001'
      and audit.action = 'attendance_verification_config_updated'
  ),
  'owner configuration changes are audited'
);

select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000002', true);

select is(
  public.get_attendance_verification_policy() ->> 'wifi_required_for_offline',
  'true',
  'staff receives the active verification policy without the allowlist'
);

select throws_ok(
  $$ select * from public.check_in_time_entry('offline', null, null, null, null, null) $$,
  '22023',
  'TIME_ENTRY_GPS_REQUIRED_FOR_OFFLINE',
  'on-site check-in requires GPS for every staff role'
);

select throws_ok(
  $$ select * from public.check_in_time_entry('offline', 10.777, 106.699, 10, 'Unknown', '11:22:33:44:55:66') $$,
  '23514',
  'TIME_ENTRY_WIFI_NOT_ALLOWED',
  'on-site check-in rejects Wi-Fi outside the owner allowlist'
);

select lives_ok(
  $$ select * from public.check_in_time_entry('offline', 10.777, 106.699, 10, 'ttv-staff', 'aa:bb:cc:dd:ee:ff') $$,
  'on-site check-in accepts GPS and case-normalized allowed Wi-Fi'
);

select throws_ok(
  $$ select * from public.check_out_time_entry('offline', 10.777, 106.699, 10, null, null) $$,
  '22023',
  'TIME_ENTRY_WIFI_REQUIRED_FOR_OFFLINE',
  'on-site check-out enforces the same Wi-Fi policy'
);

select lives_ok(
  $$ select * from public.check_out_time_entry('offline', 10.777, 106.699, 10, 'TTV-Staff', 'AA:BB:CC:DD:EE:FF') $$,
  'on-site check-out succeeds with allowed GPS and Wi-Fi evidence'
);

select ok(
  exists (
    select 1
    from public.time_entry_evidence as evidence
    join public.time_entries as entry on entry.id = evidence.time_entry_id
    where entry.staff_id = '14000000-0000-0000-0000-000000000002'
      and evidence.event_type = 'check_out'
      and evidence.evidence_type = 'wifi'
  ),
  'check-out Wi-Fi evidence is persisted'
);

-- Online attendance needs an assigned shift (20261012120000); give the staff
-- member an all-day shift for today so only the GPS/Wi-Fi exemption is tested.
insert into public.work_shifts (id, code, name, start_time, end_time)
values ('34000000-0000-0000-0000-000000000001', 'VERIFYONL', 'Verification online shift', '00:00', '23:59');
insert into public.staff_shift_assignments (staff_id, work_shift_id, weekday, effective_from)
values (
  '14000000-0000-0000-0000-000000000002',
  '34000000-0000-0000-0000-000000000001',
  extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh'))::smallint,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date
);

select lives_ok(
  $$ select * from public.check_in_time_entry('online', null, null, null, null, null) $$,
  'online attendance remains exempt from on-site GPS and Wi-Fi policy'
);

select * from finish();

\else
select plan(1);
select pass('timekeeping clock-dependent scenarios skipped outside 06:00-21:30 Vietnam time');
select * from finish();
\endif
rollback;
