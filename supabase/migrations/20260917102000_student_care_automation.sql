begin;

create function public.student_care_observations(p_student uuid)
returns table(session_id uuid,session_date date,start_time time,class_name text,attendance_status text,test_score numeric)
language sql stable security definer set search_path='' as $$
 select s.id,s.session_date,s.start_time,c.name,a.attendance_status,
  case when a.attendance_status in ('present','additional_study') then r.test_score else null end
 from public.class_sessions s join public.classes c on c.id=s.class_id
 left join public.session_attendance a on a.class_session_id=s.id and a.student_id=p_student
 left join public.session_results r on r.class_session_id=s.id and r.student_id=p_student
 where s.status='completed' and s.session_date<=(now() at time zone 'Asia/Ho_Chi_Minh')::date
 and (a.id is not null or (s.session_kind<>'additional' and exists(
  select 1 from public.student_enrollments e
  where e.student_id=p_student and e.effective_from<=s.session_date and (e.effective_to is null or e.effective_to>=s.session_date)
  and (e.class_id=s.class_id or exists(select 1 from public.class_component_links l
   where l.parent_class_id=e.class_id and l.component_class_id=s.class_id and l.effective_from<=s.session_date and (l.effective_to is null or l.effective_to>=s.session_date)))
 )))
 order by s.session_date desc,s.start_time desc,s.id desc;
$$;

create function public.student_care_calculate(p_student uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 with observations as materialized (select * from public.student_care_observations(p_student)),
 latest as (select * from observations order by session_date desc,start_time desc,session_id desc limit 2),
 scores as (select * from observations where test_score is not null order by session_date desc,start_time desc,session_id desc limit 2),
 month_absences as (select * from observations where session_date>=date_trunc('month',now() at time zone 'Asia/Ho_Chi_Minh')::date and attendance_status in ('excused_absence','unexcused_absence'))
 select (case when (select count(*) from latest)=2 and (select bool_and(coalesce(attendance_status in ('excused_absence','unexcused_absence'),false)) from latest)
 then jsonb_build_object('absence_streak',(select jsonb_agg(to_jsonb(latest) order by session_date,start_time,session_id) from latest)) else '{}'::jsonb end)
 || (case when (select count(*) from month_absences)>=3 then jsonb_build_object('absence_month',(select jsonb_agg(to_jsonb(month_absences) order by session_date,start_time,session_id) from month_absences)) else '{}'::jsonb end)
 || (case when (select count(*) from scores)=2 and (select bool_and(test_score<6) from scores)
 then jsonb_build_object('low_test_streak',(select jsonb_agg(to_jsonb(scores) order by session_date,start_time,session_id) from scores)) else '{}'::jsonb end);
$$;

create function public.student_care_enqueue(p_student uuid)
returns void language sql security definer set search_path='' as $$
 insert into public.student_care_evaluation_queue(student_id) values(p_student)
 on conflict(student_id) do update set generation=student_care_evaluation_queue.generation+1,retry_at=now(),attempts=0,last_error=null;
$$;

create function public.student_care_source_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; sid uuid;
begin
 if tg_table_name in ('session_attendance','session_results','student_enrollments') then
  perform public.student_care_enqueue((row_data->>'student_id')::uuid);
  if tg_op='UPDATE' and old.student_id is distinct from new.student_id then perform public.student_care_enqueue(old.student_id); end if;
 elsif tg_table_name='students' then
  perform public.student_care_enqueue((row_data->>'id')::uuid);
 elsif tg_table_name='class_sessions' then
  -- Include old and new rosters on date/class moves, and historically recorded attendees.
  for sid in select distinct student_id from public.session_attendance where class_session_id=(row_data->>'id')::uuid
   union select e.student_id from public.student_enrollments e where e.class_id=(row_data->>'class_id')::uuid
    or (tg_op='UPDATE' and e.class_id=old.class_id)
    or exists(select 1 from public.class_component_links l where l.parent_class_id=e.class_id and (l.component_class_id=(row_data->>'class_id')::uuid or (tg_op='UPDATE' and l.component_class_id=old.class_id)))
  loop perform public.student_care_enqueue(sid); end loop;
 else
  -- Component-link changes are rare; enqueue all enrolled students to cover both endpoints.
  for sid in select distinct student_id from public.student_enrollments loop perform public.student_care_enqueue(sid); end loop;
 end if;
 return null;
end; $$;

create trigger student_care_attendance_changed after insert or update or delete on public.session_attendance for each row execute function public.student_care_source_changed();
create trigger student_care_results_changed after insert or update or delete on public.session_results for each row execute function public.student_care_source_changed();
create trigger student_care_session_changed after insert or update or delete on public.class_sessions for each row execute function public.student_care_source_changed();
create trigger student_care_enrollment_changed after insert or update or delete on public.student_enrollments for each row execute function public.student_care_source_changed();
create trigger student_care_component_changed after insert or update or delete on public.class_component_links for each row execute function public.student_care_source_changed();
create trigger student_care_student_changed after insert or update of lifecycle_status on public.students for each row execute function public.student_care_source_changed();

create function public.student_care_evaluate(p_student uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_evidence jsonb; previous jsonb; t public.student_care_tasks%rowtype; tid uuid; active_student boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_student::text,170));
 select lifecycle_status in ('active','resumed') into active_student from public.students where id=p_student;
 v_evidence:=case when active_student then public.student_care_calculate(p_student) else '{}'::jsonb end;
 select s.evidence into previous from public.student_care_signal_state s where student_id=p_student;
 insert into public.student_care_signal_state(student_id,evidence) values(p_student,v_evidence)
 on conflict(student_id) do update set evidence=excluded.evidence,evaluated_at=now();
 select * into t from public.student_care_tasks where student_id=p_student and kind='alert' and status not in ('completed','cancelled') for update;
 if v_evidence='{}'::jsonb then
  if found and t.evidence_current then
   update public.student_care_tasks set evidence_current=false,version=version+1,updated_at=now() where id=t.id;
   insert into public.student_care_events(student_id,task_id,event_type,payload)
   values(p_student,t.id,'signal_withdrawn',jsonb_build_object('source','system','reason','Dữ liệu hiện tại không còn đủ điều kiện; cần rà soát kết quả chăm sóc.'));
  end if;
 elsif v_evidence is distinct from previous then
  if t.id is null then
   insert into public.student_care_tasks(student_id,kind,evidence,claim_due_at,contact_due_at)
   values(p_student,'alert',v_evidence,now()+interval '24 hours',now()+interval '48 hours') returning id into tid;
  else
   tid:=t.id;
   update public.student_care_tasks set evidence=v_evidence,evidence_current=true,version=version+1,updated_at=now() where id=tid;
  end if;
  insert into public.student_care_events(student_id,task_id,event_type,payload)
  values(p_student,tid,'signals_updated',jsonb_build_object('source','system','evidence',v_evidence));
  -- First activation builds the full queue before sending one summary to all assistants.
  if exists(select 1 from public.student_care_settings where id and initialized_at is not null) then
   perform public.student_care_notify(tid,'detected','care:'||tid||':'||md5(v_evidence::text),case when t.owner_id is null then 'assistants' else 'owner' end);
  end if;
 end if;
end; $$;

create function public.student_care_reconcile()
returns void language plpgsql security definer set search_path='' as $$
declare month_date date:=date_trunc('month',now() at time zone 'Asia/Ho_Chi_Minh')::date;
 today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; s record; task_id uuid; assignee uuid; scheduled_day integer;
begin
 -- Reassigning inactive personnel is an explicit human decision; never silently lose the work.
 for s in select t.* from public.student_care_tasks t where t.status not in ('completed','cancelled') and t.owner_id is not null and not public.student_care_eligible_user(t.owner_id) loop
  perform pg_advisory_xact_lock(hashtextextended(s.student_id::text,170));
  update public.student_care_tasks set owner_id=null,status='open',version=version+1,updated_at=now() where id=s.id and owner_id=s.owner_id;
  if found then
   insert into public.student_care_events(student_id,task_id,event_type,payload) values(s.student_id,s.id,'owner_unavailable',jsonb_build_object('source','system','previous_owner',s.owner_id));
   perform public.student_care_notify(s.id,'escalated','owner-unavailable:'||s.id||':'||s.version,'escalation');
  end if;
 end loop;
 for s in select id from public.students where lifecycle_status in ('active','resumed') order by id loop
  perform pg_advisory_xact_lock(hashtextextended(s.id::text,170));
  select a.owner_id into assignee from public.student_care_assignments a where a.student_id=s.id and public.student_care_eligible_user(a.owner_id);
  scheduled_day:=greatest(extract(day from today)::integer,1+(abs(hashtextextended(s.id::text,0)::numeric)%25)::integer);
  insert into public.student_care_tasks(student_id,kind,period_month,owner_id,contact_due_at,due_at)
  values(s.id,'monthly',month_date,assignee,(month_date+(scheduled_day-1)+time '18:00') at time zone 'Asia/Ho_Chi_Minh',
   ((month_date+interval '1 month') at time zone 'Asia/Ho_Chi_Minh')-interval '1 microsecond')
  on conflict do nothing returning id into task_id;
  if task_id is not null then
   insert into public.student_care_events(student_id,task_id,event_type,payload)
   values(s.id,task_id,'monthly_created',jsonb_build_object('source','system','period',month_date));
  end if;
 end loop;
 -- Daily full reconciliation repairs missed triggers; hourly runs only reconcile obligations/owners.
 if not exists(select 1 from public.student_care_settings where id and (last_reconcile_at at time zone 'Asia/Ho_Chi_Minh')::date=today) then
  insert into public.student_care_evaluation_queue(student_id)
  select id from public.students where lifecycle_status in ('active','resumed')
  on conflict(student_id) do nothing;
 end if;
 update public.student_care_settings set last_reconcile_at=now() where id;
end; $$;

create function public.student_care_remind()
returns void language plpgsql security definer set search_path='' as $$
declare t public.student_care_tasks%rowtype; day_key text:=to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD');
 overdue_initial boolean; overdue_followup boolean; audience text;
begin
 for t in select * from public.student_care_tasks where kind<>'monthly' and status not in ('completed','cancelled') loop
  overdue_initial:=coalesce((t.owner_id is null and t.claim_due_at<now()) or (t.first_contact_at is null and t.contact_due_at<now()),false);
  overdue_followup:=coalesce(t.next_followup_at<now(),false);
  audience:=case when t.owner_id is null then 'assistants' else 'owner' end;
  if extract(hour from now() at time zone 'Asia/Ho_Chi_Minh')>=8 and (overdue_initial or overdue_followup or t.due_at<now()) then
   perform public.student_care_notify(t.id,'overdue','remind:'||t.id||':'||day_key,audience);
  end if;
  if (t.kind='alert' and overdue_initial and now()>t.detected_at+interval '72 hours')
   or (overdue_followup and now()>t.next_followup_at+interval '24 hours')
   or (t.kind='monthly' and t.due_at<now()) then
   perform public.student_care_notify(t.id,'escalated','escalate:'||t.id||':'||coalesce(t.next_followup_at::text,'initial'),'escalation');
  end if;
 end loop;
 -- One daily monthly-work digest per recipient, rather than a notification per student.
 if extract(hour from now() at time zone 'Asia/Ho_Chi_Minh')>=8 then
  insert into public.notifications(recipient_user_id,event_code,title,message,href,entity_type,entity_id,dedupe_key,metadata)
  select p.id,'student_care.monthly_due','Coaching tháng cần theo dõi',
   count(*)||' công việc Coaching tháng cần phân công hoặc đã đến hạn.','/student-care?kind=monthly',
   'student_care_month',to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYY-MM'),'care-monthly-digest:'||day_key,'{}'::jsonb
  from public.student_care_tasks m cross join public.profiles p
  where m.kind='monthly' and m.status not in ('completed','cancelled') and public.student_care_eligible_user(p.id)
  and ((m.owner_id=p.id and (m.contact_due_at<=now() or m.due_at<now() or m.next_followup_at<now()))
   or (public.student_care_eligible_user(p.id,'owner') and (m.owner_id is null or m.due_at<now() or m.next_followup_at<now()-interval '24 hours')))
  and exists(select 1 from public.user_role_assignments a join public.roles r on r.id=a.role_id and r.is_active
   join public.role_permissions rp on rp.role_id=r.id join public.permissions perm on perm.id=rp.permission_id
   where a.user_id=p.id and a.revoked_at is null and perm.code='notifications.view' and perm.is_active)
  group by p.id on conflict(recipient_user_id,dedupe_key) do nothing;
 end if;
end; $$;

create function public.run_student_care_worker()
returns jsonb language plpgsql security definer set search_path='' as $$
declare q record; done integer:=0; failures integer:=0; config public.student_care_settings%rowtype;
begin
 if not pg_try_advisory_xact_lock(9172026,1) then return jsonb_build_object('busy',true); end if;
 select * into config from public.student_care_settings where id;
 if not config.enabled then return jsonb_build_object('enabled',false); end if;
 -- Hourly catch-up covers students joining mid-month and revoked staff assignments.
 if config.last_reconcile_at is null or config.last_reconcile_at<now()-interval '1 hour'
  or (config.last_reconcile_at at time zone 'Asia/Ho_Chi_Minh')::date < (now() at time zone 'Asia/Ho_Chi_Minh')::date then
  perform public.student_care_reconcile();
 end if;
 for q in select * from public.student_care_evaluation_queue where retry_at<=now() order by queued_at,student_id limit 100 for update skip locked loop
  begin
   perform public.student_care_evaluate(q.student_id);
   delete from public.student_care_evaluation_queue where student_id=q.student_id and generation=q.generation;
   done:=done+1;
  exception when others then
   update public.student_care_evaluation_queue set attempts=attempts+1,retry_at=now()+interval '5 minutes',last_error=left(sqlerrm,300) where student_id=q.student_id;
   failures:=failures+1;
  end;
 end loop;
 if config.initialized_at is null and not exists(select 1 from public.student_care_evaluation_queue) then
  insert into public.notifications(recipient_user_id,event_code,title,message,href,entity_type,entity_id,dedupe_key,metadata)
  select p.id,'student_care.initialized','Danh sách chăm sóc đã sẵn sàng',
   (select count(*) from public.student_care_tasks where kind='alert' and status not in ('completed','cancelled'))||' học viên có cảnh báo cần hỗ trợ. Mở danh sách để nhận xử lý.',
   '/student-care','student_care_initialization','v1','student-care-initialized-v1','{}'::jsonb
  from public.profiles p where public.student_care_eligible_user(p.id)
   and exists(select 1 from public.user_role_assignments a join public.roles r on r.id=a.role_id and r.is_active
    join public.role_permissions rp on rp.role_id=r.id join public.permissions perm on perm.id=rp.permission_id
    where a.user_id=p.id and a.revoked_at is null and perm.code='notifications.view' and perm.is_active)
  on conflict(recipient_user_id,dedupe_key) do nothing;
  update public.student_care_settings set initialized_at=now() where id;
 end if;
 perform public.student_care_remind();
 update public.student_care_settings set last_success_at=now(),last_error=case when failures>0 then 'Một số học viên chưa được đánh giá; đang thử lại.' else null end where id;
 return jsonb_build_object('processed',done,'failed',failures);
end; $$;

revoke all on function public.student_care_observations(uuid),public.student_care_calculate(uuid),public.student_care_enqueue(uuid),public.student_care_source_changed(),public.student_care_evaluate(uuid),public.student_care_reconcile(),public.student_care_remind(),public.run_student_care_worker() from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('student-care-worker','* * * * *','select public.run_student_care_worker();');
 else raise warning 'STUDENT_CARE_CRON_UNAVAILABLE: install pg_cron and register student-care-worker before enabling automation';
 end if;
end; $$;
commit;
