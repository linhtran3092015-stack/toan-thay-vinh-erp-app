begin;

-- Rate records are created by an approved workflow. Use the recorded creator
-- when available so audit data remains correct for future server-side jobs.
create or replace function public.audit_staff_rate_version_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := coalesce(new.created_by, auth.uid());
begin
  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    new_data,
    reason,
    metadata
  )
  values (
    actor_id,
    'staff',
    'staff_rate_version_created',
    'staff_rate_version',
    new.id::text,
    pg_catalog.to_jsonb(new),
    nullif(pg_catalog.current_setting('app.audit_reason', true), ''),
    pg_catalog.jsonb_build_object(
      'source',
      case
        when actor_id is null then 'database'
        else 'staff_management_workflow'
      end
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_staff_rate_version_insert()
from public, anon, authenticated;

create or replace function public.audit_staff_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_name is not distinct from old.display_name
    and new.phone is not distinct from old.phone
    and new.employee_code is not distinct from old.employee_code
    and new.employment_status is not distinct from old.employment_status
    and new.joined_at is not distinct from old.joined_at
    and new.left_at is not distinct from old.left_at
  then
    return new;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    metadata
  )
  values (
    auth.uid(),
    'staff',
    'staff_profile_updated',
    'profile',
    new.id::text,
    pg_catalog.jsonb_build_object(
      'display_name', old.display_name,
      'employee_code', old.employee_code,
      'employment_status', old.employment_status,
      'joined_at', old.joined_at,
      'left_at', old.left_at,
      'phone', old.phone
    ),
    pg_catalog.jsonb_build_object(
      'display_name', new.display_name,
      'employee_code', new.employee_code,
      'employment_status', new.employment_status,
      'joined_at', new.joined_at,
      'left_at', new.left_at,
      'phone', new.phone
    ),
    nullif(pg_catalog.current_setting('app.audit_reason', true), ''),
    pg_catalog.jsonb_build_object('source', 'staff_management_workflow')
  );

  return new;
end;
$$;

revoke all on function public.audit_staff_profile_update()
from public, anon, authenticated;

drop trigger if exists profiles_audit_staff_updates on public.profiles;

create trigger profiles_audit_staff_updates
after update on public.profiles
for each row execute function public.audit_staff_profile_update();

create or replace function public.update_staff_profile(
  p_staff_id uuid,
  p_display_name text,
  p_phone text,
  p_employee_code text,
  p_employment_status text,
  p_joined_at date,
  p_left_at date,
  p_reason text
)
returns table (
  id uuid,
  display_name text,
  employee_code text,
  employment_status text,
  joined_at date,
  left_at date,
  phone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_display_name text := nullif(pg_catalog.btrim(p_display_name), '');
  normalized_phone text := nullif(pg_catalog.btrim(p_phone), '');
  normalized_employee_code text := nullif(
    pg_catalog.upper(pg_catalog.btrim(p_employee_code)),
    ''
  );
  normalized_status text := pg_catalog.btrim(p_employment_status);
  normalized_reason text := pg_catalog.btrim(p_reason);
  target_profile public.profiles%rowtype;
  updated_profile public.profiles%rowtype;
  target_is_active_owner boolean := false;
  another_active_owner_exists boolean := false;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.manage') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_staff_id is null then
    raise exception using
      errcode = '22023',
      message = 'STAFF_ID_REQUIRED';
  end if;

  if normalized_reason is null or normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'STAFF_PROFILE_UPDATE_REASON_REQUIRED';
  end if;

  if pg_catalog.length(normalized_reason) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'STAFF_PROFILE_UPDATE_REASON_TOO_LONG';
  end if;

  if normalized_display_name is not null
    and pg_catalog.length(normalized_display_name) > 160 then
    raise exception using
      errcode = '22023',
      message = 'STAFF_DISPLAY_NAME_INVALID';
  end if;

  if normalized_employee_code is not null
    and (
      pg_catalog.length(normalized_employee_code) > 64
      or normalized_employee_code !~ '^[A-Z0-9._-]+$'
    ) then
    raise exception using
      errcode = '22023',
      message = 'STAFF_EMPLOYEE_CODE_INVALID';
  end if;

  if normalized_phone is not null
    and (
      pg_catalog.length(normalized_phone) > 32
      or normalized_phone !~ '^[0-9+(). -]{7,32}$'
    ) then
    raise exception using
      errcode = '22023',
      message = 'STAFF_PHONE_INVALID';
  end if;

  if normalized_status not in ('active', 'inactive', 'suspended') then
    raise exception using
      errcode = '22023',
      message = 'STAFF_EMPLOYMENT_STATUS_INVALID';
  end if;

  if normalized_status = 'inactive' and p_left_at is null then
    raise exception using
      errcode = '22023',
      message = 'INACTIVE_STAFF_LEFT_AT_REQUIRED';
  end if;

  if normalized_status <> 'inactive' and p_left_at is not null then
    raise exception using
      errcode = '22023',
      message = 'ACTIVE_OR_SUSPENDED_STAFF_LEFT_AT_FORBIDDEN';
  end if;

  if p_left_at is not null
    and p_joined_at is not null
    and p_left_at < p_joined_at then
    raise exception using
      errcode = '22023',
      message = 'STAFF_EMPLOYMENT_DATES_INVALID';
  end if;

  select profile.*
  into target_profile
  from public.profiles as profile
  where profile.id = p_staff_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STAFF_PROFILE_NOT_FOUND';
  end if;

  if target_profile.employment_status = 'active'
    and normalized_status <> 'active' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('staff-active-owner')
    );

    select exists (
      select 1
      from public.user_role_assignments as assignment
      join public.roles as role
        on role.id = assignment.role_id
        and role.is_active
      where assignment.user_id = p_staff_id
        and assignment.revoked_at is null
        and role.code = 'owner'
    )
    into target_is_active_owner;

    if target_is_active_owner then
      select exists (
        select 1
        from public.profiles as profile
        join public.user_role_assignments as assignment
          on assignment.user_id = profile.id
          and assignment.revoked_at is null
        join public.roles as role
          on role.id = assignment.role_id
          and role.is_active
        where profile.id <> p_staff_id
          and profile.employment_status = 'active'
          and role.code = 'owner'
      )
      into another_active_owner_exists;

      if not another_active_owner_exists then
        raise exception using
          errcode = '23514',
          message = 'LAST_ACTIVE_OWNER_CANNOT_BE_DEACTIVATED';
      end if;
    end if;
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    normalized_reason,
    true
  );

  update public.profiles as profile
  set
    display_name = normalized_display_name,
    employee_code = normalized_employee_code,
    employment_status = normalized_status,
    joined_at = p_joined_at,
    left_at = p_left_at,
    phone = normalized_phone
  where profile.id = p_staff_id
  returning profile.* into updated_profile;

  return query
  select
    updated_profile.id,
    updated_profile.display_name,
    updated_profile.employee_code,
    updated_profile.employment_status,
    updated_profile.joined_at,
    updated_profile.left_at,
    updated_profile.phone;
end;
$$;

revoke all on function public.update_staff_profile(
  uuid, text, text, text, text, date, date, text
) from public, anon, authenticated;

grant execute on function public.update_staff_profile(
  uuid, text, text, text, text, date, date, text
) to authenticated;

create or replace function public.create_staff_rate_version(
  p_staff_id uuid,
  p_effective_from date,
  p_offline_hourly_rate_vnd bigint,
  p_note text,
  p_reason text
)
returns table (
  id uuid,
  staff_id uuid,
  effective_from date,
  offline_hourly_rate_vnd bigint,
  online_hourly_rate_vnd bigint,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_note text := nullif(pg_catalog.btrim(p_note), '');
  normalized_reason text := pg_catalog.btrim(p_reason);
  target_profile public.profiles%rowtype;
  created_rate_version public.staff_rate_versions%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.manage_rates') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_MANAGE_RATES_PERMISSION_REQUIRED';
  end if;

  if p_staff_id is null then
    raise exception using
      errcode = '22023',
      message = 'STAFF_ID_REQUIRED';
  end if;

  if p_effective_from is null then
    raise exception using
      errcode = '22023',
      message = 'STAFF_RATE_EFFECTIVE_FROM_REQUIRED';
  end if;

  if p_offline_hourly_rate_vnd is null
    or p_offline_hourly_rate_vnd < 0
    or pg_catalog.mod(p_offline_hourly_rate_vnd, 2) <> 0 then
    raise exception using
      errcode = '22023',
      message = 'STAFF_OFFLINE_HOURLY_RATE_INVALID';
  end if;

  if normalized_note is not null
    and pg_catalog.length(normalized_note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'STAFF_RATE_NOTE_TOO_LONG';
  end if;

  if normalized_reason is null or normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'STAFF_RATE_VERSION_REASON_REQUIRED';
  end if;

  if pg_catalog.length(normalized_reason) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'STAFF_RATE_VERSION_REASON_TOO_LONG';
  end if;

  select profile.*
  into target_profile
  from public.profiles as profile
  where profile.id = p_staff_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STAFF_PROFILE_NOT_FOUND';
  end if;

  if target_profile.employment_status <> 'active' then
    raise exception using
      errcode = '23514',
      message = 'STAFF_RATE_VERSION_REQUIRES_ACTIVE_PROFILE';
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    normalized_reason,
    true
  );

  begin
    insert into public.staff_rate_versions (
      staff_id,
      effective_from,
      offline_hourly_rate_vnd,
      note,
      created_by
    )
    values (
      p_staff_id,
      p_effective_from,
      p_offline_hourly_rate_vnd,
      normalized_note,
      actor_id
    )
    returning * into created_rate_version;
  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message = 'STAFF_RATE_VERSION_EFFECTIVE_DATE_ALREADY_EXISTS';
  end;

  return query
  select
    created_rate_version.id,
    created_rate_version.staff_id,
    created_rate_version.effective_from,
    created_rate_version.offline_hourly_rate_vnd,
    created_rate_version.online_hourly_rate_vnd,
    created_rate_version.note,
    created_rate_version.created_at;
end;
$$;

revoke all on function public.create_staff_rate_version(
  uuid, date, bigint, text, text
) from public, anon, authenticated;

grant execute on function public.create_staff_rate_version(
  uuid, date, bigint, text, text
) to authenticated;

commit;
