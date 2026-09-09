begin;
-- Separate drafts from the explicitly published snapshot. No direct client writes.
create table public.website_configuration (
 id boolean primary key default true check(id),
 draft jsonb,
 published jsonb,
 version integer not null default 0,
 updated_at timestamptz not null default now()
);
insert into public.website_configuration(id) values(true);
alter table public.website_configuration enable row level security;
revoke all on public.website_configuration from public,anon,authenticated;

create function public.read_website_configuration() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_permission('settings.view') then raise exception using errcode='42501',message='WEBSITE_PERMISSION_DENIED'; end if;
 return (select jsonb_build_object('draft',draft,'version',version,'published',published is not null) from public.website_configuration where id);
end; $$;

create function public.write_website_configuration(p_draft jsonb,p_version integer,p_operation text)
returns integer language plpgsql security definer set search_path='' as $$
declare v_current public.website_configuration%rowtype; v_next jsonb;
begin
 if auth.uid() is null or not public.has_permission('settings.manage') then raise exception using errcode='42501',message='WEBSITE_PERMISSION_DENIED'; end if;
 if p_operation is null or p_operation not in ('save','publish','unpublish') then raise exception using errcode='22023',message='WEBSITE_INVALID_OPERATION'; end if;
 select * into v_current from public.website_configuration where id for update;
 if p_version is null or p_version<>v_current.version then raise exception using errcode='40001',message='WEBSITE_CONFLICT'; end if;
 if p_operation='save' then
   if p_draft is null or jsonb_typeof(p_draft)<>'object' or octet_length(p_draft::text)>1000000
     or jsonb_typeof(p_draft->'branding') is distinct from 'object'
     or jsonb_typeof(p_draft->'pages') is distinct from 'array'
     or length(coalesce(p_draft->>'title','')) not between 1 and 160 then
       raise exception using errcode='22023',message='WEBSITE_INVALID_CONTENT';
   end if;
   if jsonb_array_length(p_draft->'pages') not between 1 and 12 then raise exception using errcode='22023',message='WEBSITE_INVALID_PAGES'; end if;
   v_next:=p_draft;
 else v_next:=v_current.draft;
 end if;
 if p_operation='publish' and v_next is null then raise exception using errcode='22023',message='WEBSITE_SAVE_FIRST'; end if;
 update public.website_configuration set draft=v_next,
   published=case when p_operation='publish' then v_next when p_operation='unpublish' then null else v_current.published end,
   version=version+1,updated_at=now() where id;
 insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,old_data,new_data)
 values(auth.uid(),'settings','website_'||p_operation,'website','center',jsonb_build_object('version',v_current.version),jsonb_build_object('version',v_current.version+1));
 return v_current.version+1;
end; $$;

create function public.read_published_website() returns jsonb
language sql stable security definer set search_path='' as $$
 select published from public.website_configuration where id;
$$;
create function public.read_app_branding() returns jsonb
language sql stable security definer set search_path='' as $$
 select draft->'branding' from public.website_configuration where id and auth.uid() is not null;
$$;
revoke all on function public.read_website_configuration() from public,anon;
revoke all on function public.write_website_configuration(jsonb,integer,text) from public,anon;
revoke all on function public.read_published_website() from public;
revoke all on function public.read_app_branding() from public,anon;
grant execute on function public.read_website_configuration() to authenticated;
grant execute on function public.write_website_configuration(jsonb,integer,text) to authenticated;
grant execute on function public.read_published_website() to anon,authenticated;
grant execute on function public.read_app_branding() to authenticated;
commit;
