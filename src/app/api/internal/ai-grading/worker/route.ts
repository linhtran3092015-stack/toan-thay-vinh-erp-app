import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runGradingWorker } from "@/features/ai-grading/worker";
import { getAnthropicApiKey, getCronSecret } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" }, status });
}

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const given = Buffer.from(header ?? "", "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Safety net for the AI grading queue (plan §4.6): the GitHub Actions schedule calls this every
 * 5 minutes with "Authorization: Bearer <CRON_SECRET>" in case no after() batch picked a run up.
 */
export async function POST(request: Request) {
  const secret = getCronSecret();
  if (!secret) return json({ ok: false }, 503);
  if (!authorized(request.headers.get("authorization"), secret)) return json({ ok: false }, 401);
  if (!getAnthropicApiKey()) return json({ ok: true, stopped: "no_api_key" });

  const summary = await runGradingWorker({ deadlineMs: 280_000 });
  return json({ ok: true, ...summary });
}
