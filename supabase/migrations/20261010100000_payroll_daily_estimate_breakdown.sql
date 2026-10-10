-- Bảng lương theo ngày (realtime) cho nhân sự và chủ trung tâm.
--
-- 1. Tách phần dựng dữ liệu ước tính của một nhân sự thành
--    build_staff_payroll_estimate(p_staff_id, p_month) để dùng chung.
-- 2. Trả thêm `shifts` (toàn bộ ca trong tháng, kể cả ca đang mở) và
--    bổ sung workDate / sourceKind / sourceId cho từng dòng lương, kể cả với
--    kỳ đã duyệt (suy ra từ bản ghi chấm công hoặc dữ liệu nghiệp vụ gốc),
--    để giao diện gom được tiền lương theo từng ngày.
-- 3. Thêm RPC get_staff_payroll_estimate(p_staff_id, p_month) cho chủ trung tâm
--    (quyền payroll.dashboard.view) xem lương theo ngày của một nhân sự;
--    nhân sự vẫn có thể gọi cho chính mình.
--
-- Không thay đổi công thức tính: mọi số liệu vẫn đến từ compute_payroll_projection.

begin;

create or replace function public.build_staff_payroll_estimate(
  p_staff_id uuid,
  p_month date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm_month date := pg_catalog.date_trunc('month', p_month)::date;
  v_month_end date := (pg_catalog.date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_period public.payroll_periods%rowtype;
  v_projection jsonb;
  v_statement jsonb;
  v_lines jsonb;
  v_issues jsonb;
  v_latest_work timestamptz;
  v_approved_statement public.payroll_statements%rowtype;
  v_shifts jsonb;
begin
  if p_staff_id is null then
    raise exception using errcode = '22023', message = 'PAYROLL_STAFF_REQUIRED';
  end if;

  if p_month is null or p_month <> v_norm_month then
    raise exception using errcode = '22023', message = 'PAYROLL_MONTH_INVALID';
  end if;

  -- Toàn bộ ca làm việc trong tháng của nhân sự (đã kết thúc hoặc đang mở).
  -- Thời gian hiển thị ưu tiên yêu cầu điều chỉnh đã được duyệt, giống công thức tính lương.
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', shift.id,
      'workDate', shift.work_date,
      'checkInAt', shift.check_in_at,
      'checkOutAt', shift.check_out_at,
      'workMode', shift.work_mode,
      'status', shift.status,
      'isPendingVerification', shift.is_pending_verification,
      'workedMinutes', shift.worked_minutes
    ) order by shift.work_date, shift.check_in_at), '[]'::jsonb)
  into v_shifts
  from (
    select
      entry.id,
      entry.work_date,
      coalesce(adjustment.requested_check_in_at, entry.check_in_at) as check_in_at,
      coalesce(adjustment.requested_check_out_at, entry.check_out_at) as check_out_at,
      coalesce(adjustment.requested_check_in_mode, entry.check_in_mode) as work_mode,
      entry.status,
      case
        when entry.check_out_at is null then false
        else not public.time_entry_is_verified(entry.id)
      end as is_pending_verification,
      case
        when entry.check_out_at is null then 0
        else greatest(0, pg_catalog.floor(extract(epoch from (
          coalesce(adjustment.requested_check_out_at, entry.check_out_at)
          - coalesce(adjustment.requested_check_in_at, entry.check_in_at)
        )) / 60)::integer)
      end as worked_minutes
    from public.time_entries as entry
    left join lateral (
      select request.requested_check_in_at, request.requested_check_in_mode, request.requested_check_out_at
      from public.time_entry_adjustment_requests as request
      where request.time_entry_id = entry.id and request.status = 'approved'
      order by request.reviewed_at desc
      limit 1
    ) as adjustment on true
    where entry.staff_id = p_staff_id
      and entry.work_date >= v_norm_month
      and entry.work_date <= v_month_end
      and entry.status in ('checked_out', 'auto_ended', 'open')
  ) as shift;

  -- Kỳ đã duyệt: đọc bản chốt bất biến
  select * into v_period
  from public.payroll_periods
  where period_month = v_norm_month;

  if found and v_period.status = 'approved' then
    select * into v_approved_statement
    from public.payroll_statements
    where payroll_period_id = v_period.id
      and calculation_run_id = v_period.current_calculation_run_id
      and staff_id = p_staff_id;

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
        'latestCompletedWorkAt', (
          select pg_catalog.max(entry.check_out_at)
          from public.time_entries as entry
          where entry.staff_id = p_staff_id
            and entry.work_date >= v_norm_month
            and entry.work_date <= v_month_end
            and entry.check_out_at is not null
        ),
        'statement', pg_catalog.jsonb_build_object(
          'staffId', p_staff_id,
          'staffDisplayName', v_approved_statement.staff_display_name_snapshot,
          'staffEmployeeCode', v_approved_statement.staff_employee_code_snapshot,
          'positionCode', (
            select position.position_code
            from public.staff_payroll_position_versions as position
            where position.staff_id = p_staff_id and position.effective_from <= v_month_end
            order by position.effective_from desc
            limit 1
          ),
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
            'note', line.note,
            'sourceKind', line.source_kind,
            'sourceId', line.source_id,
            'isPendingVerification', false,
            -- Ngày phát sinh: bản ghi chấm công -> ngày công; dữ liệu nghiệp vụ -> ngày sự kiện;
            -- còn lại là khoản tính theo tháng.
            'workDate', coalesce(
              source_entry.work_date,
              source_fact.event_date,
              v_norm_month
            )
          ))
          from public.payroll_line_items as line
          left join public.time_entries as source_entry
            on source_entry.id = coalesce(
              line.source_time_entry_id,
              case when line.source_kind = 'time_entry' and line.source_id ~* '^[0-9a-f-]{36}$' then line.source_id::uuid end
            )
          left join public.payroll_source_facts as source_fact
            on line.source_kind = 'payroll_source_fact'
            and line.source_id ~* '^[0-9a-f-]{36}$'
            and source_fact.id = line.source_id::uuid
          where line.payroll_statement_id = v_approved_statement.id
        ), '[]'::jsonb),
        'issues', '[]'::jsonb,
        'recentShifts', '[]'::jsonb,
        'openShifts', '[]'::jsonb,
        'shifts', v_shifts
      );
    end if;
  end if;

  -- Ước tính thời gian thực
  v_projection := public.compute_payroll_projection(v_norm_month, pg_catalog.now(), 'estimate', p_staff_id);
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
      select pg_catalog.jsonb_agg(shift order by (shift->>'workDate') desc, (shift->>'checkOutAt') desc)
      from (
        select shift
        from jsonb_array_elements(v_shifts) as shift
        where shift->>'checkOutAt' is not null
        order by (shift->>'workDate') desc, (shift->>'checkOutAt') desc
        limit 5
      ) as recent
    ), '[]'::jsonb),
    'openShifts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', entry.id,
        'workDate', entry.work_date,
        'checkInAt', entry.check_in_at,
        'workMode', entry.check_in_mode
      ))
      from public.time_entries as entry
      where entry.staff_id = p_staff_id and entry.status = 'open'
    ), '[]'::jsonb),
    'shifts', v_shifts
  );
end;
$$;

revoke all on function public.build_staff_payroll_estimate(uuid, date) from public, anon, authenticated;

-- Nhân sự xem lương của chính mình (giữ nguyên chữ ký và quyền cũ)
create or replace function public.get_my_payroll_estimate(p_month date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.view') then
    raise exception using errcode = '42501', message = 'PAYROLL_VIEW_PERMISSION_REQUIRED';
  end if;

  if p_month is null or p_month <> pg_catalog.date_trunc('month', p_month)::date then
    raise exception using errcode = '22023', message = 'PAYROLL_MONTH_INVALID';
  end if;

  return public.build_staff_payroll_estimate(actor_id, p_month);
end;
$$;

revoke all on function public.get_my_payroll_estimate(date) from public, anon;
grant execute on function public.get_my_payroll_estimate(date) to authenticated;

-- Chủ trung tâm (payroll.dashboard.view) xem lương theo ngày của một nhân sự.
create or replace function public.get_staff_payroll_estimate(
  p_staff_id uuid,
  p_month date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_estimate jsonb;
  v_display_name text;
  v_employee_code text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if p_staff_id is null then
    raise exception using errcode = '22023', message = 'PAYROLL_STAFF_REQUIRED';
  end if;

  if p_month is null or p_month <> pg_catalog.date_trunc('month', p_month)::date then
    raise exception using errcode = '22023', message = 'PAYROLL_MONTH_INVALID';
  end if;

  if p_staff_id = actor_id then
    if not public.has_permission('payroll.view') then
      raise exception using errcode = '42501', message = 'PAYROLL_VIEW_PERMISSION_REQUIRED';
    end if;
  elsif not public.has_permission('payroll.dashboard.view') then
    raise exception using errcode = '42501', message = 'PAYROLL_DASHBOARD_VIEW_PERMISSION_REQUIRED';
  end if;

  select
    coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), profile.email),
    profile.employee_code
  into v_display_name, v_employee_code
  from public.profiles as profile
  where profile.id = p_staff_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'STAFF_PROFILE_NOT_FOUND';
  end if;

  v_estimate := public.build_staff_payroll_estimate(p_staff_id, p_month);

  return v_estimate || pg_catalog.jsonb_build_object(
    'staffId', p_staff_id,
    'staffDisplayName', v_display_name,
    'staffEmployeeCode', v_employee_code
  );
end;
$$;

revoke all on function public.get_staff_payroll_estimate(uuid, date) from public, anon;
grant execute on function public.get_staff_payroll_estimate(uuid, date) to authenticated;

commit;
