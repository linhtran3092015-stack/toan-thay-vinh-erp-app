begin;

create function public.student_care_notify(p_task uuid,p_event text,p_key text,p_audience text default 'owner')
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(recipient_user_id,event_code,title,message,href,entity_type,entity_id,dedupe_key,metadata)
 select p.id,'student_care.'||p_event,
 case p_event when 'detected' then 'Học viên cần hỗ trợ' when 'escalated' then 'Chăm sóc học viên cần điều phối'
 when 'assigned' then 'Công việc chăm sóc được phân công' else 'Nhắc công việc chăm sóc đến hạn' end,
 left(s.full_name||' · '||case t.kind when 'monthly' then 'Coaching tháng '||to_char(t.period_month,'MM/YYYY') when 'alert' then 'Cảnh báo học tập / chuyên cần' else 'Theo dõi học viên' end,1000),
 '/student-care/'||t.id,'student_care_task',t.id::text,p_key,jsonb_build_object('task_id',t.id)
 from public.student_care_tasks t join public.students s on s.id=t.student_id
 cross join public.profiles p
 where t.id=p_task and public.student_care_eligible_user(p.id)
 and ((p_audience='assistants' and public.student_care_eligible_user(p.id,'assistant_manager'))
 or (p_audience='escalation' and public.student_care_eligible_user(p.id,'owner'))
 or (p_audience='owner' and p.id=t.owner_id))
 and exists(select 1 from public.user_role_assignments a join public.roles r on r.id=a.role_id and r.is_active
 join public.role_permissions rp on rp.role_id=r.id join public.permissions perm on perm.id=rp.permission_id
 where a.user_id=p.id and a.revoked_at is null and perm.code='notifications.view' and perm.is_active)
 on conflict(recipient_user_id,dedupe_key) do nothing;
end; $$;

create function public.mutate_student_care(p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 op text:=p_command->>'op'; actor uuid:=auth.uid(); tid uuid:=nullif(p_command->>'task_id','')::uuid;
 sid uuid:=nullif(p_command->>'student_id','')::uuid; rid uuid:=(p_command->>'request_id')::uuid;
 target uuid:=nullif(p_command->>'owner_id','')::uuid; note text:=nullif(btrim(p_command->>'note'),'');
 t public.student_care_tasks%rowtype; prior public.student_care_events%rowtype;
 ev uuid; contact public.student_care_events%rowtype; ctime timestamptz;
 next_at timestamptz:=nullif(p_command->>'next_followup_at','')::timestamptz;
 cid uuid; event_data jsonb; result jsonb; success boolean;
begin
 perform public.student_care_authorize('student_care.handle');
 if rid is null or op is null or jsonb_typeof(p_command)<>'object' or pg_column_size(p_command)>20000 then
  raise exception using errcode='22023',message='STUDENT_CARE_INVALID_COMMAND'; end if;
 -- Same request in concurrent sessions must not produce two contacts or Coaching records.
 perform pg_advisory_xact_lock(hashtextextended(rid::text,171));
 select * into prior from public.student_care_events where request_id=rid;
 if found then
  if prior.actor_id is distinct from actor or prior.payload->>'command_hash' is distinct from md5(p_command::text) then
   raise exception using errcode='23514',message='STUDENT_CARE_REQUEST_CONFLICT'; end if;
  return prior.payload->'result';
 end if;
 if next_at is not null and next_at<=now() then raise exception 'STUDENT_CARE_FOLLOWUP_MUST_BE_FUTURE'; end if;
 if note is not null and length(note)>4000 then raise exception 'STUDENT_CARE_NOTE_TOO_LONG'; end if;

 if op='configure' then
  perform public.student_care_authorize('student_care.configure');
  if jsonb_typeof(p_command->'enabled') is distinct from 'boolean' then raise exception 'STUDENT_CARE_INVALID_COMMAND'; end if;
  update public.student_care_settings set enabled=(p_command->>'enabled')::boolean,updated_at=now(),updated_by=actor where id;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data)
  values(actor,'student_care','automation_configured','student_care_settings','true',p_command);
  return jsonb_build_object('enabled',(p_command->>'enabled')::boolean);
 end if;
 if tid is not null then
  select student_id into sid from public.student_care_tasks where id=tid;
 end if;
 if sid is null or not exists(select 1 from public.students where id=sid) then raise exception 'STUDENT_CARE_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text,170));

 if op='assign_student' then
  perform public.student_care_authorize('student_care.assign');
  if not public.student_care_eligible_user(target) or note is null then raise exception 'STUDENT_CARE_ASSIGNEE_OR_REASON_REQUIRED'; end if;
  insert into public.student_care_assignments(student_id,owner_id,updated_by) values(sid,target,actor)
  on conflict(student_id) do update set owner_id=excluded.owner_id,updated_at=now(),updated_by=actor;
  for t in select * from public.student_care_tasks where student_id=sid and kind in ('monthly','followup') and status not in ('completed','cancelled') for update loop
   update public.student_care_tasks set owner_id=target,version=version+1,updated_at=now() where id=t.id;
   perform public.student_care_notify(t.id,'assigned','assigned:'||rid||':'||t.id);
  end loop;
 elsif op='create_followup' then
  if next_at is null or note is null then raise exception 'STUDENT_CARE_FOLLOWUP_REQUIRED'; end if;
  insert into public.student_care_tasks(student_id,kind,owner_id,status,claimed_at,next_followup_at)
  values(sid,'followup',actor,'in_progress',now(),next_at) returning id into tid;
 else
  select * into t from public.student_care_tasks where id=tid for update;
  if not found then raise exception 'STUDENT_CARE_NOT_FOUND'; end if;
  if t.version is distinct from (p_command->>'version')::integer then raise exception using errcode='40001',message='STUDENT_CARE_STALE_VERSION'; end if;
  if t.status in ('completed','cancelled') then raise exception 'STUDENT_CARE_TASK_CLOSED'; end if;
  if op='claim' then
   if t.owner_id is not null and t.owner_id<>actor then raise exception 'STUDENT_CARE_ALREADY_CLAIMED'; end if;
   update public.student_care_tasks set owner_id=actor,claimed_at=coalesce(claimed_at,now()),status='in_progress' where id=tid;
  elsif op='assign' then
   perform public.student_care_authorize('student_care.assign');
   if not public.student_care_eligible_user(target) or note is null then raise exception 'STUDENT_CARE_ASSIGNEE_OR_REASON_REQUIRED'; end if;
   update public.student_care_tasks set owner_id=target,claimed_at=coalesce(claimed_at,now()) where id=tid;
   perform public.student_care_notify(tid,'assigned','assigned:'||rid);
  else
   if t.owner_id is distinct from actor and not public.has_permission('student_care.assign') then raise exception using errcode='42501',message='STUDENT_CARE_NOT_YOUR_TASK'; end if;
   if t.owner_id is null then raise exception 'STUDENT_CARE_CLAIM_FIRST'; end if;
   if op='contact' then
    success:=coalesce((p_command->>'success')::boolean,false);
    ctime:=coalesce(nullif(p_command->>'contact_at','')::timestamptz,now());
    if ctime>now() or ctime<t.detected_at-interval '31 days' or note is null
     or coalesce(p_command->>'recipient','') not in ('guardian','student','both')
     or coalesce(p_command->>'channel','') not in ('phone','zalo','in_person','other')
     then raise exception 'STUDENT_CARE_CONTACT_INVALID'; end if;
    if not success and next_at is null then raise exception 'STUDENT_CARE_FOLLOWUP_REQUIRED'; end if;
    if success and (nullif(btrim(p_command->>'strengths'),'') is null or nullif(btrim(p_command->>'difficulties'),'') is null
     or nullif(btrim(p_command->>'plan'),'') is null or nullif(btrim(p_command->>'outcome'),'') is null or (next_at is null and t.kind<>'followup'))
     then raise exception 'STUDENT_CARE_CONTACT_CHECKLIST_REQUIRED'; end if;
    update public.student_care_tasks set first_contact_at=case when first_contact_at is null then ctime else least(first_contact_at,ctime) end,
     next_followup_at=next_at,status='following_up' where id=tid;
    event_data:=jsonb_build_object('success',success,'contact_at',ctime,'recipient',p_command->>'recipient','channel',p_command->>'channel',
     'strengths',p_command->>'strengths','difficulties',p_command->>'difficulties','plan',p_command->>'plan','outcome',p_command->>'outcome');
   elsif op='schedule' then
    if next_at is null or note is null then raise exception 'STUDENT_CARE_FOLLOWUP_REQUIRED'; end if;
    update public.student_care_tasks set next_followup_at=next_at,status='following_up' where id=tid;
   elsif op='complete' then
    if note is null then raise exception 'STUDENT_CARE_OUTCOME_REQUIRED'; end if;
    select * into contact from public.student_care_events where id=nullif(p_command->>'contact_event_id','')::uuid
     and student_id=sid and event_type='contact' and payload->>'success'='true';
    if not found then raise exception 'STUDENT_CARE_SUCCESSFUL_CONTACT_REQUIRED'; end if;
    ctime:=(contact.payload->>'contact_at')::timestamptz;
    if t.kind='monthly' then
     if (ctime at time zone 'Asia/Ho_Chi_Minh')::date<t.period_month then raise exception 'STUDENT_CARE_CONTACT_WRONG_PERIOD'; end if;
     insert into public.student_care_monthly_contacts(task_id,contact_event_id) values(tid,contact.id);
    elsif contact.task_id is distinct from tid then raise exception 'STUDENT_CARE_CONTACT_WRONG_TASK'; end if;
    -- Keep the promised follow-up visible after completing this obligation.
    if t.next_followup_at is not null then
     insert into public.student_care_tasks(student_id,kind,owner_id,status,claimed_at,next_followup_at,evidence)
     values(sid,'followup',t.owner_id,'in_progress',now(),t.next_followup_at,jsonb_build_object('source_task_id',tid)) returning id into cid;
    end if;
    update public.student_care_tasks set status='completed',completed_at=now(),outcome=note,next_followup_at=null where id=tid;
    event_data:=jsonb_build_object('contact_event_id',contact.id,'followup_task_id',cid,'completed_late',t.due_at is not null and now()>t.due_at);
   elsif op='cancel' then
    perform public.student_care_authorize('student_care.assign');
    if note is null then raise exception 'STUDENT_CARE_REASON_REQUIRED'; end if;
    update public.student_care_tasks set status='cancelled',completed_at=now(),outcome=note where id=tid;
   elsif op='coaching' then
    if note is null or next_at is null then raise exception 'STUDENT_CARE_FOLLOWUP_REQUIRED'; end if;
    cid:=nullif(p_command->>'coaching_id','')::uuid;
    if cid is null then
     select id into cid from public.create_coaching_record(sid,'Chăm sóc học viên',note,'high',t.owner_id,(next_at at time zone 'Asia/Ho_Chi_Minh')::date);
    elsif not public.has_permission('coaching.view') or not exists(select 1 from public.coaching_records where id=cid and student_id=sid) then
     raise exception 'STUDENT_CARE_COACHING_INVALID'; end if;
    insert into public.student_care_coaching_links(task_id,coaching_id,created_by) values(tid,cid,actor) on conflict do nothing;
    update public.student_care_tasks set status='following_up',next_followup_at=next_at where id=tid;
    event_data:=jsonb_build_object('coaching_id',cid);
   else raise exception 'STUDENT_CARE_UNKNOWN_OPERATION';
   end if;
  end if;
  update public.student_care_tasks set version=version+1,updated_at=now() where id=tid;
 end if;
 result:=jsonb_build_object('task_id',tid,'student_id',sid,'coaching_id',case when op='coaching' then cid else null end);
 insert into public.student_care_events(student_id,task_id,event_type,actor_id,payload,request_id)
 values(sid,tid,op,actor,coalesce(event_data,'{}'::jsonb)||jsonb_build_object('note',note,'owner_id',target,'next_followup_at',next_at,'command_hash',md5(p_command::text),'result',result),rid)
 returning id into ev;
 return result;
end; $$;

create function public.get_student_care_dashboard(p_filter jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; page_no integer:=greatest(1,least(coalesce((p_filter->>'page')::integer,1),100000));
 month_date date:=date_trunc('month',coalesce(nullif(p_filter->>'month','')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date))::date;
begin
 perform public.student_care_authorize('student_care.view');
 with filtered as (
  select t.*,s.full_name,s.public_code,s.lifecycle_status,p.display_name as owner_name,
   coalesce((t.status not in ('completed','cancelled') and ((t.owner_id is null and t.claim_due_at<now()) or (t.first_contact_at is null and t.contact_due_at<now()) or t.due_at<now() or t.next_followup_at<now())),false) as overdue
  from public.student_care_tasks t join public.students s on s.id=t.student_id left join public.profiles p on p.id=t.owner_id
  where (coalesce(p_filter->>'kind','')='' or t.kind=p_filter->>'kind')
  and (t.kind<>'monthly' or t.period_month=month_date)
  and (coalesce(p_filter->>'student_id','')='' or t.student_id=(p_filter->>'student_id')::uuid)
  and (coalesce(p_filter->>'mine','false')<>'true' or t.owner_id=auth.uid())
  and (coalesce(p_filter->>'status','')='' or (p_filter->>'status'='unassigned' and t.owner_id is null and t.status not in ('completed','cancelled')) or t.status=p_filter->>'status')
  and (coalesce(p_filter->>'search','')='' or s.full_name ilike '%'||(p_filter->>'search')||'%' or s.public_code ilike '%'||(p_filter->>'search')||'%')
 ), selected as (select * from filtered where coalesce(p_filter->>'overdue','false')<>'true' or overdue),
 rows as (select * from selected order by overdue desc,detected_at desc,id limit 50 offset (page_no-1)*50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(rows)) from rows),'[]'::jsonb),'total',(select count(*) from selected)) into result;
 return result||jsonb_build_object('page',page_no,'month',month_date,'settings',(select to_jsonb(s) from public.student_care_settings s where id),
 'queue',jsonb_build_object('pending',(select count(*) from public.student_care_evaluation_queue),'failed',(select count(*) from public.student_care_evaluation_queue where attempts>0)),
 'summary',(select jsonb_build_object('open_alerts',count(*) filter(where kind='alert' and status not in ('completed','cancelled')),
 'unassigned',count(*) filter(where owner_id is null and status not in ('completed','cancelled')),
 'monthly_total',count(*) filter(where kind='monthly' and period_month=month_date),
 'monthly_completed',count(*) filter(where kind='monthly' and period_month=month_date and status='completed'),
 'monthly_cancelled',count(*) filter(where kind='monthly' and period_month=month_date and status='cancelled'),
 'monthly_on_time',count(*) filter(where kind='monthly' and period_month=month_date and status='completed' and completed_at<=due_at),
 'overdue',count(*) filter(where status not in ('completed','cancelled') and ((owner_id is null and claim_due_at<now()) or (first_contact_at is null and contact_due_at<now()) or next_followup_at<now() or due_at<now()))) from public.student_care_tasks),
 'assignees',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'open_tasks',(select count(*) from public.student_care_tasks t where t.owner_id=p.id and t.status not in ('completed','cancelled')))) from public.profiles p where public.student_care_eligible_user(p.id)),'[]'::jsonb));
end; $$;

create function public.get_student_care_detail(p_task_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t public.student_care_tasks%rowtype;
begin
 perform public.student_care_authorize('student_care.view');
 select * into t from public.student_care_tasks where id=p_task_id;
 if not found then return null; end if;
 return jsonb_build_object('task',to_jsonb(t),'student',(select jsonb_build_object('id',s.id,'full_name',s.full_name,'public_code',s.public_code,'lifecycle_status',s.lifecycle_status) from public.students s where s.id=t.student_id),
 'events',coalesce((select jsonb_agg(x order by x.occurred_at desc,x.id) from (select e.id,e.task_id,e.event_type,e.payload-'command_hash'-'result' as payload,e.occurred_at,p.display_name as actor_name from public.student_care_events e left join public.profiles p on p.id=e.actor_id where e.student_id=t.student_id order by e.occurred_at desc,e.id limit 200) x),'[]'::jsonb),
 'contacts',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'contact_at',e.payload->>'contact_at','note',e.payload->>'note')) from public.student_care_events e where e.student_id=t.student_id and e.event_type='contact' and e.payload->>'success'='true'
 and ((t.kind='monthly' and (e.payload->>'contact_at')::timestamptz >= t.period_month::timestamp at time zone 'Asia/Ho_Chi_Minh' and not exists(select 1 from public.student_care_monthly_contacts mc where mc.contact_event_id=e.id)) or (t.kind<>'monthly' and e.task_id=t.id))),'[]'::jsonb),
 'coaching',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'campaign_name',c.campaign_name)) from public.student_care_coaching_links l join public.coaching_records c on c.id=l.coaching_id where l.task_id=t.id),'[]'::jsonb),
 'available_coaching',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'campaign_name',c.campaign_name) order by c.created_at desc) from public.coaching_records c where c.student_id=t.student_id and public.has_permission('coaching.view')),'[]'::jsonb),
 'assignment',(select to_jsonb(a) from public.student_care_assignments a where a.student_id=t.student_id),
 'assignees',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name)) from public.profiles p where public.student_care_eligible_user(p.id)),'[]'::jsonb));
end; $$;

create function public.get_student_care_students(p_search text default '',p_page integer default 1,p_inactive boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.student_care_authorize('student_care.view');
 return (with filtered as (select s.id,s.full_name,s.public_code,s.lifecycle_status,a.owner_id,p.display_name as owner_name
 from public.students s left join public.student_care_assignments a on a.student_id=s.id left join public.profiles p on p.id=a.owner_id
 where (case when p_inactive then s.lifecycle_status in ('reserved','completed','waiting_class') else s.lifecycle_status in ('active','resumed') end)
 and (p_search='' or s.full_name ilike '%'||p_search||'%' or s.public_code ilike '%'||p_search||'%')),
 rows as (select * from filtered order by full_name,id limit 50 offset (greatest(1,least(p_page,100000))-1)*50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(rows)) from rows),'[]'::jsonb),'total',(select count(*) from filtered)));
end; $$;

revoke all on function public.student_care_notify(uuid,text,text,text),public.mutate_student_care(jsonb),public.get_student_care_dashboard(jsonb),public.get_student_care_detail(uuid),public.get_student_care_students(text,integer,boolean) from public,anon,authenticated;
grant execute on function public.mutate_student_care(jsonb),public.get_student_care_dashboard(jsonb),public.get_student_care_detail(uuid),public.get_student_care_students(text,integer,boolean) to authenticated;
commit;
