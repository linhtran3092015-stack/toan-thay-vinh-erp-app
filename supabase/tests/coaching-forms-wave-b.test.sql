begin;
select plan(29);

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('b1000000-0000-0000-0000-000000000001','authenticated','authenticated','coaching-wave-b@example.test','{"provider":"email"}','{}',now(),now());
insert into public.user_role_assignments(user_id,role_id,assignment_reason)
select 'b1000000-0000-0000-0000-000000000001', id, 'fixture' from public.roles where code='owner';
select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000001',true);

insert into public.students(id,public_code,full_name,birth_year,current_grade,lifecycle_status)
values ('b2000000-0000-0000-0000-000000000001','TV-2026-80001','Học viên Coaching',2014,6,'active');
insert into public.coaching_records(id,student_id,campaign_name,reason,priority,assistant_owner_id,opened_by)
values ('b3000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000001','Theo dõi Wave B','Fixture','medium','b1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001');

select lives_ok($$select public.save_coaching_form_draft(null,'Phiếu W B','Phiếu W B','Hướng dẫn','[{"type":"short_text","title":"Ngắn","required":true,"configuration":{}},{"type":"long_text","title":"Dài","required":false,"configuration":{}},{"type":"single_choice","title":"Một","required":true,"configuration":{"options":["A","B"]}},{"type":"multiple_choice","title":"Nhiều","required":false,"configuration":{"options":["A","B"]}},{"type":"scale","title":"Điểm","required":true,"configuration":{"min":1,"max":5}},{"type":"number","title":"Số","required":false,"configuration":{"min":0,"max":10}}]'::jsonb)$$,'creates draft with all six supported question types');
select is((select count(*) from public.coaching_form_questions),6::bigint,'all six questions stored in order');
select throws_ok($$select public.save_coaching_form_draft((select id from public.coaching_forms limit 1),'Bad','Bad',null,'[{"type":"single_choice","title":"x","required":false,"configuration":{"options":[]}}]'::jsonb)$$,'22023','COACHING_FORM_QUESTION_INVALID','invalid choice configuration is rejected server-side');
select lives_ok($$select public.publish_coaching_form_version((select id from public.coaching_form_versions limit 1))$$,'publishes a draft version');
select throws_ok($$update public.coaching_form_questions set title='changed'$$,'23514','COACHING_FORM_VERSION_IMMUTABLE','published question snapshot is immutable');
select lives_ok($$select public.create_coaching_form_version_draft((select id from public.coaching_forms limit 1))$$,'creates v2 draft by copying v1');
select is((select count(*) from public.coaching_form_questions),12::bigint,'v2 copies historical questions without rewriting v1');
select lives_ok($$select public.publish_coaching_form_version((select id from public.coaching_form_versions where status='draft' limit 1))$$,'publishes copied v2');
select is((select count(*) from public.coaching_form_versions where status='published'),2::bigint,'v1 and v2 remain published historical versions');

select lives_ok($$select public.issue_coaching_public_link('b3000000-0000-0000-0000-000000000001',(select id from public.coaching_form_versions where version_number=1),now()+interval '1 day',encode(extensions.digest('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','sha256'),'hex'))$$,'issues student-specific v1 hashed-token link');
select isnt((select token_hash from public.coaching_public_links),'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','raw token is not persisted');
select is((select state from public.get_public_coaching_form('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') limit 1),'active','valid public token resolves only its intended form');
select is((select state from public.get_public_coaching_form('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') limit 1),'invalid','unknown token is non-leaking invalid state');
select lives_ok($$select public.submit_public_coaching_form('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',(select jsonb_object_agg(id::text,answer) from (select id, case question_type when 'short_text' then '"ok"'::jsonb when 'single_choice' then '"A"'::jsonb when 'scale' then '3'::jsonb else null end answer from public.coaching_form_questions where form_version_id=(select id from public.coaching_form_versions where version_number=1)) s where answer is not null))$$,'valid required answers submit atomically');
select is((select count(*) from public.coaching_form_responses),1::bigint,'one immutable response exists');
select is((select status from public.coaching_public_links),'submitted','link is consumed after submit');
select throws_ok($$select public.submit_public_coaching_form('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','{}'::jsonb)$$,'23514','COACHING_PUBLIC_LINK_SUBMITTED','second submission is rejected');
select throws_ok($$update public.coaching_form_responses set submitted_at=now()$$,'23514','COACHING_RESPONSE_IMMUTABLE','response is immutable');
select is((select count(*) from public.coaching_form_answers),3::bigint,'exact submitted answer set stored');

select lives_ok($$select public.issue_coaching_public_link('b3000000-0000-0000-0000-000000000001',(select id from public.coaching_form_versions where version_number=2),now()+interval '1 day',encode(extensions.digest('cccccccccccccccccccccccccccccccccccccccc','sha256'),'hex'))$$,'link has required expiry');
update public.coaching_public_links set issued_at=now()-interval '2 days', expires_at=now()-interval '1 day' where token_hash=encode(extensions.digest('cccccccccccccccccccccccccccccccccccccccc','sha256'),'hex');
select is((select state from public.get_public_coaching_form('cccccccccccccccccccccccccccccccccccccccc') limit 1),'expired','expired link remains expired');
select lives_ok($$select public.issue_coaching_public_link('b3000000-0000-0000-0000-000000000001',(select id from public.coaching_form_versions where version_number=2),now()+interval '1 day',encode(extensions.digest('dddddddddddddddddddddddddddddddddddddddd','sha256'),'hex'))$$,'issues replacement active link');
select lives_ok($$select public.revoke_coaching_public_link((select id from public.coaching_public_links where token_hash=encode(extensions.digest('dddddddddddddddddddddddddddddddddddddddd','sha256'),'hex')),'Fixture revoke')$$,'authorized link revocation is audited');
select is((select state from public.get_public_coaching_form('dddddddddddddddddddddddddddddddddddddddd') limit 1),'revoked','revoked link is non-leaking');
select ok((select count(*) from public.audit_logs where action in ('coaching_form_created','coaching_form_version_published','coaching_public_link_issued','coaching_public_link_revoked')) >= 4,'high-value staff mutations are audited without answer contents');
select is((select count(*) from public.coaching_form_responses where coaching_record_id='b3000000-0000-0000-0000-000000000001'),1::bigint,'response remains linked to existing coaching record history');
select ok(not has_table_privilege('anon','public.coaching_form_responses','insert'),'anon has no direct response insert privilege');
select ok(not has_table_privilege('anon','public.students','select'),'anon cannot browse students');
select is((select pg_catalog.array_to_string(proconfig, ',') from pg_proc where proname='submit_public_coaching_form'),'search_path=""','public submission function has hardened search path');

select * from finish();
rollback;
