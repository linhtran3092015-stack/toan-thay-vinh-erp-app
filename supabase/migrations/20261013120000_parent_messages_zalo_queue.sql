-- Tin nhắn phụ huynh qua nhóm Zalo "sổ liên lạc" (ZaloCRM), hàng đợi do trợ giảng bấm gửi.
--
-- Quyết định chủ trung tâm 13/10/2026: gửi từ nick trung tâm (nick có mặt trong
-- các nhóm SLL); hai loại tin đầu: vắng không phép và nhận xét cuối buổi; trợ
-- giảng bấm "Gửi" trong hàng đợi (không tự gửi). Khóa nhóm là UID nhóm Zalo
-- (externalThreadId trong ZaloCRM) vì tên nhóm trùng (anh em) hoặc đổi tên.
--
-- 1. students.zalo_group_thread_id + nick + tên nhóm chụp lúc liên kết.
-- 2. parent_messages: hàng đợi (queued → sent / failed / skipped / expired),
--    dedupe theo nguồn (điểm danh / kết quả buổi), nội dung sinh từ mẫu trong
--    cài đặt hệ thống, trợ giảng sửa được trước khi gửi.
-- 3. Trigger: điểm danh 'unexcused_absence' → xếp hàng; sửa điểm danh về có mặt
--    → bỏ qua tin còn chờ. Kết quả buổi có nhận xét → xếp hàng (cập nhật nội
--    dung khi nhận xét đổi và tin còn chờ).
-- 4. RPC liên kết nhóm (students.update), sửa / gửi / bỏ qua tin (attendance.mark),
--    đọc hàng đợi (attendance.view). Cron dọn tin chờ quá 3 ngày → expired.

begin;

-- ---------------------------------------------------------------------------
-- 1. Nhóm sổ liên lạc trên học sinh
-- ---------------------------------------------------------------------------

alter table public.students
  add column zalo_group_thread_id text,
  add column zalo_account_id text,
  add column zalo_group_name_snapshot text,
  add column zalo_group_linked_at timestamptz,
  add column zalo_group_linked_by uuid references public.profiles(id) on delete restrict;

create index students_zalo_group_thread_idx on public.students (zalo_group_thread_id) where zalo_group_thread_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Cài đặt Zalo
-- ---------------------------------------------------------------------------

alter table public.system_settings drop constraint system_settings_key_check;
alter table public.system_settings add constraint system_settings_key_check check (
  key = any (array[
    'center.display_name', 'teacher.display_name', 'center.contact_phone', 'center.contact_email', 'center.address',
    'coaching.default_public_link_expiry_days', 'sessions.auto_lock_after_days',
    'zalo.center_account_id', 'zalo.center_account_name', 'zalo.absence_message_enabled', 'zalo.comment_message_enabled',
    'zalo.absence_template', 'zalo.comment_template'
  ])
);

insert into public.system_settings (key, value) values
  ('zalo.center_account_id', '""'::jsonb),
  ('zalo.center_account_name', '""'::jsonb),
  ('zalo.absence_message_enabled', '"on"'::jsonb),
  ('zalo.comment_message_enabled', '"on"'::jsonb),
  ('zalo.absence_template', to_jsonb('{center} thông báo: {student} vắng buổi học {class} ngày {date} ({time}) không phép. Phụ huynh vui lòng phản hồi để trung tâm sắp xếp học bù.'::text)),
  ('zalo.comment_template', to_jsonb('{center} - nhận xét buổi {date} lớp {class} của {student}: {comment}{scores}'::text))
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
      'coaching.default_public_link_expiry_days', 'sessions.auto_lock_after_days',
      'zalo.center_account_id', 'zalo.center_account_name', 'zalo.absence_message_enabled', 'zalo.comment_message_enabled',
      'zalo.absence_template', 'zalo.comment_template'
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
        or (v_key in ('zalo.center_account_id', 'zalo.center_account_name') and pg_catalog.length(v_text) > 200)
        or (v_key in ('zalo.absence_message_enabled', 'zalo.comment_message_enabled') and v_text not in ('on', 'off'))
        or (v_key in ('zalo.absence_template', 'zalo.comment_template') and (v_text = '' or pg_catalog.length(v_text) > 1000))
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

create or replace function public.system_setting_text(p_key text, p_default text default '')
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select value #>> '{}' from public.system_settings where key = p_key), p_default);
$$;

revoke all on function public.system_setting_text(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Hàng đợi tin nhắn
-- ---------------------------------------------------------------------------

create table public.parent_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_session_id uuid references public.class_sessions(id) on delete set null,
  event_code text not null check (event_code in ('attendance.unexcused_absence', 'session.comment')),
  source_type text not null check (source_type in ('session_attendance', 'session_result')),
  source_id uuid not null,
  dedupe_key text not null unique check (dedupe_key = pg_catalog.btrim(dedupe_key) and dedupe_key <> ''),
  thread_id text not null,
  thread_type text not null default 'group' check (thread_type in ('group', 'user')),
  zalo_account_id text not null,
  content text not null check (content = pg_catalog.btrim(content) and content <> '' and pg_catalog.length(content) <= 2000),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped', 'expired')),
  attempts integer not null default 0 check (attempts >= 0),
  error_message text,
  provider_message_id text,
  sent_at timestamptz,
  sent_by uuid references public.profiles(id) on delete restrict,
  skipped_at timestamptz,
  skipped_by uuid references public.profiles(id) on delete restrict,
  skip_reason text,
  content_edited_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check ((status = 'sent') = (sent_at is not null)),
  check (status <> 'skipped' or skipped_at is not null)
);

create index parent_messages_status_created_idx on public.parent_messages (status, created_at desc);
create index parent_messages_student_idx on public.parent_messages (student_id, created_at desc);
create index parent_messages_session_idx on public.parent_messages (class_session_id) where class_session_id is not null;

create trigger parent_messages_touch_updated_at
before update on public.parent_messages
for each row execute function public.touch_finance_updated_at();

alter table public.parent_messages enable row level security;
create policy parent_messages_select on public.parent_messages for select to authenticated
  using (public.has_permission('attendance.view') or public.has_permission('attendance.mark'));
revoke all privileges on public.parent_messages from public, anon, authenticated;
grant select on public.parent_messages to authenticated;

-- Mẫu: {center} {student} {class} {date} {time} {comment} {scores} {test_score} {notebook_score}
create or replace function public.render_parent_message(p_template text, p_vars jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out text := coalesce(p_template, '');
  v_key text;
begin
  for v_key in select key from pg_catalog.jsonb_object_keys(coalesce(p_vars, '{}'::jsonb)) as key loop
    v_out := pg_catalog.replace(v_out, '{' || v_key || '}', coalesce(p_vars ->> v_key, ''));
  end loop;
  return pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(v_out), '\s+\n', E'\n', 'g'), 2000);
end;
$$;

revoke all on function public.render_parent_message(text, jsonb) from public, anon, authenticated;

create or replace function public.parent_message_vars(p_student_id uuid, p_class_session_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'center', public.system_setting_text('center.display_name', 'Trung tâm'),
    'student', coalesce(nullif(pg_catalog.btrim(student.nickname), ''), student.full_name),
    'student_full_name', student.full_name,
    'class', coalesce(class_row.code, '') || case when class_row.name is not null and class_row.name <> class_row.code then ' (' || class_row.name || ')' else '' end,
    'date', pg_catalog.to_char(session.session_date, 'DD/MM/YYYY'),
    'time', pg_catalog.to_char(session.start_time, 'HH24:MI') || '-' || pg_catalog.to_char(session.end_time, 'HH24:MI')
  )
  from public.students as student
  left join public.class_sessions as session on session.id = p_class_session_id
  left join public.classes as class_row on class_row.id = session.class_id
  where student.id = p_student_id;
$$;

revoke all on function public.parent_message_vars(uuid, uuid) from public, anon, authenticated;

-- Xếp hàng / cập nhật một tin theo nguồn. Trả null khi học sinh chưa liên kết nhóm
-- hoặc loại tin đang tắt.
create or replace function public.enqueue_parent_message(
  p_student_id uuid,
  p_class_session_id uuid,
  p_event_code text,
  p_source_type text,
  p_source_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_account text := public.system_setting_text('zalo.center_account_id', '');
  v_dedupe text := p_event_code || ':' || p_source_id::text;
  v_id uuid;
begin
  select * into v_student from public.students where id = p_student_id;
  if not found or v_student.zalo_group_thread_id is null then
    return null;
  end if;
  if v_account = '' then
    return null;
  end if;
  if p_content is null or pg_catalog.btrim(p_content) = '' then
    return null;
  end if;

  insert into public.parent_messages (
    student_id, class_session_id, event_code, source_type, source_id, dedupe_key,
    thread_id, thread_type, zalo_account_id, content
  )
  values (
    p_student_id, p_class_session_id, p_event_code, p_source_type, p_source_id, v_dedupe,
    v_student.zalo_group_thread_id, 'group', coalesce(nullif(v_student.zalo_account_id, ''), v_account), pg_catalog.btrim(p_content)
  )
  on conflict (dedupe_key) do update
    set content = case when public.parent_messages.status = 'queued' and public.parent_messages.content_edited_by is null
                       then excluded.content else public.parent_messages.content end
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enqueue_parent_message(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;

-- Trigger: điểm danh vắng không phép.
create or replace function public.parent_message_on_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vars jsonb;
begin
  if new.attendance_status = 'unexcused_absence' then
    if public.system_setting_text('zalo.absence_message_enabled', 'on') <> 'on' then
      return new;
    end if;
    v_vars := public.parent_message_vars(new.student_id, new.class_session_id);
    perform public.enqueue_parent_message(
      new.student_id, new.class_session_id, 'attendance.unexcused_absence', 'session_attendance', new.id,
      public.render_parent_message(public.system_setting_text('zalo.absence_template', ''), v_vars)
    );
  elsif tg_op = 'UPDATE' and old.attendance_status = 'unexcused_absence' then
    -- Điểm danh đã sửa: tin vắng còn chờ không còn đúng.
    update public.parent_messages
    set status = 'skipped', skipped_at = pg_catalog.now(), skip_reason = 'Điểm danh đã được sửa, không còn vắng không phép'
    where dedupe_key = 'attendance.unexcused_absence:' || new.id::text and status = 'queued';
  end if;
  return new;
end;
$$;

revoke all on function public.parent_message_on_attendance() from public, anon, authenticated;

create trigger session_attendance_parent_message
after insert or update of attendance_status on public.session_attendance
for each row execute function public.parent_message_on_attendance();

-- Trigger: nhận xét cuối buổi.
create or replace function public.parent_message_on_session_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vars jsonb;
  v_scores text := '';
begin
  if new.comment is null or pg_catalog.btrim(new.comment) = '' then
    if tg_op = 'UPDATE' then
      update public.parent_messages
      set status = 'skipped', skipped_at = pg_catalog.now(), skip_reason = 'Nhận xét đã bị xóa'
      where dedupe_key = 'session.comment:' || new.id::text and status = 'queued';
    end if;
    return new;
  end if;
  if public.system_setting_text('zalo.comment_message_enabled', 'on') <> 'on' then
    return new;
  end if;
  if new.test_score is not null then
    v_scores := v_scores || ' Điểm kiểm tra: ' || pg_catalog.rtrim(pg_catalog.rtrim(new.test_score::text, '0'), '.') || '.';
  end if;
  if new.notebook_score is not null then
    v_scores := v_scores || ' Điểm vở: ' || pg_catalog.rtrim(pg_catalog.rtrim(new.notebook_score::text, '0'), '.') || '.';
  end if;
  v_vars := public.parent_message_vars(new.student_id, new.class_session_id)
    || pg_catalog.jsonb_build_object('comment', pg_catalog.btrim(new.comment), 'scores', v_scores);
  perform public.enqueue_parent_message(
    new.student_id, new.class_session_id, 'session.comment', 'session_result', new.id,
    public.render_parent_message(public.system_setting_text('zalo.comment_template', ''), v_vars)
  );
  return new;
end;
$$;

revoke all on function public.parent_message_on_session_result() from public, anon, authenticated;

create trigger session_results_parent_message
after insert or update of comment, test_score, notebook_score on public.session_results
for each row execute function public.parent_message_on_session_result();

-- ---------------------------------------------------------------------------
-- 4. RPC liên kết nhóm và thao tác hàng đợi
-- ---------------------------------------------------------------------------

create or replace function public.link_student_zalo_group(
  p_student_id uuid,
  p_thread_id text,
  p_zalo_account_id text,
  p_group_name text
)
returns public.students
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_thread text := nullif(pg_catalog.btrim(coalesce(p_thread_id, '')), '');
  v_account text := nullif(pg_catalog.btrim(coalesce(p_zalo_account_id, '')), '');
  v_row public.students%rowtype;
  v_other uuid;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('students.update') then raise exception using errcode = '42501', message = 'STUDENT_UPDATE_PERMISSION_DENIED'; end if;
  if v_thread is null or pg_catalog.length(v_thread) > 120 then raise exception using errcode = '22023', message = 'ZALO_GROUP_THREAD_ID_REQUIRED'; end if;
  if v_account is null or pg_catalog.length(v_account) > 120 then raise exception using errcode = '22023', message = 'ZALO_ACCOUNT_ID_REQUIRED'; end if;

  select id into v_other from public.students where zalo_group_thread_id = v_thread and id <> p_student_id limit 1;
  if v_other is not null then
    raise exception using errcode = '23505', message = 'ZALO_GROUP_ALREADY_LINKED_TO_ANOTHER_STUDENT';
  end if;

  update public.students
  set zalo_group_thread_id = v_thread,
      zalo_account_id = v_account,
      zalo_group_name_snapshot = pg_catalog.left(nullif(pg_catalog.btrim(coalesce(p_group_name, '')), ''), 200),
      zalo_group_linked_at = pg_catalog.now(),
      zalo_group_linked_by = actor_id
  where id = p_student_id
  returning * into v_row;
  if not found then raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND'; end if;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, new_data)
  values (actor_id, 'students', 'student_zalo_group_linked', 'student', p_student_id::text,
    pg_catalog.jsonb_build_object('thread_id', v_thread, 'zalo_account_id', v_account, 'group_name', p_group_name));
  return v_row;
end;
$$;

revoke all on function public.link_student_zalo_group(uuid, text, text, text) from public, anon;
grant execute on function public.link_student_zalo_group(uuid, text, text, text) to authenticated;

create or replace function public.unlink_student_zalo_group(p_student_id uuid, p_reason text)
returns public.students
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_row public.students%rowtype;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('students.update') then raise exception using errcode = '42501', message = 'STUDENT_UPDATE_PERMISSION_DENIED'; end if;
  if v_reason is null then raise exception using errcode = '22023', message = 'REASON_REQUIRED'; end if;
  update public.students
  set zalo_group_thread_id = null, zalo_account_id = null, zalo_group_name_snapshot = null,
      zalo_group_linked_at = null, zalo_group_linked_by = null
  where id = p_student_id
  returning * into v_row;
  if not found then raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND'; end if;
  update public.parent_messages
  set status = 'skipped', skipped_at = pg_catalog.now(), skipped_by = actor_id, skip_reason = 'Đã gỡ liên kết nhóm Zalo: ' || v_reason
  where student_id = p_student_id and status = 'queued';
  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, reason)
  values (actor_id, 'students', 'student_zalo_group_unlinked', 'student', p_student_id::text, v_reason);
  return v_row;
end;
$$;

revoke all on function public.unlink_student_zalo_group(uuid, text) from public, anon;
grant execute on function public.unlink_student_zalo_group(uuid, text) to authenticated;

create or replace function public.update_parent_message_content(p_message_id uuid, p_content text)
returns public.parent_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_content text := pg_catalog.btrim(coalesce(p_content, ''));
  v_row public.parent_messages%rowtype;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('attendance.mark') then raise exception using errcode = '42501', message = 'ATTENDANCE_MARK_PERMISSION_DENIED'; end if;
  if v_content = '' or pg_catalog.length(v_content) > 2000 then raise exception using errcode = '22023', message = 'PARENT_MESSAGE_CONTENT_INVALID'; end if;
  update public.parent_messages
  set content = v_content, content_edited_by = actor_id
  where id = p_message_id and status = 'queued'
  returning * into v_row;
  if not found then raise exception using errcode = '23514', message = 'PARENT_MESSAGE_NOT_QUEUED'; end if;
  return v_row;
end;
$$;

revoke all on function public.update_parent_message_content(uuid, text) from public, anon;
grant execute on function public.update_parent_message_content(uuid, text) to authenticated;

create or replace function public.skip_parent_message(p_message_id uuid, p_reason text)
returns public.parent_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_row public.parent_messages%rowtype;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('attendance.mark') then raise exception using errcode = '42501', message = 'ATTENDANCE_MARK_PERMISSION_DENIED'; end if;
  if v_reason is null or pg_catalog.length(v_reason) > 500 then raise exception using errcode = '22023', message = 'REASON_REQUIRED'; end if;
  update public.parent_messages
  set status = 'skipped', skipped_at = pg_catalog.now(), skipped_by = actor_id, skip_reason = v_reason
  where id = p_message_id and status in ('queued', 'failed')
  returning * into v_row;
  if not found then raise exception using errcode = '23514', message = 'PARENT_MESSAGE_NOT_QUEUED'; end if;
  return v_row;
end;
$$;

revoke all on function public.skip_parent_message(uuid, text) from public, anon;
grant execute on function public.skip_parent_message(uuid, text) to authenticated;

-- Trợ giảng bấm Gửi: ứng dụng gọi ZaloCRM rồi ghi kết quả. Tin failed được gửi lại.
create or replace function public.record_parent_message_result(
  p_message_id uuid,
  p_success boolean,
  p_provider_message_id text default null,
  p_error_message text default null
)
returns public.parent_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_row public.parent_messages%rowtype;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('attendance.mark') then raise exception using errcode = '42501', message = 'ATTENDANCE_MARK_PERMISSION_DENIED'; end if;
  update public.parent_messages
  set
    status = case when p_success then 'sent' else 'failed' end,
    attempts = attempts + 1,
    sent_at = case when p_success then pg_catalog.now() else null end,
    sent_by = case when p_success then actor_id else sent_by end,
    provider_message_id = case when p_success then p_provider_message_id else provider_message_id end,
    error_message = case when p_success then null else pg_catalog.left(coalesce(p_error_message, 'Gửi thất bại'), 500) end
  where id = p_message_id and status in ('queued', 'failed')
  returning * into v_row;
  if not found then raise exception using errcode = '23514', message = 'PARENT_MESSAGE_NOT_QUEUED'; end if;
  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, new_data)
  values (actor_id, 'parent_messages', case when p_success then 'parent_message_sent' else 'parent_message_failed' end, 'parent_message', p_message_id::text,
    pg_catalog.jsonb_build_object('event_code', v_row.event_code, 'student_id', v_row.student_id, 'thread_id', v_row.thread_id, 'provider_message_id', p_provider_message_id, 'error', p_error_message));
  return v_row;
end;
$$;

revoke all on function public.record_parent_message_result(uuid, boolean, text, text) from public, anon;
grant execute on function public.record_parent_message_result(uuid, boolean, text, text) to authenticated;

create or replace function public.get_parent_message_queue(p_status text default 'queued', p_limit integer default 200)
returns table (
  message_id uuid,
  status text,
  event_code text,
  content text,
  thread_id text,
  zalo_account_id text,
  student_id uuid,
  student_name text,
  student_public_code text,
  zalo_group_name text,
  class_session_id uuid,
  class_code text,
  session_date date,
  start_time time,
  created_at timestamptz,
  sent_at timestamptz,
  sent_by_name text,
  error_message text,
  skip_reason text,
  attempts integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not (public.has_permission('attendance.view') or public.has_permission('attendance.mark')) then
    raise exception using errcode = '42501', message = 'ATTENDANCE_VIEW_PERMISSION_DENIED';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then raise exception using errcode = '22023', message = 'LIMIT_INVALID'; end if;
  return query
  select
    m.id, m.status, m.event_code, m.content, m.thread_id, m.zalo_account_id,
    s.id, s.full_name, s.public_code, s.zalo_group_name_snapshot,
    m.class_session_id, c.code, cs.session_date, cs.start_time,
    m.created_at, m.sent_at, coalesce(nullif(pg_catalog.btrim(p.display_name), ''), p.email),
    m.error_message, m.skip_reason, m.attempts
  from public.parent_messages as m
  join public.students as s on s.id = m.student_id
  left join public.class_sessions as cs on cs.id = m.class_session_id
  left join public.classes as c on c.id = cs.class_id
  left join public.profiles as p on p.id = m.sent_by
  where (p_status is null or p_status = 'all' or m.status = p_status)
  order by case m.status when 'queued' then 0 when 'failed' then 1 else 2 end, m.created_at desc
  limit p_limit;
end;
$$;

revoke all on function public.get_parent_message_queue(text, integer) from public, anon;
grant execute on function public.get_parent_message_queue(text, integer) to authenticated;

-- Tin chờ quá 3 ngày không còn thời sự.
create or replace function public.expire_stale_parent_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  update public.parent_messages
  set status = 'expired', skip_reason = 'Quá 3 ngày chưa gửi'
  where status = 'queued' and created_at < pg_catalog.now() - interval '3 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_stale_parent_messages() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'parent-messages-expire';
    perform cron.schedule('parent-messages-expire', '30 1 * * *', 'select public.expire_stale_parent_messages();');
  end if;
end;
$$;

comment on table public.parent_messages is 'Hàng đợi tin nhắn phụ huynh gửi vào nhóm Zalo sổ liên lạc qua ZaloCRM; trợ giảng bấm gửi.';

commit;
