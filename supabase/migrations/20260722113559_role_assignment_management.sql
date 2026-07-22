create or replace function public.assign_user_role(
  target_user_id uuid,
  target_role_code text,
  assignment_reason text
)
returns table (
  assignment_id uuid,
  user_id uuid,
  role_id uuid,
  role_code text,
  assigned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_role_code text := pg_catalog.btrim(target_role_code);
  normalized_reason text := pg_catalog.btrim(assignment_reason);
  target_role public.roles%rowtype;
  created_assignment public.user_role_assignments%rowtype;
  actor_is_owner boolean;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.roles.manage') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_ROLES_MANAGE_PERMISSION_REQUIRED';
  end if;

  if target_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'TARGET_USER_ID_REQUIRED';
  end if;

  if normalized_role_code is null or normalized_role_code = '' then
    raise exception using
      errcode = '22023',
      message = 'TARGET_ROLE_CODE_REQUIRED';
  end if;

  if normalized_reason is null or normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'ASSIGNMENT_REASON_REQUIRED';
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = target_user_id
    and profile.employment_status = 'active'
  for share;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'TARGET_PROFILE_MUST_BE_ACTIVE';
  end if;

  select role.*
  into target_role
  from public.roles as role
  where role.code = normalized_role_code
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'TARGET_ROLE_NOT_FOUND';
  end if;

  if not target_role.is_active then
    raise exception using
      errcode = '23514',
      message = 'TARGET_ROLE_MUST_BE_ACTIVE';
  end if;

  if target_role.code = 'owner' then
    select exists (
      select 1
      from public.profiles as actor_profile
      join public.user_role_assignments as actor_assignment
        on actor_assignment.user_id = actor_profile.id
        and actor_assignment.revoked_at is null
      join public.roles as actor_role
        on actor_role.id = actor_assignment.role_id
        and actor_role.is_active
      where actor_profile.id = actor_id
        and actor_profile.employment_status = 'active'
        and actor_role.code = 'owner'
    )
    into actor_is_owner;

    if not actor_is_owner then
      raise exception using
        errcode = '42501',
        message = 'ONLY_ACTIVE_OWNER_CAN_ASSIGN_OWNER_ROLE';
    end if;
  end if;

  if exists (
    select 1
    from public.user_role_assignments as assignment
    where assignment.user_id = target_user_id
      and assignment.role_id = target_role.id
      and assignment.revoked_at is null
  ) then
    raise exception using
      errcode = '23505',
      message = 'ACTIVE_ROLE_ASSIGNMENT_ALREADY_EXISTS';
  end if;

  begin
    insert into public.user_role_assignments (
      user_id,
      role_id,
      assigned_by,
      assignment_reason
    )
    values (
      target_user_id,
      target_role.id,
      actor_id,
      normalized_reason
    )
    returning *
    into created_assignment;
  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message = 'ACTIVE_ROLE_ASSIGNMENT_ALREADY_EXISTS';
  end;

  return query
  select
    created_assignment.id,
    created_assignment.user_id,
    created_assignment.role_id,
    target_role.code,
    created_assignment.assigned_at;
end;
$$;

revoke all on function public.assign_user_role(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.assign_user_role(uuid, text, text)
to authenticated;


create or replace function public.revoke_user_role_assignment(
  target_assignment_id uuid,
  revocation_reason text
)
returns table (
  assignment_id uuid,
  user_id uuid,
  role_id uuid,
  role_code text,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := pg_catalog.btrim(revocation_reason);
  target_assignment public.user_role_assignments%rowtype;
  target_role public.roles%rowtype;
  updated_assignment public.user_role_assignments%rowtype;
  actor_is_owner boolean;
  remaining_owner_exists boolean;
  actor_retains_manage_permission boolean;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.roles.manage') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_ROLES_MANAGE_PERMISSION_REQUIRED';
  end if;

  if target_assignment_id is null then
    raise exception using
      errcode = '22023',
      message = 'TARGET_ASSIGNMENT_ID_REQUIRED';
  end if;

  if normalized_reason is null or normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'REVOCATION_REASON_REQUIRED';
  end if;

  select assignment.*
  into target_assignment
  from public.user_role_assignments as assignment
  where assignment.id = target_assignment_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ROLE_ASSIGNMENT_NOT_FOUND';
  end if;

  if target_assignment.revoked_at is not null then
    raise exception using
      errcode = '23514',
      message = 'ROLE_ASSIGNMENT_ALREADY_REVOKED';
  end if;

  select role.*
  into target_role
  from public.roles as role
  where role.id = target_assignment.role_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ASSIGNED_ROLE_NOT_FOUND';
  end if;

  if target_role.code = 'owner' then
    select exists (
      select 1
      from public.profiles as actor_profile
      join public.user_role_assignments as actor_assignment
        on actor_assignment.user_id = actor_profile.id
        and actor_assignment.revoked_at is null
      join public.roles as actor_role
        on actor_role.id = actor_assignment.role_id
        and actor_role.is_active
      where actor_profile.id = actor_id
        and actor_profile.employment_status = 'active'
        and actor_role.code = 'owner'
    )
    into actor_is_owner;

    if not actor_is_owner then
      raise exception using
        errcode = '42501',
        message = 'ONLY_ACTIVE_OWNER_CAN_REVOKE_OWNER_ROLE';
    end if;

    select exists (
      select 1
      from public.user_role_assignments as other_assignment
      join public.profiles as other_profile
        on other_profile.id = other_assignment.user_id
        and other_profile.employment_status = 'active'
      join public.roles as other_role
        on other_role.id = other_assignment.role_id
        and other_role.is_active
      where other_assignment.id <> target_assignment.id
        and other_assignment.revoked_at is null
        and other_role.code = 'owner'
    )
    into remaining_owner_exists;

    if not remaining_owner_exists then
      raise exception using
        errcode = '23514',
        message = 'LAST_ACTIVE_OWNER_CANNOT_BE_REVOKED';
    end if;

    if target_assignment.user_id = actor_id then
      select exists (
        select 1
        from public.user_role_assignments as other_assignment
        join public.roles as other_role
          on other_role.id = other_assignment.role_id
          and other_role.is_active
        join public.role_permissions as role_permission
          on role_permission.role_id = other_role.id
        join public.permissions as permission
          on permission.id = role_permission.permission_id
          and permission.is_active
        where other_assignment.user_id = actor_id
          and other_assignment.id <> target_assignment.id
          and other_assignment.revoked_at is null
          and permission.code = 'staff.roles.manage'
      )
      into actor_retains_manage_permission;

      if not actor_retains_manage_permission then
        raise exception using
          errcode = '23514',
          message = 'OWNER_CANNOT_REMOVE_OWN_MANAGEMENT_ACCESS';
      end if;
    end if;
  end if;

  update public.user_role_assignments as assignment
  set
    revoked_at = pg_catalog.now(),
    revoked_by = actor_id,
    revocation_reason = normalized_reason
  where assignment.id = target_assignment.id
    and assignment.revoked_at is null
  returning assignment.*
  into updated_assignment;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'ROLE_ASSIGNMENT_ALREADY_REVOKED';
  end if;

  return query
  select
    updated_assignment.id,
    updated_assignment.user_id,
    updated_assignment.role_id,
    target_role.code,
    updated_assignment.revoked_at;
end;
$$;

revoke all on function public.revoke_user_role_assignment(uuid, text)
from public, anon, authenticated;

grant execute on function public.revoke_user_role_assignment(uuid, text)
to authenticated;
