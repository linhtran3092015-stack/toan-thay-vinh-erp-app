import { NextResponse } from "next/server";

import { checkSupabaseHealth } from "@/lib/supabase/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkSupabaseHealth();

  return NextResponse.json(health, {
    headers: {
      "Cache-Control": "no-store",
    },
    status: health.connected ? 200 : 503,
  });
}
