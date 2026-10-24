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
  kind: "summary";
  thresholdVnd: number | null;
}

/**
 * The lương khoán lines contradict the offset: the engine's recorded lương
 * khoán differs from the lines listed under it, or lương khoán đạt is below the
 * part already paid inside lương cứng (the engine makes the offset the lower of
 * the two). No "cộng thêm" amount can be shown.
 */
export interface PieceworkMismatch {
  kind: "mismatch";
  absorbedVnd: number;
  earnedVnd: number;
}

/** Shown to every role on a calculated period, so it says who acts. */
export const PIECEWORK_MISMATCH_MESSAGE =
  "Lương khoán chưa khớp với phần đã trả trong lương cứng. Quản lý lương cần kiểm tra và tính lại kỳ lương này.";

/** The live estimate has no calculated period yet. */
export const PIECEWORK_ESTIMATE_MISMATCH_MESSAGE =
  "Lương khoán tạm tính chưa khớp với phần đã trả trong lương cứng; số liệu sẽ được đối chiếu khi chốt kỳ lương.";

export function summarizePiecework(lines: readonly DisplayLine[]): PieceworkSummary | PieceworkMismatch | null {
  const offsetLines = lines.filter((line) => line.lineType === PIECEWORK_OFFSET);
  if (offsetLines.length === 0) return null;
  const absorbedVnd = offsetLines.reduce((sum, line) => sum + line.amountVnd, 0);
  const snapshot = offsetLines[0].formulaSnapshot;
  const listedVnd = lines.filter(isPieceworkEarning).reduce((sum, line) => sum + line.amountVnd, 0);
  // The engine stores the lương khoán it compared with the floor on the offset
  // line; it must equal the lines listed under Lương khoán, or the section
  // would not add up (a missing line, or a line the engine counts that this
  // file shows elsewhere). Live estimates carry no snapshot and use the lines.
  const snapshotEarnedVnd = offsetLines.length === 1 ? getNumber(snapshot, "piecework_vnd") : null;
  const earnedVnd = snapshotEarnedVnd ?? listedVnd;
  const addedVnd = earnedVnd - absorbedVnd;
  if (earnedVnd !== listedVnd || addedVnd < 0) return { absorbedVnd, earnedVnd, kind: "mismatch" };
  const baseSalaryVnd = getNumber(snapshot, "base_salary_vnd");
  const floorBasisPoints = getFloorBasisPoints(snapshot);
  return {
    absorbedVnd,
    addedVnd,
    baseSalaryVnd,
    earnedVnd,
    floorBasisPoints,
    kind: "summary",
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
