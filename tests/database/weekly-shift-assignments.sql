-- Focused integration suite. Run via scripts/test-weekly-schedule-db.mjs.
-- Uses real scheduling migrations and check-in routines; auth/evidence are fixtures.
begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('test.permissions','staff.manage,timekeeping.view,timekeeping.check',true);

do $$
declare
  today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  week date := date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')::date;
  staff uuid := '22222222-2222-4222-8222-222222222222';
  day_shift uuid := '33333333-3333-4333-8333-333333333333';
  night_shift uuid := '44444444-4444-4444-8444-444444444444';
  legacy uuid := '55555555-5555-4555-8555-555555555555';
  first_id uuid; second_id uuid; third_id uuid; version timestamptz; saved jsonb; count_before integer;
begin
  assert (select effective_from = today - 14 and effective_to = week + 6 from public.staff_shift_assignments where id = legacy), 'legacy dates/ID preserved except future recurrence cutoff';
  assert jsonb_array_length(public.get_weekly_shift_schedule(week - 7)) = 1, 'legacy history remains readable';
  assert public.get_weekly_shift_schedule(week + 7) = '[]'::jsonb, 'new weeks do not silently inherit recurring schedules';

  first_id := public.save_weekly_shift_assignment(week + 7,1,staff,day_shift,null,null,'Week one');
  second_id := public.save_weekly_shift_assignment(week + 14,1,staff,night_shift,null,null,'Week two');
  assert first_id <> second_id, 'weeks have separate IDs';
  assert jsonb_array_length(public.get_weekly_shift_schedule(week + 7)) = 1, 'only selected week returned';
  assert (select work_shift_id = night_shift from public.staff_shift_assignments where id = second_id), 'second week independent';
  select updated_at into version from public.staff_shift_assignments where id = first_id;
  perform public.save_weekly_shift_assignment(week + 7,1,staff,night_shift,first_id,version,'Change first week');
  begin
    perform public.save_weekly_shift_assignment(week + 7,1,staff,day_shift,first_id,version,'Stale overwrite');
    raise exception 'EXPECTED_CONFLICT';
  exception when serialization_failure then assert sqlerrm = 'WEEKLY_SCHEDULE_CONFLICT'; end;
  begin
    perform public.save_weekly_shift_assignment(week + 7,1,staff,day_shift,null,null,'Duplicate create');
    raise exception 'EXPECTED_CONFLICT';
  exception when serialization_failure then assert sqlerrm = 'WEEKLY_SCHEDULE_CONFLICT'; end;
  assert (select work_shift_id = night_shift from public.staff_shift_assignments where id = second_id), 'first-week edits never affect second-week row';

  select updated_at into version from public.staff_shift_assignments where id = legacy;
  third_id := public.save_weekly_shift_assignment(week,extract(isodow from today)::int,staff,null,legacy,version,'Cancel current legacy slot');
  assert third_id <> legacy, 'override preserves legacy row';
  assert (select id = third_id and not is_active from public.resolve_staff_shift_on_date(staff,today)), 'tombstone overrides legacy';
  assert public.resolve_staff_shift_for_checkin(staff,today,'10:00') is null, 'cancelled legacy never resurrects at check-in';
  assert (select is_active from public.staff_shift_assignments where id = legacy), 'original legacy row not rewritten';
  assert jsonb_array_length(public.get_weekly_shift_schedule(week - 7)) = 1, 'cancellation leaves previous week untouched';

  select updated_at into version from public.staff_shift_assignments where id = third_id;
  perform public.save_weekly_shift_assignment(week,extract(isodow from today)::int,staff,day_shift,third_id,version,'Assign again');
  assert public.resolve_staff_shift_for_checkin(staff,today,'10:00') = third_id, 'reassignment resolves correctly';
  -- Real normal check-in, including its original permission guard and actor lock.
  perform set_config('request.jwt.claim.sub',staff::text,true);
  perform public.check_in_time_entry('online',null,null,null,null,null);
  assert exists(select 1 from public.time_entries where staff_shift_assignment_id = third_id), 'real check-in persists the weekly FK';
  if to_regprocedure('public.request_attendance_exception(text,text,uuid,uuid)') is not null
    and (now() at time zone 'Asia/Ho_Chi_Minh')::time < time '23:30' then
    update public.time_entries set status = 'checked_out' where staff_id = staff;
    first_id := public.request_attendance_exception('check-in','Weekly exception regression',gen_random_uuid(),null);
    assert (select staff_shift_assignment_id = third_id from public.time_entries where id = first_id), 'real exception check-in persists weekly FK';
  end if;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  select updated_at into version from public.staff_shift_assignments where id = third_id;
  begin
    perform public.save_weekly_shift_assignment(week,extract(isodow from today)::int,staff,night_shift,third_id,version,'Modify after attendance');
    raise exception 'EXPECTED_ATTENDANCE_LOCK';
  exception when check_violation then assert sqlerrm = 'WEEKLY_SCHEDULE_HAS_ATTENDANCE'; end;
  assert (public.get_weekly_shift_schedule(week)->0->>'is_locked')::boolean, 'reader explains attendance lock';

  third_id := public.save_weekly_shift_assignment(week + 7,7,staff,night_shift,null,null,'Sunday night');
  assert public.resolve_staff_shift_for_checkin(staff,week + 14,'01:00') = third_id, 'Sunday overnight wins over Monday shift before its start';
  -- Also exercise the overnight branch when Monday is explicitly off.
  select updated_at into version from public.staff_shift_assignments where id = second_id;
  perform public.save_weekly_shift_assignment(week + 14,1,staff,null,second_id,version,'Monday off');
  assert public.resolve_staff_shift_for_checkin(staff,week + 14,'01:00') = third_id, 'Sunday overnight belongs to previous week';
  assert public.resolve_staff_shift_for_checkin(staff,week + 14,'03:00') is null, 'overnight ends at its end time';
  assert public.resolve_staff_shift_for_checkin(staff,week + 21,'01:00') is null, 'does not leak into later weeks';

  begin
    perform public.save_weekly_shift_assignment(week - 7,1,staff,day_shift,null,null,'Past');
    raise exception 'EXPECTED_PAST_LOCK';
  exception when check_violation then assert sqlerrm = 'WEEKLY_SCHEDULE_PAST_DATE'; end;
  begin
    perform public.get_weekly_shift_schedule(week + 1);
    raise exception 'EXPECTED_INVALID_WEEK';
  exception when invalid_parameter_value then null; end;
  update public.work_shifts set is_active = false where id = day_shift;
  update public.profiles set employment_status = 'inactive' where id = staff;
  saved := public.get_weekly_shift_schedule(week - 7);
  assert jsonb_array_length(saved) = 1, 'retired shift and former staff stay visible in history';
  begin
    perform public.save_weekly_shift_assignment(week + 21,1,staff,night_shift,null,null,'Inactive staff');
    raise exception 'EXPECTED_INACTIVE_STAFF';
  exception when check_violation then assert sqlerrm = 'STAFF_SHIFT_REQUIRES_ACTIVE_STAFF'; end;
  update public.profiles set employment_status = 'active' where id = staff;
  begin
    perform public.save_weekly_shift_assignment(week + 21,1,staff,day_shift,null,null,'Inactive shift');
    raise exception 'EXPECTED_INACTIVE_SHIFT';
  exception when check_violation then assert sqlerrm = 'STAFF_SHIFT_REQUIRES_ACTIVE_WORK_SHIFT'; end;
  assert exists(select 1 from public.audit_logs where reason = 'Sunday night' and entity_id = third_id::text), 'assignment writes are audited';

  perform set_config('test.permissions','timekeeping.view',true);
  begin
    perform public.save_weekly_shift_assignment(week + 21,1,staff,night_shift,null,null,'Reader write');
    raise exception 'EXPECTED_PERMISSION_DENIED';
  exception when insufficient_privilege then assert sqlerrm = 'STAFF_MANAGE_PERMISSION_REQUIRED'; end;
  perform public.get_weekly_shift_schedule(week + 7);
  perform set_config('test.permissions','staff.manage',true);
  begin
    perform public.get_weekly_shift_schedule(week);
    raise exception 'EXPECTED_READ_DENIED';
  exception when insufficient_privilege then assert sqlerrm = 'TIMEKEEPING_VIEW_PERMISSION_REQUIRED'; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.get_weekly_shift_schedule(week);
    raise exception 'EXPECTED_AUTH_DENIED';
  exception when insufficient_privilege then assert sqlerrm = 'AUTHENTICATED_USER_REQUIRED'; end;

  assert not has_function_privilege('authenticated','public.resolve_staff_shift_on_date(uuid,date)','execute'), 'internal selector inaccessible';
  assert not has_function_privilege('anon','public.save_weekly_shift_assignment(date,integer,uuid,uuid,uuid,timestamptz,text)','execute'), 'anonymous writes denied';
  assert not has_function_privilege('authenticated','public.create_staff_shift_assignment(uuid,uuid,smallint,date,text)','execute'), 'old writer cannot create perpetual schedules';
  if to_regprocedure('public.request_attendance_exception(text,text,uuid,uuid)') is not null then
    assert position('resolve_staff_shift_for_checkin' in pg_get_functiondef('public.request_attendance_exception(text,text,uuid,uuid)'::regprocedure)) > 0, 'exception check-in uses same date resolver';
  end if;
  raise notice 'PASS: weekly isolation, history, cancellation, concurrency, attendance, overnight, validation, permissions and audit';
end $$;
rollback;
