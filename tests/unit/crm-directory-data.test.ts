import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCrmLeadDirectory } from "@/features/crm/data";

type CrmRow = {
  birth_year: number;
  created_at: string;
  expected_grade: number;
  expected_level: string | null;
  expected_mode: string | null;
  full_name: string;
  guardian_full_name: string;
  guardian_phone: string;
  id: string;
  lead_source: { code: string; name: string };
  public_code: string;
  sale_owner: { display_name: string } | null;
  sale_owner_id: string | null;
  status: "interested" | "trial_booked";
  student_id: string | null;
};

const rows: CrmRow[] = [
  {
    birth_year: 2015,
    created_at: "2026-08-11T08:00:00.000Z",
    expected_grade: 5,
    expected_level: "CLC",
    expected_mode: "offline",
    full_name: "An Nguyen",
    guardian_full_name: "Mai Nguyen",
    guardian_phone: "0900000001",
    id: "case-mma",
    lead_source: { code: "mma_fanpage", name: "MMA Fanpage Facebook" },
    public_code: "CRM-001",
    sale_owner: { display_name: "Sale A" },
    sale_owner_id: "sale-a",
    status: "interested",
    student_id: null,
  },
  {
    birth_year: 2014,
    created_at: "2026-08-10T08:00:00.000Z",
    expected_grade: 6,
    expected_level: "A",
    expected_mode: "online",
    full_name: "Binh Tran",
    guardian_full_name: "Hoa Tran",
    guardian_phone: "0900000002",
    id: "case-referral",
    lead_source: { code: "referral_student", name: "Giới thiệu từ học viên cũ" },
    public_code: "CRM-002",
    sale_owner: { display_name: "Sale B" },
    sale_owner_id: "sale-b",
    status: "trial_booked",
    student_id: null,
  },
];

type QueryCall = { column: string; value: unknown };

function createDirectoryQuery() {
  const calls: QueryCall[] = [];
  let selectQuery = "";
  let ordered = false;
  let limit: number | undefined;

  const query = {
    eq: vi.fn((column: string, value: unknown) => {
      calls.push({ column, value });
      return query;
    }),
    limit: vi.fn((value: number) => {
      limit = value;
      return query;
    }),
    order: vi.fn(() => {
      ordered = true;
      return query;
    }),
    select: vi.fn((value: string) => {
      selectQuery = value;
      return query;
    }),
    then: (resolve: (value: { count: number; data: CrmRow[]; error: null }) => unknown) => {
      let matchingRows = rows.filter((row) =>
        calls.every(({ column, value }) => {
          if (column === "lead_source.code") return row.lead_source.code === value;
          if (column === "status") return row.status === value;
          if (column === "expected_grade") return row.expected_grade === value;
          if (column === "sale_owner_id") return row.sale_owner_id === value;
          return true;
        }),
      );

      if (ordered) {
        matchingRows = [...matchingRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }

      return Promise.resolve(resolve({ count: matchingRows.length, data: matchingRows.slice(0, limit), error: null }));
    },
  };

  return { calls, getLimit: () => limit, getSelectQuery: () => selectQuery, query };
}

let activeQuery = createDirectoryQuery();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: vi.fn(() => activeQuery.query),
  })),
}));

describe("CRM directory source filtering", () => {
  beforeEach(() => {
    activeQuery = createDirectoryQuery();
  });

  it("keeps the existing unfiltered directory query and ordering", async () => {
    const result = await getCrmLeadDirectory();

    expect(result.items.map((item) => item.id)).toEqual(["case-mma", "case-referral"]);
    expect(result.totalCount).toBe(2);
    expect(activeQuery.calls).not.toContainEqual({ column: "lead_source.code", value: expect.anything() });
    expect(activeQuery.getSelectQuery()).toContain("lead_source:crm_lead_sources(name, code)");
    expect(activeQuery.getLimit()).toBe(100);
  });

  it("returns only cases for the requested existing source", async () => {
    const result = await getCrmLeadDirectory({ leadSourceCode: "mma_fanpage" });

    expect(result.items.map((item) => item.id)).toEqual(["case-mma"]);
    expect(result.totalCount).toBe(1);
    expect(activeQuery.calls).toContainEqual({ column: "lead_source.code", value: "mma_fanpage" });
    expect(activeQuery.getSelectQuery()).toContain("lead_source:crm_lead_sources!inner(name, code)");
  });

  it("does not return cases from another source and composes with status", async () => {
    const result = await getCrmLeadDirectory({
      leadSourceCode: "referral_student",
      status: "trial_booked",
    });

    expect(result.items.map((item) => item.id)).toEqual(["case-referral"]);
    expect(activeQuery.calls).toEqual(expect.arrayContaining([
      { column: "lead_source.code", value: "referral_student" },
      { column: "status", value: "trial_booked" },
    ]));
  });
});
