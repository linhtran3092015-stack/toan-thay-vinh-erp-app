import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-SHA256 between the Apps Script submission form and the ERP (same scheme as SePay):
 * `x-ttv-signature: sha256=<hex of HMAC(secret, "<timestamp>.<message>")>` with `x-ttv-timestamp`
 * in unix seconds, at most 5 minutes off. The message is the raw body for the webhook and
 * `GET <path>?<query>` for the roster.
 */
export const GRADING_SIGNATURE_HEADER = "x-ttv-signature";
export const GRADING_TIMESTAMP_HEADER = "x-ttv-timestamp";
export const GRADING_SIGNATURE_MAX_SKEW_SECONDS = 5 * 60;

const SIGNATURE_PREFIX = "sha256=";
const TIMESTAMP_PATTERN = /^\d{1,12}$/;

export function signGradingMessage(secret: string, timestampSeconds: number, message: string): string {
  return `${SIGNATURE_PREFIX}${createHmac("sha256", secret).update(`${timestampSeconds}.${message}`, "utf8").digest("hex")}`;
}

/** Message signed for a GET: method, path and query exactly as requested. */
export function gradingRequestMessage(method: string, url: URL): string {
  return `${method.toUpperCase()} ${url.pathname}${url.search}`;
}

export function verifyGradingSignature({
  message,
  nowMs = Date.now(),
  secret,
  signature,
  timestamp,
}: {
  message: string;
  nowMs?: number;
  secret: string;
  signature: string | null;
  timestamp: string | null;
}): boolean {
  if (!signature || !timestamp || !TIMESTAMP_PATTERN.test(timestamp)) return false;

  const timestampSeconds = Number(timestamp);
  if (Math.abs(Math.floor(nowMs / 1000) - timestampSeconds) > GRADING_SIGNATURE_MAX_SKEW_SECONDS) return false;

  const received = Buffer.from(signature.trim().toLowerCase());
  const expected = Buffer.from(signGradingMessage(secret, timestampSeconds, message));

  return received.length === expected.length && timingSafeEqual(received, expected);
}
