-- Historical tuition belongs to the bank receipt period, not the import period.
-- Existing payroll/commission consumers use cashflow.created_at as receipt time.
-- Operator action time remains in matched_at, allocation timestamps and audit_logs.
begin;

create function public.set_sepay_historical_receipt_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_at timestamptz;
begin
  select transaction_at into v_transaction_at
  from public.sepay_transactions
  where id = new.sepay_transaction_id
    and source_payloads ? 'api_v2';

  if found then
    if v_transaction_at is null then
      raise exception 'HISTORICAL_RECEIPT_DATE_REQUIRED';
    end if;
    new.created_at := v_transaction_at;
  end if;
  return new;
end;
$$;

revoke all on function public.set_sepay_historical_receipt_date() from public, anon, authenticated;

create trigger set_sepay_historical_receipt_date
before insert on public.finance_cashflow_records
for each row
when (new.sepay_transaction_id is not null and new.record_type = 'receipt' and new.category = 'tuition_fee')
execute function public.set_sepay_historical_receipt_date();

commit;
