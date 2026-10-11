-- Đợt 2 — nhóm 2a (phần 2): kết thúc ghi danh, trạng thái "Đã nghỉ", đồ thị
-- chuyển trạng thái hàng loạt, đóng lớp dọn buổi.
--
-- A6: không kết thúc được ghi danh khi học sinh nghỉ; không có trạng thái "đã
--     nghỉ"; lớp còn ghi danh active thì không đóng được.
--   → lifecycle_status 'withdrawn'; RPC end_student_enrollment (quyền
--     students.manage_status) đóng ghi danh đang hiệu lực với ngày kết thúc và
--     lý do, chuyển học sinh sang Đã nghỉ. Học sinh quay lại dùng đúng luồng
--     "Quay lại học" (resume) như sau bảo lưu.
-- A7: đổi trạng thái hàng loạt cho phép mọi chuyển đổi, không đồng bộ ghi danh.
--   → chỉ cho chuyển giữa các trạng thái trước ghi danh (quan tâm, học thử,
--     chờ xác nhận, chờ chọn lớp); các trạng thái gắn với ghi danh (đang học,
--     quay lại học, bảo lưu, đã nghỉ, hoàn thành) phải đi qua nghiệp vụ xếp
--     lớp. Audit: một dòng tổng (như cũ) + một dòng mỗi học sinh
--     (student_status_changed_in_bulk, entity_id = học sinh).
-- A8: đóng lớp để lại buổi scheduled lơ lửng.
--   → đóng / lưu trữ lớp tự hủy mọi buổi còn "đã lên lịch" với lý do đóng lớp;
--     còn buổi đang diễn ra thì không đóng được.

begin;

-- ---------------------------------------------------------------------------
-- 1. Trạng thái Đã nghỉ
-- ---------------------------------------------------------------------------

alter table public.students drop constraint students_lifecycle_status_check;
alter table public.students add constraint students_lifecycle_status_check check (
  lifecycle_status = any (array[
    'interested', 'trial_booked', 'trial_completed', 'pending_enrollment_confirmation',
    'active', 'reserved', 'resumed', 'waiting_class', 'completed', 'withdrawn'
  ])
);

-- ---------------------------------------------------------------------------
-- 2. Kết thúc ghi danh
-- ---------------------------------------------------------------------------

create or replace function public.end_student_enrollment(
  p_student_id uuid,
  p_effective_to date,
  p_reason text
)
returns public.student_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  normalized_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  locked_student_id uuid;
  active_enrollment public.student_enrollments%rowtype;
  result_enrollment public.student_enrollments%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('students.manage_status') then
    raise exception using errcode = '42501', message = 'STUDENT_END_ENROLLMENT_PERMISSION_DENIED';
  end if;
  if p_student_id is null then
    raise exception using errcode = '22023', message = 'STUDENT_ID_REQUIRED';
  end if;
  if p_effective_to is null then
    raise exception using errcode = '22023', message = 'END_ENROLLMENT_EFFECTIVE_DATE_REQUIRED';
  end if;
  if p_effective_to > business_date then
    raise exception using errcode = '23514', message = 'END_ENROLLMENT_DATE_CANNOT_BE_FUTURE';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 1000 then
    raise exception using errcode = '22023', message = 'END_ENROLLMENT_REASON_REQUIRED';
  end if;

  select student.id into locked_student_id
  from public.students as student
  where student.id = p_student_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND';
  end if;

  select enrollment.* into active_enrollment
  from public.student_enrollments as enrollment
  where enrollment.student_id = p_student_id
    and enrollment.status = 'active'
    and enrollment.effective_to is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ACTIVE_STUDENT_ENROLLMENT_NOT_FOUND';
  end if;
  if p_effective_to < active_enrollment.effective_from then
    raise exception using errcode = '23514', message = 'END_ENROLLMENT_DATE_BEFORE_START';
  end if;

  update public.student_enrollments
  set status = 'completed', effective_to = p_effective_to, ended_by = actor_id, end_reason = normalized_reason
  where id = active_enrollment.id
  returning * into result_enrollment;

  update public.students
  set lifecycle_status = 'withdrawn'
  where id = p_student_id;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
  values (
    actor_id,
    'students',
    'student_enrollment_ended',
    'student',
    p_student_id::text,
    pg_catalog.jsonb_build_object('enrollment_id', active_enrollment.id, 'class_id', active_enrollment.class_id, 'status', 'active'),
    pg_catalog.jsonb_build_object('enrollment_id', active_enrollment.id, 'status', 'completed', 'effective_to', p_effective_to, 'lifecycle_status', 'withdrawn'),
    normalized_reason
  );

  return result_enrollment;
end;
$$;

revoke all on function public.end_student_enrollment(uuid, date, text) from public, anon;
grant execute on function public.end_student_enrollment(uuid, date, text) to authenticated;

comment on function public.end_student_enrollment(uuid, date, text)
is 'Kết thúc ghi danh đang hiệu lực (học sinh nghỉ) với ngày kết thúc không ở tương lai và lý do; học sinh chuyển sang Đã nghỉ. Quay lại học dùng resume_student_enrollment.';

-- Quay lại học sau bảo lưu HOẶC sau khi nghỉ.
create or replace function public.validate_student_enrollment_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  previous_enrollment public.student_enrollments%rowtype;
  target_class_status text;
begin
  if tg_op = 'INSERT' and new.status <> 'active' then
    raise exception using errcode = '23514', message = 'NEW_ENROLLMENT_MUST_BE_ACTIVE';
  end if;
  select class_record.status into target_class_status from public.classes as class_record where class_record.id = new.class_id;
  if not found then
    raise exception using errcode = '23503', message = 'ENROLLMENT_CLASS_NOT_FOUND';
  end if;
  if target_class_status <> 'active' then
    raise exception using errcode = '23514', message = 'ENROLLMENT_CLASS_MUST_BE_ACTIVE';
  end if;
  if new.transition_kind = 'initial' then
    if new.supersedes_enrollment_id is not null then
      raise exception using errcode = '23514', message = 'INITIAL_ENROLLMENT_CANNOT_HAVE_PREDECESSOR';
    end if;
    if exists (select 1 from public.student_enrollments as enrollment where enrollment.student_id = new.student_id and enrollment.id <> new.id) then
      raise exception using errcode = '23514', message = 'INITIAL_ENROLLMENT_REQUIRES_NO_HISTORY';
    end if;
    return new;
  end if;
  if new.supersedes_enrollment_id is null then
    raise exception using errcode = '23514', message = 'ENROLLMENT_PREDECESSOR_REQUIRED';
  end if;
  select * into previous_enrollment from public.student_enrollments where id = new.supersedes_enrollment_id;
  if not found then
    raise exception using errcode = '23503', message = 'ENROLLMENT_PREDECESSOR_NOT_FOUND';
  end if;
  if previous_enrollment.student_id is distinct from new.student_id then
    raise exception using errcode = '23514', message = 'ENROLLMENT_PREDECESSOR_STUDENT_MISMATCH';
  end if;
  if previous_enrollment.status = 'active' or previous_enrollment.effective_to is null then
    raise exception using errcode = '23514', message = 'ENROLLMENT_PREDECESSOR_MUST_BE_ENDED';
  end if;
  if new.effective_from <= previous_enrollment.effective_to then
    raise exception using errcode = '23514', message = 'ENROLLMENT_SUCCESSOR_DATE_INVALID';
  end if;
  if new.transition_kind = 'transfer' then
    if previous_enrollment.status <> 'transferred' then
      raise exception using errcode = '23514', message = 'TRANSFER_PREDECESSOR_STATUS_INVALID';
    end if;
    if previous_enrollment.class_id = new.class_id then
      raise exception using errcode = '23514', message = 'TRANSFER_TARGET_CLASS_MUST_DIFFER';
    end if;
  end if;
  if new.transition_kind = 'resume' and previous_enrollment.status not in ('reserved', 'completed') then
    raise exception using errcode = '23514', message = 'RESUME_PREDECESSOR_STATUS_INVALID';
  end if;
  return new;
end;
$$;

create or replace function public.resume_student_enrollment(
  p_student_id uuid,
  p_target_class_id uuid,
  p_registered_mode text,
  p_effective_from date,
  p_reason text
)
returns public.student_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  locked_student_id uuid;
  normalized_reason text;
  previous_enrollment public.student_enrollments%rowtype;
  result_enrollment public.student_enrollments%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('students.reserve') then
    raise exception using errcode = '42501', message = 'STUDENT_RESUME_PERMISSION_DENIED';
  end if;
  if p_student_id is null then
    raise exception using errcode = '22023', message = 'STUDENT_ID_REQUIRED';
  end if;
  if p_target_class_id is null then
    raise exception using errcode = '22023', message = 'TARGET_CLASS_ID_REQUIRED';
  end if;
  if p_registered_mode is null or p_registered_mode not in ('online', 'offline') then
    raise exception using errcode = '22023', message = 'REGISTERED_MODE_INVALID';
  end if;
  if p_effective_from is null then
    raise exception using errcode = '22023', message = 'RESUME_EFFECTIVE_DATE_REQUIRED';
  end if;
  normalized_reason := pg_catalog.btrim(p_reason);
  if normalized_reason is null or normalized_reason = '' then
    raise exception using errcode = '22023', message = 'RESUME_REASON_REQUIRED';
  end if;

  select student.id into locked_student_id from public.students as student where student.id = p_student_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.student_enrollments as enrollment
    where enrollment.student_id = p_student_id and enrollment.status = 'active' and enrollment.effective_to is null
  ) then
    raise exception using errcode = '23514', message = 'STUDENT_ALREADY_HAS_ACTIVE_ENROLLMENT';
  end if;

  select enrollment.* into previous_enrollment
  from public.student_enrollments as enrollment
  where enrollment.student_id = p_student_id
  order by enrollment.effective_from desc, enrollment.created_at desc
  limit 1
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'STUDENT_ENROLLMENT_HISTORY_NOT_FOUND';
  end if;
  if previous_enrollment.status not in ('reserved', 'completed') or previous_enrollment.effective_to is null then
    raise exception using errcode = '23514', message = 'LATEST_STUDENT_ENROLLMENT_IS_NOT_RESERVED';
  end if;
  if exists (select 1 from public.student_enrollments as successor where successor.supersedes_enrollment_id = previous_enrollment.id) then
    raise exception using errcode = '23514', message = 'RESERVED_ENROLLMENT_ALREADY_HAS_SUCCESSOR';
  end if;
  if p_effective_from <= previous_enrollment.effective_to then
    raise exception using errcode = '23514', message = 'RESUME_EFFECTIVE_DATE_INVALID';
  end if;

  insert into public.student_enrollments (
    student_id, class_id, registered_mode, transition_kind, status, effective_from, effective_to,
    supersedes_enrollment_id, start_reason, started_by, ended_by, end_reason
  )
  values (
    p_student_id, p_target_class_id, p_registered_mode, 'resume', 'active', p_effective_from, null,
    previous_enrollment.id, normalized_reason, actor_id, null, null
  )
  returning * into result_enrollment;

  update public.students
  set lifecycle_status = 'active', registered_mode = p_registered_mode
  where id = p_student_id;

  return result_enrollment;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Chuyển trạng thái hàng loạt: chỉ giữa các trạng thái trước ghi danh
-- ---------------------------------------------------------------------------

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
declare
  v_actor_id uuid := auth.uid();
  v_valid_statuses text[] := array[
    'active', 'completed', 'interested', 'pending_enrollment_confirmation', 'reserved', 'resumed',
    'trial_booked', 'trial_completed', 'waiting_class', 'withdrawn'
  ];
  -- Chỉ các trạng thái chưa gắn ghi danh mới đổi hàng loạt được; phần còn lại
  -- phải đi qua nhập lớp / chuyển lớp / bảo lưu / kết thúc ghi danh.
  v_bulk_statuses text[] := array[
    'interested', 'trial_booked', 'trial_completed', 'pending_enrollment_confirmation', 'waiting_class'
  ];
  v_actual_count integer := 0;
  v_affected uuid[];
  v_reason text;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('students.manage_status') then
    raise exception using errcode = '42501', message = 'STUDENTS_MANAGE_STATUS_PERMISSION_REQUIRED';
  end if;
  if p_source_status is null or not (p_source_status = any(v_valid_statuses)) then
    raise exception using errcode = '22023', message = 'INVALID_SOURCE_STATUS';
  end if;
  if p_target_status is null or not (p_target_status = any(v_valid_statuses)) then
    raise exception using errcode = '22023', message = 'INVALID_TARGET_STATUS';
  end if;
  if p_source_status = p_target_status then
    raise exception using errcode = '22023', message = 'SOURCE_AND_TARGET_STATUS_MUST_DIFFER';
  end if;
  if not (p_source_status = any(v_bulk_statuses)) or not (p_target_status = any(v_bulk_statuses)) then
    raise exception using errcode = '23514', message = 'BULK_TRANSITION_REQUIRES_ENROLLMENT_WORKFLOW';
  end if;
  if p_expected_count is null or p_expected_count < 0 then
    raise exception using errcode = '22023', message = 'INVALID_EXPECTED_COUNT';
  end if;

  with locked_students as (
    select id
    from public.students
    where lifecycle_status = p_source_status
      and (p_student_ids is null or pg_catalog.array_length(p_student_ids, 1) is null or id = any(p_student_ids))
    for update
  )
  select pg_catalog.count(*), pg_catalog.array_agg(id)
  into v_actual_count, v_affected
  from locked_students;

  if v_actual_count <> p_expected_count then
    raise exception using errcode = '23514', message = 'Dữ liệu đã thay đổi kể từ lúc preview. Vui lòng thực hiện preview lại.';
  end if;

  v_reason := coalesce(
    nullif(btrim(p_reason), ''),
    'Chuyển trạng thái hàng loạt từ ' || p_source_status || ' sang ' || p_target_status
  );

  if v_actual_count > 0 then
    update public.students
    set lifecycle_status = p_target_status, updated_at = pg_catalog.now()
    where id = any(v_affected) and lifecycle_status = p_source_status;

    insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
    select
      v_actor_id, 'students', 'student_status_changed_in_bulk', 'student', student_id::text,
      pg_catalog.jsonb_build_object('lifecycle_status', p_source_status),
      pg_catalog.jsonb_build_object('lifecycle_status', p_target_status),
      v_reason
    from pg_catalog.unnest(v_affected) as student_id;
  end if;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor_id, 'students', 'bulk_student_status_changed', 'student', null, v_reason,
    pg_catalog.jsonb_build_object(
      'source_status', p_source_status,
      'target_status', p_target_status,
      'expected_count', p_expected_count,
      'affected_count', v_actual_count,
      'student_ids', pg_catalog.to_jsonb(coalesce(v_affected, '{}'::uuid[])),
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

-- ---------------------------------------------------------------------------
-- 4. Đóng / lưu trữ lớp: hủy buổi còn "đã lên lịch", chặn khi còn buổi đang học
-- ---------------------------------------------------------------------------

create or replace function public.change_class_status(p_class_id uuid, p_target_status text, p_reason text)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_status text;
  normalized_reason text;
  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;
  result_class public.classes%rowtype;
  cancelled_count integer := 0;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('classes.create') then
    raise exception using errcode = '42501', message = 'CLASS_CREATE_PERMISSION_DENIED';
  end if;
  if p_class_id is null then
    raise exception using errcode = '22023', message = 'CLASS_ID_REQUIRED';
  end if;

  normalized_status := pg_catalog.lower(pg_catalog.btrim(p_target_status));
  normalized_reason := pg_catalog.btrim(p_reason);

  if normalized_status not in ('active', 'closed', 'archived') then
    raise exception using errcode = '22023', message = 'CLASS_TARGET_STATUS_INVALID';
  end if;
  if normalized_reason is null or normalized_reason = '' then
    raise exception using errcode = '22023', message = 'CLASS_STATUS_REASON_REQUIRED';
  end if;

  select class_row.* into target_class from public.classes as class_row where class_row.id = p_class_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CLASS_NOT_FOUND';
  end if;
  if target_class.status = normalized_status then
    return target_class;
  end if;
  if target_class.status = 'archived' then
    raise exception using errcode = '23514', message = 'ARCHIVED_CLASS_IS_IMMUTABLE';
  end if;

  select academic_year.* into target_year from public.academic_years as academic_year where academic_year.id = target_class.academic_year_id for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if normalized_status = 'active' then
    if target_class.status <> 'draft' then
      raise exception using errcode = '23514', message = 'CLASS_ACTIVATION_TRANSITION_INVALID';
    end if;
    if target_year.status <> 'active' then
      raise exception using errcode = '23514', message = 'ACTIVE_CLASS_REQUIRES_ACTIVE_ACADEMIC_YEAR';
    end if;
  end if;

  if normalized_status = 'closed' and target_class.status <> 'active' then
    raise exception using errcode = '23514', message = 'CLASS_CLOSE_TRANSITION_INVALID';
  end if;
  if normalized_status = 'archived' and target_class.status not in ('draft', 'closed') then
    raise exception using errcode = '23514', message = 'CLASS_ARCHIVE_TRANSITION_INVALID';
  end if;

  if normalized_status in ('closed', 'archived') then
    if exists (select 1 from public.class_schedule_templates as schedule where schedule.class_id = target_class.id and schedule.is_active) then
      raise exception using errcode = '23514', message = 'CLASS_HAS_ACTIVE_SCHEDULES';
    end if;
    if exists (
      select 1 from public.student_enrollments as enrollment
      where enrollment.class_id = target_class.id and enrollment.status = 'active' and enrollment.effective_to is null
    ) then
      raise exception using errcode = '23514', message = 'CLASS_HAS_ACTIVE_STUDENT_ENROLLMENTS';
    end if;
    if exists (select 1 from public.class_sessions as s where s.class_id = target_class.id and s.status = 'in_progress') then
      raise exception using errcode = '23514', message = 'CLASS_HAS_SESSION_IN_PROGRESS';
    end if;
  end if;

  perform pg_catalog.set_config('app.workflow_reason', normalized_reason, true);

  if normalized_status in ('closed', 'archived') then
    -- Buổi chưa diễn ra của lớp đóng không còn ý nghĩa: hủy kèm lý do đóng lớp.
    update public.class_sessions
    set
      status = 'cancelled',
      cancelled_at = pg_catalog.now(),
      cancelled_by = actor_id,
      cancellation_reason = 'Lớp ' || target_class.code || ' ' || case when normalized_status = 'closed' then 'đóng' else 'lưu trữ' end || ': ' || normalized_reason
    where class_id = target_class.id
      and status = 'scheduled';
    get diagnostics cancelled_count = row_count;
  end if;

  update public.classes
  set status = normalized_status, updated_at = pg_catalog.now()
  where id = target_class.id
  returning * into result_class;

  if cancelled_count > 0 then
    insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, reason, metadata)
    values (
      actor_id, 'classes', 'class_scheduled_sessions_cancelled_on_close', 'class', target_class.id::text, normalized_reason,
      pg_catalog.jsonb_build_object('target_status', normalized_status, 'cancelled_session_count', cancelled_count)
    );
  end if;

  return result_class;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Dashboard: Đã nghỉ gộp vào nhóm "Đã hoàn thành / Nghỉ"
-- ---------------------------------------------------------------------------

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.get_dashboard_executive_overview(date)'::regprocedure) into v_def;
  v_def := replace(
    v_def,
    $s$'completed', pg_catalog.count(*) filter (where student.lifecycle_status = 'completed'),$s$,
    $s$'completed', pg_catalog.count(*) filter (where student.lifecycle_status in ('completed', 'withdrawn')),$s$
  );
  v_def := replace(
    v_def,
    $s$'waiting', pg_catalog.count(*) filter (where student.lifecycle_status not in ('active', 'resumed', 'reserved', 'completed')),$s$,
    $s$'waiting', pg_catalog.count(*) filter (where student.lifecycle_status not in ('active', 'resumed', 'reserved', 'completed', 'withdrawn')),$s$
  );
  if v_def !~ $s$'completed', 'withdrawn'$s$ then
    raise exception 'DASHBOARD_WITHDRAWN_PATCH_FAILED';
  end if;
  execute v_def;
end;
$$;

commit;
