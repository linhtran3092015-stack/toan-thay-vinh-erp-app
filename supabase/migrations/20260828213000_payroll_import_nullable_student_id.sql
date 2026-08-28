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
  normalized_student_id uuid;
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
      normalized_staff_id := nullif(pg_catalog.btrim(normalized_row->>'staff_id'), '')::uuid;
      normalized_student_id := nullif(pg_catalog.btrim(normalized_row->>'student_id'), '')::uuid;
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

      if normalized_student_id is not null and not exists (
        select 1 from public.students where id = normalized_student_id
      ) then
        raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_STUDENT_INVALID';
      end if;

      normalized_row := pg_catalog.jsonb_set(
        normalized_row,
        '{student_id}',
        coalesce(pg_catalog.to_jsonb(normalized_student_id), 'null'::jsonb),
        true
      );
      row_payload := pg_catalog.jsonb_set(
        row_payload,
        '{normalized_payload}',
        normalized_row,
        false
      );

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
create or replace function public.decide_payroll_import_batch(
  p_batch_id uuid,
  p_decision text,
  p_review_note text
)
returns public.payroll_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(p_decision));
  target_batch public.payroll_import_batches%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.import') then
    raise exception using errcode = '42501', message = 'PAYROLL_IMPORT_PERMISSION_REQUIRED';
  end if;
  if normalized_decision not in ('approved', 'rejected') or nullif(pg_catalog.btrim(p_review_note), '') is null then
    raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_DECISION_INVALID';
  end if;

  select * into target_batch from public.payroll_import_batches
  where id = p_batch_id and status = 'pending_review'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_IMPORT_BATCH_NOT_PENDING';
  end if;
  if target_batch.uploaded_by = actor_id then
    raise exception using errcode = '42501', message = 'PAYROLL_IMPORT_SELF_APPROVAL_FORBIDDEN';
  end if;
  if normalized_decision = 'approved' and (
    target_batch.error_rows > 0
    or exists (
      select 1 from public.payroll_import_rows
      where batch_id = target_batch.id and validation_status = 'conflict' and resolution is null
    )
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_IMPORT_UNRESOLVED_ROWS';
  end if;

  update public.payroll_import_batches
  set status = normalized_decision,
      reviewed_by = actor_id,
      reviewed_at = pg_catalog.now(),
      review_note = pg_catalog.btrim(p_review_note)
  where id = target_batch.id
  returning * into target_batch;

  if normalized_decision = 'approved' then
    insert into public.payroll_source_facts (
      fact_type, source_key, source_origin, event_date, staff_id, student_id,
      grade, amount_vnd, quantity, source_code, metadata,
      import_batch_id, import_row_id, approved_by, approved_at
    )
    select
      case target_batch.dataset_type
        when 'timekeeping' then 'timekeeping'
        when 'grading' then 'grading'
        when 'renewal_orders' then 'renewal_order'
        when 'new_enrollment_orders' then 'new_enrollment_order'
      end,
      import_row.source_key,
      'excel',
      (import_row.normalized_payload->>'event_date')::date,
      case
        when target_batch.dataset_type = 'renewal_orders' then grade_assignment.staff_id
        else nullif(pg_catalog.btrim(import_row.normalized_payload->>'staff_id'), '')::uuid
      end,
      nullif(pg_catalog.btrim(import_row.normalized_payload->>'student_id'), '')::uuid,
      nullif(import_row.normalized_payload->>'grade', '')::smallint,
      nullif(import_row.normalized_payload->>'amount_vnd', '')::bigint,
      nullif(import_row.normalized_payload->>'quantity', '')::numeric,
      nullif(pg_catalog.btrim(import_row.normalized_payload->>'source_code'), ''),
      coalesce(import_row.normalized_payload->'metadata', '{}'::jsonb),
      target_batch.id,
      import_row.id,
      actor_id,
      target_batch.reviewed_at
    from public.payroll_import_rows as import_row
    left join lateral (
      select assignment.staff_id
      from public.staff_grade_assignments as assignment
      where target_batch.dataset_type = 'renewal_orders'
        and assignment.grade = nullif(import_row.normalized_payload->>'grade', '')::smallint
        and assignment.effective_from <= (import_row.normalized_payload->>'event_date')::date
        and (assignment.effective_to is null
          or assignment.effective_to >= (import_row.normalized_payload->>'event_date')::date)
      order by assignment.effective_from desc, assignment.id desc
      limit 1
    ) as grade_assignment on true
    where import_row.batch_id = target_batch.id
      and (
        import_row.validation_status = 'valid'
        or (import_row.validation_status = 'conflict' and import_row.resolution = 'use_imported')
      );
  end if;
  return target_batch;
end;
$$;
