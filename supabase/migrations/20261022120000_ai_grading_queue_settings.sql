-- Chấm bài AI, Giai đoạn 3c: owner sửa câu mẫu nhận xét, trang "Chấm bài AI" (hàng chờ duyệt theo
-- buổi, số liệu hôm nay), chi phí 30 ngày, nhắc khi buổi sắp tự khóa mà còn bài chưa duyệt.

-- ---------------------------------------------------------------------------
-- 1. Câu mẫu nhận xét (chỉ owner)
-- ---------------------------------------------------------------------------

-- Thay toàn bộ câu mẫu: p_phrases = [{"slot": "y4", "text": "..."}, ...] theo thứ tự hiển thị.
-- Mỗi ô cần ít nhất 1 câu (tối đa 20), mỗi câu 1–500 ký tự. Trả số câu đã lưu.
create or replace function public.set_grading_comment_phrases(p_phrases jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  v_count integer;
begin
  if v_actor is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('settings.manage') then raise exception using errcode = '42501', message = 'SYSTEM_SETTINGS_PERMISSION_DENIED'; end if;
  if pg_catalog.jsonb_typeof(p_phrases) <> 'array' then
    raise exception using errcode = '22023', message = 'GRADING_PHRASES_INVALID';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('slot', item ->> 'slot', 'text', pg_catalog.btrim(item ->> 'text')) order by position), '[]'::jsonb)
  into v_new
  from pg_catalog.jsonb_array_elements(p_phrases) with ordinality as items(item, position);

  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_new) as item
    where pg_catalog.jsonb_typeof(item -> 'slot') <> 'string'
      or item ->> 'slot' not in ('y1_correct', 'y2_correct', 'y2_wrong', 'y3_praised', 'y3_quiet', 'y4')
      or coalesce(pg_catalog.char_length(item ->> 'text'), 0) not between 1 and 500
  ) then
    raise exception using errcode = '22023', message = 'GRADING_PHRASES_INVALID';
  end if;
  if exists (
    select 1
    from (values ('y1_correct'), ('y2_correct'), ('y2_wrong'), ('y3_praised'), ('y3_quiet'), ('y4')) as slots(slot)
    where (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(v_new) as item where item ->> 'slot' = slots.slot) not between 1 and 20
  ) then
    raise exception using errcode = '22023', message = 'GRADING_PHRASES_SLOT_COUNT';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('slot', phrase.slot, 'text', phrase.text) order by phrase.slot, phrase.sort_order), '[]'::jsonb)
  into v_old
  from public.grading_comment_phrases as phrase
  where phrase.active;

  delete from public.grading_comment_phrases where true;
  insert into public.grading_comment_phrases (slot, text, sort_order, updated_by)
  select item ->> 'slot', item ->> 'text', position::integer, v_actor
  from pg_catalog.jsonb_array_elements(v_new) with ordinality as items(item, position);
  get diagnostics v_count = row_count;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data)
  values (v_actor, 'settings', 'grading_comment_phrases_updated', 'grading_comment_phrases', 'all', v_old, v_new);
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Trang "Chấm bài AI": các buổi có đề hoặc bài nộp trong khoảng ngày
-- ---------------------------------------------------------------------------

create or replace function public.list_ai_grading_sessions(p_from date, p_to date)
returns table (
  class_session_id uuid,
  class_code text,
  class_name text,
  session_date date,
  start_time time,
  end_time time,
  session_status text,
  locked_at timestamptz,
  auto_lock_at timestamptz,
  test_status text,
  answer_key_version integer,
  submissions integer,
  grading integer,
  waiting_key integer,
  green_pending integer,
  yellow_pending integer,
  red_pending integer,
  approved integer,
  skipped integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := public.session_auto_lock_after_days();
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('ai_grading.view') then
    raise exception using errcode = '42501', message = 'AI_GRADING_VIEW_PERMISSION_DENIED';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception using errcode = '22023', message = 'AI_GRADING_RANGE_INVALID';
  end if;

  return query
  with sessions as (
    select session_row.*
    from public.class_sessions as session_row
    where session_row.session_date between p_from and p_to
      and session_row.status <> 'cancelled'
      and (
        exists (select 1 from public.session_tests as test where test.class_session_id = session_row.id)
        or exists (
          select 1 from public.grading_submissions as submission
          where submission.class_session_id = session_row.id and submission.match_status = 'matched'
        )
      )
  ),
  counted as (
    select
      submission.class_session_id,
      submission.review_status,
      submission.ai_color,
      submission.ai_answer_key_version,
      exists (
        select 1 from public.grading_runs as run
        where run.submission_id = submission.id and run.run_type = 'grade' and run.status in ('queued', 'running')
      ) as is_grading
    from public.grading_submissions as submission
    where submission.class_session_id in (select id from sessions)
      and submission.match_status = 'matched'
      and submission.counts_for_score
  )
  select
    session_row.id,
    class_row.code,
    class_row.name,
    session_row.session_date,
    session_row.start_time,
    session_row.end_time,
    session_row.status,
    session_row.locked_at,
    case
      when session_row.locked_at is null and session_row.status = 'completed' and v_days > 0 and session_row.completed_at is not null
        then session_row.completed_at + pg_catalog.make_interval(days => v_days)
    end,
    coalesce(test.status, 'none'),
    coalesce(test.answer_key_version, 0),
    (select pg_catalog.count(*)::integer from counted where counted.class_session_id = session_row.id),
    (select pg_catalog.count(*)::integer from counted where counted.class_session_id = session_row.id and counted.is_grading),
    (select pg_catalog.count(*)::integer from counted
      where counted.class_session_id = session_row.id and not counted.is_grading and counted.review_status = 'pending'
        and (test.status is distinct from 'key_confirmed' or counted.ai_answer_key_version is distinct from test.answer_key_version)),
    (select pg_catalog.count(*)::integer from counted
      where counted.class_session_id = session_row.id and not counted.is_grading and counted.review_status = 'pending'
        and counted.ai_color = 'green' and counted.ai_answer_key_version = test.answer_key_version),
    (select pg_catalog.count(*)::integer from counted
      where counted.class_session_id = session_row.id and not counted.is_grading and counted.review_status = 'pending'
        and counted.ai_color = 'yellow' and counted.ai_answer_key_version = test.answer_key_version),
    (select pg_catalog.count(*)::integer from counted
      where counted.class_session_id = session_row.id and not counted.is_grading and counted.review_status = 'pending'
        and counted.ai_color = 'red' and counted.ai_answer_key_version = test.answer_key_version),
    (select pg_catalog.count(*)::integer from counted where counted.class_session_id = session_row.id and counted.review_status = 'approved'),
    (select pg_catalog.count(*)::integer from counted where counted.class_session_id = session_row.id and counted.review_status = 'skipped')
  from sessions as session_row
  join public.classes as class_row on class_row.id = session_row.class_id
  left join public.session_tests as test on test.class_session_id = session_row.id
  order by session_row.session_date desc, session_row.start_time desc, class_row.code;
end;
$$;

-- Số liệu chấm hôm nay cho các ô trên trang (ai_grading.view; chi phí chỉ ở trang Cài đặt).
create or replace function public.get_ai_grading_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day_start timestamptz := public.ai_grading_today()::timestamp at time zone 'Asia/Ho_Chi_Minh';
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('ai_grading.view') then
    raise exception using errcode = '42501', message = 'AI_GRADING_VIEW_PERMISSION_DENIED';
  end if;
  return (
    select pg_catalog.jsonb_build_object(
      'graded', pg_catalog.count(*) filter (where submission.ai_graded_at >= v_day_start),
      'green', pg_catalog.count(*) filter (where submission.ai_graded_at >= v_day_start and submission.ai_color = 'green'),
      'yellow', pg_catalog.count(*) filter (where submission.ai_graded_at >= v_day_start and submission.ai_color = 'yellow'),
      'red', pg_catalog.count(*) filter (where submission.ai_graded_at >= v_day_start and submission.ai_color = 'red'),
      'approved', pg_catalog.count(*) filter (where submission.reviewed_at >= v_day_start and submission.review_status = 'approved')
    )
    from public.grading_submissions as submission
    where submission.ai_graded_at >= v_day_start or submission.reviewed_at >= v_day_start
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Tổng quan cài đặt: thêm chi phí 30 ngày
-- ---------------------------------------------------------------------------

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
    'daily_spend', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('date', day::date, 'cost_usd', coalesce(spend.cost_usd, 0), 'runs', coalesce(spend.runs, 0)) order by day)
      from pg_catalog.generate_series(v_today - 29, v_today, interval '1 day') as day
      left join public.ai_grading_daily_spend as spend on spend.spend_date = day::date
    ), '[]'::jsonb),
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

-- ---------------------------------------------------------------------------
-- 4. Nhắc buổi sắp tự khóa mà còn bài chưa duyệt
-- ---------------------------------------------------------------------------

-- Buổi đã hoàn thành sẽ tự khóa trong 24 giờ tới mà còn bài AI chưa duyệt: báo người hoàn thành buổi
-- (một lần mỗi buổi) và một bản tổng hợp mỗi ngày cho owner. Khóa rồi thì bài chưa duyệt không ghi được.
create or replace function public.run_ai_grading_review_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := public.session_auto_lock_after_days();
  v_count integer;
  v_inserted integer := 0;
  v_sessions integer;
  v_papers integer;
begin
  if v_days <= 0 then
    return 0;
  end if;

  create temporary table if not exists ai_grading_due_sessions (
    class_session_id uuid primary key,
    completed_by uuid,
    class_code text,
    session_date date,
    pending integer
  ) on commit drop;
  delete from ai_grading_due_sessions;

  insert into ai_grading_due_sessions
  select session_row.id, session_row.completed_by, class_row.code, session_row.session_date, pending.total
  from public.class_sessions as session_row
  join public.classes as class_row on class_row.id = session_row.class_id
  cross join lateral (
    select pg_catalog.count(*)::integer as total
    from public.grading_submissions as submission
    where submission.class_session_id = session_row.id
      and submission.match_status = 'matched'
      and submission.counts_for_score
      and submission.review_status = 'pending'
  ) as pending
  where session_row.status = 'completed'
    and session_row.locked_at is null
    and session_row.completed_at is not null
    and session_row.completed_at + pg_catalog.make_interval(days => v_days) <= pg_catalog.now() + interval '24 hours'
    and pending.total > 0;

  insert into public.notifications (recipient_user_id, actor_user_id, event_code, title, message, href, entity_type, entity_id, dedupe_key, metadata)
  select
    due.completed_by, null, 'ai_grading.review_due', 'Còn bài chấm AI chưa duyệt',
    'Buổi ' || due.class_code || ' ngày ' || pg_catalog.to_char(due.session_date, 'DD/MM/YYYY') || ' còn ' || due.pending::text
      || ' bài chưa duyệt và sẽ tự khóa trong 24 giờ. Sau khi khóa không ghi điểm được nữa.',
    '/sessions/' || due.class_session_id::text, 'class_session', due.class_session_id::text,
    'ai_grading.review_due:' || due.class_session_id::text,
    pg_catalog.jsonb_build_object('source', 'ai_grading_review_reminder', 'pending', due.pending)
  from ai_grading_due_sessions as due
  join public.profiles as profile on profile.id = due.completed_by and profile.employment_status = 'active'
  on conflict (recipient_user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  select pg_catalog.count(*)::integer, coalesce(pg_catalog.sum(due.pending), 0)::integer into v_sessions, v_papers from ai_grading_due_sessions as due;
  if v_sessions > 0 then
    v_count := public.raise_ops_alert(
      'ai_grading_review_due',
      v_sessions::text || ' buổi sắp tự khóa còn bài chấm AI chưa duyệt',
      'Có ' || v_papers::text || ' bài chưa duyệt ở ' || v_sessions::text || ' buổi sẽ tự khóa trong 24 giờ. Mở trang Chấm bài AI để duyệt.',
      'ops.ai_grading_review_due:' || public.ai_grading_today()::text,
      '/ai-grading'
    );
    v_inserted := v_inserted + coalesce(v_count, 0);
  end if;
  return v_inserted;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ai-grading-review-reminders';
    perform cron.schedule('ai-grading-review-reminders', '30 * * * *', 'select public.run_ai_grading_review_reminders();');
  else
    raise warning 'AI_GRADING_REVIEW_CRON_UNAVAILABLE: pg_cron chưa bật, không có nhắc duyệt bài trước khi tự khóa.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Quyền gọi hàm
-- ---------------------------------------------------------------------------

revoke all on function public.run_ai_grading_review_reminders() from public, anon, authenticated, service_role;
revoke all on function public.set_grading_comment_phrases(jsonb) from public, anon;
revoke all on function public.list_ai_grading_sessions(date, date) from public, anon;
revoke all on function public.get_ai_grading_today() from public, anon;
grant execute on function public.set_grading_comment_phrases(jsonb) to authenticated;
grant execute on function public.list_ai_grading_sessions(date, date) to authenticated;
grant execute on function public.get_ai_grading_today() to authenticated;
