begin;

-- Payroll 0: additive, read-only management detail model. The existing
-- get_payroll_dashboard() contract remains the summary reader for its current
-- consumers. A composite return type preserves the outer-join NULL states in
-- the canonical Supabase-generated TypeScript contract.
create type public.payroll_periods_with_details_row as (
  payroll_period_id uuid,
  period_month date,
  pay_date date,
  period_status text,
  payroll_statement_id uuid,
  staff_id uuid,
  staff_display_name text,
  staff_employee_code text,
  work_units integer,
  work_hours integer,
  total_earnings_vnd bigint,
  total_deductions_vnd bigint,
  payable_amount_vnd bigint,
  payroll_line_item_id uuid,
  line_type text,
  line_direction text,
  line_amount_vnd bigint,
  unit_count integer,
  unit_rate_vnd bigint,
  note text
);

create or replace function public.get_payroll_periods_with_details()
returns setof public.payroll_periods_with_details_row
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
  with visible_statements as (
    select
      statement.id,
      statement.payroll_period_id,
      statement.staff_id,
      statement.staff_display_name_snapshot,
      statement.staff_employee_code_snapshot,
      statement.work_units,
      statement.work_hours
    from public.payroll_statements as statement
    where can_see_all or statement.staff_id = actor_id
  ),
  statement_totals as (
    select
      statement.id as payroll_statement_id,
      coalesce(
        pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning'),
        0::numeric
      )::bigint as total_earnings_vnd,
      coalesce(
        pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'),
        0::numeric
      )::bigint as total_deductions_vnd
    from visible_statements as statement
    left join public.payroll_line_items as line
      on line.payroll_statement_id = statement.id
    group by statement.id
  )
  select
    period.id,
    period.period_month,
    period.pay_date,
    period.status,
    statement.id,
    statement.staff_id,
    statement.staff_display_name_snapshot,
    statement.staff_employee_code_snapshot,
    statement.work_units,
    statement.work_hours,
    statement_total.total_earnings_vnd,
    statement_total.total_deductions_vnd,
    (
      statement_total.total_earnings_vnd
      - statement_total.total_deductions_vnd
    )::bigint,
    line.id,
    line.line_type,
    line.direction,
    line.amount_vnd,
    line.unit_count,
    line.unit_rate_vnd,
    line.note
  from public.payroll_periods as period
  left join visible_statements as statement
    on statement.payroll_period_id = period.id
  left join statement_totals as statement_total
    on statement_total.payroll_statement_id = statement.id
  left join public.payroll_line_items as line
    on line.payroll_statement_id = statement.id
  where can_see_all or statement.id is not null
  order by
    period.period_month desc,
    statement.staff_display_name_snapshot asc nulls last,
    statement.id asc nulls last,
    line.created_at asc nulls last,
    line.id asc nulls last;
end;
$$;

revoke all on function public.get_payroll_periods_with_details() from public, anon;
grant execute on function public.get_payroll_periods_with_details() to authenticated;

commit;
