begin;

-- The Finance overview labels these figures as totals, so calculate them in
-- the database instead of summing only the most recent rows shown in the UI.
create or replace function public.get_finance_cashflow_summary()
returns table (
  receipt_vnd bigint,
  disbursement_vnd bigint,
  refund_vnd bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(
      pg_catalog.sum(cashflow.amount_vnd)
        filter (where cashflow.record_type = 'receipt'),
      0::numeric
    )::bigint as receipt_vnd,
    coalesce(
      pg_catalog.sum(cashflow.amount_vnd)
        filter (where cashflow.record_type = 'disbursement'),
      0::numeric
    )::bigint as disbursement_vnd,
    coalesce(
      pg_catalog.sum(cashflow.amount_vnd)
        filter (where cashflow.record_type = 'refund'),
      0::numeric
    )::bigint as refund_vnd
  from public.finance_cashflow_records as cashflow;
$$;

revoke all on function public.get_finance_cashflow_summary()
from public, anon;

grant execute on function public.get_finance_cashflow_summary()
to authenticated;

commit;
