-- Keep the original Finance/SePay migration immutable after it has reached
-- staging. This forward-only replacement extends the authenticated dashboard
-- contract with the operational details required by the Orders screen.

begin;

create or replace function public.get_finance_orders_dashboard(
  p_month date,
  p_order_type text default null,
  p_source text default null,
  p_period smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month_end date;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('finance.view') then
    raise exception using errcode = '42501', message = 'FINANCE_VIEW_PERMISSION_DENIED';
  end if;

  if p_month is null
    or p_month <> pg_catalog.date_trunc('month', p_month::timestamp)::date
  then
    raise exception using errcode = '22007', message = 'INVALID_FINANCE_ORDER_MONTH';
  end if;

  if p_order_type is not null and p_order_type not in ('new_enrollment', 'renewal') then
    raise exception using errcode = '22023', message = 'INVALID_FINANCE_ORDER_TYPE';
  end if;

  if p_source is not null and p_source not in ('mma', 'sb', 'sb_f1') then
    raise exception using errcode = '22023', message = 'INVALID_FINANCE_ORDER_SOURCE';
  end if;

  if p_period is not null and p_period not in (1, 2, 3) then
    raise exception using errcode = '22023', message = 'INVALID_FINANCE_ORDER_PERIOD';
  end if;

  v_month_end := (p_month + interval '1 month')::date;

  with base_orders as materialized (
    select
      cashflow.id as source_cashflow_record_id,
      transaction.id as sepay_transaction_id,
      transaction.bank_transaction_id,
      transaction.transaction_at,
      transaction.transfer_content,
      transaction.account_purpose as order_type,
      cashflow.amount_vnd as tuition_amount_vnd,
      cashflow.reference_code,
      student.id as student_id,
      student.public_code as student_public_code,
      student.full_name as student_full_name,
      guardian.full_name as guardian_full_name,
      guardian.phone as guardian_phone,
      accrual.sale_owner_id,
      sale.display_name as sale_owner_full_name,
      accrual.lead_source_code,
      accrual.lead_source_name,
      accrual.lead_source_group,
      case
        when accrual.lead_source_group = 'mma' then 'mma'
        when accrual.lead_source_group = 'sandbox'
          and lower(coalesce(accrual.lead_source_code, '')) ~ '(^|[_-])f1([_-]|$)'
          then 'sb_f1'
        when accrual.lead_source_group = 'sandbox' then 'sb'
        else null
      end as source_code,
      case
        when accrual.lead_source_group = 'sandbox'
          and lower(coalesce(accrual.lead_source_code, '')) ~ '(^|[_-])f1([_-]|$)'
          then 'SB F1'
        when accrual.lead_source_group = 'mma' then 'MMA'
        when accrual.lead_source_group = 'sandbox' then 'SB'
        else null
      end as source_label,
      class_row.code as class_code,
      class_row.name as class_name,
      public.get_finance_order_settlement_period(transaction.transaction_at) as settlement_period,
      review.is_checked,
      review.checked_at,
      review.checked_by,
      cost.status as operating_cost_status,
      cost.mechanism_code,
      cost.operating_cost_vnd
    from public.sepay_transactions as transaction
    join public.finance_cashflow_records as cashflow
      on cashflow.sepay_transaction_id = transaction.id
      and cashflow.record_type = 'receipt'
      and cashflow.category = 'tuition_fee'
      and cashflow.student_id is not null
    join public.students as student
      on student.id = cashflow.student_id
    left join public.sales_commission_accruals as accrual
      on accrual.source_cashflow_record_id = cashflow.id
    left join public.profiles as sale
      on sale.id = accrual.sale_owner_id
    left join lateral (
      select guardian_row.full_name, guardian_row.phone
      from public.student_guardians as link
      join public.guardians as guardian_row
        on guardian_row.id = link.guardian_id
      where link.student_id = cashflow.student_id
        and link.is_primary
        and link.linked_at <= transaction.transaction_at
        and (link.ended_at is null or link.ended_at >= transaction.transaction_at)
      order by link.linked_at desc, link.id desc
      limit 1
    ) as guardian on true
    left join lateral (
      select class_value.code, class_value.name
      from public.student_enrollments as enrollment
      join public.classes as class_value
        on class_value.id = enrollment.class_id
      where enrollment.student_id = cashflow.student_id
        and enrollment.effective_from <= (transaction.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date
        and (
          enrollment.effective_to is null
          or enrollment.effective_to >= (transaction.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date
        )
      order by enrollment.effective_from desc, enrollment.id desc
      limit 1
    ) as class_row on true
    left join public.finance_order_reviews as review
      on review.source_cashflow_record_id = cashflow.id
    cross join lateral public.get_finance_order_operating_cost(
      transaction.account_purpose,
      accrual.lead_source_group,
      accrual.lead_source_code,
      cashflow.amount_vnd
    ) as cost
    where (transaction.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_month
      and (transaction.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month_end
  ), filtered_orders as materialized (
    select *
    from base_orders
    where (p_order_type is null or order_type = p_order_type)
      and (p_source is null or source_code = p_source)
      and (p_period is null or settlement_period = p_period)
  ), summary as (
    select
      pg_catalog.count(*)::integer as order_count,
      coalesce(pg_catalog.sum(tuition_amount_vnd), 0)::bigint as tuition_amount_vnd,
      coalesce(pg_catalog.sum(operating_cost_vnd) filter (where operating_cost_vnd is not null), 0)::bigint as operating_cost_vnd,
      pg_catalog.count(*) filter (where operating_cost_status = 'unconfigured')::integer as unconfigured_count,
      pg_catalog.count(*) filter (where coalesce(is_checked, false))::integer as checked_count,
      pg_catalog.count(*) filter (where not coalesce(is_checked, false))::integer as unchecked_count
    from filtered_orders
  ), settlement as (
    select
      settlement_period,
      pg_catalog.count(*) filter (where order_type = 'new_enrollment')::integer as new_enrollment_count,
      pg_catalog.count(*) filter (where order_type = 'renewal')::integer as renewal_count,
      coalesce(pg_catalog.sum(tuition_amount_vnd), 0)::bigint as tuition_amount_vnd,
      coalesce(pg_catalog.sum(operating_cost_vnd) filter (where operating_cost_vnd is not null), 0)::bigint as operating_cost_vnd,
      pg_catalog.count(*) filter (where operating_cost_status = 'unconfigured')::integer as unconfigured_count,
      pg_catalog.count(*) filter (where coalesce(is_checked, false))::integer as checked_count,
      pg_catalog.count(*) filter (where not coalesce(is_checked, false))::integer as unchecked_count
    from filtered_orders
    where source_code = 'sb'
    group by settlement_period
  )
  select pg_catalog.jsonb_build_object(
    'month', p_month,
    'summary', (
      select pg_catalog.jsonb_build_object(
        'orderCount', order_count,
        'tuitionAmountVnd', tuition_amount_vnd,
        'operatingCostVnd', operating_cost_vnd,
        'unconfiguredCount', unconfigured_count,
        'checkedCount', checked_count,
        'uncheckedCount', unchecked_count
      )
      from summary
    ),
    'settlementEligible', p_source is distinct from 'mma' and p_source is distinct from 'sb_f1',
    'settlement', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'period', settlement_period,
          'newEnrollmentCount', new_enrollment_count,
          'renewalCount', renewal_count,
          'tuitionAmountVnd', tuition_amount_vnd,
          'operatingCostVnd', operating_cost_vnd,
          'unconfiguredCount', unconfigured_count,
          'checkedCount', checked_count,
          'uncheckedCount', unchecked_count
        )
        order by settlement_period
      )
      from settlement
    ), '[]'::jsonb),
    'orders', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'sourceCashflowRecordId', source_cashflow_record_id,
          'sepayTransactionId', sepay_transaction_id,
          'bankTransactionId', bank_transaction_id,
          'transactionAt', transaction_at,
          'transferContent', transfer_content,
          'orderType', order_type,
          'tuitionAmountVnd', tuition_amount_vnd,
          'referenceCode', reference_code,
          'studentId', student_id,
          'studentPublicCode', student_public_code,
          'studentFullName', student_full_name,
          'guardianFullName', guardian_full_name,
          'guardianPhone', guardian_phone,
          'saleOwnerId', sale_owner_id,
          'saleOwnerFullName', sale_owner_full_name,
          'leadSourceCode', lead_source_code,
          'leadSourceName', lead_source_name,
          'sourceCode', source_code,
          'sourceLabel', source_label,
          'classCode', class_code,
          'className', class_name,
          'settlementPeriod', settlement_period,
          'isChecked', coalesce(is_checked, false),
          'checkedAt', checked_at,
          'checkedBy', checked_by,
          'operatingCostStatus', operating_cost_status,
          'mechanismCode', mechanism_code,
          'operatingCostVnd', operating_cost_vnd
        )
        order by transaction_at desc, source_cashflow_record_id desc
      )
      from filtered_orders
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_finance_orders_dashboard(date, text, text, smallint)
from public, anon;
grant execute on function public.get_finance_orders_dashboard(date, text, text, smallint)
to authenticated;

commit;
