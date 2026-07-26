-- Migration: 20260726153000_crm_workflows.sql
-- Description: RPC Workflows for CRM lead management, Round-robin assignment, trial bookings, and official student conversion transaction

begin;

-- 1. Function: create_crm_case
create or replace function public.create_crm_case(
  p_full_name text,
  p_birth_year integer,
  p_expected_grade integer,
  p_guardian_phone text,
  p_guardian_full_name text,
  p_lead_source_code text,
  p_sale_owner_id uuid default null,
  p_expected_level text default null,
  p_expected_mode text default null,
  p_expected_tuition_fee_vnd bigint default null,
  p_discount_notes text default null,
  p_province_city text default null,
  p_notes text default null
)
returns public.crm_cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_full_name text := nullif(pg_catalog.btrim(coalesce(p_full_name, '')), '');
  normalized_guardian_phone text := nullif(pg_catalog.btrim(coalesce(p_guardian_phone, '')), '');
  normalized_guardian_name text := nullif(pg_catalog.btrim(coalesce(p_guardian_full_name, '')), '');

  source_row public.crm_lead_sources%rowtype;
  guardian_row public.guardians%rowtype;
  assigned_sale_id uuid := p_sale_owner_id;
  generated_code text;
  new_case public.crm_cases%rowtype;
  assign_method text;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('crm.update') then
    raise exception using errcode = '42501', message = 'CRM_UPDATE_PERMISSION_DENIED';
  end if;

  if normalized_full_name is null then
    raise exception using errcode = '22023', message = 'STUDENT_FULL_NAME_REQUIRED';
  end if;

  if normalized_guardian_phone is null then
    raise exception using errcode = '22023', message = 'GUARDIAN_PHONE_REQUIRED';
  end if;

  if normalized_guardian_name is null then
    raise exception using errcode = '22023', message = 'GUARDIAN_FULL_NAME_REQUIRED';
  end if;

  -- 1. Look up lead source
  select * into source_row
  from public.crm_lead_sources
  where code = p_lead_source_code and is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'INVALID_LEAD_SOURCE_CODE';
  end if;

  -- 2. Auto Round-robin sale assignment if null
  if assigned_sale_id is null then
    select p.id into assigned_sale_id
    from public.profiles as p
    join public.user_role_assignments as ura on ura.user_id = p.id
    join public.roles as r on r.id = ura.role_id
    where r.code in ('consultant', 'admissions_leader')
      and p.is_active = true
    order by (
      select count(*)
      from public.crm_cases as c
      where c.sale_owner_id = p.id
        and c.created_at >= pg_catalog.current_date
    ) asc, p.created_at asc
    limit 1;

    assign_method := 'auto_round_robin';
  else
    assign_method := 'manual_assign';
  end if;

  if assigned_sale_id is null then
    -- Fallback to actor if no consultant found
    assigned_sale_id := actor_id;
  end if;

  -- 3. Guardian reuse lookup or insert
  select * into guardian_row
  from public.guardians
  where phone = normalized_guardian_phone
  limit 1;

  if not found then
    insert into public.guardians (
      public_code,
      full_name,
      phone,
      created_by
    )
    values (
      'G-' || pg_catalog.to_char(pg_catalog.now(), 'YYMMDD') || '-' || pg_catalog.substr(md5(random()::text), 1, 4),
      normalized_guardian_name,
      normalized_guardian_phone,
      actor_id
    )
    returning * into guardian_row;
  end if;

  -- 4. Generate public code
  generated_code := 'CRM-' || pg_catalog.to_char(pg_catalog.now(), 'YYMMDD') || '-' || pg_catalog.substr(md5(random()::text), 1, 4);

  -- 5. Insert CRM Case
  insert into public.crm_cases (
    public_code,
    full_name,
    birth_year,
    expected_grade,
    expected_level,
    expected_mode,
    expected_tuition_fee_vnd,
    discount_notes,
    province_city,
    guardian_id,
    guardian_phone,
    guardian_full_name,
    lead_source_id,
    sale_owner_id,
    status,
    notes,
    created_by
  )
  values (
    generated_code,
    normalized_full_name,
    p_birth_year,
    p_expected_grade,
    p_expected_level,
    p_expected_mode,
    p_expected_tuition_fee_vnd,
    p_discount_notes,
    p_province_city,
    guardian_row.id,
    normalized_guardian_phone,
    normalized_guardian_name,
    source_row.id,
    assigned_sale_id,
    'interested',
    p_notes,
    actor_id
  )
  returning * into new_case;

  -- 6. Record Lead Assignment History
  insert into public.crm_lead_assignment_history (
    crm_case_id,
    previous_sale_owner_id,
    new_sale_owner_id,
    assignment_method,
    reason,
    assigned_by
  )
  values (
    new_case.id,
    null,
    assigned_sale_id,
    assign_method,
    'Tạo lead mới và phân công ban đầu',
    actor_id
  );

  -- 7. Initialize Enrollment Checklist
  insert into public.student_enrollment_checklists (
    crm_case_id
  )
  values (
    new_case.id
  );

  return new_case;
end;
$$;

revoke all on function public.create_crm_case(text, integer, integer, text, text, text, uuid, text, text, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.create_crm_case(text, integer, integer, text, text, text, uuid, text, text, bigint, text, text, text) to authenticated;

-- 2. Function: transfer_crm_case_lead
create or replace function public.transfer_crm_case_lead(
  p_crm_case_id uuid,
  p_new_sale_owner_id uuid,
  p_reason text
)
returns public.crm_cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  target_case public.crm_cases%rowtype;
  updated_case public.crm_cases%rowtype;
  old_sale_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('crm.transfer') then
    raise exception using errcode = '42501', message = 'CRM_TRANSFER_PERMISSION_DENIED';
  end if;

  if p_crm_case_id is null then
    raise exception using errcode = '22023', message = 'CRM_CASE_ID_REQUIRED';
  end if;

  if p_new_sale_owner_id is null then
    raise exception using errcode = '22023', message = 'NEW_SALE_OWNER_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using errcode = '22023', message = 'LEAD_TRANSFER_REASON_REQUIRED';
  end if;

  select * into target_case
  from public.crm_cases
  where id = p_crm_case_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CRM_CASE_NOT_FOUND';
  end if;

  old_sale_id := target_case.sale_owner_id;

  if old_sale_id = p_new_sale_owner_id then
    raise exception using errcode = '23514', message = 'NEW_SALE_OWNER_MUST_BE_DIFFERENT';
  end if;

  update public.crm_cases
  set sale_owner_id = p_new_sale_owner_id
  where id = p_crm_case_id
  returning * into updated_case;

  insert into public.crm_lead_assignment_history (
    crm_case_id,
    previous_sale_owner_id,
    new_sale_owner_id,
    assignment_method,
    reason,
    assigned_by
  )
  values (
    p_crm_case_id,
    old_sale_id,
    p_new_sale_owner_id,
    'manual_transfer',
    normalized_reason,
    actor_id
  );

  return updated_case;
end;
$$;

revoke all on function public.transfer_crm_case_lead(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.transfer_crm_case_lead(uuid, uuid, text) to authenticated;

-- 3. Function: book_crm_trial_session
create or replace function public.book_crm_trial_session(
  p_crm_case_id uuid,
  p_trial_date date,
  p_learning_mode text,
  p_class_session_id uuid default null,
  p_sale_notes text default null
)
returns public.crm_trial_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_case public.crm_cases%rowtype;
  new_booking public.crm_trial_bookings%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('crm.update') then
    raise exception using errcode = '42501', message = 'CRM_UPDATE_PERMISSION_DENIED';
  end if;

  select * into target_case
  from public.crm_cases
  where id = p_crm_case_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CRM_CASE_NOT_FOUND';
  end if;

  insert into public.crm_trial_bookings (
    crm_case_id,
    class_session_id,
    trial_date,
    learning_mode,
    status,
    sale_notes,
    created_by
  )
  values (
    p_crm_case_id,
    p_class_session_id,
    p_trial_date,
    p_learning_mode,
    'scheduled',
    p_sale_notes,
    actor_id
  )
  returning * into new_booking;

  update public.crm_cases
  set status = 'trial_booked'
  where id = p_crm_case_id;

  return new_booking;
end;
$$;

revoke all on function public.book_crm_trial_session(uuid, date, text, uuid, text) from public, anon, authenticated;
grant execute on function public.book_crm_trial_session(uuid, date, text, uuid, text) to authenticated;

-- 4. Function: convert_crm_case_to_official_student
create or replace function public.convert_crm_case_to_official_student(
  p_crm_case_id uuid,
  p_class_id uuid,
  p_official_start_date date,
  p_registered_mode text,
  p_checklist_items jsonb default '{}'::jsonb
)
returns public.students
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_case public.crm_cases%rowtype;
  checklist_row public.student_enrollment_checklists%rowtype;
  student_row public.students%rowtype;
  enrollment_row public.student_enrollments%rowtype;
  can_confirm_accountant boolean := false;
  generated_student_code text;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('students.confirm_official') then
    raise exception using errcode = '42501', message = 'STUDENTS_CONFIRM_OFFICIAL_PERMISSION_DENIED';
  end if;

  select * into target_case
  from public.crm_cases
  where id = p_crm_case_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CRM_CASE_NOT_FOUND';
  end if;

  if target_case.status = 'converted' then
    raise exception using errcode = '23514', message = 'CRM_CASE_ALREADY_CONVERTED';
  end if;

  -- Lock & load checklist
  select * into checklist_row
  from public.student_enrollment_checklists
  where crm_case_id = p_crm_case_id
  for update;

  if not found then
    insert into public.student_enrollment_checklists (crm_case_id)
    values (p_crm_case_id)
    returning * into checklist_row;
  end if;

  can_confirm_accountant := public.has_permission('sepay.accountant_confirm');

  -- Update checklist items from payload
  update public.student_enrollment_checklists
  set
    item_1_payment_received = coalesce((p_checklist_items->>'item_1_payment_received')::boolean, item_1_payment_received),
    item_2_source_confirmed = coalesce((p_checklist_items->>'item_2_source_confirmed')::boolean, item_2_source_confirmed),
    item_3_sale_confirmed = coalesce((p_checklist_items->>'item_3_sale_confirmed')::boolean, item_3_sale_confirmed),
    item_4_class_selected = coalesce((p_checklist_items->>'item_4_class_selected')::boolean, item_4_class_selected),
    item_5_mode_confirmed = coalesce((p_checklist_items->>'item_5_mode_confirmed')::boolean, item_5_mode_confirmed),
    item_6_fee_confirmed = coalesce((p_checklist_items->>'item_6_fee_confirmed')::boolean, item_6_fee_confirmed),
    item_7_assistant_sessions_confirmed = coalesce((p_checklist_items->>'item_7_assistant_sessions_confirmed')::boolean, item_7_assistant_sessions_confirmed),
    item_8_accountant_transaction_confirmed = case
      when can_confirm_accountant then coalesce((p_checklist_items->>'item_8_accountant_transaction_confirmed')::boolean, item_8_accountant_transaction_confirmed)
      else item_8_accountant_transaction_confirmed
    end,
    item_9_official_start_date_entered = coalesce((p_checklist_items->>'item_9_official_start_date_entered')::boolean, item_9_official_start_date_entered),
    item_10_communication_group_ready = coalesce((p_checklist_items->>'item_10_communication_group_ready')::boolean, item_10_communication_group_ready)
  where id = checklist_row.id
  returning * into checklist_row;

  -- Validate ALL 10 items are true
  if not (
    checklist_row.item_1_payment_received and
    checklist_row.item_2_source_confirmed and
    checklist_row.item_3_sale_confirmed and
    checklist_row.item_4_class_selected and
    checklist_row.item_5_mode_confirmed and
    checklist_row.item_6_fee_confirmed and
    checklist_row.item_7_assistant_sessions_confirmed and
    checklist_row.item_8_accountant_transaction_confirmed and
    checklist_row.item_9_official_start_date_entered and
    checklist_row.item_10_communication_group_ready
  ) then
    raise exception using errcode = '23514', message = 'ENROLLMENT_CHECKLIST_INCOMPLETE';
  end if;

  -- Generate Student Public Code
  generated_student_code := 'HV-' || pg_catalog.to_char(pg_catalog.now(), 'YYMMDD') || '-' || pg_catalog.substr(md5(random()::text), 1, 4);

  -- Create Official Student record
  insert into public.students (
    public_code,
    full_name,
    nickname,
    birth_year,
    current_grade,
    province_city,
    learning_level,
    registered_mode,
    lifecycle_status,
    official_start_date,
    created_by
  )
  values (
    generated_student_code,
    target_case.full_name,
    target_case.nickname,
    target_case.birth_year,
    target_case.expected_grade,
    target_case.province_city,
    target_case.expected_level,
    p_registered_mode,
    'active',
    p_official_start_date,
    actor_id
  )
  returning * into student_row;

  -- Link Guardian if exists
  if target_case.guardian_id is not null then
    insert into public.student_guardians (
      student_id,
      guardian_id,
      relationship,
      is_primary,
      created_by
    )
    values (
      student_row.id,
      target_case.guardian_id,
      target_case.guardian_relationship,
      true,
      actor_id
    )
    on conflict do nothing;
  end if;

  -- Create Official Enrollment in Class
  insert into public.student_enrollments (
    student_id,
    class_id,
    status,
    effective_from,
    registered_mode,
    transition_kind,
    start_reason,
    created_by
  )
  values (
    student_row.id,
    p_class_id,
    'active',
    p_official_start_date,
    p_registered_mode,
    'initial',
    'Chuyển đổi thành công từ CRM Lead ' || target_case.public_code,
    actor_id
  )
  returning * into enrollment_row;

  -- Update CRM Case & Checklist state
  update public.crm_cases
  set
    status = 'converted',
    student_id = student_row.id
  where id = p_crm_case_id;

  update public.student_enrollment_checklists
  set
    student_id = student_row.id,
    is_fully_completed = true,
    completed_at = pg_catalog.now(),
    completed_by = actor_id
  where id = checklist_row.id;

  return student_row;
end;
$$;

revoke all on function public.convert_crm_case_to_official_student(uuid, uuid, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.convert_crm_case_to_official_student(uuid, uuid, date, text, jsonb) to authenticated;

commit;
