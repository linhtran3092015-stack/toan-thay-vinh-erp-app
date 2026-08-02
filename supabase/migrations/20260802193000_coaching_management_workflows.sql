begin;

-- TASK 9G: Approved Coaching management workflows.
-- Records and events remain immutable. All operational changes append events.

create or replace function public.get_coaching_student_options(
  p_limit integer default 500
)
returns table (
  student_id uuid,
  student_public_code text,
  student_full_name text,
  lifecycle_status text
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

  if not public.has_permission('coaching.manage') then
    raise exception using errcode = '42501', message = 'COACHING_MANAGE_PERMISSION_DENIED';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'COACHING_STUDENT_LIMIT_INVALID';
  end if;

  return query
  select
    student.id,
    student.public_code,
    student.full_name,
    student.lifecycle_status
  from public.students as student
  order by student.full_name asc, student.public_code asc
  limit p_limit;
end;
$$;

revoke all on function public.get_coaching_student_options(integer) from public, anon;
grant execute on function public.get_coaching_student_options(integer) to authenticated;

create or replace function public.get_coaching_assignee_options()
returns table (
  profile_id uuid,
  display_name text,
  role_code text
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

  if not public.has_permission('coaching.manage') then
    raise exception using errcode = '42501', message = 'COACHING_MANAGE_PERMISSION_DENIED';
  end if;

  return query
  select
    profile.id,
    coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), profile.email),
    case
      when pg_catalog.bool_or(role.code = 'owner') then 'owner'::text
      else 'assistant_manager'::text
    end
  from public.profiles as profile
  join public.user_role_assignments as assignment
    on assignment.user_id = profile.id
    and assignment.revoked_at is null
  join public.roles as role
    on role.id = assignment.role_id
    and role.is_active
    and role.code in ('owner', 'assistant_manager')
  where profile.employment_status = 'active'
  group by profile.id, profile.display_name, profile.email
  order by
    case when pg_catalog.bool_or(role.code = 'owner') then 0 else 1 end,
    coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), profile.email);
end;
$$;

revoke all on function public.get_coaching_assignee_options() from public, anon;
grant execute on function public.get_coaching_assignee_options() to authenticated;

create or replace function public.create_coaching_record(
  p_student_id uuid,
  p_campaign_name text,
  p_reason text,
  p_priority text,
  p_assistant_owner_id uuid,
  p_review_at date default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_campaign_name text := pg_catalog.btrim(p_campaign_name);
  v_reason text := pg_catalog.btrim(p_reason);
  v_record_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('coaching.manage') then
    raise exception using errcode = '42501', message = 'COACHING_MANAGE_PERMISSION_DENIED';
  end if;

  if not exists (select 1 from public.profiles where profiles.id = v_actor_id) then
    raise exception using errcode = '23503', message = 'COACHING_ACTOR_PROFILE_NOT_FOUND';
  end if;

  if p_student_id is null then
    raise exception using errcode = '22023', message = 'COACHING_STUDENT_ID_REQUIRED';
  end if;

  if not exists (select 1 from public.students where students.id = p_student_id) then
    raise exception using errcode = 'P0002', message = 'COACHING_STUDENT_NOT_FOUND';
  end if;

  if v_campaign_name is null or v_campaign_name = '' or pg_catalog.length(v_campaign_name) > 240 then
    raise exception using errcode = '22023', message = 'COACHING_CAMPAIGN_NAME_INVALID';
  end if;

  if v_reason is null or v_reason = '' or pg_catalog.length(v_reason) > 4000 then
    raise exception using errcode = '22023', message = 'COACHING_REASON_INVALID';
  end if;

  if p_priority is null or p_priority not in ('low', 'medium', 'high') then
    raise exception using errcode = '22023', message = 'COACHING_PRIORITY_INVALID';
  end if;

  if p_assistant_owner_id is null then
    raise exception using errcode = '22023', message = 'COACHING_ASSIGNEE_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    join public.user_role_assignments as assignment
      on assignment.user_id = profile.id
      and assignment.revoked_at is null
    join public.roles as role
      on role.id = assignment.role_id
      and role.is_active
      and role.code in ('owner', 'assistant_manager')
    where profile.id = p_assistant_owner_id
      and profile.employment_status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'COACHING_ASSIGNEE_NOT_ELIGIBLE';
  end if;

  if p_review_at is not null and p_review_at < current_date then
    raise exception using errcode = '22023', message = 'COACHING_REVIEW_DATE_IN_PAST';
  end if;

  insert into public.coaching_records (
    student_id,
    campaign_name,
    reason,
    priority,
    assistant_owner_id,
    review_at,
    opened_by
  )
  values (
    p_student_id,
    v_campaign_name,
    v_reason,
    p_priority,
    p_assistant_owner_id,
    p_review_at,
    v_actor_id
  )
  returning coaching_records.id into v_record_id;

  insert into public.coaching_record_events (
    coaching_record_id,
    event_type,
    status,
    occurred_by
  )
  values (
    v_record_id,
    'opened',
    'open',
    v_actor_id
  );

  return query select v_record_id;
end;
$$;

revoke all on function public.create_coaching_record(uuid, text, text, text, uuid, date)
from public, anon;
grant execute on function public.create_coaching_record(uuid, text, text, text, uuid, date)
to authenticated;

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

  select coalesce(event.status, 'open')
  into v_current_status
  from (
    select coaching_event.status
    from public.coaching_record_events as coaching_event
    where coaching_event.coaching_record_id = p_coaching_record_id
      and coaching_event.status is not null
    order by coaching_event.occurred_at desc, coaching_event.id desc
    limit 1
  ) as event;

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

  select coalesce(event.status, 'open')
  into v_current_status
  from (
    select coaching_event.status
    from public.coaching_record_events as coaching_event
    where coaching_event.coaching_record_id = p_coaching_record_id
      and coaching_event.status is not null
    order by coaching_event.occurred_at desc, coaching_event.id desc
    limit 1
  ) as event;

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
    order by event.occurred_at desc, event.id desc
    limit 1
  ) as latest_status on true
  left join lateral (
    select event.outcome
    from public.coaching_record_events as event
    where event.coaching_record_id = coaching.id
      and event.outcome is not null
    order by event.occurred_at desc, event.id desc
    limit 1
  ) as latest_outcome on true
  left join lateral (
    select event.occurred_at
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
    order by event.occurred_at desc, event.id desc
    limit 1
  ) as latest_status on true
  left join lateral (
    select event.outcome
    from public.coaching_record_events as event
    where event.coaching_record_id = coaching.id
      and event.outcome is not null
    order by event.occurred_at desc, event.id desc
    limit 1
  ) as latest_outcome on true
  left join lateral (
    select event.occurred_at
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

comment on function public.create_coaching_record(uuid, text, text, text, uuid, date)
is 'Creates one immutable Coaching campaign and its initial open event.';

comment on function public.add_coaching_note(uuid, text)
is 'Appends a note to an open or in-progress Coaching campaign.';

comment on function public.advance_coaching_status(uuid, text, text, text)
is 'Advances Coaching linearly from open to in_progress to closed. Closing requires an outcome.';

commit;
