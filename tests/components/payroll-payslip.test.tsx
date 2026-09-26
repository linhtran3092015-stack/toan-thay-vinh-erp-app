import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PayslipDocument } from "@/features/payroll/payslip/components/payslip-document";
import { PayslipToolbar } from "@/features/payroll/payslip/components/payslip-toolbar";
import type { PayslipDocumentData } from "@/features/payroll/payslip/types";

const makeDocumentData = (
  overrides: Partial<PayslipDocumentData> = {},
): PayslipDocumentData => ({
  breakdowns: {
    commissions: [
      {
        basisRevenueFormatted: "96.000.000 VND",
        basisRevenueVnd: 96_000_000,
        gradeLabel: "Khối 6 & 7",
        ratePercentage: "5%",
        subtotalFormatted: "4.800.000 VND",
        subtotalVnd: 4_800_000,
      },
    ],
    grading: {
      creditsCount: 513,
      explanation: "513 phiếu × 2.000 VND",
      poolAmountFormatted: null,
      subtotalFormatted: "1.026.000 VND",
      subtotalVnd: 1_026_000,
    },
    workHours: [
      {
        dailyRateFormatted: "200.000 VND",
        dailyRateVnd: 200_000,
        factorText: null,
        mode: "offline",
        modeLabel: "Lương công offline",
        subtotalFormatted: "6.000.000 VND",
        subtotalVnd: 6_000_000,
        workHoursFormatted: "240 giờ",
        workMinutes: 14_400,
      },
    ],
  },
  deductions: [
    {
      amountFormatted: "2.350.000 VND",
      amountVnd: 2_350_000,
      direction: "deduction",
      formulaExplanation: "Khấu trừ tạm ứng = 2.350.000 VND",
      id: "deduction-1",
      label: "Khấu trừ tạm ứng",
      lineType: "advance_deduction",
      note: "Đã ứng ngày 15",
      quantity: null,
      unitLabel: null,
      unitRateFormatted: null,
      unitRateVnd: null,
    },
  ],
  earnings: [
    {
      amountFormatted: "6.000.000 VND",
      amountVnd: 6_000_000,
      direction: "earning",
      formulaExplanation: "30 ngày × 200.000 VND = 6.000.000 VND",
      id: "earning-1",
      label: "Lương công offline",
      lineType: "base_offline",
      note: null,
      quantity: 30,
      unitLabel: "ngày",
      unitRateFormatted: "200.000 VND",
      unitRateVnd: 200_000,
    },
    {
      amountFormatted: "1.026.000 VND",
      amountVnd: 1_026_000,
      direction: "earning",
      formulaExplanation: "513 phiếu × 2.000 VND = 1.026.000 VND",
      id: "earning-2",
      label: "Thưởng chấm bài",
      lineType: "grading_bonus",
      note: null,
      quantity: 513,
      unitLabel: "phiếu",
      unitRateFormatted: "2.000 VND",
      unitRateVnd: 2_000,
    },
    {
      amountFormatted: "4.800.000 VND",
      amountVnd: 4_800_000,
      direction: "earning",
      formulaExplanation: "96.000.000 VND × 5% = 4.800.000 VND",
      id: "earning-3",
      label: "Thưởng doanh thu",
      lineType: "revenue_bonus",
      note: null,
      quantity: null,
      unitLabel: null,
      unitRateFormatted: null,
      unitRateVnd: null,
    },
  ],
  employee: {
    avatarUrl: null,
    bankAccount: {
      accountHolderName: "TRẦN VĂN LINH",
      accountNumberMasked: "•••• •••• 0011",
      bankName: "Techcombank",
    },
    department: null,
    displayName: "Trần Văn Linh",
    employeeCode: "NV17",
    joinedAt: null,
    positionLabel: "Trợ lý vận hành",
    staffId: "staff-nv17-id",
  },
  isStale: false,
  period: {
    currentRevision: 1,
    feedbackClosedAt: null,
    feedbackOpenedAt: null,
    id: "period-uuid-1",
    lastCalculatedAt: "2026-07-28T08:00:00Z",
    payDate: "2026-08-28",
    payDateFormatted: "28/08/2026",
    periodEndDate: "31/07/2026",
    periodMonth: "2026-07-01",
    periodMonthFormatted: "THÁNG 07/2026",
    periodStartDate: "01/07/2026",
    status: "draft",
    statusLabel: "Bản nháp",
  },
  statementId: "statement-uuid-1",
  totals: {
    amountInWords: "Chín triệu bốn trăm bảy mươi sáu nghìn đồng chẵn./.",
    grossFormatted: "11.826.000 VND",
    grossVnd: 11_826_000,
    netFormatted: "9.476.000 VND",
    netVnd: 9_476_000,
    totalDeductionsFormatted: "2.350.000 VND",
    totalDeductionsVnd: 2_350_000,
    workHours: 240,
    workMinutes: 14_400,
    workUnits: 30,
  },
  ...overrides,
});

afterEach(() => {
  cleanup();
});

describe("Payslip UI Presentation & Document Structure", () => {
  it("groups repeated source rows and preserves the section subtotal", () => {
    const data = makeDocumentData();
    const source = data.earnings[0];
    render(<PayslipDocument data={{ ...data, earnings: [
      { ...source, id: "day-one", amountVnd: 100000, amountFormatted: "100.000 VND" },
      { ...source, id: "day-two", amountVnd: 200000, amountFormatted: "200.000 VND" },
    ] }} />);
    const group = screen.getByRole("region", { name: "Lương theo công" });
    expect(within(group).getAllByText("Lương công offline")).toHaveLength(1);
    expect(within(group).getAllByText("300.000 VND")).toHaveLength(2);
    expect(within(group).queryByText("100.000 VND")).not.toBeInTheDocument();
  });
  it("TEST 1 & 12: renders complete payslip document with correct Vietnamese typography and brand hierarchy", () => {
    const data = makeDocumentData();
    render(<PayslipDocument data={data} />);

    // Header
    expect(
      screen.getByRole("heading", { name: /Trung Tâm Toán Thầy Vinh/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Học Toán tư duy - Làm chủ tương lai"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Phiếu Lương" }),
    ).toBeInTheDocument();
    expect(screen.getByText("THÁNG 07/2026")).toBeInTheDocument();
    expect(screen.getByText("01/07/2026 – 31/07/2026")).toBeInTheDocument();
    expect(screen.getByText("28/08/2026")).toBeInTheDocument();

    // Employee Card
    expect(screen.getAllByText("Trần Văn Linh").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Trợ lý vận hành").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("NV17")).toBeInTheDocument();
    expect(screen.getByText("•••• •••• 0011")).toBeInTheDocument();
    expect(screen.getByText("Techcombank")).toBeInTheDocument();

    // Income Overview Card
    expect(screen.getByText("Tổng thu nhập")).toBeInTheDocument();
    expect(screen.getAllByText("11.826.000 VND").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Tổng bù trừ & khấu trừ")).toBeInTheDocument();
    expect(screen.getAllByText(/2\.350\.000 VND/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("9.476.000 VND").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Chín triệu bốn trăm bảy mươi sáu nghìn đồng chẵn/),
    ).toBeInTheDocument();

    // Line tables
    expect(screen.getByRole("heading", { name: "Thu nhập" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bù trừ & khấu trừ" })).toBeInTheDocument();
    expect(screen.getAllByText("Lương công offline")[0]).toBeInTheDocument();
    expect(screen.getByText("Thưởng chấm bài")).toBeInTheDocument();
    expect(screen.getByText("Thưởng doanh thu")).toBeInTheDocument();
    expect(screen.getByText("Khấu trừ tạm ứng")).toBeInTheDocument();

    // Breakdowns
    expect(screen.getByText("CHI TIẾT CÔNG & GIỜ LÀM")).toBeInTheDocument();
    expect(screen.getByText("CHI TIẾT CHẤM BÀI")).toBeInTheDocument();
    expect(screen.getByText("CHI TIẾT THƯỞNG DOANH THU & HOA HỒNG")).toBeInTheDocument();

    // Notes & Footer
    expect(
      screen.getByText(
        /Phiếu lương này được lập tự động từ hệ thống ERP Trung tâm Toán Thầy Vinh/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Người nhận lương")).toBeInTheDocument();
    expect(
      screen.getByText("TRUNG TÂM TOÁN THẦY VINH · ERP VẬN HÀNH"),
    ).toBeInTheDocument();
  });

  it("TEST 5: hides breakdown sections when no data exists (Empty state suppression)", () => {
    const data = makeDocumentData({
      breakdowns: {
        commissions: [],
        grading: null,
        workHours: [],
      },
    });

    render(<PayslipDocument data={data} />);

    expect(screen.queryByText("CHI TIẾT CÔNG & GIỜ LÀM")).not.toBeInTheDocument();
    expect(screen.queryByText("CHI TIẾT CHẤM BÀI")).not.toBeInTheDocument();
    expect(
      screen.queryByText("CHI TIẾT THƯỞNG DOANH THU & HOA HỒNG"),
    ).not.toBeInTheDocument();
  });

  it("TEST 13: renders properly without crashing on long employee names and multiple lines", () => {
    const longName =
      "Nguyễn Hoàng Đình Bảo Trâm Phan Vũ Gia Khiêm Long Hải";
    const data = makeDocumentData({
      employee: {
        avatarUrl: null,
        bankAccount: null,
        department: null,
        displayName: longName,
        employeeCode: "NV999999",
        joinedAt: null,
        positionLabel: "Trưởng phòng Quản lý chất lượng đào tạo và phát triển chương trình",
        staffId: "long-id-12345",
      },
    });

    render(<PayslipDocument data={data} />);

    expect(screen.getAllByText(longName).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("NV999999")).toBeInTheDocument();
  });

  it("TEST 14: renders BẢN NHÁP watermark and badge when period status is draft", () => {
    const data = makeDocumentData({
      period: {
        ...makeDocumentData().period,
        status: "draft",
        statusLabel: "Bản nháp",
      },
    });

    render(<PayslipDocument data={data} />);

    expect(screen.getByText("BẢN NHÁP")).toBeInTheDocument();
  });

  it("TEST 15: does NOT render BẢN NHÁP watermark when period status is approved", () => {
    const data = makeDocumentData({
      period: {
        ...makeDocumentData().period,
        status: "approved",
        statusLabel: "Đã duyệt & khóa",
      },
    });

    render(<PayslipDocument data={data} />);

    expect(screen.queryByText("BẢN NHÁP")).not.toBeInTheDocument();
    expect(screen.getByText("Đã duyệt & khóa")).toBeInTheDocument();
  });

  it("renders PayslipToolbar with Print and PDF Download actions", () => {
    render(
      <PayslipToolbar pdfDownloadUrl="/payroll/period-1/statements/stmt-1/payslip/pdf" />,
    );

    expect(screen.getByText("Quay lại bảng lương")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /In phiếu lương/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xuất PDF/ })).toHaveAttribute(
      "href",
      "/payroll/period-1/statements/stmt-1/payslip/pdf",
    );
  });
});
