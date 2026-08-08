begin;

-- =========================================================
-- TASK 6A-2
-- Class & Schedule Bulk Import Database Foundation
--
-- Target Academic Year: 2026-2027
-- Support for bulk importing 42 operational classes & 84 schedules
-- Supports 2-phase workflow: Dry-run -> Create Batch -> All-or-Nothing Commit
-- SHA-256 Idempotency Protection
-- Pure Security Definer RPCs; No direct browser writes allowed
-- ZERO direct writes to class_sessions
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
  'imports.classes',
  'imports',
  'Import hàng loạt lớp học và lịch học',
  'Tải file, kiểm tra dry-run và import hàng loạt lớp học và lịch học cố định.',
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
  and p.code = 'imports.classes'
on conflict (role_id, permission_id) do nothing;


-- =========================================================
-- 2. IMPORT BATCHES TABLE
-- =========================================================

create table public.class_schedule_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  source_sha256 text not null,
  academic_year_code text not null,
  academic_year_id uuid references public.academic_years(id) on delete restrict,
  status text not null default 'previewed',

  class_row_count integer not null default 0,
  class_new_count integer not null default 0,
  class_matching_count integer not null default 0,
  class_conflict_count integer not null default 0,
  class_invalid_count integer not null default 0,

  schedule_row_count integer not null default 0,
  schedule_new_count integer not null default 0,
  schedule_matching_count integer not null default 0,
  schedule_conflict_count integer not null default 0,
  schedule_invalid_count integer not null default 0,

  reason text not null,
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  committed_by uuid references public.profiles(id) on delete restrict,
  committed_at timestamptz,

  constraint class_schedule_import_batches_filename_check
    check (
      source_filename = pg_catalog.btrim(source_filename)
      and source_filename <> ''
    ),

  constraint class_schedule_import_batches_sha256_check
    check (
      source_sha256 = pg_catalog.lower(pg_catalog.btrim(source_sha256))
      and source_sha256 ~ '^[0-9a-fA-F]{64}$'
    ),

  constraint class_schedule_import_batches_academic_year_code_check
    check (
      academic_year_code = pg_catalog.btrim(academic_year_code)
      and academic_year_code ~ '^[0-9]{4}-[0-9]{4}$'
    ),

  constraint class_schedule_import_batches_status_check
    check (status in ('previewed', 'ready_to_commit', 'committed', 'rejected')),

  constraint class_schedule_import_batches_reason_check
    check (
      reason = pg_catalog.btrim(reason)
      and reason <> ''
    ),

  constraint class_schedule_import_batches_counts_check
    check (
      class_row_count >= 0
      and class_new_count >= 0
      and class_matching_count >= 0
      and class_conflict_count >= 0
      and class_invalid_count >= 0
      and schedule_row_count >= 0
      and schedule_new_count >= 0
      and schedule_matching_count >= 0
      and schedule_conflict_count >= 0
      and schedule_invalid_count >= 0
    ),

  constraint class_schedule_import_batches_commit_state_check
    check (
      (
        status = 'committed'
        and committed_by is not null
        and committed_at is not null
      )
      or
      (
        status <> 'committed'
        and committed_by is null
        and committed_at is null
      )
    )
);

create unique index class_schedule_import_batches_sha256_unique_idx
on public.class_schedule_import_batches (source_sha256);

create index class_schedule_import_batches_academic_year_idx
on public.class_schedule_import_batches (academic_year_code, created_at desc);

create index class_schedule_import_batches_status_idx
on public.class_schedule_import_batches (status, created_at desc);


-- =========================================================
-- 3. IMPORT CLASS ROWS TABLE
-- =========================================================

create table public.class_schedule_import_class_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.class_schedule_import_batches(id) on delete restrict,
  source_row_number integer not null,

  academic_year_code text not null,
  class_code text not null,
  class_name text not null,
  grade integer not null,
  level text not null,
  weekly_session_count integer not null default 2,
  default_learning_mode text not null default 'hybrid',
  status text not null default 'active',

  resolved_academic_year_id uuid references public.academic_years(id) on delete restrict,
  resolved_class_id uuid references public.classes(id) on delete restrict,

  classification text not null,
  validation_code text,
  validation_message text,

  created_at timestamptz not null default pg_catalog.now(),

  constraint class_schedule_import_class_rows_row_number_check
    check (source_row_number > 0),

  constraint class_schedule_import_class_rows_code_check
    check (
      class_code = pg_catalog.upper(pg_catalog.btrim(class_code))
      and class_code ~ '^[A-Z0-9._-]+$'
    ),

  constraint class_schedule_import_class_rows_name_check
    check (
      class_name = pg_catalog.btrim(class_name)
      and class_name <> ''
    ),

  constraint class_schedule_import_class_rows_grade_check
    check (grade between 1 and 12),

  constraint class_schedule_import_class_rows_level_check
    check (level in ('A', 'B', 'CLC')),

  constraint class_schedule_import_class_rows_weekly_sessions_check
    check (weekly_session_count between 1 and 7),

  constraint class_schedule_import_class_rows_learning_mode_check
    check (default_learning_mode in ('online', 'offline', 'hybrid')),

  constraint class_schedule_import_class_rows_status_check
    check (status in ('draft', 'active', 'closed', 'archived')),

  constraint class_schedule_import_class_rows_classification_check
    check (classification in ('new', 'existing_matching', 'existing_conflict', 'invalid', 'committed'))
);

create unique index class_schedule_import_class_rows_batch_row_unique_idx
on public.class_schedule_import_class_rows (batch_id, source_row_number);

create index class_schedule_import_class_rows_classification_idx
on public.class_schedule_import_class_rows (batch_id, classification);


-- =========================================================
-- 4. IMPORT SCHEDULE ROWS TABLE
-- =========================================================

create table public.class_schedule_import_schedule_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.class_schedule_import_batches(id) on delete restrict,
  source_row_number integer not null,

  class_code text not null,
  component_code text not null,
  weekday integer not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  learning_mode text not null default 'hybrid',
  room_name text,
  meeting_url text,
  effective_from date not null,
  effective_to date,

  resolved_class_id uuid references public.classes(id) on delete restrict,
  resolved_schedule_template_id uuid references public.class_schedule_templates(id) on delete restrict,

  classification text not null,
  validation_code text,
  validation_message text,

  created_at timestamptz not null default pg_catalog.now(),

  constraint class_schedule_import_schedule_rows_row_number_check
    check (source_row_number > 0),

  constraint class_schedule_import_schedule_rows_class_code_check
    check (
      class_code = pg_catalog.upper(pg_catalog.btrim(class_code))
      and class_code ~ '^[A-Z0-9._-]+$'
    ),

  constraint class_schedule_import_schedule_rows_component_code_check
    check (
      component_code = pg_catalog.upper(pg_catalog.btrim(component_code))
      and component_code ~ '^[A-Z0-9._-]+$'
    ),

  constraint class_schedule_import_schedule_rows_weekday_check
    check (weekday between 1 and 7),

  constraint class_schedule_import_schedule_rows_time_check
    check (end_time > start_time),

  constraint class_schedule_import_schedule_rows_learning_mode_check
    check (learning_mode in ('online', 'offline', 'hybrid')),

  constraint class_schedule_import_schedule_rows_classification_check
    check (classification in ('new', 'existing_matching', 'existing_conflict', 'invalid', 'committed'))
);

create unique index class_schedule_import_schedule_rows_batch_row_unique_idx
on public.class_schedule_import_schedule_rows (batch_id, source_row_number);

create index class_schedule_import_schedule_rows_classification_idx
on public.class_schedule_import_schedule_rows (batch_id, classification);


-- =========================================================
-- 5. IMMUTABILITY TRIGGERS
-- =========================================================

create or replace function public.prevent_committed_class_schedule_import_batch_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'committed' then
    raise exception using
      errcode = '23514',
      message = 'COMMITTED_CLASS_SCHEDULE_IMPORT_BATCH_IS_IMMUTABLE';
  end if;

  return new;
end;
$$;

create trigger prevent_committed_class_schedule_import_batch_mutation
before update on public.class_schedule_import_batches
for each row execute function public.prevent_committed_class_schedule_import_batch_mutation();


-- =========================================================
-- 6. RLS POLICIES
-- =========================================================

alter table public.class_schedule_import_batches enable row level security;
alter table public.class_schedule_import_class_rows enable row level security;
alter table public.class_schedule_import_schedule_rows enable row level security;

-- Read policies
create policy class_schedule_import_batches_select_authorized
on public.class_schedule_import_batches
for select
to authenticated
using (
  public.has_permission('imports.classes')
  or public.has_permission('classes.view')
);

create policy class_schedule_import_class_rows_select_authorized
on public.class_schedule_import_class_rows
for select
to authenticated
using (
  public.has_permission('imports.classes')
  or public.has_permission('classes.view')
);

create policy class_schedule_import_schedule_rows_select_authorized
on public.class_schedule_import_schedule_rows
for select
to authenticated
using (
  public.has_permission('imports.classes')
  or public.has_permission('classes.view')
);

-- Write policies: DENY ALL direct browser writes (writes go through SECURITY DEFINER RPCs)
create policy class_schedule_import_batches_write_denied
on public.class_schedule_import_batches
for all
to authenticated
using (false)
with check (false);

create policy class_schedule_import_class_rows_write_denied
on public.class_schedule_import_class_rows
for all
to authenticated
using (false)
with check (false);

create policy class_schedule_import_schedule_rows_write_denied
on public.class_schedule_import_schedule_rows
for all
to authenticated
using (false)
with check (false);


-- =========================================================
-- 7. RPC 1: DRY RUN CLASS SCHEDULE IMPORT (READ ONLY)
-- =========================================================

create or replace function public.dry_run_class_schedule_import(
  p_academic_year_code text,
  p_classes jsonb,
  p_schedules jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_year public.academic_years%rowtype;
  v_class_item jsonb;
  v_schedule_item jsonb;

  -- Year variables
  v_year_code text;

  -- Class loop variables
  v_class_code text;
  v_class_name text;
  v_grade integer;
  v_level text;
  v_weekly_sessions integer;
  v_mode text;
  v_status text;
  v_c_row_num integer;

  v_db_class public.classes%rowtype;
  v_c_classification text;
  v_c_code text;
  v_c_message text;

  -- Class tracking maps / arrays
  v_class_codes_seen text[] := array[]::text[];
  v_class_results jsonb := '[]'::jsonb;
  v_class_summary jsonb;
  v_c_total integer := 0;
  v_c_new integer := 0;
  v_c_matching integer := 0;
  v_c_conflict integer := 0;
  v_c_invalid integer := 0;

  -- Map of valid imported class codes -> weekly_session_count
  v_import_class_weekly_sessions jsonb := '{}'::jsonb;
  -- Map of valid imported class codes -> list of schedules
  v_import_class_schedule_counts jsonb := '{}'::jsonb;

  -- Schedule loop variables
  v_s_class_code text;
  v_component_code text;
  v_weekday integer;
  v_start_time time without time zone;
  v_end_time time without time zone;
  v_s_mode text;
  v_room text;
  v_meeting text;
  v_effective_from date;
  v_effective_to date;
  v_s_row_num integer;

  v_db_schedule public.class_schedule_templates%rowtype;
  v_s_classification text;
  v_s_code text;
  v_s_message text;
  v_s_slot_key text;
  v_schedule_slots_seen text[] := array[]::text[];
  v_schedule_results jsonb := '[]'::jsonb;

  v_s_summary jsonb;
  v_s_total integer := 0;
  v_s_new integer := 0;
  v_s_matching integer := 0;
  v_s_conflict integer := 0;
  v_s_invalid integer := 0;

begin
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('imports.classes') then
    raise exception using
      errcode = '42501',
      message = 'IMPORTS_CLASSES_PERMISSION_REQUIRED';
  end if;

  v_year_code := pg_catalog.btrim(p_academic_year_code);

  if v_year_code is null or v_year_code = '' then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_CODE_REQUIRED';
  end if;

  -- Resolve target academic year
  select y.*
  into v_year
  from public.academic_years as y
  where y.code = v_year_code;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if v_year.status = 'archived' then
    raise exception using
      errcode = '23514',
      message = 'ACADEMIC_YEAR_IS_ARCHIVED';
  end if;

  -- =========================================================
  -- 1. PROCESS CLASS ROWS
  -- =========================================================
  if p_classes is null or pg_catalog.jsonb_array_length(p_classes) = 0 then
    raise exception using
      errcode = '22023',
      message = 'CLASS_ROWS_REQUIRED';
  end if;

  for v_class_item in select * from pg_catalog.jsonb_array_elements(p_classes) loop
    v_c_total := v_c_total + 1;
    v_c_row_num := pg_catalog.coalesce((v_class_item->>'source_row_number')::integer, v_c_total + 1);

    v_class_code := pg_catalog.upper(pg_catalog.btrim(v_class_item->>'class_code'));
    v_class_name := pg_catalog.btrim(v_class_item->>'class_name');
    v_grade := (v_class_item->>'grade')::integer;
    v_level := pg_catalog.upper(pg_catalog.btrim(v_class_item->>'level'));
    v_weekly_sessions := pg_catalog.coalesce((v_class_item->>'weekly_sessions')::integer, (v_class_item->>'weekly_session_count')::integer, 2);
    v_mode := pg_catalog.lower(pg_catalog.btrim(pg_catalog.coalesce(v_class_item->>'default_learning_mode', v_class_item->>'learning_mode', 'hybrid')));
    v_status := pg_catalog.lower(pg_catalog.btrim(pg_catalog.coalesce(v_class_item->>'status', 'active')));

    v_c_classification := null;
    v_c_code := null;
    v_c_message := null;
    v_db_class := null;

    -- Basic class validation
    if v_class_code is null or v_class_code = '' or v_class_code !~ '^[A-Z0-9._-]+$' then
      v_c_classification := 'invalid';
      v_c_code := 'INVALID_CLASS_CODE';
      v_c_message := 'Mã lớp không hợp lệ (phải viết hoa, chỉ chứa chữ cái, số, dấu chấm, gạch ngang, gạch dưới).';
    elsif v_class_name is null or v_class_name = '' then
      v_c_classification := 'invalid';
      v_c_code := 'INVALID_CLASS_NAME';
      v_c_message := 'Tên lớp không được để trống.';
    elsif v_grade is null or v_grade < 1 or v_grade > 12 then
      v_c_classification := 'invalid';
      v_c_code := 'INVALID_GRADE';
      v_c_message := 'Khối lớp phải từ 1 đến 12.';
    elsif v_level not in ('A', 'B', 'CLC') then
      v_c_classification := 'invalid';
      v_c_code := 'INVALID_LEVEL';
      v_c_message := 'Trình độ lớp phải là A, B hoặc CLC.';
    elsif v_weekly_sessions is null or v_weekly_sessions < 1 or v_weekly_sessions > 7 then
      v_c_classification := 'invalid';
      v_c_code := 'INVALID_WEEKLY_SESSION_COUNT';
      v_c_message := 'Số buổi học/tuần phải từ 1 đến 7.';
    elsif v_mode not in ('online', 'offline', 'hybrid') then
      v_c_classification := 'invalid';
      v_c_code := 'INVALID_LEARNING_MODE';
      v_c_message := 'Hình thức học phải là online, offline hoặc hybrid.';
    elsif v_class_code = any(v_class_codes_seen) then
      v_c_classification := 'invalid';
      v_c_code := 'DUPLICATE_CLASS_CODE_IN_FILE';
      v_c_message := 'Mã lớp ' || v_class_code || ' bị lặp lại trong file Excel.';
    end if;

    if v_c_classification is null then
      v_class_codes_seen := pg_catalog.array_append(v_class_codes_seen, v_class_code);
      v_import_class_weekly_sessions := pg_catalog.jsonb_set(v_import_class_weekly_sessions, array[v_class_code], pg_catalog.to_jsonb(v_weekly_sessions));

      -- Differential match against DB
      select c.*
      into v_db_class
      from public.classes as c
      where c.academic_year_id = v_year.id
        and c.code = v_class_code;

      if not found then
        v_c_classification := 'new';
        v_c_code := 'CLASS_NEW';
        v_c_message := 'Sẽ tạo mới lớp học ' || v_class_code || '.';
        v_c_new := v_c_new + 1;
      else
        -- Compare canonical business fields
        if v_db_class.grade = v_grade
          and v_db_class.level = v_level
          and v_db_class.weekly_session_count = v_weekly_sessions
          and v_db_class.default_learning_mode = v_mode
          and v_db_class.status = v_status
        then
          v_c_classification := 'existing_matching';
          v_c_code := 'CLASS_EXISTING_MATCHING';
          v_c_message := 'Lớp học ' || v_class_code || ' đã tồn tại và khớp hoàn toàn dữ liệu.';
          v_c_matching := v_c_matching + 1;
        else
          v_c_classification := 'existing_conflict';
          v_c_code := 'CLASS_EXISTING_CONFLICT';
          v_c_message := 'Lớp học ' || v_class_code || ' đã tồn tại nhưng có dữ liệu khác biệt (Cơ sở dữ liệu: Khối ' || v_db_class.grade || ', Level ' || v_db_class.level || ', ' || v_db_class.weekly_session_count || ' buổi/tuần, Mode ' || v_db_class.default_learning_mode || '). Không thể đè dữ liệu tự động.';
          v_c_conflict := v_c_conflict + 1;
        end if;
      end if;
    else
      v_c_invalid := v_c_invalid + 1;
    end if;

    v_class_results := v_class_results || pg_catalog.jsonb_build_object(
      'source_row_number', v_c_row_num,
      'academic_year_code', v_year_code,
      'class_code', v_class_code,
      'class_name', v_class_name,
      'grade', v_grade,
      'level', v_level,
      'weekly_session_count', v_weekly_sessions,
      'default_learning_mode', v_mode,
      'status', v_status,
      'resolved_academic_year_id', v_year.id,
      'resolved_class_id', case when v_db_class.id is not null then v_db_class.id else null end,
      'classification', v_c_classification,
      'validation_code', v_c_code,
      'validation_message', v_c_message
    );
  end loop;


  -- =========================================================
  -- 2. PROCESS SCHEDULE ROWS
  -- =========================================================
  if p_schedules is null or pg_catalog.jsonb_array_length(p_schedules) = 0 then
    raise exception using
      errcode = '22023',
      message = 'SCHEDULE_ROWS_REQUIRED';
  end if;

  for v_schedule_item in select * from pg_catalog.jsonb_array_elements(p_schedules) loop
    v_s_total := v_s_total + 1;
    v_s_row_num := pg_catalog.coalesce((v_schedule_item->>'source_row_number')::integer, v_s_total + 1);

    v_s_class_code := pg_catalog.upper(pg_catalog.btrim(v_schedule_item->>'class_code'));
    v_component_code := pg_catalog.upper(pg_catalog.btrim(v_schedule_item->>'component_code'));
    v_weekday := (v_schedule_item->>'weekday')::integer;
    v_start_time := (v_schedule_item->>'start_time')::time;
    v_end_time := (v_schedule_item->>'end_time')::time;
    v_s_mode := pg_catalog.lower(pg_catalog.btrim(pg_catalog.coalesce(v_schedule_item->>'learning_mode', 'hybrid')));
    v_room := nullif(pg_catalog.btrim(pg_catalog.coalesce(v_schedule_item->>'room_name', v_schedule_item->>'room')), '');
    v_meeting := nullif(pg_catalog.btrim(v_schedule_item->>'meeting_url'), '');
    v_effective_from := (v_schedule_item->>'effective_from')::date;
    v_effective_to := nullif(v_schedule_item->>'effective_to', '')::date;

    v_s_classification := null;
    v_s_code := null;
    v_s_message := null;
    v_db_schedule := null;
    v_db_class := null;

    v_s_slot_key := v_s_class_code || ':' || v_component_code || ':' || pg_catalog.coalesce(v_weekday::text, '');

    -- Track schedule counts per class code
    if v_s_class_code is not null and v_s_class_code <> '' then
      v_import_class_schedule_counts := pg_catalog.jsonb_set(
        v_import_class_schedule_counts,
        array[v_s_class_code],
        pg_catalog.to_jsonb(pg_catalog.coalesce((v_import_class_schedule_counts->>v_s_class_code)::integer, 0) + 1)
      );
    end if;

    -- Schedule validation
    if v_s_class_code is null or v_s_class_code = '' then
      v_s_classification := 'invalid';
      v_s_code := 'INVALID_SCHEDULE_CLASS_CODE';
      v_s_message := 'Lịch học phải có mã lớp.';
    elsif v_component_code is null or v_component_code = '' or v_component_code !~ '^[A-Z0-9._-]+$' then
      v_s_classification := 'invalid';
      v_s_code := 'INVALID_COMPONENT_CODE';
      v_s_message := 'Mã môn/phân phần (component_code) không hợp lệ (ví dụ: MAIN1, MAIN2).';
    elsif v_weekday is null or v_weekday < 1 or v_weekday > 7 then
      v_s_classification := 'invalid';
      v_s_code := 'INVALID_WEEKDAY';
      v_s_message := 'Thứ trong tuần phải từ 1 (Thứ 2) đến 7 (Chủ Nhật).';
    elsif v_start_time is null or v_end_time is null or v_end_time <= v_start_time then
      v_s_classification := 'invalid';
      v_s_code := 'INVALID_TIME_RANGE';
      v_s_message := 'Giờ kết thúc phải sau giờ bắt đầu.';
    elsif v_s_mode not in ('online', 'offline', 'hybrid') then
      v_s_classification := 'invalid';
      v_s_code := 'INVALID_SCHEDULE_LEARNING_MODE';
      v_s_message := 'Hình thức học của lịch phải là online, offline hoặc hybrid.';
    elsif v_effective_from is null then
      v_s_classification := 'invalid';
      v_s_code := 'INVALID_EFFECTIVE_FROM';
      v_s_message := 'Ngày hiệu lực (effective_from) không được để trống.';
    elsif v_s_slot_key = any(v_schedule_slots_seen) then
      v_s_classification := 'invalid';
      v_s_code := 'DUPLICATE_SCHEDULE_SLOT_IN_FILE';
      v_s_message := 'Lịch học của lớp ' || v_s_class_code || ' (Môn: ' || v_component_code || ', Thứ: ' || v_weekday || ') bị lặp slot trong file.';
    end if;

    if v_s_classification is null then
      v_schedule_slots_seen := pg_catalog.array_append(v_schedule_slots_seen, v_s_slot_key);

      -- Check if target class exists in DB or import file
      select c.*
      into v_db_class
      from public.classes as c
      where c.academic_year_id = v_year.id
        and c.code = v_s_class_code;

      if v_db_class.id is null and not (v_s_class_code = any(v_class_codes_seen)) then
        v_s_classification := 'invalid';
        v_s_code := 'REFERENCED_CLASS_NOT_FOUND';
        v_s_message := 'Lớp ' || v_s_class_code || ' không tồn tại trong năm học và cũng không có trong danh sách lớp import.';
      end if;
    end if;

    if v_s_classification is null then
      if v_db_class.id is not null then
        -- Match against DB schedule templates
        select st.*
        into v_db_schedule
        from public.class_schedule_templates as st
        where st.class_id = v_db_class.id
          and st.component_code = v_component_code
          and st.weekday = v_weekday
          and st.is_active = true;

        if not found then
          v_s_classification := 'new';
          v_s_code := 'SCHEDULE_NEW';
          v_s_message := 'Sẽ tạo lịch học mới cho lớp ' || v_s_class_code || ' (' || v_component_code || ', Thứ ' || v_weekday || ').';
          v_s_new := v_s_new + 1;
        else
          -- Compare canonical fields
          if v_db_schedule.start_time = v_start_time
            and v_db_schedule.end_time = v_end_time
            and v_db_schedule.learning_mode = v_s_mode
            and v_db_schedule.effective_from = v_effective_from
          then
            v_s_classification := 'existing_matching';
            v_s_code := 'SCHEDULE_EXISTING_MATCHING';
            v_s_message := 'Lịch học ' || v_s_class_code || ' (' || v_component_code || ') đã tồn tại và khớp hoàn toàn.';
            v_s_matching := v_s_matching + 1;
          else
            v_s_classification := 'existing_conflict';
            v_s_code := 'SCHEDULE_EXISTING_CONFLICT';
            v_s_message := 'Lịch học ' || v_s_class_code || ' (' || v_component_code || ') đã tồn tại nhưng có thời gian/thông số khác (DB: ' || v_db_schedule.start_time || '–' || v_db_schedule.end_time || ').';
            v_s_conflict := v_s_conflict + 1;
          end if;
        end if;
      else
        -- Class is NEW
        v_s_classification := 'new';
        v_s_code := 'SCHEDULE_NEW';
        v_s_message := 'Sẽ tạo lịch học mới cho lớp mới ' || v_s_class_code || '.';
        v_s_new := v_s_new + 1;
      end if;
    else
      v_s_invalid := v_s_invalid + 1;
    end if;

    v_schedule_results := v_schedule_results || pg_catalog.jsonb_build_object(
      'source_row_number', v_s_row_num,
      'class_code', v_s_class_code,
      'component_code', v_component_code,
      'weekday', v_weekday,
      'start_time', v_start_time,
      'end_time', v_end_time,
      'learning_mode', v_s_mode,
      'room_name', v_room,
      'meeting_url', v_meeting,
      'effective_from', v_effective_from,
      'effective_to', v_effective_to,
      'resolved_class_id', case when v_db_class.id is not null then v_db_class.id else null end,
      'resolved_schedule_template_id', case when v_db_schedule.id is not null then v_db_schedule.id else null end,
      'classification', v_s_classification,
      'validation_code', v_s_code,
      'validation_message', v_s_message
    );
  end loop;

  -- Build summaries
  v_class_summary := pg_catalog.jsonb_build_object(
    'total', v_c_total,
    'new', v_c_new,
    'existing_matching', v_c_matching,
    'existing_conflict', v_c_conflict,
    'invalid', v_c_invalid
  );

  v_s_summary := pg_catalog.jsonb_build_object(
    'total', v_s_total,
    'new', v_s_new,
    'existing_matching', v_s_matching,
    'existing_conflict', v_s_conflict,
    'invalid', v_s_invalid
  );

  return pg_catalog.jsonb_build_object(
    'academic_year', pg_catalog.jsonb_build_object(
      'id', v_year.id,
      'code', v_year.code,
      'name', v_year.name,
      'status', v_year.status
    ),
    'class_summary', v_class_summary,
    'schedule_summary', v_s_summary,
    'class_rows', v_class_results,
    'schedule_rows', v_schedule_results
  );
end;
$$;


-- =========================================================
-- 8. RPC 2: CREATE CLASS SCHEDULE IMPORT BATCH
-- =========================================================

create or replace function public.create_class_schedule_import_batch(
  p_academic_year_code text,
  p_reason text,
  p_source_filename text,
  p_source_sha256 text,
  p_classes jsonb,
  p_schedules jsonb
)
returns public.class_schedule_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_dry_run_result jsonb;

  v_normalized_sha256 text;
  v_normalized_filename text;
  v_normalized_reason text;
  v_year_code text;

  v_year_id uuid;

  v_class_summary jsonb;
  v_schedule_summary jsonb;

  v_c_total integer;
  v_c_new integer;
  v_c_matching integer;
  v_c_conflict integer;
  v_c_invalid integer;

  v_s_total integer;
  v_s_new integer;
  v_s_matching integer;
  v_s_conflict integer;
  v_s_invalid integer;

  v_batch_status text;
  v_batch public.class_schedule_import_batches%rowtype;

  v_c_row jsonb;
  v_s_row jsonb;

begin
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('imports.classes') then
    raise exception using
      errcode = '42501',
      message = 'IMPORTS_CLASSES_PERMISSION_REQUIRED';
  end if;

  v_normalized_filename := pg_catalog.btrim(p_source_filename);
  v_normalized_sha256 := pg_catalog.lower(pg_catalog.btrim(p_source_sha256));
  v_normalized_reason := pg_catalog.btrim(p_reason);
  v_year_code := pg_catalog.btrim(p_academic_year_code);

  if v_normalized_filename is null or v_normalized_filename = '' then
    raise exception using
      errcode = '22023',
      message = 'SOURCE_FILENAME_REQUIRED';
  end if;

  if v_normalized_sha256 is null or v_normalized_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'SOURCE_SHA256_INVALID';
  end if;

  if v_normalized_reason is null or v_normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'IMPORT_REASON_REQUIRED';
  end if;

  -- SHA idempotency check
  if exists (
    select 1
    from public.class_schedule_import_batches
    where source_sha256 = v_normalized_sha256
  ) then
    raise exception using
      errcode = '23505',
      message = 'CLASS_SCHEDULE_IMPORT_BATCH_SHA256_ALREADY_EXISTS';
  end if;

  -- Execute Dry-Run classification
  v_dry_run_result := public.dry_run_class_schedule_import(
    v_year_code,
    p_classes,
    p_schedules
  );

  v_year_id := (v_dry_run_result->'academic_year'->>'id')::uuid;

  v_class_summary := v_dry_run_result->'class_summary';
  v_c_total := (v_class_summary->>'total')::integer;
  v_c_new := (v_class_summary->>'new')::integer;
  v_c_matching := (v_class_summary->>'existing_matching')::integer;
  v_c_conflict := (v_class_summary->>'existing_conflict')::integer;
  v_c_invalid := (v_class_summary->>'invalid')::integer;

  v_schedule_summary := v_dry_run_result->'schedule_summary';
  v_s_total := (v_schedule_summary->>'total')::integer;
  v_s_new := (v_schedule_summary->>'new')::integer;
  v_s_matching := (v_schedule_summary->>'existing_matching')::integer;
  v_s_conflict := (v_schedule_summary->>'existing_conflict')::integer;
  v_s_invalid := (v_schedule_summary->>'invalid')::integer;

  -- Status check: ready_to_commit iff 0 conflicts and 0 invalids
  if v_c_conflict = 0 and v_c_invalid = 0 and v_s_conflict = 0 and v_s_invalid = 0 then
    v_batch_status := 'ready_to_commit';
  else
    v_batch_status := 'previewed';
  end if;

  -- Insert Batch
  insert into public.class_schedule_import_batches (
    source_filename,
    source_sha256,
    academic_year_code,
    academic_year_id,
    status,
    class_row_count,
    class_new_count,
    class_matching_count,
    class_conflict_count,
    class_invalid_count,
    schedule_row_count,
    schedule_new_count,
    schedule_matching_count,
    schedule_conflict_count,
    schedule_invalid_count,
    reason,
    metadata,
    created_by
  )
  values (
    v_normalized_filename,
    v_normalized_sha256,
    v_year_code,
    v_year_id,
    v_batch_status,
    v_c_total,
    v_c_new,
    v_c_matching,
    v_c_conflict,
    v_c_invalid,
    v_s_total,
    v_s_new,
    v_s_matching,
    v_s_conflict,
    v_s_invalid,
    v_normalized_reason,
    pg_catalog.jsonb_build_object(
      'source', 'excel_import',
      'created_by', v_actor_id
    ),
    v_actor_id
  )
  returning * into v_batch;

  -- Insert Class Rows
  for v_c_row in select * from pg_catalog.jsonb_array_elements(v_dry_run_result->'class_rows') loop
    insert into public.class_schedule_import_class_rows (
      batch_id,
      source_row_number,
      academic_year_code,
      class_code,
      class_name,
      grade,
      level,
      weekly_session_count,
      default_learning_mode,
      status,
      resolved_academic_year_id,
      resolved_class_id,
      classification,
      validation_code,
      validation_message
    )
    values (
      v_batch.id,
      (v_c_row->>'source_row_number')::integer,
      v_year_code,
      v_c_row->>'class_code',
      v_c_row->>'class_name',
      (v_c_row->>'grade')::integer,
      v_c_row->>'level',
      (v_c_row->>'weekly_session_count')::integer,
      v_c_row->>'default_learning_mode',
      v_c_row->>'status',
      (v_c_row->>'resolved_academic_year_id')::uuid,
      nullif(v_c_row->>'resolved_class_id', '')::uuid,
      v_c_row->>'classification',
      v_c_row->>'validation_code',
      v_c_row->>'validation_message'
    );
  end loop;

  -- Insert Schedule Rows
  for v_s_row in select * from pg_catalog.jsonb_array_elements(v_dry_run_result->'schedule_rows') loop
    insert into public.class_schedule_import_schedule_rows (
      batch_id,
      source_row_number,
      class_code,
      component_code,
      weekday,
      start_time,
      end_time,
      learning_mode,
      room_name,
      meeting_url,
      effective_from,
      effective_to,
      resolved_class_id,
      resolved_schedule_template_id,
      classification,
      validation_code,
      validation_message
    )
    values (
      v_batch.id,
      (v_s_row->>'source_row_number')::integer,
      v_s_row->>'class_code',
      v_s_row->>'component_code',
      (v_s_row->>'weekday')::integer,
      (v_s_row->>'start_time')::time,
      (v_s_row->>'end_time')::time,
      v_s_row->>'learning_mode',
      v_s_row->>'room_name',
      v_s_row->>'meeting_url',
      (v_s_row->>'effective_from')::date,
      nullif(v_s_row->>'effective_to', '')::date,
      nullif(v_s_row->>'resolved_class_id', '')::uuid,
      nullif(v_s_row->>'resolved_schedule_template_id', '')::uuid,
      v_s_row->>'classification',
      v_s_row->>'validation_code',
      v_s_row->>'validation_message'
    );
  end loop;

  -- Audit log
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
    v_actor_id,
    'imports',
    'class_schedule_import_batch_created',
    'class_schedule_import_batch',
    v_batch.id::text,
    null,
    pg_catalog.jsonb_build_object(
      'status', v_batch.status,
      'class_row_count', v_batch.class_row_count,
      'schedule_row_count', v_batch.schedule_row_count
    ),
    'Tạo batch import lớp học & lịch học cố định',
    pg_catalog.jsonb_build_object(
      'batch_id', v_batch.id,
      'source_sha256', v_normalized_sha256,
      'academic_year_code', v_year_code
    )
  );

  return v_batch;
end;
$$;


-- =========================================================
-- 9. RPC 3: COMMIT CLASS SCHEDULE IMPORT BATCH (ALL OR NOTHING)
-- =========================================================

create or replace function public.commit_class_schedule_import_batch(
  p_batch_id uuid,
  p_reason text
)
returns public.class_schedule_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_batch public.class_schedule_import_batches%rowtype;
  v_normalized_reason text;

  v_class_row public.class_schedule_import_class_rows%rowtype;
  v_schedule_row public.class_schedule_import_schedule_rows%rowtype;

  v_new_class public.classes%rowtype;
  v_new_schedule public.class_schedule_templates%rowtype;

  v_class_id_map jsonb := '{}'::jsonb;
  v_resolved_class_id uuid;

  v_year public.academic_years%rowtype;
  v_db_class public.classes%rowtype;
  v_db_schedule public.class_schedule_templates%rowtype;

begin
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('imports.classes') then
    raise exception using
      errcode = '42501',
      message = 'IMPORTS_CLASSES_PERMISSION_REQUIRED';
  end if;

  if p_batch_id is null then
    raise exception using
      errcode = '22023',
      message = 'BATCH_ID_REQUIRED';
  end if;

  v_normalized_reason := pg_catalog.btrim(p_reason);

  if v_normalized_reason is null or v_normalized_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'COMMIT_REASON_REQUIRED';
  end if;

  -- Lock batch row for update
  select b.*
  into v_batch
  from public.class_schedule_import_batches as b
  where b.id = p_batch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_SCHEDULE_IMPORT_BATCH_NOT_FOUND';
  end if;

  if v_batch.status = 'committed' then
    raise exception using
      errcode = '23514',
      message = 'BATCH_ALREADY_COMMITTED';
  end if;

  if v_batch.status <> 'ready_to_commit' then
    raise exception using
      errcode = '23514',
      message = 'BATCH_NOT_READY_TO_COMMIT_HAS_ERRORS_OR_CONFLICTS';
  end if;

  if v_batch.class_conflict_count > 0 or v_batch.class_invalid_count > 0
    or v_batch.schedule_conflict_count > 0 or v_batch.schedule_invalid_count > 0
  then
    raise exception using
      errcode = '23514',
      message = 'BATCH_HAS_UNRESOLVED_CONFLICTS_OR_INVALID_ROWS';
  end if;

  -- Revalidate target academic year
  select y.*
  into v_year
  from public.academic_years as y
  where y.code = v_batch.academic_year_code;

  if not found or v_year.status = 'archived' then
    raise exception using
      errcode = '23514',
      message = 'TARGET_ACADEMIC_YEAR_INVALID_OR_ARCHIVED';
  end if;

  -- =========================================================
  -- 1. COMMIT CLASS ROWS
  -- =========================================================
  for v_class_row in
    select r.*
    from public.class_schedule_import_class_rows as r
    where r.batch_id = p_batch_id
    order by r.source_row_number
    for update
  loop
    if v_class_row.classification = 'existing_matching' then
      -- Verify existing class still exists and matches in DB
      select c.*
      into v_db_class
      from public.classes as c
      where c.id = v_class_row.resolved_class_id;

      if not found then
        raise exception using
          errcode = '23514',
          message = 'EXISTING_CLASS_MISSING_DURING_COMMIT_REVALIDATION';
      end if;

      v_resolved_class_id := v_db_class.id;
      v_class_id_map := pg_catalog.jsonb_set(v_class_id_map, array[v_class_row.class_code], pg_catalog.to_jsonb(v_resolved_class_id::text));

      update public.class_schedule_import_class_rows
      set classification = 'committed'
      where id = v_class_row.id;

    elsif v_class_row.classification = 'new' then
      -- Re-verify that class_code has not been created by someone else in the meantime
      if exists (
        select 1
        from public.classes
        where academic_year_id = v_year.id
          and code = v_class_row.class_code
      ) then
        raise exception using
          errcode = '23505',
          message = 'CLASS_CODE_CREATED_SINCE_DRY_RUN_CONFLICT';
      end if;

      -- Insert NEW Class
      insert into public.classes (
        academic_year_id,
        code,
        name,
        grade,
        level,
        weekly_session_count,
        default_learning_mode,
        status,
        created_by
      )
      values (
        v_year.id,
        v_class_row.class_code,
        v_class_row.class_name,
        v_class_row.grade,
        v_class_row.level,
        v_class_row.weekly_session_count,
        v_class_row.default_learning_mode,
        v_class_row.status,
        v_actor_id
      )
      returning * into v_new_class;

      v_resolved_class_id := v_new_class.id;
      v_class_id_map := pg_catalog.jsonb_set(v_class_id_map, array[v_class_row.class_code], pg_catalog.to_jsonb(v_resolved_class_id::text));

      update public.class_schedule_import_class_rows
      set
        resolved_academic_year_id = v_year.id,
        resolved_class_id = v_new_class.id,
        classification = 'committed'
      where id = v_class_row.id;
    else
      raise exception using
        errcode = '23514',
        message = 'CANNOT_COMMIT_ROW_WITH_CONFLICT_OR_INVALID_STATUS';
    end if;
  end loop;


  -- =========================================================
  -- 2. COMMIT SCHEDULE ROWS
  -- =========================================================
  for v_schedule_row in
    select r.*
    from public.class_schedule_import_schedule_rows as r
    where r.batch_id = p_batch_id
    order by r.source_row_number
    for update
  loop
    -- Resolve target class_id from class map or DB
    v_resolved_class_id := nullif(v_class_id_map->>v_schedule_row.class_code, '')::uuid;

    if v_resolved_class_id is null then
      select id into v_resolved_class_id
      from public.classes
      where academic_year_id = v_year.id
        and code = v_schedule_row.class_code;
    end if;

    if v_resolved_class_id is null then
      raise exception using
        errcode = '23514',
        message = 'SCHEDULE_ROW_REFERENCED_CLASS_NOT_FOUND_ON_COMMIT';
    end if;

    if v_schedule_row.classification = 'existing_matching' then
      -- Verify existing schedule template still exists
      select st.*
      into v_db_schedule
      from public.class_schedule_templates as st
      where st.id = v_schedule_row.resolved_schedule_template_id;

      if not found or not v_db_schedule.is_active then
        raise exception using
          errcode = '23514',
          message = 'EXISTING_SCHEDULE_TEMPLATE_MISSING_DURING_COMMIT';
      end if;

      update public.class_schedule_import_schedule_rows
      set
        resolved_class_id = v_resolved_class_id,
        classification = 'committed'
      where id = v_schedule_row.id;

    elsif v_schedule_row.classification = 'new' then
      -- Check slot uniqueness in DB
      if exists (
        select 1
        from public.class_schedule_templates
        where class_id = v_resolved_class_id
          and component_code = v_schedule_row.component_code
          and weekday = v_schedule_row.weekday
          and is_active = true
      ) then
        raise exception using
          errcode = '23505',
          message = 'SCHEDULE_SLOT_CREATED_SINCE_DRY_RUN_CONFLICT';
      end if;

      -- Insert NEW active schedule template
      insert into public.class_schedule_templates (
        class_id,
        component_code,
        weekday,
        start_time,
        end_time,
        learning_mode,
        room_name,
        meeting_url,
        effective_from,
        effective_to,
        is_active,
        created_by
      )
      values (
        v_resolved_class_id,
        v_schedule_row.component_code,
        v_schedule_row.weekday,
        v_schedule_row.start_time,
        v_schedule_row.end_time,
        v_schedule_row.learning_mode,
        v_schedule_row.room_name,
        v_schedule_row.meeting_url,
        v_schedule_row.effective_from,
        v_schedule_row.effective_to,
        true,
        v_actor_id
      )
      returning * into v_new_schedule;

      update public.class_schedule_import_schedule_rows
      set
        resolved_class_id = v_resolved_class_id,
        resolved_schedule_template_id = v_new_schedule.id,
        classification = 'committed'
      where id = v_schedule_row.id;
    else
      raise exception using
        errcode = '23514',
        message = 'CANNOT_COMMIT_SCHEDULE_ROW_WITH_CONFLICT_OR_INVALID_STATUS';
    end if;
  end loop;


  -- Update batch state
  update public.class_schedule_import_batches
  set
    status = 'committed',
    committed_by = v_actor_id,
    committed_at = pg_catalog.now()
  where id = p_batch_id
  returning * into v_batch;

  -- Audit log
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
    v_actor_id,
    'imports',
    'class_schedule_import_batch_committed',
    'class_schedule_import_batch',
    p_batch_id::text,
    pg_catalog.jsonb_build_object('status', 'ready_to_commit'),
    pg_catalog.jsonb_build_object('status', 'committed'),
    v_normalized_reason,
    pg_catalog.jsonb_build_object(
      'batch_id', p_batch_id,
      'source_sha256', v_batch.source_sha256,
      'academic_year_code', v_batch.academic_year_code,
      'class_new_count', v_batch.class_new_count,
      'class_matching_count', v_batch.class_matching_count,
      'schedule_new_count', v_batch.schedule_new_count,
      'schedule_matching_count', v_batch.schedule_matching_count
    )
  );

  return v_batch;
end;
$$;

commit;
