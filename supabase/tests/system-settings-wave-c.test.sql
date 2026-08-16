begin;
select plan(16);

select ok(to_regclass('public.system_settings') is not null, 'system settings table exists');
select is((select value #>> '{}' from public.system_settings where key='center.display_name'),'Trung tâm Toán Thầy Vinh','safe center display default is seeded');
select is((select (value #>> '{}')::integer from public.system_settings where key='coaching.default_public_link_expiry_days'),7,'coaching expiry default is seeded');
select ok(not has_table_privilege('anon','public.system_settings','select'),'anon cannot browse generic system settings');
select is((select pg_catalog.array_to_string(proconfig, ',') from pg_proc where proname='update_system_settings'),'search_path=""','settings mutation function has hardened search path');
select is(public.get_center_display_name(),'Trung tâm Toán Thầy Vinh','authenticated shell reader exposes only the seeded display name');

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('c1000000-0000-0000-0000-000000000001','authenticated','authenticated','settings-owner@example.test','{}','{}',now(),now());
insert into public.user_role_assignments(user_id,role_id,assignment_reason)
select 'c1000000-0000-0000-0000-000000000001',id,'settings fixture' from public.roles where code='owner';
select set_config('request.jwt.claim.sub','c1000000-0000-0000-0000-000000000001',true);

select lives_ok($$select public.update_system_settings('{"center.display_name":"Trung tâm thử nghiệm","coaching.default_public_link_expiry_days":14}'::jsonb)$$,'owner can update only known safe settings');
select is((select value #>> '{}' from public.system_settings where key='center.display_name'),'Trung tâm thử nghiệm','updated setting is stored');
select is((select (value #>> '{}')::integer from public.system_settings where key='coaching.default_public_link_expiry_days'),14,'typed expiry is stored');
select ok((select count(*) from public.audit_logs where action='system_setting_updated' and entity_type='system_setting')=2,'each safe setting update is audited with prior/new values');
select throws_ok($$select public.update_system_settings('{"unknown.secret":"value"}'::jsonb)$$,'22023','SYSTEM_SETTINGS_UNKNOWN_KEY','unknown keys cannot become configuration');
select throws_ok($$select public.update_system_settings('{"center.contact_email":"not-an-email"}'::jsonb)$$,'22023','SYSTEM_SETTINGS_INVALID_VALUE','invalid email is rejected in the database');
select throws_ok($$select public.update_system_settings('{"coaching.default_public_link_expiry_days":0}'::jsonb)$$,'22023','SYSTEM_SETTINGS_INVALID_EXPIRY','out-of-range expiry is rejected');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
select throws_ok($$select public.update_system_settings('{"center.display_name":"Denied"}'::jsonb)$$,'42501','SYSTEM_SETTINGS_PERMISSION_DENIED','unprivileged users cannot update settings');
select is((select value #>> '{}' from public.system_settings where key='center.display_name'),'Trung tâm thử nghiệm','denied write cannot change a setting');
select ok(not exists(select 1 from public.system_settings where key like '%secret%' or value::text ~* '(api[_-]?key|service[_-]?role|webhook[_-]?secret)'),'the known registry cannot store secret-shaped setting keys');

select * from finish();
rollback;
