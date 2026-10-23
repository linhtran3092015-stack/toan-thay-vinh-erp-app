-- Chấm bài AI, phần bổ sung sau tuần chạy thật đầu tiên:
--   1. Câu có hơn 70% bài sai: dấu hiệu đáp án chốt sai (hiện cạnh đáp án, chặn duyệt hàng loạt
--      ở phía ứng dụng, đếm trên trang Chấm bài AI).
--   2. Thống kê theo người duyệt: số bài duyệt, số bài và số câu sửa so với AI (Cài đặt → Chấm bài AI).
--   3. Nộp lại sau khi đã duyệt: cờ trên bài mới, đếm trên trang Chấm bài AI, báo người đã duyệt.

-- ---------------------------------------------------------------------------
-- 1. Câu nhiều bài sai
-- ---------------------------------------------------------------------------

-- Theo đáp án đang chốt của đề: mỗi câu có bao nhiêu bài đã chấm theo bản đáp án này và bao nhiêu bài
-- sai câu đó (bài đã duyệt lấy kết quả trợ giảng chốt, bài khác lấy kết quả AI). Bỏ bài nộp trống
-- (học sinh làm trên giấy). Chỉ trả các câu có ít nhất 5 bài và hơn 70% bài sai, kèm câu trả lời sai
-- hay gặp nhất (nhiều em cùng ghi một số khác đáp án thường là đáp án chốt nhầm).
create or replace function public.session_test_key_warnings(p_test_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with test as (
    select test_row.class_session_id, test_row.answer_key, test_row.answer_key_version
    from public.session_tests as test_row
    where test_row.id = p_test_id and test_row.status = 'key_confirmed'
  ),
  questions as (
    select item.question ->> 'label' as label, item.question ->> 'final_answer' as key_answer, item.ord
    from test
    cross join lateral pg_catalog.jsonb_array_elements(test.answer_key -> 'questions') with ordinality as item(question, ord)
  ),
  papers as (
    select submission.id, submission.review_status, submission.ai_question_results, submission.final_question_verdicts
    from public.grading_submissions as submission
    join test on test.class_session_id = submission.class_session_id
    where submission.match_status = 'matched'
      and submission.counts_for_score
      and not ('empty' = any (submission.ai_flags))
      and (
        (submission.review_status = 'approved'
          and submission.review_answer_key_version = test.answer_key_version
          and pg_catalog.jsonb_typeof(submission.final_question_verdicts) = 'object')
        or (submission.review_status <> 'approved'
          and submission.ai_answer_key_version = test.answer_key_version
          and pg_catalog.jsonb_typeof(submission.ai_question_results) = 'array')
      )
  ),
  verdicts as (
    select
      papers.id,
      questions.label,
      case
        when papers.review_status = 'approved' then papers.final_question_verdicts ->> questions.label
        else ai.result ->> 'verdict'
      end as verdict,
      nullif(pg_catalog.btrim(ai.result ->> 'extracted_final_answer'), '') as answer
    from papers
    cross join questions
    left join lateral (
      select result
      from pg_catalog.jsonb_array_elements(
        case when pg_catalog.jsonb_typeof(papers.ai_question_results) = 'array' then papers.ai_question_results else '[]'::jsonb end
      ) as result
      where result ->> 'label' = questions.label
      limit 1
    ) as ai on true
  ),
  totals as (
    select
      verdicts.label,
      pg_catalog.count(*) filter (where verdicts.verdict in ('correct', 'incorrect', 'missing'))::integer as papers,
      pg_catalog.count(*) filter (where verdicts.verdict = 'incorrect')::integer as wrong
    from verdicts
    group by verdicts.label
  ),
  common_wrong as (
    select distinct on (grouped.label) grouped.label, grouped.answer, grouped.total
    from (
      select
        verdicts.label,
        pg_catalog.min(verdicts.answer) as answer,
        pg_catalog.count(*)::integer as total
      from verdicts
      where verdicts.verdict = 'incorrect' and verdicts.answer is not null
      group by verdicts.label, pg_catalog.lower(pg_catalog.regexp_replace(verdicts.answer, '\s+', '', 'g'))
    ) as grouped
    order by grouped.label, grouped.total desc, grouped.answer
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'label', questions.label,
        'key_answer', questions.key_answer,
        'papers', totals.papers,
        'wrong', totals.wrong,
        'common_answer', case when common_wrong.total >= 2 then common_wrong.answer end,
        'common_answer_count', case when common_wrong.total >= 2 then common_wrong.total end
      )
      order by questions.ord
    ),
    '[]'::jsonb
  )
  from questions
  join totals on totals.label = questions.label
  left join common_wrong on common_wrong.label = questions.label
  where totals.papers >= 5 and totals.wrong * 10 > totals.papers * 7;
$$;

-- Đề của một buổi: thêm key_warnings (các câu ở trên).
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
    'key_warnings', public.session_test_key_warnings(test.id)
  )
  into v_result
  from public.session_tests as test
  where test.class_session_id = p_class_session_id;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Nộp lại sau khi đã duyệt
-- ---------------------------------------------------------------------------

-- Một em nộp lại sau khi bài trước đã duyệt: bài cũ trỏ superseded_by sang bài mới. Điểm trong kết quả
-- buổi giữ nguyên tới khi trợ giảng duyệt bài mới; người đã duyệt bài cũ được báo một lần cho mỗi bài mới.
-- Không ghi tên học sinh vào thông báo (trợ giảng không có quyền xem hồ sơ học sinh).
create or replace function public.grading_submissions_notify_resubmission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.review_status = 'approved'
    and new.reviewed_by is not null
    and new.superseded_by is not null
    and new.superseded_by is distinct from old.superseded_by then
    insert into public.notifications (recipient_user_id, actor_user_id, event_code, title, message, href, entity_type, entity_id, dedupe_key, metadata)
    select
      new.reviewed_by, null, 'ai_grading.resubmitted_after_review', 'Học sinh nộp lại bài đã duyệt',
      'Buổi ' || class_row.code || ' ngày ' || pg_catalog.to_char(session_row.session_date, 'DD/MM/YYYY')
        || ' có một em nộp lại bài sau khi bài trước đã được duyệt. Điểm đang ghi chưa đổi; mở buổi để xem bài mới và duyệt lại nếu cần.',
      '/sessions/' || session_row.id::text, 'class_session', session_row.id::text,
      'ai_grading.resubmitted:' || new.superseded_by::text,
      pg_catalog.jsonb_build_object('source', 'ai_grading_resubmission', 'submission_id', new.superseded_by, 'approved_submission_id', new.id)
    from public.class_sessions as session_row
    join public.classes as class_row on class_row.id = session_row.class_id
    join public.profiles as profile on profile.id = new.reviewed_by and profile.employment_status = 'active'
    where session_row.id = new.class_session_id
      and session_row.locked_at is null
      and session_row.status <> 'cancelled'
    on conflict (recipient_user_id, dedupe_key) do nothing;
  end if;
  return null;
end;
$$;

create trigger grading_submissions_notify_resubmission
after update of superseded_by on public.grading_submissions
for each row execute function public.grading_submissions_notify_resubmission();

-- Bài nộp của buổi: thêm lần nộp đã duyệt trước bài này (nộp lại sau khi duyệt) và kết quả buổi đang
-- lấy từ lần đó hay không.
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
  ai_graded_at timestamptz,
  review_status text,
  praise_bonus boolean,
  final_question_verdicts jsonb,
  paper_score integer,
  final_score integer,
  rank_label text,
  feedback_text text,
  review_answer_key_version integer,
  reviewed_at timestamptz,
  reviewed_by_name text,
  review_note text,
  attendance_status text,
  result_id uuid,
  result_test_score numeric,
  result_comment text,
  result_from_this_submission boolean,
  message_status text,
  prior_approved_attempt_no integer,
  prior_approved_at timestamptz,
  result_from_prior_approval boolean
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
      submission.ai_graded_at,
      submission.review_status,
      submission.praise_bonus,
      submission.final_question_verdicts,
      submission.paper_score::integer,
      submission.final_score::integer,
      submission.rank_label,
      submission.feedback_text,
      submission.review_answer_key_version,
      submission.reviewed_at,
      case when submission.reviewed_by is null then null else public.session_test_actor_name(submission.reviewed_by) end,
      submission.review_note,
      attendance.attendance_status,
      result.id,
      result.test_score,
      result.comment,
      result.ai_submission_id is not distinct from submission.id and result.id is not null,
      (
        select message.status from public.parent_messages as message
        where result.id is not null and message.dedupe_key = 'session.comment:' || result.id::text
        order by message.created_at desc
        limit 1
      ),
      prior.attempt_no,
      prior.reviewed_at,
      prior.id is not null and result.ai_submission_id is not distinct from prior.id
    from public.grading_submissions as submission
    join public.students as student on student.id = submission.student_id
    left join public.session_tests as test on test.class_session_id = submission.class_session_id
    left join public.session_attendance as attendance
      on attendance.class_session_id = submission.class_session_id and attendance.student_id = submission.student_id
    left join public.session_results as result
      on result.class_session_id = submission.class_session_id and result.student_id = submission.student_id
    left join lateral (
      select earlier.id, earlier.attempt_no, earlier.reviewed_at
      from public.grading_submissions as earlier
      where submission.counts_for_score
        and earlier.superseded_by = submission.id
        and earlier.review_status = 'approved'
      order by earlier.reviewed_at desc nulls last, earlier.id desc
      limit 1
    ) as prior on true
    where submission.class_session_id = p_class_session_id
      and submission.match_status = 'matched'
    order by submission.submitted_at desc, submission.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trang "Chấm bài AI": thêm số câu nhiều bài sai và số bài nộp lại sau khi duyệt còn chờ
-- ---------------------------------------------------------------------------

drop function public.list_ai_grading_sessions(date, date);
create function public.list_ai_grading_sessions(p_from date, p_to date)
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
  skipped integer,
  suspect_questions integer,
  resubmitted_pending integer
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
      ) as is_grading,
      exists (
        select 1 from public.grading_submissions as earlier
        where earlier.superseded_by = submission.id and earlier.review_status = 'approved'
      ) as is_resubmission
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
    (select pg_catalog.count(*)::integer from counted where counted.class_session_id = session_row.id and counted.review_status = 'skipped'),
    case when test.status = 'key_confirmed' then pg_catalog.jsonb_array_length(public.session_test_key_warnings(test.id)) else 0 end,
    (select pg_catalog.count(*)::integer from counted
      where counted.class_session_id = session_row.id and counted.review_status = 'pending' and counted.is_resubmission)
  from sessions as session_row
  join public.classes as class_row on class_row.id = session_row.class_id
  left join public.session_tests as test on test.class_session_id = session_row.id
  order by session_row.session_date desc, session_row.start_time desc, class_row.code;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Thống kê theo người duyệt
-- ---------------------------------------------------------------------------

-- Bài đã duyệt trong p_days ngày gần nhất (giờ Việt Nam), theo người duyệt. "Sửa" = trợ giảng đổi
-- đúng/sai của ít nhất một câu so với AI ("thiếu" và "sai" cùng 0 điểm nên không tính là sửa). Bài nộp
-- trống (làm trên giấy, trợ giảng tự tick) và bài AI không chấm được đếm riêng, không vào tỉ lệ sửa.
-- changed_green: bài xanh vẫn phải sửa (bài xanh đáng tin tới đâu).
create or replace function public.get_ai_grading_review_stats(p_days integer default 30)
returns table (
  reviewer_id uuid,
  reviewer_name text,
  approved integer,
  green integer,
  yellow integer,
  red integer,
  blank integer,
  compared integer,
  changed_papers integer,
  changed_green integer,
  changed_questions integer,
  praise_bonus integer,
  last_reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_permission('settings.view') then
    raise exception using errcode = '42501', message = 'SYSTEM_SETTINGS_PERMISSION_DENIED';
  end if;
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception using errcode = '22023', message = 'AI_GRADING_RANGE_INVALID';
  end if;

  v_since := (public.ai_grading_today() - (p_days - 1))::timestamp at time zone 'Asia/Ho_Chi_Minh';

  return query
  with reviewed as (
    select
      submission.reviewed_by,
      submission.reviewed_at,
      submission.ai_color,
      submission.praise_bonus,
      'empty' = any (submission.ai_flags) as is_blank,
      pg_catalog.jsonb_typeof(submission.ai_question_results) = 'array'
        and pg_catalog.jsonb_typeof(submission.final_question_verdicts) = 'object' as has_ai,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.jsonb_array_elements(
          case when pg_catalog.jsonb_typeof(submission.ai_question_results) = 'array' then submission.ai_question_results else '[]'::jsonb end
        ) as question
        where pg_catalog.jsonb_typeof(submission.final_question_verdicts) = 'object'
          and ((submission.final_question_verdicts ->> (question ->> 'label')) = 'correct')
            is distinct from ((question ->> 'verdict') = 'correct')
      ) as changed
    from public.grading_submissions as submission
    where submission.review_status = 'approved'
      and submission.reviewed_by is not null
      and submission.reviewed_at >= v_since
  )
  select
    reviewed.reviewed_by,
    public.session_test_actor_name(reviewed.reviewed_by),
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (where reviewed.ai_color = 'green')::integer,
    pg_catalog.count(*) filter (where reviewed.ai_color = 'yellow')::integer,
    pg_catalog.count(*) filter (where reviewed.ai_color = 'red')::integer,
    pg_catalog.count(*) filter (where reviewed.is_blank)::integer,
    pg_catalog.count(*) filter (where reviewed.has_ai and not reviewed.is_blank)::integer,
    pg_catalog.count(*) filter (where reviewed.has_ai and not reviewed.is_blank and reviewed.changed > 0)::integer,
    pg_catalog.count(*) filter (where reviewed.has_ai and not reviewed.is_blank and reviewed.changed > 0 and reviewed.ai_color = 'green')::integer,
    coalesce(pg_catalog.sum(reviewed.changed) filter (where reviewed.has_ai and not reviewed.is_blank), 0)::integer,
    pg_catalog.count(*) filter (where reviewed.praise_bonus)::integer,
    pg_catalog.max(reviewed.reviewed_at)
  from reviewed
  group by reviewed.reviewed_by
  order by pg_catalog.count(*) desc, 2;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Quyền gọi hàm
-- ---------------------------------------------------------------------------

revoke all on function public.session_test_key_warnings(uuid) from public, anon, authenticated, service_role;
revoke all on function public.grading_submissions_notify_resubmission() from public, anon, authenticated, service_role;
revoke all on function public.get_session_test(uuid) from public, anon;
revoke all on function public.get_session_grading_submissions(uuid) from public, anon;
revoke all on function public.list_ai_grading_sessions(date, date) from public, anon;
revoke all on function public.get_ai_grading_review_stats(integer) from public, anon;
grant execute on function public.get_session_test(uuid) to authenticated;
grant execute on function public.get_session_grading_submissions(uuid) to authenticated;
grant execute on function public.list_ai_grading_sessions(date, date) to authenticated;
grant execute on function public.get_ai_grading_review_stats(integer) to authenticated;
