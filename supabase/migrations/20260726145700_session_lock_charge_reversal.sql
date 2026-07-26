-- Migration: 20260726145700_session_lock_charge_reversal.sql
-- Description: Transactional lock-and-charge upgrade for lock_class_session and reverse_session_charge workflow

begin;

-- 1. Register permission for reversing session charges
insert into public.permissions (code, module, name, description)
values (
  'session_ledger.reverse',
  'session_ledger',
  'Hoàn buổi đã trừ',
  'Quyền tạo entry hoàn lại buổi học đã trừ'
)
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

-- Grant session_ledger.reverse to owner, operations_manager, assistant_manager
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where p.code = 'session_ledger.reverse'
  and r.code in ('owner', 'operations_manager', 'assistant_manager')
on conflict (role_id, permission_id) do nothing;

-- 2. Upgrade lock_class_session to execute transactional lock AND session_charge entries
create or replace function public.lock_class_session(
  p_class_session_id uuid,
  p_reason text
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_reason text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_reason, '')
      ),
      ''
    );

  target_session public.class_sessions%rowtype;
  locked_session public.class_sessions%rowtype;
  action_at timestamptz := pg_catalog.now();
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('sessions.lock') then
    raise exception using
      errcode = '42501',
      message = 'SESSION_LOCK_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SESSION_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'SESSION_LOCK_REASON_REQUIRED';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions as session_row
  where session_row.id = p_class_session_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_SESSION_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_ALREADY_LOCKED';
  end if;

  if target_session.status <> 'completed' then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  -- 2.1 Update class session to locked
  update public.class_sessions
  set
    locked_at = action_at,
    locked_by = actor_id,
    lock_reason = normalized_reason
  where id = p_class_session_id
  returning *
  into locked_session;

  -- 2.2 Create session_charge ledger entries for regular or makeup sessions
  if target_session.session_kind in ('regular', 'makeup') then
    insert into public.student_session_ledger_entries (
      student_id,
      student_enrollment_id,
      class_session_id,
      session_attendance_id,
      entry_type,
      delta_sessions,
      effective_on,
      event_key,
      unit_price_vnd,
      note,
      created_by
    )
    select
      attendance.student_id,
      attendance.student_enrollment_id,
      attendance.class_session_id,
      attendance.id,
      'session_charge',
      -1,
      target_session.session_date,
      'session-charge:' || attendance.id::text,
      null,
      'Trừ 1 buổi cho buổi học (' || target_session.session_kind || ')',
      actor_id
    from public.session_attendance as attendance
    where attendance.class_session_id = p_class_session_id
      and attendance.attendance_status in ('present', 'excused_absence', 'unexcused_absence');
  end if;

  return locked_session;
end;
$$;

revoke all on function public.lock_class_session(uuid, text) from public, anon, authenticated;
grant execute on function public.lock_class_session(uuid, text) to authenticated;

comment on function public.lock_class_session(uuid, text)
is 'Irreversibly locks a completed class session and creates session_charge ledger entries in a single transaction.';

-- 3. Create reverse_session_charge function
create or replace function public.reverse_session_charge(
  p_session_attendance_id uuid,
  p_reason text
)
returns public.student_session_ledger_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_reason text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_reason, '')
      ),
      ''
    );

  target_charge public.student_session_ledger_entries%rowtype;
  reversal_entry public.student_session_ledger_entries%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('session_ledger.reverse') then
    raise exception using
      errcode = '42501',
      message = 'SESSION_LEDGER_REVERSE_PERMISSION_DENIED';
  end if;

  if p_session_attendance_id is null then
    raise exception using
      errcode = '22023',
      message = 'SESSION_ATTENDANCE_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'SESSION_REVERSAL_REASON_REQUIRED';
  end if;

  -- Find target session_charge entry
  select charge_row.*
  into target_charge
  from public.student_session_ledger_entries as charge_row
  where charge_row.session_attendance_id = p_session_attendance_id
    and charge_row.entry_type = 'session_charge'
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SESSION_CHARGE_NOT_FOUND';
  end if;

  -- Verify charge has not already been reversed
  if exists (
    select 1
    from public.student_session_ledger_entries as existing_reversal
    where existing_reversal.reverses_entry_id = target_charge.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'SESSION_CHARGE_ALREADY_REVERSED';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  insert into public.student_session_ledger_entries (
    student_id,
    student_enrollment_id,
    class_session_id,
    session_attendance_id,
    entry_type,
    delta_sessions,
    effective_on,
    event_key,
    reverses_entry_id,
    unit_price_vnd,
    note,
    created_by
  )
  values (
    target_charge.student_id,
    target_charge.student_enrollment_id,
    target_charge.class_session_id,
    target_charge.session_attendance_id,
    'session_reversal',
    1,
    pg_catalog.current_date,
    'session-reversal:' || target_charge.id::text,
    target_charge.id,
    target_charge.unit_price_vnd,
    normalized_reason,
    actor_id
  )
  returning *
  into reversal_entry;

  return reversal_entry;
end;
$$;

revoke all on function public.reverse_session_charge(uuid, text) from public, anon, authenticated;
grant execute on function public.reverse_session_charge(uuid, text) to authenticated;

comment on function public.reverse_session_charge(uuid, text)
is 'Reverses a previously charged session attendance by creating a session_reversal ledger entry (+1).';

commit;
