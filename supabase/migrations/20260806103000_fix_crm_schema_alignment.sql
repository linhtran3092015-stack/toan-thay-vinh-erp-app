-- Align CRM write workflows with the current guardian, student and enrollment schema.

begin;

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
  normalized_guardian_phone text := nullif(
    public.normalize_vietnam_phone(
      pg_catalog.btrim(coalesce(p_guardian_phone, ''))
    ),
    ''
  );
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

  if normalized_guardian_phone !~ '^0[0-9]{9,10}$' then
    raise exception using errcode = '22023', message = 'GUARDIAN_PHONE_INVALID';
  end if;

  if normalized_guardian_name is null then
    raise exception using errcode = '22023', message = 'GUARDIAN_FULL_NAME_REQUIRED';
  end if;

  select * into source_row
  from public.crm_lead_sources
  where code = p_lead_source_code and is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'INVALID_LEAD_SOURCE_CODE';
  end if;

  if assigned_sale_id is null then
    select profile.id into assigned_sale_id
    from public.profiles as profile
    join public.user_role_assignments as assignment
      on assignment.user_id = profile.id
      and assignment.revoked_at is null
    join public.roles as role
      on role.id = assignment.role_id
      and role.is_active = true
    where role.code in ('consultant', 'admissions_leader')
      and profile.employment_status = 'active'
    order by (
      select count(*)
      from public.crm_cases as crm_case
      where crm_case.sale_owner_id = profile.id
        and crm_case.created_at >= current_date
    ) asc, profile.created_at asc
    limit 1;

    assign_method := 'auto_round_robin';
  else
    assign_method := 'manual_assign';
  end if;

  if assigned_sale_id is null then
    assigned_sale_id := actor_id;
  end if;

  select * into guardian_row
  from public.guardians
  where normalized_phone = normalized_guardian_phone
  limit 1;

  if not found then
    insert into public.guardians (
      full_name,
      phone,
      created_by
    )
    values (
      normalized_guardian_name,
      normalized_guardian_phone,
      actor_id
    )
    returning * into guardian_row;
  end if;

  generated_code := 'CRM-' || pg_catalog.to_char(pg_catalog.now(), 'YYMMDD') || '-' || pg_catalog.substr(md5(random()::text), 1, 4);

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

  insert into public.student_enrollment_checklists (crm_case_id)
  values (new_case.id);

  return new_case;
end;
$$;

revoke all on function public.create_crm_case(
  text,
  integer,
  integer,
  text,
  text,
  text,
  uuid,
  text,
  text,
  bigint,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.create_crm_case(
  text,
  integer,
  integer,
  text,
  text,
  text,
  uuid,
  text,
  text,
  bigint,
  text,
  text,
  text
) to authenticated;

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
  can_confirm_accountant boolean := false;
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

  insert into public.students (
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

  if target_case.guardian_id is not null then
    insert into public.student_guardians (
      student_id,
      guardian_id,
      relationship,
      is_primary,
      linked_by
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

  insert into public.student_enrollments (
    student_id,
    class_id,
    status,
    effective_from,
    registered_mode,
    transition_kind,
    start_reason,
    started_by
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
  );

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

revoke all on function public.convert_crm_case_to_official_student(
  uuid,
  uuid,
  date,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.convert_crm_case_to_official_student(
  uuid,
  uuid,
  date,
  text,
  jsonb
) to authenticated;

commit;
