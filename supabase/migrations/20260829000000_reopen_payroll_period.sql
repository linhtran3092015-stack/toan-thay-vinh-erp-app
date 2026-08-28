begin;

-- ============================================================
-- reopen_payroll_period
-- Allows payroll.owner_approve users to revert an approved
-- payroll period back to "review" status so corrections can
-- be made before final re-approval. This bypasses the
-- protect_payroll_period_history trigger using
-- session_replication_role = replica inside a security-definer
-- function so no trigger fires for this specific UPDATE.
--
-- Guards:
--   1. Caller must be authenticated
--   2. Caller must have payroll.owner_approve permission
--   3. Period must currently be in 'approved' status
--   4. Caller must provide a non-empty reason (audit trail)
-- ============================================================

create or replace function public.reopen_payroll_period(
  p_payroll_period_id uuid,
  p_reason text
)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  updated_period public.payroll_periods%rowtype;
  normalized_reason text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.owner_approve') then
    raise exception using errcode = '42501', message = 'PAYROLL_OWNER_APPROVE_PERMISSION_REQUIRED';
  end if;

  normalized_reason := pg_catalog.btrim(p_reason);
  if normalized_reason is null or pg_catalog.length(normalized_reason) < 5 then
    raise exception using errcode = '22023', message = 'PAYROLL_REOPEN_REASON_REQUIRED';
  end if;

  -- Temporarily bypass the immutable-history trigger so we can
  -- walk back approved -> review. session_replication_role = replica
  -- suppresses per-row triggers for this transaction only.
  set local session_replication_role = replica;

  update public.payroll_periods
  set
    status      = 'review',
    approved_by = null,
    approved_at = null
  where id = p_payroll_period_id
    and status = 'approved'
  returning * into updated_period;

  -- Re-enable triggers for remainder of transaction
  set local session_replication_role = DEFAULT;

  if not found then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_APPROVED';
  end if;

  -- Write audit log so the reopen is traceable
  insert into public.audit_logs (
    module,
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  ) values (
    'payroll',
    'payroll_period_reopened',
    'payroll_period',
    p_payroll_period_id,
    actor_id,
    jsonb_build_object(
      'reason',           normalized_reason,
      'period_month',     updated_period.period_month,
      'previous_status',  'approved'
    )
  );

  return updated_period;
end;
$$;

revoke all on function public.reopen_payroll_period(uuid, text) from public, anon;
grant execute on function public.reopen_payroll_period(uuid, text) to authenticated;

commit;
