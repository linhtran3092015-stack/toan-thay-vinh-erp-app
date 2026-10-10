-- Sửa chia lead tự động và quyền CRM cho chuyên viên tuyển sinh.
--
-- create_crm_case xoay vòng lead cho role 'consultant' — role này không
-- tồn tại (vai trò thực tế là 'admissions_specialist'), nên mọi lead tự
-- động đều dồn về 'admissions_leader'. Đồng thời cấp quyền CRM cho
-- admissions_specialist và admissions_manager, vốn bị bỏ sót khi seed.
-- Nội dung hàm giữ nguyên so với 20260806103000, chỉ đổi mã role.

begin;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where p.code in ('crm.view', 'crm.update', 'crm.transfer', 'students.confirm_official')
  and r.code in ('admissions_specialist', 'admissions_manager')
on conflict (role_id, permission_id) do nothing;

create or replace function public.create_crm_case(
  p_full_name text,
  p_birth_year integer,
  p_expected_grade integer,
  p_guardian_phone text,
  p_guardian_full_name text,
  p_lead_source_code text,
  p_sale_owner_id uuid default null,
  p_expected_level text default null,
  p_expected_mode text default null,
  p_expected_tuition_fee_vnd bigint default null,
  p_discount_notes text default null,
  p_province_city text default null,
  p_notes text default null
)
returns public.crm_cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_full_name text := nullif(pg_catalog.btrim(coalesce(p_full_name, '')), '');
  normalized_guardian_phone text := nullif(
    public.normalize_vietnam_phone(
      pg_catalog.btrim(coalesce(p_guardian_phone, ''))
    ),
    ''
  );
  normalized_guardian_name text := nullif(pg_catalog.btrim(coalesce(p_guardian_full_name, '')), '');
  source_row public.crm_lead_sources%rowtype;
  guardian_row public.guardians%rowtype;
  assigned_sale_id uuid := p_sale_owner_id;
  generated_code text;
  new_case public.crm_cases%rowtype;
  assign_method text;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.has_permission('crm.update') then
    raise exception using errcode = '42501', message = 'CRM_UPDATE_PERMISSION_DENIED';
  end if;

  if normalized_full_name is null then
    raise exception using errcode = '22023', message = 'STUDENT_FULL_NAME_REQUIRED';
  end if;

  if normalized_guardian_phone is null then
    raise exception using errcode = '22023', message = 'GUARDIAN_PHONE_REQUIRED';
  end if;

  if normalized_guardian_phone !~ '^0[0-9]{9,10}$' then
    raise exception using errcode = '22023', message = 'GUARDIAN_PHONE_INVALID';
  end if;

  if normalized_guardian_name is null then
    raise exception using errcode = '22023', message = 'GUARDIAN_FULL_NAME_REQUIRED';
  end if;

  select * into source_row
  from public.crm_lead_sources
  where code = p_lead_source_code and is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'INVALID_LEAD_SOURCE_CODE';
  end if;

  if assigned_sale_id is null then
    select profile.id into assigned_sale_id
    from public.profiles as profile
    join public.user_role_assignments as assignment
      on assignment.user_id = profile.id
      and assignment.revoked_at is null
    join public.roles as role
      on role.id = assignment.role_id
      and role.is_active = true
    where role.code in ('admissions_specialist', 'admissions_leader')
      and profile.employment_status = 'active'
    order by (
      select count(*)
      from public.crm_cases as crm_case
      where crm_case.sale_owner_id = profile.id
        and crm_case.created_at >= current_date
    ) asc, profile.created_at asc
    limit 1;

    assign_method := 'auto_round_robin';
  else
    assign_method := 'manual_assign';
  end if;

  if assigned_sale_id is null then
    assigned_sale_id := actor_id;
  end if;

  select * into guardian_row
  from public.guardians
  where normalized_phone = normalized_guardian_phone
  limit 1;

  if not found then
    insert into public.guardians (
      full_name,
      phone,
      created_by
    )
    values (
      normalized_guardian_name,
      normalized_guardian_phone,
      actor_id
    )
    returning * into guardian_row;
  end if;

  generated_code := 'CRM-' || pg_catalog.to_char(pg_catalog.now(), 'YYMMDD') || '-' || pg_catalog.substr(md5(random()::text), 1, 4);

  insert into public.crm_cases (
    public_code,
    full_name,
    birth_year,
    expected_grade,
    expected_level,
    expected_mode,
    expected_tuition_fee_vnd,
    discount_notes,
    province_city,
    guardian_id,
    guardian_phone,
    guardian_full_name,
    lead_source_id,
    sale_owner_id,
    status,
    notes,
    created_by
  )
  values (
    generated_code,
    normalized_full_name,
    p_birth_year,
    p_expected_grade,
    p_expected_level,
    p_expected_mode,
    p_expected_tuition_fee_vnd,
    p_discount_notes,
    p_province_city,
    guardian_row.id,
    normalized_guardian_phone,
    normalized_guardian_name,
    source_row.id,
    assigned_sale_id,
    'interested',
    p_notes,
    actor_id
  )
  returning * into new_case;

  insert into public.crm_lead_assignment_history (
    crm_case_id,
    previous_sale_owner_id,
    new_sale_owner_id,
    assignment_method,
    reason,
    assigned_by
  )
  values (
    new_case.id,
    null,
    assigned_sale_id,
    assign_method,
    'Tạo lead mới và phân công ban đầu',
    actor_id
  );

  insert into public.student_enrollment_checklists (crm_case_id)
  values (new_case.id);

  return new_case;
end;
$$;

commit;
