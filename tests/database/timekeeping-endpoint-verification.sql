-- Run with psql -v ON_ERROR_STOP=1 against a disposable migrated database.
-- Everything, including test fixtures, rolls back.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('13000000-0000-0000-0000-000000000091','gps-staff@example.test','{"full_name":"GPS staff"}'),
 ('13000000-0000-0000-0000-000000000092','gps-reviewer@example.test','{"full_name":"GPS reviewer"}'),
 ('13000000-0000-0000-0000-000000000093','gps-other@example.test','{"full_name":"GPS other"}');
insert into public.roles(id,code,name) values
 ('23000000-0000-0000-0000-000000000091','gps_endpoint_test','GPS endpoint test');
insert into public.role_permissions(role_id,permission_id)
 select '23000000-0000-0000-0000-000000000091',id from public.permissions
 where code in ('timekeeping.check','timekeeping.view','timekeeping.approve_adjustment');
insert into public.user_role_assignments(user_id,role_id,assignment_reason) values
 ('13000000-0000-0000-0000-000000000091','23000000-0000-0000-0000-000000000091','test'),
 ('13000000-0000-0000-0000-000000000092','23000000-0000-0000-0000-000000000091','test');
update public.center_attendance_configs set is_active = false;
insert into public.center_attendance_configs(code,name,center_latitude,center_longitude,attendance_radius_m,gps_max_accuracy_m,is_active)
 values('GPS_TEST','GPS test',10,106,100,100,true);

-- A real existing offline shift without a recent GPS sample remains open.
insert into public.time_entries(id,staff_id,work_date,check_in_at,check_in_mode,status,last_location_at)
 values('33000000-0000-0000-0000-000000000091','13000000-0000-0000-0000-000000000091',
 (now() at time zone 'Asia/Ho_Chi_Minh')::date, now()-interval '10 minutes','offline','open',now()-interval '10 minutes');
select public.run_teaching_assistant_timekeeping_watchdog();
do $$ begin
 if (now() at time zone 'Asia/Ho_Chi_Minh')::time >= time '23:30' then
  raise exception 'Run daytime fixtures before 23:30 Vietnam time';
 end if;
 if not exists(select 1 from public.time_entries where id='33000000-0000-0000-0000-000000000091' and status='open') then
  raise exception 'Missing GPS must not close an open shift';
 end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000091',true);
do $$ declare response jsonb; begin
 response := public.get_attendance_verification_policy();
 if response->>'continuous_gps_tracking_required' <> 'false' or response->>'exception_review_enabled' <> 'true' then
  raise exception 'Endpoint verification policy missing';
 end if;
 response := public.submit_attendance_heartbeat(0,0,1);
 if response->>'session_active' <> 'true' then raise exception 'Old client heartbeat closed shift'; end if;
 begin
  perform public.check_out_time_entry('offline',null,null,null,null,null);
  raise exception 'Normal offline checkout must still require GPS';
 exception when sqlstate '22023' then null; end;
end $$;
select public.request_attendance_exception('check-out','GPS timeout','43000000-0000-0000-0000-000000000091','33000000-0000-0000-0000-000000000091');
-- Retry the same logical operation: same ID, no second review or changed time.
select public.request_attendance_exception('check-out','GPS timeout','43000000-0000-0000-0000-000000000091','33000000-0000-0000-0000-000000000091');
do $$ begin
 if (public.get_attendance_exception_reviews()->0->>'status') <> 'pending' then raise exception 'Pending review absent'; end if;
 if exists(select 1 from public.get_my_monthly_timekeeping_entries(extract(month from now())::int,extract(year from now())::int)
   where entry_id='33000000-0000-0000-0000-000000000091') then raise exception 'Unapproved hours leaked into monthly report'; end if;
 begin
  perform public.decide_attendance_exception('33000000-0000-0000-0000-000000000091','approved','self');
  raise exception 'Self approval allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.request_attendance_exception('check-out','changed','43000000-0000-0000-0000-000000000091','33000000-0000-0000-0000-000000000091');
  raise exception 'Conflicting replay accepted';
 exception when sqlstate '22023' then null; end;
end $$;

select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000093',true);
do $$ begin
 if public.get_attendance_exception_reviews() <> '[]'::jsonb then raise exception 'Another employee can read private requests'; end if;
 begin
  perform public.request_attendance_exception('check-in','test','43000000-0000-0000-0000-000000000093',null);
  raise exception 'Unpermitted staff can submit';
 exception when insufficient_privilege then null; end;
 begin
  update public.attendance_exception_reviews set status='approved';
  raise exception 'Direct review write allowed';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000092',true);
select public.decide_attendance_exception('33000000-0000-0000-0000-000000000091','approved','Confirmed onsite work');
do $$ begin
 begin
  perform public.decide_attendance_exception('33000000-0000-0000-0000-000000000091','rejected','second decision');
  raise exception 'Review decision was overwritten';
 exception when sqlstate '23514' then null; end;
end $$;
select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000091',true);
do $$ begin
 if not exists(select 1 from public.get_my_monthly_timekeeping_entries(extract(month from now())::int,extract(year from now())::int)
   where entry_id='33000000-0000-0000-0000-000000000091' and total_minutes=10) then raise exception 'Approved time not restored'; end if;
end $$;

-- GPS-less check-in and ordinary verified checkout keep the review pending.
select public.request_attendance_exception('check-in','Location unavailable','43000000-0000-0000-0000-000000000094',null);
select public.request_attendance_exception('check-in','Location unavailable','43000000-0000-0000-0000-000000000094',null);
do $$ begin
 begin
  perform public.request_attendance_exception('check-in','duplicate','43000000-0000-0000-0000-000000000095',null);
  raise exception 'Second open shift allowed';
 exception when unique_violation then null; end;
end $$;
select public.check_out_time_entry('offline',10,106,5,null,null);
reset role;
do $$ declare target uuid; begin
 select time_entry_id into target from public.attendance_exception_submissions where request_id='43000000-0000-0000-0000-000000000094';
 if public.time_entry_is_verified(target) then raise exception 'Verified checkout erased pending check-in'; end if;
 if (select count(*) from public.attendance_exception_submissions where request_id='43000000-0000-0000-0000-000000000094') <> 1 then raise exception 'Replay created duplicate'; end if;
 perform set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000092',true);
 perform public.decide_attendance_exception(target,'rejected','No supporting evidence');
 if public.time_entry_is_verified(target) then raise exception 'Rejected hours counted'; end if;
 if not exists(select 1 from public.audit_logs where entity_id=target::text and action='attendance_exception_decided') then raise exception 'Missing review audit'; end if;
end $$;

-- Existing end-of-day safety remains, and future/after-cutoff check-ins cannot
-- create a negative duration when the watchdog runs.
insert into public.time_entries(id,staff_id,work_date,check_in_at,check_in_mode,status)
 values('33000000-0000-0000-0000-000000000096','13000000-0000-0000-0000-000000000091',
 (now() at time zone 'Asia/Ho_Chi_Minh')::date-1,now()-interval '1 day','offline','open');
select public.run_teaching_assistant_timekeeping_watchdog();
do $$ begin
 if not exists(select 1 from public.time_entries where id='33000000-0000-0000-0000-000000000096' and status='auto_ended' and clock_out_reason='daily_cutoff' and check_out_at >= check_in_at) then
  raise exception 'Daily cutoff stopped working';
 end if;
 if not exists(select 1 from public.time_entries where id='33000000-0000-0000-0000-000000000091' and check_in_at=now()-interval '10 minutes') then
  raise exception 'Review changed original check-in';
 end if;
end $$;
rollback;
\echo 'PASS: endpoint verification, retry, permissions, review, monthly totals and daily cutoff'
