begin;

-- TASK 8I: A locked, graded session result earns exactly one non-monetary
-- grading credit for its grader. Credit-to-money conversion is intentionally
-- out of scope until an approved rate policy exists.

insert into public.permissions (code, module, name, description)
values
  ('grading_credits.view', 'grading_credits', 'Xem tin chi cham bai', 'Nhan su xem tin chi cham bai cua chinh minh.'),
  ('grading_credits.view_all', 'grading_credits', 'Xem toan bo tin chi cham bai', 'Xem tin chi cham bai cua tat ca nhan su de quan ly va doi soat nghiep vu.')
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id, granted_by)
select role.id, permission.id, null
from public.roles as role
join public.permissions as permission
  on (
    permission.code = 'grading_credits.view'
    and role.code in (
      'owner',
      'operations_manager',
      'assistant_manager',
      'teaching_assistant'
    )
  )
  or (
    permission.code = 'grading_credits.view_all'
    and role.code in (
      'owner',
      'operations_manager',
      'assistant_manager'
    )
  )
on conflict (role_id, permission_id) do nothing;

create table public.grading_credits (
  id uuid primary key default gen_random_uuid(),
  session_result_id uuid not null references public.session_results(id) on delete restrict,
  class_session_id uuid not null references public.class_sessions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  grader_id uuid not null references public.profiles(id) on delete restrict,
  credit_units smallint not null default 1,
  credited_at timestamptz not null default pg_catalog.now(),
  credited_by uuid not null references public.profiles(id) on delete restrict,
  constraint grading_credits_result_unique unique (session_result_id),
  constraint grading_credits_session_student_unique unique (class_session_id, student_id),
  constraint grading_credits_unit_check check (credit_units = 1)
);

create index grading_credits_grader_credited_at_idx
  on public.grading_credits (grader_id, credited_at desc);

create index grading_credits_class_session_idx
  on public.grading_credits (class_session_id);

create or replace function public.validate_grading_credit_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_result public.session_results%rowtype;
  source_session public.class_sessions%rowtype;
begin
  select result_row.*
  into source_result
  from public.session_results as result_row
  where result_row.id = new.session_result_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'SESSION_RESULT_NOT_FOUND';
  end if;

  if new.class_session_id is distinct from source_result.class_session_id
    or new.student_id is distinct from source_result.student_id
    or new.grader_id is distinct from source_result.graded_by
  then
    raise exception using errcode = '23514', message = 'GRADING_CREDIT_SOURCE_MISMATCH';
  end if;

  if source_result.graded_at is null or source_result.graded_by is null then
    raise exception using errcode = '23514', message = 'GRADING_CREDIT_REQUIRES_GRADED_RESULT';
  end if;

  select session_row.*
  into source_session
  from public.class_sessions as session_row
  where session_row.id = new.class_session_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'CLASS_SESSION_NOT_FOUND';
  end if;

  if source_session.locked_at is null
    or new.credited_by is distinct from source_session.locked_by
  then
    raise exception using errcode = '23514', message = 'GRADING_CREDIT_REQUIRES_LOCKED_SESSION';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_grading_credit_source() from public, anon, authenticated;

create trigger grading_credits_validate_source
before insert on public.grading_credits
for each row execute function public.validate_grading_credit_source();

create or replace function public.prevent_grading_credit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'GRADING_CREDIT_IMMUTABLE';
end;
$$;

revoke all on function public.prevent_grading_credit_mutation() from public, anon, authenticated;

create trigger grading_credits_prevent_mutation
before update or delete on public.grading_credits
for each row execute function public.prevent_grading_credit_mutation();

create or replace function public.audit_grading_credit_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  workflow_reason text := nullif(
    pg_catalog.btrim(pg_catalog.current_setting('app.workflow_reason', true)),
    ''
  );
begin
  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    new_data,
    reason,
    metadata
  )
  values (
    new.credited_by,
    'grading_credits',
    'grading_credit_created',
    'grading_credit',
    new.id::text,
    pg_catalog.to_jsonb(new),
    workflow_reason,
    pg_catalog.jsonb_build_object(
      'source', 'session_lock',
      'class_session_id', new.class_session_id,
      'session_result_id', new.session_result_id,
      'student_id', new.student_id,
      'grader_id', new.grader_id,
      'credit_units', new.credit_units
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_grading_credit_insert() from public, anon, authenticated;

create trigger grading_credits_audit_insert
after insert on public.grading_credits
for each row execute function public.audit_grading_credit_insert();

alter table public.grading_credits enable row level security;

create policy grading_credits_select_authorized
on public.grading_credits
for select
to authenticated
using (
  public.has_permission('grading_credits.view')
  and (
    grader_id = (select auth.uid())
    or public.has_permission('grading_credits.view_all')
  )
);

revoke all privileges on public.grading_credits from public, anon, authenticated;
grant select on public.grading_credits to authenticated;

create or replace function public.get_grading_credits_dashboard(
  p_limit integer default 200
)
returns table (
  grading_credit_id uuid,
  session_result_id uuid,
  class_session_id uuid,
  class_code text,
  class_name text,
  session_date date,
  student_id uuid,
  student_public_code text,
  student_full_name text,
  grader_id uuid,
  grader_display_name text,
  credit_units smallint,
  credited_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  can_view_all boolean;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('grading_credits.view') then
    raise exception using errcode = '42501', message = 'GRADING_CREDITS_VIEW_PERMISSION_DENIED';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'GRADING_CREDITS_LIMIT_INVALID';
  end if;

  can_view_all := public.has_permission('grading_credits.view_all');

  return query
  select
    credit.id,
    credit.session_result_id,
    credit.class_session_id,
    class_row.code,
    class_row.name,
    session_row.session_date,
    credit.student_id,
    student.public_code,
    student.full_name,
    credit.grader_id,
    coalesce(nullif(pg_catalog.btrim(grader.display_name), ''), grader.email),
    credit.credit_units,
    credit.credited_at
  from public.grading_credits as credit
  join public.class_sessions as session_row
    on session_row.id = credit.class_session_id
  join public.classes as class_row
    on class_row.id = session_row.class_id
  join public.students as student
    on student.id = credit.student_id
  join public.profiles as grader
    on grader.id = credit.grader_id
  where can_view_all or credit.grader_id = actor_id
  order by credit.credited_at desc, credit.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_grading_credits_dashboard(integer) from public, anon;
grant execute on function public.get_grading_credits_dashboard(integer) to authenticated;

comment on function public.get_grading_credits_dashboard(integer)
is 'Returns the caller-owned grading credits, or all credits for users with grading_credits.view_all.';

create or replace function public.lock_class_session(
  p_class_session_id uuid,
  p_reason text
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  target_session public.class_sessions%rowtype;
  locked_session public.class_sessions%rowtype;
  action_at timestamptz := pg_catalog.now();
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('sessions.lock') then
    raise exception using errcode = '42501', message = 'SESSION_LOCK_PERMISSION_DENIED';
  end if;

  if p_class_session_id is null then
    raise exception using errcode = '22023', message = 'CLASS_SESSION_ID_REQUIRED';
  end if;

  if normalized_reason is null then
    raise exception using errcode = '22023', message = 'SESSION_LOCK_REASON_REQUIRED';
  end if;

  select session_row.*
  into target_session
  from public.class_sessions as session_row
  where session_row.id = p_class_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CLASS_SESSION_NOT_FOUND';
  end if;

  if target_session.locked_at is not null then
    raise exception using errcode = '23514', message = 'CLASS_SESSION_ALREADY_LOCKED';
  end if;

  if target_session.status <> 'completed' then
    raise exception using errcode = '23514', message = 'CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK';
  end if;

  perform pg_catalog.set_config('app.workflow_reason', normalized_reason, true);

  update public.class_sessions
  set
    locked_at = action_at,
    locked_by = actor_id,
    lock_reason = normalized_reason
  where id = p_class_session_id
  returning * into locked_session;

  -- The lock and credits are one transaction. Foundation validation ensures
  -- every present/additional-study attendee has a scored, assigned result.
  insert into public.grading_credits (
    session_result_id,
    class_session_id,
    student_id,
    grader_id,
    credit_units,
    credited_at,
    credited_by
  )
  select
    result.id,
    result.class_session_id,
    result.student_id,
    result.graded_by,
    1,
    action_at,
    actor_id
  from public.session_results as result
  where result.class_session_id = p_class_session_id
    and result.graded_at is not null
    and result.graded_by is not null;

  if target_session.session_kind in ('regular', 'makeup') then
    insert into public.student_session_ledger_entries (
      student_id,
      student_enrollment_id,
      class_session_id,
      session_attendance_id,
      entry_type,
      delta_sessions,
      effective_on,
      event_key,
      unit_price_vnd,
      note,
      created_by
    )
    select
      attendance.student_id,
      attendance.student_enrollment_id,
      attendance.class_session_id,
      attendance.id,
      'session_charge',
      -1,
      target_session.session_date,
      'session-charge:' || attendance.id::text,
      null,
      'Tru 1 buoi cho buoi hoc (' || target_session.session_kind || ')',
      actor_id
    from public.session_attendance as attendance
    where attendance.class_session_id = p_class_session_id
      and attendance.attendance_status in ('present', 'excused_absence', 'unexcused_absence');
  end if;

  return locked_session;
end;
$$;

revoke all on function public.lock_class_session(uuid, text) from public, anon, authenticated;
grant execute on function public.lock_class_session(uuid, text) to authenticated;

comment on function public.lock_class_session(uuid, text)
is 'Irreversibly locks a completed class session, creates immutable grading credits, and creates session-charge entries in one transaction.';

commit;
