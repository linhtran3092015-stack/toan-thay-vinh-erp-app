// Value: protects=the /advances list rules: pinned status labels behind Object.hasOwn, "Cần xử lý" = rows the viewer may decide minus their own (the RPCs refuse self-decisions), chips hidden at zero unless active, filters that keep server order, Vietnam-time captions that drop null pieces, "Đơn khác cùng kỳ" as a list of the same staff + month, and a count-only header with the 1000-row caveat; fails_when=an own request counts as actionable, a "Từ chối"/"Cần xử lý" chip appears on data without such rows, a raw "constructor" status reads as known, a filter reorders rows, a caption prints "bởi null" or a UTC date, a vanished filter value leaves a blank select, or the header starts adding money; why_new=step 14b moves /advances to a client list with local filters; seam=none (pure functions); no_claim=the rendered markup (advances-management.test.tsx) and the RPC scope (database)
import { describe, expect, it } from "vitest";

import {
  ADVANCES_MAX_ROWS,
  ALL_OPTION,
  allAdvanceFilters,
  buildAdvanceChips,
  buildAdvanceOptions,
  buildAdvanceTimeline,
  buildRelatedAdvances,
  countActiveAdvanceFilters,
  describeAdvanceEvent,
  describeAdvanceIdentity,
  describeAdvanceStatusCaption,
  describeAdvanceSummary,
  describeOwnPendingCaption,
  describeRelatedAdvance,
  filterAdvances,
  getActiveAdvanceChip,
  getAdvanceRowAction,
  getAdvanceStatusPresentation,
  getPayrollPeriodHref,
  isActionableAdvance,
  isKnownAdvanceStatus,
  paginateAdvances,
  resolveAdvanceFilters,
  type AdvanceViewer,
} from "@/features/advances/advance-directory-models";
import type { SalaryAdvanceDashboardEntry } from "@/features/advances/read-models";

const TODAY = "2026-10-16";
const ME = "staff-me";
const OTHER = "staff-other";

function advance(id: string, overrides: Partial<SalaryAdvanceDashboardEntry> = {}): SalaryAdvanceDashboardEntry {
  return {
    amountVnd: 1_000_000,
    approvalNote: null,
    approvedAt: null,
    approvedByDisplayName: null,
    deductedAt: null,
    deductionPayrollPeriodId: null,
    deductionPeriodMonth: "2026-10-01",
    id,
    rejectedAt: null,
    rejectedByDisplayName: null,
    rejectionReason: null,
    requestNote: `Lý do ${id}`,
    requestedAt: "2026-10-12T02:40:00.000Z",
    reviewNote: null,
    reviewedAt: null,
    reviewedByDisplayName: null,
    staffDisplayName: "Trần Thanh Tùng",
    staffEmployeeCode: "NS-007",
    staffId: OTHER,
    status: "requested",
    ...overrides,
  };
}

const owner: AdvanceViewer = { canApprove: true, canReview: true, viewerId: ME };
const accountant: AdvanceViewer = { canApprove: false, canReview: true, viewerId: ME };
const approverOnly: AdvanceViewer = { canApprove: true, canReview: false, viewerId: ME };
const staffMember: AdvanceViewer = { canApprove: false, canReview: false, viewerId: ME };

const ids = (rows: readonly SalaryAdvanceDashboardEntry[]) => rows.map((row) => row.id);
const chipSummary = (chips: ReturnType<typeof buildAdvanceChips>) => chips.map((chip) => `${chip.value}:${chip.count}`);

describe("status presentation", () => {
  it("keeps the pinned badge vocabulary and tones, and fails closed on prototype keys", () => {
    expect(getAdvanceStatusPresentation("requested")).toEqual({ label: "Chờ đối soát", tone: "warning" });
    expect(getAdvanceStatusPresentation("review")).toEqual({ label: "Chờ phê duyệt", tone: "info" });
    expect(getAdvanceStatusPresentation("approved")).toEqual({ label: "Đã phê duyệt", tone: "success" });
    expect(getAdvanceStatusPresentation("rejected")).toEqual({ label: "Đã từ chối", tone: "danger" });
    expect(getAdvanceStatusPresentation("deducted")).toEqual({ label: "Đã khấu trừ", tone: "neutral" });
    expect(getAdvanceStatusPresentation("constructor")).toEqual({ label: "Trạng thái chưa hỗ trợ: constructor", tone: "neutral" });
    expect(isKnownAdvanceStatus("toString")).toBe(false);
  });
});

describe("row actions and Cần xử lý", () => {
  it("excludes the viewer's own request from the decisions they may take", () => {
    const own = advance("own", { staffId: ME });
    const other = advance("other");
    const reviewed = advance("reviewed", { status: "review" });

    expect(isActionableAdvance(own, owner)).toBe(false);
    expect(isActionableAdvance(other, owner)).toBe(true);
    expect(isActionableAdvance(reviewed, accountant)).toBe(false);
    expect(isActionableAdvance(reviewed, approverOnly)).toBe(true);
    expect(isActionableAdvance(other, approverOnly)).toBe(false);
    expect(getAdvanceRowAction(own, owner, { canViewPayroll: true })).toEqual({ kind: "own-pending", stage: "review" });
    expect(getAdvanceRowAction(other, owner, { canViewPayroll: true })).toEqual({ kind: "decide", stage: "review" });
    expect(getAdvanceRowAction(reviewed, owner, { canViewPayroll: true })).toEqual({ kind: "decide", stage: "approve" });
  });

  // Value (review cycle 2, P2-4/R2-7): protects=an own pending row says who must act at its stage (another reviewer for a request, another owner for a reviewed one) instead of a vague "người khác xử lý"; fails_when=own-pending drops its stage or the caption names the wrong role for a stage; why_new=the own-pending action carried no stage; seam=none; no_claim=the table's short caption markup (advances-management.test.tsx)
  it("tells an own pending row which role must act at its stage", () => {
    const ownReviewed = advance("own-reviewed", { staffId: ME, status: "review" });
    expect(getAdvanceRowAction(ownReviewed, owner, { canViewPayroll: true })).toEqual({ kind: "own-pending", stage: "approve" });
    // An accountant cannot approve, so their own reviewed row is a plain view, not own-pending.
    expect(getAdvanceRowAction(ownReviewed, accountant, { canViewPayroll: true })).toEqual({ kind: "view", payrollPeriodId: null });
    expect(describeOwnPendingCaption("review")).toBe("Đơn của bạn · cần người khác đối soát");
    expect(describeOwnPendingCaption("approve")).toBe("Đơn của bạn · cần người khác phê duyệt");
  });

  it("does not set own rows apart when the viewer id is unknown", () => {
    const own = advance("own", { staffId: ME });
    expect(isActionableAdvance(own, { ...owner, viewerId: null })).toBe(true);
  });

  it("links a deducted row to its payroll period only with payroll.view and a period id", () => {
    const deducted = advance("deducted", { deductionPayrollPeriodId: "period-9", status: "deducted" });
    expect(getAdvanceRowAction(deducted, staffMember, { canViewPayroll: true })).toEqual({ kind: "view", payrollPeriodId: "period-9" });
    expect(getAdvanceRowAction(deducted, staffMember, { canViewPayroll: false })).toEqual({ kind: "view", payrollPeriodId: null });
    expect(getAdvanceRowAction(advance("no-period", { status: "deducted" }), owner, { canViewPayroll: true })).toEqual({ kind: "view", payrollPeriodId: null });
    expect(getAdvanceRowAction(advance("approved", { deductionPayrollPeriodId: "x", status: "approved" }), owner, { canViewPayroll: true })).toEqual({ kind: "view", payrollPeriodId: null });
    // /payroll loads only recent and open periods, so the link names the period as well as anchoring it.
    expect(getPayrollPeriodHref("period-9")).toBe("/payroll?period=period-9#payroll-period-period-9");
  });
});

describe("chips", () => {
  const rows = [
    advance("r-own", { staffId: ME }),
    advance("r-1"),
    advance("v-1", { status: "review" }),
    advance("a-1", { status: "approved" }),
    advance("d-1", { status: "deducted" }),
    advance("x-1", { status: "rejected" }),
    advance("u-1", { status: "constructor" }),
  ];

  it("counts per permission, never counts unknown statuses outside Tất cả, and hides empty chips", () => {
    expect(chipSummary(buildAdvanceChips(rows, allAdvanceFilters, owner))).toEqual([
      "all:7", "actionable:2", "approved:1", "deducted:1", "rejected:1",
    ]);
    expect(chipSummary(buildAdvanceChips(rows, allAdvanceFilters, accountant))).toEqual([
      "all:7", "actionable:1", "approved:1", "deducted:1", "rejected:1",
    ]);
    expect(chipSummary(buildAdvanceChips(rows, allAdvanceFilters, staffMember))).toEqual([
      "all:7", "waiting:3", "approved:1", "deducted:1", "rejected:1",
    ]);
  });

  it("offers only Tất cả when every loaded row has an unknown status", () => {
    const unknown = [advance("u-1", { status: "archived_for_audit" }), advance("u-2", { status: "constructor" })];
    expect(chipSummary(buildAdvanceChips(unknown, allAdvanceFilters, owner))).toEqual(["all:2"]);
  });

  it("keeps an active chip visible at zero and counts over search + period only", () => {
    const filters = { period: "2026-09", search: "", status: "rejected" as const };
    expect(chipSummary(buildAdvanceChips(rows, filters, owner))).toEqual(["all:0", "rejected:0"]);
    expect(getActiveAdvanceChip(filters)).toBe("rejected");
    expect(getActiveAdvanceChip({ ...filters, status: "requested" })).toBeNull();
    expect(getActiveAdvanceChip(allAdvanceFilters)).toBe(ALL_OPTION);
  });
});

describe("filters", () => {
  const rows = [
    advance("oct-1", { staffDisplayName: "Đặng Phương Thảo", staffEmployeeCode: "NS-009" }),
    advance("sep-1", { deductionPeriodMonth: "2026-09-01", status: "approved" }),
    advance("oct-2", { staffDisplayName: "Lê Bích Ngọc", staffEmployeeCode: null, status: "review" }),
    advance("nov-1", { deductionPeriodMonth: "2026-11-01", status: "constructor" }),
  ];

  it("builds options from loaded rows only: months newest first, known statuses in lifecycle order", () => {
    const options = buildAdvanceOptions(rows);
    expect(options.periods).toEqual([
      { label: "11/2026", value: "2026-11" },
      { label: "10/2026", value: "2026-10" },
      { label: "09/2026", value: "2026-09" },
    ]);
    expect(options.statuses).toEqual([
      { label: "Chờ đối soát", value: "requested" },
      { label: "Chờ phê duyệt", value: "review" },
      { label: "Đã phê duyệt", value: "approved" },
    ]);
    expect(buildAdvanceOptions([advance("u", { status: "constructor" })]).statuses).toEqual([]);
  });

  it("filters by accent-insensitive search on name or code, period and status, keeping server order", () => {
    expect(ids(filterAdvances(rows, { ...allAdvanceFilters, search: "dang phuong" }, owner))).toEqual(["oct-1"]);
    expect(ids(filterAdvances(rows, { ...allAdvanceFilters, search: "ns-00" }, owner))).toEqual(["oct-1", "sep-1", "nov-1"]);
    expect(ids(filterAdvances(rows, { ...allAdvanceFilters, period: "2026-10" }, owner))).toEqual(["oct-1", "oct-2"]);
    expect(ids(filterAdvances(rows, { ...allAdvanceFilters, status: "actionable" }, owner))).toEqual(["oct-1", "oct-2"]);
    expect(ids(filterAdvances(rows, { ...allAdvanceFilters, status: "waiting" }, staffMember))).toEqual(["oct-1", "oct-2"]);
    expect(ids(filterAdvances(rows, { ...allAdvanceFilters, status: "approved" }, owner))).toEqual(["sep-1"]);
    expect(ids(filterAdvances(rows, allAdvanceFilters, owner))).toEqual(ids(rows));
  });

  it("drops a choice the rows or the permissions no longer offer", () => {
    const options = buildAdvanceOptions(rows);
    expect(resolveAdvanceFilters({ period: "2026-01", search: "an", status: "deducted" }, options, owner)).toEqual({
      period: ALL_OPTION,
      search: "an",
      status: ALL_OPTION,
    });
    expect(resolveAdvanceFilters({ ...allAdvanceFilters, status: "waiting" }, options, owner).status).toBe(ALL_OPTION);
    expect(resolveAdvanceFilters({ ...allAdvanceFilters, status: "actionable" }, options, staffMember).status).toBe(ALL_OPTION);
    expect(resolveAdvanceFilters({ period: "2026-09", search: "", status: "actionable" }, options, owner)).toEqual({
      period: "2026-09",
      search: "",
      status: "actionable",
    });
    expect(countActiveAdvanceFilters({ period: "2026-09", search: "  ", status: "actionable" })).toBe(2);
  });

  it("pages 20 rows at a time and clamps a page past the end", () => {
    const many = Array.from({ length: 45 }, (_, index) => index);
    expect(paginateAdvances(many, 1)).toMatchObject({ end: 20, page: 1, pageCount: 3, start: 1 });
    expect(paginateAdvances(many, 9)).toMatchObject({ end: 45, page: 3, rows: [40, 41, 42, 43, 44], start: 41 });
    expect(paginateAdvances([], 1)).toMatchObject({ end: 0, page: 1, pageCount: 1, start: 0 });
  });
});

describe("captions", () => {
  it("names the latest event in Vietnam time and omits null pieces", () => {
    // 02:40 UTC = 09:40 in Vietnam.
    expect(describeAdvanceIdentity(advance("r"), TODAY)).toBe("NS-007 · gửi 12/10 09:40");
    expect(describeAdvanceIdentity(advance("r"), TODAY, "full")).toBe("NS-007 · gửi 09:40 12/10/2026");
    // 17:30 UTC on 30 Sep is 1 Oct in Vietnam.
    expect(describeAdvanceEvent(advance("late", { requestedAt: "2026-09-30T17:30:00.000Z" }), TODAY)).toBe("gửi 01/10 00:30");
    expect(describeAdvanceIdentity(advance("no-code", { staffEmployeeCode: null }), TODAY)).toBe("gửi 12/10 09:40");
    expect(describeAdvanceEvent(advance("v", { reviewedAt: "2026-10-10T03:00:00Z", reviewedByDisplayName: "Lê Thu Hằng", status: "review" }), TODAY)).toBe("đối soát 10/10 bởi Lê Thu Hằng");
    expect(describeAdvanceEvent(advance("v-null", { status: "review" }), TODAY)).toBe("đối soát");
    expect(describeAdvanceEvent(advance("a", { approvedAt: "2026-10-03T08:00:00Z", status: "approved" }), TODAY)).toBe("duyệt 03/10");
    expect(describeAdvanceEvent(advance("x", { rejectedByDisplayName: "Nguyễn Văn Vinh", status: "rejected" }), TODAY)).toBe("từ chối bởi Nguyễn Văn Vinh");
    expect(describeAdvanceEvent(advance("d", { deductionPeriodMonth: "2026-09-01", status: "deducted" }), TODAY)).toBe("trừ kỳ 09/2026");
    expect(describeAdvanceEvent(advance("old", { requestedAt: "2025-12-20T02:00:00Z" }), TODAY)).toBe("gửi 20/12/2025 09:00");
    expect(describeAdvanceEvent(advance("u", { status: "constructor" }), TODAY)).toBe("gửi 12/10 09:40");
  });

  it("captions each status without claiming money moved", () => {
    expect(describeAdvanceStatusCaption(advance("r"), TODAY)).toBe("đã gửi, chờ kế toán đối soát");
    expect(describeAdvanceStatusCaption(advance("v", { status: "review" }), TODAY)).toBe("đã đối soát, chờ chủ duyệt");
    expect(describeAdvanceStatusCaption(advance("a", { status: "approved" }), TODAY)).toBe("chưa trừ vào lương");
    expect(describeAdvanceStatusCaption(advance("d", { deductedAt: "2026-10-05T03:00:00Z", status: "deducted" }), TODAY)).toBe("tính lương 05/10");
    expect(describeAdvanceStatusCaption(advance("d-null", { deductionPeriodMonth: "2026-09-01", status: "deducted" }), TODAY)).toBe("tính lương kỳ 09/2026");
    expect(describeAdvanceStatusCaption(advance("x", { rejectionReason: "Thiếu chứng từ", status: "rejected" }), TODAY)).toBe("Thiếu chứng từ");
    expect(describeAdvanceStatusCaption(advance("x-null", { status: "rejected" }), TODAY)).toBeNull();
    expect(describeAdvanceStatusCaption(advance("u", { status: "constructor" }), TODAY)).toBe("Không thể diễn giải trạng thái này.");
    for (const status of ["requested", "review", "approved", "deducted", "rejected"]) {
      expect(describeAdvanceStatusCaption(advance(status, { status }), TODAY) ?? "").not.toMatch(/chờ khấu trừ|đã chi|đã trả/i);
    }
  });

  it("builds the read-only timeline from recorded steps only", () => {
    const deducted = advance("d", {
      approvalNote: "Đồng ý",
      approvedAt: "2026-09-07T03:00:00Z",
      approvedByDisplayName: "Nguyễn Văn Vinh",
      deductedAt: "2026-10-05T03:00:00Z",
      deductionPayrollPeriodId: "period-9",
      deductionPeriodMonth: "2026-09-01",
      reviewedAt: "2026-09-06T02:00:00Z",
      reviewedByDisplayName: "Lê Thu Hằng",
      status: "deducted",
    });
    expect(buildAdvanceTimeline(deducted)).toEqual([
      { key: "requested", label: "Gửi yêu cầu", meta: "09:40 12/10/2026", note: null },
      { key: "review", label: "Đối soát", meta: "09:00 06/09/2026 · bởi Lê Thu Hằng", note: null },
      { key: "approved", label: "Phê duyệt", meta: "10:00 07/09/2026 · bởi Nguyễn Văn Vinh", note: "Đồng ý" },
      { key: "deducted", label: "Khấu trừ", meta: "kỳ 09/2026 · tính lương lúc 10:00 05/10/2026", note: null },
    ]);
    expect(buildAdvanceTimeline(advance("bare", { status: "review" })).map((event) => event.key)).toEqual(["requested"]);
    expect(buildAdvanceTimeline(advance("x", { rejectionReason: "Thiếu chứng từ", status: "rejected" })).at(-1)).toEqual({
      key: "rejected",
      label: "Từ chối",
      meta: null,
      note: "Thiếu chứng từ",
    });
  });
});

describe("related requests and header", () => {
  it("lists the other rows of the same staff member and deduction month, never the row itself", () => {
    const rows = [
      advance("a", { amountVnd: 3_000_000 }),
      advance("b", { amountVnd: 1_000_000, requestedAt: "2026-10-04T01:00:00Z", status: "approved" }),
      advance("c", { deductionPeriodMonth: "2026-09-01" }),
      advance("d", { staffId: "someone-else" }),
    ];
    const related = buildRelatedAdvances(rows);
    expect(ids(related.get("a") ?? [])).toEqual(["b"]);
    expect(ids(related.get("b") ?? [])).toEqual(["a"]);
    expect(related.get("c")).toEqual([]);
    expect(related.get("d")).toEqual([]);
    expect(describeRelatedAdvance(rows[1], TODAY)).toMatch(/^1\.000\.000\s₫ · Đã phê duyệt · gửi 04\/10$/);
  });

  it("counts rows of the selected month for deciders and own-scope viewers, without money", () => {
    const rows = [
      advance("r"),
      advance("v", { status: "review" }),
      advance("a", { status: "approved" }),
      advance("s", { deductionPeriodMonth: "2026-09-01", status: "requested" }),
    ];
    expect(describeAdvanceSummary(rows, { period: ALL_OPTION, viewer: owner })).toBe("4 đơn · 2 chờ đối soát · 1 chờ phê duyệt");
    expect(describeAdvanceSummary(rows, { period: "2026-10", viewer: owner })).toBe("Kỳ trừ 10/2026 · 3 đơn · 1 chờ đối soát · 1 chờ phê duyệt");
    expect(describeAdvanceSummary(rows, { period: ALL_OPTION, viewer: staffMember })).toBe("4 đơn của bạn · 3 đang chờ duyệt");
    expect(describeAdvanceSummary(rows, { period: ALL_OPTION, viewer: owner })).not.toMatch(/₫|tổng/);
  });

  it("warns that a load at the row cap may be partial", () => {
    const full = Array.from({ length: ADVANCES_MAX_ROWS }, (_, index) => advance(`row-${index}`, { status: "approved" }));
    expect(describeAdvanceSummary(full, { period: ALL_OPTION, viewer: owner })).toBe(
      "1000 đơn · 0 chờ đối soát · 0 chờ phê duyệt · có thể chưa đủ (hệ thống trả tối đa 1.000 dòng)",
    );
    expect(describeAdvanceSummary(full.slice(1), { period: ALL_OPTION, viewer: owner })).not.toContain("có thể chưa đủ");
  });
});
