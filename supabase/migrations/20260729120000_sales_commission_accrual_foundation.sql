begin;

-- TASK 8J: record revenue that is eligible for sales commission from MMA and
-- Sandbox sources. A commission rate has not been approved, so this ledger
-- deliberately records eligible revenue only and never creates a payroll item.

insert into public.permissions (code, module, name, description)
values
  ('commissions.view', 'commissions', 'Xem doanh thu hoa hồng', 'Sale xem doanh thu đủ điều kiện của chính mình từ nguồn MMA hoặc Sandbox.'),
  ('commissions.manage', 'commissions', 'Quản lý doanh thu hoa hồng', 'Xem toàn bộ doanh thu đủ điều kiện để quản lý và đối soát.'),
  ('commissions.owner_adjust', 'commissions', 'Điều chỉnh hoa hồng', 'Dành riêng cho chủ trung tâm khi chính sách điều chỉnh được phê duyệt.')
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
    permission.code = 'commissions.view'
    and role.code in (
      'owner',
      'operations_manager',
      'assistant_manager',
      'admissions_specialist',
      'admissions_leader',
      'admissions_manager',
      'collaborator'
    )
  )
  or (
    permission.code = 'commissions.manage'
    and role.code in ('owner', 'operations_manager', 'assistant_manager', 'admissions_manager')
  )
  or (
    permission.code = 'commissions.owner_adjust'
    and role.code = 'owner'
  )
on conflict (role_id, permission_id) do nothing;

-- A converted case owns one official student. The unique index makes sales
-- attribution deterministic before we derive an immutable revenue snapshot.
create unique index crm_cases_student_unique_idx
  on public.crm_cases (student_id)
  where student_id is not null;

create table public.sales_commission_accruals (
  id uuid primary key default gen_random_uuid(),
  source_cashflow_record_id uuid not null unique references public.finance_cashflow_records(id) on delete restrict,
  crm_case_id uuid not null references public.crm_cases(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  sale_owner_id uuid not null references public.profiles(id) on delete restrict,
  lead_source_code text not null,
  lead_source_name text not null,
  lead_source_group text not null check (lead_source_group in ('mma', 'sandbox')),
  recognized_revenue_vnd bigint not null check (recognized_revenue_vnd > 0),
  recognized_at timestamptz not null,
  recognized_by uuid references public.profiles(id) on delete restrict,
  status text not null default 'provisional' check (status = 'provisional'),
  created_at timestamptz not null default pg_catalog.now()
);

create index sales_commission_accruals_sale_owner_recognized_idx
  on public.sales_commission_accruals (sale_owner_id, recognized_at desc);

create index sales_commission_accruals_source_group_recognized_idx
  on public.sales_commission_accruals (lead_source_group, recognized_at desc);

create or replace function public.validate_sales_commission_accrual_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_cashflow public.finance_cashflow_records%rowtype;
  source_case public.crm_cases%rowtype;
  source_lead public.crm_lead_sources%rowtype;
begin
  select cashflow.*
  into source_cashflow
  from public.finance_cashflow_records as cashflow
  where cashflow.id = new.source_cashflow_record_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'COMMISSION_CASHFLOW_SOURCE_NOT_FOUND';
  end if;

  if source_cashflow.record_type <> 'receipt'
    or source_cashflow.category <> 'tuition_fee'
    or source_cashflow.student_id is null
    or new.student_id is distinct from source_cashflow.student_id
    or new.recognized_revenue_vnd is distinct from source_cashflow.amount_vnd
    or new.recognized_at is distinct from source_cashflow.created_at
    or new.recognized_by is distinct from source_cashflow.created_by
  then
    raise exception using errcode = '23514', message = 'COMMISSION_CASHFLOW_SOURCE_MISMATCH';
  end if;

  select crm_case.*
  into source_case
  from public.crm_cases as crm_case
  where crm_case.id = new.crm_case_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'COMMISSION_CRM_CASE_NOT_FOUND';
  end if;

  if source_case.status <> 'converted'
    or source_case.student_id is distinct from new.student_id
    or source_case.sale_owner_id is distinct from new.sale_owner_id
    or source_case.lead_source_id is null
  then
    raise exception using errcode = '23514', message = 'COMMISSION_CRM_CASE_SOURCE_MISMATCH';
  end if;

  select lead_source.*
  into source_lead
  from public.crm_lead_sources as lead_source
  where lead_source.id = source_case.lead_source_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'COMMISSION_LEAD_SOURCE_NOT_FOUND';
  end if;

  if source_lead.group_code not in ('mma', 'sandbox')
    or new.lead_source_code is distinct from source_lead.code
    or new.lead_source_name is distinct from source_lead.name
    or new.lead_source_group is distinct from source_lead.group_code
    or new.status <> 'provisional'
  then
    raise exception using errcode = '23514', message = 'COMMISSION_LEAD_SOURCE_MISMATCH';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_sales_commission_accrual_source() from public, anon, authenticated;

create trigger sales_commission_accruals_validate_source
before insert on public.sales_commission_accruals
for each row execute function public.validate_sales_commission_accrual_source();

create or replace function public.prevent_sales_commission_accrual_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'SALES_COMMISSION_ACCRUAL_IMMUTABLE';
end;
$$;

revoke all on function public.prevent_sales_commission_accrual_mutation() from public, anon, authenticated;

create trigger sales_commission_accruals_prevent_mutation
before update or delete on public.sales_commission_accruals
for each row execute function public.prevent_sales_commission_accrual_mutation();

create or replace function public.audit_sales_commission_accrual_insert()
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
    new.recognized_by,
    'commissions',
    'sales_commission_accrual_created',
    'sales_commission_accrual',
    new.id::text,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object(
      'source', 'finance_cashflow_receipt',
      'source_cashflow_record_id', new.source_cashflow_record_id,
      'crm_case_id', new.crm_case_id,
      'student_id', new.student_id,
      'sale_owner_id', new.sale_owner_id,
      'lead_source_group', new.lead_source_group,
      'recognized_revenue_vnd', new.recognized_revenue_vnd
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_sales_commission_accrual_insert() from public, anon, authenticated;

create trigger sales_commission_accruals_audit_insert
after insert on public.sales_commission_accruals
for each row execute function public.audit_sales_commission_accrual_insert();

create or replace function public.create_sales_commission_accrual_from_cashflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.record_type <> 'receipt'
    or new.category <> 'tuition_fee'
    or new.student_id is null
  then
    return new;
  end if;

  insert into public.sales_commission_accruals (
    source_cashflow_record_id,
    crm_case_id,
    student_id,
    sale_owner_id,
    lead_source_code,
    lead_source_name,
    lead_source_group,
    recognized_revenue_vnd,
    recognized_at,
    recognized_by
  )
  select
    new.id,
    crm_case.id,
    new.student_id,
    crm_case.sale_owner_id,
    lead_source.code,
    lead_source.name,
    lead_source.group_code,
    new.amount_vnd,
    new.created_at,
    new.created_by
  from public.crm_cases as crm_case
  join public.crm_lead_sources as lead_source
    on lead_source.id = crm_case.lead_source_id
  where crm_case.student_id = new.student_id
    and crm_case.status = 'converted'
    and crm_case.sale_owner_id is not null
    and lead_source.group_code in ('mma', 'sandbox')
  on conflict (source_cashflow_record_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_sales_commission_accrual_from_cashflow() from public, anon, authenticated;

create trigger finance_cashflow_records_create_sales_commission_accrual
after insert on public.finance_cashflow_records
for each row execute function public.create_sales_commission_accrual_from_cashflow();

-- This covers a receipt recorded before the matching CRM case is converted,
-- without allowing later source or sale-owner edits to rewrite prior history.
create or replace function public.create_sales_commission_accruals_from_crm_conversion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lead_source public.crm_lead_sources%rowtype;
begin
  if new.status <> 'converted'
    or new.student_id is null
    or (old.status = 'converted' and old.student_id is not distinct from new.student_id)
    or new.sale_owner_id is null
    or new.lead_source_id is null
  then
    return new;
  end if;

  select source.*
  into lead_source
  from public.crm_lead_sources as source
  where source.id = new.lead_source_id;

  if not found or lead_source.group_code not in ('mma', 'sandbox') then
    return new;
  end if;

  insert into public.sales_commission_accruals (
    source_cashflow_record_id,
    crm_case_id,
    student_id,
    sale_owner_id,
    lead_source_code,
    lead_source_name,
    lead_source_group,
    recognized_revenue_vnd,
    recognized_at,
    recognized_by
  )
  select
    cashflow.id,
    new.id,
    new.student_id,
    new.sale_owner_id,
    lead_source.code,
    lead_source.name,
    lead_source.group_code,
    cashflow.amount_vnd,
    cashflow.created_at,
    cashflow.created_by
  from public.finance_cashflow_records as cashflow
  where cashflow.record_type = 'receipt'
    and cashflow.category = 'tuition_fee'
    and cashflow.student_id = new.student_id
  on conflict (source_cashflow_record_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_sales_commission_accruals_from_crm_conversion() from public, anon, authenticated;

create trigger crm_cases_create_sales_commission_accruals
after update of status, student_id on public.crm_cases
for each row execute function public.create_sales_commission_accruals_from_crm_conversion();

-- Backfill only confirmed tuition receipts with an eligible, converted CRM case.
insert into public.sales_commission_accruals (
  source_cashflow_record_id,
  crm_case_id,
  student_id,
  sale_owner_id,
  lead_source_code,
  lead_source_name,
  lead_source_group,
  recognized_revenue_vnd,
  recognized_at,
  recognized_by
)
select
  cashflow.id,
  crm_case.id,
  cashflow.student_id,
  crm_case.sale_owner_id,
  lead_source.code,
  lead_source.name,
  lead_source.group_code,
  cashflow.amount_vnd,
  cashflow.created_at,
  cashflow.created_by
from public.finance_cashflow_records as cashflow
join public.crm_cases as crm_case
  on crm_case.student_id = cashflow.student_id
join public.crm_lead_sources as lead_source
  on lead_source.id = crm_case.lead_source_id
where cashflow.record_type = 'receipt'
  and cashflow.category = 'tuition_fee'
  and crm_case.status = 'converted'
  and crm_case.sale_owner_id is not null
  and lead_source.group_code in ('mma', 'sandbox')
on conflict (source_cashflow_record_id) do nothing;

alter table public.sales_commission_accruals enable row level security;

create policy sales_commission_accruals_select_authorized
on public.sales_commission_accruals
for select
to authenticated
using (
  public.has_permission('commissions.view')
  and (
    sale_owner_id = (select auth.uid())
    or public.has_permission('commissions.manage')
  )
);

revoke all privileges on public.sales_commission_accruals from public, anon, authenticated;
grant select on public.sales_commission_accruals to authenticated;

create or replace function public.get_sales_commission_accruals_dashboard(
  p_limit integer default 200
)
returns table (
  sales_commission_accrual_id uuid,
  source_cashflow_record_id uuid,
  crm_case_id uuid,
  student_id uuid,
  student_public_code text,
  student_full_name text,
  sale_owner_id uuid,
  sale_owner_display_name text,
  sale_owner_employee_code text,
  lead_source_code text,
  lead_source_name text,
  lead_source_group text,
  recognized_revenue_vnd bigint,
  recognized_at timestamptz,
  accrual_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  can_manage boolean;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('commissions.view') then
    raise exception using errcode = '42501', message = 'COMMISSIONS_VIEW_PERMISSION_DENIED';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'COMMISSIONS_LIMIT_INVALID';
  end if;

  can_manage := public.has_permission('commissions.manage');

  return query
  select
    accrual.id,
    accrual.source_cashflow_record_id,
    accrual.crm_case_id,
    accrual.student_id,
    student.public_code,
    student.full_name,
    accrual.sale_owner_id,
    coalesce(nullif(pg_catalog.btrim(sale_owner.display_name), ''), sale_owner.email),
    sale_owner.employee_code,
    accrual.lead_source_code,
    accrual.lead_source_name,
    accrual.lead_source_group,
    accrual.recognized_revenue_vnd,
    accrual.recognized_at,
    accrual.status
  from public.sales_commission_accruals as accrual
  join public.students as student on student.id = accrual.student_id
  join public.profiles as sale_owner on sale_owner.id = accrual.sale_owner_id
  where can_manage or accrual.sale_owner_id = actor_id
  order by accrual.recognized_at desc, accrual.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_sales_commission_accruals_dashboard(integer) from public, anon;
grant execute on function public.get_sales_commission_accruals_dashboard(integer) to authenticated;

comment on table public.sales_commission_accruals
is 'Immutable eligible revenue ledger for MMA and Sandbox sales commission. This foundation intentionally contains no commission-money calculation or payroll linkage.';

comment on function public.get_sales_commission_accruals_dashboard(integer)
is 'Returns caller-owned eligible sales revenue, or all records for commissions.manage. No monetary commission is calculated until an approved policy exists.';

commit;
