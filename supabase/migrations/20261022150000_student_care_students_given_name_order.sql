-- Student care "Phân công lâu dài" / "Theo dõi riêng" pages 50 students at a
-- time, so the roll order has to come from the database: given name (the last
-- word of full_name) first, then the full name, in Vietnamese collation. This
-- matches compareStudentNames in src/lib/student-order.ts.
begin;

create or replace function public.get_student_care_students(p_search text default '',p_page integer default 1,p_inactive boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.student_care_authorize('student_care.view');
 return (with filtered as (select s.id,s.full_name,s.public_code,s.lifecycle_status,a.owner_id,p.display_name as owner_name
 from public.students s left join public.student_care_assignments a on a.student_id=s.id left join public.profiles p on p.id=a.owner_id
 where (case when p_inactive then s.lifecycle_status in ('reserved','completed','waiting_class') else s.lifecycle_status in ('active','resumed') end)
 and (p_search='' or s.full_name ilike '%'||p_search||'%' or s.public_code ilike '%'||p_search||'%')),
 rows as (select * from filtered
  order by regexp_replace(btrim(full_name),'^.*\s','') collate "vi-x-icu",btrim(full_name) collate "vi-x-icu",id
  limit 50 offset (greatest(1,least(p_page,100000))-1)*50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(rows) order by regexp_replace(btrim(rows.full_name),'^.*\s','') collate "vi-x-icu",btrim(rows.full_name) collate "vi-x-icu",rows.id) from rows),'[]'::jsonb),'total',(select count(*) from filtered)));
end; $$;

commit;
