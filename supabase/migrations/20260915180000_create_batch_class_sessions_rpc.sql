-- =========================================================
-- CREATE BATCH CLASS SESSIONS WORKFLOW RPC
-- =========================================================

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
      on conflict (schedule_template_id, session_date) where (schedule_template_id is not null)
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
