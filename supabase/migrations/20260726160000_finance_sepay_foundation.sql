-- Migration: 20260726160000_finance_sepay_foundation.sql
-- Description: Foundation schema for Finance, SePay webhooks, Credit Lots, Multi-child payment allocations, and Cashflow

begin;

-- 1. Register new permissions
insert into public.permissions (code, module, name, description)
values
  ('finance.view', 'finance', 'Xem tổng quan tài chính', 'Quyền xem danh sách tài chính, học phí và công nợ'),
  ('payments.manage', 'payments', 'Quản lý thanh toán & Nạp tiền', 'Quyền tạo yêu cầu nạp tiền và phân bổ học phí'),
  ('sepay.view', 'sepay', 'Xem giao dịch SePay', 'Quyền xem danh sách chuyển khoản SePay từ ngân hàng'),
  ('sepay.webhook_manage', 'sepay', 'Quản lý Webhook SePay', 'Quyền cấu hình và kiểm tra webhook SePay'),
  ('refunds.manage', 'refunds', 'Quản lý hoàn phí', 'Quyền xử lý và duyệt hoàn phí cho học viên'),
  ('cashflow.view', 'cashflow', 'Xem sổ quỹ dòng tiền', 'Quyền xem báo cáo thu chi dòng tiền')
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

-- Grant permissions to roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where (p.code in ('finance.view', 'payments.manage', 'sepay.view', 'cashflow.view')
       and r.code in ('owner', 'operations_manager', 'assistant_manager', 'accountant', 'admissions_leader'))
   or (p.code in ('sepay.webhook_manage', 'refunds.manage')
       and r.code in ('owner', 'operations_manager', 'accountant'))
on conflict (role_id, permission_id) do nothing;

-- 2. Create Fee Policies table
create table if not exists public.finance_fee_policies (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  learning_mode text not null check (learning_mode in ('offline', 'online', 'hybrid')),
  area_code text check (area_code in ('hanoi_hcm', 'provincial')),
  standard_unit_price_vnd bigint not null check (standard_unit_price_vnd >= 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now()
);

-- Seed default fee policies
insert into public.finance_fee_policies (code, name, learning_mode, area_code, standard_unit_price_vnd, description)
values
  ('FEE_OFFLINE_STD', 'Học phí Offline Chuẩn', 'offline', null, 140000, 'Áp dụng cho học viên học offline tại trung tâm (140.000đ/buổi)'),
  ('FEE_ONLINE_URBAN', 'Học phí Online Hà Nội/HCM', 'online', 'hanoi_hcm', 100000, 'Áp dụng cho học viên online khu vực Hà Nội/TP.HCM (100.000đ/buổi)'),
  ('FEE_ONLINE_PROV', 'Học phí Online Tỉnh', 'online', 'provincial', 70000, 'Áp dụng cho học viên online các tỉnh khác (70.000đ/buổi)')
on conflict (code) do nothing;

-- 3. Create SePay Webhooks table (Raw Webhook Log & Idempotency)
create table if not exists public.sepay_webhooks (
  id uuid primary key default gen_random_uuid(),
  sepay_id bigint unique,
  gateway text not null,
  transaction_date timestamptz not null,
  account_number text not null,
  code text,
  content text not null,
  transfer_type text not null check (transfer_type in ('in', 'out')),
  amount_in bigint not null default 0 check (amount_in >= 0),
  amount_out bigint not null default 0 check (amount_out >= 0),
  accumulated bigint default 0,
  reference_number text,
  body_raw jsonb not null,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processed', 'failed', 'ignored')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists sepay_webhooks_sepay_id_idx on public.sepay_webhooks (sepay_id);
create index if not exists sepay_webhooks_status_idx on public.sepay_webhooks (processing_status, created_at desc);

-- 4. Create Student Payment Requests table (VietQR payloads)
create table if not exists public.student_payment_requests (
  id uuid primary key default gen_random_uuid(),
  public_code text unique not null,
  student_id uuid references public.students(id) on delete restrict,
  crm_case_id uuid references public.crm_cases(id) on delete restrict,
  guardian_id uuid references public.guardians(id) on delete restrict,
  expected_amount_vnd bigint not null check (expected_amount_vnd > 0),
  purchased_sessions integer not null check (purchased_sessions > 0),
  bonus_sessions integer not null default 0 check (bonus_sessions >= 0),
  calculated_unit_price_vnd bigint not null check (calculated_unit_price_vnd >= 0),
  topup_type text not null default 'new' check (topup_type in ('new', 'renewal')),
  transfer_code text unique not null,
  qr_payload_url text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'partially_paid', 'cancelled', 'expired')),
  paid_amount_vnd bigint not null default 0 check (paid_amount_vnd >= 0),
  paid_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists student_payment_requests_student_idx on public.student_payment_requests (student_id);
create index if not exists student_payment_requests_transfer_code_idx on public.student_payment_requests (transfer_code);
create index if not exists student_payment_requests_status_idx on public.student_payment_requests (status, created_at desc);

-- 5. Create SePay Transactions table (Parsed Bank Transactions)
create table if not exists public.sepay_transactions (
  id uuid primary key default gen_random_uuid(),
  sepay_webhook_id uuid references public.sepay_webhooks(id) on delete restrict,
  bank_transaction_id text unique not null,
  bank_brand text not null,
  account_number text not null,
  amount_vnd bigint not null check (amount_vnd > 0),
  transfer_content text not null,
  transaction_at timestamptz not null,
  matched_payment_request_id uuid references public.student_payment_requests(id) on delete restrict,
  matched_student_id uuid references public.students(id) on delete restrict,
  match_status text not null default 'unmatched' check (match_status in ('unmatched', 'auto_matched', 'manual_matched', 'split_allocated')),
  matched_by uuid references public.profiles(id) on delete restrict,
  matched_at timestamptz,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists sepay_transactions_match_idx on public.sepay_transactions (match_status, transaction_at desc);
create index if not exists sepay_transactions_request_idx on public.sepay_transactions (matched_payment_request_id) where matched_payment_request_id is not null;

-- 6. Create Student Credit Lots table (Lô Tín Dụng Số Buổi)
create table if not exists public.student_credit_lots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  payment_request_id uuid references public.student_payment_requests(id) on delete restrict,
  sepay_transaction_id uuid references public.sepay_transactions(id) on delete restrict,
  total_purchased_sessions integer not null check (total_purchased_sessions >= 0),
  total_bonus_sessions integer not null default 0 check (total_bonus_sessions >= 0),
  total_sessions integer not null check (total_sessions > 0),
  remaining_sessions integer not null check (remaining_sessions >= 0),
  unit_price_vnd bigint not null check (unit_price_vnd >= 0),
  topup_type text not null default 'new' check (topup_type in ('new', 'renewal')),
  status text not null default 'active' check (status in ('active', 'exhausted', 'expired', 'refunded')),
  expires_at date,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists student_credit_lots_student_idx on public.student_credit_lots (student_id, status, created_at asc);

-- 7. Create Payment Split Allocations table (Phân bổ học phí cho nhiều con)
create table if not exists public.payment_split_allocations (
  id uuid primary key default gen_random_uuid(),
  sepay_transaction_id uuid not null references public.sepay_transactions(id) on delete restrict,
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  allocated_amount_vnd bigint not null check (allocated_amount_vnd > 0),
  allocated_sessions integer not null check (allocated_sessions > 0),
  bonus_sessions integer not null default 0 check (bonus_sessions >= 0),
  unit_price_vnd bigint not null check (unit_price_vnd >= 0),
  credit_lot_id uuid references public.student_credit_lots(id) on delete restrict,
  notes text,
  allocated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists payment_split_allocations_tx_idx on public.payment_split_allocations (sepay_transaction_id);
create index if not exists payment_split_allocations_student_idx on public.payment_split_allocations (student_id);

-- 8. Create Finance Cashflow Records table (Sổ quỹ dòng tiền)
create table if not exists public.finance_cashflow_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('receipt', 'disbursement', 'refund')),
  category text not null check (category in ('tuition_fee', 'bonus_grant', 'refund', 'other')),
  amount_vnd bigint not null check (amount_vnd > 0),
  student_id uuid references public.students(id) on delete restrict,
  sepay_transaction_id uuid references public.sepay_transactions(id) on delete restrict,
  reference_code text not null,
  note text not null,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists finance_cashflow_records_type_idx on public.finance_cashflow_records (record_type, created_at desc);

-- 9. Triggers for updated_at
create or replace function public.touch_finance_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger student_payment_requests_touch_updated_at
before update on public.student_payment_requests
for each row execute function public.touch_finance_updated_at();

create trigger student_credit_lots_touch_updated_at
before update on public.student_credit_lots
for each row execute function public.touch_finance_updated_at();

-- 10. Enable RLS and SELECT policies
alter table public.finance_fee_policies enable row level security;
alter table public.sepay_webhooks enable row level security;
alter table public.student_payment_requests enable row level security;
alter table public.sepay_transactions enable row level security;
alter table public.student_credit_lots enable row level security;
alter table public.payment_split_allocations enable row level security;
alter table public.finance_cashflow_records enable row level security;

create policy finance_fee_policies_select on public.finance_fee_policies
  for select to authenticated using (public.has_permission('finance.view'));

create policy sepay_webhooks_select on public.sepay_webhooks
  for select to authenticated using (public.has_permission('sepay.view') or public.has_permission('sepay.webhook_manage'));

create policy student_payment_requests_select on public.student_payment_requests
  for select to authenticated using (public.has_permission('finance.view') or public.has_permission('payments.manage'));

create policy sepay_transactions_select on public.sepay_transactions
  for select to authenticated using (public.has_permission('sepay.view') or public.has_permission('finance.view'));

create policy student_credit_lots_select on public.student_credit_lots
  for select to authenticated using (public.has_permission('finance.view') or public.has_permission('session_ledger.view'));

create policy payment_split_allocations_select on public.payment_split_allocations
  for select to authenticated using (public.has_permission('finance.view') or public.has_permission('payments.manage'));

create policy finance_cashflow_records_select on public.finance_cashflow_records
  for select to authenticated using (public.has_permission('cashflow.view') or public.has_permission('finance.view'));

commit;
