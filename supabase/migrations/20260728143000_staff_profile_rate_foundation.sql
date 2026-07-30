begin;

-- Rate versions are append-only. Payroll will choose the latest version whose
-- effective date is on or before the work date in a later, dedicated workflow.
create table public.staff_rate_versions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  effective_from date not null,
  offline_hourly_rate_vnd bigint not null,
  online_hourly_rate_vnd bigint generated always as (
    offline_hourly_rate_vnd / 2
  ) stored,
  note text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint staff_rate_versions_offline_rate_check
    check (
      offline_hourly_rate_vnd >= 0
      and pg_catalog.mod(offline_hourly_rate_vnd, 2) = 0
    ),
  constraint staff_rate_versions_note_trimmed_check
    check (
      note is null
      or (note = pg_catalog.btrim(note) and note <> '')
    ),
  constraint staff_rate_versions_staff_effective_from_unique
    unique (staff_id, effective_from)
);

create index staff_rate_versions_staff_effective_from_idx
on public.staff_rate_versions (staff_id, effective_from desc);

create or replace function public.prevent_staff_rate_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'STAFF_RATE_VERSION_IMMUTABLE';
end;
$$;

revoke all on function public.prevent_staff_rate_version_mutation()
from public, anon, authenticated;

create trigger staff_rate_versions_prevent_mutation
before update or delete on public.staff_rate_versions
for each row execute function public.prevent_staff_rate_version_mutation();

create or replace function public.audit_staff_rate_version_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    new_data,
    metadata
  )
  values (
    auth.uid(),
    'staff',
    'staff_rate_version_created',
    'staff_rate_version',
    new.id::text,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object('source', 'database')
  );

  return new;
end;
$$;

revoke all on function public.audit_staff_rate_version_insert()
from public, anon, authenticated;

create trigger staff_rate_versions_audit_insert
after insert on public.staff_rate_versions
for each row execute function public.audit_staff_rate_version_insert();

alter table public.staff_rate_versions enable row level security;

create policy staff_rate_versions_select_own_or_managers
on public.staff_rate_versions
for select
to authenticated
using (
  staff_id = (select auth.uid())
  or public.has_permission('staff.manage_rates')
);

revoke all privileges on table public.staff_rate_versions
from public, anon, authenticated;

grant select on table public.staff_rate_versions to authenticated;

insert into public.permissions (code, module, name, description)
values
  ('staff.manage', 'staff', 'Quản lý hồ sơ nhân sự', 'Quyền cập nhật hồ sơ nhân sự qua workflow được phê duyệt.'),
  ('staff.manage_rates', 'staff', 'Quản lý đơn giá nhân sự', 'Quyền xem và thiết lập phiên bản đơn giá nhân sự qua workflow được phê duyệt.')
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

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
  on permission.code in ('staff.manage', 'staff.manage_rates')
where role.code = 'owner'
on conflict (role_id, permission_id) do nothing;

commit;
