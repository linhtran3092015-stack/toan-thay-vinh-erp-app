-- Chấm bài AI, Giai đoạn 1b: thao tác trên "Bài nộp chưa ghép".
--
-- Trang /grading-submissions (Giai đoạn 1) chỉ để xem. Migration này thêm:
-- 1. list_grading_match_candidates: học sinh để ghép tay một bài (mặc định các em cùng
--    năm sinh trên form; gõ tìm thì theo tên/mã) kèm các buổi của em trong ngày nộp.
-- 2. match_grading_submission: ghép tay bài vào một học sinh và một buổi của em trong
--    ngày nộp (giờ Việt Nam), rồi tính lại lần nộp (lần nộp cuối được tính).
-- 3. ignore_grading_submission: đánh dấu bài rác (bắt buộc lý do), bài không bao giờ được tính.
-- 4. rematch_grading_submissions: ghi kết quả "Ghép lại tự động". Bộ ghép chạy ở TypeScript
--    (src/features/grading-submissions/matching.ts, chuẩn hoá tên bỏ dấu), hàm này kiểm tra
--    lại từng kết quả trước khi ghi.
-- 5. list_unmatched_grading_submissions trả thêm claimed_class_session_id (bộ ghép cần).
--
-- Quyền: dùng lại ai_grading.view. Bốn vai trò có quyền xem (chủ trung tâm, quản lý vận
-- hành, quản lý trợ lý, trợ giảng) cũng là những người xử lý hàng chờ này, nên một quyền
-- mới sẽ cấp cho đúng chừng ấy người. Mọi thao tác ghi đều có dòng audit_logs.
--
-- Ứng viên ghép tay chỉ gồm học sinh có ghi danh hiệu lực hoặc có buổi (danh sách lớp,
-- lớp ghép, điểm danh) trong ngày nộp, cộng em đúng mã trên form: trợ giảng không có quyền
-- students.view, nên không mở thêm danh sách học sinh ngoài những em form đã hiện.

begin;

update public.permissions
set name = 'Xem và ghép bài nộp chấm bài',
    description = 'Xem bài học sinh nộp qua form; ghép tay bài chưa ghép vào học sinh và buổi học, bỏ qua bài rác, ghép lại tự động.'
where code = 'ai_grading.view';

-- ---------------------------------------------------------------------------
-- 1. Ứng viên ghép tay
-- ---------------------------------------------------------------------------

create or replace function public.list_grading_match_candidates(
  p_submission_id uuid,
  p_query text default null,
  p_limit integer default 300
)
returns table (
  student_id uuid,
  public_code text,
  full_name text,
  nickname text,
  birth_year smallint,
  lifecycle_status text,
  enrolled_on_day boolean,
  sessions jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_submission public.grading_submissions%rowtype;
  v_on date;
  v_code text;
  v_query text := nullif(pg_catalog.btrim(coalesce(p_query, '')), '');
  v_pattern text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 300), 500));
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('ai_grading.view') then
    raise exception using errcode = '42501', message = 'AI_GRADING_VIEW_PERMISSION_DENIED';
  end if;

  if v_query is not null and pg_catalog.char_length(v_query) > 100 then
    raise exception using errcode = '22023', message = 'GRADING_MATCH_QUERY_INVALID';
  end if;

  select * into v_submission
  from public.grading_submissions as submission
  where submission.id = p_submission_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'GRADING_SUBMISSION_NOT_FOUND';
  end if;

  v_on := (v_submission.submitted_at at time zone 'Asia/Ho_Chi_Minh')::date;
  v_code := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(v_submission.claimed_student_code, ''))), '');
  if v_query is not null then
    v_pattern := '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
    with day_sessions as (
      select session_row.id, session_row.class_id, session_row.session_date, session_row.start_time, session_row.end_time
      from public.class_sessions as session_row
      where session_row.session_date = v_on
        and session_row.status <> 'cancelled'
    ),
    roster_pairs as (
      select resolved.class_session_id, resolved.student_id
      from public.resolve_class_session_rosters(array(select day_sessions.id from day_sessions)) as resolved
    ),
    attendance_pairs as (
      select attendance.class_session_id, attendance.student_id, attendance.attendance_status
      from public.session_attendance as attendance
      join day_sessions on day_sessions.id = attendance.class_session_id
    ),
    day_pairs as (
      select roster_pairs.class_session_id, roster_pairs.student_id from roster_pairs
      union
      select attendance_pairs.class_session_id, attendance_pairs.student_id from attendance_pairs
    ),
    day_pool as (
      select enrollment.student_id
      from public.student_enrollments as enrollment
      where enrollment.status = 'active'
        and enrollment.effective_from <= v_on
        and (enrollment.effective_to is null or enrollment.effective_to >= v_on)
      union
      select day_pairs.student_id from day_pairs
    ),
    picked as (
      select
        student.id,
        student.public_code,
        student.full_name,
        student.nickname,
        student.birth_year,
        student.lifecycle_status,
        exists (
          select 1
          from public.student_enrollments as enrollment
          where enrollment.student_id = student.id
            and enrollment.status = 'active'
            and enrollment.effective_from <= v_on
            and (enrollment.effective_to is null or enrollment.effective_to >= v_on)
        ) as enrolled_on_day
      from public.students as student
      where case
        when v_query is null then
          student.id = v_submission.student_id
          or (v_code is not null and student.public_code = v_code)
          or (
            student.birth_year = v_submission.claimed_birth_year
            and student.id in (select day_pool.student_id from day_pool)
          )
        else
          student.public_code = pg_catalog.upper(v_query)
          or (
            student.id in (select day_pool.student_id from day_pool)
            and (
              student.full_name ilike v_pattern
              or student.public_code ilike v_pattern
              or coalesce(student.nickname, '') ilike v_pattern
            )
          )
      end
      order by (student.birth_year = v_submission.claimed_birth_year) desc, student.full_name, student.id
      limit v_limit
    )
    select
      picked.id,
      picked.public_code,
      picked.full_name,
      picked.nickname,
      picked.birth_year,
      picked.lifecycle_status,
      picked.enrolled_on_day,
      coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'class_session_id', day_sessions.id,
              'class_code', class_row.code,
              'class_level', class_row.level,
              'session_date', day_sessions.session_date,
              'start_time', day_sessions.start_time,
              'end_time', day_sessions.end_time,
              'on_roster', exists (
                select 1 from roster_pairs
                where roster_pairs.class_session_id = day_sessions.id and roster_pairs.student_id = picked.id
              ),
              'attendance_status', (
                select attendance_pairs.attendance_status from attendance_pairs
                where attendance_pairs.class_session_id = day_sessions.id and attendance_pairs.student_id = picked.id
                limit 1
              )
            )
            order by day_sessions.start_time, class_row.code
          )
          from day_pairs
          join day_sessions on day_sessions.id = day_pairs.class_session_id
          join public.classes as class_row on class_row.id = day_sessions.class_id
          where day_pairs.student_id = picked.id
        ),
        '[]'::jsonb
      )
    from picked
    order by (picked.birth_year = v_submission.claimed_birth_year) desc, picked.full_name, picked.id;
end;
$$;

-- Buổi hợp lệ để ghép: buổi chưa hủy trong ngày nộp (giờ Việt Nam) có em trong danh sách
-- lớp (kể cả lớp ghép) hoặc có điểm danh của em. Cùng định nghĩa với bộ ghép tự động.
create or replace function public.grading_session_is_eligible(
  p_submission_submitted_at timestamptz,
  p_student_id uuid,
  p_class_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.get_grading_session_candidates(
      p_student_id,
      (p_submission_submitted_at at time zone 'Asia/Ho_Chi_Minh')::date
    ) as candidate
    where candidate.class_session_id = p_class_session_id
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Ghép tay
-- ---------------------------------------------------------------------------

create or replace function public.match_grading_submission(
  p_submission_id uuid,
  p_student_id uuid,
  p_class_session_id uuid,
  p_reason text default null
)
returns table (
  submission_id uuid,
  match_status text,
  attempt_no integer,
  counts_for_score boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_row public.grading_submissions%rowtype;
  v_after public.grading_submissions%rowtype;
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

  if p_student_id is null or p_class_session_id is null then
    raise exception using errcode = '22023', message = 'GRADING_MATCH_TARGET_REQUIRED';
  end if;

  select * into v_row
  from public.grading_submissions as submission
  where submission.id = p_submission_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'GRADING_SUBMISSION_NOT_FOUND';
  end if;

  if v_row.match_status <> 'needs_review' then
    raise exception using errcode = '55000', message = 'GRADING_SUBMISSION_NOT_PENDING';
  end if;

  if not exists (select 1 from public.students as student where student.id = p_student_id) then
    raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND';
  end if;

  if not public.grading_session_is_eligible(v_row.submitted_at, p_student_id, p_class_session_id) then
    raise exception using errcode = '22023', message = 'GRADING_SESSION_NOT_ELIGIBLE';
  end if;

  -- Lý do bài phải xem tay (trùng tên, ngoài giờ...) chuyển sang audit_logs; trên buổi học
  -- bài hiện "ghép tay" thay vì các cảnh báo cũ.
  update public.grading_submissions as submission
  set student_id = p_student_id,
      class_session_id = p_class_session_id,
      match_status = 'matched',
      student_match_method = 'manual',
      session_match_method = 'manual',
      match_issues = '{}',
      matched_at = pg_catalog.now()
  where submission.id = p_submission_id;

  perform public.refresh_grading_submission_attempts(p_student_id, p_class_session_id);

  select * into v_after from public.grading_submissions as submission where submission.id = p_submission_id;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
  values (
    v_actor,
    'ai_grading',
    'grading_submission_matched',
    'grading_submission',
    p_submission_id::text,
    pg_catalog.jsonb_build_object(
      'match_status', v_row.match_status,
      'student_id', v_row.student_id,
      'match_issues', pg_catalog.to_jsonb(v_row.match_issues)
    ),
    pg_catalog.jsonb_build_object(
      'match_status', v_after.match_status,
      'student_id', v_after.student_id,
      'class_session_id', v_after.class_session_id,
      'attempt_no', v_after.attempt_no,
      'counts_for_score', v_after.counts_for_score
    ),
    v_reason
  );

  return query select v_after.id, v_after.match_status, v_after.attempt_no, v_after.counts_for_score;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Bỏ qua (bài rác)
-- ---------------------------------------------------------------------------

create or replace function public.ignore_grading_submission(p_submission_id uuid, p_reason text)
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

  if v_reason is null or pg_catalog.char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'REASON_REQUIRED';
  end if;

  select * into v_row
  from public.grading_submissions as submission
  where submission.id = p_submission_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'GRADING_SUBMISSION_NOT_FOUND';
  end if;

  if v_row.match_status <> 'needs_review' then
    raise exception using errcode = '55000', message = 'GRADING_SUBMISSION_NOT_PENDING';
  end if;

  update public.grading_submissions as submission
  set match_status = 'ignored',
      matched_at = null,
      attempt_no = null,
      counts_for_score = false,
      superseded_by = null
  where submission.id = p_submission_id;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason)
  values (
    v_actor,
    'ai_grading',
    'grading_submission_ignored',
    'grading_submission',
    p_submission_id::text,
    pg_catalog.jsonb_build_object(
      'match_status', v_row.match_status,
      'student_id', v_row.student_id,
      'match_issues', pg_catalog.to_jsonb(v_row.match_issues)
    ),
    pg_catalog.jsonb_build_object('match_status', 'ignored'),
    v_reason
  );

  return query select p_submission_id, 'ignored'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Ghép lại tự động (ghi kết quả bộ ghép TypeScript)
-- ---------------------------------------------------------------------------

-- p_decisions: mảng [{submission_id, student_id, class_session_id, student_match_method,
-- session_match_method, match_issues}], tối đa 500. Mỗi dòng được kiểm tra lại: bài còn chờ
-- xem, phương pháp là phương pháp tự động, mã/năm sinh khớp với form, buổi hợp lệ trong
-- ngày nộp. Dòng sai bị bỏ qua (outcome 'invalid') chứ không làm hỏng cả lượt.
-- outcome: 'matched' (đã ghép), 'updated' (vẫn chờ xem, cập nhật học sinh/cảnh báo),
-- 'unchanged', 'skipped' (bài không còn chờ xem), 'invalid'.
create or replace function public.rematch_grading_submissions(p_decisions jsonb)
returns table (
  submission_id uuid,
  outcome text,
  match_status text,
  counts_for_score boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := auth.uid();
  v_decision record;
  v_row public.grading_submissions%rowtype;
  v_after public.grading_submissions%rowtype;
  v_on date;
  v_issues text[];
  v_valid boolean;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('ai_grading.view') then
    raise exception using errcode = '42501', message = 'AI_GRADING_VIEW_PERMISSION_DENIED';
  end if;

  if p_decisions is null
    or pg_catalog.jsonb_typeof(p_decisions) <> 'array'
    or pg_catalog.jsonb_array_length(p_decisions) > 500 then
    raise exception using errcode = '22023', message = 'GRADING_REMATCH_DECISIONS_INVALID';
  end if;

  for v_decision in
    select *
    from pg_catalog.jsonb_to_recordset(p_decisions) as decision(
      submission_id uuid,
      student_id uuid,
      class_session_id uuid,
      student_match_method text,
      session_match_method text,
      match_issues text[]
    )
  loop
    submission_id := v_decision.submission_id;
    counts_for_score := false;

    select * into v_row
    from public.grading_submissions as submission
    where submission.id = v_decision.submission_id
    for update;

    if not found or v_row.match_status <> 'needs_review' then
      outcome := 'skipped';
      match_status := v_row.match_status;
      counts_for_score := coalesce(v_row.counts_for_score, false);
      return next;
      continue;
    end if;

    v_on := (v_row.submitted_at at time zone 'Asia/Ho_Chi_Minh')::date;
    v_issues := coalesce(v_decision.match_issues, '{}');
    v_valid := pg_catalog.cardinality(v_issues) <= 10
      and not exists (select 1 from pg_catalog.unnest(v_issues) as issue where issue is null or issue !~ '^[a-z_]{1,40}$');

    if v_valid and v_decision.class_session_id is not null and v_decision.student_id is null then
      v_valid := false;
    end if;

    if v_valid and v_decision.student_id is null then
      v_valid := v_decision.student_match_method is null and v_decision.session_match_method is null;
    end if;

    if v_valid and v_decision.student_id is not null then
      v_valid := case v_decision.student_match_method
        when 'student_code' then exists (
          select 1 from public.students as student
          where student.id = v_decision.student_id
            and student.public_code = pg_catalog.upper(pg_catalog.btrim(v_row.claimed_student_code))
        )
        when 'name_birth_year' then exists (
          select 1
          from public.students as student
          join public.student_enrollments as enrollment
            on enrollment.student_id = student.id
           and enrollment.status = 'active'
           and enrollment.effective_from <= v_on
           and (enrollment.effective_to is null or enrollment.effective_to >= v_on)
          where student.id = v_decision.student_id
            and student.birth_year = v_row.claimed_birth_year
        )
        else false
      end;
    end if;

    if v_valid and v_decision.class_session_id is null then
      v_valid := v_decision.session_match_method is null;
    end if;

    if v_valid and v_decision.class_session_id is not null then
      v_valid := v_decision.session_match_method in ('claimed_session', 'time_window', 'attendance', 'class_option')
        and (
          v_decision.session_match_method <> 'claimed_session'
          or v_decision.class_session_id = v_row.claimed_class_session_id
        )
        and public.grading_session_is_eligible(v_row.submitted_at, v_decision.student_id, v_decision.class_session_id);
    end if;

    if not v_valid then
      outcome := 'invalid';
      match_status := v_row.match_status;
      return next;
      continue;
    end if;

    if v_decision.class_session_id is not null then
      update public.grading_submissions as submission
      set student_id = v_decision.student_id,
          class_session_id = v_decision.class_session_id,
          match_status = 'matched',
          student_match_method = v_decision.student_match_method,
          session_match_method = v_decision.session_match_method,
          match_issues = v_issues,
          matched_at = pg_catalog.now()
      where submission.id = v_decision.submission_id;

      perform public.refresh_grading_submission_attempts(v_decision.student_id, v_decision.class_session_id);

      select * into v_after from public.grading_submissions as submission where submission.id = v_decision.submission_id;

      insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, metadata)
      values (
        v_actor,
        'ai_grading',
        'grading_submission_rematched',
        'grading_submission',
        v_decision.submission_id::text,
        pg_catalog.jsonb_build_object(
          'match_status', v_row.match_status,
          'student_id', v_row.student_id,
          'match_issues', pg_catalog.to_jsonb(v_row.match_issues)
        ),
        pg_catalog.jsonb_build_object(
          'match_status', v_after.match_status,
          'student_id', v_after.student_id,
          'class_session_id', v_after.class_session_id,
          'attempt_no', v_after.attempt_no,
          'counts_for_score', v_after.counts_for_score
        ),
        pg_catalog.jsonb_build_object(
          'student_match_method', v_decision.student_match_method,
          'session_match_method', v_decision.session_match_method,
          'match_issues', pg_catalog.to_jsonb(v_issues)
        )
      );

      outcome := 'matched';
      match_status := v_after.match_status;
      counts_for_score := v_after.counts_for_score;
    elsif v_row.student_id is distinct from v_decision.student_id
      or v_row.student_match_method is distinct from v_decision.student_match_method
      or v_row.match_issues is distinct from v_issues then
      update public.grading_submissions as submission
      set student_id = v_decision.student_id,
          student_match_method = v_decision.student_match_method,
          session_match_method = null,
          match_issues = v_issues
      where submission.id = v_decision.submission_id;

      outcome := 'updated';
      match_status := 'needs_review';
    else
      outcome := 'unchanged';
      match_status := 'needs_review';
    end if;

    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Danh sách bài chưa ghép trả thêm claimed_class_session_id
-- ---------------------------------------------------------------------------

drop function public.list_unmatched_grading_submissions(integer);

create function public.list_unmatched_grading_submissions(p_limit integer default 200)
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
  claimed_class_session_id uuid
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
      submission.claimed_class_session_id
    from public.grading_submissions as submission
    left join public.students as student on student.id = submission.student_id
    left join public.class_sessions as claimed_session on claimed_session.id = submission.claimed_class_session_id
    left join public.classes as claimed_class on claimed_class.id = claimed_session.class_id
    where submission.match_status = 'needs_review'
    order by submission.submitted_at desc, submission.id
    limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

-- ---------------------------------------------------------------------------
-- Quyền gọi hàm
-- ---------------------------------------------------------------------------

revoke all on function public.grading_session_is_eligible(timestamptz, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.list_grading_match_candidates(uuid, text, integer) from public, anon;
revoke all on function public.match_grading_submission(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.ignore_grading_submission(uuid, text) from public, anon;
revoke all on function public.rematch_grading_submissions(jsonb) from public, anon;
revoke all on function public.list_unmatched_grading_submissions(integer) from public, anon;

grant execute on function public.list_grading_match_candidates(uuid, text, integer) to authenticated;
grant execute on function public.match_grading_submission(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.ignore_grading_submission(uuid, text) to authenticated;
grant execute on function public.rematch_grading_submissions(jsonb) to authenticated;
grant execute on function public.list_unmatched_grading_submissions(integer) to authenticated;

commit;
