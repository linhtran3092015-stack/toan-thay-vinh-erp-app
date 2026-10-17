-- Trạng thái vở "Chờ chấm vở" (pending) làm mặc định của kết quả buổi học.
--
-- Quyết định chủ trung tâm 17/10/2026: "Chưa nộp" trước đây vừa là mặc định vừa là
-- trường hợp học sinh không nộp vở, nên tin Zalo nhận xét bị khóa Gửi tới khi hết
-- hạn. Nay tách ra:
--   pending       Chờ chấm vở (mặc định)   khóa Gửi, tin ẩn dòng điểm vở
--   submitted     Đã nộp, có điểm          gửi được, "Điểm vở: 8,5"
--   not_submitted Chưa nộp                 gửi được, "Điểm vở: Chưa nộp vở"
--   not_required  Không yêu cầu vở         gửi được, ẩn dòng điểm vở
--
-- 1. Ràng buộc và mặc định của session_results.notebook_status.
-- 2. record_session_result / update_session_result nhận 'pending' (mặc định mới).
-- 3. Kết quả "Chưa nộp" của buổi chưa khóa chuyển sang "Chờ chấm vở": đa số là giá
--    trị mặc định chưa chấm. Buổi đã khóa giữ nguyên.
-- 4. Tin nhận xét: {notebook_score} là "Chưa nộp vở" khi học sinh không nộp; khóa
--    Gửi chỉ còn khi vở đang chờ chấm.

begin;

-- ---------------------------------------------------------------------------
-- 1. Ràng buộc và mặc định
-- ---------------------------------------------------------------------------

alter table public.session_results drop constraint session_results_notebook_status_check;
alter table public.session_results add constraint session_results_notebook_status_check check (
  notebook_status in ('pending', 'submitted', 'not_submitted', 'not_required')
);

alter table public.session_results drop constraint session_results_notebook_submission_check;
alter table public.session_results add constraint session_results_notebook_submission_check check (
  (notebook_status = 'submitted' and notebook_score is not null)
  or (notebook_status in ('pending', 'not_submitted', 'not_required') and notebook_score is null)
);

alter table public.session_results alter column notebook_status set default 'pending';

-- ---------------------------------------------------------------------------
-- 2. RPC ghi kết quả: như 20260725150000_session_result_lock_workflows.sql, thêm
--    'pending' vào danh sách trạng thái hợp lệ và làm mặc định.
-- ---------------------------------------------------------------------------

create or replace function public.record_session_result(
  p_class_session_id uuid,
  p_student_id uuid,
  p_test_score numeric default null,
  p_notebook_score numeric default null,
  p_notebook_status text default 'pending',
  p_comment text default null
)
returns public.session_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_notebook_status text :=
    pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(
          p_notebook_status,
          ''
        )
      )
    );

  normalized_comment text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_comment, '')
      ),
      ''
    );

  target_session
    public.class_sessions%rowtype;

  target_attendance
    public.session_attendance%rowtype;

  existing_result_id uuid;

  created_result
    public.session_results%rowtype;

  action_at timestamptz :=
    pg_catalog.now();

  result_graded_at timestamptz;
  result_graded_by uuid;
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'results.manage'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'RESULTS_MANAGE_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_SESSION_ID_REQUIRED';
  end if;

  if p_student_id is null then
    raise exception using
      errcode = '22023',
      message = 'STUDENT_ID_REQUIRED';
  end if;

  if normalized_notebook_status not in (
    'submitted',
    'pending',
    'not_submitted',
    'not_required'
  ) then
    raise exception using
      errcode = '22023',
      message = 'NOTEBOOK_STATUS_INVALID';
  end if;

  if p_test_score is not null
    and (
      p_test_score < 0
      or p_test_score > 10
    )
  then
    raise exception using
      errcode = '22023',
      message = 'TEST_SCORE_INVALID';
  end if;

  if p_notebook_score is not null
    and (
      p_notebook_score < 0
      or p_notebook_score > 10
    )
  then
    raise exception using
      errcode = '22023',
      message = 'NOTEBOOK_SCORE_INVALID';
  end if;

  if normalized_notebook_status =
      'submitted'
    and p_notebook_score is null
  then
    raise exception using
      errcode = '22023',
      message =
        'SUBMITTED_NOTEBOOK_REQUIRES_SCORE';
  end if;

  if normalized_notebook_status in (
      'pending',
      'not_submitted',
      'not_required'
    )
    and p_notebook_score is not null
  then
    raise exception using
      errcode = '22023',
      message =
        'NOTEBOOK_SCORE_NOT_ALLOWED';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions
    as session_row
  where session_row.id =
    p_class_session_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_SESSION_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_IS_LOCKED';
  end if;

  if target_session.status not in (
    'in_progress',
    'completed'
  ) then
    raise exception using
      errcode = '23514',
      message =
        'RESULT_REQUIRES_STARTED_SESSION';
  end if;

  select attendance_row.*
  into target_attendance
  from public.session_attendance
    as attendance_row
  where attendance_row.class_session_id =
    p_class_session_id
    and attendance_row.student_id =
      p_student_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'SESSION_ATTENDANCE_NOT_FOUND';
  end if;

  if target_attendance.attendance_status
    not in (
      'present',
      'additional_study'
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'ABSENT_STUDENT_CANNOT_HAVE_SESSION_RESULT';
  end if;

  select result_row.id
  into existing_result_id
  from public.session_results
    as result_row
  where result_row.class_session_id =
    p_class_session_id
    and result_row.student_id =
      p_student_id
  for update;

  if existing_result_id is not null then
    raise exception using
      errcode = '23505',
      message =
        'SESSION_RESULT_ALREADY_EXISTS';
  end if;

  if p_test_score is not null
    or p_notebook_score is not null
  then
    result_graded_at := action_at;
    result_graded_by := actor_id;
  else
    result_graded_at := null;
    result_graded_by := null;
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    '',
    true
  );

  begin
    insert into public.session_results (
      class_session_id,
      student_id,
      test_score,
      notebook_score,
      notebook_status,
      comment,
      graded_at,
      graded_by,
      created_by
    )
    values (
      p_class_session_id,
      p_student_id,
      p_test_score,
      p_notebook_score,
      normalized_notebook_status,
      normalized_comment,
      result_graded_at,
      result_graded_by,
      actor_id
    )
    returning *
    into created_result;

  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message =
          'SESSION_RESULT_ALREADY_EXISTS';
  end;

  return created_result;
end;
$$;

create or replace function public.update_session_result(
  p_session_result_id uuid,
  p_test_score numeric,
  p_notebook_score numeric,
  p_notebook_status text,
  p_comment text,
  p_reason text
)
returns public.session_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();

  normalized_notebook_status text :=
    pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(
          p_notebook_status,
          ''
        )
      )
    );

  normalized_comment text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_comment, '')
      ),
      ''
    );

  normalized_reason text :=
    nullif(
      pg_catalog.btrim(
        coalesce(p_reason, '')
      ),
      ''
    );

  target_result
    public.session_results%rowtype;

  target_session
    public.class_sessions%rowtype;

  target_attendance
    public.session_attendance%rowtype;

  updated_result
    public.session_results%rowtype;

  action_at timestamptz :=
    pg_catalog.now();

  result_graded_at timestamptz;
  result_graded_by uuid;
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission(
    'results.manage'
  ) then
    raise exception using
      errcode = '42501',
      message =
        'RESULTS_MANAGE_PERMISSION_DENIED';
  end if;

  if p_session_result_id is null then
    raise exception using
      errcode = '22023',
      message =
        'SESSION_RESULT_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message =
        'SESSION_RESULT_UPDATE_REASON_REQUIRED';
  end if;

  if normalized_notebook_status not in (
    'submitted',
    'pending',
    'not_submitted',
    'not_required'
  ) then
    raise exception using
      errcode = '22023',
      message = 'NOTEBOOK_STATUS_INVALID';
  end if;

  if p_test_score is not null
    and (
      p_test_score < 0
      or p_test_score > 10
    )
  then
    raise exception using
      errcode = '22023',
      message = 'TEST_SCORE_INVALID';
  end if;

  if p_notebook_score is not null
    and (
      p_notebook_score < 0
      or p_notebook_score > 10
    )
  then
    raise exception using
      errcode = '22023',
      message = 'NOTEBOOK_SCORE_INVALID';
  end if;

  if normalized_notebook_status =
      'submitted'
    and p_notebook_score is null
  then
    raise exception using
      errcode = '22023',
      message =
        'SUBMITTED_NOTEBOOK_REQUIRES_SCORE';
  end if;

  if normalized_notebook_status in (
      'pending',
      'not_submitted',
      'not_required'
    )
    and p_notebook_score is not null
  then
    raise exception using
      errcode = '22023',
      message =
        'NOTEBOOK_SCORE_NOT_ALLOWED';
  end if;

  select result_row.*
  into target_result
  from public.session_results
    as result_row
  where result_row.id =
    p_session_result_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'SESSION_RESULT_NOT_FOUND';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions
    as session_row
  where session_row.id =
    target_result.class_session_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_SESSION_NOT_FOUND';
  end if;

  select result_row.*
  into target_result
  from public.session_results
    as result_row
  where result_row.id =
    p_session_result_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'SESSION_RESULT_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using
      errcode = '23514',
      message = 'CLASS_SESSION_IS_LOCKED';
  end if;

  if target_session.status not in (
    'in_progress',
    'completed'
  ) then
    raise exception using
      errcode = '23514',
      message =
        'RESULT_REQUIRES_STARTED_SESSION';
  end if;

  select attendance_row.*
  into target_attendance
  from public.session_attendance
    as attendance_row
  where attendance_row.class_session_id =
    target_result.class_session_id
    and attendance_row.student_id =
      target_result.student_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'SESSION_ATTENDANCE_NOT_FOUND';
  end if;

  if target_attendance.attendance_status
    not in (
      'present',
      'additional_study'
    )
  then
    raise exception using
      errcode = '23514',
      message =
        'ABSENT_STUDENT_CANNOT_HAVE_SESSION_RESULT';
  end if;

  if target_result.test_score
      is not distinct from p_test_score
    and target_result.notebook_score
      is not distinct from p_notebook_score
    and target_result.notebook_status =
      normalized_notebook_status
    and target_result.comment
      is not distinct from normalized_comment
  then
    raise exception using
      errcode = '22023',
      message =
        'SESSION_RESULT_NO_CHANGES';
  end if;

  if p_test_score is not null
    or p_notebook_score is not null
  then
    result_graded_at := action_at;
    result_graded_by := actor_id;
  else
    result_graded_at := null;
    result_graded_by := null;
  end if;

  perform pg_catalog.set_config(
    'app.workflow_reason',
    normalized_reason,
    true
  );

  update public.session_results
  set
    test_score = p_test_score,
    notebook_score = p_notebook_score,
    notebook_status =
      normalized_notebook_status,
    comment = normalized_comment,
    graded_at = result_graded_at,
    graded_by = result_graded_by
  where id = p_session_result_id
  returning *
  into updated_result;

  return updated_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Tin nhận xét: "Chưa nộp vở" và khóa Gửi chỉ khi vở chờ chấm
-- ---------------------------------------------------------------------------

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
      'notebook_score', case
        when result.notebook_status = 'not_submitted' then 'Chưa nộp vở'
        else public.format_message_score(result.notebook_score)
      end,
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

-- Null khi gửi được. Tin nhận xét chờ tới khi vở được chấm (hoặc đánh dấu chưa nộp /
-- không yêu cầu) và, nếu mẫu dùng ô giám thị, có thông tin trợ giảng giám thị.
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
      when result.notebook_status = 'pending' then 'Chưa chấm vở'
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

-- ---------------------------------------------------------------------------
-- 4. Dữ liệu cũ: "Chưa nộp" của buổi chưa khóa → "Chờ chấm vở"
--    Tắt trigger tin nhắn để không tạo tin mới cho kết quả cũ; nội dung tin không
--    đổi (cả hai trạng thái đều ẩn dòng điểm vở trước bản này). Sau đó dựng lại các
--    tin đang chờ để kết quả "Chưa nộp" còn lại ghi "Chưa nộp vở".
-- ---------------------------------------------------------------------------

alter table public.session_results disable trigger session_results_parent_message;

update public.session_results as result
set notebook_status = 'pending'
from public.class_sessions as session
where session.id = result.class_session_id
  and session.locked_at is null
  and result.notebook_status = 'not_submitted';

alter table public.session_results enable trigger session_results_parent_message;

select public.refresh_queued_session_comment_messages();

commit;
