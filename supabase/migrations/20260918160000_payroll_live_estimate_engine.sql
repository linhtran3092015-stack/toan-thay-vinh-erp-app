-- Migration: Payroll Live Estimate Engine & Read Projections (Phương án B)
-- Date: 2026-09-18
begin;

-- ============================================================================
-- 1. Tables: Revision Tracking & Live Notification Markers
-- ============================================================================

create table if not exists public.payroll_source_revisions (
  month date primary key,
  revision bigint not null default 1,
  input_fingerprint text,
  updated_at timestamptz not null default pg_catalog.now()
);
alter table public.payroll_source_revisions enable row level security;
revoke all on public.payroll_source_revisions from public, anon, authenticated;

create table if not exists public.payroll_live_revisions (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  scope text not null check (scope in ('owner', 'staff')),
  staff_id uuid references public.profiles(id) on delete cascade,
  revision bigint not null default 1,
  changed_at timestamptz not null default pg_catalog.now()
);

create unique index if not exists payroll_live_revisions_scope_idx
  on public.payroll_live_revisions (month, scope, coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.payroll_live_revisions enable row level security;
revoke all on public.payroll_live_revisions from public, anon, authenticated;

create policy payroll_live_revisions_select on public.payroll_live_revisions
  for select to authenticated
  using (
    (scope = 'staff' and staff_id = auth.uid() and public.has_permission('payroll.view'))
    or
    (scope = 'owner' and public.has_permission('payroll.dashboard.view'))
  );

grant select on public.payroll_live_revisions to authenticated;

-- Add to Realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.payroll_live_revisions;
  end if;
exception when others then
  null;
end $$;

-- Helper to bump live marker
create or replace function public.bump_payroll_live_revision(
  p_month date,
  p_scope text,
  p_staff_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_norm_month date := pg_catalog.date_trunc('month', p_month)::date;
begin
  if v_norm_month is null then
    return;
  end if;

  insert into public.payroll_live_revisions (month, scope, staff_id, revision, changed_at)
  values (v_norm_month, p_scope, p_staff_id, 1, pg_catalog.now())
  on conflict (month, scope, coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set revision = public.payroll_live_revisions.revision + 1, changed_at = pg_catalog.now();
end;
$$;
revoke all on function public.bump_payroll_live_revision(date, text, uuid) from public, anon, authenticated;

-- ============================================================================
-- 2. Pure Read-Only Projection Engine: compute_payroll_projection
-- ============================================================================

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
  eligible_profiles as (
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
    where p_target_staff_id is null or position.staff_id = p_target_staff_id
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
      review.status as exception_review_status,
      adjustment.requested_check_in_at,
      adjustment.requested_check_in_mode,
      adjustment.requested_check_out_at
    from public.time_entries as entry
    left join public.attendance_exception_reviews as review
      on review.time_entry_id = entry.id
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
          when v_is_final then (review.status is null or review.status = 'approved')
          else (review.status is null or review.status in ('approved', 'pending'))
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
      (entry.exception_review_status = 'pending') as is_pending_verification,
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
      ) as resolved_grade,
      case
        when fact.fact_type = 'renewal_order' then coalesce(
          (
            select assignment.staff_id
            from public.staff_grade_assignments as assignment
            where assignment.grade = coalesce(fact.grade, (
              select class_row.grade from public.student_enrollments as enr join public.classes as class_row on class_row.id = enr.class_id where enr.student_id = fact.student_id order by enr.effective_from desc limit 1
            ))
              and assignment.effective_from <= fact.event_date
              and (assignment.effective_to is null or assignment.effective_to >= fact.event_date)
            order by assignment.effective_from desc, assignment.id desc
            limit 1
          ),
          fact.staff_id
        )
        else fact.staff_id
      end as resolved_staff_id,
      coalesce(
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
      ) as resolved_source_code
    from public.payroll_source_facts as fact
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
      )
      and exists (
        select 1 from public.staff_payroll_task_versions as task
        where task.staff_id = coaching.assistant_owner_id and task.task_code = 'student_coaching'
          and task.effective_from <= fact.event_date and task.is_enabled
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
      policy.parameters as formula_snapshot,
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
      summary.position_code,
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
  -- Statement totals per staff
  statement_aggregates as (
    select
      profile.staff_id,
      profile.staff_display_name,
      profile.staff_employee_code,
      profile.position_code,
      coalesce(pg_catalog.sum(entry.worked_minutes), 0)::integer as worked_minutes,
      pg_catalog.floor(coalesce(pg_catalog.sum(entry.worked_minutes), 0)::numeric / 540)::integer as work_units,
      pg_catalog.round(coalesce(pg_catalog.sum(entry.worked_minutes), 0)::numeric / 60)::integer as work_hours,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning'), 0)::bigint as total_earnings_vnd,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'), 0)::bigint as total_deductions_vnd,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.line_type = 'advance_deduction'), 0)::bigint as advance_deductions_vnd,
      (
        coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning'), 0)
        - coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'), 0)
      )::bigint as payable_vnd,
      coalesce(pg_catalog.count(distinct entry.time_entry_id) filter (where entry.is_pending_verification), 0)::integer as pending_verification_count
    from eligible_profiles as profile
    left join effective_time_entries as entry on entry.staff_id = profile.staff_id
    left join all_lines as line on line.staff_id = profile.staff_id
    group by profile.staff_id, profile.staff_display_name, profile.staff_employee_code, profile.position_code
  ),
  -- Issues
  detected_issues as (
    -- Missing daily rate
    select distinct
      'missing_daily_rate' as issue_code,
      entry.staff_id,
      pg_catalog.jsonb_build_object('work_date', entry.work_date) as details
    from raw_time_entries as entry
    where not exists (
      select 1 from public.staff_daily_rate_versions as rate
      where rate.staff_id = entry.staff_id and rate.effective_from <= entry.work_date
    )
    union all
    -- Missing payroll position
    select distinct
      'missing_payroll_position' as issue_code,
      entry.staff_id,
      pg_catalog.jsonb_build_object('work_date', entry.work_date) as details
    from raw_time_entries as entry
    where not exists (
      select 1 from public.staff_payroll_position_versions as pos
      where pos.staff_id = entry.staff_id and pos.effective_from <= entry.work_date
    )
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
        'workedMinutes', l.worked_minutes,
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
        'details', i.details
      ))
      from detected_issues as i
      where p_target_staff_id is null or i.staff_id = p_target_staff_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.compute_payroll_projection(date, timestamptz, text, uuid) from public, anon, authenticated;

-- ============================================================================
-- 3. Public RPC: get_my_payroll_estimate (Staff)
-- ============================================================================

create or replace function public.get_my_payroll_estimate(p_month date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_norm_month date := pg_catalog.date_trunc('month', p_month)::date;
  v_period public.payroll_periods%rowtype;
  v_projection jsonb;
  v_statement jsonb;
  v_lines jsonb;
  v_issues jsonb;
  v_latest_work timestamptz;
  v_status text := 'estimated';
  v_approved_statement public.payroll_statements%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.view') then
    raise exception using errcode = '42501', message = 'PAYROLL_VIEW_PERMISSION_REQUIRED';
  end if;

  if p_month is null or p_month <> v_norm_month then
    raise exception using errcode = '22023', message = 'PAYROLL_MONTH_INVALID';
  end if;

  -- Check if period exists and is approved
  select * into v_period
  from public.payroll_periods
  where period_month = v_norm_month;

  if found and v_period.status = 'approved' then
    v_status := 'approved';
    -- Fetch approved immutable snapshot
    select * into v_approved_statement
    from public.payroll_statements
    where payroll_period_id = v_period.id
      and calculation_run_id = v_period.current_calculation_run_id
      and staff_id = actor_id;

    if found then
      return pg_catalog.jsonb_build_object(
        'month', v_norm_month,
        'asOf', pg_catalog.now(),
        'calculatedAt', v_period.approved_at,
        'status', 'approved',
        'completeness', 'complete',
        'payrollPeriodId', v_period.id,
        'approvedAt', v_period.approved_at,
        'payrollStatementId', v_approved_statement.id,
        'statement', pg_catalog.jsonb_build_object(
          'staffId', actor_id,
          'staffDisplayName', v_approved_statement.staff_display_name_snapshot,
          'staffEmployeeCode', v_approved_statement.staff_employee_code_snapshot,
          'workedMinutes', v_approved_statement.work_minutes,
          'workUnits', v_approved_statement.work_units,
          'workHours', v_approved_statement.work_hours,
          'totalEarningsVnd', (select coalesce(sum(amount_vnd), 0) from public.payroll_line_items where payroll_statement_id = v_approved_statement.id and direction = 'earning'),
          'totalDeductionsVnd', (select coalesce(sum(amount_vnd), 0) from public.payroll_line_items where payroll_statement_id = v_approved_statement.id and direction = 'deduction'),
          'advanceDeductionsVnd', (select coalesce(sum(amount_vnd), 0) from public.payroll_line_items where payroll_statement_id = v_approved_statement.id and line_type = 'advance_deduction'),
          'payableVnd', (
            (select coalesce(sum(amount_vnd), 0) from public.payroll_line_items where payroll_statement_id = v_approved_statement.id and direction = 'earning')
            - (select coalesce(sum(amount_vnd), 0) from public.payroll_line_items where payroll_statement_id = v_approved_statement.id and direction = 'deduction')
          ),
          'pendingVerificationCount', 0
        ),
        'lines', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'lineType', line.line_type,
            'direction', line.direction,
            'amountVnd', line.amount_vnd,
            'workedMinutes', line.work_minutes,
            'unitRateVnd', line.unit_rate_vnd,
            'unitLabel', line.unit_label,
            'policyCode', line.policy_code,
            'note', line.note
          ))
          from public.payroll_line_items as line
          where line.payroll_statement_id = v_approved_statement.id
        ), '[]'::jsonb),
        'issues', '[]'::jsonb,
        'recentShifts', '[]'::jsonb
      );
    end if;
  end if;

  -- Compute live estimate
  v_projection := public.compute_payroll_projection(v_norm_month, pg_catalog.now(), 'estimate', actor_id);
  v_statement := coalesce((v_projection->'statements')->0, 'null'::jsonb);
  v_lines := coalesce(v_projection->'lines', '[]'::jsonb);
  v_issues := coalesce(v_projection->'issues', '[]'::jsonb);
  v_latest_work := (v_projection->>'latestCompletedWorkAt')::timestamptz;

  return pg_catalog.jsonb_build_object(
    'month', v_norm_month,
    'asOf', pg_catalog.now(),
    'calculatedAt', pg_catalog.now(),
    'status', 'estimated',
    'completeness', case when jsonb_array_length(v_issues) > 0 then 'partial' else 'complete' end,
    'latestCompletedWorkAt', v_latest_work,
    'statement', v_statement,
    'lines', v_lines,
    'issues', v_issues,
    'recentShifts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', entry.id,
        'workDate', entry.work_date,
        'checkInAt', entry.check_in_at,
        'checkOutAt', entry.check_out_at,
        'workMode', entry.check_in_mode,
        'isPendingVerification', not public.time_entry_is_verified(entry.id),
        'workedMinutes', greatest(0, pg_catalog.floor(extract(epoch from (entry.check_out_at - entry.check_in_at)) / 60)::integer)
      ) order by entry.work_date desc, entry.check_out_at desc)
      from public.time_entries as entry
      where entry.staff_id = actor_id
        and entry.work_date >= v_norm_month
        and entry.work_date < (v_norm_month + interval '1 month')::date
        and entry.check_out_at is not null
      limit 5
    ), '[]'::jsonb),
    'openShifts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', entry.id,
        'workDate', entry.work_date,
        'checkInAt', entry.check_in_at,
        'workMode', entry.check_in_mode
      ))
      from public.time_entries as entry
      where entry.staff_id = actor_id and entry.status = 'open'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_payroll_estimate(date) from public, anon;
grant execute on function public.get_my_payroll_estimate(date) to authenticated;

-- ============================================================================
-- 4. Public RPC: get_owner_payroll_estimate (Owner)
-- ============================================================================

create or replace function public.get_owner_payroll_estimate(
  p_month date,
  p_position_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_norm_month date := pg_catalog.date_trunc('month', p_month)::date;
  v_month_end date := (pg_catalog.date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_period public.payroll_periods%rowtype;
  v_projection jsonb;
  v_can_view_finance boolean := false;
  v_tuition_received bigint := 0;
  v_tuition_refunded bigint := 0;
  v_tuition_net bigint := 0;
  v_finance_as_of timestamptz := pg_catalog.now();
  v_statements jsonb;
  v_filtered_statements jsonb;
  v_position_summary jsonb;
  v_issues jsonb;
  v_total_earnings bigint := 0;
  v_total_deductions bigint := 0;
  v_total_advances bigint := 0;
  v_total_payable bigint := 0;
  v_pending_count integer := 0;
  v_ratio_percent numeric := null;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.dashboard.view') then
    raise exception using errcode = '42501', message = 'PAYROLL_DASHBOARD_VIEW_PERMISSION_REQUIRED';
  end if;

  if p_month is null or p_month <> v_norm_month then
    raise exception using errcode = '22023', message = 'PAYROLL_MONTH_INVALID';
  end if;

  v_can_view_finance := public.has_permission('finance.view') or public.has_permission('cashflow.view');

  -- Calculate finance net tuition
  if v_can_view_finance then
    select
      coalesce(sum(amount_vnd) filter (where record_type = 'receipt' and category = 'tuition_fee'), 0)::bigint,
      coalesce(sum(amount_vnd) filter (where record_type = 'refund' and category = 'refund' and student_id is not null), 0)::bigint
    into v_tuition_received, v_tuition_refunded
    from public.finance_cashflow_records
    where created_at >= v_norm_month
      and created_at < (v_norm_month + interval '1 month')::date
      and created_at <= v_finance_as_of;

    v_tuition_net := v_tuition_received - v_tuition_refunded;
  end if;

  -- Check if period is approved
  select * into v_period
  from public.payroll_periods
  where period_month = v_norm_month;

  if found and v_period.status = 'approved' then
    -- Read from approved snapshot
    with approved_statements as (
      select
        s.staff_id,
        s.staff_display_name_snapshot as staff_display_name,
        s.staff_employee_code_snapshot as staff_employee_code,
        pos.position_code,
        s.work_minutes as worked_minutes,
        s.work_units,
        s.work_hours,
        coalesce(sum(l.amount_vnd) filter (where l.direction = 'earning'), 0)::bigint as total_earnings_vnd,
        coalesce(sum(l.amount_vnd) filter (where l.direction = 'deduction'), 0)::bigint as total_deductions_vnd,
        coalesce(sum(l.amount_vnd) filter (where l.line_type = 'advance_deduction'), 0)::bigint as advance_deductions_vnd,
        (
          coalesce(sum(l.amount_vnd) filter (where l.direction = 'earning'), 0)
          - coalesce(sum(l.amount_vnd) filter (where l.direction = 'deduction'), 0)
        )::bigint as payable_vnd
      from public.payroll_statements as s
      left join lateral (
        select position_code from public.staff_payroll_position_versions
        where staff_id = s.staff_id and effective_from <= v_month_end
        order by effective_from desc limit 1
      ) as pos on true
      left join public.payroll_line_items as l on l.payroll_statement_id = s.id
      where s.payroll_period_id = v_period.id and s.calculation_run_id = v_period.current_calculation_run_id
      group by s.id, s.staff_id, s.staff_display_name_snapshot, s.staff_employee_code_snapshot, pos.position_code, s.work_minutes, s.work_units, s.work_hours
    )
    select
      coalesce(sum(total_earnings_vnd), 0)::bigint,
      coalesce(sum(total_deductions_vnd), 0)::bigint,
      coalesce(sum(advance_deductions_vnd), 0)::bigint,
      coalesce(sum(payable_vnd), 0)::bigint,
      coalesce(jsonb_agg(jsonb_build_object(
        'staffId', staff_id,
        'staffDisplayName', staff_display_name,
        'staffEmployeeCode', staff_employee_code,
        'positionCode', position_code,
        'workedMinutes', worked_minutes,
        'workUnits', work_units,
        'workHours', work_hours,
        'totalEarningsVnd', total_earnings_vnd,
        'totalDeductionsVnd', total_deductions_vnd,
        'advanceDeductionsVnd', advance_deductions_vnd,
        'payableVnd', payable_vnd,
        'pendingVerificationCount', 0
      ) order by position_code, staff_display_name), '[]'::jsonb)
    into v_total_earnings, v_total_deductions, v_total_advances, v_total_payable, v_statements
    from approved_statements
    where p_position_code is null or position_code = p_position_code;

    if v_can_view_finance and v_tuition_net > 0 then
      v_ratio_percent := pg_catalog.round(v_total_payable::numeric * 100 / v_tuition_net::numeric, 1);
    end if;

    return pg_catalog.jsonb_build_object(
      'month', v_norm_month,
      'asOf', pg_catalog.now(),
      'status', 'approved',
      'completeness', 'complete',
      'payrollPeriodId', v_period.id,
      'approvedAt', v_period.approved_at,
      'payrollSourceCutoff', v_period.approved_at,
      'financeAsOf', v_finance_as_of,
      'selectedPositionCode', p_position_code,
      'summary', pg_catalog.jsonb_build_object(
        'totalEarningsVnd', v_total_earnings,
        'totalDeductionsVnd', v_total_deductions,
        'advanceDeductionsVnd', v_total_advances,
        'payableVnd', v_total_payable,
        'staffCount', jsonb_array_length(v_statements),
        'pendingVerificationCount', 0
      ),
      'finance', case when v_can_view_finance then pg_catalog.jsonb_build_object(
        'status', 'available',
        'tuitionReceivedVnd', v_tuition_received,
        'tuitionRefundedVnd', v_tuition_refunded,
        'tuitionNetVnd', v_tuition_net,
        'payrollRatioPercent', v_ratio_percent
      ) else pg_catalog.jsonb_build_object('status', 'restricted') end,
      'statements', v_statements,
      'issues', '[]'::jsonb
    );
  end if;

  -- Live estimate calculation
  v_projection := public.compute_payroll_projection(v_norm_month, pg_catalog.now(), 'estimate', null);
  v_statements := coalesce(v_projection->'statements', '[]'::jsonb);
  v_issues := coalesce(v_projection->'issues', '[]'::jsonb);

  -- Aggregate summary (optionally filtered by position)
  with st as (
    select *
    from jsonb_to_recordset(v_statements) as x(
      "staffId" uuid,
      "staffDisplayName" text,
      "staffEmployeeCode" text,
      "positionCode" text,
      "workedMinutes" integer,
      "workUnits" integer,
      "workHours" integer,
      "totalEarningsVnd" bigint,
      "totalDeductionsVnd" bigint,
      "advanceDeductionsVnd" bigint,
      "payableVnd" bigint,
      "pendingVerificationCount" integer
    )
  ),
  filtered as (
    select * from st
    where p_position_code is null or "positionCode" = p_position_code
  ),
  pos_grouped as (
    select
      coalesce("positionCode", '__unassigned__') as pos_code,
      count(*)::integer as staff_cnt,
      sum("totalEarningsVnd")::bigint as earnings_sum,
      sum("totalDeductionsVnd")::bigint as deductions_sum,
      sum("payableVnd")::bigint as payable_sum
    from st
    group by "positionCode"
  )
  select
    coalesce(sum("totalEarningsVnd"), 0)::bigint,
    coalesce(sum("totalDeductionsVnd"), 0)::bigint,
    coalesce(sum("advanceDeductionsVnd"), 0)::bigint,
    coalesce(sum("payableVnd"), 0)::bigint,
    coalesce(sum("pendingVerificationCount"), 0)::integer,
    coalesce(jsonb_agg(to_jsonb(filtered.*)), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'positionCode', pos_code,
        'staffCount', staff_cnt,
        'totalEarningsVnd', earnings_sum,
        'totalDeductionsVnd', deductions_sum,
        'payableVnd', payable_sum
      ) order by pos_code) from pos_grouped
    ), '[]'::jsonb)
  into v_total_earnings, v_total_deductions, v_total_advances, v_total_payable, v_pending_count, v_filtered_statements, v_position_summary
  from filtered;

  if v_can_view_finance and v_tuition_net > 0 then
    v_ratio_percent := pg_catalog.round(v_total_payable::numeric * 100 / v_tuition_net::numeric, 1);
  end if;

  return pg_catalog.jsonb_build_object(
    'month', v_norm_month,
    'asOf', pg_catalog.now(),
    'calculatedAt', pg_catalog.now(),
    'status', 'estimated',
    'completeness', case when jsonb_array_length(v_issues) > 0 then 'partial' else 'complete' end,
    'latestCompletedWorkAt', (v_projection->>'latestCompletedWorkAt')::timestamptz,
    'selectedPositionCode', p_position_code,
    'summary', pg_catalog.jsonb_build_object(
      'totalEarningsVnd', v_total_earnings,
      'totalDeductionsVnd', v_total_deductions,
      'advanceDeductionsVnd', v_total_advances,
      'payableVnd', v_total_payable,
      'staffCount', jsonb_array_length(v_filtered_statements),
      'pendingVerificationCount', v_pending_count
    ),
    'byPosition', v_position_summary,
    'finance', case when v_can_view_finance then pg_catalog.jsonb_build_object(
      'status', 'available',
      'tuitionReceivedVnd', v_tuition_received,
      'tuitionRefundedVnd', v_tuition_refunded,
      'tuitionNetVnd', v_tuition_net,
      'payrollRatioPercent', v_ratio_percent
    ) else pg_catalog.jsonb_build_object('status', 'restricted') end,
    'statements', v_filtered_statements,
    'issues', v_issues
  );
end;
$$;

revoke all on function public.get_owner_payroll_estimate(date, text) from public, anon;
grant execute on function public.get_owner_payroll_estimate(date, text) to authenticated;

-- ============================================================================
-- 5. Refactor Writer: generate_payroll_calculation_run with Advisory Lock
-- ============================================================================

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
        (l_row->>'workedMinutes')::numeric,
        (l_row->>'unitRateVnd')::bigint,
        l_row->>'unitLabel',
        l_row->>'policyCode',
        l_row->>'sourceKind',
        l_row->>'sourceId',
        l_row->'formulaSnapshot',
        '{}'::jsonb,
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
      calculation_run_id, issue_code, staff_id, details
    ) values (
      created_run.id,
      i_row->>'issueCode',
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

revoke all on function public.generate_payroll_calculation_run(uuid, text) from public, anon;
grant execute on function public.generate_payroll_calculation_run(uuid, text) to authenticated;

-- ============================================================================
-- 6. Realtime Notification Triggers on Source Tables
-- ============================================================================

create or replace function public.trig_bump_payroll_live_time_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.bump_payroll_live_revision(old.work_date, 'owner', null);
    perform public.bump_payroll_live_revision(old.work_date, 'staff', old.staff_id);
  else
    perform public.bump_payroll_live_revision(new.work_date, 'owner', null);
    perform public.bump_payroll_live_revision(new.work_date, 'staff', new.staff_id);
    if tg_op = 'UPDATE' and old.work_date <> new.work_date then
      perform public.bump_payroll_live_revision(old.work_date, 'owner', null);
      perform public.bump_payroll_live_revision(old.work_date, 'staff', old.staff_id);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.trig_bump_payroll_live_time_entry() from public, anon, authenticated;

drop trigger if exists time_entries_bump_payroll_live on public.time_entries;
create trigger time_entries_bump_payroll_live
  after insert or update or delete on public.time_entries
  for each row execute function public.trig_bump_payroll_live_time_entry();

drop trigger if exists attendance_exception_reviews_bump_payroll_live on public.attendance_exception_reviews;
create or replace function public.trig_bump_payroll_live_attendance_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.time_entries%rowtype;
begin
  select * into v_entry from public.time_entries where id = coalesce(new.time_entry_id, old.time_entry_id);
  if found then
    perform public.bump_payroll_live_revision(v_entry.work_date, 'owner', null);
    perform public.bump_payroll_live_revision(v_entry.work_date, 'staff', v_entry.staff_id);
  end if;
  return coalesce(new, old);
end;
$$;
create trigger attendance_exception_reviews_bump_payroll_live
  after insert or update or delete on public.attendance_exception_reviews
  for each row execute function public.trig_bump_payroll_live_attendance_review();

drop trigger if exists salary_advances_bump_payroll_live on public.salary_advances;
create or replace function public.trig_bump_payroll_live_advances()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.bump_payroll_live_revision(old.deduction_period_month, 'owner', null);
    perform public.bump_payroll_live_revision(old.deduction_period_month, 'staff', old.staff_id);
  else
    perform public.bump_payroll_live_revision(new.deduction_period_month, 'owner', null);
    perform public.bump_payroll_live_revision(new.deduction_period_month, 'staff', new.staff_id);
  end if;
  return coalesce(new, old);
end;
$$;
create trigger salary_advances_bump_payroll_live
  after insert or update or delete on public.salary_advances
  for each row execute function public.trig_bump_payroll_live_advances();

commit;
