begin;

create or replace function public.configure_staff_payroll_compensation(
  p_staff_id uuid,
  p_position_code text,
  p_effective_from date,
  p_offline_daily_rate_vnd bigint,
  p_note text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  position_row public.staff_payroll_position_versions%rowtype;
  rate_row public.staff_daily_rate_versions%rowtype;
begin
  if p_position_code is null and p_offline_daily_rate_vnd is null then
    raise exception using errcode = '22023', message = 'STAFF_PAYROLL_COMPENSATION_CHANGE_REQUIRED';
  end if;

  if p_position_code is not null then
    position_row := public.create_staff_payroll_position_version(
      p_staff_id,
      p_position_code,
      p_effective_from,
      p_reason
    );
  end if;

  if p_offline_daily_rate_vnd is not null then
    rate_row := public.create_staff_daily_rate_version(
      p_staff_id,
      p_effective_from,
      p_offline_daily_rate_vnd,
      p_note,
      p_reason
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'positionVersionId', position_row.id,
    'dailyRateVersionId', rate_row.id
  );
end;
$$;

create or replace function public.create_payroll_lead_source_mapping_version(
  p_lead_source_id uuid,
  p_payroll_source_code text,
  p_effective_from date,
  p_reason text
)
returns public.payroll_lead_source_mapping_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_code text := pg_catalog.lower(pg_catalog.btrim(p_payroll_source_code));
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  created_row public.payroll_lead_source_mapping_versions%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.policy.manage') then
    raise exception using errcode = '42501', message = 'PAYROLL_POLICY_MANAGE_PERMISSION_REQUIRED';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'PAYROLL_SOURCE_MAPPING_REASON_REQUIRED';
  end if;
  if not exists (select 1 from public.crm_lead_sources where id = p_lead_source_id) then
    raise exception using errcode = 'P0002', message = 'PAYROLL_LEAD_SOURCE_NOT_FOUND';
  end if;
  perform public.assert_payroll_configuration_date_allowed(p_effective_from);

  insert into public.payroll_lead_source_mapping_versions (
    lead_source_id, payroll_source_code, effective_from, reason, created_by
  ) values (
    p_lead_source_id, normalized_code, p_effective_from, normalized_reason, actor_id
  ) returning * into created_row;
  return created_row;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PAYROLL_SOURCE_MAPPING_EFFECTIVE_DATE_EXISTS';
  when check_violation then
    raise exception using errcode = '22023', message = 'PAYROLL_SOURCE_MAPPING_CODE_INVALID';
end;
$$;

create or replace function public.create_manual_payroll_source_fact(
  p_fact_type text,
  p_source_key text,
  p_event_date date,
  p_staff_id uuid,
  p_student_id uuid,
  p_grade smallint,
  p_amount_vnd bigint,
  p_quantity numeric,
  p_source_code text,
  p_metadata jsonb
)
returns public.payroll_source_facts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_type text := pg_catalog.lower(pg_catalog.btrim(p_fact_type));
  created_row public.payroll_source_facts%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.manage')
    and not public.has_permission('payroll.accountant_reconcile')
    and not public.has_permission('payroll.owner_approve')
  then
    raise exception using errcode = '42501', message = 'PAYROLL_MANUAL_FACT_PERMISSION_REQUIRED';
  end if;
  if normalized_type not in (
    'teaching_allowance',
    'daily_admin_reporting',
    'addon_product_order',
    'staff_recruitment_salary'
  ) then
    raise exception using errcode = '22023', message = 'PAYROLL_MANUAL_FACT_TYPE_INVALID';
  end if;
  if normalized_type = 'teaching_allowance'
    and not public.has_permission('payroll.accountant_reconcile')
    and not public.has_permission('payroll.owner_approve')
  then
    raise exception using errcode = '42501', message = 'PAYROLL_ALLOWANCE_APPROVAL_PERMISSION_REQUIRED';
  end if;
  if p_event_date is null or p_staff_id is null then
    raise exception using errcode = '22023', message = 'PAYROLL_MANUAL_FACT_REQUIRED_FIELDS_MISSING';
  end if;
  if p_staff_id = actor_id then
    raise exception using errcode = '42501', message = 'PAYROLL_MANUAL_FACT_SELF_APPROVAL_FORBIDDEN';
  end if;
  if p_metadata is null
    or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
    or nullif(pg_catalog.btrim(p_metadata->>'reason'), '') is null
    or nullif(pg_catalog.btrim(p_metadata->>'evidence_url'), '') is null
  then
    raise exception using errcode = '22023', message = 'PAYROLL_MANUAL_FACT_EVIDENCE_REQUIRED';
  end if;

  insert into public.payroll_source_facts (
    fact_type, source_key, source_origin, event_date, staff_id, student_id,
    grade, amount_vnd, quantity, source_code, metadata, approved_by, approved_at
  ) values (
    normalized_type,
    pg_catalog.btrim(p_source_key),
    'manual',
    p_event_date,
    p_staff_id,
    p_student_id,
    p_grade,
    p_amount_vnd,
    p_quantity,
    nullif(pg_catalog.btrim(p_source_code), ''),
    p_metadata,
    actor_id,
    pg_catalog.now()
  ) returning * into created_row;
  return created_row;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PAYROLL_MANUAL_FACT_SOURCE_DUPLICATE';
  when check_violation then
    raise exception using errcode = '22023', message = 'PAYROLL_MANUAL_FACT_INVALID';
end;
$$;

create or replace function public.get_staff_payroll_profile(p_staff_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  can_manage boolean;
  can_view_bank boolean;
  result jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  can_manage := public.has_permission('staff.manage_payroll_profile')
    or public.has_permission('payroll.manage')
    or public.has_permission('payroll.accountant_reconcile')
    or public.has_permission('payroll.owner_approve');
  if p_staff_id is distinct from actor_id and not can_manage then
    raise exception using errcode = '42501', message = 'STAFF_PAYROLL_PROFILE_VIEW_PERMISSION_REQUIRED';
  end if;
  if not exists (select 1 from public.profiles where id = p_staff_id) then
    raise exception using errcode = 'P0002', message = 'STAFF_PROFILE_NOT_FOUND';
  end if;
  can_view_bank := p_staff_id = actor_id or public.has_permission('staff.bank.view');

  select pg_catalog.jsonb_build_object(
    'staffId', p_staff_id,
    'positions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', version.id,
        'positionCode', version.position_code,
        'effectiveFrom', version.effective_from,
        'reason', version.reason,
        'createdAt', version.created_at
      ) order by version.effective_from desc)
      from public.staff_payroll_position_versions as version
      where version.staff_id = p_staff_id
    ), '[]'::jsonb),
    'dailyRates', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', version.id,
        'effectiveFrom', version.effective_from,
        'offlineDailyRateVnd', version.offline_daily_rate_vnd,
        'onlineDailyRateVnd', pg_catalog.round(version.offline_daily_rate_vnd::numeric * version.online_rate_basis_points / 10000)::bigint,
        'onlineRateBasisPoints', version.online_rate_basis_points,
        'note', version.note,
        'reason', version.reason,
        'createdAt', version.created_at
      ) order by version.effective_from desc)
      from public.staff_daily_rate_versions as version
      where version.staff_id = p_staff_id
    ), '[]'::jsonb),
    'gradeAssignments', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', assignment.id,
        'grade', assignment.grade,
        'effectiveFrom', assignment.effective_from,
        'effectiveTo', assignment.effective_to,
        'reason', assignment.reason,
        'createdAt', assignment.created_at
      ) order by assignment.effective_from desc, assignment.grade)
      from public.staff_grade_assignments as assignment
      where assignment.staff_id = p_staff_id
    ), '[]'::jsonb),
    'tasks', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', task.id,
        'taskCode', task.task_code,
        'isEnabled', task.is_enabled,
        'effectiveFrom', task.effective_from,
        'reason', task.reason,
        'createdAt', task.created_at
      ) order by task.effective_from desc, task.task_code)
      from public.staff_payroll_task_versions as task
      where task.staff_id = p_staff_id
    ), '[]'::jsonb),
    'bankAccounts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', bank.id,
        'bankName', bank.bank_name,
        'accountNumber', case
          when can_view_bank then bank.account_number
          else pg_catalog.repeat('•', greatest(pg_catalog.length(bank.account_number) - 4, 0)) || pg_catalog.right(bank.account_number, 4)
        end,
        'isMasked', not can_view_bank,
        'accountHolderName', bank.account_holder_name,
        'effectiveFrom', bank.effective_from,
        'approvedAt', bank.approved_at
      ) order by bank.effective_from desc)
      from public.staff_bank_account_versions as bank
      where bank.staff_id = p_staff_id
    ), '[]'::jsonb),
    'bankChangeRequests', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', request.id,
        'bankName', request.bank_name,
        'accountNumber', case
          when can_view_bank then request.account_number
          else pg_catalog.repeat('•', greatest(pg_catalog.length(request.account_number) - 4, 0)) || pg_catalog.right(request.account_number, 4)
        end,
        'isMasked', not can_view_bank,
        'accountHolderName', request.account_holder_name,
        'effectiveFrom', request.effective_from,
        'reason', request.reason,
        'status', request.status,
        'requestedAt', request.requested_at,
        'reviewNote', request.review_note
      ) order by request.requested_at desc)
      from public.staff_bank_account_change_requests as request
      where request.staff_id = p_staff_id
    ), '[]'::jsonb)
  ) into result;

  if can_view_bank then
    insert into public.audit_logs (
      actor_user_id, module, action, entity_type, entity_id, metadata
    ) values (
      actor_id,
      'staff',
      'staff_bank_account_viewed',
      'profile',
      p_staff_id::text,
      pg_catalog.jsonb_build_object('source', 'staff_payroll_profile')
    );
  end if;

  return result;
end;
$$;

create or replace function public.get_payroll_management_overview()
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
  if not public.has_permission('payroll.manage')
    and not public.has_permission('payroll.accountant_reconcile')
    and not public.has_permission('payroll.owner_approve')
  then
    raise exception using errcode = '42501', message = 'PAYROLL_MANAGEMENT_VIEW_PERMISSION_REQUIRED';
  end if;

  return pg_catalog.jsonb_build_object(
    'issues', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', issue.id,
        'payrollPeriodId', period.id,
        'periodMonth', period.period_month,
        'revision', run.revision,
        'issueCode', issue.issue_code,
        'severity', issue.severity,
        'staffId', issue.staff_id,
        'sourceFactId', issue.source_fact_id,
        'details', issue.details
      ) order by period.period_month desc, issue.created_at)
      from public.payroll_calculation_issues as issue
      join public.payroll_calculation_runs as run on run.id = issue.calculation_run_id
      join public.payroll_periods as period
        on period.id = run.payroll_period_id and period.current_calculation_run_id = run.id
    ), '[]'::jsonb),
    'correctionRequests', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', request.id,
        'payrollPeriodId', request.payroll_period_id,
        'payrollStatementId', request.payroll_statement_id,
        'requestedBy', request.requested_by,
        'staffDisplayName', coalesce(profile.display_name, profile.email),
        'requestMessage', request.request_message,
        'status', request.status,
        'requestedAt', request.requested_at,
        'responseMessage', request.response_message,
        'items', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', item.id,
            'itemLabel', item.item_label,
            'requestedChange', item.requested_change,
            'evidenceUrl', item.evidence_url
          ) order by item.created_at, item.id)
          from public.payroll_correction_request_items as item
          where item.request_id = request.id
        ), '[]'::jsonb)
      ) order by request.requested_at desc)
      from public.payroll_correction_requests as request
      join public.payroll_statements as statement on statement.id = request.payroll_statement_id
      join public.profiles as profile on profile.id = statement.staff_id
    ), '[]'::jsonb),
    'importBatches', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', batch.id,
        'datasetType', batch.dataset_type,
        'periodMonth', batch.period_month,
        'fileName', batch.file_name,
        'status', batch.status,
        'totalRows', batch.total_rows,
        'validRows', batch.valid_rows,
        'errorRows', batch.error_rows,
        'conflictRows', batch.conflict_rows,
        'uploadedAt', batch.uploaded_at
      ) order by batch.uploaded_at desc)
      from public.payroll_import_batches as batch
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_payroll_explanations()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  can_see_all boolean;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.view') then
    raise exception using errcode = '42501', message = 'PAYROLL_VIEW_PERMISSION_REQUIRED';
  end if;
  can_see_all := public.has_permission('payroll.manage')
    or public.has_permission('payroll.accountant_reconcile')
    or public.has_permission('payroll.owner_approve');

  return pg_catalog.jsonb_build_object(
    'periods', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', period.id,
        'currentRevision', run.revision,
        'feedbackOpenedAt', period.feedback_opened_at,
        'feedbackClosedAt', period.feedback_closed_at,
        'blockingIssueCount', (
          select pg_catalog.count(*) from public.payroll_calculation_issues as issue
          where issue.calculation_run_id = period.current_calculation_run_id and issue.severity = 'blocking'
        ),
        'pendingCorrectionCount', (
          select pg_catalog.count(*) from public.payroll_correction_requests as request
          where request.payroll_period_id = period.id and request.status = 'pending'
        )
      ) order by period.period_month desc)
      from public.payroll_periods as period
      join public.payroll_calculation_runs as run on run.id = period.current_calculation_run_id
      where can_see_all or exists (
        select 1 from public.payroll_statements as own_statement
        where own_statement.calculation_run_id = run.id and own_statement.staff_id = actor_id
      )
    ), '[]'::jsonb),
    'statements', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', statement.id,
        'workMinutes', statement.work_minutes
      ))
      from public.payroll_statements as statement
      join public.payroll_periods as period
        on period.current_calculation_run_id = statement.calculation_run_id
      where can_see_all or statement.staff_id = actor_id
    ), '[]'::jsonb),
    'lines', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', line.id,
        'workMinutes', line.work_minutes,
        'quantity', line.quantity,
        'unitLabel', line.unit_label,
        'policyCode', line.policy_code,
        'sourceKind', line.source_kind,
        'formulaSnapshot', line.formula_snapshot,
        'evidenceSnapshot', line.evidence_snapshot
      ) order by line.created_at, line.id)
      from public.payroll_line_items as line
      join public.payroll_statements as statement on statement.id = line.payroll_statement_id
      join public.payroll_periods as period
        on period.current_calculation_run_id = statement.calculation_run_id
      where can_see_all or statement.staff_id = actor_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.configure_staff_payroll_compensation(uuid, text, date, bigint, text, text) from public, anon;
revoke all on function public.create_payroll_lead_source_mapping_version(uuid, text, date, text) from public, anon;
revoke all on function public.create_manual_payroll_source_fact(text, text, date, uuid, uuid, smallint, bigint, numeric, text, jsonb) from public, anon;
revoke all on function public.get_staff_payroll_profile(uuid) from public, anon;
revoke all on function public.get_payroll_management_overview() from public, anon;
revoke all on function public.get_payroll_explanations() from public, anon;
grant execute on function public.configure_staff_payroll_compensation(uuid, text, date, bigint, text, text) to authenticated;
grant execute on function public.create_payroll_lead_source_mapping_version(uuid, text, date, text) to authenticated;
grant execute on function public.create_manual_payroll_source_fact(text, text, date, uuid, uuid, smallint, bigint, numeric, text, jsonb) to authenticated;
grant execute on function public.get_staff_payroll_profile(uuid) to authenticated;
grant execute on function public.get_payroll_management_overview() to authenticated;
grant execute on function public.get_payroll_explanations() to authenticated;

commit;
