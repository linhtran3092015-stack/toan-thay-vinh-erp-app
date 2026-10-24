import { describe, expect, it } from "vitest";

import {
  getAmountClassName,
  getPayslipDisplayTotals,
  getPayslipSection,
  getPieceworkExplanation,
  isNettedIntoIncome,
  summarizePiecework,
} from "@/features/payroll/payslip-sections";

// An operations assistant above the 85% floor: lương cứng 2.400.000, lương
// khoán 2.800.000, plus two manual corrections.
const aboveFloorLines = [
  { amountVnd: 2_100_000, direction: "earning", lineType: "base_offline" },
  { amountVnd: 300_000, direction: "earning", lineType: "base_online" },
  { amountVnd: 1_200_000, direction: "earning", lineType: "center_renewal_duty_bonus" },
  { amountVnd: 1_075_000, direction: "earning", lineType: "operations_grade_renewal_bonus" },
  { amountVnd: 525_000, direction: "earning", lineType: "payroll_processing_bonus" },
  {
    amountVnd: 2_040_000,
    direction: "deduction",
    formulaSnapshot: { base_salary_vnd: 2_400_000, basis_points: 8_500, piecework_vnd: 2_800_000 },
    lineType: "piecework_offset",
  },
  { amountVnd: 240_000, direction: "earning", lineType: "manual_reward" },
  { amountVnd: 1_500_000, direction: "earning", lineType: "manual_reward" },
];

describe("payslip sections", () => {
  // Value: protects=the lương khoán block adds up from stored lines (earned − part inside lương cứng = added) and reads the engine snapshot keys;
  // fails_when=manual rewards are counted as lương khoán, the offset sum drifts from the stored lines, or the threshold ignores `basis_points`;
  // why_new=staff misread the offset as a deduction; the payslip now explains it from these figures;
  // seam=none (pure function); no_claim=does not recompute or validate the engine's offset
  it("summarizes lương khoán from the stored offset", () => {
    expect(summarizePiecework(aboveFloorLines)).toEqual({
      absorbedVnd: 2_040_000,
      addedVnd: 760_000,
      baseSalaryVnd: 2_400_000,
      earnedVnd: 2_800_000,
      floorBasisPoints: 8_500,
      thresholdVnd: 2_040_000,
    });
    expect(summarizePiecework([{ amountVnd: 1_000, direction: "earning", lineType: "grading_bonus" }])).toBeNull();
  });

  // Value: protects=income and deductions shown to staff still reconcile to the stored payable;
  // fails_when=the offset or a manual deduction stays in "Khấu trừ", or income − deductions no longer equals payable;
  // why_new=display totals now differ from the stored totals by design;
  // seam=none (pure function); no_claim=does not prove stored totals are right
  it("keeps only real deductions under Khấu trừ and still reconciles to payable", () => {
    const lines = [
      ...aboveFloorLines,
      { amountVnd: 60, direction: "deduction", lineType: "manual_deduction" },
      { amountVnd: 500_000, direction: "deduction", lineType: "advance_deduction" },
    ];
    const totalEarningsVnd = lines.filter((line) => line.direction === "earning").reduce((sum, line) => sum + line.amountVnd, 0);
    const totalDeductionsVnd = lines.filter((line) => line.direction === "deduction").reduce((sum, line) => sum + line.amountVnd, 0);
    const payableVnd = totalEarningsVnd - totalDeductionsVnd;

    const totals = getPayslipDisplayTotals({ lines, totalDeductionsVnd, totalEarningsVnd });

    expect(totals.deductionsVnd).toBe(500_000);
    expect(totals.incomeVnd - totals.deductionsVnd).toBe(payableVnd);
  });

  it("sorts lines into the sections staff read", () => {
    const section = (lineType: string, direction = "earning", withPiecework = true) =>
      getPayslipSection({ amountVnd: 1, direction, lineType }, withPiecework);
    expect(section("piecework_offset", "deduction")).toBe("piecework");
    expect(section("operations_grade_renewal_bonus")).toBe("piecework");
    expect(section("operations_grade_renewal_bonus", "earning", false)).toBe("earnings");
    expect(section("grading_bonus", "earning", false)).toBe("grading");
    expect(section("manual_deduction", "deduction")).toBe("manual");
    expect(section("manual_reward")).toBe("manual");
    expect(section("advance_deduction", "deduction")).toBe("deductions");
    expect(section("base_offline")).toBe("attendance");
  });

  it("explains the floor without calling it a deduction", () => {
    const above = summarizePiecework(aboveFloorLines);
    expect(above && getPieceworkExplanation(above)).toBe(
      "Lương khoán đạt 2.800.000 VND. Phần đến 85% lương cứng (2.400.000 VND × 85% = 2.040.000 VND) đã được trả trong lương cứng; phần vượt 760.000 VND được cộng thêm.",
    );
    const below = summarizePiecework([
      { amountVnd: 900_000, direction: "earning", lineType: "operations_grade_renewal_bonus" },
      { amountVnd: 900_000, direction: "deduction", formulaSnapshot: { base_salary_vnd: 1_500_000, basis_points: 8_500 }, lineType: "piecework_offset" },
    ]);
    expect(below && getPieceworkExplanation(below)).toBe(
      "Lương khoán đạt 900.000 VND, chưa vượt 85% lương cứng (1.500.000 VND × 85% = 1.275.000 VND), nên đã được trả trọn trong lương cứng. Không có khoản nào bị trừ.",
    );
  });

  // Value: protects=an offset line whose snapshot carries no base salary or floor rate still explains lương khoán by naming "ngưỡng lương cứng của chính sách", in both the above-floor and below-floor sentences;
  // fails_when=summarizePiecework derives a base, rate or threshold from an empty snapshot (e.g. 0 VND from null × null), or getPieceworkExplanation drops the fallback and prints null / NaN / 0% figures;
  // why_new=the existing explanation tests always pass a full snapshot, so the fallback branch never runs;
  // seam=none (pure function); no_claim=does not prove which engine runs omit the snapshot keys
  it("falls back to the policy threshold when the offset snapshot is empty", () => {
    const above = summarizePiecework([
      { amountVnd: 1_500_000, direction: "earning", lineType: "operations_grade_renewal_bonus" },
      { amountVnd: 1_200_000, direction: "deduction", formulaSnapshot: {}, lineType: "piecework_offset" },
    ]);
    expect(above).toEqual({ absorbedVnd: 1_200_000, addedVnd: 300_000, baseSalaryVnd: null, earnedVnd: 1_500_000, floorBasisPoints: null, thresholdVnd: null });
    expect(above && getPieceworkExplanation(above)).toBe(
      "Lương khoán đạt 1.500.000 VND. Phần đến ngưỡng lương cứng của chính sách đã được trả trong lương cứng; phần vượt 300.000 VND được cộng thêm.",
    );

    const below = summarizePiecework([
      { amountVnd: 400_000, direction: "earning", lineType: "operations_grade_renewal_bonus" },
      { amountVnd: 400_000, direction: "deduction", formulaSnapshot: {}, lineType: "piecework_offset" },
    ]);
    expect(below && getPieceworkExplanation(below)).toBe(
      "Lương khoán đạt 400.000 VND, chưa vượt ngưỡng lương cứng của chính sách, nên đã được trả trọn trong lương cứng. Không có khoản nào bị trừ.",
    );
  });

  // Value: protects=the offset and manual decreases are netted into income while advances stay real deductions and earnings (manual rewards included) are never netted; only advances are drawn red, the offset muted, a manual decrease neutral;
  // fails_when=isNettedIntoIncome drops its direction check (a manual reward is subtracted from income) or nets advances (they vanish from Khấu trừ), or getAmountClassName paints the offset or a manual decrease text-danger or an advance anything else;
  // why_new=both helpers are new and the dialog, daily table, owner chart and payslip loader branch on them; no test called them directly;
  // seam=none (pure function); no_claim=does not prove each surface applies the class it gets
  it("nets only the offset and manual decreases into income and colours only advances red", () => {
    const cases = [
      { direction: "deduction", lineType: "advance_deduction", netted: false, tone: "text-danger" },
      { direction: "deduction", lineType: "piecework_offset", netted: true, tone: "text-text-muted" },
      { direction: "deduction", lineType: "manual_deduction", netted: true, tone: "text-text-default" },
      { direction: "earning", lineType: "manual_reward", netted: false, tone: "text-text-strong" },
      { direction: "earning", lineType: "base_offline", netted: false, tone: "text-text-strong" },
    ];

    expect(cases.map(({ direction, lineType }) => [lineType, isNettedIntoIncome({ direction, lineType }), getAmountClassName({ direction, lineType })])).toEqual(
      cases.map(({ lineType, netted, tone }) => [lineType, netted, tone]),
    );
  });
});
