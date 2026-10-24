begin;

-- Scoped payroll read. Since v0.39 the payslip sums "Tổng thu nhập" and
-- "Khấu trừ" from the statement's lines, and the app read every period's lines
-- by paging get_payroll_periods_with_details() under PostgREST's max_rows plus
-- get_payroll_explanations() for the snapshots. Each page re-ran the whole
-- read, and pages were separate snapshots, so a recalculation or manual line
-- between two pages could drop a line from a printed payslip.
--
-- This reader returns:
-- - one statement (p_payroll_period_id + p_payroll_statement_id: payslip page
--   and PDF),
-- - one period (p_payroll_period_id), or
-- - a list (/payroll): the latest p_period_limit periods (default 3), every
--   period still in draft or review (their actions live on /payroll), and
--   p_include_payroll_period_id when given (links to a named period), with
--   olderPeriodCount for the periods left out,
-- as a single jsonb value (max_rows never cuts it) built in one snapshot
-- (stable), with the statement totals and the lines they are summed from.
--
-- Visibility is the same as the two readers it replaces: payroll.view is
-- required; without payroll.manage / payroll.accountant_reconcile /
-- payroll.owner_approve a viewer sees only their own current-run statement and
-- only periods that contain one. Such a viewer's blocking-issue and pending
-- correction counts cover only their own issues and requests (the readers this
-- replaces counted everyone's). Earlier calculation runs are never returned; a
-- request for one reports staleStatement with the same staff member's current
-- statement in that period, if any.
create or replace function public.get_payroll_period_details(
  p_payroll_period_id uuid default null,
  p_payroll_statement_id uuid default null,
  p_period_limit integer default null,
  p_include_payroll_period_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  can_see_all boolean;
  v_period_limit integer;
  v_result jsonb;
  v_stale_statement jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.view') then
    raise exception using errcode = '42501', message = 'PAYROLL_VIEW_PERMISSION_REQUIRED';
  end if;

  if p_payroll_statement_id is not null and p_payroll_period_id is null then
    raise exception using errcode = '22023', message = 'PAYROLL_PERIOD_REQUIRED';
  end if;

  -- 60 and the default 3 below match MAX_PAYROLL_PERIOD_COUNT and
  -- RECENT_PAYROLL_PERIOD_COUNT in src/features/payroll/period-window.ts.
  if p_period_limit is not null and (p_payroll_period_id is not null or p_period_limit not between 1 and 60) then
    raise exception using errcode = '22023', message = 'PAYROLL_PERIOD_LIMIT_INVALID';
  end if;

  if p_include_payroll_period_id is not null and p_payroll_period_id is not null then
    raise exception using errcode = '22023', message = 'PAYROLL_PERIOD_INCLUDE_INVALID';
  end if;

  can_see_all := public.has_permission('payroll.manage')
    or public.has_permission('payroll.accountant_reconcile')
    or public.has_permission('payroll.owner_approve');

  -- A single period ignores the list limit.
  v_period_limit := case when p_payroll_period_id is null then coalesce(p_period_limit, 3) end;

  with visible_periods as (
    select period.*, run.revision, run.generated_at as run_generated_at
    from public.payroll_periods as period
    left join public.payroll_calculation_runs as run
      on run.id = period.current_calculation_run_id
    where (p_payroll_period_id is null or period.id = p_payroll_period_id)
      and (
        can_see_all
        or exists (
          select 1
          from public.payroll_statements as own_statement
          where own_statement.payroll_period_id = period.id
            and own_statement.calculation_run_id = period.current_calculation_run_id
            and own_statement.staff_id = actor_id
        )
      )
  ),
  newest_periods as (
    select id
    from visible_periods
    order by period_month desc
    limit v_period_limit
  ),
  selected_periods as (
    select *
    from visible_periods as period
    where period.id in (select id from newest_periods)
      or (
        p_payroll_period_id is null
        and (period.status in ('draft', 'review') or period.id = p_include_payroll_period_id)
      )
  ),
  selected_statements as (
    select statement.*
    from public.payroll_statements as statement
    join selected_periods as period
      on period.id = statement.payroll_period_id
      and period.current_calculation_run_id = statement.calculation_run_id
    where (can_see_all or statement.staff_id = actor_id)
      and (p_payroll_statement_id is null or statement.id = p_payroll_statement_id)
  ),
  -- One pass over each statement's lines: the totals and the list come from
  -- the same rows.
  statement_lines as (
    select
      statement.id as payroll_statement_id,
      coalesce(
        pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning'),
        0::numeric
      )::bigint as total_earnings_vnd,
      coalesce(
        pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'),
        0::numeric
      )::bigint as total_deductions_vnd,
      coalesce(
        pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', line.id,
          'lineType', line.line_type,
          'direction', line.direction,
          'amountVnd', line.amount_vnd,
          'unitCount', line.unit_count,
          'unitRateVnd', line.unit_rate_vnd,
          'note', line.note,
          'quantity', line.quantity,
          'unitLabel', line.unit_label,
          'policyCode', line.policy_code,
          'sourceKind', line.source_kind,
          'workMinutes', line.work_minutes,
          'formulaSnapshot', line.formula_snapshot,
          'evidenceSnapshot', line.evidence_snapshot
        ) order by line.created_at, line.id) filter (where line.id is not null),
        '[]'::jsonb
      ) as lines
    from selected_statements as statement
    left join public.payroll_line_items as line
      on line.payroll_statement_id = statement.id
    group by statement.id
  ),
  period_statements as (
    select
      statement.payroll_period_id,
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', statement.id,
        'payrollPeriodId', statement.payroll_period_id,
        'staffId', statement.staff_id,
        'staffDisplayName', statement.staff_display_name_snapshot,
        'staffEmployeeCode', statement.staff_employee_code_snapshot,
        'workUnits', statement.work_units,
        'workHours', statement.work_hours,
        'workMinutes', statement.work_minutes,
        'totalEarningsVnd', statement_line.total_earnings_vnd,
        'totalDeductionsVnd', statement_line.total_deductions_vnd,
        'payableAmountVnd', (statement_line.total_earnings_vnd - statement_line.total_deductions_vnd)::bigint,
        'lines', statement_line.lines
      ) order by statement.staff_display_name_snapshot, statement.id) as statements
    from selected_statements as statement
    join statement_lines as statement_line
      on statement_line.payroll_statement_id = statement.id
    group by statement.payroll_period_id
  ),
  period_blocking_issues as (
    select issue.calculation_run_id, pg_catalog.count(*) as blocking_issue_count
    from public.payroll_calculation_issues as issue
    join selected_periods as period
      on period.current_calculation_run_id = issue.calculation_run_id
    where issue.severity = 'blocking'
      and (can_see_all or issue.staff_id = actor_id)
    group by issue.calculation_run_id
  ),
  period_pending_requests as (
    select request.payroll_period_id, pg_catalog.count(*) as pending_correction_count
    from public.payroll_correction_requests as request
    join selected_periods as period
      on period.id = request.payroll_period_id
    where request.status = 'pending'
      and (can_see_all or request.requested_by = actor_id)
    group by request.payroll_period_id
  )
  select pg_catalog.jsonb_build_object(
    'periods', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', period.id,
        'periodMonth', period.period_month,
        'payDate', period.pay_date,
        'status', period.status,
        'currentRevision', period.revision,
        'lastCalculatedAt', period.run_generated_at,
        'feedbackOpenedAt', period.feedback_opened_at,
        'feedbackClosedAt', period.feedback_closed_at,
        'paidAt', period.paid_at,
        'paidOn', period.paid_on,
        'paymentReference', period.payment_reference,
        'blockingIssueCount', coalesce(blocking.blocking_issue_count, 0),
        'pendingCorrectionCount', coalesce(pending.pending_correction_count, 0),
        'statements', coalesce(period_statement.statements, '[]'::jsonb)
      ) order by period.period_month desc)
      from selected_periods as period
      left join period_statements as period_statement
        on period_statement.payroll_period_id = period.id
      left join period_blocking_issues as blocking
        on blocking.calculation_run_id = period.current_calculation_run_id
      left join period_pending_requests as pending
        on pending.payroll_period_id = period.id
    ), '[]'::jsonb),
    'olderPeriodCount', case
      when p_payroll_period_id is null then
        (select pg_catalog.count(*) from visible_periods) - (select pg_catalog.count(*) from selected_periods)
      else 0
    end
  )
  into v_result;

  if p_payroll_statement_id is not null then
    -- Same rule as before: a statement the viewer may see that is not a
    -- current-run statement of the requested period is stale.
    select pg_catalog.jsonb_build_object('currentStatementId', current_statement.id)
    into v_stale_statement
    from public.payroll_statements as requested
    left join public.payroll_periods as period
      on period.id = p_payroll_period_id
    left join public.payroll_statements as current_statement
      on current_statement.payroll_period_id = period.id
      and current_statement.calculation_run_id = period.current_calculation_run_id
      and current_statement.staff_id = requested.staff_id
    where requested.id = p_payroll_statement_id
      and (can_see_all or requested.staff_id = actor_id)
      and not (
        requested.payroll_period_id = p_payroll_period_id
        and requested.calculation_run_id is not distinct from period.current_calculation_run_id
      );
  end if;

  return v_result || pg_catalog.jsonb_build_object('staleStatement', v_stale_statement);
end;
$$;

revoke all on function public.get_payroll_period_details(uuid, uuid, integer, uuid) from public, anon;
grant execute on function public.get_payroll_period_details(uuid, uuid, integer, uuid) to authenticated;

commit;
