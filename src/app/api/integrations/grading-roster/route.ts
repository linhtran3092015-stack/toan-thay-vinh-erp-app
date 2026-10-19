import { NextResponse } from "next/server";

import { loadGradingFormBirthYears, loadGradingFormRoster } from "@/features/grading-submissions/intake";
import {
  GRADING_SIGNATURE_HEADER,
  GRADING_TIMESTAMP_HEADER,
  gradingRequestMessage,
  verifyGradingSignature,
} from "@/features/grading-submissions/signature";
import { getVietnamToday } from "@/lib/datetime";
import { getGradingFormEnv } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" }, status });
}

/**
 * Student list for the Apps Script form, called server-side by Apps Script (cached 10 minutes
 * there). Without `birthYear`: the birth years that have active students. With it: the
 * students of that year, sorted, with today's sessions (plan §4.2, §4.9).
 */
export async function GET(request: Request) {
  let secret: string;
  try {
    secret = getGradingFormEnv().secret;
  } catch {
    return json({ ok: false }, 503);
  }

  const url = new URL(request.url);
  if (
    !verifyGradingSignature({
      message: gradingRequestMessage("GET", url),
      secret,
      signature: request.headers.get(GRADING_SIGNATURE_HEADER),
      timestamp: request.headers.get(GRADING_TIMESTAMP_HEADER),
    })
  ) {
    return json({ ok: false }, 401);
  }

  const rawBirthYear = url.searchParams.get("birthYear");
  const birthYear = rawBirthYear === null ? null : Number(rawBirthYear);
  if (birthYear !== null && (!/^\d{4}$/.test(rawBirthYear ?? "") || birthYear < 1990 || birthYear > 2100)) {
    return json({ error: "birthYear must be a 4-digit year", ok: false }, 400);
  }

  let supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
  try {
    supabase = createSupabaseServiceRoleClient();
  } catch {
    return json({ ok: false }, 503);
  }

  const today = getVietnamToday();
  try {
    if (birthYear === null) {
      const years = await loadGradingFormBirthYears(supabase, today);
      return years.ok ? json({ birthYears: years.birthYears, date: today, ok: true }, 200) : json({ ok: false }, 500);
    }

    const roster = await loadGradingFormRoster(supabase, birthYear, today);
    return roster.ok ? json({ birthYear, date: today, ok: true, students: roster.students }, 200) : json({ ok: false }, 500);
  } catch {
    return json({ ok: false }, 500);
  }
}
