-- Restore task bonuses in the shared projection; preserve evidence in new draft runs.
-- Existing statements (including locked periods) are not modified.
begin;

create or replace function public.compute_payroll_projection(
  p_month date,
  p_as_of timestamptz default pg_catalog.now(),
  p_mode text default 'estimate',
  p_target_staff_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm_month date := pg_catalog.date_trunc('month', p_month)::date;
  v_month_end date := (pg_catalog.date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_cutoff timestamptz := coalesce(p_as_of, pg_catalog.now());
  v_cutoff_date date := (v_cutoff at time zone 'Asia/Ho_Chi_Minh')::date;
  v_is_final boolean := (p_mode = 'final');
  v_result jsonb;
begin
  if v_norm_month is null then
    raise exception using errcode = '22023', message = 'PAYROLL_MONTH_INVALID';
  end if;

  with
  -- Active payroll position on or before month end
  effective_positions as (
    select distinct on (position.staff_id)
      position.staff_id,
      position.position_code,
      position.effective_from
    from public.staff_payroll_position_versions as position
    where position.effective_from <= v_month_end
    order by position.staff_id, position.effective_from desc
  ),
  all_eligible_profiles as (
    select
      position.staff_id,
      position.position_code,
      coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), profile.email) as staff_display_name,
      profile.employee_code as staff_employee_code
    from effective_positions as position
    join public.profiles as profile on profile.id = position.staff_id
      and (profile.joined_at is null or profile.joined_at <= v_month_end)
      and (profile.left_at is null or profile.left_at >= v_norm_month)
      and (profile.employment_status <> 'inactive' or profile.left_at >= v_norm_month)
  ),
  eligible_profiles as (
    select * from all_eligible_profiles
    where p_target_staff_id is null or staff_id = p_target_staff_id
  ),
  -- Time entries within month up to cutoff
  raw_time_entries as (
    select
      entry.id,
      entry.staff_id,
      entry.work_date,
      entry.check_in_mode,
      entry.check_in_at,
      entry.check_out_at,
      entry.status,
      not public.time_entry_is_verified(entry.id) as is_pending_verification,
      adjustment.requested_check_in_at,
      adjustment.requested_check_in_mode,
      adjustment.requested_check_out_at
    from public.time_entries as entry
    left join lateral (
      select request.requested_check_in_at, request.requested_check_in_mode, request.requested_check_out_at
      from public.time_entry_adjustment_requests as request
      where request.time_entry_id = entry.id and request.status = 'approved'
      order by request.reviewed_at desc
      limit 1
    ) as adjustment on true
    where entry.work_date >= v_norm_month
      and entry.work_date <= v_month_end
      and entry.work_date <= v_cutoff_date
      and entry.check_out_at is not null
      and entry.check_out_at <= v_cutoff
      and entry.status in ('checked_out', 'auto_ended')
      and (p_target_staff_id is null or entry.staff_id = p_target_staff_id)
      -- Filter by verification mode:
      and (
        case
          when v_is_final then public.time_entry_is_verified(entry.id)
          else (
            public.time_entry_is_verified(entry.id)
            or exists (
              select 1 from public.attendance_exception_reviews as r
              where r.time_entry_id = entry.id and r.status = 'pending'
            )
          )
        end
      )
  ),
  effective_time_entries as (
    select
      entry.id as time_entry_id,
      'time_entry'::text as source_kind,
      entry.id::text as source_id,
      entry.staff_id,
      entry.work_date,
      coalesce(entry.requested_check_in_mode, entry.check_in_mode) as work_mode,
      greatest(
        0,
        pg_catalog.floor(extract(epoch from (
          coalesce(entry.requested_check_out_at, entry.check_out_at)
          - coalesce(entry.requested_check_in_at, entry.check_in_at)
        )) / 60)::integer
      ) as worked_minutes,
      entry.check_in_at,
      entry.check_out_at,
      entry.is_pending_verification,
      rate.id as daily_rate_version_id,
      rate.offline_daily_rate_vnd,
      rate.online_rate_basis_points
    from raw_time_entries as entry
    left join lateral (
      select rate.id, rate.offline_daily_rate_vnd, rate.online_rate_basis_points
      from public.staff_daily_rate_versions as rate
      where rate.staff_id = entry.staff_id and rate.effective_from <= entry.work_date
      order by rate.effective_from desc
      limit 1
    ) as rate on true
    union all
    select
      null::uuid as time_entry_id,
      'payroll_source_fact'::text as source_kind,
      fact.id::text as source_id,
      fact.staff_id,
      fact.event_date as work_date,
      coalesce(nullif(fact.metadata->>'work_mode', ''), 'offline') as work_mode,
      greatest(0, coalesce(fact.quantity, (fact.metadata->>'work_minutes')::numeric, 0))::integer as worked_minutes,
      null::timestamptz as check_in_at,
      null::timestamptz as check_out_at,
      false as is_pending_verification,
      rate.id as daily_rate_version_id,
      rate.offline_daily_rate_vnd,
      rate.online_rate_basis_points
    from public.payroll_source_facts as fact
    left join lateral (
      select rate.id, rate.offline_daily_rate_vnd, rate.online_rate_basis_points
      from public.staff_daily_rate_versions as rate
      where rate.staff_id = fact.staff_id and rate.effective_from <= fact.event_date
      order by rate.effective_from desc
      limit 1
    ) as rate on true
    where fact.fact_type = 'timekeeping'
      and fact.event_date >= v_norm_month
      and fact.event_date <= v_month_end
      and fact.event_date <= v_cutoff_date
      and fact.staff_id is not null
      and (p_target_staff_id is null or fact.staff_id = p_target_staff_id)
      and not exists (
        select 1 from public.time_entries as system_entry
        where system_entry.staff_id = fact.staff_id
          and system_entry.work_date = fact.event_date
          and system_entry.status in ('checked_out', 'auto_ended')
          and system_entry.check_out_at is not null
          and system_entry.check_out_at <= v_cutoff
      )
  ),
  -- Line items: Base Salary
  base_salary_lines as (
    select
      entry.staff_id,
      case when entry.work_mode = 'online' then 'base_online' else 'base_offline' end as line_type,
      'earning' as direction,
      pg_catalog.round(
        entry.worked_minutes::numeric * coalesce(entry.offline_daily_rate_vnd, 0)
        * case when entry.work_mode = 'online' then coalesce(entry.online_rate_basis_points, 5000) else 10000 end
        / 540 / 10000
      )::bigint as amount_vnd,
      entry.worked_minutes,
      entry.offline_daily_rate_vnd as unit_rate_vnd,
      'phút' as unit_label,
      'daily_base_salary' as policy_code,
      entry.source_kind,
      entry.source_id,
      entry.work_date,
      entry.is_pending_verification,
      pg_catalog.jsonb_build_object(
        'worked_minutes', entry.worked_minutes,
        'minutes_per_day', 540,
        'daily_rate_vnd', entry.offline_daily_rate_vnd,
        'mode_basis_points', case when entry.work_mode = 'online' then entry.online_rate_basis_points else 10000 end,
        'pending_verification', entry.is_pending_verification
      ) as formula_snapshot,
      case when entry.work_mode = 'online' then 'Công online theo phút thực tế (50%).' else 'Công offline theo phút thực tế.' end as note
    from effective_time_entries as entry
    where entry.worked_minutes > 0 and entry.offline_daily_rate_vnd is not null
  ),
  -- Line items: Teaching Allowance
  teaching_allowance_lines as (
    select
      fact.staff_id,
      'teaching_allowance' as line_type,
      'earning' as direction,
      (coalesce(fact.quantity, 1) * (policy.parameters->>'amount_vnd')::bigint)::bigint as amount_vnd,
      coalesce(fact.quantity, 1)::integer as worked_minutes,
      (policy.parameters->>'amount_vnd')::bigint as unit_rate_vnd,
      'lần' as unit_label,
      policy.policy_code,
      'payroll_source_fact' as source_kind,
      fact.id::text as source_id,
      fact.event_date as work_date,
      false as is_pending_verification,
      policy.parameters as formula_snapshot,
      'Phụ cấp đã được duyệt.' as note
    from public.payroll_source_facts as fact
    join lateral (
      select version.policy_code, version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = 'teaching_allowance' and version.effective_from <= fact.event_date
      order by version.effective_from desc
      limit 1
    ) as policy on true
    where fact.fact_type = 'teaching_allowance'
      and fact.event_date >= v_norm_month
      and fact.event_date <= v_month_end
      and fact.event_date <= v_cutoff_date
      and (p_target_staff_id is null or fact.staff_id = p_target_staff_id)
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
  ),
  -- Grading pool credits (must compute all staff to calculate ratio, then filter)
  raw_grading_credits as (
    select credit.grader_id, credit.credit_units::numeric as credit_units
    from public.grading_credits as credit
    where (credit.credited_at at time zone 'Asia/Ho_Chi_Minh')::date >= v_norm_month
      and (credit.credited_at at time zone 'Asia/Ho_Chi_Minh')::date <= v_month_end
      and credit.credited_at <= v_cutoff
      and credit.credit_units > 0
    union all
    select fact.staff_id as grader_id, coalesce(fact.quantity, 0) as credit_units
    from public.payroll_source_facts as fact
    where fact.fact_type = 'grading'
      and fact.event_date >= v_norm_month
      and fact.event_date <= v_month_end
      and fact.event_date <= v_cutoff_date
      and fact.staff_id is not null
      and coalesce(fact.quantity, 0) > 0
      and not exists (
        select 1 from public.grading_credits as system_credit
        where system_credit.grader_id = fact.staff_id
          and (system_credit.credited_at at time zone 'Asia/Ho_Chi_Minh')::date = fact.event_date
          and system_credit.credit_units > 0
          and system_credit.credited_at <= v_cutoff
      )
  ),
  grader_counts as (
    select grader_id, pg_catalog.sum(credit_units)::bigint as credit_count
    from raw_grading_credits
    group by grader_id
  ),
  eligible_graders as (
    select grader.*
    from grader_counts as grader
    where exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = grader.grader_id and position.position_code = 'teaching_assistant'
        and position.effective_from <= v_month_end
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id
            and newer.effective_from <= v_month_end
            and newer.effective_from > position.effective_from
        )
    )
  ),
  grading_policy as (
    select version.id, version.policy_code, version.parameters,
      (version.parameters->>'monthly_pool_vnd')::bigint as pool_vnd
    from public.payroll_policy_versions as version
    where version.policy_code = 'grading_pool' and version.effective_from <= v_month_end
    order by version.effective_from desc
    limit 1
  ),
  grading_shares as (
    select
      grader.grader_id,
      grader.credit_count,
      pg_catalog.sum(grader.credit_count) over () as total_count,
      policy.id as policy_id,
      policy.policy_code,
      policy.parameters,
      policy.pool_vnd,
      case when pg_catalog.sum(grader.credit_count) over () > 0 then
        pg_catalog.floor(policy.pool_vnd::numeric * grader.credit_count / pg_catalog.sum(grader.credit_count) over ())::bigint
      else 0::bigint end as base_amount,
      case when pg_catalog.sum(grader.credit_count) over () > 0 then
        pg_catalog.mod(policy.pool_vnd * grader.credit_count, pg_catalog.sum(grader.credit_count) over ())
      else 0 end as remainder
    from eligible_graders as grader
    cross join grading_policy as policy
  ),
  grading_ranked as (
    select grading_shares.*,
      pg_catalog.row_number() over (order by remainder desc, grader_id) as remainder_rank,
      pool_vnd - pg_catalog.sum(base_amount) over () as leftover_vnd
    from grading_shares
  ),
  grading_lines as (
    select
      ranked.grader_id as staff_id,
      'grading_bonus' as line_type,
      'earning' as direction,
      ranked.base_amount + case when ranked.remainder_rank <= ranked.leftover_vnd then 1 else 0 end as amount_vnd,
      ranked.credit_count::integer as worked_minutes,
      null::bigint as unit_rate_vnd,
      'bài' as unit_label,
      ranked.policy_code,
      'grading_pool' as source_kind,
      ranked.policy_id::text as source_id,
      v_norm_month as work_date,
      false as is_pending_verification,
      pg_catalog.jsonb_build_object(
        'monthly_pool_vnd', ranked.pool_vnd,
        'staff_credits', ranked.credit_count,
        'total_credits', ranked.total_count
      ) as formula_snapshot,
      'Phân bổ quỹ thưởng chấm bài theo tỷ lệ.' as note
    from grading_ranked as ranked
    where (p_target_staff_id is null or ranked.grader_id = p_target_staff_id)
      and (ranked.base_amount + case when ranked.remainder_rank <= ranked.leftover_vnd then 1 else 0 end) > 0
  ),
  -- Order-based bonuses for Operations and Admissions
  resolved_order_facts as (
    select
      fact.id as fact_id,
      fact.fact_type,
      fact.event_date,
      fact.amount_vnd,
      fact.metadata,
      fact.source_key,
      fact.student_id,
      resolved_grade.grade as resolved_grade,
      resolved_staff.staff_id as resolved_staff_id,
      resolved_source.source_code as resolved_source_code
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
    where fact.event_date >= v_norm_month
      and fact.event_date <= v_month_end
      and fact.event_date <= v_cutoff_date
      and fact.amount_vnd > 0
  ),
  -- Operations: Renewal Bonus (2%)
  operations_renewal_lines as (
    select
      fact.resolved_staff_id as staff_id,
      'operations_grade_renewal_bonus' as line_type,
      'earning' as direction,
      pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint as amount_vnd,
      1 as worked_minutes,
      fact.amount_vnd as unit_rate_vnd,
      'đơn' as unit_label,
      policy.policy_code,
      'payroll_source_fact' as source_kind,
      fact.fact_id::text as source_id,
      fact.event_date as work_date,
      false as is_pending_verification,
      policy.parameters as formula_snapshot,
      'Thưởng tái phí khối phụ trách.' as note
    from resolved_order_facts as fact
    join lateral (
      select version.policy_code, version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = 'operations_grade_renewal' and version.effective_from <= fact.event_date
      order by version.effective_from desc limit 1
    ) as policy on true
    where fact.fact_type = 'renewal_order'
      and fact.resolved_staff_id is not null
      and (p_target_staff_id is null or fact.resolved_staff_id = p_target_staff_id)
      and exists (
        select 1 from public.staff_payroll_position_versions as pos
        where pos.staff_id = fact.resolved_staff_id and pos.position_code = 'operations_assistant'
          and pos.effective_from <= fact.event_date
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = pos.staff_id
              and newer.effective_from <= fact.event_date
              and newer.effective_from > pos.effective_from
          )
      )
  ),
  -- Operations: New Enrollment Bonus
  operations_new_enrollment_lines as (
    select
      fact.resolved_staff_id as staff_id,
      gen.line_type,
      'earning' as direction,
      gen.amount_vnd,
      1 as worked_minutes,
      fact.amount_vnd as unit_rate_vnd,
      'đơn' as unit_label,
      policy.policy_code,
      'payroll_source_fact' as source_kind,
      fact.fact_id::text as source_id,
      fact.event_date as work_date,
      false as is_pending_verification,
      policy.parameters as formula_snapshot,
      gen.note
    from resolved_order_facts as fact
    join lateral (
      select version.policy_code, version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = 'operations_new_enrollment' and version.effective_from <= fact.event_date
      order by version.effective_from desc limit 1
    ) as policy on true
    cross join lateral (
      values
        ('new_student_fixed_bonus', coalesce((policy.parameters->'fixed_by_source'->>fact.resolved_source_code)::bigint, 0), 'Thưởng cố định theo nguồn tuyển sinh.'),
        ('new_student_revenue_bonus', pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'revenue_rate_basis_points')::integer / 10000)::bigint, 'Thưởng 5% doanh thu đơn tuyển mới.')
    ) as gen(line_type, amount_vnd, note)
    where fact.fact_type = 'new_enrollment_order'
      and fact.resolved_staff_id is not null
      and fact.resolved_source_code is not null
      and gen.amount_vnd > 0
      and (p_target_staff_id is null or fact.resolved_staff_id = p_target_staff_id)
      and exists (
        select 1 from public.staff_payroll_position_versions as pos
        where pos.staff_id = fact.resolved_staff_id and pos.position_code = 'operations_assistant'
          and pos.effective_from <= fact.event_date
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = pos.staff_id
              and newer.effective_from <= fact.event_date
              and newer.effective_from > pos.effective_from
          )
      )
  ),
  -- Admissions: New Enrollment Fixed Bonus
  admissions_fixed_lines as (
    select
      fact.resolved_staff_id as staff_id,
      'new_student_fixed_bonus' as line_type,
      'earning' as direction,
      (policy.parameters->'fixed_by_source'->>fact.resolved_source_code)::bigint as amount_vnd,
      1 as worked_minutes,
      fact.amount_vnd as unit_rate_vnd,
      'đơn' as unit_label,
      policy.policy_code,
      'payroll_source_fact' as source_kind,
      fact.fact_id::text as source_id,
      fact.event_date as work_date,
      false as is_pending_verification,
      policy.parameters as formula_snapshot,
      'Thưởng cố định theo nguồn tuyển sinh.' as note
    from resolved_order_facts as fact
    join lateral (
      select version.policy_code, version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = 'admissions_new_enrollment' and version.effective_from <= fact.event_date
      order by version.effective_from desc limit 1
    ) as policy on true
    where fact.fact_type = 'new_enrollment_order'
      and fact.resolved_staff_id is not null
      and fact.resolved_source_code is not null
      and coalesce((policy.parameters->'fixed_by_source'->>fact.resolved_source_code)::bigint, 0) > 0
      and (p_target_staff_id is null or fact.resolved_staff_id = p_target_staff_id)
      and exists (
        select 1 from public.staff_payroll_position_versions as pos
        where pos.staff_id = fact.resolved_staff_id and pos.position_code = 'admissions_manager'
          and pos.effective_from <= fact.event_date
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = pos.staff_id
              and newer.effective_from <= fact.event_date
              and newer.effective_from > pos.effective_from
          )
      )
  ),
  -- Admissions: Monthly Revenue Tiers
  admissions_staff_revenue as (
    select fact.resolved_staff_id as staff_id, pg_catalog.sum(fact.amount_vnd)::bigint as revenue_vnd
    from resolved_order_facts as fact
    where fact.fact_type = 'new_enrollment_order'
      and fact.resolved_staff_id is not null
      and exists (
        select 1 from public.staff_payroll_position_versions as pos
        where pos.staff_id = fact.resolved_staff_id and pos.position_code = 'admissions_manager'
          and pos.effective_from <= fact.event_date
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = pos.staff_id
              and newer.effective_from <= fact.event_date
              and newer.effective_from > pos.effective_from
          )
      )
    group by fact.resolved_staff_id
  ),
  admissions_tier_lines as (
    select
      rev.staff_id,
      'admissions_revenue_tier_bonus' as line_type,
      'earning' as direction,
      pg_catalog.round(rev.revenue_vnd::numeric * selected.rate_basis_points / 10000)::bigint as amount_vnd,
      0 as worked_minutes,
      selected.rate_basis_points as unit_rate_vnd,
      'basis points' as unit_label,
      policy.policy_code,
      'monthly_new_enrollment_revenue' as source_kind,
      v_norm_month::text || ':' || rev.staff_id::text as source_id,
      v_norm_month as work_date,
      false as is_pending_verification,
      pg_catalog.jsonb_build_object('revenue_vnd', rev.revenue_vnd, 'rate_basis_points', selected.rate_basis_points) as formula_snapshot,
      'Hoa hồng theo mức doanh thu tuyển mới.' as note
    from admissions_staff_revenue as rev
    cross join lateral (
      select version.policy_code, version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = 'admissions_revenue_tiers' and version.effective_from <= v_month_end
      order by version.effective_from desc limit 1
    ) as policy
    cross join lateral (
      select (tier->>'rate_basis_points')::integer as rate_basis_points
      from pg_catalog.jsonb_array_elements(policy.parameters->'tiers') as tier
      where (tier->>'minimum_vnd')::bigint <= rev.revenue_vnd
      order by (tier->>'minimum_vnd')::bigint desc
      limit 1
    ) as selected
    where (p_target_staff_id is null or rev.staff_id = p_target_staff_id)
      and selected.rate_basis_points > 0
  ),
  -- Operations: Coaching Bonus
  coaching_orders as (
    select coaching.assistant_owner_id as staff_id, pg_catalog.sum(fact.amount_vnd)::bigint as revenue_vnd
    from resolved_order_facts as fact
    join lateral (
      select record.assistant_owner_id
      from public.coaching_records as record
      where record.student_id = fact.student_id
        and (record.opened_at at time zone 'Asia/Ho_Chi_Minh')::date <= fact.event_date
      order by record.opened_at desc, record.id desc
      limit 1
    ) as coaching on true
    where fact.fact_type = 'renewal_order'
      and exists (
        select 1 from public.staff_payroll_position_versions as pos
        where pos.staff_id = coaching.assistant_owner_id and pos.position_code = 'operations_assistant'
          and pos.effective_from <= fact.event_date
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = pos.staff_id
              and newer.effective_from <= fact.event_date
              and newer.effective_from > pos.effective_from
          )
      )
      and exists (
        select 1 from public.staff_payroll_task_versions as task
        where task.staff_id = coaching.assistant_owner_id and task.task_code = 'student_coaching'
          and task.effective_from <= fact.event_date and task.is_enabled
          and not exists (
            select 1 from public.staff_payroll_task_versions as newer
            where newer.staff_id = task.staff_id
              and newer.task_code = task.task_code
              and newer.effective_from <= fact.event_date
              and newer.effective_from > task.effective_from
          )
      )
    group by coaching.assistant_owner_id
  ),
  coaching_lines as (
    select
      coaching.staff_id,
      'student_coaching_bonus' as line_type,
      'earning' as direction,
      pg_catalog.round(coaching.revenue_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint as amount_vnd,
      0 as worked_minutes,
      (policy.parameters->>'rate_basis_points')::bigint as unit_rate_vnd,
      'basis points' as unit_label,
      policy.policy_code,
      'coaching_renewal_revenue' as source_kind,
      v_norm_month::text || ':' || coaching.staff_id::text as source_id,
      v_norm_month as work_date,
      false as is_pending_verification,
      policy.parameters || jsonb_build_object('revenue_vnd', coaching.revenue_vnd) as formula_snapshot,
      'Thưởng coaching trên doanh thu tái phí học sinh phụ trách.' as note
    from coaching_orders as coaching
    cross join lateral (
      select version.policy_code, version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = 'operations_student_coaching' and version.effective_from <= v_month_end
      order by version.effective_from desc limit 1
    ) as policy
    where (p_target_staff_id is null or coaching.staff_id = p_target_staff_id)
      and pg_catalog.round(coaching.revenue_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint > 0
  ),
  -- Monthly metrics must remain global even in a single employee estimate.
  center_metrics as (
    select coalesce(sum(amount_vnd), 0)::bigint as revenue_vnd
    from public.payroll_source_facts
    where fact_type = 'renewal_order'
      and event_date between v_norm_month and least(v_month_end, v_cutoff_date)
  ),
  monthly_task_lines as (
    select staff.staff_id, task.task_code || '_bonus' as line_type,
      'earning' as direction, calculated.amount_vnd, 0 as worked_minutes,
      null::bigint as unit_rate_vnd, null::text as unit_label,
      policy.policy_code, 'monthly_center_metric' as source_kind,
      v_norm_month::text || ':' || task.task_code || ':' || staff.staff_id::text as source_id,
      v_norm_month as work_date, false as is_pending_verification,
      policy.parameters || jsonb_build_object(
        'period_month', v_norm_month, 'center_renewal_revenue_vnd', metric.revenue_vnd,
        'revenue_vnd', case when task.task_code = 'record_excess'
          then greatest(metric.revenue_vnd - (policy.parameters->>'record_revenue_vnd')::bigint, 0)
          else metric.revenue_vnd end,
        'payroll_statement_count', headcount.value
      ) as formula_snapshot,
      case task.task_code when 'center_renewal_duty' then 'Thưởng quản lý và trực tin nhắn.'
        when 'record_excess' then 'Thưởng doanh thu tái phí vượt kỷ lục.'
        else 'Thưởng tính lương nhân sự.' end as note
    from eligible_profiles staff
    cross join (values ('center_renewal_duty'), ('record_excess'), ('payroll_processing')) task(task_code)
    join lateral (
      select is_enabled from public.staff_payroll_task_versions version
      where version.staff_id = staff.staff_id and version.task_code = task.task_code
        and version.effective_from <= least(v_month_end, v_cutoff_date)
      order by version.effective_from desc limit 1
    ) enabled on enabled.is_enabled
    join lateral (
      select policy_code, parameters from public.payroll_policy_versions version
      where version.policy_code = 'operations_' || task.task_code
        and version.effective_from <= least(v_month_end, v_cutoff_date)
      order by version.effective_from desc limit 1
    ) policy on true
    cross join center_metrics metric
    cross join lateral (
      select count(*)::bigint as value from all_eligible_profiles counted
      where coalesce((policy.parameters->>'include_self')::boolean, true)
        or counted.staff_id <> staff.staff_id
    ) headcount
    cross join lateral (
      select case task.task_code
        when 'center_renewal_duty' then round(metric.revenue_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint
        when 'record_excess' then round(greatest(metric.revenue_vnd - (policy.parameters->>'record_revenue_vnd')::bigint, 0)::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint
        else headcount.value * (policy.parameters->>'amount_per_staff_vnd')::bigint end as amount_vnd
    ) calculated
    where staff.position_code = 'operations_assistant' and calculated.amount_vnd > 0
  ),
  task_fact_lines as (
    select fact.staff_id, mapping.task_code || '_bonus' as line_type,
      'earning' as direction, calculated.amount_vnd, 0 as worked_minutes,
      case when fact.fact_type = 'daily_admin_reporting' then (policy.parameters->>'amount_per_day_vnd')::bigint
        else fact.amount_vnd end as unit_rate_vnd,
      case when fact.fact_type = 'daily_admin_reporting' then 'ngày' else 'VND doanh thu' end as unit_label,
      policy.policy_code, 'payroll_source_fact' as source_kind, fact.id::text as source_id,
      fact.event_date as work_date, false as is_pending_verification,
      policy.parameters || jsonb_build_object('revenue_vnd', fact.amount_vnd) as formula_snapshot,
      mapping.note
    from public.payroll_source_facts fact
    join eligible_profiles staff on staff.staff_id = fact.staff_id
    join (values
      ('daily_admin_reporting', 'daily_admin_reporting', 'Thưởng ngày thực hiện nhập dòng tiền và báo cáo.'),
      ('addon_product_order', 'addon_product_sales', 'Thưởng bán sản phẩm phụ.'),
      ('staff_recruitment_salary', 'staff_recruitment_care', 'Thưởng tuyển dụng và chăm sóc nhân sự hiệu quả.')
    ) mapping(fact_type, task_code, note) on mapping.fact_type = fact.fact_type
    join lateral (
      select position_code from public.staff_payroll_position_versions version
      where version.staff_id = fact.staff_id and version.effective_from <= fact.event_date
      order by version.effective_from desc limit 1
    ) position on position.position_code = 'operations_assistant'
    join lateral (
      select is_enabled from public.staff_payroll_task_versions version
      where version.staff_id = fact.staff_id and version.task_code = mapping.task_code
        and version.effective_from <= fact.event_date
      order by version.effective_from desc limit 1
    ) enabled on enabled.is_enabled
    join lateral (
      select policy_code, parameters from public.payroll_policy_versions version
      where version.policy_code = 'operations_' || mapping.task_code and version.effective_from <= fact.event_date
      order by version.effective_from desc limit 1
    ) policy on true
    cross join lateral (
      select case when fact.fact_type = 'daily_admin_reporting'
        then round(coalesce(fact.quantity, 1) * (policy.parameters->>'amount_per_day_vnd')::bigint)::bigint
        else round(fact.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint end as amount_vnd
    ) calculated
    where fact.event_date between v_norm_month and least(v_month_end, v_cutoff_date)
      and calculated.amount_vnd > 0
  ),
  -- Combine all earning lines
  all_earning_lines as (
    select * from base_salary_lines
    union all
    select * from teaching_allowance_lines
    union all
    select * from grading_lines
    union all
    select * from operations_renewal_lines
    union all
    select * from operations_new_enrollment_lines
    union all
    select * from admissions_fixed_lines
    union all
    select * from admissions_tier_lines
    union all
    select * from coaching_lines
    union all select * from monthly_task_lines
    union all select * from task_fact_lines
  ),
  -- Piecework floor calculations
  staff_earnings_summary as (
    select
      profile.staff_id,
      profile.position_code,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.line_type in ('base_offline', 'base_online')), 0)::bigint as base_salary_vnd,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.line_type not in ('base_offline', 'base_online')), 0)::bigint as piecework_vnd
    from eligible_profiles as profile
    left join all_earning_lines as line on line.staff_id = profile.staff_id
    group by profile.staff_id, profile.position_code
  ),
  floor_offsets as (
    select
      summary.staff_id,
      'piecework_offset' as line_type,
      'deduction' as direction,
      least(
        summary.piecework_vnd,
        pg_catalog.round(
          summary.base_salary_vnd::numeric
          * (floor_policy.parameters->>'base_salary_basis_points')::integer
          / 10000
        )::bigint
      ) as amount_vnd,
      0 as worked_minutes,
      null::bigint as unit_rate_vnd,
      null::text as unit_label,
      case summary.position_code when 'operations_assistant' then 'operations_piecework_floor' else 'admissions_piecework_floor' end as policy_code,
      'piecework_floor' as source_kind,
      v_norm_month::text || ':' || summary.staff_id::text as source_id,
      v_norm_month as work_date,
      false as is_pending_verification,
      pg_catalog.jsonb_build_object(
        'base_salary_vnd', summary.base_salary_vnd,
        'piecework_vnd', summary.piecework_vnd,
        'basis_points', (floor_policy.parameters->>'base_salary_basis_points')::integer
      ) as formula_snapshot,
      case summary.position_code when 'operations_assistant' then 'Bù trừ lương khoán đến ngưỡng 85% lương cứng.' else 'Bù trừ phần lương khoán chưa vượt lương cứng.' end as note
    from staff_earnings_summary as summary
    join lateral (
      select version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = case summary.position_code
        when 'operations_assistant' then 'operations_piecework_floor'
        when 'admissions_manager' then 'admissions_piecework_floor'
      end and version.effective_from <= v_month_end
      order by version.effective_from desc limit 1
    ) as floor_policy on summary.position_code in ('operations_assistant', 'admissions_manager')
    where least(
      summary.piecework_vnd,
      pg_catalog.round(
        summary.base_salary_vnd::numeric
        * (floor_policy.parameters->>'base_salary_basis_points')::integer
        / 10000
      )::bigint
    ) > 0
  ),
  -- Advances
  advance_deductions as (
    select
      adv.staff_id,
      'advance_deduction' as line_type,
      'deduction' as direction,
      adv.amount_vnd,
      0 as worked_minutes,
      null::bigint as unit_rate_vnd,
      null::text as unit_label,
      'salary_advance' as policy_code,
      'salary_advance' as source_kind,
      adv.id::text as source_id,
      adv.deduction_period_month as work_date,
      false as is_pending_verification,
      pg_catalog.jsonb_build_object('amount_vnd', adv.amount_vnd, 'request_note', adv.request_note) as formula_snapshot,
      'Khấu trừ tạm ứng lương.' as note
    from public.salary_advances as adv
    where adv.deduction_period_month = v_norm_month
      and adv.status in ('approved', 'deducted')
      and (p_target_staff_id is null or adv.staff_id = p_target_staff_id)
  ),
  -- Combined lines
  all_lines as (
    select * from all_earning_lines
    union all
    select * from floor_offsets
    union all
    select * from advance_deductions
  ),
  -- Statement totals per staff (decoupled to eliminate multi-join cartesian fanout)
  staff_entry_aggregates as (
    select
      entry.staff_id,
      coalesce(pg_catalog.sum(entry.worked_minutes), 0)::integer as worked_minutes,
      coalesce(pg_catalog.count(distinct entry.time_entry_id) filter (where entry.is_pending_verification), 0)::integer as pending_verification_count
    from effective_time_entries as entry
    group by entry.staff_id
  ),
  staff_line_aggregates as (
    select
      line.staff_id,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning'), 0)::bigint as total_earnings_vnd,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'), 0)::bigint as total_deductions_vnd,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.line_type = 'advance_deduction'), 0)::bigint as advance_deductions_vnd
    from all_lines as line
    group by line.staff_id
  ),
  statement_aggregates as (
    select
      profile.staff_id,
      profile.staff_display_name,
      profile.staff_employee_code,
      profile.position_code,
      coalesce(entry_agg.worked_minutes, 0)::integer as worked_minutes,
      pg_catalog.floor(coalesce(entry_agg.worked_minutes, 0)::numeric / 540)::integer as work_units,
      pg_catalog.round(coalesce(entry_agg.worked_minutes, 0)::numeric / 60)::integer as work_hours,
      coalesce(line_agg.total_earnings_vnd, 0)::bigint as total_earnings_vnd,
      coalesce(line_agg.total_deductions_vnd, 0)::bigint as total_deductions_vnd,
      coalesce(line_agg.advance_deductions_vnd, 0)::bigint as advance_deductions_vnd,
      (
        coalesce(line_agg.total_earnings_vnd, 0)
        - coalesce(line_agg.total_deductions_vnd, 0)
      )::bigint as payable_vnd,
      coalesce(entry_agg.pending_verification_count, 0)::integer as pending_verification_count
    from eligible_profiles as profile
    left join staff_entry_aggregates as entry_agg on entry_agg.staff_id = profile.staff_id
    left join staff_line_aggregates as line_agg on line_agg.staff_id = profile.staff_id
  ),
  -- Order fact issues
  order_fact_issues as (
    select
      evaluated.issue_code,
      evaluated.staff_id,
      fact.fact_id as source_fact_id,
      pg_catalog.jsonb_build_object(
        'source_key', fact.source_key,
        'fact_type', fact.fact_type,
        'event_date', fact.event_date,
        'amount_vnd', fact.amount_vnd,
        'grade', fact.resolved_grade,
        'source_code', fact.resolved_source_code
      ) as details
    from resolved_order_facts as fact
    cross join lateral (
      select
        case
          when fact.fact_type = 'renewal_order' and fact.resolved_grade is null then 'missing_grade'
          when fact.fact_type = 'renewal_order' and (
            fact.resolved_staff_id is null
            or not exists (
              select 1
              from public.staff_payroll_position_versions as position
              where position.staff_id = fact.resolved_staff_id
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
          when fact.fact_type = 'new_enrollment_order' and fact.resolved_staff_id is null then 'missing_recruiter'
          when fact.fact_type = 'new_enrollment_order' and (
            fact.resolved_source_code is null
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
              where position.staff_id = fact.resolved_staff_id
                and position.effective_from <= fact.event_date
                and policy.parameters->'fixed_by_source' ? fact.resolved_source_code
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
        fact.resolved_staff_id as staff_id
    ) as evaluated
    where evaluated.issue_code is not null
  ),
  -- Timekeeping facts from excel
  timekeeping_fact_issues as (
    select
      'missing_payroll_position' as issue_code,
      fact.staff_id,
      fact.id as source_fact_id,
      pg_catalog.jsonb_build_object('work_date', fact.event_date, 'source', 'excel') as details
    from public.payroll_source_facts as fact
    where fact.fact_type = 'timekeeping'
      and fact.event_date >= v_norm_month
      and fact.event_date <= v_month_end
      and fact.event_date <= v_cutoff_date
      and fact.staff_id is not null
      and not exists (
        select 1 from public.staff_payroll_position_versions as position
        where position.staff_id = fact.staff_id and position.effective_from <= fact.event_date
      )
    union all
    select
      'missing_daily_rate' as issue_code,
      fact.staff_id,
      fact.id as source_fact_id,
      pg_catalog.jsonb_build_object('work_date', fact.event_date, 'source', 'excel') as details
    from public.payroll_source_facts as fact
    where fact.fact_type = 'timekeeping'
      and fact.event_date >= v_norm_month
      and fact.event_date <= v_month_end
      and fact.event_date <= v_cutoff_date
      and fact.staff_id is not null
      and not exists (
        select 1 from public.staff_daily_rate_versions as rate
        where rate.staff_id = fact.staff_id and rate.effective_from <= fact.event_date
      )
  ),
  -- Issues
  detected_issues as (
    -- Missing daily rate from verified time entries
    select distinct
      'missing_daily_rate' as issue_code,
      entry.staff_id,
      null::uuid as source_fact_id,
      pg_catalog.jsonb_build_object('work_date', entry.work_date) as details
    from raw_time_entries as entry
    where not exists (
      select 1 from public.staff_daily_rate_versions as rate
      where rate.staff_id = entry.staff_id and rate.effective_from <= entry.work_date
    )
    union all
    -- Missing payroll position from verified time entries
    select distinct
      'missing_payroll_position' as issue_code,
      entry.staff_id,
      null::uuid as source_fact_id,
      pg_catalog.jsonb_build_object('work_date', entry.work_date) as details
    from raw_time_entries as entry
    where not exists (
      select 1 from public.staff_payroll_position_versions as pos
      where pos.staff_id = entry.staff_id and pos.effective_from <= entry.work_date
    )
    union all
    select * from timekeeping_fact_issues
    union all
    select * from order_fact_issues
  ),
  latest_work as (
    select pg_catalog.max(check_out_at) as latest_completed_work_at
    from raw_time_entries
  )
  select pg_catalog.jsonb_build_object(
    'month', v_norm_month,
    'asOf', v_cutoff,
    'mode', p_mode,
    'latestCompletedWorkAt', (select latest_completed_work_at from latest_work),
    'statements', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'staffId', s.staff_id,
        'staffDisplayName', s.staff_display_name,
        'staffEmployeeCode', s.staff_employee_code,
        'positionCode', s.position_code,
        'workedMinutes', s.worked_minutes,
        'workUnits', s.work_units,
        'workHours', s.work_hours,
        'totalEarningsVnd', s.total_earnings_vnd,
        'totalDeductionsVnd', s.total_deductions_vnd,
        'advanceDeductionsVnd', s.advance_deductions_vnd,
        'payableVnd', s.payable_vnd,
        'pendingVerificationCount', s.pending_verification_count
      ) order by s.position_code, s.staff_display_name)
      from statement_aggregates as s
    ), '[]'::jsonb),
    'lines', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'staffId', l.staff_id,
        'lineType', l.line_type,
        'direction', l.direction,
        'amountVnd', l.amount_vnd,
        'workedMinutes', case when l.line_type in ('base_offline', 'base_online') then l.worked_minutes else 0 end,
        'quantity', case when l.source_kind = 'payroll_source_fact'
          then coalesce((select quantity from public.payroll_source_facts where id::text = l.source_id), 1)
          else l.worked_minutes end,
        'evidenceSnapshot', coalesce((select fact.metadata || jsonb_build_object(
          'order_value_vnd', fact.amount_vnd, 'grade', coalesce(resolved.resolved_grade, fact.grade),
          'event_date', fact.event_date, 'source_key', fact.source_key)
          from public.payroll_source_facts fact
          left join resolved_order_facts resolved on resolved.fact_id = fact.id
          where l.source_kind = 'payroll_source_fact' and fact.id::text = l.source_id), l.formula_snapshot),
        'unitRateVnd', l.unit_rate_vnd,
        'unitLabel', l.unit_label,
        'policyCode', l.policy_code,
        'sourceKind', l.source_kind,
        'sourceId', l.source_id,
        'workDate', l.work_date,
        'isPendingVerification', l.is_pending_verification,
        'formulaSnapshot', l.formula_snapshot,
        'note', l.note
      ) order by l.staff_id, l.direction, l.line_type)
      from all_lines as l
    ), '[]'::jsonb),
    'issues', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'issueCode', i.issue_code,
        'staffId', i.staff_id,
        'sourceFactId', i.source_fact_id,
        'details', i.details
      ))
      from detected_issues as i
      where p_target_staff_id is null or i.staff_id = p_target_staff_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

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
  next_revision integer;
  v_projection jsonb;
  v_statement_id uuid;
  v_statement_map jsonb := '{}'::jsonb;
  s_row jsonb;
  l_row jsonb;
  i_row jsonb;
  v_fingerprint text;
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

  -- 1. Take transaction advisory lock on the month
  perform pg_advisory_xact_lock(hashtext('payroll_engine_' || target_period.period_month::text));

  if target_period.status <> 'draft' then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_DRAFT';
  end if;
  if exists (
    select 1 from public.payroll_correction_requests
    where payroll_period_id = target_period.id and status = 'pending'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_CORRECTION_REQUESTS_PENDING';
  end if;

  -- Sync SePay order facts before calculating final run
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

  -- 2. Call compute_payroll_projection in 'final' mode
  v_projection := public.compute_payroll_projection(target_period.period_month, pg_catalog.now(), 'final', null);

  -- 3. Write statements
  for s_row in select * from jsonb_array_elements(v_projection->'statements')
  loop
    insert into public.payroll_statements (
      payroll_period_id, calculation_run_id, staff_id, staff_display_name_snapshot,
      staff_employee_code_snapshot, work_units, work_hours, work_minutes
    ) values (
      target_period.id,
      created_run.id,
      (s_row->>'staffId')::uuid,
      s_row->>'staffDisplayName',
      s_row->>'staffEmployeeCode',
      (s_row->>'workUnits')::integer,
      (s_row->>'workHours')::integer,
      (s_row->>'workedMinutes')::integer
    ) returning id into v_statement_id;

    v_statement_map := v_statement_map || jsonb_build_object(s_row->>'staffId', v_statement_id::text);
  end loop;

  -- 4. Write line items
  for l_row in select * from jsonb_array_elements(v_projection->'lines')
  loop
    v_statement_id := (v_statement_map->>(l_row->>'staffId'))::uuid;
    if v_statement_id is not null then
      insert into public.payroll_line_items (
        payroll_statement_id, line_type, direction, amount_vnd, work_minutes, quantity,
        unit_rate_vnd, unit_label, policy_code, source_kind, source_id,
        formula_snapshot, evidence_snapshot, note, created_by,
        salary_advance_id
      ) values (
        v_statement_id,
        l_row->>'lineType',
        l_row->>'direction',
        (l_row->>'amountVnd')::bigint,
        (l_row->>'workedMinutes')::integer,
        (l_row->>'quantity')::numeric,
        (l_row->>'unitRateVnd')::bigint,
        l_row->>'unitLabel',
        l_row->>'policyCode',
        l_row->>'sourceKind',
        l_row->>'sourceId',
        l_row->'formulaSnapshot',
        coalesce(l_row->'evidenceSnapshot', '{}'::jsonb),
        l_row->>'note',
        actor_id,
        case when l_row->>'sourceKind' = 'salary_advance' then (l_row->>'sourceId')::uuid else null end
      );
    end if;
  end loop;

  -- 5. Carry manual lines from previous run
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

  -- 6. Write issues
  for i_row in select * from jsonb_array_elements(v_projection->'issues')
  loop
    insert into public.payroll_calculation_issues (
      calculation_run_id, issue_code, source_fact_id, staff_id, details
    ) values (
      created_run.id,
      i_row->>'issueCode',
      (i_row->>'sourceFactId')::uuid,
      (i_row->>'staffId')::uuid,
      i_row->'details'
    );
  end loop;

  -- 7. Mark salary advances deducted
  update public.salary_advances
  set status = 'deducted', deducted_at = pg_catalog.now(), deduction_payroll_period_id = target_period.id
  where status = 'approved'
    and deduction_period_month = target_period.period_month
    and exists (
      select 1 from public.payroll_statements as statement
      where statement.calculation_run_id = created_run.id
        and statement.staff_id = salary_advances.staff_id
    );

  -- 8. Compute and record input fingerprint
  v_fingerprint := pg_catalog.md5(v_projection::text);

  insert into public.payroll_source_revisions (month, revision, input_fingerprint, updated_at)
  values (target_period.period_month, next_revision, v_fingerprint, pg_catalog.now())
  on conflict (month)
  do update set revision = public.payroll_source_revisions.revision + 1, input_fingerprint = v_fingerprint, updated_at = pg_catalog.now();

  -- 9. Update target payroll period
  update public.payroll_periods
  set
    current_calculation_run_id = created_run.id,
    feedback_opened_at = pg_catalog.now(),
    feedback_closed_at = null,
    feedback_closed_by = null
  where id = target_period.id;

  -- 10. Bump live revisions for owner and staff
  perform public.bump_payroll_live_revision(target_period.period_month, 'owner', null);

  return created_run;
end;
$$;

commit;
