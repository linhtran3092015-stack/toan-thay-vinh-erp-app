-- Sửa leo thang công việc Coaching tháng không bao giờ chạy.
--
-- student_care_remind lặp qua `kind <> 'monthly'` nhưng bên trong lại kiểm
-- tra `kind = 'monthly' and due_at < now()` để leo thang, nên nhánh đó là
-- mã chết. Nay lặp qua mọi công việc chưa kết thúc; nhắc "quá hạn" hằng ngày
-- vẫn chỉ áp dụng cho alert/followup (công việc tháng đã có bản tin tổng
-- hợp riêng), còn leo thang áp dụng cho cả công việc tháng quá hạn.

begin;

create or replace function public.student_care_remind()
returns void language plpgsql security definer set search_path='' as $$
declare t public.student_care_tasks%rowtype; day_key text:=to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD');
 overdue_initial boolean; overdue_followup boolean; audience text;
begin
 for t in select * from public.student_care_tasks where status not in ('completed','cancelled') loop
  overdue_initial:=coalesce((t.owner_id is null and t.claim_due_at<now()) or (t.first_contact_at is null and t.contact_due_at<now()),false);
  overdue_followup:=coalesce(t.next_followup_at<now(),false);
  audience:=case when t.owner_id is null then 'assistants' else 'owner' end;
  if t.kind<>'monthly' and extract(hour from now() at time zone 'Asia/Ho_Chi_Minh')>=8 and (overdue_initial or overdue_followup or t.due_at<now()) then
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

commit;
