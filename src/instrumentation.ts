import type { Instrumentation } from "next";

/**
 * Server-side error reporting without a vendor SDK: every unhandled error in
 * a route, server action or render is logged as one JSON line (Vercel log
 * drains pick these up) and forwarded to ALERT_WEBHOOK_URL when configured.
 * In-app ops alerts for business incidents are raised explicitly by the code
 * that detects them (see lib/ops-alerts).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const detail = error instanceof Error ? { message: error.message, name: error.name, stack: error.stack } : { message: String(error) };
  const record = {
    level: "error",
    method: request.method,
    path: request.path,
    routeType: context.routeType,
    routerKind: context.routerKind,
    source: "next.onRequestError",
    ...detail,
  };
  console.error(JSON.stringify(record));

  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url || !url.startsWith("https://")) return;
  try {
    await fetch(url, {
      body: JSON.stringify({
        code: "unhandled_request_error",
        text: `[ERP lỗi máy chủ] ${request.method} ${request.path}: ${detail.message}`,
        ...record,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // The alert channel must never mask the original failure.
  }
};
