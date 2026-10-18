// Value: protects=the caps /audit names ("hiển thị 100 mới nhất", "tùy chọn lấy từ 1.000 bản ghi mới nhất") are the ones getAuditLogsResult asks for, the loader still filters and normalises exactly as before the helpers moved to audit-log-models.ts, and the /dev/lists fixture query runs the loader's own filter normaliser and actor label (no copy);
// fails_when=a loader .limit(...) changes without the constant the page states (or a literal comes back), data.ts loses its server-only guard, the moved normalisers stop being applied (untrimmed values, invalid dates sent), a filter becomes partial (ilike) or the Vietnam-day bounds shift, or the loader or the fixture re-inlines the filter object or the actor label;
// why_new=step 14d replaces the loader's literals with AUDIT_LOG_ROW_LIMIT / AUDIT_FILTER_OPTION_ROW_LIMIT and moves its helpers; seam=source text of data.ts plus a recording fake of the Supabase query builder; no_claim=what PostgREST or RLS return for these calls
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { auditPreviewActorIds, auditPreviewProfiles, runAuditPreviewQuery } from "@/app/dev/lists/audit-fixtures";
import {
  AUDIT_FILTER_OPTION_ROW_LIMIT,
  AUDIT_LOG_ROW_LIMIT,
  normalizeAuditFilters,
} from "@/features/audit/audit-log-models";

const source = readFileSync(join(process.cwd(), "src/features/audit/data.ts"), "utf8");
const fixtureSource = readFileSync(join(process.cwd(), "src/app/dev/lists/audit-fixtures.ts"), "utf8");

type Call = [method: string, ...args: unknown[]];

const supabase = vi.hoisted(() => {
  const calls: { table: string; chain: Call[] }[] = [];
  const results = new Map<string, unknown[]>();

  function builder(table: string) {
    const record = { chain: [] as Call[], table };
    calls.push(record);
    const query: Record<string, unknown> = {};
    for (const method of ["select", "order", "limit", "eq", "gte", "lt", "in"]) {
      query[method] = (...args: unknown[]) => {
        record.chain.push([method, ...args]);
        return query;
      };
    }
    // Awaiting the builder resolves like PostgREST: the audit read (count), the catalog read, the profiles read.
    query.then = (resolve: (value: unknown) => void) => {
      const isMain = record.chain.some(([method, , options]) => method === "select" && Boolean(options));
      const key = table === "profiles" ? "profiles" : isMain ? "main" : "catalog";
      const data = results.get(key) ?? [];
      resolve({ count: isMain ? data.length : null, data, error: null });
    };
    return query;
  }

  return { builder, calls, results };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: (table: string) => supabase.builder(table) })),
}));

afterEach(() => {
  supabase.calls.length = 0;
  supabase.results.clear();
});

describe("audit list load limits (source)", () => {
  it("keeps data.ts server-only and imports both caps from the models file", () => {
    expect(source).toMatch(/^import "server-only";/);
    expect(source).toMatch(/import \{[^}]*AUDIT_FILTER_OPTION_ROW_LIMIT,[^}]*AUDIT_LOG_ROW_LIMIT,[^}]*\} from "@\/features\/audit\/audit-log-models";/);
  });

  it("caps the audit read at AUDIT_LOG_ROW_LIMIT and the option read at AUDIT_FILTER_OPTION_ROW_LIMIT, with no literal limit left", () => {
    expect(source).toContain(".limit(AUDIT_LOG_ROW_LIMIT);");
    expect(source).toContain(".limit(AUDIT_FILTER_OPTION_ROW_LIMIT),");
    expect(source).not.toMatch(/\.limit\(\d/);
    expect(source).not.toMatch(/MAX_AUDIT_ROWS|MAX_CATALOG_ROWS/);
    expect(AUDIT_LOG_ROW_LIMIT).toBe(100);
    expect(AUDIT_FILTER_OPTION_ROW_LIMIT).toBe(1000);
  });
});

describe("getAuditLogsResult after the helpers moved", () => {
  it("asks for the newest 100 rows with an exact count and the newest 1.000 for options", async () => {
    const { getAuditLogsResult } = await import("@/features/audit/data");
    await getAuditLogsResult({});

    const [main, catalog] = supabase.calls;
    expect(main.table).toBe("audit_logs");
    expect(main.chain).toContainEqual(["select", expect.stringContaining("old_data,new_data"), { count: "exact" }]);
    expect(main.chain).toContainEqual(["limit", 100]);
    expect(main.chain.filter(([method]) => ["eq", "gte", "lt"].includes(method))).toEqual([]);
    expect(catalog.table).toBe("audit_logs");
    expect(catalog.chain).toContainEqual(["limit", 1000]);
  });

  it("normalises the raw URL values, filters exactly and bounds days in Vietnam time", async () => {
    const { getAuditLogsResult } = await import("@/features/audit/data");
    const result = await getAuditLogsResult({
      action: "  student_updated ",
      actorId: `${"a".repeat(36)}-extra`,
      entityId: " HS0142 ",
      entityType: "student",
      fromDate: "2026-10-01",
      module: "students",
      toDate: "2026-10-31",
    });

    const [main] = supabase.calls;
    expect(main.chain.filter(([method]) => ["eq", "gte", "lt"].includes(method))).toEqual([
      ["eq", "module", "students"],
      ["eq", "action", "student_updated"],
      ["eq", "entity_type", "student"],
      ["eq", "entity_id", "HS0142"],
      ["eq", "actor_user_id", "a".repeat(36)],
      ["gte", "occurred_at", "2026-10-01T00:00:00+07:00"],
      ["lt", "occurred_at", "2026-11-01T00:00:00+07:00"],
    ]);
    expect(result.ok && result.data.filters).toEqual({
      action: "student_updated",
      actorId: "a".repeat(36),
      entityId: "HS0142",
      entityType: "student",
      fromDate: "2026-10-01",
      module: "students",
      toDate: "2026-10-31",
    });
  });

  it("drops an impossible date instead of sending it", async () => {
    const { getAuditLogsResult } = await import("@/features/audit/data");
    const result = await getAuditLogsResult({ fromDate: "2026-02-30", toDate: "31/10/2026" });

    expect(supabase.calls[0].chain.filter(([method]) => method === "gte" || method === "lt")).toEqual([]);
    expect(result.ok && result.data.filters).toMatchObject({ fromDate: "", toDate: "" });
  });

  it("labels actors from readable profiles and keeps the exact count", async () => {
    supabase.results.set("main", [
      { action: "student_updated", actor_user_id: "p1", entity_id: "s1", entity_type: "student", id: "r1", metadata: {}, module: "students", new_data: null, occurred_at: "2026-10-16T02:00:00+00:00", old_data: null, reason: null, request_id: null },
      { action: "ops_alert_raised", actor_user_id: null, entity_id: "o1", entity_type: "ops_alert", id: "r2", metadata: {}, module: "ops", new_data: null, occurred_at: "2026-10-16T01:00:00+00:00", old_data: null, reason: "x", request_id: null },
    ]);
    supabase.results.set("catalog", [
      { action: "student_updated", actor_user_id: "p1", entity_type: "student", module: "students" },
      { action: "guardian_updated", actor_user_id: "p9", entity_type: "guardian", module: "students" },
    ]);
    supabase.results.set("profiles", [{ display_name: null, email: "lan.nguyen@example.com", id: "p1" }]);

    const { getAuditLogsResult } = await import("@/features/audit/data");
    const result = await getAuditLogsResult({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalCount).toBe(2);
    expect(result.data.entries.map((entry) => entry.actor?.displayName ?? null)).toEqual(["lan.nguyen", null]);
    expect(result.data.options.actors).toEqual([
      { id: "p1", label: "lan.nguyen · lan.nguyen@example.com" },
      { id: "p9", label: "p9" },
    ]);
    expect(result.data.options.modules).toEqual(["students"]);
  });
});

describe("the loader and the /dev/lists fixture share one filter normaliser and actor label", () => {
  it.each([
    ["data.ts", source],
    ["audit-fixtures.ts", fixtureSource],
  ])("%s imports normalizeAuditFilters and getAuditActorOptionLabel instead of re-implementing them", (_name, text) => {
    expect(text).toMatch(/import \{[^}]*getAuditActorOptionLabel,[^}]*normalizeAuditFilters,[^}]*\} from "@\/features\/audit\/audit-log-models";/);
    expect(text).toContain("normalizeAuditFilters(input)");
    expect(text).toContain("getAuditActorOptionLabel(actorId, actor)");
    // No local copy of the caps or the "{name} · {email}" template.
    expect(text).not.toMatch(/normalizeFilter\(|normalizeDate\(/);
    expect(text).not.toContain("} · ${");
  });

  it.each([
    {},
    { action: "  student_updated ", actorId: "x".repeat(50), entityId: ` ${"y".repeat(200)} `, module: "m".repeat(130) },
    { entityType: " student ", fromDate: "2026-02-30", toDate: " 2026-10-16 " },
  ])("returns the same filters from both for %o", async (input) => {
    const { getAuditLogsResult } = await import("@/features/audit/data");
    const loaded = await getAuditLogsResult(input);

    expect(loaded.ok && loaded.data.filters).toEqual(normalizeAuditFilters(input));
    expect(runAuditPreviewQuery([], input).filters).toEqual(normalizeAuditFilters(input));
  });

  it("labels the same readable and unreadable actors identically", async () => {
    const readable = auditPreviewProfiles.find((profile) => profile.id === auditPreviewActorIds.admissions);
    supabase.results.set("catalog", [
      { action: "crm_case_status_changed", actor_user_id: auditPreviewActorIds.admissions, entity_type: "crm_case", module: "crm" },
      { action: "guardian_updated", actor_user_id: auditPreviewActorIds.unreadable, entity_type: "guardian", module: "students" },
    ]);
    supabase.results.set("profiles", [readable]);

    const { getAuditLogsResult } = await import("@/features/audit/data");
    const loaded = await getAuditLogsResult({});
    const fixture = runAuditPreviewQuery(
      [
        { action: "crm_case_status_changed", actor_user_id: auditPreviewActorIds.admissions, entity_id: "c1", entity_type: "crm_case", id: "r1", metadata: {}, module: "crm", new_data: null, occurred_at: "2026-10-14T13:20:00.000+00:00", old_data: null, reason: null, request_id: null },
        { action: "guardian_updated", actor_user_id: auditPreviewActorIds.unreadable, entity_id: "g1", entity_type: "guardian", id: "r2", metadata: {}, module: "students", new_data: null, occurred_at: "2026-10-13T13:20:00.000+00:00", old_data: null, reason: null, request_id: null },
      ],
      {},
    );

    expect(loaded.ok && loaded.data.options.actors).toEqual(fixture.options.actors);
    expect(fixture.options.actors).toEqual([
      { id: auditPreviewActorIds.unreadable, label: auditPreviewActorIds.unreadable },
      { id: auditPreviewActorIds.admissions, label: "minh.tuyensinh · minh.tuyensinh@example.com" },
    ]);
  });
});
