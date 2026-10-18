-- Chấm bài AI, Giai đoạn 1b: xem lại và khôi phục bài đã "Bỏ qua (bài rác)".
--
-- Bài bỏ qua trước đây biến khỏi mọi màn hình; chỉ audit_logs còn giữ người làm và lý do, nên
-- bỏ qua nhầm thì phải sửa bằng SQL. Migration này thêm:
-- 1. list_ignored_grading_submissions: bài đang bị bỏ qua, kèm người bỏ qua, lúc nào và lý do
--    (lấy từ dòng audit_logs 'grading_submission_ignored' gần nhất của bài).
-- 2. restore_grading_submission: đưa bài đang bị bỏ qua về lại "chờ ghép" (needs_review), ghi
--    chú tuỳ chọn, ghi audit 'grading_submission_restored'. Bài giữ nguyên học sinh đã nhận ra và
--    cảnh báo như trước khi bị bỏ qua; ghép tay hoặc ghép lại tự động như mọi bài chờ ghép.
--
-- Quyền: dùng lại ai_grading.view như các thao tác ghép tay, bỏ qua, ghép lại.

begin;

update public.permissions
set description = 'Xem bài học sinh nộp qua form; ghép tay bài chưa ghép vào học sinh và buổi học, bỏ qua bài rác, khôi phục bài bỏ qua nhầm, ghép lại tự động.'
where code = 'ai_grading.view';

-- ---------------------------------------------------------------------------
-- 1. Danh sách bài đã bỏ qua
-- ---------------------------------------------------------------------------

-- Cùng các cột với list_unmatched_grading_submissions, thêm ignored_at, ignored_by,
-- ignored_by_name, ignore_reason (null khi không có dòng audit, ví dụ bài bỏ qua bằng SQL).
-- Bỏ qua gần nhất trước.
create or replace function public.list_ignored_grading_submissions(p_limit integer default 200)
returns table (
  submission_id uuid,
  submitted_at timestamptz,
  received_at timestamptz,
  answer_text text,
  answer_truncated boolean,
  claimed_student_code text,
  claimed_full_name text,
  claimed_birth_year smallint,
  claimed_class_option text,
  claimed_class_option_other text,
  claimed_session_label text,
  match_issues text[],
  student_id uuid,
  student_full_name text,
  student_public_code text,
  claimed_class_session_id uuid,
  ignored_at timestamptz,
  ignored_by uuid,
  ignored_by_name text,
  ignore_reason text
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
      submission.submitted_at,
      submission.received_at,
      submission.answer_text,
      submission.answer_truncated,
      submission.claimed_student_code,
      submission.claimed_full_name,
      submission.claimed_birth_year,
      submission.claimed_class_option,
      submission.claimed_class_option_other,
      case when claimed_class.id is null then null
        else claimed_class.code || ' · ' || pg_catalog.to_char(claimed_session.start_time, 'HH24:MI')
      end,
      submission.match_issues,
      submission.student_id,
      student.full_name,
      student.public_code,
      submission.claimed_class_session_id,
      ignored.occurred_at,
      ignored.actor_user_id,
      case when ignored.actor_user_id is null then null
        else coalesce(
          nullif(pg_catalog.btrim(actor.display_name), ''),
          nullif(pg_catalog.split_part(actor.email, '@', 1), ''),
          'Nhân sự trung tâm'
        )
      end,
      ignored.reason
    from public.grading_submissions as submission
    left join public.students as student on student.id = submission.student_id
    left join public.class_sessions as claimed_session on claimed_session.id = submission.claimed_class_session_id
    left join public.classes as claimed_class on claimed_class.id = claimed_session.class_id
    left join lateral (
      select log.occurred_at, log.actor_user_id, log.reason
      from public.audit_logs as log
      where log.entity_type = 'grading_submission'
        and log.entity_id = submission.id::text
        and log.action = 'grading_submission_ignored'
      order by log.occurred_at desc, log.id desc
      limit 1
    ) as ignored on true
    left join public.profiles as actor on actor.id = ignored.actor_user_id
    where submission.match_status = 'ignored'
    order by coalesce(ignored.occurred_at, submission.updated_at) desc, submission.id
    limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Khôi phục bài bỏ qua nhầm
-- ---------------------------------------------------------------------------

create or replace function public.restore_grading_submission(p_submission_id uuid, p_reason text default null)
returns table (submission_id uuid, match_status text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_row public.grading_submissions%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('ai_grading.view') then
    raise exception using errcode = '42501', message = 'AI_GRADING_VIEW_PERMISSION_DENIED';
  end if;

  if v_reason is not null and pg_catalog.char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'REASON_TOO_LONG';
  end if;

  select * into v_row
  from public.grading_submissions as submission
  where submission.id = p_submission_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'GRADING_SUBMISSION_NOT_FOUND';
  end if;

  if v_row.match_status <> 'ignored' then
    raise exception using errcode = '55000', message = 'GRADING_SUBMISSION_NOT_IGNORED';
  end if;

  -- Bỏ qua chỉ đổi trạng thái (và xoá lần nộp); học sinh đã nhận ra và cảnh báo vẫn còn, nên
  -- bài quay lại hàng chờ đúng như trước khi bị bỏ qua.
  update public.grading_submissions as submission
  set match_status = 'needs_review',
      matched_at = null,
      attempt_no = null,
      counts_for_score = false,
      superseded_by = null
  where submission.id = p_submission_id;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
  values (
    v_actor,
    'ai_grading',
    'grading_submission_restored',
    'grading_submission',
    p_submission_id::text,
    pg_catalog.jsonb_build_object('match_status', v_row.match_status),
    pg_catalog.jsonb_build_object(
      'match_status', 'needs_review',
      'student_id', v_row.student_id,
      'match_issues', pg_catalog.to_jsonb(v_row.match_issues)
    ),
    v_reason
  );

  return query select p_submission_id, 'needs_review'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quyền gọi hàm
-- ---------------------------------------------------------------------------

revoke all on function public.list_ignored_grading_submissions(integer) from public, anon;
revoke all on function public.restore_grading_submission(uuid, text) from public, anon;

grant execute on function public.list_ignored_grading_submissions(integer) to authenticated;
grant execute on function public.restore_grading_submission(uuid, text) to authenticated;

commit;
