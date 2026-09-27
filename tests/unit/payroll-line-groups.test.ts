import { describe, expect, it } from "vitest";
import { groupPayrollLines } from "@/features/payroll/payroll-line-groups";

describe("payroll presentation grouping", () => {
  it("preserves every source and its stored amount without mixing deductions", () => {
    const lines = [
      { id: "1", lineType: "base_offline", direction: "earning", amountVnd: 466667 },
      { id: "2", lineType: "base_offline", direction: "earning", amountVnd: 466666 },
      { id: "3", lineType: "base_offline", direction: "deduction", amountVnd: 100 },
      { id: "4", lineType: "constructor", direction: "earning", amountVnd: 0 },
    ];
    const groups = groupPayrollLines(lines);
    expect(groups).toHaveLength(3);
    expect(groups[0].amountVnd).toBe(933333);
    expect(groups[0].lines).toEqual(lines.slice(0, 2));
    expect(groups.flatMap(group => group.lines)).toHaveLength(4);
    expect(groupPayrollLines([])).toEqual([]);
  });
});
