import { getPayrollPositionName } from "@/features/payroll/dashboard/aggregate";
import { formatCompactVnd, formatShortMonth, formatSignedPercent, formatVnd } from "@/features/payroll/dashboard/format";
import type { PayrollDashboardData, PayrollDashboardSourcePeriod } from "@/features/payroll/dashboard/read-models";
import { formatDayMonth, getTodayInVietnam } from "@/features/payroll/estimate/daily-breakdown";
import type { OwnerPayrollEstimate, StaffEstimateStatement } from "@/features/payroll/estimate/types";
import { formatWorkMinutes } from "@/features/payroll/payroll-presentation";

/**
 * Pure presentation model for /payroll/dashboard (design 8a). Every figure is
 * read from what the existing loaders return (owner live estimate, dashboard
 * RPC); a figure the ERP does not have is left out, never shown as 0.
 */

export type PayrollFigureTone = "danger" | "warning";

export interface PayrollFigure {
  helper?: string;
  key: string;
  label: string;
  tone?: PayrollFigureTone;
  value: string;
}

export type PayrollBadgeTone = "info" | "neutral" | "success" | "warning";

/**
 * Header badge. A period in review ("Chờ đối soát") or approved ("Đã duyệt")
 * wins: the live estimate RPC reports "estimated" for every non-approved
 * month, so it cannot say the period is waiting for review. "Tạm tính · đến
 * dd/MM" only otherwise.
 */
export function getPayrollHeaderBadge(
  estimate: Pick<OwnerPayrollEstimate, "asOf" | "status"> | null,
  periodStatus: string | null,
): { label: string; tone: PayrollBadgeTone } | null {
  if (periodStatus === "review") return { label: "Chờ đối soát", tone: "warning" };
  if (periodStatus === "approved" || estimate?.status === "approved") return { label: "Đã duyệt", tone: "success" };
  if (estimate) {
    const asOf = formatVietnamDayMonth(estimate.asOf);
    return { label: asOf ? `Tạm tính · đến ${asOf}` : "Tạm tính", tone: "info" };
  }
  if (periodStatus === "draft") return { label: "Bản nháp", tone: "neutral" };
  return null;
}

function formatVietnamDayMonth(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDayMonth(getTodayInVietnam(date));
}

/**
 * Context line under the page title: staff count, positions, hours already
 * counted and shifts awaiting verification. Staff, positions and hours come
 * from the same rows as the "Theo nhân sự" table (statements are already
 * position-filtered and include idle staff, which the rows drop). Pay date is
 * not loaded on this screen, so it is not shown.
 */
export function buildPayrollHeaderContext(
  estimate: (Pick<OwnerPayrollEstimate, "issues" | "statements" | "summary"> & Partial<Pick<OwnerPayrollEstimate, "status">>) | null,
  dashboard: Pick<PayrollDashboardData, "summary">,
): string[] {
  if (!estimate) {
    return dashboard.summary.employeeCount > 0
      ? [`${dashboard.summary.employeeCount} nhân sự có bảng lương kỳ này`]
      : [];
  }

  const rows = buildOwnerStaffRows(estimate);
  const parts = [`${rows.length} nhân sự`];
  const positions = [...new Set(rows.map((row) => row.positionCode))];
  if (positions.length > 0) {
    const names = positions.map(getPayrollPositionName);
    parts.push(`${positions.length} vị trí (${names.join(", ")})`);
  }
  const workedMinutes = rows.reduce((sum, row) => sum + row.workedMinutes, 0);
  if (workedMinutes > 0) {
    parts.push(`${formatWorkMinutes(workedMinutes)} công ghi nhận`);
  }
  if (estimate.summary.pendingVerificationCount > 0) {
    parts.push(`${estimate.summary.pendingVerificationCount} ca chờ xác minh`);
  }
  return parts;
}

/**
 * The page's primary action is the real outstanding task: a period waiting in
 * review that this viewer can approve. Otherwise the page has no primary.
 */
export function getOutstandingPayrollTask(
  periods: readonly PayrollDashboardSourcePeriod[],
  canApprove: boolean,
): { href: string; label: string } | null {
  if (!canApprove) return null;
  const review = [...periods]
    .filter((period) => period.status === "review")
    .sort((left, right) => right.month.localeCompare(left.month))[0];
  return review ? { href: "/payroll", label: `Xem kỳ ${formatShortMonth(review.month)} chờ duyệt` } : null;
}

/** Thin figures strip for the live estimate (design 8a). */
export function buildLiveEstimateFigures(
  estimate: Pick<OwnerPayrollEstimate, "finance" | "status" | "summary">,
  options: { positionFiltered: boolean },
): PayrollFigure[] {
  const { finance, summary } = estimate;
  const figures: PayrollFigure[] = [
    // Same split as the payslip (payslip-sections.ts): the piecework offset and
    // manual decreases are netted into income, so "Khấu trừ" is the advances.
    // payable + advances equals that income only because the line-item check
    // constraint allows exactly three deduction types (advance_deduction,
    // piecework_offset, manual_deduction; 20260825120000_payroll_calculation_engine.sql).
    { helper: "Trước khấu trừ", key: "earnings", label: "Tổng thu nhập", value: formatVnd(summary.payableVnd + summary.advanceDeductionsVnd) },
    {
      helper: "Tạm ứng lương trừ trong kỳ",
      key: "deductions",
      label: "Khấu trừ",
      tone: summary.advanceDeductionsVnd > 0 ? "danger" : undefined,
      value: summary.advanceDeductionsVnd > 0 ? `−${formatVnd(summary.advanceDeductionsVnd)}` : formatVnd(0),
    },
    {
      helper: "Sau khấu trừ",
      key: "payable",
      label: estimate.status === "approved" ? "Lương phải trả đã duyệt" : "Lương tạm tính phải trả",
      value: formatVnd(summary.payableVnd),
    },
    {
      helper: summary.pendingVerificationCount === 0
        ? "Không có ca chờ xác minh"
        : estimate.status === "approved"
          // Approved pay excludes unverified work: nothing is "tính tạm".
          ? "Không nằm trong lương đã duyệt"
          : "Đã tính tạm, chờ duyệt xác minh chấm công",
      key: "pending",
      label: "Ca chờ xác minh",
      tone: summary.pendingVerificationCount > 0 ? "warning" : undefined,
      value: `${summary.pendingVerificationCount} ca`,
    },
  ];

  if (finance.status === "available" && finance.tuitionNetVnd !== undefined) {
    // A part the payload does not carry is left out, never printed as 0.
    const tuitionParts = [
      finance.tuitionReceivedVnd !== undefined ? `Thu ${formatCompactVnd(finance.tuitionReceivedVnd)}` : null,
      finance.tuitionRefundedVnd !== undefined ? `Hoàn ${formatCompactVnd(finance.tuitionRefundedVnd)}` : null,
    ].filter((part): part is string => part !== null);
    figures.push({
      ...(tuitionParts.length > 0 ? { helper: tuitionParts.join(" · ") } : {}),
      key: "tuition",
      label: "Thực thu sau hoàn",
      value: formatVnd(finance.tuitionNetVnd),
    });
    if (finance.tuitionNetVnd > 0 && finance.payrollRatioPercent !== null && finance.payrollRatioPercent !== undefined) {
      figures.push({
        helper: options.positionFiltered ? "Lương vị trí / thực thu toàn trung tâm" : "Trên học phí thực thu trong kỳ",
        key: "ratio",
        label: "Lương phải trả / Thực thu",
        value: `${finance.payrollRatioPercent}%`,
      });
    }
  }

  return figures;
}

/** Figures of the payroll period statements (the "Phân tích" section). */
export function buildStatementFigures(summary: PayrollDashboardData["summary"]): PayrollFigure[] {
  const figures: PayrollFigure[] = [
    {
      helper: summary.payrollChangePercent === null
        ? "Không có dữ liệu tháng trước"
        : `${formatSignedPercent(summary.payrollChangePercent)} so với tháng trước`,
      key: "total",
      label: "Tổng chi phí lương",
      value: formatVnd(summary.totalPayroll),
    },
    {
      helper: `${summary.employeeChange > 0 ? "+" : ""}${summary.employeeChange} so với tháng trước`,
      key: "employees",
      label: "Nhân sự được tính lương",
      value: `${summary.employeeCount} nhân sự`,
    },
    {
      helper: "Tổng thực trả / số nhân sự",
      key: "average",
      label: "Trung bình / nhân sự",
      value: formatVnd(Math.round(summary.averageSalary)),
    },
  ];
  if (summary.highestPaidEmployee) {
    figures.push({
      helper: `${summary.highestPaidEmployee.staffDisplayName} · ${summary.highestPaidEmployee.positionName}`,
      key: "highest",
      label: "Tổng lương cao nhất",
      value: formatVnd(summary.highestPaidEmployee.currentPayroll),
    });
  }
  if (summary.payrollChangePercent !== null) {
    figures.push({
      helper: "So với tổng tháng trước",
      key: "change",
      label: "Biến động quỹ lương",
      value: `${summary.payrollChange > 0 ? "+" : ""}${formatVnd(summary.payrollChange)}`,
    });
  }
  return figures;
}

const blockingIssueLabels: Record<string, string> = {
  missing_daily_rate: "Thiếu mức lương ngày",
  missing_payroll_position: "Thiếu vị trí tính lương",
};

export type OwnerStaffRow = StaffEstimateStatement & {
  /**
   * Set when a blocking issue (missing position or daily rate) touches this
   * staff member. Issues are raised per work date, so other days may still be
   * calculated: see `hasCalculatedAmounts`.
   */
  blockedReason: string | null;
  /** False when income, deductions and payable are all 0: nothing to show yet. */
  hasCalculatedAmounts: boolean;
  /** Dashboard-wide position label (`getPayrollPositionName`: one label for the unassigned bucket). */
  positionLabel: string;
};

function hasActivity(statement: StaffEstimateStatement): boolean {
  return statement.payableVnd !== 0
    || statement.workedMinutes > 0
    || statement.totalEarningsVnd !== 0
    || statement.totalDeductionsVnd !== 0;
}

function hasCalculatedAmounts(statement: StaffEstimateStatement): boolean {
  return !(statement.totalEarningsVnd === 0 && statement.totalDeductionsVnd === 0 && statement.payableVnd === 0);
}

/**
 * Staff rows for "Theo nhân sự": staff with activity this month plus anyone a
 * blocking issue touches, the latter first so they get fixed before the
 * period closes. A blocked row keeps its calculated amounts (the issue may
 * cover only some work dates), so the visible rows add up to the footer.
 */
export function buildOwnerStaffRows(
  estimate: Pick<OwnerPayrollEstimate, "issues" | "statements"> & Partial<Pick<OwnerPayrollEstimate, "status">>,
): OwnerStaffRow[] {
  // An approved statement is already paid: a missing position on it (older
  // statements) is not something left to calculate.
  const guardMissingPosition = estimate.status !== "approved";
  // Every distinct blocking reason per staff, so fixing one does not reveal another.
  const labelsByStaff = new Map<string, Set<string>>();
  for (const issue of estimate.issues) {
    const label = blockingIssueLabels[issue.issueCode];
    if (!issue.staffId || !label) continue;
    const labels = labelsByStaff.get(issue.staffId) ?? new Set<string>();
    labels.add(label);
    labelsByStaff.set(issue.staffId, labels);
  }
  const issuesByStaff = new Map([...labelsByStaff].map(([staffId, labels]) => [staffId, [...labels].join(", ")]));

  return estimate.statements
    .filter((statement) =>
      issuesByStaff.has(statement.staffId) || (guardMissingPosition && !statement.positionCode) || hasActivity(statement))
    .map((statement): OwnerStaffRow => {
      // Statements come only from staff with a payroll position; the null
      // check stays as a guard because the payload type allows it.
      const blockedReason = issuesByStaff.get(statement.staffId)
        ?? (statement.positionCode || !guardMissingPosition ? null : blockingIssueLabels.missing_payroll_position);
      return {
        ...statement,
        blockedReason,
        hasCalculatedAmounts: hasCalculatedAmounts(statement),
        positionLabel: getPayrollPositionName(statement.positionCode),
      };
    })
    .sort((left, right) => {
      if ((left.blockedReason === null) !== (right.blockedReason === null)) {
        return left.blockedReason === null ? 1 : -1;
      }
      return right.payableVnd - left.payableVnd;
    });
}

/**
 * Staff who clocked work but have no payroll position: the estimate raises a
 * `missing_payroll_position` issue for them (per work date) but returns no
 * statement, so they cannot appear as a table row. Issues are not
 * position-filtered, and such staff belong to no position: under a position
 * filter the count is 0.
 */
export function countStaffWithoutPayrollPosition(
  estimate: Pick<OwnerPayrollEstimate, "issues" | "statements">,
  options: { positionCode?: string | null } = {},
): number {
  if (options.positionCode) return 0;
  const withStatement = new Set(estimate.statements.map((statement) => statement.staffId));
  const staffIds = new Set<string>();
  for (const issue of estimate.issues) {
    if (issue.issueCode === "missing_payroll_position" && issue.staffId && !withStatement.has(issue.staffId)) {
      staffIds.add(issue.staffId);
    }
  }
  return staffIds.size;
}
