begin;

create or replace function public.find_student_form_duplicates(
  p_student_id uuid,
  p_full_name text,
  p_birth_year integer,
  p_guardian_phone text
)
returns table (
  guardian_id uuid,
  guardian_full_name text,
  guardian_phone text,
  linked_student_id uuid,
  linked_student_public_code text,
  linked_student_full_name text,
  linked_student_birth_year smallint,
  linked_student_lifecycle_status text,
  is_exact_student_duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_normalized_phone text;
  v_normalized_name text;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not (
    public.has_permission('students.create')
    or public.has_permission('students.update')
  ) then
    raise exception using
      errcode = '42501',
      message = 'STUDENT_FORM_PERMISSION_DENIED';
  end if;

  v_normalized_phone := public.normalize_vietnam_phone(
    coalesce(p_guardian_phone, '')
  );

  if v_normalized_phone !~ '^0[0-9]{9,10}$' then
    raise exception using
      errcode = '22023',
      message = 'GUARDIAN_PHONE_INVALID';
  end if;

  v_normalized_name := public.normalize_student_name(
    coalesce(p_full_name, '')
  );

  return query
  select
    guardian.id,
    guardian.full_name,
    guardian.phone,
    student.id,
    student.public_code,
    student.full_name,
    student.birth_year,
    student.lifecycle_status,
    (
      student.id is not null
      and student.id is distinct from p_student_id
      and public.normalize_student_name(student.full_name)
        = v_normalized_name
      and student.birth_year = p_birth_year
    ) as is_exact_student_duplicate
  from public.guardians as guardian
  left join public.student_guardians as link
    on link.guardian_id = guardian.id
    and link.ended_at is null
  left join public.students as student
    on student.id = link.student_id
  where guardian.normalized_phone = v_normalized_phone
  order by
    student.full_name nulls last,
    student.id nulls last;
end;
$$;

revoke all on function public.find_student_form_duplicates(
  uuid,
  text,
  integer,
  text
)
from public, anon, authenticated;

grant execute on function public.find_student_form_duplicates(
  uuid,
  text,
  integer,
  text
)
to authenticated;

commit;
