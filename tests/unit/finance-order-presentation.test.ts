import { describe, expect, it } from "vitest";

import {
  formatFinanceDateTime,
  getFinanceOrderCostPresentation,
  getFinanceOrderSourceLabel,
} from "@/features/finance/finance-order-presentation";

describe("Finance Order source label", () => {
  it("joins the partner group and the lead source name", () => {
    expect(getFinanceOrderSourceLabel({ leadSourceName: "Đối tác Sandbox", sourceLabel: "SB" }))
      .toBe("SB · Đối tác Sandbox");
    expect(getFinanceOrderSourceLabel({ leadSourceName: null, sourceLabel: "MMA" })).toBe("MMA");
  });

  it("names a known source outside MMA/SB instead of calling it unknown", () => {
    expect(getFinanceOrderSourceLabel({ leadSourceName: "Đến trực tiếp trung tâm", sourceLabel: null }))
      .toBe("Đến trực tiếp trung tâm");
  });

  it("falls back to unknown only when no source resolved", () => {
    expect(getFinanceOrderSourceLabel({ leadSourceName: null, sourceLabel: null })).toBe("Chưa xác định");
  });
});

describe("Finance Order cost presentation", () => {
  it("formats transaction timestamps in the fixed business timezone for deterministic hydration", () => {
    expect(formatFinanceDateTime("2026-07-25T07:00:00.000Z")).toBe("14:00 25/07/2026");
  });

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
