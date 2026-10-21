insert into public.profiles(id,display_name,email) values
 ('11111111-1111-4111-8111-111111111111','Owner','owner@example.test'),
 ('11111111-1111-4111-8111-111111111112','Assistant','assistant@example.test');
insert into public.user_role_assignments(user_id,role_id) select '11111111-1111-4111-8111-111111111111',id from public.roles where code='owner';
insert into public.user_role_assignments(user_id,role_id) select '11111111-1111-4111-8111-111111111112',id from public.roles where code='assistant_manager';
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into public.students(id,full_name,public_code) values('22222222-2222-4222-8222-222222222222','Care student','CARE-1');
insert into public.classes(id,name) values('33333333-3333-4333-8333-333333333333','Class A');
insert into public.student_enrollments(student_id,class_id,effective_from) values('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',current_date-100);
insert into public.class_sessions(id,class_id,session_date,start_time) values
 ('44444444-4444-4444-8444-444444444441','33333333-3333-4333-8333-333333333333',(now() at time zone 'Asia/Ho_Chi_Minh')::date,'10:00'),
 ('44444444-4444-4444-8444-444444444442','33333333-3333-4333-8333-333333333333',(now() at time zone 'Asia/Ho_Chi_Minh')::date,'11:00'),
 ('44444444-4444-4444-8444-444444444443','33333333-3333-4333-8333-333333333333',(now() at time zone 'Asia/Ho_Chi_Minh')::date,'12:00');
insert into public.session_attendance(student_id,class_session_id,attendance_status)
select '22222222-2222-4222-8222-222222222222',id,'excused_absence' from public.class_sessions;
do $$declare e jsonb;begin
 e:=public.student_care_calculate('22222222-2222-4222-8222-222222222222');
 assert e ? 'absence_streak','2 consecutive absences'; assert e ? 'absence_month','3 monthly absences'; assert not e ? 'low_test_streak','missing scores are not zero';
end;$$;
select public.mutate_student_care(jsonb_build_object('op','configure','enabled',true,'request_id',gen_random_uuid()));
select public.run_student_care_worker();
do $$begin
 assert (select count(*)=1 from public.student_care_tasks where kind='alert'),'one aggregate alert';
 assert (select count(*)=1 from public.student_care_tasks where kind='monthly'),'one monthly task';
 assert (select count(*)=1 from public.notifications where event_code='student_care.initialized' and recipient_user_id='11111111-1111-4111-8111-111111111112'),'assistant receives initial summary';
 assert not exists(select 1 from public.notifications where event_code='student_care.detected'),'initial scan does not flood notifications';
end;$$;
select public.run_student_care_worker();
select public.student_care_reconcile();
do $$begin assert (select count(*)=1 from public.student_care_tasks where kind='monthly'),'reconcile idempotent';end;$$;
update public.session_attendance set attendance_status='present';
insert into public.session_results(student_id,class_session_id,test_score) values
 ('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444441',5),
 ('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444443',5.9);
do $$declare e jsonb;begin
 e:=public.student_care_calculate('22222222-2222-4222-8222-222222222222');
 assert e ? 'low_test_streak','two latest scored tests skip missing middle score'; assert not e ? 'absence_streak','present breaks absence';
end;$$;
insert into public.session_results(student_id,class_session_id,test_score) values('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444442',6);
do $$begin assert public.student_care_calculate('22222222-2222-4222-8222-222222222222')='{}'::jsonb,'backfilled 6 breaks latest score pair';end;$$;
select public.run_student_care_worker();
do $$begin assert (select not evidence_current from public.student_care_tasks where kind='alert'),'corrected evidence withdrawn';end;$$;

-- Update evidence on an already-open task (not only initial creation/withdrawal).
update public.session_results set test_score=5 where class_session_id='44444444-4444-4444-8444-444444444442';
select public.student_care_evaluate('22222222-2222-4222-8222-222222222222');
select public.run_student_care_worker();
do $$begin
 assert exists(select 1 from public.student_care_tasks where kind='alert' and evidence ? 'low_test_streak'),'updated evidence persisted on open alert';
 assert not exists(select 1 from public.student_care_evaluation_queue where attempts>0),'worker has no hidden per-student errors';
end;$$;

set role authenticated;
do $$declare t public.student_care_tasks%rowtype; d jsonb; task_id uuid; command jsonb; ev uuid;begin
 d:=public.get_student_care_dashboard();
 assert (d->>'total')::integer=2,'dashboard has both tasks';
 task_id:=(d->'rows'->0->>'id')::uuid;
 d:=public.get_student_care_detail(task_id);
 command:=jsonb_build_object('op','claim','task_id',task_id,'version',(d->'task'->>'version')::integer,'request_id',gen_random_uuid());
 perform public.mutate_student_care(command); perform public.mutate_student_care(command);
 d:=public.get_student_care_detail(task_id);
 assert d->'task'->>'owner_id'='11111111-1111-4111-8111-111111111111','claim and retry';
 begin
  perform public.mutate_student_care(jsonb_build_object('op','complete','task_id',task_id,'version',(d->'task'->>'version')::integer,'request_id',gen_random_uuid(),'note','done'));
  raise exception 'test expected contact gate';
 exception when others then if sqlerrm<>'STUDENT_CARE_SUCCESSFUL_CONTACT_REQUIRED' then raise;end if;end;
 perform public.mutate_student_care(jsonb_build_object('op','contact','task_id',task_id,'version',(d->'task'->>'version')::integer,'request_id',gen_random_uuid(),'note','Trao đổi với phụ huynh','success',true,'recipient','guardian','channel','phone','strengths','Đi học đều','difficulties','Cần luyện thêm','plan','Luyện mỗi ngày','outcome','Đã thống nhất','next_followup_at',now()+interval '3 days'));
 d:=public.get_student_care_detail(task_id);ev:=(d->'contacts'->0->>'id')::uuid;
 perform public.mutate_student_care(jsonb_build_object('op','complete','task_id',task_id,'version',(d->'task'->>'version')::integer,'request_id',gen_random_uuid(),'note','Đã hỗ trợ','contact_event_id',ev));
 d:=public.get_student_care_detail(task_id); assert d->'task'->>'status'='completed','completed with evidence';
 begin perform 1 from public.student_care_tasks;raise exception 'test expected direct read denied';
 exception when insufficient_privilege then null; end;
 begin perform public.run_student_care_worker();raise exception 'test expected worker denied';
 exception when insufficient_privilege then null; end;
end;$$;
reset role;
do $$begin assert exists(select 1 from public.student_care_tasks where kind='followup'),'promised follow-up survives completion';end;$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111112',false);
set role authenticated;
do $$begin
 begin perform public.mutate_student_care(jsonb_build_object('op','configure','enabled',false,'request_id',gen_random_uuid()));raise exception 'test expected configure denied';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;

-- Monthly completion may reuse an alert contact, but never credit two months.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$declare m public.student_care_tasks%rowtype; ev uuid; next_id uuid; v integer; begin
 select id into ev from public.student_care_events where event_type='contact' and payload->>'success'='true' limit 1;
 select * into m from public.student_care_tasks where kind='monthly';
 if m.status<>'completed' then
  perform public.mutate_student_care(jsonb_build_object('op','claim','task_id',m.id,'version',m.version,'request_id',gen_random_uuid()));
  perform public.mutate_student_care(jsonb_build_object('op','complete','task_id',m.id,'version',m.version+1,'request_id',gen_random_uuid(),'contact_event_id',ev,'note','Coaching tháng đã đủ nội dung'));
 end if;
 assert exists(select 1 from public.student_care_monthly_contacts where contact_event_id=ev),'monthly contact credited';
 insert into public.student_care_tasks(student_id,kind,period_month,owner_id)
 values(m.student_id,'monthly',m.period_month-interval '1 month','11111111-1111-4111-8111-111111111111') returning id into next_id;
 begin
  perform public.mutate_student_care(jsonb_build_object('op','complete','task_id',next_id,'version',1,'request_id',gen_random_uuid(),'contact_event_id',ev,'note','Cannot credit same call twice'));
  raise exception 'expected duplicate monthly contact rejection';
 exception when unique_violation then null; end;
 -- One real Coaching record and link, even when the request is retried.
 declare cmd jsonb; begin
  cmd:=jsonb_build_object('op','coaching','task_id',next_id,'version',1,'request_id',gen_random_uuid(),'note','Cần hỗ trợ thêm','next_followup_at',now()+interval '2 days');
  perform public.mutate_student_care(cmd); perform public.mutate_student_care(cmd);
  assert (select count(*)=1 from public.student_care_coaching_links where task_id=next_id),'coaching idempotency';
 end;
 -- Follow-up can conclude without forcing an endless sequence of new tasks.
 select id,version into next_id,v from public.student_care_tasks where kind='followup' limit 1;
 perform public.mutate_student_care(jsonb_build_object('op','contact','task_id',next_id,'version',v,'request_id',gen_random_uuid(),'success',true,'recipient','guardian','channel','phone','note','Đã ổn định','strengths','Tiến bộ','difficulties','Không còn','plan','Duy trì','outcome','Ổn định'));
 select id into ev from public.student_care_events where task_id=next_id and event_type='contact' order by occurred_at desc limit 1;
 perform public.mutate_student_care(jsonb_build_object('op','complete','task_id',next_id,'version',v+1,'request_id',gen_random_uuid(),'contact_event_id',ev,'note','Đã ổn định'));
 assert (select next_followup_at is null from public.student_care_tasks where id=next_id),'follow-up can end';
end;$$;

-- Calendar month uses Vietnam dates; two-session streak still spans months.
begin;
update public.class_sessions set session_date=(date_trunc('month',now() at time zone 'Asia/Ho_Chi_Minh')-interval '1 day')::date;
update public.session_attendance set attendance_status='unexcused_absence';
do $$declare e jsonb;begin
 e:=public.student_care_calculate('22222222-2222-4222-8222-222222222222');
 assert e ? 'absence_streak','cross-month absence streak';
 assert not e ? 'absence_month','previous month absent sessions excluded';
 assert not e ? 'low_test_streak','scores on absent sessions excluded';
end;$$;
rollback;

-- Reminders/escalations deduplicate, and inactive staff lose work ownership visibly.
begin;
update public.student_care_tasks set status='cancelled',completed_at=now() where status not in ('completed','cancelled');
insert into public.student_care_tasks(student_id,kind,detected_at,claim_due_at,contact_due_at)
values('22222222-2222-4222-8222-222222222222','alert',now()-interval '73 hours',now()-interval '49 hours',now()-interval '25 hours');
do $$declare n integer;begin
 perform public.student_care_remind();select count(*) into n from public.notifications;
 perform public.student_care_remind();
 assert (select count(*)=n from public.notifications),'daily notification dedupe';
 assert exists(select 1 from public.notifications where event_code='student_care.escalated' and recipient_user_id='11111111-1111-4111-8111-111111111111'),'72h escalates to owner';
end;$$;
insert into public.student_care_tasks(student_id,kind,owner_id,status,next_followup_at)
values('22222222-2222-4222-8222-222222222222','followup','11111111-1111-4111-8111-111111111112','in_progress',now()-interval '25 hours');
select public.student_care_remind();
do $$begin assert exists(select 1 from public.notifications n join public.student_care_tasks t on t.id::text=n.entity_id where t.kind='followup' and n.event_code='student_care.escalated'),'follow-up escalates after24h';end;$$;
update public.profiles set employment_status='inactive' where id='11111111-1111-4111-8111-111111111112';
select public.student_care_reconcile();
do $$begin assert not exists(select 1 from public.student_care_tasks where owner_id='11111111-1111-4111-8111-111111111112' and status not in ('completed','cancelled')),'inactive staff work is unassigned';end;$$;
rollback;

-- No legacy 500-student cap. All active students receive exactly one obligation.
begin;
insert into public.students(full_name,public_code) select 'Scale student '||n,'CARE-SCALE-'||n from generate_series(1,505) n;
select public.student_care_reconcile();select public.student_care_reconcile();
do $$declare d jsonb;begin
 assert (select count(*)=506 from public.student_care_tasks where kind='monthly' and period_month=date_trunc('month',now() at time zone 'Asia/Ho_Chi_Minh')::date),'monthly generation beyond500';
 d:=public.get_student_care_students('',11,false);
 assert (d->>'total')::integer=506 and jsonb_array_length(d->'rows')=6,'last student page accessible';
end;$$;
rollback;

-- Students list in roll order: given name (last word) first, then the full name, Vietnamese collation.
begin;
insert into public.students(full_name,public_code) values
 ('Trần Văn Bình','CARE-ORD-1'),('Nguyễn Thị An','CARE-ORD-2'),('Đỗ Minh An','CARE-ORD-3'),('Lê Ngọc Ân','CARE-ORD-4'),('Phạm Văn Ánh','CARE-ORD-5');
do $$declare d jsonb;begin
 d:=public.get_student_care_students('CARE-ORD',1,false);
 assert (select string_agg(r->>'full_name',',' order by o) from jsonb_array_elements(d->'rows') with ordinality x(r,o))='Đỗ Minh An,Nguyễn Thị An,Phạm Văn Ánh,Lê Ngọc Ân,Trần Văn Bình','students sorted by given name';
end;$$;
rollback;

-- All classes are aggregated, CP/KP combine, and unrecorded attendance breaks a streak.
begin;
insert into public.classes(id,name) values('33333333-3333-4333-8333-333333333334','Class B');
insert into public.student_enrollments(student_id,class_id,effective_from)
values('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333334',current_date-100);
update public.class_sessions set class_id='33333333-3333-4333-8333-333333333334' where id='44444444-4444-4444-8444-444444444442';
update public.session_attendance set attendance_status=case when class_session_id='44444444-4444-4444-8444-444444444442' then 'excused_absence' else 'unexcused_absence' end;
do $$declare e jsonb;begin
 e:=public.student_care_calculate('22222222-2222-4222-8222-222222222222');
 assert e ? 'absence_streak' and e ? 'absence_month','mixed CP/KP across classes';
 assert e->'absence_streak'->0->>'class_name'='Class B','cross-class evidence retains origin';
end;$$;
delete from public.session_attendance where class_session_id='44444444-4444-4444-8444-444444444443';
do $$begin assert not public.student_care_calculate('22222222-2222-4222-8222-222222222222') ? 'absence_streak','missing attendance is not absence';end;$$;
update public.session_attendance set attendance_status='present';
update public.session_results set test_score=0;
do $$begin assert public.student_care_calculate('22222222-2222-4222-8222-222222222222') ? 'low_test_streak','zero is a real score and missing latest attendance is skipped';end;$$;
rollback;

-- Authorization is enforced in the database, including append-only history.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111112',false);
set role authenticated;
do $$begin
 begin
  perform public.mutate_student_care(jsonb_build_object('op','assign_student','student_id','22222222-2222-4222-8222-222222222222','owner_id','11111111-1111-4111-8111-111111111112','note','not authorized','request_id',gen_random_uuid()));
  raise exception 'expected assignment denied';
 exception when insufficient_privilege then null; end;
end;$$;
reset role;
do $$begin
 begin update public.student_care_events set event_type='tampered';raise exception 'expected immutable history';
 exception when check_violation then null;end;
end;$$;
