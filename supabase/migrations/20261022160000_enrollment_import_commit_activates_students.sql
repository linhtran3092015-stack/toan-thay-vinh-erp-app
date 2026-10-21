begin;

-- Import ghi danh phải để lại học viên ở cùng trạng thái như ghi danh thủ công
-- (enroll_student_in_class): lifecycle_status = 'active', registered_mode theo
-- ghi danh, official_start_date = ngày hiệu lực nếu chưa có. Bản cũ chỉ chèn
-- student_enrollments nên học viên import vẫn 'interested', bị loại khỏi
-- phân bổ SePay, chăm sóc học viên và số liệu "đang học" trên dashboard.
--
-- Dòng 'existing_matching' (đã có ghi danh active khớp) cũng được kích hoạt nếu
-- học viên chưa ở trạng thái đang học, để import lại một file cũ sửa được các
-- học viên đã import trước bản sửa này.

create or replace function public.commit_student_enrollment_import_batch(
  p_batch_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text;

  v_batch public.student_enrollment_import_batches%rowtype;
  r public.student_enrollment_import_rows%rowtype;

  v_student_id uuid;
  v_student_lifecycle_status text;
  v_class_id uuid;
  v_new_enrollment_id uuid;

  v_reval_active_enrollment public.student_enrollments%rowtype;
  v_created_enrollment_ids uuid[] := array[]::uuid[];

  v_committed_new_cnt integer := 0;
  v_reused_matching_cnt integer := 0;
  v_activated_student_cnt integer := 0;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('imports.enrollments') then
    raise exception using
      errcode = '42501',
      message = 'IMPORTS_ENROLLMENTS_PERMISSION_DENIED';
  end if;

  normalized_reason := pg_catalog.btrim(p_reason);
  if normalized_reason is null or normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ENROLLMENT_IMPORT_REASON_INVALID';
  end if;

  if p_batch_id is null then
    raise exception using
      errcode = '22023',
      message = 'BATCH_ID_REQUIRED';
  end if;

  -- Lock batch FOR UPDATE
  select * into v_batch
  from public.student_enrollment_import_batches
  where id = p_batch_id
  for update;

  if v_batch.id is null then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ENROLLMENT_IMPORT_BATCH_NOT_FOUND';
  end if;

  if v_batch.status = 'committed' then
    raise exception using
      errcode = '23505',
      message = 'STUDENT_ENROLLMENT_IMPORT_BATCH_ALREADY_COMMITTED';
  end if;

  if v_batch.status <> 'ready_to_commit' then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ENROLLMENT_IMPORT_BATCH_NOT_READY';
  end if;

  -- Revalidate all rows against live DB state before operational write
  for r in
    select * from public.student_enrollment_import_rows
    where batch_id = p_batch_id
    order by source_row asc
  loop
    -- Re-verify student exists; lock it like enroll_student_in_class does
    select id, lifecycle_status
    into v_student_id, v_student_lifecycle_status
    from public.students
    where public_code = r.student_public_code
    for update;

    if v_student_id is null then
      raise exception using
        errcode = '22023',
        message = 'STUDENT_ENROLLMENT_IMPORT_REVALIDATION_FAILED';
    end if;

    -- Re-verify class exists and active
    select id into v_class_id
    from public.classes
    where code = r.class_code
      and academic_year_id = v_batch.academic_year_id
      and status = 'active';

    if v_class_id is null then
      raise exception using
        errcode = '22023',
        message = 'STUDENT_ENROLLMENT_IMPORT_REVALIDATION_FAILED';
    end if;

    -- Re-check active enrollment state
    select * into v_reval_active_enrollment
    from public.student_enrollments
    where student_id = v_student_id
      and status = 'active'
      and effective_to is null;

    if r.classification = 'new' then
      if v_reval_active_enrollment.id is not null then
        -- Student acquired an active enrollment after batch creation!
        raise exception using
          errcode = '22023',
          message = 'STUDENT_ENROLLMENT_IMPORT_REVALIDATION_FAILED';
      end if;

      insert into public.student_enrollments (
        student_id,
        class_id,
        registered_mode,
        transition_kind,
        status,
        effective_from,
        effective_to,
        start_reason,
        started_by
      )
      values (
        v_student_id,
        v_class_id,
        r.registered_mode,
        'initial',
        'active',
        r.effective_from,
        null,
        normalized_reason,
        actor_id
      )
      returning id into v_new_enrollment_id;

      -- Same student-side effects as enroll_student_in_class
      update public.students
      set
        lifecycle_status = 'active',
        registered_mode = r.registered_mode,
        official_start_date = coalesce(
          official_start_date,
          r.effective_from
        )
      where id = v_student_id;

      if v_student_lifecycle_status is distinct from 'active' then
        v_activated_student_cnt := v_activated_student_cnt + 1;
      end if;

      v_created_enrollment_ids := pg_catalog.array_append(v_created_enrollment_ids, v_new_enrollment_id);
      v_committed_new_cnt := v_committed_new_cnt + 1;

      -- Update staging row with created enrollment reference
      update public.student_enrollment_import_rows
      set
        resolved_student_id = v_student_id,
        resolved_class_id = v_class_id,
        resolved_enrollment_id = v_new_enrollment_id
      where id = r.id;

    elsif r.classification = 'existing_matching' then
      if v_reval_active_enrollment.id is null
         or v_reval_active_enrollment.class_id <> v_class_id
         or v_reval_active_enrollment.registered_mode <> r.registered_mode
         or v_reval_active_enrollment.effective_from <> r.effective_from
      then
        -- Active enrollment state changed!
        raise exception using
          errcode = '22023',
          message = 'STUDENT_ENROLLMENT_IMPORT_REVALIDATION_FAILED';
      end if;

      -- Heal students enrolled by an import before this fix
      if v_student_lifecycle_status not in ('active', 'resumed') then
        update public.students
        set
          lifecycle_status = 'active',
          registered_mode = r.registered_mode,
          official_start_date = coalesce(
            official_start_date,
            r.effective_from
          )
        where id = v_student_id;

        v_activated_student_cnt := v_activated_student_cnt + 1;
      end if;

      v_reused_matching_cnt := v_reused_matching_cnt + 1;

      -- Update staging row with existing enrollment reference
      update public.student_enrollment_import_rows
      set
        resolved_student_id = v_student_id,
        resolved_class_id = v_class_id,
        resolved_enrollment_id = v_reval_active_enrollment.id
      where id = r.id;
    else
      -- Cannot commit conflict or invalid rows
      raise exception using
        errcode = '22023',
        message = 'STUDENT_ENROLLMENT_IMPORT_REVALIDATION_FAILED';
    end if;
  end loop;

  -- Update Batch Status
  update public.student_enrollment_import_batches
  set
    status = 'committed',
    committed_by = actor_id,
    committed_at = pg_catalog.now()
  where id = p_batch_id;

  -- Audit log event
  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    metadata
  )
  values (
    actor_id,
    'imports',
    'student_enrollment_import_batch_committed',
    'student_enrollment_import_batch',
    p_batch_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'source_filename', v_batch.source_filename,
      'source_sha256', v_batch.source_sha256,
      'academic_year_code', v_batch.academic_year_code,
      'committed_new_count', v_committed_new_cnt,
      'reused_matching_count', v_reused_matching_cnt,
      'activated_student_count', v_activated_student_cnt
    ),
    normalized_reason,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'committed',
    'committed_new_count', v_committed_new_cnt,
    'reused_matching_count', v_reused_matching_cnt,
    'activated_student_count', v_activated_student_cnt,
    'committed_at', pg_catalog.now()
  );
end;
$$;

revoke all on function public.commit_student_enrollment_import_batch(uuid, text) from public, anon;
grant execute on function public.commit_student_enrollment_import_batch(uuid, text) to authenticated;

commit;
