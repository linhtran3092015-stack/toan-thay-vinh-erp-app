begin;

-- =========================================================
-- TASK 7B-2A
-- Student Enrollment Bulk Import Database Foundation
--
-- Target Academic Year: 2026-2027
-- Supports 2-Phase Controlled Bulk Enrollment Import Workflow:
--   Dry-run -> Create Batch -> All-or-Nothing Commit
-- SHA-256 Idempotency Protection
-- Pure Security Definer RPCs; No direct browser writes allowed
-- ZERO writes to class_sessions, session_ledger, students, or classes
-- =========================================================


-- =========================================================
-- 1. SEED NEW PERMISSION
-- =========================================================

insert into public.permissions (
  code,
  module,
  name,
  description,
  is_active
)
values (
  'imports.enrollments',
  'imports',
  'Import hàng loạt ghi danh học viên',
  'Tải file, kiểm tra dry-run và import hàng loạt ghi danh học viên vào lớp.',
  true
)
on conflict (code) do update
set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

-- Grant default permission ONLY to owner role
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where r.code = 'owner'
  and p.code = 'imports.enrollments'
on conflict (role_id, permission_id) do nothing;


-- =========================================================
-- 2. IMPORT BATCHES TABLE
-- =========================================================

create table public.student_enrollment_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  source_sha256 text not null,
  academic_year_code text not null,
  academic_year_id uuid references public.academic_years(id) on delete restrict,
  status text not null default 'ready_to_commit',

  row_count integer not null default 0,
  new_count integer not null default 0,
  matching_count integer not null default 0,
  conflict_count integer not null default 0,
  invalid_count integer not null default 0,

  reason text not null,
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  committed_by uuid references public.profiles(id) on delete restrict,
  committed_at timestamptz,

  constraint student_enrollment_import_batches_filename_check
    check (
      source_filename = pg_catalog.btrim(source_filename)
      and source_filename <> ''
    ),

  constraint student_enrollment_import_batches_sha256_check
    check (
      source_sha256 = pg_catalog.lower(pg_catalog.btrim(source_sha256))
      and source_sha256 ~ '^[0-9a-fA-F]{64}$'
    ),

  constraint student_enrollment_import_batches_academic_year_code_check
    check (
      academic_year_code = pg_catalog.btrim(academic_year_code)
      and academic_year_code ~ '^[0-9]{4}-[0-9]{4}$'
    ),

  constraint student_enrollment_import_batches_status_check
    check (
      status in ('ready_to_commit', 'committed', 'rejected')
    ),

  constraint student_enrollment_import_batches_reason_check
    check (
      reason = pg_catalog.btrim(reason)
      and reason <> ''
    ),

  constraint student_enrollment_import_batches_row_counts_check
    check (
      row_count >= 0
      and new_count >= 0
      and matching_count >= 0
      and conflict_count >= 0
      and invalid_count >= 0
      and row_count = (new_count + matching_count + conflict_count + invalid_count)
    ),

  constraint student_enrollment_import_batches_committed_check
    check (
      (
        status = 'committed'
        and committed_at is not null
        and committed_by is not null
      )
      or
      (
        status <> 'committed'
        and committed_at is null
        and committed_by is null
      )
    )
);

create unique index student_enrollment_import_batches_source_sha256_uidx
on public.student_enrollment_import_batches (source_sha256);

create index student_enrollment_import_batches_created_at_idx
on public.student_enrollment_import_batches (created_at desc);

create index student_enrollment_import_batches_status_idx
on public.student_enrollment_import_batches (status);

comment on table public.student_enrollment_import_batches is
  'Lưu vết các đợt import hàng loạt ghi danh học viên vào lớp.';

alter table public.student_enrollment_import_batches
  enable row level security;

create policy student_enrollment_import_batches_select_authorized
on public.student_enrollment_import_batches
for select
to authenticated
using (
  public.has_permission('imports.enrollments')
);


-- =========================================================
-- 3. IMPORT ROWS TABLE
-- =========================================================

create table public.student_enrollment_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.student_enrollment_import_batches(id) on delete cascade,

  source_row integer not null,
  academic_year_code text not null,
  student_public_code text not null,
  class_code text not null,
  registered_mode text not null,
  effective_from date not null,

  classification text not null,

  resolved_student_id uuid
    references public.students(id) on delete restrict,
  resolved_class_id uuid
    references public.classes(id) on delete restrict,
  resolved_enrollment_id uuid
    references public.student_enrollments(id) on delete restrict,

  validation_code text,
  validation_message text,

  created_at timestamptz not null default pg_catalog.now(),

  constraint student_enrollment_import_rows_source_row_check
    check (source_row > 0),

  constraint student_enrollment_import_rows_student_code_check
    check (
      student_public_code = pg_catalog.btrim(student_public_code)
      and student_public_code <> ''
    ),

  constraint student_enrollment_import_rows_class_code_check
    check (
      class_code = pg_catalog.btrim(class_code)
      and class_code <> ''
    ),

  constraint student_enrollment_import_rows_registered_mode_check
    check (registered_mode in ('online', 'offline')),

  constraint student_enrollment_import_rows_classification_check
    check (
      classification in (
        'new',
        'existing_matching',
        'existing_conflict',
        'invalid'
      )
    ),

  constraint student_enrollment_import_rows_batch_source_row_uidx
    unique (batch_id, source_row),

  constraint student_enrollment_import_rows_batch_student_uidx
    unique (batch_id, student_public_code)
);

create index student_enrollment_import_rows_batch_id_idx
on public.student_enrollment_import_rows (batch_id, source_row);

create index student_enrollment_import_rows_classification_idx
on public.student_enrollment_import_rows (batch_id, classification);

comment on table public.student_enrollment_import_rows is
  'Chi tiết từng dòng ghi danh được kiểm tra và lưu vết trong đợt import.';

alter table public.student_enrollment_import_rows
  enable row level security;

create policy student_enrollment_import_rows_select_authorized
on public.student_enrollment_import_rows
for select
to authenticated
using (
  public.has_permission('imports.enrollments')
);


-- =========================================================
-- 4. DRY-RUN RPC
-- =========================================================

create or replace function public.dry_run_student_enrollment_import(
  p_academic_year_code text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_year_code text;
  v_academic_year_id uuid;

  v_row_count integer;
  v_new_count integer := 0;
  v_matching_count integer := 0;
  v_conflict_count integer := 0;
  v_invalid_count integer := 0;

  r jsonb;
  v_source_row integer;
  v_student_code text;
  v_class_code text;
  v_mode text;
  v_eff_date_str text;
  v_eff_date date;

  v_student_id uuid;
  v_class_id uuid;

  v_existing_active_enrollment public.student_enrollments%rowtype;
  v_has_historical_enrollment boolean;

  v_classification text;
  v_val_code text;
  v_val_msg text;

  seen_student_codes text[] := array[]::text[];
  result_rows jsonb := '[]'::jsonb;
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

  normalized_year_code := pg_catalog.btrim(p_academic_year_code);
  if normalized_year_code is null or normalized_year_code = '' then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_CODE_REQUIRED';
  end if;

  select id into v_academic_year_id
  from public.academic_years
  where code = normalized_year_code;

  if v_academic_year_id is null then
    raise exception using
      errcode = '22023',
      message = 'ENROLLMENT_IMPORT_ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ENROLLMENT_IMPORT_ROWS_MUST_BE_ARRAY';
  end if;

  v_row_count := jsonb_array_length(p_rows);
  if v_row_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ENROLLMENT_IMPORT_ROWS_REQUIRED';
  end if;

  if v_row_count > 1000 then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ENROLLMENT_IMPORT_MAXIMUM_1000_ROWS';
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_source_row := (r->>'source_row')::integer;
    v_student_code := pg_catalog.btrim(r->>'student_public_code');
    v_class_code := pg_catalog.btrim(r->>'class_code');
    v_mode := pg_catalog.lower(pg_catalog.btrim(r->>'registered_mode'));
    v_eff_date_str := pg_catalog.btrim(r->>'effective_from');

    v_classification := null;
    v_val_code := null;
    v_val_msg := null;
    v_student_id := null;
    v_class_id := null;

    -- 1. Check duplicate student in file
    if v_student_code is not null and v_student_code <> '' then
      if v_student_code = any(seen_student_codes) then
        v_classification := 'invalid';
        v_val_code := 'ENROLLMENT_IMPORT_DUPLICATE_STUDENT_IN_FILE';
        v_val_msg := 'Học viên xuất hiện nhiều hơn 1 lần trong file import.';
      else
        seen_student_codes := pg_catalog.array_append(seen_student_codes, v_student_code);
      end if;
    end if;

    -- 2. Validate required fields & types if not already marked invalid
    if v_classification is null then
      if v_student_code is null or v_student_code = '' then
        v_classification := 'invalid';
        v_val_code := 'ENROLLMENT_IMPORT_STUDENT_CODE_REQUIRED';
        v_val_msg := 'Mã học viên không được để trống.';
      elsif v_class_code is null or v_class_code = '' then
        v_classification := 'invalid';
        v_val_code := 'ENROLLMENT_IMPORT_CLASS_CODE_REQUIRED';
        v_val_msg := 'Mã lớp không được để trống.';
      elsif v_mode is null or v_mode not in ('online', 'offline') then
        v_classification := 'invalid';
        v_val_code := 'ENROLLMENT_IMPORT_MODE_INVALID';
        v_val_msg := 'Hình thức học không hợp lệ (chỉ chấp nhận online hoặc offline).';
      else
        begin
          v_eff_date := v_eff_date_str::date;
        exception when others then
          v_eff_date := null;
        end;

        if v_eff_date is null then
          v_classification := 'invalid';
          v_val_code := 'ENROLLMENT_IMPORT_EFFECTIVE_DATE_INVALID';
          v_val_msg := 'Ngày hiệu lực không hợp lệ.';
        end if;
      end if;
    end if;

    -- 3. Resolve student and class
    if v_classification is null then
      select id into v_student_id
      from public.students
      where public_code = v_student_code;

      if v_student_id is null then
        v_classification := 'invalid';
        v_val_code := 'ENROLLMENT_IMPORT_STUDENT_NOT_FOUND';
        v_val_msg := 'Không tìm thấy học viên có mã ' || v_student_code || '.';
      end if;
    end if;

    if v_classification is null then
      select id into v_class_id
      from public.classes
      where code = v_class_code
        and academic_year_id = v_academic_year_id
        and status = 'active';

      if v_class_id is null then
        v_classification := 'invalid';
        v_val_code := 'ENROLLMENT_IMPORT_CLASS_NOT_FOUND';
        v_val_msg := 'Không tìm thấy lớp học active ' || v_class_code || ' trong năm học ' || normalized_year_code || '.';
      end if;
    end if;

    -- 4. Check enrollment history & status
    if v_classification is null then
      -- Check active enrollment
      select * into v_existing_active_enrollment
      from public.student_enrollments
      where student_id = v_student_id
        and status = 'active'
        and effective_to is null;

      if v_existing_active_enrollment.id is null then
        -- Check if student has non-active historical enrollments
        select exists (
          select 1 from public.student_enrollments
          where student_id = v_student_id
        ) into v_has_historical_enrollment;

        if v_has_historical_enrollment then
          v_classification := 'existing_conflict';
          v_val_code := 'ENROLLMENT_IMPORT_HISTORICAL_ENROLLMENT_CONFLICT';
          v_val_msg := 'Học viên có lịch sử ghi danh đã đóng/chuyển/bảo lưu. Không thể import tự động.';
        else
          v_classification := 'new';
        end if;
      else
        -- Active enrollment exists, check exact match vs conflict
        if v_existing_active_enrollment.class_id = v_class_id
           and v_existing_active_enrollment.registered_mode = v_mode
           and v_existing_active_enrollment.effective_from = v_eff_date
        then
          v_classification := 'existing_matching';
        else
          v_classification := 'existing_conflict';
          v_val_code := 'ENROLLMENT_IMPORT_ACTIVE_ENROLLMENT_CONFLICT';
          v_val_msg := 'Học viên đang có ghi danh active khác lớp, hình thức hoặc ngày bắt đầu.';
        end if;
      end if;
    end if;

    -- Summary counter increments
    if v_classification = 'new' then
      v_new_count := v_new_count + 1;
    elsif v_classification = 'existing_matching' then
      v_matching_count := v_matching_count + 1;
    elsif v_classification = 'existing_conflict' then
      v_conflict_count := v_conflict_count + 1;
    elsif v_classification = 'invalid' then
      v_invalid_count := v_invalid_count + 1;
    end if;

    result_rows := result_rows || jsonb_build_object(
      'source_row', v_source_row,
      'academic_year_code', normalized_year_code,
      'student_public_code', v_student_code,
      'class_code', v_class_code,
      'registered_mode', v_mode,
      'effective_from', v_eff_date_str,
      'classification', v_classification,
      'resolved_student_id', v_student_id,
      'resolved_class_id', v_class_id,
      'resolved_enrollment_id', v_existing_active_enrollment.id,
      'validation_code', v_val_code,
      'validation_message', v_val_msg
    );
  end loop;

  return jsonb_build_object(
    'academic_year_code', normalized_year_code,
    'academic_year_id', v_academic_year_id,
    'row_count', v_row_count,
    'new_count', v_new_count,
    'matching_count', v_matching_count,
    'conflict_count', v_conflict_count,
    'invalid_count', v_invalid_count,
    'rows', result_rows
  );
end;
$$;


-- =========================================================
-- 5. CREATE BATCH RPC
-- =========================================================

create or replace function public.create_student_enrollment_import_batch(
  p_source_filename text,
  p_source_sha256 text,
  p_reason text,
  p_academic_year_code text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_filename text;
  normalized_sha256 text;
  normalized_reason text;
  normalized_year_code text;

  dry_res jsonb;
  v_academic_year_id uuid;
  v_batch_status text;

  batch_id uuid;
  batch_row public.student_enrollment_import_batches%rowtype;
  item jsonb;
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

  normalized_filename := pg_catalog.btrim(p_source_filename);
  if normalized_filename is null or normalized_filename = '' then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ENROLLMENT_IMPORT_SOURCE_FILENAME_INVALID';
  end if;

  normalized_sha256 := pg_catalog.lower(pg_catalog.btrim(p_source_sha256));
  if normalized_sha256 is null or normalized_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ENROLLMENT_IMPORT_SOURCE_SHA256_INVALID';
  end if;

  normalized_reason := pg_catalog.btrim(p_reason);
  if normalized_reason is null or normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ENROLLMENT_IMPORT_REASON_INVALID';
  end if;

  -- SHA-256 Idempotency Protection
  if exists (
    select 1 from public.student_enrollment_import_batches
    where source_sha256 = normalized_sha256
  ) then
    raise exception using
      errcode = '23505',
      message = 'STUDENT_ENROLLMENT_IMPORT_SHA_ALREADY_EXISTS';
  end if;

  -- Execute dry-run validation internally
  dry_res := public.dry_run_student_enrollment_import(p_academic_year_code, p_rows);

  v_academic_year_id := (dry_res->>'academic_year_id')::uuid;
  normalized_year_code := dry_res->>'academic_year_code';

  if (dry_res->>'conflict_count')::integer = 0 and (dry_res->>'invalid_count')::integer = 0 then
    v_batch_status := 'ready_to_commit';
  else
    v_batch_status := 'rejected';
  end if;

  -- Insert Batch
  insert into public.student_enrollment_import_batches (
    source_filename,
    source_sha256,
    academic_year_code,
    academic_year_id,
    status,
    row_count,
    new_count,
    matching_count,
    conflict_count,
    invalid_count,
    reason,
    created_by
  )
  values (
    normalized_filename,
    normalized_sha256,
    normalized_year_code,
    v_academic_year_id,
    v_batch_status,
    (dry_res->>'row_count')::integer,
    (dry_res->>'new_count')::integer,
    (dry_res->>'matching_count')::integer,
    (dry_res->>'conflict_count')::integer,
    (dry_res->>'invalid_count')::integer,
    normalized_reason,
    actor_id
  )
  returning * into batch_row;

  batch_id := batch_row.id;

  -- Insert Rows
  for item in select * from jsonb_array_elements(dry_res->'rows')
  loop
    insert into public.student_enrollment_import_rows (
      batch_id,
      source_row,
      academic_year_code,
      student_public_code,
      class_code,
      registered_mode,
      effective_from,
      classification,
      resolved_student_id,
      resolved_class_id,
      resolved_enrollment_id,
      validation_code,
      validation_message
    )
    values (
      batch_id,
      (item->>'source_row')::integer,
      normalized_year_code,
      item->>'student_public_code',
      item->>'class_code',
      item->>'registered_mode',
      (item->>'effective_from')::date,
      item->>'classification',
      nullif(item->>'resolved_student_id', '')::uuid,
      nullif(item->>'resolved_class_id', '')::uuid,
      nullif(item->>'resolved_enrollment_id', '')::uuid,
      nullif(item->>'validation_code', ''),
      nullif(item->>'validation_message', '')
    );
  end loop;

  -- Audit log event
  perform public.log_audit_event(
    'student_enrollment_import_batch_created',
    'student_enrollment_import_batches',
    batch_id,
    null,
    jsonb_build_object(
      'source_filename', normalized_filename,
      'source_sha256', normalized_sha256,
      'academic_year_code', normalized_year_code,
      'status', v_batch_status,
      'row_count', batch_row.row_count,
      'new_count', batch_row.new_count,
      'matching_count', batch_row.matching_count,
      'conflict_count', batch_row.conflict_count,
      'invalid_count', batch_row.invalid_count,
      'reason', normalized_reason
    )
  );

  return jsonb_build_object(
    'batch', to_jsonb(batch_row),
    'dry_run', dry_res
  );
end;
$$;


-- =========================================================
-- 6. COMMIT BATCH RPC
-- =========================================================

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
  v_class_id uuid;
  v_existing_enrollment_id uuid;
  v_new_enrollment_id uuid;

  v_reval_active_enrollment public.student_enrollments%rowtype;
  v_created_enrollment_ids uuid[] := array[]::uuid[];

  v_committed_new_cnt integer := 0;
  v_reused_matching_cnt integer := 0;
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
    -- Re-verify student exists
    select id into v_student_id
    from public.students
    where public_code = r.student_public_code;

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

      -- Operational INSERT into student_enrollments ONLY
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
  perform public.log_audit_event(
    'student_enrollment_import_batch_committed',
    'student_enrollment_import_batches',
    p_batch_id,
    null,
    jsonb_build_object(
      'source_filename', v_batch.source_filename,
      'source_sha256', v_batch.source_sha256,
      'academic_year_code', v_batch.academic_year_code,
      'committed_new_count', v_committed_new_cnt,
      'reused_matching_count', v_reused_matching_cnt,
      'reason', normalized_reason
    )
  );

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'committed',
    'committed_new_count', v_committed_new_cnt,
    'reused_matching_count', v_reused_matching_cnt,
    'committed_at', pg_catalog.now()
  );
end;
$$;

commit;
