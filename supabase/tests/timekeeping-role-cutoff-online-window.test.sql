begin;
select plan(10);

-- Fixture: one teaching assistant, three owners (non-TA) used as online check-in actors.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('b1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'cutoff-ta@example.test', '{}', '{"full_name":"Cutoff TA"}', now(), now()),
  ('b1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'cutoff-ops@example.test', '{}', '{"full_name":"Cutoff Ops"}', now(), now()),
  ('b1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'cutoff-noshift@example.test', '{}', '{"full_name":"Cutoff No Shift"}', now(), now()),
  ('b1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'cutoff-pastshift@example.test', '{}', '{"full_name":"Cutoff Past Shift"}', now(), now());

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select 'b1000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'teaching_assistant';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select u.id, r.id, 'fixture'
from (values ('b1000000-0000-4000-8000-000000000002'::uuid), ('b1000000-0000-4000-8000-000000000003'::uuid), ('b1000000-0000-4000-8000-000000000004'::uuid)) as u(id)
cross join public.roles r where r.code = 'owner';

select is(public.timekeeping_daily_cutoff('b1000000-0000-4000-8000-000000000001'), time '22:30', 'teaching assistants auto-end at 22:30');
select is(public.timekeeping_daily_cutoff('b1000000-0000-4000-8000-000000000002'), time '22:45', 'other roles auto-end at 22:45');

-- Watchdog: yesterday's forgotten shifts close at each role's cutoff, not 23:30.
insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, status) values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
    (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1,
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1)::timestamp + time '18:00') at time zone 'Asia/Ho_Chi_Minh', 'offline', 'open'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002',
    (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1,
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1)::timestamp + time '18:00') at time zone 'Asia/Ho_Chi_Minh', 'online', 'open');

select is(public.run_teaching_assistant_timekeeping_watchdog(), 2, 'watchdog closes both stale shifts');
select is(
  (select check_out_at at time zone 'Asia/Ho_Chi_Minh' from public.time_entries where id = 'b2000000-0000-4000-8000-000000000001'),
  (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1)::timestamp + time '22:30'),
  'teaching assistant shift is cut at 22:30');
select is(
  (select check_out_at at time zone 'Asia/Ho_Chi_Minh' from public.time_entries where id = 'b2000000-0000-4000-8000-000000000002'),
  (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1)::timestamp + time '22:45'),
  'non-TA shift is cut at 22:45');
select is(
  (select status || '/' || clock_out_reason from public.time_entries where id = 'b2000000-0000-4000-8000-000000000002'),
  'auto_ended/daily_cutoff', 'auto-ended entries keep the daily_cutoff reason');

-- Online check-in window. Shifts are built around the current Vietnam time so
-- the assertions hold whenever the suite runs between 01:30 and 21:00.
insert into public.work_shifts (id, code, name, start_time, end_time) values
  ('b3000000-0000-4000-8000-000000000001', 'ONLNOW', 'Covers now',
    ((now() at time zone 'Asia/Ho_Chi_Minh')::time - interval '1 hour')::time,
    ((now() at time zone 'Asia/Ho_Chi_Minh')::time + interval '1 hour')::time),
  ('b3000000-0000-4000-8000-000000000002', 'ONLPAST', 'Ended earlier',
    ((now() at time zone 'Asia/Ho_Chi_Minh')::time - interval '1 hour 20 minutes')::time,
    ((now() at time zone 'Asia/Ho_Chi_Minh')::time - interval '40 minutes')::time);

insert into public.staff_shift_assignments (staff_id, work_shift_id, weekday, effective_from) values
  ('b1000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001',
    extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh'))::smallint, (now() at time zone 'Asia/Ho_Chi_Minh')::date),
  ('b1000000-0000-4000-8000-000000000004', 'b3000000-0000-4000-8000-000000000002',
    extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh'))::smallint, (now() at time zone 'Asia/Ho_Chi_Minh')::date);

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', true);
select case
  when (now() at time zone 'Asia/Ho_Chi_Minh')::time between time '01:30' and time '21:00' then
    throws_ok($$select public.check_in_time_entry('online', null, null, null, null, null)$$,
      '23514', 'TIME_ENTRY_ONLINE_REQUIRES_SCHEDULED_SHIFT', 'online check-in without an assigned shift is refused')
  else skip('outside the daytime window', 1)
end;

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000004', true);
select case
  when (now() at time zone 'Asia/Ho_Chi_Minh')::time between time '01:30' and time '21:00' then
    throws_ok($$select public.check_in_time_entry('online', null, null, null, null, null)$$,
      '23514', 'TIME_ENTRY_ONLINE_OUTSIDE_SHIFT_WINDOW', 'online check-in more than 15 minutes after the shift is refused')
  else skip('outside the daytime window', 1)
end;

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
select case
  when (now() at time zone 'Asia/Ho_Chi_Minh')::time between time '01:30' and time '21:00' then
    lives_ok($$select public.check_in_time_entry('online', null, null, null, null, null)$$,
      'online check-in inside the assigned shift succeeds')
  else skip('outside the daytime window', 1)
end;
select case
  when (now() at time zone 'Asia/Ho_Chi_Minh')::time between time '01:30' and time '21:00' then
    is((select staff_shift_assignment_id is not null from public.time_entries where staff_id = 'b1000000-0000-4000-8000-000000000002' and status = 'open'),
      true, 'the open online entry is linked to the assigned shift')
  else skip('outside the daytime window', 1)
end;

select * from finish();
rollback;
