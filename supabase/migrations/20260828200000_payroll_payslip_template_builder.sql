begin;

-- 1. Register permission
insert into public.permissions (code, module, name, description)
values
  ('payroll.template.manage', 'payroll', 'Quản lý mẫu phiếu lương', 'Tạo, chỉnh sửa, xem trước, xuất bản, nhân bản và đặt mẫu phiếu lương mặc định.')
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id, granted_by)
select role.id, permission.id, null
from public.roles as role
join public.permissions as permission on (
  role.code in ('owner', 'accountant')
)
where permission.code = 'payroll.template.manage'
on conflict (role_id, permission_id) do nothing;

-- 2. Tables
create table if not exists public.payroll_payslip_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_payslip_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.payroll_payslip_templates(id) on delete cascade,
  version_number integer not null,
  schema_version integer not null default 1,
  configuration jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

-- Index for lookup
create index if not exists idx_payroll_payslip_templates_is_default on public.payroll_payslip_templates(is_default) where is_default = true and is_archived = false;
create index if not exists idx_payroll_payslip_template_versions_template_status on public.payroll_payslip_template_versions(template_id, status);

-- 3. Add snapshot_template_version_id to payroll_statements
alter table public.payroll_statements
  add column if not exists snapshot_template_version_id uuid references public.payroll_payslip_template_versions(id) on delete set null;

-- 4. Triggers
-- Prevent mutation of published versions
create or replace function public.prevent_published_payslip_template_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    -- Allow archiving a published version or soft updates, but prevent modifying the configuration payload
    if (tg_op = 'UPDATE' and old.configuration <> new.configuration) or tg_op = 'DELETE' then
      raise exception using errcode = '23514', message = 'PAYSLIP_TEMPLATE_PUBLISHED_VERSION_IMMUTABLE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_published_payslip_template_version_mutation on public.payroll_payslip_template_versions;
create trigger trg_prevent_published_payslip_template_version_mutation
before update or delete on public.payroll_payslip_template_versions
for each row execute function public.prevent_published_payslip_template_version_mutation();

-- Ensure single default template
create or replace function public.ensure_single_default_payslip_template()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_default = true and (old is null or old.is_default = false) then
    update public.payroll_payslip_templates
    set is_default = false, updated_at = now()
    where id <> new.id and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_single_default_payslip_template on public.payroll_payslip_templates;
create trigger trg_ensure_single_default_payslip_template
before insert or update on public.payroll_payslip_templates
for each row execute function public.ensure_single_default_payslip_template();

-- 5. RLS
alter table public.payroll_payslip_templates enable row level security;
alter table public.payroll_payslip_template_versions enable row level security;

-- Read policy: anyone with app.access or payroll.view or payroll.template.manage
drop policy if exists "payroll_payslip_templates_read" on public.payroll_payslip_templates;
create policy "payroll_payslip_templates_read" on public.payroll_payslip_templates
for select to authenticated
using (
  public.has_permission('app.access')
);

drop policy if exists "payroll_payslip_template_versions_read" on public.payroll_payslip_template_versions;
create policy "payroll_payslip_template_versions_read" on public.payroll_payslip_template_versions
for select to authenticated
using (
  public.has_permission('app.access')
);

-- Write policy: template manager only
drop policy if exists "payroll_payslip_templates_write" on public.payroll_payslip_templates;
create policy "payroll_payslip_templates_write" on public.payroll_payslip_templates
for all to authenticated
using (
  public.has_permission('payroll.template.manage')
)
with check (
  public.has_permission('payroll.template.manage')
);

drop policy if exists "payroll_payslip_template_versions_write" on public.payroll_payslip_template_versions;
create policy "payroll_payslip_template_versions_write" on public.payroll_payslip_template_versions
for all to authenticated
using (
  public.has_permission('payroll.template.manage')
)
with check (
  public.has_permission('payroll.template.manage')
);

-- 6. Seed Default Template: "Toán Thầy Vinh – Standard"
do $$
declare
  v_template_id uuid;
  v_system_user_id uuid;
  v_default_config jsonb;
begin
  -- Resolve an admin / owner or null for created_by
  select id into v_system_user_id from public.profiles order by created_at limit 1;

  v_default_config := '{
    "schemaVersion": 1,
    "page": {
      "size": "A4",
      "orientation": "portrait",
      "margin": "normal"
    },
    "branding": {
      "showLogo": true,
      "logoUrl": null,
      "companyName": "Trung Tâm Toán Thầy Vinh",
      "subtitle": "Hệ thống quản lý giáo dục",
      "primaryColor": "#1e3a8a",
      "secondaryColor": "#3b82f6",
      "accentColor": "#f8fafc",
      "fontFamily": "Be Vietnam Pro",
      "borderRadius": "md",
      "borderStyle": "solid",
      "draftWatermarkText": "BẢN NHÁP",
      "showDraftWatermark": true
    },
    "sections": [
      {
        "id": "header",
        "type": "header",
        "title": "TIÊU ĐỀ PHIẾU LƯƠNG",
        "visible": true,
        "hideWhenEmpty": false,
        "settings": {
          "showPeriodDates": true,
          "showPayDate": true,
          "showStatusBadge": true,
          "alignment": "between"
        }
      },
      {
        "id": "employee_info",
        "type": "employee_info",
        "title": "THÔNG TIN NHÂN SỰ",
        "visible": true,
        "hideWhenEmpty": false,
        "settings": {
          "showEmployeeCode": true,
          "showPosition": true,
          "showDepartment": true,
          "showJoinedDate": true,
          "showAvatar": true,
          "showBankInfo": true,
          "layout": "grid"
        }
      },
      {
        "id": "summary",
        "type": "summary",
        "title": "TỔNG QUAN THU NHẬP",
        "visible": true,
        "hideWhenEmpty": false,
        "settings": {
          "showGross": true,
          "showDeductions": true,
          "showNet": true,
          "showAmountInWords": true,
          "highlightNetPay": true
        }
      },
      {
        "id": "earnings",
        "type": "earnings",
        "title": "I. CÁC KHOẢN THU NHẬP",
        "visible": true,
        "hideWhenEmpty": false,
        "settings": {
          "showQuantity": true,
          "showUnitRate": true,
          "showFormula": true,
          "showNote": true,
          "compactMode": false
        }
      },
      {
        "id": "deductions",
        "type": "deductions",
        "title": "II. TẠM ỨNG & KHẤU TRỪ",
        "visible": true,
        "hideWhenEmpty": false,
        "settings": {
          "showNote": true,
          "compactMode": false
        }
      },
      {
        "id": "work_hours",
        "type": "work_hours",
        "title": "Chi tiết công & giờ làm",
        "visible": true,
        "hideWhenEmpty": true,
        "settings": {
          "showModeBreakdown": true,
          "showDailyRate": true
        }
      },
      {
        "id": "grading",
        "type": "grading",
        "title": "Chi tiết chấm bài",
        "visible": true,
        "hideWhenEmpty": true,
        "settings": {
          "showPoolAmount": true,
          "showExplanation": true
        }
      },
      {
        "id": "commissions",
        "type": "commissions",
        "title": "Chi tiết hoa hồng & tái phí",
        "visible": true,
        "hideWhenEmpty": true,
        "settings": {
          "showBasisRevenue": true,
          "showRatePercentage": true
        }
      },
      {
        "id": "totals",
        "type": "totals",
        "title": "TỔNG KẾT LƯƠNG",
        "visible": true,
        "hideWhenEmpty": false,
        "settings": {
          "showEquationFormula": true,
          "highlightNetPay": true
        }
      },
      {
        "id": "notes",
        "type": "notes",
        "title": "GHI CHÚ & XÁC NHẬN",
        "visible": true,
        "hideWhenEmpty": false,
        "settings": {
          "showSignatures": true,
          "customNotes": "Mọi thắc mắc về bảng lương vui lòng gửi yêu cầu phản hồi trong thời hạn quy định.",
          "employeeSignatureLabel": "Người nhận lương\n(Ký và ghi rõ họ tên)",
          "managerSignatureLabel": "Người lập biểu\n(Ký và ghi rõ họ tên)"
        }
      },
      {
        "id": "footer",
        "type": "footer",
        "title": "CHÂN TRANG",
        "visible": true,
        "hideWhenEmpty": false,
        "settings": {
          "showCompanyInfo": true,
          "hotline": "0987 654 321",
          "website": "toanthayvinh.edu.vn",
          "address": "Hà Nội, Việt Nam",
          "customFooterText": "Phiếu lương điện tử được tạo tự động bởi Hệ thống ERP Toán Thầy Vinh."
        }
      }
    ]
  }'::jsonb;

  -- Insert or update standard template
  insert into public.payroll_payslip_templates (id, name, slug, description, is_default, is_archived, created_by)
  values (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Toán Thầy Vinh – Standard',
    'toan-thay-vinh-standard',
    'Mẫu phiếu lương chuẩn A4 của Trung Tâm Toán Thầy Vinh với đầy đủ thông tin thu nhập, khấu trừ và công thức.',
    true,
    false,
    v_system_user_id
  )
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    is_default = true
  returning id into v_template_id;

  -- Insert or update version 1
  insert into public.payroll_payslip_template_versions (
    template_id,
    version_number,
    schema_version,
    configuration,
    status,
    published_at,
    created_by
  )
  values (
    v_template_id,
    1,
    1,
    v_default_config,
    'published',
    now(),
    v_system_user_id
  )
  on conflict (template_id, version_number) do update set
    configuration = excluded.configuration,
    status = 'published',
    published_at = coalesce(payroll_payslip_template_versions.published_at, now());

end $$;

commit;
