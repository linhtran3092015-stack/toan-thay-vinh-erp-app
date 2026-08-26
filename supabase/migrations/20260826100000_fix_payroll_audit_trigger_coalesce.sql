begin;

-- BLOCKER 1 FIX: audit_payroll_period_change() sử dụng pg_catalog.coalesce() không tồn tại.
-- COALESCE là SQL syntax built-in, không phải function trong pg_catalog.
-- Migration 20260825120000 redefine function với pg_catalog.coalesce() (bug regression),
-- gây lỗi "function pg_catalog.coalesce(uuid, uuid) does not exist" khi trigger fires.
-- Migration 20260729102000 đã dùng unqualified coalesce() — đúng.
-- Fix: redefine lại function với coalesce() unqualified + đầy đủ 5 cases từ 20260825120000.
-- Audit trail, RLS, quyền không thay đổi.

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
  elsif old.status = 'draft' and new.status = 'review' then
    audit_action := 'payroll_submitted_for_review';
  elsif old.status = 'review' and new.status = 'approved' then
    audit_action := 'payroll_approved';
  elsif old.status = 'draft'
    and new.status = 'draft'
    and new.current_calculation_run_id is distinct from old.current_calculation_run_id
  then
    audit_action := 'payroll_calculation_revised';
  elsif old.status = 'draft'
    and new.status = 'draft'
    and new.feedback_closed_at is distinct from old.feedback_closed_at
  then
    audit_action := 'payroll_feedback_closed';
  else
    raise exception using errcode = 'P0001', message = 'UNSUPPORTED_PAYROLL_PERIOD_AUDIT_EVENT';
  end if;

  insert into public.audit_logs (
    actor_user_id, module, action, entity_type, entity_id, old_data, new_data, metadata
  )
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

revoke all on function public.audit_payroll_period_change() from public, anon, authenticated;

-- FIX: Scope salary advance uniqueness in payroll_line_items to statement level.
-- Previously unique on salary_advance_id globally, which prevented recalculating a draft period
-- that had advance deductions because previous calculation run revisions hold immutable line items.
drop index if exists public.payroll_line_items_salary_advance_unique_idx;

create unique index if not exists payroll_line_items_salary_advance_statement_unique_idx
  on public.payroll_line_items (payroll_statement_id, salary_advance_id)
  where salary_advance_id is not null;

-- BLOCKER 2 FIX: Xác minh không có payroll_statements thiếu calculation_run_id.
-- Migration 20260825120000 đã backfill tất cả statements cũ đúng cách.
-- Migration này thêm assertion idempotent để verify trên cả fresh DB và production upgrade.
-- Nếu assertion fail, có nghĩa là có statement orphaned — cần điều tra thêm.

do $$
declare
  orphaned_count integer;
begin
  select count(*) into orphaned_count
  from public.payroll_statements
  where calculation_run_id is null;

  if orphaned_count > 0 then
    raise exception
      using errcode = '23514',
            message = 'PAYROLL_STATEMENTS_MISSING_CALCULATION_RUN_ID',
            detail = format('%s payroll_statements có calculation_run_id là NULL — cần backfill trước khi tiếp tục.', orphaned_count);
  end if;
end;
$$;

-- Xác minh mọi current_calculation_run_id trên payroll_periods đều hợp lệ.
do $$
declare
  orphaned_count integer;
begin
  select count(*) into orphaned_count
  from public.payroll_periods
  where current_calculation_run_id is null;

  -- current_calculation_run_id = NULL chỉ hợp lệ nếu period chưa có calculation run nào.
  -- Trên fresh DB (không có production data) đây là 0.
  -- Trên production upgrade: migration 20260825120000 đã backfill tất cả.
  -- Nếu > 0, có period orphaned — log warning (không raise exception vì có thể là period mới được tạo
  -- trong quá trình transition migration, rất hiếm nhưng cần idempotent).
  if orphaned_count > 0 then
    raise warning 'PAYROLL_PERIODS_MISSING_CURRENT_RUN: % payroll_periods thiếu current_calculation_run_id', orphaned_count;
  end if;
end;
$$;

commit;
