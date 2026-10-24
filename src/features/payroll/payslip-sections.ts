import { attendanceLineTypes, PIECEWORK_OFFSET } from "@/features/payroll/payroll-line-groups";
import { formatCurrency, formatPercentage, getFloorBasisPoints, getNumber } from "@/features/payroll/payroll-presentation";

/**
 * How a payslip reads to staff. Presentation only: sorts and sums stored
 * lines, never recalculates pay.
 *
 * Two kinds of stored "deduction" lines are not money taken from the staff
 * member, so they stay out of "Khấu trừ" (which keeps real deductions such as
 * salary advances):
 * - piecework_offset: the part of lương khoán already paid inside lương cứng
 *   (khối vận hành / tuyển sinh are paid lương cứng + lương khoán above the
 *   floor). It is shown inside a "Lương khoán" block next to the bonuses it
 *   offsets.
 * - manual_deduction: a correction the manager entered, shown with the manual
 *   rewards under "Điều chỉnh".
 */

interface DisplayLine {
  amountVnd: number;
  direction: string;
  formulaSnapshot?: Record<string, unknown>;
  lineType: string;
}

export type PayslipSectionKey = "attendance" | "grading" | "piecework" | "earnings" | "manual" | "deductions";

export const manualAdjustmentLineTypes = new Set(["manual_reward", "manual_deduction"]);


export function signedAmount(line: DisplayLine): number {
  return line.direction === "deduction" ? -line.amountVnd : line.amountVnd;
}

/** Bonus lines the engine counts as lương khoán: every earning except attendance pay and manual adjustments. */
function isPieceworkEarning(line: DisplayLine): boolean {
  return line.direction === "earning" && !attendanceLineTypes.has(line.lineType) && !manualAdjustmentLineTypes.has(line.lineType);
}

/** A stored deduction that is not money taken from the staff member: the offset or a manual decrease. */
export function isNettedIntoIncome(line: Pick<DisplayLine, "direction" | "lineType">): boolean {
  return line.direction === "deduction" && (line.lineType === PIECEWORK_OFFSET || manualAdjustmentLineTypes.has(line.lineType));
}

/** Only real deductions (advances) are red; the offset is muted and a manual decrease stays neutral. */
export function getAmountClassName(line: Pick<DisplayLine, "direction" | "lineType">): string {
  if (line.direction !== "deduction") return "text-text-strong";
  if (line.lineType === PIECEWORK_OFFSET) return "text-text-muted";
  if (manualAdjustmentLineTypes.has(line.lineType)) return "text-text-default";
  return "text-danger";
}

export function getPayslipSection(line: DisplayLine, withPiecework: boolean): PayslipSectionKey {
  if (line.lineType === PIECEWORK_OFFSET) return "piecework";
  if (manualAdjustmentLineTypes.has(line.lineType)) return "manual";
  if (line.direction === "deduction") return "deductions";
  if (attendanceLineTypes.has(line.lineType)) return "attendance";
  if (withPiecework && isPieceworkEarning(line)) return "piecework";
  if (line.lineType === "grading_bonus") return "grading";
  return "earnings";
}

export interface PieceworkSummary {
  /** Phần lương khoán đã nằm trong lương cứng (the stored offset). */
  absorbedVnd: number;
  /** Phần lương khoán được cộng thêm vào thu nhập. */
  addedVnd: number;
  baseSalaryVnd: number | null;
  /** Lương khoán đạt được trong kỳ. */
  earnedVnd: number;
  floorBasisPoints: number | null;
  thresholdVnd: number | null;
}

export function summarizePiecework(lines: readonly DisplayLine[]): PieceworkSummary | null {
  const offsetLines = lines.filter((line) => line.lineType === PIECEWORK_OFFSET);
  if (offsetLines.length === 0) return null;
  const earnedVnd = lines.filter(isPieceworkEarning).reduce((sum, line) => sum + line.amountVnd, 0);
  const absorbedVnd = offsetLines.reduce((sum, line) => sum + line.amountVnd, 0);
  const snapshot = offsetLines[0].formulaSnapshot;
  const baseSalaryVnd = getNumber(snapshot, "base_salary_vnd");
  const floorBasisPoints = getFloorBasisPoints(snapshot);
  return {
    absorbedVnd,
    addedVnd: earnedVnd - absorbedVnd,
    baseSalaryVnd,
    earnedVnd,
    floorBasisPoints,
    thresholdVnd: baseSalaryVnd !== null && floorBasisPoints !== null ? Math.round((baseSalaryVnd * floorBasisPoints) / 10_000) : null,
  };
}

export interface PayslipDisplayTotals {
  deductionsVnd: number;
  incomeVnd: number;
}

/**
 * "Tổng thu nhập − Khấu trừ = Thực nhận", with the offset and manual deductions
 * netted into income, so income − deductions still equals the stored payable.
 */
export function getPayslipDisplayTotals(statement: {
  lines: readonly DisplayLine[];
  totalDeductionsVnd: number;
  totalEarningsVnd: number;
}): PayslipDisplayTotals {
  const netted = statement.lines.filter(isNettedIntoIncome).reduce((sum, line) => sum + line.amountVnd, 0);
  return {
    deductionsVnd: statement.totalDeductionsVnd - netted,
    incomeVnd: statement.totalEarningsVnd - netted,
  };
}

export const PIECEWORK_RULE = "Lương = lương cứng + phần lương khoán vượt ngưỡng lương cứng.";

export function getPieceworkExplanation(summary: PieceworkSummary): string {
  const floor = summary.floorBasisPoints !== null ? formatPercentage(summary.floorBasisPoints) : null;
  const threshold = summary.thresholdVnd !== null && summary.baseSalaryVnd !== null && floor !== null
    ? `${floor} lương cứng (${formatCurrency(summary.baseSalaryVnd)} × ${floor} = ${formatCurrency(summary.thresholdVnd)})`
    : "ngưỡng lương cứng của chính sách";
  if (summary.addedVnd > 0) {
    return `Lương khoán đạt ${formatCurrency(summary.earnedVnd)}. Phần đến ${threshold} đã được trả trong lương cứng; phần vượt ${formatCurrency(summary.addedVnd)} được cộng thêm.`;
  }
  return `Lương khoán đạt ${formatCurrency(summary.earnedVnd)}, chưa vượt ${threshold}, nên đã được trả trọn trong lương cứng. Không có khoản nào bị trừ.`;
}
