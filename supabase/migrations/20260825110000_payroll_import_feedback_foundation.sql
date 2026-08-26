begin;

-- The previous immutable-history and audit triggers reject the one-time feedback-state backfill.
-- Remove them inside this transaction and recreate the stricter replacements below.
drop trigger if exists payroll_periods_protect_history on public.payroll_periods;
drop trigger if exists payroll_periods_audit_change on public.payroll_periods;

alter table public.payroll_periods
  add column feedback_opened_at timestamptz,
  add column feedback_closed_at timestamptz,
  add column feedback_closed_by uuid references public.profiles(id) on delete restrict;

update public.payroll_periods
set
  feedback_opened_at = generated_at,
  feedback_closed_at = case when status in ('review', 'approved') then reviewed_at else null end,
  feedback_closed_by = case when status in ('review', 'approved') then reviewed_by else null end;

alter table public.payroll_periods
  alter column feedback_opened_at set default pg_catalog.now(),
  alter column feedback_opened_at set not null,
  add constraint payroll_periods_feedback_state_check check (
    (feedback_closed_at is null and feedback_closed_by is null)
    or (feedback_closed_at is not null and feedback_closed_by is not null and feedback_closed_at >= feedback_opened_at)
  );

create table public.payroll_import_batches (
  id uuid primary key default gen_random_uuid(),
  dataset_type text not null check (dataset_type in ('timekeeping', 'grading', 'renewal_orders', 'new_enrollment_orders')),
  period_month date not null,
  file_name text not null,
  file_sha256 text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'superseded')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  conflict_rows integer not null default 0 check (conflict_rows >= 0),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default pg_catalog.now(),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  constraint payroll_import_month_start_check check (period_month = pg_catalog.date_trunc('month', period_month)::date),
  constraint payroll_import_file_name_check check (
    file_name = pg_catalog.btrim(file_name) and file_name <> '' and pg_catalog.length(file_name) <= 255
  ),
  constraint payroll_import_file_sha_check check (file_sha256 ~ '^[a-f0-9]{64}$'),
  constraint payroll_import_counts_check check (total_rows = valid_rows + error_rows + conflict_rows),
  constraint payroll_import_review_state_check check (
    (status = 'pending_review' and reviewed_by is null and reviewed_at is null and review_note is null)
    or (status in ('approved', 'rejected', 'superseded') and reviewed_by is not null and reviewed_at is not null and review_note is not null)
  ),
  unique (dataset_type, file_sha256)
);

create index payroll_import_batches_period_status_idx
  on public.payroll_import_batches (period_month desc, status, dataset_type);

create table public.payroll_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payroll_import_batches(id) on delete restrict,
  row_number integer not null check (row_number > 0),
  source_key text not null,
  raw_payload jsonb not null,
  normalized_payload jsonb,
  validation_status text not null check (validation_status in ('valid', 'error', 'conflict')),
  validation_errors jsonb not null default '[]'::jsonb,
  conflict_payload jsonb,
  resolution text check (resolution in ('use_system', 'use_imported')),
  resolution_reason text,
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  constraint payroll_import_row_source_key_check check (
    source_key = pg_catalog.btrim(source_key) and source_key <> '' and pg_catalog.length(source_key) <= 240
  ),
  constraint payroll_import_row_raw_object_check check (pg_catalog.jsonb_typeof(raw_payload) = 'object'),
  constraint payroll_import_row_normalized_object_check check (
    normalized_payload is null or pg_catalog.jsonb_typeof(normalized_payload) = 'object'
  ),
  constraint payroll_import_row_validation_errors_array_check check (pg_catalog.jsonb_typeof(validation_errors) = 'array'),
  constraint payroll_import_row_resolution_state_check check (
    (validation_status <> 'conflict' and resolution is null and resolution_reason is null and resolved_by is null and resolved_at is null)
    or (validation_status = 'conflict' and resolution is null and resolution_reason is null and resolved_by is null and resolved_at is null)
    or (validation_status = 'conflict' and resolution is not null and resolution_reason is not null and resolved_by is not null and resolved_at is not null)
  ),
  unique (batch_id, row_number),
  unique (batch_id, source_key)
);

create index payroll_import_rows_batch_status_idx
  on public.payroll_import_rows (batch_id, validation_status, row_number);

create table public.payroll_source_facts (
  id uuid primary key default gen_random_uuid(),
  fact_type text not null check (fact_type in (
    'timekeeping',
    'grading',
    'renewal_order',
    'new_enrollment_order',
    'teaching_allowance',
    'daily_admin_reporting',
    'addon_product_order',
    'staff_recruitment_salary'
  )),
  source_key text not null,
  source_origin text not null check (source_origin in ('system', 'excel', 'manual')),
  event_date date not null,
  staff_id uuid references public.profiles(id) on delete restrict,
  student_id uuid references public.students(id) on delete restrict,
  grade smallint check (grade between 2 and 12),
  amount_vnd bigint check (amount_vnd is null or amount_vnd >= 0),
  quantity numeric(14,4) check (quantity is null or quantity >= 0),
  source_code text,
  metadata jsonb not null default '{}'::jsonb,
  import_batch_id uuid references public.payroll_import_batches(id) on delete restrict,
  import_row_id uuid references public.payroll_import_rows(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  constraint payroll_source_fact_source_key_check check (
    source_key = pg_catalog.btrim(source_key) and source_key <> '' and pg_catalog.length(source_key) <= 240
  ),
  constraint payroll_source_fact_source_code_check check (
    source_code is null or (source_code = pg_catalog.btrim(source_code) and source_code <> '' and pg_catalog.length(source_code) <= 120)
  ),
  constraint payroll_source_fact_metadata_object_check check (pg_catalog.jsonb_typeof(metadata) = 'object'),
  constraint payroll_source_fact_import_link_check check (
    (source_origin = 'excel' and import_batch_id is not null and import_row_id is not null and approved_by is not null and approved_at is not null)
    or (source_origin <> 'excel' and import_batch_id is null and import_row_id is null)
  ),
  unique (fact_type, source_key)
);

create index payroll_source_facts_event_idx
  on public.payroll_source_facts (event_date, fact_type, staff_id);
create index payroll_source_facts_student_event_idx
  on public.payroll_source_facts (student_id, event_date desc)
  where student_id is not null;

create trigger payroll_source_facts_immutable
before update or delete on public.payroll_source_facts
for each row execute function public.prevent_payroll_configuration_mutation();

create or replace function public.protect_payroll_import_batch_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'pending_review'
    and new.status in ('approved', 'rejected')
    and new.dataset_type is not distinct from old.dataset_type
    and new.period_month is not distinct from old.period_month
    and new.file_name is not distinct from old.file_name
    and new.file_sha256 is not distinct from old.file_sha256
    and new.total_rows is not distinct from old.total_rows
    and new.valid_rows is not distinct from old.valid_rows
    and new.error_rows is not distinct from old.error_rows
    and new.conflict_rows is not distinct from old.conflict_rows
    and new.uploaded_by is not distinct from old.uploaded_by
    and new.uploaded_at is not distinct from old.uploaded_at
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'approved'
    and new.status = 'superseded'
    and new.dataset_type is not distinct from old.dataset_type
    and new.period_month is not distinct from old.period_month
    and new.file_name is not distinct from old.file_name
    and new.file_sha256 is not distinct from old.file_sha256
    and new.total_rows is not distinct from old.total_rows
    and new.valid_rows is not distinct from old.valid_rows
    and new.error_rows is not distinct from old.error_rows
    and new.conflict_rows is not distinct from old.conflict_rows
    and new.uploaded_by is not distinct from old.uploaded_by
    and new.uploaded_at is not distinct from old.uploaded_at
  then
    return new;
  end if;

  raise exception using errcode = '23514', message = 'PAYROLL_IMPORT_BATCH_HISTORY_IMMUTABLE';
end;
$$;

create trigger payroll_import_batches_protect_history
before update or delete on public.payroll_import_batches
for each row execute function public.protect_payroll_import_batch_history();

create or replace function public.protect_payroll_import_row_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.validation_status = 'conflict'
    and old.resolution is null
    and new.resolution is not null
    and new.batch_id is not distinct from old.batch_id
    and new.row_number is not distinct from old.row_number
    and new.source_key is not distinct from old.source_key
    and new.raw_payload is not distinct from old.raw_payload
    and new.normalized_payload is not distinct from old.normalized_payload
    and new.validation_status is not distinct from old.validation_status
    and new.validation_errors is not distinct from old.validation_errors
    and new.conflict_payload is not distinct from old.conflict_payload
    and new.created_at is not distinct from old.created_at
  then
    return new;
  end if;
  raise exception using errcode = '23514', message = 'PAYROLL_IMPORT_ROW_HISTORY_IMMUTABLE';
end;
$$;

create trigger payroll_import_rows_protect_history
before update or delete on public.payroll_import_rows
for each row execute function public.protect_payroll_import_row_history();

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
    public.digest(
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

create or replace function public.resolve_payroll_import_conflict(
  p_row_id uuid,
  p_resolution text,
  p_reason text
)
returns public.payroll_import_rows
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_resolution text := pg_catalog.lower(pg_catalog.btrim(p_resolution));
  updated_row public.payroll_import_rows%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.import') then
    raise exception using errcode = '42501', message = 'PAYROLL_IMPORT_PERMISSION_REQUIRED';
  end if;
  if normalized_resolution not in ('use_system', 'use_imported') or nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'PAYROLL_IMPORT_RESOLUTION_INVALID';
  end if;

  update public.payroll_import_rows as import_row
  set resolution = normalized_resolution,
      resolution_reason = pg_catalog.btrim(p_reason),
      resolved_by = actor_id,
      resolved_at = pg_catalog.now()
  from public.payroll_import_batches as batch
  where import_row.id = p_row_id
    and batch.id = import_row.batch_id
    and batch.status = 'pending_review'
    and import_row.validation_status = 'conflict'
    and import_row.resolution is null
  returning import_row.* into updated_row;

  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_IMPORT_CONFLICT_NOT_PENDING';
  end if;
  return updated_row;
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
        else nullif(import_row.normalized_payload->>'staff_id', '')::uuid
      end,
      nullif(import_row.normalized_payload->>'student_id', '')::uuid,
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

revoke all on function public.create_payroll_import_batch(text, date, text, text, jsonb) from public, anon;
revoke all on function public.resolve_payroll_import_conflict(uuid, text, text) from public, anon;
revoke all on function public.decide_payroll_import_batch(uuid, text, text) from public, anon;
grant execute on function public.create_payroll_import_batch(text, date, text, text, jsonb) to authenticated;
grant execute on function public.resolve_payroll_import_conflict(uuid, text, text) to authenticated;
grant execute on function public.decide_payroll_import_batch(uuid, text, text) to authenticated;

create table public.payroll_correction_requests (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
  payroll_statement_id uuid not null references public.payroll_statements(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  request_message text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  requested_at timestamptz not null default pg_catalog.now(),
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolved_at timestamptz,
  response_message text,
  constraint payroll_correction_request_message_check check (
    request_message = pg_catalog.btrim(request_message) and request_message <> '' and pg_catalog.length(request_message) <= 4000
  ),
  constraint payroll_correction_response_state_check check (
    (status = 'pending' and resolved_by is null and resolved_at is null and response_message is null)
    or (status in ('accepted', 'rejected') and resolved_by is not null and resolved_at is not null and response_message is not null)
  )
);

create table public.payroll_correction_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.payroll_correction_requests(id) on delete restrict,
  payroll_line_item_id uuid references public.payroll_line_items(id) on delete restrict,
  item_label text not null,
  requested_change text not null,
  evidence_url text,
  created_at timestamptz not null default pg_catalog.now(),
  constraint payroll_correction_item_label_check check (
    item_label = pg_catalog.btrim(item_label) and item_label <> '' and pg_catalog.length(item_label) <= 240
  ),
  constraint payroll_correction_item_change_check check (
    requested_change = pg_catalog.btrim(requested_change) and requested_change <> '' and pg_catalog.length(requested_change) <= 4000
  ),
  constraint payroll_correction_item_evidence_check check (
    evidence_url is null or (evidence_url = pg_catalog.btrim(evidence_url) and evidence_url ~ '^https?://')
  )
);

create index payroll_correction_period_status_idx
  on public.payroll_correction_requests (payroll_period_id, status, requested_at);

create or replace function public.protect_payroll_correction_request_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'pending'
    and new.status in ('accepted', 'rejected')
    and new.payroll_period_id is not distinct from old.payroll_period_id
    and new.payroll_statement_id is not distinct from old.payroll_statement_id
    and new.requested_by is not distinct from old.requested_by
    and new.request_message is not distinct from old.request_message
    and new.requested_at is not distinct from old.requested_at
  then
    return new;
  end if;
  raise exception using errcode = '23514', message = 'PAYROLL_CORRECTION_REQUEST_HISTORY_IMMUTABLE';
end;
$$;

create trigger payroll_correction_requests_protect_history
before update or delete on public.payroll_correction_requests
for each row execute function public.protect_payroll_correction_request_history();
create trigger payroll_correction_items_immutable
before update or delete on public.payroll_correction_request_items
for each row execute function public.prevent_payroll_configuration_mutation();

create or replace function public.submit_payroll_correction_request(
  p_payroll_statement_id uuid,
  p_request_message text,
  p_items jsonb
)
returns public.payroll_correction_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_statement public.payroll_statements%rowtype;
  target_period public.payroll_periods%rowtype;
  item jsonb;
  created_request public.payroll_correction_requests%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if pg_catalog.jsonb_typeof(p_items) <> 'array' or pg_catalog.jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'PAYROLL_CORRECTION_ITEMS_REQUIRED';
  end if;

  select * into target_statement from public.payroll_statements
  where id = p_payroll_statement_id and staff_id = actor_id;
  if not found then
    raise exception using errcode = '42501', message = 'PAYROLL_CORRECTION_OWN_STATEMENT_REQUIRED';
  end if;
  select * into target_period from public.payroll_periods where id = target_statement.payroll_period_id for share;
  if target_period.status <> 'draft' or target_period.feedback_closed_at is not null then
    raise exception using errcode = '23514', message = 'PAYROLL_FEEDBACK_WINDOW_CLOSED';
  end if;

  insert into public.payroll_correction_requests (
    payroll_period_id, payroll_statement_id, requested_by, request_message
  ) values (
    target_period.id, target_statement.id, actor_id, pg_catalog.btrim(p_request_message)
  ) returning * into created_request;

  for item in select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    if nullif(item->>'payroll_line_item_id', '') is not null and not exists (
      select 1 from public.payroll_line_items
      where id = (item->>'payroll_line_item_id')::uuid
        and payroll_statement_id = target_statement.id
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_CORRECTION_LINE_MISMATCH';
    end if;
    insert into public.payroll_correction_request_items (
      request_id, payroll_line_item_id, item_label, requested_change, evidence_url
    ) values (
      created_request.id,
      nullif(item->>'payroll_line_item_id', '')::uuid,
      pg_catalog.btrim(item->>'item_label'),
      pg_catalog.btrim(item->>'requested_change'),
      nullif(pg_catalog.btrim(item->>'evidence_url'), '')
    );
  end loop;
  return created_request;
exception
  when check_violation or invalid_text_representation then
    raise exception using errcode = '22023', message = 'PAYROLL_CORRECTION_REQUEST_INVALID';
end;
$$;

create or replace function public.resolve_payroll_correction_request(
  p_request_id uuid,
  p_decision text,
  p_response_message text
)
returns public.payroll_correction_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(p_decision));
  target_request public.payroll_correction_requests%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.feedback.resolve') then
    raise exception using errcode = '42501', message = 'PAYROLL_FEEDBACK_RESOLVE_PERMISSION_REQUIRED';
  end if;
  if normalized_decision not in ('accepted', 'rejected') or nullif(pg_catalog.btrim(p_response_message), '') is null then
    raise exception using errcode = '22023', message = 'PAYROLL_CORRECTION_DECISION_INVALID';
  end if;

  select * into target_request from public.payroll_correction_requests
  where id = p_request_id and status = 'pending'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_CORRECTION_REQUEST_NOT_PENDING';
  end if;
  if target_request.requested_by = actor_id then
    raise exception using errcode = '42501', message = 'PAYROLL_CORRECTION_SELF_APPROVAL_FORBIDDEN';
  end if;

  update public.payroll_correction_requests
  set status = normalized_decision,
      resolved_by = actor_id,
      resolved_at = pg_catalog.now(),
      response_message = pg_catalog.btrim(p_response_message)
  where id = target_request.id
  returning * into target_request;
  return target_request;
end;
$$;

create or replace function public.protect_payroll_period_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'draft'
    and new.status = 'draft'
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.approved_by is not distinct from old.approved_by
    and new.approved_at is not distinct from old.approved_at
    and new.feedback_opened_at is not distinct from old.feedback_opened_at
    and old.feedback_closed_at is null
    and old.feedback_closed_by is null
    and new.feedback_closed_at is not null
    and new.feedback_closed_by is not null
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'draft'
    and new.status = 'review'
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.approved_by is null
    and new.approved_at is null
    and new.feedback_opened_at is not distinct from old.feedback_opened_at
    and new.feedback_closed_at is not distinct from old.feedback_closed_at
    and new.feedback_closed_by is not distinct from old.feedback_closed_by
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'review'
    and new.status = 'approved'
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.feedback_opened_at is not distinct from old.feedback_opened_at
    and new.feedback_closed_at is not distinct from old.feedback_closed_at
    and new.feedback_closed_by is not distinct from old.feedback_closed_by
  then
    return new;
  end if;

  raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_HISTORY_IS_IMMUTABLE';
end;
$$;

create trigger payroll_periods_protect_history
before update or delete on public.payroll_periods
for each row execute function public.protect_payroll_period_history();

create trigger payroll_periods_audit_change
after insert or update on public.payroll_periods
for each row execute function public.audit_payroll_period_change();

create or replace function public.close_payroll_feedback(p_payroll_period_id uuid)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  updated_period public.payroll_periods%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.feedback.resolve') then
    raise exception using errcode = '42501', message = 'PAYROLL_FEEDBACK_RESOLVE_PERMISSION_REQUIRED';
  end if;
  if exists (
    select 1 from public.payroll_correction_requests
    where payroll_period_id = p_payroll_period_id and status = 'pending'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_CORRECTION_REQUESTS_PENDING';
  end if;
  update public.payroll_periods
  set feedback_closed_at = pg_catalog.now(), feedback_closed_by = actor_id
  where id = p_payroll_period_id and status = 'draft' and feedback_closed_at is null
  returning * into updated_period;
  if not found then
    raise exception using errcode = '23514', message = 'PAYROLL_FEEDBACK_NOT_OPEN';
  end if;
  return updated_period;
end;
$$;

create or replace function public.submit_payroll_for_review(p_payroll_period_id uuid)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  updated_period public.payroll_periods%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.accountant_reconcile') then
    raise exception using errcode = '42501', message = 'PAYROLL_ACCOUNTANT_RECONCILE_PERMISSION_REQUIRED';
  end if;
  if exists (
    select 1 from public.payroll_statements
    where payroll_period_id = p_payroll_period_id and staff_id = actor_id
  ) then
    raise exception using errcode = '42501', message = 'PAYROLL_SELF_RECONCILIATION_FORBIDDEN';
  end if;
  if exists (
    select 1 from public.payroll_correction_requests
    where payroll_period_id = p_payroll_period_id and status = 'pending'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_CORRECTION_REQUESTS_PENDING';
  end if;

  update public.payroll_periods
  set status = 'review', reviewed_by = actor_id, reviewed_at = pg_catalog.now()
  where id = p_payroll_period_id and status = 'draft' and feedback_closed_at is not null
  returning * into updated_period;
  if not found then
    raise exception using errcode = '23514', message = 'PAYROLL_FEEDBACK_MUST_BE_CLOSED';
  end if;
  return updated_period;
end;
$$;

create or replace function public.approve_payroll_period(p_payroll_period_id uuid)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  updated_period public.payroll_periods%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.owner_approve') then
    raise exception using errcode = '42501', message = 'PAYROLL_OWNER_APPROVE_PERMISSION_REQUIRED';
  end if;
  if exists (
    select 1 from public.payroll_statements
    where payroll_period_id = p_payroll_period_id and staff_id = actor_id
  ) then
    raise exception using errcode = '42501', message = 'PAYROLL_SELF_APPROVAL_FORBIDDEN';
  end if;

  update public.payroll_periods
  set status = 'approved', approved_by = actor_id, approved_at = pg_catalog.now()
  where id = p_payroll_period_id and status = 'review'
  returning * into updated_period;
  if not found then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_IN_REVIEW';
  end if;
  return updated_period;
end;
$$;

revoke all on function public.submit_payroll_correction_request(uuid, text, jsonb) from public, anon;
revoke all on function public.resolve_payroll_correction_request(uuid, text, text) from public, anon;
revoke all on function public.close_payroll_feedback(uuid) from public, anon;
grant execute on function public.submit_payroll_correction_request(uuid, text, jsonb) to authenticated;
grant execute on function public.resolve_payroll_correction_request(uuid, text, text) to authenticated;
grant execute on function public.close_payroll_feedback(uuid) to authenticated;

alter table public.payroll_import_batches enable row level security;
alter table public.payroll_import_rows enable row level security;
alter table public.payroll_source_facts enable row level security;
alter table public.payroll_correction_requests enable row level security;
alter table public.payroll_correction_request_items enable row level security;

create policy payroll_import_batches_select on public.payroll_import_batches for select to authenticated
using (public.has_permission('payroll.import'));
create policy payroll_import_rows_select on public.payroll_import_rows for select to authenticated
using (public.has_permission('payroll.import'));
create policy payroll_source_facts_select on public.payroll_source_facts for select to authenticated
using (public.has_permission('payroll.view'));
create policy payroll_correction_requests_select on public.payroll_correction_requests for select to authenticated
using (
  requested_by = (select auth.uid())
  or public.has_permission('payroll.feedback.resolve')
  or public.has_permission('payroll.owner_approve')
);
create policy payroll_correction_items_select on public.payroll_correction_request_items for select to authenticated
using (
  exists (
    select 1 from public.payroll_correction_requests as request
    where request.id = payroll_correction_request_items.request_id
      and (
        request.requested_by = (select auth.uid())
        or public.has_permission('payroll.feedback.resolve')
        or public.has_permission('payroll.owner_approve')
      )
  )
);

revoke all privileges on public.payroll_import_batches, public.payroll_import_rows,
  public.payroll_source_facts, public.payroll_correction_requests,
  public.payroll_correction_request_items from public, anon, authenticated;
grant select on public.payroll_import_batches, public.payroll_import_rows,
  public.payroll_source_facts, public.payroll_correction_requests,
  public.payroll_correction_request_items to authenticated;

commit;
