-- Wave A: immutable student tuition periods, notices, and renewal requests.
-- This migration is deliberately additive: it does not alter historical orders,
-- payment requests, ledger entries, or CRM attribution snapshots.
begin;

insert into public.permissions (code, module, name, description) values
  ('tuition_periods.view', 'tuition_periods', 'Xem kỳ thu học phí', 'Xem kỳ thu, preview và phiếu học phí'),
  ('tuition_periods.manage', 'tuition_periods', 'Quản lý kỳ thu học phí', 'Tạo và chuẩn bị kỳ thu học phí'),
  ('tuition_periods.lock', 'tuition_periods', 'Khóa kỳ thu học phí', 'Khóa kỳ thu thành snapshot tài chính'),
  ('tuition_periods.export', 'tuition_periods', 'In phiếu học phí', 'In/xuất phiếu học phí không thay đổi dữ liệu'),
  ('tuition_periods.adjust', 'tuition_periods', 'Điều chỉnh phiếu học phí', 'Lập điều chỉnh hoặc phát hành lại phiếu đã khóa'),
  ('students.manage_tuition_rates', 'students', 'Quản lý đơn giá học phí', 'Thêm phiên bản đơn giá học phí học viên'),
  ('students.correct_acquisition_source', 'students', 'Sửa nguồn học viên', 'Hiệu chỉnh nguồn học viên có lưu vết'),
  ('settings.receipts.manage', 'settings', 'Quản lý mẫu phiếu học phí', 'Xuất bản phiên bản mẫu phiếu học phí'),
  ('settings.sepay_receiving_accounts.manage', 'settings', 'Quản lý tài khoản nhận SePay', 'Quản lý phiên bản tài khoản nhận công khai theo mục đích')
on conflict (code) do update set module = excluded.module, name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r join public.permissions p on true
where (r.code = 'owner' and p.code in (
  'tuition_periods.view','tuition_periods.manage','tuition_periods.lock','tuition_periods.export','tuition_periods.adjust',
  'students.manage_tuition_rates','students.correct_acquisition_source','settings.receipts.manage','settings.sepay_receiving_accounts.manage'
)) or (r.code in ('operations_manager','assistant_manager','accountant') and p.code in (
  'tuition_periods.view','tuition_periods.manage','tuition_periods.export'
))
on conflict (role_id, permission_id) do nothing;

create table public.student_tuition_rate_versions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  effective_from date not null,
  unit_price_vnd bigint not null check (unit_price_vnd > 0),
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (student_id, effective_from)
);
create index student_tuition_rate_versions_lookup_idx on public.student_tuition_rate_versions (student_id, effective_from desc);

create table public.student_acquisition_source_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  lead_source_id uuid not null references public.crm_lead_sources(id) on delete restrict,
  crm_case_id uuid references public.crm_cases(id) on delete restrict,
  reason text not null check (length(trim(reason)) > 0),
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  supersedes_id uuid references public.student_acquisition_source_assignments(id) on delete restrict,
  is_current boolean not null default true
);
create unique index student_acquisition_source_current_unique on public.student_acquisition_source_assignments (student_id) where is_current;
create index student_acquisition_source_history_idx on public.student_acquisition_source_assignments (student_id, assigned_at desc);

create table public.tuition_receipt_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.tuition_receipt_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.tuition_receipt_templates(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete restrict,
  reason text not null check (length(trim(reason)) > 0),
  unique (template_id, version_number)
);
insert into public.tuition_receipt_templates(code,name) values ('TUITION_NOTICE_DEFAULT','Phiếu học phí mặc định') on conflict (code) do nothing;
insert into public.tuition_receipt_template_versions(template_id,version_number,content,reason)
select id,1,jsonb_build_object('center_display_name','Trung tâm Toán Thầy Vinh','title','HỌC PHÍ {PERIOD_NAME}','footer','Phụ huynh vui lòng kiểm tra thông tin học phí trước khi thanh toán.','show_qr',true),'Default Wave A template'
from public.tuition_receipt_templates where code='TUITION_NOTICE_DEFAULT'
on conflict (template_id,version_number) do nothing;

-- Public receiving-account identity only. SePay credentials and webhook secrets
-- remain environment-managed and never appear in this catalog or a notice.
create or replace function public.normalize_sepay_receiving_account_number(p_account_number text)
returns text language sql immutable strict set search_path = '' as $$
  select pg_catalog.upper(pg_catalog.regexp_replace(pg_catalog.btrim(p_account_number), '[[:space:]]+', '', 'g'));
$$;

create table public.sepay_receiving_account_versions (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('new_enrollment','renewal')),
  bank_code text not null check (length(trim(bank_code)) > 0),
  account_number text not null check (length(trim(account_number)) > 0),
  signed_account_number text generated always as (public.normalize_sepay_receiving_account_number(account_number)) stored,
  account_display_name text not null check (length(trim(account_display_name)) > 0),
  effective_from date not null,
  effective_to date,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  changed_by uuid references public.profiles(id) on delete restrict,
  changed_at timestamptz,
  audit_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(audit_metadata)='object'),
  check (effective_to is null or effective_to >= effective_from)
);
create index sepay_receiving_account_versions_effective_idx on public.sepay_receiving_account_versions(purpose,status,effective_from desc);
create extension if not exists btree_gist;
alter table public.sepay_receiving_account_versions add constraint sepay_receiving_account_versions_no_active_overlap
  exclude using gist (purpose with =, daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&)
  where (status = 'active');
alter table public.sepay_receiving_account_versions add constraint sepay_receiving_account_versions_no_active_signed_identity_overlap
  exclude using gist (signed_account_number with =, daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&)
  where (status = 'active');

create table public.tuition_collection_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  starts_on date not null,
  ends_on date not null,
  due_on date,
  status text not null default 'draft' check (status in ('draft','locked')),
  receipt_template_version_id uuid references public.tuition_receipt_template_versions(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  locked_by uuid references public.profiles(id) on delete restrict,
  locked_at timestamptz,
  check (ends_on >= starts_on),
  check (due_on is null or due_on >= starts_on)
);
create index tuition_collection_periods_status_dates_idx on public.tuition_collection_periods (status, starts_on desc, ends_on desc);

create table public.tuition_collection_items (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.tuition_collection_periods(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  enrollment_id uuid references public.student_enrollments(id) on delete restrict,
  class_id uuid references public.classes(id) on delete restrict,
  acquisition_source_id uuid references public.crm_lead_sources(id) on delete restrict,
  student_snapshot jsonb not null check (jsonb_typeof(student_snapshot) = 'object'),
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) = 'object'),
  opening_balance_sessions bigint not null,
  scheduled_chargeable_sessions integer not null check (scheduled_chargeable_sessions >= 0),
  credit_offset_sessions integer not null default 0 check (credit_offset_sessions >= 0),
  debit_carry_sessions integer not null default 0 check (debit_carry_sessions >= 0),
  payable_sessions integer not null check (payable_sessions >= 0),
  payable_amount_vnd bigint not null check (payable_amount_vnd >= 0),
  status text not null check (status in ('pending_payment','no_payment','reissued')),
  receipt_template_snapshot jsonb not null check (jsonb_typeof(receipt_template_snapshot) = 'object'),
  receipt_template_version_id uuid references public.tuition_receipt_template_versions(id) on delete restrict,
  payment_request_id uuid unique references public.student_payment_requests(id) on delete restrict,
  payment_contract_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(payment_contract_snapshot) = 'object'),
  reissued_from_item_id uuid references public.tuition_collection_items(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  unique (period_id, student_id, reissued_from_item_id)
);
create index tuition_collection_items_student_idx on public.tuition_collection_items (student_id, created_at desc);
create index tuition_collection_items_period_status_idx on public.tuition_collection_items (period_id, status);

create table public.tuition_collection_item_lines (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.tuition_collection_items(id) on delete restrict,
  class_session_id uuid references public.class_sessions(id) on delete restrict,
  line_kind text not null check (line_kind in ('session','opening_debit')),
  session_date date,
  session_kind text,
  unit_price_vnd bigint not null check (unit_price_vnd >= 0),
  session_count integer not null default 1 check (session_count > 0),
  payable_session_count integer not null default 0 check (payable_session_count >= 0),
  amount_vnd bigint not null default 0 check (amount_vnd >= 0),
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  check ((line_kind = 'session' and class_session_id is not null and session_date is not null) or line_kind = 'opening_debit'),
  unique (item_id, class_session_id)
);
create index tuition_collection_item_lines_item_idx on public.tuition_collection_item_lines (item_id, session_date, id);

create table public.tuition_collection_item_adjustments (
  id uuid primary key default gen_random_uuid(),
  original_item_id uuid not null references public.tuition_collection_items(id) on delete restrict,
  replacement_item_id uuid not null unique references public.tuition_collection_items(id) on delete restrict,
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create or replace function public.create_student_tuition_rate_version(p_student_id uuid, p_effective_from date, p_unit_price_vnd bigint, p_reason text)
returns public.student_tuition_rate_versions
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_row public.student_tuition_rate_versions;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('students.manage_tuition_rates') then raise exception 'TUITION_RATE_PERMISSION_DENIED'; end if;
  if p_effective_from is null or p_unit_price_vnd is null or p_unit_price_vnd <= 0 or nullif(trim(p_reason),'') is null then raise exception 'TUITION_RATE_INPUT_INVALID'; end if;
  insert into public.student_tuition_rate_versions(student_id,effective_from,unit_price_vnd,reason,created_by)
  values (p_student_id,p_effective_from,p_unit_price_vnd,trim(p_reason),v_actor) returning * into v_row;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data,reason)
  values(v_actor,'finance','tuition_rate_version_created','student_tuition_rate_version',v_row.id::text,to_jsonb(v_row),trim(p_reason));
  return v_row;
end; $$;

create or replace function public.correct_student_acquisition_source(p_student_id uuid, p_lead_source_id uuid, p_reason text)
returns public.student_acquisition_source_assignments
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_old uuid; v_row public.student_acquisition_source_assignments;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('students.correct_acquisition_source') then raise exception 'STUDENT_SOURCE_PERMISSION_DENIED'; end if;
  if p_lead_source_id is null or nullif(trim(p_reason),'') is null then raise exception 'STUDENT_SOURCE_INPUT_INVALID'; end if;
  select id into v_old from public.student_acquisition_source_assignments where student_id=p_student_id and is_current for update;
  update public.student_acquisition_source_assignments set is_current=false where id=v_old;
  insert into public.student_acquisition_source_assignments(student_id,lead_source_id,reason,assigned_by,supersedes_id)
  values(p_student_id,p_lead_source_id,trim(p_reason),v_actor,v_old) returning * into v_row;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data,reason)
  values(v_actor,'students','acquisition_source_corrected','student',p_student_id::text,to_jsonb(v_row),trim(p_reason));
  return v_row;
end; $$;

create or replace function public.create_tuition_collection_period(p_name text, p_starts_on date, p_ends_on date, p_due_on date default null, p_receipt_template_version_id uuid default null)
returns public.tuition_collection_periods
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_row public.tuition_collection_periods;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('tuition_periods.manage') then raise exception 'TUITION_PERIOD_MANAGE_PERMISSION_DENIED'; end if;
  if nullif(trim(p_name),'') is null or p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on or (p_due_on is not null and p_due_on < p_starts_on) then raise exception 'TUITION_PERIOD_INPUT_INVALID'; end if;
  insert into public.tuition_collection_periods(name,starts_on,ends_on,due_on,receipt_template_version_id,created_by)
  values(trim(p_name),p_starts_on,p_ends_on,p_due_on,p_receipt_template_version_id,v_actor) returning * into v_row;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data)
  values(v_actor,'finance','tuition_period_created','tuition_collection_period',v_row.id::text,to_jsonb(v_row));
  return v_row;
end; $$;

create or replace function public.publish_tuition_receipt_template_version(p_code text, p_name text, p_content jsonb, p_reason text)
returns public.tuition_receipt_template_versions
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_template uuid; v_row public.tuition_receipt_template_versions;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('settings.receipts.manage') then raise exception 'RECEIPT_TEMPLATE_PERMISSION_DENIED'; end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null or jsonb_typeof(coalesce(p_content,'{}'::jsonb)) <> 'object' or nullif(trim(p_reason),'') is null then raise exception 'RECEIPT_TEMPLATE_INPUT_INVALID'; end if;
  insert into public.tuition_receipt_templates(code,name,created_by) values(trim(p_code),trim(p_name),v_actor)
  on conflict(code) do update set name=excluded.name returning id into v_template;
  insert into public.tuition_receipt_template_versions(template_id,version_number,content,published_by,reason)
  values(v_template,(select coalesce(max(version_number),0)+1 from public.tuition_receipt_template_versions where template_id=v_template),p_content,v_actor,trim(p_reason)) returning * into v_row;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data,reason)
  values(v_actor,'finance','receipt_template_version_published','tuition_receipt_template_version',v_row.id::text,to_jsonb(v_row),trim(p_reason));
  return v_row;
end; $$;

-- accountNumber is the only receiving-account identifier signed in the current
-- SePay webhook payload. Resolve it at the transaction's Vietnam business date,
-- never from process ENV or transfer content.
create or replace function public.resolve_sepay_receiving_account(p_signed_account_number text, p_transaction_at timestamptz)
returns table(account_version_id uuid, purpose text, bank_code text, account_number text, account_display_name text, signed_account_number text)
language plpgsql security definer set search_path = '' as $$
declare v_effective_on date; v_matches integer;
begin
  if p_transaction_at is null or nullif(trim(p_signed_account_number),'') is null then
    return query select null::uuid, 'unknown'::text, null::text, null::text, null::text, null::text;
    return;
  end if;
  v_effective_on := (p_transaction_at at time zone 'Asia/Ho_Chi_Minh')::date;
  select count(*) into v_matches
  from public.sepay_receiving_account_versions v
  where v.status='active'
    and v.signed_account_number=public.normalize_sepay_receiving_account_number(p_signed_account_number)
    and v.effective_from<=v_effective_on
    and coalesce(v.effective_to,v_effective_on)>=v_effective_on;
  if v_matches<>1 then
    return query select null::uuid, 'unknown'::text, null::text, null::text, null::text, null::text;
    return;
  end if;
  return query
  select v.id,v.purpose,v.bank_code,v.account_number,v.account_display_name,v.signed_account_number
  from public.sepay_receiving_account_versions v
  where v.status='active'
    and v.signed_account_number=public.normalize_sepay_receiving_account_number(p_signed_account_number)
    and v.effective_from<=v_effective_on
    and coalesce(v.effective_to,v_effective_on)>=v_effective_on;
end; $$;

create or replace function public.get_effective_sepay_receiving_account(p_purpose text, p_effective_on date default current_date)
returns table(account_version_id uuid, purpose text, bank_code text, account_number text, account_display_name text)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_matches integer;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not (public.has_permission('payments.create_request') or public.has_permission('payments.manage') or public.has_permission('settings.sepay_receiving_accounts.manage')) then
    raise exception 'SEPAY_RECEIVING_ACCOUNT_PERMISSION_DENIED';
  end if;
  if p_purpose not in ('new_enrollment','renewal') or p_effective_on is null then raise exception 'SEPAY_RECEIVING_ACCOUNT_INPUT_INVALID'; end if;
  select count(*) into v_matches from public.sepay_receiving_account_versions v
  where v.purpose=p_purpose and v.status='active' and v.effective_from<=p_effective_on and coalesce(v.effective_to,p_effective_on)>=p_effective_on;
  if v_matches<>1 then raise exception 'SEPAY_RECEIVING_ACCOUNT_UNAVAILABLE'; end if;
  return query select v.id,v.purpose,v.bank_code,v.account_number,v.account_display_name from public.sepay_receiving_account_versions v
  where v.purpose=p_purpose and v.status='active' and v.effective_from<=p_effective_on and coalesce(v.effective_to,p_effective_on)>=p_effective_on;
end; $$;

create or replace function public.create_sepay_receiving_account_version(p_purpose text, p_bank_code text, p_account_number text, p_account_display_name text, p_effective_from date, p_reason text)
returns public.sepay_receiving_account_versions
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_row public.sepay_receiving_account_versions;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('settings.sepay_receiving_accounts.manage') then raise exception 'SEPAY_RECEIVING_ACCOUNT_PERMISSION_DENIED'; end if;
  if p_purpose not in ('new_enrollment','renewal') or p_effective_from is null or nullif(trim(p_bank_code),'') is null or nullif(trim(p_account_number),'') is null or nullif(trim(p_account_display_name),'') is null or nullif(trim(p_reason),'') is null then raise exception 'SEPAY_RECEIVING_ACCOUNT_INPUT_INVALID'; end if;
  insert into public.sepay_receiving_account_versions(purpose,bank_code,account_number,account_display_name,effective_from,created_by,audit_metadata)
  values(p_purpose,trim(p_bank_code),trim(p_account_number),trim(p_account_display_name),p_effective_from,v_actor,jsonb_build_object('reason',trim(p_reason)))
  returning * into v_row;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data,reason)
  values(v_actor,'finance','sepay_receiving_account_version_created','sepay_receiving_account_version',v_row.id::text,to_jsonb(v_row),trim(p_reason));
  return v_row;
end; $$;

create or replace function public.retire_sepay_receiving_account_version(p_account_version_id uuid, p_effective_to date, p_reason text)
returns public.sepay_receiving_account_versions
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_row public.sepay_receiving_account_versions;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('settings.sepay_receiving_accounts.manage') then raise exception 'SEPAY_RECEIVING_ACCOUNT_PERMISSION_DENIED'; end if;
  if p_account_version_id is null or p_effective_to is null or nullif(trim(p_reason),'') is null then raise exception 'SEPAY_RECEIVING_ACCOUNT_INPUT_INVALID'; end if;
  select * into v_row from public.sepay_receiving_account_versions where id=p_account_version_id for update;
  if not found then raise exception 'SEPAY_RECEIVING_ACCOUNT_NOT_FOUND'; end if;
  if p_effective_to<v_row.effective_from then raise exception 'SEPAY_RECEIVING_ACCOUNT_EFFECTIVE_DATE_INVALID'; end if;
  update public.sepay_receiving_account_versions set effective_to=p_effective_to,changed_by=v_actor,changed_at=now(),audit_metadata=audit_metadata || jsonb_build_object('retired_reason',trim(p_reason)) where id=v_row.id returning * into v_row;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data,reason)
  values(v_actor,'finance','sepay_receiving_account_version_retired','sepay_receiving_account_version',v_row.id::text,to_jsonb(v_row),trim(p_reason));
  return v_row;
end; $$;

create or replace function public.reissue_tuition_collection_item(p_original_item_id uuid, p_payable_amount_vnd bigint, p_reason text)
returns public.tuition_collection_items language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_original public.tuition_collection_items; v_new public.tuition_collection_items; v_period public.tuition_collection_periods; v_account public.sepay_receiving_account_versions; v_guardian uuid; v_request uuid; v_public text; v_transfer text; v_new_id uuid:=gen_random_uuid(); v_contract jsonb:='{}'::jsonb;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('tuition_periods.adjust') then raise exception 'TUITION_PERIOD_ADJUST_PERMISSION_DENIED'; end if;
 if p_payable_amount_vnd is null or p_payable_amount_vnd<0 or nullif(trim(p_reason),'') is null then raise exception 'TUITION_REISSUE_INPUT_INVALID'; end if;
 select * into v_original from public.tuition_collection_items where id=p_original_item_id for update;
 if not found then raise exception 'TUITION_ITEM_NOT_FOUND'; end if;
 if exists (select 1 from public.tuition_collection_item_adjustments where original_item_id=v_original.id) then raise exception 'TUITION_ITEM_ALREADY_REISSUED'; end if;
 if p_payable_amount_vnd>0 then
   select * into v_period from public.tuition_collection_periods where id=v_original.period_id;
   select * into v_account from public.sepay_receiving_account_versions where purpose='renewal' and status='active' and effective_from<=current_date and coalesce(effective_to,current_date)>=current_date order by effective_from desc limit 1;
   if v_account.id is null then raise exception 'RENEWAL_RECEIVING_ACCOUNT_BLOCKER'; end if;
   select guardian_id into v_guardian from public.student_guardians where student_id=v_original.student_id and is_primary and ended_at is null limit 1;
   if v_guardian is null then raise exception 'STUDENT_PRIMARY_GUARDIAN_NOT_FOUND'; end if;
   v_public:='PAY-'||to_char(now(),'YYMMDD')||'-'||upper(substr(md5(random()::text),1,12)); v_transfer:='TTV '||v_public;
   insert into public.student_payment_requests(public_code,student_id,guardian_id,expected_amount_vnd,purchased_sessions,bonus_sessions,calculated_unit_price_vnd,topup_type,transfer_code,notes,created_by) values(v_public,v_original.student_id,v_guardian,p_payable_amount_vnd,greatest(v_original.payable_sessions,1),0,round(p_payable_amount_vnd::numeric/greatest(v_original.payable_sessions,1))::bigint,'renewal',v_transfer,'Tuition reissue '||v_new_id::text,v_actor) returning id into v_request;
   v_contract:=jsonb_build_object('version',1,'receiving_account_version_id',v_account.id,'purpose','renewal','bank_code',v_account.bank_code,'account_number',v_account.account_number,'account_display_name',v_account.account_display_name,'amount_vnd',p_payable_amount_vnd,'payment_request_id',v_request,'public_code',v_public,'transfer_code',v_transfer,'qr_format','vietqr.app');
 end if;
 insert into public.tuition_collection_items(id,period_id,student_id,enrollment_id,class_id,acquisition_source_id,student_snapshot,source_snapshot,opening_balance_sessions,scheduled_chargeable_sessions,credit_offset_sessions,debit_carry_sessions,payable_sessions,payable_amount_vnd,status,receipt_template_snapshot,receipt_template_version_id,payment_request_id,payment_contract_snapshot,reissued_from_item_id,created_by)
 values(v_new_id,v_original.period_id,v_original.student_id,v_original.enrollment_id,v_original.class_id,v_original.acquisition_source_id,v_original.student_snapshot,v_original.source_snapshot,v_original.opening_balance_sessions,v_original.scheduled_chargeable_sessions,v_original.credit_offset_sessions,v_original.debit_carry_sessions,case when p_payable_amount_vnd=0 then 0 else v_original.payable_sessions end,p_payable_amount_vnd,case when p_payable_amount_vnd=0 then 'no_payment' else 'pending_payment' end,v_original.receipt_template_snapshot,v_original.receipt_template_version_id,v_request,v_contract,v_original.id,v_actor) returning * into v_new;
 insert into public.tuition_collection_item_adjustments(original_item_id,replacement_item_id,reason,created_by) values(v_original.id,v_new.id,trim(p_reason),v_actor);
 insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data,reason) values(v_actor,'finance','tuition_item_reissued','tuition_collection_item',v_new.id::text,to_jsonb(v_new),trim(p_reason));
 return v_new;
end; $$;

-- One canonical calculation source for preview and the lock transaction. A session
-- is materialized by date/enrolment, not inferred from a schedule. Regular sessions
-- are billable unless cancelled; makeup sessions only when their explicit source is cancelled.
create or replace function public.preview_tuition_collection_period(p_period_id uuid)
returns table(student_id uuid, enrollment_id uuid, class_id uuid, class_session_id uuid, session_date date, session_kind text, unit_price_vnd bigint, acquisition_source_id uuid, opening_balance_sessions bigint, blocker_code text)
language sql stable security definer set search_path = '' as $$
  with period as (select * from public.tuition_collection_periods where id=p_period_id), candidates as (
    select e.student_id,e.id enrollment_id,e.class_id,s.id class_session_id,s.session_date,s.session_kind,
      r.unit_price_vnd, coalesce(a.lead_source_id,c.lead_source_id) acquisition_source_id,
      coalesce(b.balance_sessions,0) opening_balance_sessions
    from period p
    join public.class_sessions s on s.session_date between p.starts_on and p.ends_on
    join public.student_enrollments e on e.class_id=s.class_id and e.effective_from <= s.session_date and coalesce(e.effective_to,s.session_date) >= s.session_date
    left join public.class_sessions src on src.id=s.makeup_for_session_id
    left join lateral (select rv.unit_price_vnd from public.student_tuition_rate_versions rv where rv.student_id=e.student_id and rv.effective_from<=s.session_date order by rv.effective_from desc limit 1) r on true
    left join lateral (select x.lead_source_id from public.student_acquisition_source_assignments x where x.student_id=e.student_id and x.is_current order by x.assigned_at desc limit 1) a on true
    left join lateral (select cc.lead_source_id from public.crm_cases cc where cc.student_id=e.student_id order by cc.updated_at desc, cc.created_at desc limit 1) c on true
    left join public.student_session_balances b on b.student_id=e.student_id
    where e.status in ('active','transferred','reserved','completed') and (
      (s.session_kind='regular' and s.status <> 'cancelled') or
      (s.session_kind='makeup' and s.status <> 'cancelled' and src.status='cancelled')
    )
  ) select *, case when unit_price_vnd is null then 'MISSING_EFFECTIVE_TUITION_RATE' when acquisition_source_id is null then 'MISSING_ACQUISITION_SOURCE' else null end from candidates;
$$;

create or replace function public.lock_tuition_collection_period(p_period_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_period public.tuition_collection_periods; v_template jsonb:='{}'::jsonb; v_template_id uuid; v_account public.sepay_receiving_account_versions%rowtype;
  v_student record; v_line record; v_item uuid; v_balance bigint; v_credit integer; v_debit integer; v_payable integer; v_amount bigint; v_sessions integer; v_first_rate bigint; v_request uuid; v_public text; v_transfer text;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('tuition_periods.lock') then raise exception 'TUITION_PERIOD_LOCK_PERMISSION_DENIED'; end if;
  select * into v_period from public.tuition_collection_periods where id=p_period_id for update;
  if not found then raise exception 'TUITION_PERIOD_NOT_FOUND'; end if;
  if v_period.status='locked' then return jsonb_build_object('period_id',v_period.id,'status','locked','idempotent',true); end if;
  if exists(select 1 from public.preview_tuition_collection_period(p_period_id) where blocker_code is not null) then raise exception 'TUITION_PERIOD_BLOCKERS'; end if;
  select * into v_account from public.sepay_receiving_account_versions
  where purpose='renewal' and status='active' and effective_from <= v_period.ends_on and coalesce(effective_to,v_period.ends_on) >= v_period.ends_on
  order by effective_from desc limit 1;
  if v_account.id is null or exists(select 1 from public.sepay_receiving_account_versions where purpose='renewal' and status='active' and effective_from <= v_period.ends_on and coalesce(effective_to,v_period.ends_on) >= v_period.ends_on and id<>v_account.id) then raise exception 'RENEWAL_RECEIVING_ACCOUNT_BLOCKER'; end if;
  select tv.id,tv.content into v_template_id,v_template from public.tuition_receipt_template_versions tv where tv.id=coalesce(v_period.receipt_template_version_id,(select id from public.tuition_receipt_template_versions order by published_at desc limit 1));
  if v_template_id is null then raise exception 'RECEIPT_TEMPLATE_REQUIRED'; end if;
  for v_student in select student_id,(array_agg(enrollment_id order by session_date))[1] enrollment_id,(array_agg(class_id order by session_date))[1] class_id,(array_agg(acquisition_source_id order by session_date))[1] source_id,min(opening_balance_sessions) balance from public.preview_tuition_collection_period(p_period_id) group by student_id loop
    v_balance:=v_student.balance; v_credit:=greatest(v_balance,0)::integer; v_debit:=greatest(-v_balance,0)::integer; v_payable:=0; v_amount:=0; v_sessions:=0; v_first_rate:=null;
    insert into public.tuition_collection_items(period_id,student_id,enrollment_id,class_id,acquisition_source_id,student_snapshot,source_snapshot,opening_balance_sessions,scheduled_chargeable_sessions,credit_offset_sessions,debit_carry_sessions,payable_sessions,payable_amount_vnd,status,receipt_template_snapshot,receipt_template_version_id,created_by)
    select p_period_id,v_student.student_id,v_student.enrollment_id,v_student.class_id,v_student.source_id,jsonb_build_object('student_id',s.id,'full_name',s.full_name,'public_code',s.public_code,'current_grade',s.current_grade,'class_id',c.id,'class_name',c.name,'class_code',c.code,'class_grade',c.grade),jsonb_build_object('source_id',ls.id,'code',ls.code,'name',ls.name),v_balance,0,0,v_debit,0,0,'no_payment',v_template,v_template_id,v_actor from public.students s join public.classes c on c.id=v_student.class_id join public.crm_lead_sources ls on ls.id=v_student.source_id where s.id=v_student.student_id returning id into v_item;
    for v_line in select * from public.preview_tuition_collection_period(p_period_id) where student_id=v_student.student_id order by session_date,class_session_id loop
      v_sessions:=v_sessions+1; v_first_rate:=coalesce(v_first_rate,v_line.unit_price_vnd);
      if v_credit>0 then v_credit:=v_credit-1; else v_payable:=v_payable+1; v_amount:=v_amount+v_line.unit_price_vnd; end if;
      insert into public.tuition_collection_item_lines(item_id,class_session_id,line_kind,session_date,session_kind,unit_price_vnd,session_count,payable_session_count,amount_vnd,snapshot)
      values(v_item,v_line.class_session_id,'session',v_line.session_date,v_line.session_kind,v_line.unit_price_vnd,1,case when v_sessions <= greatest(v_balance,0) then 0 else 1 end,case when v_sessions <= greatest(v_balance,0) then 0 else v_line.unit_price_vnd end,jsonb_build_object('session_id',v_line.class_session_id,'session_date',v_line.session_date,'session_kind',v_line.session_kind,'rate_vnd',v_line.unit_price_vnd));
    end loop;
    if v_debit>0 then v_payable:=v_payable+v_debit; v_amount:=v_amount+(v_debit*v_first_rate); insert into public.tuition_collection_item_lines(item_id,line_kind,unit_price_vnd,session_count,payable_session_count,amount_vnd,snapshot) values(v_item,'opening_debit',v_first_rate,v_debit,v_debit,v_debit*v_first_rate,jsonb_build_object('reason','opening_negative_session_balance')) ; end if;
    update public.tuition_collection_items set scheduled_chargeable_sessions=v_sessions,credit_offset_sessions=greatest(v_balance,0)::integer,payable_sessions=v_payable,payable_amount_vnd=v_amount,status=case when v_amount=0 then 'no_payment' else 'pending_payment' end where id=v_item;
    if v_amount>0 then
      select guardian_id into strict v_request from public.student_guardians where student_id=v_student.student_id and is_primary and ended_at is null limit 1;
      v_public:='PAY-'||to_char(now(),'YYMMDD')||'-'||upper(substr(md5(random()::text),1,12)); v_transfer:='TTV '||v_public;
      insert into public.student_payment_requests(public_code,student_id,guardian_id,expected_amount_vnd,purchased_sessions,bonus_sessions,calculated_unit_price_vnd,topup_type,transfer_code,notes,created_by)
      values(v_public,v_student.student_id,v_request,v_amount,v_payable,0,round(v_amount::numeric/v_payable)::bigint,'renewal',v_transfer,'Tuition collection item '||v_item::text,v_actor) returning id into v_request;
      update public.tuition_collection_items set payment_request_id=v_request, payment_contract_snapshot=jsonb_build_object('version',1,'receiving_account_version_id',v_account.id,'purpose','renewal','bank_code',v_account.bank_code,'account_number',v_account.account_number,'account_display_name',v_account.account_display_name,'amount_vnd',v_amount,'payment_request_id',v_request,'public_code',v_public,'transfer_code',v_transfer,'qr_format','vietqr.app') where id=v_item;
      insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data) values(v_actor,'finance','tuition_payment_request_created','student_payment_request',v_request::text,jsonb_build_object('tuition_collection_item_id',v_item,'purpose','renewal','amount_vnd',v_amount,'transfer_code',v_transfer));
    end if;
  end loop;
  update public.tuition_collection_periods set status='locked',locked_by=v_actor,locked_at=now(),receipt_template_version_id=v_template_id where id=p_period_id;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data) values(v_actor,'finance','tuition_period_locked','tuition_collection_period',p_period_id::text,jsonb_build_object('template_version_id',v_template_id));
  return jsonb_build_object('period_id',p_period_id,'status','locked','idempotent',false);
end; $$;

create or replace function public.prevent_tuition_item_snapshot_mutation() returns trigger language plpgsql set search_path='' as $$ begin
  if exists (select 1 from public.tuition_collection_periods where id=old.period_id and status='locked') then raise exception 'TUITION_SNAPSHOT_IMMUTABLE'; end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
create or replace function public.prevent_tuition_item_line_snapshot_mutation() returns trigger language plpgsql set search_path='' as $$ begin
  if exists (select 1 from public.tuition_collection_items i join public.tuition_collection_periods p on p.id=i.period_id where i.id=old.item_id and p.status='locked') then raise exception 'TUITION_SNAPSHOT_IMMUTABLE'; end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger tuition_collection_items_immutable before update or delete on public.tuition_collection_items for each row execute function public.prevent_tuition_item_snapshot_mutation();
create trigger tuition_collection_item_lines_immutable before update or delete on public.tuition_collection_item_lines for each row execute function public.prevent_tuition_item_line_snapshot_mutation();

alter table public.student_tuition_rate_versions enable row level security;
alter table public.student_acquisition_source_assignments enable row level security;
alter table public.tuition_receipt_templates enable row level security;
alter table public.sepay_receiving_account_versions enable row level security;
alter table public.tuition_receipt_template_versions enable row level security;
alter table public.tuition_collection_periods enable row level security;
alter table public.tuition_collection_items enable row level security;
alter table public.tuition_collection_item_lines enable row level security;
alter table public.tuition_collection_item_adjustments enable row level security;
create policy student_tuition_rates_select on public.student_tuition_rate_versions for select to authenticated using (public.has_permission('students.view') or public.has_permission('students.manage_tuition_rates'));
create policy student_source_assignments_select on public.student_acquisition_source_assignments for select to authenticated using (public.has_permission('students.view') or public.has_permission('students.correct_acquisition_source'));
create policy tuition_templates_select on public.tuition_receipt_templates for select to authenticated using (public.has_permission('tuition_periods.view') or public.has_permission('settings.receipts.manage'));
create policy sepay_receiving_account_versions_select on public.sepay_receiving_account_versions for select to authenticated using (public.has_permission('tuition_periods.view') or public.has_permission('sepay.view') or public.has_permission('settings.sepay_receiving_accounts.manage'));
create policy tuition_template_versions_select on public.tuition_receipt_template_versions for select to authenticated using (public.has_permission('tuition_periods.view') or public.has_permission('settings.receipts.manage'));
create policy tuition_periods_select on public.tuition_collection_periods for select to authenticated using (public.has_permission('tuition_periods.view'));
create policy tuition_items_select on public.tuition_collection_items for select to authenticated using (public.has_permission('tuition_periods.view'));
create policy tuition_item_lines_select on public.tuition_collection_item_lines for select to authenticated using (public.has_permission('tuition_periods.view'));
create policy tuition_item_adjustments_select on public.tuition_collection_item_adjustments for select to authenticated using (public.has_permission('tuition_periods.view'));

revoke all on function public.create_student_tuition_rate_version(uuid,date,bigint,text), public.correct_student_acquisition_source(uuid,uuid,text), public.create_tuition_collection_period(text,date,date,date,uuid), public.publish_tuition_receipt_template_version(text,text,jsonb,text), public.create_sepay_receiving_account_version(text,text,text,text,date,text), public.retire_sepay_receiving_account_version(uuid,date,text), public.get_effective_sepay_receiving_account(text,date), public.resolve_sepay_receiving_account(text,timestamptz), public.reissue_tuition_collection_item(uuid,bigint,text), public.preview_tuition_collection_period(uuid), public.lock_tuition_collection_period(uuid) from public, anon;
revoke all on function public.resolve_sepay_receiving_account(text,timestamptz) from authenticated;
grant execute on function public.create_student_tuition_rate_version(uuid,date,bigint,text), public.correct_student_acquisition_source(uuid,uuid,text), public.create_tuition_collection_period(text,date,date,date,uuid), public.publish_tuition_receipt_template_version(text,text,jsonb,text), public.create_sepay_receiving_account_version(text,text,text,text,date,text), public.retire_sepay_receiving_account_version(uuid,date,text), public.get_effective_sepay_receiving_account(text,date), public.reissue_tuition_collection_item(uuid,bigint,text), public.preview_tuition_collection_period(uuid), public.lock_tuition_collection_period(uuid) to authenticated;
grant execute on function public.resolve_sepay_receiving_account(text,timestamptz) to service_role;
commit;
