// Value: protects=a composite class lists each in-force component class once, in component_order, for object or array embeds;
// a link read error fails the page;
// fails_when=the today filter or component_order sort is dropped, a component linked for two periods shows twice, an array embed is lost, or a link error is swallowed;
// why_new=getClassDetail's componentClasses mapping had no unit test (the workspace tests mock it);
// seam=none; no_claim=does not prove PostgREST accepts the embed alias or the or() filter syntax
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: supabase.from })),
}));
vi.mock("@/lib/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/datetime")>()),
  getVietnamToday: () => "2026-10-13",
}));

import { getClassDetail } from "@/features/classes/data";

type Result = { data: unknown; error: unknown };
type Call = [string, unknown[]];

/** Chainable PostgREST stand-in that records calls per table. */
function tables(results: Record<string, Result>) {
  const calls: Record<string, Call[]> = {};
  supabase.from.mockImplementation((table: string) => {
    const result = results[table];
    if (!result) throw new Error(`Unexpected table query: ${table}`);
    const own = (calls[table] ??= []);
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "is", "or", "order", "maybeSingle"]) {
      builder[method] = vi.fn((...args: unknown[]) => {
        own.push([method, args]);
        return builder;
      });
    }
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return builder;
  });
  return calls;
}

const classRow = {
  academic_year_id: "ay-1",
  classin_url: null,
  code: "L-9A",
  default_learning_mode: "offline",
  grade: 9,
  id: "class-1",
  level: "A",
  name: "Lớp 9A",
  notes: null,
  status: "active",
  weekly_session_count: 2,
};

const algebra = { code: "L-9A-DS", id: "comp-ds", name: "Đại số" };
const geometry = { code: "L-9A-HH", id: "comp-hh", name: "Hình học" };

function arrange(links: Result) {
  return tables({
    academic_years: { data: null, error: null },
    class_component_links: links,
    class_schedule_templates: { data: [], error: null },
    classes: { data: classRow, error: null },
  });
}

beforeEach(() => {
  supabase.from.mockReset();
});

describe("getClassDetail componentClasses", () => {
  // Value: protects=links that started on or before today (including one starting today) are listed once each, in component order;
  // fails_when=the effective_from <= today filter becomes strict (a link starting today is dropped) or the dedupe/order is lost;
  // why_new=fixtures gained effective_from when componentClasses started filtering on it;
  // seam=none; no_claim=does not prove PostgREST returns effective_from as an ISO date string
  it("lists in-force components once each, in component order, for object and array embeds", async () => {
    const calls = arrange({
      data: [
        { component: algebra, component_order: 1, effective_from: "2026-09-01" },
        // Same component linked again for a later period.
        { component: [algebra], component_order: 1, effective_from: "2026-10-13" },
        { component: [geometry], component_order: 2, effective_from: "2026-10-13" },
        { component: null, component_order: 3, effective_from: "2026-09-01" },
      ],
      error: null,
    });

    const result = await getClassDetail("class-1", { includeStudentCounts: false });

    expect(calls.class_component_links).toContainEqual(["eq", ["parent_class_id", "class-1"]]);
    expect(calls.class_component_links).toContainEqual(["or", ["effective_to.is.null,effective_to.gte.2026-10-13"]]);
    expect(calls.class_component_links).toContainEqual(["order", ["component_order", { ascending: true }]]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail.componentClasses).toEqual([algebra, geometry]);
  });

  // Value: protects=a link that starts after today does not make the class composite today (the UI would hide its own session and schedule controls);
  // fails_when=componentClasses ignores effective_from again, or effective_from stops being selected;
  // why_new=red-team found a future-starting link listed as a component while the database still accepts the parent's own sessions dated before it;
  // seam=none; no_claim=does not cover open-ended schedule templates, which the database rejects while any future link overlaps them
  it("leaves out links that start after today", async () => {
    const calls = arrange({
      data: [
        { component: algebra, component_order: 1, effective_from: "2026-10-14" },
        { component: [geometry], component_order: 2, effective_from: "2026-11-01" },
      ],
      error: null,
    });

    const result = await getClassDetail("class-1", { includeStudentCounts: false });

    expect(calls.class_component_links?.find(([method]) => method === "select")?.[1][0]).toContain("effective_from");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail.componentClasses).toEqual([]);
  });

  it("fails with component_links_query_failed when the link read errors", async () => {
    arrange({ data: null, error: { message: "denied" } });

    const result = await getClassDetail("class-1", { includeStudentCounts: false });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("component_links_query_failed");
  });
});
