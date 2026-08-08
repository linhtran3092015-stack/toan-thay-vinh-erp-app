-- Fix student import blank learning level normalization inconsistency.
-- Ensures blank/whitespace learning_level and registered_mode are normalized to NULL
-- identically across dry-run, commit, and helper functions.

-- 1. Helper function: create_student_with_primary_guardian
create or replace function public.create_student_with_primary_guardian(
  p_full_name text,
  p_nickname text,
  p_birth_year integer,
  p_province_city text,
  p_current_grade integer,
  p_learning_level text,
  p_registered_mode text,
  p_learning_goal text,
  p_internal_notes text,
  p_guardian_full_name text,
  p_guardian_phone text,
  p_guardian_relationship text,
  p_guardian_zalo text,
  p_guardian_email text,
  p_guardian_notes text,
  p_duplicate_override_reason text,
  p_reason text
)
returns table (
  student_id uuid,
  student_public_code text,
  guardian_id uuid,
  guardian_reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_full_name text :=
    pg_catalog.btrim(p_full_name);

  normalized_nickname text :=
    nullif(
      pg_catalog.btrim(p_nickname),
      ''
    );

  normalized_province_city text :=
    nullif(
      pg_catalog.btrim(p_province_city),
      ''
    );

  normalized_learning_level text :=
    nullif(
      pg_catalog.upper(
        pg_catalog.btrim(p_learning_level)
      ),
      ''
    );

  normalized_registered_mode text :=
    nullif(
      pg_catalog.lower(
        pg_catalog.btrim(p_registered_mode)
      ),
      ''
    );

  normalized_learning_goal text :=
    nullif(
      pg_catalog.btrim(p_learning_goal),
      ''
    );

  normalized_internal_notes text :=
    nullif(
      pg_catalog.btrim(p_internal_notes),
      ''
    );

  normalized_guardian_full_name text :=
    pg_catalog.btrim(p_guardian_full_name);

  normalized_guardian_phone text :=
    public.normalize_vietnam_phone(
      coalesce(p_guardian_phone, '')
    );

  normalized_guardian_relationship text :=
    pg_catalog.btrim(p_guardian_relationship);

  normalized_guardian_zalo text :=
    nullif(
      pg_catalog.btrim(p_guardian_zalo),
      ''
    );

  normalized_guardian_email text :=
    nullif(
      pg_catalog.lower(
        pg_catalog.btrim(p_guardian_email)
      ),
      ''
    );

  normalized_guardian_notes text :=
    nullif(
      pg_catalog.btrim(p_guardian_notes),
      ''
    );

  normalized_duplicate_reason text :=
    nullif(
      pg_catalog.btrim(
        p_duplicate_override_reason
      ),
      ''
    );

  normalized_reason text :=
    nullif(
      pg_catalog.btrim(p_reason),
      ''
    );

  audit_reason text;
  duplicate_found boolean := false;
  result_student_id uuid;
  result_public_code text;
  result_guardian_id uuid;
  reused_guardian boolean := false;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('students.create') then
    raise exception using
      errcode = '42501',
      message = 'STUDENT_CREATE_PERMISSION_DENIED';
  end if;

  if normalized_full_name is null
    or normalized_full_name = ''
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_FULL_NAME_REQUIRED';
  end if;

  if p_birth_year is null
    or p_birth_year < 1990
    or p_birth_year > 2100
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_BIRTH_YEAR_INVALID';
  end if;

  if p_current_grade is null
    or p_current_grade < 1
    or p_current_grade > 12
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_CURRENT_GRADE_INVALID';
  end if;

  if normalized_learning_level is not null
    and normalized_learning_level not in ('A', 'B', 'CLC')
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_LEARNING_LEVEL_INVALID';
  end if;

  if normalized_registered_mode is not null
    and normalized_registered_mode not in ('online', 'offline')
  then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_REGISTERED_MODE_INVALID';
  end if;

  if normalized_guardian_full_name is null
    or normalized_guardian_full_name = ''
  then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_FULL_NAME_REQUIRED';
  end if;

  if normalized_guardian_phone
    !~ '^0[0-9]{9,10}$'
  then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_PHONE_INVALID';
  end if;

  -- Check for exact duplicate student (same name, birth year, guardian phone)
  select exists (
    select 1
    from public.students as s
    join public.student_guardians as sg
      on sg.student_id = s.id
      and sg.ended_at is null
    join public.guardians as g
      on g.id = sg.guardian_id
    where public.normalize_student_name(s.full_name) =
      public.normalize_student_name(normalized_full_name)
      and s.birth_year = p_birth_year
      and g.normalized_phone = normalized_guardian_phone
  )
  into duplicate_found;

  if duplicate_found
    and normalized_duplicate_reason is null
  then
    raise exception using
      errcode = '23514',
      message =
        'STUDENT_DUPLICATE_OVERRIDE_REASON_REQUIRED';
  end if;

  audit_reason := normalized_reason;

  if duplicate_found then
    audit_reason :=
      audit_reason
      || ' | Duplicate override: '
      || normalized_duplicate_reason;
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    audit_reason,
    true
  );

  select guardian.id
  into result_guardian_id
  from public.guardians as guardian
  where guardian.normalized_phone =
    normalized_guardian_phone
  for update;

  if found then
    reused_guardian := true;
  else
    insert into public.guardians (
      full_name,
      phone,
      zalo,
      email,
      notes,
      created_by
    )
    values (
      normalized_guardian_full_name,
      normalized_guardian_phone,
      normalized_guardian_zalo,
      normalized_guardian_email,
      normalized_guardian_notes,
      actor_id
    )
    returning id
    into result_guardian_id;
  end if;

  insert into public.students (
    full_name,
    nickname,
    birth_year,
    province_city,
    current_grade,
    lifecycle_status,
    learning_level,
    registered_mode,
    official_start_date,
    learning_goal,
    internal_notes,
    created_by
  )
  values (
    normalized_full_name,
    normalized_nickname,
    p_birth_year,
    normalized_province_city,
    p_current_grade,
    'interested',
    normalized_learning_level,
    normalized_registered_mode,
    null,
    normalized_learning_goal,
    normalized_internal_notes,
    actor_id
  )
  returning
    id,
    public_code
  into
    result_student_id,
    result_public_code;

  insert into public.student_guardians (
    student_id,
    guardian_id,
    relationship,
    is_primary,
    linked_by
  )
  values (
    result_student_id,
    result_guardian_id,
    normalized_guardian_relationship,
    true,
    actor_id
  );

  return query
  select
    result_student_id,
    result_public_code,
    result_guardian_id,
    reused_guardian;
end;
$$;

-- 2. Dry-run function: validate_student_import_rows
create or replace function public.validate_student_import_rows(
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
<<student_import_validation>>
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
      row_number := source_ordinality::integer + 1;
    end if;

    -- STUDENT REQUIRED FIELDS
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

    -- STUDENT OPTIONAL FIELDS
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
          'STUDENT_LEARNING_LEVEL_INVALID',
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
          'STUDENT_REGISTERED_MODE_INVALID',
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

    -- GUARDIAN REQUIRED FIELDS
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

    -- GUARDIAN OPTIONAL FIELDS
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

    -- DUPLICATE AND GUARDIAN REUSE LOOKUP
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
          and student.birth_year =
            student_import_validation.birth_year
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

  -- DUPLICATES INSIDE THE SAME IMPORT FILE
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

-- 3. Commit function: commit_student_import_rows
create or replace function public.commit_student_import_rows(
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
      nullif(
        btrim(
          normalized_row ->> 'learning_level'
        ),
        ''
      ),
      nullif(
        btrim(
          normalized_row ->> 'registered_mode'
        ),
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
