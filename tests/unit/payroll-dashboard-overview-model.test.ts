// Value: protects=the /payroll/dashboard presentation model (design 8a): the page's only primary is the real outstanding task (a period in review the viewer can approve), the figures strip leaves out figures the loaders do not return instead of showing 0, and staff the estimate could not calculate are flagged "Chưa tính được" with the reason;
// fails_when=the primary appears without a review period or approval right, a restricted/missing tuition figure or ratio is rendered as 0, a staff row with no position or rate is treated as a calculated amount, or idle staff with no activity are listed;
// why_new=step 8 adds overview-model.ts as the pure seam the dashboard components render;
// seam=pure functions only, fixtures shaped like the owner estimate and dashboard RPC payloads; no_claim=does not prove the components render these models (owner-payroll-dashboard-redesign covers that)
import { describe, expect, it } from "vitest";

import {
  buildLiveEstimateFigures,
  buildOwnerStaffRows,
  buildPayrollHeaderContext,
  buildStatementFigures,
  countStaffWithoutPayrollPosition,
  getOutstandingPayrollTask,
  getPayrollHeaderBadge,
} from "@/features/payroll/dashboard/overview-model";
import { getPayrollPositionName } from "@/features/payroll/dashboard/aggregate";
import { UNASSIGNED_POSITION_CODE } from "@/features/payroll/dashboard/read-models";
import type { OwnerPayrollEstimate, StaffEstimateStatement } from "@/features/payroll/estimate/types";

function statement(overrides: Partial<StaffEstimateStatement> & Pick<StaffEstimateStatement, "staffId">): StaffEstimateStatement {
  return {
    advanceDeductionsVnd: 0,
    payableVnd: 0,
    pendingVerificationCount: 0,
    positionCode: "teaching_assistant",
    staffDisplayName: "Nhân sự",
    staffEmployeeCode: null,
    totalDeductionsVnd: 0,
    totalEarningsVnd: 0,
    workHours: 0,
    workUnits: 0,
    workedMinutes: 0,
    ...overrides,
  };
}

const summary = {
  advanceDeductionsVnd: 1_000_000,
  payableVnd: 4_000_000,
  pendingVerificationCount: 2,
  staffCount: 3,
  totalDeductionsVnd: 1_000_000,
  totalEarningsVnd: 5_000_000,
};

// Value: protects=the dashboard uses ONE label for the "unassigned" bucket and for a null position ("Chưa phân loại", as the period analytics name it) instead of leaking the internal code;
// fails_when=getPayrollPositionName passes "__unassigned__" through, reads null differently from the bucket, or maps every code to the no-position label;
// why_new=no test calls the dashboard label helper with the unassigned bucket the dashboard RPC returns; review pass 3 (fix 6) removed the overview-model alias, so the labels are asserted on getPayrollPositionName directly;
// seam=none; no_claim=none beyond protects (pure function)
describe("getPayrollPositionName (dashboard position label)", () => {
  it("reads the unassigned bucket as the analytics label and keeps known labels", () => {
    expect(getPayrollPositionName(UNASSIGNED_POSITION_CODE)).toBe("Chưa phân loại");
    expect(getPayrollPositionName(null)).toBe("Chưa phân loại");
    expect(getPayrollPositionName("teaching_assistant")).toBe("Trợ giảng");
  });
});

describe("getOutstandingPayrollTask", () => {
  const periods = [
    { month: "2026-10-01", status: "draft" },
    { month: "2026-09-01", status: "review" },
    { month: "2026-08-01", status: "approved" },
  ];

  it("links the latest period in review when the viewer can approve it", () => {
    expect(getOutstandingPayrollTask(periods, true)).toEqual({ href: "/payroll", label: "Xem kỳ 09/2026 chờ duyệt" });
  });

  it("gives no primary without approval right or without a period in review", () => {
    expect(getOutstandingPayrollTask(periods, false)).toBeNull();
    expect(getOutstandingPayrollTask([{ month: "2026-10-01", status: "draft" }], true)).toBeNull();
  });
});

describe("getPayrollHeaderBadge", () => {
  it("reads the live estimate status first, then the period status", () => {
    expect(getPayrollHeaderBadge({ asOf: "2026-10-12T08:30:00Z", status: "estimated" }, "draft")).toEqual({ label: "Tạm tính · đến 12/10", tone: "info" });
    expect(getPayrollHeaderBadge({ asOf: "2026-10-12T08:30:00Z", status: "approved" }, "draft")).toEqual({ label: "Đã duyệt", tone: "success" });
    expect(getPayrollHeaderBadge(null, "review")).toEqual({ label: "Chờ đối soát", tone: "warning" });
    expect(getPayrollHeaderBadge(null, null)).toBeNull();
  });

  // Value: protects=the header badge tells the owner a period is waiting for review or already approved even though the live estimate RPC reports "estimated" for every non-approved month;
  // fails_when=the estimate badge "Tạm tính · đến dd/MM" hides a period in review or an approved period;
  // why_new=review fix RT5: the estimate used to win over the period status;
  // seam=none; no_claim=none beyond protects (pure function)
  it("lets a period in review or approved win over the live estimate badge", () => {
    const estimated = { asOf: "2026-10-12T08:30:00Z", status: "estimated" as const };
    expect(getPayrollHeaderBadge(estimated, "review")).toEqual({ label: "Chờ đối soát", tone: "warning" });
    expect(getPayrollHeaderBadge(estimated, "approved")).toEqual({ label: "Đã duyệt", tone: "success" });
    expect(getPayrollHeaderBadge(estimated, null)).toEqual({ label: "Tạm tính · đến 12/10", tone: "info" });
  });
});

describe("buildPayrollHeaderContext", () => {
  // Value: protects=the header counts the same staff the "Theo nhân sự" table lists (activity-filtered rows), not summary.staffCount, which includes every eligible positioned staff even with no activity;
  // fails_when=the header says "3 nhân sự" while the table lists 2, or counts an idle staff member's position;
  // why_new=review pass 2 (fix 4): the count came from summary.staffCount;
  // seam=none; no_claim=none beyond protects (pure function)
  it("lists staff, positions and counted hours from the listed rows, and pending shifts from the summary", () => {
    const context = buildPayrollHeaderContext(
      {
        issues: [],
        statements: [
          statement({ staffId: "a", workedMinutes: 600 }),
          statement({ staffId: "b", workedMinutes: 30 }),
          statement({ positionCode: "admissions_manager", staffId: "idle" }),
        ],
        summary,
      },
      { summary: { employeeCount: 0 } as never },
    );

    expect(context).toEqual(["2 nhân sự", "1 vị trí (Trợ giảng)", "10 giờ 30 phút công ghi nhận", "2 ca chờ xác minh"]);
    expect(context.join(" ")).not.toMatch(/ngày trả/);
  });

  // Value: protects=the header names only the positions of the staff actually listed when the dashboard is filtered to one position;
  // fails_when=the positions list is read from a position summary that still carries other positions, so a filtered page claims "3 vị trí";
  // why_new=review fix RT4: positions now come from estimate.statements (already position-filtered), not byPosition;
  // seam=none; no_claim=does not prove the RPC filters statements (it does: get_owner_payroll_estimate filters by p_position_code)
  it("lists only the positions present in the position-filtered statements", () => {
    const filtered = {
      byPosition: [
        { payableVnd: 1, positionCode: "teaching_assistant", staffCount: 1, totalDeductionsVnd: 0, totalEarningsVnd: 1 },
        { payableVnd: 1, positionCode: "admissions_manager", staffCount: 1, totalDeductionsVnd: 0, totalEarningsVnd: 1 },
        { payableVnd: 1, positionCode: "operations_assistant", staffCount: 1, totalDeductionsVnd: 0, totalEarningsVnd: 1 },
      ],
      issues: [],
      statements: [
        statement({ positionCode: "admissions_manager", staffId: "a", workedMinutes: 60 }),
        statement({ positionCode: "admissions_manager", staffId: "b", workedMinutes: 60 }),
      ],
      summary: { ...summary, pendingVerificationCount: 0, staffCount: 2 },
    };
    const context = buildPayrollHeaderContext(filtered, { summary: { employeeCount: 0 } as never });
    expect(context).toEqual(["2 nhân sự", "1 vị trí (Quản lý tuyển sinh)", "2 giờ công ghi nhận"]);
  });
});

// Value: protects=fallback branches of the 8a header model: without a live estimate the context comes from the period statements, the primary names the latest period in review, and the badge never prints an invalid date;
// fails_when=the null-estimate context shows "0 nhân sự" or nothing for a period with statements, the review sort flips to the oldest period, or an unparseable asOf leaks "undefined/undefined";
// why_new=existing rows exercise only the estimate-present header and a single review period;
// seam=none; no_claim=none beyond protects (pure functions, fixtures only)
describe("header model fallbacks", () => {
  it("falls back to the period statements when the live estimate is missing", () => {
    expect(buildPayrollHeaderContext(null, { summary: { employeeCount: 4 } as never })).toEqual(["4 nhân sự có bảng lương kỳ này"]);
    expect(buildPayrollHeaderContext(null, { summary: { employeeCount: 0 } as never })).toEqual([]);
  });

  it("names the latest period in review when several are waiting", () => {
    const periods = [
      { month: "2026-07-01", status: "review" },
      { month: "2026-09-01", status: "review" },
      { month: "2026-08-01", status: "review" },
    ];
    expect(getOutstandingPayrollTask(periods, true)?.label).toBe("Xem kỳ 09/2026 chờ duyệt");
  });

  it("keeps the estimate badge readable without a valid as-of date and maps the remaining period statuses", () => {
    expect(getPayrollHeaderBadge({ asOf: "not-a-date", status: "estimated" }, null)).toEqual({ label: "Tạm tính", tone: "info" });
    expect(getPayrollHeaderBadge(null, "approved")).toEqual({ label: "Đã duyệt", tone: "success" });
    expect(getPayrollHeaderBadge(null, "draft")).toEqual({ label: "Bản nháp", tone: "neutral" });
  });

  it("labels approved payable figures and leaves zero deductions and pending shifts untoned", () => {
    const figures = buildLiveEstimateFigures(
      {
        finance: { status: "restricted" },
        status: "approved",
        summary: { ...summary, advanceDeductionsVnd: 0, pendingVerificationCount: 0, totalDeductionsVnd: 0 },
      },
      { positionFiltered: false },
    );
    expect(figures.find((figure) => figure.key === "payable")?.label).toBe("Lương phải trả đã duyệt");
    expect(figures.find((figure) => figure.key === "deductions")).toMatchObject({ tone: undefined, value: "0 ₫" });
    expect(figures.find((figure) => figure.key === "pending")).toMatchObject({ helper: "Không có ca chờ xác minh", tone: undefined, value: "0 ca" });
  });
});

// Value: protects=the "Ca chờ xác minh" figure never claims "Đã tính tạm" for an approved month (approved pay excludes unverified work), and the tuition helper leaves out a received/refunded part the payload does not carry instead of printing 0;
// fails_when=an approved month's helper still says "Đã tính tạm", or a missing tuitionReceivedVnd / tuitionRefundedVnd renders as "Thu 0" / "Hoàn 0";
// why_new=review pass 2 (fixes 9 and 16);
// seam=none; no_claim=none beyond protects (pure function)
describe("buildLiveEstimateFigures gating", () => {
  it("does not call pending shifts provisional once approved", () => {
    const pending = buildLiveEstimateFigures({ finance: { status: "restricted" }, status: "approved", summary }, { positionFiltered: false })
      .find((figure) => figure.key === "pending");
    expect(pending?.helper).not.toMatch(/tính tạm/);
    expect(pending?.helper).toBe("Không nằm trong lương đã duyệt");
  });

  it("omits tuition parts the payload does not carry", () => {
    const tuitionOf = (finance: OwnerPayrollEstimate["finance"]) =>
      buildLiveEstimateFigures({ finance, status: "estimated", summary }, { positionFiltered: false }).find((figure) => figure.key === "tuition");

    expect(tuitionOf({ status: "available", tuitionNetVnd: 10_000_000 })?.helper).toBeUndefined();
    expect(tuitionOf({ status: "available", tuitionNetVnd: 10_000_000, tuitionReceivedVnd: 12_000_000 })?.helper).toMatch(/^Thu .+$/);
    expect(tuitionOf({ status: "available", tuitionNetVnd: 10_000_000, tuitionReceivedVnd: 12_000_000 })?.helper).not.toMatch(/Hoàn/);
    expect(tuitionOf({ status: "available", tuitionNetVnd: 10_000_000, tuitionReceivedVnd: 12_000_000, tuitionRefundedVnd: 2_000_000 })?.helper).toMatch(/^Thu .+ · Hoàn .+$/);
  });
});

describe("buildLiveEstimateFigures", () => {
  it("omits tuition and ratio when finance is restricted instead of showing 0", () => {
    const figures = buildLiveEstimateFigures({ finance: { status: "restricted" }, status: "estimated", summary }, { positionFiltered: false });
    expect(figures.map((figure) => figure.label)).toEqual(["Tổng thu nhập", "Khấu trừ", "Lương tạm tính phải trả", "Ca chờ xác minh"]);
    expect(figures.find((figure) => figure.key === "deductions")).toMatchObject({ tone: "danger", value: "−1.000.000 ₫" });
    expect(figures.find((figure) => figure.key === "pending")).toMatchObject({ tone: "warning", value: "2 ca" });
  });

  it("shows tuition but omits the ratio when there is no net tuition to divide by", () => {
    const labels = buildLiveEstimateFigures(
      { finance: { payrollRatioPercent: null, status: "available", tuitionNetVnd: 0 }, status: "estimated", summary },
      { positionFiltered: false },
    ).map((figure) => figure.label);
    expect(labels).toContain("Thực thu sau hoàn");
    expect(labels).not.toContain("Lương phải trả / Thực thu");
  });

  it("adds the ratio with the position-filter caveat when it is known", () => {
    const ratio = buildLiveEstimateFigures(
      { finance: { payrollRatioPercent: 20, status: "available", tuitionNetVnd: 50_000_000 }, status: "estimated", summary },
      { positionFiltered: true },
    ).find((figure) => figure.key === "ratio");
    expect(ratio).toMatchObject({ helper: "Lương vị trí / thực thu toàn trung tâm", value: "20%" });
  });
});

describe("buildStatementFigures", () => {
  it("leaves out the highest earner and the change when there is no data for them", () => {
    const labels = buildStatementFigures({
      averageSalary: 0,
      employeeChange: 0,
      employeeCount: 0,
      highestPaidEmployee: null,
      payrollChange: 0,
      payrollChangePercent: null,
      previousMonthPayroll: 0,
      totalPayroll: 0,
    }).map((figure) => figure.label);
    expect(labels).toEqual(["Tổng chi phí lương", "Nhân sự được tính lương", "Trung bình / nhân sự"]);
  });

  // Value: protects=the "Phân tích" figures name the highest earner with their position and show a payroll drop without a "+" sign, with a signed percent;
  // fails_when=the highest-earner helper loses the name or position, a negative change reads "+-…", or the percent loses its sign;
  // why_new=review fix T5: only the no-data branch was covered;
  // seam=none; no_claim=none beyond protects (pure function)
  it("names the highest earner and signs a payroll decrease", () => {
    const figures = buildStatementFigures({
      averageSalary: 3_000_000,
      employeeChange: -1,
      employeeCount: 2,
      highestPaidEmployee: {
        change: 0,
        changePercent: null,
        currentPayroll: 4_000_000,
        isNew: false,
        positionCode: "teaching_assistant",
        positionName: "Trợ giảng",
        previousPayroll: 4_000_000,
        sharePercent: 66.7,
        staffDisplayName: "Trần Thanh Tùng",
        staffEmployeeCode: "NV07",
        staffId: "a",
      },
      payrollChange: -1_500_000,
      payrollChangePercent: -20,
      previousMonthPayroll: 7_500_000,
      totalPayroll: 6_000_000,
    });

    expect(figures.find((figure) => figure.key === "highest")).toMatchObject({ helper: "Trần Thanh Tùng · Trợ giảng", value: "4.000.000 ₫" });
    const change = figures.find((figure) => figure.key === "change");
    expect(change?.value).not.toContain("+");
    expect(change?.value).toBe("-1.500.000 ₫");
    expect(figures.find((figure) => figure.key === "total")?.helper).toBe("−20,0% so với tháng trước");
    expect(figures.find((figure) => figure.key === "employees")?.helper).toBe("-1 so với tháng trước");
  });
});

describe("buildOwnerStaffRows", () => {
  // Statements come only from staff with a payroll position; missing-position
  // and missing-rate issues are raised per work date.
  const estimate: Pick<OwnerPayrollEstimate, "issues" | "statements"> = {
    issues: [
      { details: { work_date: "2026-10-03" }, issueCode: "missing_daily_rate", staffId: "rate" },
      { details: { work_date: "2026-10-04" }, issueCode: "missing_daily_rate", staffId: "partial" },
      { details: { work_date: "2026-10-05" }, issueCode: "missing_daily_rate", staffId: "idle-blocked" },
      { details: { work_date: "2026-10-06" }, issueCode: "missing_payroll_position", staffId: "no-position" },
      { details: { work_date: "2026-10-07" }, issueCode: "missing_payroll_position", staffId: "no-position" },
      { issueCode: "missing_grade" },
    ],
    statements: [
      statement({ payableVnd: 1_000_000, staffDisplayName: "Ít", staffId: "low", totalEarningsVnd: 1_000_000, workedMinutes: 60 }),
      statement({ payableVnd: 3_000_000, staffDisplayName: "Nhiều", staffId: "high", totalEarningsVnd: 3_000_000, workedMinutes: 120 }),
      statement({ staffDisplayName: "Chưa đơn giá", staffId: "rate", workedMinutes: 90 }),
      statement({ payableVnd: 500_000, staffDisplayName: "Thiếu vài ngày", staffId: "partial", totalEarningsVnd: 500_000, workedMinutes: 150 }),
      statement({ staffDisplayName: "Không phát sinh", staffId: "idle" }),
      statement({ staffDisplayName: "Chưa chấm công", staffId: "idle-blocked" }),
    ],
  };

  it("lists blocked staff first, then sorts by payable and drops idle staff without an issue", () => {
    const rows = buildOwnerStaffRows(estimate);
    expect(rows.map((row) => row.staffId)).toEqual(["partial", "rate", "idle-blocked", "high", "low"]);
    expect(rows[1]).toMatchObject({ blockedReason: "Thiếu mức lương ngày", hasCalculatedAmounts: false, positionLabel: "Trợ giảng" });
    expect(rows[3]).toMatchObject({ blockedReason: null, hasCalculatedAmounts: true });
  });

  // Value: protects=a staff row with a blocking issue keeps the amounts the estimate did calculate, so the visible rows add up to the footer total;
  // fails_when=a blocked row is flattened to "no amounts" while its payable is still inside summary.payableVnd, or the rows stop reconciling with the totals;
  // why_new=review fix RT1: missing-rate issues are per work date, so other days of the same staff are calculated;
  // seam=none; no_claim=does not prove the component renders the amounts (owner-payroll-dashboard-redesign covers that)
  it("keeps calculated amounts on a blocked row so rows reconcile with the totals", () => {
    const rows = buildOwnerStaffRows(estimate);
    expect(rows[0]).toMatchObject({ blockedReason: "Thiếu mức lương ngày", hasCalculatedAmounts: true, payableVnd: 500_000 });
    const payableOfRows = rows.reduce((sum, row) => sum + row.payableVnd, 0);
    const payableOfStatements = estimate.statements.reduce((sum, item) => sum + item.payableVnd, 0);
    expect(payableOfRows).toBe(payableOfStatements);
  });

  // Value: protects=staff with a blocking issue but no activity yet stay listed as "not calculated", while idle staff without an issue are dropped;
  // fails_when=the activity filter drops an idle blocked staff member (the owner never sees the missing rate) or keeps idle unblocked staff;
  // why_new=review fix T3: the idle + blocked combination was untested;
  // seam=none; no_claim=none beyond protects (pure function)
  it("keeps an idle staff member with a blocking issue as not calculated", () => {
    const rows = buildOwnerStaffRows(estimate);
    expect(rows.find((row) => row.staffId === "idle-blocked")).toMatchObject({ blockedReason: "Thiếu mức lương ngày", hasCalculatedAmounts: false });
    expect(rows.find((row) => row.staffId === "idle")).toBeUndefined();
  });

  // Value: protects=staff who clocked work but have no payroll position (no statement, only per-date issues) are counted once so the table can say they are not calculated;
  // fails_when=they are dropped silently, counted once per work date, or a staff member with a statement is counted too;
  // why_new=review fix RT2: the RPC returns no statement for them, so they never reach a table row;
  // seam=none; no_claim=does not prove the component renders the line (owner-payroll-dashboard-redesign covers that)
  it("counts staff without a payroll position once, only when they have no statement", () => {
    expect(countStaffWithoutPayrollPosition(estimate)).toBe(1);
    expect(countStaffWithoutPayrollPosition({
      issues: [{ issueCode: "missing_payroll_position", staffId: "low" }],
      statements: estimate.statements,
    })).toBe(0);
    expect(buildOwnerStaffRows(estimate).some((row) => row.staffId === "no-position")).toBe(false);
  });

  // Value: protects=under a position filter the "no payroll position" count is 0: issues are not position-filtered and such staff belong to no position;
  // fails_when=a page filtered to one position still reports staff without a position (from the unfiltered issues);
  // why_new=review pass 2 (fix 3);
  // seam=none; no_claim=does not prove the component hides the line (owner-payroll-dashboard-redesign covers that)
  it("counts no staff without a position under a position filter", () => {
    expect(countStaffWithoutPayrollPosition(estimate, { positionCode: "teaching_assistant" })).toBe(0);
    expect(countStaffWithoutPayrollPosition(estimate, { positionCode: null })).toBe(1);
  });

  // Value: protects=the null-position guard: a statement without a position (the payload type allows it) is listed as blocked "Thiếu vị trí tính lương" with the dashboard's no-position label, even when idle;
  // fails_when=the guard is dropped so a positionless statement is hidden or treated as calculated, or its label differs from the rest of the dashboard;
  // why_new=review pass 2 (17d): the guard branch was never driven;
  // seam=none; no_claim=does not prove the RPC can return such a statement (it inner-joins positions today)
  it("lists a statement without a position as blocked", () => {
    const rows = buildOwnerStaffRows({ issues: [], statements: [statement({ positionCode: null, staffId: "null-position" })] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      blockedReason: "Thiếu vị trí tính lương",
      hasCalculatedAmounts: false,
      positionCode: null,
      positionLabel: "Chưa phân loại",
    });
  });
});

// Value: protects=an approved statement with no payroll position (older statements) is listed as paid, not flagged "Thiếu vị trí tính lương", while an estimated one still is; fails_when=the missing-position guard ignores estimate.status; why_new=adversarial review: approved months would flag already-paid rows; seam=none; no_claim=does not prove which approved statements carry a null position in production
describe("buildOwnerStaffRows for an approved month", () => {
  it("does not flag a missing position on an approved statement", () => {
    const paid = statement({ payableVnd: 500000, positionCode: null, staffId: "old", totalEarningsVnd: 500000, workedMinutes: 300 });
    const approvedRows = buildOwnerStaffRows({ issues: [], statements: [paid], status: "approved" });
    expect(approvedRows).toHaveLength(1);
    expect(approvedRows[0].blockedReason).toBeNull();
    const estimatedRows = buildOwnerStaffRows({ issues: [], statements: [paid], status: "estimated" });
    expect(estimatedRows[0].blockedReason).toBe("Thiếu vị trí tính lương");
  });
});

// Value: protects=a staff member blocked by both a missing daily rate and a missing position sees both reasons at once; fails_when=only the first issue the RPC returned is shown, so fixing it reveals a second, unseen blocker; why_new=final adversarial review (finding 5); seam=none; no_claim=none beyond protects
describe("buildOwnerStaffRows with several blocking issues", () => {
  it("joins every distinct blocking reason for one staff member", () => {
    const rows = buildOwnerStaffRows({
      issues: [
        { details: { work_date: "2026-10-05" }, issueCode: "missing_daily_rate", staffId: "both" },
        { details: { work_date: "2026-10-06" }, issueCode: "missing_payroll_position", staffId: "both" },
        { details: { work_date: "2026-10-07" }, issueCode: "missing_daily_rate", staffId: "both" },
      ],
      statements: [statement({ positionCode: "teaching_assistant", staffId: "both", workedMinutes: 120 })],
      status: "estimated",
    });
    expect(rows[0].blockedReason).toBe("Thiếu mức lương ngày, Thiếu vị trí tính lương");
  });
});
