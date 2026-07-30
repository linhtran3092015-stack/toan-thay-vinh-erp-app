begin;

-- COALESCE is SQL syntax. Redefine all payroll writers that still used the
-- schema-qualified form before any payroll period can be created in production.
create or replace function public.audit_payroll_period_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
begin
  if tg_op = 'INSERT' then
    audit_action := 'payroll_draft_created';
  elsif new.status = 'review' then
    audit_action := 'payroll_submitted_for_review';
  elsif new.status = 'approved' then
    audit_action := 'payroll_approved';
  else
    raise exception using errcode = 'P0001', message = 'UNSUPPORTED_PAYROLL_PERIOD_AUDIT_EVENT';
  end if;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, metadata)
  values (
    coalesce(auth.uid(), new.generated_by),
    'payroll',
    audit_action,
    'payroll_period',
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object('source', 'payroll_workflow')
  );

  return new;
end;
$$;

create or replace function public.audit_payroll_line_item_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, new_data, metadata)
  values (
    coalesce(new.created_by, auth.uid()),
    'payroll',
    case when new.line_type in ('manual_reward', 'manual_deduction') then 'payroll_manual_line_added' else 'payroll_line_calculated' end,
    'payroll_line_item',
    new.id::text,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object('source', 'payroll_workflow')
  );

  return new;
end;
$$;

create or replace function public.create_payroll_draft(p_period_month date)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_month date := pg_catalog.date_trunc('month', p_period_month)::date;
  created_period public.payroll_periods%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.manage') then
    raise exception using errcode = '42501', message = 'PAYROLL_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_period_month is null or p_period_month <> normalized_month then
    raise exception using errcode = '22023', message = 'PAYROLL_PERIOD_MONTH_INVALID';
  end if;

  if normalized_month >= pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception using errcode = '22023', message = 'PAYROLL_PERIOD_NOT_CLOSED';
  end if;

  if exists (select 1 from public.payroll_periods where period_month = normalized_month) then
    raise exception using errcode = '23505', message = 'PAYROLL_PERIOD_ALREADY_EXISTS';
  end if;

  if exists (
    select 1
    from public.time_entries as entry
    where entry.work_date >= normalized_month
      and entry.work_date < (normalized_month + interval '1 month')::date
      and entry.status in ('checked_out', 'auto_ended')
      and not exists (
        select 1
        from public.staff_rate_versions as rate
        where rate.staff_id = entry.staff_id
          and rate.effective_from <= entry.work_date
      )
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_RATE_VERSION_NOT_FOUND';
  end if;

  insert into public.payroll_periods (period_month, pay_date, status, generated_by)
  values (
    normalized_month,
    (normalized_month + interval '1 month' + interval '27 days')::date,
    'draft',
    actor_id
  )
  returning * into created_period;

  with effective_entries as (
    select
      entry.id as time_entry_id,
      entry.staff_id,
      rate.id as rate_version_id,
      case
        when coalesce(adjustment.requested_check_in_mode, entry.check_in_mode) = 'online'
          then rate.online_hourly_rate_vnd
        else rate.offline_hourly_rate_vnd
      end as hourly_rate_vnd
    from public.time_entries as entry
    left join lateral (
      select request.requested_check_in_mode
      from public.time_entry_adjustment_requests as request
      where request.time_entry_id = entry.id
        and request.status = 'approved'
      order by request.reviewed_at desc
      limit 1
    ) as adjustment on true
    join lateral (
      select rate.id, rate.offline_hourly_rate_vnd, rate.online_hourly_rate_vnd
      from public.staff_rate_versions as rate
      where rate.staff_id = entry.staff_id
        and rate.effective_from <= entry.work_date
      order by rate.effective_from desc
      limit 1
    ) as rate on true
    where entry.work_date >= normalized_month
      and entry.work_date < (normalized_month + interval '1 month')::date
      and entry.status in ('checked_out', 'auto_ended')
  )
  insert into public.payroll_statements (
    payroll_period_id,
    staff_id,
    staff_display_name_snapshot,
    staff_employee_code_snapshot,
    work_units,
    work_hours
  )
  select
    created_period.id,
    entry.staff_id,
    coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), profile.email),
    profile.employee_code,
    pg_catalog.count(*)::integer,
    (pg_catalog.count(*) * 9)::integer
  from effective_entries as entry
  join public.profiles as profile on profile.id = entry.staff_id
  group by entry.staff_id, profile.display_name, profile.email, profile.employee_code;

  with effective_entries as (
    select
      entry.id as time_entry_id,
      entry.staff_id,
      rate.id as rate_version_id,
      case
        when coalesce(adjustment.requested_check_in_mode, entry.check_in_mode) = 'online'
          then rate.online_hourly_rate_vnd
        else rate.offline_hourly_rate_vnd
      end as hourly_rate_vnd
    from public.time_entries as entry
    left join lateral (
      select request.requested_check_in_mode
      from public.time_entry_adjustment_requests as request
      where request.time_entry_id = entry.id
        and request.status = 'approved'
      order by request.reviewed_at desc
      limit 1
    ) as adjustment on true
    join lateral (
      select rate.id, rate.offline_hourly_rate_vnd, rate.online_hourly_rate_vnd
      from public.staff_rate_versions as rate
      where rate.staff_id = entry.staff_id
        and rate.effective_from <= entry.work_date
      order by rate.effective_from desc
      limit 1
    ) as rate on true
    where entry.work_date >= normalized_month
      and entry.work_date < (normalized_month + interval '1 month')::date
      and entry.status in ('checked_out', 'auto_ended')
  )
  insert into public.payroll_line_items (
    payroll_statement_id,
    line_type,
    direction,
    amount_vnd,
    unit_count,
    unit_rate_vnd,
    source_time_entry_id,
    staff_rate_version_id,
    note,
    created_by
  )
  select
    statement.id,
    'hourly_wage',
    'earning',
    entry.hourly_rate_vnd * 9,
    9,
    entry.hourly_rate_vnd,
    entry.time_entry_id,
    entry.rate_version_id,
    '1 công × 9 giờ',
    actor_id
  from effective_entries as entry
  join public.payroll_statements as statement
    on statement.payroll_period_id = created_period.id
    and statement.staff_id = entry.staff_id;

  return created_period;
end;
$$;

revoke all on function public.audit_payroll_period_change() from public, anon, authenticated;
revoke all on function public.audit_payroll_line_item_insert() from public, anon, authenticated;
revoke all on function public.create_payroll_draft(date) from public, anon;
grant execute on function public.create_payroll_draft(date) to authenticated;

commit;
