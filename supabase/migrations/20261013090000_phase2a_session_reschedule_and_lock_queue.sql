-- Đợt 2 — nhóm 2a (phần 1): đổi lịch buổi học, hàng đợi buổi chưa khóa, tự khóa.
--
-- A4: không đổi được lịch buổi học; muốn dời phải hủy rồi tạo buổi bù, và
--     unique index (template, ngày) tính cả buổi đã hủy nên không tạo lại được
--     buổi cùng ngày.
--   → RPC update_class_session cho buổi còn "đã lên lịch": đổi ngày/giờ/hình
--     thức/phòng/link/ghi chú, lưu lịch cũ trên dòng, audit theo trigger sẵn
--     có. Trigger bảo vệ lịch sử mở đúng các cột đó khi RPC đặt cờ
--     app.session_reschedule; kiểm tra thứ trong tuần của buổi chính được bỏ
--     qua khi đổi lịch (buổi dời sang ngày khác thứ là chuyện bình thường).
--     Unique index bỏ qua buổi đã hủy.
-- A2: khóa buổi là bước duy nhất trừ buổi và hoàn toàn thủ công; không có
--     danh sách "đã học xong chưa khóa", không tự khóa.
--   → RPC get_unlocked_completed_sessions (hàng đợi + thiếu điểm danh bao
--     nhiêu); cài đặt sessions.auto_lock_after_days (0 = tắt, mặc định 3);
--     worker tự khóa chạy mỗi giờ qua pg_cron, chỉ khóa buổi đã đủ điểm danh,
--     locked_by = người hoàn thành buổi, lý do ghi rõ "tự động"; nhắc người
--     hoàn thành buổi sau 24 giờ chưa khóa và nhắc quản lý buổi học mỗi sáng
--     khi còn tồn đọng.

begin;

-- ---------------------------------------------------------------------------
-- 1. Đổi lịch buổi học
-- ---------------------------------------------------------------------------

alter table public.class_sessions
  add column rescheduled_at timestamptz,
  add column rescheduled_by uuid references public.profiles(id) on delete restrict,
  add column reschedule_reason text,
  add column previous_session_date date,
  add column previous_start_time time,
  add column previous_end_time time,
  add column reschedule_count integer not null default 0 check (reschedule_count >= 0);

drop index public.class_sessions_template_date_unique_idx;
create unique index class_sessions_template_date_unique_idx
  on public.class_sessions (schedule_template_id, session_date)
  where schedule_template_id is not null and status <> 'cancelled';

create or replace function public.protect_session_foundation_history()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reschedule_open boolean := false;
begin
  if tg_table_name = 'class_sessions' then
    reschedule_open :=
      old.status = 'scheduled'
      and old.locked_at is null
      and coalesce(pg_catalog.current_setting('app.session_reschedule', true), '') = 'on';

    if new.id is distinct from old.id
      or new.class_id is distinct from old.class_id
      or new.schedule_template_id is distinct from old.schedule_template_id
      or new.makeup_for_session_id is distinct from old.makeup_for_session_id
      or new.session_kind is distinct from old.session_kind
      or new.component_code is distinct from old.component_code
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception using errcode = '23514', message = 'CLASS_SESSION_IDENTITY_IS_IMMUTABLE';
    end if;

    if not reschedule_open and (
      new.session_date is distinct from old.session_date
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.learning_mode is distinct from old.learning_mode
      or new.room_name is distinct from old.room_name
      or new.meeting_url is distinct from old.meeting_url
      or new.rescheduled_at is distinct from old.rescheduled_at
      or new.rescheduled_by is distinct from old.rescheduled_by
      or new.reschedule_reason is distinct from old.reschedule_reason
      or new.previous_session_date is distinct from old.previous_session_date
      or new.previous_start_time is distinct from old.previous_start_time
      or new.previous_end_time is distinct from old.previous_end_time
      or new.reschedule_count is distinct from old.reschedule_count
    ) then
      raise exception using errcode = '23514', message = 'CLASS_SESSION_IDENTITY_IS_IMMUTABLE';
    end if;

    if old.status = 'cancelled'
      and (pg_catalog.to_jsonb(new) - 'updated_at') is distinct from (pg_catalog.to_jsonb(old) - 'updated_at')
    then
      raise exception using errcode = '23514', message = 'CANCELLED_CLASS_SESSION_IS_IMMUTABLE';
    end if;

    if old.status = 'completed'
      and (pg_catalog.to_jsonb(new) - 'updated_at' - 'locked_at' - 'locked_by' - 'lock_reason')
        is distinct from (pg_catalog.to_jsonb(old) - 'updated_at' - 'locked_at' - 'locked_by' - 'lock_reason')
    then
      raise exception using errcode = '23514', message = 'COMPLETED_CLASS_SESSION_HISTORY_IS_IMMUTABLE';
    end if;
  elsif tg_table_name = 'session_attendance' then
    if new.id is distinct from old.id
      or new.class_session_id is distinct from old.class_session_id
      or new.student_id is distinct from old.student_id
      or new.student_enrollment_id is distinct from old.student_enrollment_id
      or new.created_at is distinct from old.created_at
    then
      raise exception using errcode = '23514', message = 'SESSION_ATTENDANCE_IDENTITY_IS_IMMUTABLE';
    end if;
  elsif tg_table_name = 'session_results' then
    if new.id is distinct from old.id
      or new.class_session_id is distinct from old.class_session_id
      or new.student_id is distinct from old.student_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception using errcode = '23514', message = 'SESSION_RESULT_IDENTITY_IS_IMMUTABLE';
    end if;
  else
    raise exception using errcode = '22023', message = 'UNSUPPORTED_SESSION_HISTORY_TABLE';
  end if;

  return new;
end;
$$;

-- Giống bản 20260817090000 (qua các bản vá sau), chỉ thêm: khi đổi lịch, buổi
-- chính không bị bắt phải đúng thứ của lịch mẫu.
create or replace function public.validate_class_session_foundation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c public.classes%rowtype;
  y public.academic_years%rowtype;
  t public.class_schedule_templates%rowtype;
  src public.class_sessions%rowtype;
  active_context boolean := false;
  attendance_count integer;
  missing_count integer;
  rescheduling boolean :=
    tg_op = 'UPDATE'
    and coalesce(pg_catalog.current_setting('app.session_reschedule', true), '') = 'on';
begin
  select * into c from public.classes where id = new.class_id for share;
  if not found then raise exception 'CLASS_NOT_FOUND'; end if;
  select * into y from public.academic_years where id = c.academic_year_id for share;
  if not found then raise exception 'ACADEMIC_YEAR_NOT_FOUND'; end if;

  if exists (
    select 1 from public.class_component_links x
    where x.parent_class_id = new.class_id
      and x.effective_from <= new.session_date
      and (x.effective_to is null or x.effective_to >= new.session_date)
  ) then
    raise exception 'COMPOSITE_PARENT_CANNOT_HAVE_CLASS_SESSION';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'scheduled' then raise exception 'CLASS_SESSION_MUST_START_SCHEDULED'; end if;
    active_context := true;
  elsif old.status = 'scheduled' and new.status = 'in_progress' then
    active_context := true;
  end if;
  if active_context and c.status <> 'active' then raise exception 'CLASS_SESSION_REQUIRES_ACTIVE_CLASS'; end if;
  if active_context and y.status <> 'active' then raise exception 'CLASS_SESSION_REQUIRES_ACTIVE_ACADEMIC_YEAR'; end if;

  if new.session_kind = 'regular' then
    select * into t from public.class_schedule_templates where id = new.schedule_template_id for share;
    if not found then raise exception 'CLASS_SCHEDULE_TEMPLATE_NOT_FOUND'; end if;
    if t.class_id <> new.class_id then raise exception 'CLASS_SESSION_SCHEDULE_CLASS_MISMATCH'; end if;
    if new.session_date < t.effective_from or (t.effective_to is not null and new.session_date > t.effective_to) then
      raise exception 'CLASS_SESSION_SCHEDULE_NOT_EFFECTIVE';
    end if;
    -- Thứ trong tuần chỉ kiểm tra khi tạo mới hoặc khi ngày đổi ngoài luồng đổi
    -- lịch; buổi đã dời sang ngày khác thứ vẫn bắt đầu / hoàn thành / khóa được.
    if (tg_op = 'INSERT' or new.session_date is distinct from old.session_date)
      and not rescheduling
      and date_part('isodow', new.session_date)::smallint <> t.weekday
    then
      raise exception 'CLASS_SESSION_WEEKDAY_MISMATCH';
    end if;
  elsif new.session_kind = 'makeup' then
    select * into src from public.class_sessions where id = new.makeup_for_session_id for share;
    if not found then raise exception 'MAKEUP_SOURCE_SESSION_NOT_FOUND'; end if;
    if src.class_id <> new.class_id then raise exception 'MAKEUP_SESSION_CLASS_MISMATCH'; end if;
    if src.session_kind = 'additional' then raise exception 'ADDITIONAL_SESSION_CANNOT_HAVE_MAKEUP'; end if;
    if src.status <> 'cancelled' then raise exception 'MAKEUP_SOURCE_SESSION_MUST_BE_CANCELLED'; end if;
    if new.session_date <= src.session_date then raise exception 'MAKEUP_SESSION_DATE_INVALID'; end if;
  end if;

  if tg_op = 'INSERT' and new.locked_at is not null then raise exception 'CLASS_SESSION_CANNOT_START_LOCKED'; end if;

  if tg_op = 'UPDATE' then
    if old.status = 'scheduled' and new.status not in ('scheduled', 'in_progress', 'cancelled') then
      raise exception 'CLASS_SESSION_STATUS_TRANSITION_INVALID';
    end if;
    if old.status = 'in_progress'
      and new.status not in ('in_progress', 'completed', 'cancelled')
      and not (new.status = 'scheduled' and pg_catalog.current_setting('app.allow_session_reset', true) = 'true')
    then
      raise exception 'CLASS_SESSION_STATUS_TRANSITION_INVALID';
    end if;
    if old.status in ('completed', 'cancelled') and new.status <> old.status then
      raise exception 'CLASS_SESSION_TERMINAL_STATUS_IMMUTABLE';
    end if;
    if old.status = 'in_progress' and new.status = 'cancelled'
      and (new.started_at is distinct from old.started_at or new.started_by is distinct from old.started_by)
    then
      raise exception 'CANCELLED_SESSION_MUST_PRESERVE_START';
    end if;
    if old.started_at is not null and new.started_at < old.started_at
      and pg_catalog.current_setting('app.allow_session_reset', true) <> 'true'
    then
      raise exception 'CLASS_SESSION_STARTED_AT_CANNOT_MOVE_BACK';
    end if;
    if new.completed_at is not null and new.started_at is not null and new.completed_at < new.started_at then
      raise exception 'CLASS_SESSION_COMPLETION_TIME_INVALID';
    end if;
    if old.locked_at is not null and new.locked_at is null then raise exception 'CLASS_SESSION_CANNOT_BE_UNLOCKED'; end if;
    if old.locked_at is not null
      and (pg_catalog.to_jsonb(new) - 'updated_at') is distinct from (pg_catalog.to_jsonb(old) - 'updated_at')
    then
      raise exception 'LOCKED_CLASS_SESSION_IS_IMMUTABLE';
    end if;
  end if;

  if new.locked_at is not null and old.locked_at is null then
    if new.status <> 'completed' then raise exception 'ONLY_COMPLETED_SESSION_CAN_BE_LOCKED'; end if;
    if tg_op <> 'UPDATE' or old.status <> 'completed' then raise exception 'CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK'; end if;
    select count(*) into attendance_count from public.session_attendance where class_session_id = new.id;
    if attendance_count = 0 then raise exception 'CLASS_SESSION_LOCK_REQUIRES_ATTENDANCE'; end if;
    if new.session_kind in ('regular', 'makeup') then
      select count(*) into missing_count
      from public.resolve_class_session_rosters(array[new.id]) r
      where not exists (
        select 1 from public.session_attendance a
        where a.class_session_id = new.id
          and a.student_id = r.student_id
          and a.student_enrollment_id = r.student_enrollment_id
          and a.attendance_status in ('present', 'excused_absence', 'unexcused_absence')
      );
      if missing_count > 0 then raise exception 'CLASS_SESSION_LOCK_REQUIRES_FULL_ATTENDANCE'; end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.update_class_session(
  p_class_session_id uuid,
  p_session_date date,
  p_start_time time,
  p_end_time time,
  p_learning_mode text,
  p_room_name text,
  p_meeting_url text,
  p_notes text,
  p_reason text
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_session public.class_sessions%rowtype;
  v_result public.class_sessions%rowtype;
  v_room text := nullif(pg_catalog.btrim(coalesce(p_room_name, '')), '');
  v_url text := nullif(pg_catalog.btrim(coalesce(p_meeting_url, '')), '');
  v_notes text := nullif(pg_catalog.btrim(coalesce(p_notes, '')), '');
  v_time_changed boolean;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('sessions.manage') then
    raise exception using errcode = '42501', message = 'SESSION_MANAGE_PERMISSION_DENIED';
  end if;
  if p_class_session_id is null then
    raise exception using errcode = '22023', message = 'CLASS_SESSION_ID_REQUIRED';
  end if;
  if p_session_date is null or p_start_time is null or p_end_time is null then
    raise exception using errcode = '22023', message = 'CLASS_SESSION_SCHEDULE_REQUIRED';
  end if;
  if p_end_time <= p_start_time then
    raise exception using errcode = '22023', message = 'CLASS_SESSION_TIME_RANGE_INVALID';
  end if;
  if p_learning_mode is null or p_learning_mode not in ('online', 'offline', 'hybrid') then
    raise exception using errcode = '22023', message = 'CLASS_SESSION_LEARNING_MODE_INVALID';
  end if;
  if v_reason is null or pg_catalog.length(v_reason) < 3 or pg_catalog.length(v_reason) > 1000 then
    raise exception using errcode = '22023', message = 'CLASS_SESSION_RESCHEDULE_REASON_REQUIRED';
  end if;

  select * into v_session from public.class_sessions where id = p_class_session_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CLASS_SESSION_NOT_FOUND';
  end if;
  if v_session.status <> 'scheduled' or v_session.locked_at is not null then
    raise exception using errcode = '23514', message = 'CLASS_SESSION_RESCHEDULE_STATUS_INVALID';
  end if;

  v_time_changed := v_session.session_date <> p_session_date
    or v_session.start_time <> p_start_time
    or v_session.end_time <> p_end_time;

  -- Không cho hai buổi cùng lớp chồng giờ trong cùng ngày.
  if exists (
    select 1
    from public.class_sessions as other
    where other.class_id = v_session.class_id
      and other.id <> v_session.id
      and other.session_date = p_session_date
      and other.status <> 'cancelled'
      and other.start_time < p_end_time
      and other.end_time > p_start_time
  ) then
    raise exception using errcode = '23505', message = 'CLASS_SESSION_TIME_CONFLICT';
  end if;

  perform pg_catalog.set_config('app.workflow_reason', v_reason, true);
  perform pg_catalog.set_config('app.session_reschedule', 'on', true);

  begin
    update public.class_sessions
    set
      session_date = p_session_date,
      start_time = p_start_time,
      end_time = p_end_time,
      learning_mode = p_learning_mode,
      room_name = v_room,
      meeting_url = v_url,
      notes = v_notes,
      rescheduled_at = case when v_time_changed then pg_catalog.now() else rescheduled_at end,
      rescheduled_by = case when v_time_changed then actor_id else rescheduled_by end,
      reschedule_reason = case when v_time_changed then v_reason else reschedule_reason end,
      previous_session_date = case when v_time_changed then v_session.session_date else previous_session_date end,
      previous_start_time = case when v_time_changed then v_session.start_time else previous_start_time end,
      previous_end_time = case when v_time_changed then v_session.end_time else previous_end_time end,
      reschedule_count = reschedule_count + case when v_time_changed then 1 else 0 end
    where id = v_session.id
    returning * into v_result;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'CLASS_SESSION_DATE_CONFLICT';
  end;

  perform pg_catalog.set_config('app.session_reschedule', 'off', true);

  return v_result;
end;
$$;

revoke all on function public.update_class_session(uuid, date, time, time, text, text, text, text, text) from public, anon;
grant execute on function public.update_class_session(uuid, date, time, time, text, text, text, text, text) to authenticated;

comment on function public.update_class_session(uuid, date, time, time, text, text, text, text, text)
is 'Đổi lịch / sửa buổi học còn ở trạng thái đã lên lịch (ngày, giờ, hình thức, phòng, link, ghi chú). Lưu lịch cũ trên dòng; buổi chính được dời sang ngày khác thứ của lịch mẫu.';

-- ---------------------------------------------------------------------------
-- 2. Khóa buổi: tách lõi dùng chung cho RPC thủ công và worker tự khóa
-- ---------------------------------------------------------------------------

create or replace function public.lock_class_session_internal(
  p_class_session_id uuid,
  p_reason text,
  p_actor uuid
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.class_sessions%rowtype;
  result_row public.class_sessions%rowtype;
  required_count integer;
  recorded_count integer;
  reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  action_at timestamptz := pg_catalog.now();
begin
  if p_class_session_id is null then raise exception 'CLASS_SESSION_ID_REQUIRED'; end if;
  if p_actor is null then raise exception 'SESSION_LOCK_ACTOR_REQUIRED'; end if;
  if reason is null then raise exception 'SESSION_LOCK_REASON_REQUIRED'; end if;
  select * into s from public.class_sessions where id = p_class_session_id for update;
  if not found then raise exception 'CLASS_SESSION_NOT_FOUND'; end if;
  if s.locked_at is not null then raise exception 'CLASS_SESSION_ALREADY_LOCKED'; end if;
  if s.status <> 'completed' then raise exception 'CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK'; end if;
  select count(*) into required_count from public.resolve_class_session_rosters(array[p_class_session_id]);
  if required_count = 0 then raise exception 'SESSION_HAS_NO_ELIGIBLE_ROSTER'; end if;
  select count(*) into recorded_count
  from public.resolve_class_session_rosters(array[p_class_session_id]) r
  join public.session_attendance a
    on a.class_session_id = p_class_session_id
    and a.student_id = r.student_id
    and a.student_enrollment_id = r.student_enrollment_id
    where a.attendance_status in ('present', 'excused_absence', 'unexcused_absence');
  if recorded_count <> required_count then raise exception 'SESSION_ATTENDANCE_INCOMPLETE_FOR_LOCK'; end if;
  perform pg_catalog.set_config('app.workflow_reason', reason, true);
  update public.class_sessions
  set locked_at = action_at, locked_by = p_actor, lock_reason = reason
  where id = p_class_session_id
  returning * into result_row;
  insert into public.grading_credits(session_result_id, class_session_id, student_id, grader_id, credit_units, credited_at, credited_by)
  select result.id, result.class_session_id, result.student_id, result.graded_by, 1, action_at, p_actor
  from public.session_results result
  where result.class_session_id = p_class_session_id and result.graded_at is not null and result.graded_by is not null;
  if s.session_kind in ('regular', 'makeup') then
    insert into public.student_session_ledger_entries(student_id, student_enrollment_id, class_session_id, session_attendance_id, entry_type, delta_sessions, effective_on, event_key, unit_price_vnd, note, created_by)
    select a.student_id, a.student_enrollment_id, a.class_session_id, a.id, 'session_charge', -1, s.session_date,
      'session-charge:' || a.id::text, null, 'Tru 1 buoi cho buoi hoc (' || s.session_kind || ')', p_actor
    from public.session_attendance a
    where a.class_session_id = p_class_session_id
      and a.attendance_status in ('present', 'excused_absence', 'unexcused_absence');
  end if;
  return result_row;
end;
$$;

revoke all on function public.lock_class_session_internal(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.lock_class_session(p_class_session_id uuid, p_reason text)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('sessions.lock') then raise exception 'SESSION_LOCK_PERMISSION_DENIED'; end if;
  return public.lock_class_session_internal(p_class_session_id, p_reason, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Cài đặt tự khóa + hàng đợi + worker + nhắc
-- ---------------------------------------------------------------------------

alter table public.system_settings drop constraint system_settings_key_check;
alter table public.system_settings add constraint system_settings_key_check check (
  key = any (array[
    'center.display_name', 'teacher.display_name', 'center.contact_phone', 'center.contact_email', 'center.address',
    'coaching.default_public_link_expiry_days', 'sessions.auto_lock_after_days'
  ])
);

insert into public.system_settings (key, value)
values ('sessions.auto_lock_after_days', '3'::jsonb)
on conflict (key) do nothing;

create or replace function public.update_system_settings(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_key text;
  v_value jsonb;
  v_text text;
  v_old jsonb;
  v_result jsonb := '{}'::jsonb;
begin
  if v_actor is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('settings.manage') then raise exception using errcode = '42501', message = 'SYSTEM_SETTINGS_PERMISSION_DENIED'; end if;
  if pg_catalog.jsonb_typeof(p_values) <> 'object' then raise exception using errcode = '22023', message = 'SYSTEM_SETTINGS_INVALID_PAYLOAD'; end if;
  if exists (
    select 1 from pg_catalog.jsonb_object_keys(p_values) as k
    where k not in (
      'center.display_name', 'teacher.display_name', 'center.contact_phone', 'center.contact_email', 'center.address',
      'coaching.default_public_link_expiry_days', 'sessions.auto_lock_after_days'
    )
  ) then
    raise exception using errcode = '22023', message = 'SYSTEM_SETTINGS_UNKNOWN_KEY';
  end if;

  for v_key in select key from pg_catalog.jsonb_object_keys(p_values) as key loop
    v_value := p_values -> v_key;
    if v_key = 'coaching.default_public_link_expiry_days' then
      if pg_catalog.jsonb_typeof(v_value) <> 'number' or not ((v_value #>> '{}') ~ '^[0-9]+$') or (v_value #>> '{}')::integer not between 1 and 90 then
        raise exception using errcode = '22023', message = 'SYSTEM_SETTINGS_INVALID_EXPIRY';
      end if;
    elsif v_key = 'sessions.auto_lock_after_days' then
      if pg_catalog.jsonb_typeof(v_value) <> 'number' or not ((v_value #>> '{}') ~ '^[0-9]+$') or (v_value #>> '{}')::integer not between 0 and 30 then
        raise exception using errcode = '22023', message = 'SYSTEM_SETTINGS_INVALID_AUTO_LOCK_DAYS';
      end if;
    else
      if pg_catalog.jsonb_typeof(v_value) <> 'string' then raise exception using errcode = '22023', message = 'SYSTEM_SETTINGS_INVALID_TEXT'; end if;
      v_text := pg_catalog.btrim(v_value #>> '{}');
      if (v_key in ('center.display_name', 'teacher.display_name') and (v_text = '' or pg_catalog.length(v_text) > 160))
        or (v_key = 'center.address' and pg_catalog.length(v_text) > 500)
        or (v_key in ('center.contact_phone', 'center.contact_email') and pg_catalog.length(v_text) > 160)
        or (v_key = 'center.contact_email' and v_text <> '' and v_text !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
      then
        raise exception using errcode = '22023', message = 'SYSTEM_SETTINGS_INVALID_VALUE';
      end if;
      v_value := to_jsonb(v_text);
    end if;

    select value into v_old from public.system_settings where key = v_key for update;
    if not found then
      insert into public.system_settings (key, value, updated_at, updated_by) values (v_key, v_value, pg_catalog.now(), v_actor);
    else
      update public.system_settings set value = v_value, updated_at = pg_catalog.now(), updated_by = v_actor where key = v_key;
    end if;
    insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data)
    values (v_actor, 'settings', 'system_setting_updated', 'system_setting', v_key, v_old, v_value);
    v_result := v_result || pg_catalog.jsonb_build_object(v_key, v_value);
  end loop;

  return v_result;
end;
$$;

create or replace function public.session_auto_lock_after_days()
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select nullif(value #>> '{}', '')::integer from public.system_settings where key = 'sessions.auto_lock_after_days'),
    0
  );
$$;

revoke all on function public.session_auto_lock_after_days() from public, anon;
grant execute on function public.session_auto_lock_after_days() to authenticated;

create or replace function public.get_unlocked_completed_sessions(p_limit integer default 200)
returns table (
  class_session_id uuid,
  class_id uuid,
  class_code text,
  class_name text,
  session_date date,
  start_time time,
  end_time time,
  session_kind text,
  completed_at timestamptz,
  completed_by uuid,
  completed_by_name text,
  days_since_completed integer,
  roster_count integer,
  attendance_count integer,
  missing_attendance_count integer,
  auto_lock_on date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := public.session_auto_lock_after_days();
  v_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('sessions.view') then
    raise exception using errcode = '42501', message = 'SESSION_VIEW_PERMISSION_DENIED';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'LIMIT_INVALID';
  end if;

  return query
  select
    s.id,
    c.id,
    c.code,
    c.name,
    s.session_date,
    s.start_time,
    s.end_time,
    s.session_kind,
    s.completed_at,
    s.completed_by,
    coalesce(nullif(pg_catalog.btrim(p.display_name), ''), p.email),
    greatest(0, v_today - (s.completed_at at time zone 'Asia/Ho_Chi_Minh')::date)::integer,
    roster.total::integer,
    attendance.total::integer,
    greatest(0, roster.total - attendance.recorded)::integer,
    case
      when v_days > 0 and roster.total > 0 and roster.total = attendance.recorded
        then ((s.completed_at at time zone 'Asia/Ho_Chi_Minh')::date + v_days)
      else null
    end
  from public.class_sessions as s
  join public.classes as c on c.id = s.class_id
  left join public.profiles as p on p.id = s.completed_by
  cross join lateral (
    select count(*) as total from public.resolve_class_session_rosters(array[s.id])
  ) as roster
  cross join lateral (
    select
      count(*) as total,
      count(*) filter (
        where exists (
          select 1 from public.resolve_class_session_rosters(array[s.id]) r
          where r.student_id = a.student_id and r.student_enrollment_id = a.student_enrollment_id
        ) and a.attendance_status in ('present', 'excused_absence', 'unexcused_absence')
      ) as recorded
    from public.session_attendance a
    where a.class_session_id = s.id
  ) as attendance
  where s.status = 'completed'
    and s.locked_at is null
  order by s.completed_at asc, s.id
  limit p_limit;
end;
$$;

revoke all on function public.get_unlocked_completed_sessions(integer) from public, anon;
grant execute on function public.get_unlocked_completed_sessions(integer) to authenticated;

-- Worker: khóa buổi đã hoàn thành đủ N ngày và đủ điểm danh. Lỗi từng buổi
-- (thiếu điểm danh, không có roster...) không chặn các buổi khác.
create or replace function public.run_class_session_auto_lock_worker()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := public.session_auto_lock_after_days();
  v_session record;
  v_locked integer := 0;
begin
  if v_days <= 0 then
    return 0;
  end if;

  for v_session in
    select s.id, s.completed_by
    from public.class_sessions as s
    where s.status = 'completed'
      and s.locked_at is null
      and s.completed_by is not null
      and s.completed_at <= pg_catalog.now() - make_interval(days => v_days)
    order by s.completed_at
    limit 200
  loop
    begin
      perform public.lock_class_session_internal(
        v_session.id,
        'Tự động khóa sau ' || v_days::text || ' ngày kể từ khi hoàn thành (cài đặt hệ thống)',
        v_session.completed_by
      );
      v_locked := v_locked + 1;
      insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, reason, metadata)
      values (
        v_session.completed_by,
        'sessions',
        'class_session_auto_locked',
        'class_session',
        v_session.id::text,
        'Tự động khóa sau ' || v_days::text || ' ngày',
        pg_catalog.jsonb_build_object('source', 'auto_lock_worker', 'auto_lock_after_days', v_days)
      );
    exception
      when others then
        -- Buổi chưa đủ điều kiện ở lại hàng đợi; quản lý sẽ thấy lý do thiếu.
        null;
    end;
  end loop;

  return v_locked;
end;
$$;

revoke all on function public.run_class_session_auto_lock_worker() from public, anon, authenticated;

-- Nhắc: người hoàn thành buổi sau 24 giờ chưa khóa (một lần mỗi buổi); quản lý
-- buổi học mỗi sáng khi còn tồn đọng (một lần mỗi ngày).
create or replace function public.run_class_session_lock_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_pending integer;
  v_inserted integer := 0;
  v_count integer;
begin
  insert into public.notifications (
    recipient_user_id, actor_user_id, event_code, title, message, href, entity_type, entity_id, dedupe_key, metadata
  )
  select
    s.completed_by,
    null,
    'session.lock_reminder',
    'Buổi học chưa khóa',
    'Buổi ' || c.code || ' ngày ' || pg_catalog.to_char(s.session_date, 'DD/MM/YYYY') || ' đã hoàn thành hơn 1 ngày nhưng chưa khóa. Khóa buổi để trừ buổi và tính thưởng chấm bài.',
    '/sessions/' || s.id::text,
    'class_session',
    s.id::text,
    'session.lock_reminder:' || s.id::text,
    pg_catalog.jsonb_build_object('source', 'session_lock_reminder')
  from public.class_sessions as s
  join public.classes as c on c.id = s.class_id
  join public.profiles as p on p.id = s.completed_by and p.employment_status = 'active'
  where s.status = 'completed'
    and s.locked_at is null
    and s.completed_by is not null
    and s.completed_at <= pg_catalog.now() - interval '1 day'
  on conflict (recipient_user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  select count(*) into v_pending
  from public.class_sessions as s
  where s.status = 'completed' and s.locked_at is null and s.completed_at <= pg_catalog.now() - interval '1 day';

  if v_pending > 0 then
    insert into public.notifications (
      recipient_user_id, actor_user_id, event_code, title, message, href, entity_type, entity_id, dedupe_key, metadata
    )
    select
      recipient.user_id,
      null,
      'session.lock_queue_digest',
      v_pending::text || ' buổi học đã hoàn thành chưa khóa',
      'Có ' || v_pending::text || ' buổi học hoàn thành hơn 1 ngày nhưng chưa khóa. Buổi chưa khóa chưa trừ buổi học sinh và chưa tính thưởng chấm bài.',
      '/sessions?status=completed&lock=unlocked',
      null,
      null,
      'session.lock_queue_digest:' || pg_catalog.to_char(v_today, 'YYYY-MM-DD'),
      pg_catalog.jsonb_build_object('source', 'session_lock_reminder', 'pending_count', v_pending)
    from (
      select distinct assignment.user_id
      from public.user_role_assignments as assignment
      join public.profiles as profile on profile.id = assignment.user_id and profile.employment_status = 'active'
      join public.roles as role on role.id = assignment.role_id and role.is_active
      join public.role_permissions as role_permission on role_permission.role_id = role.id
      join public.permissions as permission on permission.id = role_permission.permission_id and permission.is_active
      where permission.code = 'sessions.manage'
    ) as recipient
    on conflict (recipient_user_id, dedupe_key) do nothing;
    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.run_class_session_lock_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('class-session-auto-lock', 'class-session-lock-reminders');
    perform cron.schedule('class-session-auto-lock', '15 * * * *', 'select public.run_class_session_auto_lock_worker();');
    -- 01:00 UTC = 08:00 giờ Việt Nam.
    perform cron.schedule('class-session-lock-reminders', '0 1 * * *', 'select public.run_class_session_lock_reminders();');
  else
    raise warning 'SESSION_LOCK_CRON_UNAVAILABLE: install pg_cron and register class-session-auto-lock / class-session-lock-reminders';
  end if;
end;
$$;

commit;
