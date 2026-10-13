// Value: protects=a composite class lists each non-ended component class once (future links included, with effectiveFrom), in component_order,
// for object or array embeds; a link read error fails the page;
// fails_when=future links are dropped again, ended links are listed, the component_order sort or dedupe is lost, an array embed is lost, or a link error is swallowed;
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
  // Value: protects=every non-ended link is listed once per component in component order, carrying the earliest effectiveFrom;
  // fails_when=the dedupe/order is lost, effectiveFrom is missing, or a later window overwrites an earlier effectiveFrom;
  // why_new=componentClasses now carries effectiveFrom and keeps future links (api-contract review);
  // seam=none; no_claim=does not prove PostgREST returns effective_from as an ISO date string
  it("lists non-ended components once each, in component order, with the earliest effectiveFrom", async () => {
    const calls = arrange({
      data: [
        { component: algebra, component_order: 1, effective_from: "2026-09-01", effective_to: "2026-10-31" },
        // Same component linked again for a later period.
        { component: [algebra], component_order: 1, effective_from: "2026-11-01", effective_to: null },
        { component: [geometry], component_order: 2, effective_from: "2026-10-13", effective_to: null },
        { component: null, component_order: 3, effective_from: "2026-09-01", effective_to: null },
      ],
      error: null,
    });

    const result = await getClassDetail("class-1", { includeStudentCounts: false });

    expect(calls.class_component_links).toContainEqual(["eq", ["parent_class_id", "class-1"]]);
    expect(calls.class_component_links).toContainEqual(["or", ["effective_to.is.null,effective_to.gte.2026-10-13"]]);
    expect(calls.class_component_links).toContainEqual(["order", ["component_order", { ascending: true }]]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail.componentClasses).toEqual([
      { ...algebra, effectiveFrom: "2026-09-01" },
      { ...geometry, effectiveFrom: "2026-10-13" },
    ]);
  });

  // Value: protects=a link starting after today still marks the class composite (the database already rejects its schedule templates and
  // sessions dated from that start), exposing effectiveFrom so the UI can say when;
  // fails_when=componentClasses filters on effective_from <= today again, or effective_from stops being selected;
  // why_new=api-contract review: b6d2930 dropped future links while validate_component_parent_schedule rejects templates overlapping any link;
  // seam=none; no_claim=does not prove which session dates the database accepts before effectiveFrom
  it("keeps links that start after today, with their effectiveFrom", async () => {
    const calls = arrange({
      data: [
        { component: algebra, component_order: 1, effective_from: "2026-10-14", effective_to: null },
        { component: [geometry], component_order: 2, effective_from: "2026-11-01", effective_to: "2027-05-31" },
      ],
      error: null,
    });

    const result = await getClassDetail("class-1", { includeStudentCounts: false });

    expect(calls.class_component_links?.find(([method]) => method === "select")?.[1][0]).toContain("effective_from");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail.componentClasses).toEqual([
      { ...algebra, effectiveFrom: "2026-10-14" },
      { ...geometry, effectiveFrom: "2026-11-01" },
    ]);
  });

  // Value: protects=a link that ended before today does not make the class composite, even if the server filter lets it through;
  // fails_when=the effective_to >= today check is dropped on both the query and the mapping, or a link ending today is treated as ended;
  // why_new=componentClasses now keeps future links, so ended-link exclusion needs its own test;
  // seam=none; no_claim=does not prove PostgREST applies the or() filter
  it("leaves out links that ended before today but keeps one ending today", async () => {
    arrange({
      data: [
        { component: algebra, component_order: 1, effective_from: "2026-09-01", effective_to: "2026-10-12" },
        { component: geometry, component_order: 2, effective_from: "2026-09-01", effective_to: "2026-10-13" },
      ],
      error: null,
    });

    const result = await getClassDetail("class-1", { includeStudentCounts: false });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail.componentClasses).toEqual([{ ...geometry, effectiveFrom: "2026-09-01" }]);
  });

  it("fails with component_links_query_failed when the link read errors", async () => {
    arrange({ data: null, error: { message: "denied" } });

    const result = await getClassDetail("class-1", { includeStudentCounts: false });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("component_links_query_failed");
  });
});
