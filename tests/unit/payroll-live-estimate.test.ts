import { describe, expect, it, vi } from "vitest";

import {
  ownerPayrollEstimateSchema,
  staffPayrollEstimateSchema,
} from "@/features/payroll/estimate/types";
import {
  getMyPayrollEstimateResult,
  getOwnerPayrollEstimateResult,
} from "@/features/payroll/estimate/data";
import * as supabaseServer from "@/lib/supabase/server";

describe("payroll-live-estimate: schemas and data contracts", () => {
  describe("staffPayrollEstimateSchema", () => {
    it("successfully parses valid staff payroll estimate", () => {
      const sample = {
        asOf: "2026-09-18T10:00:00Z",
        calculatedAt: "2026-09-18T10:00:00Z",
        completeness: "complete" as const,
        latestCompletedWorkAt: "2026-09-18T09:30:00Z",
        lines: [
          {
            amountVnd: 500000,
            direction: "earning" as const,
            lineType: "base_offline",
            note: null,
            policyCode: "POL_BASE",
            unitLabel: "giờ",
            unitRateVnd: 50000,
            workedMinutes: 600,
          },
          {
            amountVnd: 100000,
            direction: "earning" as const,
            lineType: "teaching_allowance",
            note: "Phụ cấp",
            policyCode: null,
            unitLabel: null,
            unitRateVnd: null,
            workedMinutes: null,
          },
        ],
        month: "2026-09-01",
        openShifts: [
          {
            checkInAt: "2026-09-18T14:00:00Z",
            id: "a0000000-0000-4000-8000-000000000001",
            workDate: "2026-09-18",
            workMode: "offline",
          },
        ],
        recentShifts: [
          {
            checkInAt: "2026-09-18T08:00:00Z",
            checkOutAt: "2026-09-18T11:00:00Z",
            id: "a0000000-0000-4000-8000-000000000002",
            isPendingVerification: true,
            workDate: "2026-09-18",
            workedMinutes: 180,
            workMode: "offline",
          },
        ],
        statement: {
          advanceDeductionsVnd: 50000,
          payableVnd: 550000,
          pendingVerificationCount: 1,
          positionCode: "tro_giang",
          staffDisplayName: "Nguyễn Văn A",
          staffEmployeeCode: "NV001",
          staffId: "a0000000-0000-4000-8000-000000000003",
          totalDeductionsVnd: 50000,
          totalEarningsVnd: 600000,
          workHours: 10,
          workedMinutes: 600,
          workUnits: 1,
        },
        status: "estimated" as const,
      };

      const result = staffPayrollEstimateSchema.safeParse(sample);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.statement?.payableVnd).toBe(550000);
        expect(result.data.lines).toHaveLength(2);
        expect(result.data.openShifts).toHaveLength(1);
        expect(result.data.recentShifts[0].isPendingVerification).toBe(true);
      }
    });

    it("rejects invalid completeness enum", () => {
      const invalid = {
        asOf: "2026-09-18T10:00:00Z",
        calculatedAt: "2026-09-18T10:00:00Z",
        completeness: "unknown_status",
        lines: [],
        month: "2026-09-01",
        openShifts: [],
        recentShifts: [],
        status: "estimated",
      };

      const result = staffPayrollEstimateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("ownerPayrollEstimateSchema", () => {
    it("successfully parses valid owner payroll estimate with tuition net ratio", () => {
      const sample = {
        asOf: "2026-09-18T10:00:00Z",
        byPosition: [
          {
            payableVnd: 25000000,
            positionCode: "tro_giang",
            staffCount: 5,
            totalDeductionsVnd: 1000000,
            totalEarningsVnd: 26000000,
          },
        ],
        calculatedAt: "2026-09-18T10:00:00Z",
        completeness: "complete" as const,
        finance: {
          payrollRatioPercent: 28.5,
          status: "available" as const,
          tuitionNetVnd: 100000000,
          tuitionReceivedVnd: 105000000,
          tuitionRefundedVnd: 5000000,
        },
        issues: [],
        month: "2026-09-01",
        status: "estimated" as const,
        summary: {
          advanceDeductionsVnd: 2000000,
          payableVnd: 50000000,
          pendingVerificationCount: 3,
          staffCount: 10,
          totalDeductionsVnd: 2000000,
          totalEarningsVnd: 52000000,
        },
      };

      const result = ownerPayrollEstimateSchema.safeParse(sample);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finance.tuitionNetVnd).toBe(100000000);
        expect(result.data.finance.payrollRatioPercent).toBe(28.5);
        expect(result.data.summary.staffCount).toBe(10);
        expect(result.data.summary.pendingVerificationCount).toBe(3);
      }
    });
  });

  describe("data fetchers", () => {
    it("getMyPayrollEstimateResult handles successful RPC and schema validation", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          asOf: "2026-09-18T12:00:00Z",
          calculatedAt: "2026-09-18T12:00:00Z",
          completeness: "complete",
          lines: [],
          month: "2026-09-01",
          openShifts: [],
          recentShifts: [],
          statement: null,
          status: "estimated",
        },
        error: null,
      });

      vi.spyOn(supabaseServer, "createSupabaseServerClient").mockResolvedValue({
        rpc: mockRpc,
      } as unknown as Awaited<ReturnType<typeof supabaseServer.createSupabaseServerClient>>);

      const result = await getMyPayrollEstimateResult("2026-09-01");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe("estimated");
        expect(mockRpc).toHaveBeenCalledWith("get_my_payroll_estimate", {
          p_month: "2026-09-01",
        });
      }
    });

    it("getOwnerPayrollEstimateResult handles RPC errors gracefully", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      vi.spyOn(supabaseServer, "createSupabaseServerClient").mockResolvedValue({
        rpc: mockRpc,
      } as unknown as Awaited<ReturnType<typeof supabaseServer.createSupabaseServerClient>>);

      const result = await getOwnerPayrollEstimateResult({
        month: "2026-09-01",
        positionCode: "tro_giang",
      });
      expect(result.ok).toBe(false);
    });
  });
});
