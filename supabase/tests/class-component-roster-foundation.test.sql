begin;

select plan(42);

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('ca000000-0000-0000-0000-000000000001','authenticated','authenticated','component-roster@example.test','{"provider":"email"}','{}',now(),now());
insert into public.roles (id,code,name) values ('ca000000-0000-0000-0000-000000000002','componentroster','Component roster test');
insert into public.role_permissions(role_id,permission_id)
select 'ca000000-0000-0000-0000-000000000002',id
from public.permissions
where code in ('attendance.mark','classes.create','classes.manage_schedule','sessions.lock','sessions.manage','sessions.view','tuition_periods.view');
insert into public.user_role_assignments(user_id,role_id,assignment_reason)
values ('ca000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000002','Component roster test');
select set_config('request.jwt.claim.sub','ca000000-0000-0000-0000-000000000001',true);

insert into public.academic_years(id,code,name,starts_on,ends_on,status,is_current)
values ('ca000000-0000-0000-0000-000000000010','2030-2031','Năm học component roster',date '2030-08-01',date '2031-05-31','active',false);
insert into public.classes(id,academic_year_id,code,name,grade,level,status,weekly_session_count) values
  ('ca000000-0000-0000-0000-000000000011','ca000000-0000-0000-0000-000000000010','5A','5A',5,'A','active',1),
  ('ca000000-0000-0000-0000-000000000012','ca000000-0000-0000-0000-000000000010','5B','5B',5,'B','active',1),
  ('ca000000-0000-0000-0000-000000000013','ca000000-0000-0000-0000-000000000010','5CLC1','5CLC1',5,'CLC','active',1),
  ('ca000000-0000-0000-0000-000000000014','ca000000-0000-0000-0000-000000000010','5CLC2','5CLC2',5,'CLC','active',1),
  ('ca000000-0000-0000-0000-000000000015','ca000000-0000-0000-0000-000000000010','5A1','5A1',5,'A','active',2),
  ('ca000000-0000-0000-0000-000000000016','ca000000-0000-0000-0000-000000000010','5A2','5A2',5,'A','active',2),
  ('ca000000-0000-0000-0000-000000000017','ca000000-0000-0000-0000-000000000010','5A0','5A0',5,'A','active',2),
  ('ca000000-0000-0000-0000-000000000018','ca000000-0000-0000-0000-000000000010','5D','5D',5,'B','active',1);
insert into public.academic_years(id,code,name,starts_on,ends_on,status,is_current)
values ('ca000000-0000-0000-0000-000000000019','2031-2032','Năm học mismatch',date '2031-08-01',date '2032-05-31','active',false);
insert into public.classes(id,academic_year_id,code,name,grade,level,status,weekly_session_count) values
  ('ca000000-0000-0000-0000-00000000001a','ca000000-0000-0000-0000-000000000019','5AY','5AY',5,'A','active',1),
  ('ca000000-0000-0000-0000-00000000001b','ca000000-0000-0000-0000-000000000010','6A','6A',6,'A','active',1);

select lives_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000015'::uuid,'ca000000-0000-0000-0000-000000000011'::uuid,1::smallint,date '2030-08-01',null::date,'5A1 component 1'::text)$$,'5A1 -> 5A mapping is created through the audited RPC');
select lives_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000015'::uuid,'ca000000-0000-0000-0000-000000000013'::uuid,2::smallint,date '2030-08-01',null::date,'5A1 component 2'::text)$$,'5A1 -> 5CLC1 mapping is created');
select lives_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000016'::uuid,'ca000000-0000-0000-0000-000000000011'::uuid,1::smallint,date '2030-08-01',null::date,'5A2 component 1'::text)$$,'5A2 -> 5A mapping is created');
select lives_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000016'::uuid,'ca000000-0000-0000-0000-000000000014'::uuid,2::smallint,date '2030-09-01',null::date,'5A2 component 2'::text)$$,'5A2 -> 5CLC2 mapping is effective dated');
select lives_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000017'::uuid,'ca000000-0000-0000-0000-000000000011'::uuid,1::smallint,date '2030-08-01',null::date,'5A0 component 1'::text)$$,'5A0 -> 5A mapping is created');
select lives_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000017'::uuid,'ca000000-0000-0000-0000-000000000012'::uuid,2::smallint,date '2030-08-01',date '2030-09-15','5A0 component 2'::text)$$,'5A0 -> 5B mapping has an effective end');
select matches(pg_get_functiondef('public.create_class_component_link(uuid,uuid,smallint,date,date,text)'::regprocedure),'order by id for update','inverse component-link writes lock both endpoints in stable UUID order');
select throws_ok($$select public.update_class('ca000000-0000-0000-0000-000000000015'::uuid,'ca000000-0000-0000-0000-000000000010'::uuid,'5A1'::text,'5A1'::text,5::smallint,'A'::text,1::smallint,'offline'::text,null::text,null::text,'Invalid linked-class change'::text)$$,'P0001','CLASS_COMPONENT_LINKED_CLASS_IDENTITY_IMMUTABLE','update_class cannot change weekly-session role after a component mapping exists');
select throws_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000015'::uuid,'ca000000-0000-0000-0000-00000000001a'::uuid,1::smallint,date '2030-08-01',null::date,'Wrong academic year'::text)$$,'P0001','CLASS_COMPONENT_LINK_ACADEMIC_YEAR_MISMATCH','cross-year component mapping is rejected');
select throws_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000015'::uuid,'ca000000-0000-0000-0000-00000000001b'::uuid,1::smallint,date '2030-08-01',null::date,'Wrong grade'::text)$$,'P0001','CLASS_COMPONENT_LINK_GRADE_MISMATCH','cross-grade component mapping is rejected');
select throws_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000011'::uuid,'ca000000-0000-0000-0000-000000000012'::uuid,1::smallint,date '2030-08-01',null::date,'Wrong parent count'::text)$$,'P0001','CLASS_COMPONENT_LINK_PARENT_WEEKLY_SESSION_COUNT_INVALID','one-session class cannot become a composite parent');
select throws_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000015'::uuid,'ca000000-0000-0000-0000-000000000011'::uuid,1::smallint,date '2030-08-01',null::date,'Duplicate overlap'::text)$$,'P0001','CLASS_COMPONENT_LINK_MAXIMUM_TWO_EFFECTIVE_COMPONENTS','overlapping duplicate component mapping is rejected');
select throws_ok($$select public.create_class_component_link('ca000000-0000-0000-0000-000000000015'::uuid,'ca000000-0000-0000-0000-000000000018'::uuid,1::smallint,date '2030-08-01',null::date,'Third component'::text)$$,'P0001','CLASS_COMPONENT_LINK_MAXIMUM_TWO_EFFECTIVE_COMPONENTS','a third effective component mapping is rejected');
select throws_ok($$insert into public.class_schedule_templates(class_id,weekday,start_time,end_time,learning_mode,effective_from) values ('ca000000-0000-0000-0000-000000000015',1,time '18:00',time '19:30','offline',date '2030-08-01')$$,'P0001','COMPOSITE_PARENT_CANNOT_HAVE_SCHEDULE_TEMPLATE','composite parent schedule template creation is rejected');
select throws_ok($$insert into public.class_sessions(class_id,session_date,session_kind,start_time,end_time,learning_mode,status) values ('ca000000-0000-0000-0000-000000000015',date '2030-08-05','additional',time '18:00',time '19:30','offline','scheduled')$$,'P0001','COMPOSITE_PARENT_CANNOT_HAVE_CLASS_SESSION','composite parent session creation is rejected');

insert into public.class_schedule_templates(id,class_id,weekday,start_time,end_time,learning_mode,effective_from) values
  ('ca000000-0000-0000-0000-000000000021','ca000000-0000-0000-0000-000000000011',1,time '18:00',time '19:30','offline',date '2030-08-01'),
  ('ca000000-0000-0000-0000-000000000022','ca000000-0000-0000-0000-000000000012',1,time '18:00',time '19:30','offline',date '2030-08-01'),
  ('ca000000-0000-0000-0000-000000000023','ca000000-0000-0000-0000-000000000013',1,time '18:00',time '19:30','offline',date '2030-08-01'),
  ('ca000000-0000-0000-0000-000000000024','ca000000-0000-0000-0000-000000000014',1,time '18:00',time '19:30','offline',date '2030-08-01'),
  ('ca000000-0000-0000-0000-000000000025','ca000000-0000-0000-0000-000000000018',1,time '18:00',time '19:30','offline',date '2030-08-01');
insert into public.class_sessions(id,class_id,schedule_template_id,session_date,session_kind,start_time,end_time,learning_mode,status) values
  ('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000011','ca000000-0000-0000-0000-000000000021',date '2030-08-05','regular',time '18:00',time '19:30','offline','scheduled'),
  ('ca000000-0000-0000-0000-000000000032','ca000000-0000-0000-0000-000000000013','ca000000-0000-0000-0000-000000000023',date '2030-08-05','regular',time '18:00',time '19:30','offline','scheduled'),
  ('ca000000-0000-0000-0000-000000000033','ca000000-0000-0000-0000-000000000014','ca000000-0000-0000-0000-000000000024',date '2030-08-05','regular',time '18:00',time '19:30','offline','scheduled'),
  ('ca000000-0000-0000-0000-000000000034','ca000000-0000-0000-0000-000000000014','ca000000-0000-0000-0000-000000000024',date '2030-09-02','regular',time '18:00',time '19:30','offline','scheduled'),
  ('ca000000-0000-0000-0000-000000000035','ca000000-0000-0000-0000-000000000012','ca000000-0000-0000-0000-000000000022',date '2030-09-16','regular',time '18:00',time '19:30','offline','scheduled'),
  ('ca000000-0000-0000-0000-000000000036','ca000000-0000-0000-0000-000000000018','ca000000-0000-0000-0000-000000000025',date '2030-08-05','regular',time '18:00',time '19:30','offline','scheduled'),
  ('ca000000-0000-0000-0000-000000000037','ca000000-0000-0000-0000-000000000012','ca000000-0000-0000-0000-000000000022',date '2030-08-05','regular',time '18:00',time '19:30','offline','scheduled');
select is((public.dry_run_class_session_generation('ca000000-0000-0000-0000-000000000010',date '2030-08-05',date '2030-08-05')->>'total_occurrences')::integer,5,'session generation discovers physical component templates only');

insert into public.students(id,public_code,full_name,birth_year,current_grade,lifecycle_status) values
  ('ca000000-0000-0000-0000-000000000041','TV-2030-00041','Direct 5A',2020,5,'active'),
  ('ca000000-0000-0000-0000-000000000042','TV-2030-00042','Composite 5A1',2020,5,'active'),
  ('ca000000-0000-0000-0000-000000000043','TV-2030-00043','Composite 5A2',2020,5,'active'),
  ('ca000000-0000-0000-0000-000000000044','TV-2030-00044','Composite 5A0',2020,5,'active'),
  ('ca000000-0000-0000-0000-000000000045','TV-2030-00045','Unrelated enrollment',2020,5,'active'),
  ('ca000000-0000-0000-0000-000000000046','TV-2030-00046','Historical composite 5A1',2020,5,'active');
insert into public.student_enrollments(id,student_id,class_id,registered_mode,status,effective_from,effective_to) values
  ('ca000000-0000-0000-0000-000000000051','ca000000-0000-0000-0000-000000000041','ca000000-0000-0000-0000-000000000011','offline','active',date '2030-08-01',null),
  ('ca000000-0000-0000-0000-000000000052','ca000000-0000-0000-0000-000000000042','ca000000-0000-0000-0000-000000000015','offline','active',date '2030-08-01',null),
  ('ca000000-0000-0000-0000-000000000053','ca000000-0000-0000-0000-000000000043','ca000000-0000-0000-0000-000000000016','offline','active',date '2030-08-01',null),
  ('ca000000-0000-0000-0000-000000000054','ca000000-0000-0000-0000-000000000044','ca000000-0000-0000-0000-000000000017','offline','active',date '2030-08-01',null),
  ('ca000000-0000-0000-0000-000000000055','ca000000-0000-0000-0000-000000000045','ca000000-0000-0000-0000-000000000018','offline','active',date '2030-08-01',null),
  ('ca000000-0000-0000-0000-000000000056','ca000000-0000-0000-0000-000000000046','ca000000-0000-0000-0000-000000000015','offline','active',date '2030-08-01',null);
update public.student_enrollments
set status='transferred', effective_to=date '2030-08-05', ended_by='ca000000-0000-0000-0000-000000000001', end_reason='Test transfer'
where id='ca000000-0000-0000-0000-000000000056';

select is((select count(*) from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000031'))::integer,4,'5A roster contains direct, 5A1, 5A2, and 5A0 students exactly once');
select ok(exists(select 1 from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000031') where student_id='ca000000-0000-0000-0000-000000000041'),'direct 5A student appears in 5A roster');
select ok(exists(select 1 from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000031') where student_id='ca000000-0000-0000-0000-000000000042' and student_enrollment_id='ca000000-0000-0000-0000-000000000052' and enrollment_class_id='ca000000-0000-0000-0000-000000000015'),'5A1 student appears with the real enrollment identity');
select ok(exists(select 1 from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000032') where student_id='ca000000-0000-0000-0000-000000000042'),'5A1 student appears in 5CLC1');
select ok(exists(select 1 from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000031') where student_id='ca000000-0000-0000-0000-000000000043'),'5A2 student appears in 5A');
select ok(exists(select 1 from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000037') where student_id='ca000000-0000-0000-0000-000000000044'),'5A0 student appears in 5B');
select ok(not exists(select 1 from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000033') where student_id='ca000000-0000-0000-0000-000000000042'),'5A1 student does not appear in 5CLC2');
select ok(not exists(select 1 from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000033') where student_id='ca000000-0000-0000-0000-000000000043'),'component effective_from is respected');
select ok(exists(select 1 from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000034') where student_id='ca000000-0000-0000-0000-000000000043'),'5A2 student appears in 5CLC2 after effective_from');
select ok(not exists(select 1 from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000035') where student_id='ca000000-0000-0000-0000-000000000044'),'component effective_to is respected');
select ok(not exists(select 1 from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000031') where student_id='ca000000-0000-0000-0000-000000000045'),'enrollment effective dates are respected');
select is((select count(*) from public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000036'))::integer,1,'unmapped direct class keeps legacy direct-enrollment roster behavior');

update public.class_sessions
set status='in_progress', started_at=now(), started_by='ca000000-0000-0000-0000-000000000001'
where id='ca000000-0000-0000-0000-000000000031';
select lives_ok($$select public.mark_session_attendance('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000042','present','offline')$$,'main attendance accepts the composite enrollment');
select throws_ok($$select public.mark_session_attendance('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000045','present','offline')$$,'P0001','MAIN_ATTENDANCE_REQUIRES_EFFECTIVE_ENROLLMENT','unrelated enrollment is rejected for main attendance');
select lives_ok($$select public.mark_session_attendance('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000045','additional_study','offline')$$,'additional study still works without effective roster membership');
select throws_ok($$select public.lock_class_session('ca000000-0000-0000-0000-000000000031','Incomplete roster')$$,'P0001','CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK','lock remains lifecycle-gated before completeness is evaluated');
select lives_ok($$select public.mark_session_attendance('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000041','present','offline')$$,'direct roster attendance remains valid');
select lives_ok($$select public.mark_session_attendance('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000043','present','offline')$$,'5A2 roster attendance remains valid');
select lives_ok($$select public.mark_session_attendance('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000044','present','offline')$$,'5A0 roster attendance remains valid');
update public.class_sessions
set status='completed', completed_at=now(), completed_by='ca000000-0000-0000-0000-000000000001'
where id='ca000000-0000-0000-0000-000000000031';
insert into public.session_results(class_session_id,student_id,test_score,notebook_status,graded_at,graded_by,created_by) values
  ('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000041',8,'not_required',now(),'ca000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001'),
  ('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000042',8,'not_required',now(),'ca000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001'),
  ('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000043',8,'not_required',now(),'ca000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001'),
  ('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000044',8,'not_required',now(),'ca000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001'),
  ('ca000000-0000-0000-0000-000000000031','ca000000-0000-0000-0000-000000000045',8,'not_required',now(),'ca000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001');
select lives_ok($$select public.lock_class_session('ca000000-0000-0000-0000-000000000031','All resolved roster attendance has been reviewed')$$,'lock succeeds only after all resolved roster attendance and results exist');
select is((select count(*) from public.student_session_ledger_entries where class_session_id='ca000000-0000-0000-0000-000000000031' and student_enrollment_id='ca000000-0000-0000-0000-000000000052')::integer,1,'locking charges exactly one session against the 5A1 enrollment');
insert into public.tuition_collection_periods(id,name,starts_on,ends_on,status,created_by)
values ('ca000000-0000-0000-0000-000000000061','Kỳ component roster',date '2030-08-01',date '2030-08-31','draft','ca000000-0000-0000-0000-000000000001');
select is((select count(*) from public.preview_tuition_collection_period('ca000000-0000-0000-0000-000000000061') where student_id='ca000000-0000-0000-0000-000000000042')::integer,2,'tuition preview counts both 5A1 physical components');
select is((select distinct class_id from public.preview_tuition_collection_period('ca000000-0000-0000-0000-000000000061') where student_id='ca000000-0000-0000-0000-000000000042'),'ca000000-0000-0000-0000-000000000015'::uuid,'tuition preview preserves the official 5A1 enrollment class');
select is((select count(*) from public.preview_tuition_collection_period('ca000000-0000-0000-0000-000000000061') where student_id='ca000000-0000-0000-0000-000000000046')::integer,2,'tuition preview retains transferred composite enrollment sessions within its effective dates');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.resolve_class_session_roster('ca000000-0000-0000-0000-000000000031')$$,'28000','AUTHENTICATION_REQUIRED','anon cannot access the internal roster RPC');
select throws_ok($$select public.preview_tuition_collection_period('ca000000-0000-0000-0000-000000000010')$$,'28000','AUTHENTICATION_REQUIRED','anon cannot access tuition preview');

select * from finish();
rollback;
