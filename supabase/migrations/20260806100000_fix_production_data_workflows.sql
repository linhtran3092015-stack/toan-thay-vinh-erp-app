-- Fix production workflow functions reported by plpgsql_check on Supabase Cloud.
-- Applied migrations remain immutable; this migration only replaces function bodies.

begin;

create or replace function public.reverse_session_charge(
  p_session_attendance_id uuid,
  p_reason text
)
returns public.student_session_ledger_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_reason, '')
      ),
      ''
    );
  target_charge public.student_session_ledger_entries%rowtype;
  reversal_entry public.student_session_ledger_entries%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('session_ledger.reverse') then
    raise exception using
      errcode = '42501',
      message = 'SESSION_LEDGER_REVERSE_PERMISSION_DENIED';
  end if;

  if p_session_attendance_id is null then
    raise exception using
      errcode = '22023',
      message = 'SESSION_ATTENDANCE_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'SESSION_REVERSAL_REASON_REQUIRED';
  end if;

  select charge_row.*
  into target_charge
  from public.student_session_ledger_entries as charge_row
  where charge_row.session_attendance_id = p_session_attendance_id
    and charge_row.entry_type = 'session_charge'
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SESSION_CHARGE_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.student_session_ledger_entries as existing_reversal
    where existing_reversal.reverses_entry_id = target_charge.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'SESSION_CHARGE_ALREADY_REVERSED';
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  insert into public.student_session_ledger_entries (
    student_id,
    student_enrollment_id,
    class_session_id,
    session_attendance_id,
    entry_type,
    delta_sessions,
    effective_on,
    event_key,
    reverses_entry_id,
    unit_price_vnd,
    note,
    created_by
  )
  values (
    target_charge.student_id,
    target_charge.student_enrollment_id,
    target_charge.class_session_id,
    target_charge.session_attendance_id,
    'session_reversal',
    1,
    current_date,
    'session-reversal:' || target_charge.id::text,
    target_charge.id,
    target_charge.unit_price_vnd,
    normalized_reason,
    actor_id
  )
  returning *
  into reversal_entry;

  return reversal_entry;
end;
$$;

revoke all on function public.reverse_session_charge(uuid, text)
from public, anon, authenticated;
grant execute on function public.reverse_session_charge(uuid, text)
to authenticated;

comment on function public.reverse_session_charge(uuid, text)
is 'Reverses a previously charged session attendance by creating a session_reversal ledger entry (+1).';

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

  generated_student_code := 'HV-' || pg_catalog.to_char(pg_catalog.now(), 'YYMMDD') || '-' || pg_catalog.substr(md5(random()::text), 1, 4);

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

create or replace function public.allocate_payment_to_students(
  p_sepay_transaction_id uuid,
  p_guardian_id uuid,
  p_allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_tx record;
  v_total_allocated bigint := 0;
  v_item jsonb;
  v_student_id uuid;
  v_amount_vnd bigint;
  v_purchased_sessions integer;
  v_bonus_sessions integer;
  v_unit_price bigint;
  v_credit_lot_id uuid;
  v_ref_code text;
  v_seen_student_ids uuid[] := array[]::uuid[];
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED: Vui long dang nhap.';
  end if;

  if not (
    public.has_permission('sepay.allocate')
    or public.has_permission('payments.manage')
  ) then
    raise exception 'SEPAY_ALLOCATE_PERMISSION_DENIED: Khong co quyen phan bo hoc phi.';
  end if;

  if p_sepay_transaction_id is null then
    raise exception 'TRANSACTION_NOT_FOUND: Giao dich SePay khong ton tai.';
  end if;

  if p_guardian_id is null then
    raise exception 'GUARDIAN_ID_REQUIRED: Thieu phu huynh phan bo.';
  end if;

  if p_allocations is null
    or pg_catalog.jsonb_typeof(p_allocations) <> 'array'
    or pg_catalog.jsonb_array_length(p_allocations) = 0
  then
    raise exception 'EMPTY_ALLOCATIONS: Can phan bo it nhat 1 hoc vien.';
  end if;

  select
    tx.*,
    webhook.transfer_type as webhook_transfer_type
  into v_tx
  from public.sepay_transactions as tx
  left join public.sepay_webhooks as webhook
    on webhook.id = tx.sepay_webhook_id
  where tx.id = p_sepay_transaction_id
  for update of tx;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND: Giao dich SePay khong ton tai.';
  end if;

  if v_tx.webhook_transfer_type is distinct from 'in' then
    raise exception 'TRANSACTION_NOT_INBOUND: Chi giao dich chuyen vao moi duoc phan bo.';
  end if;

  if v_tx.match_status <> 'unmatched' then
    raise exception 'TRANSACTION_NOT_AVAILABLE_FOR_ALLOCATION: Giao dich da duoc xu ly hoac dang can doi soat.';
  end if;

  if exists (
    select 1
    from public.payment_split_allocations as allocation
    where allocation.sepay_transaction_id = p_sepay_transaction_id
  ) then
    raise exception 'ALLOCATION_ALREADY_EXISTS: Giao dich da co phan bo.';
  end if;

  for v_item in
    select item.value
    from pg_catalog.jsonb_array_elements(p_allocations) as item(value)
  loop
    begin
      v_student_id := (v_item ->> 'student_id')::uuid;
      v_amount_vnd := (v_item ->> 'allocated_amount_vnd')::bigint;
      v_purchased_sessions := (v_item ->> 'allocated_sessions')::integer;
      v_bonus_sessions := coalesce((v_item ->> 'bonus_sessions')::integer, 0);
      v_unit_price := coalesce(
        nullif((v_item ->> 'unit_price_vnd')::bigint, 0),
        v_amount_vnd / v_purchased_sessions
      );
    exception
      when others then
        raise exception 'INVALID_ALLOCATION_ITEM: Du lieu phan bo khong hop le.';
    end;

    if v_amount_vnd <= 0
      or v_purchased_sessions <= 0
      or v_bonus_sessions < 0
      or v_unit_price <= 0
    then
      raise exception 'INVALID_ALLOCATION_ITEM: Gia tri phan bo phai lon hon 0.';
    end if;

    if v_student_id = any(v_seen_student_ids) then
      raise exception 'DUPLICATE_ALLOCATION_STUDENT: Moi hoc vien chi duoc phan bo mot lan trong giao dich.';
    end if;

    if not exists (
      select 1
      from public.student_guardians as link
      where link.student_id = v_student_id
        and link.guardian_id = p_guardian_id
        and link.ended_at is null
    ) then
      raise exception 'STUDENT_GUARDIAN_MISMATCH: Hoc vien khong thuoc phu huynh da chon.';
    end if;

    v_seen_student_ids := pg_catalog.array_append(v_seen_student_ids, v_student_id);
    v_total_allocated := v_total_allocated + v_amount_vnd;
  end loop;

  if v_total_allocated <> v_tx.amount_vnd then
    raise exception 'ALLOCATION_TOTAL_MUST_MATCH_TRANSACTION: Tong tien phan bo (%) phai bang so tien giao dich (%).', v_total_allocated, v_tx.amount_vnd;
  end if;

  v_ref_code := 'SPLIT-' || pg_catalog.substr(p_sepay_transaction_id::text, 1, 8);

  for v_item in
    select item.value
    from pg_catalog.jsonb_array_elements(p_allocations) as item(value)
  loop
    v_student_id := (v_item ->> 'student_id')::uuid;
    v_amount_vnd := (v_item ->> 'allocated_amount_vnd')::bigint;
    v_purchased_sessions := (v_item ->> 'allocated_sessions')::integer;
    v_bonus_sessions := coalesce((v_item ->> 'bonus_sessions')::integer, 0);
    v_unit_price := coalesce(
      nullif((v_item ->> 'unit_price_vnd')::bigint, 0),
      v_amount_vnd / v_purchased_sessions
    );

    insert into public.student_credit_lots (
      student_id,
      sepay_transaction_id,
      total_purchased_sessions,
      total_bonus_sessions,
      total_sessions,
      remaining_sessions,
      unit_price_vnd,
      topup_type,
      status,
      created_by
    )
    values (
      v_student_id,
      p_sepay_transaction_id,
      v_purchased_sessions,
      v_bonus_sessions,
      v_purchased_sessions + v_bonus_sessions,
      v_purchased_sessions + v_bonus_sessions,
      v_unit_price,
      'new',
      'active',
      v_actor_id
    )
    returning id into v_credit_lot_id;

    insert into public.payment_split_allocations (
      sepay_transaction_id,
      guardian_id,
      student_id,
      allocated_amount_vnd,
      allocated_sessions,
      bonus_sessions,
      unit_price_vnd,
      credit_lot_id,
      notes,
      allocated_by
    )
    values (
      p_sepay_transaction_id,
      p_guardian_id,
      v_student_id,
      v_amount_vnd,
      v_purchased_sessions,
      v_bonus_sessions,
      v_unit_price,
      v_credit_lot_id,
      nullif(pg_catalog.btrim(v_item ->> 'notes'), ''),
      v_actor_id
    );

    insert into public.student_session_ledger_entries (
      student_id,
      entry_type,
      delta_sessions,
      effective_on,
      event_key,
      reference_code,
      unit_price_vnd,
      note,
      metadata,
      created_by
    )
    values (
      v_student_id,
      'payment_credit',
      v_purchased_sessions,
      current_date,
      'sepay-split-payment-credit:' || p_sepay_transaction_id::text || ':' || v_student_id::text,
      v_ref_code,
      v_unit_price,
      'Nap hoc phi phan bo nhieu con',
      pg_catalog.jsonb_build_object(
        'allocation_amount_vnd', v_amount_vnd,
        'credit_lot_id', v_credit_lot_id,
        'guardian_id', p_guardian_id,
        'sepay_transaction_id', p_sepay_transaction_id
      ),
      v_actor_id
    );

    if v_bonus_sessions > 0 then
      insert into public.student_session_ledger_entries (
        student_id,
        entry_type,
        delta_sessions,
        effective_on,
        event_key,
        reference_code,
        unit_price_vnd,
        note,
        metadata,
        created_by
      )
      values (
        v_student_id,
        'bonus_credit',
        v_bonus_sessions,
        current_date,
        'sepay-split-bonus-credit:' || p_sepay_transaction_id::text || ':' || v_student_id::text,
        v_ref_code,
        null,
        'Tang buoi hoc kem phan bo nhieu con',
        pg_catalog.jsonb_build_object(
          'credit_lot_id', v_credit_lot_id,
          'guardian_id', p_guardian_id,
          'sepay_transaction_id', p_sepay_transaction_id
        ),
        v_actor_id
      );
    end if;

    insert into public.finance_cashflow_records (
      record_type,
      category,
      amount_vnd,
      student_id,
      sepay_transaction_id,
      reference_code,
      note,
      created_by
    )
    values (
      'receipt',
      'tuition_fee',
      v_amount_vnd,
      v_student_id,
      p_sepay_transaction_id,
      v_ref_code,
      'Phan bo hoc phi cho hoc vien',
      v_actor_id
    );
  end loop;

  update public.sepay_transactions
  set
    match_status = 'split_allocated',
    matched_by = v_actor_id,
    matched_at = pg_catalog.now()
  where id = p_sepay_transaction_id;

  return pg_catalog.jsonb_build_object(
    'status', 'success',
    'sepay_transaction_id', p_sepay_transaction_id,
    'total_allocated_vnd', v_total_allocated
  );
end;
$$;

revoke all on function public.allocate_payment_to_students(uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.allocate_payment_to_students(uuid, uuid, jsonb)
to authenticated;

-- Keep the incomplete legacy refund workflow fail-closed. A complete refund
-- workflow requires request, approval, FIFO, bonus exclusion and clawback rules.
create or replace function public.process_student_refund(
  p_student_id uuid,
  p_refund_amount_vnd bigint,
  p_refund_sessions integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '0A000',
    message = 'REFUND_WORKFLOW_NOT_AVAILABLE';
end;
$$;

revoke all on function public.process_student_refund(
  uuid,
  bigint,
  integer,
  text
) from public, anon, authenticated, service_role;

commit;
