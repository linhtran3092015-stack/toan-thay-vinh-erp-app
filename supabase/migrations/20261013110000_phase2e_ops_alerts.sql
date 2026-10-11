-- Đợt 2 — nhóm 2e: cảnh báo vận hành trong ứng dụng.
--
-- S6: không có giám sát; pg_cron lỗi không ai biết; webhook xử lý lỗi chỉ ghi
--     console.
--   → raise_ops_alert: ghi thông báo cho mọi tài khoản có quyền settings.manage
--     (chủ trung tâm / quản trị) kèm audit; chỉ service role gọi được (API route
--     webhook, worker) — người dùng không tự tạo cảnh báo.
--   → run_ops_health_check (pg_cron mỗi 15 phút): job cron thất bại trong 30
--     phút gần nhất, webhook SePay xử lý lỗi trong 30 phút gần nhất, job cron
--     không chạy quá 3 giờ dù đang bật. Mỗi sự cố chỉ báo một lần (dedupe).

begin;

create or replace function public.raise_ops_alert(
  p_code text,
  p_title text,
  p_message text,
  p_dedupe_key text default null,
  p_href text default '/settings'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := nullif(pg_catalog.btrim(coalesce(p_code, '')), '');
  v_title text := pg_catalog.left(nullif(pg_catalog.btrim(coalesce(p_title, '')), ''), 200);
  v_message text := pg_catalog.left(nullif(pg_catalog.btrim(coalesce(p_message, '')), ''), 1000);
  v_dedupe text := pg_catalog.left(coalesce(nullif(pg_catalog.btrim(coalesce(p_dedupe_key, '')), ''), 'ops.' || coalesce(v_code, 'alert') || ':' || gen_random_uuid()::text), 300);
  v_count integer;
begin
  if v_code is null or v_code !~ '^[a-z][a-z0-9_]*$' then
    raise exception using errcode = '22023', message = 'OPS_ALERT_CODE_INVALID';
  end if;
  if v_title is null or v_message is null then
    raise exception using errcode = '22023', message = 'OPS_ALERT_CONTENT_REQUIRED';
  end if;

  insert into public.notifications (
    recipient_user_id, actor_user_id, event_code, title, message, href, entity_type, entity_id, dedupe_key, metadata
  )
  select
    recipient.user_id,
    null,
    'ops.' || v_code,
    v_title,
    v_message,
    coalesce(p_href, '/settings'),
    null,
    null,
    v_dedupe,
    pg_catalog.jsonb_build_object('source', 'ops_alert', 'code', v_code)
  from (
    select distinct assignment.user_id
    from public.user_role_assignments as assignment
    join public.profiles as profile on profile.id = assignment.user_id and profile.employment_status = 'active'
    join public.roles as role on role.id = assignment.role_id and role.is_active
    join public.role_permissions as role_permission on role_permission.role_id = role.id
    join public.permissions as permission on permission.id = role_permission.permission_id and permission.is_active
    where permission.code = 'settings.manage'
  ) as recipient
  on conflict (recipient_user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, reason, metadata)
    values (null, 'ops', 'ops_alert_raised', 'ops_alert', v_dedupe, v_title,
      pg_catalog.jsonb_build_object('code', v_code, 'message', v_message, 'recipients', v_count));
  end if;

  return v_count;
end;
$$;

revoke all on function public.raise_ops_alert(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.raise_ops_alert(text, text, text, text, text) to service_role;

create or replace function public.run_ops_health_check()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alerts integer := 0;
  v_row record;
  v_failed_webhooks integer;
  v_window text := pg_catalog.to_char(pg_catalog.date_trunc('hour', pg_catalog.now()) + make_interval(mins => 30 * (pg_catalog.date_part('minute', pg_catalog.now())::integer / 30)), 'YYYY-MM-DD"T"HH24:MI');
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Job cron thất bại gần đây: một cảnh báo mỗi lần chạy.
    for v_row in
      select d.runid, j.jobname, d.return_message, d.end_time
      from cron.job_run_details as d
      join cron.job as j on j.jobid = d.jobid
      where d.status = 'failed'
        and d.end_time >= pg_catalog.now() - interval '30 minutes'
        and j.jobname <> 'ops-health-check'
    loop
      v_alerts := v_alerts + public.raise_ops_alert(
        'cron_job_failed',
        'Tác vụ nền thất bại: ' || v_row.jobname,
        'Lần chạy ' || v_row.runid::text || ' lúc ' || pg_catalog.to_char(v_row.end_time at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') || ': ' || pg_catalog.left(coalesce(v_row.return_message, 'không có thông điệp'), 400),
        'ops.cron_job_failed:' || v_row.runid::text,
        '/settings'
      );
    end loop;

    -- Job đang bật nhưng không chạy quá 3 giờ (pg_cron treo hoặc bị tắt).
    for v_row in
      select j.jobname, pg_catalog.max(d.start_time) as last_start
      from cron.job as j
      left join cron.job_run_details as d on d.jobid = j.jobid
      where j.active
        and j.jobname <> 'ops-health-check'
      group by j.jobname
      having pg_catalog.max(d.start_time) is null or pg_catalog.max(d.start_time) < pg_catalog.now() - interval '3 hours'
    loop
      v_alerts := v_alerts + public.raise_ops_alert(
        'cron_job_stale',
        'Tác vụ nền không chạy: ' || v_row.jobname,
        'Lần chạy gần nhất: ' || coalesce(pg_catalog.to_char(v_row.last_start at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM'), 'chưa bao giờ') || '. Kiểm tra pg_cron trên Supabase.',
        'ops.cron_job_stale:' || v_row.jobname || ':' || pg_catalog.to_char(pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD'),
        '/settings'
      );
    end loop;
  end if;

  -- Webhook SePay xử lý lỗi: một cảnh báo mỗi 30 phút khi có lỗi mới.
  select pg_catalog.count(*) into v_failed_webhooks
  from public.sepay_webhooks
  where processing_status = 'failed'
    and created_at >= pg_catalog.now() - interval '30 minutes';
  if v_failed_webhooks > 0 then
    v_alerts := v_alerts + public.raise_ops_alert(
      'sepay_webhook_failed',
      v_failed_webhooks::text || ' webhook SePay xử lý lỗi',
      'Có ' || v_failed_webhooks::text || ' webhook SePay bị lỗi trong 30 phút qua. Tiền có thể đã về nhưng chưa ghi nhận; kiểm tra Giao dịch SePay và đồng bộ lịch sử nếu cần.',
      'ops.sepay_webhook_failed:' || v_window,
      '/finance/sepay?queue=review'
    );
  end if;

  return v_alerts;
end;
$$;

revoke all on function public.run_ops_health_check() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ops-health-check';
    perform cron.schedule('ops-health-check', '*/15 * * * *', 'select public.run_ops_health_check();');
  else
    raise warning 'OPS_HEALTH_CRON_UNAVAILABLE: install pg_cron and register ops-health-check';
  end if;
end;
$$;

comment on function public.raise_ops_alert(text, text, text, text, text)
is 'Service-role only: notifies every active account with settings.manage about an operational incident (deduplicated) and audits it.';

commit;
