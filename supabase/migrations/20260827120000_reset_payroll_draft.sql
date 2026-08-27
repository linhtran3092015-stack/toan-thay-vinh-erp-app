begin;

-- A reset briefly clears the current-run pointer inside one transaction so the
-- existing engine cannot carry manual lines forward. Do not persist that
-- transaction-internal state; record the following null-to-run transition as
-- one explicit reset event instead.
create or replace function public.audit_payroll_period_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  audit_metadata jsonb := pg_catalog.jsonb_build_object('source', 'payroll_workflow');
  previous_run_id uuid;
  new_revision integer;
begin
  if tg_op = 'UPDATE'
    and old.status = 'draft'
    and new.status = 'draft'
    and old.current_calculation_run_id is not null
    and new.current_calculation_run_id is null
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    audit_action := 'payroll_draft_created';
  elsif old.status = 'draft' and new.status = 'review' then
    audit_action := 'payroll_submitted_for_review';
  elsif old.status = 'review' and new.status = 'approved' then
    audit_action := 'payroll_approved';
  elsif old.status = 'draft'
    and new.status = 'draft'
    and old.current_calculation_run_id is null
    and new.current_calculation_run_id is not null
  then
    select run.revision into new_revision
    from public.payroll_calculation_runs as run
    where run.id = new.current_calculation_run_id;

    if new_revision > 1 then
      audit_action := 'payroll_draft_reset';
      select run.id into previous_run_id
      from public.payroll_calculation_runs as run
      where run.payroll_period_id = new.id
        and run.status = 'superseded'
        and run.id <> new.current_calculation_run_id
      order by run.revision desc
      limit 1;
      audit_metadata := audit_metadata || pg_catalog.jsonb_build_object(
        'previous_calculation_run_id', previous_run_id,
        'new_calculation_run_id', new.current_calculation_run_id
      );
    else
      audit_action := 'payroll_calculation_revised';
    end if;
  elsif old.status = 'draft'
    and new.status = 'draft'
    and new.current_calculation_run_id is distinct from old.current_calculation_run_id
  then
    audit_action := 'payroll_calculation_revised';
  elsif old.status = 'draft'
    and new.status = 'draft'
    and new.feedback_closed_at is distinct from old.feedback_closed_at
  then
    audit_action := 'payroll_feedback_closed';
  else
    raise exception using errcode = 'P0001', message = 'UNSUPPORTED_PAYROLL_PERIOD_AUDIT_EVENT';
  end if;

  insert into public.audit_logs (
    actor_user_id, module, action, entity_type, entity_id, old_data, new_data, metadata
  ) values (
    coalesce(auth.uid(), new.generated_by),
    'payroll',
    audit_action,
    'payroll_period',
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    audit_metadata
  );

  return new;
end;
$$;

revoke all on function public.audit_payroll_period_change() from public, anon, authenticated;

-- Replace the active draft calculation with a clean revision while retaining
-- every previous revision for audit. The temporary null pointer prevents the
-- calculation engine from carrying manual reward/deduction lines forward.
create or replace function public.reset_payroll_draft(
  p_payroll_period_id uuid,
  p_expected_revision integer,
  p_reason text,
  p_confirmation text
)
returns public.payroll_calculation_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  normalized_confirmation text := pg_catalog.upper(pg_catalog.btrim(p_confirmation));
  target_period public.payroll_periods%rowtype;
  previous_run_id uuid;
  current_revision integer;
  expected_confirmation text;
  created_run public.payroll_calculation_runs%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.manage') then
    raise exception using errcode = '42501', message = 'PAYROLL_MANAGE_PERMISSION_REQUIRED';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'PAYROLL_RESET_REASON_REQUIRED';
  end if;

  select * into target_period
  from public.payroll_periods
  where id = p_payroll_period_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_PERIOD_NOT_FOUND';
  end if;
  if target_period.status <> 'draft' then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_DRAFT';
  end if;
  if target_period.current_calculation_run_id is null then
    raise exception using errcode = '23514', message = 'PAYROLL_CURRENT_CALCULATION_RUN_REQUIRED';
  end if;

  select run.revision into current_revision
  from public.payroll_calculation_runs as run
  where run.id = target_period.current_calculation_run_id;

  if p_expected_revision is null or current_revision is distinct from p_expected_revision then
    raise exception using errcode = '40001', message = 'PAYROLL_RESET_STALE_REVISION';
  end if;
  if exists (
    select 1 from public.payroll_correction_requests
    where payroll_period_id = target_period.id and status = 'pending'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_CORRECTION_REQUESTS_PENDING';
  end if;

  expected_confirmation := 'DAT LAI ' || pg_catalog.to_char(target_period.period_month, 'MM/YYYY');
  if normalized_confirmation is distinct from expected_confirmation then
    raise exception using errcode = '22023', message = 'PAYROLL_RESET_CONFIRMATION_INVALID';
  end if;

  previous_run_id := target_period.current_calculation_run_id;

  update public.payroll_calculation_runs
  set status = 'superseded'
  where id = previous_run_id and status = 'current';

  if not found then
    raise exception using errcode = '23514', message = 'PAYROLL_CURRENT_CALCULATION_RUN_INVALID';
  end if;

  update public.payroll_periods
  set
    current_calculation_run_id = null,
    feedback_opened_at = pg_catalog.now(),
    feedback_closed_at = null,
    feedback_closed_by = null
  where id = target_period.id;

  created_run := public.generate_payroll_calculation_run(
    target_period.id,
    normalized_reason
  );

  return created_run;
end;
$$;

revoke all on function public.reset_payroll_draft(uuid, integer, text, text) from public, anon;
grant execute on function public.reset_payroll_draft(uuid, integer, text, text) to authenticated;

commit;
