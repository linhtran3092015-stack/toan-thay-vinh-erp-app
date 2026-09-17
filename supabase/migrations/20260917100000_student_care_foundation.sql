begin;

insert into public.permissions(code,module,name,description) values
 ('student_care.view','student_care','Xem chăm sóc học viên','Xem công việc, bằng chứng và lịch sử chăm sóc.'),
 ('student_care.handle','student_care','Xử lý chăm sóc học viên','Nhận việc và xử lý công việc được phân công.'),
 ('student_care.assign','student_care','Điều phối chăm sóc','Phân công, chuyển giao và duyệt ngoại lệ.'),
 ('student_care.configure','student_care','Cấu hình chăm sóc','Bật hoặc tạm dừng xử lý tự động.')
on conflict(code) do update set name=excluded.name,description=excluded.description,is_active=true;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.module='student_care'
where r.code='owner' or (r.code='assistant_manager' and p.code in ('student_care.view','student_care.handle'))
on conflict do nothing;

create table public.student_care_settings (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 policy_version integer not null default 1 check(policy_version=1),
 initialized_at timestamptz,
 last_success_at timestamptz,
 last_reconcile_at timestamptz,
 last_error text,
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id)
);
insert into public.student_care_settings(id) values(true);
comment on table public.student_care_settings is 'Policy v1: CP/KP >=2 consecutive or >=3/calendar month; latest two scored tests <6; claim/contact/escalation 24/48/72 hours; follow-up escalation +24h. Disabled until staging validation and explicit activation.';

create table public.student_care_assignments (
 student_id uuid primary key references public.students(id) on delete restrict,
 owner_id uuid not null references public.profiles(id) on delete restrict,
 updated_at timestamptz not null default now(),
 updated_by uuid not null references public.profiles(id)
);
create table public.student_care_tasks (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.students(id) on delete restrict,
 kind text not null check(kind in ('alert','monthly','followup')),
 period_month date,
 status text not null default 'open' check(status in ('open','in_progress','following_up','completed','cancelled')),
 owner_id uuid references public.profiles(id) on delete restrict,
 policy_version integer not null default 1 check(policy_version=1),
 evidence jsonb not null default '{}'::jsonb,
 evidence_current boolean not null default true,
 detected_at timestamptz not null default now(),
 claimed_at timestamptz,
 claim_due_at timestamptz,
 contact_due_at timestamptz,
 first_contact_at timestamptz,
 due_at timestamptz,
 next_followup_at timestamptz,
 completed_at timestamptz,
 outcome text,
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 check ((kind='monthly' and period_month is not null and extract(day from period_month)=1) or (kind<>'monthly' and period_month is null)),
 check ((status in ('completed','cancelled')) = (completed_at is not null)),
 check (status not in ('in_progress','following_up') or owner_id is not null),
 check (outcome is null or length(outcome) between 1 and 4000)
);
create unique index student_care_month_unique on public.student_care_tasks(student_id,period_month) where kind='monthly';
create unique index student_care_open_alert_unique on public.student_care_tasks(student_id) where kind='alert' and status not in ('completed','cancelled');
create index student_care_tasks_work_idx on public.student_care_tasks(status,owner_id,contact_due_at,next_followup_at);
create index student_care_tasks_student_idx on public.student_care_tasks(student_id,detected_at desc,id);
create index student_care_tasks_month_idx on public.student_care_tasks(period_month,status) where kind='monthly';

create table public.student_care_events (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.students(id) on delete restrict,
 task_id uuid references public.student_care_tasks(id) on delete restrict,
 event_type text not null,
 actor_id uuid references public.profiles(id) on delete restrict,
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 request_id uuid unique,
 occurred_at timestamptz not null default now()
);
create index student_care_events_task_idx on public.student_care_events(task_id,occurred_at,id);
create table public.student_care_monthly_contacts (
 task_id uuid primary key references public.student_care_tasks(id) on delete restrict,
 contact_event_id uuid not null unique references public.student_care_events(id) on delete restrict
);
create table public.student_care_coaching_links (
 task_id uuid not null references public.student_care_tasks(id) on delete restrict,
 coaching_id uuid not null references public.coaching_records(id) on delete restrict,
 created_at timestamptz not null default now(),
 created_by uuid not null references public.profiles(id),
 primary key(task_id,coaching_id)
);
create table public.student_care_evaluation_queue (
 student_id uuid primary key references public.students(id) on delete restrict,
 generation bigint not null default 1,
 queued_at timestamptz not null default now(),
 retry_at timestamptz not null default now(),
 attempts integer not null default 0,
 last_error text
);
create table public.student_care_signal_state (
 student_id uuid primary key references public.students(id) on delete restrict,
 evidence jsonb not null default '{}'::jsonb,
 evaluated_at timestamptz not null default now()
);

create function public.student_care_eligible_user(p_user uuid, p_role text default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p
 join public.user_role_assignments a on a.user_id=p.id and a.revoked_at is null
 join public.roles r on r.id=a.role_id and r.is_active and r.code in ('owner','assistant_manager')
 join public.role_permissions rp on rp.role_id=r.id
 join public.permissions perm on perm.id=rp.permission_id and perm.code='student_care.handle' and perm.is_active
 where p.id=p_user and p.employment_status='active' and (p_role is null or r.code=p_role));
$$;
create function public.student_care_authorize(p_permission text)
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.student_care_eligible_user(auth.uid()) or not public.has_permission(p_permission)
 then raise exception using errcode='42501',message='STUDENT_CARE_PERMISSION_DENIED'; end if;
end; $$;
create function public.student_care_protect_history()
returns trigger language plpgsql set search_path='' as $$
begin raise exception using errcode='23514',message='STUDENT_CARE_HISTORY_IMMUTABLE'; end; $$;
create trigger student_care_events_immutable before update or delete on public.student_care_events
for each row execute function public.student_care_protect_history();
create trigger student_care_contacts_immutable before update or delete on public.student_care_monthly_contacts
for each row execute function public.student_care_protect_history();
create trigger student_care_links_immutable before update or delete on public.student_care_coaching_links
for each row execute function public.student_care_protect_history();

do $$ declare t text; begin
 foreach t in array array['student_care_settings','student_care_assignments','student_care_tasks','student_care_events','student_care_monthly_contacts','student_care_coaching_links','student_care_evaluation_queue','student_care_signal_state'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
 end loop;
end; $$;
revoke all on function public.student_care_eligible_user(uuid,text),public.student_care_authorize(text),public.student_care_protect_history() from public,anon,authenticated;
commit;
