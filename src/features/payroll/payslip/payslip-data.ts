import "server-only";

import { getCurrentAuthUser } from "@/features/auth/current-user";
import { getPayrollStatementDetailsResult } from "@/features/payroll/data";
import {
  formatCurrency,
  formatWorkMinutes,
  getLineFormulaSummary,
  getLineNote,
  getLineTypeLabel,
} from "@/features/payroll/payroll-presentation";
import type {
  CommissionDetail,
  GradingDetail,
  PayslipBankAccountInfo,
  PayslipDocumentData,
  PayslipLineItem,
  PayslipResult,
  WorkHoursDetail,
} from "@/features/payroll/payslip/types";
import { formatVietnameseCurrencyWords } from "@/features/payroll/payslip/vietnamese-currency-words";
import {
  getPayslipDisplayTotals,
  isNettedIntoIncome,
  manualAdjustmentLineTypes,
  PIECEWORK_MISMATCH_MESSAGE,
  summarizePiecework,
} from "@/features/payroll/payslip-sections";
import {
  getUnreconciledReadMessage,
  type PayrollLineRead,
  type PayrollStatementRead,
} from "@/features/payroll/read-models";
import {
  payrollPositionLabels,
  type PayrollPositionCode,
} from "@/features/staff/payroll-profile-types";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeFormatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const trimmed = value.trim();
    if (!trimmed) return "—";
    const d = trimmed.includes("T") ? new Date(trimmed) : new Date(`${trimmed}T00:00:00`);
    if (Number.isNaN(d.getTime())) return trimmed;
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return value;
  }
}

function getMonthDates(periodMonth: string): {
  endDateFormatted: string;
  startDateFormatted: string;
} {
  try {
    const [yearStr, monthStr] = (periodMonth || "").split("-");
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    if (Number.isNaN(year) || Number.isNaN(month)) {
      return {
        endDateFormatted: "—",
        startDateFormatted: "—",
      };
    }
    const paddedMonth = String(month).padStart(2, "0");

    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const paddedLastDay = String(lastDay).padStart(2, "0");

    return {
      endDateFormatted: `${paddedLastDay}/${paddedMonth}/${year}`,
      startDateFormatted: `01/${paddedMonth}/${year}`,
    };
  } catch {
    return {
      endDateFormatted: "—",
      startDateFormatted: "—",
    };
  }
}

function formatPeriodMonthHeader(periodMonth: string): string {
  try {
    const [yearStr, monthStr] = (periodMonth || "").split("-");
    const year = yearStr || "----";
    const paddedMonth = (monthStr || "").slice(0, 2).padStart(2, "0");
    return `THÁNG ${paddedMonth}/${year}`;
  } catch {
    return "KỲ LƯƠNG";
  }
}

function getPeriodStatusLabel(status: string): string {
  const map: Record<string, string> = {
    approved: "Đã duyệt & khóa",
    draft: "Bản nháp",
    review: "Chờ đối soát",
  };
  return map[status] ?? status;
}

function maskAccountNumber(accountNumber: string): string {
  const trimmed = accountNumber.trim();
  if (trimmed.length <= 4) return trimmed;
  const last4 = trimmed.slice(-4);
  return `•••• •••• ${last4}`;
}

function extractWorkHoursBreakdown(
  lines: readonly PayrollLineRead[],
): readonly WorkHoursDetail[] {
  const details: WorkHoursDetail[] = [];

  for (const line of lines) {
    if (
      line.lineType !== "base_offline" &&
      line.lineType !== "base_online" &&
      line.lineType !== "hourly_wage"
    ) {
      continue;
    }

    const formula = line.formulaSnapshot;
    const workedMinutes =
      (typeof formula.worked_minutes === "number" ? formula.worked_minutes : null) ??
      line.workMinutes ??
      0;
    const dailyRate =
      (typeof formula.daily_rate_vnd === "number" ? formula.daily_rate_vnd : null) ??
      line.unitRateVnd ??
      0;
    const modeBasisPoints =
      typeof formula.mode_basis_points === "number" ? formula.mode_basis_points : null;

    let mode: WorkHoursDetail["mode"] = "general";
    let modeLabel = "Công làm việc";

    if (line.lineType === "base_offline") {
      mode = "offline";
      modeLabel = "Lương công offline";
    } else if (line.lineType === "base_online") {
      mode = "online";
      modeLabel = "Lương công online";
    } else if (line.lineType === "hourly_wage") {
      mode = "general";
      modeLabel = "Lương theo giờ";
    }

    let factorText: string | null = null;
    if (modeBasisPoints !== null && modeBasisPoints !== 10_000) {
      factorText = `Hệ số ${modeBasisPoints / 100}%`;
    }

    details.push({
      dailyRateFormatted: formatCurrency(dailyRate),
      dailyRateVnd: dailyRate,
      factorText,
      mode,
      modeLabel,
      subtotalFormatted: formatCurrency(line.amountVnd),
      subtotalVnd: line.amountVnd,
      workHoursFormatted: formatWorkMinutes(workedMinutes),
      workMinutes: workedMinutes,
    });
  }

  return details;
}

function extractGradingBreakdown(
  lines: readonly PayrollLineRead[],
): GradingDetail | null {
  const gradingLine = lines.find((line) => line.lineType === "grading_bonus");
  if (!gradingLine) return null;

  const formula = gradingLine.formulaSnapshot;
  const staffCredits =
    (typeof formula.staff_credits === "number" ? formula.staff_credits : null) ??
    gradingLine.quantity ??
    gradingLine.unitCount ??
    0;
  const totalCredits =
    typeof formula.total_credits === "number" ? formula.total_credits : null;
  const monthlyPool =
    typeof formula.monthly_pool_vnd === "number" ? formula.monthly_pool_vnd : null;

  let explanation = "";
  if (staffCredits && totalCredits && monthlyPool) {
    explanation = `${new Intl.NumberFormat("vi-VN").format(staffCredits)} phiếu / ${new Intl.NumberFormat("vi-VN").format(totalCredits)} phiếu × ${formatCurrency(monthlyPool)}`;
  } else if (gradingLine.unitRateVnd && staffCredits) {
    explanation = `${new Intl.NumberFormat("vi-VN").format(staffCredits)} phiếu × ${formatCurrency(gradingLine.unitRateVnd)}`;
  } else {
    explanation = gradingLine.note ?? "Thưởng chấm bài theo kỳ";
  }

  return {
    creditsCount: staffCredits,
    explanation,
    poolAmountFormatted: monthlyPool ? formatCurrency(monthlyPool) : null,
    subtotalFormatted: formatCurrency(gradingLine.amountVnd),
    subtotalVnd: gradingLine.amountVnd,
  };
}

function extractCommissionBreakdowns(
  lines: readonly PayrollLineRead[],
): readonly CommissionDetail[] {
  const details: CommissionDetail[] = [];

  for (const line of lines) {
    const isCommissionType =
      line.lineType === "operations_grade_renewal_bonus" ||
      line.lineType === "admissions_revenue_tier_bonus" ||
      line.lineType === "revenue_bonus" ||
      line.lineType === "new_student_revenue_bonus" ||
      line.lineType === "record_excess_bonus";

    if (!isCommissionType) continue;

    const formula = line.formulaSnapshot;
    const evidence = line.evidenceSnapshot;

    const revenue =
      (typeof formula.revenue_vnd === "number" ? formula.revenue_vnd : null) ??
      (typeof evidence.order_value_vnd === "number" ? evidence.order_value_vnd : null) ??
      (typeof evidence.center_renewal_revenue_vnd === "number" ? evidence.center_renewal_revenue_vnd : null) ??
      0;

    const rateBasisPoints =
      (typeof formula.rate_basis_points === "number" ? formula.rate_basis_points : null) ??
      (typeof formula.revenue_rate_basis_points === "number" ? formula.revenue_rate_basis_points : null) ??
      0;

    const grade =
      typeof evidence.grade === "number" ? `Khối ${evidence.grade}` : null;

    if (revenue > 0 || rateBasisPoints > 0) {
      details.push({
        basisRevenueFormatted: formatCurrency(revenue),
        basisRevenueVnd: revenue,
        gradeLabel: grade,
        ratePercentage: `${rateBasisPoints / 100}%`,
        subtotalFormatted: formatCurrency(line.amountVnd),
        subtotalVnd: line.amountVnd,
      });
    }
  }

  return details;
}

function normalizePayslipLine(line: PayrollLineRead): PayslipLineItem {
  return {
    amountFormatted: formatCurrency(line.amountVnd),
    amountVnd: line.amountVnd,
    direction: line.direction === "deduction" ? "deduction" : "earning",
    formulaExplanation: getLineFormulaSummary(line),
    id: line.id,
    label: getLineTypeLabel(line.lineType),
    lineType: line.lineType,
    note: getLineNote(line),
    quantity: line.quantity ?? line.unitCount,
    unitLabel: line.unitLabel,
    unitRateFormatted: line.unitRateVnd ? formatCurrency(line.unitRateVnd) : null,
    unitRateVnd: line.unitRateVnd,
  };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getPayslipDocumentData(
  payrollPeriodId: string,
  payrollStatementId: string,
): Promise<PayslipResult> {
  const idsAreUuids = uuidPattern.test(payrollPeriodId) && uuidPattern.test(payrollStatementId);
  // The read enforces payroll.view and own-statement visibility itself, so it
  // starts with the session checks instead of after them (one round trip).
  const [permissionsResult, authUserResult, detailsResult] = await Promise.all([
    getCachedDatabasePermissions(),
    getCurrentAuthUser(),
    idsAreUuids ? getPayrollStatementDetailsResult(payrollPeriodId, payrollStatementId) : null,
  ]);

  if (!permissionsResult.ok || !authUserResult.ok) {
    return {
      error: "NOT_AUTHENTICATED",
      message: "Yêu cầu đăng nhập để truy cập phiếu lương.",
      ok: false,
    };
  }

  if (!permissionsResult.permissions.includes("payroll.view")) {
    return {
      error: "PERMISSION_DENIED",
      message: "Tài khoản hiện tại không có quyền xem phiếu lương.",
      ok: false,
    };
  }

  const canManage =
    permissionsResult.permissions.includes("payroll.manage") ||
    permissionsResult.permissions.includes("payroll.accountant_reconcile") ||
    permissionsResult.permissions.includes("payroll.owner_approve");

  // A link that is not a uuid cannot name a period or statement; the uuid-typed
  // read would fail as if the system were down.
  if (!detailsResult) {
    return uuidPattern.test(payrollPeriodId)
      ? {
          error: "STATEMENT_NOT_FOUND",
          message: "Không tìm thấy phiếu lương của nhân sự trong kỳ này.",
          ok: false,
        }
      : {
          error: "PERIOD_NOT_FOUND",
          message: "Không tìm thấy kỳ lương yêu cầu.",
          ok: false,
        };
  }

  // Only this statement's lines, read in one snapshot and checked against its totals.
  if (!detailsResult.ok) {
    return detailsResult.reason === "unreconciled"
      ? {
          error: "STATEMENT_CALCULATION_MISMATCH",
          message: getUnreconciledReadMessage(permissionsResult.permissions.includes("payroll.manage")),
          ok: false,
        }
      : {
          error: "PERIOD_NOT_FOUND",
          message: "Không tải được phiếu lương từ hệ thống.",
          ok: false,
        };
  }

  const period = detailsResult.data.periods.find((p) => p.id === payrollPeriodId);
  if (!period) {
    return {
      error: "PERIOD_NOT_FOUND",
      message: "Không tìm thấy kỳ lương yêu cầu.",
      ok: false,
    };
  }

  // Find statement in the CURRENT calculation run of this period
  const currentStatement: PayrollStatementRead | undefined =
    period.statements.find((s) => s.id === payrollStatementId);

  if (!currentStatement) {
    // The reader reports a statement from an older calculation run, with the
    // same staff member's current statement in this period when there is one.
    const staleStatement = detailsResult.data.staleStatement;
    if (staleStatement) {
      return {
        error: "STATEMENT_STALE",
        message:
          "Phiếu lương này thuộc phiên bản tính cũ và không còn là phiên bản hiện tại.",
        ok: false,
        suggestedCurrentStatementId: staleStatement.currentStatementId ?? undefined,
      };
    }

    return {
      error: "STATEMENT_NOT_FOUND",
      message: "Không tìm thấy phiếu lương của nhân sự trong kỳ này.",
      ok: false,
    };
  }

  // Authorization check: Non-managers can ONLY see their own payslip
  if (!canManage && currentStatement.staffId !== authUserResult.user.id) {
    return {
      error: "PERMISSION_DENIED",
      message: "Bạn không có quyền xem phiếu lương của nhân sự khác.",
      ok: false,
    };
  }

  // Fetch optional profile, position, and masked bank info from DB
  let avatarUrl: string | null = null;
  let positionLabel = "Nhân sự trung tâm";
  let bankAccount: PayslipBankAccountInfo | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const [profileRes, positionRes, bankRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("avatar_url, display_name")
        .eq("id", currentStatement.staffId)
        .maybeSingle(),
      supabase
        .from("staff_payroll_position_versions")
        .select("position_code")
        .eq("staff_id", currentStatement.staffId)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("staff_bank_account_versions")
        .select("account_holder_name, account_number, bank_name")
        .eq("staff_id", currentStatement.staffId)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileRes.data?.avatar_url) {
      avatarUrl = profileRes.data.avatar_url;
    }

    if (positionRes.data?.position_code) {
      const posCode = positionRes.data.position_code as PayrollPositionCode;
      positionLabel =
        payrollPositionLabels[posCode] ?? positionRes.data.position_code;
    }

    if (bankRes.data?.account_number && bankRes.data.bank_name) {
      bankAccount = {
        accountHolderName: bankRes.data.account_holder_name,
        accountNumberMasked: maskAccountNumber(bankRes.data.account_number),
        bankName: bankRes.data.bank_name,
      };
    }
  } catch {
    // Graceful fallback to statement snapshot values
  }

  // Manual adjustments and the piecework offset are not deductions to staff;
  // see payslip-sections.ts.
  const earningLines = currentStatement.lines
    .filter((l) => l.direction === "earning" && !manualAdjustmentLineTypes.has(l.lineType))
    .map(normalizePayslipLine);

  const adjustmentLines = currentStatement.lines
    .filter((l) => manualAdjustmentLineTypes.has(l.lineType))
    .map(normalizePayslipLine);

  const deductionLines = currentStatement.lines
    .filter((l) => l.direction === "deduction" && !isNettedIntoIncome(l))
    .map(normalizePayslipLine);

  const displayTotals = getPayslipDisplayTotals(currentStatement);
  // A printed payslip never shows lương khoán below the part already paid in lương cứng.
  const piecework = summarizePiecework(currentStatement.lines);
  if (piecework?.kind === "mismatch") {
    return { error: "STATEMENT_CALCULATION_MISMATCH", message: PIECEWORK_MISMATCH_MESSAGE, ok: false };
  }

  const workHoursBreakdown = extractWorkHoursBreakdown(currentStatement.lines);
  const gradingBreakdown = extractGradingBreakdown(currentStatement.lines);
  const commissionBreakdowns = extractCommissionBreakdowns(currentStatement.lines);

  const { startDateFormatted, endDateFormatted } = getMonthDates(
    period.periodMonth,
  );

  const monthYearLabel = formatPeriodMonthHeader(period.periodMonth);

  const data: PayslipDocumentData = {
    breakdowns: {
      commissions: commissionBreakdowns,
      grading: gradingBreakdown,
      workHours: workHoursBreakdown,
    },
    adjustments: adjustmentLines,
    deductions: deductionLines,
    earnings: earningLines,
    employee: {
      avatarUrl,
      bankAccount,
      department: null,
      displayName: currentStatement.staffDisplayName,
      employeeCode: currentStatement.staffEmployeeCode,
      joinedAt: null,
      positionLabel,
      staffId: currentStatement.staffId,
    },
    isStale: false,
    period: {
      currentRevision: period.currentRevision,
      feedbackClosedAt: period.feedbackClosedAt,
      feedbackOpenedAt: period.feedbackOpenedAt,
      id: period.id,
      lastCalculatedAt: period.lastCalculatedAt,
      payDate: period.payDate,
      payDateFormatted: safeFormatDate(period.payDate),
      periodEndDate: endDateFormatted,
      periodMonth: period.periodMonth,
      periodMonthFormatted: monthYearLabel,
      periodStartDate: startDateFormatted,
      status: period.status,
      statusLabel: getPeriodStatusLabel(period.status),
    },
    piecework,
    statementId: currentStatement.id,
    totals: {
      amountInWords: formatVietnameseCurrencyWords(
        currentStatement.payableAmountVnd,
      ),
      grossFormatted: formatCurrency(displayTotals.incomeVnd),
      grossVnd: displayTotals.incomeVnd,
      netFormatted: formatCurrency(currentStatement.payableAmountVnd),
      netVnd: currentStatement.payableAmountVnd,
      totalDeductionsFormatted: formatCurrency(displayTotals.deductionsVnd),
      totalDeductionsVnd: displayTotals.deductionsVnd,
      workHours: currentStatement.workHours,
      workMinutes: currentStatement.workMinutes,
      workUnits: currentStatement.workUnits,
    },
  };

  // Optional audit logging
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from("audit_logs").insert({
      action: "payslip_viewed",
      actor_user_id: authUserResult.user.id,
      entity_id: currentStatement.id,
      entity_type: "payroll_statement",
      metadata: {
        pay_date: period.payDate,
        period_month: period.periodMonth,
        staff_id: currentStatement.staffId,
      },
      module: "payroll",
    });
  } catch {
    // Non-blocking audit log
  }

  return {
    data,
    ok: true,
  };
}

export function getPayslipPdfFilename(data: PayslipDocumentData): string {
  const code =
    data.employee.employeeCode ||
    data.employee.staffId.slice(0, 8);
  const periodMonthParts = data.period.periodMonth.slice(0, 7); // "2026-07"
  return `Phieu-luong-${code}-${periodMonthParts}.pdf`;
}
