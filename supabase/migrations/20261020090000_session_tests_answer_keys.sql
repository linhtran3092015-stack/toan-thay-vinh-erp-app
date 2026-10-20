-- Chấm bài AI, Giai đoạn 2 "Đề & đáp án" (docs/AI_GRADING_INTEGRATION_PLAN_2026-10-16.md §3 bước 1–3,
-- §4.1, §4.4, §4.6, §4.7, §4.9, §9).
--
-- Trợ giảng tải ảnh đề lên buổi học, nhập (hoặc sau này để AI đề xuất) đáp án từng câu rồi chốt.
-- AI chỉ chấm theo đáp án đã chốt (Giai đoạn 3). Quyết định đã chốt:
--   * trợ giảng được chốt đáp án (§9 dòng 4);
--   * mỗi câu đúng trọn điểm hoặc sai, nên đáp án không có điểm từng phần (§9 dòng 2);
--   * chốt khi tổng điểm các câu đúng bằng 10;
--   * sửa sau khi chốt tạo phiên bản mới (answer_key_version + 1), ghi nhật ký kèm lý do.
--
-- 1. Quyền ai_grading.manage_tests (tải đề, sửa nháp, dùng lại đề, AI đọc đề) và
--    ai_grading.confirm_key (chốt đáp án), cấp cho owner, quản lý vận hành, quản lý trợ lý, trợ giảng.
-- 2. Bảng session_tests (đề của một buổi), session_test_assets (ảnh đề), grading_runs (mỗi lần
--    gọi AI; giai đoạn này chỉ dùng loại extract_key, chưa có tiến trình nền gọi Claude).
-- 3. Bucket Storage riêng tư session-tests (lần đầu repo dùng Storage) và policy trên
--    storage.objects theo quyền. Ảnh xem qua link ký ngắn hạn. Đường dẫn ảnh:
--    {test_id}/{uuid}.jpg; dùng lại đề thì hai đề cùng trỏ một ảnh, nên chỉ xoá được ảnh
--    không còn dòng session_test_assets nào trỏ tới.
-- 4. RPC SECURITY DEFINER (search_path = '', không cấp cho anon), mỗi hàm tự kiểm tra quyền.
--    Chỉ sửa được đề khi buổi chưa khóa và chưa hủy.

begin;

-- ---------------------------------------------------------------------------
-- 1. Quyền
-- ---------------------------------------------------------------------------

insert into public.permissions (code, module, name, description) values
  ('ai_grading.manage_tests', 'ai_grading', 'Quản lý đề kiểm tra',
   'Tải ảnh đề lên buổi học, sắp xếp và xoá trang, sửa đáp án nháp, dùng lại đề của buổi khác, yêu cầu AI đọc đề.'),
  ('ai_grading.confirm_key', 'ai_grading', 'Chốt đáp án',
   'Chốt đáp án đề kiểm tra (tổng điểm bằng 10) và sửa đáp án đã chốt (tạo phiên bản mới, bắt buộc lý do).')
on conflict (code) do update set name = excluded.name, description = excluded.description, is_active = true;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
join public.permissions as permission on permission.code in ('ai_grading.manage_tests', 'ai_grading.confirm_key')
where role.code in ('owner', 'operations_manager', 'assistant_manager', 'teaching_assistant')
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Bảng
-- ---------------------------------------------------------------------------

create table public.session_tests (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions(id) on delete restrict,
  title text,
  status text not null default 'draft',
  marking_guide text,
  answer_key jsonb not null default '{"questions": []}'::jsonb,
  answer_key_version integer not null default 0,
  source_test_id uuid references public.session_tests(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  confirmed_at timestamptz,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_tests_class_session_key unique (class_session_id),
  constraint session_tests_status_check check (status in ('draft', 'key_review', 'key_confirmed')),
  constraint session_tests_title_check
    check (title is null or pg_catalog.char_length(pg_catalog.btrim(title)) between 1 and 200),
  constraint session_tests_marking_guide_check
    check (marking_guide is null or pg_catalog.char_length(marking_guide) between 1 and 2000),
  constraint session_tests_answer_key_check check (
    pg_catalog.jsonb_typeof(answer_key) = 'object'
    and pg_catalog.jsonb_typeof(answer_key -> 'questions') = 'array'
  ),
  -- answer_key_version đếm số lần chốt: 0 = chưa chốt lần nào. Đã chốt thì không quay lại nháp.
  constraint session_tests_confirmed_check check (
    (status = 'key_confirmed') = (answer_key_version >= 1)
    and (status = 'key_confirmed') = (confirmed_at is not null and confirmed_by is not null)
  ),
  constraint session_tests_version_check check (answer_key_version >= 0),
  constraint session_tests_source_check check (source_test_id is null or source_test_id <> id)
);

create index session_tests_source_idx on public.session_tests (source_test_id) where source_test_id is not null;

create trigger session_tests_set_updated_at
before update on public.session_tests
for each row execute function public.set_updated_at();

create table public.session_test_assets (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.session_tests(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  page_no integer not null,
  sha256 text not null,
  width integer not null,
  height integer not null,
  uploaded_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  -- Deferrable: đổi chỗ hoặc xoá trang đánh số lại trong một câu lệnh.
  constraint session_test_assets_page_key unique (test_id, page_no) deferrable initially immediate,
  constraint session_test_assets_sha_key unique (test_id, sha256),
  constraint session_test_assets_path_key unique (test_id, storage_path),
  constraint session_test_assets_page_check check (page_no between 1 and 20),
  constraint session_test_assets_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  constraint session_test_assets_sha_check check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint session_test_assets_size_check check (width between 1 and 10000 and height between 1 and 10000),
  constraint session_test_assets_path_check check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$'
  )
);

create index session_test_assets_storage_path_idx on public.session_test_assets (storage_path);

-- Mỗi lần gọi AI. Giai đoạn 2 chỉ xếp hàng lượt extract_key; tiến trình nền nhận và chạy
-- lượt (claim/complete, thử lại, trần chi phí) thuộc Giai đoạn 3.
create table public.grading_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  test_id uuid not null references public.session_tests(id) on delete restrict,
  submission_id uuid references public.grading_submissions(id) on delete restrict,
  answer_key_version integer,
  model text not null,
  prompt_version text not null,
  effort text not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  result jsonb,
  stop_reason text,
  input_tokens integer,
  cache_read_tokens integer,
  output_tokens integer,
  cost_usd_est numeric(10, 4),
  request_id text,
  latency_ms integer,
  error_code text,
  error_message text,
  requested_by uuid references public.profiles(id) on delete restrict,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grading_runs_type_check check (run_type in ('extract_key', 'grade')),
  constraint grading_runs_target_check check (
    (run_type = 'extract_key' and submission_id is null)
    or (run_type = 'grade' and submission_id is not null and answer_key_version is not null)
  ),
  constraint grading_runs_status_check check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  constraint grading_runs_effort_check check (effort in ('low', 'medium', 'high')),
  constraint grading_runs_model_check check (model ~ '^claude-[a-z0-9-]{1,60}$'),
  constraint grading_runs_prompt_version_check check (pg_catalog.char_length(prompt_version) between 1 and 40),
  constraint grading_runs_counts_check check (
    attempt_count >= 0
    and coalesce(input_tokens, 0) >= 0
    and coalesce(cache_read_tokens, 0) >= 0
    and coalesce(output_tokens, 0) >= 0
    and coalesce(cost_usd_est, 0) >= 0
    and coalesce(latency_ms, 0) >= 0
  ),
  constraint grading_runs_version_check check (answer_key_version is null or answer_key_version >= 1),
  constraint grading_runs_error_check check (error_message is null or pg_catalog.char_length(error_message) <= 2000)
);

-- Một đề chỉ có một lượt đọc đề đang chờ hoặc đang chạy.
create unique index grading_runs_active_extract_key_idx on public.grading_runs (test_id)
  where run_type = 'extract_key' and status in ('queued', 'running');
create index grading_runs_queue_idx on public.grading_runs (next_attempt_at) where status = 'queued';
create index grading_runs_test_idx on public.grading_runs (test_id, created_at desc);
create index grading_runs_submission_idx on public.grading_runs (submission_id) where submission_id is not null;

create trigger grading_runs_set_updated_at
before update on public.grading_runs
for each row execute function public.set_updated_at();

alter table public.session_tests enable row level security;
alter table public.session_test_assets enable row level security;
alter table public.grading_runs enable row level security;

create policy session_tests_select on public.session_tests
for select to authenticated
using (public.has_permission('ai_grading.view') or public.has_permission('ai_grading.manage_tests'));

create policy session_test_assets_select on public.session_test_assets
for select to authenticated
using (public.has_permission('ai_grading.view') or public.has_permission('ai_grading.manage_tests'));

create policy grading_runs_select on public.grading_runs
for select to authenticated
using (public.has_permission('ai_grading.view') or public.has_permission('ai_grading.manage_tests'));

-- Chỉ đọc trực tiếp; mọi thay đổi đi qua RPC bên dưới.
revoke all privileges on public.session_tests from public, anon, authenticated;
revoke all privileges on public.session_test_assets from public, anon, authenticated;
revoke all privileges on public.grading_runs from public, anon, authenticated;
grant select on public.session_tests to authenticated;
grant select on public.session_test_assets to authenticated;
grant select on public.grading_runs to authenticated;

comment on table public.session_tests is
  'Đề kiểm tra cuối buổi của một buổi học (Giai đoạn 2 chấm bài AI): ảnh đề, đáp án từng câu, trạng thái draft → key_review → key_confirmed. answer_key_version đếm số lần chốt. Chỉ ghi qua RPC.';
comment on table public.session_test_assets is
  'Ảnh đề (bucket Storage riêng tư session-tests). Dùng lại đề thì nhiều dòng trỏ cùng một storage_path.';
comment on table public.grading_runs is
  'Mỗi lần gọi AI (đọc đề extract_key, chấm bài grade). Giai đoạn 2 chỉ xếp hàng extract_key; tiến trình nền ở Giai đoạn 3.';

-- ---------------------------------------------------------------------------
-- 3. Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-tests', 'session-tests', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Tải ảnh lên: người có quyền quản lý đề, đúng mẫu đường dẫn {test_id}/{uuid}.{đuôi}, đề tồn tại
-- và buổi học chưa khóa, chưa hủy. Kiểm tra đường dẫn trước khi ép kiểu uuid.
create or replace function public.session_test_object_insert_allowed(p_bucket_id text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_bucket_id is distinct from 'session-tests' or p_name is null
    or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$'
  then
    return false;
  end if;

  if not public.has_permission('ai_grading.manage_tests') then
    return false;
  end if;

  return exists (
    select 1
    from public.session_tests as test
    join public.class_sessions as session_row on session_row.id = test.class_session_id
    where test.id = pg_catalog.split_part(p_name, '/', 1)::uuid
      and session_row.locked_at is null
      and session_row.status <> 'cancelled'
  );
end;
$$;

-- Xoá ảnh: người có quyền quản lý đề, chỉ ảnh không còn trang đề nào trỏ tới (ảnh bỏ trang,
-- hoặc ảnh tải lên nhưng chưa ghi được vào đề).
create or replace function public.session_test_object_delete_allowed(p_bucket_id text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket_id = 'session-tests'
    and public.has_permission('ai_grading.manage_tests')
    and not exists (
      select 1 from public.session_test_assets as asset where asset.storage_path = p_name
    );
$$;

create policy session_tests_objects_select on storage.objects
for select to authenticated
using (
  bucket_id = 'session-tests'
  and (public.has_permission('ai_grading.view') or public.has_permission('ai_grading.manage_tests'))
);

create policy session_tests_objects_insert on storage.objects
for insert to authenticated
with check (public.session_test_object_insert_allowed(bucket_id, name));

create policy session_tests_objects_delete on storage.objects
for delete to authenticated
using (public.session_test_object_delete_allowed(bucket_id, name));

-- Không có policy update: ảnh đã tải không bị ghi đè (upsert = false).

-- ---------------------------------------------------------------------------
-- 4. Đáp án: chuẩn hoá và kiểm tra
-- ---------------------------------------------------------------------------

-- Dựng lại đáp án chỉ với các trường đã khai báo: questions[] gồm label, prompt_text, max_points,
-- final_answer, accepted_equivalents[], solution_steps[]. Chuỗi được cắt khoảng trắng hai đầu;
-- cách viết tương đương và bước giải rỗng bị bỏ. Nháp cho phép max_points null và final_answer
-- rỗng; điều kiện chốt nằm ở session_test_key_confirm_problem. Bản sao TypeScript:
-- src/features/session-tests/answer-key.ts.
create or replace function public.normalize_session_test_answer_key(p_answer_key jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_questions jsonb;
  v_question jsonb;
  v_result jsonb := '[]'::jsonb;
  v_labels text[] := '{}';
  v_label text;
  v_prompt text;
  v_final text;
  v_points numeric;
  v_equivalents jsonb;
  v_steps jsonb;
begin
  if p_answer_key is null or pg_catalog.jsonb_typeof(p_answer_key) <> 'object' then
    raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_INVALID';
  end if;

  v_questions := p_answer_key -> 'questions';
  if v_questions is null or pg_catalog.jsonb_typeof(v_questions) <> 'array' then
    raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_INVALID';
  end if;

  if pg_catalog.jsonb_array_length(v_questions) > 50 then
    raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_TOO_MANY_QUESTIONS';
  end if;

  for v_question in select element from pg_catalog.jsonb_array_elements(v_questions) as items(element) loop
    if pg_catalog.jsonb_typeof(v_question) <> 'object'
      or pg_catalog.jsonb_typeof(v_question -> 'label') is distinct from 'string'
      or coalesce(pg_catalog.jsonb_typeof(v_question -> 'prompt_text'), 'string') <> 'string'
      or coalesce(pg_catalog.jsonb_typeof(v_question -> 'final_answer'), 'string') <> 'string'
      or coalesce(pg_catalog.jsonb_typeof(v_question -> 'max_points'), 'null') not in ('number', 'null')
      or coalesce(pg_catalog.jsonb_typeof(v_question -> 'accepted_equivalents'), 'array') <> 'array'
      or coalesce(pg_catalog.jsonb_typeof(v_question -> 'solution_steps'), 'array') <> 'array'
    then
      raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_INVALID';
    end if;

    v_label := pg_catalog.btrim(v_question ->> 'label');
    if pg_catalog.char_length(v_label) not between 1 and 20 then
      raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_LABEL_INVALID';
    end if;
    if pg_catalog.lower(v_label) = any (v_labels) then
      raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_LABEL_DUPLICATE';
    end if;
    v_labels := v_labels || pg_catalog.lower(v_label);

    v_prompt := pg_catalog.btrim(coalesce(v_question ->> 'prompt_text', ''));
    v_final := pg_catalog.btrim(coalesce(v_question ->> 'final_answer', ''));
    if pg_catalog.char_length(v_prompt) > 4000 or pg_catalog.char_length(v_final) > 500 then
      raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_TEXT_TOO_LONG';
    end if;

    v_points := (v_question ->> 'max_points')::numeric;
    -- Điểm mỗi câu: lớn hơn 0, tối đa 10, theo bước 0,25 (đề có câu 0,5 hoặc 0,25 điểm).
    if v_points is not null and (v_points <= 0 or v_points > 10 or (v_points * 4) <> pg_catalog.trunc(v_points * 4)) then
      raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_POINTS_INVALID';
    end if;

    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(coalesce(v_question -> 'accepted_equivalents', '[]'::jsonb)) as items(element)
      where pg_catalog.jsonb_typeof(items.element) <> 'string'
    ) or exists (
      select 1
      from pg_catalog.jsonb_array_elements(coalesce(v_question -> 'solution_steps', '[]'::jsonb)) as items(element)
      where pg_catalog.jsonb_typeof(items.element) <> 'string'
    ) then
      raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_INVALID';
    end if;

    select coalesce(pg_catalog.jsonb_agg(pg_catalog.btrim(items.element) order by items.ordinality), '[]'::jsonb)
    into v_equivalents
    from pg_catalog.jsonb_array_elements_text(coalesce(v_question -> 'accepted_equivalents', '[]'::jsonb))
      with ordinality as items(element, ordinality)
    where pg_catalog.btrim(items.element) <> '';

    select coalesce(pg_catalog.jsonb_agg(pg_catalog.btrim(items.element) order by items.ordinality), '[]'::jsonb)
    into v_steps
    from pg_catalog.jsonb_array_elements_text(coalesce(v_question -> 'solution_steps', '[]'::jsonb))
      with ordinality as items(element, ordinality)
    where pg_catalog.btrim(items.element) <> '';

    if pg_catalog.jsonb_array_length(v_equivalents) > 20
      or pg_catalog.jsonb_array_length(v_steps) > 40
      or exists (
        select 1 from pg_catalog.jsonb_array_elements_text(v_equivalents) as items(element)
        where pg_catalog.char_length(items.element) > 200
      )
      or exists (
        select 1 from pg_catalog.jsonb_array_elements_text(v_steps) as items(element)
        where pg_catalog.char_length(items.element) > 2000
      )
    then
      raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_TEXT_TOO_LONG';
    end if;

    v_result := v_result || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'label', v_label,
        'prompt_text', v_prompt,
        'max_points', v_points,
        'final_answer', v_final,
        'accepted_equivalents', v_equivalents,
        'solution_steps', v_steps
      )
    );
  end loop;

  return pg_catalog.jsonb_build_object('questions', v_result);
end;
$$;

-- Điều kiện chốt trên đáp án đã chuẩn hoá: có ít nhất một câu, câu nào cũng có điểm và đáp án
-- cuối, tổng điểm đúng bằng 10. Trả mã lỗi đầu tiên gặp, null khi chốt được.
create or replace function public.session_test_key_confirm_problem(p_answer_key jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_array_length(p_answer_key -> 'questions') = 0 then 'SESSION_TEST_KEY_EMPTY'
    when exists (
      select 1 from pg_catalog.jsonb_array_elements(p_answer_key -> 'questions') as items(element)
      where pg_catalog.jsonb_typeof(items.element -> 'max_points') <> 'number'
    ) then 'SESSION_TEST_KEY_POINTS_MISSING'
    when exists (
      select 1 from pg_catalog.jsonb_array_elements(p_answer_key -> 'questions') as items(element)
      where coalesce(items.element ->> 'final_answer', '') = ''
    ) then 'SESSION_TEST_KEY_FINAL_ANSWER_MISSING'
    when (
      select pg_catalog.sum((items.element ->> 'max_points')::numeric)
      from pg_catalog.jsonb_array_elements(p_answer_key -> 'questions') as items(element)
    ) <> 10 then 'SESSION_TEST_KEY_TOTAL_NOT_TEN'
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Hàm nội bộ
-- ---------------------------------------------------------------------------

-- Khóa đề (for update) và kiểm tra buổi còn sửa được (chưa khóa, chưa hủy).
create or replace function public.lock_open_session_test(p_test_id uuid)
returns public.session_tests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test public.session_tests%rowtype;
  v_session public.class_sessions%rowtype;
begin
  select * into v_test from public.session_tests as test where test.id = p_test_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'SESSION_TEST_NOT_FOUND';
  end if;

  select * into v_session from public.class_sessions as session_row where session_row.id = v_test.class_session_id;
  if v_session.locked_at is not null or v_session.status = 'cancelled' then
    raise exception using errcode = '55000', message = 'SESSION_TEST_SESSION_CLOSED';
  end if;

  return v_test;
end;
$$;

create or replace function public.require_session_test_permission(p_permission text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(p_permission) then
    raise exception using errcode = '42501', message = case p_permission
      when 'ai_grading.manage_tests' then 'AI_GRADING_MANAGE_TESTS_PERMISSION_DENIED'
      when 'ai_grading.confirm_key' then 'AI_GRADING_CONFIRM_KEY_PERMISSION_DENIED'
      else 'AI_GRADING_VIEW_PERMISSION_DENIED'
    end;
  end if;

  return v_actor;
end;
$$;

create or replace function public.session_test_actor_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(pg_catalog.btrim(profile.display_name), ''),
    nullif(pg_catalog.split_part(profile.email, '@', 1), ''),
    'Nhân sự trung tâm'
  )
  from public.profiles as profile
  where profile.id = p_user_id;
$$;

-- Lượt đọc đề đang chờ bị hủy khi đáp án đã chốt (kết quả AI không còn dùng được).
create or replace function public.cancel_queued_key_extractions(p_test_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.grading_runs as run
  set status = 'cancelled',
      finished_at = pg_catalog.now(),
      error_code = 'cancelled_by_confirm'
  where run.test_id = p_test_id
    and run.run_type = 'extract_key'
    and run.status = 'queued';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC đọc
-- ---------------------------------------------------------------------------

-- Đề của một buổi (null khi chưa có): đáp án, người chốt, đề gốc khi dùng lại, các trang ảnh
-- và lượt AI đọc đề gần nhất.
create or replace function public.get_session_test(p_class_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not (public.has_permission('ai_grading.view') or public.has_permission('ai_grading.manage_tests')) then
    raise exception using errcode = '42501', message = 'AI_GRADING_VIEW_PERMISSION_DENIED';
  end if;

  select pg_catalog.jsonb_build_object(
    'id', test.id,
    'class_session_id', test.class_session_id,
    'title', test.title,
    'status', test.status,
    'marking_guide', test.marking_guide,
    'answer_key', test.answer_key,
    'answer_key_version', test.answer_key_version,
    'confirmed_at', test.confirmed_at,
    'confirmed_by_name', case when test.confirmed_by is null then null else public.session_test_actor_name(test.confirmed_by) end,
    'updated_at', test.updated_at,
    'source', (
      select pg_catalog.jsonb_build_object(
        'test_id', source.id,
        'class_session_id', source.class_session_id,
        'class_code', source_class.code,
        'start_time', source_session.start_time
      )
      from public.session_tests as source
      join public.class_sessions as source_session on source_session.id = source.class_session_id
      join public.classes as source_class on source_class.id = source_session.class_id
      where source.id = test.source_test_id
    ),
    'assets', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', asset.id,
          'storage_path', asset.storage_path,
          'mime_type', asset.mime_type,
          'page_no', asset.page_no,
          'sha256', asset.sha256,
          'width', asset.width,
          'height', asset.height
        )
        order by asset.page_no
      )
      from public.session_test_assets as asset
      where asset.test_id = test.id
    ), '[]'::jsonb),
    'extraction', (
      select pg_catalog.jsonb_build_object(
        'id', run.id,
        'status', run.status,
        'created_at', run.created_at,
        'finished_at', run.finished_at,
        'error_code', run.error_code
      )
      from public.grading_runs as run
      where run.test_id = test.id and run.run_type = 'extract_key'
      order by run.created_at desc, run.id desc
      limit 1
    )
  )
  into v_result
  from public.session_tests as test
  where test.class_session_id = p_class_session_id;

  return v_result;
end;
$$;

-- "Dùng đề có sẵn": đề đã chốt của các buổi khác cùng ngày, cùng khối (một đề = một ngày + một khối).
create or replace function public.list_session_test_sources(p_class_session_id uuid)
returns table (
  test_id uuid,
  class_session_id uuid,
  class_code text,
  class_name text,
  start_time time,
  end_time time,
  title text,
  marking_guide text,
  answer_key jsonb,
  answer_key_version integer,
  confirmed_at timestamptz,
  confirmed_by_name text,
  page_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions%rowtype;
  v_grade integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not (public.has_permission('ai_grading.view') or public.has_permission('ai_grading.manage_tests')) then
    raise exception using errcode = '42501', message = 'AI_GRADING_VIEW_PERMISSION_DENIED';
  end if;

  select * into v_session from public.class_sessions as session_row where session_row.id = p_class_session_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'SESSION_NOT_FOUND';
  end if;
  select class_row.grade into v_grade from public.classes as class_row where class_row.id = v_session.class_id;

  return query
    select
      test.id,
      test.class_session_id,
      class_row.code,
      class_row.name,
      session_row.start_time,
      session_row.end_time,
      test.title,
      test.marking_guide,
      test.answer_key,
      test.answer_key_version,
      test.confirmed_at,
      public.session_test_actor_name(test.confirmed_by),
      (select pg_catalog.count(*)::integer from public.session_test_assets as asset where asset.test_id = test.id)
    from public.session_tests as test
    join public.class_sessions as session_row on session_row.id = test.class_session_id
    join public.classes as class_row on class_row.id = session_row.class_id
    where test.status = 'key_confirmed'
      and test.class_session_id <> p_class_session_id
      and session_row.session_date = v_session.session_date
      and session_row.status <> 'cancelled'
      and class_row.grade = v_grade
    order by session_row.start_time, class_row.code, test.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC ghi
-- ---------------------------------------------------------------------------

-- Tạo đề nháp cho buổi (gọi trước khi tải ảnh đầu tiên). Đã có thì trả đề cũ.
create or replace function public.create_session_test(p_class_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.manage_tests');
  v_session public.class_sessions%rowtype;
  v_id uuid;
begin
  select * into v_session from public.class_sessions as session_row where session_row.id = p_class_session_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'SESSION_NOT_FOUND';
  end if;
  if v_session.locked_at is not null or v_session.status = 'cancelled' then
    raise exception using errcode = '55000', message = 'SESSION_TEST_SESSION_CLOSED';
  end if;

  insert into public.session_tests (class_session_id, created_by, updated_by)
  values (p_class_session_id, v_actor, v_actor)
  on conflict (class_session_id) do nothing
  returning id into v_id;

  if v_id is null then
    select test.id into v_id from public.session_tests as test where test.class_session_id = p_class_session_id;
  end if;

  return v_id;
end;
$$;

-- Ghi các ảnh vừa tải lên (đã có trong Storage, đúng thư mục của đề) thành trang cuối của đề.
-- Ảnh trùng (cùng sha256) với một trang đã có không được thêm: added = false, trình duyệt xoá ảnh đó.
create or replace function public.add_session_test_assets(p_test_id uuid, p_assets jsonb)
returns table (asset_id uuid, storage_path text, page_no integer, added boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.manage_tests');
  v_test public.session_tests%rowtype;
  v_item jsonb;
  v_path text;
  v_mime text;
  v_sha text;
  v_width integer;
  v_height integer;
  v_next_page integer;
  v_existing_id uuid;
  v_new_id uuid;
begin
  if p_assets is null or pg_catalog.jsonb_typeof(p_assets) <> 'array'
    or pg_catalog.jsonb_array_length(p_assets) not between 1 and 20
  then
    raise exception using errcode = '22023', message = 'SESSION_TEST_ASSETS_INVALID';
  end if;

  v_test := public.lock_open_session_test(p_test_id);

  select coalesce(pg_catalog.max(asset.page_no), 0) + 1 into v_next_page
  from public.session_test_assets as asset
  where asset.test_id = v_test.id;

  for v_item in select element from pg_catalog.jsonb_array_elements(p_assets) as items(element) loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
      or pg_catalog.jsonb_typeof(v_item -> 'storage_path') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'mime_type') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'sha256') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'width') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'height') is distinct from 'number'
    then
      raise exception using errcode = '22023', message = 'SESSION_TEST_ASSETS_INVALID';
    end if;

    v_path := v_item ->> 'storage_path';
    v_mime := v_item ->> 'mime_type';
    v_sha := pg_catalog.lower(v_item ->> 'sha256');
    v_width := (v_item ->> 'width')::integer;
    v_height := (v_item ->> 'height')::integer;

    if pg_catalog.split_part(v_path, '/', 1) <> v_test.id::text
      or v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
      or v_sha !~ '^[0-9a-f]{64}$'
      or v_width not between 1 and 10000
      or v_height not between 1 and 10000
    then
      raise exception using errcode = '22023', message = 'SESSION_TEST_ASSETS_INVALID';
    end if;

    if not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'session-tests' and object.name = v_path
    ) then
      raise exception using errcode = 'P0002', message = 'SESSION_TEST_ASSET_OBJECT_MISSING';
    end if;

    select asset.id into v_existing_id
    from public.session_test_assets as asset
    where asset.test_id = v_test.id and (asset.sha256 = v_sha or asset.storage_path = v_path);

    if v_existing_id is not null then
      return query
        select asset.id, v_path, asset.page_no, false
        from public.session_test_assets as asset where asset.id = v_existing_id;
      continue;
    end if;

    if v_next_page > 20 then
      raise exception using errcode = '22023', message = 'SESSION_TEST_TOO_MANY_PAGES';
    end if;

    insert into public.session_test_assets (test_id, storage_path, mime_type, page_no, sha256, width, height, uploaded_by)
    values (v_test.id, v_path, v_mime, v_next_page, v_sha, v_width, v_height, v_actor)
    returning id into v_new_id;

    return query select v_new_id, v_path, v_next_page, true;
    v_next_page := v_next_page + 1;
  end loop;

  update public.session_tests as test set updated_by = v_actor where test.id = v_test.id;
end;
$$;

-- Bỏ một trang; các trang sau dồn lên. still_referenced = true khi đề khác (dùng lại đề) vẫn
-- trỏ cùng ảnh, khi đó không xoá ảnh trong Storage.
create or replace function public.remove_session_test_asset(p_asset_id uuid)
returns table (storage_path text, still_referenced boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.manage_tests');
  v_asset public.session_test_assets%rowtype;
  v_test public.session_tests%rowtype;
begin
  select * into v_asset from public.session_test_assets as asset where asset.id = p_asset_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'SESSION_TEST_ASSET_NOT_FOUND';
  end if;

  v_test := public.lock_open_session_test(v_asset.test_id);

  delete from public.session_test_assets as asset where asset.id = v_asset.id;

  update public.session_test_assets as asset
  set page_no = asset.page_no - 1
  where asset.test_id = v_test.id and asset.page_no > v_asset.page_no;

  update public.session_tests as test set updated_by = v_actor where test.id = v_test.id;

  return query
    select v_asset.storage_path,
      exists (select 1 from public.session_test_assets as other where other.storage_path = v_asset.storage_path);
end;
$$;

-- Sắp lại trang: p_asset_ids phải gồm đúng các trang của đề, mỗi trang một lần.
create or replace function public.reorder_session_test_assets(p_test_id uuid, p_asset_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.manage_tests');
  v_test public.session_tests%rowtype;
begin
  v_test := public.lock_open_session_test(p_test_id);

  if p_asset_ids is null
    or pg_catalog.cardinality(p_asset_ids) <> (select pg_catalog.count(distinct id) from pg_catalog.unnest(p_asset_ids) as ids(id))
    or (select pg_catalog.array_agg(asset.id order by asset.id) from public.session_test_assets as asset where asset.test_id = v_test.id)
      is distinct from (select pg_catalog.array_agg(ids.id order by ids.id) from pg_catalog.unnest(p_asset_ids) as ids(id))
  then
    raise exception using errcode = '22023', message = 'SESSION_TEST_PAGE_ORDER_INVALID';
  end if;

  update public.session_test_assets as asset
  set page_no = ordered.ord::integer
  from pg_catalog.unnest(p_asset_ids) with ordinality as ordered(id, ord)
  where asset.id = ordered.id and asset.page_no <> ordered.ord;

  update public.session_tests as test set updated_by = v_actor where test.id = v_test.id;
end;
$$;

-- Lưu nháp (trước khi chốt). Có ít nhất một câu thì đề chuyển "chờ chốt" (key_review).
-- Đáp án đã chốt chỉ sửa qua confirm_session_test_key (tạo phiên bản mới, có lý do).
create or replace function public.save_session_test_draft(
  p_test_id uuid,
  p_title text,
  p_marking_guide text,
  p_answer_key jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.manage_tests');
  v_test public.session_tests%rowtype;
  v_key jsonb;
  v_status text;
begin
  v_test := public.lock_open_session_test(p_test_id);
  if v_test.status = 'key_confirmed' then
    raise exception using errcode = '55000', message = 'SESSION_TEST_ALREADY_CONFIRMED';
  end if;

  v_key := public.normalize_session_test_answer_key(p_answer_key);
  v_status := case when pg_catalog.jsonb_array_length(v_key -> 'questions') > 0 then 'key_review' else 'draft' end;

  update public.session_tests as test
  set title = nullif(pg_catalog.btrim(coalesce(p_title, '')), ''),
      marking_guide = nullif(pg_catalog.btrim(coalesce(p_marking_guide, '')), ''),
      answer_key = v_key,
      status = v_status,
      updated_by = v_actor
  where test.id = v_test.id;

  return v_status;
end;
$$;

-- Chốt đáp án. p_expected_version là phiên bản người dùng đang sửa (0 khi chưa chốt lần nào):
-- người khác chốt trước thì báo xung đột. Đề đã chốt thì đây là sửa sau khi chốt: bắt buộc lý do,
-- đáp án phải khác bản đang dùng, phiên bản tăng 1. Ghi nhật ký cả hai trường hợp.
create or replace function public.confirm_session_test_key(
  p_test_id uuid,
  p_title text,
  p_marking_guide text,
  p_answer_key jsonb,
  p_expected_version integer,
  p_reason text default null
)
returns table (answer_key_version integer, confirmed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.confirm_key');
  v_test public.session_tests%rowtype;
  v_after public.session_tests%rowtype;
  v_key jsonb;
  v_problem text;
  v_title text := nullif(pg_catalog.btrim(coalesce(p_title, '')), '');
  v_guide text := nullif(pg_catalog.btrim(coalesce(p_marking_guide, '')), '');
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_revision boolean;
  v_cancelled integer;
begin
  v_test := public.lock_open_session_test(p_test_id);

  if p_expected_version is distinct from v_test.answer_key_version then
    raise exception using errcode = '40001', message = 'SESSION_TEST_VERSION_CONFLICT';
  end if;

  v_key := public.normalize_session_test_answer_key(p_answer_key);
  v_problem := public.session_test_key_confirm_problem(v_key);
  if v_problem is not null then
    raise exception using errcode = '22023', message = v_problem;
  end if;

  v_revision := v_test.status = 'key_confirmed';
  if v_revision then
    if v_reason is null then
      raise exception using errcode = '22023', message = 'REASON_REQUIRED';
    end if;
    if v_key = v_test.answer_key
      and v_title is not distinct from v_test.title
      and v_guide is not distinct from v_test.marking_guide
    then
      raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_UNCHANGED';
    end if;
  end if;
  if v_reason is not null and pg_catalog.char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'REASON_TOO_LONG';
  end if;

  update public.session_tests as test
  set title = v_title,
      marking_guide = v_guide,
      answer_key = v_key,
      status = 'key_confirmed',
      answer_key_version = test.answer_key_version + 1,
      confirmed_by = v_actor,
      confirmed_at = pg_catalog.now(),
      updated_by = v_actor
  where test.id = v_test.id
  returning * into v_after;

  v_cancelled := public.cancel_queued_key_extractions(v_test.id);

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
  values (
    v_actor,
    'ai_grading',
    case when v_revision then 'session_test_key_revised' else 'session_test_key_confirmed' end,
    'session_test',
    v_test.id::text,
    case when v_revision then pg_catalog.jsonb_build_object(
      'answer_key_version', v_test.answer_key_version,
      'title', v_test.title,
      'marking_guide', v_test.marking_guide,
      'answer_key', v_test.answer_key
    ) else pg_catalog.jsonb_build_object('status', v_test.status) end,
    pg_catalog.jsonb_build_object(
      'class_session_id', v_after.class_session_id,
      'answer_key_version', v_after.answer_key_version,
      'question_count', pg_catalog.jsonb_array_length(v_key -> 'questions'),
      'title', v_after.title,
      'marking_guide', v_after.marking_guide,
      'answer_key', v_after.answer_key,
      'cancelled_extractions', v_cancelled
    ),
    v_reason
  );

  return query select v_after.answer_key_version, v_after.confirmed_at;
end;
$$;

-- "Dùng đề có sẵn": chép đáp án đã chốt của một buổi khác cùng ngày, cùng khối, và chốt luôn cho
-- buổi này (người bấm là người chốt). Buổi này chưa có ảnh đề thì các trang ảnh cũng được chép
-- (cùng trỏ ảnh của đề gốc, không nhân bản file). Buổi này đã chốt thì là sửa sau khi chốt:
-- bắt buộc lý do, phiên bản tăng 1. Sửa đề gốc sau đó không tự cập nhật buổi này.
create or replace function public.copy_session_test_key(
  p_class_session_id uuid,
  p_source_test_id uuid,
  p_expected_version integer,
  p_reason text default null
)
returns table (test_id uuid, answer_key_version integer, copied_pages integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.manage_tests');
  v_session public.class_sessions%rowtype;
  v_source public.session_tests%rowtype;
  v_source_session public.class_sessions%rowtype;
  v_test public.session_tests%rowtype;
  v_after public.session_tests%rowtype;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_revision boolean;
  v_pages integer := 0;
  v_cancelled integer;
begin
  perform public.require_session_test_permission('ai_grading.confirm_key');

  select * into v_session from public.class_sessions as session_row where session_row.id = p_class_session_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'SESSION_NOT_FOUND';
  end if;

  select * into v_source from public.session_tests as source where source.id = p_source_test_id;
  if not found or v_source.status <> 'key_confirmed' then
    raise exception using errcode = 'P0002', message = 'SESSION_TEST_SOURCE_NOT_FOUND';
  end if;
  select * into v_source_session from public.class_sessions as session_row where session_row.id = v_source.class_session_id;

  if v_source.class_session_id = p_class_session_id
    or v_source_session.session_date <> v_session.session_date
    or v_source_session.status = 'cancelled'
    or (select class_row.grade from public.classes as class_row where class_row.id = v_source_session.class_id)
      is distinct from (select class_row.grade from public.classes as class_row where class_row.id = v_session.class_id)
  then
    raise exception using errcode = '22023', message = 'SESSION_TEST_SOURCE_NOT_ELIGIBLE';
  end if;

  if v_reason is not null and pg_catalog.char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'REASON_TOO_LONG';
  end if;

  v_test := public.lock_open_session_test(public.create_session_test(p_class_session_id));

  if p_expected_version is distinct from v_test.answer_key_version then
    raise exception using errcode = '40001', message = 'SESSION_TEST_VERSION_CONFLICT';
  end if;

  v_revision := v_test.status = 'key_confirmed';
  if v_revision then
    if v_reason is null then
      raise exception using errcode = '22023', message = 'REASON_REQUIRED';
    end if;
    if v_test.answer_key = v_source.answer_key
      and v_test.title is not distinct from v_source.title
      and v_test.marking_guide is not distinct from v_source.marking_guide
    then
      raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_UNCHANGED';
    end if;
  end if;

  if not exists (select 1 from public.session_test_assets as asset where asset.test_id = v_test.id) then
    insert into public.session_test_assets (test_id, storage_path, mime_type, page_no, sha256, width, height, uploaded_by)
    select v_test.id, asset.storage_path, asset.mime_type, asset.page_no, asset.sha256, asset.width, asset.height, v_actor
    from public.session_test_assets as asset
    where asset.test_id = v_source.id;
    get diagnostics v_pages = row_count;
  end if;

  update public.session_tests as test
  set title = v_source.title,
      marking_guide = v_source.marking_guide,
      answer_key = v_source.answer_key,
      source_test_id = v_source.id,
      status = 'key_confirmed',
      answer_key_version = test.answer_key_version + 1,
      confirmed_by = v_actor,
      confirmed_at = pg_catalog.now(),
      updated_by = v_actor
  where test.id = v_test.id
  returning * into v_after;

  v_cancelled := public.cancel_queued_key_extractions(v_test.id);

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
  values (
    v_actor,
    'ai_grading',
    'session_test_key_copied',
    'session_test',
    v_test.id::text,
    pg_catalog.jsonb_build_object(
      'status', v_test.status,
      'answer_key_version', v_test.answer_key_version,
      'title', v_test.title,
      'marking_guide', v_test.marking_guide,
      'answer_key', v_test.answer_key
    ),
    pg_catalog.jsonb_build_object(
      'class_session_id', v_after.class_session_id,
      'source_test_id', v_source.id,
      'source_class_session_id', v_source.class_session_id,
      'source_answer_key_version', v_source.answer_key_version,
      'answer_key_version', v_after.answer_key_version,
      'question_count', pg_catalog.jsonb_array_length(v_after.answer_key -> 'questions'),
      'copied_pages', v_pages,
      'cancelled_extractions', v_cancelled
    ),
    v_reason
  );

  return query select v_after.id, v_after.answer_key_version, v_pages;
end;
$$;

-- "AI đọc đề": xếp một lượt extract_key (Claude Opus 5.5, effort high, prompt key-v1). Máy chủ
-- chỉ gọi hàm này khi đã cấu hình ANTHROPIC_API_KEY; tiến trình nền chạy lượt ở Giai đoạn 3.
create or replace function public.request_session_test_key_extraction(p_test_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.manage_tests');
  v_test public.session_tests%rowtype;
  v_id uuid;
begin
  v_test := public.lock_open_session_test(p_test_id);
  if v_test.status = 'key_confirmed' then
    raise exception using errcode = '55000', message = 'SESSION_TEST_ALREADY_CONFIRMED';
  end if;

  if not exists (select 1 from public.session_test_assets as asset where asset.test_id = v_test.id) then
    raise exception using errcode = '55000', message = 'SESSION_TEST_NO_PAGES';
  end if;

  if exists (
    select 1 from public.grading_runs as run
    where run.test_id = v_test.id and run.run_type = 'extract_key' and run.status in ('queued', 'running')
  ) then
    raise exception using errcode = '55000', message = 'SESSION_TEST_EXTRACTION_ACTIVE';
  end if;

  insert into public.grading_runs (run_type, test_id, model, prompt_version, effort, requested_by)
  values ('extract_key', v_test.id, 'claude-opus-5-5', 'key-v1', 'high', v_actor)
  returning id into v_id;

  return v_id;
end;
$$;

-- Hủy lượt đọc đề còn đang chờ (chưa chạy).
create or replace function public.cancel_session_test_key_extraction(p_test_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.manage_tests');
  v_count integer;
begin
  if not exists (select 1 from public.session_tests as test where test.id = p_test_id) then
    raise exception using errcode = 'P0002', message = 'SESSION_TEST_NOT_FOUND';
  end if;

  update public.grading_runs as run
  set status = 'cancelled',
      finished_at = pg_catalog.now(),
      error_code = 'cancelled_by_user'
  where run.test_id = p_test_id
    and run.run_type = 'extract_key'
    and run.status = 'queued';
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception using errcode = '55000', message = 'SESSION_TEST_EXTRACTION_NOT_QUEUED';
  end if;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quyền gọi hàm
-- ---------------------------------------------------------------------------

-- Hàm nội bộ: chỉ gọi từ RPC khác.
revoke all on function public.normalize_session_test_answer_key(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.session_test_key_confirm_problem(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.lock_open_session_test(uuid) from public, anon, authenticated, service_role;
revoke all on function public.require_session_test_permission(text) from public, anon, authenticated, service_role;
revoke all on function public.session_test_actor_name(uuid) from public, anon, authenticated, service_role;
revoke all on function public.cancel_queued_key_extractions(uuid) from public, anon, authenticated, service_role;

-- Policy trên storage.objects chạy với quyền người gọi, nên người đăng nhập cần quyền gọi hai hàm này.
revoke all on function public.session_test_object_insert_allowed(text, text) from public, anon;
revoke all on function public.session_test_object_delete_allowed(text, text) from public, anon;
grant execute on function public.session_test_object_insert_allowed(text, text) to authenticated;
grant execute on function public.session_test_object_delete_allowed(text, text) to authenticated;

revoke all on function public.get_session_test(uuid) from public, anon;
revoke all on function public.list_session_test_sources(uuid) from public, anon;
revoke all on function public.create_session_test(uuid) from public, anon;
revoke all on function public.add_session_test_assets(uuid, jsonb) from public, anon;
revoke all on function public.remove_session_test_asset(uuid) from public, anon;
revoke all on function public.reorder_session_test_assets(uuid, uuid[]) from public, anon;
revoke all on function public.save_session_test_draft(uuid, text, text, jsonb) from public, anon;
revoke all on function public.confirm_session_test_key(uuid, text, text, jsonb, integer, text) from public, anon;
revoke all on function public.copy_session_test_key(uuid, uuid, integer, text) from public, anon;
revoke all on function public.request_session_test_key_extraction(uuid) from public, anon;
revoke all on function public.cancel_session_test_key_extraction(uuid) from public, anon;

grant execute on function public.get_session_test(uuid) to authenticated;
grant execute on function public.list_session_test_sources(uuid) to authenticated;
grant execute on function public.create_session_test(uuid) to authenticated;
grant execute on function public.add_session_test_assets(uuid, jsonb) to authenticated;
grant execute on function public.remove_session_test_asset(uuid) to authenticated;
grant execute on function public.reorder_session_test_assets(uuid, uuid[]) to authenticated;
grant execute on function public.save_session_test_draft(uuid, text, text, jsonb) to authenticated;
grant execute on function public.confirm_session_test_key(uuid, text, text, jsonb, integer, text) to authenticated;
grant execute on function public.copy_session_test_key(uuid, uuid, integer, text) to authenticated;
grant execute on function public.request_session_test_key_extraction(uuid) to authenticated;
grant execute on function public.cancel_session_test_key_extraction(uuid) to authenticated;

commit;
