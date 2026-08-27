begin;

create or replace function public.get_payroll_explanations()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  can_see_all boolean;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.view') then
    raise exception using errcode = '42501', message = 'PAYROLL_VIEW_PERMISSION_REQUIRED';
  end if;
  can_see_all := public.has_permission('payroll.manage')
    or public.has_permission('payroll.accountant_reconcile')
    or public.has_permission('payroll.owner_approve');

  return pg_catalog.jsonb_build_object(
    'periods', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', period.id,
        'currentRevision', run.revision,
        'lastCalculatedAt', run.created_at,
        'feedbackOpenedAt', period.feedback_opened_at,
        'feedbackClosedAt', period.feedback_closed_at,
        'blockingIssueCount', (
          select pg_catalog.count(*) from public.payroll_calculation_issues as issue
          where issue.calculation_run_id = period.current_calculation_run_id and issue.severity = 'blocking'
        ),
        'pendingCorrectionCount', (
          select pg_catalog.count(*) from public.payroll_correction_requests as request
          where request.payroll_period_id = period.id and request.status = 'pending'
        )
      ) order by period.period_month desc)
      from public.payroll_periods as period
      join public.payroll_calculation_runs as run on run.id = period.current_calculation_run_id
      where can_see_all or exists (
        select 1 from public.payroll_statements as own_statement
        where own_statement.calculation_run_id = run.id and own_statement.staff_id = actor_id
      )
    ), '[]'::jsonb),
    'statements', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', statement.id,
        'workMinutes', statement.work_minutes
      ))
      from public.payroll_statements as statement
      join public.payroll_periods as period
        on period.current_calculation_run_id = statement.calculation_run_id
      where can_see_all or statement.staff_id = actor_id
    ), '[]'::jsonb),
    'lines', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', line.id,
        'workMinutes', line.work_minutes,
        'quantity', line.quantity,
        'unitLabel', line.unit_label,
        'policyCode', line.policy_code,
        'sourceKind', line.source_kind,
        'formulaSnapshot', line.formula_snapshot,
        'evidenceSnapshot', line.evidence_snapshot
      ) order by line.created_at, line.id)
      from public.payroll_line_items as line
      join public.payroll_statements as statement on statement.id = line.payroll_statement_id
      join public.payroll_periods as period
        on period.current_calculation_run_id = statement.calculation_run_id
      where can_see_all or statement.staff_id = actor_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_payroll_explanations() from public, anon;
grant execute on function public.get_payroll_explanations() to authenticated;

commit;
