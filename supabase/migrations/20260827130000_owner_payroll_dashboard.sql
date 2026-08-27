begin;

insert into public.permissions (code, module, name, description)
values (
  'payroll.dashboard.view',
  'payroll',
  'Xem tổng quan quỹ lương',
  'Xem dashboard phân tích chi phí lương toàn trung tâm.'
)
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id, granted_by)
select role.id, permission.id, null
from public.roles as role
join public.permissions as permission on permission.code = 'payroll.dashboard.view'
where role.code = 'owner'
on conflict (role_id, permission_id) do nothing;

create or replace function public.get_owner_payroll_dashboard(
  p_selected_month date,
  p_position_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_month date := pg_catalog.date_trunc('month', p_selected_month)::date;
  range_start date;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.dashboard.view') then
    raise exception using errcode = '42501', message = 'PAYROLL_DASHBOARD_VIEW_PERMISSION_REQUIRED';
  end if;

  if p_selected_month is null or p_selected_month <> normalized_month then
    raise exception using errcode = '22023', message = 'PAYROLL_DASHBOARD_MONTH_INVALID';
  end if;

  range_start := (normalized_month - interval '5 months')::date;

  return (
    with statement_totals as (
      select
        period.period_month,
        period.status as period_status,
        statement.id as payroll_statement_id,
        statement.staff_id,
        statement.staff_display_name_snapshot,
        statement.staff_employee_code_snapshot,
        coalesce(
          pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning'),
          0::numeric
        )::bigint as total_earnings_vnd,
        coalesce(
          pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'),
          0::numeric
        )::bigint as total_deductions_vnd
      from public.payroll_periods as period
      join public.payroll_statements as statement
        on statement.payroll_period_id = period.id
        and statement.calculation_run_id = period.current_calculation_run_id
      left join public.payroll_line_items as line
        on line.payroll_statement_id = statement.id
      where period.period_month between range_start and normalized_month
      group by
        period.period_month,
        period.status,
        statement.id,
        statement.staff_id,
        statement.staff_display_name_snapshot,
        statement.staff_employee_code_snapshot
    ), positioned_statements as (
      select
        total.*,
        position.position_code,
        (total.total_earnings_vnd - total.total_deductions_vnd)::bigint as payable_amount_vnd
      from statement_totals as total
      left join lateral (
        select version.position_code
        from public.staff_payroll_position_versions as version
        where version.staff_id = total.staff_id
          and version.effective_from < (total.period_month + interval '1 month')::date
        order by version.effective_from desc, version.created_at desc, version.id desc
        limit 1
      ) as position on true
    ), filtered_statements as (
      select *
      from positioned_statements as statement
      where p_position_code is null
        or statement.position_code = p_position_code
        or (p_position_code = '__unassigned__' and statement.position_code is null)
    ), filtered_lines as (
      select
        statement.period_month,
        line.line_type,
        line.direction,
        pg_catalog.sum(line.amount_vnd)::bigint as amount_vnd
      from filtered_statements as statement
      join public.payroll_line_items as line
        on line.payroll_statement_id = statement.payroll_statement_id
      where statement.period_month in (
        normalized_month,
        (normalized_month - interval '1 month')::date
      )
      group by statement.period_month, line.line_type, line.direction
    ), used_positions as (
      select distinct position.position_code
      from public.payroll_statements as statement
      join public.payroll_periods as period
        on period.id = statement.payroll_period_id
        and statement.calculation_run_id = period.current_calculation_run_id
      left join lateral (
        select version.position_code
        from public.staff_payroll_position_versions as version
        where version.staff_id = statement.staff_id
          and version.effective_from < (period.period_month + interval '1 month')::date
        order by version.effective_from desc, version.created_at desc, version.id desc
        limit 1
      ) as position on true
    )
    select pg_catalog.jsonb_build_object(
      'selectedMonth', normalized_month,
      'selectedPositionCode', p_position_code,
      'periods', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'month', period.period_month,
          'status', period.status
        ) order by period.period_month desc)
        from public.payroll_periods as period
      ), '[]'::jsonb),
      'positionOptions', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'code', used.position_code
        ) order by used.position_code nulls last)
        from used_positions as used
      ), '[]'::jsonb),
      'statements', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'month', statement.period_month,
          'periodStatus', statement.period_status,
          'payrollStatementId', statement.payroll_statement_id,
          'staffId', statement.staff_id,
          'staffDisplayName', statement.staff_display_name_snapshot,
          'staffEmployeeCode', statement.staff_employee_code_snapshot,
          'positionCode', statement.position_code,
          'totalEarningsVnd', statement.total_earnings_vnd,
          'totalDeductionsVnd', statement.total_deductions_vnd,
          'payableAmountVnd', statement.payable_amount_vnd
        ) order by statement.period_month, statement.staff_display_name_snapshot, statement.staff_id)
        from filtered_statements as statement
      ), '[]'::jsonb),
      'composition', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'month', line.period_month,
          'lineType', line.line_type,
          'direction', line.direction,
          'amountVnd', line.amount_vnd
        ) order by line.period_month, line.direction, line.line_type)
        from filtered_lines as line
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_owner_payroll_dashboard(date, text) from public, anon;
grant execute on function public.get_owner_payroll_dashboard(date, text) to authenticated;

commit;
