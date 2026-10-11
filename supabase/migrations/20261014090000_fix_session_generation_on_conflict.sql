-- =========================================================
-- FIX: session generation ON CONFLICT after Đợt 2a partial index
-- =========================================================
-- Migration 20261013090000 rebuilt class_sessions_template_date_unique_idx
-- as "where schedule_template_id is not null and status <> 'cancelled'".
-- create_batch_class_sessions and materialize_class_sessions still used the
-- old predicate "where schedule_template_id is not null", so Postgres raised
-- 42P10 (no matching unique constraint) on every template-based insert.
-- Both functions are re-created unchanged except for the conflict predicate.

create or replace function public.create_batch_class_sessions(
  p_class_id uuid,
  p_sessions jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_class_rec public.classes%rowtype;
  v_item jsonb;
  v_created_ids jsonb := '[]'::jsonb;
  v_new_id uuid;
  v_session_date date;
  v_start_time time without time zone;
  v_end_time time without time zone;
  v_learning_mode text;
  v_session_kind text;
  v_schedule_template_id uuid;
  v_component_code text;
  v_room_name text;
  v_meeting_url text;
  v_notes text;
  v_total_created integer := 0;
begin
  -- 1. Check authentication
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATION_REQUIRED';
  end if;

  -- 2. Check permission
  if not public.has_permission('sessions.manage') then
    raise exception using
      errcode = '42501',
      message = 'SESSION_MANAGE_PERMISSION_DENIED';
  end if;

  -- 3. Validate class
  if p_class_id is null then
    raise exception using
      errcode = '22023',
      message = 'CLASS_ID_REQUIRED';
  end if;

  select *
  into v_class_rec
  from public.classes
  where id = p_class_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CLASS_NOT_FOUND';
  end if;

  if coalesce(v_class_rec.status, '') <> 'active' then
    raise exception using
      errcode = '22023',
      message = 'CLASS_NOT_ACTIVE';
  end if;

  -- 4. Validate p_sessions
  if p_sessions is null or pg_catalog.jsonb_typeof(p_sessions) <> 'array' or pg_catalog.jsonb_array_length(p_sessions) = 0 then
    raise exception using
      errcode = '22023',
      message = 'SESSIONS_ARRAY_REQUIRED';
  end if;

  -- 5. Loop over each session and insert
  for v_item in select * from pg_catalog.jsonb_array_elements(p_sessions)
  loop
    v_session_date := (v_item->>'session_date')::date;
    v_start_time := (v_item->>'start_time')::time;
    v_end_time := (v_item->>'end_time')::time;
    
    if v_session_date is null then
      raise exception using errcode = '22023', message = 'SESSION_DATE_REQUIRED';
    end if;

    if v_start_time is null or v_end_time is null or v_end_time <= v_start_time then
      raise exception using errcode = '22023', message = 'CLASS_SESSION_TIME_INVALID';
    end if;

    v_schedule_template_id := nullif(v_item->>'schedule_template_id', '')::uuid;
    
    -- Normalize session kind:
    -- If schedule_template_id is provided, it must be 'regular'
    -- If schedule_template_id is null, it must be 'additional' (batch creation doesn't do makeup)
    if v_schedule_template_id is not null then
      v_session_kind := 'regular';
      -- Verify template exists and belongs to class
      if not exists (
        select 1 from public.class_schedule_templates
        where id = v_schedule_template_id and class_id = p_class_id
      ) then
        raise exception using errcode = '23514', message = 'SCHEDULE_TEMPLATE_CLASS_MISMATCH';
      end if;
    else
      v_session_kind := 'additional';
    end if;

    v_learning_mode := coalesce(nullif(pg_catalog.lower(pg_catalog.btrim(v_item->>'learning_mode')), ''), 'offline');
    if v_learning_mode not in ('online', 'offline', 'hybrid') then
      v_learning_mode := 'offline';
    end if;

    v_component_code := nullif(pg_catalog.upper(pg_catalog.btrim(v_item->>'component_code')), '');
    if v_component_code is not null and v_component_code !~ '^[A-Z0-9._-]+$' then
      v_component_code := null;
    end if;

    v_room_name := nullif(pg_catalog.btrim(v_item->>'room_name'), '');
    v_meeting_url := nullif(pg_catalog.btrim(v_item->>'meeting_url'), '');
    v_notes := nullif(pg_catalog.btrim(v_item->>'notes'), '');

    v_new_id := null;

    -- Insert session
    if v_schedule_template_id is not null then
      insert into public.class_sessions (
        class_id,
        schedule_template_id,
        session_date,
        session_kind,
        component_code,
        start_time,
        end_time,
        learning_mode,
        room_name,
        meeting_url,
        status,
        notes,
        created_by
      ) values (
        p_class_id,
        v_schedule_template_id,
        v_session_date,
        v_session_kind,
        v_component_code,
        v_start_time,
        v_end_time,
        v_learning_mode,
        v_room_name,
        v_meeting_url,
        'scheduled',
        v_notes,
        v_actor_id
      )
      on conflict (schedule_template_id, session_date)
        where (schedule_template_id is not null and status <> 'cancelled')
      do nothing
      returning id into v_new_id;
    else
      insert into public.class_sessions (
        class_id,
        session_date,
        session_kind,
        component_code,
        start_time,
        end_time,
        learning_mode,
        room_name,
        meeting_url,
        status,
        notes,
        created_by
      ) values (
        p_class_id,
        v_session_date,
        v_session_kind,
        v_component_code,
        v_start_time,
        v_end_time,
        v_learning_mode,
        v_room_name,
        v_meeting_url,
        'scheduled',
        v_notes,
        v_actor_id
      )
      returning id into v_new_id;
    end if;

    if v_new_id is not null then
      v_created_ids := v_created_ids || pg_catalog.jsonb_build_array(v_new_id);
      v_total_created := v_total_created + 1;
    end if;
  end loop;

  -- 6. Insert audit log
  if v_total_created > 0 then
    insert into public.audit_logs (
      actor_user_id,
      module,
      action,
      entity_type,
      entity_id,
      new_data,
      reason,
      metadata
    ) values (
      v_actor_id,
      'sessions',
      'batch_sessions_created',
      'class',
      p_class_id::text,
      pg_catalog.jsonb_build_object(
        'class_id', p_class_id,
        'class_code', v_class_rec.code,
        'created_count', v_total_created,
        'session_ids', v_created_ids
      ),
      coalesce(nullif(pg_catalog.btrim(p_reason), ''), 'Tạo buổi học hàng loạt'),
      pg_catalog.jsonb_build_object(
        'source', 'batch_session_creation',
        'total_requested', pg_catalog.jsonb_array_length(p_sessions),
        'total_created', v_total_created,
        'skipped_duplicates', pg_catalog.jsonb_array_length(p_sessions) - v_total_created
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'created_count', v_total_created,
    'session_ids', v_created_ids
  );
end;
$$;

revoke all on function public.create_batch_class_sessions(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_batch_class_sessions(uuid, jsonb, text) to authenticated;

comment on function public.create_batch_class_sessions(uuid, jsonb, text) is
  'Batch creates class sessions for a given class in a single transaction with sessions.manage permission.';

create or replace function public.materialize_class_sessions(p_academic_year_id uuid,p_start_date date,p_end_date date,p_allow_backfill boolean default false,p_reason text default 'Bulk class session generation')
returns jsonb language plpgsql security definer set search_path='' as $$
declare d date:=p_start_date; rec record; made integer:=0; skipped integer:=0; today date:=now()::date;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATED_USER_REQUIRED'; end if;
  if not public.has_permission('sessions.manage') then raise exception 'SESSIONS_MANAGE_PERMISSION_REQUIRED'; end if;
  if p_academic_year_id is null then raise exception 'ACADEMIC_YEAR_ID_REQUIRED'; end if;
  if p_start_date is null or p_end_date is null then raise exception 'START_AND_END_DATE_REQUIRED'; end if;
  if p_end_date<p_start_date then raise exception 'END_DATE_MUST_BE_ON_OR_AFTER_START_DATE'; end if;
  if p_end_date-p_start_date>62 then raise exception 'GENERATION_HORIZON_EXCEEDS_MAXIMUM_62_DAYS'; end if;
  if p_start_date<today and not p_allow_backfill then raise exception 'BACKFILL_MATERIALIZATION_NOT_ALLOWED_WITHOUT_EXPLICIT_FLAG'; end if;
  while d<=p_end_date loop
    for rec in select t.id,t.class_id,t.component_code,t.start_time,t.end_time,t.learning_mode,t.room_name,t.meeting_url from public.class_schedule_templates t join public.classes c on c.id=t.class_id where c.academic_year_id=p_academic_year_id and c.status='active' and c.code<>'6AC1' and t.is_active and t.weekday=extract(isodow from d)::smallint and t.effective_from<=d and (t.effective_to is null or t.effective_to>=d) and c.weekly_session_count=1 order by c.code,t.start_time loop
      insert into public.class_sessions(class_id,schedule_template_id,session_date,session_kind,component_code,start_time,end_time,learning_mode,room_name,meeting_url,status,created_by) values(rec.class_id,rec.id,d,'regular',rec.component_code,rec.start_time,rec.end_time,rec.learning_mode,rec.room_name,rec.meeting_url,'scheduled',auth.uid()) on conflict(schedule_template_id,session_date) where (schedule_template_id is not null and status <> 'cancelled') do nothing;
      if found then made:=made+1; else skipped:=skipped+1; end if;
    end loop; d:=d+1;
  end loop;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,new_data,reason,metadata) values(auth.uid(),'sessions','class_session_batch_materialized','academic_year',p_academic_year_id::text,jsonb_build_object('created_count',made,'skipped_count',skipped),coalesce(p_reason,'Bulk class session generation'),jsonb_build_object('source','authenticated_user'));
  return jsonb_build_object('academic_year_id',p_academic_year_id,'start_date',p_start_date,'end_date',p_end_date,'created_count',made,'skipped_count',skipped,'total_count',made+skipped);
end;
$$;
