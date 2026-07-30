-- TASK 9D — IN-APP NOTIFICATION FOUNDATION
--
-- Scope:
-- - notifications.view permission
-- - recipient-scoped notification storage
-- - recipient-only RLS reads
-- - RPC-only read-state mutations
-- - salary advance workflow notifications
--
-- No email, Zalo, browser push, realtime or service-role access.

insert into public.permissions (
  code,
  module,
  name,
  description
)
values (
  'notifications.view',
  'notifications',
  'Xem thông báo',
  'Xem và đánh dấu đã đọc các thông báo trong ứng dụng của chính tài khoản.'
)
on conflict (code) do update
set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (
  role_id,
  permission_id,
  granted_by
)
select distinct
  role.id,
  notification_permission.id,
  null
from public.roles as role
join public.role_permissions as app_role_permission
  on app_role_permission.role_id = role.id
join public.permissions as app_permission
  on app_permission.id = app_role_permission.permission_id
  and app_permission.code = 'app.access'
  and app_permission.is_active
cross join public.permissions as notification_permission
where role.is_active
  and notification_permission.code = 'notifications.view'
  and notification_permission.is_active
on conflict (role_id, permission_id) do nothing;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null
    references public.profiles(id) on delete restrict,
  actor_user_id uuid
    references public.profiles(id) on delete restrict,
  event_code text not null,
  title text not null,
  message text not null,
  href text,
  entity_type text,
  entity_id text,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),

  constraint notifications_event_code_check
    check (
      event_code = pg_catalog.btrim(event_code)
      and event_code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
      and pg_catalog.length(event_code) <= 100
    ),

  constraint notifications_title_check
    check (
      title = pg_catalog.btrim(title)
      and title <> ''
      and pg_catalog.length(title) <= 200
    ),

  constraint notifications_message_check
    check (
      message = pg_catalog.btrim(message)
      and message <> ''
      and pg_catalog.length(message) <= 1000
    ),

  constraint notifications_href_check
    check (
      href is null
      or (
        href = pg_catalog.btrim(href)
        and href like '/%'
        and href not like '//%'
        and pg_catalog.length(href) <= 500
      )
    ),

  constraint notifications_entity_pair_check
    check (
      (
        entity_type is null
        and entity_id is null
      )
      or
      (
        entity_type is not null
        and entity_id is not null
        and entity_type = pg_catalog.btrim(entity_type)
        and entity_type <> ''
        and entity_id = pg_catalog.btrim(entity_id)
        and entity_id <> ''
        and pg_catalog.length(entity_type) <= 100
        and pg_catalog.length(entity_id) <= 200
      )
    ),

  constraint notifications_dedupe_key_check
    check (
      dedupe_key = pg_catalog.btrim(dedupe_key)
      and dedupe_key <> ''
      and pg_catalog.length(dedupe_key) <= 300
    ),

  constraint notifications_metadata_object_check
    check (pg_catalog.jsonb_typeof(metadata) = 'object'),

  constraint notifications_read_time_check
    check (read_at is null or read_at >= created_at)
);

create unique index notifications_recipient_dedupe_unique_idx
on public.notifications (
  recipient_user_id,
  dedupe_key
);

create index notifications_recipient_created_idx
on public.notifications (
  recipient_user_id,
  created_at desc,
  id desc
);

create index notifications_recipient_unread_idx
on public.notifications (
  recipient_user_id,
  created_at desc
)
where read_at is null;

create or replace function public.protect_notification_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '23514',
      message = 'NOTIFICATIONS_CANNOT_BE_DELETED';
  end if;

  if new.id is distinct from old.id
    or new.recipient_user_id is distinct from old.recipient_user_id
    or new.actor_user_id is distinct from old.actor_user_id
    or new.event_code is distinct from old.event_code
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.href is distinct from old.href
    or new.entity_type is distinct from old.entity_type
    or new.entity_id is distinct from old.entity_id
    or new.dedupe_key is distinct from old.dedupe_key
    or new.metadata is distinct from old.metadata
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'NOTIFICATION_CONTENT_IS_IMMUTABLE';
  end if;

  if new.read_at is not distinct from old.read_at then
    return new;
  end if;

  if old.read_at is null
    and new.read_at is not null
    and new.read_at >= old.created_at
  then
    return new;
  end if;

  raise exception using
    errcode = '23514',
    message = 'NOTIFICATION_READ_STATE_IS_IMMUTABLE';
end;
$$;

revoke all on function public.protect_notification_history()
from public, anon, authenticated;

create trigger notifications_protect_history
before update or delete on public.notifications
for each row execute function public.protect_notification_history();

alter table public.notifications enable row level security;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  recipient_user_id = (select auth.uid())
  and public.has_permission('notifications.view')
);

revoke all privileges on public.notifications
from public, anon, authenticated;

grant select on public.notifications
to authenticated;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  updated_notification public.notifications%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('notifications.view') then
    raise exception using
      errcode = '42501',
      message = 'NOTIFICATIONS_VIEW_PERMISSION_REQUIRED';
  end if;

  if p_notification_id is null then
    raise exception using
      errcode = '22023',
      message = 'NOTIFICATION_ID_REQUIRED';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, pg_catalog.now())
  where id = p_notification_id
    and recipient_user_id = actor_id
  returning * into updated_notification;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'NOTIFICATION_NOT_FOUND';
  end if;

  return updated_notification;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  updated_count bigint;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('notifications.view') then
    raise exception using
      errcode = '42501',
      message = 'NOTIFICATIONS_VIEW_PERMISSION_REQUIRED';
  end if;

  update public.notifications
  set read_at = pg_catalog.now()
  where recipient_user_id = actor_id
    and read_at is null;

  get diagnostics updated_count = row_count;

  return updated_count;
end;
$$;

revoke all on function public.mark_notification_read(uuid)
from public, anon;

revoke all on function public.mark_all_notifications_read()
from public, anon;

grant execute on function public.mark_notification_read(uuid)
to authenticated;

grant execute on function public.mark_all_notifications_read()
to authenticated;

create or replace function public.notify_salary_advance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
    and new.status = 'requested'
  then
    insert into public.notifications (
      recipient_user_id,
      actor_user_id,
      event_code,
      title,
      message,
      href,
      entity_type,
      entity_id,
      dedupe_key,
      metadata
    )
    select
      recipient.user_id,
      new.requested_by,
      'salary_advance.requested',
      'Có yêu cầu tạm ứng mới',
      'Một yêu cầu tạm ứng mới đang chờ đối soát.',
      '/advances',
      'salary_advance',
      new.id::text,
      'salary_advance:' || new.id::text || ':requested',
      pg_catalog.jsonb_build_object(
        'source',
        'salary_advance_workflow'
      )
    from (
      select assignment.user_id
      from public.user_role_assignments as assignment
      join public.profiles as profile
        on profile.id = assignment.user_id
        and profile.employment_status = 'active'
      join public.roles as role
        on role.id = assignment.role_id
        and role.is_active
      join public.role_permissions as role_permission
        on role_permission.role_id = role.id
      join public.permissions as permission
        on permission.id = role_permission.permission_id
        and permission.is_active
      where assignment.revoked_at is null
        and permission.code in (
          'advances.review',
          'notifications.view'
        )
      group by assignment.user_id
      having pg_catalog.count(distinct permission.code) = 2
    ) as recipient
    on conflict (
      recipient_user_id,
      dedupe_key
    ) do nothing;

  elsif tg_op = 'UPDATE'
    and old.status = 'requested'
    and new.status = 'review'
  then
    insert into public.notifications (
      recipient_user_id,
      actor_user_id,
      event_code,
      title,
      message,
      href,
      entity_type,
      entity_id,
      dedupe_key,
      metadata
    )
    select
      recipient.user_id,
      new.reviewed_by,
      'salary_advance.review',
      'Yêu cầu tạm ứng chờ duyệt',
      'Một yêu cầu tạm ứng đã được đối soát và đang chờ duyệt.',
      '/advances',
      'salary_advance',
      new.id::text,
      'salary_advance:' || new.id::text || ':review',
      pg_catalog.jsonb_build_object(
        'source',
        'salary_advance_workflow'
      )
    from (
      select assignment.user_id
      from public.user_role_assignments as assignment
      join public.profiles as profile
        on profile.id = assignment.user_id
        and profile.employment_status = 'active'
      join public.roles as role
        on role.id = assignment.role_id
        and role.is_active
      join public.role_permissions as role_permission
        on role_permission.role_id = role.id
      join public.permissions as permission
        on permission.id = role_permission.permission_id
        and permission.is_active
      where assignment.revoked_at is null
        and permission.code in (
          'advances.owner_approve',
          'notifications.view'
        )
      group by assignment.user_id
      having pg_catalog.count(distinct permission.code) = 2
    ) as recipient
    on conflict (
      recipient_user_id,
      dedupe_key
    ) do nothing;

  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status in ('approved', 'rejected')
  then
    insert into public.notifications (
      recipient_user_id,
      actor_user_id,
      event_code,
      title,
      message,
      href,
      entity_type,
      entity_id,
      dedupe_key,
      metadata
    )
    select distinct
      assignment.user_id,
      case
        when new.status = 'approved' then new.approved_by
        else new.rejected_by
      end,
      case
        when new.status = 'approved'
          then 'salary_advance.approved'
        else 'salary_advance.rejected'
      end,
      case
        when new.status = 'approved'
          then 'Yêu cầu tạm ứng đã được duyệt'
        else 'Yêu cầu tạm ứng đã bị từ chối'
      end,
      case
        when new.status = 'approved'
          then 'Yêu cầu tạm ứng của bạn đã được duyệt.'
        else 'Yêu cầu tạm ứng của bạn đã bị từ chối. Mở mục Tạm ứng để xem chi tiết.'
      end,
      '/advances',
      'salary_advance',
      new.id::text,
      'salary_advance:' || new.id::text || ':' || new.status,
      pg_catalog.jsonb_build_object(
        'source',
        'salary_advance_workflow'
      )
    from public.user_role_assignments as assignment
    join public.profiles as profile
      on profile.id = assignment.user_id
      and profile.employment_status = 'active'
    join public.roles as role
      on role.id = assignment.role_id
      and role.is_active
    join public.role_permissions as role_permission
      on role_permission.role_id = role.id
    join public.permissions as permission
      on permission.id = role_permission.permission_id
      and permission.is_active
      and permission.code = 'notifications.view'
    where assignment.revoked_at is null
      and assignment.user_id = new.requested_by
    on conflict (
      recipient_user_id,
      dedupe_key
    ) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_salary_advance_change()
from public, anon, authenticated;

create trigger salary_advances_create_notifications
after insert or update of status on public.salary_advances
for each row execute function public.notify_salary_advance_change();
