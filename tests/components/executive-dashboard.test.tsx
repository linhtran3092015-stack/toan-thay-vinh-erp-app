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

function mockExecutiveDashboard(overrides?: Partial<RoleAwareDashboardReadModel>): RoleAwareDashboardReadModel {
  return {
    admissionsFunnel: {
      data: {
        conversionRatePercent: 18.5,
        steps: [
          { count: 250, key: "leads", label: "Tổng tiềm năng", percentage: 100 },
          { count: 180, key: "contacted", label: "Đã liên hệ", percentage: 72 },
          { count: 120, key: "consulted", label: "Đã tư vấn", percentage: 48 },
          { count: 65, key: "registered", label: "Đã đăng ký / Học thử", percentage: 26 },
          { count: 46, key: "enrolled", label: "Đã nhập học", percentage: 18.5 },
        ],
        topSources: [
          { count: 120, name: "Fanpage Facebook" },
          { count: 80, name: "Website" },
          { count: 50, name: "Phụ huynh giới thiệu" },
        ],
        totalLeads: 250,
      },
      status: "ready",
    },
    advances: {
      data: {
        approvedUndeductedCount: 2,
        deductedCount: 5,
        pendingReviewCount: 1,
        rejectedCount: 0,
        requestCount: 8,
        totalRequestedVnd: 15_000_000,
      },
      status: "ready",
    },
    attention: {
      data: [
        {
          count: 2,
          description: "2 kỳ bảng lương đã tính toán xong cần duyệt.",
          href: "/payroll",
          id: "payroll-review",
          module: "Bảng lương",
          severity: "danger",
          title: "2 kỳ bảng lương đang chờ duyệt",
        },
        {
          count: 5,
          description: "5 khoản học phí quá hạn cần đôn đốc.",
          href: "/finance",
          id: "payments-overdue",
          module: "Tài chính",
          severity: "warning",
          title: "5 khoản học phí quá hạn",
        },
      ],
      status: "ready",
    },
    availableMonths: ["2026-08", "2026-07", "2026-06"],
    availableYears: [2026, 2025],
    coaching: {
      data: {
        closedCount: 10,
        highPriorityCount: 2,
        inProgressCount: 4,
        openCount: 1,
        recordCount: 15,
      },
      status: "ready",
    },
    finance: {
      data: {
        disbursementVnd: 850_000_000,
        netCashflowVnd: 1_600_000_000,
        paymentRequestCount: 120,
        receiptVnd: 2_450_000_000,
        refundVnd: 0,
      },
      status: "ready",
    },
    gradingCredits: {
      data: {
        entryCount: 45,
        latestCreditedAt: "2026-08-28T10:00:00.000Z",
        totalCreditUnits: 120,
      },
      status: "ready",
    },
    kpis: {
      data: {
        disbursementChangePercent: -5.2,
        disbursementVnd: 850_000_000,
        netCashflowChangePercent: 15.8,
        netCashflowVnd: 1_600_000_000,
        receivablesVnd: 320_500_000,
        revenueChangePercent: 12.5,
        revenueVnd: 2_450_000_000,
        totalStudents: 1248,
        totalStudentsChangePercent: 8.2,
      },
      status: "ready",
    },
    lastUpdatedAt: "2026-08-29T23:00:00.000Z",
    operationalHighlights: {
      data: {
        activeClassesCount: 38,
        activeStaffCount: 42,
        closedCoachingCount: 12,
        completedSessionsCount: 340,
        gradingCreditUnits: 215,
      },
      status: "ready",
    },
    payroll: {
      data: {
        approvedStatementCount: 30,
        draftStatementCount: 2,
        latestPeriodMonth: "2026-08",
        reviewStatementCount: 2,
        statementCount: 34,
      },
      status: "ready",
    },
    payrollSummary: {
      data: {
        approvedCount: 30,
        draftCount: 2,
        latestPeriodMonth: "2026-08",
        reviewCount: 2,
        staffByPosition: [
          { amountVnd: 120_000_000, employeeCount: 18, positionName: "Giáo viên" },
          { amountVnd: 45_000_000, employeeCount: 15, positionName: "Trợ giảng" },
          { amountVnd: 20_500_000, employeeCount: 5, positionName: "Vận hành" },
        ],
        statementCount: 34,
        totalPayrollVnd: 185_500_000,
        variancePercent: 4.5,
      },
      status: "ready",
    },
    receivablesAging: {
      data: {
        collectedVnd: 2_129_500_000,
        from31To60DaysVnd: 85_000_000,
        items: [
          { amountVnd: 185_500_000, color: "#315FCC", key: "under_30", label: "Trong hạn / Dưới 30 ngày", percentage: 57.9 },
          { amountVnd: 85_000_000, color: "#C06A1B", key: "31_to_60", label: "Quá hạn 31–60 ngày", percentage: 26.5 },
          { amountVnd: 50_000_000, color: "#C33752", key: "over_60", label: "Quá hạn trên 60 ngày", percentage: 15.6 },
        ],
        over60DaysVnd: 50_000_000,
        totalReceivablesVnd: 320_500_000,
        under30DaysVnd: 185_500_000,
      },
      status: "ready",
    },
    revenueComposition: {
      data: [
        { amountVnd: 2_100_000_000, category: "tuition", label: "Học phí", sharePercent: 85.7 },
        { amountVnd: 250_000_000, category: "service", label: "Phí dịch vụ", sharePercent: 10.2 },
        { amountVnd: 100_000_000, category: "other", label: "Khác", sharePercent: 4.1 },
      ],
      status: "ready",
    },
    revenueTrend: {
      data: [
        { costVnd: 700_000_000, month: "2026-01", monthLabel: "T1", netVnd: 1_100_000_000, revenueVnd: 1_800_000_000 },
        { costVnd: 750_000_000, month: "2026-02", monthLabel: "T2", netVnd: 1_250_000_000, revenueVnd: 2_000_000_000 },
        { costVnd: 800_000_000, month: "2026-03", monthLabel: "T3", netVnd: 1_400_000_000, revenueVnd: 2_200_000_000 },
        { costVnd: 820_000_000, month: "2026-04", monthLabel: "T4", netVnd: 1_480_000_000, revenueVnd: 2_300_000_000 },
        { costVnd: 810_000_000, month: "2026-05", monthLabel: "T5", netVnd: 1_540_000_000, revenueVnd: 2_350_000_000 },
        { costVnd: 840_000_000, month: "2026-06", monthLabel: "T6", netVnd: 1_560_000_000, revenueVnd: 2_400_000_000 },
        { costVnd: 860_000_000, month: "2026-07", monthLabel: "T7", netVnd: 1_540_000_000, revenueVnd: 2_400_000_000 },
        { costVnd: 850_000_000, month: "2026-08", monthLabel: "T8", netVnd: 1_600_000_000, revenueVnd: 2_450_000_000 },
      ],
      status: "ready",
    },
    selectedMonth: "2026-08",
    selectedYear: 2026,
    studentStatus: {
      data: {
        activeCount: 1150,
        completedCount: 48,
        items: [
          { color: "#16794C", count: 1150, key: "active", label: "Đang theo học", percentage: 92.1 },
          { color: "#C06A1B", count: 35, key: "reserved", label: "Bảo lưu / Tạm nghỉ", percentage: 2.8 },
          { color: "#667085", count: 48, key: "completed", label: "Đã hoàn thành / Nghỉ", percentage: 3.8 },
          { color: "#315FCC", count: 15, key: "waiting", label: "Chờ xếp lớp / Quan tâm", percentage: 1.2 },
        ],
        reservedCount: 35,
        totalCount: 1248,
        waitingCount: 15,
      },
      status: "ready",
    },
    topClasses: {
      data: [
        { code: "L9A", id: "c-1", name: "Toán 9 Chuyên", rank: 1, revenueVnd: 680_000_000, studentCount: 45 },
        { code: "L8A", id: "c-2", name: "Toán 8 Nâng cao", rank: 2, revenueVnd: 520_000_000, studentCount: 38 },
        { code: "L7A", id: "c-3", name: "Toán 7 Nâng cao", rank: 3, revenueVnd: 410_000_000, studentCount: 32 },
        { code: "L6A", id: "c-4", name: "Toán 6 Cơ bản", rank: 4, revenueVnd: 350_000_000, studentCount: 28 },
        { code: "L9B", id: "c-5", name: "Toán 9 Luyện thi", rank: 5, revenueVnd: 290_000_000, studentCount: 24 },
      ],
      status: "ready",
    },
    ...overrides,
  };
}

describe("Executive Dashboard UI & Business Logic", () => {
  it("renders header greeting with user name and period selector", () => {
    const dashboard = mockExecutiveDashboard();
    render(<DashboardPage dashboard={dashboard} userDisplayName="Thầy Vinh" />);

    expect(screen.getByText("Chào mừng, Thầy Vinh 👋")).toBeInTheDocument();
    expect(screen.getByText("Xuất báo cáo")).toBeInTheDocument();
    expect(screen.getByText("Tháng 8/2026")).toBeInTheDocument();
  });

  it("renders 5 top executive KPIs with numbers and trend indicators", () => {
    const dashboard = mockExecutiveDashboard();
    render(<DashboardPage dashboard={dashboard} />);

    expect(screen.getByText("Tổng học sinh")).toBeInTheDocument();
    expect(screen.getAllByText("1.248").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Doanh thu")).toBeInTheDocument();
    expect(screen.getAllByText("2,5 tỷ").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Chi phí")).toBeInTheDocument();
    expect(screen.getAllByText("850 tr").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Dòng tiền ròng")).toBeInTheDocument();
    expect(screen.getAllByText("1,6 tỷ").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Công nợ phải thu")).toBeInTheDocument();
    expect(screen.getAllByText("320,5 tr").length).toBeGreaterThanOrEqual(1);
  });

  it("renders attention center with action items", () => {
    const dashboard = mockExecutiveDashboard();
    render(<DashboardPage dashboard={dashboard} />);

    expect(screen.getByText("Trung tâm cần chú ý")).toBeInTheDocument();
    expect(screen.getByText("2 việc cần xử lý")).toBeInTheDocument();
    expect(screen.getByText("2 kỳ bảng lương đang chờ duyệt")).toBeInTheDocument();
    expect(screen.getByText("5 khoản học phí quá hạn")).toBeInTheDocument();
  });

  it("renders attention center safe state when no items need action", () => {
    const dashboard = mockExecutiveDashboard({
      attention: { data: [], status: "ready" },
    });
    render(<DashboardPage dashboard={dashboard} />);

    expect(screen.getByText("Tất cả ổn định")).toBeInTheDocument();
    expect(screen.getByText("Không có vấn đề quan trọng cần xử lý")).toBeInTheDocument();
  });

  it("renders 12-month revenue trend chart and composition donut", () => {
    const dashboard = mockExecutiveDashboard();
    render(<DashboardPage dashboard={dashboard} />);

    expect(screen.getByText("Doanh thu & Chi phí theo tháng")).toBeInTheDocument();
    expect(screen.getByText("Cơ cấu doanh thu")).toBeInTheDocument();
    expect(screen.getByText("Học phí")).toBeInTheDocument();
  });

  it("renders admissions funnel and conversion rate", () => {
    const dashboard = mockExecutiveDashboard();
    render(<DashboardPage dashboard={dashboard} />);

    expect(screen.getByText("Tình hình tuyển sinh & Phễu chuyển đổi")).toBeInTheDocument();
    expect(screen.getByText("Tỷ lệ chuyển đổi")).toBeInTheDocument();
    expect(screen.getByText("18,5%")).toBeInTheDocument();
    expect(screen.getByText("Fanpage Facebook")).toBeInTheDocument();
  });

  it("renders top classes and receivables aging distribution", () => {
    const dashboard = mockExecutiveDashboard();
    render(<DashboardPage dashboard={dashboard} />);

    expect(screen.getByText("Top 5 Lớp & Khối học tiêu biểu")).toBeInTheDocument();
    expect(screen.getByText("Toán 9 Chuyên")).toBeInTheDocument();
    expect(screen.getByText("Công nợ & Tuổi nợ phải thu")).toBeInTheDocument();
    expect(screen.getByText("Trong hạn / Dưới 30 ngày")).toBeInTheDocument();
  });

  it("renders payroll fund and operational highlights row", () => {
    const dashboard = mockExecutiveDashboard();
    render(<DashboardPage dashboard={dashboard} />);

    expect(screen.getByText("Quỹ lương & Cơ cấu nhân sự")).toBeInTheDocument();
    expect(screen.getByText("185,5 tr")).toBeInTheDocument();
    expect(screen.getByText("Hoạt động học vụ & vận hành nổi bật")).toBeInTheDocument();
    expect(screen.getByText("Lớp học đang mở")).toBeInTheDocument();
    expect(screen.getByText("Buổi học đã diễn ra")).toBeInTheDocument();
  });

  it("hides restricted sections when unauthorized without breaking the layout", () => {
    const dashboard = mockExecutiveDashboard({
      attention: { status: "hidden" },
      kpis: { status: "hidden" },
      payrollSummary: { status: "hidden" },
      receivablesAging: { status: "hidden" },
      revenueComposition: { status: "hidden" },
      revenueTrend: { status: "hidden" },
    });
    render(<DashboardPage dashboard={dashboard} />);

    expect(screen.queryByText("Doanh thu & Chi phí theo tháng")).not.toBeInTheDocument();
    expect(screen.queryByText("Quỹ lương & Cơ cấu nhân sự")).not.toBeInTheDocument();
    expect(screen.queryByText("Công nợ & Tuổi nợ phải thu")).not.toBeInTheDocument();
    // Non-restricted sections like admissions and student status remain visible
    expect(screen.getByText("Tình hình tuyển sinh & Phễu chuyển đổi")).toBeInTheDocument();
    expect(screen.getByText("Tình hình học sinh")).toBeInTheDocument();
  });
});
