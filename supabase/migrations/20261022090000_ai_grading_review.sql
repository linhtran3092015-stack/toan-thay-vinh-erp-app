-- Chấm bài AI, Giai đoạn 3b: trợ giảng duyệt bài AI đã chấm, ERP ghi điểm và nhận xét vào kết quả
-- buổi (giữ nguyên điểm vở), tin Zalo có bài làm của học sinh và bài chữa của thầy cô.
--
-- - Quyền mới ai_grading.review (owner, hai quản lý, trợ giảng); duyệt cần thêm results.manage.
-- - Điểm (đã chốt 17/10): mỗi câu đúng trọn điểm hoặc 0; tổng làm tròn số nguyên (.5 lên) rồi mới
--   +1 "tích cực tương tác", tối đa 10; xếp hạng theo điểm cuối (grading_rank_bands).
-- - Người duyệt là người chấm (graded_by) nên nhận công chấm khi khóa buổi, như nhập tay.
-- - Đáp án đổi sau khi duyệt: không tự chấm lại bài đã duyệt; trợ giảng bấm "Chấm lại" nếu cần.
-- - Câu mẫu nhận xét (grading_comment_phrases) khởi tạo từ bản demo; owner sửa ở 3c.

-- ---------------------------------------------------------------------------
-- 1. Quyền
-- ---------------------------------------------------------------------------

insert into public.permissions (code, module, name, description) values
  ('ai_grading.review', 'ai_grading', 'Duyệt bài chấm AI',
   'Sửa kết quả từng câu AI chấm, tick tích cực tương tác (+1), sửa nhận xét và duyệt để ghi điểm vào kết quả buổi; chấm lại hoặc bỏ qua bài. Duyệt cần thêm quyền nhập kết quả buổi.')
on conflict (code) do update set name = excluded.name, description = excluded.description, is_active = true;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
join public.permissions as permission on permission.code = 'ai_grading.review'
where role.code in ('owner', 'operations_manager', 'assistant_manager', 'teaching_assistant')
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Câu mẫu nhận xét
-- ---------------------------------------------------------------------------

create table public.grading_comment_phrases (
  id uuid primary key default gen_random_uuid(),
  slot text not null,
  text text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint grading_comment_phrases_slot_check check (slot in ('y1_correct', 'y2_correct', 'y2_wrong', 'y3_praised', 'y3_quiet', 'y4')),
  constraint grading_comment_phrases_text_check check (pg_catalog.char_length(pg_catalog.btrim(text)) between 1 and 500)
);

create trigger grading_comment_phrases_set_updated_at
before update on public.grading_comment_phrases
for each row execute function public.set_updated_at();

alter table public.grading_comment_phrases enable row level security;
create policy grading_comment_phrases_select on public.grading_comment_phrases
for select to authenticated
using (public.has_permission('ai_grading.view') or public.has_permission('settings.view'));
revoke all on public.grading_comment_phrases from anon;
revoke insert, update, delete on public.grading_comment_phrases from authenticated;
grant select on public.grading_comment_phrases to authenticated;

insert into public.grading_comment_phrases (slot, text, sort_order) values
  ('y1_correct', 'Con làm bài đạt kết quả rất tốt, rất đáng được khen ngợi.', 1),
  ('y2_correct', 'Ba mẹ tiếp tục động viên, đồng hành để con thêm tự tin, mạnh dạn hơn trong học tập.', 1),
  ('y2_correct', 'Mong ba mẹ tiếp tục khích lệ để con giữ vững phong độ và tự tin hơn mỗi buổi học.', 2),
  ('y2_correct', 'Ba mẹ hãy khen ngợi và đồng hành cùng con để con thêm hứng thú, mạnh dạn hơn với môn Toán.', 3),
  ('y2_wrong', 'Nhờ phụ huynh hỗ trợ, nhắc nhở con xem lại video/slide bài giảng và làm lại bài thi đầu ra cho đến khi đúng với đáp án thầy đã chữa.', 1),
  ('y2_wrong', 'Phụ huynh giúp thầy nhắc con xem lại video và slide buổi học, rồi làm lại bài thi đầu ra đến khi khớp với đáp án thầy đã chữa.', 2),
  ('y2_wrong', 'Ba mẹ nhắc con dành thời gian xem lại bài giảng và tự làm lại bài thi đầu ra cho đến khi đúng như phần thầy chữa.', 3),
  ('y3_praised', 'Hôm nay con học tập rất sôi nổi, hăng hái phát biểu và tích cực nhắn tin tương tác với thầy.', 1),
  ('y3_praised', 'Buổi học hôm nay con rất chủ động, hăng hái trả lời và nhắn tin trao đổi bài cùng thầy.', 2),
  ('y3_praised', 'Thầy rất vui vì hôm nay con tham gia bài học sôi nổi, mạnh dạn phát biểu ý kiến.', 3),
  ('y3_quiet', 'Hôm nay con còn hơi trầm, ít tham gia nhắn tin trả lời bài; thầy mong buổi sau con mạnh dạn và tương tác nhiều hơn.', 1),
  ('y3_quiet', 'Buổi này con chưa tham gia trả lời nhiều; thầy khích lệ con mạnh dạn nhắn tin phát biểu ở buổi sau.', 2),
  ('y3_quiet', 'Con còn hơi rụt rè trong giờ học hôm nay; thầy mong con tự tin tương tác với thầy nhiều hơn vào buổi tới.', 3),
  ('y4', 'Cố gắng phát huy kết quả này, thầy tin con sẽ ngày càng tiến bộ.', 1),
  ('y4', 'Thầy luôn theo sát và tin rằng con sẽ tiến bộ hơn nữa trong những buổi tới.', 2),
  ('y4', 'Chúc con giữ vững tinh thần học tập, thầy tin con sẽ ngày càng vững vàng hơn.', 3);

-- ---------------------------------------------------------------------------
-- 3. Cột duyệt
-- ---------------------------------------------------------------------------

alter table public.grading_submissions
  add column review_status text not null default 'pending',
  add column praise_bonus boolean not null default false,
  add column final_question_verdicts jsonb,
  add column paper_score smallint,
  add column final_score smallint,
  add column rank_label text,
  add column feedback_text text,
  add column review_answer_key_version integer,
  add column session_result_id uuid references public.session_results(id) on delete set null,
  add column reviewed_by uuid references public.profiles(id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text,
  add constraint grading_submissions_review_status_check check (review_status in ('pending', 'approved', 'skipped')),
  add constraint grading_submissions_review_scores_check check (
    (paper_score is null or paper_score between 0 and 10) and (final_score is null or final_score between 0 and 10)
  ),
  add constraint grading_submissions_review_note_check check (review_note is null or pg_catalog.char_length(review_note) <= 500),
  add constraint grading_submissions_approved_check check (
    review_status <> 'approved' or (
      reviewed_by is not null and reviewed_at is not null and paper_score is not null and final_score is not null
      and session_result_id is not null and review_answer_key_version is not null
      and pg_catalog.jsonb_typeof(final_question_verdicts) = 'object'
      and feedback_text is not null and pg_catalog.char_length(feedback_text) between 1 and 1200
    )
  );

-- Bài chấm AI đã duyệt ghi vào kết quả buổi nào; tin Zalo đọc bài làm từ đây và ghi "(đã cộng 1)".
alter table public.session_results
  add column ai_submission_id uuid references public.grading_submissions(id) on delete set null,
  add column test_bonus_points smallint not null default 0,
  add constraint session_results_test_bonus_check check (test_bonus_points in (0, 1) and (test_bonus_points = 0 or test_score is not null));

create index session_results_ai_submission_idx on public.session_results (ai_submission_id) where ai_submission_id is not null;

-- Sửa điểm tay (update_session_result) sau khi duyệt AI: điểm mới không còn là "điểm bài + 1", nên bỏ
-- hậu tố "(đã cộng 1)". approve_grading_submission bật app.grading_approval để giữ điểm cộng của nó.
create or replace function public.session_results_reset_bonus_on_manual_score()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.test_score is distinct from old.test_score
    and coalesce(pg_catalog.current_setting('app.grading_approval', true), '') <> 'on' then
    new.test_bonus_points := 0;
  end if;
  return new;
end;
$$;

revoke all on function public.session_results_reset_bonus_on_manual_score() from public, anon, authenticated, service_role;

create trigger session_results_reset_bonus_on_manual_score
before update of test_score on public.session_results
for each row execute function public.session_results_reset_bonus_on_manual_score();

-- ---------------------------------------------------------------------------
-- 4. Điểm
-- ---------------------------------------------------------------------------

-- Làm tròn số nguyên, .5 lên (7,5 → 8; 7,25 → 7). Bản TS: roundHalfUp trong src/features/ai-grading/scoring.ts.
create or replace function public.grading_round_half_up(p_value numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.floor(p_value + 0.5)::integer;
$$;

-- ---------------------------------------------------------------------------
-- 5. Xếp lượt chấm: bỏ qua bài đã duyệt, trừ khi trợ giảng bấm "Chấm lại"
-- ---------------------------------------------------------------------------

drop function public.enqueue_submission_grading(uuid);
create function public.enqueue_submission_grading(p_submission_id uuid, p_force boolean default false)
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

  if not p_force and (
    v_submission.review_status = 'approved'
    or v_submission.ai_answer_key_version is not distinct from v_test.answer_key_version
  ) then
    return null;
  end if;

  update public.grading_runs as run
  set status = 'cancelled', finished_at = pg_catalog.now(), error_code = 'superseded_key'
  where run.submission_id = p_submission_id
    and run.run_type = 'grade'
    and run.status = 'queued'
    and run.answer_key_version <> v_test.answer_key_version;

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

revoke all on function public.enqueue_submission_grading(uuid, boolean) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. RPC duyệt
-- ---------------------------------------------------------------------------

create or replace function public.require_grading_review(p_with_results boolean)
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
  if not public.has_permission('ai_grading.review') then
    raise exception using errcode = '42501', message = 'AI_GRADING_REVIEW_PERMISSION_DENIED';
  end if;
  if p_with_results and not public.has_permission('results.manage') then
    raise exception using errcode = '42501', message = 'RESULTS_MANAGE_PERMISSION_DENIED';
  end if;
  return v_actor;
end;
$$;

-- Khóa bài đang tính điểm của buổi còn sửa được.
create or replace function public.lock_reviewable_submission(p_submission_id uuid)
returns public.grading_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.grading_submissions%rowtype;
  v_session public.class_sessions%rowtype;
begin
  select * into v_submission from public.grading_submissions as submission where submission.id = p_submission_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'GRADING_SUBMISSION_NOT_FOUND';
  end if;
  if v_submission.match_status <> 'matched' or not v_submission.counts_for_score then
    raise exception using errcode = '55000', message = 'GRADING_SUBMISSION_NOT_CURRENT';
  end if;
  select * into v_session from public.class_sessions as session_row where session_row.id = v_submission.class_session_id;
  if v_session.locked_at is not null then
    raise exception using errcode = '55000', message = 'CLASS_SESSION_IS_LOCKED';
  end if;
  if v_session.status = 'cancelled' then
    raise exception using errcode = '55000', message = 'CLASS_SESSION_IS_CANCELLED';
  end if;
  return v_submission;
end;
$$;

-- "Tích cực tương tác" (+1) cho bài chưa duyệt; bài đã duyệt thì đổi trong lúc duyệt lại.
create or replace function public.set_grading_praise_bonus(p_submission_id uuid, p_praise boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_grading_review(false);
  v_submission public.grading_submissions%rowtype;
begin
  v_submission := public.lock_reviewable_submission(p_submission_id);
  if v_submission.review_status = 'approved' then
    raise exception using errcode = '55000', message = 'GRADING_SUBMISSION_ALREADY_APPROVED';
  end if;
  update public.grading_submissions as submission
  set praise_bonus = coalesce(p_praise, false)
  where submission.id = v_submission.id;
end;
$$;

-- Duyệt: tính điểm trong SQL, ghi/cập nhật kết quả buổi (giữ điểm vở), đánh dấu bài đã duyệt.
-- p_verdicts: {nhãn câu: correct|incorrect|missing} cho đủ mọi câu của đáp án đang dùng.
-- p_expected_key_version: phiên bản đáp án trợ giảng đang nhìn; đáp án đổi thì báo để tải lại.
create or replace function public.approve_grading_submission(
  p_submission_id uuid,
  p_verdicts jsonb,
  p_praise_bonus boolean,
  p_feedback_text text,
  p_expected_key_version integer,
  p_reason text default null
)
returns table (session_result_id uuid, paper_score integer, final_score integer, rank_label text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_grading_review(true);
  v_submission public.grading_submissions%rowtype;
  v_test public.session_tests%rowtype;
  v_result public.session_results%rowtype;
  v_feedback text := pg_catalog.btrim(pg_catalog.replace(coalesce(p_feedback_text, ''), E'\r\n', E'\n'));
  v_paper integer;
  v_final integer;
  v_bonus smallint;
  v_rank text;
  v_labels_ok boolean;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  v_submission := public.lock_reviewable_submission(p_submission_id);

  select * into v_test from public.session_tests as test where test.class_session_id = v_submission.class_session_id;
  if not found or v_test.status <> 'key_confirmed' then
    raise exception using errcode = '55000', message = 'GRADING_KEY_NOT_CONFIRMED';
  end if;
  if p_expected_key_version is distinct from v_test.answer_key_version then
    raise exception using errcode = '40001', message = 'GRADING_KEY_VERSION_CHANGED';
  end if;

  v_labels_ok := pg_catalog.jsonb_typeof(p_verdicts) = 'object'
    and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_verdicts))
      = pg_catalog.jsonb_array_length(v_test.answer_key -> 'questions')
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(v_test.answer_key -> 'questions') as question
      where coalesce(p_verdicts ->> (question ->> 'label'), '') not in ('correct', 'incorrect', 'missing')
    );
  if not coalesce(v_labels_ok, false) then
    raise exception using errcode = '22023', message = 'GRADING_VERDICTS_INVALID';
  end if;

  if v_feedback = '' or pg_catalog.char_length(v_feedback) > 1200 then
    raise exception using errcode = '22023', message = 'GRADING_FEEDBACK_INVALID';
  end if;
  if v_reason is not null and pg_catalog.char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'GRADING_REASON_TOO_LONG';
  end if;

  v_paper := public.grading_round_half_up(public.grading_raw_score(v_test.answer_key, p_verdicts));
  v_bonus := case when coalesce(p_praise_bonus, false) and v_paper < 10 then 1 else 0 end;
  v_final := least(10, v_paper + v_bonus);
  v_rank := public.grading_rank_label(v_final);

  perform pg_catalog.set_config('app.workflow_reason', coalesce(v_reason, 'Duyệt chấm AI'), true);
  perform pg_catalog.set_config('app.grading_approval', 'on', true);

  select * into v_result
  from public.session_results as result
  where result.class_session_id = v_submission.class_session_id and result.student_id = v_submission.student_id
  for update;

  -- Kiểm tra buổi đã bắt đầu và em có mặt nằm ở trigger validate_session_result_foundation.
  if found then
    update public.session_results as result
    set test_score = v_final,
        comment = v_feedback,
        test_bonus_points = v_bonus,
        ai_submission_id = v_submission.id,
        graded_at = pg_catalog.now(),
        graded_by = v_actor
    where result.id = v_result.id
    returning result.* into v_result;
  else
    insert into public.session_results (
      class_session_id, student_id, test_score, comment, graded_at, graded_by, created_by, ai_submission_id, test_bonus_points
    ) values (
      v_submission.class_session_id, v_submission.student_id, v_final, v_feedback, pg_catalog.now(), v_actor, v_actor,
      v_submission.id, v_bonus
    )
    returning * into v_result;
  end if;
  -- Later writes in the same transaction are not part of this approval.
  perform pg_catalog.set_config('app.grading_approval', '', true);

  update public.grading_submissions as submission
  set review_status = 'approved',
      praise_bonus = coalesce(p_praise_bonus, false),
      final_question_verdicts = p_verdicts,
      paper_score = v_paper,
      final_score = v_final,
      rank_label = v_rank,
      feedback_text = v_feedback,
      review_answer_key_version = v_test.answer_key_version,
      session_result_id = v_result.id,
      reviewed_by = v_actor,
      reviewed_at = pg_catalog.now(),
      review_note = v_reason
  where submission.id = v_submission.id;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
  values (
    v_actor, 'ai_grading', 'grading_submission_approved', 'grading_submission', v_submission.id::text,
    pg_catalog.jsonb_build_object('review_status', v_submission.review_status, 'ai_raw_score', v_submission.ai_raw_score, 'ai_color', v_submission.ai_color),
    pg_catalog.jsonb_build_object('paper_score', v_paper, 'final_score', v_final, 'praise_bonus', coalesce(p_praise_bonus, false),
      'answer_key_version', v_test.answer_key_version, 'session_result_id', v_result.id,
      'changed_from_ai', v_submission.ai_question_results is not null and exists (
        select 1 from pg_catalog.jsonb_array_elements(v_submission.ai_question_results) as question
        where p_verdicts ->> (question ->> 'label') is distinct from question ->> 'verdict'
      )),
    coalesce(v_reason, 'Duyệt chấm AI')
  );

  return query select v_result.id, v_paper, v_final, v_rank;
end;
$$;

-- "Bỏ qua": trợ giảng chấm tay bài này (không ghi gì vào kết quả buổi).
create or replace function public.skip_grading_submission(p_submission_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_grading_review(false);
  v_submission public.grading_submissions%rowtype;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or pg_catalog.char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'GRADING_SKIP_REASON_REQUIRED';
  end if;
  v_submission := public.lock_reviewable_submission(p_submission_id);
  if v_submission.review_status = 'approved' then
    raise exception using errcode = '55000', message = 'GRADING_SUBMISSION_ALREADY_APPROVED';
  end if;
  update public.grading_submissions as submission
  set review_status = 'skipped', reviewed_by = v_actor, reviewed_at = pg_catalog.now(), review_note = v_reason
  where submission.id = v_submission.id;
  perform public.cancel_submission_grading(v_submission.id, 'skipped_by_reviewer');
  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
  values (v_actor, 'ai_grading', 'grading_submission_skipped', 'grading_submission', v_submission.id::text,
    pg_catalog.jsonb_build_object('review_status', v_submission.review_status), pg_catalog.jsonb_build_object('review_status', 'skipped'), v_reason);
end;
$$;

-- "Chấm lại": xếp lượt AI chấm lại theo đáp án đang dùng (kể cả bài đã duyệt hoặc đã bỏ qua; kết
-- quả buổi đã ghi không đổi cho tới khi duyệt lại). Trả id lượt.
create or replace function public.regrade_grading_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_grading_review(false);
  v_submission public.grading_submissions%rowtype;
  v_id uuid;
begin
  v_submission := public.lock_reviewable_submission(p_submission_id);
  if not exists (
    select 1 from public.session_tests as test
    where test.class_session_id = v_submission.class_session_id and test.status = 'key_confirmed'
  ) then
    raise exception using errcode = '55000', message = 'GRADING_KEY_NOT_CONFIRMED';
  end if;
  if v_submission.review_status = 'skipped' then
    update public.grading_submissions as submission
    set review_status = 'pending', reviewed_by = null, reviewed_at = null, review_note = null
    where submission.id = v_submission.id;
  end if;
  v_id := public.enqueue_submission_grading(v_submission.id, true);
  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data)
  values (v_actor, 'ai_grading', 'grading_submission_regrade_requested', 'grading_submission', v_submission.id::text, null,
    pg_catalog.jsonb_build_object('grading_run_id', v_id));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Tin Zalo: bài làm, bài chữa, "(đã cộng 1)"
-- ---------------------------------------------------------------------------

-- Lời giải cả đề từ đáp án đã chốt: "Câu 13 (đáp án x = 54):" rồi các bước, mỗi câu một khối.
create or replace function public.session_test_solution_text(p_answer_key jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(pg_catalog.string_agg(
    'Câu ' || (question ->> 'label') || ' (đáp án ' || (question ->> 'final_answer') || ')'
      || case
        when pg_catalog.jsonb_array_length(coalesce(question -> 'solution_steps', '[]'::jsonb)) > 0
          then E':\n' || (
            select pg_catalog.string_agg(step, E'\n' order by position)
            from pg_catalog.jsonb_array_elements_text(question -> 'solution_steps') with ordinality as steps(step, position)
          )
        else ''
      end,
    E'\n' order by question_position
  ), '')
  from pg_catalog.jsonb_array_elements(coalesce(p_answer_key -> 'questions', '[]'::jsonb)) with ordinality as questions(question, question_position);
$$;

-- Bài làm dài cắt ở 1.500 ký tự, lời giải ở 2.500, để tin (tối đa 3 phần × 2.000) gửi được.
create or replace function public.message_excerpt(p_text text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_text is null then ''
    when pg_catalog.char_length(pg_catalog.btrim(p_text)) <= p_max then pg_catalog.btrim(p_text)
    else pg_catalog.rtrim(pg_catalog.left(pg_catalog.btrim(p_text), p_max - 1)) || '…'
  end;
$$;

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
      'test_score', public.format_message_score(result.test_score)
        || case when result.test_bonus_points > 0 and result.test_score is not null then ' (đã cộng ' || result.test_bonus_points::text || ')' else '' end,
      'notebook_score', case
        when result.notebook_status = 'not_submitted' then 'Chưa nộp vở'
        else public.format_message_score(result.notebook_score)
      end,
      'rank', coalesce(public.grading_rank_label(result.test_score), ''),
      -- Chỉ bài chấm AI đã duyệt có bài làm và bài chữa; buổi nhập tay để trống (mục tự ẩn).
      'answer_text', case when submission.id is not null then public.message_excerpt(submission.answer_text, 1500) else '' end,
      'solution', case when submission.id is not null and test.status = 'key_confirmed'
        then public.message_excerpt(public.session_test_solution_text(test.answer_key), 2500) else '' end,
      'supervisor_name', coalesce(contact.supervisor_name, ''),
      'grading_contact_phone', coalesce(contact.grading_contact_phone, '')
    )
  from public.session_results as result
  left join public.session_message_contacts as contact on contact.class_session_id = result.class_session_id
  left join public.grading_submissions as submission on submission.id = result.ai_submission_id
  left join public.session_tests as test on test.class_session_id = result.class_session_id
  where result.id = p_result_id;
$$;

revoke all on function public.session_comment_message_vars(uuid) from public, anon, authenticated;

drop trigger session_results_parent_message on public.session_results;
create trigger session_results_parent_message
after insert or update of comment, test_score, notebook_score, notebook_status, ai_submission_id, test_bonus_points on public.session_results
for each row execute function public.parent_message_on_session_result();

-- ---------------------------------------------------------------------------
-- 8. Bài nộp của buổi: thêm kết quả duyệt, điểm danh, kết quả buổi đang có
-- ---------------------------------------------------------------------------

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
  message_status text
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
      )
    from public.grading_submissions as submission
    join public.students as student on student.id = submission.student_id
    left join public.session_tests as test on test.class_session_id = submission.class_session_id
    left join public.session_attendance as attendance
      on attendance.class_session_id = submission.class_session_id and attendance.student_id = submission.student_id
    left join public.session_results as result
      on result.class_session_id = submission.class_session_id and result.student_id = submission.student_id
    where submission.class_session_id = p_class_session_id
      and submission.match_status = 'matched'
    order by submission.submitted_at desc, submission.id;
end;
$$;

-- Câu mẫu đang dùng, theo ô và thứ tự (cho bản nháp nhận xét).
create or replace function public.list_grading_comment_phrases()
returns table (slot text, text text)
language sql
stable
security definer
set search_path = ''
as $$
  select phrase.slot, pg_catalog.btrim(phrase.text)
  from public.grading_comment_phrases as phrase
  where phrase.active and (public.has_permission('ai_grading.view') or public.has_permission('settings.view'))
  order by phrase.slot, phrase.sort_order, phrase.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 9. Quyền gọi hàm
-- ---------------------------------------------------------------------------

revoke all on function public.grading_round_half_up(numeric) from public, anon, authenticated, service_role;
revoke all on function public.require_grading_review(boolean) from public, anon, authenticated, service_role;
revoke all on function public.lock_reviewable_submission(uuid) from public, anon, authenticated, service_role;
revoke all on function public.session_test_solution_text(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.message_excerpt(text, integer) from public, anon, authenticated, service_role;

revoke all on function public.set_grading_praise_bonus(uuid, boolean) from public, anon;
revoke all on function public.approve_grading_submission(uuid, jsonb, boolean, text, integer, text) from public, anon;
revoke all on function public.skip_grading_submission(uuid, text) from public, anon;
revoke all on function public.regrade_grading_submission(uuid) from public, anon;
revoke all on function public.get_session_grading_submissions(uuid) from public, anon;
revoke all on function public.list_grading_comment_phrases() from public, anon;
grant execute on function public.set_grading_praise_bonus(uuid, boolean) to authenticated;
grant execute on function public.approve_grading_submission(uuid, jsonb, boolean, text, integer, text) to authenticated;
grant execute on function public.skip_grading_submission(uuid, text) to authenticated;
grant execute on function public.regrade_grading_submission(uuid) to authenticated;
grant execute on function public.get_session_grading_submissions(uuid) to authenticated;
grant execute on function public.list_grading_comment_phrases() to authenticated;
