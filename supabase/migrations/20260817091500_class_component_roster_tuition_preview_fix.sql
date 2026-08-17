begin;

create or replace function public.preview_tuition_collection_period(p_period_id uuid)
returns table(student_id uuid,enrollment_id uuid,class_id uuid,class_session_id uuid,session_date date,session_kind text,unit_price_vnd bigint,acquisition_source_id uuid,opening_balance_sessions bigint,blocker_code text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='28000',message='AUTHENTICATION_REQUIRED'; end if;
  if not public.has_permission('tuition_periods.view') then raise exception using errcode='42501',message='TUITION_PERIOD_VIEW_PERMISSION_DENIED'; end if;
  return query
  with period as (
    select * from public.tuition_collection_periods where id=p_period_id
  ), sessions as (
    select session_row.id
    from public.class_sessions session_row
    join period on session_row.session_date between period.starts_on and period.ends_on
    left join public.class_sessions source_session on source_session.id=session_row.makeup_for_session_id
    where (session_row.session_kind='regular' and session_row.status<>'cancelled')
       or (session_row.session_kind='makeup' and session_row.status<>'cancelled' and source_session.status='cancelled')
  ), candidates as (
    select
      roster.student_id,
      roster.student_enrollment_id as enrollment_id,
      roster.enrollment_class_id as class_id,
      session_row.id as class_session_id,
      session_row.session_date,
      session_row.session_kind,
      rate.unit_price_vnd,
      coalesce(source_assignment.lead_source_id, crm_case.lead_source_id) as acquisition_source_id,
      coalesce(balance.balance_sessions,0)::bigint as opening_balance_sessions
    from sessions
    join public.class_sessions session_row on session_row.id=sessions.id
    join public.resolve_class_session_rosters(array(select id from sessions)) roster
      on roster.class_session_id=session_row.id
    left join lateral (
      select version.unit_price_vnd
      from public.student_tuition_rate_versions version
      where version.student_id=roster.student_id and version.effective_from<=session_row.session_date
      order by version.effective_from desc
      limit 1
    ) rate on true
    left join lateral (
      select assignment.lead_source_id
      from public.student_acquisition_source_assignments assignment
      where assignment.student_id=roster.student_id and assignment.is_current
      order by assignment.assigned_at desc
      limit 1
    ) source_assignment on true
    left join lateral (
      select crm.lead_source_id
      from public.crm_cases crm
      where crm.student_id=roster.student_id
      order by crm.updated_at desc,crm.created_at desc
      limit 1
    ) crm_case on true
    left join public.student_session_balances balance on balance.student_id=roster.student_id
  )
  select
    candidates.student_id,
    candidates.enrollment_id,
    candidates.class_id,
    candidates.class_session_id,
    candidates.session_date,
    candidates.session_kind,
    candidates.unit_price_vnd,
    candidates.acquisition_source_id,
    candidates.opening_balance_sessions,
    case
      when candidates.unit_price_vnd is null then 'MISSING_EFFECTIVE_TUITION_RATE'
      when candidates.acquisition_source_id is null then 'MISSING_ACQUISITION_SOURCE'
      else null
    end
  from candidates;
end;
$$;

revoke all on function public.preview_tuition_collection_period(uuid) from public, anon;
grant execute on function public.preview_tuition_collection_period(uuid) to authenticated;

commit;
