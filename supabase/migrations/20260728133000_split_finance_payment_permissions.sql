begin;

-- The legacy payments.manage capability remains during the transition. These
-- granular permissions let future role changes follow the foundation's
-- least-privilege model without changing any current role's effective access.
insert into public.permissions (code, module, name, description)
values
  ('payments.view', 'payments', 'Xem yêu cầu thanh toán', 'Quyền xem yêu cầu nạp học phí và phân bổ thanh toán'),
  ('payments.create_request', 'payments', 'Tạo yêu cầu thanh toán', 'Quyền tạo yêu cầu nạp học phí/VietQR cho học viên'),
  ('sepay.allocate', 'sepay', 'Phân bổ giao dịch SePay', 'Quyền phân bổ giao dịch chuyển khoản SePay cho học viên')
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

-- Every role with the old broad capability receives its equivalent granular
-- capabilities. No role without payments.manage is granted access here.
insert into public.role_permissions (role_id, permission_id)
select legacy_grant.role_id, granular_permission.id
from public.role_permissions as legacy_grant
join public.permissions as legacy_permission
  on legacy_permission.id = legacy_grant.permission_id
join public.permissions as granular_permission
  on granular_permission.code in (
    'payments.view',
    'payments.create_request',
    'sepay.allocate'
  )
where legacy_permission.code = 'payments.manage'
on conflict (role_id, permission_id) do nothing;

drop policy if exists student_payment_requests_select
  on public.student_payment_requests;

create policy student_payment_requests_select
on public.student_payment_requests
for select
to authenticated
using (
  public.has_permission('finance.view')
  or public.has_permission('payments.view')
  or public.has_permission('payments.manage')
);

drop policy if exists sepay_transactions_select
  on public.sepay_transactions;

create policy sepay_transactions_select
on public.sepay_transactions
for select
to authenticated
using (
  public.has_permission('sepay.view')
  or public.has_permission('sepay.allocate')
  or public.has_permission('finance.view')
);

drop policy if exists payment_split_allocations_select
  on public.payment_split_allocations;

create policy payment_split_allocations_select
on public.payment_split_allocations
for select
to authenticated
using (
  public.has_permission('finance.view')
  or public.has_permission('payments.view')
  or public.has_permission('sepay.allocate')
  or public.has_permission('payments.manage')
);

commit;
