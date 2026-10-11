-- Đợt 2 — nhóm 2b: CRM khép kín.
--
-- C1: CRM dừng ở "đã đặt lịch học thử": không có RPC cho trial_completed /
--     dropped / kết quả học thử; lead rớt không đóng được.
--   → record_crm_trial_result (đến / vắng / hủy, nhận xét giáo viên) đẩy case
--     sang Đã học thử hoặc trả về Đang quan tâm; advance_crm_case_status cho
--     Chờ xác nhận nhập học, Dừng (kèm lý do), Mở lại.
-- Ghi chú & nhắc theo dõi: bảng crm_case_notes (ghi chú, ngày hẹn theo dõi,
--     đánh dấu đã xử lý); worker pg_cron mỗi sáng nhắc sale phụ trách các hẹn
--     đến hạn; thông báo cho sale khi được giao lead (trigger lịch sử phân công).
-- C3: thanh toán không gắn với chuyển đổi — phiếu tuyển mới không tạo được trước
--     khi convert nên tiền về luôn unmatched; checklist "đã nhận học phí" tự tick.
--   → Chuyển case sang Chờ xác nhận nhập học tạo hồ sơ học sinh tạm
--     (lifecycle pending_enrollment_confirmation, gắn phụ huynh chính, gắn vào
--     case) để kế toán lập phiếu thu tuyển mới ngay; phiếu thu ghi crm_case_id;
--     convert dùng lại hồ sơ đó thay vì tạo mới, và mục 1 checklist được hệ
--     thống xác nhận khi học sinh đã có phiếu thu tuyển mới ở trạng thái đã thu.

begin;

-- ---------------------------------------------------------------------------
-- 1. Cột trạng thái bổ sung
-- ---------------------------------------------------------------------------

alter table public.crm_cases
  add column dropped_at timestamptz,
  add column dropped_by uuid references public.profiles(id) on delete restrict,
  add column drop_reason text,
  add column status_changed_at timestamptz not null default pg_catalog.now();

alter table public.crm_trial_bookings
  add column result_recorded_at timestamptz,
  add column result_recorded_by uuid references public.profiles(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 2. Ghi chú & hẹn theo dõi
-- ---------------------------------------------------------------------------

create table public.crm_case_notes (
  id uuid primary key default gen_random_uuid(),
  crm_case_id uuid not null references public.crm_cases(id) on delete cascade,
  note text not null check (note = pg_catalog.btrim(note) and note <> '' and pg_catalog.length(note) <= 2000),
  follow_up_at date,
  follow_up_done_at timestamptz,
  follow_up_done_by uuid references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  check (follow_up_done_at is null or follow_up_at is not null)
);

create index crm_case_notes_case_idx on public.crm_case_notes (crm_case_id, created_at desc);
create index crm_case_notes_follow_up_idx on public.crm_case_notes (follow_up_at) where follow_up_at is not null and follow_up_done_at is null;

alter table public.crm_case_notes enable row level security;
create policy crm_case_notes_select on public.crm_case_notes for select to authenticated using (public.has_permission('crm.view'));
revoke all privileges on public.crm_case_notes from public, anon, authenticated;
grant select on public.crm_case_notes to authenticated;

create or replace function public.add_crm_case_note(
  p_crm_case_id uuid,
  p_note text,
  p_follow_up_at date default null
)
returns public.crm_case_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  v_row public.crm_case_notes%rowtype;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('crm.update') then raise exception using errcode = '42501', message = 'CRM_UPDATE_PERMISSION_DENIED'; end if;
  if v_note is null or pg_catalog.length(v_note) > 2000 then raise exception using errcode = '22023', message = 'CRM_NOTE_REQUIRED'; end if;
  if not exists (select 1 from public.crm_cases where id = p_crm_case_id) then
    raise exception using errcode = 'P0002', message = 'CRM_CASE_NOT_FOUND';
  end if;
  insert into public.crm_case_notes (crm_case_id, note, follow_up_at, created_by)
  values (p_crm_case_id, v_note, p_follow_up_at, actor_id)
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.add_crm_case_note(uuid, text, date) from public, anon;
grant execute on function public.add_crm_case_note(uuid, text, date) to authenticated;

create or replace function public.complete_crm_follow_up(p_note_id uuid)
returns public.crm_case_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_row public.crm_case_notes%rowtype;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('crm.update') then raise exception using errcode = '42501', message = 'CRM_UPDATE_PERMISSION_DENIED'; end if;
  select * into v_row from public.crm_case_notes where id = p_note_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CRM_NOTE_NOT_FOUND'; end if;
  if v_row.follow_up_at is null then raise exception using errcode = '23514', message = 'CRM_NOTE_HAS_NO_FOLLOW_UP'; end if;
  if v_row.follow_up_done_at is not null then return v_row; end if;
  update public.crm_case_notes
  set follow_up_done_at = pg_catalog.now(), follow_up_done_by = actor_id
  where id = p_note_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.complete_crm_follow_up(uuid) from public, anon;
grant execute on function public.complete_crm_follow_up(uuid) to authenticated;

create or replace function public.get_crm_case_notes(p_crm_case_id uuid)
returns table (
  note_id uuid,
  note text,
  follow_up_at date,
  follow_up_done_at timestamptz,
  follow_up_done_by_name text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('crm.view') then raise exception using errcode = '42501', message = 'CRM_VIEW_PERMISSION_DENIED'; end if;
  return query
  select
    n.id, n.note, n.follow_up_at, n.follow_up_done_at,
    coalesce(nullif(pg_catalog.btrim(done_by.display_name), ''), done_by.email),
    n.created_by,
    coalesce(nullif(pg_catalog.btrim(author.display_name), ''), author.email),
    n.created_at
  from public.crm_case_notes as n
  left join public.profiles as author on author.id = n.created_by
  left join public.profiles as done_by on done_by.id = n.follow_up_done_by
  where n.crm_case_id = p_crm_case_id
  order by n.created_at desc, n.id desc;
end;
$$;

revoke all on function public.get_crm_case_notes(uuid) from public, anon;
grant execute on function public.get_crm_case_notes(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Kết quả học thử
-- ---------------------------------------------------------------------------

create or replace function public.record_crm_trial_result(
  p_booking_id uuid,
  p_result text,
  p_teacher_feedback text default null,
  p_sale_notes text default null
)
returns public.crm_trial_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_booking public.crm_trial_bookings%rowtype;
  v_case public.crm_cases%rowtype;
  v_feedback text := nullif(pg_catalog.btrim(coalesce(p_teacher_feedback, '')), '');
  v_notes text := nullif(pg_catalog.btrim(coalesce(p_sale_notes, '')), '');
  v_next_status text;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('crm.update') then raise exception using errcode = '42501', message = 'CRM_UPDATE_PERMISSION_DENIED'; end if;
  if p_result is null or p_result not in ('attended', 'no_show', 'cancelled') then
    raise exception using errcode = '22023', message = 'CRM_TRIAL_RESULT_INVALID';
  end if;
  if pg_catalog.length(coalesce(v_feedback, '')) > 2000 or pg_catalog.length(coalesce(v_notes, '')) > 2000 then
    raise exception using errcode = '22023', message = 'CRM_TRIAL_NOTE_TOO_LONG';
  end if;

  select * into v_booking from public.crm_trial_bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CRM_TRIAL_BOOKING_NOT_FOUND'; end if;
  if v_booking.status <> 'scheduled' then raise exception using errcode = '23514', message = 'CRM_TRIAL_RESULT_ALREADY_RECORDED'; end if;

  select * into v_case from public.crm_cases where id = v_booking.crm_case_id for update;
  if v_case.status = 'converted' then raise exception using errcode = '23514', message = 'CRM_CASE_ALREADY_CONVERTED'; end if;

  update public.crm_trial_bookings
  set status = p_result,
      teacher_feedback = coalesce(v_feedback, teacher_feedback),
      sale_notes = coalesce(v_notes, sale_notes),
      result_recorded_at = pg_catalog.now(),
      result_recorded_by = actor_id
  where id = p_booking_id
  returning * into v_booking;

  -- Đến học thử → Đã học thử. Vắng / hủy khi không còn lịch thử nào khác → về
  -- Đang quan tâm để sale đặt lại. Case đã đi xa hơn (chờ xác nhận, dừng) giữ nguyên.
  if p_result = 'attended' and v_case.status in ('interested', 'trial_booked') then
    v_next_status := 'trial_completed';
  elsif p_result in ('no_show', 'cancelled') and v_case.status = 'trial_booked'
    and not exists (select 1 from public.crm_trial_bookings where crm_case_id = v_case.id and status = 'scheduled') then
    v_next_status := 'interested';
  end if;

  if v_next_status is not null then
    update public.crm_cases set status = v_next_status, status_changed_at = pg_catalog.now() where id = v_case.id;
    if v_case.student_id is not null then
      update public.students set lifecycle_status = v_next_status
      where id = v_case.student_id and lifecycle_status in ('interested', 'trial_booked', 'trial_completed');
    end if;
  end if;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data)
  values (
    actor_id, 'crm', 'crm_trial_result_recorded', 'crm_trial_booking', p_booking_id::text,
    pg_catalog.jsonb_build_object('status', 'scheduled', 'case_status', v_case.status),
    pg_catalog.jsonb_build_object('status', p_result, 'case_status', coalesce(v_next_status, v_case.status), 'teacher_feedback', v_feedback)
  );

  return v_booking;
end;
$$;

revoke all on function public.record_crm_trial_result(uuid, text, text, text) from public, anon;
grant execute on function public.record_crm_trial_result(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Chuyển trạng thái case: chờ xác nhận (tạo hồ sơ tạm), dừng, mở lại
-- ---------------------------------------------------------------------------

create or replace function public.advance_crm_case_status(
  p_crm_case_id uuid,
  p_target_status text,
  p_reason text default null
)
returns public.crm_cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_case public.crm_cases%rowtype;
  v_result public.crm_cases%rowtype;
  v_student_id uuid;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('crm.update') then raise exception using errcode = '42501', message = 'CRM_UPDATE_PERMISSION_DENIED'; end if;
  if p_target_status is null or p_target_status not in ('pending_enrollment_confirmation', 'dropped', 'interested') then
    raise exception using errcode = '22023', message = 'CRM_TARGET_STATUS_INVALID';
  end if;
  if p_target_status in ('dropped', 'interested') and (v_reason is null or pg_catalog.length(v_reason) > 1000) then
    raise exception using errcode = '22023', message = 'CRM_STATUS_REASON_REQUIRED';
  end if;

  select * into v_case from public.crm_cases where id = p_crm_case_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CRM_CASE_NOT_FOUND'; end if;
  if v_case.status = 'converted' then raise exception using errcode = '23514', message = 'CRM_CASE_ALREADY_CONVERTED'; end if;
  if v_case.status = p_target_status then return v_case; end if;

  if p_target_status = 'pending_enrollment_confirmation' then
    if v_case.status not in ('interested', 'trial_booked', 'trial_completed') then
      raise exception using errcode = '23514', message = 'CRM_STATUS_TRANSITION_INVALID';
    end if;
    v_student_id := v_case.student_id;
    if v_student_id is null then
      -- Hồ sơ tạm để kế toán lập phiếu thu tuyển mới trước khi chuyển đổi.
      insert into public.students (
        full_name, nickname, birth_year, current_grade, province_city, learning_level, registered_mode,
        lifecycle_status, created_by
      )
      values (
        v_case.full_name, v_case.nickname, v_case.birth_year, v_case.expected_grade, v_case.province_city,
        case when v_case.expected_level in ('A', 'B', 'CLC') then v_case.expected_level end,
        case when v_case.expected_mode in ('online', 'offline') then v_case.expected_mode end,
        'pending_enrollment_confirmation', actor_id
      )
      returning id into v_student_id;
      if v_case.guardian_id is not null then
        insert into public.student_guardians (student_id, guardian_id, relationship, is_primary, linked_by)
        values (v_student_id, v_case.guardian_id, coalesce(v_case.guardian_relationship, 'Phụ huynh'), true, actor_id)
        on conflict do nothing;
      end if;
    else
      update public.students set lifecycle_status = 'pending_enrollment_confirmation'
      where id = v_student_id and lifecycle_status in ('interested', 'trial_booked', 'trial_completed');
    end if;
    update public.crm_cases
    set status = 'pending_enrollment_confirmation', student_id = v_student_id, status_changed_at = pg_catalog.now(),
        dropped_at = null, dropped_by = null, drop_reason = null
    where id = v_case.id
    returning * into v_result;

  elsif p_target_status = 'dropped' then
    update public.crm_cases
    set status = 'dropped', dropped_at = pg_catalog.now(), dropped_by = actor_id, drop_reason = v_reason,
        status_changed_at = pg_catalog.now()
    where id = v_case.id
    returning * into v_result;
    -- Lịch thử còn treo không còn ý nghĩa.
    update public.crm_trial_bookings set status = 'cancelled', result_recorded_at = pg_catalog.now(), result_recorded_by = actor_id
    where crm_case_id = v_case.id and status = 'scheduled';
    if v_case.student_id is not null then
      update public.students set lifecycle_status = 'interested'
      where id = v_case.student_id and lifecycle_status in ('interested', 'trial_booked', 'trial_completed', 'pending_enrollment_confirmation');
    end if;

  else -- interested (mở lại)
    if v_case.status <> 'dropped' then
      raise exception using errcode = '23514', message = 'CRM_STATUS_TRANSITION_INVALID';
    end if;
    update public.crm_cases
    set status = 'interested', dropped_at = null, dropped_by = null, drop_reason = null, status_changed_at = pg_catalog.now()
    where id = v_case.id
    returning * into v_result;
  end if;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
  values (
    actor_id, 'crm', 'crm_case_status_changed', 'crm_case', v_case.id::text,
    pg_catalog.jsonb_build_object('status', v_case.status, 'student_id', v_case.student_id),
    pg_catalog.jsonb_build_object('status', v_result.status, 'student_id', v_result.student_id),
    v_reason
  );

  return v_result;
end;
$$;

revoke all on function public.advance_crm_case_status(uuid, text, text) from public, anon;
grant execute on function public.advance_crm_case_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Chuyển đổi dùng lại hồ sơ tạm; mục 1 checklist dựa vào phiếu thu đã thu
-- ---------------------------------------------------------------------------

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
  has_paid_request boolean := false;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('students.confirm_official') then
    raise exception using errcode = '42501', message = 'STUDENTS_CONFIRM_OFFICIAL_PERMISSION_DENIED';
  end if;
  if p_registered_mode is null or p_registered_mode not in ('online', 'offline') then
    raise exception using errcode = '22023', message = 'REGISTERED_MODE_INVALID';
  end if;

  select * into target_case from public.crm_cases where id = p_crm_case_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CRM_CASE_NOT_FOUND'; end if;
  if target_case.status = 'converted' then raise exception using errcode = '23514', message = 'CRM_CASE_ALREADY_CONVERTED'; end if;
  if target_case.status = 'dropped' then raise exception using errcode = '23514', message = 'CRM_CASE_DROPPED'; end if;

  select * into checklist_row from public.student_enrollment_checklists where crm_case_id = p_crm_case_id for update;
  if not found then
    insert into public.student_enrollment_checklists (crm_case_id) values (p_crm_case_id) returning * into checklist_row;
  end if;

  can_confirm_accountant := public.has_permission('sepay.accountant_confirm');
  if target_case.student_id is not null then
    select exists (
      select 1 from public.student_payment_requests as request
      where request.student_id = target_case.student_id and request.status = 'paid'
    ) into has_paid_request;
  end if;

  update public.student_enrollment_checklists
  set
    item_1_payment_received = has_paid_request or coalesce((p_checklist_items->>'item_1_payment_received')::boolean, item_1_payment_received),
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
    checklist_row.item_1_payment_received and checklist_row.item_2_source_confirmed and checklist_row.item_3_sale_confirmed
    and checklist_row.item_4_class_selected and checklist_row.item_5_mode_confirmed and checklist_row.item_6_fee_confirmed
    and checklist_row.item_7_assistant_sessions_confirmed and checklist_row.item_8_accountant_transaction_confirmed
    and checklist_row.item_9_official_start_date_entered and checklist_row.item_10_communication_group_ready
  ) then
    raise exception using errcode = '23514', message = 'ENROLLMENT_CHECKLIST_INCOMPLETE';
  end if;

  if target_case.student_id is not null then
    update public.students
    set
      current_grade = target_case.expected_grade,
      learning_level = coalesce(case when target_case.expected_level in ('A', 'B', 'CLC') then target_case.expected_level end, learning_level),
      registered_mode = p_registered_mode,
      lifecycle_status = 'active',
      official_start_date = p_official_start_date
    where id = target_case.student_id
    returning * into student_row;
  else
    insert into public.students (
      full_name, nickname, birth_year, current_grade, province_city, learning_level, registered_mode,
      lifecycle_status, official_start_date, created_by
    )
    values (
      target_case.full_name, target_case.nickname, target_case.birth_year, target_case.expected_grade, target_case.province_city,
      case when target_case.expected_level in ('A', 'B', 'CLC') then target_case.expected_level end,
      p_registered_mode, 'active', p_official_start_date, actor_id
    )
    returning * into student_row;
  end if;

  if target_case.guardian_id is not null then
    insert into public.student_guardians (student_id, guardian_id, relationship, is_primary, linked_by)
    values (student_row.id, target_case.guardian_id, coalesce(target_case.guardian_relationship, 'Phụ huynh'), true, actor_id)
    on conflict do nothing;
  end if;

  insert into public.student_enrollments (
    student_id, class_id, status, effective_from, registered_mode, transition_kind, start_reason, started_by
  )
  values (
    student_row.id, p_class_id, 'active', p_official_start_date, p_registered_mode, 'initial',
    'Chuyển đổi thành công từ CRM Lead ' || target_case.public_code, actor_id
  );

  update public.crm_cases
  set status = 'converted', student_id = student_row.id, status_changed_at = pg_catalog.now()
  where id = p_crm_case_id;

  update public.student_enrollment_checklists
  set student_id = student_row.id, is_fully_completed = true, completed_at = pg_catalog.now(), completed_by = actor_id
  where id = checklist_row.id;

  return student_row;
end;
$$;

-- Phiếu thu ghi nhận case CRM của học sinh (nếu có) để đối chiếu tuyển mới.
create or replace function public.create_student_payment_request(
  p_student_id uuid,
  p_expected_amount_vnd bigint,
  p_purchased_sessions integer,
  p_bonus_sessions integer default 0,
  p_calculated_unit_price_vnd bigint default 0,
  p_topup_type text default 'new',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_student public.students%rowtype;
  v_guardian_id uuid;
  v_public_code text;
  v_transfer_code text;
  v_request_id uuid;
  v_unit_price bigint;
  v_crm_case_id uuid;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then raise exception 'AUTHENTICATION_REQUIRED: Vui long dang nhap.'; end if;
  if not (public.has_permission('payments.create_request') or public.has_permission('payments.manage')) then
    raise exception 'PAYMENTS_CREATE_REQUEST_PERMISSION_DENIED: Khong co quyen tao yeu cau nap tien.';
  end if;
  if p_student_id is null then raise exception 'STUDENT_ID_REQUIRED: Thieu ma hoc vien.'; end if;
  select * into v_student from public.students where id = p_student_id;
  if not found then raise exception 'STUDENT_NOT_FOUND: Hoc vien khong ton tai.'; end if;
  select link.guardian_id into v_guardian_id
  from public.student_guardians as link
  where link.student_id = p_student_id and link.is_primary and link.ended_at is null;
  if v_guardian_id is null then raise exception 'STUDENT_PRIMARY_GUARDIAN_NOT_FOUND: Hoc vien chua co phu huynh chinh dang hoat dong.'; end if;
  if p_expected_amount_vnd is null or p_expected_amount_vnd <= 0 then raise exception 'INVALID_EXPECTED_AMOUNT: So tien du kien nap phai lon hon 0.'; end if;
  if p_purchased_sessions is null or p_purchased_sessions <= 0 then raise exception 'INVALID_PURCHASED_SESSIONS: So buoi mua phai lon hon 0.'; end if;
  if coalesce(p_bonus_sessions, 0) < 0 then raise exception 'INVALID_BONUS_SESSIONS: So buoi tang khong duoc am.'; end if;
  if coalesce(p_topup_type, 'new') not in ('new', 'renewal') then raise exception 'INVALID_TOPUP_TYPE: Loai nap khong hop le.'; end if;
  -- JavaScript's existing positive Math.round(amount / sessions) behavior is
  -- reproduced with PostgreSQL numeric rounding. The legacy caller argument is
  -- deliberately ignored.
  v_unit_price := pg_catalog.round(p_expected_amount_vnd::numeric / p_purchased_sessions::numeric)::bigint;
  if v_unit_price <= 0 then raise exception 'INVALID_UNIT_PRICE: Don gia phai lon hon 0.'; end if;
  select crm_case.id into v_crm_case_id from public.crm_cases as crm_case where crm_case.student_id = p_student_id;
  v_public_code := 'PAY-' || pg_catalog.to_char(pg_catalog.now(), 'YYMMDD') || '-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::text), 1, 12));
  v_transfer_code := public.format_student_payment_transfer_code(p_student_id, v_guardian_id, v_public_code);
  insert into public.student_payment_requests (
    public_code, student_id, guardian_id, crm_case_id, expected_amount_vnd, purchased_sessions, bonus_sessions,
    calculated_unit_price_vnd, topup_type, transfer_code, notes, created_by
  )
  values (
    v_public_code, p_student_id, v_guardian_id, v_crm_case_id, p_expected_amount_vnd, p_purchased_sessions,
    coalesce(p_bonus_sessions, 0), v_unit_price, coalesce(p_topup_type, 'new'), v_transfer_code, p_notes, v_actor_id
  )
  returning id into v_request_id;
  return pg_catalog.jsonb_build_object(
    'id', v_request_id, 'public_code', v_public_code, 'transfer_code', v_transfer_code,
    'expected_amount_vnd', p_expected_amount_vnd, 'purchased_sessions', p_purchased_sessions,
    'bonus_sessions', coalesce(p_bonus_sessions, 0), 'status', 'pending'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Thông báo: được giao lead; hẹn theo dõi đến hạn
-- ---------------------------------------------------------------------------

create or replace function public.notify_crm_lead_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.crm_cases%rowtype;
begin
  if new.new_sale_owner_id is null or new.new_sale_owner_id = new.assigned_by then
    return new;
  end if;
  select * into v_case from public.crm_cases where id = new.crm_case_id;
  insert into public.notifications (
    recipient_user_id, actor_user_id, event_code, title, message, href, entity_type, entity_id, dedupe_key, metadata
  )
  values (
    new.new_sale_owner_id,
    new.assigned_by,
    'crm.lead_assigned',
    'Bạn được giao lead mới',
    'Lead ' || coalesce(v_case.public_code, '') || ' · ' || coalesce(v_case.full_name, '') || ' (khối ' || coalesce(v_case.expected_grade::text, '?') || ') vừa được giao cho bạn. Liên hệ phụ huynh và ghi chú lịch theo dõi.',
    '/crm/' || new.crm_case_id::text,
    'crm_case',
    new.crm_case_id::text,
    'crm.lead_assigned:' || new.id::text,
    pg_catalog.jsonb_build_object('source', 'crm_lead_assignment', 'assignment_method', new.assignment_method)
  )
  on conflict (recipient_user_id, dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function public.notify_crm_lead_assigned() from public, anon, authenticated;

create trigger crm_lead_assignment_history_notify
after insert on public.crm_lead_assignment_history
for each row execute function public.notify_crm_lead_assigned();

create or replace function public.run_crm_follow_up_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_count integer;
begin
  insert into public.notifications (
    recipient_user_id, actor_user_id, event_code, title, message, href, entity_type, entity_id, dedupe_key, metadata
  )
  select
    recipient.user_id,
    null,
    'crm.follow_up_due',
    case when n.follow_up_at < v_today then 'Hẹn theo dõi lead đã quá hạn' else 'Hôm nay có hẹn theo dõi lead' end,
    'Lead ' || c.public_code || ' · ' || c.full_name || ': ' || pg_catalog.left(n.note, 160)
      || case when n.follow_up_at < v_today then ' (hẹn ngày ' || pg_catalog.to_char(n.follow_up_at, 'DD/MM') || ')' else '' end,
    '/crm/' || c.id::text,
    'crm_case',
    c.id::text,
    'crm.follow_up_due:' || n.id::text || ':' || pg_catalog.to_char(v_today, 'YYYY-MM-DD'),
    pg_catalog.jsonb_build_object('source', 'crm_follow_up_reminder', 'note_id', n.id, 'follow_up_at', n.follow_up_at)
  from public.crm_case_notes as n
  join public.crm_cases as c on c.id = n.crm_case_id
  cross join lateral (
    select distinct user_id
    from (values (c.sale_owner_id), (n.created_by)) as candidate(user_id)
    where user_id is not null
  ) as recipient
  join public.profiles as p on p.id = recipient.user_id and p.employment_status = 'active'
  where n.follow_up_at is not null
    and n.follow_up_done_at is null
    and n.follow_up_at <= v_today
    and c.status not in ('converted', 'dropped')
  on conflict (recipient_user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.run_crm_follow_up_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'crm-follow-up-reminders';
    -- 01:00 UTC = 08:00 giờ Việt Nam.
    perform cron.schedule('crm-follow-up-reminders', '0 1 * * *', 'select public.run_crm_follow_up_reminders();');
  else
    raise warning 'CRM_FOLLOW_UP_CRON_UNAVAILABLE: install pg_cron and register crm-follow-up-reminders';
  end if;
end;
$$;

comment on table public.crm_case_notes is 'Ghi chú làm việc với lead và hẹn theo dõi; worker crm-follow-up-reminders nhắc sale phụ trách mỗi sáng.';
comment on function public.advance_crm_case_status(uuid, text, text) is 'Chuyển case CRM sang Chờ xác nhận nhập học (tạo hồ sơ học sinh tạm để lập phiếu thu), Dừng (kèm lý do) hoặc Mở lại.';
comment on function public.record_crm_trial_result(uuid, text, text, text) is 'Ghi kết quả buổi học thử (đến / vắng / hủy) và cập nhật trạng thái case tương ứng.';

commit;
