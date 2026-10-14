// Value: protects=the read-only loaders added for the lead list: chip counts honour grade, sale, source and search but never the status filter, run as head-only exact counts, and fail closed (null) instead of showing a partial set; the header context counts this Vietnam month's new leads and centre-wide pending confirmations; the directory row now carries status_changed_at, drop_reason and the earliest scheduled trial, and reports a failed query as failed rather than empty;
// fails_when=a chip count is narrowed by the active status, a filter is dropped from the counts, counts transfer rows, one failed count yields a misleading partial set, the month boundary uses UTC instead of Vietnam time, or a directory error renders as "no leads";
// why_new=step 10 adds getCrmStatusCounts and getCrmDirectoryOverview and extends the directory select;
// seam=createSupabaseServerClient is replaced by a recording query builder that filters fixture rows; no_claim=does not prove PostgREST accepts the embedded !inner source filter on a head request or the crm_trial_bookings embed (verified by reading the FK in the migrations, not against a database)
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCrmDirectoryOverview, getCrmLeadDirectory, getCrmStatusCounts } from "@/features/crm/data";

type Row = {
  created_at: string;
  expected_grade: number;
  sale_owner_id: string | null;
  source: string;
  status: string;
};

// Sale filters must be profile ids (UUIDs); anything else is ignored by the loaders.
const SALE_A = "5a1e0000-0000-4000-8000-00000000000a";
const SALE_B = "5a1e0000-0000-4000-8000-00000000000b";

const rows: Row[] = [
  { created_at: "2026-10-12T02:00:00Z", expected_grade: 8, sale_owner_id: SALE_A, source: "mma_fanpage", status: "interested" },
  { created_at: "2026-10-09T02:00:00Z", expected_grade: 8, sale_owner_id: SALE_A, source: "mma_fanpage", status: "trial_booked" },
  { created_at: "2026-09-30T17:30:00Z", expected_grade: 8, sale_owner_id: SALE_B, source: "referral_student", status: "pending_enrollment_confirmation" },
  { created_at: "2026-09-29T02:00:00Z", expected_grade: 9, sale_owner_id: SALE_A, source: "mma_fanpage", status: "pending_enrollment_confirmation" },
  { created_at: "2026-09-20T02:00:00Z", expected_grade: 8, sale_owner_id: SALE_A, source: "mma_fanpage", status: "dropped" },
];

interface Recorded {
  eq: [string, unknown][];
  gte: [string, string][];
  head: boolean | undefined;
  or: string[];
  select: string;
}

let recorded: Recorded[] = [];
let failStatus: string | null = null;
let failMonthCount = false;
let directoryResult: { data: unknown[] | null; error: { message: string } | null } = { data: [], error: null };

function builder() {
  const call: Recorded = { eq: [], gte: [], head: undefined, or: [], select: "" };
  recorded.push(call);
  const query = {
    eq: (column: string, value: unknown) => { call.eq.push([column, value]); return query; },
    gte: (column: string, value: string) => { call.gte.push([column, value]); return query; },
    limit: () => query,
    or: (value: string) => { call.or.push(value); return query; },
    order: () => query,
    select: (columns: string, options?: { head?: boolean }) => { call.select = columns; call.head = options?.head; return query; },
    then: (resolve: (value: unknown) => unknown) => {
      if (!call.head) return Promise.resolve(resolve({ count: directoryResult.data?.length ?? null, ...directoryResult }));
      const status = call.eq.find(([column]) => column === "status")?.[1];
      if (failMonthCount && call.gte.length > 0) return Promise.resolve(resolve({ count: null, data: null, error: { message: "boom" } }));
      if (failStatus && status === failStatus) return Promise.resolve(resolve({ count: null, data: null, error: { message: "boom" } }));
      const count = rows.filter((row) =>
        call.eq.every(([column, value]) => {
          if (column === "status") return row.status === value;
          if (column === "expected_grade") return row.expected_grade === value;
          if (column === "sale_owner_id") return row.sale_owner_id === value;
          if (column === "lead_source.code") return row.source === value;
          return true;
        }) && call.gte.every(([, value]) => Date.parse(row.created_at) >= Date.parse(value)),
      ).length;
      return Promise.resolve(resolve({ count, data: null, error: null }));
    },
  };
  return query;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: vi.fn(() => builder()) })),
}));

beforeEach(() => {
  recorded = [];
  failStatus = null;
  failMonthCount = false;
  directoryResult = { data: [], error: null };
});

describe("CRM status chip counts", () => {
  it("counts every status with head-only exact counts under the non-status filters", async () => {
    const counts = await getCrmStatusCounts({ expectedGrade: 8, leadSourceCode: "mma_fanpage", saleOwnerId: SALE_A, search: "An" });

    expect(counts).toEqual({
      converted: 0,
      dropped: 1,
      interested: 1,
      pending_enrollment_confirmation: 0,
      trial_booked: 1,
      trial_completed: 0,
    });
    expect(recorded).toHaveLength(6);
    for (const call of recorded) {
      expect(call.head).toBe(true);
      expect(call.select).toContain("lead_source:crm_lead_sources!inner(code)");
      expect(call.or).toEqual([expect.stringContaining("full_name.ilike.%An%")]);
      expect(call.eq.filter(([column]) => column === "status")).toHaveLength(1);
      expect(call.eq).toContainEqual(["sale_owner_id", SALE_A]);
    }
  });

  // Value (extension, fix pass 1): protects=a search with PostgREST reserved characters (, ( ) " \) still runs as a search instead of breaking the .or() filter into a persistent "Không tải được" error, and a hand-edited non-UUID sale filter is ignored rather than failing the query;
  // fails_when=the raw term is interpolated into the .or() string, or any non-empty sale value reaches .eq("sale_owner_id");
  // why_new=F12 hardens the shared filter builder; seam=recording query builder as in this file; no_claim=does not run PostgREST's parser
  it("strips PostgREST reserved characters from the search and ignores a non-UUID sale filter", async () => {
    await getCrmStatusCounts({ saleOwnerId: "sale-a", search: ' Nguyễn (Hân), "0905"\\ ' });
    for (const call of recorded) {
      expect(call.or).toEqual(["full_name.ilike.%Nguyễn Hân 0905%,public_code.ilike.%Nguyễn Hân 0905%,guardian_phone.ilike.%Nguyễn Hân 0905%,guardian_full_name.ilike.%Nguyễn Hân 0905%"]);
      expect(call.eq.some(([column]) => column === "sale_owner_id")).toBe(false);
    }

    recorded = [];
    await getCrmLeadDirectory({ saleOwnerId: "not-a-uuid", search: "(),\"" });
    expect(recorded[0].or).toEqual([]);
    expect(recorded[0].eq.some(([column]) => column === "sale_owner_id")).toBe(false);

    recorded = [];
    await getCrmLeadDirectory({ saleOwnerId: SALE_B, search: "LD-2610" });
    expect(recorded[0].or).toEqual([expect.stringContaining("public_code.ilike.%LD-2610%")]);
    expect(recorded[0].eq).toContainEqual(["sale_owner_id", SALE_B]);
  });

  it("does not let the directory's status filter narrow the chips", async () => {
    // The page passes the filters without `status`; even a stray one is ignored by the type and the query.
    const counts = await getCrmStatusCounts({ expectedGrade: 8, status: "dropped" } as Parameters<typeof getCrmStatusCounts>[0]);
    expect(counts?.interested).toBe(1);
    expect(counts?.pending_enrollment_confirmation).toBe(1);
    expect(recorded.every((call) => call.select === "id")).toBe(true);
  });

  it("returns null when any status count fails", async () => {
    failStatus = "converted";
    expect(await getCrmStatusCounts()).toBeNull();
  });
});

describe("CRM list header context", () => {
  it("counts leads created since the start of the Vietnam month and pending confirmations centre-wide", async () => {
    const overview = await getCrmDirectoryOverview(new Date("2026-10-14T05:00:00Z"));

    expect(overview).toEqual({ monthLabel: "10/2026", newLeadsThisMonth: 3, pendingConfirmation: 2 });
    expect(recorded[0].gte).toEqual([["created_at", "2026-10-01T00:00:00+07:00"]]);
  });

  // Value (extension, coverage pass 2): protects=a failed header count comes back as null (the list then leaves it out) while the other count still loads, never as 0;
  // fails_when=the error branch is dropped and a failed query reads `count ?? 0` or a missing count, so the header claims "0 lead mới" / "0 chờ xác nhận" during an outage;
  // why_new=the header test above only covers both counts succeeding; seam=createSupabaseServerClient fixture as in this file; no_claim=does not prove which PostgREST errors occur in production
  it("reports a failed header count as unavailable (null), not zero, and keeps the other count", async () => {
    failStatus = "pending_enrollment_confirmation";
    expect(await getCrmDirectoryOverview(new Date("2026-10-14T05:00:00Z"))).toEqual({ monthLabel: "10/2026", newLeadsThisMonth: 3, pendingConfirmation: null });

    failStatus = null;
    failMonthCount = true;
    expect(await getCrmDirectoryOverview(new Date("2026-10-14T05:00:00Z"))).toEqual({ monthLabel: "10/2026", newLeadsThisMonth: null, pendingConfirmation: 2 });
  });
});

describe("CRM directory read model", () => {
  it("maps status timing, drop reason and the earliest scheduled trial onto each row", async () => {
    directoryResult = {
      data: [{
        birth_year: 2013,
        created_at: "2026-10-09T02:00:00Z",
        drop_reason: null,
        expected_grade: 8,
        expected_level: "B",
        expected_mode: "offline",
        full_name: "Trần Minh Quân",
        guardian_full_name: "Trần Văn Long",
        guardian_phone: "0912998877",
        id: "case-1",
        lead_source: { code: "referral_student", name: "SB · Giới thiệu" },
        public_code: "LD-2610-0041",
        sale_owner: null,
        sale_owner_id: null,
        status: "trial_booked",
        status_changed_at: "2026-10-09T02:00:00Z",
        student_id: null,
        trial_bookings: [
          { status: "scheduled", trial_date: "2026-10-21" },
          { status: "scheduled", trial_date: "2026-10-14" },
        ],
      }],
      error: null,
    };

    const result = await getCrmLeadDirectory();

    expect(recorded[0].select).toContain("trial_bookings:crm_trial_bookings(trial_date, status)");
    expect(result.failed).toBeUndefined();
    expect(result.items[0]).toMatchObject({ dropReason: null, nextTrialDate: "2026-10-14", saleOwnerId: null, statusChangedAt: "2026-10-09T02:00:00Z" });
  });

  // Value (extension, fix pass 3, H3): protects=a row whose sale owner's name profiles RLS hides reads "Sale khác (không xem được tên)" while a row without an owner keeps "Chưa phân công";
  // fails_when=the list loader falls back to "Chưa phân công" whenever the embedded name is null, so the table shows an assigned lead with the warning badge text;
  // why_new=H3; seam=as above; no_claim=does not prove which roles RLS hides names from
  it("labels a set sale owner whose name is hidden instead of calling the lead unassigned", async () => {
    const base = {
      birth_year: 2013, created_at: "2026-10-09T02:00:00Z", drop_reason: null, expected_grade: 8, expected_level: "B", expected_mode: "offline",
      guardian_full_name: "Trần Văn Long", guardian_phone: "0912998877", lead_source: { code: "mma_fanpage", name: "MMA · Facebook" },
      sale_owner: null, status: "interested", status_changed_at: null, student_id: null, trial_bookings: [],
    };
    directoryResult = {
      data: [
        { ...base, full_name: "Trần Minh Quân", id: "case-1", public_code: "LD-2610-0041", sale_owner_id: SALE_A },
        { ...base, full_name: "Nguyễn Gia Hân", id: "case-2", public_code: "LD-2610-0048", sale_owner_id: null },
      ],
      error: null,
    };

    const result = await getCrmLeadDirectory();

    expect(result.items.map((item) => [item.id, item.saleOwnerId, item.saleOwnerName])).toEqual([
      ["case-1", SALE_A, "Sale khác (không xem được tên)"],
      ["case-2", null, "Chưa phân công"],
    ]);
  });

  it("reports a failed directory query as failed, not as an empty list", async () => {
    directoryResult = { data: null, error: { message: "permission denied" } };
    expect(await getCrmLeadDirectory()).toEqual({ failed: true, items: [], totalCount: 0 });
  });
});
