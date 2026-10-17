// Value: protects=the /commissions list rules: the commission month is recognizedOn (the Vietnam bank date, never recognizedAt or the server timezone), options come only from loaded rows (Map keys, so `constructor` is a value not a prototype hit; no static MMA/Sandbox), filters keep the reader order and drop the Sale dimension without manage, a vanished option falls back to "all", and a month is called complete only when the load is under the limit or the oldest loaded day is strictly before the month;
// fails_when=a month is derived from recognizedAt, an option list is static or built on a plain object, filtering re-sorts, a tie on the 1st is treated as complete, or "all months" on a capped load stops reporting the cap;
// why_new=step 14b moves filtering/options/paging out of the page file (the page may not contain .filter/.sort/.reduce); seam=none; no_claim=the RPC ordering and limit (database) and the rendered markup (commissions-management.test.tsx)
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ALL_OPTION,
  COMMISSIONS_DEFAULT_LIMIT,
  COMMISSIONS_LIMIT,
  allCommissionFilters,
  buildCommissionOptions,
  countActiveCommissionFilters,
  describeCommissionCounts,
  describeCommissionCoverage,
  describePartialMonth,
  filterCommissions,
  formatRecognizedTime,
  getRecognizedMonth,
  getSaleOwnerLabel,
  getSourceGroupPresentation,
  getStatusPresentation,
  paginateCommissions,
  resolveCommissionFilters,
} from "@/features/commissions/commission-directory-models";
import type { SalesCommissionAccrualDashboardEntry } from "@/features/commissions/read-models";

function entry(
  id: string,
  recognizedOn: string,
  overrides: Partial<SalesCommissionAccrualDashboardEntry> = {},
): SalesCommissionAccrualDashboardEntry {
  return {
    id,
    leadSourceCode: "mma_fanpage",
    leadSourceGroup: "mma",
    leadSourceName: "MMA Fanpage",
    recognizedAt: `${recognizedOn}T03:00:00.000Z`,
    recognizedOn,
    recognizedRevenueVnd: 1_000_000,
    saleOwnerDisplayName: "Lê Thu Trang",
    saleOwnerEmployeeCode: "NS-014",
    saleOwnerId: "sale-1",
    sourceCashflowRecordId: `cashflow-${id}`,
    status: "provisional",
    studentFullName: "Nguyễn Minh Anh",
    studentId: `student-${id}`,
    studentPublicCode: "TTV-00100",
    ...overrides,
  };
}

const huy = { saleOwnerDisplayName: "Phạm Quốc Huy", saleOwnerEmployeeCode: null, saleOwnerId: "sale-2" };
const sandbox = { leadSourceCode: "sandbox_partner", leadSourceGroup: "sandbox", leadSourceName: "Sandbox đối tác" };

describe("presentation", () => {
  it("maps the known group and status and names anything else, prototype keys included", () => {
    expect(getSourceGroupPresentation("mma")).toEqual({ label: "MMA", tone: "info" });
    expect(getSourceGroupPresentation("sandbox")).toEqual({ label: "Sandbox", tone: "warning" });
    expect(getStatusPresentation("provisional")).toEqual({ label: "Chờ chính sách", tone: "warning" });

    for (const raw of ["constructor", "toString", "__proto__", "other"]) {
      expect(getSourceGroupPresentation(raw)).toEqual({ label: `Nguồn chưa hỗ trợ: ${raw}`, tone: "neutral" });
      expect(getStatusPresentation(raw)).toEqual({ label: `Trạng thái chưa hỗ trợ: ${raw}`, tone: "neutral" });
    }
  });

  it("labels a sale with the employee code when there is one", () => {
    expect(getSaleOwnerLabel(entry("a", "2026-10-01"))).toBe("Lê Thu Trang · NS-014");
    expect(getSaleOwnerLabel(entry("b", "2026-10-01", huy))).toBe("Phạm Quốc Huy");
  });
});

describe("getRecognizedMonth / formatRecognizedTime", () => {
  // A host far from Vietnam proves neither helper follows the server timezone.
  // (Worker threads ignore a runtime TZ change; the assertions still hold there.)
  const originalTimeZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles";
  });
  afterAll(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it("reads the month straight from the Vietnam business date", () => {
    expect(getRecognizedMonth("2026-10-01")).toBe("2026-10");
    expect(getRecognizedMonth("2026-08-31")).toBe("2026-08");
    expect(getRecognizedMonth("2026-13-01")).toBeNull();
    expect(getRecognizedMonth("01/10/2026")).toBeNull();
    expect(getRecognizedMonth("")).toBeNull();
  });

  it("captions the bank timestamp in Vietnam time and tolerates garbage", () => {
    expect(formatRecognizedTime("2026-09-30T17:30:00Z")).toBe("00:30");
    expect(formatRecognizedTime("2026-10-12T08:05:00+00:00")).toBe("15:05");
    expect(formatRecognizedTime("not-a-date")).toBeNull();
  });
});

describe("buildCommissionOptions", () => {
  it("derives months newest first, sales by name and groups known-first from the loaded rows", () => {
    const options = buildCommissionOptions([
      entry("a", "2026-09-12", { ...huy }),
      // recognizedAt is 30 Sep in UTC, recognizedOn already says October: October wins.
      entry("b", "2026-10-01", { recognizedAt: "2026-09-30T17:20:00Z", ...sandbox }),
      entry("c", "2026-08-03", { leadSourceGroup: "constructor", leadSourceName: "Hội thảo" }),
      entry("d", "2026-08-02", { leadSourceGroup: "other" }),
      entry("e", "garbage"),
    ]);

    expect(options.months).toEqual([
      { label: "Tháng 10/2026", value: "2026-10" },
      { label: "Tháng 09/2026", value: "2026-09" },
      { label: "Tháng 08/2026", value: "2026-08" },
    ]);
    expect(options.sales).toEqual([
      { label: "Lê Thu Trang · NS-014", value: "sale-1" },
      { label: "Phạm Quốc Huy", value: "sale-2" },
    ]);
    expect(options.sources).toEqual([
      { label: "MMA", value: "mma" },
      { label: "Sandbox", value: "sandbox" },
      { label: "Nguồn chưa hỗ trợ: constructor", value: "constructor" },
      { label: "Nguồn chưa hỗ trợ: other", value: "other" },
    ]);
  });

  it("offers no known group that no row carries", () => {
    const options = buildCommissionOptions([entry("a", "2026-10-01", { leadSourceGroup: "constructor" })]);
    expect(options.sources).toEqual([{ label: "Nguồn chưa hỗ trợ: constructor", value: "constructor" }]);
    expect(buildCommissionOptions([])).toEqual({ months: [], sales: [], sources: [] });
  });
});

describe("filters", () => {
  const rows = [
    entry("oct-1", "2026-10-12"),
    entry("oct-2", "2026-10-01", { ...huy, ...sandbox }),
    entry("sep-1", "2026-09-20", { ...sandbox }),
    entry("aug-1", "2026-08-11", { ...huy }),
  ];
  const ids = (list: readonly SalesCommissionAccrualDashboardEntry[]) => list.map((row) => row.id);

  it("keeps every row in reader order by default", () => {
    expect(ids(filterCommissions(rows, allCommissionFilters, { canManage: true }))).toEqual(["oct-1", "oct-2", "sep-1", "aug-1"]);
  });

  it("narrows by month, Sale and source, keeping the reader order", () => {
    expect(ids(filterCommissions(rows, { ...allCommissionFilters, month: "2026-10" }, { canManage: true }))).toEqual(["oct-1", "oct-2"]);
    expect(ids(filterCommissions(rows, { ...allCommissionFilters, saleOwnerId: "sale-2" }, { canManage: true }))).toEqual(["oct-2", "aug-1"]);
    expect(ids(filterCommissions(rows, { ...allCommissionFilters, sourceGroup: "sandbox" }, { canManage: true }))).toEqual(["oct-2", "sep-1"]);
    expect(ids(filterCommissions(rows, { month: "2026-10", saleOwnerId: "sale-2", sourceGroup: "sandbox" }, { canManage: true }))).toEqual(["oct-2"]);
    expect(filterCommissions(rows, { ...allCommissionFilters, month: "2026-07" }, { canManage: true })).toEqual([]);
  });

  it("ignores the Sale dimension without manage, in filtering and in the active count", () => {
    const filters = { ...allCommissionFilters, saleOwnerId: "sale-2" };
    expect(ids(filterCommissions(rows, filters, { canManage: false }))).toEqual(["oct-1", "oct-2", "sep-1", "aug-1"]);
    expect(countActiveCommissionFilters(filters, { canManage: false })).toBe(0);
    expect(countActiveCommissionFilters(filters, { canManage: true })).toBe(1);
    expect(countActiveCommissionFilters({ month: "2026-10", saleOwnerId: "sale-2", sourceGroup: "mma" }, { canManage: true })).toBe(3);
    expect(countActiveCommissionFilters(allCommissionFilters, { canManage: true })).toBe(0);
  });

  it("falls back to all for a value the reloaded rows no longer offer", () => {
    const options = buildCommissionOptions(rows);
    expect(
      resolveCommissionFilters({ month: "2026-07", saleOwnerId: "sale-9", sourceGroup: "constructor" }, options, { canManage: true }),
    ).toEqual(allCommissionFilters);
    expect(
      resolveCommissionFilters({ month: "2026-09", saleOwnerId: "sale-2", sourceGroup: "sandbox" }, options, { canManage: true }),
    ).toEqual({ month: "2026-09", saleOwnerId: "sale-2", sourceGroup: "sandbox" });
    expect(
      resolveCommissionFilters({ ...allCommissionFilters, saleOwnerId: "sale-2" }, options, { canManage: false }).saleOwnerId,
    ).toBe(ALL_OPTION);
  });
});

describe("describeCommissionCoverage", () => {
  const rows = [entry("a", "2026-10-12"), entry("b", "2026-09-20"), entry("c", "2026-09-01")];

  it("is complete for any month while the load is under the limit", () => {
    expect(describeCommissionCoverage({ entries: rows, limit: 4, month: "2026-09" })).toEqual({ capped: false, partialMonth: null });
    expect(describeCommissionCoverage({ entries: rows, limit: 4, month: ALL_OPTION })).toEqual({ capped: false, partialMonth: null });
  });

  it("reports the cap for all months and flags a month that starts on or after the oldest loaded day", () => {
    expect(describeCommissionCoverage({ entries: rows, limit: 3, month: ALL_OPTION })).toEqual({ capped: true, partialMonth: null });
    // Oldest loaded day is 1 Sep: September may be cut (a tie on the 1st is not enough).
    expect(describeCommissionCoverage({ entries: rows, limit: 3, month: "2026-09" })).toEqual({ capped: true, partialMonth: "2026-09" });
    // A month entirely before the oldest loaded day is cut as well.
    expect(describeCommissionCoverage({ entries: rows, limit: 3, month: "2026-08" })).toEqual({ capped: true, partialMonth: "2026-08" });
    // October starts strictly after 1 Sep: complete.
    expect(describeCommissionCoverage({ entries: rows, limit: 3, month: "2026-10" })).toEqual({ capped: true, partialMonth: null });
  });

  it("does not trust malformed dates for the oldest day", () => {
    const withGarbage = [entry("a", "2026-10-12"), entry("b", "garbage")];
    expect(describeCommissionCoverage({ entries: withGarbage, limit: 2, month: "2026-10" })).toEqual({ capped: true, partialMonth: "2026-10" });
    expect(describeCommissionCoverage({ entries: [entry("x", "garbage")], limit: 1, month: "2026-10" })).toEqual({ capped: true, partialMonth: "2026-10" });
  });

  it("phrases counts and the notice without any money total", () => {
    expect(describeCommissionCounts({ capped: false, filteredCount: 3, hasFilters: false, limit: 500, total: 3 })).toBe("3 bản ghi");
    expect(describeCommissionCounts({ capped: false, filteredCount: 1, hasFilters: true, limit: 500, total: 3 })).toBe("1 trong 3 bản ghi");
    expect(describeCommissionCounts({ capped: true, filteredCount: 12, hasFilters: true, limit: 500, total: 500 })).toBe(
      "12 trong 500 bản ghi · chỉ tải 500 bản ghi mới nhất theo ngày tiền về",
    );
    expect(describePartialMonth("2026-08", 500)).toBe("Tháng 08/2026 có thể chưa đủ: chỉ tải 500 bản ghi mới nhất.");
  });
});

describe("paginateCommissions / limits", () => {
  it("pages 20 rows and clamps the requested page", () => {
    const rows = Array.from({ length: 45 }, (_, index) => index);
    expect(paginateCommissions(rows, 1)).toMatchObject({ end: 20, page: 1, pageCount: 3, start: 1 });
    expect(paginateCommissions(rows, 3)).toMatchObject({ end: 45, page: 3, rows: [40, 41, 42, 43, 44], start: 41 });
    expect(paginateCommissions(rows, 9).page).toBe(3);
    expect(paginateCommissions([], 2)).toEqual({ end: 0, page: 1, pageCount: 1, rows: [], start: 0 });
  });

  it("keeps the route at the RPC maximum and the page default at the loader default", () => {
    expect(COMMISSIONS_LIMIT).toBe(500);
    expect(COMMISSIONS_DEFAULT_LIMIT).toBe(200);
  });
});
