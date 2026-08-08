begin;

-- =========================================================
-- TASK 5A-3 — OPENING SESSION BALANCE IMPORT FOUNDATION
-- (Revised R1: hardened idempotency, count consistency,
--  audit accuracy, post idempotency, fractional guard)
--
-- Scope:
--   * Permissions: imports.session_balances
--                  imports.session_balances.approve
--   * Batch table:  session_balance_import_batches
--   * Row table:    session_balance_import_rows
--   * RLS:          browser cannot INSERT/UPDATE/DELETE
--   * RPCs:
--       dry_run_session_balance_import_rows
--       create_session_balance_import_batch
--       reconcile_session_balance_import_batch
--       exclude_session_balance_import_row
--       approve_session_balance_import_batch
--       post_session_balance_import_batch
--
-- Invariants:
--   * delta_sessions remains integer (not changed)
--   * entry_type = 'manual_adjustment' for all posted rows
--   * annual_carryover is NEVER used here
--   * Fractional source_balance is NEVER rounded or truncated
--   * All writes are transaction-safe RPC-only
-- =========================================================


-- =========================================================
-- §2  PERMISSIONS (idempotent seed)
-- =========================================================

-- Guard: exactly one active owner role required
do $$
declare
  v_count integer;
begin
  select pg_catalog.count(*)
  into v_count
  from public.roles
  where code = 'owner'
    and is_active = true;

  if v_count <> 1 then
    raise exception
      'EXACTLY_ONE_ACTIVE_OWNER_ROLE_REQUIRED';
  end if;
end;
$$;


-- Idempotent: ON CONFLICT (code) DO NOTHING
-- Migration is safe to run even if permissions already exist.
insert into public.permissions (
  code,
  module,
  name,
  description,
  is_active
)
values
  (
    'imports.session_balances',
    'imports',
    'Import số dư buổi đầu kỳ',
    'Tải file, kiểm tra dry-run, tạo batch và đối soát import số dư buổi đầu kỳ.',
    true
  ),
  (
    'imports.session_balances.approve',
    'imports',
    'Duyệt import số dư buổi đầu kỳ',
    'Phê duyệt và post số dư buổi đầu kỳ vào sổ cái.',
    true
  )
on conflict (code) do nothing;


-- Grant both permissions to owner role only.
-- ON CONFLICT DO NOTHING: safe if grant already exists.
-- Other roles must be configured via RBAC UI.
insert into public.role_permissions (
  role_id,
  permission_id,
  granted_by
)
select
  r.id,
  p.id,
  null
from public.roles as r
cross join public.permissions as p
where r.code = 'owner'
  and r.is_active = true
  and p.code in (
    'imports.session_balances',
    'imports.session_balances.approve'
  )
on conflict (role_id, permission_id) do nothing;


-- Verify: owner must now have both grants (whether pre-existing or just inserted)
do $$
declare
  v_grant_count integer;
begin
  select pg_catalog.count(*)
  into v_grant_count
  from public.role_permissions as rp
  join public.roles as r
    on r.id = rp.role_id
  join public.permissions as p
    on p.id = rp.permission_id
  where r.code = 'owner'
    and r.is_active = true
    and p.code in (
      'imports.session_balances',
      'imports.session_balances.approve'
    )
    and p.is_active = true;

  if v_grant_count <> 2 then
    raise exception
      'OWNER_SESSION_BALANCE_IMPORT_GRANTS_NOT_PRESENT';
  end if;
end;
$$;


-- =========================================================
-- §3  BATCH TABLE
-- =========================================================

create table public.session_balance_import_batches (
  id uuid primary key
    default gen_random_uuid(),

  source_filename text not null,
  source_sha256 text not null,

  effective_on date not null,

  status text not null
    default 'draft',

  row_count integer,
  valid_count integer,
  review_count integer,
  invalid_count integer,
  no_change_count integer,
  excluded_count integer,
  posted_count integer,

  -- Mandatory reason for every batch; describes the import purpose
  reason text not null,

  created_by uuid
    references public.profiles(id)
    on delete restrict,

  created_at timestamptz not null
    default pg_catalog.now(),

  reconciled_by uuid
    references public.profiles(id)
    on delete restrict,

  reconciled_at timestamptz,

  approved_by uuid
    references public.profiles(id)
    on delete restrict,

  approved_at timestamptz,

  posted_by uuid
    references public.profiles(id)
    on delete restrict,

  posted_at timestamptz,

  metadata jsonb not null
    default '{}'::jsonb,

  constraint session_balance_import_batches_status_check
    check (
      status in (
        'draft',
        'previewed',
        'awaiting_reconciliation',
        'awaiting_approval',
        'approved',
        'posted',
        'rejected'
      )
    ),

  constraint session_balance_import_batches_source_filename_check
    check (
      source_filename = pg_catalog.btrim(source_filename)
      and source_filename <> ''
      and pg_catalog.char_length(source_filename) <= 255
    ),

  constraint session_balance_import_batches_source_sha256_check
    check (
      source_sha256 = pg_catalog.lower(source_sha256)
      and source_sha256 ~ '^[0-9a-f]{64}$'
    ),

  constraint session_balance_import_batches_reason_check
    check (
      reason = pg_catalog.btrim(reason)
      and reason <> ''
      and pg_catalog.char_length(reason) <= 2000
    ),

  constraint session_balance_import_batches_metadata_check
    check (
      pg_catalog.jsonb_typeof(metadata) = 'object'
    ),

  constraint session_balance_import_batches_counts_nonneg_check
    check (
      (row_count is null or row_count >= 0)
      and (valid_count is null or valid_count >= 0)
      and (review_count is null or review_count >= 0)
      and (invalid_count is null or invalid_count >= 0)
      and (no_change_count is null or no_change_count >= 0)
      and (excluded_count is null or excluded_count >= 0)
      and (posted_count is null or posted_count >= 0)
    ),

  constraint session_balance_import_batches_reconciled_check
    check (
      (reconciled_by is null) = (reconciled_at is null)
    ),

  constraint session_balance_import_batches_approved_check
    check (
      (approved_by is null) = (approved_at is null)
    ),

  constraint session_balance_import_batches_posted_check
    check (
      (posted_by is null) = (posted_at is null)
    )
);


create unique index
  session_balance_import_batches_sha256_uidx
on public.session_balance_import_batches (source_sha256);


create index
  session_balance_import_batches_created_at_idx
on public.session_balance_import_batches (
  created_at desc,
  id desc
);


create index
  session_balance_import_batches_status_idx
on public.session_balance_import_batches (
  status,
  created_at desc
);


-- Append-only: no hard deletes
create or replace function
  public.prevent_session_balance_import_batch_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'SESSION_BALANCE_IMPORT_BATCH_CANNOT_BE_DELETED';
  return old;
end;
$$;

revoke all on function
  public.prevent_session_balance_import_batch_delete()
from public, anon, authenticated;

create trigger
  session_balance_import_batches_prevent_delete
before delete
on public.session_balance_import_batches
for each row execute function
  public.prevent_session_balance_import_batch_delete();


-- Posted batches: business-critical fields are immutable.
-- The trigger fires BEFORE update; it checks old.status.
-- Post RPC transitions approved → posted so old.status = 'approved' (not 'posted').
-- Therefore post RPC is NOT blocked by this trigger.
create or replace function
  public.prevent_posted_session_balance_import_batch_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only block if the batch was already in 'posted' state before this update.
  -- The transition approved → posted is permitted (old.status = 'approved').
  if old.status = 'posted' then
    raise exception using
      errcode = '42501',
      message = 'SESSION_BALANCE_IMPORT_BATCH_IS_IMMUTABLE_WHEN_POSTED';
  end if;
  return new;
end;
$$;

revoke all on function
  public.prevent_posted_session_balance_import_batch_mutation()
from public, anon, authenticated;

create trigger
  session_balance_import_batches_prevent_posted_mutation
before update
on public.session_balance_import_batches
for each row execute function
  public.prevent_posted_session_balance_import_batch_mutation();


comment on table public.session_balance_import_batches
is 'Append-only batch ledger for opening session balance imports. Posted batches are immutable.';

comment on column public.session_balance_import_batches.source_sha256
is 'Lowercase SHA-256 of the source file; used as idempotency key to prevent double-import.';

comment on column public.session_balance_import_batches.effective_on
is 'The effective date applied to all ledger entries created by this batch.';

comment on column public.session_balance_import_batches.status
is 'Lifecycle: draft → previewed → awaiting_reconciliation → awaiting_approval → approved → posted (or rejected).';


-- =========================================================
-- §4  ROW TABLE
-- =========================================================

create table public.session_balance_import_rows (
  id uuid primary key
    default gen_random_uuid(),

  batch_id uuid not null
    references public.session_balance_import_batches(id)
    on delete restrict,

  source_row_number integer not null,

  student_public_code text not null,

  source_student_name text,

  -- Stored exactly as provided; NEVER rounded or truncated.
  -- Fractional values (e.g. 7.5) classify row as 'review'.
  source_balance numeric(12,1) not null,

  student_id uuid
    references public.students(id)
    on delete restrict,

  student_enrollment_id uuid
    references public.student_enrollments(id)
    on delete restrict,

  -- Only set for valid rows; null for review/invalid/no_change/excluded.
  -- Must remain integer to match ledger schema.
  delta_sessions integer,

  validation_status text not null,

  validation_code text,

  validation_message text,

  current_balance_before integer,

  expected_balance_after integer,

  ledger_entry_id uuid
    references public.student_session_ledger_entries(id)
    on delete restrict,

  excluded_reason text,

  created_at timestamptz not null
    default pg_catalog.now(),

  constraint session_balance_import_rows_unique_row_number
    unique (batch_id, source_row_number),

  constraint session_balance_import_rows_validation_status_check
    check (
      validation_status in (
        'valid',
        'review',
        'invalid',
        'no_change',
        'excluded',
        'posted'
      )
    ),

  constraint session_balance_import_rows_student_public_code_check
    check (
      student_public_code = pg_catalog.btrim(student_public_code)
      and student_public_code <> ''
    ),

  constraint session_balance_import_rows_excluded_reason_check
    check (
      excluded_reason is null
      or (
        excluded_reason = pg_catalog.btrim(excluded_reason)
        and excluded_reason <> ''
      )
    ),

  -- delta_sessions must be non-zero when set (mirrors ledger constraint)
  constraint session_balance_import_rows_delta_sessions_nonzero_check
    check (
      delta_sessions is null
      or delta_sessions <> 0
    ),

  -- excluded rows must have a reason
  constraint session_balance_import_rows_excluded_has_reason_check
    check (
      validation_status <> 'excluded'
      or excluded_reason is not null
    )
);


create index
  session_balance_import_rows_batch_idx
on public.session_balance_import_rows (
  batch_id,
  source_row_number
);


create index
  session_balance_import_rows_student_idx
on public.session_balance_import_rows (student_id)
where student_id is not null;


create index
  session_balance_import_rows_validation_status_idx
on public.session_balance_import_rows (
  batch_id,
  validation_status
);


-- Append-only: no hard deletes
create or replace function
  public.prevent_session_balance_import_row_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'SESSION_BALANCE_IMPORT_ROW_CANNOT_BE_DELETED';
  return old;
end;
$$;

revoke all on function
  public.prevent_session_balance_import_row_delete()
from public, anon, authenticated;

create trigger
  session_balance_import_rows_prevent_delete
before delete
on public.session_balance_import_rows
for each row execute function
  public.prevent_session_balance_import_row_delete();


-- Posted rows: identity and source fields are immutable.
-- Trigger checks old.validation_status.
-- Post RPC updates rows from 'valid' → 'posted', so old.validation_status = 'valid'.
-- Therefore the post RPC transition is NOT blocked by this trigger.
create or replace function
  public.prevent_posted_session_balance_import_row_source_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only block if row was already posted before this update attempt.
  -- The transition valid → posted is permitted (old.validation_status = 'valid').
  if old.validation_status = 'posted' then
    if (
      new.batch_id is distinct from old.batch_id
      or new.source_row_number is distinct from old.source_row_number
      or new.student_public_code is distinct from old.student_public_code
      or new.source_student_name is distinct from old.source_student_name
      or new.source_balance is distinct from old.source_balance
      or new.student_id is distinct from old.student_id
      or new.student_enrollment_id is distinct from old.student_enrollment_id
      or new.delta_sessions is distinct from old.delta_sessions
      or new.ledger_entry_id is distinct from old.ledger_entry_id
    ) then
      raise exception using
        errcode = '42501',
        message = 'SESSION_BALANCE_IMPORT_ROW_IDENTITY_IS_IMMUTABLE_WHEN_POSTED';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function
  public.prevent_posted_session_balance_import_row_source_mutation()
from public, anon, authenticated;

create trigger
  session_balance_import_rows_prevent_posted_mutation
before update
on public.session_balance_import_rows
for each row execute function
  public.prevent_posted_session_balance_import_row_source_mutation();


comment on table public.session_balance_import_rows
is 'One row per source spreadsheet row in a session balance import batch. source_balance is stored verbatim (never rounded). Fractional values must be reviewed manually.';

comment on column public.session_balance_import_rows.source_balance
is 'Exact numeric value from source file. NEVER rounded or truncated. Fractional values (e.g. 7.5) produce validation_status=review and are never posted.';

comment on column public.session_balance_import_rows.delta_sessions
is 'Integer ledger delta. Only populated for valid rows where source_balance is a non-zero integer. Null for review, no_change, invalid, excluded rows.';


-- =========================================================
-- §10  RLS AND PRIVILEGES
-- =========================================================

alter table public.session_balance_import_batches
  enable row level security;

alter table public.session_balance_import_rows
  enable row level security;


-- No direct browser DML — all writes go through security-definer RPCs
revoke all on table
  public.session_balance_import_batches
from public, anon, authenticated;

revoke all on table
  public.session_balance_import_rows
from public, anon, authenticated;


-- SELECT for users with either permission
grant select on table
  public.session_balance_import_batches
to authenticated;

grant select on table
  public.session_balance_import_rows
to authenticated;


create policy
  session_balance_import_batches_select_authorized
on public.session_balance_import_batches
for select
to authenticated
using (
  public.has_permission('imports.session_balances')
  or public.has_permission('imports.session_balances.approve')
);


create policy
  session_balance_import_rows_select_authorized
on public.session_balance_import_rows
for select
to authenticated
using (
  public.has_permission('imports.session_balances')
  or public.has_permission('imports.session_balances.approve')
);


-- =========================================================
-- §6  DRY-RUN RPC
-- =========================================================

create or replace function public.dry_run_session_balance_import_rows(
  p_rows jsonb,
  p_effective_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
/*
  Validates import rows without writing anything.

  NEVER writes to: students, student_enrollments,
                   student_session_ledger_entries,
                   session_balance_import_batches,
                   session_balance_import_rows.

  Classification rules (applied in order):
    Pre: student_public_code missing => invalid (STUDENT_PUBLIC_CODE_REQUIRED)
    Pre: source_balance unparseable  => invalid (SOURCE_BALANCE_INVALID)

    B. source_balance = 0
       => no_change, delta_sessions = null (no ledger entry)

    C. source_balance has fractional part (mod(balance,1) <> 0)
       => review, delta_sessions = null
       TUYỆT ĐỐI KHÔNG ROUND / TRUNCATE

    E. student_public_code matches multiple students
       => invalid (STUDENT_CODE_AMBIGUOUS)

    D. student_public_code not found
       => invalid (STUDENT_NOT_FOUND)

    F. student found but no active enrollment
       => review (NO_ACTIVE_ENROLLMENT)

    A. non-zero integer source_balance, student+enrollment found
       => valid, delta_sessions = source_balance::integer
       (cast is safe because fractional guard C already passed)

  Returns:
    {
      "summary": {
        "total": N,
        "valid": N,
        "review": N,
        "invalid": N,
        "no_change": N
      },
      "rows": [ { ... per-row result ... } ]
    }
*/
declare
  v_actor_id uuid := auth.uid();
  v_source_row jsonb;
  v_ordinality bigint;

  v_total integer := 0;
  v_valid integer := 0;
  v_review integer := 0;
  v_invalid integer := 0;
  v_no_change integer := 0;

  v_row_result jsonb;
  v_rows_out jsonb := '[]'::jsonb;

  v_source_row_number integer;
  v_student_public_code text;
  v_source_student_name text;
  v_source_balance numeric(12,1);

  v_student_id uuid;
  v_student_count integer;
  v_enrollment_id uuid;

  v_delta_sessions integer;
  v_validation_status text;
  v_validation_code text;
  v_validation_message text;
  v_current_balance_before integer;
  v_expected_balance_after integer;
begin
  -- Authentication guard
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  -- Permission guard
  if not public.has_permission('imports.session_balances') then
    raise exception using
      errcode = '42501',
      message = 'IMPORTS_SESSION_BALANCES_PERMISSION_REQUIRED';
  end if;

  -- Input validation
  if p_rows is null
    or pg_catalog.jsonb_typeof(p_rows) <> 'array'
  then
    raise exception using
      errcode = '22023',
      message = 'SESSION_BALANCE_IMPORT_ROWS_MUST_BE_ARRAY';
  end if;

  if pg_catalog.jsonb_array_length(p_rows) < 1 then
    raise exception using
      errcode = '22023',
      message = 'SESSION_BALANCE_IMPORT_ROWS_REQUIRED';
  end if;

  if pg_catalog.jsonb_array_length(p_rows) > 5000 then
    raise exception using
      errcode = '22023',
      message = 'SESSION_BALANCE_IMPORT_MAXIMUM_5000_ROWS';
  end if;

  if p_effective_on is null then
    raise exception using
      errcode = '22023',
      message = 'EFFECTIVE_ON_DATE_REQUIRED';
  end if;

  -- Process each row
  for v_source_row, v_ordinality in
    select elem.value, elem.ordinality
    from pg_catalog.jsonb_array_elements(p_rows)
      with ordinality as elem(value, ordinality)
  loop
    v_total := v_total + 1;

    -- Reset per-row state
    v_student_id             := null;
    v_enrollment_id          := null;
    v_delta_sessions         := null;
    v_validation_status      := null;
    v_validation_code        := null;
    v_validation_message     := null;
    v_current_balance_before := null;
    v_expected_balance_after := null;

    -- Extract fields
    v_source_row_number := coalesce(
      nullif(pg_catalog.btrim(v_source_row ->> 'source_row_number'), '')::integer,
      v_ordinality::integer
    );

    v_student_public_code := nullif(
      pg_catalog.btrim(coalesce(v_source_row ->> 'student_public_code', '')),
      ''
    );

    v_source_student_name := nullif(
      pg_catalog.btrim(coalesce(v_source_row ->> 'source_student_name', '')),
      ''
    );

    -- Parse source_balance verbatim; treat unparseable as null
    begin
      v_source_balance := (
        nullif(pg_catalog.btrim(coalesce(v_source_row ->> 'source_balance', '')), '')
      )::numeric(12,1);
    exception
      when others then
        v_source_balance := null;
    end;

    -- --------------------------------------------------------
    -- Classification: exactly one branch executes per row.
    -- Counters incremented exactly once.
    -- Append happens once at the bottom of the loop.
    -- Standard PL/pgSQL IF/ELSIF/ELSE -- no goto, no labels.
    -- --------------------------------------------------------

    -- Pre-check: student_public_code required
    if v_student_public_code is null then
      v_validation_status  := 'invalid';
      v_validation_code    := 'STUDENT_PUBLIC_CODE_REQUIRED';
      v_validation_message := 'Ma hoc vien (student_public_code) la bat buoc.';
      v_invalid := v_invalid + 1;

    -- Pre-check: source_balance must be parseable
    elsif v_source_balance is null then
      v_validation_status  := 'invalid';
      v_validation_code    := 'SOURCE_BALANCE_INVALID';
      v_validation_message := 'source_balance khong hop le hoac bi thieu.';
      v_invalid := v_invalid + 1;

    -- Rule B: balance = 0 => no_change (no ledger entry created)
    elsif v_source_balance = 0 then
      v_validation_status  := 'no_change';
      v_validation_code    := 'BALANCE_IS_ZERO';
      v_validation_message := 'So du bang 0, khong can tao but toan.';
      -- delta_sessions intentionally null
      v_no_change := v_no_change + 1;

    -- Rule C: fractional balance => review (NEVER ROUND OR TRUNCATE)
    -- Use mod() to detect non-integer value safely on numeric type.
    elsif pg_catalog.mod(v_source_balance, 1::numeric) <> 0 then
      v_validation_status  := 'review';
      v_validation_code    := 'BALANCE_HAS_FRACTIONAL_PART';
      v_validation_message :=
        'So du co phan thap phan (' || v_source_balance::text ||
        '). Can kiem tra lai. Khong duoc lam tron hoac cat bo.';
      -- delta_sessions intentionally null; row will NOT be posted
      v_review := v_review + 1;

    else
      -- At this point: source_balance is numeric, no fractional part, <> 0.
      -- Resolve student by public_code.
      select pg_catalog.count(*)
      into v_student_count
      from public.students as s
      where s.public_code = v_student_public_code;

      -- Rule E: ambiguous code
      if v_student_count > 1 then
        v_validation_status  := 'invalid';
        v_validation_code    := 'STUDENT_CODE_AMBIGUOUS';
        v_validation_message :=
          'Ma hoc vien ' || v_student_public_code ||
          ' khop voi nhieu hon mot hoc vien.';
        v_invalid := v_invalid + 1;

      -- Rule D: not found
      elsif v_student_count = 0 then
        v_validation_status  := 'invalid';
        v_validation_code    := 'STUDENT_NOT_FOUND';
        v_validation_message :=
          'Khong tim thay hoc vien voi ma ' || v_student_public_code || '.';
        v_invalid := v_invalid + 1;

      else
        -- Exactly one student found; fetch id
        select s.id
        into v_student_id
        from public.students as s
        where s.public_code = v_student_public_code;

        -- Fetch active enrollment (if any)
        select e.id
        into v_enrollment_id
        from public.student_enrollments as e
        where e.student_id = v_student_id
          and e.status = 'active'
          and e.effective_to is null
        limit 1;

        -- Rule F: no active enrollment => review (do NOT create enrollment)
        if v_enrollment_id is null then
          v_validation_status  := 'review';
          v_validation_code    := 'NO_ACTIVE_ENROLLMENT';
          v_validation_message :=
            'Hoc vien ' || v_student_public_code ||
            ' khong co enrollment dang active. Can kiem tra truoc khi import.';
          v_review := v_review + 1;

        else
          -- Rule A: valid -- non-zero integer-valued balance, student + enrollment found.
          -- Cast is safe: fractional guard (Rule C) has already passed above.
          v_delta_sessions := v_source_balance::integer;

          -- Fetch current ledger balance (informational only; no writes)
          select coalesce(sum(le.delta_sessions), 0)::integer
          into v_current_balance_before
          from public.student_session_ledger_entries as le
          where le.student_id = v_student_id;

          v_expected_balance_after :=
            v_current_balance_before + v_delta_sessions;

          v_validation_status  := 'valid';
          v_validation_code    := 'OK';
          v_validation_message := 'Hop le. San sang import.';
          v_valid := v_valid + 1;
        end if; -- enrollment check
      end if; -- student count check
    end if; -- top-level classification
    -- --------------------------------------------------------
    -- End classification. Append result exactly once per row.
    -- --------------------------------------------------------

    v_row_result := pg_catalog.jsonb_build_object(
      'source_row_number',      v_source_row_number,
      'student_public_code',    v_student_public_code,
      'source_student_name',    v_source_student_name,
      'source_balance',         v_source_balance,
      'student_id',             v_student_id,
      'student_enrollment_id',  v_enrollment_id,
      'delta_sessions',         v_delta_sessions,
      'validation_status',      v_validation_status,
      'validation_code',        v_validation_code,
      'validation_message',     v_validation_message,
      'current_balance_before', v_current_balance_before,
      'expected_balance_after', v_expected_balance_after
    );

    v_rows_out := v_rows_out || pg_catalog.jsonb_build_array(v_row_result);
  end loop;

  return pg_catalog.jsonb_build_object(
    'summary', pg_catalog.jsonb_build_object(
      'total',     v_total,
      'valid',     v_valid,
      'review',    v_review,
      'invalid',   v_invalid,
      'no_change', v_no_change
    ),
    'rows', v_rows_out
  );
end;
$$;

revoke all on function
  public.dry_run_session_balance_import_rows(jsonb, date)
from public, anon, authenticated;

grant execute on function
  public.dry_run_session_balance_import_rows(jsonb, date)
to authenticated;

comment on function
  public.dry_run_session_balance_import_rows(jsonb, date)
is
  'Read-only dry-run validation for opening session balance import rows. '
  'Classifies each row as valid/review/invalid/no_change. '
  'Never writes any data. Fractional source_balance values are never rounded or truncated.';


-- =========================================================
-- §7a  CREATE BATCH RPC
-- =========================================================

create or replace function public.create_session_balance_import_batch(
  p_source_filename text,
  p_source_sha256 text,
  p_effective_on date,
  p_reason text,
  p_rows jsonb
)
returns public.session_balance_import_batches
language plpgsql
security definer
set search_path = ''
as $$
/*
  Persists a validated batch and its rows.

  Steps:
    1. Authenticate + permission check
    2. Normalize + validate inputs
    3. SHA-256 idempotency guard (raises if already exists)
    4. Run dry-run inline to classify rows
    5. Insert batch (status = awaiting_reconciliation)
    6. Insert rows preserving source_balance as numeric(12,1)
    7. Audit log
    8. Return batch row

  Does NOT write to student_session_ledger_entries.
*/
declare
  v_actor_id uuid := auth.uid();
  v_normalized_filename text;
  v_normalized_sha256 text;
  v_normalized_reason text;

  v_dry_run_result jsonb;
  v_summary jsonb;
  v_row_result jsonb;
  v_row_ordinality bigint;

  v_batch public.session_balance_import_batches%rowtype;

  v_total integer := 0;
  v_valid integer := 0;
  v_review integer := 0;
  v_invalid integer := 0;
  v_no_change integer := 0;
begin
  -- Authentication
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  -- Permission
  if not public.has_permission('imports.session_balances') then
    raise exception using
      errcode = '42501',
      message = 'IMPORTS_SESSION_BALANCES_PERMISSION_REQUIRED';
  end if;

  -- Normalize inputs
  v_normalized_filename := nullif(pg_catalog.btrim(coalesce(p_source_filename, '')), '');
  v_normalized_sha256   := pg_catalog.lower(nullif(pg_catalog.btrim(coalesce(p_source_sha256, '')), ''));
  v_normalized_reason   := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');

  if v_normalized_filename is null then
    raise exception using
      errcode = '22023',
      message = 'SOURCE_FILENAME_REQUIRED';
  end if;

  if v_normalized_sha256 is null
    or v_normalized_sha256 !~ '^[0-9a-f]{64}$'
  then
    raise exception using
      errcode = '22023',
      message = 'SOURCE_SHA256_INVALID';
  end if;

  if p_effective_on is null then
    raise exception using
      errcode = '22023',
      message = 'EFFECTIVE_ON_DATE_REQUIRED';
  end if;

  if v_normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'REASON_REQUIRED';
  end if;

  if p_rows is null
    or pg_catalog.jsonb_typeof(p_rows) <> 'array'
    or pg_catalog.jsonb_array_length(p_rows) < 1
  then
    raise exception using
      errcode = '22023',
      message = 'SESSION_BALANCE_IMPORT_ROWS_REQUIRED';
  end if;

  -- SHA-256 idempotency guard: same file cannot be imported twice
  if exists (
    select 1
    from public.session_balance_import_batches as b
    where b.source_sha256 = v_normalized_sha256
  ) then
    raise exception using
      errcode = '23505',
      message = 'SESSION_BALANCE_IMPORT_BATCH_SHA256_ALREADY_EXISTS';
  end if;

  -- Run dry-run to classify rows (reads only; never writes)
  v_dry_run_result := public.dry_run_session_balance_import_rows(
    p_rows,
    p_effective_on
  );

  v_summary   := v_dry_run_result -> 'summary';
  v_total     := (v_summary ->> 'total')::integer;
  v_valid     := (v_summary ->> 'valid')::integer;
  v_review    := (v_summary ->> 'review')::integer;
  v_invalid   := (v_summary ->> 'invalid')::integer;
  v_no_change := (v_summary ->> 'no_change')::integer;

  -- Insert batch (starts awaiting_reconciliation regardless of row quality)
  insert into public.session_balance_import_batches (
    source_filename,
    source_sha256,
    effective_on,
    status,
    row_count,
    valid_count,
    review_count,
    invalid_count,
    no_change_count,
    excluded_count,
    posted_count,
    reason,
    created_by
  )
  values (
    v_normalized_filename,
    v_normalized_sha256,
    p_effective_on,
    'awaiting_reconciliation',
    v_total,
    v_valid,
    v_review,
    v_invalid,
    v_no_change,
    0,
    0,
    v_normalized_reason,
    v_actor_id
  )
  returning * into v_batch;

  -- Insert classified rows, preserving source_balance verbatim
  for v_row_result, v_row_ordinality in
    select elem.value, elem.ordinality
    from pg_catalog.jsonb_array_elements(v_dry_run_result -> 'rows')
      with ordinality as elem(value, ordinality)
  loop
    insert into public.session_balance_import_rows (
      batch_id,
      source_row_number,
      student_public_code,
      source_student_name,
      source_balance,
      student_id,
      student_enrollment_id,
      delta_sessions,
      validation_status,
      validation_code,
      validation_message,
      current_balance_before,
      expected_balance_after
    )
    values (
      v_batch.id,
      (v_row_result ->> 'source_row_number')::integer,
      v_row_result ->> 'student_public_code',
      nullif(pg_catalog.btrim(coalesce(v_row_result ->> 'source_student_name', '')), ''),
      -- source_balance stored as numeric(12,1); never rounded
      (v_row_result ->> 'source_balance')::numeric(12,1),
      nullif(v_row_result ->> 'student_id', '')::uuid,
      nullif(v_row_result ->> 'student_enrollment_id', '')::uuid,
      -- delta_sessions is null for non-valid rows (review/invalid/no_change)
      nullif(v_row_result ->> 'delta_sessions', '')::integer,
      v_row_result ->> 'validation_status',
      nullif(v_row_result ->> 'validation_code', ''),
      nullif(v_row_result ->> 'validation_message', ''),
      nullif(v_row_result ->> 'current_balance_before', '')::integer,
      nullif(v_row_result ->> 'expected_balance_after', '')::integer
    );
  end loop;

  -- Audit: create batch
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
    v_actor_id,
    'imports',
    'session_balance_import_batch_created',
    'session_balance_import_batch',
    v_batch.id::text,
    null,
    pg_catalog.to_jsonb(v_batch),
    v_normalized_reason,
    pg_catalog.jsonb_build_object(
      'source',          'authenticated_user',
      'source_filename', v_normalized_filename,
      'source_sha256',   v_normalized_sha256,
      'effective_on',    p_effective_on,
      'row_count',       v_total,
      'valid_count',     v_valid,
      'review_count',    v_review,
      'invalid_count',   v_invalid,
      'no_change_count', v_no_change
    )
  );

  return v_batch;
end;
$$;

revoke all on function
  public.create_session_balance_import_batch(text, text, date, text, jsonb)
from public, anon, authenticated;

grant execute on function
  public.create_session_balance_import_batch(text, text, date, text, jsonb)
to authenticated;

comment on function
  public.create_session_balance_import_batch(text, text, date, text, jsonb)
is
  'Creates a session balance import batch after dry-run validation. '
  'SHA-256 idempotency prevents double-import. '
  'Batch starts in status awaiting_reconciliation.';


-- =========================================================
-- §7b  EXCLUDE ROW RPC
-- =========================================================

create or replace function public.exclude_session_balance_import_row(
  p_row_id uuid,
  p_excluded_reason text
)
returns public.session_balance_import_rows
language plpgsql
security definer
set search_path = ''
as $$
/*
  Marks a review or invalid row as excluded.

  Rules:
    * Only review or invalid rows may be excluded (not valid, no_change, posted).
    * Batch must be in awaiting_reconciliation or awaiting_approval.
    * Reason is mandatory and non-empty.
    * source_balance is never modified.
    * Batch counts are updated using the CAPTURED OLD status (not post-update status).
*/
declare
  v_actor_id uuid := auth.uid();
  v_normalized_reason text;
  v_old_status text;              -- captured before update
  v_row public.session_balance_import_rows%rowtype;
  v_batch public.session_balance_import_batches%rowtype;
begin
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('imports.session_balances') then
    raise exception using
      errcode = '42501',
      message = 'IMPORTS_SESSION_BALANCES_PERMISSION_REQUIRED';
  end if;

  if p_row_id is null then
    raise exception using
      errcode = '22023',
      message = 'ROW_ID_REQUIRED';
  end if;

  v_normalized_reason := nullif(pg_catalog.btrim(coalesce(p_excluded_reason, '')), '');

  if v_normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'EXCLUDED_REASON_REQUIRED';
  end if;

  -- Lock row first; capture old status before any update
  select r.*
  into v_row
  from public.session_balance_import_rows as r
  where r.id = p_row_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SESSION_BALANCE_IMPORT_ROW_NOT_FOUND';
  end if;

  -- Only review or invalid rows may be excluded
  if v_row.validation_status not in ('review', 'invalid') then
    raise exception using
      errcode = '23514',
      message = 'ONLY_REVIEW_OR_INVALID_ROWS_MAY_BE_EXCLUDED';
  end if;

  -- Capture old status BEFORE the update for accurate count adjustment
  v_old_status := v_row.validation_status;

  -- Fetch parent batch
  select b.*
  into v_batch
  from public.session_balance_import_batches as b
  where b.id = v_row.batch_id
  for update;

  if v_batch.status not in (
    'awaiting_reconciliation',
    'awaiting_approval'
  ) then
    raise exception using
      errcode = '23514',
      message = 'BATCH_STATUS_DOES_NOT_ALLOW_ROW_EXCLUSION';
  end if;

  -- Update row: mark excluded, clear delta_sessions
  -- source_balance is intentionally NOT modified
  update public.session_balance_import_rows
  set
    validation_status = 'excluded',
    excluded_reason   = v_normalized_reason,
    delta_sessions    = null
  where id = p_row_id
  returning * into v_row;

  -- Update batch counts using CAPTURED old status (v_old_status),
  -- not v_row.validation_status (which is now 'excluded').
  update public.session_balance_import_batches
  set
    excluded_count = coalesce(excluded_count, 0) + 1,
    review_count   = case
      when v_old_status = 'review'
        then greatest(coalesce(review_count, 0) - 1, 0)
      else review_count
    end,
    invalid_count  = case
      when v_old_status = 'invalid'
        then greatest(coalesce(invalid_count, 0) - 1, 0)
      else invalid_count
    end
  where id = v_batch.id;

  -- Audit: old_data reflects actual pre-exclusion state
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
    v_actor_id,
    'imports',
    'session_balance_import_row_excluded',
    'session_balance_import_row',
    p_row_id::text,
    pg_catalog.jsonb_build_object(
      'validation_status', v_old_status,
      'excluded_reason',   null
    ),
    pg_catalog.jsonb_build_object(
      'validation_status', 'excluded',
      'excluded_reason',   v_normalized_reason
    ),
    v_normalized_reason,
    pg_catalog.jsonb_build_object(
      'source',   'authenticated_user',
      'batch_id', v_batch.id
    )
  );

  return v_row;
end;
$$;

revoke all on function
  public.exclude_session_balance_import_row(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.exclude_session_balance_import_row(uuid, text)
to authenticated;

comment on function
  public.exclude_session_balance_import_row(uuid, text)
is
  'Marks a review or invalid import row as excluded with a mandatory reason. '
  'Excluded rows are skipped during post. '
  'Only allowed while batch is in awaiting_reconciliation or awaiting_approval. '
  'source_balance is never modified. '
  'Batch counts are updated correctly using the pre-update row status.';


-- =========================================================
-- §7c  RECONCILE BATCH RPC
-- =========================================================

create or replace function public.reconcile_session_balance_import_batch(
  p_batch_id uuid,
  p_reason text
)
returns public.session_balance_import_batches
language plpgsql
security definer
set search_path = ''
as $$
/*
  Transitions batch: awaiting_reconciliation → awaiting_approval.

  Pre-conditions:
    * No unresolved invalid rows (must be excluded first)
    * No unresolved review rows (must be excluded first)
    * Reason is mandatory

  Counts verified from actual row data (not cached batch counts).
*/
declare
  v_actor_id uuid := auth.uid();
  v_normalized_reason text;
  v_batch public.session_balance_import_batches%rowtype;
  v_remaining_invalid integer;
  v_remaining_review integer;
begin
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('imports.session_balances') then
    raise exception using
      errcode = '42501',
      message = 'IMPORTS_SESSION_BALANCES_PERMISSION_REQUIRED';
  end if;

  if p_batch_id is null then
    raise exception using
      errcode = '22023',
      message = 'BATCH_ID_REQUIRED';
  end if;

  v_normalized_reason := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');

  if v_normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'RECONCILIATION_REASON_REQUIRED';
  end if;

  select b.*
  into v_batch
  from public.session_balance_import_batches as b
  where b.id = p_batch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SESSION_BALANCE_IMPORT_BATCH_NOT_FOUND';
  end if;

  if v_batch.status <> 'awaiting_reconciliation' then
    raise exception using
      errcode = '23514',
      message = 'BATCH_MUST_BE_AWAITING_RECONCILIATION';
  end if;

  -- Verify from actual row data (authoritative source of truth)
  select pg_catalog.count(*)
  into v_remaining_invalid
  from public.session_balance_import_rows as r
  where r.batch_id = p_batch_id
    and r.validation_status = 'invalid';

  if v_remaining_invalid > 0 then
    raise exception using
      errcode = '23514',
      message = 'BATCH_HAS_INVALID_ROWS_MUST_EXCLUDE_OR_FIX_BEFORE_RECONCILIATION';
  end if;

  select pg_catalog.count(*)
  into v_remaining_review
  from public.session_balance_import_rows as r
  where r.batch_id = p_batch_id
    and r.validation_status = 'review';

  if v_remaining_review > 0 then
    raise exception using
      errcode = '23514',
      message = 'BATCH_HAS_REVIEW_ROWS_MUST_EXCLUDE_OR_FIX_BEFORE_RECONCILIATION';
  end if;

  -- Transition
  update public.session_balance_import_batches
  set
    status        = 'awaiting_approval',
    reconciled_by = v_actor_id,
    reconciled_at = pg_catalog.now()
  where id = p_batch_id
  returning * into v_batch;

  -- Audit
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
    v_actor_id,
    'imports',
    'session_balance_import_batch_reconciled',
    'session_balance_import_batch',
    p_batch_id::text,
    pg_catalog.jsonb_build_object('status', 'awaiting_reconciliation'),
    pg_catalog.jsonb_build_object('status', 'awaiting_approval'),
    v_normalized_reason,
    pg_catalog.jsonb_build_object(
      'source',   'authenticated_user',
      'batch_id', p_batch_id
    )
  );

  return v_batch;
end;
$$;

revoke all on function
  public.reconcile_session_balance_import_batch(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.reconcile_session_balance_import_batch(uuid, text)
to authenticated;

comment on function
  public.reconcile_session_balance_import_batch(uuid, text)
is
  'Transitions a batch from awaiting_reconciliation to awaiting_approval. '
  'Requires all invalid and review rows to have been excluded first. '
  'Counts are verified from actual row data, not cached batch counts. '
  'Reason is mandatory.';


-- =========================================================
-- §8  APPROVE BATCH RPC
-- =========================================================

create or replace function public.approve_session_balance_import_batch(
  p_batch_id uuid
)
returns public.session_balance_import_batches
language plpgsql
security definer
set search_path = ''
as $$
/*
  Transitions batch: awaiting_approval → approved.

  Maker/checker: approved_by must differ from created_by.
  Pre-conditions:
    * No invalid rows (verified from actual row data)
    * No unexcluded review rows (verified from actual row data)
    * excluded and no_change rows are acceptable

  Does NOT write to student_session_ledger_entries.
*/
declare
  v_actor_id uuid := auth.uid();
  v_batch public.session_balance_import_batches%rowtype;
  v_remaining_invalid integer;
  v_remaining_review integer;
begin
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('imports.session_balances.approve') then
    raise exception using
      errcode = '42501',
      message = 'IMPORTS_SESSION_BALANCES_APPROVE_PERMISSION_REQUIRED';
  end if;

  if p_batch_id is null then
    raise exception using
      errcode = '22023',
      message = 'BATCH_ID_REQUIRED';
  end if;

  select b.*
  into v_batch
  from public.session_balance_import_batches as b
  where b.id = p_batch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SESSION_BALANCE_IMPORT_BATCH_NOT_FOUND';
  end if;

  if v_batch.status <> 'awaiting_approval' then
    raise exception using
      errcode = '23514',
      message = 'BATCH_MUST_BE_AWAITING_APPROVAL';
  end if;

  -- Maker/checker: four-eyes principle
  if v_batch.created_by = v_actor_id then
    raise exception using
      errcode = '23514',
      message = 'APPROVER_MUST_DIFFER_FROM_CREATOR_FOUR_EYES_PRINCIPLE_REQUIRED';
  end if;

  -- Re-validate from actual row data (not cached counts)
  select pg_catalog.count(*)
  into v_remaining_invalid
  from public.session_balance_import_rows as r
  where r.batch_id = p_batch_id
    and r.validation_status = 'invalid';

  if v_remaining_invalid > 0 then
    raise exception using
      errcode = '23514',
      message = 'BATCH_HAS_INVALID_ROWS_CANNOT_APPROVE';
  end if;

  select pg_catalog.count(*)
  into v_remaining_review
  from public.session_balance_import_rows as r
  where r.batch_id = p_batch_id
    and r.validation_status = 'review';

  if v_remaining_review > 0 then
    raise exception using
      errcode = '23514',
      message = 'BATCH_HAS_REVIEW_ROWS_CANNOT_APPROVE';
  end if;

  -- Transition
  update public.session_balance_import_batches
  set
    status      = 'approved',
    approved_by = v_actor_id,
    approved_at = pg_catalog.now()
  where id = p_batch_id
  returning * into v_batch;

  -- Audit
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
    v_actor_id,
    'imports',
    'session_balance_import_batch_approved',
    'session_balance_import_batch',
    p_batch_id::text,
    pg_catalog.jsonb_build_object('status', 'awaiting_approval'),
    pg_catalog.jsonb_build_object('status', 'approved'),
    'Batch được phê duyệt',
    pg_catalog.jsonb_build_object(
      'source',      'authenticated_user',
      'batch_id',    p_batch_id,
      'approved_by', v_actor_id
    )
  );

  return v_batch;
end;
$$;

revoke all on function
  public.approve_session_balance_import_batch(uuid)
from public, anon, authenticated;

grant execute on function
  public.approve_session_balance_import_batch(uuid)
to authenticated;

comment on function
  public.approve_session_balance_import_batch(uuid)
is
  'Transitions a batch from awaiting_approval to approved. '
  'Requires imports.session_balances.approve permission. '
  'Enforces four-eyes: approver must differ from creator. '
  'Blocks if any invalid or unexcluded review rows remain. '
  'Does NOT write ledger entries.';


-- =========================================================
-- §9  POST BATCH RPC
-- =========================================================

create or replace function public.post_session_balance_import_batch(
  p_batch_id uuid
)
returns public.session_balance_import_batches
language plpgsql
security definer
set search_path = ''
as $$
/*
  Transitions batch: approved → posted.

  For each row with validation_status = 'valid' AND delta_sessions IS NOT NULL:
    * Inserts one student_session_ledger_entries row
    * entry_type = 'manual_adjustment'  (NOT annual_carryover)
    * effective_on = batch.effective_on  (NOT current_date)
    * event_key = 'opening-session-balance:<batch_id>:<row_id>'  (deterministic)
    * ON CONFLICT (event_key) DO NOTHING  (idempotent re-run)
    * Updates row: validation_status = 'posted', ledger_entry_id = entry.id

  Skips: no_change, excluded, review, invalid rows.

  Transaction-safe: any unhandled error causes full rollback.

  Idempotency:
    * event_key unique constraint prevents duplicate ledger entries.
    * If called again after partial failure, already-posted rows
      are skipped (their validation_status is already 'posted' so
      the WHERE clause excludes them).
    * posted_count reflects only rows posted in THIS invocation.
      The batch's posted_count is SET (not incremented) to the
      total number of rows currently in 'posted' status after the loop.

  Note on trigger ordering:
    * prevent_posted_session_balance_import_batch_mutation fires BEFORE update
      and checks old.status. During post, old.status = 'approved', so no conflict.
    * prevent_posted_session_balance_import_row_source_mutation fires BEFORE update
      on rows and checks old.validation_status. During post, old.validation_status = 'valid',
      so no conflict.
*/
declare
  v_actor_id uuid := auth.uid();
  v_batch public.session_balance_import_batches%rowtype;
  v_row public.session_balance_import_rows%rowtype;
  v_ledger_entry public.student_session_ledger_entries%rowtype;
  v_event_key text;
  v_reference_code text;
  v_posted_in_this_run integer := 0;
  v_total_posted_count integer := 0;
begin
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('imports.session_balances.approve') then
    raise exception using
      errcode = '42501',
      message = 'IMPORTS_SESSION_BALANCES_APPROVE_PERMISSION_REQUIRED';
  end if;

  if p_batch_id is null then
    raise exception using
      errcode = '22023',
      message = 'BATCH_ID_REQUIRED';
  end if;

  select b.*
  into v_batch
  from public.session_balance_import_batches as b
  where b.id = p_batch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SESSION_BALANCE_IMPORT_BATCH_NOT_FOUND';
  end if;

  if v_batch.status <> 'approved' then
    raise exception using
      errcode = '23514',
      message = 'BATCH_MUST_BE_APPROVED_BEFORE_POSTING';
  end if;

  -- Deterministic reference_code per batch (first 8 chars of batch UUID)
  v_reference_code := 'OPENING-BALANCE-' || pg_catalog.substr(p_batch_id::text, 1, 8);

  -- Post each valid row (validation_status = 'valid', delta_sessions not null)
  for v_row in
    select r.*
    from public.session_balance_import_rows as r
    where r.batch_id = p_batch_id
      and r.validation_status = 'valid'
      and r.delta_sessions is not null
    order by r.source_row_number
    for update
  loop
    -- Deterministic event_key: matches ledger regex ^[a-z0-9][a-z0-9:_-]*$
    v_event_key :=
      'opening-session-balance:' ||
      p_batch_id::text || ':' ||
      v_row.id::text;

    -- Reset ledger_entry for each iteration
    v_ledger_entry.id := null;

    -- Insert ledger entry using batch's effective_on (NOT current_date)
    -- entry_type is hard-coded 'manual_adjustment' (NOT annual_carryover)
    insert into public.student_session_ledger_entries (
      student_id,
      student_enrollment_id,
      class_session_id,
      session_attendance_id,
      entry_type,
      delta_sessions,
      effective_on,
      event_key,
      reference_code,
      reverses_entry_id,
      transfer_group_id,
      unit_price_vnd,
      note,
      metadata,
      created_by
    )
    values (
      v_row.student_id,
      v_row.student_enrollment_id,
      null,                       -- no class session for opening balance
      null,                       -- no attendance for opening balance
      'manual_adjustment',        -- NOT annual_carryover
      v_row.delta_sessions,       -- integer; never rounded
      v_batch.effective_on,       -- use batch date, NOT current_date
      v_event_key,
      v_reference_code,
      null,                       -- not a reversal
      null,                       -- not a transfer
      null,                       -- no unit price for balance import
      'Số dư buổi đầu kỳ từ import dữ liệu',
      pg_catalog.jsonb_build_object(
        'source',            'opening_session_balance_import',
        'import_batch_id',   p_batch_id,
        'source_sha256',     v_batch.source_sha256,
        'source_row_number', v_row.source_row_number,
        'source_balance',    v_row.source_balance
      ),
      v_actor_id
    )
    on conflict (event_key) do nothing
    returning * into v_ledger_entry;

    -- If DO NOTHING fired (idempotent re-run), fetch existing entry
    if v_ledger_entry.id is null then
      select le.*
      into v_ledger_entry
      from public.student_session_ledger_entries as le
      where le.event_key = v_event_key;
    end if;

    -- Mark row as posted and link ledger entry
    -- Trigger prevent_posted_session_balance_import_row_source_mutation
    -- will NOT block this because old.validation_status = 'valid' here.
    update public.session_balance_import_rows
    set
      validation_status = 'posted',
      ledger_entry_id   = v_ledger_entry.id
    where id = v_row.id;

    v_posted_in_this_run := v_posted_in_this_run + 1;
  end loop;

  -- Count ALL rows now in 'posted' status for this batch.
  -- This handles idempotent re-runs correctly (previously posted rows
  -- are already 'posted', so they don't appear in the loop above,
  -- but they should still count toward posted_count).
  select pg_catalog.count(*)
  into v_total_posted_count
  from public.session_balance_import_rows as r
  where r.batch_id = p_batch_id
    and r.validation_status = 'posted';

  -- Transition batch: approved → posted
  -- Trigger prevent_posted_session_balance_import_batch_mutation
  -- will NOT block this because old.status = 'approved' here.
  update public.session_balance_import_batches
  set
    status       = 'posted',
    posted_count = v_total_posted_count,
    posted_by    = v_actor_id,
    posted_at    = pg_catalog.now()
  where id = p_batch_id
  returning * into v_batch;

  -- Audit
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
    v_actor_id,
    'imports',
    'session_balance_import_batch_posted',
    'session_balance_import_batch',
    p_batch_id::text,
    pg_catalog.jsonb_build_object('status', 'approved'),
    pg_catalog.jsonb_build_object(
      'status',       'posted',
      'posted_count', v_total_posted_count
    ),
    'Batch được post thành công',
    pg_catalog.jsonb_build_object(
      'source',              'authenticated_user',
      'batch_id',            p_batch_id,
      'posted_by',           v_actor_id,
      'posted_in_this_run',  v_posted_in_this_run,
      'total_posted_count',  v_total_posted_count,
      'entry_type',          'manual_adjustment'
    )
  );

  return v_batch;
end;
$$;

revoke all on function
  public.post_session_balance_import_batch(uuid)
from public, anon, authenticated;

grant execute on function
  public.post_session_balance_import_batch(uuid)
to authenticated;

comment on function
  public.post_session_balance_import_batch(uuid)
is
  'Posts an approved session balance import batch by creating one manual_adjustment ledger entry '
  'per valid row with a non-null delta_sessions. '
  'effective_on is taken from batch.effective_on, never from current_date. '
  'entry_type is always manual_adjustment (NOT annual_carryover). '
  'Idempotent: duplicate event_key silently skipped; '
  'posted_count reflects total rows in posted status after run. '
  'Transaction-safe: any error causes full rollback.';


commit;
