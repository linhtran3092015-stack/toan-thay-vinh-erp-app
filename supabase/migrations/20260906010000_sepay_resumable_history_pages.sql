-- Resumable, bounded SePay history imports. Existing run IDs become their own
-- session IDs so this migration is safe on databases that already have logs.

begin;

alter table public.sepay_sync_runs
  add column sync_session_id uuid;

update public.sepay_sync_runs
set sync_session_id = id
where sync_session_id is null;

alter table public.sepay_sync_runs
  alter column sync_session_id set not null;

create unique index sepay_sync_runs_session_account_idx
  on public.sepay_sync_runs (sync_session_id, account_version_id);

-- Persist one fetched page and its checkpoint in the same database transaction.
-- Repeating a request for an already stored page only returns its checkpoint.
create function public.ingest_sepay_api_v2_sync_page(
  p_sync_run_id uuid,
  p_expected_page integer,
  p_total_available integer,
  p_has_more boolean,
  p_transactions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.sepay_sync_runs;
  v_batch jsonb := pg_catalog.jsonb_build_object(
    'seen', 0,
    'recorded', 0,
    'duplicates', 0,
    'linked', 0,
    'manual_review', 0
  );
begin
  if p_sync_run_id is null
    or p_expected_page < 1
    or p_expected_page > 10
    or p_total_available < 0
    or p_total_available > 1000
    or p_has_more is null
    or p_transactions is null
    or pg_catalog.jsonb_typeof(p_transactions) <> 'array'
    or pg_catalog.jsonb_array_length(p_transactions) > 100
    or (p_has_more and pg_catalog.jsonb_array_length(p_transactions) = 0)
  then
    raise exception 'SEPAY_SYNC_PAGE_INVALID';
  end if;

  select *
  into v_run
  from public.sepay_sync_runs
  where id = p_sync_run_id
  for update;

  if not found then
    raise exception 'SEPAY_SYNC_RUN_NOT_FOUND';
  end if;

  if v_run.pages_processed >= p_expected_page then
    return pg_catalog.jsonb_build_object(
      'already_processed', true,
      'completed', v_run.status = 'completed',
      'duplicates', v_run.duplicate_count,
      'linked', v_run.linked_count,
      'manual_review', v_run.manual_review_count,
      'pages_processed', v_run.pages_processed,
      'recorded', v_run.recorded_count,
      'seen', v_run.total_seen,
      'total_available', v_run.total_available
    );
  end if;

  if v_run.status <> 'running'
    or v_run.pages_processed <> p_expected_page - 1
  then
    raise exception 'SEPAY_SYNC_PAGE_OUT_OF_SEQUENCE';
  end if;

  if pg_catalog.jsonb_array_length(p_transactions) > 0 then
    v_batch := public.ingest_sepay_api_v2_transactions_batch(p_transactions);
  end if;

  update public.sepay_sync_runs
  set
    completed_at = case when p_has_more then null else pg_catalog.now() end,
    duplicate_count = duplicate_count + (v_batch ->> 'duplicates')::integer,
    linked_count = linked_count + (v_batch ->> 'linked')::integer,
    manual_review_count = manual_review_count + (v_batch ->> 'manual_review')::integer,
    pages_processed = p_expected_page,
    recorded_count = recorded_count + (v_batch ->> 'recorded')::integer,
    status = case when p_has_more then 'running' else 'completed' end,
    total_available = p_total_available,
    total_seen = total_seen + (v_batch ->> 'seen')::integer
  where id = p_sync_run_id
  returning * into v_run;

  return pg_catalog.jsonb_build_object(
    'already_processed', false,
    'completed', v_run.status = 'completed',
    'duplicates', v_run.duplicate_count,
    'linked', v_run.linked_count,
    'manual_review', v_run.manual_review_count,
    'pages_processed', v_run.pages_processed,
    'recorded', v_run.recorded_count,
    'seen', v_run.total_seen,
    'total_available', v_run.total_available
  );
end;
$$;

revoke all on function public.ingest_sepay_api_v2_sync_page(
  uuid, integer, integer, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.ingest_sepay_api_v2_sync_page(
  uuid, integer, integer, boolean, jsonb
) to service_role;

commit;
