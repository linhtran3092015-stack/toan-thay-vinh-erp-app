import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAlertWebhookUrl } from "@/lib/env";
import type { Database } from "@/types/database.generated";

export interface OpsAlertInput {
  /** snake_case incident code, e.g. `sepay_webhook_processing_failed`. */
  code: string;
  /** Stable key so repeated occurrences of one incident notify once. */
  dedupeKey?: string;
  href?: string;
  message: string;
  title: string;
}

/**
 * Raises an operational alert: in-app notification to every account with
 * `settings.manage` (through the RPC, which only the service role may call,
 * so pass the caller's service-role client) and, when configured, a JSON POST
 * to ALERT_WEBHOOK_URL. Never throws — alerting must not break the request
 * that detected the incident.
 */
export async function raiseOpsAlert(
  supabase: SupabaseClient<Database>,
  input: OpsAlertInput,
): Promise<void> {
  const payload = {
    code: input.code,
    href: input.href ?? "/settings",
    message: input.message.slice(0, 1000),
    raisedAt: new Date().toISOString(),
    source: "toan-thay-vinh-erp",
    title: input.title.slice(0, 200),
  };

  await Promise.allSettled([
    (async () => {
      try {
        const { error } = await supabase.rpc("raise_ops_alert", {
          p_code: input.code,
          p_dedupe_key: input.dedupeKey ?? undefined,
          p_href: payload.href,
          p_message: payload.message,
          p_title: payload.title,
        });
        if (error) console.error("OPS_ALERT_DB_FAILED", input.code, error.message);
      } catch (error) {
        console.error("OPS_ALERT_DB_FAILED", input.code, error instanceof Error ? error.message : "unknown");
      }
    })(),
    (async () => {
      const url = getAlertWebhookUrl();
      if (!url) return;
      try {
        const response = await fetch(url, {
          body: JSON.stringify({ ...payload, text: `[${payload.title}] ${payload.message}` }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) console.error("OPS_ALERT_WEBHOOK_FAILED", input.code, response.status);
      } catch (error) {
        console.error("OPS_ALERT_WEBHOOK_FAILED", input.code, error instanceof Error ? error.message : "unknown");
      }
    })(),
  ]);
}
