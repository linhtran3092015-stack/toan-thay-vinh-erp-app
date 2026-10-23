-- The coaching dialog must list every student (723 on 2026-10-21). The old
-- 500-row ceiling, taken in full_name order, dropped students whose family
-- name sorts late. The app pages through PostgREST's max_rows with range()
-- and sorts by given name itself; id makes the page order total.
begin;

create or replace function public.get_coaching_student_options(
  p_limit integer default 500
)
returns table (
  student_id uuid,
  student_public_code text,
  student_full_name text,
  lifecycle_status text
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

  if not public.has_permission('coaching.manage') then
    raise exception using errcode = '42501', message = 'COACHING_MANAGE_PERMISSION_DENIED';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception using errcode = '22023', message = 'COACHING_STUDENT_LIMIT_INVALID';
  end if;

  return query
  select
    student.id,
    student.public_code,
    student.full_name,
    student.lifecycle_status
  from public.students as student
  order by student.full_name asc, student.public_code asc, student.id asc
  limit p_limit;
end;
$$;

commit;
