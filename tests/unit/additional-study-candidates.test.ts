import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdditionalStudyCandidates } from "@/features/sessions/attendance-data";

interface Page {
  data: Array<Record<string, unknown>> | null;
  error: unknown;
}

const dependencies = vi.hoisted(() => ({
  from: vi.fn(),
  pages: [] as Page[],
  range: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: dependencies.from })),
}));

function candidate(id: string, fullName: string, overrides: Record<string, unknown> = {}) {
  return { current_grade: 9, full_name: fullName, id, public_code: `TTV-${id}`, registered_mode: "offline", ...overrides };
}

const ok = (rows: Array<Record<string, unknown>>): Page => ({ data: rows, error: null });

// PostgREST hands rows back in full_name order (family name first), 500 per page.
const fullFirstPage = () =>
  ok([
    ...Array.from({ length: 499 }, (_, index) => candidate(`minh-${index}`, "Nguyễn Văn Minh")),
    candidate("binh", "Vũ Đức Bình"),
  ]);

describe("getAdditionalStudyCandidates", () => {
  beforeEach(() => {
    dependencies.pages = [];
    dependencies.range.mockReset();
    // Past the scripted pages the table is empty.
    dependencies.range.mockImplementation(async (from: number) => dependencies.pages[from / 500] ?? ok([]));
    dependencies.from.mockReset();
    dependencies.from.mockImplementation(() => {
      const query = { eq: vi.fn(), order: vi.fn(), range: dependencies.range, select: vi.fn() };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.order.mockReturnValue(query);
      return query;
    });
  });

  // Value: protects=the session page's walk-in picker offers every active student (past the first 500-row page) by given name, pages mixed;
  // fails_when=the loader goes back to one capped read, stops after a full page, asks overlapping/oversized ranges, or keeps PostgREST's family-name order;
  // why_new=no test loaded additional-study candidates; session-detail-route mocks the loader whole;
  // seam=none; no_claim=mocked PostgREST pages; does not prove max_rows on prod or that order(full_name, id) gives non-overlapping pages
  it("reads every active student past the first page and lists them by given name", async () => {
    dependencies.pages = [fullFirstPage(), ok([candidate("an", "Vũ Thị An"), candidate("yen", "Vương Văn Yến")])];

    const result = await getAdditionalStudyCandidates();

    expect(dependencies.range.mock.calls).toEqual([
      [0, 499],
      [500, 999],
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.students.map((student) => student.fullName)).toEqual([
      "Vũ Thị An",
      "Vũ Đức Bình",
      ...Array.from({ length: 499 }, () => "Nguyễn Văn Minh"),
      "Vương Văn Yến",
    ]);
    expect(result.students[0]).toEqual({
      currentGrade: 9,
      fullName: "Vũ Thị An",
      id: "an",
      publicCode: "TTV-an",
      registeredMode: "offline",
    });
  });

  // Value: protects=a failed or malformed later page fails the whole picker closed instead of offering only the students read so far;
  // fails_when=fetchAllPages returns the rows read before an error, keeps paging after it, or row validation skips pages after the first;
  // why_new=the paged read added a per-page error path; nothing exercised an error or a bad row after a full first page;
  // seam=none; no_claim=mocked PostgREST pages; does not prove how the session page renders the error message
  it.each([
    { code: "query_failed", label: "the second page errors", second: { data: null, error: { message: "statement timeout" } } },
    { code: "invalid_response", label: "a second-page row has no public code", second: ok([candidate("an", "Vũ Thị An", { public_code: "" })]) },
  ])("fails closed when $label", async ({ code, second }) => {
    dependencies.pages = [fullFirstPage(), second];

    const result = await getAdditionalStudyCandidates();

    expect(result).toMatchObject({ error: { code }, ok: false });
    expect(dependencies.range).toHaveBeenCalledTimes(2);
  });
});
