-- Tạm ứng lương: không được tự đối soát / tự duyệt yêu cầu của chính mình.
--
-- review_salary_advance và approve_salary_advance chỉ kiểm tra quyền, nên kế
-- toán có thể đối soát tạm ứng của mình và chủ trung tâm có thể duyệt tạm ứng
-- của mình. Nay áp dụng cùng nguyên tắc với duyệt chấm công: người ra quyết
-- định phải khác người nhận tạm ứng. Nội dung còn lại giữ nguyên.

begin;

create or replace function public.review_salary_advance(
  p_salary_advance_id uuid,
  p_decision text,
  p_note text
)
returns public.salary_advances
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(p_decision));
  normalized_note text := nullif(pg_catalog.btrim(p_note), '');
  target_staff_id uuid;
  updated_advance public.salary_advances%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('advances.review') then
    raise exception using errcode = '42501', message = 'ADVANCES_REVIEW_PERMISSION_REQUIRED';
  end if;

  if normalized_decision not in ('review', 'rejected') then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_REVIEW_DECISION_INVALID';
  end if;

  if normalized_decision = 'rejected' and normalized_note is null then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_REJECTION_REASON_REQUIRED';
  end if;

  if normalized_note is not null and pg_catalog.length(normalized_note) > 2000 then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_REVIEW_NOTE_INVALID';
  end if;

  select staff_id into target_staff_id
  from public.salary_advances
  where id = p_salary_advance_id
  for update;

  if target_staff_id = actor_id then
    raise exception using errcode = '42501', message = 'SALARY_ADVANCE_SELF_DECISION_FORBIDDEN';
  end if;

  if normalized_decision = 'review' then
    update public.salary_advances
    set status = 'review', reviewed_by = actor_id, reviewed_at = pg_catalog.now(), review_note = normalized_note
    where id = p_salary_advance_id and status = 'requested'
    returning * into updated_advance;
  else
    update public.salary_advances
    set status = 'rejected', rejected_by = actor_id, rejected_at = pg_catalog.now(), rejection_reason = normalized_note
    where id = p_salary_advance_id and status = 'requested'
    returning * into updated_advance;
  end if;

  if not found then
    raise exception using errcode = '23514', message = 'SALARY_ADVANCE_NOT_REQUESTED';
  end if;

  return updated_advance;
end;
$$;

create or replace function public.approve_salary_advance(
  p_salary_advance_id uuid,
  p_decision text,
  p_note text
)
returns public.salary_advances
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(p_decision));
  normalized_note text := nullif(pg_catalog.btrim(p_note), '');
  target_staff_id uuid;
  updated_advance public.salary_advances%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('advances.owner_approve') then
    raise exception using errcode = '42501', message = 'ADVANCES_OWNER_APPROVE_PERMISSION_REQUIRED';
  end if;

  if normalized_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_APPROVAL_DECISION_INVALID';
  end if;

  if normalized_decision = 'rejected' and normalized_note is null then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_REJECTION_REASON_REQUIRED';
  end if;

  if normalized_note is not null and pg_catalog.length(normalized_note) > 2000 then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_APPROVAL_NOTE_INVALID';
  end if;

  select staff_id into target_staff_id
  from public.salary_advances
  where id = p_salary_advance_id
  for update;

  if target_staff_id = actor_id then
    raise exception using errcode = '42501', message = 'SALARY_ADVANCE_SELF_DECISION_FORBIDDEN';
  end if;

  if normalized_decision = 'approved' then
    update public.salary_advances
    set status = 'approved', approved_by = actor_id, approved_at = pg_catalog.now(), approval_note = normalized_note
    where id = p_salary_advance_id and status = 'review'
    returning * into updated_advance;
  else
    update public.salary_advances
    set status = 'rejected', rejected_by = actor_id, rejected_at = pg_catalog.now(), rejection_reason = normalized_note
    where id = p_salary_advance_id and status = 'review'
    returning * into updated_advance;
  end if;

  if not found then
    raise exception using errcode = '23514', message = 'SALARY_ADVANCE_NOT_REVIEWED';
  end if;

  return updated_advance;
end;
$$;

revoke all on function public.review_salary_advance(uuid, text, text) from public, anon;
revoke all on function public.approve_salary_advance(uuid, text, text) from public, anon;
grant execute on function public.review_salary_advance(uuid, text, text) to authenticated;
grant execute on function public.approve_salary_advance(uuid, text, text) to authenticated;

commit;
