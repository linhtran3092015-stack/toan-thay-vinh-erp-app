begin;

-- =========================================================
-- TASK 8E
-- Time entries for self-service check-in and check-out.
--
-- This migration deliberately excludes adjustment requests, payroll totals,
-- GPS geofencing, Wi-Fi allowlists, and staff schedule management.
-- =========================================================


-- =========================================================
-- TIME ENTRIES
-- =========================================================

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  staff_shift_assignment_id uuid not null
    references public.staff_shift_assignments(id) on delete restrict,
  work_date date not null,
  check_in_at timestamptz not null,
  check_in_mode text not null,
  check_out_at timestamptz,
  check_out_mode text,
  status text not null default 'open',
  auto_ended_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint time_entries_check_in_mode_check
    check (check_in_mode in ('online', 'offline')),
  constraint time_entries_check_out_mode_check
    check (
      check_out_mode is null
      or check_out_mode in ('online', 'offline', 'auto_end')
    ),
  constraint time_entries_status_check
    check (status in ('open', 'checked_out', 'auto_ended')),
  constraint time_entries_lifecycle_check
    check (
      (
        status = 'open'
        and check_out_at is null
        and check_out_mode is null
        and auto_ended_at is null
      )
      or
      (
        status = 'checked_out'
        and check_out_at is not null
        and check_out_mode in ('online', 'offline')
        and auto_ended_at is null
      )
      or
      (
        status = 'auto_ended'
        and check_out_at is not null
        and check_out_mode = 'auto_end'
        and auto_ended_at = check_out_at
      )
    ),
  constraint time_entries_checkout_after_checkin_check
    check (check_out_at is null or check_out_at >= check_in_at)
);

create unique index time_entries_one_open_entry_per_staff_idx
on public.time_entries (staff_id)
where status = 'open';

create index time_entries_staff_work_date_idx
on public.time_entries (staff_id, work_date desc, check_in_at desc);

create index time_entries_work_date_status_idx
on public.time_entries (work_date desc, status, check_in_at desc);

create trigger time_entries_set_updated_at
before update on public.time_entries
for each row execute function public.set_updated_at();


-- GPS and Wi-Fi evidence are stored separately so management read models can
-- expose evidence presence without exposing precise location or network IDs.
create table public.time_entry_evidence (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null
    references public.time_entries(id) on delete restrict,
  event_type text not null,
  evidence_type text not null,
  captured_at timestamptz not null default pg_catalog.now(),
  gps_latitude numeric(9, 6),
  gps_longitude numeric(9, 6),
  gps_accuracy_meters integer,
  wifi_ssid text,
  wifi_bssid text,
  created_at timestamptz not null default pg_catalog.now(),

  constraint time_entry_evidence_event_type_check
    check (event_type in ('check_in', 'check_out')),
  constraint time_entry_evidence_type_check
    check (evidence_type in ('gps', 'wifi')),
  constraint time_entry_evidence_gps_range_check
    check (
      gps_latitude is null
      or (gps_latitude between -90 and 90 and gps_longitude between -180 and 180)
    ),
  constraint time_entry_evidence_gps_accuracy_check
    check (gps_accuracy_meters is null or gps_accuracy_meters >= 0),
  constraint time_entry_evidence_wifi_bssid_check
    check (
      wifi_bssid is null
      or wifi_bssid ~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
    ),
  constraint time_entry_evidence_payload_check
    check (
      (
        evidence_type = 'gps'
        and gps_latitude is not null
        and gps_longitude is not null
        and wifi_ssid is null
        and wifi_bssid is null
      )
      or
      (
        evidence_type = 'wifi'
        and gps_latitude is null
        and gps_longitude is null
        and gps_accuracy_meters is null
        and wifi_ssid is not null
      )
    ),
  constraint time_entry_evidence_wifi_ssid_trimmed_check
    check (
      wifi_ssid is null
      or (
        wifi_ssid = pg_catalog.btrim(wifi_ssid)
        and wifi_ssid <> ''
        and pg_catalog.length(wifi_ssid) <= 128
      )
    )
);

create unique index time_entry_evidence_one_type_per_event_idx
on public.time_entry_evidence (time_entry_id, event_type, evidence_type);

create index time_entry_evidence_entry_event_idx
on public.time_entry_evidence (time_entry_id, event_type);


-- =========================================================
-- HISTORY PROTECTION AND AUDIT
-- =========================================================

create or replace function public.protect_time_entry_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'open' then
    raise exception using
      errcode = '23514',
      message = 'CLOSED_TIME_ENTRY_IS_IMMUTABLE';
  end if;

  if new.id is distinct from old.id
    or new.staff_id is distinct from old.staff_id
    or new.staff_shift_assignment_id is distinct from old.staff_shift_assignment_id
    or new.work_date is distinct from old.work_date
    or new.check_in_at is distinct from old.check_in_at
    or new.check_in_mode is distinct from old.check_in_mode
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_HISTORY_IS_IMMUTABLE';
  end if;

  if new.status not in ('checked_out', 'auto_ended') then
    raise exception using
      errcode = '23514',
      message = 'OPEN_TIME_ENTRY_MUST_BE_CLOSED_BY_WORKFLOW';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_time_entry_history()
from public, anon, authenticated;

create trigger time_entries_protect_history
before update on public.time_entries
for each row execute function public.protect_time_entry_history();


create or replace function public.prevent_time_entry_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'TIME_ENTRIES_CANNOT_BE_DELETED';
end;
$$;

revoke all on function public.prevent_time_entry_delete()
from public, anon, authenticated;

create trigger time_entries_prevent_delete
before delete on public.time_entries
for each row execute function public.prevent_time_entry_delete();


create or replace function public.prevent_time_entry_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'TIME_ENTRY_EVIDENCE_IS_IMMUTABLE';
end;
$$;

revoke all on function public.prevent_time_entry_evidence_mutation()
from public, anon, authenticated;

create trigger time_entry_evidence_prevent_mutation
before update or delete on public.time_entry_evidence
for each row execute function public.prevent_time_entry_evidence_mutation();


create or replace function public.audit_time_entry_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  audit_action text;
begin
  if tg_op = 'INSERT' then
    actor_id := new.staff_id;
    audit_action := 'time_entry_checked_in';
  elsif new.status = 'auto_ended' then
    actor_id := null;
    audit_action := 'time_entry_auto_ended';
  elsif old.status = 'open' and new.status = 'checked_out' then
    actor_id := new.staff_id;
    audit_action := 'time_entry_checked_out';
  else
    raise exception using
      errcode = 'P0001',
      message = 'UNSUPPORTED_TIME_ENTRY_AUDIT_EVENT';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    actor_id,
    'timekeeping',
    audit_action,
    'time_entry',
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object(
      'source',
      case
        when new.status = 'auto_ended' then 'timekeeping_auto_end'
        else 'timekeeping_entry_workflow'
      end
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_time_entry_change()
from public, anon, authenticated;

create trigger time_entries_audit_changes
after insert or update on public.time_entries
for each row execute function public.audit_time_entry_change();


-- =========================================================
-- AUTO-END
--
-- A scheduler can call a privileged job separately. Until one is configured,
-- every authorized timekeeping read/check workflow invokes this function, so
-- overdue teaching-assistant entries close with the correct 23:30 VN cutoff.
-- =========================================================

create or replace function public.auto_end_stale_teaching_assistant_time_entries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date := (
    pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
  )::date;
  business_time time without time zone := (
    pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
  )::time;
  closed_count integer := 0;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.view')
    and not public.has_permission('timekeeping.check')
  then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_ACCESS_PERMISSION_REQUIRED';
  end if;

  update public.time_entries as entry
  set
    check_out_at = (
      entry.work_date::timestamp
      + time '23:30'
    ) at time zone 'Asia/Ho_Chi_Minh',
    check_out_mode = 'auto_end',
    status = 'auto_ended',
    auto_ended_at = (
      entry.work_date::timestamp
      + time '23:30'
    ) at time zone 'Asia/Ho_Chi_Minh',
    updated_at = pg_catalog.now()
  where entry.status = 'open'
    and exists (
      select 1
      from public.user_role_assignments as assignment
      join public.roles as role
        on role.id = assignment.role_id
        and role.code = 'teaching_assistant'
        and role.is_active
      where assignment.user_id = entry.staff_id
        and assignment.revoked_at is null
    )
    and (
      entry.work_date < business_date
      or (
        entry.work_date = business_date
        and business_time >= time '23:30'
      )
    );

  get diagnostics closed_count = row_count;

  return closed_count;
end;
$$;

revoke all on function public.auto_end_stale_teaching_assistant_time_entries()
from public, anon, authenticated;


-- =========================================================
-- CHECK-IN / CHECK-OUT WORKFLOWS
-- Permission: timekeeping.check
-- =========================================================

create or replace function public.check_in_time_entry(
  p_mode text,
  p_gps_latitude numeric,
  p_gps_longitude numeric,
  p_gps_accuracy_meters integer,
  p_wifi_ssid text,
  p_wifi_bssid text
)
returns public.time_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date := (
    pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
  )::date;
  business_time time without time zone := (
    pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
  )::time;
  current_weekday smallint := pg_catalog.date_part(
    'isodow',
    (
      pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
    )::date
  )::smallint;
  previous_weekday smallint;
  normalized_mode text := pg_catalog.lower(pg_catalog.btrim(p_mode));
  normalized_wifi_ssid text := nullif(pg_catalog.btrim(p_wifi_ssid), '');
  normalized_wifi_bssid text := nullif(
    pg_catalog.upper(pg_catalog.btrim(p_wifi_bssid)),
    ''
  );
  target_profile public.profiles%rowtype;
  target_assignment public.staff_shift_assignments%rowtype;
  target_shift public.work_shifts%rowtype;
  is_teaching_assistant boolean := false;
  result_entry public.time_entries%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  if normalized_mode not in ('online', 'offline') then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_MODE_INVALID';
  end if;

  if (p_gps_latitude is null) <> (p_gps_longitude is null)
    or (
      p_gps_latitude is not null
      and (
        p_gps_latitude < -90
        or p_gps_latitude > 90
        or p_gps_longitude < -180
        or p_gps_longitude > 180
      )
    )
    or (
      p_gps_accuracy_meters is not null
      and (
        p_gps_accuracy_meters < 0
        or p_gps_latitude is null
      )
    )
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_GPS_EVIDENCE_INVALID';
  end if;

  if normalized_wifi_ssid is not null
    and pg_catalog.length(normalized_wifi_ssid) > 128
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_WIFI_EVIDENCE_INVALID';
  end if;

  if normalized_wifi_bssid is not null
    and normalized_wifi_bssid !~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_WIFI_EVIDENCE_INVALID';
  end if;

  if normalized_wifi_bssid is not null
    and normalized_wifi_ssid is null
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_WIFI_EVIDENCE_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('time-entry:' || actor_id::text)
  );

  perform public.auto_end_stale_teaching_assistant_time_entries();

  select profile.*
  into target_profile
  from public.profiles as profile
  where profile.id = actor_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STAFF_PROFILE_NOT_FOUND';
  end if;

  if target_profile.employment_status <> 'active' then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_REQUIRES_ACTIVE_STAFF';
  end if;

  select exists (
    select 1
    from public.user_role_assignments as assignment
    join public.roles as role
      on role.id = assignment.role_id
      and role.code = 'teaching_assistant'
      and role.is_active
    where assignment.user_id = actor_id
      and assignment.revoked_at is null
  )
  into is_teaching_assistant;

  if is_teaching_assistant and business_time >= time '23:30' then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_TEACHING_ASSISTANT_CHECKIN_CUTOFF_REACHED';
  end if;

  if exists (
    select 1
    from public.time_entries as entry
    where entry.staff_id = actor_id
      and entry.status = 'open'
  ) then
    raise exception using
      errcode = '23505',
      message = 'TIME_ENTRY_OPEN_ENTRY_ALREADY_EXISTS';
  end if;

  previous_weekday := case
    when current_weekday = 1 then 7
    else current_weekday - 1
  end;

  select assignment.*
  into target_assignment
  from public.staff_shift_assignments as assignment
  join public.work_shifts as shift
    on shift.id = assignment.work_shift_id
  where assignment.staff_id = actor_id
    and assignment.is_active
    and shift.is_active
    and (
      assignment.weekday = current_weekday
      or (
        shift.crosses_midnight
        and assignment.weekday = previous_weekday
        and business_time < shift.end_time
      )
    )
  order by case
    when assignment.weekday = current_weekday then 0
    else 1
  end
  limit 1
  for share of assignment;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_ACTIVE_SCHEDULE_REQUIRED';
  end if;

  select shift.*
  into target_shift
  from public.work_shifts as shift
  where shift.id = target_assignment.work_shift_id
  for share;

  if not found or not target_shift.is_active then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_ACTIVE_SCHEDULE_REQUIRED';
  end if;

  insert into public.time_entries (
    staff_id,
    staff_shift_assignment_id,
    work_date,
    check_in_at,
    check_in_mode,
    status
  )
  values (
    actor_id,
    target_assignment.id,
    business_date,
    pg_catalog.now(),
    normalized_mode,
    'open'
  )
  returning * into result_entry;

  if p_gps_latitude is not null then
    insert into public.time_entry_evidence (
      time_entry_id,
      event_type,
      evidence_type,
      gps_latitude,
      gps_longitude,
      gps_accuracy_meters
    )
    values (
      result_entry.id,
      'check_in',
      'gps',
      p_gps_latitude,
      p_gps_longitude,
      p_gps_accuracy_meters
    );
  end if;

  if normalized_wifi_ssid is not null then
    insert into public.time_entry_evidence (
      time_entry_id,
      event_type,
      evidence_type,
      wifi_ssid,
      wifi_bssid
    )
    values (
      result_entry.id,
      'check_in',
      'wifi',
      normalized_wifi_ssid,
      normalized_wifi_bssid
    );
  end if;

  return result_entry;
end;
$$;

revoke all on function public.check_in_time_entry(
  text,
  numeric,
  numeric,
  integer,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.check_in_time_entry(
  text,
  numeric,
  numeric,
  integer,
  text,
  text
)
to authenticated;


create or replace function public.check_out_time_entry(
  p_mode text,
  p_gps_latitude numeric,
  p_gps_longitude numeric,
  p_gps_accuracy_meters integer,
  p_wifi_ssid text,
  p_wifi_bssid text
)
returns public.time_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_mode text := pg_catalog.lower(pg_catalog.btrim(p_mode));
  normalized_wifi_ssid text := nullif(pg_catalog.btrim(p_wifi_ssid), '');
  normalized_wifi_bssid text := nullif(
    pg_catalog.upper(pg_catalog.btrim(p_wifi_bssid)),
    ''
  );
  target_entry public.time_entries%rowtype;
  result_entry public.time_entries%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  if normalized_mode not in ('online', 'offline') then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_MODE_INVALID';
  end if;

  if (p_gps_latitude is null) <> (p_gps_longitude is null)
    or (
      p_gps_latitude is not null
      and (
        p_gps_latitude < -90
        or p_gps_latitude > 90
        or p_gps_longitude < -180
        or p_gps_longitude > 180
      )
    )
    or (
      p_gps_accuracy_meters is not null
      and (
        p_gps_accuracy_meters < 0
        or p_gps_latitude is null
      )
    )
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_GPS_EVIDENCE_INVALID';
  end if;

  if normalized_wifi_ssid is not null
    and pg_catalog.length(normalized_wifi_ssid) > 128
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_WIFI_EVIDENCE_INVALID';
  end if;

  if normalized_wifi_bssid is not null
    and normalized_wifi_bssid !~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_WIFI_EVIDENCE_INVALID';
  end if;

  if normalized_wifi_bssid is not null
    and normalized_wifi_ssid is null
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_WIFI_EVIDENCE_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('time-entry:' || actor_id::text)
  );

  perform public.auto_end_stale_teaching_assistant_time_entries();

  select entry.*
  into target_entry
  from public.time_entries as entry
  where entry.staff_id = actor_id
    and entry.status = 'open'
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'TIME_ENTRY_OPEN_ENTRY_NOT_FOUND';
  end if;

  update public.time_entries
  set
    check_out_at = pg_catalog.now(),
    check_out_mode = normalized_mode,
    status = 'checked_out',
    updated_at = pg_catalog.now()
  where id = target_entry.id
  returning * into result_entry;

  if p_gps_latitude is not null then
    insert into public.time_entry_evidence (
      time_entry_id,
      event_type,
      evidence_type,
      gps_latitude,
      gps_longitude,
      gps_accuracy_meters
    )
    values (
      result_entry.id,
      'check_out',
      'gps',
      p_gps_latitude,
      p_gps_longitude,
      p_gps_accuracy_meters
    );
  end if;

  if normalized_wifi_ssid is not null then
    insert into public.time_entry_evidence (
      time_entry_id,
      event_type,
      evidence_type,
      wifi_ssid,
      wifi_bssid
    )
    values (
      result_entry.id,
      'check_out',
      'wifi',
      normalized_wifi_ssid,
      normalized_wifi_bssid
    );
  end if;

  return result_entry;
end;
$$;

revoke all on function public.check_out_time_entry(
  text,
  numeric,
  numeric,
  integer,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.check_out_time_entry(
  text,
  numeric,
  numeric,
  integer,
  text,
  text
)
to authenticated;


-- =========================================================
-- READ MODELS
-- =========================================================

create or replace function public.get_my_timekeeping_entries()
returns table (
  entry_id uuid,
  work_date date,
  check_in_at timestamptz,
  check_in_mode text,
  check_out_at timestamptz,
  check_out_mode text,
  entry_status text,
  auto_ended_at timestamptz,
  work_shift_code text,
  work_shift_name text,
  scheduled_start_time time without time zone,
  scheduled_end_time time without time zone,
  has_check_in_gps_evidence boolean,
  has_check_in_wifi_evidence boolean,
  has_check_out_gps_evidence boolean,
  has_check_out_wifi_evidence boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  perform public.auto_end_stale_teaching_assistant_time_entries();

  return query
  select
    entry.id,
    entry.work_date,
    entry.check_in_at,
    entry.check_in_mode,
    entry.check_out_at,
    entry.check_out_mode,
    entry.status,
    entry.auto_ended_at,
    shift.code,
    shift.name,
    shift.start_time,
    shift.end_time,
    exists (
      select 1
      from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_in'
        and evidence.evidence_type = 'gps'
    ),
    exists (
      select 1
      from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_in'
        and evidence.evidence_type = 'wifi'
    ),
    exists (
      select 1
      from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_out'
        and evidence.evidence_type = 'gps'
    ),
    exists (
      select 1
      from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_out'
        and evidence.evidence_type = 'wifi'
    )
  from public.time_entries as entry
  join public.staff_shift_assignments as assignment
    on assignment.id = entry.staff_shift_assignment_id
  join public.work_shifts as shift
    on shift.id = assignment.work_shift_id
  where entry.staff_id = auth.uid()
    and entry.work_date = (
      pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
    )::date
  order by entry.check_in_at desc;
end;
$$;

revoke all on function public.get_my_timekeeping_entries()
from public, anon, authenticated;

grant execute on function public.get_my_timekeeping_entries()
to authenticated;


create or replace function public.get_timekeeping_day_entries()
returns table (
  entry_id uuid,
  staff_id uuid,
  staff_display_name text,
  staff_employee_code text,
  work_date date,
  check_in_at timestamptz,
  check_in_mode text,
  check_out_at timestamptz,
  check_out_mode text,
  entry_status text,
  auto_ended_at timestamptz,
  work_shift_code text,
  work_shift_name text,
  scheduled_start_time time without time zone,
  scheduled_end_time time without time zone,
  has_check_in_gps_evidence boolean,
  has_check_in_wifi_evidence boolean,
  has_check_out_gps_evidence boolean,
  has_check_out_wifi_evidence boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.view') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_VIEW_PERMISSION_REQUIRED';
  end if;

  perform public.auto_end_stale_teaching_assistant_time_entries();

  return query
  select
    entry.id,
    profile.id,
    profile.display_name,
    profile.employee_code,
    entry.work_date,
    entry.check_in_at,
    entry.check_in_mode,
    entry.check_out_at,
    entry.check_out_mode,
    entry.status,
    entry.auto_ended_at,
    shift.code,
    shift.name,
    shift.start_time,
    shift.end_time,
    exists (
      select 1
      from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_in'
        and evidence.evidence_type = 'gps'
    ),
    exists (
      select 1
      from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_in'
        and evidence.evidence_type = 'wifi'
    ),
    exists (
      select 1
      from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_out'
        and evidence.evidence_type = 'gps'
    ),
    exists (
      select 1
      from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_out'
        and evidence.evidence_type = 'wifi'
    )
  from public.time_entries as entry
  join public.profiles as profile
    on profile.id = entry.staff_id
  join public.staff_shift_assignments as assignment
    on assignment.id = entry.staff_shift_assignment_id
  join public.work_shifts as shift
    on shift.id = assignment.work_shift_id
  where entry.work_date = (
    pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
  )::date
  order by entry.check_in_at desc, profile.display_name nulls last;
end;
$$;

revoke all on function public.get_timekeeping_day_entries()
from public, anon, authenticated;

grant execute on function public.get_timekeeping_day_entries()
to authenticated;


-- =========================================================
-- RLS AND GRANTS
-- =========================================================

alter table public.time_entries enable row level security;
alter table public.time_entry_evidence enable row level security;

create policy time_entries_select_own_or_timekeeping_view
on public.time_entries
for select
to authenticated
using (
  staff_id = (select auth.uid())
  or public.has_permission('timekeeping.view')
);

-- Raw location and Wi-Fi identifiers are limited to the staff member who
-- supplied them. Management read models expose only presence flags.
create policy time_entry_evidence_select_own_staff
on public.time_entry_evidence
for select
to authenticated
using (
  exists (
    select 1
    from public.time_entries as entry
    where entry.id = time_entry_evidence.time_entry_id
      and entry.staff_id = (select auth.uid())
  )
);

revoke all privileges on table
  public.time_entries,
  public.time_entry_evidence
from public, anon, authenticated;

grant select on table
  public.time_entries,
  public.time_entry_evidence
to authenticated;

commit;
