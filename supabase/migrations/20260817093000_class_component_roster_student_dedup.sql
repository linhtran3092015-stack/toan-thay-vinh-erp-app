begin;

create or replace function public.resolve_class_session_rosters(p_class_session_ids uuid[])
returns table (class_session_id uuid, student_id uuid, student_enrollment_id uuid, enrollment_class_id uuid, session_class_id uuid, registered_mode text)
language sql stable security definer set search_path = '' as $$
  select distinct on (session_row.id, enrollment.student_id)
    session_row.id,
    enrollment.student_id,
    enrollment.id,
    enrollment.class_id,
    session_row.class_id,
    enrollment.registered_mode
  from public.class_sessions session_row
  join public.student_enrollments enrollment on enrollment.status = 'active'
    and enrollment.effective_from <= session_row.session_date
    and (enrollment.effective_to is null or enrollment.effective_to >= session_row.session_date)
  left join public.class_component_links link on link.parent_class_id = enrollment.class_id
    and link.component_class_id = session_row.class_id
    and link.effective_from <= session_row.session_date
    and (link.effective_to is null or link.effective_to >= session_row.session_date)
  where session_row.id = any(p_class_session_ids)
    and (enrollment.class_id = session_row.class_id or link.id is not null)
  order by
    session_row.id,
    enrollment.student_id,
    case when enrollment.class_id = session_row.class_id then 0 else 1 end,
    enrollment.effective_from desc,
    enrollment.created_at desc,
    link.component_order nulls first,
    enrollment.id;
$$;

revoke all on function public.resolve_class_session_rosters(uuid[]) from public, anon, authenticated;

commit;
