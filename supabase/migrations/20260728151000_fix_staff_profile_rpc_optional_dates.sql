begin;

-- Supabase type generation represents non-default function arguments as
-- required. Optional dates let the UI clear them without unsafe type casts.
drop function public.update_staff_profile(
  uuid, text, text, text, text, date, date, text
);

create function public.update_staff_profile(
  p_staff_id uuid,
  p_display_name text,
  p_phone text,
  p_employee_code text,
  p_employment_status text,
  p_reason text,
  p_joined_at date default null,
  p_left_at date default null
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
  uuid, text, text, text, text, text, date, date
) from public, anon, authenticated;

grant execute on function public.update_staff_profile(
  uuid, text, text, text, text, text, date, date
) to authenticated;

commit;
