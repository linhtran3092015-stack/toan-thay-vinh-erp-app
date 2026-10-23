-- Owner tools on attendance: re-adjusting an already adjusted entry (the
-- previous approval becomes `superseded`), changing the attendance mode, and
-- deleting an entry with its dependent rows and an audit snapshot.
begin;
select plan(70);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('16000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'timekeeping-readjust-owner@example.test', '{"provider":"email"}', '{"full_name":"Readjust Owner"}', now(), now()),
  ('16000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'timekeeping-readjust-staff@example.test', '{"provider":"email"}', '{"full_name":"Readjust Staff"}', now(), now());

insert into public.roles (id, code, name)
values
  ('26000000-0000-0000-0000-000000000001', 'timekeeping_readjust_owner_test', 'Timekeeping readjust owner test'),
  ('26000000-0000-0000-0000-000000000002', 'timekeeping_readjust_staff_test', 'Timekeeping readjust staff test');

insert into public.role_permissions (role_id, permission_id)
select '26000000-0000-0000-0000-000000000001', permission.id
from public.permissions as permission
where permission.code in ('timekeeping.approve_adjustment', 'timekeeping.view');

insert into public.role_permissions (role_id, permission_id)
select '26000000-0000-0000-0000-000000000002', permission.id
from public.permissions as permission
where permission.code = 'timekeeping.check';

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values
  ('16000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', 'Readjust test'),
  ('16000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000002', 'Readjust test');

-- Far-future months keep the fixtures clear of real payroll periods.
insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, check_out_at, check_out_mode, status, auto_ended_at, last_latitude, last_longitude, last_location_accuracy)
values ('36000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', '2020-03-10', '2020-03-10 01:00+00', 'offline', '2020-03-10 15:00+00', 'auto_end', 'auto_ended', '2020-03-10 15:00+00', 10.762622, 106.660172, 12);

insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, check_out_at, check_out_mode, status, auto_ended_at)
values
  ('36000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002', '2020-03-11', '2020-03-11 01:00+00', 'online', '2020-03-11 15:00+00', 'auto_end', 'auto_ended', '2020-03-11 15:00+00'),
  ('36000000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-000000000002', '2020-04-10', '2020-04-10 01:00+00', 'offline', '2020-04-10 05:00+00', 'offline', 'checked_out', null);

insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, status)
values ('36000000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000002', '2020-03-12', now(), 'offline', 'open');

insert into public.time_entry_evidence (time_entry_id, event_type, evidence_type, gps_latitude, gps_longitude, gps_accuracy_meters)
values ('36000000-0000-0000-0000-000000000001', 'check_in', 'gps', 10.762622, 106.660172, 12);

select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);

-- ---------------------------------------------------------------------------
-- Re-adjust + mode
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000001', '2020-03-10 01:00+00', '2020-03-10 05:00+00', 'Quên chấm ra') $$,
  'the first direct adjustment succeeds'
);

select lives_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000001', '2020-03-10 01:30+00', '2020-03-10 05:30+00', 'Sửa lại giờ vào', 'online') $$,
  'an already adjusted entry can be adjusted again'
);

select is(
  (select count(*)::integer from public.time_entry_adjustment_requests where time_entry_id = '36000000-0000-0000-0000-000000000001' and status = 'approved'),
  1,
  'exactly one approved adjustment remains in effect'
);

select is(
  (select count(*)::integer from public.time_entry_adjustment_requests where time_entry_id = '36000000-0000-0000-0000-000000000001' and status = 'superseded'),
  1,
  'the previous approval is kept as superseded'
);

select results_eq(
  $$ select actor_user_id, old_data ->> 'status', new_data ->> 'status'
     from public.audit_logs
     where action = 'time_entry_adjustment_superseded'
       and metadata ->> 'time_entry_id' = '36000000-0000-0000-0000-000000000001' $$,
  $$ values ('16000000-0000-0000-0000-000000000001'::uuid, 'approved'::text, 'superseded'::text) $$,
  'superseding an approval is audited with the acting owner'
);

select results_eq(
  $$ select check_in_mode, check_out_mode, check_in_at, check_out_at from public.time_entries where id = '36000000-0000-0000-0000-000000000001' $$,
  $$ values ('online'::text, 'online'::text, '2020-03-10 01:30+00'::timestamptz, '2020-03-10 05:30+00'::timestamptz) $$,
  'the entry carries the new times and mode'
);

select results_eq(
  $$ select requested_check_in_mode, requested_check_out_mode, original_check_in_at, original_check_out_at, original_check_in_mode
     from public.time_entry_adjustment_requests
     where time_entry_id = '36000000-0000-0000-0000-000000000001' and status = 'approved' $$,
  $$ values ('online'::text, 'online'::text, '2020-03-10 01:00+00'::timestamptz, '2020-03-10 05:00+00'::timestamptz, 'offline'::text) $$,
  'the new approval records the mode and starts from the previously effective values'
);

select is(
  (select requested_check_in_mode from public.time_entry_adjustment_requests where time_entry_id = '36000000-0000-0000-0000-000000000001' and status = 'superseded'),
  'offline',
  'the superseded approval keeps the mode it recorded'
);

select lives_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000002', '2020-03-11 01:00+00', '2020-03-11 04:00+00', 'Ca trực tuyến quên chấm ra') $$,
  'adjusting an online entry without a mode succeeds'
);

select is(
  (select requested_check_in_mode from public.time_entry_adjustment_requests where time_entry_id = '36000000-0000-0000-0000-000000000002' and status = 'approved'),
  'online',
  'an online entry stays online in the approved adjustment payroll reads'
);

select throws_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000001', '2020-03-10 01:30+00', '2020-03-10 05:30+00', 'Không đổi gì', 'online') $$,
  '22023',
  'TIME_ENTRY_ADJUSTMENT_NO_CHANGE',
  'saving the effective values again is refused'
);

select throws_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000001', '2020-03-10 01:30+00', '2020-03-10 06:00+00', 'Sai hình thức', 'hybrid') $$,
  '22023',
  'TIME_ENTRY_MODE_INVALID',
  'an unknown mode is refused'
);

select throws_ok(
  $$ update public.time_entry_adjustment_requests set status = 'approved' where time_entry_id = '36000000-0000-0000-0000-000000000001' and status = 'superseded' $$,
  '23514',
  'TIME_ENTRY_ADJUSTMENT_DECISION_IS_FINAL',
  'a superseded adjustment cannot be revived'
);

-- A manual entry is born with an approved adjustment; it must stay editable.
select set_config('test.manual_entry_id', (
  select id::text from public.admin_create_time_entry(
    '16000000-0000-0000-0000-000000000002', '2020-03-13', '2020-03-13 01:00+00', '2020-03-13 03:00+00', 'offline', 'Công bù'
  )
), true);

select lives_ok(
  format(
    $$ select * from public.admin_adjust_time_entry(%L, '2020-03-13 01:00+00', '2020-03-13 04:00+00', 'Bù thêm một giờ') $$,
    current_setting('test.manual_entry_id')
  ),
  'a manually created entry can be adjusted'
);

-- Before 20261023180000 the RPC recorded every direct adjustment as offline,
-- even for an online shift (11 such entries on prod in 2026-09). Without a
-- chosen mode a re-adjust follows the check-in mode, so it repairs the shift.
insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, check_out_at, check_out_mode, status)
values ('36000000-0000-0000-0000-000000000005', '16000000-0000-0000-0000-000000000002', '2020-03-14', '2020-03-14 01:00+00', 'online', '2020-03-14 04:00+00', 'online', 'checked_out');

insert into public.time_entry_adjustment_requests (
  time_entry_id, requester_id,
  original_check_in_at, original_check_in_mode, original_check_out_at, original_check_out_mode,
  requested_check_in_at, requested_check_in_mode, requested_check_out_at, requested_check_out_mode,
  request_reason, status, reviewed_by, reviewed_at, decision_reason
) values (
  '36000000-0000-0000-0000-000000000005', '16000000-0000-0000-0000-000000000002',
  '2020-03-14 01:00+00', 'online', '2020-03-14 12:00+00', 'auto_end',
  '2020-03-14 01:00+00', 'offline', '2020-03-14 04:00+00', 'offline',
  'Quên chấm ra', 'approved', '16000000-0000-0000-0000-000000000001', now(), 'Chủ trung tâm điều chỉnh trực tiếp: Quên chấm ra'
);

select lives_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000005', '2020-03-14 01:00+00', '2020-03-14 05:00+00', 'Dạy thêm một giờ') $$,
  'a legacy offline-forced approval can be re-adjusted without choosing a mode'
);

select results_eq(
  $$ select entry.check_in_mode, request.requested_check_in_mode, request.requested_check_out_mode, request.original_check_in_mode
     from public.time_entries as entry
     join public.time_entry_adjustment_requests as request on request.time_entry_id = entry.id and request.status = 'approved'
     where entry.id = '36000000-0000-0000-0000-000000000005' $$,
  $$ values ('online'::text, 'online'::text, 'online'::text, 'offline'::text) $$,
  'without a chosen mode the re-adjust follows the check-in mode and records what payroll used before'
);

select lives_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000005', '2020-03-14 01:00+00', '2020-03-14 05:00+00', 'Thực ra dạy tại trung tâm', 'offline') $$,
  'only the mode can be changed on a re-adjust'
);

select lives_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000005', '2020-03-14 01:00+00', '2020-03-14 05:30+00', 'Sửa giờ ra') $$,
  'a later re-adjust without a mode succeeds'
);

select is(
  (select requested_check_in_mode from public.time_entry_adjustment_requests where time_entry_id = '36000000-0000-0000-0000-000000000005' and status = 'approved'),
  'offline',
  'a mode the owner chose becomes the check-in mode later re-adjusts follow'
);

-- A staff request filed before the owner corrects the entry directly is closed
-- so it can never be approved over the newer correction.
insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, check_out_at, check_out_mode, status, auto_ended_at)
values ('36000000-0000-0000-0000-000000000006', '16000000-0000-0000-0000-000000000002', '2020-03-15', '2020-03-15 01:00+00', 'offline', '2020-03-15 15:00+00', 'auto_end', 'auto_ended', '2020-03-15 15:00+00');

insert into public.time_entry_adjustment_requests (
  id, time_entry_id, requester_id,
  original_check_in_at, original_check_in_mode, original_check_out_at, original_check_out_mode,
  requested_check_in_at, requested_check_in_mode, requested_check_out_at, requested_check_out_mode,
  request_reason
) values (
  '46000000-0000-0000-0000-000000000003', '36000000-0000-0000-0000-000000000006', '16000000-0000-0000-0000-000000000002',
  '2020-03-15 01:00+00', 'offline', '2020-03-15 15:00+00', 'auto_end',
  '2020-03-15 01:00+00', 'offline', '2020-03-15 11:00+00', 'offline',
  'Em về lúc 18h'
);

select lives_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000006', '2020-03-15 01:00+00', '2020-03-15 05:00+00', 'Quản lý xác nhận về lúc 12h') $$,
  'the owner corrects an entry that has a pending staff request'
);

select results_eq(
  $$ select status, reviewed_by, decision_reason from public.time_entry_adjustment_requests where id = '46000000-0000-0000-0000-000000000003' $$,
  $$ values ('rejected'::text, '16000000-0000-0000-0000-000000000001'::uuid, 'Chủ trung tâm đã điều chỉnh trực tiếp lượt chấm công này.'::text) $$,
  'the pending staff request is closed with the reason'
);

select throws_ok(
  $$ select * from public.decide_time_entry_adjustment('46000000-0000-0000-0000-000000000003', 'approved', null) $$,
  '23514',
  'TIME_ENTRY_ADJUSTMENT_REQUEST_ALREADY_DECIDED',
  'the stale request can no longer be approved over the correction'
);

-- Confirming an auto-ended shift with unchanged times is a real change: it
-- becomes a manual check-out, so the no-change guard only applies to checked_out.
insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, check_out_at, check_out_mode, status, auto_ended_at)
values ('36000000-0000-0000-0000-000000000007', '16000000-0000-0000-0000-000000000002', '2020-03-16', '2020-03-16 01:00+00', 'offline', '2020-03-16 05:00+00', 'auto_end', 'auto_ended', '2020-03-16 05:00+00');

select lives_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000007', '2020-03-16 01:00+00', '2020-03-16 05:00+00', 'Xác nhận ca tự kết thúc') $$,
  'an auto-ended shift can be confirmed with unchanged times'
);

select results_eq(
  $$ select status, clock_out_reason, auto_ended_at from public.time_entries where id = '36000000-0000-0000-0000-000000000007' $$,
  $$ values ('checked_out'::text, 'manual'::text, null::timestamptz) $$,
  'the confirmed shift becomes a manual check-out'
);

select set_config('test.staff_revision_before', coalesce((
  select revision::text from public.payroll_live_revisions
  where month = '2020-03-01' and scope = 'staff' and staff_id = '16000000-0000-0000-0000-000000000002'
), '0'), true);

select set_config('test.owner_revision_before', coalesce((
  select revision::text from public.payroll_live_revisions
  where month = '2020-03-01' and scope = 'owner' and staff_id is null
), '0'), true);

-- A staff request approved after a direct adjustment supersedes it.
insert into public.time_entry_adjustment_requests (
  id, time_entry_id, requester_id,
  original_check_in_at, original_check_in_mode, original_check_out_at, original_check_out_mode,
  requested_check_in_at, requested_check_in_mode, requested_check_out_at, requested_check_out_mode,
  request_reason
) values (
  '46000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002',
  '2020-03-11 01:00+00', 'online', '2020-03-11 15:00+00', 'auto_end',
  '2020-03-11 01:00+00', 'online', '2020-03-11 05:00+00', 'online',
  'Em về lúc 12h'
);

select lives_ok(
  $$ select * from public.decide_time_entry_adjustment('46000000-0000-0000-0000-000000000001', 'approved', null) $$,
  'approving a staff request on an adjusted entry succeeds'
);

select is(
  (select status from public.time_entry_adjustment_requests where id = '46000000-0000-0000-0000-000000000001'),
  'approved',
  'the staff approval is the one in effect'
);

select is(
  (select status from public.time_entry_adjustment_requests where time_entry_id = '36000000-0000-0000-0000-000000000002' and id <> '46000000-0000-0000-0000-000000000001'),
  'superseded',
  'the earlier direct adjustment is superseded'
);

select ok(
  (select revision from public.payroll_live_revisions
   where month = '2020-03-01' and scope = 'staff' and staff_id = '16000000-0000-0000-0000-000000000002')
    > current_setting('test.staff_revision_before')::bigint,
  'approving a request tells the live payroll estimate to refresh'
);

select ok(
  (select revision from public.payroll_live_revisions
   where month = '2020-03-01' and scope = 'owner' and staff_id is null)
    > current_setting('test.owner_revision_before')::bigint,
  'approving a request tells the owner payroll overview to refresh too'
);

-- Generated by /ship test coverage audit (Claude Opus 5.5) — 2026-10-23
-- Value: protects=the approval payroll reads changes only when a new approval lands: a rejection keeps it, signed-in users cannot call the supersede helper, staff cannot adjust directly;
-- fails_when=supersede runs before the approve-only branch in decide, the helper's revoke is dropped (security definer, so any user could void approvals), or the rewritten adjust RPC loses its permission check;
-- why_new=the cases above only approve; no test covered reject-after-adjust, the helper's grants or a staff caller of admin_adjust_time_entry; seam=none;
-- no_claim=runs as the test superuser with request.jwt.claim.sub; does not prove PostgREST routing or RLS on reads
insert into public.time_entry_adjustment_requests (
  id, time_entry_id, requester_id,
  original_check_in_at, original_check_in_mode, original_check_out_at, original_check_out_mode,
  requested_check_in_at, requested_check_in_mode, requested_check_out_at, requested_check_out_mode,
  request_reason
) values (
  '46000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002',
  '2020-03-11 01:00+00', 'online', '2020-03-11 15:00+00', 'auto_end',
  '2020-03-11 01:00+00', 'online', '2020-03-11 06:00+00', 'online',
  'Em về lúc 13h'
);

select lives_ok(
  $$ select * from public.decide_time_entry_adjustment('46000000-0000-0000-0000-000000000002', 'rejected', 'Không khớp lịch dạy') $$,
  'rejecting a later staff request on an adjusted entry succeeds'
);

select is(
  (select id::text from public.time_entry_adjustment_requests where time_entry_id = '36000000-0000-0000-0000-000000000002' and status = 'approved'),
  '46000000-0000-0000-0000-000000000001',
  'a rejection leaves the approval in effect'
);

select ok(
  not has_function_privilege('authenticated', 'public.supersede_time_entry_adjustment(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.supersede_time_entry_adjustment(uuid)', 'execute'),
  'signed-in and anonymous users cannot supersede an approval directly'
);

select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000002', '2020-03-11 01:00+00', '2020-03-11 09:00+00', 'Tự sửa giờ', 'offline') $$,
  '42501',
  'TIMEKEEPING_MANAGE_PERMISSION_REQUIRED',
  'staff cannot adjust attendance directly'
);

select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);

-- ---------------------------------------------------------------------------
-- Delete
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ delete from public.time_entries where id = '36000000-0000-0000-0000-000000000001' $$,
  '23514',
  'TIME_ENTRIES_CANNOT_BE_DELETED',
  'a plain delete is still blocked outside the workflow'
);

select throws_ok(
  $$ select * from public.admin_delete_time_entry('36000000-0000-0000-0000-000000000001', '   ') $$,
  '22023',
  'TIME_ENTRY_DELETE_REASON_REQUIRED',
  'deleting requires a reason'
);

select throws_ok(
  $$ select * from public.admin_delete_time_entry('36000000-0000-0000-0000-000000000003', 'Chấm nhầm') $$,
  '23514',
  'TIME_ENTRY_OPEN_CANNOT_BE_DELETED',
  'an open entry cannot be deleted'
);

insert into public.payroll_periods (period_month, pay_date, status, generated_by, reviewed_by, reviewed_at, approved_by, approved_at)
values ('2020-04-01', '2020-05-28', 'approved',
  '16000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', now(),
  '16000000-0000-0000-0000-000000000001', now());

select throws_ok(
  $$ select * from public.admin_delete_time_entry('36000000-0000-0000-0000-000000000004', 'Chấm nhầm') $$,
  '23514',
  'TIME_ENTRY_LOCKED_BY_PAYROLL',
  'an entry in a month with approved payroll cannot be deleted'
);

select throws_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000004', '2020-04-10 01:00+00', '2020-04-10 06:00+00', 'Sửa sau khi chốt lương') $$,
  '23514',
  'TIME_ENTRY_LOCKED_BY_PAYROLL',
  'an entry in a month with approved payroll cannot be adjusted'
);

insert into public.time_entry_adjustment_requests (
  id, time_entry_id, requester_id,
  original_check_in_at, original_check_in_mode, original_check_out_at, original_check_out_mode,
  requested_check_in_at, requested_check_in_mode, requested_check_out_at, requested_check_out_mode,
  request_reason
) values (
  '46000000-0000-0000-0000-000000000004', '36000000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-000000000002',
  '2020-04-10 01:00+00', 'offline', '2020-04-10 05:00+00', 'offline',
  '2020-04-10 01:00+00', 'offline', '2020-04-10 07:00+00', 'offline',
  'Em về lúc 14h'
);

select throws_ok(
  $$ select * from public.decide_time_entry_adjustment('46000000-0000-0000-0000-000000000004', 'approved', null) $$,
  '23514',
  'TIME_ENTRY_LOCKED_BY_PAYROLL',
  'a request in a month with approved payroll cannot be approved'
);

select lives_ok(
  $$ select * from public.decide_time_entry_adjustment('46000000-0000-0000-0000-000000000004', 'rejected', 'Kỳ lương đã chốt') $$,
  'a request in a locked month can still be rejected'
);

select throws_ok(
  $$ select * from public.admin_create_time_entry('16000000-0000-0000-0000-000000000002', '2020-04-11', '2020-04-11 01:00+00', '2020-04-11 03:00+00', 'offline', 'Công bù') $$,
  '23514',
  'TIME_ENTRY_LOCKED_BY_PAYROLL',
  'make-up attendance cannot be added to a month with approved payroll'
);

insert into public.attendance_exception_reviews (time_entry_id, check_out_reason)
values ('36000000-0000-0000-0000-000000000004', 'Mất mạng khi chấm ra');

select throws_ok(
  $$ select public.decide_attendance_exception('36000000-0000-0000-0000-000000000004', 'approved', 'Đã xác minh') $$,
  '23514',
  'TIME_ENTRY_LOCKED_BY_PAYROLL',
  'an attendance exception in a locked month cannot be decided'
);

-- A period under review is locked too: approving it later keeps its run, so a
-- change made during review would never reach the approved statement.
insert into public.payroll_periods (period_month, pay_date, status, generated_by, reviewed_by, reviewed_at)
values ('2020-06-01', '2020-07-28', 'review',
  '16000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', now());

insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, check_out_at, check_out_mode, status)
values
  ('36000000-0000-0000-0000-000000000008', '16000000-0000-0000-0000-000000000002', '2020-06-10', '2020-06-10 01:00+00', 'offline', '2020-06-10 05:00+00', 'offline', 'checked_out'),
  ('36000000-0000-0000-0000-000000000009', '16000000-0000-0000-0000-000000000002', '2020-07-10', '2020-07-10 01:00+00', 'offline', '2020-07-10 05:00+00', 'offline', 'checked_out');

select throws_ok(
  $$ select * from public.admin_delete_time_entry('36000000-0000-0000-0000-000000000008', 'Chấm nhầm') $$,
  '23514',
  'TIME_ENTRY_LOCKED_BY_PAYROLL',
  'an entry in a month whose payroll is under review cannot be deleted'
);

insert into public.payroll_periods (period_month, pay_date, status, generated_by)
values ('2020-07-01', '2020-08-28', 'draft', '16000000-0000-0000-0000-000000000001');

select lives_ok(
  $$ select * from public.admin_delete_time_entry('36000000-0000-0000-0000-000000000009', 'Chấm nhầm') $$,
  'an entry in a month whose payroll is still a draft can be deleted'
);

-- Payroll skips an imported (Excel/manual) timekeeping fact only while the day
-- still has a closed system entry; deleting the last one would pay the import.
insert into public.payroll_source_facts (fact_type, source_key, source_origin, event_date, staff_id, quantity)
values ('timekeeping', 'readjust-test:2020-03-14', 'manual', '2020-03-14', '16000000-0000-0000-0000-000000000002', 240);

select throws_ok(
  $$ select * from public.admin_delete_time_entry('36000000-0000-0000-0000-000000000005', 'Chấm trùng') $$,
  '23514',
  'TIME_ENTRY_DELETE_WOULD_RESTORE_IMPORTED_TIMEKEEPING',
  'deleting the last entry of a day with imported timekeeping is refused'
);

insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, check_out_at, check_out_mode, status)
values ('36000000-0000-0000-0000-000000000010', '16000000-0000-0000-0000-000000000002', '2020-03-14', '2020-03-14 06:00+00', 'offline', '2020-03-14 08:00+00', 'offline', 'checked_out');

select lives_ok(
  $$ select * from public.admin_delete_time_entry('36000000-0000-0000-0000-000000000005', 'Chấm trùng') $$,
  'a duplicate can be deleted on an imported-timekeeping day while another closed entry remains'
);

select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$ select * from public.admin_delete_time_entry('36000000-0000-0000-0000-000000000001', 'Tự xoá') $$,
  '42501',
  'TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED',
  'staff cannot delete attendance'
);

select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);

-- Generated by /ship test coverage audit (Claude Opus 5.5) — 2026-10-23
-- Value: protects=outside admin_delete_time_entry, adjustment history and evidence stay undeletable, and the delete bypass never lets evidence be edited;
-- fails_when=a rewritten guard trigger's GUC check is inverted or defaulted open, or the evidence guard returns early for UPDATE when the bypass is on;
-- why_new=only the time_entries guard had a plain-delete case; the adjustment and evidence guards were rewritten with no test; seam=none;
-- no_claim=runs as the test superuser, so it proves the triggers only, not table grants or RLS for API roles
select throws_ok(
  $$ delete from public.time_entry_adjustment_requests where time_entry_id = '36000000-0000-0000-0000-000000000001' $$,
  '23514',
  'TIME_ENTRY_ADJUSTMENT_REQUESTS_CANNOT_BE_DELETED',
  'adjustment history cannot be deleted outside the workflow'
);

select throws_ok(
  $$ delete from public.time_entry_evidence where time_entry_id = '36000000-0000-0000-0000-000000000001' $$,
  '23514',
  'TIME_ENTRY_EVIDENCE_IS_IMMUTABLE',
  'evidence cannot be deleted outside the workflow'
);

select set_config('app.allow_time_entry_delete', 'true', true);

select throws_ok(
  $$ update public.time_entry_evidence set gps_accuracy_meters = 1 where time_entry_id = '36000000-0000-0000-0000-000000000001' $$,
  '23514',
  'TIME_ENTRY_EVIDENCE_IS_IMMUTABLE',
  'the delete bypass never allows editing evidence'
);

select set_config('app.allow_time_entry_delete', 'false', true);

select lives_ok(
  $$ select * from public.admin_delete_time_entry('36000000-0000-0000-0000-000000000001', 'Chấm trùng ca') $$,
  'the owner deletes an adjusted entry with evidence'
);

select ok(
  not exists (select 1 from public.time_entries where id = '36000000-0000-0000-0000-000000000001'),
  'the entry is gone'
);

select ok(
  not exists (select 1 from public.time_entry_adjustment_requests where time_entry_id = '36000000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.time_entry_evidence where time_entry_id = '36000000-0000-0000-0000-000000000001'),
  'its adjustments and evidence are removed with it'
);

select results_eq(
  $$ select reason, jsonb_array_length(old_data -> 'adjustment_requests'), jsonb_array_length(old_data -> 'evidence')
     from public.audit_logs
     where action = 'time_entry_deleted' and entity_id = '36000000-0000-0000-0000-000000000001' $$,
  $$ values ('Chấm trùng ca'::text, 2, 1) $$,
  'the audit log keeps the reason and a snapshot of the removed rows'
);

select ok(
  not ((select old_data -> 'evidence' -> 0 from public.audit_logs where action = 'time_entry_deleted' and entity_id = '36000000-0000-0000-0000-000000000001') ? 'gps_latitude')
  and not ((select old_data -> 'time_entry' from public.audit_logs where action = 'time_entry_deleted' and entity_id = '36000000-0000-0000-0000-000000000001')
    ?| array['last_latitude', 'last_longitude', 'last_location_accuracy']),
  'the audit snapshot leaves out precise coordinates from evidence and the entry'
);

select is(
  current_setting('app.allow_time_entry_delete', true),
  'false',
  'the delete bypass is switched off again after the workflow'
);

-- Generated by /ship test coverage audit (Claude Opus 5.5) — 2026-10-23
-- Value: protects=an entry that went through an attendance exception (review + submission rows, FK restrict) can still be deleted, those rows go with it, and the audit snapshot keeps the review;
-- fails_when=the exception deletes are dropped or run after the time_entries delete (FK violation aborts the delete), or the review is left out of old_data;
-- why_new=the delete case above has evidence and adjustments but no exception rows; seam=none;
-- no_claim=does not cover entries referenced by payroll_line_items (the lock branch); runs as the test superuser
insert into public.attendance_exception_reviews (time_entry_id, check_out_reason)
values ('36000000-0000-0000-0000-000000000002', 'Mất mạng khi chấm ra');

insert into public.attendance_exception_submissions (request_id, staff_id, operation, time_entry_id, reason)
values ('56000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', 'check-out', '36000000-0000-0000-0000-000000000002', 'Mất mạng khi chấm ra');

select lives_ok(
  $$ select * from public.admin_delete_time_entry('36000000-0000-0000-0000-000000000002', 'Nhân sự chấm nhầm ngày') $$,
  'an entry with an attendance exception can be deleted'
);

select ok(
  not exists (select 1 from public.attendance_exception_reviews where time_entry_id = '36000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.attendance_exception_submissions where time_entry_id = '36000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.time_entries where id = '36000000-0000-0000-0000-000000000002'),
  'its attendance exception review and submission are removed with it'
);

select results_eq(
  $$ select old_data -> 'attendance_exception_review' ->> 'check_out_reason', jsonb_array_length(old_data -> 'attendance_exception_submissions')
     from public.audit_logs
     where action = 'time_entry_deleted' and entity_id = '36000000-0000-0000-0000-000000000002' $$,
  $$ values ('Mất mạng khi chấm ra'::text, 1) $$,
  'the audit snapshot keeps the attendance exception'
);

-- ---------------------------------------------------------------------------
-- Guards kept by the rewritten RPCs
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select * from public.decide_time_entry_adjustment('46000000-0000-0000-0000-0000000000ff', 'approved', null) $$,
  'P0002',
  'TIME_ENTRY_ADJUSTMENT_REQUEST_NOT_FOUND',
  'deciding an unknown request reports it as not found'
);

insert into public.time_entry_adjustment_requests (
  id, time_entry_id, requester_id,
  original_check_in_at, original_check_in_mode, original_check_out_at, original_check_out_mode,
  requested_check_in_at, requested_check_in_mode, requested_check_out_at, requested_check_out_mode,
  request_reason
) values (
  '46000000-0000-0000-0000-000000000005', '36000000-0000-0000-0000-000000000007', '16000000-0000-0000-0000-000000000001',
  '2020-03-16 01:00+00', 'offline', '2020-03-16 05:00+00', 'offline',
  '2020-03-16 01:00+00', 'offline', '2020-03-16 06:00+00', 'offline',
  'Tự xin thêm giờ'
);

select throws_ok(
  $$ select * from public.decide_time_entry_adjustment('46000000-0000-0000-0000-000000000005', 'approved', null) $$,
  '42501',
  'TIME_ENTRY_ADJUSTMENT_SELF_APPROVAL_FORBIDDEN',
  'an approver cannot approve their own request'
);

select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$ select * from public.decide_time_entry_adjustment('46000000-0000-0000-0000-000000000005', 'rejected', 'Không') $$,
  '42501',
  'TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED',
  'staff cannot decide adjustment requests'
);

select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);

-- The form has minute precision; recorded times carry seconds.
insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, check_out_at, check_out_mode, status)
values ('36000000-0000-0000-0000-000000000011', '16000000-0000-0000-0000-000000000002', '2020-03-18', '2020-03-18 01:00:37+00', 'online', '2020-03-18 05:00:12+00', 'online', 'checked_out');

select throws_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000011', '2020-03-18 01:00+00', '2020-03-18 05:00+00', 'Bấm lưu nhầm') $$,
  '22023',
  'TIME_ENTRY_ADJUSTMENT_NO_CHANGE',
  'saving the times the form showed, unchanged, is a no-change'
);

select lives_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000011', '2020-03-18 01:00+00', '2020-03-18 05:00+00', 'Thực ra dạy tại trung tâm', 'offline') $$,
  'only the mode is changed'
);

select results_eq(
  $$ select check_in_at, check_out_at, check_in_mode from public.time_entries where id = '36000000-0000-0000-0000-000000000011' $$,
  $$ values ('2020-03-18 01:00:37+00'::timestamptz, '2020-03-18 05:00:12+00'::timestamptz, 'offline'::text) $$,
  'a mode-only change keeps the recorded seconds'
);

select results_eq(
  $$ select actor_user_id from public.audit_logs
     where action = 'time_entry_adjustment_direct' and metadata ->> 'time_entry_id' = '36000000-0000-0000-0000-000000000011' $$,
  $$ values ('16000000-0000-0000-0000-000000000001'::uuid) $$,
  'a direct adjustment is audited as the owner''s, not as a staff request'
);

select throws_ok(
  format(
    $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000011', '2020-03-18 01:00+00', %L, 'Nhập nhầm năm') $$,
    now() + interval '1 day'
  ),
  '22023',
  'TIME_ENTRY_ADJUSTMENT_CANNOT_USE_FUTURE_TIME',
  'an adjustment cannot end in the future'
);

select throws_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000011', '2020-03-19 01:00+00', '2020-03-19 05:00+00', 'Nhập nhầm ngày') $$,
  '22023',
  'TIME_ENTRY_ADJUSTMENT_WORK_DATE_INVALID',
  'the check-in must stay on the entry''s work date'
);

-- A forgotten check-out: adjusting an open shift closes it.
insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, status)
values ('36000000-0000-0000-0000-000000000012', '16000000-0000-0000-0000-000000000001', '2020-03-17', '2020-03-17 01:00+00', 'offline', 'open');

select lives_ok(
  $$ select * from public.admin_adjust_time_entry('36000000-0000-0000-0000-000000000012', '2020-03-17 01:00+00', '2020-03-17 04:00+00', 'Quên chấm ra') $$,
  'an open shift can be closed by a direct adjustment'
);

select results_eq(
  $$ select entry.status, entry.check_out_at, request.original_check_out_at
     from public.time_entries as entry
     join public.time_entry_adjustment_requests as request on request.time_entry_id = entry.id and request.status = 'approved'
     where entry.id = '36000000-0000-0000-0000-000000000012' $$,
  $$ values ('checked_out'::text, '2020-03-17 04:00+00'::timestamptz, '2020-03-17 01:00+00'::timestamptz) $$,
  'the closed shift records the check-in as its original check-out'
);

select * from finish();
rollback;
