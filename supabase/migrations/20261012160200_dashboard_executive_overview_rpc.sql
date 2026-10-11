-- KPI dashboard tổng quan tính bằng SQL thay vì tải nguyên bảng về máy chủ ứng dụng.
--
-- Trước đây src/features/dashboard/data.ts kéo toàn bộ students, finance_cashflow_
-- records, student_payment_requests, crm_cases, classes, student_enrollments,
-- class_sessions, profiles... rồi đếm bằng TypeScript; vài truy vấn còn sai tên
-- cột (payroll_periods.month, payroll_statements.period_id, payroll_import_
-- batches.status = 'conflicted') nên thẻ Quỹ lương luôn lỗi và quỹ lương bị
-- ước lượng 5.500.000 đ/người. RPC này trả một jsonb gồm từng mục; mục nào
-- người gọi không có quyền thì null (ứng dụng ẩn mục đó). Doanh thu theo
-- effective_on (ngày tiền về), quỹ lương lấy từ dòng lương thật của lần tính
-- hiện hành.

begin;

create or replace function public.get_dashboard_executive_overview(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_month date;
  v_next date;
  v_prev date;
  v_year_start date;
  v_year_end date;
  can_finance boolean;
  can_payments boolean;
  can_students boolean;
  can_classes boolean;
  can_crm boolean;
  can_sessions boolean;
  can_grading boolean;
  can_coaching boolean;
  can_staff boolean;
  can_payroll_view boolean;
  can_payroll_fund boolean;
  can_advances boolean;
  can_timekeeping boolean;
  v_kpis jsonb;
  v_attention jsonb;
  v_trend jsonb;
  v_composition jsonb;
  v_top_classes jsonb;
  v_funnel jsonb;
  v_student_status jsonb;
  v_receivables jsonb;
  v_payroll jsonb;
  v_operations jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  v_month := pg_catalog.date_trunc('month', coalesce(p_month, v_today))::date;
  v_next := (v_month + interval '1 month')::date;
  v_prev := (v_month - interval '1 month')::date;
  v_year_start := pg_catalog.date_trunc('year', v_month)::date;
  v_year_end := (v_year_start + interval '1 year')::date;

  can_finance := public.has_permission('finance.view') or public.has_permission('cashflow.view');
  can_payments := public.has_permission('payments.view');
  can_students := public.has_permission('students.view');
  can_classes := public.has_permission('classes.view');
  can_crm := public.has_permission('crm.view');
  can_sessions := public.has_permission('sessions.view');
  can_grading := public.has_permission('grading_credits.view');
  can_coaching := public.has_permission('coaching.view');
  can_staff := public.has_permission('staff.view');
  can_payroll_view := public.has_permission('payroll.view');
  can_payroll_fund := public.has_permission('payroll.manage')
    or public.has_permission('payroll.accountant_reconcile')
    or public.has_permission('payroll.owner_approve')
    or public.has_permission('payroll.dashboard.view');
  can_advances := public.has_permission('advances.view');
  can_timekeeping := public.has_permission('timekeeping.view')
    or public.has_permission('timekeeping.approve_adjustment');

  -- 1. KPI đầu trang
  if can_finance or can_payments or can_students then
    select pg_catalog.jsonb_build_object(
      'students', case when can_students then (
        select pg_catalog.jsonb_build_object(
          'active_count', pg_catalog.count(*) filter (where student.lifecycle_status in ('active', 'resumed')),
          'total_count', pg_catalog.count(*),
          'created_before_month_count', pg_catalog.count(*) filter (
            where (student.created_at at time zone 'Asia/Ho_Chi_Minh')::date < v_month
          )
        )
        from public.students as student
      ) end,
      'cashflow', case when can_finance or can_payments then (
        select pg_catalog.jsonb_build_object(
          'revenue_vnd', coalesce(pg_catalog.sum(cashflow.amount_vnd) filter (
            where cashflow.record_type = 'receipt' and cashflow.effective_on >= v_month and cashflow.effective_on < v_next), 0),
          'disbursement_vnd', coalesce(pg_catalog.sum(cashflow.amount_vnd) filter (
            where cashflow.record_type = 'disbursement' and cashflow.effective_on >= v_month and cashflow.effective_on < v_next), 0),
          'refund_vnd', coalesce(pg_catalog.sum(cashflow.amount_vnd) filter (
            where cashflow.record_type = 'refund' and cashflow.effective_on >= v_month and cashflow.effective_on < v_next), 0),
          'prev_revenue_vnd', coalesce(pg_catalog.sum(cashflow.amount_vnd) filter (
            where cashflow.record_type = 'receipt' and cashflow.effective_on >= v_prev and cashflow.effective_on < v_month), 0),
          'prev_disbursement_vnd', coalesce(pg_catalog.sum(cashflow.amount_vnd) filter (
            where cashflow.record_type = 'disbursement' and cashflow.effective_on >= v_prev and cashflow.effective_on < v_month), 0),
          'prev_refund_vnd', coalesce(pg_catalog.sum(cashflow.amount_vnd) filter (
            where cashflow.record_type = 'refund' and cashflow.effective_on >= v_prev and cashflow.effective_on < v_month), 0),
          'receivables_vnd', (
            select coalesce(pg_catalog.sum(request.expected_amount_vnd - request.paid_amount_vnd), 0)
            from public.student_payment_requests as request
            where request.status in ('pending', 'partially_paid')
              and request.expected_amount_vnd > request.paid_amount_vnd
          )
        )
        from public.finance_cashflow_records as cashflow
        where cashflow.effective_on >= v_prev and cashflow.effective_on < v_next
      ) end
    )
    into v_kpis;
  end if;

  -- 2. Việc cần chú ý (chỉ số đếm; nhãn do ứng dụng giữ)
  select pg_catalog.jsonb_build_object(
    'payroll_review', case when can_payroll_view then (
      select pg_catalog.count(*) from public.payroll_periods where status = 'review') end,
    'advances_pending', case when can_advances then (
      select pg_catalog.count(*) from public.salary_advances where status in ('requested', 'review')) end,
    'timekeeping_adjustments_pending', case when can_timekeeping then (
      select pg_catalog.count(*) from public.time_entry_adjustment_requests where status = 'pending') end,
    'payments_overdue', case when can_payments or can_finance then (
      select pg_catalog.count(*) from public.student_payment_requests
      where status = 'pending' and created_at < pg_catalog.now() - interval '14 days') end,
    'coaching_urgent', case when can_coaching then (
      select pg_catalog.count(*)
      from public.coaching_records as coaching
      left join lateral (
        select event.status
        from public.coaching_record_events as event
        where event.coaching_record_id = coaching.id and event.status is not null
        order by event.event_sequence desc
        limit 1
      ) as latest on true
      where coaching.priority = 'high'
        and coalesce(latest.status, 'open') in ('open', 'in_progress')) end,
    'import_conflicted', case when can_payroll_view or public.has_permission('payroll.import') then (
      select pg_catalog.count(*) from public.payroll_import_batches
      where status = 'pending_review' and conflict_rows > 0) end
  )
  into v_attention;

  -- 3. Doanh thu & chi phí 12 tháng của năm chọn
  if can_finance then
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'month', pg_catalog.to_char(month_start, 'YYYY-MM'),
      'revenue_vnd', coalesce(totals.revenue_vnd, 0),
      'cost_vnd', coalesce(totals.cost_vnd, 0),
      'refund_vnd', coalesce(totals.refund_vnd, 0)
    ) order by month_start)
    into v_trend
    from pg_catalog.generate_series(v_year_start, v_year_end - interval '1 month', interval '1 month') as month_start
    left join lateral (
      select
        pg_catalog.sum(cashflow.amount_vnd) filter (where cashflow.record_type = 'receipt') as revenue_vnd,
        pg_catalog.sum(cashflow.amount_vnd) filter (where cashflow.record_type = 'disbursement') as cost_vnd,
        pg_catalog.sum(cashflow.amount_vnd) filter (where cashflow.record_type = 'refund') as refund_vnd
      from public.finance_cashflow_records as cashflow
      where cashflow.effective_on >= month_start::date
        and cashflow.effective_on < (month_start + interval '1 month')::date
    ) as totals on true;

    -- 4. Cơ cấu doanh thu tháng theo loại thu
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'category', grouped.category,
      'amount_vnd', grouped.amount_vnd
    ) order by grouped.amount_vnd desc, grouped.category), '[]'::jsonb)
    into v_composition
    from (
      select cashflow.category, pg_catalog.sum(cashflow.amount_vnd) as amount_vnd
      from public.finance_cashflow_records as cashflow
      where cashflow.record_type = 'receipt'
        and cashflow.effective_on >= v_month and cashflow.effective_on < v_next
      group by cashflow.category
    ) as grouped;
  end if;

  -- 5. Lớp đông nhất theo ghi danh đang hiệu lực
  if can_classes or can_students then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', ranked.id,
      'code', ranked.code,
      'name', ranked.name,
      'student_count', ranked.student_count
    ) order by ranked.student_count desc, ranked.name), '[]'::jsonb)
    into v_top_classes
    from (
      select class_row.id, class_row.code, class_row.name,
        (
          select pg_catalog.count(*)
          from public.student_enrollments as enrollment
          where enrollment.class_id = class_row.id
            and enrollment.status = 'active'
            and enrollment.effective_to is null
        ) as student_count
      from public.classes as class_row
      order by 4 desc, class_row.name
      limit 5
    ) as ranked;
  end if;

  -- 6. Phễu tuyển sinh
  if can_crm then
    select pg_catalog.jsonb_build_object(
      'total', pg_catalog.count(*),
      'trial_booked_or_later', pg_catalog.count(*) filter (where crm_case.status in
        ('trial_booked', 'trial_completed', 'pending_enrollment_confirmation', 'converted')),
      'trial_completed_or_later', pg_catalog.count(*) filter (where crm_case.status in
        ('trial_completed', 'pending_enrollment_confirmation', 'converted')),
      'pending_confirmation_or_later', pg_catalog.count(*) filter (where crm_case.status in
        ('pending_enrollment_confirmation', 'converted')),
      'converted', pg_catalog.count(*) filter (where crm_case.status = 'converted'),
      'top_sources', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'name', grouped.source_name, 'count', grouped.case_count
        ) order by grouped.case_count desc, grouped.source_name), '[]'::jsonb)
        from (
          select coalesce(lead_source.name, 'Fanpage / Trực tiếp') as source_name, pg_catalog.count(*) as case_count
          from public.crm_cases as inner_case
          left join public.crm_lead_sources as lead_source on lead_source.id = inner_case.lead_source_id
          group by 1
          order by 2 desc, 1
          limit 4
        ) as grouped
      )
    )
    into v_funnel
    from public.crm_cases as crm_case;
  end if;

  -- 7. Tình hình học sinh
  if can_students then
    select pg_catalog.jsonb_build_object(
      'active', pg_catalog.count(*) filter (where student.lifecycle_status in ('active', 'resumed')),
      'reserved', pg_catalog.count(*) filter (where student.lifecycle_status = 'reserved'),
      'completed', pg_catalog.count(*) filter (where student.lifecycle_status = 'completed'),
      'waiting', pg_catalog.count(*) filter (where student.lifecycle_status not in ('active', 'resumed', 'reserved', 'completed')),
      'total', pg_catalog.count(*)
    )
    into v_student_status
    from public.students as student;
  end if;

  -- 8. Công nợ phải thu theo tuổi nợ (tính từ ngày lập phiếu)
  if can_finance or can_payments then
    select pg_catalog.jsonb_build_object(
      'under_30_vnd', coalesce(pg_catalog.sum(debt.amount_vnd) filter (where debt.age_days <= 30), 0),
      'from_31_to_60_vnd', coalesce(pg_catalog.sum(debt.amount_vnd) filter (where debt.age_days > 30 and debt.age_days <= 60), 0),
      'over_60_vnd', coalesce(pg_catalog.sum(debt.amount_vnd) filter (where debt.age_days > 60), 0),
      'total_vnd', coalesce(pg_catalog.sum(debt.amount_vnd), 0),
      'collected_vnd', (
        select coalesce(pg_catalog.sum(paid.paid_amount_vnd), 0)
        from public.student_payment_requests as paid
        where paid.status = 'paid'
          and paid.paid_at is not null
          and (paid.paid_at at time zone 'Asia/Ho_Chi_Minh')::date >= v_month
          and (paid.paid_at at time zone 'Asia/Ho_Chi_Minh')::date < v_next
      )
    )
    into v_receivables
    from (
      select
        request.expected_amount_vnd - request.paid_amount_vnd as amount_vnd,
        v_today - (request.created_at at time zone 'Asia/Ho_Chi_Minh')::date as age_days
      from public.student_payment_requests as request
      where request.status in ('pending', 'partially_paid')
        and request.expected_amount_vnd > request.paid_amount_vnd
    ) as debt;
  end if;

  -- 9. Quỹ lương tháng từ dòng lương thật của lần tính hiện hành
  if can_payroll_fund then
    with month_statements as (
      select
        statement.id,
        statement.staff_id,
        coalesce((
          select pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning')
            - coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'), 0)
          from public.payroll_line_items as line
          where line.payroll_statement_id = statement.id
        ), 0) as payable_vnd
      from public.payroll_periods as period
      join public.payroll_statements as statement
        on statement.payroll_period_id = period.id
        and statement.calculation_run_id = period.current_calculation_run_id
      where period.period_month = v_month
    )
    select pg_catalog.jsonb_build_object(
      'latest_period_month', (select pg_catalog.max(period_month) from public.payroll_periods),
      'draft_count', (select pg_catalog.count(*) from public.payroll_periods where status = 'draft'),
      'review_count', (select pg_catalog.count(*) from public.payroll_periods where status = 'review'),
      'approved_count', (select pg_catalog.count(*) from public.payroll_periods where status = 'approved'),
      'statement_count', (select pg_catalog.count(*) from month_statements),
      'total_payroll_vnd', (select coalesce(pg_catalog.sum(payable_vnd), 0) from month_statements),
      'prev_total_payroll_vnd', (
        select coalesce(pg_catalog.sum(
          coalesce((select pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning')
            - coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'), 0)
            from public.payroll_line_items as line where line.payroll_statement_id = statement.id), 0)
        ), 0)
        from public.payroll_periods as period
        join public.payroll_statements as statement
          on statement.payroll_period_id = period.id
          and statement.calculation_run_id = period.current_calculation_run_id
        where period.period_month = v_prev
      ),
      'by_position', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'position_code', grouped.position_code,
          'employee_count', grouped.employee_count,
          'amount_vnd', grouped.amount_vnd
        ) order by grouped.amount_vnd desc, grouped.position_code), '[]'::jsonb)
        from (
          select
            coalesce(position.position_code, 'other') as position_code,
            pg_catalog.count(*) as employee_count,
            pg_catalog.sum(month_statements.payable_vnd) as amount_vnd
          from month_statements
          left join lateral (
            select version.position_code
            from public.staff_payroll_position_versions as version
            where version.staff_id = month_statements.staff_id
              and version.effective_from < v_next
            order by version.effective_from desc, version.created_at desc
            limit 1
          ) as position on true
          group by 1
        ) as grouped
      )
    )
    into v_payroll;
  end if;

  -- 10. Hoạt động nổi bật trong tháng
  select pg_catalog.jsonb_build_object(
    'active_classes', case when can_classes then (
      select pg_catalog.count(*) from public.classes where status = 'active') end,
    'completed_sessions', case when can_sessions then (
      select pg_catalog.count(*) from public.class_sessions
      where status = 'completed' and session_date >= v_month and session_date < v_next) end,
    'grading_credit_units', case when can_grading then (
      select coalesce(pg_catalog.sum(credit_units), 0) from public.grading_credits
      where (credited_at at time zone 'Asia/Ho_Chi_Minh')::date >= v_month
        and (credited_at at time zone 'Asia/Ho_Chi_Minh')::date < v_next) end,
    'closed_coaching', case when can_coaching then (
      select pg_catalog.count(*)
      from public.coaching_records as coaching
      join lateral (
        select event.status, event.occurred_at
        from public.coaching_record_events as event
        where event.coaching_record_id = coaching.id and event.status is not null
        order by event.event_sequence desc
        limit 1
      ) as latest on true
      where latest.status = 'closed'
        and (latest.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date >= v_month
        and (latest.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date < v_next) end,
    'active_staff', case when can_staff then (
      select pg_catalog.count(*) from public.profiles where employment_status = 'active') end
  )
  into v_operations;

  return pg_catalog.jsonb_build_object(
    'month', pg_catalog.to_char(v_month, 'YYYY-MM'),
    'kpis', v_kpis,
    'attention', v_attention,
    'revenue_trend', v_trend,
    'revenue_composition', v_composition,
    'top_classes', v_top_classes,
    'admissions_funnel', v_funnel,
    'student_status', v_student_status,
    'receivables_aging', v_receivables,
    'payroll_summary', v_payroll,
    'operational_highlights', v_operations
  );
end;
$$;

revoke all on function public.get_dashboard_executive_overview(date) from public, anon;
grant execute on function public.get_dashboard_executive_overview(date) to authenticated;

comment on function public.get_dashboard_executive_overview(date)
is 'Tổng hợp KPI dashboard cho một tháng (doanh thu theo ngày tiền về, công nợ, phễu CRM, học sinh, quỹ lương thật, hoạt động). Mục không có quyền trả null.';

commit;
