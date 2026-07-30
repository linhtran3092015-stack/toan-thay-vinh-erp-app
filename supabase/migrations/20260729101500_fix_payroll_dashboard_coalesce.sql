begin;

-- COALESCE is SQL syntax rather than a schema-qualified PostgreSQL function.
-- Keep sums as exact numeric values until the bigint RPC return cast.
create or replace function public.get_payroll_dashboard()
returns table (
  payroll_period_id uuid,
  period_month date,
  pay_date date,
  period_status text,
  staff_id uuid,
  payroll_statement_id uuid,
  staff_display_name text,
  staff_employee_code text,
  work_units integer,
  work_hours integer,
  total_earnings_vnd bigint,
  total_deductions_vnd bigint,
  payable_amount_vnd bigint
)
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

  return query
  select
    period.id,
    period.period_month,
    period.pay_date,
    period.status,
    statement.staff_id,
    statement.id,
    statement.staff_display_name_snapshot,
    statement.staff_employee_code_snapshot,
    statement.work_units,
    statement.work_hours,
    coalesce(
      pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning'),
      0::numeric
    )::bigint,
    coalesce(
      pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'),
      0::numeric
    )::bigint,
    (
      coalesce(
        pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning'),
        0::numeric
      )
      - coalesce(
        pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'),
        0::numeric
      )
    )::bigint
  from public.payroll_periods as period
  join public.payroll_statements as statement on statement.payroll_period_id = period.id
  left join public.payroll_line_items as line on line.payroll_statement_id = statement.id
  where can_see_all or statement.staff_id = actor_id
  group by
    period.id,
    period.period_month,
    period.pay_date,
    period.status,
    statement.staff_id,
    statement.id,
    statement.staff_display_name_snapshot,
    statement.staff_employee_code_snapshot,
    statement.work_units,
    statement.work_hours
  order by period.period_month desc, statement.staff_display_name_snapshot asc;
end;
$$;

revoke all on function public.get_payroll_dashboard() from public, anon;
grant execute on function public.get_payroll_dashboard() to authenticated;

commit;
