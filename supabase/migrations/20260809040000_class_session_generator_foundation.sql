-- Migration: 20260809040000_class_session_generator_foundation.sql
-- Description: Bulk class-session generator functions (Dry-run & Materialization) for recurring schedule templates

create or replace function public.dry_run_class_session_generation(
  p_academic_year_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
/*
  READ-ONLY Dry-run for bulk class session generation.
  Calculates all occurrences for active official classes in the given academic year
  from active recurring class_schedule_templates.

  Permission required: sessions.manage
*/
declare
  v_actor_id uuid := auth.uid();
  v_curr_date date;
  v_curr_iso_wd integer;
  v_rec record;
  v_existing_session public.class_sessions%rowtype;

  v_total_count integer := 0;
  v_new_count integer := 0;
  v_matching_count integer := 0;
  v_conflict_count integer := 0;
  v_invalid_count integer := 0;

  v_occurrences jsonb := '[]'::jsonb;
  v_item jsonb;
  v_classification text;
  v_is_past boolean;
  v_today date := pg_catalog.now()::date;
  v_classes_count integer := 0;
begin
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('sessions.manage') then
    raise exception using
      errcode = '42501',
      message = 'SESSIONS_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_academic_year_id is null then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_ID_REQUIRED';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception using
      errcode = '22023',
      message = 'START_AND_END_DATE_REQUIRED';
  end if;

  if p_end_date < p_start_date then
    raise exception using
      errcode = '23514',
      message = 'END_DATE_MUST_BE_ON_OR_AFTER_START_DATE';
  end if;

  if (p_end_date - p_start_date) > 62 then
    raise exception using
      errcode = '23514',
      message = 'GENERATION_HORIZON_EXCEEDS_MAXIMUM_62_DAYS';
  end if;

  -- Verify active official classes in this academic year
  select pg_catalog.count(*)
  into v_classes_count
  from public.classes
  where academic_year_id = p_academic_year_id
    and status = 'active'
    and code <> '6AC1';

  v_curr_date := p_start_date;
  while v_curr_date <= p_end_date loop
    v_curr_iso_wd := extract(isodow from v_curr_date)::integer;

    for v_rec in (
      select
        t.id as template_id,
        t.class_id,
        c.code as class_code,
        c.name as class_name,
        t.component_code,
        t.weekday,
        t.start_time,
        t.end_time,
        t.learning_mode,
        t.room_name,
        t.meeting_url,
        t.effective_from,
        t.effective_to
      from public.class_schedule_templates as t
      join public.classes as c on c.id = t.class_id
      where c.academic_year_id = p_academic_year_id
        and c.status = 'active'
        and c.code <> '6AC1'
        and t.is_active = true
        and t.weekday = v_curr_iso_wd
        and t.effective_from <= v_curr_date
        and (t.effective_to is null or t.effective_to >= v_curr_date)
      order by c.code, t.start_time
    ) loop
      v_total_count := v_total_count + 1;
      v_is_past := (v_curr_date < v_today);

      -- Check if session already exists
      select *
      into v_existing_session
      from public.class_sessions
      where schedule_template_id = v_rec.template_id
        and session_date = v_curr_date;

      if not found then
        v_classification := 'new';
        v_new_count := v_new_count + 1;
      else
        if v_existing_session.start_time = v_rec.start_time
           and v_existing_session.end_time = v_rec.end_time
           and v_existing_session.learning_mode = v_rec.learning_mode then
          v_classification := 'existing_matching';
          v_matching_count := v_matching_count + 1;
        else
          v_classification := 'existing_conflict';
          v_conflict_count := v_conflict_count + 1;
        end if;
      end if;

      v_item := pg_catalog.jsonb_build_object(
        'template_id',     v_rec.template_id,
        'class_id',        v_rec.class_id,
        'class_code',      v_rec.class_code,
        'class_name',      v_rec.class_name,
        'component_code',  v_rec.component_code,
        'session_date',    v_curr_date,
        'weekday',         v_rec.weekday,
        'start_time',      v_rec.start_time,
        'end_time',        v_rec.end_time,
        'learning_mode',   v_rec.learning_mode,
        'room_name',       v_rec.room_name,
        'meeting_url',     v_rec.meeting_url,
        'classification',  v_classification,
        'is_past',         v_is_past
      );

      v_occurrences := v_occurrences || pg_catalog.jsonb_build_array(v_item);
    end loop;

    v_curr_date := v_curr_date + 1;
  end loop;

  return pg_catalog.jsonb_build_object(
    'academic_year_id',        p_academic_year_id,
    'start_date',              p_start_date,
    'end_date',                p_end_date,
    'official_classes_count',  v_classes_count,
    'total_occurrences',       v_total_count,
    'new_count',               v_new_count,
    'existing_matching_count', v_matching_count,
    'existing_conflict_count', v_conflict_count,
    'invalid_count',           v_invalid_count,
    'occurrences',             v_occurrences
  );
end;
$function$;

grant execute on function public.dry_run_class_session_generation(uuid, date, date) to authenticated;


create or replace function public.materialize_class_sessions(
  p_academic_year_id uuid,
  p_start_date date,
  p_end_date date,
  p_allow_backfill boolean default false,
  p_reason text default 'Bulk class session generation'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
/*
  WRITE Function to materialize class sessions from active schedule templates.
  Uses ON CONFLICT (schedule_template_id, session_date) DO NOTHING for idempotency.

  Permission required: sessions.manage
*/
declare
  v_actor_id uuid := auth.uid();
  v_curr_date date;
  v_curr_iso_wd integer;
  v_rec record;

  v_today date := pg_catalog.now()::date;
  v_created_count integer := 0;
  v_skipped_count integer := 0;
  v_total_count integer := 0;
begin
  if v_actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('sessions.manage') then
    raise exception using
      errcode = '42501',
      message = 'SESSIONS_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_academic_year_id is null then
    raise exception using
      errcode = '22023',
      message = 'ACADEMIC_YEAR_ID_REQUIRED';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception using
      errcode = '22023',
      message = 'START_AND_END_DATE_REQUIRED';
  end if;

  if p_end_date < p_start_date then
    raise exception using
      errcode = '23514',
      message = 'END_DATE_MUST_BE_ON_OR_AFTER_START_DATE';
  end if;

  if (p_end_date - p_start_date) > 62 then
    raise exception using
      errcode = '23514',
      message = 'GENERATION_HORIZON_EXCEEDS_MAXIMUM_62_DAYS';
  end if;

  -- Backfill Guard
  if p_start_date < v_today and not p_allow_backfill then
    raise exception using
      errcode = '23514',
      message = 'BACKFILL_MATERIALIZATION_NOT_ALLOWED_WITHOUT_EXPLICIT_FLAG';
  end if;

  v_curr_date := p_start_date;
  while v_curr_date <= p_end_date loop
    v_curr_iso_wd := extract(isodow from v_curr_date)::integer;

    for v_rec in (
      select
        t.id as template_id,
        t.class_id,
        t.component_code,
        t.start_time,
        t.end_time,
        t.learning_mode,
        t.room_name,
        t.meeting_url
      from public.class_schedule_templates as t
      join public.classes as c on c.id = t.class_id
      where c.academic_year_id = p_academic_year_id
        and c.status = 'active'
        and c.code <> '6AC1'
        and t.is_active = true
        and t.weekday = v_curr_iso_wd
        and t.effective_from <= v_curr_date
        and (t.effective_to is null or t.effective_to >= v_curr_date)
      order by c.code, t.start_time
    ) loop
      v_total_count := v_total_count + 1;

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
        created_by
      )
      values (
        v_rec.class_id,
        v_rec.template_id,
        v_curr_date,
        'regular',
        v_rec.component_code,
        v_rec.start_time,
        v_rec.end_time,
        v_rec.learning_mode,
        v_rec.room_name,
        v_rec.meeting_url,
        'scheduled',
        v_actor_id
      )
      on conflict (schedule_template_id, session_date) where (schedule_template_id is not null) do nothing;

      if found then
        v_created_count := v_created_count + 1;
      else
        v_skipped_count := v_skipped_count + 1;
      end if;
    end loop;

    v_curr_date := v_curr_date + 1;
  end loop;

  -- Audit log entry
  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    metadata
  )
  values (
    v_actor_id,
    'sessions',
    'class_session_batch_materialized',
    'academic_year',
    p_academic_year_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'created_count', v_created_count,
      'skipped_count', v_skipped_count,
      'total_count',   v_total_count
    ),
    coalesce(p_reason, 'Bulk class session generation'),
    pg_catalog.jsonb_build_object(
      'source',           'authenticated_user',
      'academic_year_id', p_academic_year_id,
      'start_date',       p_start_date,
      'end_date',         p_end_date,
      'allow_backfill',   p_allow_backfill
    )
  );

  return pg_catalog.jsonb_build_object(
    'academic_year_id', p_academic_year_id,
    'start_date',       p_start_date,
    'end_date',         p_end_date,
    'created_count',    v_created_count,
    'skipped_count',    v_skipped_count,
    'total_count',      v_total_count
  );
end;
$function$;

grant execute on function public.materialize_class_sessions(uuid, date, date, boolean, text) to authenticated;
