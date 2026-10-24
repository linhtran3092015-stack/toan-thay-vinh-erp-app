"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { buildPayrollDashboardData } from "@/features/payroll/dashboard/aggregate";
import { OwnerPayrollDashboardPage } from "@/features/payroll/dashboard/payroll-dashboard-page";
import type { PayrollDashboardSource } from "@/features/payroll/dashboard/read-models";
import { StaffPayrollLedger } from "@/features/payroll/estimate/components/staff-payroll-ledger";
import type {
  OwnerPayrollEstimate,
  StaffEstimateLine,
  StaffEstimateStatement,
  StaffMonthShift,
  StaffPayrollEstimate,
} from "@/features/payroll/estimate/types";
import type { PayrollEstimateTransport } from "@/features/payroll/estimate/use-payroll-live-estimate";
import { formatCurrency } from "@/features/payroll/payroll-presentation";
import { PayslipDocument } from "@/features/payroll/payslip/components/payslip-document";
import { PayslipToolbar } from "@/features/payroll/payslip/components/payslip-toolbar";
import type { PayslipDocumentData } from "@/features/payroll/payslip/types";
import { formatVietnameseCurrencyWords } from "@/features/payroll/payslip/vietnamese-currency-words";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type PayrollPreviewView = "dashboard" | "ledger" | "payslip" | "payslip-piecework";
export type PayrollPreviewRole = "owner" | "accountant" | "staff";
export type PayrollPreviewState = "normal" | "empty" | "errors";

const STUB = "Bản xem trước không đọc dữ liệu thật.";
const MONTH = "2026-10-01";
const TODAY = "2026-10-12";

/** Accountant: prepares and reconciles payroll; no owner dashboard, no approval. */
const accountantPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "finance.view",
  "payroll.view",
  "payroll.manage",
  "payroll.import",
  "payroll.accountant_reconcile",
  "timekeeping.view",
  "timekeeping.check",
];

/** Teaching assistant: sees only their own payroll. */
const staffPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "payroll.view",
  "timekeeping.view",
  "timekeeping.check",
];

const staffIds = {
  duc: "e1000000-0000-4000-8000-000000000011",
  hanh: "e1000000-0000-4000-8000-000000000003",
  khoi: "e1000000-0000-4000-8000-000000000012",
  lan: "e1000000-0000-4000-8000-000000000009",
  thao: "e1000000-0000-4000-8000-000000000015",
  tung: "e1000000-0000-4000-8000-000000000007",
};

function statement(overrides: Partial<StaffEstimateStatement> & Pick<StaffEstimateStatement, "staffDisplayName" | "staffId">): StaffEstimateStatement {
  return {
    advanceDeductionsVnd: 0,
    payableVnd: 0,
    pendingVerificationCount: 0,
    positionCode: "teaching_assistant",
    staffEmployeeCode: null,
    totalDeductionsVnd: 0,
    totalEarningsVnd: 0,
    workHours: 0,
    workUnits: 0,
    workedMinutes: 0,
    ...overrides,
  };
}

/* ---------------------------------------------------------------- ledger (8b) */

/** Shift times are given in Vietnam time (UTC+7) and stored as UTC like the RPC. */
function shift(id: number, workDate: string, from: string, to: string | null, workedMinutes: number, overrides: Partial<StaffMonthShift> = {}): StaffMonthShift {
  const toUtc = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const [year, month, day] = workDate.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, hours - 7, minutes)).toISOString();
  };
  return {
    checkInAt: toUtc(from),
    checkOutAt: to ? toUtc(to) : null,
    id: `f1000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    isPendingVerification: false,
    status: to ? "checked_out" : "open",
    workDate,
    workMode: "offline",
    workedMinutes,
    ...overrides,
  };
}

const DAILY_RATE_VND = 720_000;

/** Base pay line for one closed shift: minutes × daily rate / 540, online at 50%. */
function baseLine(source: StaffMonthShift, amountVnd: number): StaffEstimateLine {
  return {
    amountVnd,
    direction: "earning",
    isPendingVerification: source.isPendingVerification,
    lineType: source.workMode === "online" ? "base_online" : "base_offline",
    note: source.workMode === "online" ? "Công online theo phút thực tế (50%)." : "Công offline theo phút thực tế.",
    policyCode: "daily_base_salary",
    sourceId: source.id,
    sourceKind: "time_entry",
    unitLabel: "phút",
    unitRateVnd: DAILY_RATE_VND,
    workDate: source.workDate,
    workedMinutes: source.workedMinutes,
  };
}

const ledgerShifts: StaffMonthShift[] = [
  shift(1, "2026-10-01", "17:22", "19:22", 120),
  shift(2, "2026-10-03", "17:16", "19:16", 120),
  shift(3, "2026-10-05", "14:49", "16:49", 120),
  shift(4, "2026-10-06", "17:20", "19:20", 120),
  shift(5, "2026-10-06", "19:40", "21:40", 120, { workMode: "online" }),
  shift(6, "2026-10-08", "14:52", "17:04", 132, { isPendingVerification: true }),
  shift(7, "2026-10-08", "17:18", "19:35", 137),
  shift(8, "2026-10-10", "17:21", "19:38", 137),
  shift(9, "2026-10-12", "15:00", null, 0),
];

const ledgerLines: StaffEstimateLine[] = [
  baseLine(ledgerShifts[0], 160_000),
  baseLine(ledgerShifts[1], 160_000),
  baseLine(ledgerShifts[2], 160_000),
  baseLine(ledgerShifts[3], 160_000),
  baseLine(ledgerShifts[4], 80_000),
  baseLine(ledgerShifts[5], 176_000),
  baseLine(ledgerShifts[6], 182_667),
  baseLine(ledgerShifts[7], 182_667),
  {
    amountVnd: 50_000,
    direction: "earning",
    lineType: "teaching_allowance",
    note: null,
    policyCode: "teaching_allowance",
    sourceId: "f2000000-0000-4000-8000-000000000001",
    sourceKind: "payroll_source_fact",
    unitLabel: "lần",
    unitRateVnd: 50_000,
    workDate: "2026-10-06",
    workedMinutes: null,
  },
  {
    amountVnd: 300_000,
    direction: "earning",
    lineType: "grading_bonus",
    note: "Tạm tính theo quỹ chấm bài tháng; thay đổi khi có thêm phiếu chấm.",
    policyCode: "grading_pool",
    sourceId: "grading-pool-2026-10",
    sourceKind: "grading_pool",
    unitLabel: "bài",
    unitRateVnd: null,
    workDate: MONTH,
    workedMinutes: null,
  },
  {
    amountVnd: 1_000_000,
    direction: "deduction",
    lineType: "advance_deduction",
    note: "Tạm ứng đã duyệt ngày 03/10.",
    policyCode: null,
    sourceId: "f3000000-0000-4000-8000-000000000001",
    sourceKind: "salary_advance",
    unitLabel: null,
    unitRateVnd: null,
    workDate: MONTH,
    workedMinutes: null,
  },
];

const tungStatement = statement({
  advanceDeductionsVnd: 1_000_000,
  payableVnd: 611_334,
  pendingVerificationCount: 1,
  staffDisplayName: "Trần Thanh Tùng",
  staffEmployeeCode: "NV07",
  staffId: staffIds.tung,
  totalDeductionsVnd: 1_000_000,
  totalEarningsVnd: 1_611_334,
  workHours: 16,
  workUnits: 7,
  workedMinutes: 1_006,
});

function ledgerEstimate(state: PayrollPreviewState): StaffPayrollEstimate {
  const empty = state === "empty";
  return {
    asOf: "2026-10-12T08:30:00Z",
    calculatedAt: "2026-10-12T08:30:00Z",
    completeness: "complete",
    issues: [],
    latestCompletedWorkAt: empty ? null : "2026-10-10T12:38:00Z",
    lines: empty ? [] : ledgerLines,
    month: MONTH,
    openShifts: [],
    recentShifts: [],
    shifts: empty ? [] : ledgerShifts,
    staffDisplayName: tungStatement.staffDisplayName,
    staffEmployeeCode: tungStatement.staffEmployeeCode,
    staffId: tungStatement.staffId,
    statement: empty
      ? { ...tungStatement, advanceDeductionsVnd: 0, payableVnd: 0, pendingVerificationCount: 0, totalDeductionsVnd: 0, totalEarningsVnd: 0, workHours: 0, workUnits: 0, workedMinutes: 0 }
      : tungStatement,
    status: "estimated",
  };
}

/* ------------------------------------------------------------- dashboard (8a) */

const ownerStatements: StaffEstimateStatement[] = [
  tungStatement,
  statement({ payableVnd: 4_680_000, pendingVerificationCount: 1, positionCode: "admissions_manager", staffDisplayName: "Hoàng Minh Khôi", staffEmployeeCode: "NV12", staffId: staffIds.khoi, totalEarningsVnd: 4_680_000, workHours: 26, workedMinutes: 1_560 }),
  statement({ payableVnd: 9_960_000, pendingVerificationCount: 3, positionCode: "operations_assistant", staffDisplayName: "Phạm Thu Hạnh", staffEmployeeCode: "NV03", staffId: staffIds.hanh, totalEarningsVnd: 9_960_000, workHours: 22, workedMinutes: 1_320 }),
  // Some of Lan's work dates have no daily rate: the rest is still calculated.
  statement({ advanceDeductionsVnd: 2_000_000, payableVnd: 1_060_000, pendingVerificationCount: 2, staffDisplayName: "Đỗ Mai Lan", staffEmployeeCode: "NV09", staffId: staffIds.lan, totalDeductionsVnd: 2_000_000, totalEarningsVnd: 3_060_000, workHours: 18, workedMinutes: 1_080 }),
  // No daily rate on any work date: nothing calculated yet.
  statement({ staffDisplayName: "Vũ Minh Đức", staffEmployeeCode: "NV11", staffId: staffIds.duc, workHours: 10, workedMinutes: 600 }),
  // Đặng Phương Thảo (no payroll position) has no statement, as in the RPC:
  // she appears only as a `missing_payroll_position` issue.
];

function ownerEstimate(state: PayrollPreviewState): OwnerPayrollEstimate {
  const base = {
    asOf: "2026-10-12T08:30:00Z",
    calculatedAt: "2026-10-12T08:30:00Z",
    month: MONTH,
    selectedPositionCode: null,
    status: "estimated" as const,
  };
  if (state === "empty") {
    return {
      ...base,
      byPosition: [],
      completeness: "complete",
      finance: { payrollRatioPercent: null, status: "available", tuitionNetVnd: 0, tuitionReceivedVnd: 0, tuitionRefundedVnd: 0 },
      issues: [],
      latestCompletedWorkAt: null,
      statements: [],
      summary: { advanceDeductionsVnd: 0, payableVnd: 0, pendingVerificationCount: 0, staffCount: 0, totalDeductionsVnd: 0, totalEarningsVnd: 0 },
    };
  }
  return {
    ...base,
    byPosition: [
      { payableVnd: 9_960_000, positionCode: "operations_assistant", staffCount: 1, totalDeductionsVnd: 0, totalEarningsVnd: 9_960_000 },
      { payableVnd: 4_680_000, positionCode: "admissions_manager", staffCount: 1, totalDeductionsVnd: 0, totalEarningsVnd: 4_680_000 },
      { payableVnd: 1_671_334, positionCode: "teaching_assistant", staffCount: 3, totalDeductionsVnd: 3_000_000, totalEarningsVnd: 4_671_334 },
    ],
    completeness: "partial",
    finance: { payrollRatioPercent: 17, status: "available", tuitionNetVnd: 96_000_000, tuitionReceivedVnd: 98_400_000, tuitionRefundedVnd: 2_400_000 },
    // Raised per work date, as get_owner_payroll_estimate does.
    issues: [
      { details: { work_date: "2026-10-06" }, issueCode: "missing_payroll_position", staffId: staffIds.thao },
      { details: { work_date: "2026-10-08" }, issueCode: "missing_payroll_position", staffId: staffIds.thao },
      { details: { work_date: "2026-10-03" }, issueCode: "missing_daily_rate", staffId: staffIds.duc },
      { details: { work_date: "2026-10-09" }, issueCode: "missing_daily_rate", staffId: staffIds.lan },
    ],
    latestCompletedWorkAt: "2026-10-12T07:55:00Z",
    statements: ownerStatements,
    summary: {
      advanceDeductionsVnd: 3_000_000,
      payableVnd: 16_311_334,
      pendingVerificationCount: 7,
      staffCount: 5,
      totalDeductionsVnd: 3_000_000,
      totalEarningsVnd: 19_311_334,
    },
  };
}

function periodStatement(index: number, month: string, staffId: string, staffDisplayName: string, staffEmployeeCode: string, positionCode: string, payableAmountVnd: number, periodStatus: string) {
  return {
    month,
    payableAmountVnd,
    payrollStatementId: `f6000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    periodStatus,
    positionCode,
    staffDisplayName,
    staffEmployeeCode,
    staffId,
    totalDeductionsVnd: 0,
    totalEarningsVnd: payableAmountVnd,
  };
}

/** Period statements through the real pure aggregation, as the RPC would feed it. */
function dashboardSource(state: PayrollPreviewState): PayrollDashboardSource {
  if (state === "empty") {
    return { composition: [], periods: [], positionOptions: [], selectedMonth: MONTH, selectedPositionCode: null, statements: [] };
  }
  const september = "2026-09-01";
  return {
    composition: [
      { amountVnd: 14_100_000, direction: "earning", lineType: "base_offline", month: MONTH },
      { amountVnd: 1_200_000, direction: "earning", lineType: "base_online", month: MONTH },
      { amountVnd: 6_400_000, direction: "earning", lineType: "center_renewal_duty_bonus", month: MONTH },
      { amountVnd: 900_000, direction: "earning", lineType: "grading_bonus", month: MONTH },
      { amountVnd: 3_000_000, direction: "deduction", lineType: "advance_deduction", month: MONTH },
    ],
    periods: [
      { month: MONTH, status: "draft" },
      { month: september, status: "review" },
      { month: "2026-08-01", status: "approved" },
    ],
    positionOptions: [{ code: "teaching_assistant" }, { code: "operations_assistant" }, { code: "admissions_manager" }],
    selectedMonth: MONTH,
    selectedPositionCode: null,
    statements: [
      periodStatement(1, MONTH, staffIds.hanh, "Phạm Thu Hạnh", "NV03", "operations_assistant", 9_960_000, "draft"),
      periodStatement(2, MONTH, staffIds.khoi, "Hoàng Minh Khôi", "NV12", "admissions_manager", 4_680_000, "draft"),
      periodStatement(3, MONTH, staffIds.tung, "Trần Thanh Tùng", "NV07", "teaching_assistant", 3_200_000, "draft"),
      periodStatement(4, MONTH, staffIds.lan, "Đỗ Mai Lan", "NV09", "teaching_assistant", 1_760_000, "draft"),
      periodStatement(5, september, staffIds.hanh, "Phạm Thu Hạnh", "NV03", "operations_assistant", 9_400_000, "review"),
      periodStatement(6, september, staffIds.khoi, "Hoàng Minh Khôi", "NV12", "admissions_manager", 5_100_000, "review"),
      periodStatement(7, september, staffIds.tung, "Trần Thanh Tùng", "NV07", "teaching_assistant", 3_112_000, "review"),
    ],
  };
}

/* ------------------------------------------------------------------- transport */

function staffIdFrom(endpoint: string): string | null {
  return new URL(endpoint, "http://preview.local").searchParams.get("staffId");
}

function createPreviewTransport(state: PayrollPreviewState): PayrollEstimateTransport {
  return {
    load: async (endpoint) => {
      if (state === "errors") throw new Error(STUB);
      if (endpoint.startsWith("/api/payroll/owner-estimate")) return ownerEstimate(state);
      // Every staff row opens the same sample ledger, relabelled by the dialog header.
      const ledger = ledgerEstimate(state);
      return { ...ledger, staffId: staffIdFrom(endpoint) ?? ledger.staffId };
    },
    subscribe: () => () => {},
  };
}

/**
 * Inert stand-ins for the live estimate: fixtures instead of `/api/payroll/*`
 * and no Supabase realtime channel (the preview runs on localhost where
 * .env.local may point at production). One stable object per state so the
 * hook's effect does not resubscribe on every render.
 */
export const previewPayrollTransports: Record<PayrollPreviewState, PayrollEstimateTransport> = {
  empty: createPreviewTransport("empty"),
  errors: createPreviewTransport("errors"),
  normal: createPreviewTransport("normal"),
};

/* --------------------------------------------------------------- payslip (8b) */

function payslipLine(id: string, lineType: string, label: string, amountVnd: number, direction: "earning" | "deduction" = "earning", note: string | null = null) {
  return {
    amountFormatted: formatCurrency(amountVnd),
    amountVnd,
    direction,
    formulaExplanation: null,
    id,
    label,
    lineType,
    note,
    quantity: null,
    unitLabel: null,
    unitRateFormatted: null,
    unitRateVnd: null,
  };
}

function payslipData(state: PayrollPreviewState): PayslipDocumentData {
  const empty = state === "empty";
  const earnings = empty
    ? []
    : [
        payslipLine("p1", "base_offline", "Lương công offline", 4_160_000),
        payslipLine("p2", "base_online", "Lương công online", 440_000),
        payslipLine("p3", "teaching_allowance", "Phụ cấp trợ giảng", 350_000),
        payslipLine("p4", "grading_bonus", "Thưởng chấm bài", 300_000),
        payslipLine("p5", "new_student_fixed_bonus", "Thưởng tuyển sinh theo nguồn", 300_000),
      ];
  const adjustments = empty
    ? []
    : [
        payslipLine("p7", "manual_reward", "Điều chỉnh tăng", 120_000, "earning", "Phụ cấp ăn tối 3 ngày làm thông ca × 40.000"),
        payslipLine("p8", "manual_deduction", "Điều chỉnh giảm", 50_000, "deduction", "Trừ phần thưởng chấm bài tính trùng ngày 20/09"),
      ];
  const deductions = empty ? [] : [payslipLine("p6", "advance_deduction", "Khấu trừ tạm ứng", 2_000_000, "deduction")];
  const gross = empty ? 0 : 5_620_000;
  const totalDeductions = empty ? 0 : 2_000_000;
  const net = gross - totalDeductions;

  return {
    breakdowns: empty
      ? { commissions: [], grading: null, workHours: [] }
      : {
          commissions: [{ basisRevenueFormatted: "4.800.000 VND", basisRevenueVnd: 4_800_000, gradeLabel: "Nguồn MMA", ratePercentage: "6,25%", subtotalFormatted: "300.000 VND", subtotalVnd: 300_000 }],
          grading: { creditsCount: 120, explanation: "120/410 phiếu của quỹ 1.025.000 VND", poolAmountFormatted: "1.025.000 VND", subtotalFormatted: "300.000 VND", subtotalVnd: 300_000 },
          workHours: [
            { dailyRateFormatted: "720.000 VND", dailyRateVnd: 720_000, factorText: null, mode: "offline", modeLabel: "Lương công offline", subtotalFormatted: "4.160.000 VND", subtotalVnd: 4_160_000, workHoursFormatted: "52 giờ", workMinutes: 3_120 },
            { dailyRateFormatted: "720.000 VND", dailyRateVnd: 720_000, factorText: "50%", mode: "online", modeLabel: "Lương công online", subtotalFormatted: "440.000 VND", subtotalVnd: 440_000, workHoursFormatted: "5 giờ 30 phút", workMinutes: 330 },
          ],
        },
    adjustments,
    deductions,
    earnings,
    employee: {
      avatarUrl: null,
      bankAccount: { accountHolderName: "TRAN THANH TUNG", accountNumberMasked: "•••• •••• 2291", bankName: "Techcombank" },
      department: null,
      displayName: "Trần Thanh Tùng",
      employeeCode: "NV07",
      joinedAt: null,
      positionLabel: "Trợ giảng",
      staffId: staffIds.tung,
    },
    isStale: false,
    period: {
      currentRevision: 3,
      feedbackClosedAt: empty ? null : "2026-10-02T10:00:00Z",
      feedbackOpenedAt: "2026-10-01T02:00:00Z",
      id: "f4000000-0000-4000-8000-000000000009",
      lastCalculatedAt: "2026-10-02T09:12:00Z",
      payDate: "2026-10-05",
      payDateFormatted: "05/10/2026",
      periodEndDate: "30/09/2026",
      periodMonth: "2026-09-01",
      periodMonthFormatted: "THÁNG 09/2026",
      periodStartDate: "01/09/2026",
      status: empty ? "draft" : "approved",
      statusLabel: empty ? "Bản nháp" : "Đã duyệt & khóa",
    },
    piecework: null,
    statementId: "f5000000-0000-4000-8000-000000000007",
    totals: {
      amountInWords: formatVietnameseCurrencyWords(net),
      grossFormatted: formatCurrency(gross),
      grossVnd: gross,
      netFormatted: formatCurrency(net),
      netVnd: net,
      totalDeductionsFormatted: formatCurrency(totalDeductions),
      totalDeductionsVnd: totalDeductions,
      workHours: empty ? 0 : 57,
      workMinutes: empty ? 0 : 3_450,
      workUnits: empty ? 0 : 26,
    },
  };
}

/**
 * An operations assistant on lương cứng + lương khoán (fictional figures):
 * lương cứng 2.600.000, lương khoán 2.700.000 above the 85% floor (2.210.000),
 * so 490.000 is added; two manager corrections with their notes; one advance.
 */
function pieceworkPayslipData(): PayslipDocumentData {
  const base = payslipData("normal");
  const income = 3_200_000;
  const totalDeductions = 500_000;
  const net = income - totalDeductions;
  return {
    ...base,
    adjustments: [
      payslipLine("k6", "manual_reward", "Điều chỉnh tăng", 150_000, "earning", "Phụ cấp điện thoại 10 ca × 15.000"),
      payslipLine("k7", "manual_deduction", "Điều chỉnh giảm", 40_000, "deduction", "Trả lại phần công online tính nhầm thành offline"),
    ],
    breakdowns: {
      commissions: [],
      grading: null,
      workHours: [
        { dailyRateFormatted: "720.000 VND", dailyRateVnd: 720_000, factorText: null, mode: "offline", modeLabel: "Lương công offline", subtotalFormatted: "2.400.000 VND", subtotalVnd: 2_400_000, workHoursFormatted: "30 giờ", workMinutes: 1_800 },
        { dailyRateFormatted: "720.000 VND", dailyRateVnd: 720_000, factorText: "50%", mode: "online", modeLabel: "Lương công online", subtotalFormatted: "200.000 VND", subtotalVnd: 200_000, workHoursFormatted: "5 giờ", workMinutes: 300 },
      ],
    },
    deductions: [payslipLine("k8", "advance_deduction", "Khấu trừ tạm ứng", 500_000, "deduction")],
    earnings: [
      payslipLine("k1", "base_offline", "Lương công offline", 2_400_000),
      payslipLine("k2", "base_online", "Lương công online", 200_000),
      payslipLine("k3", "operations_grade_renewal_bonus", "Thưởng tái phí khối phụ trách", 1_500_000),
      payslipLine("k4", "center_renewal_duty_bonus", "Thưởng quản lý và trực tin nhắn", 900_000),
      payslipLine("k5", "payroll_processing_bonus", "Thưởng tính lương nhân sự", 300_000),
    ],
    employee: { ...base.employee, bankAccount: null, displayName: "Phạm Thu Hạnh", employeeCode: "NV03", positionLabel: "Trợ lý vận hành", staffId: staffIds.hanh },
    piecework: { absorbedVnd: 2_210_000, addedVnd: 490_000, baseSalaryVnd: 2_600_000, earnedVnd: 2_700_000, floorBasisPoints: 8_500, thresholdVnd: 2_210_000 },
    totals: {
      ...base.totals,
      amountInWords: formatVietnameseCurrencyWords(net),
      grossFormatted: formatCurrency(income),
      grossVnd: income,
      netFormatted: formatCurrency(net),
      netVnd: net,
      totalDeductionsFormatted: formatCurrency(totalDeductions),
      totalDeductionsVnd: totalDeductions,
      workHours: 35,
      workMinutes: 2_100,
      workUnits: 3,
    },
  };
}

/* ----------------------------------------------------------------------- page */

export function PayrollPreview({
  role,
  state,
  view,
}: {
  role: PayrollPreviewRole;
  state: PayrollPreviewState;
  view: PayrollPreviewView;
}) {
  const permissions = role === "owner" ? DATABASE_PERMISSION_CODES : role === "accountant" ? accountantPermissions : staffPermissions;
  const previewPathname = view === "dashboard" || (view === "ledger" && role === "owner") ? "/payroll/dashboard" : "/payroll";
  const displayName = role === "owner" ? "Nguyễn Văn Vinh" : role === "accountant" ? "Nguyễn Thu Hằng" : "Trần Thanh Tùng";

  return (
    <AppShell
      authUser={{ displayName, email: "preview@example.com", id: "dev-user", initials: displayName.split(" ").map((part) => part[0]).slice(-2).join("") }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname={previewPathname}
      unreadNotificationCount={2}
    >
      {view === "dashboard" ? <DashboardView permissions={permissions} state={state} /> : null}
      {view === "ledger" ? <LedgerView role={role} state={state} /> : null}
      {view === "payslip" ? <PayslipView state={state} /> : null}
      {view === "payslip-piecework" ? <PayslipView piecework state={state} /> : null}
    </AppShell>
  );
}

function DashboardView({ permissions, state }: { permissions: readonly PermissionCode[]; state: PayrollPreviewState }) {
  if (!permissions.includes("payroll.dashboard.view")) {
    return <PermissionDeniedState description="Dashboard tổng quan quỹ lương chỉ dành cho Chủ trung tâm." title="Không có quyền xem Dashboard lương" />;
  }

  return (
    <OwnerPayrollDashboardPage
      canApprove={permissions.includes("payroll.owner_approve")}
      dashboard={buildPayrollDashboardData(dashboardSource(state))}
      estimateTransport={previewPayrollTransports[state]}
      initialOwnerEstimate={state === "errors" ? null : ownerEstimate(state)}
      today={TODAY}
    />
  );
}

function LedgerView({ role, state }: { role: PayrollPreviewRole; state: PayrollPreviewState }) {
  const isOwner = role === "owner";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <StaffPayrollLedger
        estimate={state === "errors" ? null : ledgerEstimate(state)}
        loadState={state === "errors" ? "error" : "ready"}
        month={MONTH}
        onRetry={() => {}}
        showProfileLink={isOwner}
        target={{
          positionLabel: "Trợ giảng",
          staffDisplayName: tungStatement.staffDisplayName,
          staffEmployeeCode: tungStatement.staffEmployeeCode,
          staffId: tungStatement.staffId,
        }}
        titleId="preview-ledger-title"
        today={TODAY}
        variant="page"
      />
    </div>
  );
}

function PayslipView({ piecework = false, state }: { piecework?: boolean; state: PayrollPreviewState }) {
  if (state === "errors") {
    return <ErrorState description="Không tìm thấy phiếu lương của nhân sự." title="Không tải được phiếu lương" />;
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-canvas">
      <PayslipToolbar
        pdfDownloadUrl="/payroll/preview/statements/preview/payslip/pdf"
        pdfUnavailableReason="Bản xem trước không tạo PDF."
      />
      <div className="p-4 sm:p-6">
        <PayslipDocument data={piecework && state === "normal" ? pieceworkPayslipData() : payslipData(state)} />
      </div>
    </div>
  );
}
