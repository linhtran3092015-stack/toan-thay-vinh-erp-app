begin;

-- TASK 9G: Event timestamps use transaction time and can tie. A database-owned
-- sequence gives every append a deterministic order without mutating history.

alter table public.coaching_record_events
  add column event_sequence bigint generated always as identity;

alter table public.coaching_record_events
  add constraint coaching_record_events_event_sequence_key
  unique (event_sequence);

create index coaching_record_events_record_sequence_idx
  on public.coaching_record_events (coaching_record_id, event_sequence desc);

create or replace function public.add_coaching_note(
  p_coaching_record_id uuid,
  p_note text
)
returns table (id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current_status text;
  v_event_id uuid;
  v_note text := pg_catalog.btrim(p_note);
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('coaching.manage') then
    raise exception using errcode = '42501', message = 'COACHING_MANAGE_PERMISSION_DENIED';
  end if;

  if p_coaching_record_id is null then
    raise exception using errcode = '22023', message = 'COACHING_RECORD_ID_REQUIRED';
  end if;

  if v_note is null or v_note = '' or pg_catalog.length(v_note) > 4000 then
    raise exception using errcode = '22023', message = 'COACHING_NOTE_INVALID';
  end if;

  perform 1
  from public.coaching_records
  where coaching_records.id = p_coaching_record_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COACHING_RECORD_NOT_FOUND';
  end if;

  select coaching_event.status
  into v_current_status
  from public.coaching_record_events as coaching_event
  where coaching_event.coaching_record_id = p_coaching_record_id
    and coaching_event.status is not null
  order by coaching_event.event_sequence desc
  limit 1;

  v_current_status := coalesce(v_current_status, 'open');

  if v_current_status = 'closed' then
    raise exception using errcode = '23514', message = 'COACHING_RECORD_CLOSED';
  end if;

  insert into public.coaching_record_events (
    coaching_record_id,
    event_type,
    note,
    occurred_by
  )
  values (
    p_coaching_record_id,
    'note_added',
    v_note,
    v_actor_id
  )
  returning coaching_record_events.id into v_event_id;

  return query select v_event_id;
end;
$$;

revoke all on function public.add_coaching_note(uuid, text) from public, anon;
grant execute on function public.add_coaching_note(uuid, text) to authenticated;

create or replace function public.advance_coaching_status(
  p_coaching_record_id uuid,
  p_target_status text,
  p_note text default null,
  p_outcome text default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current_status text;
  v_event_id uuid;
  v_note text := nullif(pg_catalog.btrim(p_note), '');
  v_outcome text := nullif(pg_catalog.btrim(p_outcome), '');
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('coaching.manage') then
    raise exception using errcode = '42501', message = 'COACHING_MANAGE_PERMISSION_DENIED';
  end if;

  if p_coaching_record_id is null then
    raise exception using errcode = '22023', message = 'COACHING_RECORD_ID_REQUIRED';
  end if;

  if p_target_status is null or p_target_status not in ('in_progress', 'closed') then
    raise exception using errcode = '22023', message = 'COACHING_TARGET_STATUS_INVALID';
  end if;

  if v_note is not null and pg_catalog.length(v_note) > 4000 then
    raise exception using errcode = '22023', message = 'COACHING_NOTE_INVALID';
  end if;

  if v_outcome is not null and pg_catalog.length(v_outcome) > 4000 then
    raise exception using errcode = '22023', message = 'COACHING_OUTCOME_INVALID';
  end if;

  perform 1
  from public.coaching_records
  where coaching_records.id = p_coaching_record_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COACHING_RECORD_NOT_FOUND';
  end if;

  select coaching_event.status
  into v_current_status
  from public.coaching_record_events as coaching_event
  where coaching_event.coaching_record_id = p_coaching_record_id
    and coaching_event.status is not null
  order by coaching_event.event_sequence desc
  limit 1;

  v_current_status := coalesce(v_current_status, 'open');

  if v_current_status = 'closed' then
    raise exception using errcode = '23514', message = 'COACHING_RECORD_CLOSED';
  end if;

  if p_target_status = 'in_progress' then
    if v_current_status <> 'open' then
      raise exception using errcode = '23514', message = 'COACHING_START_TRANSITION_INVALID';
    end if;

    if v_note is null then
      raise exception using errcode = '22023', message = 'COACHING_START_NOTE_REQUIRED';
    end if;

    if v_outcome is not null then
      raise exception using errcode = '22023', message = 'COACHING_START_OUTCOME_FORBIDDEN';
    end if;

    insert into public.coaching_record_events (
      coaching_record_id,
      event_type,
      status,
      note,
      occurred_by
    )
    values (
      p_coaching_record_id,
      'status_changed',
      'in_progress',
      v_note,
      v_actor_id
    )
    returning coaching_record_events.id into v_event_id;
  else
    if v_current_status <> 'in_progress' then
      raise exception using errcode = '23514', message = 'COACHING_CLOSE_TRANSITION_INVALID';
    end if;

    if v_outcome is null then
      raise exception using errcode = '22023', message = 'COACHING_CLOSE_OUTCOME_REQUIRED';
    end if;

    insert into public.coaching_record_events (
      coaching_record_id,
      event_type,
      status,
      note,
      outcome,
      occurred_by
    )
    values (
      p_coaching_record_id,
      'outcome_recorded',
      'closed',
      v_note,
      v_outcome,
      v_actor_id
    )
    returning coaching_record_events.id into v_event_id;
  end if;

  return query select v_event_id;
end;
$$;

revoke all on function public.advance_coaching_status(uuid, text, text, text)
from public, anon;
grant execute on function public.advance_coaching_status(uuid, text, text, text)
to authenticated;

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
    coalesce(latest_status.status, 'open'),
    latest_outcome.outcome,
    latest_event.occurred_at
  from public.coaching_records as coaching
  join public.students as student on student.id = coaching.student_id
  join public.profiles as assistant_owner on assistant_owner.id = coaching.assistant_owner_id
  left join lateral (
    select event.status
    from public.coaching_record_events as event
    where event.coaching_record_id = coaching.id
      and event.status is not null
    order by event.event_sequence desc
    limit 1
  ) as latest_status on true
  left join lateral (
    select event.outcome
    from public.coaching_record_events as event
    where event.coaching_record_id = coaching.id
      and event.outcome is not null
    order by event.event_sequence desc
    limit 1
  ) as latest_outcome on true
  left join lateral (
    select event.occurred_at
    from public.coaching_record_events as event
    where event.coaching_record_id = coaching.id
    order by event.event_sequence desc
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
    coalesce(latest_status.status, 'open'),
    latest_outcome.outcome,
    latest_event.occurred_at
  from public.coaching_records as coaching
  join public.students as student on student.id = coaching.student_id
  join public.profiles as assistant_owner on assistant_owner.id = coaching.assistant_owner_id
  left join lateral (
    select event.status
    from public.coaching_record_events as event
    where event.coaching_record_id = coaching.id
      and event.status is not null
    order by event.event_sequence desc
    limit 1
  ) as latest_status on true
  left join lateral (
    select event.outcome
    from public.coaching_record_events as event
    where event.coaching_record_id = coaching.id
      and event.outcome is not null
    order by event.event_sequence desc
    limit 1
  ) as latest_outcome on true
  left join lateral (
    select event.occurred_at
    from public.coaching_record_events as event
    where event.coaching_record_id = coaching.id
    order by event.event_sequence desc
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
  order by event.event_sequence asc;
end;
$$;

revoke all on function public.get_coaching_record_events(uuid) from public, anon;
grant execute on function public.get_coaching_record_events(uuid) to authenticated;

comment on column public.coaching_record_events.event_sequence
is 'Database-owned append order for deterministic Coaching state derivation.';

commit;
