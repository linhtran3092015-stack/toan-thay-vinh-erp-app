import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = {
  push: vi.fn(),
  replace: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { DashboardPage } from "@/features/dashboard/dashboard-page";
import type { RoleAwareDashboardReadModel } from "@/features/dashboard/read-models";

afterEach(() => {
  cleanup();
});

describe("Global dashboard Commission aggregate authority", () => {
  it("does not present Commission aggregates while keeping other dashboard sections intact", () => {
    const dashboard: RoleAwareDashboardReadModel = {
      admissionsFunnel: {
        data: {
          conversionRatePercent: 12.5,
          steps: [
            { count: 100, key: "leads", label: "Tổng tiềm năng", percentage: 100 },
            { count: 60, key: "contacted", label: "Đã liên hệ", percentage: 60 },
            { count: 40, key: "consulted", label: "Đã tư vấn", percentage: 40 },
            { count: 20, key: "registered", label: "Đã đăng ký / Học thử", percentage: 20 },
            { count: 12, key: "enrolled", label: "Đã nhập học", percentage: 12 },
          ],
          topSources: [{ count: 50, name: "Fanpage" }],
          totalLeads: 100,
        },
        status: "ready",
      },
      advances: {
        data: {
          approvedUndeductedCount: 0,
          deductedCount: 0,
          pendingReviewCount: 0,
          rejectedCount: 0,
          requestCount: 0,
          totalRequestedVnd: 0,
        },
        status: "ready",
      },
      attention: {
        data: [],
        status: "ready",
      },
      availableMonths: ["2026-08", "2026-07"],
      availableYears: [2026, 2025],
      coaching: {
        data: {
          closedCount: 0,
          highPriorityCount: 0,
          inProgressCount: 0,
          openCount: 0,
          recordCount: 0,
        },
        status: "ready",
      },
      finance: {
        data: {
          disbursementVnd: 200_000,
          netCashflowVnd: 1_200_000,
          paymentRequestCount: 3,
          receiptVnd: 1_400_000,
          refundVnd: 0,
        },
        status: "ready",
      },
      gradingCredits: {
        data: {
          entryCount: 0,
          latestCreditedAt: null,
          totalCreditUnits: 0,
        },
        status: "ready",
      },
      kpis: {
        data: {
          disbursementChangePercent: 0,
          disbursementVnd: 200_000,
          netCashflowChangePercent: 0,
          netCashflowVnd: 1_200_000,
          receivablesVnd: 500_000,
          revenueChangePercent: 10,
          revenueVnd: 1_400_000,
          totalStudents: 150,
          totalStudentsChangePercent: 5,
        },
        status: "ready",
      },
      lastUpdatedAt: "2026-08-29T10:00:00.000Z",
      operationalHighlights: {
        data: {
          activeClassesCount: 12,
          activeStaffCount: 20,
          closedCoachingCount: 5,
          completedSessionsCount: 45,
          gradingCreditUnits: 80,
        },
        status: "ready",
      },
      payroll: {
        data: {
          approvedStatementCount: 0,
          draftStatementCount: 0,
          latestPeriodMonth: null,
          reviewStatementCount: 0,
          statementCount: 0,
        },
        status: "ready",
      },
      payrollSummary: {
        data: {
          approvedCount: 1,
          draftCount: 0,
          latestPeriodMonth: "2026-08",
          reviewCount: 0,
          staffByPosition: [],
          statementCount: 5,
          totalPayrollVnd: 50_000_000,
          variancePercent: 2,
        },
        status: "ready",
      },
      receivablesAging: {
        data: {
          collectedVnd: 1_000_000,
          from31To60DaysVnd: 100_000,
          items: [
            { amountVnd: 400_000, color: "#315FCC", key: "under_30", label: "Trong hạn / Dưới 30 ngày", percentage: 80 },
            { amountVnd: 100_000, color: "#C06A1B", key: "31_to_60", label: "Quá hạn 31–60 ngày", percentage: 20 },
            { amountVnd: 0, color: "#C33752", key: "over_60", label: "Quá hạn trên 60 ngày", percentage: 0 },
          ],
          over60DaysVnd: 0,
          totalReceivablesVnd: 500_000,
          under30DaysVnd: 400_000,
        },
        status: "ready",
      },
      revenueComposition: {
        data: [
          { amountVnd: 1_400_000, category: "tuition", label: "Học phí", sharePercent: 100 },
        ],
        status: "ready",
      },
      revenueTrend: {
        data: [
          { costVnd: 200_000, month: "2026-08", monthLabel: "T8", netVnd: 1_200_000, revenueVnd: 1_400_000 },
        ],
        status: "ready",
      },
      selectedMonth: "2026-08",
      selectedYear: 2026,
      studentStatus: {
        data: {
          activeCount: 140,
          completedCount: 5,
          items: [
            { color: "#16794C", count: 140, key: "active", label: "Đang theo học", percentage: 93.3 },
            { color: "#C06A1B", count: 5, key: "reserved", label: "Bảo lưu / Tạm nghỉ", percentage: 3.3 },
            { color: "#667085", count: 5, key: "completed", label: "Đã hoàn thành / Nghỉ", percentage: 3.3 },
            { color: "#315FCC", count: 0, key: "waiting", label: "Chờ xếp lớp / Quan tâm", percentage: 0 },
          ],
          reservedCount: 5,
          totalCount: 150,
          waitingCount: 0,
        },
        status: "ready",
      },
      topClasses: {
        data: [
          { code: "L9A", id: "c-1", name: "Toán 9 Chuyên", rank: 1, revenueVnd: 36_000_000, studentCount: 20 },
        ],
        status: "ready",
      },
    };

    render(<DashboardPage dashboard={dashboard} />);

    expect(screen.getByText("Doanh thu")).toBeInTheDocument();
    expect(screen.getByText("Quỹ lương & Cơ cấu nhân sự")).toBeInTheDocument();
    expect(screen.getByText("Tình hình tuyển sinh & Phễu chuyển đổi")).toBeInTheDocument();
    expect(screen.queryByText("Thực lĩnh")).not.toBeInTheDocument();
    expect(screen.queryByText("Doanh thu hoa hồng")).not.toBeInTheDocument();
    expect(screen.queryByText("Doanh thu ghi nhận")).not.toBeInTheDocument();
    expect(screen.queryByText("MMA", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Sandbox", { exact: true })).not.toBeInTheDocument();
  });

  it("does not load or aggregate the capped Commission ledger in dashboard data composition", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/dashboard/data.ts"),
      "utf8",
    );

    expect(source).not.toContain("getSalesCommissionAccrualsDashboardResult");
    expect(source).not.toContain("loadCommissionSummary");
    expect(source).not.toContain("recognizedRevenueVnd");
    expect(source).not.toContain("mmaAccrualCount");
    expect(source).not.toContain("sandboxAccrualCount");
  });
});
