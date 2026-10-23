-- admin_adjust_time_entry keeps the entry's online/offline mode when the owner
-- does not choose one. It used to record every direct adjustment as 'offline',
-- so remote shifts paid 100% (11 entries on prod in 2026-09).
begin;
select plan(10);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'adjust-mode-owner@example.test', '{}', '{"full_name":"Adjust Mode Owner"}', now(), now()),
  ('c1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'adjust-mode-ta@example.test', '{}', '{"full_name":"Adjust Mode TA"}', now(), now());

insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select 'c1000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select 'c1000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'teaching_assistant';

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);

-- 270,000 VND/day ÷ 540 minutes = 500 VND/minute; online pays 50% = 250.
insert into public.staff_payroll_position_versions (staff_id, position_code, effective_from, reason, created_by)
values ('c1000000-0000-4000-8000-000000000002', 'teaching_assistant', '2026-01-01', 'fixture', 'c1000000-0000-4000-8000-000000000001');
insert into public.staff_daily_rate_versions (staff_id, effective_from, offline_daily_rate_vnd, note, reason, created_by)
values ('c1000000-0000-4000-8000-000000000002', '2026-01-01', 270000, 'fixture', 'fixture', 'c1000000-0000-4000-8000-000000000001');

-- c2…01 is a remote (online) grading shift, c2…02 an evening shift at the centre.
insert into public.time_entries (id, staff_id, work_date, check_in_at, check_in_mode, check_out_at, check_out_mode, status, clock_out_reason)
select id::uuid, 'c1000000-0000-4000-8000-000000000002', date '2026-09-15',
  (date '2026-09-15' + start_at) at time zone 'Asia/Ho_Chi_Minh', mode,
  (date '2026-09-15' + end_at) at time zone 'Asia/Ho_Chi_Minh', mode, 'checked_out', 'manual'
from (values
  ('c2000000-0000-4000-8000-000000000001', time '11:05', time '12:50', 'online'),
  ('c2000000-0000-4000-8000-000000000002', time '18:10', time '22:40', 'offline')
) as fixture(id, start_at, end_at, mode);

select public.admin_adjust_time_entry(id::uuid,
  (date '2026-09-15' + start_at) at time zone 'Asia/Ho_Chi_Minh',
  (date '2026-09-15' + end_at) at time zone 'Asia/Ho_Chi_Minh', 'Điều chỉnh giờ')
from (values
  ('c2000000-0000-4000-8000-000000000001', time '11:00', time '13:00'),
  ('c2000000-0000-4000-8000-000000000002', time '18:00', time '22:30')
) as adjust(id, start_at, end_at);

select is(
  (select requested_check_in_mode || '/' || requested_check_out_mode from public.time_entry_adjustment_requests
   where time_entry_id = 'c2000000-0000-4000-8000-000000000001' and status = 'approved'),
  'online/online', 'adjusting an online shift records it as online');
select is(
  (select check_out_mode from public.time_entries where id = 'c2000000-0000-4000-8000-000000000001'),
  'online', 'the online shift still checks out online');
select is(
  (select requested_check_in_mode || '/' || requested_check_out_mode from public.time_entry_adjustment_requests
   where time_entry_id = 'c2000000-0000-4000-8000-000000000002' and status = 'approved'),
  'offline/offline', 'adjusting an offline shift records it as offline');

select set_config('test.projection', public.compute_payroll_projection(
  date '2026-09-01', now(), 'estimate', 'c1000000-0000-4000-8000-000000000002')::text, true);
create temporary view projection_lines as
select line->>'sourceId' as source_id, line->>'lineType' as line_type, (line->>'amountVnd')::bigint as amount_vnd
from jsonb_array_elements(current_setting('test.projection')::jsonb->'lines') as line;

select is(
  (select line_type || ':' || amount_vnd from projection_lines where source_id = 'c2000000-0000-4000-8000-000000000001'),
  'base_online:30000', 'payroll pays the adjusted 120-minute remote shift at 50%');
select is(
  (select line_type || ':' || amount_vnd from projection_lines where source_id = 'c2000000-0000-4000-8000-000000000002'),
  'base_offline:135000', 'the adjusted 270-minute offline shift still pays 100%');
select is(
  (current_setting('test.projection')::jsonb->'statements'->0->>'payableVnd')::bigint,
  165000::bigint, 'the statement totals both shifts');

-- An adjusted entry can be adjusted again; the earlier approval is superseded.
select lives_ok(
  $$select public.admin_adjust_time_entry('c2000000-0000-4000-8000-000000000001',
      (date '2026-09-15' + time '11:00') at time zone 'Asia/Ho_Chi_Minh',
      (date '2026-09-15' + time '13:30') at time zone 'Asia/Ho_Chi_Minh', 'Sửa lần hai')$$,
  'an adjusted online shift can be adjusted again and stays online');
select is(
  (select string_agg(status || ':' || requested_check_in_mode, ',' order by status)
   from public.time_entry_adjustment_requests where time_entry_id = 'c2000000-0000-4000-8000-000000000001'),
  'approved:online,superseded:online', 'the re-adjust supersedes the earlier approval and keeps the mode');

-- Payroll reads only the approval in effect: the 150-minute re-adjusted shift,
-- not the superseded 120-minute one, and not both.
select set_config('test.projection_after', public.compute_payroll_projection(
  date '2026-09-01', now(), 'estimate', 'c1000000-0000-4000-8000-000000000002')::text, true);
select is(
  (select string_agg(line->>'lineType' || ':' || (line->>'amountVnd'), ',')
   from jsonb_array_elements(current_setting('test.projection_after')::jsonb->'lines') as line
   where line->>'sourceId' = 'c2000000-0000-4000-8000-000000000001'),
  'base_online:37500', 'payroll pays the re-adjusted 150-minute remote shift once, at 50%');
select is(
  (current_setting('test.projection_after')::jsonb->'statements'->0->>'payableVnd')::bigint,
  172500::bigint, 'the statement totals the re-adjusted shift and the offline shift');

select * from finish();
rollback;
