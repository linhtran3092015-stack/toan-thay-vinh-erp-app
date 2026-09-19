import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StaffLiveEstimateCard } from "@/features/payroll/estimate/components/staff-live-estimate-card";
import { OwnerLiveEstimateOverview } from "@/features/payroll/estimate/components/owner-live-estimate-overview";
import type { OwnerPayrollEstimate, StaffPayrollEstimate } from "@/features/payroll/estimate/types";

// Mock Supabase browser client for usePayrollLiveEstimate
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    channel: () => ({
      on: () => ({
        subscribe: () => ({}),
      }),
    }),
    removeChannel: () => Promise.resolve(),
  }),
}));

describe("StaffLiveEstimateCard Component", () => {
  const mockStaffEstimate: StaffPayrollEstimate = {
    asOf: "2026-09-18T10:00:00Z",
    calculatedAt: "2026-09-18T10:00:00Z",
    completeness: "complete",
    latestCompletedWorkAt: "2026-09-18T09:30:00Z",
    lines: [
      {
        amountVnd: 500000,
        direction: "earning",
        lineType: "base_offline",
        note: null,
        policyCode: "POL_BASE",
        unitLabel: "phút",
        unitRateVnd: 50000,
        workedMinutes: 600,
      },
    ],
    month: "2026-09-01",
    openShifts: [],
    recentShifts: [
      {
        checkInAt: "2026-09-18T08:00:00Z",
        checkOutAt: "2026-09-18T11:00:00Z",
        id: "a0000000-0000-4000-8000-000000000002",
        isPendingVerification: false,
        workDate: "2026-09-18",
        workedMinutes: 180,
        workMode: "offline",
      },
    ],
    statement: {
      advanceDeductionsVnd: 0,
      payableVnd: 500000,
      pendingVerificationCount: 0,
      positionCode: "teaching_assistant",
      staffDisplayName: "Nguyễn Anh Kiên",
      staffEmployeeCode: "NV24",
      staffId: "db57d08d-4cbf-42ba-84e8-20fd52c90503",
      totalDeductionsVnd: 0,
      totalEarningsVnd: 500000,
      workHours: 10,
      workUnits: 1,
      workedMinutes: 600,
    },
    status: "estimated",
    issues: [],
  };

  it("renders staff estimate details correctly when data is provided", () => {
    render(<StaffLiveEstimateCard initialEstimate={mockStaffEstimate} month="2026-09-01" />);

    expect(screen.getByText("tháng 9 năm 2026")).toBeInTheDocument();
    expect(screen.getAllByText("Lương tạm tính").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("500.000 VND").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("teaching_assistant")).toBeInTheDocument();
  });

  it("renders retry button when fetch fails and estimate is null", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<StaffLiveEstimateCard initialEstimate={null} month="2026-09-01" />);

    const retryBtn = await screen.findByRole("button", { name: /thử lại/i });
    expect(retryBtn).toBeInTheDocument();
    expect(screen.getByText(/chưa tải được dữ liệu lương tạm tính/i)).toBeInTheDocument();
  });
});

describe("OwnerLiveEstimateOverview Component", () => {
  const mockOwnerEstimate: OwnerPayrollEstimate = {
    asOf: "2026-09-18T10:00:00Z",
    calculatedAt: "2026-09-18T10:00:00Z",
    completeness: "complete",
    byPosition: [
      {
        positionCode: "teaching_assistant",
        staffCount: 5,
        totalEarningsVnd: 10000000,
        totalDeductionsVnd: 0,
        payableVnd: 10000000,
      },
    ],
    finance: {
      status: "available",
      tuitionReceivedVnd: 50000000,
      tuitionRefundedVnd: 0,
      tuitionNetVnd: 50000000,
      payrollRatioPercent: 20,
    },
    issues: [],
    latestCompletedWorkAt: null,
    month: "2026-08-01",
    selectedPositionCode: null,
    statements: [],
    status: "estimated",
    summary: {
      advanceDeductionsVnd: 0,
      payableVnd: 10000000,
      pendingVerificationCount: 0,
      staffCount: 5,
      totalDeductionsVnd: 0,
      totalEarningsVnd: 10000000,
    },
  };

  it("renders owner overview KPI cards correctly when data is provided", () => {
    render(<OwnerLiveEstimateOverview initialEstimate={mockOwnerEstimate} month="2026-08-01" />);

    expect(screen.getByText("Lương tạm tính phải trả")).toBeInTheDocument();
    expect(screen.getByText("Thực thu sau hoàn")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("Trợ giảng")).toBeInTheDocument();
  });

  it("renders retry button when fetch fails and estimate is null", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<OwnerLiveEstimateOverview initialEstimate={null} month="2026-08-01" />);

    const retryBtn = await screen.findByRole("button", { name: /thử lại/i });
    expect(retryBtn).toBeInTheDocument();
    expect(screen.getByText(/chưa tải được tổng quan lương tạm tính/i)).toBeInTheDocument();
  });
});
