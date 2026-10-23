import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const migration = read("supabase/migrations/20261023180000_timekeeping_readjust_mode_and_delete.sql");
const pgTapFiles = [
  "supabase/tests/timekeeping-readjust-mode-delete.test.sql",
  "supabase/tests/timekeeping-admin-adjust-keeps-mode.test.sql",
];
const generatedTypes = read("src/types/database.generated.ts");

function routine(name: string): string {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  expect(start, `missing routine ${name}`).toBeGreaterThanOrEqual(0);
  return migration.slice(start, migration.indexOf("$$;", start));
}

/** Both markers must exist and `first` must come before `second`. */
function expectOrdered(body: string, first: string, second: string) {
  const firstAt = body.indexOf(first);
  const secondAt = body.indexOf(second);
  expect(firstAt, `missing ${first}`).toBeGreaterThanOrEqual(0);
  expect(secondAt, `missing ${second}`).toBeGreaterThanOrEqual(0);
  expect(firstAt).toBeLessThan(secondAt);
}

describe("timekeeping re-adjust / mode / delete migration", () => {
  it("supersedes the approval in effect before a new one becomes approved", () => {
    expectOrdered(
      routine("admin_adjust_time_entry"),
      "perform public.supersede_time_entry_adjustment(target_entry.id)",
      "insert into public.time_entry_adjustment_requests",
    );
    expectOrdered(
      routine("decide_time_entry_adjustment"),
      "perform public.supersede_time_entry_adjustment(target_entry.id)",
      "update public.time_entry_adjustment_requests",
    );
  });

  it("locks the time entry before the request row in decide, like adjust and delete", () => {
    expectOrdered(
      routine("decide_time_entry_adjustment"),
      "from public.time_entries as entry",
      "from public.time_entry_adjustment_requests as request\n  where request.id = p_time_entry_adjustment_request_id\n  for update",
    );
  });

  it("refuses every change to a month whose payroll left draft", () => {
    for (const name of ["admin_adjust_time_entry", "decide_time_entry_adjustment", "admin_delete_time_entry"]) {
      expect(routine(name)).toContain("perform public.assert_time_entry_month_unlocked(target_entry.work_date)");
    }
    expect(routine("admin_create_time_entry")).toContain("perform public.assert_time_entry_month_unlocked(p_work_date)");
    expect(routine("decide_attendance_exception")).toContain("perform public.assert_time_entry_month_unlocked(target.work_date)");
    expect(routine("assert_time_entry_month_unlocked")).toContain("period.status");
  });

  it("switches the delete bypass off again and keeps coordinates out of the audit", () => {
    const remove = routine("admin_delete_time_entry");
    expectOrdered(remove, "set_config('app.allow_time_entry_delete', 'true', true)", "delete from public.time_entries");
    expectOrdered(remove, "delete from public.time_entries", "set_config('app.allow_time_entry_delete', 'false', true)");
    expect(remove).not.toMatch(/gps_latitude|wifi_bssid|wifi_ssid/);
    expect(remove).toMatch(/to_jsonb\(target_entry\)\s*- 'last_latitude' - 'last_longitude' - 'last_location_accuracy'/);
  });

  it("keeps the generated types in step with the RPC signatures", () => {
    expect(generatedTypes).toMatch(/admin_adjust_time_entry: \{\s*Args: \{[^}]*p_mode\?: string/);
    expect(generatedTypes).toContain("admin_delete_time_entry: {");
    expect(generatedTypes).toContain("Args: { p_reason: string; p_time_entry_id: string }");
  });

  it.each(pgTapFiles)("%s declares a pgTAP plan matching its assertions", (path) => {
    const pgTapTest = read(path);
    const planned = Number(/select plan\((\d+)\);/.exec(pgTapTest)?.[1]);
    const assertions = pgTapTest.match(/^select (?:ok|is|isnt|lives_ok|throws_ok|throws_like|results_eq|set_eq|bag_eq|is_empty|cmp_ok|matches)\(/gm) ?? [];
    expect(assertions.length).toBe(planned);
  });
});
