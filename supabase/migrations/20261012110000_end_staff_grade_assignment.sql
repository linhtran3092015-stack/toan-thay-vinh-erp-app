-- Thu hồi phân công khối phụ trách (trợ lý vận hành).
--
-- Trước đây chỉ có create_staff_grade_assignment; muốn bỏ một khối khỏi nhân
-- sự phải tạo phân công mới cho người khác (khối tự đóng) hoặc không có cách
-- nào. RPC này đóng phân công đang mở tại ngày chọn, giữ nguyên lịch sử
-- (trigger bất biến chỉ cho phép đặt effective_to qua GUC
-- app.payroll_grade_transfer) và ghi audit kèm lý do. Ngày kết thúc không
-- được rơi vào tháng lương đã chốt.

begin;

create or replace function public.end_staff_grade_assignment(
  p_assignment_id uuid,
  p_effective_to date,
  p_reason text
)
returns public.staff_grade_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  assignment public.staff_grade_assignments%rowtype;
  updated_row public.staff_grade_assignments%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('staff.manage_payroll_profile') then
    raise exception using errcode = '42501', message = 'STAFF_PAYROLL_PROFILE_PERMISSION_REQUIRED';
  end if;
  if p_effective_to is null then
    raise exception using errcode = '22023', message = 'STAFF_GRADE_ASSIGNMENT_DATES_INVALID';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'STAFF_GRADE_ASSIGNMENT_REASON_REQUIRED';
  end if;

  select * into assignment
  from public.staff_grade_assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'STAFF_GRADE_ASSIGNMENT_NOT_FOUND';
  end if;
  if assignment.staff_id = actor_id then
    raise exception using errcode = '42501', message = 'STAFF_GRADE_ASSIGNMENT_SELF_CHANGE_FORBIDDEN';
  end if;
  if assignment.effective_to is not null then
    raise exception using errcode = '23514', message = 'STAFF_GRADE_ASSIGNMENT_ALREADY_ENDED';
  end if;
  if p_effective_to < assignment.effective_from then
    raise exception using errcode = '22023', message = 'STAFF_GRADE_ASSIGNMENT_DATES_INVALID';
  end if;

  -- The grade is unassigned from the day after the end date; that day must not
  -- belong to a payroll month that is already in review or approved.
  perform public.assert_payroll_configuration_date_allowed(p_effective_to + 1);

  perform pg_catalog.set_config('app.payroll_grade_transfer', 'on', true);
  update public.staff_grade_assignments
  set effective_to = p_effective_to
  where id = assignment.id
  returning * into updated_row;
  perform pg_catalog.set_config('app.payroll_grade_transfer', 'off', true);

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    metadata
  )
  values (
    actor_id,
    'payroll',
    'staff_grade_assignment_ended',
    'staff_grade_assignment',
    assignment.id::text,
    pg_catalog.jsonb_build_object(
      'staff_id', assignment.staff_id,
      'grade', assignment.grade,
      'effective_from', assignment.effective_from,
      'effective_to', null
    ),
    pg_catalog.jsonb_build_object(
      'staff_id', assignment.staff_id,
      'grade', assignment.grade,
      'effective_from', assignment.effective_from,
      'effective_to', p_effective_to
    ),
    normalized_reason,
    pg_catalog.jsonb_build_object('source', 'staff_profile')
  );

  return updated_row;
end;
$$;

revoke all on function public.end_staff_grade_assignment(uuid, date, text)
from public, anon;
grant execute on function public.end_staff_grade_assignment(uuid, date, text)
to authenticated;

commit;
