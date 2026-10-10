import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const SEPAY_SIGNATURE_PREFIX = "sha256=";
const SEPAY_MAX_TIMESTAMP_AGE_SECONDS = 5 * 60;

const sepayWebhookPayloadSchema = z
  .object({
    accountNumber: z.coerce.string().trim().min(1, "accountNumber is required"),
    code: z.string().trim().nullable().optional(),
    content: z.string().trim().optional().default(""),
    description: z.string().trim().nullable().optional(),
    gateway: z.string().trim().optional().default("UNKNOWN"),
    id: z.coerce.number().int().nonnegative("id must be >= 0").max(Number.MAX_SAFE_INTEGER),
    referenceCode: z.string().trim().nullable().optional(),
    transactionDate: z.string().trim().min(1, "transactionDate is required"),
    transferAmount: z.coerce
      .number()
      .int()
      .nonnegative("transferAmount must be >= 0")
      .max(Number.MAX_SAFE_INTEGER)
      .optional()
      .default(0),
    transferType: z.preprocess(
      (val) => {
        if (typeof val === "string") {
          const lower = val.toLowerCase().trim();
          if (lower === "credit" || lower === "in") return "in";
          if (lower === "debit" || lower === "out") return "out";
        }
        return val ?? "in";
      },
      z.enum(["in", "out"]).default("in"),
    ),
  })
  .passthrough()
  .transform((data) => ({
    ...data,
    content: data.content || data.description || "Giao dịch SePay",
  }));

export type SepayWebhookPayload = z.infer<
  typeof sepayWebhookPayloadSchema
>;

export function verifySepayWebhookSignature({
  rawBody,
  secret,
  signature,
  timestamp,
}: {
  rawBody: string;
  secret: string;
  signature: string | null;
  timestamp: string | null;
}): boolean {
  const timestampSeconds = Number(timestamp);

  if (
    !signature ||
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) >
      SEPAY_MAX_TIMESTAMP_AGE_SECONDS
  ) {
    return false;
  }

  const expectedSignature = `${SEPAY_SIGNATURE_PREFIX}${createHmac(
    "sha256",
    secret,
  )
    .update(`${timestampSeconds}.${rawBody}`)
    .digest("hex")}`;
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}

export function parseSepayWebhookPayloadDetailed(
  rawBody: string,
): { ok: true; data: SepayWebhookPayload } | { ok: false; error: string } {
  try {
    const json = JSON.parse(rawBody);
    const result = sepayWebhookPayloadSchema.safeParse(json);

    if (!result.success) {
      const details = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return { ok: false, error: details };
    }

    return { ok: true, data: result.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

export function parseSepayWebhookPayload(
  rawBody: string,
): SepayWebhookPayload | null {
  const result = parseSepayWebhookPayloadDetailed(rawBody);
  if (!result.ok) {
    console.error("SEPAY_WEBHOOK_PAYLOAD_PARSE_FAILED:", result.error, "bodyLength:", rawBody.length);
    return null;
  }
  return result.data;
}

export function toSepayTransactionTimestamp(
  transactionDate: string,
): string | null {
  if (!transactionDate || typeof transactionDate !== "string") {
    return null;
  }

  const trimmed = transactionDate.trim();
  if (!trimmed) return null;

  // Check if it already has timezone offset or Z
  if (/([+-]\d{2}:?\d{2}|Z)$/i.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  // Handle "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss" without tz -> assume Vietnam (+07:00)
  const normalized = trimmed.replace(" ", "T");
  const withTz = Date.parse(`${normalized}+07:00`);
  if (!Number.isNaN(withTz)) {
    return new Date(withTz).toISOString();
  }

  const fallback = Date.parse(trimmed);
  return Number.isNaN(fallback) ? null : new Date(fallback).toISOString();
}
