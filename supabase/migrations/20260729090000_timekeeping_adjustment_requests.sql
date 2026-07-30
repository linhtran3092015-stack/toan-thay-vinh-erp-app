begin;

-- =========================================================
-- TASK 8F
-- Append-only time-entry adjustment requests and decisions.
-- Approved proposals are separate from the original time entry so the
-- check-in/check-out evidence and source timestamps remain immutable.
-- =========================================================


-- =========================================================
-- ADJUSTMENT REQUESTS
-- =========================================================

create table public.time_entry_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null
    references public.time_entries(id) on delete restrict,
  requester_id uuid not null
    references public.profiles(id) on delete restrict,
  original_check_in_at timestamptz not null,
  original_check_in_mode text not null,
  original_check_out_at timestamptz not null,
  original_check_out_mode text not null,
  requested_check_in_at timestamptz not null,
  requested_check_in_mode text not null,
  requested_check_out_at timestamptz not null,
  requested_check_out_mode text not null,
  request_reason text not null,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint time_entry_adjustment_original_modes_check
    check (
      original_check_in_mode in ('online', 'offline')
      and original_check_out_mode in ('online', 'offline', 'auto_end')
    ),
  constraint time_entry_adjustment_requested_modes_check
    check (
      requested_check_in_mode in ('online', 'offline')
      and requested_check_out_mode in ('online', 'offline')
    ),
  constraint time_entry_adjustment_requested_time_range_check
    check (requested_check_out_at >= requested_check_in_at),
  constraint time_entry_adjustment_request_reason_check
    check (
      request_reason = pg_catalog.btrim(request_reason)
      and request_reason <> ''
      and pg_catalog.length(request_reason) <= 2000
    ),
  constraint time_entry_adjustment_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint time_entry_adjustment_decision_lifecycle_check
    check (
      (
        status = 'pending'
        and reviewed_by is null
        and reviewed_at is null
        and decision_reason is null
      )
      or
      (
        status = 'approved'
        and reviewed_by is not null
        and reviewed_at is not null
        and (
          decision_reason is null
          or (
            decision_reason = pg_catalog.btrim(decision_reason)
            and decision_reason <> ''
            and pg_catalog.length(decision_reason) <= 2000
          )
        )
      )
      or
      (
        status = 'rejected'
        and reviewed_by is not null
        and reviewed_at is not null
        and decision_reason is not null
        and decision_reason = pg_catalog.btrim(decision_reason)
        and decision_reason <> ''
        and pg_catalog.length(decision_reason) <= 2000
      )
    )
);

create unique index time_entry_adjustment_one_pending_request_idx
on public.time_entry_adjustment_requests (time_entry_id)
where status = 'pending';

create unique index time_entry_adjustment_one_approved_request_idx
on public.time_entry_adjustment_requests (time_entry_id)
where status = 'approved';

create index time_entry_adjustment_requester_created_idx
on public.time_entry_adjustment_requests (requester_id, created_at desc);

create index time_entry_adjustment_pending_queue_idx
on public.time_entry_adjustment_requests (created_at asc)
where status = 'pending';

create trigger time_entry_adjustment_requests_set_updated_at
before update on public.time_entry_adjustment_requests
for each row execute function public.set_updated_at();


-- =========================================================
-- HISTORY PROTECTION AND AUDIT
-- =========================================================

create or replace function public.protect_time_entry_adjustment_request_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'pending' then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_ADJUSTMENT_DECISION_IS_FINAL';
  end if;

  if new.id is distinct from old.id
    or new.time_entry_id is distinct from old.time_entry_id
    or new.requester_id is distinct from old.requester_id
    or new.original_check_in_at is distinct from old.original_check_in_at
    or new.original_check_in_mode is distinct from old.original_check_in_mode
    or new.original_check_out_at is distinct from old.original_check_out_at
    or new.original_check_out_mode is distinct from old.original_check_out_mode
    or new.requested_check_in_at is distinct from old.requested_check_in_at
    or new.requested_check_in_mode is distinct from old.requested_check_in_mode
    or new.requested_check_out_at is distinct from old.requested_check_out_at
    or new.requested_check_out_mode is distinct from old.requested_check_out_mode
    or new.request_reason is distinct from old.request_reason
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_ADJUSTMENT_HISTORY_IS_IMMUTABLE';
  end if;

  if new.status not in ('approved', 'rejected') then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_ADJUSTMENT_MUST_BE_DECIDED_BY_WORKFLOW';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_time_entry_adjustment_request_history()
from public, anon, authenticated;

create trigger time_entry_adjustment_requests_protect_history
before update on public.time_entry_adjustment_requests
for each row execute function public.protect_time_entry_adjustment_request_history();


create or replace function public.prevent_time_entry_adjustment_request_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'TIME_ENTRY_ADJUSTMENT_REQUESTS_CANNOT_BE_DELETED';
end;
$$;

revoke all on function public.prevent_time_entry_adjustment_request_delete()
from public, anon, authenticated;

create trigger time_entry_adjustment_requests_prevent_delete
before delete on public.time_entry_adjustment_requests
for each row execute function public.prevent_time_entry_adjustment_request_delete();


create or replace function public.audit_time_entry_adjustment_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  audit_action text;
  audit_reason text;
begin
  if tg_op = 'INSERT' then
    actor_id := new.requester_id;
    audit_action := 'time_entry_adjustment_requested';
    audit_reason := new.request_reason;
  elsif new.status = 'approved' then
    actor_id := new.reviewed_by;
    audit_action := 'time_entry_adjustment_approved';
    audit_reason := new.decision_reason;
  elsif new.status = 'rejected' then
    actor_id := new.reviewed_by;
    audit_action := 'time_entry_adjustment_rejected';
    audit_reason := new.decision_reason;
  else
    raise exception using
      errcode = 'P0001',
      message = 'UNSUPPORTED_TIME_ENTRY_ADJUSTMENT_AUDIT_EVENT';
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
    'timekeeping',
    audit_action,
    'time_entry_adjustment_request',
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    audit_reason,
    pg_catalog.jsonb_build_object(
      'source',
      'timekeeping_adjustment_workflow',
      'time_entry_id',
      new.time_entry_id
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_time_entry_adjustment_request_change()
from public, anon, authenticated;

create trigger time_entry_adjustment_requests_audit_changes
after insert or update on public.time_entry_adjustment_requests
for each row execute function public.audit_time_entry_adjustment_request_change();


-- =========================================================
-- WRITE WORKFLOWS
-- =========================================================

create or replace function public.request_time_entry_adjustment(
  p_time_entry_id uuid,
  p_requested_check_in_at timestamptz,
  p_requested_check_in_mode text,
  p_requested_check_out_at timestamptz,
  p_requested_check_out_mode text,
  p_request_reason text
)
returns public.time_entry_adjustment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_check_in_mode text := pg_catalog.lower(
    pg_catalog.btrim(p_requested_check_in_mode)
  );
  normalized_check_out_mode text := pg_catalog.lower(
    pg_catalog.btrim(p_requested_check_out_mode)
  );
  normalized_reason text := nullif(pg_catalog.btrim(p_request_reason), '');
  target_entry public.time_entries%rowtype;
  shift_crosses_midnight boolean;
  earliest_allowed_date date;
  latest_allowed_date date;
  result_request public.time_entry_adjustment_requests%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  if p_time_entry_id is null then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ID_REQUIRED';
  end if;

  if p_requested_check_in_at is null
    or p_requested_check_out_at is null
    or normalized_check_in_mode not in ('online', 'offline')
    or normalized_check_out_mode not in ('online', 'offline')
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_VALUES_INVALID';
  end if;

  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_REASON_REQUIRED';
  end if;

  if p_requested_check_out_at < p_requested_check_in_at then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_TIME_RANGE_INVALID';
  end if;

  if p_requested_check_in_at > pg_catalog.now()
    or p_requested_check_out_at > pg_catalog.now()
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_CANNOT_USE_FUTURE_TIME';
  end if;

  select entry.*
  into target_entry
  from public.time_entries as entry
  where entry.id = p_time_entry_id
    and entry.staff_id = actor_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'TIME_ENTRY_NOT_AVAILABLE_FOR_ADJUSTMENT';
  end if;

  if target_entry.status = 'open' or target_entry.check_out_at is null then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_MUST_BE_CLOSED_FOR_ADJUSTMENT';
  end if;

  select shift.crosses_midnight
  into shift_crosses_midnight
  from public.staff_shift_assignments as assignment
  join public.work_shifts as shift
    on shift.id = assignment.work_shift_id
  where assignment.id = target_entry.staff_shift_assignment_id;

  earliest_allowed_date := target_entry.work_date;
  latest_allowed_date := target_entry.work_date + case
    when coalesce(shift_crosses_midnight, false) then 1
    else 0
  end;

  if (
    p_requested_check_in_at at time zone 'Asia/Ho_Chi_Minh'
  )::date <> earliest_allowed_date
    or (
      p_requested_check_out_at at time zone 'Asia/Ho_Chi_Minh'
    )::date < earliest_allowed_date
    or (
      p_requested_check_out_at at time zone 'Asia/Ho_Chi_Minh'
    )::date > latest_allowed_date
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_WORK_DATE_INVALID';
  end if;

  if target_entry.check_in_at = p_requested_check_in_at
    and target_entry.check_in_mode = normalized_check_in_mode
    and target_entry.check_out_at = p_requested_check_out_at
    and target_entry.check_out_mode = normalized_check_out_mode
  then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_NO_CHANGE';
  end if;

  if exists (
    select 1
    from public.time_entry_adjustment_requests as request
    where request.time_entry_id = target_entry.id
      and request.status = 'approved'
  ) then
    raise exception using
      errcode = '23505',
      message = 'TIME_ENTRY_ALREADY_HAS_APPROVED_ADJUSTMENT';
  end if;

  insert into public.time_entry_adjustment_requests (
    time_entry_id,
    requester_id,
    original_check_in_at,
    original_check_in_mode,
    original_check_out_at,
    original_check_out_mode,
    requested_check_in_at,
    requested_check_in_mode,
    requested_check_out_at,
    requested_check_out_mode,
    request_reason
  )
  values (
    target_entry.id,
    actor_id,
    target_entry.check_in_at,
    target_entry.check_in_mode,
    target_entry.check_out_at,
    target_entry.check_out_mode,
    p_requested_check_in_at,
    normalized_check_in_mode,
    p_requested_check_out_at,
    normalized_check_out_mode,
    normalized_reason
  )
  returning * into result_request;

  return result_request;
end;
$$;

revoke all on function public.request_time_entry_adjustment(
  uuid,
  timestamptz,
  text,
  timestamptz,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.request_time_entry_adjustment(
  uuid,
  timestamptz,
  text,
  timestamptz,
  text,
  text
)
to authenticated;


create or replace function public.decide_time_entry_adjustment(
  p_time_entry_adjustment_request_id uuid,
  p_decision text,
  p_decision_reason text
)
returns public.time_entry_adjustment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(p_decision));
  normalized_reason text := nullif(pg_catalog.btrim(p_decision_reason), '');
  target_request public.time_entry_adjustment_requests%rowtype;
  result_request public.time_entry_adjustment_requests%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.approve_adjustment') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED';
  end if;

  if p_time_entry_adjustment_request_id is null then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_REQUEST_ID_REQUIRED';
  end if;

  if normalized_decision not in ('approved', 'rejected') then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_DECISION_INVALID';
  end if;

  if normalized_reason is not null and pg_catalog.length(normalized_reason) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_DECISION_REASON_TOO_LONG';
  end if;

  if normalized_decision = 'rejected' and normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_REJECTION_REASON_REQUIRED';
  end if;

  select request.*
  into target_request
  from public.time_entry_adjustment_requests as request
  where request.id = p_time_entry_adjustment_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'TIME_ENTRY_ADJUSTMENT_REQUEST_NOT_FOUND';
  end if;

  if target_request.requester_id = actor_id then
    raise exception using
      errcode = '42501',
      message = 'TIME_ENTRY_ADJUSTMENT_SELF_APPROVAL_FORBIDDEN';
  end if;

  if target_request.status <> 'pending' then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_ADJUSTMENT_REQUEST_ALREADY_DECIDED';
  end if;

  update public.time_entry_adjustment_requests
  set
    status = normalized_decision,
    reviewed_by = actor_id,
    reviewed_at = pg_catalog.now(),
    decision_reason = normalized_reason,
    updated_at = pg_catalog.now()
  where id = target_request.id
  returning * into result_request;

  return result_request;
end;
$$;

revoke all on function public.decide_time_entry_adjustment(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.decide_time_entry_adjustment(uuid, text, text)
to authenticated;


-- =========================================================
-- READ MODELS
-- =========================================================

create or replace function public.get_my_timekeeping_adjustable_entries()
returns table (
  time_entry_id uuid,
  work_date date,
  check_in_at timestamptz,
  check_in_mode text,
  check_out_at timestamptz,
  check_out_mode text,
  entry_status text,
  work_shift_code text,
  work_shift_name text,
  adjustment_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  return query
  select
    entry.id,
    entry.work_date,
    entry.check_in_at,
    entry.check_in_mode,
    entry.check_out_at,
    entry.check_out_mode,
    entry.status,
    shift.code,
    shift.name,
    latest_request.status
  from public.time_entries as entry
  join public.staff_shift_assignments as assignment
    on assignment.id = entry.staff_shift_assignment_id
  join public.work_shifts as shift
    on shift.id = assignment.work_shift_id
  left join lateral (
    select request.status
    from public.time_entry_adjustment_requests as request
    where request.time_entry_id = entry.id
    order by
      case request.status
        when 'pending' then 0
        when 'approved' then 1
        else 2
      end,
      request.created_at desc
    limit 1
  ) as latest_request on true
  where entry.staff_id = auth.uid()
    and entry.status in ('checked_out', 'auto_ended')
  order by entry.work_date desc, entry.check_in_at desc;
end;
$$;

revoke all on function public.get_my_timekeeping_adjustable_entries()
from public, anon, authenticated;

grant execute on function public.get_my_timekeeping_adjustable_entries()
to authenticated;


create or replace function public.get_my_time_entry_adjustment_requests()
returns table (
  request_id uuid,
  time_entry_id uuid,
  work_date date,
  original_check_in_at timestamptz,
  original_check_in_mode text,
  original_check_out_at timestamptz,
  original_check_out_mode text,
  requested_check_in_at timestamptz,
  requested_check_in_mode text,
  requested_check_out_at timestamptz,
  requested_check_out_mode text,
  request_reason text,
  request_status text,
  reviewed_at timestamptz,
  decision_reason text,
  reviewer_display_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  return query
  select
    request.id,
    request.time_entry_id,
    entry.work_date,
    request.original_check_in_at,
    request.original_check_in_mode,
    request.original_check_out_at,
    request.original_check_out_mode,
    request.requested_check_in_at,
    request.requested_check_in_mode,
    request.requested_check_out_at,
    request.requested_check_out_mode,
    request.request_reason,
    request.status,
    request.reviewed_at,
    request.decision_reason,
    reviewer.display_name,
    request.created_at
  from public.time_entry_adjustment_requests as request
  join public.time_entries as entry
    on entry.id = request.time_entry_id
  left join public.profiles as reviewer
    on reviewer.id = request.reviewed_by
  where request.requester_id = auth.uid()
  order by request.created_at desc;
end;
$$;

revoke all on function public.get_my_time_entry_adjustment_requests()
from public, anon, authenticated;

grant execute on function public.get_my_time_entry_adjustment_requests()
to authenticated;


create or replace function public.get_time_entry_adjustment_approval_queue()
returns table (
  request_id uuid,
  time_entry_id uuid,
  requester_id uuid,
  requester_display_name text,
  requester_employee_code text,
  work_date date,
  original_check_in_at timestamptz,
  original_check_in_mode text,
  original_check_out_at timestamptz,
  original_check_out_mode text,
  requested_check_in_at timestamptz,
  requested_check_in_mode text,
  requested_check_out_at timestamptz,
  requested_check_out_mode text,
  request_reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.approve_adjustment') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED';
  end if;

  return query
  select
    request.id,
    request.time_entry_id,
    request.requester_id,
    requester.display_name,
    requester.employee_code,
    entry.work_date,
    request.original_check_in_at,
    request.original_check_in_mode,
    request.original_check_out_at,
    request.original_check_out_mode,
    request.requested_check_in_at,
    request.requested_check_in_mode,
    request.requested_check_out_at,
    request.requested_check_out_mode,
    request.request_reason,
    request.created_at
  from public.time_entry_adjustment_requests as request
  join public.time_entries as entry
    on entry.id = request.time_entry_id
  join public.profiles as requester
    on requester.id = request.requester_id
  where request.status = 'pending'
  order by request.created_at asc;
end;
$$;

revoke all on function public.get_time_entry_adjustment_approval_queue()
from public, anon, authenticated;

grant execute on function public.get_time_entry_adjustment_approval_queue()
to authenticated;


-- =========================================================
-- RLS AND GRANTS
-- =========================================================

alter table public.time_entry_adjustment_requests enable row level security;

create policy time_entry_adjustment_requests_select_own_or_approver
on public.time_entry_adjustment_requests
for select
to authenticated
using (
  requester_id = (select auth.uid())
  or public.has_permission('timekeeping.approve_adjustment')
);

revoke all privileges on table public.time_entry_adjustment_requests
from public, anon, authenticated;

grant select on table public.time_entry_adjustment_requests
to authenticated;

commit;
