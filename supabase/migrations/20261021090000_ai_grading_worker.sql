-- Chấm bài AI, Giai đoạn 3a: hàng đợi và tiến trình nền gọi Claude.
--
-- - Cài đặt (chỉ owner sửa): bật/tắt, model chấm, mức suy luận, chấm hai lần, model trọng tài,
--   model đọc đề, trần chi phí ngày (USD).
-- - Đáp án chốt (hoặc sửa sau khi chốt) thì mọi bài đang tính điểm của buổi được xếp lượt chấm;
--   bài mới vào buổi đã có đáp án chốt cũng vậy. Bài cũ bị thay bởi bài nộp sau thì hủy lượt chờ.
-- - Tiến trình nền (service_role) nhận lượt qua claim_grading_runs và trả kết quả qua
--   complete_grading_run. Một lượt "grade" là cả bài: 2 lần chấm (+ trọng tài khi lệch) do
--   worker gọi rồi gộp; chi tiết từng lần nằm trong result.calls.
-- - Kết quả AI ghi lên bài nộp (ai_*). Duyệt bài, ghi điểm vào kết quả buổi và tin Zalo ở 3b.
-- - Chạm trần chi phí ngày, hết tín dụng hay khóa API sai: dừng cả hàng đợi và báo owner.

-- ---------------------------------------------------------------------------
-- 1. Cài đặt
-- ---------------------------------------------------------------------------

alter table public.system_settings drop constraint system_settings_key_check;
alter table public.system_settings add constraint system_settings_key_check check (
  key = any (array[
    'center.display_name', 'teacher.display_name', 'center.contact_phone', 'center.contact_email', 'center.address',
    'coaching.default_public_link_expiry_days', 'sessions.auto_lock_after_days',
    'zalo.center_account_id', 'zalo.center_account_name', 'zalo.absence_message_enabled', 'zalo.comment_message_enabled',
    'zalo.absence_template', 'zalo.comment_template', 'zalo.comment_footer',
    'ai_grading.enabled', 'ai_grading.grade_model', 'ai_grading.grade_effort', 'ai_grading.double_check',
    'ai_grading.tiebreak_model', 'ai_grading.key_model', 'ai_grading.daily_budget_usd'
  ])
);

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
      'zalo.absence_template', 'zalo.comment_template', 'zalo.comment_footer',
      'ai_grading.enabled', 'ai_grading.grade_model', 'ai_grading.grade_effort', 'ai_grading.double_check',
      'ai_grading.tiebreak_model', 'ai_grading.key_model', 'ai_grading.daily_budget_usd'
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
    elsif v_key = 'ai_grading.daily_budget_usd' then
      if pg_catalog.jsonb_typeof(v_value) <> 'number' or not ((v_value #>> '{}') ~ '^[0-9]+$') or (v_value #>> '{}')::integer not between 1 and 200 then
        raise exception using errcode = '22023', message = 'SYSTEM_SETTINGS_INVALID_AI_BUDGET';
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
        or (v_key in ('zalo.absence_message_enabled', 'zalo.comment_message_enabled', 'ai_grading.enabled', 'ai_grading.double_check')
          and v_text not in ('on', 'off'))
        or (v_key = 'zalo.absence_template' and (v_text = '' or pg_catalog.length(v_text) > 1000))
        or (v_key = 'zalo.comment_template' and (v_text = '' or pg_catalog.length(v_text) > 3000))
        or (v_key = 'zalo.comment_footer' and pg_catalog.length(v_text) > 1500)
        or (v_key = 'ai_grading.grade_model' and v_text not in ('claude-haiku-5-5', 'claude-sonnet-5-5'))
        or (v_key = 'ai_grading.grade_effort' and v_text not in ('low', 'medium', 'high'))
        or (v_key = 'ai_grading.tiebreak_model' and v_text not in ('claude-sonnet-5-5', 'claude-haiku-5-5', 'off'))
        or (v_key = 'ai_grading.key_model' and v_text not in ('claude-opus-5-5', 'claude-sonnet-5-5'))
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

-- Cài đặt chấm AI đã điền mặc định (khóa chưa lưu thì lấy mặc định). Bản TS: src/features/ai-grading/settings.ts.
create or replace function public.ai_grading_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with stored as (
    select coalesce(pg_catalog.jsonb_object_agg(setting.key, setting.value), '{}'::jsonb) as value
    from public.system_settings as setting
    where setting.key like 'ai\_grading.%'
  )
  select pg_catalog.jsonb_build_object(
    'enabled', coalesce(stored.value ->> 'ai_grading.enabled', 'off') = 'on',
    'grade_model', coalesce(stored.value ->> 'ai_grading.grade_model', 'claude-haiku-5-5'),
    'grade_effort', coalesce(stored.value ->> 'ai_grading.grade_effort', 'medium'),
    'double_check', coalesce(stored.value ->> 'ai_grading.double_check', 'on') = 'on',
    'tiebreak_model', coalesce(stored.value ->> 'ai_grading.tiebreak_model', 'claude-sonnet-5-5'),
    'key_model', coalesce(stored.value ->> 'ai_grading.key_model', 'claude-opus-5-5'),
    'daily_budget_usd', coalesce((stored.value ->> 'ai_grading.daily_budget_usd')::numeric, 20)
  )
  from stored;
$$;

-- ---------------------------------------------------------------------------
-- 2. Trạng thái tiến trình nền (một dòng)
-- ---------------------------------------------------------------------------

create table public.ai_grading_worker_state (
  id boolean primary key default true,
  paused_until timestamptz,
  pause_reason text,
  paused_at timestamptz,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint ai_grading_worker_state_singleton_check check (id),
  constraint ai_grading_worker_state_reason_check check (pause_reason is null or pg_catalog.char_length(pause_reason) between 1 and 500)
);

insert into public.ai_grading_worker_state (id) values (true);

alter table public.ai_grading_worker_state enable row level security;
revoke all on public.ai_grading_worker_state from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lượt chạy và kết quả AI trên bài nộp
-- ---------------------------------------------------------------------------

alter table public.grading_runs
  add column cache_creation_tokens integer,
  add constraint grading_runs_cache_creation_check check (cache_creation_tokens is null or cache_creation_tokens >= 0);

-- Mỗi bài chỉ có một lượt chấm đang chờ hoặc đang chạy.
create unique index grading_runs_active_grade_idx
  on public.grading_runs (submission_id)
  where run_type = 'grade' and status in ('queued', 'running');

-- Chi phí ước tính theo ngày (giờ Việt Nam), cộng mỗi khi một lượt trả kết quả. Trần ngày đọc ở đây.
create table public.ai_grading_daily_spend (
  spend_date date primary key,
  cost_usd numeric(12, 4) not null default 0,
  runs integer not null default 0,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint ai_grading_daily_spend_values_check check (cost_usd >= 0 and runs >= 0)
);

alter table public.ai_grading_daily_spend enable row level security;
revoke all on public.ai_grading_daily_spend from anon, authenticated;

alter table public.grading_submissions
  add column ai_color text,
  add column ai_raw_score numeric(5, 2),
  add column ai_question_results jsonb,
  add column ai_flags text[] not null default '{}',
  add column ai_confidence text,
  add column ai_answer_key_version integer,
  add column ai_run_id uuid references public.grading_runs(id) on delete set null,
  add column ai_graded_at timestamptz,
  add constraint grading_submissions_ai_color_check check (ai_color is null or ai_color in ('green', 'yellow', 'red')),
  add constraint grading_submissions_ai_confidence_check check (ai_confidence is null or ai_confidence in ('high', 'medium', 'low')),
  add constraint grading_submissions_ai_score_check check (ai_raw_score is null or ai_raw_score between 0 and 10),
  add constraint grading_submissions_ai_version_check check (ai_answer_key_version is null or ai_answer_key_version >= 1),
  -- Xanh/vàng có điểm và kết quả từng câu; đỏ là AI không cho được kết quả dùng được.
  add constraint grading_submissions_ai_result_check check (
    (ai_color is null and ai_graded_at is null and ai_raw_score is null and ai_question_results is null)
    or (ai_color in ('green', 'yellow') and ai_graded_at is not null and ai_raw_score is not null
      and pg_catalog.jsonb_typeof(ai_question_results) = 'array' and ai_answer_key_version is not null)
    or (ai_color = 'red' and ai_graded_at is not null and ai_raw_score is null)
  );

create index grading_submissions_ai_run_idx on public.grading_submissions (ai_run_id) where ai_run_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Hàm nội bộ
-- ---------------------------------------------------------------------------

-- Điểm bài (chưa làm tròn, chưa cộng): tổng điểm các câu đúng. Bản TS: src/features/ai-grading/scoring.ts.
create or replace function public.grading_raw_score(p_answer_key jsonb, p_verdicts jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(pg_catalog.sum((question ->> 'max_points')::numeric), 0)
  from pg_catalog.jsonb_array_elements(coalesce(p_answer_key -> 'questions', '[]'::jsonb)) as question
  where p_verdicts ->> (question ->> 'label') = 'correct';
$$;

-- Đầu ngày hôm nay theo giờ Việt Nam.
create or replace function public.ai_grading_day_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select pg_catalog.date_trunc('day', pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
$$;

create or replace function public.ai_grading_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

-- Xếp lượt chấm cho một bài nếu bài đang tính điểm, buổi có đáp án chốt và AI chưa chấm theo
-- đúng phiên bản đáp án đó. Trả id lượt (mới hoặc đang có), null khi không cần chấm.
create or replace function public.enqueue_submission_grading(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.grading_submissions%rowtype;
  v_test public.session_tests%rowtype;
  v_settings jsonb;
  v_id uuid;
begin
  select * into v_submission from public.grading_submissions as submission where submission.id = p_submission_id;
  if not found or not v_submission.counts_for_score then
    return null;
  end if;

  select * into v_test from public.session_tests as test where test.class_session_id = v_submission.class_session_id;
  if not found or v_test.status <> 'key_confirmed' then
    return null;
  end if;

  if v_submission.ai_answer_key_version is not distinct from v_test.answer_key_version then
    return null;
  end if;

  update public.grading_runs as run
  set status = 'cancelled', finished_at = pg_catalog.now(), error_code = 'superseded_key'
  where run.submission_id = p_submission_id
    and run.run_type = 'grade'
    and run.status = 'queued'
    and run.answer_key_version <> v_test.answer_key_version;

  -- Lượt đang chạy theo đáp án cũ: khi xong, complete_grading_run thấy lệch phiên bản và xếp lại.
  select run.id into v_id
  from public.grading_runs as run
  where run.submission_id = p_submission_id and run.run_type = 'grade' and run.status in ('queued', 'running');
  if found then
    return v_id;
  end if;

  v_settings := public.ai_grading_settings();
  insert into public.grading_runs (run_type, test_id, submission_id, answer_key_version, model, prompt_version, effort)
  values ('grade', v_test.id, p_submission_id, v_test.answer_key_version, v_settings ->> 'grade_model', 'grade-v2', v_settings ->> 'grade_effort')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.cancel_submission_grading(p_submission_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.grading_runs as run
  set status = 'cancelled', finished_at = pg_catalog.now(), error_code = p_reason
  where run.submission_id = p_submission_id and run.run_type = 'grade' and run.status = 'queued';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- AI không chấm được bài (hết số lần thử): bài thành "đỏ" để trợ giảng chấm tay.
create or replace function public.record_submission_ai_failure(p_run public.grading_runs)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.grading_submissions as submission
  set ai_color = 'red',
      ai_raw_score = null,
      ai_question_results = null,
      ai_flags = '{}',
      ai_confidence = null,
      ai_answer_key_version = p_run.answer_key_version,
      ai_run_id = p_run.id,
      ai_graded_at = pg_catalog.now()
  where submission.id = p_run.submission_id
    and submission.counts_for_score
    and exists (
      select 1 from public.session_tests as test
      where test.id = p_run.test_id and test.answer_key_version = p_run.answer_key_version
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Tự xếp lượt chấm
-- ---------------------------------------------------------------------------

create or replace function public.grading_submissions_queue_ai()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.counts_for_score then
    if tg_op = 'INSERT' or not old.counts_for_score or old.class_session_id is distinct from new.class_session_id then
      perform public.enqueue_submission_grading(new.id);
    end if;
  elsif tg_op = 'UPDATE' and old.counts_for_score then
    perform public.cancel_submission_grading(new.id, 'superseded_submission');
  end if;
  return null;
end;
$$;

create trigger grading_submissions_queue_ai
after insert or update of counts_for_score, class_session_id on public.grading_submissions
for each row execute function public.grading_submissions_queue_ai();

-- Chốt đáp án lần đầu, sửa sau khi chốt, hay dùng lại đề: chấm (lại) mọi bài đang tính điểm của buổi.
create or replace function public.session_tests_queue_ai()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission_id uuid;
begin
  if new.status <> 'key_confirmed' then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'key_confirmed' and old.answer_key_version = new.answer_key_version then
    return null;
  end if;

  for v_submission_id in
    select submission.id
    from public.grading_submissions as submission
    where submission.class_session_id = new.class_session_id and submission.counts_for_score
    order by submission.submitted_at
  loop
    perform public.enqueue_submission_grading(v_submission_id);
  end loop;
  return null;
end;
$$;

create trigger session_tests_queue_ai
after insert or update of status, answer_key_version on public.session_tests
for each row execute function public.session_tests_queue_ai();

-- "AI đọc đề" dùng model đọc đề trong cài đặt (mặc định Opus 5.5).
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
  values ('extract_key', v_test.id, public.ai_grading_settings() ->> 'key_model', 'key-v1', 'high', v_actor)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Tiến trình nền (chỉ service_role)
-- ---------------------------------------------------------------------------

-- Nhận tối đa p_limit lượt. Không nhận gì khi chưa bật, đang tạm dừng hoặc đã chạm trần chi phí ngày.
-- Lượt đang chạy quá hạn khóa (worker chết giữa chừng) được nhận lại; quá 3 lần thì thành lỗi.
-- payload: grade → bài làm + đáp án đúng phiên bản; extract_key → đường dẫn các trang ảnh.
create or replace function public.claim_grading_runs(p_limit integer default 4, p_lock_seconds integer default 330)
returns table (
  run_id uuid,
  run_type text,
  test_id uuid,
  submission_id uuid,
  answer_key_version integer,
  model text,
  effort text,
  prompt_version text,
  attempt_count integer,
  payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings jsonb := public.ai_grading_settings();
  v_state public.ai_grading_worker_state%rowtype;
  v_spent numeric;
  v_run public.grading_runs%rowtype;
begin
  if not (v_settings ->> 'enabled')::boolean then
    return;
  end if;

  select * into v_state from public.ai_grading_worker_state as state where state.id for update;
  if v_state.paused_until is not null and v_state.paused_until > pg_catalog.now() then
    return;
  end if;

  select coalesce(spend.cost_usd, 0) into v_spent
  from (select 1) as one
  left join public.ai_grading_daily_spend as spend on spend.spend_date = public.ai_grading_today();
  if v_spent >= (v_settings ->> 'daily_budget_usd')::numeric then
    update public.ai_grading_worker_state as state
    set paused_until = (public.ai_grading_today() + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh',
        pause_reason = 'daily_budget', paused_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where state.id;
    perform public.raise_ops_alert(
      'ai_grading_daily_budget',
      'Chấm bài AI tạm dừng: chạm trần chi phí ngày',
      pg_catalog.format('Hôm nay đã dùng khoảng %s USD (trần %s USD). Chấm bài AI chạy lại từ 0 giờ ngày mai; trong lúc chờ, trợ giảng chấm tay.',
        pg_catalog.round(v_spent, 2), v_settings ->> 'daily_budget_usd'),
      'ops.ai_grading_daily_budget:' || public.ai_grading_today()::text,
      '/settings/ai-grading'
    );
    return;
  end if;

  -- Buổi đã khóa hoặc đã hủy: không chấm nữa (không ghi điểm được).
  update public.grading_runs as run
  set status = 'cancelled', finished_at = pg_catalog.now(), error_code = 'session_closed'
  where run.status = 'queued'
    and exists (
      select 1
      from public.session_tests as test
      join public.class_sessions as session_row on session_row.id = test.class_session_id
      where test.id = run.test_id and (session_row.locked_at is not null or session_row.status = 'cancelled')
    );

  for v_run in
    update public.grading_runs as run
    set status = 'failed', finished_at = pg_catalog.now(), locked_until = null, error_code = 'worker_timeout',
        error_message = 'Tiến trình nền dừng giữa chừng 3 lần.'
    where run.status = 'running' and run.locked_until < pg_catalog.now() and run.attempt_count >= 3
    returning run.*
  loop
    if v_run.run_type = 'grade' then
      perform public.record_submission_ai_failure(v_run);
    end if;
  end loop;

  return query
  with picked as (
    select run.id
    from public.grading_runs as run
    where (run.status = 'queued' and run.next_attempt_at <= pg_catalog.now())
       or (run.status = 'running' and run.locked_until < pg_catalog.now())
    order by (run.run_type = 'extract_key') desc, run.next_attempt_at, run.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 4), 10))
  ),
  claimed as (
    update public.grading_runs as run
    set status = 'running',
        attempt_count = run.attempt_count + 1,
        locked_until = pg_catalog.now() + pg_catalog.make_interval(secs => greatest(60, least(coalesce(p_lock_seconds, 330), 900))),
        started_at = pg_catalog.now(),
        model = case when run.run_type = 'grade' then v_settings ->> 'grade_model' else v_settings ->> 'key_model' end,
        effort = case when run.run_type = 'grade' then v_settings ->> 'grade_effort' else 'high' end
    from picked
    where run.id = picked.id
    returning run.*
  )
  select
    claimed.id,
    claimed.run_type,
    claimed.test_id,
    claimed.submission_id,
    claimed.answer_key_version,
    claimed.model,
    claimed.effort,
    claimed.prompt_version,
    claimed.attempt_count,
    case when claimed.run_type = 'grade' then
      pg_catalog.jsonb_build_object(
        'answer_text', submission.answer_text,
        'answer_key', test.answer_key,
        'test_title', test.title,
        'current_key_version', test.answer_key_version,
        'counts_for_score', submission.counts_for_score,
        'double_check', (v_settings ->> 'double_check')::boolean,
        'tiebreak_model', nullif(v_settings ->> 'tiebreak_model', 'off')
      )
    else
      pg_catalog.jsonb_build_object(
        'pages', coalesce((
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object('storage_path', asset.storage_path, 'mime_type', asset.mime_type, 'page_no', asset.page_no)
            order by asset.page_no
          )
          from public.session_test_assets as asset
          where asset.test_id = claimed.test_id
        ), '[]'::jsonb),
        'test_status', test.status
      )
    end
  from claimed
  join public.session_tests as test on test.id = claimed.test_id
  left join public.grading_submissions as submission on submission.id = claimed.submission_id;
end;
$$;

-- Trả kết quả một lượt đang chạy.
-- p_outcome:
--   succeeded: grade → p_result {color, verdicts {nhãn: verdict}, questions[], flags[], confidence, calls[]};
--              extract_key → p_result {answer_key {questions[]}, title, transcription_warnings[], served_by, ...}
--   failed:    không thử lại (bài chấm thành đỏ).
--   retry:     lỗi tạm thời; thử lại sau p_retry_after_seconds (mặc định tăng dần), tối đa 3 lần.
--   paused:    hết tín dụng / chạm trần workspace / khóa API sai: lượt quay lại hàng đợi, cả hàng đợi dừng 1 giờ.
-- p_usage: {input_tokens, cache_read_tokens, cache_creation_tokens, output_tokens, cost_usd, request_id, latency_ms, model, stop_reason}
-- Trả: applied, stale, draft_changed, key_confirmed, invalid_key, failed, retry_scheduled, paused, not_running.
create or replace function public.complete_grading_run(
  p_run_id uuid,
  p_outcome text,
  p_result jsonb default null,
  p_usage jsonb default null,
  p_error_code text default null,
  p_error_message text default null,
  p_retry_after_seconds integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.grading_runs%rowtype;
  v_test public.session_tests%rowtype;
  v_submission public.grading_submissions%rowtype;
  v_usage jsonb := coalesce(p_usage, '{}'::jsonb);
  v_cost numeric := greatest(coalesce((coalesce(p_usage, '{}'::jsonb) ->> 'cost_usd')::numeric, 0), 0);
  v_error_message text := pg_catalog.left(nullif(pg_catalog.btrim(coalesce(p_error_message, '')), ''), 2000);
  v_outcome text;
  v_key jsonb;
  v_verdicts jsonb;
  v_color text;
  v_labels_ok boolean;
begin
  if p_outcome is null or p_outcome not in ('succeeded', 'failed', 'retry', 'paused') then
    raise exception using errcode = '22023', message = 'GRADING_RUN_INVALID_OUTCOME';
  end if;

  select * into v_run from public.grading_runs as run where run.id = p_run_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'GRADING_RUN_NOT_FOUND';
  end if;
  if v_run.status <> 'running' then
    return 'not_running';
  end if;

  -- Token và chi phí cộng dồn qua các lần thử; chi phí cũng vào sổ theo ngày.
  update public.grading_runs as run
  set input_tokens = coalesce(run.input_tokens, 0) + coalesce((v_usage ->> 'input_tokens')::integer, 0),
      cache_read_tokens = coalesce(run.cache_read_tokens, 0) + coalesce((v_usage ->> 'cache_read_tokens')::integer, 0),
      cache_creation_tokens = coalesce(run.cache_creation_tokens, 0) + coalesce((v_usage ->> 'cache_creation_tokens')::integer, 0),
      output_tokens = coalesce(run.output_tokens, 0) + coalesce((v_usage ->> 'output_tokens')::integer, 0),
      cost_usd_est = coalesce(run.cost_usd_est, 0) + v_cost,
      request_id = coalesce(pg_catalog.left(v_usage ->> 'request_id', 200), run.request_id),
      latency_ms = coalesce((v_usage ->> 'latency_ms')::integer, run.latency_ms),
      model = coalesce(nullif(pg_catalog.left(v_usage ->> 'model', 60), ''), run.model),
      stop_reason = coalesce(pg_catalog.left(v_usage ->> 'stop_reason', 40), run.stop_reason),
      error_code = case when p_outcome = 'succeeded' then null else pg_catalog.left(p_error_code, 80) end,
      error_message = case when p_outcome = 'succeeded' then null else v_error_message end
  where run.id = v_run.id
  returning run.* into v_run;

  insert into public.ai_grading_daily_spend as spend (spend_date, cost_usd, runs)
  values (public.ai_grading_today(), v_cost, 1)
  on conflict (spend_date) do update
  set cost_usd = spend.cost_usd + excluded.cost_usd, runs = spend.runs + 1, updated_at = pg_catalog.now();

  if p_outcome = 'paused' then
    update public.grading_runs as run
    set status = 'queued', locked_until = null, attempt_count = greatest(run.attempt_count - 1, 0),
        next_attempt_at = pg_catalog.now() + interval '1 hour'
    where run.id = v_run.id;
    update public.ai_grading_worker_state as state
    set paused_until = pg_catalog.now() + interval '1 hour',
        pause_reason = coalesce(pg_catalog.left(p_error_code, 80), 'api_unavailable'),
        paused_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where state.id;
    perform public.raise_ops_alert(
      'ai_grading_paused',
      'Chấm bài AI tạm dừng: Claude API từ chối',
      pg_catalog.format('Lý do: %s. Hàng đợi thử lại sau 1 giờ; trong lúc chờ, trợ giảng chấm tay. %s',
        case p_error_code
          when 'credit_exhausted' then 'hết tín dụng API'
          when 'workspace_limit' then 'chạm trần chi tiêu của workspace'
          when 'spend_limit' then 'chạm trần chi tiêu tháng'
          when 'auth_failed' then 'khóa API sai hoặc đã bị thu hồi'
          else coalesce(p_error_code, 'không rõ')
        end,
        coalesce(v_error_message, '')),
      'ops.ai_grading_paused:' || coalesce(p_error_code, 'unknown') || ':' || public.ai_grading_today()::text,
      '/settings/ai-grading'
    );
    return 'paused';
  end if;

  if p_outcome = 'retry' and v_run.attempt_count < 3 then
    update public.grading_runs as run
    set status = 'queued', locked_until = null,
        next_attempt_at = pg_catalog.now() + pg_catalog.make_interval(
          secs => greatest(5, least(coalesce(p_retry_after_seconds, 30 * (2 ^ greatest(v_run.attempt_count - 1, 0))::integer), 3600)))
    where run.id = v_run.id;
    return 'retry_scheduled';
  end if;

  if p_outcome in ('retry', 'failed') then
    update public.grading_runs as run
    set status = 'failed', locked_until = null, finished_at = pg_catalog.now()
    where run.id = v_run.id
    returning run.* into v_run;
    if v_run.run_type = 'grade' then
      perform public.record_submission_ai_failure(v_run);
    end if;
    return 'failed';
  end if;

  -- succeeded
  if v_run.run_type = 'extract_key' then
    select * into v_test from public.session_tests as test where test.id = v_run.test_id for update;
    if v_test.status = 'key_confirmed' then
      v_outcome := 'key_confirmed';
    elsif pg_catalog.jsonb_array_length(coalesce(v_test.answer_key -> 'questions', '[]'::jsonb)) > 0
      and v_test.updated_at > v_run.created_at then
      -- Trợ giảng đã sửa bản nháp sau khi yêu cầu: không ghi đè, bản AI vẫn nằm trong lượt.
      v_outcome := 'draft_changed';
    else
      begin
        v_key := public.normalize_session_test_answer_key(coalesce(p_result -> 'answer_key', '{"questions": []}'::jsonb));
        update public.session_tests as test
        set answer_key = v_key,
            status = case when pg_catalog.jsonb_array_length(v_key -> 'questions') > 0 then 'key_review' else 'draft' end,
            title = coalesce(test.title, nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_result ->> 'title', '')), 200), ''))
        where test.id = v_test.id;
        v_outcome := 'applied';
      exception when others then
        v_outcome := 'invalid_key';
      end;
    end if;

    update public.grading_runs as run
    set status = 'succeeded', locked_until = null, finished_at = pg_catalog.now(),
        result = coalesce(p_result, '{}'::jsonb) || pg_catalog.jsonb_build_object('outcome', v_outcome)
    where run.id = v_run.id;
    return v_outcome;
  end if;

  -- grade
  select * into v_submission from public.grading_submissions as submission where submission.id = v_run.submission_id for update;
  select * into v_test from public.session_tests as test where test.id = v_run.test_id;
  v_color := p_result ->> 'color';
  v_verdicts := p_result -> 'verdicts';

  if not v_submission.counts_for_score or v_test.status <> 'key_confirmed' or v_test.answer_key_version <> v_run.answer_key_version then
    v_outcome := 'stale';
  else
    -- Khuôn JSON bảo đảm cấu trúc, không bảo đảm đủ câu: kiểm tra lại đúng nhãn của đáp án.
    v_labels_ok := pg_catalog.jsonb_typeof(v_verdicts) = 'object'
      and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_verdicts))
        = pg_catalog.jsonb_array_length(v_test.answer_key -> 'questions')
      and not exists (
        select 1 from pg_catalog.jsonb_array_elements(v_test.answer_key -> 'questions') as question
        where coalesce(v_verdicts ->> (question ->> 'label'), '') not in ('correct', 'incorrect', 'missing')
      );

    if v_color in ('green', 'yellow') and coalesce(v_labels_ok, false) then
      update public.grading_submissions as submission
      set ai_color = v_color,
          ai_raw_score = public.grading_raw_score(v_test.answer_key, v_verdicts),
          ai_question_results = case when pg_catalog.jsonb_typeof(p_result -> 'questions') = 'array' then p_result -> 'questions' else '[]'::jsonb end,
          ai_flags = coalesce(array(
            select flag from pg_catalog.jsonb_array_elements_text(
              case when pg_catalog.jsonb_typeof(p_result -> 'flags') = 'array' then p_result -> 'flags' else '[]'::jsonb end
            ) as flag
          ), '{}'),
          ai_confidence = case when p_result ->> 'confidence' in ('high', 'medium', 'low') then p_result ->> 'confidence' end,
          ai_answer_key_version = v_run.answer_key_version,
          ai_run_id = v_run.id,
          ai_graded_at = pg_catalog.now()
      where submission.id = v_submission.id;
    else
      perform public.record_submission_ai_failure(v_run);
    end if;
    v_outcome := 'applied';
  end if;

  update public.grading_runs as run
  set status = 'succeeded', locked_until = null, finished_at = pg_catalog.now(),
      result = coalesce(p_result, '{}'::jsonb) || pg_catalog.jsonb_build_object('outcome', v_outcome)
  where run.id = v_run.id;

  if v_outcome = 'stale' then
    perform public.enqueue_submission_grading(v_submission.id);
  end if;
  return v_outcome;
end;
$$;

-- Cảnh báo khi hàng đợi kẹt (worker không chạy) hoặc lỗi nhiều. Chạy 10 phút/lần.
create or replace function public.run_ai_grading_health_check()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings jsonb := public.ai_grading_settings();
  v_state public.ai_grading_worker_state%rowtype;
  v_hour text := pg_catalog.to_char(pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24');
  v_waiting integer;
  v_finished integer;
  v_failed integer;
begin
  if not (v_settings ->> 'enabled')::boolean then
    return;
  end if;
  select * into v_state from public.ai_grading_worker_state as state where state.id;
  if v_state.paused_until is not null and v_state.paused_until > pg_catalog.now() then
    return;
  end if;

  select pg_catalog.count(*)::integer into v_waiting
  from public.grading_runs as run
  where run.status = 'queued' and run.next_attempt_at < pg_catalog.now() - interval '20 minutes';
  if v_waiting > 0 then
    perform public.raise_ops_alert(
      'ai_grading_queue_stalled',
      'Chấm bài AI: có lượt chờ quá 20 phút',
      pg_catalog.format('%s lượt đọc đề/chấm bài đang chờ quá 20 phút. Kiểm tra ANTHROPIC_API_KEY và CRON_SECRET trên Vercel, hoặc mở trang buổi học để chạy lại.', v_waiting),
      'ops.ai_grading_queue_stalled:' || v_hour,
      '/settings/ai-grading'
    );
  end if;

  select pg_catalog.count(*)::integer, (pg_catalog.count(*) filter (where run.status = 'failed'))::integer
  into v_finished, v_failed
  from public.grading_runs as run
  where run.finished_at >= pg_catalog.now() - interval '1 hour' and run.status in ('succeeded', 'failed');
  if v_finished >= 5 and v_failed * 5 > v_finished then
    perform public.raise_ops_alert(
      'ai_grading_failure_rate',
      'Chấm bài AI: lỗi nhiều trong 1 giờ qua',
      pg_catalog.format('%s/%s lượt lỗi trong 1 giờ qua. Các bài lỗi hiện màu đỏ để trợ giảng chấm tay.', v_failed, v_finished),
      'ops.ai_grading_failure_rate:' || v_hour,
      '/settings/ai-grading'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC cho người dùng
-- ---------------------------------------------------------------------------

-- Tổng quan cho trang Cài đặt → Chấm bài AI.
create or replace function public.get_ai_grading_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_state public.ai_grading_worker_state%rowtype;
  v_today date := public.ai_grading_today();
  v_day_start timestamptz := public.ai_grading_today()::timestamp at time zone 'Asia/Ho_Chi_Minh';
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('settings.view') then
    raise exception using errcode = '42501', message = 'SYSTEM_SETTINGS_PERMISSION_DENIED';
  end if;

  select * into v_state from public.ai_grading_worker_state as state where state.id;

  return pg_catalog.jsonb_build_object(
    'settings', public.ai_grading_settings(),
    'paused_until', case when v_state.paused_until > pg_catalog.now() then v_state.paused_until end,
    'pause_reason', case when v_state.paused_until > pg_catalog.now() then v_state.pause_reason end,
    'spent_today_usd', coalesce((select spend.cost_usd from public.ai_grading_daily_spend as spend where spend.spend_date = v_today), 0),
    'spent_month_usd', coalesce((
      select pg_catalog.sum(spend.cost_usd) from public.ai_grading_daily_spend as spend
      where spend.spend_date >= pg_catalog.date_trunc('month', v_today)::date
    ), 0),
    'queued', (select pg_catalog.count(*) from public.grading_runs as run where run.status = 'queued'),
    'running', (select pg_catalog.count(*) from public.grading_runs as run where run.status = 'running'),
    'graded_today', (
      select pg_catalog.count(*) from public.grading_runs as run
      where run.run_type = 'grade' and run.status = 'succeeded' and run.finished_at >= v_day_start
    ),
    'failed_today', (
      select pg_catalog.count(*) from public.grading_runs as run
      where run.status = 'failed' and run.finished_at >= v_day_start
    ),
    'keys_read_today', (
      select pg_catalog.count(*) from public.grading_runs as run
      where run.run_type = 'extract_key' and run.status = 'succeeded' and run.finished_at >= v_day_start
    )
  );
end;
$$;

-- Owner cho chạy lại ngay sau khi đã xử lý nguyên nhân tạm dừng (nạp tín dụng, sửa khóa, nâng trần...).
create or replace function public.resume_ai_grading()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old jsonb;
begin
  if v_actor is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('settings.manage') then raise exception using errcode = '42501', message = 'SYSTEM_SETTINGS_PERMISSION_DENIED'; end if;

  select pg_catalog.jsonb_build_object('paused_until', state.paused_until, 'pause_reason', state.pause_reason)
  into v_old from public.ai_grading_worker_state as state where state.id for update;

  update public.ai_grading_worker_state as state
  set paused_until = null, pause_reason = null, paused_at = null, updated_at = pg_catalog.now()
  where state.id;
  update public.grading_runs as run
  set next_attempt_at = pg_catalog.now()
  where run.status = 'queued' and run.next_attempt_at > pg_catalog.now();

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data)
  values (v_actor, 'settings', 'ai_grading_resumed', 'ai_grading_worker_state', 'worker', v_old, null);
end;
$$;

-- Đề của một buổi: thêm cảnh báo của AI khi đọc đề và kết quả ghi bản nháp (outcome).
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
    )
  )
  into v_result
  from public.session_tests as test
  where test.class_session_id = p_class_session_id;

  return v_result;
end;
$$;

-- Bài nộp của buổi: thêm kết quả AI và trạng thái chấm.
-- ai_state: not_counted (bài cũ đã có bài nộp sau), grading (đang chờ/đang chấm), waiting_key
-- (chưa chốt đáp án hoặc chưa chấm theo bản đáp án mới), graded, failed.
drop function public.get_session_grading_submissions(uuid);
create function public.get_session_grading_submissions(p_class_session_id uuid)
returns table (
  submission_id uuid,
  student_id uuid,
  student_full_name text,
  student_public_code text,
  submitted_at timestamptz,
  answer_text text,
  answer_truncated boolean,
  attempt_no integer,
  counts_for_score boolean,
  student_match_method text,
  session_match_method text,
  match_issues text[],
  ai_state text,
  ai_color text,
  ai_raw_score numeric,
  ai_question_results jsonb,
  ai_flags text[],
  ai_confidence text,
  ai_answer_key_version integer,
  ai_graded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('ai_grading.view') then
    raise exception using errcode = '42501', message = 'AI_GRADING_VIEW_PERMISSION_DENIED';
  end if;

  return query
    select
      submission.id,
      submission.student_id,
      student.full_name,
      student.public_code,
      submission.submitted_at,
      submission.answer_text,
      submission.answer_truncated,
      submission.attempt_no,
      submission.counts_for_score,
      submission.student_match_method,
      submission.session_match_method,
      submission.match_issues,
      case
        when not submission.counts_for_score then 'not_counted'
        when exists (
          select 1 from public.grading_runs as run
          where run.submission_id = submission.id and run.run_type = 'grade' and run.status in ('queued', 'running')
        ) then 'grading'
        when test.id is null or test.status <> 'key_confirmed'
          or submission.ai_answer_key_version is distinct from test.answer_key_version then 'waiting_key'
        when submission.ai_color = 'red' then 'failed'
        else 'graded'
      end,
      submission.ai_color,
      submission.ai_raw_score,
      submission.ai_question_results,
      submission.ai_flags,
      submission.ai_confidence,
      submission.ai_answer_key_version,
      submission.ai_graded_at
    from public.grading_submissions as submission
    join public.students as student on student.id = submission.student_id
    left join public.session_tests as test on test.class_session_id = submission.class_session_id
    where submission.class_session_id = p_class_session_id
      and submission.match_status = 'matched'
    order by submission.submitted_at desc, submission.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Lịch chạy
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ai-grading-health-check';
    perform cron.schedule('ai-grading-health-check', '*/10 * * * *', 'select public.run_ai_grading_health_check();');
  else
    raise warning 'AI_GRADING_HEALTH_CRON_UNAVAILABLE: pg_cron chưa bật, không có cảnh báo hàng đợi chấm AI.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Quyền gọi hàm
-- ---------------------------------------------------------------------------

-- Hàm nội bộ: chỉ gọi từ hàm khác hoặc trigger.
revoke all on function public.ai_grading_settings() from public, anon, authenticated, service_role;
revoke all on function public.grading_raw_score(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.ai_grading_today() from public, anon, authenticated, service_role;
revoke all on function public.enqueue_submission_grading(uuid) from public, anon, authenticated, service_role;
revoke all on function public.cancel_submission_grading(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.record_submission_ai_failure(public.grading_runs) from public, anon, authenticated, service_role;
revoke all on function public.grading_submissions_queue_ai() from public, anon, authenticated, service_role;
revoke all on function public.session_tests_queue_ai() from public, anon, authenticated, service_role;
revoke all on function public.run_ai_grading_health_check() from public, anon, authenticated, service_role;

-- Tiến trình nền.
revoke all on function public.claim_grading_runs(integer, integer) from public, anon, authenticated;
revoke all on function public.complete_grading_run(uuid, text, jsonb, jsonb, text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_grading_runs(integer, integer) to service_role;
grant execute on function public.complete_grading_run(uuid, text, jsonb, jsonb, text, text, integer) to service_role;

-- Người dùng.
revoke all on function public.get_ai_grading_overview() from public, anon;
revoke all on function public.resume_ai_grading() from public, anon;
revoke all on function public.get_session_grading_submissions(uuid) from public, anon;
grant execute on function public.get_ai_grading_overview() to authenticated;
grant execute on function public.resume_ai_grading() to authenticated;
grant execute on function public.get_session_grading_submissions(uuid) to authenticated;
