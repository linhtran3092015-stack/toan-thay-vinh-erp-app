import "server-only";

import { after } from "next/server";

import { runGradingWorker } from "@/features/ai-grading/worker";
import { getAnthropicApiKey } from "@/lib/env";

/**
 * Start a worker batch after the response is sent: a submission arrived, "AI đọc đề" was
 * requested, a key was confirmed, or someone opened a session with AI work pending. after()
 * runs for the route's maxDuration (300 s on the routes that call this). Never throws.
 */
export function kickGradingWorker(reason: string): void {
  if (!getAnthropicApiKey()) return;
  try {
    after(async () => {
      try {
        await runGradingWorker({ deadlineMs: 270_000 });
      } catch (error) {
        console.error("[ai-grading] worker failed", reason, error instanceof Error ? error.message : error);
      }
    });
  } catch (error) {
    // after() is only available inside a request; nothing to schedule elsewhere (e.g. scripts).
    console.error("[ai-grading] could not schedule the worker", reason, error instanceof Error ? error.message : error);
  }
}
