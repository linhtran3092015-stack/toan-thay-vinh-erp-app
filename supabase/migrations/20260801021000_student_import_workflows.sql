begin;

-- =========================================================
-- TASK 9F — STUDENT IMPORT V1
-- =========================================================
--
-- Scope:
--   * one row creates one student and one primary guardian link;
--   * existing guardians may be reused by normalized phone;
--   * dry-run never writes data;
--   * commit is all-or-nothing;
--   * exact student duplicates are blocked;
--   * duplicate rows inside the same file are blocked;
--   * one source SHA-256 may be committed only once;
--   * no enrollment, CRM, finance or official-status workflow.
--
-- The application parses the XLSX file. The database receives only
-- normalized JSON input and never stores the original workbook.

-- =========================================================
-- IMPORT BATCH LEDGER
-- =========================================================

create table public.student_import_batches (
  id uuid primary key default gen_random_uuid(),

  source_filename text not null,
  source_sha256 text not null,

  row_count integer not null,
  student_count integer not null,
  guardian_created_count integer not null,
  guardian_reused_count integer not null,

  committed_by uuid not null
    references public.profiles (id)
    on delete restrict,

  committed_at timestamp with time zone not null
    default now(),

  reason text not null,

  metadata jsonb not null
    default '{}'::jsonb,

  constraint student_import_batches_source_filename_check
    check (
      source_filename = btrim(source_filename)
      and source_filename <> ''
      and char_length(source_filename) <= 255
      and lower(source_filename) ~ '\.xlsx$'
    ),

  constraint student_import_batches_source_sha256_check
    check (
      source_sha256 = lower(source_sha256)
      and source_sha256 ~ '^[0-9a-f]{64}$'
    ),

  constraint student_import_batches_row_count_check
    check (
      row_count between 1 and 500
    ),

  constraint student_import_batches_student_count_check
    check (
      student_count = row_count
    ),

  constraint student_import_batches_guardian_counts_check
    check (
      guardian_created_count >= 0
      and guardian_reused_count >= 0
      and guardian_created_count
        + guardian_reused_count
        = student_count
    ),

  constraint student_import_batches_reason_check
    check (
      reason = btrim(reason)
      and reason <> ''
      and char_length(reason) <= 2000
    ),

  constraint student_import_batches_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
    )
);

create unique index student_import_batches_source_sha256_uidx
on public.student_import_batches (source_sha256);

create index student_import_batches_committed_at_idx
on public.student_import_batches (
  committed_at desc,
  id desc
);

create index student_import_batches_committed_by_idx
on public.student_import_batches (
  committed_by,
  committed_at desc
);

comment on table public.student_import_batches is
  'Append-only ledger of successfully committed student imports.';

comment on column public.student_import_batches.source_sha256 is
  'Lowercase SHA-256 of the original XLSX file; used as idempotency key.';

comment on column public.student_import_batches.metadata is
  'Batch-level technical metadata only; must not contain complete imported rows.';

-- =========================================================
-- APPEND-ONLY PROTECTION
-- =========================================================

create function public.prevent_student_import_batch_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    using
      errcode = '42501',
      message = 'STUDENT_IMPORT_BATCH_IS_APPEND_ONLY';
end;
$$;

revoke all
on function public.prevent_student_import_batch_mutation()
from public, anon, authenticated;

create trigger student_import_batches_prevent_mutation
before update or delete
on public.student_import_batches
for each row
execute function public.prevent_student_import_batch_mutation();

-- =========================================================
-- RLS AND DIRECT TABLE PRIVILEGES
-- =========================================================

alter table public.student_import_batches
enable row level security;

revoke all
on table public.student_import_batches
from public, anon, authenticated;

grant select
on table public.student_import_batches
to authenticated;

create policy student_import_batches_select_authorized
on public.student_import_batches
for select
to authenticated
using (
  public.has_permission('imports.students')
);

-- =========================================================
-- DRY-RUN VALIDATION
-- =========================================================

create function public.validate_student_import_rows(
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();

  source_row jsonb;
  source_ordinality bigint;

  working_rows jsonb := '[]'::jsonb;
  final_rows jsonb := '[]'::jsonb;

  errors jsonb;
  warnings jsonb;
  normalized_data jsonb;

  row_number integer;
  row_number_text text;

  student_full_name text;
  normalized_student_name text;
  nickname text;
  birth_year integer;
  birth_year_text text;
  province_city text;
  current_grade integer;
  current_grade_text text;
  learning_level text;
  registered_mode text;
  learning_goal text;
  internal_notes text;

  guardian_full_name text;
  guardian_phone text;
  normalized_guardian_phone text;
  guardian_relationship text;
  guardian_zalo text;
  guardian_email text;
  guardian_notes text;

  existing_guardian_id uuid;
  exact_student_duplicate boolean;

  duplicate_key text;
  status_value text;

  total_count integer;
  valid_count integer;
  warning_count integer;
  invalid_count integer;
begin
  if actor_user_id is null then
    raise exception
      using
        errcode = '28000',
        message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('imports.students') then
    raise exception
      using
        errcode = '42501',
        message = 'IMPORTS_STUDENTS_PERMISSION_REQUIRED';
  end if;

  if p_rows is null
    or jsonb_typeof(p_rows) <> 'array'
  then
    raise exception
      using
        errcode = '22023',
        message = 'STUDENT_IMPORT_ROWS_MUST_BE_ARRAY';
  end if;

  total_count := jsonb_array_length(p_rows);

  if total_count < 1 then
    raise exception
      using
        errcode = '22023',
        message = 'STUDENT_IMPORT_ROWS_REQUIRED';
  end if;

  if total_count > 500 then
    raise exception
      using
        errcode = '22023',
        message = 'STUDENT_IMPORT_MAXIMUM_500_ROWS';
  end if;

  for source_row, source_ordinality in
    select
      row_value,
      row_ordinality
    from jsonb_array_elements(p_rows)
      with ordinality
      as input_row (
        row_value,
        row_ordinality
      )
  loop
    errors := '[]'::jsonb;
    warnings := '[]'::jsonb;

    existing_guardian_id := null;
    exact_student_duplicate := false;
    duplicate_key := null;

    if jsonb_typeof(source_row) <> 'object' then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'ROW_MUST_BE_OBJECT',
          'field',
          null,
          'message',
          'Dòng dữ liệu phải là một object.'
        )
      );

      source_row := '{}'::jsonb;
    end if;

    row_number_text :=
      nullif(
        btrim(source_row ->> 'row_number'),
        ''
      );

    if row_number_text is not null
      and char_length(row_number_text) <= 9
      and row_number_text ~ '^[1-9][0-9]*$'
    then
      row_number := row_number_text::integer;
    else
      -- Ordinality 1 is normally spreadsheet row 2
      -- because row 1 contains headers.
      row_number := source_ordinality::integer + 1;
    end if;

    -- -----------------------------------------------------
    -- STUDENT REQUIRED FIELDS
    -- -----------------------------------------------------

    student_full_name :=
      nullif(
        btrim(source_row ->> 'student_full_name'),
        ''
      );

    if student_full_name is null then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'STUDENT_FULL_NAME_REQUIRED',
          'field',
          'student_full_name',
          'message',
          'Họ tên học viên là bắt buộc.'
        )
      );
    elsif char_length(student_full_name) > 200 then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'STUDENT_FULL_NAME_TOO_LONG',
          'field',
          'student_full_name',
          'message',
          'Họ tên học viên không được vượt quá 200 ký tự.'
        )
      );
    end if;

    birth_year := null;
    birth_year_text :=
      nullif(
        btrim(source_row ->> 'birth_year'),
        ''
      );

    if birth_year_text is null then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'BIRTH_YEAR_REQUIRED',
          'field',
          'birth_year',
          'message',
          'Năm sinh là bắt buộc.'
        )
      );
    elsif birth_year_text !~ '^[0-9]{4}$' then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'BIRTH_YEAR_INVALID',
          'field',
          'birth_year',
          'message',
          'Năm sinh phải gồm 4 chữ số.'
        )
      );
    else
      birth_year := birth_year_text::integer;

      if birth_year < 1990
        or birth_year > 2100
      then
        errors := errors || jsonb_build_array(
          jsonb_build_object(
            'code',
            'BIRTH_YEAR_OUT_OF_RANGE',
            'field',
            'birth_year',
            'message',
            'Năm sinh phải nằm trong khoảng 1990–2100.'
          )
        );
      end if;
    end if;

    current_grade := null;
    current_grade_text :=
      nullif(
        btrim(source_row ->> 'current_grade'),
        ''
      );

    if current_grade_text is null then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'CURRENT_GRADE_REQUIRED',
          'field',
          'current_grade',
          'message',
          'Khối hiện tại là bắt buộc.'
        )
      );
    elsif current_grade_text !~ '^[0-9]{1,2}$' then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'CURRENT_GRADE_INVALID',
          'field',
          'current_grade',
          'message',
          'Khối hiện tại phải là số từ 1 đến 12.'
        )
      );
    else
      current_grade := current_grade_text::integer;

      if current_grade < 1
        or current_grade > 12
      then
        errors := errors || jsonb_build_array(
          jsonb_build_object(
            'code',
            'CURRENT_GRADE_OUT_OF_RANGE',
            'field',
            'current_grade',
            'message',
            'Khối hiện tại phải nằm trong khoảng 1–12.'
          )
        );
      end if;
    end if;

    -- -----------------------------------------------------
    -- STUDENT OPTIONAL FIELDS
    -- -----------------------------------------------------

    nickname :=
      nullif(
        btrim(source_row ->> 'nickname'),
        ''
      );

    province_city :=
      nullif(
        btrim(source_row ->> 'province_city'),
        ''
      );

    learning_level :=
      nullif(
        upper(
          btrim(source_row ->> 'learning_level')
        ),
        ''
      );

    registered_mode :=
      nullif(
        lower(
          btrim(source_row ->> 'registered_mode')
        ),
        ''
      );

    learning_goal :=
      nullif(
        btrim(source_row ->> 'learning_goal'),
        ''
      );

    internal_notes :=
      nullif(
        btrim(source_row ->> 'internal_notes'),
        ''
      );

    if nickname is not null
      and char_length(nickname) > 200
    then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'NICKNAME_TOO_LONG',
          'field',
          'nickname',
          'message',
          'Tên thường gọi không được vượt quá 200 ký tự.'
        )
      );
    end if;

    if province_city is not null
      and char_length(province_city) > 200
    then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'PROVINCE_CITY_TOO_LONG',
          'field',
          'province_city',
          'message',
          'Tỉnh, thành phố không được vượt quá 200 ký tự.'
        )
      );
    end if;

    if learning_level is not null
      and learning_level not in (
        'A',
        'B',
        'CLC'
      )
    then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'LEARNING_LEVEL_INVALID',
          'field',
          'learning_level',
          'message',
          'Trình độ chỉ nhận A, B hoặc CLC.'
        )
      );
    end if;

    if registered_mode is not null
      and registered_mode not in (
        'online',
        'offline'
      )
    then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'REGISTERED_MODE_INVALID',
          'field',
          'registered_mode',
          'message',
          'Hình thức học chỉ nhận online hoặc offline.'
        )
      );
    end if;

    if learning_goal is not null
      and char_length(learning_goal) > 5000
    then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'LEARNING_GOAL_TOO_LONG',
          'field',
          'learning_goal',
          'message',
          'Mục tiêu học tập không được vượt quá 5.000 ký tự.'
        )
      );
    end if;

    if internal_notes is not null
      and char_length(internal_notes) > 5000
    then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'INTERNAL_NOTES_TOO_LONG',
          'field',
          'internal_notes',
          'message',
          'Ghi chú nội bộ không được vượt quá 5.000 ký tự.'
        )
      );
    end if;

    -- -----------------------------------------------------
    -- GUARDIAN REQUIRED FIELDS
    -- -----------------------------------------------------

    guardian_full_name :=
      nullif(
        btrim(source_row ->> 'guardian_full_name'),
        ''
      );

    guardian_phone :=
      nullif(
        btrim(source_row ->> 'guardian_phone'),
        ''
      );

    guardian_relationship :=
      nullif(
        btrim(source_row ->> 'guardian_relationship'),
        ''
      );

    if guardian_full_name is null then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'GUARDIAN_FULL_NAME_REQUIRED',
          'field',
          'guardian_full_name',
          'message',
          'Họ tên phụ huynh là bắt buộc.'
        )
      );
    elsif char_length(guardian_full_name) > 200 then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'GUARDIAN_FULL_NAME_TOO_LONG',
          'field',
          'guardian_full_name',
          'message',
          'Họ tên phụ huynh không được vượt quá 200 ký tự.'
        )
      );
    end if;

    if guardian_phone is null then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'GUARDIAN_PHONE_REQUIRED',
          'field',
          'guardian_phone',
          'message',
          'Số điện thoại phụ huynh là bắt buộc.'
        )
      );

      normalized_guardian_phone := null;
    else
      begin
        normalized_guardian_phone :=
          public.normalize_vietnam_phone(
            guardian_phone
          );
      exception
        when others then
          normalized_guardian_phone := null;
      end;

      if normalized_guardian_phone is null
        or normalized_guardian_phone
          !~ '^0[0-9]{9,10}$'
      then
        errors := errors || jsonb_build_array(
          jsonb_build_object(
            'code',
            'GUARDIAN_PHONE_INVALID',
            'field',
            'guardian_phone',
            'message',
            'Số điện thoại phụ huynh không hợp lệ.'
          )
        );
      end if;
    end if;

    if guardian_relationship is null then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'GUARDIAN_RELATIONSHIP_REQUIRED',
          'field',
          'guardian_relationship',
          'message',
          'Quan hệ với học viên là bắt buộc.'
        )
      );
    elsif char_length(guardian_relationship) > 100 then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'GUARDIAN_RELATIONSHIP_TOO_LONG',
          'field',
          'guardian_relationship',
          'message',
          'Quan hệ với học viên không được vượt quá 100 ký tự.'
        )
      );
    end if;

    -- -----------------------------------------------------
    -- GUARDIAN OPTIONAL FIELDS
    -- -----------------------------------------------------

    guardian_zalo :=
      nullif(
        btrim(source_row ->> 'guardian_zalo'),
        ''
      );

    guardian_email :=
      nullif(
        lower(
          btrim(source_row ->> 'guardian_email')
        ),
        ''
      );

    guardian_notes :=
      nullif(
        btrim(source_row ->> 'guardian_notes'),
        ''
      );

    if guardian_zalo is not null
      and char_length(guardian_zalo) > 200
    then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'GUARDIAN_ZALO_TOO_LONG',
          'field',
          'guardian_zalo',
          'message',
          'Thông tin Zalo không được vượt quá 200 ký tự.'
        )
      );
    end if;

    if guardian_email is not null then
      if char_length(guardian_email) > 320
        or guardian_email
          !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      then
        errors := errors || jsonb_build_array(
          jsonb_build_object(
            'code',
            'GUARDIAN_EMAIL_INVALID',
            'field',
            'guardian_email',
            'message',
            'Email phụ huynh không hợp lệ.'
          )
        );
      end if;
    end if;

    if guardian_notes is not null
      and char_length(guardian_notes) > 5000
    then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'GUARDIAN_NOTES_TOO_LONG',
          'field',
          'guardian_notes',
          'message',
          'Ghi chú phụ huynh không được vượt quá 5.000 ký tự.'
        )
      );
    end if;

    -- -----------------------------------------------------
    -- DUPLICATE AND GUARDIAN REUSE LOOKUP
    -- -----------------------------------------------------

    if student_full_name is not null then
      begin
        normalized_student_name :=
          public.normalize_student_name(
            student_full_name
          );
      exception
        when others then
          normalized_student_name := null;
      end;
    else
      normalized_student_name := null;
    end if;

    if normalized_guardian_phone is not null then
      select guardian.id
      into existing_guardian_id
      from public.guardians as guardian
      where guardian.normalized_phone =
        normalized_guardian_phone
      order by
        guardian.created_at,
        guardian.id
      limit 1;

      if existing_guardian_id is not null then
        warnings := warnings || jsonb_build_array(
          jsonb_build_object(
            'code',
            'GUARDIAN_WILL_BE_REUSED',
            'field',
            'guardian_phone',
            'message',
            'Phụ huynh đã tồn tại và sẽ được dùng lại.'
          )
        );
      end if;
    end if;

    if normalized_student_name is not null
      and birth_year is not null
      and normalized_guardian_phone is not null
    then
      select exists (
        select 1
        from public.students as student
        join public.student_guardians as guardian_link
          on guardian_link.student_id = student.id
          and guardian_link.ended_at is null
        join public.guardians as guardian
          on guardian.id = guardian_link.guardian_id
        where public.normalize_student_name(
            student.full_name
          ) = normalized_student_name
          and student.birth_year = birth_year
          and guardian.normalized_phone =
            normalized_guardian_phone
      )
      into exact_student_duplicate;

      duplicate_key :=
        normalized_student_name
        || '|'
        || birth_year::text
        || '|'
        || normalized_guardian_phone;
    end if;

    if exact_student_duplicate then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'code',
          'EXACT_STUDENT_DUPLICATE',
          'field',
          null,
          'message',
          'Học viên đã tồn tại với cùng họ tên, năm sinh và số điện thoại phụ huynh.'
        )
      );
    end if;

    normalized_data := jsonb_build_object(
      'student_full_name',
      student_full_name,
      'nickname',
      nickname,
      'birth_year',
      birth_year,
      'province_city',
      province_city,
      'current_grade',
      current_grade,
      'learning_level',
      learning_level,
      'registered_mode',
      registered_mode,
      'learning_goal',
      learning_goal,
      'internal_notes',
      internal_notes,

      'guardian_full_name',
      guardian_full_name,
      'guardian_phone',
      normalized_guardian_phone,
      'guardian_relationship',
      guardian_relationship,
      'guardian_zalo',
      guardian_zalo,
      'guardian_email',
      guardian_email,
      'guardian_notes',
      guardian_notes
    );

    status_value :=
      case
        when jsonb_array_length(errors) > 0
          then 'invalid'
        when jsonb_array_length(warnings) > 0
          then 'warning'
        else 'valid'
      end;

    working_rows := working_rows || jsonb_build_array(
      jsonb_build_object(
        'row_number',
        row_number,
        'status',
        status_value,
        'normalized_data',
        normalized_data,
        'errors',
        errors,
        'warnings',
        warnings,
        'guardian_reused',
        existing_guardian_id is not null,
        'existing_guardian_id',
        existing_guardian_id,
        'exact_student_duplicate',
        exact_student_duplicate,
        'duplicate_key',
        duplicate_key
      )
    );
  end loop;

  -- -------------------------------------------------------
  -- DUPLICATES INSIDE THE SAME IMPORT FILE
  -- -------------------------------------------------------

  with expanded as (
    select
      row_item,
      row_ordinality,
      nullif(
        row_item ->> 'duplicate_key',
        ''
      ) as duplicate_key
    from jsonb_array_elements(working_rows)
      with ordinality
      as import_row (
        row_item,
        row_ordinality
      )
  ),
  duplicate_keys as (
    select expanded.duplicate_key
    from expanded
    where expanded.duplicate_key is not null
    group by expanded.duplicate_key
    having count(*) > 1
  ),
  rendered as (
    select
      expanded.row_ordinality,
      case
        when duplicate_keys.duplicate_key is not null
        then
          (
            expanded.row_item
            - 'duplicate_key'
          )
          || jsonb_build_object(
            'status',
            'invalid',
            'errors',
            coalesce(
              expanded.row_item -> 'errors',
              '[]'::jsonb
            )
            || jsonb_build_array(
              jsonb_build_object(
                'code',
                'DUPLICATE_ROW_IN_IMPORT_FILE',
                'field',
                null,
                'message',
                'File có nhiều dòng trùng họ tên học viên, năm sinh và số điện thoại phụ huynh.'
              )
            )
          )
        else
          expanded.row_item
          - 'duplicate_key'
      end as rendered_row
    from expanded
    left join duplicate_keys
      on duplicate_keys.duplicate_key =
        expanded.duplicate_key
  )
  select coalesce(
    jsonb_agg(
      rendered.rendered_row
      order by rendered.row_ordinality
    ),
    '[]'::jsonb
  )
  into final_rows
  from rendered;

  select
    count(*) filter (
      where row_item ->> 'status' = 'valid'
    ),
    count(*) filter (
      where row_item ->> 'status' = 'warning'
    ),
    count(*) filter (
      where row_item ->> 'status' = 'invalid'
    )
  into
    valid_count,
    warning_count,
    invalid_count
  from jsonb_array_elements(final_rows)
    as final_row (row_item);

  return jsonb_build_object(
    'row_count',
    total_count,
    'valid_count',
    valid_count,
    'warning_count',
    warning_count,
    'invalid_count',
    invalid_count,
    'rows',
    final_rows
  );
end;
$$;

revoke all
on function public.validate_student_import_rows(jsonb)
from public, anon, authenticated;

grant execute
on function public.validate_student_import_rows(jsonb)
to authenticated;

comment on function public.validate_student_import_rows(jsonb) is
  'Dry-run validation for student import v1. This function never writes data.';

-- =========================================================
-- ALL-OR-NOTHING COMMIT
-- =========================================================

create function public.commit_student_import_rows(
  p_source_filename text,
  p_source_sha256 text,
  p_rows jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();

  normalized_filename text :=
    nullif(
      btrim(p_source_filename),
      ''
    );

  normalized_sha256 text :=
    lower(
      nullif(
        btrim(p_source_sha256),
        ''
      )
    );

  normalized_reason text :=
    nullif(
      btrim(p_reason),
      ''
    );

  validation_result jsonb;
  validation_rows jsonb;

  validated_row jsonb;
  normalized_row jsonb;

  created_record record;

  created_students jsonb := '[]'::jsonb;

  batch_id uuid;
  batch_committed_at timestamp with time zone;

  total_count integer;
  guardian_created_count integer := 0;
  guardian_reused_count integer := 0;

  row_reason text;
begin
  if actor_user_id is null then
    raise exception
      using
        errcode = '28000',
        message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('imports.students') then
    raise exception
      using
        errcode = '42501',
        message = 'IMPORTS_STUDENTS_PERMISSION_REQUIRED';
  end if;

  if not public.has_permission('students.create') then
    raise exception
      using
        errcode = '42501',
        message = 'STUDENTS_CREATE_PERMISSION_REQUIRED';
  end if;

  if normalized_filename is null
    or char_length(normalized_filename) > 255
    or lower(normalized_filename) !~ '\.xlsx$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'STUDENT_IMPORT_SOURCE_FILENAME_INVALID';
  end if;

  if normalized_sha256 is null
    or normalized_sha256 !~ '^[0-9a-f]{64}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'STUDENT_IMPORT_SOURCE_SHA256_INVALID';
  end if;

  if normalized_reason is null
    or char_length(normalized_reason) > 1500
  then
    raise exception
      using
        errcode = '22023',
        message = 'STUDENT_IMPORT_REASON_INVALID';
  end if;

  if exists (
    select 1
    from public.student_import_batches as import_batch
    where import_batch.source_sha256 =
      normalized_sha256
  ) then
    raise exception
      using
        errcode = '23505',
        message = 'STUDENT_IMPORT_FILE_ALREADY_COMMITTED';
  end if;

  -- Validate again inside the commit transaction.
  -- Client-provided dry-run results are never trusted.
  validation_result :=
    public.validate_student_import_rows(
      p_rows
    );

  total_count :=
    (validation_result ->> 'row_count')::integer;

  if (
    validation_result ->> 'invalid_count'
  )::integer > 0 then
    raise exception
      using
        errcode = '22023',
        message = 'STUDENT_IMPORT_VALIDATION_FAILED',
        detail =
          'invalid_count='
          || (
            validation_result
            ->> 'invalid_count'
          );
  end if;

  validation_rows :=
    validation_result -> 'rows';

  for validated_row in
    select row_item
    from jsonb_array_elements(validation_rows)
      as import_row (row_item)
    order by (
      row_item ->> 'row_number'
    )::integer
  loop
    normalized_row :=
      validated_row -> 'normalized_data';

    row_reason :=
      format(
        'Import học viên từ %s, dòng %s. %s',
        normalized_filename,
        validated_row ->> 'row_number',
        normalized_reason
      );

    select *
    into strict created_record
    from public.create_student_with_primary_guardian(
      normalized_row ->> 'student_full_name',
      coalesce(
        normalized_row ->> 'nickname',
        ''
      ),
      (
        normalized_row ->> 'birth_year'
      )::integer,
      coalesce(
        normalized_row ->> 'province_city',
        ''
      ),
      (
        normalized_row ->> 'current_grade'
      )::integer,
      coalesce(
        normalized_row ->> 'learning_level',
        ''
      ),
      coalesce(
        normalized_row ->> 'registered_mode',
        ''
      ),
      coalesce(
        normalized_row ->> 'learning_goal',
        ''
      ),
      coalesce(
        normalized_row ->> 'internal_notes',
        ''
      ),
      normalized_row ->> 'guardian_full_name',
      normalized_row ->> 'guardian_phone',
      normalized_row ->> 'guardian_relationship',
      coalesce(
        normalized_row ->> 'guardian_zalo',
        ''
      ),
      coalesce(
        normalized_row ->> 'guardian_email',
        ''
      ),
      coalesce(
        normalized_row ->> 'guardian_notes',
        ''
      ),
      '',
      row_reason
    );

    if created_record.guardian_reused then
      guardian_reused_count :=
        guardian_reused_count + 1;
    else
      guardian_created_count :=
        guardian_created_count + 1;
    end if;

    created_students :=
      created_students
      || jsonb_build_array(
        jsonb_build_object(
          'row_number',
          (
            validated_row
            ->> 'row_number'
          )::integer,
          'student_id',
          created_record.student_id,
          'student_public_code',
          created_record.student_public_code,
          'guardian_id',
          created_record.guardian_id,
          'guardian_reused',
          created_record.guardian_reused
        )
      );
  end loop;

  insert into public.student_import_batches (
    source_filename,
    source_sha256,
    row_count,
    student_count,
    guardian_created_count,
    guardian_reused_count,
    committed_by,
    reason,
    metadata
  )
  values (
    normalized_filename,
    normalized_sha256,
    total_count,
    total_count,
    guardian_created_count,
    guardian_reused_count,
    actor_user_id,
    normalized_reason,
    jsonb_build_object(
      'import_version',
      1,
      'source_format',
      'xlsx',
      'all_or_nothing',
      true
    )
  )
  returning
    id,
    committed_at
  into
    batch_id,
    batch_committed_at;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    new_data,
    reason,
    metadata
  )
  values (
    actor_user_id,
    'imports',
    'student_import_committed',
    'student_import_batch',
    batch_id::text,
    jsonb_build_object(
      'source_filename',
      normalized_filename,
      'source_sha256',
      normalized_sha256,
      'row_count',
      total_count,
      'student_count',
      total_count,
      'guardian_created_count',
      guardian_created_count,
      'guardian_reused_count',
      guardian_reused_count,
      'committed_at',
      batch_committed_at
    ),
    normalized_reason,
    jsonb_build_object(
      'import_version',
      1,
      'source_format',
      'xlsx',
      'all_or_nothing',
      true
    )
  );

  return jsonb_build_object(
    'batch_id',
    batch_id,
    'source_filename',
    normalized_filename,
    'source_sha256',
    normalized_sha256,
    'row_count',
    total_count,
    'student_count',
    total_count,
    'guardian_created_count',
    guardian_created_count,
    'guardian_reused_count',
    guardian_reused_count,
    'committed_by',
    actor_user_id,
    'committed_at',
    batch_committed_at,
    'students',
    created_students
  );
end;
$$;

revoke all
on function public.commit_student_import_rows(
  text,
  text,
  jsonb,
  text
)
from public, anon, authenticated;

grant execute
on function public.commit_student_import_rows(
  text,
  text,
  jsonb,
  text
)
to authenticated;

comment on function public.commit_student_import_rows(
  text,
  text,
  jsonb,
  text
) is
  'All-or-nothing student import v1. Revalidates rows and records one append-only batch.';

commit;
