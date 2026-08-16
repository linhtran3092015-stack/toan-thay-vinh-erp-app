begin;

insert into public.permissions (code,module,name,description) values
 ('settings.view','settings','Xem cài đặt hệ thống','Xem cấu hình vận hành an toàn.'),
 ('settings.manage','settings','Quản lý cài đặt hệ thống','Cập nhật cấu hình vận hành an toàn có audit.')
on conflict (code) do update set module=excluded.module,name=excluded.name,description=excluded.description,is_active=true;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.code in ('settings.view','settings.manage')
where (r.code='owner') or (r.code='assistant_manager' and p.code='settings.view')
on conflict (role_id,permission_id) do nothing;

create table public.system_settings (
 key text primary key check (key in ('center.display_name','teacher.display_name','center.contact_phone','center.contact_email','center.address','coaching.default_public_link_expiry_days')),
 value jsonb not null check (pg_catalog.jsonb_typeof(value) in ('string','number')),
 updated_at timestamptz not null default pg_catalog.now(),
 updated_by uuid references public.profiles(id) on delete restrict
);

insert into public.system_settings(key,value) values
 ('center.display_name',to_jsonb('Trung tâm Toán Thầy Vinh'::text)),
 ('teacher.display_name',to_jsonb('Toán Thầy Vinh'::text)),
 ('center.contact_phone',to_jsonb(''::text)),
 ('center.contact_email',to_jsonb(''::text)),
 ('center.address',to_jsonb(''::text)),
 ('coaching.default_public_link_expiry_days',to_jsonb(7))
on conflict (key) do nothing;

alter table public.system_settings enable row level security;
create policy system_settings_select on public.system_settings for select to authenticated using (public.has_permission('settings.view'));

-- The application shell needs one non-sensitive branding value for every
-- authenticated user. Keep this boundary deliberately narrower than table RLS.
create function public.get_center_display_name()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select value #>> '{}' from public.system_settings where key='center.display_name'),
    'Trung tâm Toán Thầy Vinh'
  );
$$;

create or replace function public.update_system_settings(p_values jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_key text; v_value jsonb; v_text text; v_old jsonb; v_result jsonb:='{}'::jsonb;
begin
 if v_actor is null then raise exception using errcode='28000',message='AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('settings.manage') then raise exception using errcode='42501',message='SYSTEM_SETTINGS_PERMISSION_DENIED'; end if;
 if pg_catalog.jsonb_typeof(p_values) <> 'object' then raise exception using errcode='22023',message='SYSTEM_SETTINGS_INVALID_PAYLOAD'; end if;
 if exists (select 1 from pg_catalog.jsonb_object_keys(p_values) as k where k not in ('center.display_name','teacher.display_name','center.contact_phone','center.contact_email','center.address','coaching.default_public_link_expiry_days')) then raise exception using errcode='22023',message='SYSTEM_SETTINGS_UNKNOWN_KEY'; end if;
 for v_key in select key from pg_catalog.jsonb_object_keys(p_values) as key loop
   v_value:=p_values->v_key;
   if v_key='coaching.default_public_link_expiry_days' then
     if pg_catalog.jsonb_typeof(v_value)<>'number' or not ((v_value #>> '{}') ~ '^[0-9]+$') or (v_value #>> '{}')::integer not between 1 and 90 then raise exception using errcode='22023',message='SYSTEM_SETTINGS_INVALID_EXPIRY'; end if;
   else
     if pg_catalog.jsonb_typeof(v_value)<>'string' then raise exception using errcode='22023',message='SYSTEM_SETTINGS_INVALID_TEXT'; end if;
     v_text:=pg_catalog.btrim(v_value #>> '{}');
     if (v_key in ('center.display_name','teacher.display_name') and (v_text='' or pg_catalog.length(v_text)>160)) or (v_key='center.address' and pg_catalog.length(v_text)>500) or (v_key in ('center.contact_phone','center.contact_email') and pg_catalog.length(v_text)>160) or (v_key='center.contact_email' and v_text<>'' and v_text !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then raise exception using errcode='22023',message='SYSTEM_SETTINGS_INVALID_VALUE'; end if;
     v_value:=to_jsonb(v_text);
   end if;
   select value into v_old from public.system_settings where key=v_key for update;
   update public.system_settings set value=v_value,updated_at=pg_catalog.now(),updated_by=v_actor where key=v_key;
   insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,old_data,new_data) values(v_actor,'settings','system_setting_updated','system_setting',v_key,v_old,v_value);
   v_result:=v_result || pg_catalog.jsonb_build_object(v_key,v_value);
 end loop;
 return v_result;
end; $$;

revoke all on table public.system_settings from public,anon;
revoke all on function public.get_center_display_name() from public,anon;
revoke all on function public.update_system_settings(jsonb) from public,anon;
grant select on table public.system_settings to authenticated;
grant execute on function public.get_center_display_name() to authenticated;
grant execute on function public.update_system_settings(jsonb) to authenticated;
commit;
