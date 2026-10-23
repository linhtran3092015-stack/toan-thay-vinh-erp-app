import Anthropic from "@anthropic-ai/sdk";

/**
 * How the worker reacts to a Claude API error (plan §4.6), decided from the SDK error classes and
 * the error type in the body, never from free text alone:
 * - pause: no point retrying soon (no credit, workspace or monthly spend limit, bad key). The run
 *   goes back to the queue and the whole queue waits an hour; owners get an alert.
 * - retry: temporary (rate limit with retry-after, overload, 5xx, network, timeout).
 * - fatal: the request itself is wrong; retrying the same body will not help.
 * The SDK already retries 429/5xx/network twice with backoff before the error reaches us.
 */

export type PauseCode = "auth_failed" | "credit_exhausted" | "spend_limit" | "workspace_limit" | "model_unavailable";

export type ApiErrorClass =
  | { code: PauseCode; kind: "pause"; message: string }
  | { code: string; kind: "retry"; message: string; retryAfterSeconds: number | null }
  | { code: string; kind: "fatal"; message: string };

function bodyErrorType(error: InstanceType<typeof Anthropic.APIError>): string {
  const body = error.error as { error?: { type?: unknown } } | undefined;
  const inner = body?.error?.type;
  return typeof inner === "string" ? inner : (error.type ?? "");
}

function retryAfter(error: InstanceType<typeof Anthropic.APIError>): number | null {
  const header = error.headers?.get?.("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : null;
}

function shortMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

export function classifyApiError(error: unknown): ApiErrorClass {
  const message = shortMessage(error);
  if (error instanceof Anthropic.APIConnectionError) {
    return { code: error instanceof Anthropic.APIConnectionTimeoutError ? "timeout" : "connection", kind: "retry", message, retryAfterSeconds: null };
  }
  if (!(error instanceof Anthropic.APIError)) {
    return { code: "unexpected", kind: "retry", message, retryAfterSeconds: null };
  }

  const type = bodyErrorType(error);
  const lower = message.toLowerCase();
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return { code: "auth_failed", kind: "pause", message };
  }
  if (type === "billing_error" || lower.includes("credit balance is too low")) {
    return { code: "credit_exhausted", kind: "pause", message };
  }
  if (error instanceof Anthropic.BadRequestError && lower.includes("usage limits")) {
    return { code: "workspace_limit", kind: "pause", message };
  }
  if (error instanceof Anthropic.RateLimitError) {
    if (lower.includes("spend_limit") || lower.includes("spend limit")) return { code: "spend_limit", kind: "pause", message };
    return { code: "rate_limited", kind: "retry", message, retryAfterSeconds: retryAfter(error) };
  }
  if (error instanceof Anthropic.NotFoundError) {
    return { code: "model_unavailable", kind: "pause", message };
  }
  if (error instanceof Anthropic.InternalServerError || error.status === 529 || type === "overloaded_error" || type === "api_error") {
    return { code: type === "overloaded_error" || error.status === 529 ? "overloaded" : "server_error", kind: "retry", message, retryAfterSeconds: retryAfter(error) };
  }
  if (error.status === 408 || error.status === 409 || type === "timeout_error") {
    return { code: "timeout", kind: "retry", message, retryAfterSeconds: retryAfter(error) };
  }
  return { code: `http_${error.status ?? "unknown"}`, kind: "fatal", message };
}
