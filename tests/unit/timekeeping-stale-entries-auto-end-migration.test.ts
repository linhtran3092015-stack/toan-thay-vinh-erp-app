import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260907030000_auto_end_all_stale_time_entries.sql",
  ),
  "utf8",
);

/**
 * Pure simulation of the SQL watchdog decision logic to verify edge cases
 */
interface TimeEntryRecord {
  checkInAtMs: number;
  checkInMode: "online" | "offline";
  isTeachingAssistant: boolean;
  lastLocationAtMs: number | null;
  workDate: string;
}

interface WatchdogDecision {
  effectiveEndMs: number;
  reason: "location_lost" | "daily_cutoff";
  shouldClose: boolean;
}

function evaluateWatchdogDecision(
  entry: TimeEntryRecord,
  nowMs: number,
  businessDate: string,
  businessTime: string, // "HH:MM"
): WatchdogDecision {
  const dailyCutoffMs = new Date(`${entry.workDate}T23:30:00+07:00`).getTime();
  const locationLossMs =
    (entry.lastLocationAtMs ?? entry.checkInAtMs) + 90 * 1000;

  // Case 1: Teaching Assistant with offline mode & continuous location loss before cutoff
  if (
    entry.isTeachingAssistant &&
    entry.checkInMode === "offline" &&
    nowMs >= locationLossMs &&
    locationLossMs <= dailyCutoffMs
  ) {
    return {
      effectiveEndMs: locationLossMs,
      reason: "location_lost",
      shouldClose: true,
    };
  }

  // Case 2: Daily cutoff reached for ANY staff role (past date or >= 23:30 today)
  if (
    entry.workDate < businessDate ||
    (entry.workDate === businessDate && businessTime >= "23:30")
  ) {
    return {
      effectiveEndMs: dailyCutoffMs,
      reason: "daily_cutoff",
      shouldClose: true,
    };
  }

  return {
    effectiveEndMs: 0,
    reason: "daily_cutoff",
    shouldClose: false,
  };
}

describe("auto-end all stale time entries migration", () => {
  describe("Migration SQL Structure Verification", () => {
    it("contains one-time data cleanup for historical unclosed entries", () => {
      expect(migration).toContain("update public.time_entries");
      expect(migration).toContain("status = 'auto_ended'");
      expect(migration).toContain("clock_out_reason = 'daily_cutoff'");
      expect(migration).toContain("where status = 'open'");
      expect(migration).toMatch(/work_date < \(pg_catalog\.now\(\) at time zone 'Asia\/Ho_Chi_Minh'\)::date/);
    });

    it("redefines run_teaching_assistant_timekeeping_watchdog to evaluate all open entries", () => {
      expect(migration).toContain(
        "create or replace function public.run_teaching_assistant_timekeeping_watchdog()",
      );
      // Iterates over all open entries regardless of role
      expect(migration).toMatch(/from public\.time_entries as entry\s+where entry\.status = 'open'/);
      expect(migration).toContain("role.code = 'teaching_assistant'");
      expect(migration).toContain("effective_reason := 'location_lost'");
      expect(migration).toContain("effective_reason := 'daily_cutoff'");
    });

    it("ensures auto_end_stale_teaching_assistant_time_entries routes to the watchdog", () => {
      expect(migration).toContain(
        "create or replace function public.auto_end_stale_teaching_assistant_time_entries()",
      );
      expect(migration).toContain("return public.run_teaching_assistant_timekeeping_watchdog();");
    });

    it("updates get_my_timekeeping_entries to include open entries from any date", () => {
      expect(migration).toContain(
        "create or replace function public.get_my_timekeeping_entries()",
      );
      expect(migration).toMatch(
        /where entry\.staff_id = actor_id\s+and \(entry\.work_date = business_date or entry\.status = 'open'\)/,
      );
    });
  });

  describe("Watchdog Decision Logic Simulation", () => {
    it("auto-ends stale entry from yesterday for non-TA role (e.g. assistant_manager)", () => {
      const yesterday = "2026-09-06";
      const today = "2026-09-07";
      const checkInAtMs = new Date("2026-09-06T08:00:00+07:00").getTime();
      const nowMs = new Date("2026-09-07T09:00:00+07:00").getTime();

      const decision = evaluateWatchdogDecision(
        {
          checkInAtMs,
          checkInMode: "offline",
          isTeachingAssistant: false,
          lastLocationAtMs: null,
          workDate: yesterday,
        },
        nowMs,
        today,
        "09:00",
      );

      expect(decision.shouldClose).toBe(true);
      expect(decision.reason).toBe("daily_cutoff");
      expect(decision.effectiveEndMs).toBe(
        new Date("2026-09-06T23:30:00+07:00").getTime(),
      );
    });

    it("keeps active session open during normal work hours today for non-TA role", () => {
      const today = "2026-09-07";
      const checkInAtMs = new Date("2026-09-07T14:00:00+07:00").getTime();
      const nowMs = new Date("2026-09-07T15:30:00+07:00").getTime();

      const decision = evaluateWatchdogDecision(
        {
          checkInAtMs,
          checkInMode: "offline",
          isTeachingAssistant: false,
          lastLocationAtMs: null,
          workDate: today,
        },
        nowMs,
        today,
        "15:30",
      );

      expect(decision.shouldClose).toBe(false);
    });

    it("auto-ends active session for non-TA role once 23:30 cutoff is reached today", () => {
      const today = "2026-09-07";
      const checkInAtMs = new Date("2026-09-07T14:00:00+07:00").getTime();
      const nowMs = new Date("2026-09-07T23:31:00+07:00").getTime();

      const decision = evaluateWatchdogDecision(
        {
          checkInAtMs,
          checkInMode: "offline",
          isTeachingAssistant: false,
          lastLocationAtMs: null,
          workDate: today,
        },
        nowMs,
        today,
        "23:31",
      );

      expect(decision.shouldClose).toBe(true);
      expect(decision.reason).toBe("daily_cutoff");
      expect(decision.effectiveEndMs).toBe(
        new Date("2026-09-07T23:30:00+07:00").getTime(),
      );
    });

    it("auto-ends online teaching assistant session at daily cutoff", () => {
      const today = "2026-09-07";
      const checkInAtMs = new Date("2026-09-07T18:00:00+07:00").getTime();
      const nowMs = new Date("2026-09-07T23:35:00+07:00").getTime();

      const decision = evaluateWatchdogDecision(
        {
          checkInAtMs,
          checkInMode: "online",
          isTeachingAssistant: true,
          lastLocationAtMs: null,
          workDate: today,
        },
        nowMs,
        today,
        "23:35",
      );

      expect(decision.shouldClose).toBe(true);
      expect(decision.reason).toBe("daily_cutoff");
      expect(decision.effectiveEndMs).toBe(
        new Date("2026-09-07T23:30:00+07:00").getTime(),
      );
    });

    it("preserves location_lost precedence when offline teaching assistant loses GPS before cutoff", () => {
      const today = "2026-09-07";
      const checkInAtMs = new Date("2026-09-07T14:00:00+07:00").getTime();
      const lastLocationAtMs = new Date("2026-09-07T14:30:00+07:00").getTime();
      const nowMs = new Date("2026-09-07T14:32:00+07:00").getTime();

      const decision = evaluateWatchdogDecision(
        {
          checkInAtMs,
          checkInMode: "offline",
          isTeachingAssistant: true,
          lastLocationAtMs,
          workDate: today,
        },
        nowMs,
        today,
        "14:32",
      );

      expect(decision.shouldClose).toBe(true);
      expect(decision.reason).toBe("location_lost");
      expect(decision.effectiveEndMs).toBe(lastLocationAtMs + 90 * 1000);
    });
  });
});
