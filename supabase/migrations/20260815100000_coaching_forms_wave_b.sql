begin;

-- Wave B: additive form/version/link/response layer for the existing immutable
-- coaching record history. Public submissions never receive table privileges.

insert into public.permissions (code, module, name, description)
values
  ('coaching_forms.view', 'coaching_forms', 'Xem biểu mẫu Coaching', 'Xem biểu mẫu Coaching và phiên bản.'),
  ('coaching_forms.manage', 'coaching_forms', 'Soạn biểu mẫu Coaching', 'Tạo và chỉnh sửa bản nháp biểu mẫu Coaching.'),
  ('coaching_forms.publish', 'coaching_forms', 'Xuất bản biểu mẫu Coaching', 'Xuất bản phiên bản biểu mẫu Coaching.'),
  ('coaching_forms.close', 'coaching_forms', 'Lưu trữ biểu mẫu Coaching', 'Lưu trữ biểu mẫu Coaching.'),
  ('coaching_links.manage', 'coaching_links', 'Quản lý liên kết Coaching', 'Phát hành và thu hồi liên kết Coaching công khai.'),
  ('coaching_responses.view', 'coaching_responses', 'Xem phản hồi Coaching', 'Xem phản hồi biểu mẫu Coaching.')
on conflict (code) do update set module = excluded.module, name = excluded.name, description = excluded.description, is_active = true;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission on permission.code in (
  'coaching_forms.view','coaching_forms.manage','coaching_forms.publish',
  'coaching_forms.close','coaching_links.manage','coaching_responses.view'
)
where role.code in ('owner', 'assistant_manager')
on conflict (role_id, permission_id) do nothing;

create table public.coaching_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete restrict,
  constraint coaching_forms_name_check check (name = pg_catalog.btrim(name) and name <> '' and pg_catalog.length(name) <= 240)
);

create table public.coaching_form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.coaching_forms(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  title text not null,
  instructions text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  constraint coaching_form_versions_number_key unique (form_id, version_number),
  constraint coaching_form_versions_title_check check (title = pg_catalog.btrim(title) and title <> '' and pg_catalog.length(title) <= 240),
  constraint coaching_form_versions_instructions_check check (instructions is null or pg_catalog.length(instructions) <= 4000),
  constraint coaching_form_versions_published_check check ((status <> 'published') or (published_by is not null and published_at is not null))
);

create unique index coaching_form_versions_single_draft_idx on public.coaching_form_versions(form_id) where status = 'draft';
create index coaching_form_versions_form_idx on public.coaching_form_versions(form_id, version_number desc);

create table public.coaching_form_questions (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null references public.coaching_form_versions(id) on delete restrict,
  question_type text not null check (question_type in ('short_text','long_text','single_choice','multiple_choice','scale','number')),
  title text not null,
  description text,
  is_required boolean not null default false,
  sort_order integer not null check (sort_order > 0),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  constraint coaching_form_questions_version_order_key unique (form_version_id, sort_order),
  constraint coaching_form_questions_title_check check (title = pg_catalog.btrim(title) and title <> '' and pg_catalog.length(title) <= 1000),
  constraint coaching_form_questions_description_check check (description is null or pg_catalog.length(description) <= 4000),
  constraint coaching_form_questions_configuration_object check (pg_catalog.jsonb_typeof(configuration) = 'object')
);
create index coaching_form_questions_version_idx on public.coaching_form_questions(form_version_id, sort_order);

create table public.coaching_public_links (
  id uuid primary key default gen_random_uuid(),
  coaching_record_id uuid not null references public.coaching_records(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  form_version_id uuid not null references public.coaching_form_versions(id) on delete restrict,
  token_hash text not null unique,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','submitted','revoked')),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default pg_catalog.now(),
  revoked_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  revoke_reason text,
  constraint coaching_public_links_expiry_check check (expires_at > issued_at),
  constraint coaching_public_links_revoke_check check ((status <> 'revoked') or (revoked_by is not null and revoked_at is not null)),
  constraint coaching_public_links_revoke_reason_check check (revoke_reason is null or (revoke_reason = pg_catalog.btrim(revoke_reason) and revoke_reason <> '' and pg_catalog.length(revoke_reason) <= 1000))
);
create unique index coaching_public_links_one_active_student_version_idx on public.coaching_public_links(student_id, form_version_id) where status = 'active';
create index coaching_public_links_record_idx on public.coaching_public_links(coaching_record_id, issued_at desc);
create index coaching_public_links_hash_idx on public.coaching_public_links(token_hash);

create table public.coaching_form_responses (
  id uuid primary key default gen_random_uuid(),
  public_link_id uuid not null unique references public.coaching_public_links(id) on delete restrict,
  coaching_record_id uuid not null references public.coaching_records(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  form_id uuid not null references public.coaching_forms(id) on delete restrict,
  form_version_id uuid not null references public.coaching_form_versions(id) on delete restrict,
  submitted_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now()
);
create index coaching_form_responses_record_idx on public.coaching_form_responses(coaching_record_id, submitted_at desc);
create index coaching_form_responses_form_idx on public.coaching_form_responses(form_id, form_version_id, submitted_at desc);

create table public.coaching_form_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.coaching_form_responses(id) on delete restrict,
  question_id uuid not null references public.coaching_form_questions(id) on delete restrict,
  answer jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint coaching_form_answers_response_question_key unique (response_id, question_id)
);
create index coaching_form_answers_response_idx on public.coaching_form_answers(response_id);

create or replace function public.coaching_validate_question(p_question_type text, p_configuration jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_options jsonb; v_min numeric; v_max numeric;
begin
  if p_configuration is null or pg_catalog.jsonb_typeof(p_configuration) <> 'object' then return false; end if;
  if p_question_type in ('short_text','long_text') then return p_configuration = '{}'::jsonb; end if;
  if p_question_type in ('single_choice','multiple_choice') then
    v_options := p_configuration->'options';
    return pg_catalog.jsonb_typeof(v_options) = 'array' and pg_catalog.jsonb_array_length(v_options) between 1 and 50
      and not exists (select 1 from pg_catalog.jsonb_array_elements_text(v_options) x where pg_catalog.btrim(x.value) = '' or pg_catalog.length(x.value) > 500)
      and (select count(*) = count(distinct value) from pg_catalog.jsonb_array_elements_text(v_options));
  end if;
  if p_question_type = 'scale' then
    begin v_min := (p_configuration->>'min')::numeric; v_max := (p_configuration->>'max')::numeric; exception when others then return false; end;
    return v_min = pg_catalog.trunc(v_min) and v_max = pg_catalog.trunc(v_max) and v_min >= 0 and v_max <= 10 and v_min < v_max;
  end if;
  if p_question_type = 'number' then
    begin
      if p_configuration ? 'min' then perform (p_configuration->>'min')::numeric; end if;
      if p_configuration ? 'max' then perform (p_configuration->>'max')::numeric; end if;
      if p_configuration ? 'min' and p_configuration ? 'max' and (p_configuration->>'min')::numeric > (p_configuration->>'max')::numeric then return false; end if;
    exception when others then return false; end;
    return true;
  end if;
  return false;
end; $$;
revoke all on function public.coaching_validate_question(text,jsonb) from public, anon, authenticated;

alter table public.coaching_form_questions add constraint coaching_form_questions_configuration_valid check (public.coaching_validate_question(question_type, configuration));

create or replace function public.prevent_published_coaching_version_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'published' then raise exception using errcode='23514', message='COACHING_FORM_VERSION_IMMUTABLE'; end if;
  return new;
end; $$;
create trigger coaching_form_versions_published_immutable before update or delete on public.coaching_form_versions for each row execute function public.prevent_published_coaching_version_mutation();

create or replace function public.prevent_published_coaching_question_mutation()
returns trigger language plpgsql set search_path = '' as $$
declare v_status text;
begin
  select status into v_status from public.coaching_form_versions where id = coalesce(old.form_version_id,new.form_version_id);
  if v_status = 'published' then raise exception using errcode='23514', message='COACHING_FORM_VERSION_IMMUTABLE'; end if;
  return coalesce(new,old);
end; $$;
create trigger coaching_form_questions_published_immutable before update or delete on public.coaching_form_questions for each row execute function public.prevent_published_coaching_question_mutation();

create or replace function public.prevent_coaching_response_mutation()
returns trigger language plpgsql set search_path = '' as $$ begin raise exception using errcode='23514', message='COACHING_RESPONSE_IMMUTABLE'; end; $$;
create trigger coaching_form_responses_immutable before update or delete on public.coaching_form_responses for each row execute function public.prevent_coaching_response_mutation();
create trigger coaching_form_answers_immutable before update or delete on public.coaching_form_answers for each row execute function public.prevent_coaching_response_mutation();

create or replace function public.audit_coaching_form_mutation(p_action text, p_entity_type text, p_entity_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,reason) values(auth.uid(),'coaching',p_action,p_entity_type,p_entity_id::text,p_reason); end; $$;
revoke all on function public.audit_coaching_form_mutation(text,text,uuid,text) from public, anon, authenticated;

create or replace function public.save_coaching_form_draft(p_form_id uuid, p_name text, p_title text, p_instructions text, p_questions jsonb)
returns table(form_id uuid, form_version_id uuid, version_number integer)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_form uuid:=p_form_id; v_version uuid; v_number integer; v_q jsonb; v_index integer:=0;
begin
 if v_actor is null then raise exception using errcode='28000',message='AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('coaching_forms.manage') then raise exception using errcode='42501',message='COACHING_FORM_MANAGE_PERMISSION_DENIED'; end if;
 if p_name is null or pg_catalog.btrim(p_name)='' or pg_catalog.length(p_name)>240 or p_title is null or pg_catalog.btrim(p_title)='' or pg_catalog.length(p_title)>240 or p_instructions is not null and pg_catalog.length(p_instructions)>4000 or pg_catalog.jsonb_typeof(p_questions)<>'array' then raise exception using errcode='22023',message='COACHING_FORM_DRAFT_INVALID'; end if;
 if v_form is null then
   insert into public.coaching_forms(name,created_by) values(pg_catalog.btrim(p_name),v_actor) returning id into v_form;
   insert into public.coaching_form_versions(form_id,version_number,title,instructions,created_by) values(v_form,1,pg_catalog.btrim(p_title),nullif(pg_catalog.btrim(p_instructions),''),v_actor) returning id, public.coaching_form_versions.version_number into v_version,v_number;
   perform public.audit_coaching_form_mutation('coaching_form_created','coaching_form',v_form,null);
 else
   select version.id,version.version_number into v_version,v_number from public.coaching_form_versions as version where version.form_id=v_form and version.status='draft' for update;
   if not found then raise exception using errcode='23514',message='COACHING_FORM_DRAFT_NOT_FOUND'; end if;
   update public.coaching_forms set name=pg_catalog.btrim(p_name) where id=v_form and status='active';
   if not found then raise exception using errcode='23514',message='COACHING_FORM_ARCHIVED'; end if;
   update public.coaching_form_versions set title=pg_catalog.btrim(p_title),instructions=nullif(pg_catalog.btrim(p_instructions),'') where id=v_version;
   delete from public.coaching_form_questions as question where question.form_version_id=v_version;
 end if;
 for v_q in select value from pg_catalog.jsonb_array_elements(p_questions) loop
   v_index:=v_index+1;
   if not (v_q ? 'type' and v_q ? 'title') or v_q->>'type' not in ('short_text','long_text','single_choice','multiple_choice','scale','number') or pg_catalog.btrim(v_q->>'title')='' or pg_catalog.length(v_q->>'title')>1000 or not public.coaching_validate_question(v_q->>'type',coalesce(v_q->'configuration','{}'::jsonb)) then raise exception using errcode='22023',message='COACHING_FORM_QUESTION_INVALID'; end if;
   insert into public.coaching_form_questions(form_version_id,question_type,title,description,is_required,sort_order,configuration) values(v_version,v_q->>'type',pg_catalog.btrim(v_q->>'title'),nullif(pg_catalog.btrim(v_q->>'description'),''),coalesce((v_q->>'required')::boolean,false),v_index,coalesce(v_q->'configuration','{}'::jsonb));
 end loop;
 return query select v_form,v_version,v_number;
end; $$;

create or replace function public.publish_coaching_form_version(p_form_version_id uuid)
returns table(form_id uuid, form_version_id uuid, version_number integer)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_form uuid; v_number integer;
begin
 if v_actor is null then raise exception using errcode='28000',message='AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('coaching_forms.publish') then raise exception using errcode='42501',message='COACHING_FORM_PUBLISH_PERMISSION_DENIED'; end if;
 select version.form_id,version.version_number into v_form,v_number from public.coaching_form_versions as version where version.id=p_form_version_id and version.status='draft' for update;
 if not found then raise exception using errcode='23514',message='COACHING_FORM_DRAFT_NOT_FOUND'; end if;
 if not exists(select 1 from public.coaching_form_questions as question where question.form_version_id=p_form_version_id) then raise exception using errcode='23514',message='COACHING_FORM_QUESTIONS_REQUIRED'; end if;
 update public.coaching_form_versions set status='published',published_by=v_actor,published_at=pg_catalog.now() where id=p_form_version_id;
 perform public.audit_coaching_form_mutation('coaching_form_version_published','coaching_form_version',p_form_version_id,null);
 return query select v_form,p_form_version_id,v_number;
end; $$;

create or replace function public.create_coaching_form_version_draft(p_form_id uuid)
returns table(form_version_id uuid, version_number integer)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_source uuid; v_new uuid; v_number integer;
begin
 if v_actor is null then raise exception using errcode='28000',message='AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('coaching_forms.manage') then raise exception using errcode='42501',message='COACHING_FORM_MANAGE_PERMISSION_DENIED'; end if;
 if exists(select 1 from public.coaching_form_versions as version where version.form_id=p_form_id and version.status='draft') then raise exception using errcode='23514',message='COACHING_FORM_DRAFT_ALREADY_EXISTS'; end if;
 select version.id into v_source from public.coaching_form_versions as version where version.form_id=p_form_id and version.status='published' order by version.version_number desc limit 1;
 if v_source is null then raise exception using errcode='P0002',message='COACHING_FORM_PUBLISHED_VERSION_NOT_FOUND'; end if;
 select coalesce(max(version.version_number),0)+1 into v_number from public.coaching_form_versions as version where version.form_id=p_form_id;
 insert into public.coaching_form_versions(form_id,version_number,title,instructions,status,created_by) select source.form_id,v_number,source.title,source.instructions,'draft',v_actor from public.coaching_form_versions as source where source.id=v_source returning id into v_new;
 insert into public.coaching_form_questions(form_version_id,question_type,title,description,is_required,sort_order,configuration) select v_new,question.question_type,question.title,question.description,question.is_required,question.sort_order,question.configuration from public.coaching_form_questions as question where question.form_version_id=v_source order by question.sort_order;
 perform public.audit_coaching_form_mutation('coaching_form_version_draft_created','coaching_form_version',v_new,null);
 return query select v_new,v_number;
end; $$;

create or replace function public.issue_coaching_public_link(p_coaching_record_id uuid,p_form_version_id uuid,p_expires_at timestamptz,p_token_hash text)
returns table(link_id uuid)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_student uuid; v_link uuid;
begin
 if v_actor is null then raise exception using errcode='28000',message='AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('coaching_links.manage') then raise exception using errcode='42501',message='COACHING_LINK_MANAGE_PERMISSION_DENIED'; end if;
 if p_expires_at is null or p_expires_at <= pg_catalog.now() or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='COACHING_LINK_INVALID'; end if;
 select student_id into v_student from public.coaching_records where id=p_coaching_record_id for update;
 if v_student is null then raise exception using errcode='P0002',message='COACHING_RECORD_NOT_FOUND'; end if;
 if not exists(select 1 from public.coaching_form_versions where id=p_form_version_id and status='published') then raise exception using errcode='23514',message='COACHING_FORM_VERSION_NOT_PUBLISHED'; end if;
 update public.coaching_public_links set status='revoked',revoked_by=v_actor,revoked_at=pg_catalog.now(),revoke_reason='Được thay bằng liên kết mới' where student_id=v_student and form_version_id=p_form_version_id and status='active';
 insert into public.coaching_public_links(coaching_record_id,student_id,form_version_id,token_hash,expires_at,issued_by) values(p_coaching_record_id,v_student,p_form_version_id,p_token_hash,p_expires_at,v_actor) returning id into v_link;
 perform public.audit_coaching_form_mutation('coaching_public_link_issued','coaching_public_link',v_link,null);
 return query select v_link;
end; $$;

create or replace function public.revoke_coaching_public_link(p_link_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not public.has_permission('coaching_links.manage') then raise exception using errcode='42501',message='COACHING_LINK_MANAGE_PERMISSION_DENIED'; end if;
 if p_reason is null or pg_catalog.btrim(p_reason)='' then raise exception using errcode='22023',message='COACHING_LINK_REVOKE_REASON_REQUIRED'; end if;
 update public.coaching_public_links set status='revoked',revoked_by=v_actor,revoked_at=pg_catalog.now(),revoke_reason=pg_catalog.btrim(p_reason) where id=p_link_id and status='active';
 if not found then raise exception using errcode='23514',message='COACHING_LINK_NOT_ACTIVE'; end if;
 perform public.audit_coaching_form_mutation('coaching_public_link_revoked','coaching_public_link',p_link_id,pg_catalog.btrim(p_reason));
end; $$;

create or replace function public.get_public_coaching_form(p_token text)
returns table(state text, form_title text, instructions text, student_name text, form_version_id uuid, question_id uuid, question_type text, question_title text, question_description text, is_required boolean, sort_order integer, configuration jsonb)
language plpgsql stable security definer set search_path='' as $$
declare v_link public.coaching_public_links%rowtype; v_version public.coaching_form_versions%rowtype;
begin
 select * into v_link from public.coaching_public_links where token_hash=pg_catalog.encode(extensions.digest(p_token,'sha256'),'hex');
 if not found then return query select 'invalid'::text,null::text,null::text,null::text,null::uuid,null::uuid,null::text,null::text,null::text,null::boolean,null::integer,null::jsonb; return; end if;
 if v_link.status='submitted' then return query select 'submitted'::text,null::text,null::text,null::text,null::uuid,null::uuid,null::text,null::text,null::text,null::boolean,null::integer,null::jsonb; return; end if;
 if v_link.status='revoked' then return query select 'revoked'::text,null::text,null::text,null::text,null::uuid,null::uuid,null::text,null::text,null::text,null::boolean,null::integer,null::jsonb; return; end if;
 if v_link.expires_at <= pg_catalog.now() then return query select 'expired'::text,null::text,null::text,null::text,null::uuid,null::uuid,null::text,null::text,null::text,null::boolean,null::integer,null::jsonb; return; end if;
 select * into v_version from public.coaching_form_versions where id=v_link.form_version_id and status='published';
 if not found then return query select 'invalid'::text,null::text,null::text,null::text,null::uuid,null::uuid,null::text,null::text,null::text,null::boolean,null::integer,null::jsonb; return; end if;
 return query select 'active'::text,v_version.title,v_version.instructions,student.full_name,v_version.id,q.id,q.question_type,q.title,q.description,q.is_required,q.sort_order,q.configuration from public.students student join public.coaching_form_questions q on q.form_version_id=v_version.id where student.id=v_link.student_id order by q.sort_order;
end; $$;

create or replace function public.submit_public_coaching_form(p_token text,p_answers jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare v_link public.coaching_public_links%rowtype; v_version public.coaching_form_versions%rowtype; v_response uuid; v_question public.coaching_form_questions%rowtype; v_answer jsonb; v_options jsonb; v_count integer;
begin
 if p_token is null or pg_catalog.length(p_token)<32 or pg_catalog.jsonb_typeof(p_answers)<>'object' then raise exception using errcode='22023',message='COACHING_PUBLIC_SUBMISSION_INVALID'; end if;
 select * into v_link from public.coaching_public_links where token_hash=pg_catalog.encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found then raise exception using errcode='P0002',message='COACHING_PUBLIC_LINK_INVALID'; end if;
 if v_link.status='submitted' then raise exception using errcode='23514',message='COACHING_PUBLIC_LINK_SUBMITTED'; end if;
 if v_link.status='revoked' then raise exception using errcode='23514',message='COACHING_PUBLIC_LINK_REVOKED'; end if;
 if v_link.expires_at<=pg_catalog.now() then raise exception using errcode='23514',message='COACHING_PUBLIC_LINK_EXPIRED'; end if;
 select * into v_version from public.coaching_form_versions where id=v_link.form_version_id and status='published'; if not found then raise exception using errcode='23514',message='COACHING_PUBLIC_LINK_INVALID'; end if;
 if exists(select 1 from pg_catalog.jsonb_object_keys(p_answers) key where not exists(select 1 from public.coaching_form_questions q where q.form_version_id=v_version.id and q.id::text=key)) then raise exception using errcode='22023',message='COACHING_PUBLIC_ANSWER_UNKNOWN_QUESTION'; end if;
 for v_question in select question.* from public.coaching_form_questions as question where question.form_version_id=v_version.id order by question.sort_order loop
   v_answer:=p_answers->v_question.id::text;
   if v_answer is null then if v_question.is_required then raise exception using errcode='22023',message='COACHING_PUBLIC_ANSWER_REQUIRED'; else continue; end if; end if;
   if v_question.question_type in ('short_text','long_text') then if pg_catalog.jsonb_typeof(v_answer)<>'string' or pg_catalog.length(pg_catalog.btrim(v_answer#>>'{}'))=0 then raise exception using errcode='22023',message='COACHING_PUBLIC_ANSWER_INVALID'; end if;
   elsif v_question.question_type='single_choice' then v_options:=v_question.configuration->'options'; if pg_catalog.jsonb_typeof(v_answer)<>'string' or not exists(select 1 from pg_catalog.jsonb_array_elements_text(v_options) x where x.value=v_answer#>>'{}') then raise exception using errcode='22023',message='COACHING_PUBLIC_ANSWER_INVALID'; end if;
   elsif v_question.question_type='multiple_choice' then v_options:=v_question.configuration->'options'; if pg_catalog.jsonb_typeof(v_answer)<>'array' or pg_catalog.jsonb_array_length(v_answer)=0 or exists(select 1 from pg_catalog.jsonb_array_elements_text(v_answer) x where not exists(select 1 from pg_catalog.jsonb_array_elements_text(v_options) y where y.value=x.value)) or (select count(*)<>count(distinct value) from pg_catalog.jsonb_array_elements_text(v_answer)) then raise exception using errcode='22023',message='COACHING_PUBLIC_ANSWER_INVALID'; end if;
   elsif v_question.question_type='scale' then begin v_count:=(v_answer#>>'{}')::integer; exception when others then raise exception using errcode='22023',message='COACHING_PUBLIC_ANSWER_INVALID'; end; if v_count<(v_question.configuration->>'min')::integer or v_count>(v_question.configuration->>'max')::integer then raise exception using errcode='22023',message='COACHING_PUBLIC_ANSWER_INVALID'; end if;
   elsif v_question.question_type='number' then begin perform (v_answer#>>'{}')::numeric; exception when others then raise exception using errcode='22023',message='COACHING_PUBLIC_ANSWER_INVALID'; end; if (v_question.configuration?'min' and (v_answer#>>'{}')::numeric<(v_question.configuration->>'min')::numeric) or (v_question.configuration?'max' and (v_answer#>>'{}')::numeric>(v_question.configuration->>'max')::numeric) then raise exception using errcode='22023',message='COACHING_PUBLIC_ANSWER_INVALID'; end if; end if;
 end loop;
 insert into public.coaching_form_responses(public_link_id,coaching_record_id,student_id,form_id,form_version_id) select v_link.id,v_link.coaching_record_id,v_link.student_id,v_version.form_id,v_version.id returning id into v_response;
 insert into public.coaching_form_answers(response_id,question_id,answer) select v_response,q.id,p_answers->q.id::text from public.coaching_form_questions q where q.form_version_id=v_version.id and p_answers ? q.id::text;
 update public.coaching_public_links set status='submitted' where id=v_link.id;
 return 'submitted';
end; $$;

create or replace function public.get_coaching_form_responses(p_coaching_record_id uuid)
returns table(response_id uuid,form_name text,version_number integer,submitted_at timestamptz,student_name text)
language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null or not public.has_permission('coaching_responses.view') then raise exception using errcode='42501',message='COACHING_RESPONSE_VIEW_PERMISSION_DENIED'; end if;
return query select r.id,f.name,v.version_number,r.submitted_at,s.full_name from public.coaching_form_responses r join public.coaching_forms f on f.id=r.form_id join public.coaching_form_versions v on v.id=r.form_version_id join public.students s on s.id=r.student_id where r.coaching_record_id=p_coaching_record_id order by r.submitted_at desc; end; $$;

create or replace function public.get_coaching_forms()
returns table(form_id uuid, name text, form_status text, version_id uuid, version_number integer, version_status text, title text, instructions text, published_at timestamptz, response_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_permission('coaching_forms.view') then raise exception using errcode='42501',message='COACHING_FORM_VIEW_PERMISSION_DENIED'; end if;
 return query
 select f.id,f.name,f.status,v.id,v.version_number,v.status,v.title,v.instructions,v.published_at,(select count(*) from public.coaching_form_responses r where r.form_version_id=v.id)
 from public.coaching_forms f
 join lateral (select * from public.coaching_form_versions as version where version.form_id=f.id order by version.version_number desc limit 1) v on true
 order by f.created_at desc;
end; $$;

create or replace function public.get_coaching_form_detail(p_form_id uuid)
returns table(form_id uuid,name text,form_status text,version_id uuid,version_number integer,version_status text,title text,instructions text,question_id uuid,question_type text,question_title text,question_description text,is_required boolean,sort_order integer,configuration jsonb)
language plpgsql stable security definer set search_path='' as $$
declare v_version uuid;
begin
 if auth.uid() is null or not public.has_permission('coaching_forms.view') then raise exception using errcode='42501',message='COACHING_FORM_VIEW_PERMISSION_DENIED'; end if;
 select version.id into v_version from public.coaching_form_versions as version where version.form_id=p_form_id and version.status='draft' order by version.version_number desc limit 1;
 if v_version is null then select version.id into v_version from public.coaching_form_versions as version where version.form_id=p_form_id order by version.version_number desc limit 1; end if;
 return query select f.id,f.name,f.status,v.id,v.version_number,v.status,v.title,v.instructions,q.id,q.question_type,q.title,q.description,q.is_required,q.sort_order,q.configuration from public.coaching_forms f join public.coaching_form_versions v on v.id=v_version left join public.coaching_form_questions q on q.form_version_id=v.id where f.id=p_form_id order by q.sort_order;
end; $$;

create or replace function public.get_coaching_responses(
  p_form_id uuid default null,
  p_student_id uuid default null,
  p_form_version_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(response_id uuid, coaching_record_id uuid, student_id uuid, student_name text, form_id uuid, form_name text, form_version_id uuid, version_number integer, submitted_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_permission('coaching_responses.view') then raise exception using errcode='42501',message='COACHING_RESPONSE_VIEW_PERMISSION_DENIED'; end if;
 return query select r.id,r.coaching_record_id,r.student_id,s.full_name,f.id,f.name,v.id,v.version_number,r.submitted_at
 from public.coaching_form_responses r
 join public.students s on s.id=r.student_id
 join public.coaching_forms f on f.id=r.form_id
 join public.coaching_form_versions v on v.id=r.form_version_id
 where (p_form_id is null or r.form_id=p_form_id) and (p_student_id is null or r.student_id=p_student_id) and (p_form_version_id is null or r.form_version_id=p_form_version_id)
   and (p_from is null or r.submitted_at>=p_from) and (p_to is null or r.submitted_at<=p_to)
 order by r.submitted_at desc, r.id desc;
end; $$;

create or replace function public.get_coaching_response_detail(p_response_id uuid)
returns table(response_id uuid, coaching_record_id uuid, student_id uuid, student_name text, form_id uuid, form_name text, form_version_id uuid, version_number integer, submitted_at timestamptz, question_id uuid, question_type text, question_title text, question_description text, sort_order integer, answer jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_permission('coaching_responses.view') then raise exception using errcode='42501',message='COACHING_RESPONSE_VIEW_PERMISSION_DENIED'; end if;
 return query select r.id,r.coaching_record_id,r.student_id,s.full_name,f.id,f.name,v.id,v.version_number,r.submitted_at,q.id,q.question_type,q.title,q.description,q.sort_order,a.answer
 from public.coaching_form_responses r
 join public.students s on s.id=r.student_id
 join public.coaching_forms f on f.id=r.form_id
 join public.coaching_form_versions v on v.id=r.form_version_id
 join public.coaching_form_questions q on q.form_version_id=r.form_version_id
 left join public.coaching_form_answers a on a.response_id=r.id and a.question_id=q.id
 where r.id=p_response_id order by q.sort_order;
end; $$;

create or replace function public.get_coaching_public_links(p_coaching_record_id uuid)
returns table(link_id uuid, form_version_id uuid, form_name text, version_number integer, status text, expires_at timestamptz, issued_at timestamptz, revoked_at timestamptz, revoke_reason text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_permission('coaching_links.manage') then raise exception using errcode='42501',message='COACHING_LINK_MANAGE_PERMISSION_DENIED'; end if;
 return query
 select link.id,link.form_version_id,form.name,version.version_number,link.status,link.expires_at,link.issued_at,link.revoked_at,link.revoke_reason
 from public.coaching_public_links link
 join public.coaching_form_versions version on version.id=link.form_version_id
 join public.coaching_forms form on form.id=version.form_id
 where link.coaching_record_id=p_coaching_record_id
 order by link.issued_at desc,link.id desc;
end; $$;

alter table public.coaching_forms enable row level security;
alter table public.coaching_form_versions enable row level security;
alter table public.coaching_form_questions enable row level security;
alter table public.coaching_public_links enable row level security;
alter table public.coaching_form_responses enable row level security;
alter table public.coaching_form_answers enable row level security;
create policy coaching_forms_select on public.coaching_forms for select to authenticated using (public.has_permission('coaching_forms.view'));
create policy coaching_form_versions_select on public.coaching_form_versions for select to authenticated using (public.has_permission('coaching_forms.view'));
create policy coaching_form_questions_select on public.coaching_form_questions for select to authenticated using (public.has_permission('coaching_forms.view'));
create policy coaching_public_links_select on public.coaching_public_links for select to authenticated using (public.has_permission('coaching_links.manage'));
create policy coaching_form_responses_select on public.coaching_form_responses for select to authenticated using (public.has_permission('coaching_responses.view'));
create policy coaching_form_answers_select on public.coaching_form_answers for select to authenticated using (public.has_permission('coaching_responses.view'));
revoke all on public.coaching_forms,public.coaching_form_versions,public.coaching_form_questions,public.coaching_public_links,public.coaching_form_responses,public.coaching_form_answers from public,anon,authenticated;
grant select on public.coaching_forms,public.coaching_form_versions,public.coaching_form_questions,public.coaching_public_links,public.coaching_form_responses,public.coaching_form_answers to authenticated;
revoke all on function public.save_coaching_form_draft(uuid,text,text,text,jsonb),public.publish_coaching_form_version(uuid),public.create_coaching_form_version_draft(uuid),public.issue_coaching_public_link(uuid,uuid,timestamptz,text),public.revoke_coaching_public_link(uuid,text),public.get_public_coaching_form(text),public.submit_public_coaching_form(text,jsonb),public.get_coaching_form_responses(uuid),public.get_coaching_forms(),public.get_coaching_form_detail(uuid),public.get_coaching_responses(uuid,uuid,uuid,timestamptz,timestamptz),public.get_coaching_response_detail(uuid),public.get_coaching_public_links(uuid) from public,anon;
grant execute on function public.save_coaching_form_draft(uuid,text,text,text,jsonb),public.publish_coaching_form_version(uuid),public.create_coaching_form_version_draft(uuid),public.issue_coaching_public_link(uuid,uuid,timestamptz,text),public.revoke_coaching_public_link(uuid,text),public.get_coaching_form_responses(uuid),public.get_coaching_forms(),public.get_coaching_form_detail(uuid),public.get_coaching_responses(uuid,uuid,uuid,timestamptz,timestamptz),public.get_coaching_response_detail(uuid),public.get_coaching_public_links(uuid) to authenticated;
grant execute on function public.get_public_coaching_form(text),public.submit_public_coaching_form(text,jsonb) to anon,authenticated;
commit;
