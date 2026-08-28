begin;

-- 1. Allow system migrations to seed initial mappings when profiles table is empty
alter table public.payroll_lead_source_mapping_versions
  alter column created_by drop not null;

-- 2. Insert lead source mapping for referral_teacher -> teacher_vinh_zalo_direct_referral
insert into public.payroll_lead_source_mapping_versions (
  lead_source_id,
  payroll_source_code,
  effective_from,
  reason,
  created_by
)
select
  source.id,
  'teacher_vinh_zalo_direct_referral',
  '2025-07-01'::date,
  'Ánh xạ nguồn giới thiệu từ giáo viên sang mã nguồn lương teacher_vinh_zalo_direct_referral.',
  (select id from public.profiles order by created_at limit 1)
from public.crm_lead_sources as source
where source.code = 'referral_teacher'
  and not exists (
    select 1
    from public.payroll_lead_source_mapping_versions as mapping
    where mapping.lead_source_id = source.id
      and mapping.effective_from = '2025-07-01'::date
  );

-- 3. Update/insert operations_new_enrollment policy version to include all 7 valid source codes in fixed_by_source
insert into public.payroll_policy_versions (
  policy_code,
  effective_from,
  parameters,
  reason,
  created_by
)
select
  'operations_new_enrollment',
  '2026-01-01'::date,
  jsonb_build_object(
    'revenue_rate_basis_points', 500,
    'fixed_by_source', jsonb_build_object(
      'survey', 500000,
      'school_telesales_ads', 200000,
      'organic_direct', 100000,
      'referral_internal_upsell', 50000,
      'math_to_english', 100000,
      'teacher_vinh_zalo_direct_referral', 50000,
      'self_sourced', 500000
    )
  ),
  'Bổ sung mã nguồn tuyển mới teacher_vinh_zalo_direct_referral và self_sourced cho khối vận hành.',
  (select id from public.profiles order by created_at limit 1)
where not exists (
  select 1
  from public.payroll_policy_versions as policy
  where policy.policy_code = 'operations_new_enrollment'
    and policy.effective_from = '2026-01-01'::date
);

-- 4. Upgrade sync_payroll_order_facts to ensure correct dynamic lookup during facts sync
create or replace function public.sync_payroll_order_facts(p_period_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  inserted_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.manage') then
    raise exception using errcode = '42501', message = 'PAYROLL_MANAGE_PERMISSION_REQUIRED';
  end if;
  if p_period_month is null or p_period_month <> pg_catalog.date_trunc('month', p_period_month)::date then
    raise exception using errcode = '22023', message = 'PAYROLL_PERIOD_MONTH_INVALID';
  end if;

  insert into public.payroll_source_facts (
    fact_type,
    source_key,
    source_origin,
    event_date,
    staff_id,
    student_id,
    grade,
    amount_vnd,
    quantity,
    source_code,
    metadata,
    approved_by,
    approved_at
  )
  select
    case transaction.account_purpose
      when 'renewal' then 'renewal_order'
      when 'new_enrollment' then 'new_enrollment_order'
    end,
    cashflow.id::text,
    'system',
    (cashflow.created_at at time zone 'Asia/Ho_Chi_Minh')::date,
    case
      when transaction.account_purpose = 'new_enrollment' then accrual.sale_owner_id
      else grade_assignment.staff_id
    end,
    cashflow.student_id,
    case when coalesce(class_at_order.grade, student.current_grade) between 2 and 12
      then coalesce(class_at_order.grade, student.current_grade)
      else null
    end,
    cashflow.amount_vnd,
    1,
    source_mapping.payroll_source_code,
    pg_catalog.jsonb_build_object(
      'cashflow_record_id', cashflow.id,
      'sepay_transaction_id', transaction.id,
      'sale_owner_id', accrual.sale_owner_id,
      'lead_source_code', accrual.lead_source_code,
      'lead_source_name', accrual.lead_source_name,
      'account_purpose', transaction.account_purpose,
      'grade_assignment_id', grade_assignment.id
    ),
    null,
    null
  from public.sepay_transactions as transaction
  join public.finance_cashflow_records as cashflow
    on cashflow.sepay_transaction_id = transaction.id
    and cashflow.record_type = 'receipt'
    and cashflow.category = 'tuition_fee'
    and cashflow.student_id is not null
  join public.students as student on student.id = cashflow.student_id
  left join public.sales_commission_accruals as accrual
    on accrual.source_cashflow_record_id = cashflow.id
  left join public.crm_cases as crm_case on crm_case.id = accrual.crm_case_id
  left join lateral (
    select class_row.grade
    from public.student_enrollments as enrollment
    join public.classes as class_row on class_row.id = enrollment.class_id
    where enrollment.student_id = cashflow.student_id
      and enrollment.effective_from <= (cashflow.created_at at time zone 'Asia/Ho_Chi_Minh')::date
      and (enrollment.effective_to is null or enrollment.effective_to >= (cashflow.created_at at time zone 'Asia/Ho_Chi_Minh')::date)
    order by enrollment.effective_from desc, enrollment.id desc
    limit 1
  ) as class_at_order on true
  left join lateral (
    select assignment.id, assignment.staff_id
    from public.staff_grade_assignments as assignment
    where assignment.grade = coalesce(class_at_order.grade, student.current_grade)
      and assignment.effective_from <= (cashflow.created_at at time zone 'Asia/Ho_Chi_Minh')::date
      and (assignment.effective_to is null or assignment.effective_to >= (cashflow.created_at at time zone 'Asia/Ho_Chi_Minh')::date)
    order by assignment.effective_from desc, assignment.id desc
    limit 1
  ) as grade_assignment on true
  left join lateral (
    select mapping.payroll_source_code
    from public.payroll_lead_source_mapping_versions as mapping
    where mapping.lead_source_id = crm_case.lead_source_id
      and mapping.effective_from <= (cashflow.created_at at time zone 'Asia/Ho_Chi_Minh')::date
    order by mapping.effective_from desc
    limit 1
  ) as source_mapping on true
  where transaction.account_purpose in ('new_enrollment', 'renewal')
    and (cashflow.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p_period_month
    and (cashflow.created_at at time zone 'Asia/Ho_Chi_Minh')::date < (p_period_month + interval '1 month')::date
  on conflict (fact_type, source_key) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- 5. Replace generate_payroll_calculation_run with dynamic assignment & source resolution
create or replace function public.generate_payroll_calculation_run(
  p_payroll_period_id uuid,
  p_reason text
)
returns public.payroll_calculation_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  target_period public.payroll_periods%rowtype;
  previous_run_id uuid;
  created_run public.payroll_calculation_runs%rowtype;
  month_end date;
  next_revision integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.manage') then
    raise exception using errcode = '42501', message = 'PAYROLL_MANAGE_PERMISSION_REQUIRED';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'PAYROLL_CALCULATION_REASON_REQUIRED';
  end if;

  select * into target_period
  from public.payroll_periods
  where id = p_payroll_period_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_PERIOD_NOT_FOUND';
  end if;
  if target_period.status <> 'draft' then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_DRAFT';
  end if;
  if exists (
    select 1 from public.payroll_correction_requests
    where payroll_period_id = target_period.id and status = 'pending'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_CORRECTION_REQUESTS_PENDING';
  end if;

  month_end := (target_period.period_month + interval '1 month' - interval '1 day')::date;
  perform public.sync_payroll_order_facts(target_period.period_month);

  previous_run_id := target_period.current_calculation_run_id;
  select coalesce(pg_catalog.max(revision), 0) + 1
  into next_revision
  from public.payroll_calculation_runs
  where payroll_period_id = target_period.id;

  if previous_run_id is not null then
    update public.payroll_calculation_runs set status = 'superseded' where id = previous_run_id;
  end if;

  insert into public.payroll_calculation_runs (
    payroll_period_id, revision, status, reason, generated_by
  ) values (
    target_period.id, next_revision, 'current', normalized_reason, actor_id
  ) returning * into created_run;

  -- Time entries without a configured payroll position are visible blockers.
  insert into public.payroll_calculation_issues (
    calculation_run_id, issue_code, staff_id, details
  )
  select distinct
    created_run.id,
    'missing_payroll_position',
    entry.staff_id,
    pg_catalog.jsonb_build_object('work_date', entry.work_date)
  from public.time_entries as entry
  where entry.work_date >= target_period.period_month
    and entry.work_date < (target_period.period_month + interval '1 month')::date
    and entry.status in ('checked_out', 'auto_ended')
    and not exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = entry.staff_id and position.effective_from <= entry.work_date
    );

  insert into public.payroll_calculation_issues (
    calculation_run_id, issue_code, staff_id, source_fact_id, details
  )
  select created_run.id, 'missing_payroll_position', fact.staff_id, fact.id,
    pg_catalog.jsonb_build_object('work_date', fact.event_date, 'source', 'excel')
  from public.payroll_source_facts as fact
  where fact.fact_type = 'timekeeping'
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and fact.staff_id is not null
    and not exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = fact.staff_id and position.effective_from <= fact.event_date
    );

  -- Every configured payroll position gets a statement, even with zero work minutes.
  with effective_positions as (
    select distinct on (position.staff_id)
      position.staff_id,
      position.position_code
    from public.staff_payroll_position_versions as position
    where position.effective_from <= month_end
    order by position.staff_id, position.effective_from desc
  ), effective_entries as (
    select
      entry.staff_id,
      greatest(
        0,
        pg_catalog.floor(
          extract(epoch from (
            coalesce(adjustment.requested_check_out_at, entry.check_out_at)
            - coalesce(adjustment.requested_check_in_at, entry.check_in_at)
          )) / 60
        )::integer
      ) as worked_minutes
    from public.time_entries as entry
    left join lateral (
      select request.requested_check_in_at, request.requested_check_out_at
      from public.time_entry_adjustment_requests as request
      where request.time_entry_id = entry.id and request.status = 'approved'
      order by request.reviewed_at desc
      limit 1
    ) as adjustment on true
    where entry.work_date >= target_period.period_month
      and entry.work_date < (target_period.period_month + interval '1 month')::date
      and entry.status in ('checked_out', 'auto_ended')
      and entry.check_out_at is not null
    union all
    select
      fact.staff_id,
      greatest(0, coalesce(fact.quantity, (fact.metadata->>'work_minutes')::numeric, 0))::integer as worked_minutes
    from public.payroll_source_facts as fact
    where fact.fact_type = 'timekeeping'
      and fact.event_date >= target_period.period_month
      and fact.event_date < (target_period.period_month + interval '1 month')::date
      and fact.staff_id is not null
      and not exists (
        select 1 from public.time_entries as system_entry
        where system_entry.staff_id = fact.staff_id
          and system_entry.work_date = fact.event_date
          and system_entry.status in ('checked_out', 'auto_ended')
          and system_entry.check_out_at is not null
      )
  ), minutes_by_staff as (
    select staff_id, coalesce(pg_catalog.sum(worked_minutes), 0)::integer as work_minutes
    from effective_entries
    group by staff_id
  )
  insert into public.payroll_statements (
    payroll_period_id, calculation_run_id, staff_id, staff_display_name_snapshot,
    staff_employee_code_snapshot, work_units, work_hours, work_minutes
  )
  select
    target_period.id,
    created_run.id,
    position.staff_id,
    coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), profile.email),
    profile.employee_code,
    pg_catalog.floor(coalesce(minutes.work_minutes, 0)::numeric / 540)::integer,
    pg_catalog.round(coalesce(minutes.work_minutes, 0)::numeric / 60)::integer,
    coalesce(minutes.work_minutes, 0)
  from effective_positions as position
  join public.profiles as profile on profile.id = position.staff_id
    and (profile.joined_at is null or profile.joined_at <= month_end)
    and (profile.left_at is null or profile.left_at >= target_period.period_month)
    and (profile.employment_status <> 'inactive' or profile.left_at >= target_period.period_month)
  left join minutes_by_staff as minutes on minutes.staff_id = position.staff_id;

  -- A closed entry requires the daily rate effective on its work date.
  insert into public.payroll_calculation_issues (
    calculation_run_id, issue_code, staff_id, details
  )
  select distinct
    created_run.id,
    'missing_daily_rate',
    entry.staff_id,
    pg_catalog.jsonb_build_object('work_date', entry.work_date)
  from public.time_entries as entry
  where entry.work_date >= target_period.period_month
    and entry.work_date < (target_period.period_month + interval '1 month')::date
    and entry.status in ('checked_out', 'auto_ended')
    and not exists (
      select 1 from public.staff_daily_rate_versions as rate
      where rate.staff_id = entry.staff_id and rate.effective_from <= entry.work_date
    );

  insert into public.payroll_calculation_issues (
    calculation_run_id, issue_code, staff_id, source_fact_id, details
  )
  select created_run.id, 'missing_daily_rate', fact.staff_id, fact.id,
    pg_catalog.jsonb_build_object('work_date', fact.event_date, 'source', 'excel')
  from public.payroll_source_facts as fact
  where fact.fact_type = 'timekeeping'
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and fact.staff_id is not null
    and not exists (
      select 1 from public.staff_daily_rate_versions as rate
      where rate.staff_id = fact.staff_id and rate.effective_from <= fact.event_date
    );

  with effective_entries as (
    select
      entry.id as time_entry_id,
      'time_entry'::text as source_kind,
      entry.id::text as source_id,
      entry.staff_id,
      entry.work_date,
      coalesce(adjustment.requested_check_in_mode, entry.check_in_mode) as work_mode,
      greatest(
        0,
        pg_catalog.floor(extract(epoch from (
          coalesce(adjustment.requested_check_out_at, entry.check_out_at)
          - coalesce(adjustment.requested_check_in_at, entry.check_in_at)
        )) / 60)::integer
      ) as worked_minutes,
      rate.id as daily_rate_version_id,
      rate.offline_daily_rate_vnd,
      rate.online_rate_basis_points
    from public.time_entries as entry
    left join lateral (
      select request.requested_check_in_at, request.requested_check_in_mode, request.requested_check_out_at
      from public.time_entry_adjustment_requests as request
      where request.time_entry_id = entry.id and request.status = 'approved'
      order by request.reviewed_at desc
      limit 1
    ) as adjustment on true
    join lateral (
      select rate.id, rate.offline_daily_rate_vnd, rate.online_rate_basis_points
      from public.staff_daily_rate_versions as rate
      where rate.staff_id = entry.staff_id and rate.effective_from <= entry.work_date
      order by rate.effective_from desc
      limit 1
    ) as rate on true
    where entry.work_date >= target_period.period_month
      and entry.work_date < (target_period.period_month + interval '1 month')::date
      and entry.status in ('checked_out', 'auto_ended')
      and entry.check_out_at is not null
    union all
    select
      null::uuid as time_entry_id,
      'payroll_source_fact'::text as source_kind,
      fact.id::text as source_id,
      fact.staff_id,
      fact.event_date as work_date,
      coalesce(nullif(fact.metadata->>'work_mode', ''), 'offline') as work_mode,
      greatest(0, coalesce(fact.quantity, (fact.metadata->>'work_minutes')::numeric, 0))::integer as worked_minutes,
      rate.id as daily_rate_version_id,
      rate.offline_daily_rate_vnd,
      rate.online_rate_basis_points
    from public.payroll_source_facts as fact
    join lateral (
      select rate.id, rate.offline_daily_rate_vnd, rate.online_rate_basis_points
      from public.staff_daily_rate_versions as rate
      where rate.staff_id = fact.staff_id and rate.effective_from <= fact.event_date
      order by rate.effective_from desc
      limit 1
    ) as rate on true
    where fact.fact_type = 'timekeeping'
      and fact.event_date >= target_period.period_month
      and fact.event_date < (target_period.period_month + interval '1 month')::date
      and not exists (
        select 1 from public.time_entries as system_entry
        where system_entry.staff_id = fact.staff_id
          and system_entry.work_date = fact.event_date
          and system_entry.status in ('checked_out', 'auto_ended')
          and system_entry.check_out_at is not null
      )
      and fact.staff_id is not null
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, source_time_entry_id,
    staff_daily_rate_version_id, work_minutes, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    case when entry.work_mode = 'online' then 'base_online' else 'base_offline' end,
    'earning',
    pg_catalog.round(
      entry.worked_minutes::numeric * entry.offline_daily_rate_vnd
      * case when entry.work_mode = 'online' then entry.online_rate_basis_points else 10000 end
      / 540 / 10000
    )::bigint,
    entry.time_entry_id,
    entry.daily_rate_version_id,
    entry.worked_minutes,
    entry.worked_minutes,
    entry.offline_daily_rate_vnd,
    'phút',
    'daily_base_salary',
    entry.source_kind,
    entry.source_id,
    pg_catalog.jsonb_build_object(
      'worked_minutes', entry.worked_minutes,
      'minutes_per_day', 540,
      'daily_rate_vnd', entry.offline_daily_rate_vnd,
      'mode_basis_points', case when entry.work_mode = 'online' then entry.online_rate_basis_points else 10000 end
    ),
    pg_catalog.jsonb_build_object('work_date', entry.work_date, 'mode', entry.work_mode, 'source', entry.source_kind),
    case when entry.work_mode = 'online' then 'Công online theo phút thực tế (50%).' else 'Công offline theo phút thực tế.' end,
    actor_id
  from effective_entries as entry
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = entry.staff_id
  where entry.worked_minutes > 0
    and pg_catalog.round(
      entry.worked_minutes::numeric * entry.offline_daily_rate_vnd
      * case when entry.work_mode = 'online' then entry.online_rate_basis_points else 10000 end
      / 540 / 10000
    )::bigint > 0;

  -- Teaching allowances are approved source facts.
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'teaching_allowance',
    'earning',
    (coalesce(fact.quantity, 1) * (policy.parameters->>'amount_vnd')::bigint)::bigint,
    coalesce(fact.quantity, 1),
    (policy.parameters->>'amount_vnd')::bigint,
    'lần',
    policy.policy_code,
    'payroll_source_fact',
    fact.id::text,
    policy.parameters,
    fact.metadata,
    'Phụ cấp đã được duyệt.',
    actor_id
  from public.payroll_source_facts as fact
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = fact.staff_id
  join lateral (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'teaching_allowance' and version.effective_from <= fact.event_date
    order by version.effective_from desc
    limit 1
  ) as policy on true
  where fact.fact_type = 'teaching_allowance'
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = fact.staff_id and position.position_code = 'teaching_assistant'
        and position.effective_from <= fact.event_date
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id
            and newer.effective_from <= fact.event_date
            and newer.effective_from > position.effective_from
        )
    )
    and (coalesce(fact.quantity, 1) * (policy.parameters->>'amount_vnd')::bigint)::bigint > 0;

  -- Divide the monthly grading pool exactly, including deterministic remainder distribution.
  with policy as (
    select version.id, version.policy_code, version.parameters,
      (version.parameters->>'monthly_pool_vnd')::bigint as pool_vnd
    from public.payroll_policy_versions as version
    where version.policy_code = 'grading_pool' and version.effective_from <= month_end
    order by version.effective_from desc
    limit 1
  ), grader_counts as (
    select source.grader_id, pg_catalog.sum(source.credit_units)::bigint as credit_count
    from (
      select credit.grader_id, credit.credit_units::numeric as credit_units
      from public.grading_credits as credit
      where (credit.credited_at at time zone 'Asia/Ho_Chi_Minh')::date >= target_period.period_month
        and (credit.credited_at at time zone 'Asia/Ho_Chi_Minh')::date < (target_period.period_month + interval '1 month')::date
        and credit.credit_units > 0
      union all
      select fact.staff_id as grader_id, coalesce(fact.quantity, 0) as credit_units
      from public.payroll_source_facts as fact
      where fact.fact_type = 'grading'
        and fact.event_date >= target_period.period_month
        and fact.event_date < (target_period.period_month + interval '1 month')::date
        and fact.staff_id is not null
        and coalesce(fact.quantity, 0) > 0
        and not exists (
          select 1 from public.grading_credits as system_credit
          where system_credit.grader_id = fact.staff_id
            and (system_credit.credited_at at time zone 'Asia/Ho_Chi_Minh')::date = fact.event_date
            and system_credit.credit_units > 0
        )
    ) as source
    group by source.grader_id
  ), eligible_counts as (
    select grader.*
    from grader_counts as grader
    where exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = grader.grader_id and position.position_code = 'teaching_assistant'
        and position.effective_from <= month_end
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id and newer.effective_from <= month_end
            and newer.effective_from > position.effective_from
        )
    )
  ), shares as (
    select
      grader.grader_id,
      grader.credit_count,
      pg_catalog.sum(grader.credit_count) over () as total_count,
      policy.id as policy_id,
      policy.policy_code,
      policy.parameters,
      policy.pool_vnd,
      pg_catalog.floor(policy.pool_vnd::numeric * grader.credit_count / pg_catalog.sum(grader.credit_count) over ())::bigint as base_amount,
      pg_catalog.mod(policy.pool_vnd * grader.credit_count, pg_catalog.sum(grader.credit_count) over ()) as remainder
    from eligible_counts as grader
    cross join policy
  ), ranked as (
    select shares.*,
      pg_catalog.row_number() over (order by remainder desc, grader_id) as remainder_rank,
      pool_vnd - pg_catalog.sum(base_amount) over () as leftover_vnd
    from shares
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'grading_bonus',
    'earning',
    ranked.base_amount + case when ranked.remainder_rank <= ranked.leftover_vnd then 1 else 0 end,
    ranked.credit_count,
    'bài',
    ranked.policy_code,
    'grading_pool',
    ranked.policy_id::text,
    pg_catalog.jsonb_build_object(
      'monthly_pool_vnd', ranked.pool_vnd,
      'staff_credits', ranked.credit_count,
      'total_credits', ranked.total_count
    ),
    pg_catalog.jsonb_build_object('period_month', target_period.period_month),
    'Phân bổ quỹ thưởng chấm bài theo tỷ lệ.',
    actor_id
  from ranked
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = ranked.grader_id
  where ranked.base_amount + case when ranked.remainder_rank <= ranked.leftover_vnd then 1 else 0 end > 0;

  -- Order data quality blockers remain attached to the run for resolution.
  insert into public.payroll_calculation_issues (calculation_run_id, issue_code, source_fact_id, staff_id, details)
  select
    created_run.id,
    evaluated.issue_code,
    fact.id,
    evaluated.staff_id,
    pg_catalog.jsonb_build_object(
      'source_key', fact.source_key,
      'fact_type', fact.fact_type,
      'event_date', fact.event_date,
      'amount_vnd', fact.amount_vnd,
      'grade', evaluated.grade,
      'source_code', evaluated.source_code
    )
  from public.payroll_source_facts as fact
  cross join lateral (
    select
      coalesce(
        fact.grade,
        (
          select class_row.grade
          from public.student_enrollments as enrollment
          join public.classes as class_row on class_row.id = enrollment.class_id
          where enrollment.student_id = fact.student_id
            and enrollment.effective_from <= fact.event_date
            and (enrollment.effective_to is null or enrollment.effective_to >= fact.event_date)
          order by enrollment.effective_from desc, enrollment.id desc
          limit 1
        ),
        (select student.current_grade from public.students as student where student.id = fact.student_id)
      ) as grade
  ) as resolved_grade
  cross join lateral (
    select
      case
        when fact.fact_type = 'renewal_order' then coalesce(
          (
            select assignment.staff_id
            from public.staff_grade_assignments as assignment
            where assignment.grade = resolved_grade.grade
              and assignment.effective_from <= fact.event_date
              and (assignment.effective_to is null or assignment.effective_to >= fact.event_date)
            order by assignment.effective_from desc, assignment.id desc
            limit 1
          ),
          fact.staff_id
        )
        else fact.staff_id
      end as staff_id
  ) as resolved_staff
  cross join lateral (
    select coalesce(
      fact.source_code,
      (
        select mapping.payroll_source_code
        from public.finance_cashflow_records as cashflow
        join public.sales_commission_accruals as accrual on accrual.source_cashflow_record_id = cashflow.id
        join public.crm_cases as crm_case on crm_case.id = accrual.crm_case_id
        join public.payroll_lead_source_mapping_versions as mapping on mapping.lead_source_id = crm_case.lead_source_id
        where cashflow.id::text = fact.source_key
          and mapping.effective_from <= fact.event_date
        order by mapping.effective_from desc
        limit 1
      )
    ) as source_code
  ) as resolved_source
  cross join lateral (
    select
      case
        when fact.fact_type = 'renewal_order' and resolved_grade.grade is null then 'missing_grade'
        when fact.fact_type = 'renewal_order' and (
          resolved_staff.staff_id is null
          or not exists (
            select 1
            from public.staff_payroll_position_versions as position
            where position.staff_id = resolved_staff.staff_id
              and position.position_code = 'operations_assistant'
              and position.effective_from <= fact.event_date
              and not exists (
                select 1 from public.staff_payroll_position_versions as newer
                where newer.staff_id = position.staff_id
                  and newer.effective_from <= fact.event_date
                  and newer.effective_from > position.effective_from
              )
          )
        ) then 'missing_grade_assignment'
        when fact.fact_type = 'new_enrollment_order' and resolved_staff.staff_id is null then 'missing_recruiter'
        when fact.fact_type = 'new_enrollment_order' and (
          resolved_source.source_code is null
          or not exists (
            select 1
            from public.staff_payroll_position_versions as position
            join lateral (
              select policy.parameters
              from public.payroll_policy_versions as policy
              where policy.policy_code = case position.position_code
                when 'operations_assistant' then 'operations_new_enrollment'
                when 'admissions_manager' then 'admissions_new_enrollment'
              end
                and policy.effective_from <= fact.event_date
              order by policy.effective_from desc
              limit 1
            ) as policy on position.position_code in ('operations_assistant', 'admissions_manager')
            where position.staff_id = resolved_staff.staff_id
              and position.effective_from <= fact.event_date
              and policy.parameters->'fixed_by_source' ? resolved_source.source_code
              and not exists (
                select 1 from public.staff_payroll_position_versions as newer
                where newer.staff_id = position.staff_id
                  and newer.effective_from <= fact.event_date
                  and newer.effective_from > position.effective_from
              )
          )
        ) then 'missing_source_mapping'
        else null
      end as issue_code,
      resolved_staff.staff_id as staff_id,
      resolved_grade.grade as grade,
      resolved_source.source_code as source_code
  ) as evaluated
  where fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and evaluated.issue_code is not null;

  -- Operations: 2% renewal revenue for assigned grades.
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'operations_grade_renewal_bonus',
    'earning',
    pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint,
    1,
    fact.amount_vnd,
    'đơn',
    policy.policy_code,
    'payroll_source_fact',
    fact.id::text,
    policy.parameters,
    fact.metadata || pg_catalog.jsonb_build_object('grade', resolved_grade.grade, 'order_value_vnd', fact.amount_vnd),
    'Thưởng tái phí khối phụ trách.',
    actor_id
  from public.payroll_source_facts as fact
  cross join lateral (
    select
      coalesce(
        fact.grade,
        (
          select class_row.grade
          from public.student_enrollments as enrollment
          join public.classes as class_row on class_row.id = enrollment.class_id
          where enrollment.student_id = fact.student_id
            and enrollment.effective_from <= fact.event_date
            and (enrollment.effective_to is null or enrollment.effective_to >= fact.event_date)
          order by enrollment.effective_from desc, enrollment.id desc
          limit 1
        ),
        (select student.current_grade from public.students as student where student.id = fact.student_id)
      ) as grade
  ) as resolved_grade
  cross join lateral (
    select
      coalesce(
        (
          select assignment.staff_id
          from public.staff_grade_assignments as assignment
          where assignment.grade = resolved_grade.grade
            and assignment.effective_from <= fact.event_date
            and (assignment.effective_to is null or assignment.effective_to >= fact.event_date)
          order by assignment.effective_from desc, assignment.id desc
          limit 1
        ),
        fact.staff_id
      ) as staff_id
  ) as resolved_staff
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = resolved_staff.staff_id
  join lateral (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'operations_grade_renewal' and version.effective_from <= fact.event_date
    order by version.effective_from desc limit 1
  ) as policy on true
  where fact.fact_type = 'renewal_order'
    and resolved_staff.staff_id is not null and fact.amount_vnd > 0
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = resolved_staff.staff_id and position.position_code = 'operations_assistant'
        and position.effective_from <= fact.event_date
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id and newer.effective_from <= fact.event_date
            and newer.effective_from > position.effective_from
        )
    )
    and pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint > 0;

  -- Operations: fixed source amount plus 5% of every new-enrollment order.
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    generated.line_type,
    'earning',
    generated.amount_vnd,
    1,
    fact.amount_vnd,
    'đơn',
    policy.policy_code,
    'payroll_source_fact',
    fact.id::text,
    policy.parameters,
    fact.metadata || pg_catalog.jsonb_build_object('source_code', resolved_source.source_code, 'order_value_vnd', fact.amount_vnd),
    generated.note,
    actor_id
  from public.payroll_source_facts as fact
  cross join lateral (
    select coalesce(
      fact.source_code,
      (
        select mapping.payroll_source_code
        from public.finance_cashflow_records as cashflow
        join public.sales_commission_accruals as accrual on accrual.source_cashflow_record_id = cashflow.id
        join public.crm_cases as crm_case on crm_case.id = accrual.crm_case_id
        join public.payroll_lead_source_mapping_versions as mapping on mapping.lead_source_id = crm_case.lead_source_id
        where cashflow.id::text = fact.source_key
          and mapping.effective_from <= fact.event_date
        order by mapping.effective_from desc
        limit 1
      )
    ) as source_code
  ) as resolved_source
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = fact.staff_id
  join lateral (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'operations_new_enrollment' and version.effective_from <= fact.event_date
    order by version.effective_from desc limit 1
  ) as policy on true
  cross join lateral (
    values
      ('new_student_fixed_bonus'::text, coalesce((policy.parameters->'fixed_by_source'->>resolved_source.source_code)::bigint, 0), 'Thưởng cố định theo nguồn tuyển sinh.'::text),
      ('new_student_revenue_bonus'::text, pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'revenue_rate_basis_points')::integer / 10000)::bigint, 'Thưởng 5% doanh thu đơn tuyển mới.'::text)
  ) as generated(line_type, amount_vnd, note)
  where fact.fact_type = 'new_enrollment_order'
    and fact.staff_id is not null and fact.amount_vnd > 0 and resolved_source.source_code is not null
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and generated.amount_vnd > 0
    and policy.parameters->'fixed_by_source' ? resolved_source.source_code
    and exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = fact.staff_id and position.position_code = 'operations_assistant'
        and position.effective_from <= fact.event_date
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id and newer.effective_from <= fact.event_date
            and newer.effective_from > position.effective_from
        )
    );

  -- Admissions: fixed source bonus per order.
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'new_student_fixed_bonus',
    'earning',
    (policy.parameters->'fixed_by_source'->>resolved_source.source_code)::bigint,
    1,
    fact.amount_vnd,
    'đơn',
    policy.policy_code,
    'payroll_source_fact',
    fact.id::text,
    policy.parameters,
    fact.metadata || pg_catalog.jsonb_build_object('source_code', resolved_source.source_code, 'order_value_vnd', fact.amount_vnd),
    'Thưởng cố định theo nguồn tuyển sinh.',
    actor_id
  from public.payroll_source_facts as fact
  cross join lateral (
    select coalesce(
      fact.source_code,
      (
        select mapping.payroll_source_code
        from public.finance_cashflow_records as cashflow
        join public.sales_commission_accruals as accrual on accrual.source_cashflow_record_id = cashflow.id
        join public.crm_cases as crm_case on crm_case.id = accrual.crm_case_id
        join public.payroll_lead_source_mapping_versions as mapping on mapping.lead_source_id = crm_case.lead_source_id
        where cashflow.id::text = fact.source_key
          and mapping.effective_from <= fact.event_date
        order by mapping.effective_from desc
        limit 1
      )
    ) as source_code
  ) as resolved_source
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = fact.staff_id
  join lateral (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'admissions_new_enrollment' and version.effective_from <= fact.event_date
    order by version.effective_from desc limit 1
  ) as policy on true
  where fact.fact_type = 'new_enrollment_order'
    and fact.staff_id is not null and resolved_source.source_code is not null
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and coalesce((policy.parameters->'fixed_by_source'->>resolved_source.source_code)::bigint, 0) > 0
    and exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = fact.staff_id and position.position_code = 'admissions_manager'
        and position.effective_from <= fact.event_date
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id and newer.effective_from <= fact.event_date
            and newer.effective_from > position.effective_from
        )
    );

  -- Admissions: highest reached tier applies to the full monthly new revenue.
  with admissions_revenue as (
    select fact.staff_id, pg_catalog.sum(fact.amount_vnd)::bigint as revenue_vnd
    from public.payroll_source_facts as fact
    where fact.fact_type = 'new_enrollment_order'
      and fact.staff_id is not null
      and fact.event_date >= target_period.period_month
      and fact.event_date < (target_period.period_month + interval '1 month')::date
      and exists (
        select 1 from public.staff_payroll_position_versions as position
        where position.staff_id = fact.staff_id and position.position_code = 'admissions_manager'
          and position.effective_from <= fact.event_date
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = position.staff_id and newer.effective_from <= fact.event_date
              and newer.effective_from > position.effective_from
          )
      )
    group by fact.staff_id
  ), policy as (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'admissions_revenue_tiers' and version.effective_from <= month_end
    order by version.effective_from desc limit 1
  ), selected_tiers as (
    select
      revenue.staff_id,
      revenue.revenue_vnd,
      policy.policy_code,
      policy.parameters,
      (
        select (tier->>'rate_basis_points')::integer
        from pg_catalog.jsonb_array_elements(policy.parameters->'tiers') as tier
        where (tier->>'minimum_vnd')::bigint <= revenue.revenue_vnd
        order by (tier->>'minimum_vnd')::bigint desc
        limit 1
      ) as rate_basis_points
    from admissions_revenue as revenue
    cross join policy
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'admissions_revenue_tier_bonus',
    'earning',
    pg_catalog.round(tier.revenue_vnd::numeric * tier.rate_basis_points / 10000)::bigint,
    tier.revenue_vnd,
    tier.rate_basis_points,
    'basis points',
    tier.policy_code,
    'monthly_new_enrollment_revenue',
    created_run.id::text || ':' || tier.staff_id::text,
    pg_catalog.jsonb_build_object('revenue_vnd', tier.revenue_vnd, 'rate_basis_points', tier.rate_basis_points, 'tiers', tier.parameters->'tiers'),
    pg_catalog.jsonb_build_object('period_month', target_period.period_month),
    'Hoa hồng theo mức doanh thu tuyển mới.',
    actor_id
  from selected_tiers as tier
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = tier.staff_id
  where tier.rate_basis_points > 0;

  -- Optional operations policies calculated from center totals or approved facts.
  with operations_staff as (
    select statement.id as statement_id, statement.staff_id
    from public.payroll_statements as statement
    where statement.calculation_run_id = created_run.id
      and exists (
        select 1 from public.staff_payroll_position_versions as position
        where position.staff_id = statement.staff_id and position.position_code = 'operations_assistant'
          and position.effective_from <= month_end
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = position.staff_id and newer.effective_from <= month_end
              and newer.effective_from > position.effective_from
          )
      )
  ), renewal_total as (
    select coalesce(pg_catalog.sum(amount_vnd), 0)::bigint as amount_vnd
    from public.payroll_source_facts
    where fact_type = 'renewal_order'
      and event_date >= target_period.period_month
      and event_date < (target_period.period_month + interval '1 month')::date
  ), statement_count as (
    select pg_catalog.count(*)::bigint as value
    from public.payroll_statements
    where calculation_run_id = created_run.id
  ), enabled_tasks as (
    select distinct on (task.staff_id, task.task_code)
      task.staff_id, task.task_code, task.is_enabled
    from public.staff_payroll_task_versions as task
    where task.effective_from <= month_end
    order by task.staff_id, task.task_code, task.effective_from desc
  ), generated as (
    select
      staff.statement_id,
      staff.staff_id,
      task.task_code,
      case task.task_code
        when 'center_renewal_duty' then 'center_renewal_duty_bonus'
        when 'record_excess' then 'record_excess_bonus'
        when 'payroll_processing' then 'payroll_processing_bonus'
      end as line_type,
      case task.task_code
        when 'center_renewal_duty' then pg_catalog.round(renewal_total.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint
        when 'record_excess' then pg_catalog.round(greatest(renewal_total.amount_vnd - (policy.parameters->>'record_revenue_vnd')::bigint, 0)::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint
        when 'payroll_processing' then statement_count.value * (policy.parameters->>'amount_per_staff_vnd')::bigint
      end as amount_vnd,
      policy.policy_code,
      policy.parameters
    from operations_staff as staff
    join enabled_tasks as task on task.staff_id = staff.staff_id and task.is_enabled
      and task.task_code in ('center_renewal_duty', 'record_excess', 'payroll_processing')
    join lateral (
      select version.policy_code, version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = case task.task_code
        when 'center_renewal_duty' then 'operations_center_renewal_duty'
        when 'record_excess' then 'operations_record_excess'
        when 'payroll_processing' then 'operations_payroll_processing'
      end
      and version.effective_from <= month_end
      order by version.effective_from desc limit 1
    ) as policy on true
    cross join renewal_total
    cross join statement_count
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, policy_code, source_kind,
    source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    generated.statement_id,
    generated.line_type,
    'earning',
    generated.amount_vnd,
    generated.policy_code,
    'monthly_center_metric',
    created_run.id::text || ':' || generated.task_code || ':' || generated.staff_id::text,
    generated.parameters,
    pg_catalog.jsonb_build_object(
      'period_month', target_period.period_month,
      'center_renewal_revenue_vnd', (select amount_vnd from renewal_total),
      'payroll_statement_count', (select value from statement_count)
    ),
    case generated.task_code
      when 'center_renewal_duty' then 'Thưởng quản lý và trực tin nhắn.'
      when 'record_excess' then 'Thưởng doanh thu tái phí vượt kỷ lục.'
      else 'Thưởng tính lương nhân sự.'
    end,
    actor_id
  from generated
  where generated.amount_vnd > 0;

  -- Optional task facts: daily reporting, add-on sales, and recruited staff salary.
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    case fact.fact_type
      when 'daily_admin_reporting' then 'daily_admin_reporting_bonus'
      when 'addon_product_order' then 'addon_product_sales_bonus'
      when 'staff_recruitment_salary' then 'staff_recruitment_care_bonus'
    end,
    'earning',
    case fact.fact_type
      when 'daily_admin_reporting' then coalesce(fact.quantity, 1)::bigint * (policy.parameters->>'amount_per_day_vnd')::bigint
      else pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint
    end,
    coalesce(fact.quantity, 1),
    case when fact.fact_type = 'daily_admin_reporting' then (policy.parameters->>'amount_per_day_vnd')::bigint else fact.amount_vnd end,
    case when fact.fact_type = 'daily_admin_reporting' then 'ngày' else 'VND doanh thu' end,
    policy.policy_code,
    'payroll_source_fact',
    fact.id::text,
    policy.parameters,
    fact.metadata,
    case fact.fact_type
      when 'daily_admin_reporting' then 'Thưởng ngày thực hiện nhập dòng tiền và báo cáo.'
      when 'addon_product_order' then 'Thưởng bán sản phẩm phụ.'
      else 'Thưởng tuyển dụng và chăm sóc nhân sự hiệu quả.'
    end,
    actor_id
  from public.payroll_source_facts as fact
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = fact.staff_id
  join lateral (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = case fact.fact_type
      when 'daily_admin_reporting' then 'operations_daily_admin_reporting'
      when 'addon_product_order' then 'operations_addon_product_sales'
      when 'staff_recruitment_salary' then 'operations_staff_recruitment_care'
    end
      and version.effective_from <= fact.event_date
    order by version.effective_from desc limit 1
  ) as policy on true
  where fact.fact_type in ('daily_admin_reporting', 'addon_product_order', 'staff_recruitment_salary')
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and exists (
      select 1 from public.staff_payroll_task_versions as task
      where task.staff_id = fact.staff_id
        and task.task_code = case fact.fact_type
          when 'daily_admin_reporting' then 'daily_admin_reporting'
          when 'addon_product_order' then 'addon_product_sales'
          when 'staff_recruitment_salary' then 'staff_recruitment_care'
        end
        and task.effective_from <= fact.event_date
        and task.is_enabled
        and not exists (
          select 1 from public.staff_payroll_task_versions as newer
          where newer.staff_id = task.staff_id and newer.task_code = task.task_code
            and newer.effective_from <= fact.event_date and newer.effective_from > task.effective_from
        )
    )
    and exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = fact.staff_id
        and position.position_code = 'operations_assistant'
        and position.effective_from <= fact.event_date
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id
            and newer.effective_from <= fact.event_date
            and newer.effective_from > position.effective_from
        )
    )
    and case fact.fact_type
      when 'daily_admin_reporting' then coalesce(fact.quantity, 1)::bigint * (policy.parameters->>'amount_per_day_vnd')::bigint
      else pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint
    end > 0;

  -- Coaching bonus uses renewal facts for students with a coaching owner.
  with coaching_renewal as (
    select coaching.assistant_owner_id as staff_id, pg_catalog.sum(fact.amount_vnd)::bigint as revenue_vnd,
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('fact_id', fact.id, 'student_id', fact.student_id, 'amount_vnd', fact.amount_vnd)) as evidence
    from public.payroll_source_facts as fact
    join lateral (
      select record.assistant_owner_id
      from public.coaching_records as record
      where record.student_id = fact.student_id
        and (record.opened_at at time zone 'Asia/Ho_Chi_Minh')::date <= fact.event_date
      order by record.opened_at desc, record.id desc
      limit 1
    ) as coaching on true
    where fact.fact_type = 'renewal_order'
      and fact.event_date >= target_period.period_month
      and fact.event_date < (target_period.period_month + interval '1 month')::date
      and exists (
        select 1 from public.staff_payroll_position_versions as position
        where position.staff_id = coaching.assistant_owner_id
          and position.position_code = 'operations_assistant'
          and position.effective_from <= fact.event_date
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = position.staff_id
              and newer.effective_from <= fact.event_date
              and newer.effective_from > position.effective_from
          )
      )
      and exists (
        select 1 from public.staff_payroll_task_versions as task
        where task.staff_id = coaching.assistant_owner_id
          and task.task_code = 'student_coaching'
          and task.effective_from <= fact.event_date
          and task.is_enabled
          and not exists (
            select 1 from public.staff_payroll_task_versions as newer
            where newer.staff_id = task.staff_id and newer.task_code = task.task_code
              and newer.effective_from <= fact.event_date and newer.effective_from > task.effective_from
          )
      )
    group by coaching.assistant_owner_id
  ), policy as (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'operations_student_coaching' and version.effective_from <= month_end
    order by version.effective_from desc limit 1
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'student_coaching_bonus',
    'earning',
    pg_catalog.round(coaching.revenue_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint,
    coaching.revenue_vnd,
    (policy.parameters->>'rate_basis_points')::bigint,
    'basis points',
    policy.policy_code,
    'coaching_renewal_revenue',
    created_run.id::text || ':' || coaching.staff_id::text,
    policy.parameters,
    pg_catalog.jsonb_build_object('orders', coaching.evidence),
    'Thưởng coaching trên doanh thu tái phí học sinh phụ trách.',
    actor_id
  from coaching_renewal as coaching
  cross join policy
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = coaching.staff_id
  where pg_catalog.round(coaching.revenue_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint > 0;

  -- Carry manual lines into the new immutable calculation revision.
  if previous_run_id is not null then
    insert into public.payroll_line_items (
      payroll_statement_id, line_type, direction, amount_vnd, unit_count, unit_rate_vnd,
      quantity, unit_label, policy_code, source_kind, source_id, formula_snapshot,
      evidence_snapshot, note, created_by
    )
    select
      new_statement.id,
      line.line_type,
      line.direction,
      line.amount_vnd,
      line.unit_count,
      line.unit_rate_vnd,
      line.quantity,
      line.unit_label,
      line.policy_code,
      'carried_manual_line',
      line.id::text,
      line.formula_snapshot,
      line.evidence_snapshot,
      line.note,
      line.created_by
    from public.payroll_line_items as line
    join public.payroll_statements as old_statement
      on old_statement.id = line.payroll_statement_id and old_statement.calculation_run_id = previous_run_id
    join public.payroll_statements as new_statement
      on new_statement.calculation_run_id = created_run.id and new_statement.staff_id = old_statement.staff_id
    where line.line_type in ('manual_reward', 'manual_deduction');
  end if;

  -- Apply the role-specific piecework floor using an auditable offset line.
  with statement_amounts as (
    select
      statement.id as statement_id,
      statement.staff_id,
      position.position_code,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (
        where line.direction = 'earning' and line.line_type in ('base_offline', 'base_online', 'hourly_wage')
      ), 0)::bigint as base_salary_vnd,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (
        where line.direction = 'earning' and line.line_type not in ('base_offline', 'base_online', 'hourly_wage', 'manual_reward')
      ), 0)::bigint as piecework_vnd
    from public.payroll_statements as statement
    join lateral (
      select version.position_code
      from public.staff_payroll_position_versions as version
      where version.staff_id = statement.staff_id and version.effective_from <= month_end
      order by version.effective_from desc limit 1
    ) as position on true
    left join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where statement.calculation_run_id = created_run.id
    group by statement.id, statement.staff_id, position.position_code
  ), offsets as (
    select
      amount.*,
      (floor_policy.parameters->>'base_salary_basis_points')::integer as base_floor_basis_points,
      least(
        amount.piecework_vnd,
        pg_catalog.round(
          amount.base_salary_vnd::numeric
          * (floor_policy.parameters->>'base_salary_basis_points')::integer
          / 10000
        )::bigint
      ) as offset_vnd
    from statement_amounts as amount
    join lateral (
      select version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = case amount.position_code
        when 'operations_assistant' then 'operations_piecework_floor'
        when 'admissions_manager' then 'admissions_piecework_floor'
      end
        and version.effective_from <= month_end
      order by version.effective_from desc
      limit 1
    ) as floor_policy on amount.position_code in ('operations_assistant', 'admissions_manager')
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, policy_code, source_kind,
    source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    calculated_offset.statement_id,
    'piecework_offset',
    'deduction',
    calculated_offset.offset_vnd,
    case calculated_offset.position_code when 'operations_assistant' then 'operations_piecework_floor' else 'admissions_piecework_floor' end,
    'calculation_run',
    created_run.id::text || ':piecework-floor:' || calculated_offset.staff_id::text,
    pg_catalog.jsonb_build_object(
      'position_code', calculated_offset.position_code,
      'base_salary_vnd', calculated_offset.base_salary_vnd,
      'piecework_vnd', calculated_offset.piecework_vnd,
      'offset_vnd', calculated_offset.offset_vnd,
      'base_floor_basis_points', calculated_offset.base_floor_basis_points
    ),
    '{}'::jsonb,
    case calculated_offset.position_code
      when 'operations_assistant' then 'Bù trừ lương khoán đến ngưỡng 85% lương cứng.'
      else 'Bù trừ phần lương khoán chưa vượt lương cứng.'
    end,
    actor_id
  from offsets as calculated_offset
  where calculated_offset.offset_vnd > 0;

  -- Salary advances are deducted once per current calculation revision.
  insert into public.payroll_calculation_issues (
    calculation_run_id, issue_code, staff_id, details
  )
  select
    created_run.id,
    'missing_advance_statement',
    advance.staff_id,
    pg_catalog.jsonb_build_object('salary_advance_id', advance.id, 'amount_vnd', advance.amount_vnd)
  from public.salary_advances as advance
  where advance.status = 'approved'
    and advance.deduction_period_month = target_period.period_month
    and not exists (
      select 1 from public.payroll_statements as statement
      where statement.calculation_run_id = created_run.id and statement.staff_id = advance.staff_id
    );

  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, note, created_by,
    salary_advance_id, policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot
  )
  select
    statement.id,
    'advance_deduction',
    'deduction',
    advance.amount_vnd,
    'Khấu trừ tạm ứng lương.',
    actor_id,
    advance.id,
    'salary_advance',
    'salary_advance',
    advance.id::text,
    pg_catalog.jsonb_build_object('amount_vnd', advance.amount_vnd),
    pg_catalog.jsonb_build_object('request_note', advance.request_note)
  from public.salary_advances as advance
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = advance.staff_id
  where (advance.status = 'approved' and advance.deduction_period_month = target_period.period_month)
    or (advance.status = 'deducted' and advance.deduction_payroll_period_id = target_period.id);

  update public.salary_advances
  set status = 'deducted', deducted_at = pg_catalog.now(), deduction_payroll_period_id = target_period.id
  where status = 'approved'
    and deduction_period_month = target_period.period_month
    and exists (
      select 1 from public.payroll_statements as statement
      where statement.calculation_run_id = created_run.id
        and statement.staff_id = salary_advances.staff_id
    );

  update public.payroll_periods
  set
    current_calculation_run_id = created_run.id,
    feedback_opened_at = pg_catalog.now(),
    feedback_closed_at = null,
    feedback_closed_by = null
  where id = target_period.id;

  return created_run;
end;
$$;

revoke all on function public.generate_payroll_calculation_run(uuid, text) from public, anon;

commit;
