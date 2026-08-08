begin;

-- =========================================================
-- TASK 6A-5R1
-- Fix PostgreSQL pg_catalog.coalesce error in dry_run_class_schedule_import
--
-- Replaces invalid pg_catalog.coalesce(...) syntax with standard coalesce(...)
-- Preserves all SECURITY DEFINER, search_path, permission guards and logic.
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
    v_c_row_num := coalesce((v_class_item->>'source_row_number')::integer, v_c_total + 1);

    v_class_code := pg_catalog.upper(pg_catalog.btrim(v_class_item->>'class_code'));
    v_class_name := pg_catalog.btrim(v_class_item->>'class_name');
    v_grade := (v_class_item->>'grade')::integer;
    v_level := pg_catalog.upper(pg_catalog.btrim(v_class_item->>'level'));
    v_weekly_sessions := coalesce((v_class_item->>'weekly_sessions')::integer, (v_class_item->>'weekly_session_count')::integer, 2);
    v_mode := pg_catalog.lower(pg_catalog.btrim(coalesce(v_class_item->>'default_learning_mode', v_class_item->>'learning_mode', 'hybrid')));
    v_status := pg_catalog.lower(pg_catalog.btrim(coalesce(v_class_item->>'status', 'active')));

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
    v_s_row_num := coalesce((v_schedule_item->>'source_row_number')::integer, v_s_total + 1);

    v_s_class_code := pg_catalog.upper(pg_catalog.btrim(v_schedule_item->>'class_code'));
    v_component_code := pg_catalog.upper(pg_catalog.btrim(v_schedule_item->>'component_code'));
    v_weekday := (v_schedule_item->>'weekday')::integer;
    v_start_time := (v_schedule_item->>'start_time')::time;
    v_end_time := (v_schedule_item->>'end_time')::time;
    v_s_mode := pg_catalog.lower(pg_catalog.btrim(coalesce(v_schedule_item->>'learning_mode', 'hybrid')));
    v_room := nullif(pg_catalog.btrim(coalesce(v_schedule_item->>'room_name', v_schedule_item->>'room')), '');
    v_meeting := nullif(pg_catalog.btrim(v_schedule_item->>'meeting_url'), '');
    v_effective_from := (v_schedule_item->>'effective_from')::date;
    v_effective_to := nullif(v_schedule_item->>'effective_to', '')::date;

    v_s_classification := null;
    v_s_code := null;
    v_s_message := null;
    v_db_schedule := null;
    v_db_class := null;

    v_s_slot_key := v_s_class_code || ':' || v_component_code || ':' || coalesce(v_weekday::text, '');

    -- Track schedule counts per class code
    if v_s_class_code is not null and v_s_class_code <> '' then
      v_import_class_schedule_counts := pg_catalog.jsonb_set(
        v_import_class_schedule_counts,
        array[v_s_class_code],
        pg_catalog.to_jsonb(coalesce((v_import_class_schedule_counts->>v_s_class_code)::integer, 0) + 1)
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

commit;
