begin;

-- =========================================================
-- STUDENT ENROLLMENTS
-- effective_to is the final effective date of the enrollment.
-- =========================================================

create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),

  student_id uuid not null
    references public.students(id) on delete restrict,

  class_id uuid not null
    references public.classes(id) on delete restrict,

  registered_mode text not null,

  transition_kind text not null default 'initial',

  status text not null default 'active',

  effective_from date not null,
  effective_to date,

  supersedes_enrollment_id uuid
    references public.student_enrollments(id) on delete restrict,

  start_reason text,

  started_by uuid
    references public.profiles(id) on delete restrict,

  ended_by uuid
    references public.profiles(id) on delete restrict,

  end_reason text,

  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint student_enrollments_registered_mode_check
    check (registered_mode in ('online', 'offline')),

  constraint student_enrollments_transition_kind_check
    check (
      transition_kind in (
        'initial',
        'transfer',
        'resume'
      )
    ),

  constraint student_enrollments_status_check
    check (
      status in (
        'active',
        'transferred',
        'reserved',
        'completed'
      )
    ),

  constraint student_enrollments_effective_dates_check
    check (
      effective_to is null
      or effective_to >= effective_from
    ),

  constraint student_enrollments_supersedes_self_check
    check (
      supersedes_enrollment_id is null
      or supersedes_enrollment_id <> id
    ),

  constraint student_enrollments_start_reason_check
    check (
      start_reason is null
      or pg_catalog.btrim(start_reason) <> ''
    ),

  constraint student_enrollments_transition_state_check
    check (
      (
        transition_kind = 'initial'
        and supersedes_enrollment_id is null
      )
      or
      (
        transition_kind in ('transfer', 'resume')
        and supersedes_enrollment_id is not null
        and start_reason is not null
        and pg_catalog.btrim(start_reason) <> ''
      )
    ),

  constraint student_enrollments_end_state_check
    check (
      (
        status = 'active'
        and effective_to is null
        and ended_by is null
        and end_reason is null
      )
      or
      (
        status <> 'active'
        and effective_to is not null
        and ended_by is not null
        and end_reason is not null
        and pg_catalog.btrim(end_reason) <> ''
      )
    )
);

create unique index student_enrollments_one_active_per_student_idx
on public.student_enrollments (student_id)
where status = 'active' and effective_to is null;

create unique index student_enrollments_one_successor_idx
on public.student_enrollments (supersedes_enrollment_id)
where supersedes_enrollment_id is not null;

create index student_enrollments_student_history_idx
on public.student_enrollments (
  student_id,
  effective_from desc,
  created_at desc
);

create index student_enrollments_class_active_idx
on public.student_enrollments (
  class_id,
  student_id
)
where status = 'active' and effective_to is null;

create index student_enrollments_status_idx
on public.student_enrollments (
  status,
  effective_from desc
);

create trigger student_enrollments_set_updated_at
before update on public.student_enrollments
for each row execute function public.set_updated_at();


-- =========================================================
-- TRANSITION VALIDATION
-- =========================================================

create or replace function public.validate_student_enrollment_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  previous_enrollment public.student_enrollments%rowtype;
  target_class_status text;
begin
  if tg_op = 'INSERT' and new.status <> 'active' then
    raise exception using
      errcode = '23514',
      message = 'NEW_ENROLLMENT_MUST_BE_ACTIVE';
  end if;

  select class_record.status
  into target_class_status
  from public.classes as class_record
  where class_record.id = new.class_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'ENROLLMENT_CLASS_NOT_FOUND';
  end if;

  if target_class_status <> 'active' then
    raise exception using
      errcode = '23514',
      message = 'ENROLLMENT_CLASS_MUST_BE_ACTIVE';
  end if;

  if new.transition_kind = 'initial' then
    if new.supersedes_enrollment_id is not null then
      raise exception using
        errcode = '23514',
        message = 'INITIAL_ENROLLMENT_CANNOT_HAVE_PREDECESSOR';
    end if;

    if exists (
      select 1
      from public.student_enrollments as enrollment
      where enrollment.student_id = new.student_id
        and enrollment.id <> new.id
    ) then
      raise exception using
        errcode = '23514',
        message = 'INITIAL_ENROLLMENT_REQUIRES_NO_HISTORY';
    end if;

    return new;
  end if;

  if new.supersedes_enrollment_id is null then
    raise exception using
      errcode = '23514',
      message = 'ENROLLMENT_PREDECESSOR_REQUIRED';
  end if;

  select *
  into previous_enrollment
  from public.student_enrollments
  where id = new.supersedes_enrollment_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'ENROLLMENT_PREDECESSOR_NOT_FOUND';
  end if;

  if previous_enrollment.student_id is distinct from new.student_id then
    raise exception using
      errcode = '23514',
      message = 'ENROLLMENT_PREDECESSOR_STUDENT_MISMATCH';
  end if;

  if previous_enrollment.status = 'active'
    or previous_enrollment.effective_to is null
  then
    raise exception using
      errcode = '23514',
      message = 'ENROLLMENT_PREDECESSOR_MUST_BE_ENDED';
  end if;

  if new.effective_from <= previous_enrollment.effective_to then
    raise exception using
      errcode = '23514',
      message = 'ENROLLMENT_SUCCESSOR_DATE_INVALID';
  end if;

  if new.transition_kind = 'transfer' then
    if previous_enrollment.status <> 'transferred' then
      raise exception using
        errcode = '23514',
        message = 'TRANSFER_PREDECESSOR_STATUS_INVALID';
    end if;

    if previous_enrollment.class_id = new.class_id then
      raise exception using
        errcode = '23514',
        message = 'TRANSFER_TARGET_CLASS_MUST_DIFFER';
    end if;
  end if;

  if new.transition_kind = 'resume'
    and previous_enrollment.status <> 'reserved'
  then
    raise exception using
      errcode = '23514',
      message = 'RESUME_PREDECESSOR_STATUS_INVALID';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_student_enrollment_transition()
from public, anon, authenticated;

create trigger student_enrollments_validate_transition
before insert or update of
  student_id,
  class_id,
  transition_kind,
  effective_from,
  supersedes_enrollment_id
on public.student_enrollments
for each row execute function public.validate_student_enrollment_transition();


-- =========================================================
-- HISTORY PROTECTION
-- =========================================================

create or replace function public.protect_student_enrollment_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'active' then
    raise exception using
      errcode = '23514',
      message = 'ENDED_STUDENT_ENROLLMENT_IS_IMMUTABLE';
  end if;

  if new.id is distinct from old.id
    or new.student_id is distinct from old.student_id
    or new.class_id is distinct from old.class_id
    or new.registered_mode is distinct from old.registered_mode
    or new.transition_kind is distinct from old.transition_kind
    or new.effective_from is distinct from old.effective_from
    or new.supersedes_enrollment_id
      is distinct from old.supersedes_enrollment_id
    or new.start_reason is distinct from old.start_reason
    or new.started_by is distinct from old.started_by
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'STUDENT_ENROLLMENT_HISTORY_IS_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_student_enrollment_history()
from public, anon, authenticated;

create trigger student_enrollments_protect_history
before update on public.student_enrollments
for each row execute function public.protect_student_enrollment_history();


create or replace function public.prevent_student_enrollment_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'STUDENT_ENROLLMENT_HARD_DELETE_FORBIDDEN';
end;
$$;

revoke all on function public.prevent_student_enrollment_delete()
from public, anon, authenticated;

create trigger student_enrollments_prevent_delete
before delete on public.student_enrollments
for each row execute function public.prevent_student_enrollment_delete();


-- A class identity becomes historical once schedules or enrollments use it.
create or replace function public.protect_class_identity_after_schedule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    exists (
      select 1
      from public.class_schedule_templates
      where class_id = old.id
    )
    or exists (
      select 1
      from public.student_enrollments
      where class_id = old.id
    )
  )
  and (
    new.academic_year_id is distinct from old.academic_year_id
    or new.code is distinct from old.code
    or new.grade is distinct from old.grade
    or new.level is distinct from old.level
  )
  then
    raise exception using
      errcode = '23514',
      message = 'CLASS_IDENTITY_IMMUTABLE_AFTER_USE';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_class_identity_after_schedule()
from public, anon, authenticated;


-- =========================================================
-- AUDIT
-- =========================================================

create or replace function public.audit_student_enrollment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  audit_action text;
begin
  if tg_op = 'INSERT' then
    audit_action := 'student_enrollment_started';

    insert into public.audit_logs (
      actor_user_id,
      module,
      action,
      entity_type,
      entity_id,
      old_data,
      new_data,
      reason,
      metadata
    )
    values (
      actor_id,
      'students',
      audit_action,
      'student_enrollment',
      new.id::text,
      null,
      pg_catalog.to_jsonb(new),
      new.start_reason,
      pg_catalog.jsonb_build_object(
        'source',
        case
          when actor_id is null then 'database'
          else 'authenticated_user'
        end
      )
    );

    return new;
  end if;

  audit_action := case new.status
    when 'transferred' then 'student_enrollment_transferred'
    when 'reserved' then 'student_enrollment_reserved'
    when 'completed' then 'student_enrollment_completed'
    else 'student_enrollment_updated'
  end;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    metadata
  )
  values (
    actor_id,
    'students',
    audit_action,
    'student_enrollment',
    new.id::text,
    pg_catalog.to_jsonb(old),
    pg_catalog.to_jsonb(new),
    new.end_reason,
    pg_catalog.jsonb_build_object(
      'source',
      case
        when actor_id is null then 'database'
        else 'authenticated_user'
      end
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_student_enrollment_change()
from public, anon, authenticated;

create trigger student_enrollments_audit_changes
after insert or update on public.student_enrollments
for each row execute function public.audit_student_enrollment_change();


-- =========================================================
-- PERMISSIONS
-- =========================================================

insert into public.permissions (
  code,
  module,
  name,
  description
)
values
  (
    'students.transfer_class',
    'students',
    'Chuyển lớp học viên',
    'Kết thúc lớp hiện tại và chuyển học viên sang lớp mới.'
  ),
  (
    'students.reserve',
    'students',
    'Bảo lưu học viên',
    'Bảo lưu và đưa học viên quay lại học qua workflow được duyệt.'
  )
on conflict (code) do update
set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (
  role_id,
  permission_id,
  granted_by
)
select
  role.id,
  permission.id,
  null
from public.roles as role
cross join public.permissions as permission
where role.code = 'owner'
  and permission.code in (
    'students.transfer_class',
    'students.reserve'
  )
on conflict (role_id, permission_id) do nothing;


-- =========================================================
-- RLS AND GRANTS
-- =========================================================

alter table public.student_enrollments enable row level security;

create policy student_enrollments_select_authorized
on public.student_enrollments
for select
to authenticated
using (
  public.has_permission('students.view')
  or public.has_permission('classes.view')
);

revoke all privileges on table public.student_enrollments
from public, anon, authenticated;

grant select on table public.student_enrollments
to authenticated;

commit;
