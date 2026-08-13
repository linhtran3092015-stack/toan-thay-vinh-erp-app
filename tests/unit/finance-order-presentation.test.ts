import { describe, expect, it } from "vitest";

import { getFinanceOrderCostPresentation } from "@/features/finance/finance-order-presentation";

describe("Finance Order cost presentation", () => {
  it("never presents an unconfigured policy as zero VND", () => {
    expect(getFinanceOrderCostPresentation({
      mechanismCode: "unconfigured",
      operatingCostStatus: "unconfigured",
      operatingCostVnd: null,
    })).toMatchObject({ label: "Chưa cấu hình", tone: "warning" });
  });

  it("labels the configured SB and MMA mechanisms explicitly", () => {
    expect(getFinanceOrderCostPresentation({
      mechanismCode: "renewal_sb_20_percent",
      operatingCostStatus: "configured",
      operatingCostVnd: 560_000,
    })).toMatchObject({ label: "20% học phí" });
    expect(getFinanceOrderCostPresentation({
      mechanismCode: "renewal_mma_zero",
      operatingCostStatus: "configured",
      operatingCostVnd: 0,
    })).toMatchObject({ label: "0 VND" });
    expect(getFinanceOrderCostPresentation({
      mechanismCode: "new_enrollment_sb_fixed_plus_25_percent",
      operatingCostStatus: "configured",
      operatingCostVnd: 1_400_000,
    })).toMatchObject({ label: "700.000 + 25%" });
  });
});
