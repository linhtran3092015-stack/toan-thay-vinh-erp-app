-- Siết quyền đọc dữ liệu nguồn lương.
--
-- Trước đây payroll_source_facts và payroll_calculation_runs chỉ cần
-- `payroll.view` (quyền cấp cho mọi vai trò), nên bất kỳ nhân sự nào cũng
-- đọc được số tiền, số lượng và metadata lương của người khác.
-- Nay: nhân sự chỉ đọc dòng của chính mình; người quản lý lương
-- (manage / import / accountant_reconcile / owner_approve / dashboard.view)
-- đọc toàn bộ. Các RPC security definer không bị ảnh hưởng.

begin;

drop policy if exists payroll_source_facts_select on public.payroll_source_facts;
create policy payroll_source_facts_select on public.payroll_source_facts for select to authenticated
using (
  staff_id = (select auth.uid())
  or (select public.has_permission('payroll.manage'))
  or (select public.has_permission('payroll.import'))
  or (select public.has_permission('payroll.accountant_reconcile'))
  or (select public.has_permission('payroll.owner_approve'))
  or (select public.has_permission('payroll.dashboard.view'))
);

drop policy if exists payroll_calculation_runs_select on public.payroll_calculation_runs;
create policy payroll_calculation_runs_select on public.payroll_calculation_runs for select to authenticated
using (
  (select public.has_permission('payroll.manage'))
  or (select public.has_permission('payroll.import'))
  or (select public.has_permission('payroll.accountant_reconcile'))
  or (select public.has_permission('payroll.owner_approve'))
  or (select public.has_permission('payroll.dashboard.view'))
  or exists (
    select 1 from public.payroll_statements s
    where s.calculation_run_id = payroll_calculation_runs.id
      and s.staff_id = (select auth.uid())
  )
);

commit;
