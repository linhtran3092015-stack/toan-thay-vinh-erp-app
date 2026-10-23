import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPaymentRequestCreationOptions } from "@/features/finance/payment-request-create-data";

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

/** A students row with its primary-guardian embed; `guardian: null` is a guardian the reader cannot see. */
function student(id: string, fullName: string, guardian: { full_name: string; phone: string } | null = { full_name: `PH ${id}`, phone: "0900000000" }) {
  return {
    full_name: fullName,
    id,
    public_code: `TTV-${id}`,
    student_guardians: [{ ended_at: null, guardian, is_primary: true }],
  };
}

const ok = (rows: Array<Record<string, unknown>>): Page => ({ data: rows, error: null });

describe("getPaymentRequestCreationOptions", () => {
  beforeEach(() => {
    dependencies.pages = [];
    dependencies.range.mockReset();
    // Past the scripted pages the table is empty.
    dependencies.range.mockImplementation(async (from: number) => dependencies.pages[from / 500] ?? ok([]));
    dependencies.from.mockReset();
    dependencies.from.mockImplementation(() => {
      const query = { eq: vi.fn(), in: vi.fn(), is: vi.fn(), order: vi.fn(), range: dependencies.range, select: vi.fn() };
      for (const step of [query.select, query.in, query.eq, query.is, query.order]) step.mockReturnValue(query);
      return query;
    });
  });

  // Value: protects=the new payment request picker offers every payable student past the first 500-row page, by given name, minus students whose guardian is unreadable;
  // fails_when=the loader goes back to one capped read, stops after a full page, keeps PostgREST's family-name order, or offers a student with no guardian to bill;
  // why_new=no test loaded the payment request creation options;
  // seam=none; no_claim=mocked PostgREST pages; does not prove the !inner primary-guardian filter or that order(full_name, id) gives non-overlapping pages
  it("reads every page, lists students by given name and drops a student without a readable guardian", async () => {
    // PostgREST hands rows back in full_name order (family name first), 500 per page.
    dependencies.pages = [
      ok([
        ...Array.from({ length: 499 }, (_, index) => student(`minh-${index}`, "Nguyễn Văn Minh")),
        student("binh", "Vũ Đức Bình", null),
      ]),
      ok([student("an", "Vũ Thị An", { full_name: "Vũ Văn Hùng", phone: "0912345678" }), student("yen", "Vương Văn Yến")]),
    ];

    const result = await getPaymentRequestCreationOptions();

    expect(dependencies.range.mock.calls).toEqual([
      [0, 499],
      [500, 999],
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((option) => option.name)).toEqual([
      "Vũ Thị An",
      ...Array.from({ length: 499 }, () => "Nguyễn Văn Minh"),
      "Vương Văn Yến",
    ]);
    expect(result.data[0]).toEqual({
      guardianName: "Vũ Văn Hùng",
      guardianPhone: "0912345678",
      id: "an",
      name: "Vũ Thị An",
      publicCode: "TTV-an",
    });
  });
});
