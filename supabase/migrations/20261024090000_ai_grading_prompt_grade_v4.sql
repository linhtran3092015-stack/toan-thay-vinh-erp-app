-- Prompt chấm bài grade-v4 (24/10/2026): học sinh ghi chung một giá trị cho nhiều ẩn ("a và b=0")
-- được hiểu là mọi ẩn bằng giá trị đó, vẫn để vàng. Các lượt chấm mới ghi đúng phiên bản prompt worker
-- đang dùng (src/features/ai-grading/prompts.ts). Chỉ đổi nhãn prompt_version; cách xếp lượt giữ nguyên.

create or replace function public.enqueue_submission_grading(p_submission_id uuid, p_force boolean default false)
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
  values ('grade', v_test.id, p_submission_id, v_test.answer_key_version, v_settings ->> 'grade_model', 'grade-v4', v_settings ->> 'grade_effort')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enqueue_submission_grading(uuid, boolean) from public, anon, authenticated, service_role;
