import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904010000_owner_managed_attendance_verification.sql",
  ),
  "utf8",
);

describe("owner-managed attendance verification migration", () => {
  it("grants a dedicated management permission only to the owner by default", () => {
    expect(migration).toContain("'timekeeping.manage_verification'");
    expect(migration).toMatch(/where role\.code = 'owner'/);
    expect(migration).toMatch(/has_permission\('timekeeping\.manage_verification'\)/);
  });

  it("enforces GPS and the optional Wi-Fi allowlist in one database validator", () => {
    expect(migration).toContain("function public.validate_offline_attendance_evidence");
    expect(migration).toContain("TIME_ENTRY_GPS_REQUIRED_FOR_OFFLINE");
    expect(migration).toContain("TIME_ENTRY_OUTSIDE_GEOFENCE");
    expect(migration).toContain("TIME_ENTRY_WIFI_REQUIRED_FOR_OFFLINE");
    expect(migration).toContain("TIME_ENTRY_WIFI_NOT_ALLOWED");
    expect(migration.match(/perform public\.validate_offline_attendance_evidence/g)).toHaveLength(2);
    expect(migration).toMatch(/if not found then\s+return null;/);
  });

  it("persists both check-in and check-out Wi-Fi evidence", () => {
    expect(migration).toMatch(/result_entry\.id, 'check_in', 'wifi'/);
    expect(migration).toMatch(/result_entry\.id, 'check_out', 'wifi'/);
  });

  it("keeps the personal read model on the current Vietnam business date", () => {
    expect(migration).toMatch(/business_date date := \(pg_catalog\.now\(\) at time zone 'Asia\/Ho_Chi_Minh'\)::date/);
    expect(migration).toMatch(/entry\.work_date = business_date/);
  });

  it("scopes the teaching-assistant watchdog to on-site sessions", () => {
    expect(migration).toMatch(/entry\.check_in_mode = 'offline'/);
    expect(migration).toContain("'gps_verification_required', false");
  });
});
