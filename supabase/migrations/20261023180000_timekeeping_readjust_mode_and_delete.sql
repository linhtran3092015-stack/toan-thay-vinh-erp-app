-- Chấm công: điều chỉnh lại nhiều lần, đổi hình thức, xoá lượt công.
--
-- 1. Điều chỉnh lại: unique index "mỗi lượt công một bản ghi approved" khiến
--    lần sửa giờ thứ hai (và mọi lần sửa công bù tạo tay, vốn đã có sẵn bản
--    approved) lỗi. Thêm trạng thái `superseded`: trước khi một điều chỉnh mới
--    được duyệt (sửa trực tiếp hoặc duyệt yêu cầu của nhân sự), bản approved
--    cũ chuyển sang superseded. Bất biến "≤ 1 approved / lượt công" giữ nguyên
--    nên mọi read model và engine lương đọc `status = 'approved'` không đổi.
--    Chủ trung tâm sửa trực tiếp thì yêu cầu đang chờ của lượt công đó tự
--    chuyển rejected, để một yêu cầu cũ không thể được duyệt đè lên bản sửa mới
--    (nhân sự vẫn không gửi được yêu cầu mới cho ca đã có điều chỉnh duyệt, nên
--    nhánh supersede khi duyệt yêu cầu chỉ là lưới an toàn). Bản approved do chủ
--    trung tâm ghi trực tiếp được audit là time_entry_adjustment_direct với
--    người thực hiện là chủ trung tâm, không phải nhân sự.
-- 2. Hình thức: admin_adjust_time_entry nhận thêm p_mode (online/offline).
--    null = theo hình thức lúc chấm công (time_entries.check_in_mode), như chủ
--    trung tâm đã chốt. Giờ nhập theo phút: nếu giờ gửi lên trùng phút với giờ
--    đang có hiệu lực thì giữ nguyên giá trị cũ (có giây), để lưu không đổi gì
--    vẫn báo TIME_ENTRY_ADJUSTMENT_NO_CHANGE và sửa riêng hình thức không làm
--    tròn giờ. Giờ vào phải thuộc ngày làm việc, giờ ra không quá ngày hôm sau
--    và không ở tương lai. Trước đây RPC luôn ghi requested_*_mode = 'offline',
--    làm ca trực tuyến bị sửa giờ bị engine lương tính như ca tại trung tâm
--    (11 ca tháng 9/2026 trên prod; migration này không sửa dữ liệu cũ, ca nào
--    được sửa lại sẽ tự về đúng hình thức lúc chấm công).
-- 3. Xoá: admin_delete_time_entry xoá hẳn lượt công cùng bằng chứng, yêu cầu
--    điều chỉnh và review ngoại lệ của nó; audit giữ snapshot (bằng chứng chỉ
--    giữ loại/thời điểm; toạ độ/Wi-Fi và vị trí cuối của ca không vào audit).
--    Từ chối ca đang mở, ca đã nằm trong bảng lương tính bằng engine cũ
--    (payroll_line_items FK) và ca mà khi xoá sẽ làm công import Excel của
--    ngày đó được tính lại (khoá tư vấn theo nhân sự + ngày để hai lượt xoá
--    song song không cùng lọt). Các trigger chặn xoá chỉ mở khi RPC bật GUC
--    app.allow_time_entry_delete.
-- 4. Khoá theo kỳ lương (mục 1, hàm assert_time_entry_month_unlocked): khi kỳ
--    lương của tháng đã rời trạng thái nháp (review/approved), xoá, sửa trực
--    tiếp, duyệt yêu cầu, thêm công bù và duyệt ngoại lệ chấm công đều bị từ
--    chối (TIME_ENTRY_LOCKED_BY_PAYROLL); chỉ kỳ nháp mới tính lại được.
-- 5. Duyệt yêu cầu (mục 1) khoá dòng time_entries trước, cùng thứ tự khoá với
--    sửa trực tiếp và xoá, và báo bảng lương tạm tính cập nhật.

begin;

set local lock_timeout = '5s';

-- =========================================================
-- 1. SUPERSEDED ADJUSTMENTS, KHOÁ KỲ LƯƠNG, DUYỆT YÊU CẦU
-- =========================================================

alter table public.time_entry_adjustment_requests
  drop constraint time_entry_adjustment_status_check,
  add constraint time_entry_adjustment_status_check
    check (status in ('pending', 'approved', 'rejected', 'superseded'));

alter table public.time_entry_adjustment_requests
  drop constraint time_entry_adjustment_decision_lifecycle_check,
  add constraint time_entry_adjustment_decision_lifecycle_check
    check (
      (
        status = 'pending'
        and reviewed_by is null
        and reviewed_at is null
        and decision_reason is null
      )
      or
      (
        status in ('approved', 'superseded')
        and reviewed_by is not null
        and reviewed_at is not null
        and (
          decision_reason is null
          or (
            decision_reason = pg_catalog.btrim(decision_reason)
            and decision_reason <> ''
            and pg_catalog.length(decision_reason) <= 2000
          )
        )
      )
      or
      (
        status = 'rejected'
        and reviewed_by is not null
        and reviewed_at is not null
        and decision_reason is not null
        and decision_reason = pg_catalog.btrim(decision_reason)
        and decision_reason <> ''
        and pg_catalog.length(decision_reason) <= 2000
      )
    );

create or replace function public.protect_time_entry_adjustment_request_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Một điều chỉnh mới thay thế bản đã duyệt: chỉ được đổi trạng thái.
  if old.status = 'approved' and new.status = 'superseded' then
    if new.id is distinct from old.id
      or new.time_entry_id is distinct from old.time_entry_id
      or new.requester_id is distinct from old.requester_id
      or new.original_check_in_at is distinct from old.original_check_in_at
      or new.original_check_in_mode is distinct from old.original_check_in_mode
      or new.original_check_out_at is distinct from old.original_check_out_at
      or new.original_check_out_mode is distinct from old.original_check_out_mode
      or new.requested_check_in_at is distinct from old.requested_check_in_at
      or new.requested_check_in_mode is distinct from old.requested_check_in_mode
      or new.requested_check_out_at is distinct from old.requested_check_out_at
      or new.requested_check_out_mode is distinct from old.requested_check_out_mode
      or new.request_reason is distinct from old.request_reason
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.decision_reason is distinct from old.decision_reason
      or new.created_at is distinct from old.created_at
    then
      raise exception using
        errcode = '23514',
        message = 'TIME_ENTRY_ADJUSTMENT_HISTORY_IS_IMMUTABLE';
    end if;

    return new;
  end if;

  if old.status <> 'pending' then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_ADJUSTMENT_DECISION_IS_FINAL';
  end if;

  if new.id is distinct from old.id
    or new.time_entry_id is distinct from old.time_entry_id
    or new.requester_id is distinct from old.requester_id
    or new.original_check_in_at is distinct from old.original_check_in_at
    or new.original_check_in_mode is distinct from old.original_check_in_mode
    or new.original_check_out_at is distinct from old.original_check_out_at
    or new.original_check_out_mode is distinct from old.original_check_out_mode
    or new.requested_check_in_at is distinct from old.requested_check_in_at
    or new.requested_check_in_mode is distinct from old.requested_check_in_mode
    or new.requested_check_out_at is distinct from old.requested_check_out_at
    or new.requested_check_out_mode is distinct from old.requested_check_out_mode
    or new.request_reason is distinct from old.request_reason
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_ADJUSTMENT_HISTORY_IS_IMMUTABLE';
  end if;

  if new.status not in ('approved', 'rejected') then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_ADJUSTMENT_MUST_BE_DECIDED_BY_WORKFLOW';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_time_entry_adjustment_request_history()
from public, anon, authenticated;

create or replace function public.audit_time_entry_adjustment_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  audit_action text;
  audit_reason text;
begin
  if tg_op = 'INSERT' and new.status = 'approved' then
    -- Chủ trung tâm ghi trực tiếp (sửa giờ, công bù): người thực hiện là người duyệt.
    actor_id := new.reviewed_by;
    audit_action := 'time_entry_adjustment_direct';
    audit_reason := new.request_reason;
  elsif tg_op = 'INSERT' then
    actor_id := new.requester_id;
    audit_action := 'time_entry_adjustment_requested';
    audit_reason := new.request_reason;
  elsif new.status = 'approved' then
    actor_id := new.reviewed_by;
    audit_action := 'time_entry_adjustment_approved';
    audit_reason := new.decision_reason;
  elsif new.status = 'rejected' then
    actor_id := new.reviewed_by;
    audit_action := 'time_entry_adjustment_rejected';
    audit_reason := new.decision_reason;
  elsif new.status = 'superseded' then
    actor_id := auth.uid();
    audit_action := 'time_entry_adjustment_superseded';
    audit_reason := null;
  else
    raise exception using
      errcode = 'P0001',
      message = 'UNSUPPORTED_TIME_ENTRY_ADJUSTMENT_AUDIT_EVENT';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    metadata
  )
  values (
    actor_id,
    'timekeeping',
    audit_action,
    'time_entry_adjustment_request',
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    audit_reason,
    pg_catalog.jsonb_build_object(
      'source',
      'timekeeping_adjustment_workflow',
      'time_entry_id',
      new.time_entry_id
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_time_entry_adjustment_request_change()
from public, anon, authenticated;

-- Gọi ngay trước khi một điều chỉnh mới thành approved (unique index chỉ cho
-- một bản approved mỗi lượt công).
create or replace function public.supersede_time_entry_adjustment(p_time_entry_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.time_entry_adjustment_requests
  set status = 'superseded', updated_at = pg_catalog.now()
  where time_entry_id = p_time_entry_id
    and status = 'approved';
$$;

revoke all on function public.supersede_time_entry_adjustment(uuid)
from public, anon, authenticated;

-- Chỉ kỳ lương nháp mới tính lại được: tháng có kỳ đã rời nháp thì công đã khoá.
create or replace function public.assert_time_entry_month_unlocked(p_work_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_status text;
begin
  -- for share: kỳ lương không thể chuyển trạng thái giữa chừng thao tác này.
  select period.status
  into period_status
  from public.payroll_periods as period
  where period.period_month = pg_catalog.date_trunc('month', p_work_date)::date
  for share;

  if found and period_status <> 'draft' then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_LOCKED_BY_PAYROLL',
      detail = pg_catalog.to_char(p_work_date, 'YYYY-MM');
  end if;
end;
$$;

revoke all on function public.assert_time_entry_month_unlocked(date)
from public, anon, authenticated;

create or replace function public.decide_time_entry_adjustment(
  p_time_entry_adjustment_request_id uuid,
  p_decision text,
  p_decision_reason text
)
returns public.time_entry_adjustment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(p_decision));
  normalized_reason text := nullif(pg_catalog.btrim(p_decision_reason), '');
  target_entry_id uuid;
  target_entry public.time_entries%rowtype;
  target_request public.time_entry_adjustment_requests%rowtype;
  result_request public.time_entry_adjustment_requests%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.approve_adjustment') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED';
  end if;

  if p_time_entry_adjustment_request_id is null then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_REQUEST_ID_REQUIRED';
  end if;

  if normalized_decision not in ('approved', 'rejected') then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_DECISION_INVALID';
  end if;

  if normalized_reason is not null and pg_catalog.length(normalized_reason) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_DECISION_REASON_TOO_LONG';
  end if;

  if normalized_decision = 'rejected' and normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'TIME_ENTRY_ADJUSTMENT_REJECTION_REASON_REQUIRED';
  end if;

  -- Khoá lượt công trước rồi mới khoá yêu cầu: cùng thứ tự với sửa trực tiếp
  -- và xoá, nên ba thao tác chạy nối tiếp thay vì kẹt khoá lẫn nhau.
  -- time_entry_id bất biến nên đọc trước khi khoá là an toàn.
  select request.time_entry_id
  into target_entry_id
  from public.time_entry_adjustment_requests as request
  where request.id = p_time_entry_adjustment_request_id;

  select entry.*
  into target_entry
  from public.time_entries as entry
  where entry.id = target_entry_id
  for update;

  select request.*
  into target_request
  from public.time_entry_adjustment_requests as request
  where request.id = p_time_entry_adjustment_request_id
  for update;

  if target_entry.id is null or target_request.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'TIME_ENTRY_ADJUSTMENT_REQUEST_NOT_FOUND';
  end if;

  if target_request.requester_id = actor_id then
    raise exception using
      errcode = '42501',
      message = 'TIME_ENTRY_ADJUSTMENT_SELF_APPROVAL_FORBIDDEN';
  end if;

  if target_request.status <> 'pending' then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_ADJUSTMENT_REQUEST_ALREADY_DECIDED';
  end if;

  if normalized_decision = 'approved' then
    perform public.assert_time_entry_month_unlocked(target_entry.work_date);
    perform public.supersede_time_entry_adjustment(target_entry.id);
  end if;

  update public.time_entry_adjustment_requests
  set
    status = normalized_decision,
    reviewed_by = actor_id,
    reviewed_at = pg_catalog.now(),
    decision_reason = normalized_reason,
    updated_at = pg_catalog.now()
  where id = target_request.id
  returning * into result_request;

  -- Duyệt đổi giờ/hình thức bảng lương đọc; time_entries không đổi nên trigger
  -- của nó không báo, phải báo bảng lương tạm tính ở đây.
  if normalized_decision = 'approved' then
    perform public.bump_payroll_live_revision(target_entry.work_date, 'owner', null);
    perform public.bump_payroll_live_revision(target_entry.work_date, 'staff', target_entry.staff_id);
  end if;

  return result_request;
end;
$$;

revoke all on function public.decide_time_entry_adjustment(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.decide_time_entry_adjustment(uuid, text, text)
to authenticated;


-- =========================================================
-- 2. ADMIN ADJUST: RE-ADJUST + MODE
-- =========================================================

drop function if exists public.admin_adjust_time_entry(uuid, timestamptz, timestamptz, text);

create or replace function public.admin_adjust_time_entry(
  p_time_entry_id uuid,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
  p_reason text,
  p_mode text default null
)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_entry public.time_entries%rowtype;
  current_adjustment public.time_entry_adjustment_requests%rowtype;
  result_entry public.time_entries%rowtype;
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  requested_mode text := nullif(pg_catalog.lower(pg_catalog.btrim(p_mode)), '');
  effective_check_in_at timestamptz;
  effective_check_out_at timestamptz;
  effective_check_in_mode text;
  effective_check_out_mode text;
  new_mode text;
  new_check_in_at timestamptz;
  new_check_out_at timestamptz;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.manage') and not public.has_permission('timekeeping.approve_adjustment') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_time_entry_id is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_ID_REQUIRED';
  end if;

  if p_check_in_at is null or p_check_out_at is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_CHECK_IN_AND_OUT_REQUIRED';
  end if;

  if p_check_out_at < p_check_in_at then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_CHECK_OUT_MUST_BE_AFTER_CHECK_IN';
  end if;

  if normalized_reason is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_ADJUSTMENT_REASON_REQUIRED';
  end if;

  if requested_mode is not null and requested_mode not in ('online', 'offline') then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_MODE_INVALID';
  end if;

  select entry.* into target_entry
  from public.time_entries as entry
  where entry.id = p_time_entry_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TIME_ENTRY_NOT_FOUND';
  end if;

  perform public.assert_time_entry_month_unlocked(target_entry.work_date);

  select request.* into current_adjustment
  from public.time_entry_adjustment_requests as request
  where request.time_entry_id = target_entry.id
    and request.status = 'approved'
  for update;

  -- Giá trị đang có hiệu lực (bản approved nếu có) là "gốc" của lần sửa này.
  effective_check_in_at := coalesce(current_adjustment.requested_check_in_at, target_entry.check_in_at);
  effective_check_out_at := coalesce(current_adjustment.requested_check_out_at, target_entry.check_out_at);
  effective_check_in_mode := coalesce(current_adjustment.requested_check_in_mode, target_entry.check_in_mode);
  effective_check_out_mode := coalesce(current_adjustment.requested_check_out_mode, target_entry.check_out_mode);
  -- Không chọn hình thức thì theo hình thức lúc chấm công, không theo bản
  -- approved: bản approved cũ của RPC trước có thể đã ghi sai 'offline'.
  new_mode := coalesce(requested_mode, target_entry.check_in_mode);

  -- Ô nhập chỉ có phút: cùng phút với giờ đang có hiệu lực thì giữ giá trị cũ.
  new_check_in_at := case
    when pg_catalog.date_trunc('minute', effective_check_in_at) = pg_catalog.date_trunc('minute', p_check_in_at)
      then effective_check_in_at
    else p_check_in_at
  end;
  new_check_out_at := case
    when effective_check_out_at is not null
      and pg_catalog.date_trunc('minute', effective_check_out_at) = pg_catalog.date_trunc('minute', p_check_out_at)
      then effective_check_out_at
    else p_check_out_at
  end;
  if new_check_out_at < new_check_in_at then
    new_check_in_at := p_check_in_at;
    new_check_out_at := p_check_out_at;
  end if;

  if new_check_in_at > pg_catalog.now() or new_check_out_at > pg_catalog.now() then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_ADJUSTMENT_CANNOT_USE_FUTURE_TIME';
  end if;

  if (new_check_in_at at time zone 'Asia/Ho_Chi_Minh')::date <> target_entry.work_date
    or (new_check_out_at at time zone 'Asia/Ho_Chi_Minh')::date > target_entry.work_date + 1
  then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_ADJUSTMENT_WORK_DATE_INVALID';
  end if;

  if target_entry.status = 'checked_out'
    and effective_check_in_at = new_check_in_at
    and effective_check_out_at = new_check_out_at
    and effective_check_in_mode = new_mode
  then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_ADJUSTMENT_NO_CHANGE';
  end if;

  update public.time_entries
  set
    check_in_at = new_check_in_at,
    check_in_mode = new_mode,
    check_out_at = new_check_out_at,
    status = 'checked_out',
    check_out_mode = new_mode,
    clock_out_reason = 'manual',
    auto_ended_at = null,
    updated_at = pg_catalog.now()
  where id = target_entry.id
  returning * into result_entry;

  perform public.supersede_time_entry_adjustment(target_entry.id);

  -- Yêu cầu nhân sự gửi trước bản sửa này đã lỗi thời: đóng lại để không thể
  -- được duyệt đè lên giờ chủ trung tâm vừa xác nhận.
  update public.time_entry_adjustment_requests
  set
    status = 'rejected',
    reviewed_by = actor_id,
    reviewed_at = pg_catalog.now(),
    decision_reason = 'Chủ trung tâm đã điều chỉnh trực tiếp lượt chấm công này.',
    updated_at = pg_catalog.now()
  where time_entry_id = target_entry.id
    and status = 'pending';

  -- Bản approved mới giữ payroll và audit đồng bộ với giờ vừa sửa.
  insert into public.time_entry_adjustment_requests (
    time_entry_id,
    requester_id,
    original_check_in_at,
    original_check_in_mode,
    original_check_out_at,
    original_check_out_mode,
    requested_check_in_at,
    requested_check_in_mode,
    requested_check_out_at,
    requested_check_out_mode,
    request_reason,
    status,
    reviewed_by,
    reviewed_at,
    decision_reason
  ) values (
    target_entry.id,
    target_entry.staff_id,
    effective_check_in_at,
    effective_check_in_mode,
    coalesce(effective_check_out_at, effective_check_in_at),
    coalesce(effective_check_out_mode, 'offline'),
    new_check_in_at,
    new_mode,
    new_check_out_at,
    new_mode,
    normalized_reason,
    'approved',
    actor_id,
    pg_catalog.now(),
    'Chủ trung tâm điều chỉnh trực tiếp: ' || normalized_reason
  );

  return result_entry;
end;
$$;

revoke all on function public.admin_adjust_time_entry(uuid, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.admin_adjust_time_entry(uuid, timestamptz, timestamptz, text, text) to authenticated;


-- =========================================================
-- 3. ADMIN DELETE
-- =========================================================

create or replace function public.prevent_time_entry_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.allow_time_entry_delete', true) = 'true' then
    return old;
  end if;

  raise exception using
    errcode = '23514',
    message = 'TIME_ENTRIES_CANNOT_BE_DELETED';
end;
$$;

revoke all on function public.prevent_time_entry_delete()
from public, anon, authenticated;

create or replace function public.prevent_time_entry_adjustment_request_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.allow_time_entry_delete', true) = 'true' then
    return old;
  end if;

  raise exception using
    errcode = '23514',
    message = 'TIME_ENTRY_ADJUSTMENT_REQUESTS_CANNOT_BE_DELETED';
end;
$$;

revoke all on function public.prevent_time_entry_adjustment_request_delete()
from public, anon, authenticated;

create or replace function public.prevent_time_entry_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('app.allow_time_entry_delete', true) = 'true'
  then
    return old;
  end if;

  raise exception using
    errcode = '23514',
    message = 'TIME_ENTRY_EVIDENCE_IS_IMMUTABLE';
end;
$$;

revoke all on function public.prevent_time_entry_evidence_mutation()
from public, anon, authenticated;

create or replace function public.admin_delete_time_entry(
  p_time_entry_id uuid,
  p_reason text
)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_entry public.time_entries%rowtype;
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_adjustments jsonb;
  v_evidence jsonb;
  v_exception_review jsonb;
  v_exception_submissions jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.approve_adjustment') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED';
  end if;

  if p_time_entry_id is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_ID_REQUIRED';
  end if;

  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_DELETE_REASON_REQUIRED';
  end if;

  select entry.* into target_entry
  from public.time_entries as entry
  where entry.id = p_time_entry_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TIME_ENTRY_NOT_FOUND';
  end if;

  if target_entry.status = 'open' then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_OPEN_CANNOT_BE_DELETED';
  end if;

  perform public.assert_time_entry_month_unlocked(target_entry.work_date);

  -- Engine lương cũ trỏ dòng lương vào lượt công bằng FK restrict; các dòng
  -- đó bất biến nên mở lại kỳ lương cũng không gỡ được.
  if exists (
    select 1
    from public.payroll_line_items as line
    where line.source_time_entry_id = target_entry.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_REFERENCED_BY_PAYROLL_HISTORY';
  end if;

  -- Bảng lương chỉ bỏ qua công import Excel của một ngày khi ngày đó còn lượt
  -- công hệ thống đã đóng; xoá lượt cuối cùng sẽ làm công import được tính lại.
  -- Khoá theo nhân sự + ngày: hai lượt xoá song song của cùng ngày không thể
  -- cùng thấy lượt kia còn lại.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(
    'time_entry_day:' || target_entry.staff_id::text || ':' || target_entry.work_date::text
  ));

  if exists (
    select 1
    from public.payroll_source_facts as fact
    where fact.fact_type = 'timekeeping'
      and fact.staff_id = target_entry.staff_id
      and fact.event_date = target_entry.work_date
  ) and not exists (
    select 1
    from public.time_entries as other_entry
    where other_entry.staff_id = target_entry.staff_id
      and other_entry.work_date = target_entry.work_date
      and other_entry.id <> target_entry.id
      and other_entry.status in ('checked_out', 'auto_ended')
      and other_entry.check_out_at is not null
  ) then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_DELETE_WOULD_RESTORE_IMPORTED_TIMEKEEPING';
  end if;

  -- Snapshot của bản ghi xoá. Bằng chứng chỉ giữ loại/thời điểm; toạ độ, Wi-Fi
  -- và vị trí cuối của ca được tách riêng có chủ đích, không đưa vào snapshot.
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(request) order by request.created_at), '[]'::jsonb)
  into v_adjustments
  from public.time_entry_adjustment_requests as request
  where request.time_entry_id = target_entry.id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', evidence.id,
    'event_type', evidence.event_type,
    'evidence_type', evidence.evidence_type,
    'captured_at', evidence.captured_at
  ) order by evidence.captured_at), '[]'::jsonb)
  into v_evidence
  from public.time_entry_evidence as evidence
  where evidence.time_entry_id = target_entry.id;

  select pg_catalog.to_jsonb(review)
  into v_exception_review
  from public.attendance_exception_reviews as review
  where review.time_entry_id = target_entry.id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(submission)), '[]'::jsonb)
  into v_exception_submissions
  from public.attendance_exception_submissions as submission
  where submission.time_entry_id = target_entry.id;

  perform pg_catalog.set_config('app.allow_time_entry_delete', 'true', true);

  delete from public.attendance_exception_submissions where time_entry_id = target_entry.id;
  delete from public.attendance_exception_reviews where time_entry_id = target_entry.id;
  delete from public.time_entry_evidence where time_entry_id = target_entry.id;
  delete from public.time_entry_adjustment_requests where time_entry_id = target_entry.id;
  delete from public.time_entries where id = target_entry.id;

  perform pg_catalog.set_config('app.allow_time_entry_delete', 'false', true);

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    metadata
  ) values (
    actor_id,
    'timekeeping',
    'time_entry_deleted',
    'time_entry',
    target_entry.id::text,
    pg_catalog.jsonb_build_object(
      'time_entry', pg_catalog.to_jsonb(target_entry)
        - 'last_latitude' - 'last_longitude' - 'last_location_accuracy',
      'adjustment_requests', v_adjustments,
      'evidence', v_evidence,
      'attendance_exception_review', v_exception_review,
      'attendance_exception_submissions', v_exception_submissions
    ),
    null,
    normalized_reason,
    pg_catalog.jsonb_build_object(
      'source', 'timekeeping_admin_delete',
      'staff_id', target_entry.staff_id,
      'work_date', target_entry.work_date
    )
  );

  return target_entry;
end;
$$;

revoke all on function public.admin_delete_time_entry(uuid, text) from public, anon;
grant execute on function public.admin_delete_time_entry(uuid, text) to authenticated;


-- =========================================================
-- 4. KHOÁ KỲ LƯƠNG CHO CÔNG BÙ VÀ DUYỆT NGOẠI LỆ
-- Định nghĩa đang chạy (20260908070000, 20260915170000), chỉ thêm
-- assert_time_entry_month_unlocked.
-- =========================================================

create or replace function public.admin_create_time_entry(
  p_staff_id uuid,
  p_work_date date,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
  p_mode text,
  p_notes text
)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_profile public.profiles%rowtype;
  normalized_mode text := coalesce(nullif(pg_catalog.lower(pg_catalog.btrim(p_mode)), ''), 'offline');
  normalized_notes text := nullif(pg_catalog.btrim(p_notes), '');
  new_entry public.time_entries%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.manage') and not public.has_permission('timekeeping.approve_adjustment') and not public.has_permission('staff.manage') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED';
  end if;

  if p_staff_id is null then
    raise exception using errcode = '22023', message = 'STAFF_ID_REQUIRED';
  end if;

  if p_work_date is null then
    raise exception using errcode = '22023', message = 'WORK_DATE_REQUIRED';
  end if;

  if p_check_in_at is null or p_check_out_at is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_CHECK_IN_AND_OUT_REQUIRED';
  end if;

  if p_check_out_at < p_check_in_at then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_CHECK_OUT_MUST_BE_AFTER_CHECK_IN';
  end if;

  select profile.* into target_profile
  from public.profiles as profile
  where profile.id = p_staff_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'STAFF_PROFILE_NOT_FOUND';
  end if;

  perform public.assert_time_entry_month_unlocked(p_work_date);

  insert into public.time_entries (
    staff_id,
    staff_shift_assignment_id,
    work_date,
    check_in_at,
    check_in_mode,
    check_out_at,
    check_out_mode,
    status,
    clock_out_reason
  ) values (
    p_staff_id,
    null,
    p_work_date,
    p_check_in_at,
    normalized_mode,
    p_check_out_at,
    normalized_mode,
    'checked_out',
    'manual'
  ) returning * into new_entry;

  insert into public.time_entry_adjustment_requests (
    time_entry_id,
    requester_id,
    original_check_in_at,
    original_check_in_mode,
    original_check_out_at,
    original_check_out_mode,
    requested_check_in_at,
    requested_check_in_mode,
    requested_check_out_at,
    requested_check_out_mode,
    request_reason,
    status,
    reviewed_by,
    reviewed_at,
    decision_reason
  ) values (
    new_entry.id,
    p_staff_id,
    p_check_in_at,
    normalized_mode,
    p_check_out_at,
    normalized_mode,
    p_check_in_at,
    normalized_mode,
    p_check_out_at,
    normalized_mode,
    coalesce(normalized_notes, 'Chủ trung tâm bổ sung công bù'),
    'approved',
    actor_id,
    pg_catalog.now(),
    'Chủ trung tâm tạo mới công bù'
  );

  return new_entry;
end;
$$;

revoke all on function public.admin_create_time_entry(uuid, date, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.admin_create_time_entry(uuid, date, timestamptz, timestamptz, text, text) to authenticated;

create or replace function public.decide_attendance_exception(p_entry_id uuid, p_decision text, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.time_entries%rowtype; review public.attendance_exception_reviews%rowtype;
begin
  if auth.uid() is null or not public.has_permission('timekeeping.approve_adjustment') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_ADJUSTMENT_APPROVAL_PERMISSION_REQUIRED';
  end if;
  if p_decision is null or p_decision not in ('approved','rejected') or nullif(btrim(p_reason),'') is null or length(p_reason) > 2000 then
    raise exception using errcode = '22023', message = 'ATTENDANCE_EXCEPTION_INPUT_INVALID';
  end if;
  select * into target from public.time_entries where id = p_entry_id for update;
  if not found or target.status = 'open' then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_NOT_CLOSED';
  end if;
  if target.staff_id = auth.uid() then
    raise exception using errcode = '42501', message = 'TIME_ENTRY_ADJUSTMENT_SELF_REVIEW_FORBIDDEN';
  end if;
  perform public.assert_time_entry_month_unlocked(target.work_date);
  select * into review from public.attendance_exception_reviews where time_entry_id = p_entry_id for update;
  if not found or review.status <> 'pending' then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_ADJUSTMENT_ALREADY_DECIDED';
  end if;
  update public.attendance_exception_reviews set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(), decision_reason = btrim(p_reason)
    where time_entry_id = p_entry_id;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,old_data,new_data,metadata)
    values(auth.uid(),'timekeeping','attendance_exception_decided','time_entry',p_entry_id::text,
      pg_catalog.to_jsonb(review), pg_catalog.jsonb_build_object('status',p_decision),
      pg_catalog.jsonb_build_object('reason',btrim(p_reason)));
  return p_entry_id;
end;
$$;
revoke all on function public.decide_attendance_exception(uuid,text,text) from public, anon;
grant execute on function public.decide_attendance_exception(uuid,text,text) to authenticated;

commit;
