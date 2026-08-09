-- Corrective migration to allow Owner/Admin self-approval for session balance import batches.
-- Removes the obsolete Four-Eyes maker-checker actor restriction from approve_session_balance_import_batch.
-- Security boundary remains strictly RBAC-guarded by permission: imports.session_balances.approve

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

  Permission required: imports.session_balances.approve (Owner / Admin role).
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
