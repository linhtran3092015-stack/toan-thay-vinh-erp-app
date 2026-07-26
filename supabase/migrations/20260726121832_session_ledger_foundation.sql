begin;


-- =========================================================
-- TASK 5.5B
-- Immutable student session ledger foundation.
--
-- Scope:
-- - Append-only integer session ledger.
-- - Derived balance and running balance.
-- - Derived zero/negative balance alerts.
-- - Session charge and reversal integrity.
-- - Read-only browser access through RLS.
--
-- Credit lots and payment allocation are intentionally
-- deferred to Task 7 Finance/SePay.
-- =========================================================


-- =========================================================
-- STUDENT SESSION LEDGER
-- =========================================================

create table public.student_session_ledger_entries (
  id uuid primary key
    default gen_random_uuid(),

  student_id uuid not null
    references public.students(id)
    on delete restrict,

  student_enrollment_id uuid
    references public.student_enrollments(id)
    on delete restrict,

  class_session_id uuid
    references public.class_sessions(id)
    on delete restrict,

  session_attendance_id uuid
    references public.session_attendance(id)
    on delete restrict,

  entry_type text not null,

  delta_sessions integer not null,

  effective_on date not null,

  event_key text not null,

  reference_code text,

  reverses_entry_id uuid
    references public.student_session_ledger_entries(id)
    on delete restrict,

  transfer_group_id uuid,

  unit_price_vnd bigint,

  note text not null,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references public.profiles(id)
    on delete restrict,

  created_at timestamptz not null
    default pg_catalog.now(),

  constraint student_session_ledger_entry_type_check
    check (
      entry_type in (
        'payment_credit',
        'bonus_credit',
        'session_charge',
        'session_reversal',
        'manual_adjustment',
        'transfer_out',
        'transfer_in',
        'refund_debit',
        'annual_carryover'
      )
    ),

  constraint student_session_ledger_delta_check
    check (delta_sessions <> 0),

  constraint student_session_ledger_sign_check
    check (
      (
        entry_type in (
          'payment_credit',
          'bonus_credit',
          'session_reversal',
          'transfer_in',
          'annual_carryover'
        )
        and delta_sessions > 0
      )
      or
      (
        entry_type in (
          'session_charge',
          'transfer_out',
          'refund_debit'
        )
        and delta_sessions < 0
      )
      or
      entry_type = 'manual_adjustment'
    ),

  constraint student_session_ledger_session_charge_check
    check (
      entry_type <> 'session_charge'
      or (
        delta_sessions = -1
        and student_enrollment_id is not null
        and class_session_id is not null
        and session_attendance_id is not null
        and reverses_entry_id is null
      )
    ),

  constraint student_session_ledger_reversal_check
    check (
      (
        entry_type = 'session_reversal'
        and delta_sessions = 1
        and student_enrollment_id is not null
        and class_session_id is not null
        and session_attendance_id is not null
        and reverses_entry_id is not null
      )
      or
      (
        entry_type <> 'session_reversal'
        and reverses_entry_id is null
      )
    ),

  constraint student_session_ledger_attendance_reference_check
    check (
      entry_type in (
        'session_charge',
        'session_reversal'
      )
      or session_attendance_id is null
    ),

  constraint student_session_ledger_transfer_group_check
    check (
      (
        entry_type in (
          'transfer_in',
          'transfer_out'
        )
        and transfer_group_id is not null
      )
      or
      (
        entry_type not in (
          'transfer_in',
          'transfer_out'
        )
        and transfer_group_id is null
      )
    ),

  constraint student_session_ledger_reversal_self_check
    check (
      reverses_entry_id is null
      or reverses_entry_id <> id
    ),

  constraint student_session_ledger_unit_price_check
    check (
      unit_price_vnd is null
      or unit_price_vnd > 0
    ),

  constraint student_session_ledger_event_key_check
    check (
      event_key =
        pg_catalog.lower(
          pg_catalog.btrim(event_key)
        )
      and event_key <> ''
      and event_key ~
        '^[a-z0-9][a-z0-9:_-]*$'
    ),

  constraint student_session_ledger_reference_code_check
    check (
      reference_code is null
      or (
        reference_code =
          pg_catalog.btrim(reference_code)
        and reference_code <> ''
      )
    ),

  constraint student_session_ledger_note_check
    check (
      note = pg_catalog.btrim(note)
      and note <> ''
    ),

  constraint student_session_ledger_metadata_check
    check (
      pg_catalog.jsonb_typeof(metadata) =
        'object'
    ),

  constraint student_session_ledger_event_key_unique
    unique (event_key)
);


create index
  student_session_ledger_student_history_idx
on public.student_session_ledger_entries (
  student_id,
  effective_on desc,
  created_at desc,
  id desc
);


create index
  student_session_ledger_enrollment_idx
on public.student_session_ledger_entries (
  student_enrollment_id,
  created_at desc
)
where student_enrollment_id is not null;


create index
  student_session_ledger_session_idx
on public.student_session_ledger_entries (
  class_session_id,
  student_id
)
where class_session_id is not null;


create unique index
  student_session_ledger_charge_attendance_unique_idx
on public.student_session_ledger_entries (
  session_attendance_id
)
where entry_type = 'session_charge';


create unique index
  student_session_ledger_reversal_unique_idx
on public.student_session_ledger_entries (
  reverses_entry_id
)
where reverses_entry_id is not null;


create index
  student_session_ledger_transfer_group_idx
on public.student_session_ledger_entries (
  transfer_group_id
)
where transfer_group_id is not null;


-- =========================================================
-- LEDGER INSERT VALIDATION
-- =========================================================

create or replace function
  public.validate_student_session_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_attendance
    public.session_attendance%rowtype;

  target_session
    public.class_sessions%rowtype;

  reversed_entry
    public.student_session_ledger_entries%rowtype;
begin
  if new.created_by is null
    and auth.uid() is not null
  then
    new.created_by := auth.uid();
  end if;

  if new.entry_type = 'session_charge' then
    select attendance_row.*
    into target_attendance
    from public.session_attendance
      as attendance_row
    where attendance_row.id =
      new.session_attendance_id;

    if not found then
      raise exception using
        errcode = 'P0002',
        message =
          'LEDGER_ATTENDANCE_NOT_FOUND';
    end if;

    if target_attendance.student_id
      <> new.student_id
    then
      raise exception using
        errcode = '23514',
        message =
          'LEDGER_ATTENDANCE_STUDENT_MISMATCH';
    end if;

    if target_attendance.class_session_id
      <> new.class_session_id
    then
      raise exception using
        errcode = '23514',
        message =
          'LEDGER_ATTENDANCE_SESSION_MISMATCH';
    end if;

    if target_attendance.student_enrollment_id
      is distinct from
        new.student_enrollment_id
    then
      raise exception using
        errcode = '23514',
        message =
          'LEDGER_ATTENDANCE_ENROLLMENT_MISMATCH';
    end if;

    if target_attendance.attendance_status
      not in (
        'present',
        'excused_absence',
        'unexcused_absence'
      )
    then
      raise exception using
        errcode = '23514',
        message =
          'ATTENDANCE_STATUS_IS_NOT_CHARGEABLE';
    end if;

    select session_row.*
    into target_session
    from public.class_sessions
      as session_row
    where session_row.id =
      new.class_session_id;

    if not found then
      raise exception using
        errcode = 'P0002',
        message =
          'LEDGER_CLASS_SESSION_NOT_FOUND';
    end if;

    if target_session.session_kind
      not in (
        'regular',
        'makeup'
      )
    then
      raise exception using
        errcode = '23514',
        message =
          'SESSION_KIND_IS_NOT_CHARGEABLE';
    end if;

    if target_session.status <> 'completed'
      or target_session.locked_at is null
    then
      raise exception using
        errcode = '23514',
        message =
          'SESSION_CHARGE_REQUIRES_LOCKED_SESSION';
    end if;

    if new.effective_on
      <> target_session.session_date
    then
      raise exception using
        errcode = '23514',
        message =
          'SESSION_CHARGE_DATE_MISMATCH';
    end if;

  elsif new.entry_type =
    'session_reversal'
  then
    select ledger_row.*
    into reversed_entry
    from public.student_session_ledger_entries
      as ledger_row
    where ledger_row.id =
      new.reverses_entry_id
    for share;

    if not found then
      raise exception using
        errcode = 'P0002',
        message =
          'REVERSED_LEDGER_ENTRY_NOT_FOUND';
    end if;

    if reversed_entry.entry_type
      <> 'session_charge'
    then
      raise exception using
        errcode = '23514',
        message =
          'ONLY_SESSION_CHARGE_CAN_BE_REVERSED';
    end if;

    if reversed_entry.student_id
      <> new.student_id
      or reversed_entry.student_enrollment_id
        is distinct from
          new.student_enrollment_id
      or reversed_entry.class_session_id
        is distinct from
          new.class_session_id
      or reversed_entry.session_attendance_id
        is distinct from
          new.session_attendance_id
    then
      raise exception using
        errcode = '23514',
        message =
          'SESSION_REVERSAL_SOURCE_MISMATCH';
    end if;

    if new.unit_price_vnd
      is distinct from
        reversed_entry.unit_price_vnd
    then
      raise exception using
        errcode = '23514',
        message =
          'SESSION_REVERSAL_PRICE_MISMATCH';
    end if;

    if new.effective_on
      < reversed_entry.effective_on
    then
      raise exception using
        errcode = '23514',
        message =
          'SESSION_REVERSAL_DATE_INVALID';
    end if;
  end if;

  return new;
end;
$$;


revoke all on function
  public.validate_student_session_ledger_entry()
from public, anon, authenticated;


create trigger
  student_session_ledger_validate_insert
before insert
on public.student_session_ledger_entries
for each row execute function
  public.validate_student_session_ledger_entry();


-- =========================================================
-- APPEND-ONLY PROTECTION
-- =========================================================

create or replace function
  public.prevent_student_session_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message =
      'SESSION_LEDGER_IS_APPEND_ONLY';

  return old;
end;
$$;


revoke all on function
  public.prevent_student_session_ledger_mutation()
from public, anon, authenticated;


create trigger
  student_session_ledger_prevent_mutation
before update or delete
on public.student_session_ledger_entries
for each row execute function
  public.prevent_student_session_ledger_mutation();


-- =========================================================
-- LEDGER AUDIT
-- =========================================================

create or replace function
  public.audit_student_session_ledger_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid :=
    coalesce(
      new.created_by,
      auth.uid()
    );
begin
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
    'session_ledger',
    'session_ledger_entry_created',
    'student_session_ledger_entry',
    new.id::text,
    null,
    pg_catalog.to_jsonb(new),
    new.note,
    pg_catalog.jsonb_build_object(
      'source',
      case
        when actor_id is null
          then 'database'
        else 'authenticated_user'
      end,
      'student_id',
      new.student_id,
      'entry_type',
      new.entry_type,
      'delta_sessions',
      new.delta_sessions,
      'class_session_id',
      new.class_session_id,
      'event_key',
      new.event_key
    )
  );

  return new;
end;
$$;


revoke all on function
  public.audit_student_session_ledger_insert()
from public, anon, authenticated;


create trigger
  student_session_ledger_audit_insert
after insert
on public.student_session_ledger_entries
for each row execute function
  public.audit_student_session_ledger_insert();


-- =========================================================
-- READ MODELS
-- =========================================================

create view
  public.student_session_ledger_running_balances
with (
  security_invoker = true
)
as
select
  ledger.id,
  ledger.student_id,
  ledger.student_enrollment_id,
  ledger.class_session_id,
  ledger.session_attendance_id,
  ledger.entry_type,
  ledger.delta_sessions,
  ledger.effective_on,
  ledger.event_key,
  ledger.reference_code,
  ledger.reverses_entry_id,
  ledger.transfer_group_id,
  ledger.unit_price_vnd,
  ledger.note,
  ledger.metadata,
  ledger.created_by,
  ledger.created_at,

  sum(ledger.delta_sessions)
    over (
      partition by ledger.student_id
      order by
        ledger.effective_on,
        ledger.created_at,
        ledger.id
      rows between
        unbounded preceding
        and current row
    )::bigint
    as balance_after

from public.student_session_ledger_entries
  as ledger;


create view
  public.student_session_balances
with (
  security_invoker = true
)
as
select
  ledger.student_id,

  sum(
    ledger.delta_sessions
  )::bigint
    as balance_sessions,

  sum(
    case
      when ledger.delta_sessions > 0
        then ledger.delta_sessions
      else 0
    end
  )::bigint
    as total_credit_sessions,

  abs(
    sum(
      case
        when ledger.delta_sessions < 0
          then ledger.delta_sessions
        else 0
      end
    )
  )::bigint
    as total_debit_sessions,

  count(*)::bigint
    as ledger_entry_count,

  max(ledger.created_at)
    as latest_entry_at

from public.student_session_ledger_entries
  as ledger

group by ledger.student_id;


create view
  public.student_session_balance_alerts
with (
  security_invoker = true
)
as
select
  balance.student_id,

  case
    when balance.balance_sessions < 0
      then 'negative_sessions'
    else 'zero_sessions'
  end
    as alert_type,

  case
    when balance.balance_sessions < 0
      then 'danger'
    else 'warning'
  end
    as severity,

  balance.balance_sessions,

  case
    when balance.balance_sessions < 0
      then 'Học viên đang học âm buổi'
    else 'Học viên đã hết buổi'
  end
    as title,

  case
    when balance.balance_sessions < 0
      then
        'Số dư buổi hiện tại đang âm. Cần kiểm tra và nhắc tái phí.'
    else
      'Số dư buổi hiện tại bằng 0. Cần kiểm tra kế hoạch tái phí.'
  end
    as description

from public.student_session_balances
  as balance

where balance.balance_sessions <= 0;


-- =========================================================
-- RLS AND PRIVILEGES
-- =========================================================

alter table
  public.student_session_ledger_entries
enable row level security;


create policy
  student_session_ledger_select_authorized
on public.student_session_ledger_entries
for select
to authenticated
using (
  public.has_permission(
    'session_ledger.view'
  )
);


revoke all on table
  public.student_session_ledger_entries
from public, anon, authenticated;


grant select on table
  public.student_session_ledger_entries
to authenticated;


revoke all on table
  public.student_session_ledger_running_balances,
  public.student_session_balances,
  public.student_session_balance_alerts
from public, anon, authenticated;


grant select on table
  public.student_session_ledger_running_balances,
  public.student_session_balances,
  public.student_session_balance_alerts
to authenticated;


-- =========================================================
-- COMMENTS
-- =========================================================

comment on table
  public.student_session_ledger_entries
is
  'Append-only integer session ledger. Balance is always derived from ledger entries and is never stored as a mutable student column.';


comment on view
  public.student_session_ledger_running_balances
is
  'Authorized read model that calculates the balance after every immutable ledger entry.';


comment on view
  public.student_session_balances
is
  'Authorized per-student aggregate session balance derived from immutable ledger entries.';


comment on view
  public.student_session_balance_alerts
is
  'Authorized deterministic zero-session and negative-session alerts derived from the current session balance.';


commit;
