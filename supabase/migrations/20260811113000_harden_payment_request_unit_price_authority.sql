begin;

-- Keep the legacy optional parameter for RPC-call compatibility, but never
-- accept it as accounting input. The stored price is derived only from the
-- request amount and purchased-session facts that this function validates.
create or replace function public.create_student_payment_request(
  p_student_id uuid,
  p_expected_amount_vnd bigint,
  p_purchased_sessions integer,
  p_bonus_sessions integer default 0,
  p_calculated_unit_price_vnd bigint default 0,
  p_topup_type text default 'new',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_student public.students%rowtype;
  v_guardian_id uuid;
  v_public_code text;
  v_transfer_code text;
  v_request_id uuid;
  v_unit_price bigint;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED: Vui long dang nhap.';
  end if;

  if not (
    public.has_permission('payments.create_request')
    or public.has_permission('payments.manage')
  ) then
    raise exception 'PAYMENTS_CREATE_REQUEST_PERMISSION_DENIED: Khong co quyen tao yeu cau nap tien.';
  end if;

  if p_student_id is null then
    raise exception 'STUDENT_ID_REQUIRED: Thieu ma hoc vien.';
  end if;

  select *
  into v_student
  from public.students
  where id = p_student_id;

  if not found then
    raise exception 'STUDENT_NOT_FOUND: Hoc vien khong ton tai.';
  end if;

  select link.guardian_id
  into v_guardian_id
  from public.student_guardians as link
  where link.student_id = p_student_id
    and link.is_primary
    and link.ended_at is null;

  if v_guardian_id is null then
    raise exception 'STUDENT_PRIMARY_GUARDIAN_NOT_FOUND: Hoc vien chua co phu huynh chinh dang hoat dong.';
  end if;

  if p_expected_amount_vnd is null or p_expected_amount_vnd <= 0 then
    raise exception 'INVALID_EXPECTED_AMOUNT: So tien du kien nap phai lon hon 0.';
  end if;

  if p_purchased_sessions is null or p_purchased_sessions <= 0 then
    raise exception 'INVALID_PURCHASED_SESSIONS: So buoi mua phai lon hon 0.';
  end if;

  if coalesce(p_bonus_sessions, 0) < 0 then
    raise exception 'INVALID_BONUS_SESSIONS: So buoi tang khong duoc am.';
  end if;

  if coalesce(p_topup_type, 'new') not in ('new', 'renewal') then
    raise exception 'INVALID_TOPUP_TYPE: Loai nap khong hop le.';
  end if;

  -- JavaScript's existing positive Math.round(amount / sessions) behavior is
  -- reproduced with PostgreSQL numeric rounding. The legacy caller argument is
  -- deliberately ignored.
  v_unit_price := pg_catalog.round(
    p_expected_amount_vnd::numeric / p_purchased_sessions::numeric
  )::bigint;

  if v_unit_price <= 0 then
    raise exception 'INVALID_UNIT_PRICE: Don gia phai lon hon 0.';
  end if;

  v_public_code := 'PAY-'
    || pg_catalog.to_char(pg_catalog.now(), 'YYMMDD')
    || '-'
    || pg_catalog.upper(
      pg_catalog.substr(
        pg_catalog.md5(pg_catalog.random()::text),
        1,
        12
      )
    );
  v_transfer_code := 'TTV ' || v_public_code;

  insert into public.student_payment_requests (
    public_code,
    student_id,
    guardian_id,
    expected_amount_vnd,
    purchased_sessions,
    bonus_sessions,
    calculated_unit_price_vnd,
    topup_type,
    transfer_code,
    notes,
    created_by
  )
  values (
    v_public_code,
    p_student_id,
    v_guardian_id,
    p_expected_amount_vnd,
    p_purchased_sessions,
    coalesce(p_bonus_sessions, 0),
    v_unit_price,
    coalesce(p_topup_type, 'new'),
    v_transfer_code,
    p_notes,
    v_actor_id
  )
  returning id into v_request_id;

  return pg_catalog.jsonb_build_object(
    'id', v_request_id,
    'public_code', v_public_code,
    'transfer_code', v_transfer_code,
    'expected_amount_vnd', p_expected_amount_vnd,
    'purchased_sessions', p_purchased_sessions,
    'bonus_sessions', coalesce(p_bonus_sessions, 0),
    'status', 'pending'
  );
end;
$$;

revoke all on function public.create_student_payment_request(
  uuid,
  bigint,
  integer,
  integer,
  bigint,
  text,
  text
) from public, anon;
grant execute on function public.create_student_payment_request(
  uuid,
  bigint,
  integer,
  integer,
  bigint,
  text,
  text
) to authenticated;

commit;
