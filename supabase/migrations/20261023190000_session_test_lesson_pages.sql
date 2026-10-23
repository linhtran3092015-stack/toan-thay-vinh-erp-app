-- Ảnh bài giảng (slide cuối buổi của thầy) cho chấm bài AI. Thử 23/10/2026 trên hai đề lớp 4: có slide
-- thì AI đọc đề hiểu đề như thầy (sửa được câu thùng dầu AI tự giải sai) và viết lời giải theo đúng dạng
-- bài, phương pháp, công thức thầy dạy.
--   * session_test_lesson_pages: ảnh slide của đề (cùng bucket session-tests, cùng mẫu đường dẫn
--     {test_id}/{uuid}.jpg nên policy tải lên giữ nguyên). Dùng lại slide của buổi khác thì nhiều
--     dòng trỏ cùng một ảnh; chỉ xoá ảnh khi không còn dòng nào (đề hay slide) trỏ tới.
--   * answer_key.methods: "Phương pháp của thầy" AI tóm tắt từ slide, trợ giảng sửa và chốt cùng đáp
--     án; đi theo mọi luồng lưu nháp, chốt, dùng lại đề, và vào lời nhắc chấm bài.

-- ---------------------------------------------------------------------------
-- 1. Bảng ảnh bài giảng
-- ---------------------------------------------------------------------------

create table public.session_test_lesson_pages (
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
  constraint session_test_lesson_pages_page_key unique (test_id, page_no) deferrable initially immediate,
  constraint session_test_lesson_pages_sha_key unique (test_id, sha256),
  constraint session_test_lesson_pages_path_key unique (test_id, storage_path),
  constraint session_test_lesson_pages_page_check check (page_no between 1 and 10),
  constraint session_test_lesson_pages_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  constraint session_test_lesson_pages_sha_check check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint session_test_lesson_pages_size_check check (width between 1 and 10000 and height between 1 and 10000),
  constraint session_test_lesson_pages_path_check check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$'
  )
);

create index session_test_lesson_pages_storage_path_idx on public.session_test_lesson_pages (storage_path);

comment on table public.session_test_lesson_pages is
  'Ảnh slide bài giảng của buổi (bucket session-tests). AI đọc đề kèm slide để lời giải và nhận xét theo phương pháp thầy dạy.';

alter table public.session_test_lesson_pages enable row level security;

create policy session_test_lesson_pages_select on public.session_test_lesson_pages
for select to authenticated
using (public.has_permission('ai_grading.view') or public.has_permission('ai_grading.manage_tests'));

revoke all privileges on public.session_test_lesson_pages from public, anon, authenticated;
grant select on public.session_test_lesson_pages to authenticated;

-- Xoá ảnh trong Storage: chỉ khi không còn trang đề hay trang slide nào trỏ tới.
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
    )
    and not exists (
      select 1 from public.session_test_lesson_pages as lesson where lesson.storage_path = p_name
    );
$$;

-- ---------------------------------------------------------------------------
-- 2. Đáp án giữ thêm "methods" (phương pháp của thầy)
-- ---------------------------------------------------------------------------

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
  v_methods text;
begin
  if p_answer_key is null or pg_catalog.jsonb_typeof(p_answer_key) <> 'object' then
    raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_INVALID';
  end if;

  v_questions := p_answer_key -> 'questions';
  if v_questions is null or pg_catalog.jsonb_typeof(v_questions) <> 'array' then
    raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_INVALID';
  end if;

  -- Phương pháp của thầy (tóm tắt từ slide bài giảng): chữ, tối đa 4.000 ký tự; rỗng thì không lưu.
  if coalesce(pg_catalog.jsonb_typeof(p_answer_key -> 'methods'), 'null') not in ('string', 'null') then
    raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_INVALID';
  end if;
  v_methods := pg_catalog.btrim(coalesce(p_answer_key ->> 'methods', ''));
  if pg_catalog.char_length(v_methods) > 4000 then
    raise exception using errcode = '22023', message = 'SESSION_TEST_KEY_TEXT_TOO_LONG';
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

  return pg_catalog.jsonb_build_object('questions', v_result)
    || case when v_methods <> '' then pg_catalog.jsonb_build_object('methods', v_methods) else '{}'::jsonb end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC ảnh bài giảng
-- ---------------------------------------------------------------------------

-- Ghi các ảnh slide vừa tải lên (tối đa 10). Ảnh trùng (sha256 hoặc đường dẫn) không thêm trang mới.
create or replace function public.add_session_test_lesson_pages(p_test_id uuid, p_pages jsonb)
returns table (page_id uuid, storage_path text, page_no integer, added boolean)
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
  if p_pages is null or pg_catalog.jsonb_typeof(p_pages) <> 'array'
    or pg_catalog.jsonb_array_length(p_pages) not between 1 and 10
  then
    raise exception using errcode = '22023', message = 'SESSION_TEST_LESSON_PAGES_INVALID';
  end if;

  v_test := public.lock_open_session_test(p_test_id);

  select coalesce(pg_catalog.max(lesson.page_no), 0) + 1 into v_next_page
  from public.session_test_lesson_pages as lesson
  where lesson.test_id = v_test.id;

  for v_item in select element from pg_catalog.jsonb_array_elements(p_pages) as items(element) loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
      or pg_catalog.jsonb_typeof(v_item -> 'storage_path') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'mime_type') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'sha256') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'width') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'height') is distinct from 'number'
    then
      raise exception using errcode = '22023', message = 'SESSION_TEST_LESSON_PAGES_INVALID';
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
      raise exception using errcode = '22023', message = 'SESSION_TEST_LESSON_PAGES_INVALID';
    end if;

    if not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'session-tests' and object.name = v_path
    ) then
      raise exception using errcode = 'P0002', message = 'SESSION_TEST_ASSET_OBJECT_MISSING';
    end if;

    select lesson.id into v_existing_id
    from public.session_test_lesson_pages as lesson
    where lesson.test_id = v_test.id and (lesson.sha256 = v_sha or lesson.storage_path = v_path);

    if v_existing_id is not null then
      return query
        select lesson.id, v_path, lesson.page_no, false
        from public.session_test_lesson_pages as lesson where lesson.id = v_existing_id;
      continue;
    end if;

    if v_next_page > 10 then
      raise exception using errcode = '22023', message = 'SESSION_TEST_TOO_MANY_LESSON_PAGES';
    end if;

    insert into public.session_test_lesson_pages (test_id, storage_path, mime_type, page_no, sha256, width, height, uploaded_by)
    values (v_test.id, v_path, v_mime, v_next_page, v_sha, v_width, v_height, v_actor)
    returning id into v_new_id;

    return query select v_new_id, v_path, v_next_page, true;
    v_next_page := v_next_page + 1;
  end loop;

  update public.session_tests as test set updated_by = v_actor where test.id = v_test.id;
end;
$$;

-- Bỏ một ảnh slide; các ảnh sau dồn lên. still_referenced = true khi đề hoặc slide khác vẫn dùng ảnh.
create or replace function public.remove_session_test_lesson_page(p_page_id uuid)
returns table (storage_path text, still_referenced boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.manage_tests');
  v_page public.session_test_lesson_pages%rowtype;
  v_test public.session_tests%rowtype;
begin
  select * into v_page from public.session_test_lesson_pages as lesson where lesson.id = p_page_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'SESSION_TEST_LESSON_PAGE_NOT_FOUND';
  end if;

  v_test := public.lock_open_session_test(v_page.test_id);

  delete from public.session_test_lesson_pages as lesson where lesson.id = v_page.id;

  update public.session_test_lesson_pages as lesson
  set page_no = lesson.page_no - 1
  where lesson.test_id = v_test.id and lesson.page_no > v_page.page_no;

  update public.session_tests as test set updated_by = v_actor where test.id = v_test.id;

  return query
    select v_page.storage_path,
      exists (select 1 from public.session_test_lesson_pages as other where other.storage_path = v_page.storage_path)
      or exists (select 1 from public.session_test_assets as asset where asset.storage_path = v_page.storage_path);
end;
$$;

-- Slide của buổi khác cùng khối trong vòng 6 ngày (tuần của thầy chạy thứ Bảy đến thứ Sáu, không
-- trùng tuần lịch), để buổi này dùng lại mà không phải tải lên lần nữa.
create or replace function public.list_session_lesson_sources(p_class_session_id uuid)
returns table (
  test_id uuid,
  class_session_id uuid,
  class_code text,
  class_name text,
  session_date date,
  start_time time,
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
  if not public.has_permission('ai_grading.manage_tests') then
    raise exception using errcode = '42501', message = 'AI_GRADING_MANAGE_TESTS_PERMISSION_DENIED';
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
      session_row.session_date,
      session_row.start_time,
      (select pg_catalog.count(*)::integer from public.session_test_lesson_pages as lesson where lesson.test_id = test.id)
    from public.session_tests as test
    join public.class_sessions as session_row on session_row.id = test.class_session_id
    join public.classes as class_row on class_row.id = session_row.class_id
    where test.class_session_id <> p_class_session_id
      and session_row.status <> 'cancelled'
      and class_row.grade = v_grade
      and session_row.session_date between v_session.session_date - 6 and v_session.session_date + 6
      and exists (select 1 from public.session_test_lesson_pages as lesson where lesson.test_id = test.id)
    order by pg_catalog.abs(session_row.session_date - v_session.session_date), session_row.session_date desc, session_row.start_time, class_row.code;
end;
$$;

-- Chép slide của đề nguồn (cùng khối, trong vòng 6 ngày) sang đề này; trỏ cùng ảnh, không tải lại.
-- Ảnh đã có (cùng sha256) bỏ qua. Trả số ảnh thêm được.
create or replace function public.copy_session_test_lesson_pages(p_test_id uuid, p_source_test_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_session_test_permission('ai_grading.manage_tests');
  v_test public.session_tests%rowtype;
  v_target_session public.class_sessions%rowtype;
  v_source_session public.class_sessions%rowtype;
  v_next_page integer;
  v_added integer := 0;
  v_page public.session_test_lesson_pages%rowtype;
begin
  v_test := public.lock_open_session_test(p_test_id);
  select * into v_target_session from public.class_sessions as session_row where session_row.id = v_test.class_session_id;

  select session_row.* into v_source_session
  from public.session_tests as source
  join public.class_sessions as session_row on session_row.id = source.class_session_id
  where source.id = p_source_test_id and source.id <> v_test.id;
  if not found then
    raise exception using errcode = 'P0002', message = 'SESSION_TEST_LESSON_SOURCE_NOT_FOUND';
  end if;
  if v_source_session.status = 'cancelled'
    or pg_catalog.abs(v_source_session.session_date - v_target_session.session_date) > 6
    or (select class_row.grade from public.classes as class_row where class_row.id = v_source_session.class_id)
      is distinct from (select class_row.grade from public.classes as class_row where class_row.id = v_target_session.class_id)
  then
    raise exception using errcode = '22023', message = 'SESSION_TEST_LESSON_SOURCE_NOT_ELIGIBLE';
  end if;

  select coalesce(pg_catalog.max(lesson.page_no), 0) + 1 into v_next_page
  from public.session_test_lesson_pages as lesson where lesson.test_id = v_test.id;

  for v_page in
    select * from public.session_test_lesson_pages as lesson
    where lesson.test_id = p_source_test_id
    order by lesson.page_no
  loop
    continue when exists (
      select 1 from public.session_test_lesson_pages as lesson
      where lesson.test_id = v_test.id and (lesson.sha256 = v_page.sha256 or lesson.storage_path = v_page.storage_path)
    );
    if v_next_page > 10 then
      raise exception using errcode = '22023', message = 'SESSION_TEST_TOO_MANY_LESSON_PAGES';
    end if;
    insert into public.session_test_lesson_pages (test_id, storage_path, mime_type, page_no, sha256, width, height, uploaded_by)
    values (v_test.id, v_page.storage_path, v_page.mime_type, v_next_page, v_page.sha256, v_page.width, v_page.height, v_actor);
    v_next_page := v_next_page + 1;
    v_added := v_added + 1;
  end loop;

  if v_added > 0 then
    update public.session_tests as test set updated_by = v_actor where test.id = v_test.id;
  end if;
  return v_added;
end;
$$;

-- Đề của buổi: thêm lesson_pages.
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
        'error_code', run.error_code,
        'outcome', run.result ->> 'outcome',
        'warnings', case when pg_catalog.jsonb_typeof(run.result -> 'transcription_warnings') = 'array'
          then run.result -> 'transcription_warnings' else '[]'::jsonb end
      )
      from public.grading_runs as run
      where run.test_id = test.id and run.run_type = 'extract_key'
      order by run.created_at desc, run.id desc
      limit 1
    ),
    'key_warnings', public.session_test_key_warnings(test.id),
    'lesson_pages', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', lesson.id,
          'storage_path', lesson.storage_path,
          'mime_type', lesson.mime_type,
          'page_no', lesson.page_no,
          'sha256', lesson.sha256,
          'width', lesson.width,
          'height', lesson.height
        )
        order by lesson.page_no
      )
      from public.session_test_lesson_pages as lesson
      where lesson.test_id = test.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.session_tests as test
  where test.class_session_id = p_class_session_id;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Quyền gọi hàm
-- ---------------------------------------------------------------------------

revoke all on function public.normalize_session_test_answer_key(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.add_session_test_lesson_pages(uuid, jsonb) from public, anon;
revoke all on function public.remove_session_test_lesson_page(uuid) from public, anon;
revoke all on function public.list_session_lesson_sources(uuid) from public, anon;
revoke all on function public.copy_session_test_lesson_pages(uuid, uuid) from public, anon;
revoke all on function public.get_session_test(uuid) from public, anon;
grant execute on function public.add_session_test_lesson_pages(uuid, jsonb) to authenticated;
grant execute on function public.remove_session_test_lesson_page(uuid) to authenticated;
grant execute on function public.list_session_lesson_sources(uuid) to authenticated;
grant execute on function public.copy_session_test_lesson_pages(uuid, uuid) to authenticated;
grant execute on function public.get_session_test(uuid) to authenticated;
