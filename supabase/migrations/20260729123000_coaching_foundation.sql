begin;

-- TASK 9A: Coaching is an append-only record of a distinct support campaign.
-- Operational creation, assignment changes, automation, and close criteria are
-- intentionally deferred until the business policy is approved.

insert into public.permissions (code, module, name, description)
values
  ('coaching.view', 'coaching', 'Xem coaching', 'Chủ trung tâm và trợ lý xem các phiếu coaching.'),
  ('coaching.manage', 'coaching', 'Quản lý coaching', 'Dành cho chủ trung tâm và trợ lý khi quy trình tạo hoặc cập nhật phiếu được phê duyệt.')
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id, granted_by)
select role.id, permission.id, null
from public.roles as role
join public.permissions as permission
  on permission.code in ('coaching.view', 'coaching.manage')
where role.code in ('owner', 'assistant_manager')
on conflict (role_id, permission_id) do nothing;

create table public.coaching_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  campaign_name text not null,
  reason text not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  assistant_owner_id uuid not null references public.profiles(id) on delete restrict,
  review_at date,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  opened_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  constraint coaching_records_campaign_name_check
    check (campaign_name = pg_catalog.btrim(campaign_name) and campaign_name <> '' and pg_catalog.length(campaign_name) <= 240),
  constraint coaching_records_reason_check
    check (reason = pg_catalog.btrim(reason) and reason <> '' and pg_catalog.length(reason) <= 4000)
);

create index coaching_records_student_opened_idx
  on public.coaching_records (student_id, opened_at desc);

create index coaching_records_assistant_opened_idx
  on public.coaching_records (assistant_owner_id, opened_at desc);

create table public.coaching_record_events (
  id uuid primary key default gen_random_uuid(),
  coaching_record_id uuid not null references public.coaching_records(id) on delete restrict,
  event_type text not null check (event_type in ('opened', 'status_changed', 'outcome_recorded', 'note_added')),
  status text check (status in ('open', 'in_progress', 'closed')),
  note text,
  outcome text,
  occurred_by uuid not null references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  constraint coaching_record_events_note_check
    check (note is null or (note = pg_catalog.btrim(note) and note <> '' and pg_catalog.length(note) <= 4000)),
  constraint coaching_record_events_outcome_check
    check (outcome is null or (outcome = pg_catalog.btrim(outcome) and outcome <> '' and pg_catalog.length(outcome) <= 4000)),
  constraint coaching_record_events_payload_check
    check (status is not null or note is not null or outcome is not null)
);

create index coaching_record_events_record_occurred_idx
  on public.coaching_record_events (coaching_record_id, occurred_at desc, id desc);

create or replace function public.prevent_coaching_record_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'COACHING_RECORD_IMMUTABLE';
end;
$$;

revoke all on function public.prevent_coaching_record_mutation() from public, anon, authenticated;

create trigger coaching_records_prevent_mutation
before update or delete on public.coaching_records
for each row execute function public.prevent_coaching_record_mutation();

create or replace function public.prevent_coaching_record_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'COACHING_RECORD_EVENT_IMMUTABLE';
end;
$$;

revoke all on function public.prevent_coaching_record_event_mutation() from public, anon, authenticated;

create trigger coaching_record_events_prevent_mutation
before update or delete on public.coaching_record_events
for each row execute function public.prevent_coaching_record_event_mutation();

create or replace function public.audit_coaching_record_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    new_data,
    metadata
  )
  values (
    new.opened_by,
    'coaching',
    'coaching_record_created',
    'coaching_record',
    new.id::text,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object(
      'student_id', new.student_id,
      'assistant_owner_id', new.assistant_owner_id,
      'priority', new.priority
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_coaching_record_insert() from public, anon, authenticated;

create trigger coaching_records_audit_insert
after insert on public.coaching_records
for each row execute function public.audit_coaching_record_insert();

create or replace function public.audit_coaching_record_event_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    new_data,
    metadata
  )
  values (
    new.occurred_by,
    'coaching',
    'coaching_record_event_created',
    'coaching_record_event',
    new.id::text,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object(
      'coaching_record_id', new.coaching_record_id,
      'event_type', new.event_type,
      'status', new.status
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_coaching_record_event_insert() from public, anon, authenticated;

create trigger coaching_record_events_audit_insert
after insert on public.coaching_record_events
for each row execute function public.audit_coaching_record_event_insert();

alter table public.coaching_records enable row level security;
alter table public.coaching_record_events enable row level security;

create policy coaching_records_select_authorized
on public.coaching_records
for select
to authenticated
using (public.has_permission('coaching.view'));

create policy coaching_record_events_select_authorized
on public.coaching_record_events
for select
to authenticated
using (public.has_permission('coaching.view'));

revoke all privileges on public.coaching_records, public.coaching_record_events
from public, anon, authenticated;
grant select on public.coaching_records, public.coaching_record_events to authenticated;

create or replace function public.get_coaching_records_dashboard(
  p_limit integer default 200
)
returns table (
  coaching_record_id uuid,
  student_id uuid,
  student_public_code text,
  student_full_name text,
  campaign_name text,
  reason text,
  priority text,
  assistant_owner_id uuid,
  assistant_owner_display_name text,
  review_at date,
  opened_at timestamptz,
  current_status text,
  latest_outcome text,
  latest_event_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('coaching.view') then
    raise exception using errcode = '42501', message = 'COACHING_VIEW_PERMISSION_DENIED';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'COACHING_LIMIT_INVALID';
  end if;

  return query
  select
    coaching.id,
    coaching.student_id,
    student.public_code,
    student.full_name,
    coaching.campaign_name,
    coaching.reason,
    coaching.priority,
    coaching.assistant_owner_id,
    coalesce(nullif(pg_catalog.btrim(assistant_owner.display_name), ''), assistant_owner.email),
    coaching.review_at,
    coaching.opened_at,
    coalesce(latest_event.status, 'open'),
    latest_event.outcome,
    latest_event.occurred_at
  from public.coaching_records as coaching
  join public.students as student on student.id = coaching.student_id
  join public.profiles as assistant_owner on assistant_owner.id = coaching.assistant_owner_id
  left join lateral (
    select event.status, event.outcome, event.occurred_at
    from public.coaching_record_events as event
    where event.coaching_record_id = coaching.id
    order by event.occurred_at desc, event.id desc
    limit 1
  ) as latest_event on true
  order by coaching.opened_at desc, coaching.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_coaching_records_dashboard(integer) from public, anon;
grant execute on function public.get_coaching_records_dashboard(integer) to authenticated;

create or replace function public.get_coaching_record_detail(
  p_coaching_record_id uuid
)
returns table (
  coaching_record_id uuid,
  student_id uuid,
  student_public_code text,
  student_full_name text,
  campaign_name text,
  reason text,
  priority text,
  assistant_owner_id uuid,
  assistant_owner_display_name text,
  review_at date,
  opened_at timestamptz,
  current_status text,
  latest_outcome text,
  latest_event_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('coaching.view') then
    raise exception using errcode = '42501', message = 'COACHING_VIEW_PERMISSION_DENIED';
  end if;

  if p_coaching_record_id is null then
    raise exception using errcode = '22023', message = 'COACHING_RECORD_ID_REQUIRED';
  end if;

  return query
  select
    coaching.id,
    coaching.student_id,
    student.public_code,
    student.full_name,
    coaching.campaign_name,
    coaching.reason,
    coaching.priority,
    coaching.assistant_owner_id,
    coalesce(nullif(pg_catalog.btrim(assistant_owner.display_name), ''), assistant_owner.email),
    coaching.review_at,
    coaching.opened_at,
    coalesce(latest_event.status, 'open'),
    latest_event.outcome,
    latest_event.occurred_at
  from public.coaching_records as coaching
  join public.students as student on student.id = coaching.student_id
  join public.profiles as assistant_owner on assistant_owner.id = coaching.assistant_owner_id
  left join lateral (
    select event.status, event.outcome, event.occurred_at
    from public.coaching_record_events as event
    where event.coaching_record_id = coaching.id
    order by event.occurred_at desc, event.id desc
    limit 1
  ) as latest_event on true
  where coaching.id = p_coaching_record_id;
end;
$$;

revoke all on function public.get_coaching_record_detail(uuid) from public, anon;
grant execute on function public.get_coaching_record_detail(uuid) to authenticated;

create or replace function public.get_coaching_record_events(
  p_coaching_record_id uuid
)
returns table (
  coaching_record_event_id uuid,
  event_type text,
  status text,
  note text,
  outcome text,
  occurred_by_display_name text,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('coaching.view') then
    raise exception using errcode = '42501', message = 'COACHING_VIEW_PERMISSION_DENIED';
  end if;

  if p_coaching_record_id is null then
    raise exception using errcode = '22023', message = 'COACHING_RECORD_ID_REQUIRED';
  end if;

  return query
  select
    event.id,
    event.event_type,
    event.status,
    event.note,
    event.outcome,
    coalesce(nullif(pg_catalog.btrim(actor.display_name), ''), actor.email),
    event.occurred_at
  from public.coaching_record_events as event
  join public.profiles as actor on actor.id = event.occurred_by
  where event.coaching_record_id = p_coaching_record_id
  order by event.occurred_at asc, event.id asc;
end;
$$;

revoke all on function public.get_coaching_record_events(uuid) from public, anon;
grant execute on function public.get_coaching_record_events(uuid) to authenticated;

comment on table public.coaching_records
is 'Immutable coaching campaign record. Each campaign is a separate record; creation and mutation workflows require an approved follow-up policy.';

comment on table public.coaching_record_events
is 'Immutable coaching history. Current state is derived from the latest append-only event.';

commit;
