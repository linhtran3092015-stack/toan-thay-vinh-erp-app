import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const SEPAY_SIGNATURE_PREFIX = "sha256=";
const SEPAY_MAX_TIMESTAMP_AGE_SECONDS = 5 * 60;

const sepayWebhookPayloadSchema = z
  .object({
    accountNumber: z.string().trim().min(1),
    code: z.string().trim().nullable().optional(),
    content: z.string().trim().min(1),
    gateway: z.string().trim().min(1),
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    referenceCode: z.string().trim().nullable().optional(),
    transactionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
    transferAmount: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    transferType: z.enum(["in", "out"]),
  })
  .passthrough();

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

export function parseSepayWebhookPayload(
  rawBody: string,
): SepayWebhookPayload | null {
  try {
    const result = sepayWebhookPayloadSchema.safeParse(
      JSON.parse(rawBody),
    );

    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function isExpectedSepayAccount(
  accountNumber: string,
  expectedAccountNumber: string,
): boolean {
  return normalizeAccountNumber(accountNumber) === normalizeAccountNumber(expectedAccountNumber);
}

export function toSepayTransactionTimestamp(
  transactionDate: string,
): string | null {
  const timestamp = Date.parse(
    `${transactionDate.replace(" ", "T")}+07:00`,
  );

  return Number.isNaN(timestamp)
    ? null
    : new Date(timestamp).toISOString();
}

function normalizeAccountNumber(value: string): string {
  return value.replace(/\s+/g, "");
}
