create or replace function public.create_payroll_import_batch(
  p_dataset_type text,
  p_period_month date,
  p_file_name text,
  p_file_sha256 text,
  p_rows jsonb
)
returns public.payroll_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_dataset text := pg_catalog.lower(pg_catalog.btrim(p_dataset_type));
  normalized_sha text;
  row_payload jsonb;
  created_batch public.payroll_import_batches%rowtype;
  row_count integer;
  valid_count integer := 0;
  error_count integer := 0;
  conflict_count integer := 0;
  normalized_row jsonb;
  normalized_event_date date;
  normalized_staff_id uuid;
  normalized_grade smallint;
  normalized_amount_vnd bigint;
  normalized_quantity numeric;
  normalized_source_code text;
  normalized_work_mode text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.import') then
    raise exception using errcode = '42501', message = 'PAYROLL_IMPORT_PERMISSION_REQUIRED';
  end if;
  if normalized_dataset not in ('timekeeping', 'grading', 'renewal_orders', 'new_enrollment_orders') then
    raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_DATASET_INVALID';
  end if;
  if p_period_month is null or p_period_month <> pg_catalog.date_trunc('month', p_period_month)::date then
    raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_PERIOD_INVALID';
  end if;
  if pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_ROWS_INVALID';
  end if;
  row_count := pg_catalog.jsonb_array_length(p_rows);
  if row_count = 0 or row_count > 5000 then
    raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_ROW_COUNT_INVALID';
  end if;
  -- Deduplicate from the server-validated content instead of trusting a digest
  -- supplied by the browser.
  normalized_sha := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(normalized_dataset || '|' || p_period_month::text || '|' || p_rows::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  select
    pg_catalog.count(*) filter (where value->>'validation_status' = 'valid'),
    pg_catalog.count(*) filter (where value->>'validation_status' = 'error'),
    pg_catalog.count(*) filter (where value->>'validation_status' = 'conflict')
  into valid_count, error_count, conflict_count
  from pg_catalog.jsonb_array_elements(p_rows);

  if valid_count + error_count + conflict_count <> row_count then
    raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_ROW_STATUS_INVALID';
  end if;

  insert into public.payroll_import_batches (
    dataset_type, period_month, file_name, file_sha256, total_rows,
    valid_rows, error_rows, conflict_rows, uploaded_by
  ) values (
    normalized_dataset, p_period_month, pg_catalog.btrim(p_file_name), normalized_sha, row_count,
    valid_count, error_count, conflict_count, actor_id
  ) returning * into created_batch;

  for row_payload in select value from pg_catalog.jsonb_array_elements(p_rows)
  loop
    if row_payload->>'validation_status' in ('valid', 'conflict') then
      normalized_row := row_payload->'normalized_payload';
      if normalized_row is null or pg_catalog.jsonb_typeof(normalized_row) <> 'object' then
        raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_NORMALIZED_ROW_REQUIRED';
      end if;

      normalized_event_date := (normalized_row->>'event_date')::date;
      normalized_staff_id := nullif(normalized_row->>'staff_id', '')::uuid;
      normalized_grade := nullif(normalized_row->>'grade', '')::smallint;
      normalized_amount_vnd := nullif(normalized_row->>'amount_vnd', '')::bigint;
      normalized_quantity := nullif(normalized_row->>'quantity', '')::numeric;
      normalized_source_code := nullif(pg_catalog.btrim(normalized_row->>'source_code'), '');
      normalized_work_mode := nullif(pg_catalog.btrim(normalized_row->'metadata'->>'work_mode'), '');

      if normalized_event_date < p_period_month
        or normalized_event_date >= (p_period_month + interval '1 month')::date
      then
        raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_EVENT_OUTSIDE_PERIOD';
      end if;

      if normalized_dataset in ('timekeeping', 'grading', 'new_enrollment_orders')
        and (normalized_staff_id is null or not exists (
          select 1 from public.profiles where id = normalized_staff_id
        ))
      then
        raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_STAFF_INVALID';
      end if;

      if normalized_dataset = 'timekeeping'
        and (normalized_quantity is null or normalized_quantity <= 0
          or normalized_work_mode not in ('offline', 'online'))
      then
        raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_TIMEKEEPING_INVALID';
      elsif normalized_dataset = 'grading'
        and (normalized_quantity is null or normalized_quantity <= 0)
      then
        raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_GRADING_INVALID';
      elsif normalized_dataset in ('renewal_orders', 'new_enrollment_orders')
        and (normalized_grade is null or normalized_grade not between 2 and 12
          or normalized_amount_vnd is null or normalized_amount_vnd < 0)
      then
        raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_ORDER_INVALID';
      end if;

      if normalized_dataset = 'new_enrollment_orders'
        and (normalized_source_code is null or not exists (
          select 1
          from public.payroll_policy_versions as policy
          where policy.policy_code in ('operations_new_enrollment', 'admissions_new_enrollment')
            and policy.effective_from <= normalized_event_date
            and policy.parameters->'fixed_by_source' ? normalized_source_code
        ))
      then
        raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_SOURCE_CODE_INVALID';
      end if;
    end if;

    insert into public.payroll_import_rows (
      batch_id, row_number, source_key, raw_payload, normalized_payload,
      validation_status, validation_errors, conflict_payload
    ) values (
      created_batch.id,
      (row_payload->>'row_number')::integer,
      pg_catalog.btrim(row_payload->>'source_key'),
      row_payload->'raw_payload',
      row_payload->'normalized_payload',
      row_payload->>'validation_status',
      coalesce(row_payload->'validation_errors', '[]'::jsonb),
      row_payload->'conflict_payload'
    );
  end loop;

  return created_batch;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PAYROLL_IMPORT_FILE_OR_SOURCE_DUPLICATE';
  when check_violation or invalid_text_representation then
    raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_PAYLOAD_INVALID';
end;
$$;
