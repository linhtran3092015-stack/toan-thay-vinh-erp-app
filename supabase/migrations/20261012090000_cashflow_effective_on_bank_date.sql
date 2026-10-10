-- Ghi nhận doanh thu theo ngày tiền về ngân hàng, không theo ngày phân bổ.
--
-- Trước đây fact lương (renewal_order / new_enrollment_order) lấy event_date
-- từ finance_cashflow_records.created_at — tức ngày kế toán phân bổ giao dịch.
-- Giao dịch chuyển cuối tháng 9 nhưng phân bổ đầu tháng 10 bị tính vào doanh
-- thu tháng 10, kéo theo thưởng ngưỡng doanh thu / gia hạn tính sai tháng.
-- Quyết định chủ trung tâm 11/10/2026: doanh thu và thưởng theo doanh thu tính
-- theo ngày tiền về.
--
-- 1. Thêm finance_cashflow_records.effective_on (ngày nghiệp vụ, múi giờ VN):
--    = ngày giao dịch SePay nếu có, ngược lại = ngày tạo. Trigger tự điền.
-- 2. sync_payroll_order_facts dùng effective_on cho event_date, tra cứu lớp /
--    phân công khối / nguồn và lọc tháng.
-- 3. Sửa lại event_date của các fact hệ thống đã ghi theo ngày phân bổ.
-- Kỳ lương đã duyệt giữ nguyên snapshot; chỉ kỳ nháp/tính lại mới dùng số mới.

begin;

alter table public.finance_cashflow_records
  add column effective_on date;

update public.finance_cashflow_records as cashflow
set effective_on = coalesce(
  (
    select (transaction.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date
    from public.sepay_transactions as transaction
    where transaction.id = cashflow.sepay_transaction_id
  ),
  (cashflow.created_at at time zone 'Asia/Ho_Chi_Minh')::date
);

alter table public.finance_cashflow_records
  alter column effective_on set not null;

create index finance_cashflow_records_effective_on_idx
  on public.finance_cashflow_records (effective_on, record_type);

create or replace function public.set_finance_cashflow_effective_on()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.effective_on is null then
    new.effective_on := coalesce(
      (
        select (transaction.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date
        from public.sepay_transactions as transaction
        where transaction.id = new.sepay_transaction_id
      ),
      (coalesce(new.created_at, pg_catalog.now()) at time zone 'Asia/Ho_Chi_Minh')::date
    );
  end if;
  return new;
end;
$$;

revoke all on function public.set_finance_cashflow_effective_on()
from public, anon, authenticated;

create trigger finance_cashflow_records_set_effective_on
before insert on public.finance_cashflow_records
for each row execute function public.set_finance_cashflow_effective_on();

create or replace function public.sync_payroll_order_facts(p_period_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  inserted_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.manage') then
    raise exception using errcode = '42501', message = 'PAYROLL_MANAGE_PERMISSION_REQUIRED';
  end if;
  if p_period_month is null or p_period_month <> pg_catalog.date_trunc('month', p_period_month)::date then
    raise exception using errcode = '22023', message = 'PAYROLL_PERIOD_MONTH_INVALID';
  end if;

  insert into public.payroll_source_facts (
    fact_type,
    source_key,
    source_origin,
    event_date,
    staff_id,
    student_id,
    grade,
    amount_vnd,
    quantity,
    source_code,
    metadata,
    approved_by,
    approved_at
  )
  select
    case transaction.account_purpose
      when 'renewal' then 'renewal_order'
      when 'new_enrollment' then 'new_enrollment_order'
    end,
    cashflow.id::text,
    'system',
    cashflow.effective_on,
    case
      when transaction.account_purpose = 'new_enrollment' then accrual.sale_owner_id
      else grade_assignment.staff_id
    end,
    cashflow.student_id,
    case when coalesce(class_at_order.grade, student.current_grade) between 2 and 12
      then coalesce(class_at_order.grade, student.current_grade)
      else null
    end,
    cashflow.amount_vnd,
    1,
    source_mapping.payroll_source_code,
    pg_catalog.jsonb_build_object(
      'cashflow_record_id', cashflow.id,
      'sepay_transaction_id', transaction.id,
      'sale_owner_id', accrual.sale_owner_id,
      'lead_source_code', accrual.lead_source_code,
      'lead_source_name', accrual.lead_source_name,
      'account_purpose', transaction.account_purpose,
      'grade_assignment_id', grade_assignment.id,
      'bank_transaction_at', transaction.transaction_at,
      'allocated_at', cashflow.created_at
    ),
    null,
    null
  from public.sepay_transactions as transaction
  join public.finance_cashflow_records as cashflow
    on cashflow.sepay_transaction_id = transaction.id
    and cashflow.record_type = 'receipt'
    and cashflow.category = 'tuition_fee'
    and cashflow.student_id is not null
  join public.students as student on student.id = cashflow.student_id
  left join public.sales_commission_accruals as accrual
    on accrual.source_cashflow_record_id = cashflow.id
  left join public.crm_cases as crm_case on crm_case.id = accrual.crm_case_id
  left join lateral (
    select class_row.grade
    from public.student_enrollments as enrollment
    join public.classes as class_row on class_row.id = enrollment.class_id
    where enrollment.student_id = cashflow.student_id
      and enrollment.effective_from <= cashflow.effective_on
      and (enrollment.effective_to is null or enrollment.effective_to >= cashflow.effective_on)
    order by enrollment.effective_from desc, enrollment.id desc
    limit 1
  ) as class_at_order on true
  left join lateral (
    select assignment.id, assignment.staff_id
    from public.staff_grade_assignments as assignment
    where assignment.grade = coalesce(class_at_order.grade, student.current_grade)
      and assignment.effective_from <= cashflow.effective_on
      and (assignment.effective_to is null or assignment.effective_to >= cashflow.effective_on)
    order by assignment.effective_from desc, assignment.id desc
    limit 1
  ) as grade_assignment on true
  left join lateral (
    select mapping.payroll_source_code
    from public.payroll_lead_source_mapping_versions as mapping
    where mapping.lead_source_id = crm_case.lead_source_id
      and mapping.effective_from <= cashflow.effective_on
    order by mapping.effective_from desc
    limit 1
  ) as source_mapping on true
  where transaction.account_purpose in ('new_enrollment', 'renewal')
    and cashflow.effective_on >= p_period_month
    and cashflow.effective_on < (p_period_month + interval '1 month')::date
  on conflict (fact_type, source_key) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- Fact hệ thống đã ghi theo ngày phân bổ: chuyển về ngày tiền về.
-- Fact là bất biến (trigger payroll_source_facts_immutable); đây là sửa dữ liệu
-- một lần nên tắt riêng trigger đó trong phạm vi migration, không tắt toàn bộ.
alter table public.payroll_source_facts disable trigger payroll_source_facts_immutable;

update public.payroll_source_facts as fact
set
  event_date = cashflow.effective_on,
  metadata = fact.metadata || pg_catalog.jsonb_build_object(
    'event_date_corrected_from', fact.event_date,
    'allocated_at', cashflow.created_at
  )
from public.finance_cashflow_records as cashflow
where fact.source_origin = 'system'
  and fact.fact_type in ('renewal_order', 'new_enrollment_order')
  and fact.source_key = cashflow.id::text
  and fact.event_date <> cashflow.effective_on;

alter table public.payroll_source_facts enable trigger payroll_source_facts_immutable;

commit;
