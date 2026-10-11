-- Doanh thu đủ điều kiện hoa hồng ghi nhận theo ngày tiền về ngân hàng.
--
-- Trước đây sales_commission_accruals.recognized_at = finance_cashflow_records
-- .created_at, tức thời điểm kế toán phân bổ (trừ giao dịch lịch sử API v2 đã
-- được trigger set_sepay_historical_receipt_date đẩy created_at về ngày giao
-- dịch). Giao dịch chuyển cuối tháng nhưng phân bổ đầu tháng sau bị tính doanh
-- thu hoa hồng sang tháng sau. Quyết định chủ trung tâm 11/10/2026: doanh thu
-- và mọi khoản thưởng theo doanh thu tính theo ngày tiền về.
--
-- 1. Thêm recognized_on (ngày nghiệp vụ VN) = finance_cashflow_records
--    .effective_on; recognized_at = thời điểm ngân hàng ghi nhận (sepay
--    transaction_at) nếu có, ngược lại = created_at của dòng tiền.
-- 2. Trigger kiểm tra nguồn, hai trigger tạo accrual và dashboard dùng quy ước
--    mới; dashboard trả thêm recognized_on và sắp theo ngày tiền về.
-- 3. Sửa accrual đã ghi theo ngày phân bổ (sổ bất biến nên tắt riêng trigger
--    chặn sửa trong phạm vi migration).
-- 4. Cho phép xoá accrual khi đảo phân bổ SePay (GUC app.sepay_allocation_
--    reversal = 'on', chỉ RPC reverse_sepay_allocation đặt).

begin;

alter table public.sales_commission_accruals
  add column recognized_on date;

update public.sales_commission_accruals as accrual
set recognized_on = cashflow.effective_on
from public.finance_cashflow_records as cashflow
where cashflow.id = accrual.source_cashflow_record_id;

alter table public.sales_commission_accruals
  alter column recognized_on set not null;

create index sales_commission_accruals_recognized_on_idx
  on public.sales_commission_accruals (recognized_on desc, sale_owner_id);

-- Thời điểm ghi nhận theo quy ước mới cho một dòng tiền.
create or replace function public.commission_recognized_at_for_cashflow(
  p_cashflow public.finance_cashflow_records
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select transaction.transaction_at
      from public.sepay_transactions as transaction
      where transaction.id = p_cashflow.sepay_transaction_id
    ),
    p_cashflow.created_at
  );
$$;

revoke all on function public.commission_recognized_at_for_cashflow(public.finance_cashflow_records)
from public, anon, authenticated;

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
    or new.recognized_at is distinct from public.commission_recognized_at_for_cashflow(source_cashflow)
    or new.recognized_on is distinct from source_cashflow.effective_on
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

-- Sổ vẫn bất biến với người dùng; chỉ RPC đảo phân bổ SePay được xoá accrual
-- của dòng tiền bị đảo, và chính RPC đó ghi audit.
create or replace function public.prevent_sales_commission_accrual_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('app.sepay_allocation_reversal', true) = 'on'
  then
    return old;
  end if;

  raise exception using errcode = '23514', message = 'SALES_COMMISSION_ACCRUAL_IMMUTABLE';
end;
$$;

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
    recognized_on,
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
    public.commission_recognized_at_for_cashflow(new),
    new.effective_on,
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
    recognized_on,
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
    public.commission_recognized_at_for_cashflow(cashflow),
    cashflow.effective_on,
    cashflow.created_by
  from public.finance_cashflow_records as cashflow
  where cashflow.record_type = 'receipt'
    and cashflow.category = 'tuition_fee'
    and cashflow.student_id = new.student_id
  on conflict (source_cashflow_record_id) do nothing;

  return new;
end;
$$;

-- Sửa một lần các accrual đã ghi theo ngày phân bổ.
alter table public.sales_commission_accruals disable trigger sales_commission_accruals_prevent_mutation;

update public.sales_commission_accruals as accrual
set recognized_at = public.commission_recognized_at_for_cashflow(cashflow)
from public.finance_cashflow_records as cashflow
where cashflow.id = accrual.source_cashflow_record_id
  and accrual.recognized_at is distinct from public.commission_recognized_at_for_cashflow(cashflow);

alter table public.sales_commission_accruals enable trigger sales_commission_accruals_prevent_mutation;

drop function public.get_sales_commission_accruals_dashboard(integer);

create function public.get_sales_commission_accruals_dashboard(
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
  recognized_on date,
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
    accrual.recognized_on,
    accrual.status
  from public.sales_commission_accruals as accrual
  join public.students as student on student.id = accrual.student_id
  join public.profiles as sale_owner on sale_owner.id = accrual.sale_owner_id
  where can_manage or accrual.sale_owner_id = actor_id
  order by accrual.recognized_on desc, accrual.recognized_at desc, accrual.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_sales_commission_accruals_dashboard(integer) from public, anon;
grant execute on function public.get_sales_commission_accruals_dashboard(integer) to authenticated;

comment on column public.sales_commission_accruals.recognized_on
is 'Ngày tiền về ngân hàng (múi giờ VN) của dòng tiền nguồn; dùng để xếp doanh thu hoa hồng vào tháng.';

comment on function public.get_sales_commission_accruals_dashboard(integer)
is 'Returns caller-owned eligible sales revenue, or all records for commissions.manage, ordered by bank date. No monetary commission is calculated until an approved policy exists.';

commit;
