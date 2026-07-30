begin;

-- Task 8C establishes recurring work-shift assignments only. Time entries,
-- location evidence, auto-end rules, payroll, and schedule mutations remain
-- outside this migration.
create table public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  start_time time not null,
  end_time time not null,
  crosses_midnight boolean not null default false,
  break_minutes smallint not null default 0,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint work_shifts_code_format_check
    check (
      code = pg_catalog.upper(pg_catalog.btrim(code))
      and code ~ '^[A-Z0-9._-]{2,64}$'
    ),
  constraint work_shifts_name_trimmed_check
    check (
      name = pg_catalog.btrim(name)
      and name <> ''
      and pg_catalog.length(name) <= 160
    ),
  constraint work_shifts_break_minutes_check
    check (break_minutes >= 0),
  constraint work_shifts_times_check
    check (
      (crosses_midnight and end_time < start_time)
      or (not crosses_midnight and end_time > start_time)
    ),
  constraint work_shifts_notes_trimmed_check
    check (
      notes is null
      or (notes = pg_catalog.btrim(notes) and notes <> '')
    ),
  constraint work_shifts_code_unique unique (code)
);

create index work_shifts_active_code_idx
on public.work_shifts (is_active, code);

create trigger work_shifts_set_updated_at
before update on public.work_shifts
for each row execute function public.set_updated_at();


-- A schedule is a recurring weekly slot. One active shift per staff member and
-- weekday is deliberately enforced; replacement and ending workflows follow
-- in Task 8D and retain the historical record here.
create table public.staff_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  work_shift_id uuid not null references public.work_shifts(id) on delete restrict,
  weekday smallint not null,
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true,
  supersedes_staff_shift_assignment_id uuid
    references public.staff_shift_assignments(id) on delete restrict,
  ended_by uuid references public.profiles(id) on delete restrict,
  end_reason text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint staff_shift_assignments_weekday_check
    check (weekday between 1 and 7),
  constraint staff_shift_assignments_effective_dates_check
    check (effective_to is null or effective_to >= effective_from),
  constraint staff_shift_assignments_lifecycle_check
    check (
      (
        is_active
        and effective_to is null
        and ended_by is null
        and end_reason is null
      )
      or
      (
        not is_active
        and effective_to is not null
        and ended_by is not null
        and end_reason is not null
        and pg_catalog.btrim(end_reason) <> ''
      )
    ),
  constraint staff_shift_assignments_end_reason_trimmed_check
    check (
      end_reason is null
      or (
        end_reason = pg_catalog.btrim(end_reason)
        and pg_catalog.length(end_reason) <= 2000
      )
    ),
  constraint staff_shift_assignments_supersedes_self_check
    check (
      supersedes_staff_shift_assignment_id is null
      or supersedes_staff_shift_assignment_id <> id
    )
);

create unique index staff_shift_assignments_active_staff_weekday_unique_idx
on public.staff_shift_assignments (staff_id, weekday)
where is_active;

create unique index staff_shift_assignments_supersedes_unique_idx
on public.staff_shift_assignments (supersedes_staff_shift_assignment_id)
where supersedes_staff_shift_assignment_id is not null;

create index staff_shift_assignments_staff_effective_idx
on public.staff_shift_assignments (
  staff_id,
  effective_from desc,
  effective_to desc
);

create index staff_shift_assignments_shift_idx
on public.staff_shift_assignments (work_shift_id, weekday)
where is_active;

create trigger staff_shift_assignments_set_updated_at
before update on public.staff_shift_assignments
for each row execute function public.set_updated_at();


-- =========================================================
-- AUDIT
-- =========================================================

create or replace function public.audit_timekeeping_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  audit_action text;
  audit_entity_type text;
begin
  if tg_table_name = 'work_shifts' then
    actor_id := coalesce(new.created_by, auth.uid());
    audit_entity_type := 'work_shift';
    audit_action := case
      when tg_op = 'INSERT' then 'work_shift_created'
      else 'work_shift_updated'
    end;
  elsif tg_table_name = 'staff_shift_assignments' then
    actor_id := coalesce(new.ended_by, new.created_by, auth.uid());
    audit_entity_type := 'staff_shift_assignment';
    audit_action := case
      when tg_op = 'INSERT' then 'staff_shift_assignment_created'
      when old.is_active and not new.is_active
        then 'staff_shift_assignment_ended'
      else 'staff_shift_assignment_updated'
    end;
  else
    raise exception using
      errcode = 'P0001',
      message = 'UNSUPPORTED_TIMEKEEPING_AUDIT_TABLE';
  end if;

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
    'timekeeping',
    audit_action,
    audit_entity_type,
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    nullif(pg_catalog.current_setting('app.audit_reason', true), ''),
    pg_catalog.jsonb_build_object(
      'source',
      case
        when actor_id is null then 'database'
        else 'timekeeping_schedule_workflow'
      end
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_timekeeping_schedule_change()
from public, anon, authenticated;

create trigger work_shifts_audit_changes
after insert or update on public.work_shifts
for each row execute function public.audit_timekeeping_schedule_change();

create trigger staff_shift_assignments_audit_changes
after insert or update on public.staff_shift_assignments
for each row execute function public.audit_timekeeping_schedule_change();


-- =========================================================
-- READ MODEL
-- =========================================================

-- The function deliberately exposes only schedule-facing profile fields. It
-- avoids widening profile-table access for users who can view timekeeping but
-- do not otherwise have staff-directory permission.
create or replace function public.get_timekeeping_schedule()
returns table (
  assignment_id uuid,
  staff_id uuid,
  staff_display_name text,
  staff_employee_code text,
  staff_employment_status text,
  weekday smallint,
  effective_from date,
  effective_to date,
  work_shift_id uuid,
  work_shift_code text,
  work_shift_name text,
  start_time time,
  end_time time,
  crosses_midnight boolean,
  break_minutes smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.view') then
    raise exception using
      errcode = '42501',
      message = 'TIMEKEEPING_VIEW_PERMISSION_REQUIRED';
  end if;

  return query
  select
    assignment.id,
    profile.id,
    profile.display_name,
    profile.employee_code,
    profile.employment_status,
    assignment.weekday,
    assignment.effective_from,
    assignment.effective_to,
    shift.id,
    shift.code,
    shift.name,
    shift.start_time,
    shift.end_time,
    shift.crosses_midnight,
    shift.break_minutes
  from public.staff_shift_assignments as assignment
  join public.profiles as profile
    on profile.id = assignment.staff_id
  join public.work_shifts as shift
    on shift.id = assignment.work_shift_id
  where assignment.is_active
    and shift.is_active
    and profile.employment_status = 'active'
  order by assignment.weekday, shift.start_time, profile.display_name nulls last;
end;
$$;

revoke all on function public.get_timekeeping_schedule()
from public, anon, authenticated;

grant execute on function public.get_timekeeping_schedule() to authenticated;


-- =========================================================
-- PERMISSIONS
-- =========================================================

insert into public.permissions (code, module, name, description)
values
  (
    'timekeeping.view',
    'timekeeping',
    'Xem chấm công',
    'Xem lịch phân công và dữ liệu chấm công được cấp quyền.'
  ),
  (
    'timekeeping.check',
    'timekeeping',
    'Chấm công',
    'Thực hiện check-in và check-out qua workflow được phê duyệt.'
  ),
  (
    'timekeeping.approve_adjustment',
    'timekeeping',
    'Duyệt điều chỉnh công',
    'Duyệt yêu cầu điều chỉnh công qua workflow được phê duyệt.'
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
join public.permissions as permission
  on permission.code in (
    'timekeeping.view',
    'timekeeping.check',
    'timekeeping.approve_adjustment'
  )
where role.code = 'owner'
on conflict (role_id, permission_id) do nothing;


-- =========================================================
-- RLS AND GRANTS
-- =========================================================

alter table public.work_shifts enable row level security;
alter table public.staff_shift_assignments enable row level security;

create policy work_shifts_select_timekeeping_view
on public.work_shifts
for select
to authenticated
using (public.has_permission('timekeeping.view'));

create policy staff_shift_assignments_select_timekeeping_view
on public.staff_shift_assignments
for select
to authenticated
using (
  staff_id = (select auth.uid())
  or public.has_permission('timekeeping.view')
);

revoke all privileges on table
  public.work_shifts,
  public.staff_shift_assignments
from public, anon, authenticated;

grant select on table
  public.work_shifts,
  public.staff_shift_assignments
to authenticated;

commit;
