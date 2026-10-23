-- Lưới an toàn cho hàng đợi chấm AI chạy ngay trong cơ sở dữ liệu: pg_cron gọi worker qua pg_net
-- 5 phút một lần khi còn lượt chờ. Lịch "*/5" của GitHub Actions thực tế chỉ chạy 3–5 giờ một lần.
-- URL worker và CRON_SECRET nằm trong Supabase Vault (không ghi vào migration vì repo công khai):
--   select vault.create_secret('<CRON_SECRET như trên Vercel>', 'ai_grading_cron_secret');
--   select vault.create_secret('https://<tên miền production>/api/internal/ai-grading/worker', 'ai_grading_worker_url');
-- Chưa có hai secret này thì lịch không gọi gì (not_configured).

create extension if not exists pg_net with schema extensions;

alter table public.ai_grading_worker_state
  add column last_kick_at timestamptz,
  add column last_kick_request_id bigint;

-- Gọi worker một lần nếu có việc. Trả về: disabled | paused | not_configured | idle | kicked.
-- Lần gọi trước bị từ chối (ví dụ 401 vì CRON_SECRET hai nơi khác nhau) thì báo owner, mỗi giờ một lần.
create or replace function public.kick_ai_grading_worker()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.ai_grading_worker_state%rowtype;
  v_url text;
  v_secret text;
  v_status integer;
  v_error text;
  v_request bigint;
begin
  if not coalesce((public.ai_grading_settings() ->> 'enabled')::boolean, false) then
    return 'disabled';
  end if;

  select * into v_state from public.ai_grading_worker_state as state where state.id for update;
  if v_state.paused_until is not null and v_state.paused_until > pg_catalog.now() then
    return 'paused';
  end if;

  select secret.decrypted_secret into v_url from vault.decrypted_secrets as secret where secret.name = 'ai_grading_worker_url';
  select secret.decrypted_secret into v_secret from vault.decrypted_secrets as secret where secret.name = 'ai_grading_cron_secret';
  if nullif(pg_catalog.btrim(coalesce(v_url, '')), '') is null or nullif(pg_catalog.btrim(coalesce(v_secret, '')), '') is null then
    return 'not_configured';
  end if;

  if v_state.last_kick_request_id is not null then
    select response.status_code, response.error_msg into v_status, v_error
    from net._http_response as response
    where response.id = v_state.last_kick_request_id;
    if found and (v_status is null or v_status not between 200 and 299) then
      perform public.raise_ops_alert(
        'ai_grading_kick_failed',
        'Lịch gọi chấm bài AI bị lỗi',
        'Lần gọi worker gần nhất từ cơ sở dữ liệu trả về ' || coalesce('HTTP ' || v_status::text, v_error, 'lỗi không rõ')
          || '. Kiểm tra CRON_SECRET trên Vercel và secret ai_grading_cron_secret trong Supabase Vault có giống nhau không.',
        'ops.ai_grading_kick_failed:' || pg_catalog.to_char(pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24'),
        '/settings/ai-grading'
      );
    end if;
  end if;

  -- Cùng điều kiện với claim_grading_runs: lượt đến hạn, hoặc lượt đang chạy mà tiến trình đã mất.
  if not exists (
    select 1 from public.grading_runs as run
    where (run.status = 'queued' and run.next_attempt_at <= pg_catalog.now())
       or (run.status = 'running' and run.locked_until < pg_catalog.now())
  ) then
    return 'idle';
  end if;

  -- Worker chạy tối đa khoảng 280 giây; chờ đủ lâu để lần sau đọc được mã trả về.
  v_request := net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := pg_catalog.jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    timeout_milliseconds := 300000
  );
  update public.ai_grading_worker_state as state
  set last_kick_at = pg_catalog.now(), last_kick_request_id = v_request
  where state.id;
  return 'kicked';
end;
$$;

revoke all on function public.kick_ai_grading_worker() from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ai-grading-worker-kick';
    perform cron.schedule('ai-grading-worker-kick', '*/5 * * * *', 'select public.kick_ai_grading_worker();');
  else
    raise warning 'AI_GRADING_WORKER_CRON_UNAVAILABLE: pg_cron chưa bật, hàng đợi chấm AI chỉ chạy khi có bài mới hoặc qua GitHub Actions.';
  end if;
end $$;
