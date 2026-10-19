-- Chấm bài AI, Giai đoạn 1 "Nhận bài vào ERP" (docs/AI_GRADING_INTEGRATION_PLAN_2026-10-16.md §4.1–4.3, §4.9).
--
-- Học sinh vẫn nộp bài cuối buổi qua form Apps Script; Apps Script ghi Sheet rồi gửi
-- thêm một bản sang ERP (webhook có chữ ký HMAC). Danh sách tên trên form lấy từ ERP.
-- Quyết định 18/10/2026: bảng chỉ có cột của Giai đoạn 1 (cột chấm/duyệt thêm ở
-- Giai đoạn 3); không có bảng ánh xạ lựa chọn lớp (ánh xạ cố định trong code);
-- câu 6 (học thử tiếng Anh) và câu 7 (SĐT phụ huynh) không gửi sang ERP; trùng họ
-- tên cùng năm sinh thì form hiện 4 số cuối SĐT phụ huynh chính, che trong SQL.
--
-- 1. Quyền ai_grading.view (owner, quản lý vận hành, quản lý trợ lý, trợ giảng).
-- 2. grading_submissions: bài nộp + kết quả ghép học sinh/buổi học + lần nộp.
-- 3. RPC cho webhook và API danh sách (chỉ service_role): danh sách theo năm sinh,
--    ứng viên học sinh, ứng viên buổi học, ghi bài nộp (chống trùng external_id),
--    tính lại lần nộp (lần nộp cuối được tính).
-- 4. RPC đọc cho màn hình (ai_grading.view): bài chưa ghép, bài nộp của một buổi.
-- 5. Cron xoá raw_payload sau 30 ngày.

begin;

-- ---------------------------------------------------------------------------
-- 1. Quyền
-- ---------------------------------------------------------------------------

insert into public.permissions (code, module, name, description) values
  ('ai_grading.view', 'ai_grading', 'Xem bài nộp chấm bài', 'Xem bài học sinh nộp qua form, kết quả ghép học sinh và buổi học.')
on conflict (code) do update set name = excluded.name, description = excluded.description, is_active = true;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles as role
join public.permissions as permission on permission.code = 'ai_grading.view'
where role.code in ('owner', 'operations_manager', 'assistant_manager', 'teaching_assistant')
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Bảng bài nộp
-- ---------------------------------------------------------------------------

create table public.grading_submissions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'apps_script_form',
  external_id text not null,
  submitted_at timestamptz not null,
  received_at timestamptz not null default now(),
  answer_text text not null,
  answer_truncated boolean not null default false,
  claimed_student_code text,
  claimed_full_name text not null,
  claimed_birth_year smallint not null,
  claimed_class_session_id uuid,
  claimed_class_option text,
  claimed_class_option_other text,
  raw_payload jsonb,
  student_id uuid references public.students(id) on delete restrict,
  class_session_id uuid references public.class_sessions(id) on delete restrict,
  match_status text not null,
  student_match_method text,
  session_match_method text,
  match_issues text[] not null default '{}',
  matched_at timestamptz,
  attempt_no integer,
  counts_for_score boolean not null default false,
  superseded_by uuid references public.grading_submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grading_submissions_source_check check (source in ('apps_script_form')),
  constraint grading_submissions_external_id_check check (external_id ~ '^[A-Za-z0-9_-]{8,100}$'),
  constraint grading_submissions_source_external_id_key unique (source, external_id),
  constraint grading_submissions_answer_length_check check (pg_catalog.char_length(answer_text) <= 20000),
  constraint grading_submissions_claimed_code_check
    check (claimed_student_code is null or pg_catalog.char_length(claimed_student_code) between 1 and 40),
  constraint grading_submissions_claimed_name_check
    check (pg_catalog.char_length(pg_catalog.btrim(claimed_full_name)) between 1 and 200),
  constraint grading_submissions_claimed_birth_year_check check (claimed_birth_year between 1990 and 2100),
  constraint grading_submissions_claimed_option_check
    check (claimed_class_option is null or pg_catalog.char_length(claimed_class_option) <= 200),
  constraint grading_submissions_claimed_option_other_check
    check (claimed_class_option_other is null or pg_catalog.char_length(claimed_class_option_other) <= 500),
  constraint grading_submissions_match_status_check check (match_status in ('matched', 'needs_review', 'ignored')),
  constraint grading_submissions_student_method_check
    check (student_match_method is null or student_match_method in ('student_code', 'name_birth_year', 'manual')),
  constraint grading_submissions_session_method_check
    check (session_match_method is null or session_match_method in ('claimed_session', 'time_window', 'attendance', 'class_option', 'manual')),
  constraint grading_submissions_session_needs_student_check check (class_session_id is null or student_id is not null),
  constraint grading_submissions_matched_check check (
    match_status <> 'matched'
    or (
      student_id is not null and class_session_id is not null
      and student_match_method is not null and session_match_method is not null and matched_at is not null
    )
  ),
  constraint grading_submissions_counts_check check (not counts_for_score or match_status = 'matched'),
  constraint grading_submissions_attempt_check check (attempt_no is null or attempt_no >= 1),
  constraint grading_submissions_superseded_check check (superseded_by is null or superseded_by <> id)
);

create index grading_submissions_needs_review_idx on public.grading_submissions (submitted_at desc)
  where match_status = 'needs_review';
create index grading_submissions_session_student_idx on public.grading_submissions (class_session_id, student_id)
  where class_session_id is not null;
create index grading_submissions_student_idx on public.grading_submissions (student_id) where student_id is not null;
create index grading_submissions_superseded_by_idx on public.grading_submissions (superseded_by) where superseded_by is not null;

create trigger grading_submissions_set_updated_at
before update on public.grading_submissions
for each row execute function public.set_updated_at();

alter table public.grading_submissions enable row level security;

create policy grading_submissions_select on public.grading_submissions
for select to authenticated
using (public.has_permission('ai_grading.view'));

revoke all privileges on public.grading_submissions from public, anon, authenticated;
grant select on public.grading_submissions to authenticated;

comment on table public.grading_submissions is
  'Bài kiểm tra cuối buổi học sinh nộp qua form Apps Script (Giai đoạn 1 chấm bài AI). Chỉ ghi qua record_grading_submission (service_role). raw_payload tự xoá sau 30 ngày.';

-- ---------------------------------------------------------------------------
-- 3. RPC cho webhook và API danh sách (chỉ service_role)
-- ---------------------------------------------------------------------------

-- Năm sinh có học sinh đang có ghi danh hiệu lực vào ngày p_on (ô năm sinh trên form).
create or replace function public.get_grading_form_birth_years(p_on date)
returns table (birth_year smallint, student_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select student.birth_year, pg_catalog.count(distinct student.id)::integer
  from public.students as student
  join public.student_enrollments as enrollment
    on enrollment.student_id = student.id
   and enrollment.status = 'active'
   and enrollment.effective_from <= p_on
   and (enrollment.effective_to is null or enrollment.effective_to >= p_on)
  group by student.birth_year
  order by student.birth_year desc;
$$;

-- Danh sách tên trên form: học sinh có ghi danh hiệu lực, một năm sinh. Chỉ trả 4 số
-- cuối SĐT phụ huynh chính (che ngay trong SQL, số đầy đủ không rời database) và các
-- buổi học hôm nay của em (theo danh sách lớp, kể cả lớp ghép, hoặc theo điểm danh).
create or replace function public.get_grading_form_roster(p_birth_year smallint, p_on date)
returns table (
  student_id uuid,
  public_code text,
  full_name text,
  nickname text,
  guardian_phone_last4 text,
  sessions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with roster_students as (
    select distinct student.id, student.public_code, student.full_name, student.nickname
    from public.students as student
    join public.student_enrollments as enrollment
      on enrollment.student_id = student.id
     and enrollment.status = 'active'
     and enrollment.effective_from <= p_on
     and (enrollment.effective_to is null or enrollment.effective_to >= p_on)
    where student.birth_year = p_birth_year
  ),
  day_sessions as (
    select session_row.id
    from public.class_sessions as session_row
    where session_row.session_date = p_on
      and session_row.status <> 'cancelled'
  ),
  day_members as (
    select roster.class_session_id, roster.student_id
    from public.resolve_class_session_rosters(array(select day_sessions.id from day_sessions)) as roster
    union
    select attendance.class_session_id, attendance.student_id
    from public.session_attendance as attendance
    join day_sessions on day_sessions.id = attendance.class_session_id
  )
  select
    roster_students.id,
    roster_students.public_code,
    roster_students.full_name,
    roster_students.nickname,
    (
      select pg_catalog.right(guardian.normalized_phone, 4)
      from public.student_guardians as link
      join public.guardians as guardian on guardian.id = link.guardian_id
      where link.student_id = roster_students.id
        and link.is_primary
        and link.ended_at is null
      limit 1
    ),
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', session_row.id,
            'class_code', class_row.code,
            'start_time', session_row.start_time,
            'end_time', session_row.end_time
          )
          order by session_row.start_time, class_row.code
        )
        from day_members
        join public.class_sessions as session_row on session_row.id = day_members.class_session_id
        join public.classes as class_row on class_row.id = session_row.class_id
        where day_members.student_id = roster_students.id
      ),
      '[]'::jsonb
    )
  from roster_students;
$$;

-- Ứng viên học sinh để ghép bài: 'code' = em có đúng mã (mọi trạng thái);
-- 'birth_year' = em có ghi danh hiệu lực vào ngày nộp và đúng năm sinh (ghép theo tên).
-- Chuẩn hoá tên (bỏ dấu) làm ở TypeScript vì database chưa có unaccent.
create or replace function public.get_grading_student_candidates(
  p_student_code text,
  p_birth_year smallint,
  p_on date
)
returns table (
  student_id uuid,
  public_code text,
  full_name text,
  birth_year smallint,
  candidate_source text
)
language sql
stable
security definer
set search_path = ''
as $$
  select student.id, student.public_code, student.full_name, student.birth_year, 'code'
  from public.students as student
  where p_student_code is not null
    and student.public_code = pg_catalog.upper(pg_catalog.btrim(p_student_code))
  union all
  select distinct student.id, student.public_code, student.full_name, student.birth_year, 'birth_year'
  from public.students as student
  join public.student_enrollments as enrollment
    on enrollment.student_id = student.id
   and enrollment.status = 'active'
   and enrollment.effective_from <= p_on
   and (enrollment.effective_to is null or enrollment.effective_to >= p_on)
  where student.birth_year = p_birth_year;
$$;

-- Ứng viên buổi học: buổi chưa hủy trong ngày nộp có em trong danh sách lớp (kể cả
-- lớp ghép) hoặc có điểm danh của em (học thêm).
create or replace function public.get_grading_session_candidates(p_student_id uuid, p_on date)
returns table (
  class_session_id uuid,
  class_code text,
  class_level text,
  session_date date,
  start_time time,
  end_time time,
  session_status text,
  on_roster boolean,
  attendance_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  with day_sessions as (
    select session_row.id, session_row.class_id, session_row.session_date, session_row.start_time,
      session_row.end_time, session_row.status
    from public.class_sessions as session_row
    where session_row.session_date = p_on
      and session_row.status <> 'cancelled'
  ),
  roster as (
    select resolved.class_session_id
    from public.resolve_class_session_rosters(array(select day_sessions.id from day_sessions)) as resolved
    where resolved.student_id = p_student_id
  )
  select
    day_sessions.id,
    class_row.code,
    class_row.level,
    day_sessions.session_date,
    day_sessions.start_time,
    day_sessions.end_time,
    day_sessions.status,
    roster.class_session_id is not null,
    attendance.attendance_status
  from day_sessions
  join public.classes as class_row on class_row.id = day_sessions.class_id
  left join roster on roster.class_session_id = day_sessions.id
  left join public.session_attendance as attendance
    on attendance.class_session_id = day_sessions.id
   and attendance.student_id = p_student_id
  where roster.class_session_id is not null or attendance.id is not null
  order by day_sessions.start_time, class_row.code;
$$;

-- Lần nộp của một học sinh trong một buổi: lần nộp cuối (theo giờ nộp) được tính,
-- các lần trước trỏ superseded_by về lần cuối. Bài gửi bù đến muộn của một lần nộp
-- cũ không thay được lần mới hơn.
create or replace function public.refresh_grading_submission_attempts(p_student_id uuid, p_class_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('grading_submissions:' || p_student_id::text || ':' || p_class_session_id::text, 0)
  );

  with ranked as (
    select
      submission.id,
      pg_catalog.row_number() over (
        order by submission.submitted_at, submission.received_at, submission.id
      )::integer as attempt_no,
      pg_catalog.row_number() over (
        order by submission.submitted_at desc, submission.received_at desc, submission.id desc
      ) as recency
    from public.grading_submissions as submission
    where submission.student_id = p_student_id
      and submission.class_session_id = p_class_session_id
      and submission.match_status = 'matched'
  ),
  latest as (
    select ranked.id from ranked where ranked.recency = 1
  ),
  target as (
    select
      ranked.id,
      ranked.attempt_no,
      ranked.recency = 1 as counts_for_score,
      case when ranked.recency = 1 then null else (select latest.id from latest) end as superseded_by
    from ranked
  )
  update public.grading_submissions as submission
  set attempt_no = target.attempt_no,
      counts_for_score = target.counts_for_score,
      superseded_by = target.superseded_by
  from target
  where submission.id = target.id
    and (
      submission.attempt_no is distinct from target.attempt_no
      or submission.counts_for_score is distinct from target.counts_for_score
      or submission.superseded_by is distinct from target.superseded_by
    );
end;
$$;

-- Ghi một bài nộp đã được webhook ghép. Gửi lại cùng external_id không tạo dòng mới
-- và không đổi dòng cũ (inserted = false).
create or replace function public.record_grading_submission(
  p_external_id text,
  p_submitted_at timestamptz,
  p_answer_text text,
  p_answer_truncated boolean,
  p_claimed_student_code text,
  p_claimed_full_name text,
  p_claimed_birth_year smallint,
  p_claimed_class_session_id uuid,
  p_claimed_class_option text,
  p_claimed_class_option_other text,
  p_raw_payload jsonb,
  p_student_id uuid,
  p_class_session_id uuid,
  p_match_status text,
  p_student_match_method text,
  p_session_match_method text,
  p_match_issues text[],
  p_source text default 'apps_script_form'
)
returns table (
  submission_id uuid,
  inserted boolean,
  match_status text,
  counts_for_score boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id uuid;
begin
  if p_match_status not in ('matched', 'needs_review') then
    raise exception using errcode = '22023', message = 'GRADING_SUBMISSION_MATCH_STATUS_INVALID';
  end if;

  insert into public.grading_submissions (
    source, external_id, submitted_at, answer_text, answer_truncated,
    claimed_student_code, claimed_full_name, claimed_birth_year, claimed_class_session_id,
    claimed_class_option, claimed_class_option_other, raw_payload,
    student_id, class_session_id, match_status, student_match_method, session_match_method,
    match_issues, matched_at
  )
  values (
    p_source, p_external_id, p_submitted_at, p_answer_text, coalesce(p_answer_truncated, false),
    nullif(pg_catalog.btrim(p_claimed_student_code), ''), pg_catalog.btrim(p_claimed_full_name), p_claimed_birth_year,
    p_claimed_class_session_id, nullif(pg_catalog.btrim(p_claimed_class_option), ''),
    nullif(pg_catalog.btrim(p_claimed_class_option_other), ''), p_raw_payload,
    p_student_id, p_class_session_id, p_match_status, p_student_match_method, p_session_match_method,
    coalesce(p_match_issues, '{}'), case when p_match_status = 'matched' then pg_catalog.now() end
  )
  on conflict (source, external_id) do nothing
  returning id into v_id;

  if v_id is null then
    return query
      select existing.id, false, existing.match_status, existing.counts_for_score
      from public.grading_submissions as existing
      where existing.source = p_source and existing.external_id = p_external_id;
    return;
  end if;

  if p_match_status = 'matched' then
    perform public.refresh_grading_submission_attempts(p_student_id, p_class_session_id);
  end if;

  return query
    select created.id, true, created.match_status, created.counts_for_score
    from public.grading_submissions as created
    where created.id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC đọc cho màn hình (ai_grading.view)
-- ---------------------------------------------------------------------------

create or replace function public.list_unmatched_grading_submissions(p_limit integer default 200)
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
  student_public_code text
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
      student.public_code
    from public.grading_submissions as submission
    left join public.students as student on student.id = submission.student_id
    left join public.class_sessions as claimed_session on claimed_session.id = submission.claimed_class_session_id
    left join public.classes as claimed_class on claimed_class.id = claimed_session.class_id
    where submission.match_status = 'needs_review'
    order by submission.submitted_at desc, submission.id
    limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

create or replace function public.get_session_grading_submissions(p_class_session_id uuid)
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
  match_issues text[]
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
      submission.match_issues
    from public.grading_submissions as submission
    join public.students as student on student.id = submission.student_id
    where submission.class_session_id = p_class_session_id
      and submission.match_status = 'matched'
    order by submission.submitted_at desc, submission.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Xoá raw_payload sau 30 ngày
-- ---------------------------------------------------------------------------

create or replace function public.purge_grading_submission_payloads()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.grading_submissions
  set raw_payload = null
  where raw_payload is not null
    and received_at < pg_catalog.now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'grading-submissions-purge-payload';
    perform cron.schedule('grading-submissions-purge-payload', '15 2 * * *', 'select public.purge_grading_submission_payloads();');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quyền gọi hàm
-- ---------------------------------------------------------------------------

revoke all on function public.get_grading_form_birth_years(date) from public, anon, authenticated;
revoke all on function public.get_grading_form_roster(smallint, date) from public, anon, authenticated;
revoke all on function public.get_grading_student_candidates(text, smallint, date) from public, anon, authenticated;
revoke all on function public.get_grading_session_candidates(uuid, date) from public, anon, authenticated;
revoke all on function public.refresh_grading_submission_attempts(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.record_grading_submission(
  text, timestamptz, text, boolean, text, text, smallint, uuid, text, text, jsonb, uuid, uuid, text, text, text, text[], text
) from public, anon, authenticated;
revoke all on function public.purge_grading_submission_payloads() from public, anon, authenticated, service_role;

grant execute on function public.get_grading_form_birth_years(date) to service_role;
grant execute on function public.get_grading_form_roster(smallint, date) to service_role;
grant execute on function public.get_grading_student_candidates(text, smallint, date) to service_role;
grant execute on function public.get_grading_session_candidates(uuid, date) to service_role;
grant execute on function public.record_grading_submission(
  text, timestamptz, text, boolean, text, text, smallint, uuid, text, text, jsonb, uuid, uuid, text, text, text, text[], text
) to service_role;

revoke all on function public.list_unmatched_grading_submissions(integer) from public, anon;
revoke all on function public.get_session_grading_submissions(uuid) from public, anon;
grant execute on function public.list_unmatched_grading_submissions(integer) to authenticated;
grant execute on function public.get_session_grading_submissions(uuid) to authenticated;

commit;
