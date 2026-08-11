import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DashboardPage } from "@/features/dashboard/dashboard-page";
import type { RoleAwareDashboardReadModel } from "@/features/dashboard/read-models";

afterEach(() => {
  cleanup();
});

describe("Global dashboard Commission aggregate authority", () => {
  it("does not present Commission aggregates while keeping other dashboard sections intact", () => {
    const dashboard: RoleAwareDashboardReadModel = {
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
      payroll: {
        data: {
          approvedStatementCount: 0,
          draftStatementCount: 0,
          latestPeriodMonth: null,
          reviewStatementCount: 0,
          statementCount: 0,
          totalPayableVnd: 0,
        },
        status: "ready",
      },
    };

    render(<DashboardPage dashboard={dashboard} />);

    expect(screen.getByText("5 khối dữ liệu")).toBeInTheDocument();
    expect(screen.getByText("Tổng quan tài chính")).toBeInTheDocument();
    expect(screen.getByText("Bảng lương")).toBeInTheDocument();
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
