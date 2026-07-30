begin;

-- A DELETE trigger has no NEW record. Keep the immutable history guard
-- explicit so delete attempts consistently return the payroll domain error.
create or replace function public.protect_payroll_period_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIODS_CANNOT_BE_DELETED';
  end if;

  if old.status = 'draft' and new.status = 'review'
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.approved_by is null
    and new.approved_at is null
  then
    return new;
  end if;

  if old.status = 'review' and new.status = 'approved'
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
  then
    return new;
  end if;

  raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_HISTORY_IS_IMMUTABLE';
end;
$$;

revoke all on function public.protect_payroll_period_history() from public, anon, authenticated;

commit;
