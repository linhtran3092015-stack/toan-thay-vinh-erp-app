-- Restrict the privileged webhook RPC to the server-side service role.
-- The HMAC verification remains in the Next.js route and must run before this RPC.

begin;

revoke all on function public.process_sepay_webhook_transaction(
  bigint,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  bigint,
  bigint,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.process_sepay_webhook_transaction(
  bigint,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  bigint,
  bigint,
  text,
  jsonb
) to service_role;

commit;
