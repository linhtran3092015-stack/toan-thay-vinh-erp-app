-- Tin Zalo nhận xét cuối buổi theo mẫu mới cho mọi buổi (kế hoạch chấm bài AI,
-- Giai đoạn 2b, mục 4.10). Không phụ thuộc AI: các ô {answer_text}, {solution}
-- và hậu tố "(đã cộng 1)" để trống tới Giai đoạn 3.
--
-- Quyết định chủ trung tâm 17/10/2026: mẫu tin dài có tiêu đề, họ tên, dòng Kết
-- quả (điểm luyện tập / điểm vở / xếp hạng), bài làm, bài chữa, nhận xét và thông
-- tin liên hệ; tin dài tách 2–3 tin gửi liền nhau; khóa Gửi tới khi có điểm vở;
-- trợ giảng tự điền tên + SĐT trợ giảng giám thị; chỉ owner sửa mẫu.
--
-- 1. Cài đặt: zalo.comment_template (mẫu mới, tối đa 3.000 ký tự) và
--    zalo.comment_footer (thông tin cuối, tối đa 1.500 ký tự).
-- 2. grading_rank_bands: thang xếp hạng theo khoảng điểm, chỉ settings.manage sửa.
-- 3. session_message_contacts: trợ giảng giám thị + SĐT thắc mắc bài chấm theo
--    buổi, trợ giảng (attendance.mark) tự điền.
-- 4. parent_messages: nội dung tối đa 6.000 ký tự; parts_total / parts_sent /
--    provider_message_ids để gửi lại đi tiếp từ phần lỗi; khóa gửi đồng thời.
-- 5. Dựng tin: mục / dòng / phần trống tự ẩn cùng nhãn (render_comment_message).
--    Tin còn chờ (chưa sửa tay, chưa gửi phần nào) dựng lại khi đổi kết quả,
--    thông tin giám thị, mẫu tin hoặc thang xếp hạng.
-- 6. Gửi: begin_parent_message_send chặn khi chưa có điểm vở / chưa điền giám
--    thị; record_parent_message_part ghi từng phần đã gửi.

begin;

-- ---------------------------------------------------------------------------
-- 1. Cài đặt mẫu tin
-- ---------------------------------------------------------------------------

alter table public.system_settings drop constraint system_settings_key_check;
alter table public.system_settings add constraint system_settings_key_check check (
  key = any (array[
    'center.display_name', 'teacher.display_name', 'center.contact_phone', 'center.contact_email', 'center.address',
    'coaching.default_public_link_expiry_days', 'sessions.auto_lock_after_days',
    'zalo.center_account_id', 'zalo.center_account_name', 'zalo.absence_message_enabled', 'zalo.comment_message_enabled',
    'zalo.absence_template', 'zalo.comment_template', 'zalo.comment_footer'
  ])
);

-- Mẫu cũ một dòng được thay cho mọi buổi (đã chốt); giá trị cũ giữ trong nhật ký.
insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
select null, 'settings', 'system_setting_default_replaced', 'system_setting', 'zalo.comment_template', value, null,
  'Thay mẫu tin nhận xét cuối buổi bằng mẫu mới (quyết định 17/10/2026)'
from public.system_settings
where key = 'zalo.comment_template';

insert into public.system_settings (key, value) values
  ('zalo.comment_template', to_jsonb($tpl$THẦY VINH VÀ THẦY CÔ CỘNG SỰ KÍNH GỬI PHỤ HUYNH NHẬN XÉT TÌNH HÌNH CỦA CON BUỔI HỌC NGÀY {date}

- Tên học sinh: {student_full_name}
- Kết quả: Điểm luyện tập cuối buổi: {test_score} - Điểm vở: {notebook_score} - Xếp hạng: {rank}

- Bài làm của học sinh:
{answer_text}

- Bài chữa chi tiết của thầy cô:
{solution}

- Nhận xét cho học sinh:
{comment}

{footer}$tpl$::text)),
  ('zalo.comment_footer', to_jsonb($ftr$Chủ nhiệm CLB: Thầy Lã Quang Vinh
Trợ giảng Giám thị: {supervisor_name}
SĐT thắc mắc bài chấm: {grading_contact_phone}
SĐT các thầy cô hỗ trợ:
   Thầy Linh: 077 88878 64
   Thầy Phương: 093 698 4828
   Cô Huyền: 036 356 0088
   Thầy Cô Trực Văn Phòng (18h-22h30 hàng ngày): 086 989 0233

- SĐT phản ánh nếu PH,HS không được hỗ trợ: Thầy Vinh 09666 49198$ftr$::text))
on conflict (key) do update set value = excluded.value, updated_at = pg_catalog.now(), updated_by = null;

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
      'zalo.absence_template', 'zalo.comment_template', 'zalo.comment_footer'
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
      -- Mẫu tin giữ nguyên thụt đầu dòng (thông tin cuối), chỉ bỏ dòng trống / khoảng trắng hai đầu.
      v_text := case when v_key in ('zalo.comment_template', 'zalo.comment_footer')
        then pg_catalog.btrim(pg_catalog.replace(v_value #>> '{}', E'\r\n', E'\n'), E' \t\r\n')
        else pg_catalog.btrim(v_value #>> '{}') end;
      if (v_key in ('center.display_name', 'teacher.display_name') and (v_text = '' or pg_catalog.length(v_text) > 160))
        or (v_key = 'center.address' and pg_catalog.length(v_text) > 500)
        or (v_key in ('center.contact_phone', 'center.contact_email') and pg_catalog.length(v_text) > 160)
        or (v_key = 'center.contact_email' and v_text <> '' and v_text !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
        or (v_key in ('zalo.center_account_id', 'zalo.center_account_name') and pg_catalog.length(v_text) > 200)
        or (v_key in ('zalo.absence_message_enabled', 'zalo.comment_message_enabled') and v_text not in ('on', 'off'))
        or (v_key = 'zalo.absence_template' and (v_text = '' or pg_catalog.length(v_text) > 1000))
        or (v_key = 'zalo.comment_template' and (v_text = '' or pg_catalog.length(v_text) > 3000))
        or (v_key = 'zalo.comment_footer' and pg_catalog.length(v_text) > 1500)
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

  -- Tin nhận xét còn chờ (chưa sửa tay) theo mẫu mới.
  if p_values ? 'zalo.comment_template' or p_values ? 'zalo.comment_footer' then
    perform public.refresh_queued_session_comment_messages(null);
  end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Thang xếp hạng
-- ---------------------------------------------------------------------------

create table public.grading_rank_bands (
  id uuid primary key default gen_random_uuid(),
  min_score numeric(4, 2) not null unique check (min_score between 0 and 10),
  label text not null check (label = pg_catalog.btrim(label) and label <> '' and pg_catalog.length(label) <= 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  updated_by uuid references public.profiles(id) on delete restrict
);

insert into public.grading_rank_bands (min_score, label, sort_order) values
  (0, 'Tiến bộ ít', 1),
  (5, 'Tiến bộ vừa', 2),
  (8, 'Tiến bộ', 3),
  (9, 'Tiến bộ nhiều', 4),
  (10, 'Rất tiến bộ', 5);

alter table public.grading_rank_bands enable row level security;
create policy grading_rank_bands_select on public.grading_rank_bands for select to authenticated
  using (public.has_permission('settings.view') or public.has_permission('results.view') or public.has_permission('results.manage'));
revoke all privileges on public.grading_rank_bands from public, anon, authenticated;
grant select on public.grading_rank_bands to authenticated;

-- Xếp theo khoảng: band có min_score lớn nhất không vượt điểm (8,5 → band 8).
create or replace function public.grading_rank_label(p_score numeric)
returns text
language sql
stable
set search_path = ''
as $$
  select band.label
  from public.grading_rank_bands as band
  where p_score is not null and band.min_score <= p_score
  order by band.min_score desc
  limit 1;
$$;

revoke all on function public.grading_rank_label(numeric) from public, anon, authenticated;

-- Thay cả thang (owner). p_bands: [{"min_score": 0, "label": "..."}, ...], phải có mốc 0.
create or replace function public.set_grading_rank_bands(p_bands jsonb)
returns setof public.grading_rank_bands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old jsonb;
  v_item jsonb;
  v_score numeric;
  v_label text;
  v_seen numeric[] := '{}';
  v_index integer := 0;
begin
  if v_actor is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('settings.manage') then raise exception using errcode = '42501', message = 'SYSTEM_SETTINGS_PERMISSION_DENIED'; end if;
  if pg_catalog.jsonb_typeof(p_bands) <> 'array' or pg_catalog.jsonb_array_length(p_bands) not between 1 and 10 then
    raise exception using errcode = '22023', message = 'GRADING_RANK_BANDS_INVALID';
  end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_bands) loop
    if pg_catalog.jsonb_typeof(v_item -> 'min_score') <> 'number' or pg_catalog.jsonb_typeof(v_item -> 'label') <> 'string' then
      raise exception using errcode = '22023', message = 'GRADING_RANK_BANDS_INVALID';
    end if;
    v_score := (v_item ->> 'min_score')::numeric;
    v_label := pg_catalog.btrim(v_item ->> 'label');
    if v_score < 0 or v_score > 10 or v_score <> pg_catalog.round(v_score, 2) or v_score = any (v_seen)
      or v_label = '' or pg_catalog.length(v_label) > 80 then
      raise exception using errcode = '22023', message = 'GRADING_RANK_BANDS_INVALID';
    end if;
    v_seen := v_seen || v_score;
  end loop;
  if not (0 = any (v_seen)) then
    raise exception using errcode = '22023', message = 'GRADING_RANK_BANDS_NEED_ZERO';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('min_score', min_score, 'label', label) order by min_score), '[]'::jsonb)
  into v_old from public.grading_rank_bands;

  delete from public.grading_rank_bands where true;
  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_bands) order by (value ->> 'min_score')::numeric
  loop
    v_index := v_index + 1;
    insert into public.grading_rank_bands (min_score, label, sort_order, updated_by)
    values ((v_item ->> 'min_score')::numeric, pg_catalog.btrim(v_item ->> 'label'), v_index, v_actor);
  end loop;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data)
  values (v_actor, 'settings', 'grading_rank_bands_updated', 'grading_rank_bands', 'grading_rank_bands', v_old, p_bands);

  perform public.refresh_queued_session_comment_messages(null);

  return query select * from public.grading_rank_bands order by min_score;
end;
$$;

revoke all on function public.set_grading_rank_bands(jsonb) from public, anon;
grant execute on function public.set_grading_rank_bands(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Trợ giảng giám thị theo buổi
-- ---------------------------------------------------------------------------

create table public.session_message_contacts (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null unique references public.class_sessions(id) on delete cascade,
  supervisor_name text not null check (supervisor_name = pg_catalog.btrim(supervisor_name) and supervisor_name <> '' and pg_catalog.length(supervisor_name) <= 120),
  grading_contact_phone text not null check (
    grading_contact_phone = pg_catalog.btrim(grading_contact_phone)
    and grading_contact_phone ~ '^[0-9+(). -]+$'
    and pg_catalog.length(pg_catalog.regexp_replace(grading_contact_phone, '[^0-9]', '', 'g')) between 8 and 15
    and pg_catalog.length(grading_contact_phone) <= 30
  ),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default pg_catalog.now()
);

-- Điền sẵn theo lần điền gần nhất của chính trợ giảng.
create index session_message_contacts_updated_by_idx on public.session_message_contacts (updated_by, updated_at desc);

alter table public.session_message_contacts enable row level security;
create policy session_message_contacts_select on public.session_message_contacts for select to authenticated
  using (public.has_permission('attendance.view') or public.has_permission('attendance.mark'));
revoke all privileges on public.session_message_contacts from public, anon, authenticated;
grant select on public.session_message_contacts to authenticated;

create or replace function public.set_session_message_contact(
  p_class_session_id uuid,
  p_supervisor_name text,
  p_grading_contact_phone text
)
returns public.session_message_contacts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_supervisor_name, '')), '\s+', ' ', 'g');
  v_phone text := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_grading_contact_phone, '')), '\s+', ' ', 'g');
  v_old public.session_message_contacts%rowtype;
  v_row public.session_message_contacts%rowtype;
begin
  if v_actor is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('attendance.mark') then raise exception using errcode = '42501', message = 'ATTENDANCE_MARK_PERMISSION_DENIED'; end if;
  if v_name = '' or pg_catalog.length(v_name) > 120 then
    raise exception using errcode = '22023', message = 'SESSION_MESSAGE_CONTACT_NAME_INVALID';
  end if;
  if v_phone !~ '^[0-9+(). -]+$' or pg_catalog.length(v_phone) > 30
    or pg_catalog.length(pg_catalog.regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 8 and 15 then
    raise exception using errcode = '22023', message = 'SESSION_MESSAGE_CONTACT_PHONE_INVALID';
  end if;
  if not exists (select 1 from public.class_sessions where id = p_class_session_id) then
    raise exception using errcode = 'P0002', message = 'SESSION_NOT_FOUND';
  end if;

  select * into v_old from public.session_message_contacts where class_session_id = p_class_session_id for update;
  insert into public.session_message_contacts (class_session_id, supervisor_name, grading_contact_phone, created_by, updated_by)
  values (p_class_session_id, v_name, v_phone, v_actor, v_actor)
  on conflict (class_session_id) do update
    set supervisor_name = excluded.supervisor_name,
        grading_contact_phone = excluded.grading_contact_phone,
        updated_by = v_actor,
        updated_at = pg_catalog.now()
  returning * into v_row;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data)
  values (v_actor, 'parent_messages', 'session_message_contact_updated', 'class_session', p_class_session_id::text,
    case when v_old.id is null then null else pg_catalog.jsonb_build_object('supervisor_name', v_old.supervisor_name, 'grading_contact_phone', v_old.grading_contact_phone) end,
    pg_catalog.jsonb_build_object('supervisor_name', v_row.supervisor_name, 'grading_contact_phone', v_row.grading_contact_phone));

  perform public.refresh_queued_session_comment_messages(p_class_session_id);
  return v_row;
end;
$$;

revoke all on function public.set_session_message_contact(uuid, text, text) from public, anon;
grant execute on function public.set_session_message_contact(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Hàng đợi: tin dài và gửi nhiều phần
-- ---------------------------------------------------------------------------

alter table public.parent_messages drop constraint parent_messages_content_check;
alter table public.parent_messages add constraint parent_messages_content_check
  check (content = pg_catalog.btrim(content) and content <> '' and pg_catalog.length(content) <= 6000);

alter table public.parent_messages
  add column parts_total integer check (parts_total between 1 and 3),
  add column parts_sent integer not null default 0 check (parts_sent between 0 and 3),
  add column provider_message_ids text[] not null default '{}',
  add column sending_until timestamptz,
  add column sending_by uuid references public.profiles(id) on delete restrict,
  add constraint parent_messages_parts_progress_check check (
    (parts_total is null and parts_sent = 0) or (parts_total is not null and parts_sent <= parts_total)
  ),
  add constraint parent_messages_provider_ids_check check (pg_catalog.cardinality(provider_message_ids) = parts_sent);

comment on column public.parent_messages.parts_total is 'Số tin Zalo khi tách (≤ 2.000 ký tự/tin), chốt ở lần bấm Gửi đầu tiên.';
comment on column public.parent_messages.parts_sent is 'Số phần đã gửi thành công; gửi lại đi tiếp từ phần parts_sent + 1.';
comment on column public.parent_messages.provider_message_ids is 'Mã tin ZaloCRM của từng phần đã gửi, theo thứ tự.';

-- Một tin chỉ tự cập nhật khi chưa gửi xong (chờ hoặc lỗi), chưa sửa tay, chưa gửi phần
-- nào và không đang gửi.
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
    set content = case when public.parent_messages.status in ('queued', 'failed')
                         and public.parent_messages.content_edited_by is null
                         and public.parent_messages.parts_sent = 0
                         and (public.parent_messages.sending_until is null or public.parent_messages.sending_until < pg_catalog.now())
                       then excluded.content else public.parent_messages.content end
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enqueue_parent_message(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;

create or replace function public.update_parent_message_content(p_message_id uuid, p_content text)
returns public.parent_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_content text := pg_catalog.btrim(pg_catalog.replace(coalesce(p_content, ''), E'\r\n', E'\n'), E' \t\r\n');
  v_row public.parent_messages%rowtype;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('attendance.mark') then raise exception using errcode = '42501', message = 'ATTENDANCE_MARK_PERMISSION_DENIED'; end if;
  if v_content = '' or pg_catalog.length(v_content) > 6000 then raise exception using errcode = '22023', message = 'PARENT_MESSAGE_CONTENT_INVALID'; end if;
  select * into v_row from public.parent_messages where id = p_message_id for update;
  if not found or v_row.status not in ('queued', 'failed') then raise exception using errcode = '23514', message = 'PARENT_MESSAGE_NOT_QUEUED'; end if;
  if v_row.sending_until is not null and v_row.sending_until > pg_catalog.now() then
    raise exception using errcode = '55P03', message = 'PARENT_MESSAGE_SENDING';
  end if;
  if v_row.parts_sent > 0 then raise exception using errcode = '23514', message = 'PARENT_MESSAGE_PARTIALLY_SENT'; end if;
  update public.parent_messages
  set content = v_content, content_edited_by = actor_id
  where id = p_message_id
  returning * into v_row;
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
  select * into v_row from public.parent_messages where id = p_message_id for update;
  if not found or v_row.status not in ('queued', 'failed') then raise exception using errcode = '23514', message = 'PARENT_MESSAGE_NOT_QUEUED'; end if;
  if v_row.sending_until is not null and v_row.sending_until > pg_catalog.now() then
    raise exception using errcode = '55P03', message = 'PARENT_MESSAGE_SENDING';
  end if;
  update public.parent_messages
  set status = 'skipped', skipped_at = pg_catalog.now(), skipped_by = actor_id, skip_reason = v_reason
  where id = p_message_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.skip_parent_message(uuid, text) from public, anon;
grant execute on function public.skip_parent_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Dựng tin nhận xét
-- ---------------------------------------------------------------------------

-- 0 = không có ô dữ liệu đã biết, 1 = có ô có giá trị, 2 = mọi ô đều trống.
create or replace function public.comment_template_state(p_text text, p_vars jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.count(*) filter (where p_vars ? hit.parts[1]) = 0 then 0
    when pg_catalog.bool_or(p_vars ? hit.parts[1] and pg_catalog.btrim(coalesce(p_vars ->> hit.parts[1], ''), E' \t\r\n') <> '') then 1
    else 2
  end
  from pg_catalog.regexp_matches(coalesce(p_text, ''), '\{([a-z_]+)\}', 'g') as hit(parts);
$$;

revoke all on function public.comment_template_state(text, jsonb) from public, anon, authenticated;

-- Thay ô dữ liệu trong một lượt (giá trị chứa "{...}" không bị thay tiếp). Ô lạ giữ nguyên.
create or replace function public.comment_template_fill(p_text text, p_vars jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_pieces text[] := pg_catalog.regexp_split_to_array(coalesce(p_text, ''), '\{[a-z_]+\}');
  v_keys text[];
  v_out text;
  v_index integer;
begin
  select coalesce(pg_catalog.array_agg(hit.parts[1] order by hit.n), '{}')
  into v_keys
  from pg_catalog.regexp_matches(coalesce(p_text, ''), '\{([a-z_]+)\}', 'g') with ordinality as hit(parts, n);
  v_out := v_pieces[1];
  for v_index in 1 .. coalesce(pg_catalog.array_length(v_keys, 1), 0) loop
    v_out := v_out
      || case when p_vars ? v_keys[v_index]
           then pg_catalog.btrim(coalesce(p_vars ->> v_keys[v_index], ''), E' \t\r\n')
           else '{' || v_keys[v_index] || '}' end
      || v_pieces[v_index + 1];
  end loop;
  return v_out;
end;
$$;

revoke all on function public.comment_template_fill(text, jsonb) from public, anon, authenticated;

-- Mục trống tự ẩn (bản sao TypeScript: src/features/parent-messages/comment-template.ts).
-- {footer} được thay bằng thông tin cuối trước, rồi xét từng đoạn (cách nhau bằng dòng trống):
--   1. Dòng có ô dữ liệu mà mọi ô đều trống → ẩn dòng.
--   2. Dòng nhãn (không có ô dữ liệu, kết thúc bằng ":") → ẩn khi các dòng ngay dưới nó
--      (tới dòng nhãn kế tiếp hoặc hết đoạn) có ô dữ liệu và đều đã bị ẩn.
--   3. Trong dòng còn lại, sau nhãn đầu dòng ("- Kết quả: "), phần cách nhau bằng " - "
--      có ô dữ liệu mà mọi ô đều trống → ẩn phần đó.
--   4. Đoạn không còn dòng nào → ẩn. Dòng không có ô dữ liệu giữ nguyên.
create or replace function public.render_comment_message(p_template text, p_footer text, p_vars jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_source text := pg_catalog.replace(
    pg_catalog.replace(coalesce(p_template, ''), E'\r\n', E'\n'),
    '{footer}',
    pg_catalog.btrim(pg_catalog.replace(coalesce(p_footer, ''), E'\r\n', E'\n'), E' \t\r\n')
  );
  v_vars jsonb := coalesce(p_vars, '{}'::jsonb) - 'footer';
  v_block text;
  v_lead text;
  v_part text;
  v_lines text[];
  v_states integer[];
  v_keep boolean[];
  v_is_label boolean[];
  v_has_data boolean;
  v_any_kept boolean;
  v_count integer;
  v_index integer;
  v_next integer;
  v_blocks_out text[] := '{}';
  v_lines_out text[];
  v_parts_out text[];
  v_out text;
begin
  foreach v_block in array pg_catalog.regexp_split_to_array(v_source, '\n([ \t]*\n)+') loop
    if pg_catalog.btrim(v_block, E' \t\n') = '' then
      continue;
    end if;
    v_lines := pg_catalog.string_to_array(v_block, E'\n');
    v_count := pg_catalog.cardinality(v_lines);
    v_states := '{}';
    v_keep := '{}';
    v_is_label := '{}';
    for v_index in 1 .. v_count loop
      v_states := v_states || public.comment_template_state(v_lines[v_index], v_vars);
      v_keep := v_keep || (v_states[v_index] <> 2);
      v_is_label := v_is_label || (v_states[v_index] = 0 and pg_catalog.right(pg_catalog.rtrim(v_lines[v_index], E' \t'), 1) = ':');
    end loop;

    for v_index in 1 .. v_count loop
      if v_is_label[v_index] then
        v_has_data := false;
        v_any_kept := false;
        v_next := v_index + 1;
        while v_next <= v_count and not v_is_label[v_next] loop
          v_has_data := v_has_data or v_states[v_next] <> 0;
          v_any_kept := v_any_kept or v_keep[v_next];
          v_next := v_next + 1;
        end loop;
        if v_has_data and not v_any_kept then
          v_keep[v_index] := false;
        end if;
      end if;
    end loop;

    v_lines_out := '{}';
    for v_index in 1 .. v_count loop
      if not v_keep[v_index] then
        continue;
      end if;
      if v_states[v_index] = 0 then
        v_lines_out := v_lines_out || v_lines[v_index];
        continue;
      end if;
      v_lead := coalesce(pg_catalog.substring(v_lines[v_index], '^([^{}:]*:[ \t]*)'), '');
      v_parts_out := '{}';
      foreach v_part in array pg_catalog.string_to_array(pg_catalog.substr(v_lines[v_index], pg_catalog.length(v_lead) + 1), ' - ') loop
        if public.comment_template_state(v_part, v_vars) <> 2 then
          v_parts_out := v_parts_out || public.comment_template_fill(v_part, v_vars);
        end if;
      end loop;
      v_lines_out := v_lines_out || (v_lead || pg_catalog.array_to_string(v_parts_out, ' - '));
    end loop;
    if pg_catalog.cardinality(v_lines_out) > 0 then
      v_blocks_out := v_blocks_out || pg_catalog.array_to_string(v_lines_out, E'\n');
    end if;
  end loop;

  v_out := pg_catalog.regexp_replace(pg_catalog.array_to_string(v_blocks_out, E'\n\n'), '[ \t]+(\n|$)', '\1', 'g');
  return pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(v_out, E' \t\r\n'), 6000), E' \t\r\n');
end;
$$;

revoke all on function public.render_comment_message(text, text, jsonb) from public, anon, authenticated;

-- Điểm dạng Việt Nam: 8.50 → "8,5", 9.00 → "9".
create or replace function public.format_message_score(p_score numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_score is null then ''
    when p_score = pg_catalog.trunc(p_score) then pg_catalog.trunc(p_score)::text
    else pg_catalog.replace(pg_catalog.rtrim(p_score::text, '0'), '.', ',')
  end;
$$;

revoke all on function public.format_message_score(numeric) from public, anon, authenticated;

create or replace function public.session_comment_message_vars(p_result_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.parent_message_vars(result.student_id, result.class_session_id)
    || pg_catalog.jsonb_build_object(
      'comment', coalesce(pg_catalog.btrim(result.comment), ''),
      -- Ô cũ của mẫu một dòng, giữ cho mẫu tự soạn còn dùng.
      'scores', concat_ws('',
        case when result.test_score is not null then ' Điểm kiểm tra: ' || pg_catalog.rtrim(pg_catalog.rtrim(result.test_score::text, '0'), '.') || '.' end,
        case when result.notebook_score is not null then ' Điểm vở: ' || pg_catalog.rtrim(pg_catalog.rtrim(result.notebook_score::text, '0'), '.') || '.' end),
      'test_score', public.format_message_score(result.test_score),
      'notebook_score', public.format_message_score(result.notebook_score),
      'rank', coalesce(public.grading_rank_label(result.test_score), ''),
      -- Bài làm và bài chữa đến từ chấm AI (Giai đoạn 3).
      'answer_text', '',
      'solution', '',
      'supervisor_name', coalesce(contact.supervisor_name, ''),
      'grading_contact_phone', coalesce(contact.grading_contact_phone, '')
    )
  from public.session_results as result
  left join public.session_message_contacts as contact on contact.class_session_id = result.class_session_id
  where result.id = p_result_id;
$$;

revoke all on function public.session_comment_message_vars(uuid) from public, anon, authenticated;

-- Null khi không có kết quả hoặc chưa có nhận xét (chỉ nhận xét mới tạo tin, như trước).
create or replace function public.render_session_comment_message(p_result_id uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_comment text;
begin
  select comment into v_comment from public.session_results where id = p_result_id;
  if v_comment is null or pg_catalog.btrim(v_comment) = '' then
    return null;
  end if;
  return nullif(public.render_comment_message(
    public.system_setting_text('zalo.comment_template', ''),
    public.system_setting_text('zalo.comment_footer', ''),
    public.session_comment_message_vars(p_result_id)
  ), '');
end;
$$;

revoke all on function public.render_session_comment_message(uuid) from public, anon, authenticated;

-- Dựng lại tin nhận xét chưa gửi (chờ hoặc lỗi, chưa sửa tay, chưa gửi phần nào, không
-- đang gửi). Điều kiện lặp lại trên dòng được cập nhật: khi tranh chấp, Postgres chỉ
-- kiểm tra lại WHERE ngoài.
create or replace function public.refresh_queued_session_comment_messages(p_class_session_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.parent_messages as message
  set content = rendered.content
  from (
    select candidate.id, public.render_session_comment_message(candidate.source_id) as content
    from public.parent_messages as candidate
    where candidate.event_code = 'session.comment'
      and candidate.status in ('queued', 'failed')
      and candidate.content_edited_by is null
      and candidate.parts_sent = 0
      and (candidate.sending_until is null or candidate.sending_until < pg_catalog.now())
      and (p_class_session_id is null or candidate.class_session_id = p_class_session_id)
  ) as rendered
  where message.id = rendered.id
    and message.status in ('queued', 'failed')
    and message.content_edited_by is null
    and message.parts_sent = 0
    and (message.sending_until is null or message.sending_until < pg_catalog.now())
    and rendered.content is not null
    and rendered.content is distinct from message.content;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.refresh_queued_session_comment_messages(uuid) from public, anon, authenticated;

create or replace function public.parent_message_on_session_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.comment is null or pg_catalog.btrim(new.comment) = '' then
    if tg_op = 'UPDATE' then
      update public.parent_messages
      set status = 'skipped', skipped_at = pg_catalog.now(), skip_reason = 'Nhận xét đã bị xóa'
      where dedupe_key = 'session.comment:' || new.id::text
        and status in ('queued', 'failed') and parts_sent = 0
        and (sending_until is null or sending_until < pg_catalog.now());
    end if;
    return new;
  end if;
  if public.system_setting_text('zalo.comment_message_enabled', 'on') <> 'on' then
    return new;
  end if;
  perform public.enqueue_parent_message(
    new.student_id, new.class_session_id, 'session.comment', 'session_result', new.id,
    public.render_session_comment_message(new.id)
  );
  return new;
end;
$$;

revoke all on function public.parent_message_on_session_result() from public, anon, authenticated;

drop trigger session_results_parent_message on public.session_results;
create trigger session_results_parent_message
after insert or update of comment, test_score, notebook_score, notebook_status on public.session_results
for each row execute function public.parent_message_on_session_result();

-- ---------------------------------------------------------------------------
-- 6. Gửi nhiều phần và khóa Gửi
-- ---------------------------------------------------------------------------

-- Null khi gửi được. Tin nhận xét cần điểm vở (trừ khi "không yêu cầu vở") và,
-- nếu mẫu dùng ô giám thị, thông tin trợ giảng giám thị của buổi.
create or replace function public.parent_message_send_block_reason(p_message_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when message.event_code <> 'session.comment' then null else nullif(concat_ws('; ',
    case
      when result.id is null then 'Không tìm thấy kết quả buổi học'
      when result.notebook_score is null and result.notebook_status <> 'not_required' then 'Chưa có điểm vở'
    end,
    case
      when contact.id is null
        and (
          public.system_setting_text('zalo.comment_template', '') ~ '\{(supervisor_name|grading_contact_phone)\}'
          or (public.system_setting_text('zalo.comment_template', '') like '%{footer}%'
              and public.system_setting_text('zalo.comment_footer', '') ~ '\{(supervisor_name|grading_contact_phone)\}')
        )
      then 'Chưa điền trợ giảng giám thị'
    end
  ), '') end
  from public.parent_messages as message
  left join public.session_results as result on result.id = message.source_id and message.source_type = 'session_result'
  left join public.session_message_contacts as contact on contact.class_session_id = message.class_session_id
  where message.id = p_message_id;
$$;

revoke all on function public.parent_message_send_block_reason(uuid) from public, anon, authenticated;

-- Bắt đầu (hoặc tiếp tục) gửi: kiểm tra khóa Gửi, chốt số phần, giữ khóa 2 phút để
-- hai người không gửi trùng. Ứng dụng gửi từ phần parts_sent + 1. p_content_md5 là
-- md5 của đúng nội dung ứng dụng đã tách: nội dung vừa đổi thì từ chối, không giữ khóa.
create or replace function public.begin_parent_message_send(p_message_id uuid, p_parts_total integer, p_content_md5 text default null)
returns public.parent_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_row public.parent_messages%rowtype;
  v_reason text;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('attendance.mark') then raise exception using errcode = '42501', message = 'ATTENDANCE_MARK_PERMISSION_DENIED'; end if;
  select * into v_row from public.parent_messages where id = p_message_id for update;
  if not found or v_row.status not in ('queued', 'failed') then raise exception using errcode = '23514', message = 'PARENT_MESSAGE_NOT_QUEUED'; end if;
  if v_row.sending_until is not null and v_row.sending_until > pg_catalog.now() then
    raise exception using errcode = '55P03', message = 'PARENT_MESSAGE_SENDING';
  end if;
  if p_content_md5 is not null and pg_catalog.md5(v_row.content) <> p_content_md5 then
    raise exception using errcode = '40001', message = 'PARENT_MESSAGE_CONTENT_CHANGED';
  end if;
  if p_parts_total is null or p_parts_total not between 1 and 3 then
    raise exception using errcode = '22023', message = 'PARENT_MESSAGE_TOO_LONG';
  end if;
  v_reason := public.parent_message_send_block_reason(p_message_id);
  if v_reason is not null then
    raise exception using errcode = '23514', message = 'PARENT_MESSAGE_SEND_BLOCKED', detail = v_reason;
  end if;
  if v_row.parts_sent > 0 and v_row.parts_total is distinct from p_parts_total then
    raise exception using errcode = '23514', message = 'PARENT_MESSAGE_PARTS_CHANGED';
  end if;
  update public.parent_messages
  set parts_total = p_parts_total, sending_until = pg_catalog.now() + interval '2 minutes', sending_by = actor_id
  where id = p_message_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.begin_parent_message_send(uuid, integer, text) from public, anon;
grant execute on function public.begin_parent_message_send(uuid, integer, text) to authenticated;

-- RPC cũ (bản ứng dụng trước 0.21, chỉ còn cho lúc deploy): không được ghi đè tin đã
-- đi theo luồng nhiều phần hoặc đang gửi.
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
  select * into v_row from public.parent_messages where id = p_message_id for update;
  if not found or v_row.status not in ('queued', 'failed') then raise exception using errcode = '23514', message = 'PARENT_MESSAGE_NOT_QUEUED'; end if;
  if v_row.parts_total is not null or (v_row.sending_until is not null and v_row.sending_until > pg_catalog.now()) then
    raise exception using errcode = '23514', message = 'PARENT_MESSAGE_USE_PARTS';
  end if;
  update public.parent_messages
  set
    status = case when p_success then 'sent' else 'failed' end,
    attempts = attempts + 1,
    sent_at = case when p_success then pg_catalog.now() else null end,
    sent_by = case when p_success then actor_id else sent_by end,
    provider_message_id = case when p_success then p_provider_message_id else provider_message_id end,
    error_message = case when p_success then null else pg_catalog.left(coalesce(p_error_message, 'Gửi thất bại'), 500) end
  where id = p_message_id
  returning * into v_row;
  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, new_data)
  values (actor_id, 'parent_messages', case when p_success then 'parent_message_sent' else 'parent_message_failed' end, 'parent_message', p_message_id::text,
    pg_catalog.jsonb_build_object('event_code', v_row.event_code, 'student_id', v_row.student_id, 'thread_id', v_row.thread_id, 'provider_message_id', p_provider_message_id, 'error', p_error_message));
  return v_row;
end;
$$;

revoke all on function public.record_parent_message_result(uuid, boolean, text, text) from public, anon;
grant execute on function public.record_parent_message_result(uuid, boolean, text, text) to authenticated;

-- Ghi kết quả một phần. Phần cuối thành công → sent; một phần lỗi → failed, lần
-- gửi lại đi tiếp từ phần đó.
create or replace function public.record_parent_message_part(
  p_message_id uuid,
  p_part_no integer,
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
  v_done boolean;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('attendance.mark') then raise exception using errcode = '42501', message = 'ATTENDANCE_MARK_PERMISSION_DENIED'; end if;
  select * into v_row from public.parent_messages where id = p_message_id for update;
  if not found or v_row.status not in ('queued', 'failed') or v_row.parts_total is null then
    raise exception using errcode = '23514', message = 'PARENT_MESSAGE_NOT_QUEUED';
  end if;
  if v_row.sending_by is distinct from actor_id or v_row.sending_until is null then
    raise exception using errcode = '55P03', message = 'PARENT_MESSAGE_NOT_SENDING';
  end if;
  if p_part_no is distinct from v_row.parts_sent + 1 then
    raise exception using errcode = '22023', message = 'PARENT_MESSAGE_PART_OUT_OF_ORDER';
  end if;

  if p_success then
    v_done := p_part_no = v_row.parts_total;
    update public.parent_messages
    set
      parts_sent = p_part_no,
      provider_message_ids = provider_message_ids || coalesce(p_provider_message_id, ''),
      provider_message_id = coalesce(provider_message_id, p_provider_message_id),
      status = case when v_done then 'sent' else status end,
      sent_at = case when v_done then pg_catalog.now() else sent_at end,
      sent_by = case when v_done then actor_id else sent_by end,
      attempts = case when v_done then attempts + 1 else attempts end,
      error_message = case when v_done then null else error_message end,
      sending_until = case when v_done then null else pg_catalog.now() + interval '2 minutes' end,
      sending_by = case when v_done then null else sending_by end
    where id = p_message_id
    returning * into v_row;
  else
    v_done := true;
    update public.parent_messages
    set
      status = 'failed',
      attempts = attempts + 1,
      error_message = pg_catalog.left(
        case when v_row.parts_total > 1 then 'Phần ' || p_part_no || '/' || v_row.parts_total || ': ' else '' end
          || coalesce(p_error_message, 'Gửi thất bại'), 500),
      sending_until = null,
      sending_by = null
    where id = p_message_id
    returning * into v_row;
  end if;

  if v_done then
    insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, new_data)
    values (actor_id, 'parent_messages', case when p_success then 'parent_message_sent' else 'parent_message_failed' end, 'parent_message', p_message_id::text,
      pg_catalog.jsonb_build_object('event_code', v_row.event_code, 'student_id', v_row.student_id, 'thread_id', v_row.thread_id,
        'parts_total', v_row.parts_total, 'parts_sent', v_row.parts_sent, 'provider_message_ids', pg_catalog.to_jsonb(v_row.provider_message_ids),
        'error', case when p_success then null else p_error_message end));
  end if;
  return v_row;
end;
$$;

revoke all on function public.record_parent_message_part(uuid, integer, boolean, text, text) from public, anon;
grant execute on function public.record_parent_message_part(uuid, integer, boolean, text, text) to authenticated;

drop function public.get_parent_message_queue(text, integer);
create function public.get_parent_message_queue(p_status text default 'queued', p_limit integer default 200)
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
  attempts integer,
  parts_total integer,
  parts_sent integer,
  send_block_reason text,
  content_edited boolean
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
    m.error_message, m.skip_reason, m.attempts,
    m.parts_total, m.parts_sent,
    case when m.status in ('queued', 'failed') then public.parent_message_send_block_reason(m.id) end,
    m.content_edited_by is not null
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

-- Tin nhận xét đang chờ chuyển sang mẫu mới.
select public.refresh_queued_session_comment_messages(null);

comment on table public.grading_rank_bands is 'Thang xếp hạng theo điểm cuối buổi (khoảng: min_score ≤ điểm < mốc kế tiếp); chỉ owner sửa.';
comment on table public.session_message_contacts is 'Trợ giảng giám thị và SĐT thắc mắc bài chấm theo buổi, dùng trong tin Zalo nhận xét.';

commit;
