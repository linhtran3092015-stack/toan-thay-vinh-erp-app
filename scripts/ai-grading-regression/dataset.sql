-- Regression set (read-only): every AI-graded paper a TA approved on the key version that is still
-- confirmed. No student name, code or phone; answer_text is what the grader already sends to Claude.
select coalesce(json_agg(paper order by paper.session_date, paper.submission_id), '[]'::json)::text as papers
from (
  select
    submission.id as submission_id,
    session_row.session_date,
    class_row.grade,
    test.title as test_title,
    test.answer_key,
    test.answer_key_version as key_version,
    submission.answer_text,
    submission.final_question_verdicts as ta_verdicts,
    submission.paper_score as ta_paper_score,
    submission.ai_color as live_color,
    submission.ai_flags as live_flags,
    case when jsonb_typeof(submission.ai_question_results) = 'array' then (
      select jsonb_object_agg(question ->> 'label', question ->> 'verdict')
      from jsonb_array_elements(submission.ai_question_results) as question
    ) end as live_verdicts
  from public.grading_submissions as submission
  join public.session_tests as test on test.class_session_id = submission.class_session_id
  join public.class_sessions as session_row on session_row.id = submission.class_session_id
  join public.classes as class_row on class_row.id = session_row.class_id
  where submission.review_status = 'approved'
    and jsonb_typeof(submission.final_question_verdicts) = 'object'
    and test.status = 'key_confirmed'
    and submission.review_answer_key_version = test.answer_key_version
) as paper;
