-- Nhận lời mời tài khoản chỉ khi email trong phiên đã được xác minh.
--
-- accept_my_account_invitation khớp email trong JWT với lời mời đang chờ
-- rồi cấp vai trò, nhưng không kiểm tra email đó đã xác minh hay chưa.
-- Nếu provider Email trên Supabase bật đăng ký không cần xác nhận, ai đó
-- có thể đăng ký qua API bằng địa chỉ được mời và chiếm vai trò của lời mời.
-- Nay yêu cầu `user_metadata.email_verified = true` (Google OAuth luôn đặt
-- cờ này). Lời mời không bị tiêu thụ khi kiểm tra thất bại.

begin;

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
  actor_email_verified boolean := coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean,
    false
  );
  pending_invitation public.account_invitations%rowtype;
begin
  if actor_id is null or actor_email = '' then
    return false;
  end if;

  if public.has_permission('app.access') then
    return true;
  end if;

  if not actor_email_verified then
    return false;
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
    pg_catalog.jsonb_build_object('source', 'oauth_callback', 'email_verified', true)
  );

  return public.has_permission('app.access');
end;
$$;

commit;
