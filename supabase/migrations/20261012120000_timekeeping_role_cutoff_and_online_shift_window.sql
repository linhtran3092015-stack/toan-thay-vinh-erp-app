-- Chấm công: mốc tự đóng ca theo vai trò và check-in online phải khớp ca xếp.
--
-- Quyết định chủ trung tâm 11/10/2026:
--   2. Ca quên check-out tự đóng lúc 22:30 với trợ giảng, 22:45 với các vai
--      trò còn lại (trước đây 23:30 cho tất cả). Ca tự đóng vẫn được tính
--      lương tới mốc đó.
--   3. Check-in online chỉ được khi có ca trong phân công lịch (do chủ trung
--      tâm / trợ lý quản lý xếp) và thời điểm nằm trong ca ± 15 phút. Không
--      có ca xếp thì không check-in online được. Check-in tại trung tâm
--      (offline) giữ nguyên: xác minh GPS/geofence như cũ.
--
-- check_in_time_entry được viết lại nguyên văn từ định nghĩa đang chạy
-- (20260904010000 + bản vá 20260916100000), chỉ đổi hai điểm trên.

begin;

create or replace function public.timekeeping_daily_cutoff(p_staff_id uuid)
returns time without time zone
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_user_teaching_assistant(p_staff_id) then time '22:30'
    else time '22:45'
  end;
$$;
revoke all on function public.timekeeping_daily_cutoff(uuid) from public, anon, authenticated;

create or replace function public.run_teaching_assistant_timekeeping_watchdog()
returns integer language plpgsql security definer set search_path = '' as $$
declare closed_count integer;
begin
  update public.time_entries as entry
  set check_out_at = greatest(entry.check_in_at, (entry.work_date::timestamp + public.timekeeping_daily_cutoff(entry.staff_id)) at time zone 'Asia/Ho_Chi_Minh'),
      check_out_mode = 'auto_end', status = 'auto_ended', clock_out_reason = 'daily_cutoff',
      auto_ended_at = greatest(entry.check_in_at, (entry.work_date::timestamp + public.timekeeping_daily_cutoff(entry.staff_id)) at time zone 'Asia/Ho_Chi_Minh'),
      updated_at = pg_catalog.now()
  where entry.status = 'open'
    and pg_catalog.now() >= (entry.work_date::timestamp + public.timekeeping_daily_cutoff(entry.staff_id)) at time zone 'Asia/Ho_Chi_Minh';
  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;
revoke all on function public.run_teaching_assistant_timekeeping_watchdog() from public, anon, authenticated;

create or replace function public.check_in_time_entry(
  p_mode text,
  p_gps_latitude numeric,
  p_gps_longitude numeric,
  p_gps_accuracy_meters integer,
  p_wifi_ssid text,
  p_wifi_bssid text
)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  business_time time without time zone := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::time;
  current_weekday smallint := pg_catalog.date_part('isodow', business_date)::smallint;
  normalized_mode text := pg_catalog.lower(pg_catalog.btrim(p_mode));
  normalized_wifi_ssid text := nullif(pg_catalog.btrim(p_wifi_ssid), '');
  normalized_wifi_bssid text := nullif(pg_catalog.upper(pg_catalog.btrim(p_wifi_bssid)), '');
  online_grace constant interval := interval '15 minutes';
  target_profile public.profiles%rowtype;
  target_assignment public.staff_shift_assignments%rowtype;
  target_shift public.work_shifts%rowtype;
  result_entry public.time_entries%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  if normalized_mode not in ('online', 'offline') then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_MODE_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('time-entry:' || actor_id::text));
  perform public.run_teaching_assistant_timekeeping_watchdog();

  select profile.* into target_profile
  from public.profiles as profile
  where profile.id = actor_id for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'STAFF_PROFILE_NOT_FOUND';
  end if;

  if target_profile.employment_status <> 'active' then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_REQUIRES_ACTIVE_STAFF';
  end if;

  if exists (
    select 1 from public.time_entries as entry
    where entry.staff_id = actor_id and entry.status = 'open'
  ) then
    raise exception using errcode = '23505', message = 'TIME_ENTRY_OPEN_ENTRY_ALREADY_EXISTS';
  end if;

  -- A shift opened after the daily cutoff would be auto-ended immediately.
  if business_time >= public.timekeeping_daily_cutoff(actor_id) then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_CHECKIN_CUTOFF_REACHED';
  end if;

  if normalized_mode = 'offline' then
    perform public.validate_offline_attendance_evidence(
      p_gps_latitude, p_gps_longitude, p_gps_accuracy_meters,
      normalized_wifi_ssid, normalized_wifi_bssid
    );
  end if;

  select * into target_assignment from public.staff_shift_assignments where id = public.resolve_staff_shift_for_checkin(actor_id, business_date, business_time) for share;

  if normalized_mode = 'online' then
    if target_assignment.id is null then
      raise exception using errcode = '23514', message = 'TIME_ENTRY_ONLINE_REQUIRES_SCHEDULED_SHIFT';
    end if;

    select * into target_shift from public.work_shifts where id = target_assignment.work_shift_id;

    -- time - time yields an interval, so a shift starting just after midnight
    -- does not wrap when the grace is subtracted.
    if target_assignment.weekday = current_weekday then
      if (business_time - target_shift.start_time) < -online_grace then
        raise exception using errcode = '23514', message = 'TIME_ENTRY_ONLINE_OUTSIDE_SHIFT_WINDOW';
      end if;
      if not target_shift.crosses_midnight and (business_time - target_shift.end_time) > online_grace then
        raise exception using errcode = '23514', message = 'TIME_ENTRY_ONLINE_OUTSIDE_SHIFT_WINDOW';
      end if;
    elsif (business_time - target_shift.end_time) > online_grace then
      -- Overnight shift that started yesterday and already ended.
      raise exception using errcode = '23514', message = 'TIME_ENTRY_ONLINE_OUTSIDE_SHIFT_WINDOW';
    end if;
  end if;

  insert into public.time_entries (
    staff_id, staff_shift_assignment_id, work_date, check_in_at,
    check_in_mode, status, last_latitude, last_longitude,
    last_location_accuracy, last_location_at
  ) values (
    actor_id, target_assignment.id, business_date, pg_catalog.now(),
    normalized_mode, 'open', p_gps_latitude, p_gps_longitude,
    p_gps_accuracy_meters,
    case when normalized_mode = 'offline' and p_gps_latitude is not null then pg_catalog.now() else null end
  ) returning * into result_entry;

  if p_gps_latitude is not null then
    insert into public.time_entry_evidence (
      time_entry_id, event_type, evidence_type,
      gps_latitude, gps_longitude, gps_accuracy_meters
    ) values (
      result_entry.id, 'check_in', 'gps',
      p_gps_latitude, p_gps_longitude, p_gps_accuracy_meters
    );
  end if;

  if normalized_wifi_ssid is not null then
    insert into public.time_entry_evidence (
      time_entry_id, event_type, evidence_type, wifi_ssid, wifi_bssid
    ) values (
      result_entry.id, 'check_in', 'wifi', normalized_wifi_ssid, normalized_wifi_bssid
    );
  end if;

  return result_entry;
end;
$$;
revoke all on function public.check_in_time_entry(text, numeric, numeric, integer, text, text)
from public, anon;
grant execute on function public.check_in_time_entry(text, numeric, numeric, integer, text, text)
to authenticated;

commit;
