-- Migration: bulk student lifecycle status transition RPC with concurrency guard and audit logging.
-- Target: public.students.lifecycle_status only.
-- Security boundary: strictly RBAC-guarded by permission: students.manage_status

create or replace function public.bulk_transition_student_lifecycle_status(
  p_source_status text,
  p_target_status text,
  p_expected_count integer,
  p_student_ids uuid[] default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
/*
  Transitions lifecycle_status of students matching p_source_status (and optional p_student_ids) to p_target_status.
  
  Permission required: students.manage_status
  
  Guarantees:
    - Atomic transaction (All-Or-Nothing).
    - Row-level locking (FOR UPDATE).
    - Concurrency guard: aborts if actual locked count != p_expected_count.
    - Append-only audit log in public.audit_logs.
    - Zero side-effects on enrollments, classes, schedules, tuition, or ledger entries.
*/
declare
  v_actor_id uuid := auth.uid();
  v_valid_statuses text[] := array[
    'active',
    'completed',
    'interested',
    'pending_enrollment_confirmation',
    'reserved',
    'resumed',
    'trial_booked',
    'trial_completed',
    'waiting_class'
  ];
  v_actual_count integer := 0;
  v_reason text;
begin
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('students.manage_status') then
    raise exception using
      errcode = '42501',
      message = 'STUDENTS_MANAGE_STATUS_PERMISSION_REQUIRED';
  end if;

  if p_source_status is null or not (p_source_status = any(v_valid_statuses)) then
    raise exception using
      errcode = '22023',
      message = 'INVALID_SOURCE_STATUS';
  end if;

  if p_target_status is null or not (p_target_status = any(v_valid_statuses)) then
    raise exception using
      errcode = '22023',
      message = 'INVALID_TARGET_STATUS';
  end if;

  if p_source_status = p_target_status then
    raise exception using
      errcode = '22023',
      message = 'SOURCE_AND_TARGET_STATUS_MUST_DIFFER';
  end if;

  if p_expected_count is null or p_expected_count < 0 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_EXPECTED_COUNT';
  end if;

  -- Lock matching student rows FOR UPDATE and count actual records
  if p_student_ids is not null and pg_catalog.array_length(p_student_ids, 1) > 0 then
    select pg_catalog.count(*)
    into v_actual_count
    from public.students
    where id = any(p_student_ids)
      and lifecycle_status = p_source_status
    for update;
  else
    select pg_catalog.count(*)
    into v_actual_count
    from public.students
    where lifecycle_status = p_source_status
    for update;
  end if;

  -- Concurrency Guard: Abort & Rollback if data changed since preview
  if v_actual_count <> p_expected_count then
    raise exception using
      errcode = '23514',
      message = 'Dữ liệu đã thay đổi kể từ lúc preview. Vui lòng thực hiện preview lại.';
  end if;

  -- Execute bulk update only if records exist
  if v_actual_count > 0 then
    if p_student_ids is not null and pg_catalog.array_length(p_student_ids, 1) > 0 then
      update public.students
      set
        lifecycle_status = p_target_status,
        updated_at = pg_catalog.now()
      where id = any(p_student_ids)
        and lifecycle_status = p_source_status;
    else
      update public.students
      set
        lifecycle_status = p_target_status,
        updated_at = pg_catalog.now()
      where lifecycle_status = p_source_status;
    end if;
  end if;

  v_reason := pg_catalog.coalesce(
    pg_catalog.nullif(pg_catalog.trim(p_reason), ''),
    'Chuyển trạng thái hàng loạt từ ' || p_source_status || ' sang ' || p_target_status
  );

  -- Audit log insertion inside transaction
  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  )
  values (
    v_actor_id,
    'students',
    'bulk_student_status_changed',
    'student',
    null,
    v_reason,
    pg_catalog.jsonb_build_object(
      'source_status', p_source_status,
      'target_status', p_target_status,
      'expected_count', p_expected_count,
      'affected_count', v_actual_count,
      'is_all', (p_student_ids is null or pg_catalog.array_length(p_student_ids, 1) is null)
    )
  );

  return pg_catalog.jsonb_build_object(
    'affected_count', v_actual_count,
    'source_status', p_source_status,
    'target_status', p_target_status
  );
end;
$$;
