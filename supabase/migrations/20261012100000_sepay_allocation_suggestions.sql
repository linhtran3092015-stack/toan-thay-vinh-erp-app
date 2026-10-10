-- Gợi ý khớp giao dịch SePay chưa phân bổ với học sinh.
--
-- Phụ huynh thường chuyển khoản tự do ("Pham Khanh Phu 2013 0912...") thay vì
-- theo mã phiếu, nên phần lớn giao dịch rơi vào `unmatched` và kế toán phải
-- tra tay từng món. RPC này đọc nội dung chuyển khoản, chuẩn hóa như
-- normalize_payment_reference, rồi đối chiếu với tên học sinh, năm sinh, mã
-- học sinh và số điện thoại phụ huynh chính:
--   high   = tên + năm sinh, hoặc mã học sinh, hoặc số điện thoại phụ huynh
--   medium = chỉ khớp tên
-- Kèm đơn giá buổi hiện hành và số buổi gợi ý; kế toán vẫn tự quyết số buổi
-- (quyết định chủ trung tâm 11/10/2026) và xác nhận từng dòng qua
-- allocate_sepay_tuition_manually. Chỉ đọc, không ghi gì.

begin;

create or replace function public.suggest_sepay_allocation_matches(p_limit integer default 300)
returns table (
  transaction_id uuid,
  transaction_at timestamptz,
  amount_vnd bigint,
  transfer_content text,
  account_purpose text,
  match_status text,
  student_id uuid,
  student_name text,
  student_code text,
  birth_year smallint,
  current_grade smallint,
  guardian_name text,
  guardian_phone text,
  unit_price_vnd bigint,
  suggested_sessions integer,
  pending_request_id uuid,
  confidence text,
  match_reasons text[],
  candidate_rank integer,
  candidate_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not (public.has_permission('sepay.allocate') or public.has_permission('payments.manage')) then
    raise exception using errcode = '42501', message = 'SEPAY_ALLOCATE_PERMISSION_DENIED';
  end if;

  return query
  with open_tx as (
    select
      t.id,
      t.transaction_at,
      t.amount_vnd,
      t.transfer_content,
      t.account_purpose,
      t.match_status,
      (t.transaction_at at time zone 'Asia/Ho_Chi_Minh')::date as business_date,
      public.normalize_payment_reference(coalesce(t.transfer_content, '')) as content_norm,
      coalesce(array(
        select m[1] from pg_catalog.regexp_matches(coalesce(t.transfer_content, ''), '(20[0-2][0-9])', 'g') as m
      ), '{}'::text[]) as years,
      coalesce(array(
        select public.normalize_vietnam_phone(m[1])
        from pg_catalog.regexp_matches(pg_catalog.regexp_replace(coalesce(t.transfer_content, ''), '[^0-9]+', ' ', 'g'), '(0[0-9]{9,10}|84[0-9]{9,10})', 'g') as m
      ), '{}'::text[]) as phones
    from public.sepay_transactions as t
    where t.transfer_type = 'in'
      and t.match_status in ('unmatched', 'amount_mismatch', 'account_purpose_mismatch')
      and t.account_purpose in ('new_enrollment', 'renewal')
      and t.amount_vnd > 0
      and not exists (select 1 from public.finance_cashflow_records c where c.sepay_transaction_id = t.id)
      and not exists (select 1 from public.student_credit_lots l where l.sepay_transaction_id = t.id)
      and not exists (select 1 from public.payment_split_allocations a where a.sepay_transaction_id = t.id)
    order by t.transaction_at desc
    limit greatest(1, least(coalesce(p_limit, 300), 1000))
  ),
  eligible_students as (
    select
      s.id,
      s.full_name,
      s.public_code,
      s.birth_year,
      s.current_grade,
      g.full_name as guardian_name,
      g.phone as guardian_phone,
      g.normalized_phone as guardian_phone_norm,
      public.normalize_payment_reference(s.full_name) as name_norm,
      case when s.nickname is not null then public.normalize_payment_reference(s.nickname) end as nickname_norm,
      pg_catalog.upper(s.public_code) as code_upper
    from public.students as s
    join public.student_guardians as sg on sg.student_id = s.id and sg.is_primary and sg.ended_at is null
    join public.guardians as g on g.id = sg.guardian_id
    where s.lifecycle_status = 'active'
  ),
  scored as (
    select
      tx.id as transaction_id,
      st.id as student_id,
      (pg_catalog.length(st.name_norm) >= 6 and pg_catalog.strpos(tx.content_norm, st.name_norm) > 0) as name_hit,
      (st.nickname_norm is not null and pg_catalog.length(st.nickname_norm) >= 6 and pg_catalog.strpos(tx.content_norm, st.nickname_norm) > 0) as nickname_hit,
      (st.birth_year::text = any(tx.years)) as year_hit,
      (st.guardian_phone_norm = any(tx.phones)) as phone_hit,
      (pg_catalog.strpos(tx.content_norm, pg_catalog.regexp_replace(st.code_upper, '[^A-Z0-9]', '', 'g')) > 0) as code_hit,
      pg_catalog.length(st.name_norm) as name_length
    from open_tx as tx
    cross join eligible_students as st
  ),
  ranked as (
    select
      sc.*,
      case
        when sc.code_hit or sc.phone_hit or ((sc.name_hit or sc.nickname_hit) and sc.year_hit) then 'high'
        when sc.name_hit or sc.nickname_hit then 'medium'
      end as confidence,
      pg_catalog.array_remove(array[
        case when sc.code_hit then 'student_code' end,
        case when sc.phone_hit then 'guardian_phone' end,
        case when sc.name_hit then 'student_name' end,
        case when sc.nickname_hit then 'student_nickname' end,
        case when sc.year_hit then 'birth_year' end
      ], null) as reasons
    from scored as sc
    where sc.code_hit or sc.phone_hit or sc.name_hit or sc.nickname_hit
  ),
  numbered as (
    select
      r.*,
      pg_catalog.row_number() over (
        partition by r.transaction_id
        order by case r.confidence when 'high' then 0 else 1 end, r.name_length desc, r.student_id
      )::integer as candidate_rank,
      pg_catalog.count(*) over (partition by r.transaction_id)::integer as candidate_count
    from ranked as r
  )
  select
    tx.id,
    tx.transaction_at,
    tx.amount_vnd,
    tx.transfer_content,
    tx.account_purpose,
    tx.match_status,
    st.id,
    st.full_name,
    st.public_code,
    st.birth_year,
    st.current_grade,
    st.guardian_name,
    st.guardian_phone,
    rate.unit_price_vnd,
    case
      when rate.unit_price_vnd is null or rate.unit_price_vnd <= 0 then null
      else greatest(1, (tx.amount_vnd / rate.unit_price_vnd))::integer
    end,
    pending.request_id,
    n.confidence,
    n.reasons,
    n.candidate_rank,
    n.candidate_count
  from numbered as n
  join open_tx as tx on tx.id = n.transaction_id
  join eligible_students as st on st.id = n.student_id
  left join lateral (
    select v.unit_price_vnd
    from public.student_tuition_rate_versions as v
    where v.student_id = st.id and v.effective_from <= tx.business_date
    order by v.effective_from desc
    limit 1
  ) as rate on true
  left join lateral (
    select
      case when pg_catalog.count(*) = 1 then pg_catalog.min(r.id::text)::uuid end as request_id
    from public.student_payment_requests as r
    where r.student_id = st.id
      and r.status in ('pending', 'partially_paid')
      and r.expected_amount_vnd = tx.amount_vnd
  ) as pending on true
  where n.candidate_rank <= 3
  order by tx.transaction_at desc, n.candidate_rank;
end;
$$;

revoke all on function public.suggest_sepay_allocation_matches(integer)
from public, anon, authenticated;
grant execute on function public.suggest_sepay_allocation_matches(integer)
to authenticated;

commit;
