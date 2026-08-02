begin;

create or replace function public.is_active_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    join public.user_role_assignments as assignment
      on assignment.user_id = profile.id
      and assignment.revoked_at is null
    join public.roles as role
      on role.id = assignment.role_id
      and role.is_active
    where profile.id = (select auth.uid())
      and profile.employment_status = 'active'
      and role.code = 'owner'
  );
$$;

revoke all on function public.is_active_owner() from public, anon;
grant execute on function public.is_active_owner() to authenticated;

create table public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pending',
  invited_by uuid not null references public.profiles(id) on delete restrict,
  invited_at timestamptz not null default now(),
  invitation_reason text not null,
  accepted_by uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_invitations_email_normalized_check
    check (email = pg_catalog.lower(pg_catalog.btrim(email)) and email <> ''),
  constraint account_invitations_email_format_check
    check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint account_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked')),
  constraint account_invitations_reason_check
    check (pg_catalog.btrim(invitation_reason) <> ''),
  constraint account_invitations_lifecycle_check
    check (
      (status = 'pending'
        and accepted_by is null
        and accepted_at is null
        and revoked_by is null
        and revoked_at is null
        and revocation_reason is null)
      or
      (status = 'accepted'
        and accepted_by is not null
        and accepted_at is not null
        and revoked_by is null
        and revoked_at is null
        and revocation_reason is null)
      or
      (status = 'revoked'
        and accepted_by is null
        and accepted_at is null
        and revoked_by is not null
        and revoked_at is not null
        and revocation_reason is not null
        and pg_catalog.btrim(revocation_reason) <> '')
    )
);

create unique index account_invitations_pending_email_unique_idx
on public.account_invitations (email)
where status = 'pending';

create index account_invitations_status_time_idx
on public.account_invitations (status, invited_at desc);

create trigger account_invitations_set_updated_at
before update on public.account_invitations
for each row execute function public.set_updated_at();

create table public.account_invitation_roles (
  invitation_id uuid not null
    references public.account_invitations(id) on delete restrict,
  role_id uuid not null references public.roles(id) on delete restrict,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  primary key (invitation_id, role_id)
);

alter table public.account_invitations enable row level security;
alter table public.account_invitation_roles enable row level security;

create policy account_invitations_select_owner
on public.account_invitations
for select
to authenticated
using (public.is_active_owner());

create policy account_invitation_roles_select_owner
on public.account_invitation_roles
for select
to authenticated
using (public.is_active_owner());

revoke all privileges on table
  public.account_invitations,
  public.account_invitation_roles
from public, anon, authenticated;

grant select on table
  public.account_invitations,
  public.account_invitation_roles
to authenticated;

create or replace function public.create_account_invitation(
  target_email text,
  target_role_ids uuid[],
  invitation_reason text
)
returns table (
  invitation_id uuid,
  email text,
  invited_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(target_email));
  normalized_reason text := pg_catalog.btrim(invitation_reason);
  requested_role_count integer := coalesce(pg_catalog.cardinality(target_role_ids), 0);
  valid_role_count integer;
  created_invitation public.account_invitations%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.is_active_owner() then
    raise exception using errcode = '42501', message = 'ACTIVE_OWNER_REQUIRED';
  end if;

  if normalized_email is null
    or normalized_email = ''
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception using errcode = '22023', message = 'VALID_EMAIL_REQUIRED';
  end if;

  if normalized_reason is null or normalized_reason = '' then
    raise exception using errcode = '22023', message = 'INVITATION_REASON_REQUIRED';
  end if;

  if requested_role_count = 0 then
    raise exception using errcode = '22023', message = 'AT_LEAST_ONE_ROLE_REQUIRED';
  end if;

  select pg_catalog.count(*)
  into valid_role_count
  from public.roles as role
  where role.id = any(target_role_ids)
    and role.is_active;

  if valid_role_count <> requested_role_count then
    raise exception using errcode = '22023', message = 'ROLE_SELECTION_INVALID';
  end if;

  if not exists (
    select 1
    from public.roles as role
    join public.role_permissions as role_permission
      on role_permission.role_id = role.id
    join public.permissions as permission
      on permission.id = role_permission.permission_id
      and permission.is_active
    where role.id = any(target_role_ids)
      and role.is_active
      and permission.code = 'app.access'
  ) then
    raise exception using errcode = '23514', message = 'SELECTED_ROLES_MUST_GRANT_APP_ACCESS';
  end if;

  if exists (
    select 1
    from public.profiles as profile
    where profile.email = normalized_email
  ) then
    raise exception using errcode = '23505', message = 'ACCOUNT_PROFILE_ALREADY_EXISTS';
  end if;

  if exists (
    select 1
    from public.account_invitations as invitation
    where invitation.email = normalized_email
      and invitation.status = 'pending'
  ) then
    raise exception using errcode = '23505', message = 'PENDING_INVITATION_ALREADY_EXISTS';
  end if;

  insert into public.account_invitations (
    email,
    invited_by,
    invitation_reason
  )
  values (
    normalized_email,
    actor_id,
    normalized_reason
  )
  returning * into created_invitation;

  insert into public.account_invitation_roles (
    invitation_id,
    role_id,
    granted_by
  )
  select
    created_invitation.id,
    requested_role.id,
    actor_id
  from public.roles as requested_role
  where requested_role.id = any(target_role_ids);

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
    'rbac',
    'account_invitation_created',
    'account_invitation',
    created_invitation.id::text,
    pg_catalog.jsonb_build_object(
      'email', normalized_email,
      'role_ids', pg_catalog.to_jsonb(target_role_ids),
      'status', 'pending'
    ),
    normalized_reason,
    pg_catalog.jsonb_build_object('source', 'settings')
  );

  return query
  select created_invitation.id, created_invitation.email, created_invitation.invited_at;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PENDING_INVITATION_ALREADY_EXISTS';
end;
$$;

revoke all on function public.create_account_invitation(text, uuid[], text)
from public, anon, authenticated;
grant execute on function public.create_account_invitation(text, uuid[], text)
to authenticated;

create or replace function public.accept_my_account_invitation()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(auth.jwt() ->> 'email', ''))
  );
  pending_invitation public.account_invitations%rowtype;
begin
  if actor_id is null or actor_email = '' then
    return false;
  end if;

  if public.has_permission('app.access') then
    return true;
  end if;

  select invitation.*
  into pending_invitation
  from public.account_invitations as invitation
  where invitation.email = actor_email
    and invitation.status = 'pending'
  order by invitation.invited_at desc
  limit 1
  for update;

  if not found then
    return false;
  end if;

  if not exists (
    select 1
    from public.account_invitation_roles as invitation_role
    join public.roles as role
      on role.id = invitation_role.role_id
      and role.is_active
    join public.role_permissions as role_permission
      on role_permission.role_id = role.id
    join public.permissions as permission
      on permission.id = role_permission.permission_id
      and permission.is_active
    where invitation_role.invitation_id = pending_invitation.id
      and permission.code = 'app.access'
  ) then
    return false;
  end if;

  insert into public.user_role_assignments (
    user_id,
    role_id,
    assigned_by,
    assignment_reason
  )
  select
    actor_id,
    invitation_role.role_id,
    pending_invitation.invited_by,
    pending_invitation.invitation_reason
  from public.account_invitation_roles as invitation_role
  join public.roles as role
    on role.id = invitation_role.role_id
    and role.is_active
  where invitation_role.invitation_id = pending_invitation.id
  on conflict (user_id, role_id) where revoked_at is null do nothing;

  update public.account_invitations
  set
    status = 'accepted',
    accepted_by = actor_id,
    accepted_at = pg_catalog.now()
  where id = pending_invitation.id;

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
    actor_id,
    'rbac',
    'account_invitation_accepted',
    'account_invitation',
    pending_invitation.id::text,
    pg_catalog.jsonb_build_object('status', 'pending'),
    pg_catalog.jsonb_build_object('status', 'accepted', 'user_id', actor_id),
    pending_invitation.invitation_reason,
    pg_catalog.jsonb_build_object('source', 'oauth_callback')
  );

  return public.has_permission('app.access');
end;
$$;

revoke all on function public.accept_my_account_invitation()
from public, anon, authenticated;
grant execute on function public.accept_my_account_invitation()
to authenticated;

create or replace function public.revoke_account_invitation(
  target_invitation_id uuid,
  revocation_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := pg_catalog.btrim(revocation_reason);
  invitation_before public.account_invitations%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.is_active_owner() then
    raise exception using errcode = '42501', message = 'ACTIVE_OWNER_REQUIRED';
  end if;

  if normalized_reason is null or normalized_reason = '' then
    raise exception using errcode = '22023', message = 'REVOCATION_REASON_REQUIRED';
  end if;

  select invitation.*
  into invitation_before
  from public.account_invitations as invitation
  where invitation.id = target_invitation_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'INVITATION_NOT_FOUND';
  end if;

  if invitation_before.status <> 'pending' then
    raise exception using errcode = '23514', message = 'ONLY_PENDING_INVITATION_CAN_BE_REVOKED';
  end if;

  update public.account_invitations
  set
    status = 'revoked',
    revoked_by = actor_id,
    revoked_at = pg_catalog.now(),
    revocation_reason = normalized_reason
  where id = invitation_before.id;

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
    actor_id,
    'rbac',
    'account_invitation_revoked',
    'account_invitation',
    invitation_before.id::text,
    pg_catalog.jsonb_build_object('status', 'pending'),
    pg_catalog.jsonb_build_object('status', 'revoked'),
    normalized_reason,
    pg_catalog.jsonb_build_object('source', 'settings')
  );

  return true;
end;
$$;

revoke all on function public.revoke_account_invitation(uuid, text)
from public, anon, authenticated;
grant execute on function public.revoke_account_invitation(uuid, text)
to authenticated;

create or replace function public.set_user_roles(
  target_user_id uuid,
  target_role_ids uuid[],
  change_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := pg_catalog.btrim(change_reason);
  requested_role_count integer := coalesce(pg_catalog.cardinality(target_role_ids), 0);
  valid_role_count integer;
  target_had_owner boolean;
  target_keeps_owner boolean;
  remaining_owner_exists boolean;
  old_role_ids uuid[];
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.is_active_owner() then
    raise exception using errcode = '42501', message = 'ACTIVE_OWNER_REQUIRED';
  end if;

  if normalized_reason is null or normalized_reason = '' then
    raise exception using errcode = '22023', message = 'CHANGE_REASON_REQUIRED';
  end if;

  if requested_role_count = 0 then
    raise exception using errcode = '22023', message = 'AT_LEAST_ONE_ROLE_REQUIRED';
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = target_user_id
    and profile.employment_status = 'active'
  for update;

  if not found then
    raise exception using errcode = '23514', message = 'TARGET_PROFILE_MUST_BE_ACTIVE';
  end if;

  select pg_catalog.count(*)
  into valid_role_count
  from public.roles as role
  where role.id = any(target_role_ids)
    and role.is_active;

  if valid_role_count <> requested_role_count then
    raise exception using errcode = '22023', message = 'ROLE_SELECTION_INVALID';
  end if;

  if not exists (
    select 1
    from public.roles as role
    join public.role_permissions as role_permission
      on role_permission.role_id = role.id
    join public.permissions as permission
      on permission.id = role_permission.permission_id
      and permission.is_active
    where role.id = any(target_role_ids)
      and role.is_active
      and permission.code = 'app.access'
  ) then
    raise exception using errcode = '23514', message = 'SELECTED_ROLES_MUST_GRANT_APP_ACCESS';
  end if;

  select pg_catalog.array_agg(assignment.role_id order by assignment.role_id)
  into old_role_ids
  from public.user_role_assignments as assignment
  where assignment.user_id = target_user_id
    and assignment.revoked_at is null;

  select exists (
    select 1
    from public.user_role_assignments as assignment
    join public.roles as role on role.id = assignment.role_id
    where assignment.user_id = target_user_id
      and assignment.revoked_at is null
      and role.code = 'owner'
  ) into target_had_owner;

  select exists (
    select 1
    from public.roles as role
    where role.id = any(target_role_ids)
      and role.code = 'owner'
  ) into target_keeps_owner;

  if target_had_owner and not target_keeps_owner then
    select exists (
      select 1
      from public.user_role_assignments as assignment
      join public.profiles as profile
        on profile.id = assignment.user_id
        and profile.employment_status = 'active'
      join public.roles as role
        on role.id = assignment.role_id
        and role.is_active
      where assignment.user_id <> target_user_id
        and assignment.revoked_at is null
        and role.code = 'owner'
    ) into remaining_owner_exists;

    if not remaining_owner_exists then
      raise exception using errcode = '23514', message = 'LAST_ACTIVE_OWNER_CANNOT_BE_REVOKED';
    end if;
  end if;

  update public.user_role_assignments as assignment
  set
    revoked_at = pg_catalog.now(),
    revoked_by = actor_id,
    revocation_reason = normalized_reason
  where assignment.user_id = target_user_id
    and assignment.revoked_at is null
    and not (assignment.role_id = any(target_role_ids));

  insert into public.user_role_assignments (
    user_id,
    role_id,
    assigned_by,
    assignment_reason
  )
  select
    target_user_id,
    role.id,
    actor_id,
    normalized_reason
  from public.roles as role
  where role.id = any(target_role_ids)
    and not exists (
      select 1
      from public.user_role_assignments as assignment
      where assignment.user_id = target_user_id
        and assignment.role_id = role.id
        and assignment.revoked_at is null
    );

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
    actor_id,
    'rbac',
    'user_roles_replaced',
    'profile',
    target_user_id::text,
    pg_catalog.jsonb_build_object('role_ids', coalesce(pg_catalog.to_jsonb(old_role_ids), '[]'::jsonb)),
    pg_catalog.jsonb_build_object('role_ids', pg_catalog.to_jsonb(target_role_ids)),
    normalized_reason,
    pg_catalog.jsonb_build_object('source', 'settings')
  );

  return requested_role_count;
end;
$$;

revoke all on function public.set_user_roles(uuid, uuid[], text)
from public, anon, authenticated;
grant execute on function public.set_user_roles(uuid, uuid[], text)
to authenticated;

create or replace function public.audit_role_permission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  audit_action text;
  audit_entity_id text;
  audit_old_data jsonb;
  audit_new_data jsonb;
  audit_reason text := nullif(
    pg_catalog.current_setting('app.audit_reason', true),
    ''
  );
begin
  if tg_op = 'INSERT' then
    audit_action := 'role_permission_granted';
    audit_entity_id := new.role_id::text || ':' || new.permission_id::text;
    audit_old_data := null;
    audit_new_data := pg_catalog.to_jsonb(new);
  elsif tg_op = 'DELETE' then
    audit_action := 'role_permission_revoked';
    audit_entity_id := old.role_id::text || ':' || old.permission_id::text;
    audit_old_data := pg_catalog.to_jsonb(old);
    audit_new_data := null;
  else
    audit_action := 'role_permission_updated';
    audit_entity_id := new.role_id::text || ':' || new.permission_id::text;
    audit_old_data := pg_catalog.to_jsonb(old);
    audit_new_data := pg_catalog.to_jsonb(new);
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
    actor_id,
    'rbac',
    audit_action,
    'role_permission',
    audit_entity_id,
    audit_old_data,
    audit_new_data,
    audit_reason,
    pg_catalog.jsonb_build_object(
      'source',
      case when actor_id is null then 'database' else 'authenticated_user' end
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.audit_role_permission_change()
from public, anon, authenticated;

create or replace function public.set_role_permissions(
  target_role_id uuid,
  target_permission_ids uuid[],
  change_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := pg_catalog.btrim(change_reason);
  requested_permission_count integer := coalesce(pg_catalog.cardinality(target_permission_ids), 0);
  valid_permission_count integer;
  target_role public.roles%rowtype;
  old_permission_ids uuid[];
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.is_active_owner() then
    raise exception using errcode = '42501', message = 'ACTIVE_OWNER_REQUIRED';
  end if;

  if normalized_reason is null or normalized_reason = '' then
    raise exception using errcode = '22023', message = 'CHANGE_REASON_REQUIRED';
  end if;

  select role.*
  into target_role
  from public.roles as role
  where role.id = target_role_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TARGET_ROLE_NOT_FOUND';
  end if;

  if not target_role.is_active then
    raise exception using errcode = '23514', message = 'TARGET_ROLE_MUST_BE_ACTIVE';
  end if;

  if target_role.code = 'owner' then
    raise exception using errcode = '23514', message = 'OWNER_PERMISSIONS_ARE_IMMUTABLE';
  end if;

  if requested_permission_count > 0 then
    select pg_catalog.count(*)
    into valid_permission_count
    from public.permissions as permission
    where permission.id = any(target_permission_ids)
      and permission.is_active;

    if valid_permission_count <> requested_permission_count then
      raise exception using errcode = '22023', message = 'PERMISSION_SELECTION_INVALID';
    end if;
  end if;

  select pg_catalog.array_agg(role_permission.permission_id order by role_permission.permission_id)
  into old_permission_ids
  from public.role_permissions as role_permission
  where role_permission.role_id = target_role.id;

  perform pg_catalog.set_config('app.audit_reason', normalized_reason, true);

  delete from public.role_permissions as role_permission
  where role_permission.role_id = target_role.id
    and not (
      role_permission.permission_id = any(
        coalesce(target_permission_ids, array[]::uuid[])
      )
    );

  insert into public.role_permissions (
    role_id,
    permission_id,
    granted_by
  )
  select
    target_role.id,
    permission.id,
    actor_id
  from public.permissions as permission
  where permission.id = any(
    coalesce(target_permission_ids, array[]::uuid[])
  )
  on conflict (role_id, permission_id) do nothing;

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
    actor_id,
    'rbac',
    'role_permissions_replaced',
    'role',
    target_role.id::text,
    pg_catalog.jsonb_build_object(
      'permission_ids', coalesce(pg_catalog.to_jsonb(old_permission_ids), '[]'::jsonb)
    ),
    pg_catalog.jsonb_build_object(
      'permission_ids', pg_catalog.to_jsonb(
        coalesce(target_permission_ids, array[]::uuid[])
      )
    ),
    normalized_reason,
    pg_catalog.jsonb_build_object('source', 'settings')
  );

  return requested_permission_count;
end;
$$;

revoke all on function public.set_role_permissions(uuid, uuid[], text)
from public, anon, authenticated;
grant execute on function public.set_role_permissions(uuid, uuid[], text)
to authenticated;

commit;
