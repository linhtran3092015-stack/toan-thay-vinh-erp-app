-- Xóa tài khoản nhân sự (chỉ Owner đang hoạt động).
--
-- Dữ liệu vận hành (chấm công, lương, điểm danh, audit) tham chiếu profiles
-- bằng `on delete restrict`, nên không thể xóa cứng một tài khoản đã phát sinh
-- lịch sử. Quy tắc:
--   1. Luôn: thu hồi mọi vai trò và lời mời đang chờ, chuyển trạng thái làm
--      việc sang `inactive`, ghi `account_deleted_at` để ẩn khỏi mọi danh sách.
--      Tài khoản mất `app.access` ngay (has_permission yêu cầu active).
--   2. Nếu tài khoản chưa phát sinh dữ liệu tham chiếu nào: xóa hẳn profile và
--      auth.users để không còn đăng nhập được. Nếu bị ràng buộc khóa ngoại,
--      giữ bản ghi ở trạng thái đã xóa mềm.
-- Không xóa được chính mình hoặc tài khoản đang giữ vai trò Owner.

begin;

alter table public.profiles
  add column account_deleted_at timestamptz,
  add column account_deleted_by uuid references public.profiles(id) on delete restrict,
  add column account_deletion_reason text,
  add constraint profiles_account_deleted_requires_inactive_check
    check (account_deleted_at is null or employment_status = 'inactive'),
  add constraint profiles_account_deletion_reason_check
    check (
      account_deleted_at is null
      or pg_catalog.btrim(coalesce(account_deletion_reason, '')) <> ''
    );

create index profiles_account_deleted_at_idx
  on public.profiles (account_deleted_at)
  where account_deleted_at is not null;

create or replace function public.delete_staff_account(
  target_user_id uuid,
  deletion_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := pg_catalog.btrim(coalesce(deletion_reason, ''));
  target public.profiles%rowtype;
  business_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  revoked_role_count integer := 0;
  revoked_invitation_count integer := 0;
  hard_deleted boolean := false;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.is_active_owner() then
    raise exception using errcode = '42501', message = 'ACTIVE_OWNER_REQUIRED';
  end if;

  if normalized_reason = '' then
    raise exception using errcode = '22023', message = 'DELETION_REASON_REQUIRED';
  end if;

  if target_user_id = actor_id then
    raise exception using errcode = '23514', message = 'CANNOT_DELETE_OWN_ACCOUNT';
  end if;

  select * into target
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TARGET_PROFILE_NOT_FOUND';
  end if;

  if target.account_deleted_at is not null then
    raise exception using errcode = '23514', message = 'ACCOUNT_ALREADY_DELETED';
  end if;

  if exists (
    select 1
    from public.user_role_assignments as assignment
    join public.roles as role
      on role.id = assignment.role_id
    where assignment.user_id = target_user_id
      and assignment.revoked_at is null
      and role.code = 'owner'
  ) then
    raise exception using errcode = '23514', message = 'CANNOT_DELETE_OWNER_ACCOUNT';
  end if;

  update public.user_role_assignments
  set
    revoked_at = pg_catalog.now(),
    revoked_by = actor_id,
    revocation_reason = normalized_reason
  where user_id = target_user_id
    and revoked_at is null;
  get diagnostics revoked_role_count = row_count;

  update public.account_invitations
  set
    status = 'revoked',
    revoked_by = actor_id,
    revoked_at = pg_catalog.now(),
    revocation_reason = normalized_reason
  where email = target.email
    and status = 'pending';
  get diagnostics revoked_invitation_count = row_count;

  update public.profiles
  set
    employment_status = 'inactive',
    left_at = coalesce(left_at, greatest(business_today, coalesce(joined_at, business_today))),
    account_deleted_at = pg_catalog.now(),
    account_deleted_by = actor_id,
    account_deletion_reason = normalized_reason
  where id = target_user_id;

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
    'staff_account_deleted',
    'profile',
    target_user_id::text,
    pg_catalog.jsonb_build_object(
      'email', target.email,
      'display_name', target.display_name,
      'employment_status', target.employment_status
    ),
    pg_catalog.jsonb_build_object(
      'employment_status', 'inactive',
      'account_deleted', true
    ),
    normalized_reason,
    pg_catalog.jsonb_build_object(
      'source', 'settings',
      'revoked_role_count', revoked_role_count,
      'revoked_invitation_count', revoked_invitation_count
    )
  );

  -- Xóa cứng chỉ khi không còn bản ghi nào tham chiếu tài khoản. Mọi lỗi khóa
  -- ngoại hoặc thiếu quyền trên auth.users hủy riêng khối này, bản ghi xóa mềm
  -- phía trên vẫn được giữ.
  begin
    delete from public.user_role_assignments where user_id = target_user_id;
    delete from public.profiles where id = target_user_id;
    delete from auth.users where id = target_user_id;
    hard_deleted := true;
  exception
    when foreign_key_violation or insufficient_privilege then
      hard_deleted := false;
  end;

  return pg_catalog.jsonb_build_object(
    'hardDeleted', hard_deleted,
    'revokedRoleCount', revoked_role_count,
    'revokedInvitationCount', revoked_invitation_count
  );
end;
$$;

revoke all on function public.delete_staff_account(uuid, text)
from public, anon, authenticated;
grant execute on function public.delete_staff_account(uuid, text)
to authenticated;

commit;
