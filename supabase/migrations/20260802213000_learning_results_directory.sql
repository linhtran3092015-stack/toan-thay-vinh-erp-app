begin;

create or replace function public.get_learning_results_directory(
  p_limit integer default 500
)
returns table (
  result_id uuid,
  class_session_id uuid,
  session_date date,
  session_status text,
  locked_at timestamptz,
  student_id uuid,
  student_code text,
  student_name text,
  current_grade integer,
  class_id uuid,
  class_code text,
  class_name text,
  class_grade integer,
  class_level text,
  test_score numeric,
  notebook_score numeric,
  notebook_status text,
  result_comment text,
  graded_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required'
      using errcode = '42501';
  end if;

  if not public.has_permission('results.view') then
    raise exception 'results_view_permission_required'
      using errcode = '42501';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_result_limit'
      using errcode = '22023';
  end if;

  return query
  select
    result.id,
    class_session.id,
    class_session.session_date,
    class_session.status,
    class_session.locked_at,
    student.id,
    student.public_code,
    student.full_name,
    student.current_grade::integer,
    class_definition.id,
    class_definition.code,
    class_definition.name,
    class_definition.grade::integer,
    class_definition.level,
    result.test_score,
    result.notebook_score,
    result.notebook_status,
    result.comment,
    result.graded_at
  from public.session_results as result
  join public.class_sessions as class_session
    on class_session.id = result.class_session_id
  join public.students as student
    on student.id = result.student_id
  join public.classes as class_definition
    on class_definition.id = class_session.class_id
  order by
    class_session.session_date desc,
    class_session.start_time desc,
    student.full_name,
    result.id
  limit p_limit;
end;
$$;

revoke all on function public.get_learning_results_directory(integer)
from public, anon;

grant execute on function public.get_learning_results_directory(integer)
to authenticated;

comment on function public.get_learning_results_directory(integer)
is 'Returns the latest learning results visible to callers with results.view without granting broader direct access to student or class directories.';

commit;
