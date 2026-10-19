import { NextResponse } from "next/server";

import { ingestGradingSubmission } from "@/features/grading-submissions/intake";
import { GRADING_WEBHOOK_MAX_BODY_BYTES, parseGradingSubmissionPayload } from "@/features/grading-submissions/payload";
import {
  GRADING_SIGNATURE_HEADER,
  GRADING_TIMESTAMP_HEADER,
  verifyGradingSignature,
} from "@/features/grading-submissions/signature";
import { getVietnamToday } from "@/lib/datetime";
import { getGradingFormEnv } from "@/lib/env";
import { raiseOpsAlert } from "@/lib/ops-alerts";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" }, status });
}

/**
 * End-of-session test submitted through the Apps Script form (plan §4.2). Apps Script appends
 * the Sheet row first, then posts here; a failed post is resent by its 10-minute trigger, so any
 * non-2xx answer except 400/413/415/422 means "try again later".
 */
export async function POST(request: Request) {
  let secret: string;
  try {
    secret = getGradingFormEnv().secret;
  } catch {
    return json({ ok: false }, 503);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ ok: false }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > GRADING_WEBHOOK_MAX_BODY_BYTES) {
    return json({ ok: false }, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ ok: false }, 400);
  }

  if (Buffer.byteLength(rawBody, "utf8") > GRADING_WEBHOOK_MAX_BODY_BYTES) {
    return json({ ok: false }, 413);
  }

  if (
    !rawBody ||
    !verifyGradingSignature({
      message: rawBody,
      secret,
      signature: request.headers.get(GRADING_SIGNATURE_HEADER),
      timestamp: request.headers.get(GRADING_TIMESTAMP_HEADER),
    })
  ) {
    return json({ ok: false }, 401);
  }

  const parsed = parseGradingSubmissionPayload(rawBody);
  if (!parsed.ok) {
    // Never log the body: it carries the child's name and answer.
    console.error("GRADING_SUBMISSION_VALIDATION_FAILED:", parsed.error, "bodyLength:", rawBody.length);
    return json({ error: parsed.error, ok: false }, 400);
  }

  let supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
  try {
    supabase = createSupabaseServiceRoleClient();
  } catch {
    return json({ ok: false }, 503);
  }

  let result: Awaited<ReturnType<typeof ingestGradingSubmission>>;
  try {
    result = await ingestGradingSubmission(supabase, parsed.data);
  } catch {
    result = { error: "unexpected", kind: "failed", ok: false };
  }

  if (!result.ok && result.kind === "rejected") {
    // Apps Script marks 422 as final ("Bị từ chối") instead of resending forever.
    console.error("GRADING_SUBMISSION_REJECTED:", result.error);
    return json({ error: result.error, ok: false }, 422);
  }

  if (!result.ok) {
    console.error("GRADING_SUBMISSION_INGEST_FAILED:", result.error);
    await raiseOpsAlert(supabase, {
      code: "grading_submission_ingest_failed",
      dedupeKey: `ops.grading_submission_ingest_failed:${getVietnamToday()}`,
      href: "/grading-submissions",
      message: `Bài nộp từ form chưa ghi được vào ERP (${result.error}). Apps Script sẽ tự gửi lại sau 10 phút; nếu lặp lại, kiểm tra kết nối Supabase.`,
      title: "Nhận bài nộp lỗi",
    });
    return json({ ok: false }, 500);
  }

  return json({ duplicate: result.duplicate, matchStatus: result.matchStatus, ok: true }, 200);
}
