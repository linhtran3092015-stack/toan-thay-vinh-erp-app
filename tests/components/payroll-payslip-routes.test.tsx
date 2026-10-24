import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PayslipPageRoute from "@/app/(app)/payroll/[periodId]/statements/[statementId]/payslip/page";
import { GET as payslipPdfRouteHandler } from "@/app/(app)/payroll/[periodId]/statements/[statementId]/payslip/pdf/route";
import type { NextRequest } from "next/server";

const mockGetPayslipDocumentData = vi.fn();
const mockRedirect = vi.fn();

vi.mock("@/features/payroll/payslip/payslip-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/payroll/payslip/payslip-data")>();
  return {
    ...actual,
    getPayslipDocumentData: (...args: unknown[]) => mockGetPayslipDocumentData(...args),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

const mockDocData = {
  breakdowns: {
    commissions: [],
    grading: null,
    workHours: [],
  },
  adjustments: [],
  deductions: [],
  earnings: [],
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
    staffId: "staff-nv17",
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
  piecework: null,
  statementId: "stmt-uuid-1",
  totals: {
    amountInWords: "Mười triệu đồng chẵn./.",
    grossFormatted: "10.000.000 VND",
    grossVnd: 10_000_000,
    netFormatted: "10.000.000 VND",
    netVnd: 10_000_000,
    totalDeductionsFormatted: "0 VND",
    totalDeductionsVnd: 0,
    workHours: 160,
    workMinutes: 9_600,
    workUnits: 20,
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PayslipPageRoute", () => {
  it("renders payslip page successfully when statement data is valid and authorized", async () => {
    mockGetPayslipDocumentData.mockResolvedValueOnce({
      data: mockDocData,
      ok: true,
    });

    const page = await PayslipPageRoute({
      params: Promise.resolve({
        periodId: "period-uuid-1",
        statementId: "stmt-uuid-1",
      }),
    });

    render(page);

    expect(
      screen.getByRole("heading", { name: /Trung Tâm Toán Thầy Vinh/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Trần Văn Linh").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("NV17")).toBeInTheDocument();
    expect(screen.getByText("Quay lại bảng lương")).toBeInTheDocument();
  });

  it("redirects to CURRENT statement when accessing a stale statement revision", async () => {
    mockGetPayslipDocumentData.mockResolvedValueOnce({
      error: "STATEMENT_STALE",
      message: "Phiếu lương thuộc phiên bản tính cũ.",
      ok: false,
      suggestedCurrentStatementId: "current-stmt-uuid-2",
    });

    await PayslipPageRoute({
      params: Promise.resolve({
        periodId: "period-uuid-1",
        statementId: "old-stale-stmt",
      }),
    });

    expect(mockRedirect).toHaveBeenCalledWith(
      "/payroll/period-uuid-1/statements/current-stmt-uuid-2/payslip",
    );
  });

  it("renders PermissionDeniedState when access is unauthorized", async () => {
    mockGetPayslipDocumentData.mockResolvedValueOnce({
      error: "PERMISSION_DENIED",
      message: "Bạn không có quyền xem phiếu lương của nhân sự khác.",
      ok: false,
    });

    const page = await PayslipPageRoute({
      params: Promise.resolve({
        periodId: "period-uuid-1",
        statementId: "unauthorized-stmt",
      }),
    });

    render(page);

    expect(screen.getByText("Không có quyền xem phiếu lương")).toBeInTheDocument();
    expect(
      screen.getByText("Bạn không có quyền xem phiếu lương của nhân sự khác."),
    ).toBeInTheDocument();
  });

  it("renders ErrorState when period or statement is not found", async () => {
    mockGetPayslipDocumentData.mockResolvedValueOnce({
      error: "STATEMENT_NOT_FOUND",
      message: "Không tìm thấy phiếu lương của nhân sự.",
      ok: false,
    });

    const page = await PayslipPageRoute({
      params: Promise.resolve({
        periodId: "period-uuid-1",
        statementId: "nonexistent-stmt",
      }),
    });

    render(page);

    expect(screen.getByText("Không tải được phiếu lương")).toBeInTheDocument();
  });
});

describe("Payslip PDF Route Handler", () => {
  it("TEST 9 & 10: returns 200 with application/pdf and Content-Disposition attachment", async () => {
    mockGetPayslipDocumentData.mockResolvedValueOnce({
      data: mockDocData,
      ok: true,
    });

    const response = await payslipPdfRouteHandler(
      {} as NextRequest,
      {
        params: Promise.resolve({
          periodId: "period-uuid-1",
          statementId: "stmt-uuid-1",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Phieu-luong-NV17-2026-07.pdf"',
    );

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    expect(bytes.length).toBeGreaterThan(100);
    const header = new TextDecoder().decode(bytes.slice(0, 8));
    expect(header).toContain("%PDF-1.4");
  });

  it("returns 403 when PDF export is unauthorized", async () => {
    mockGetPayslipDocumentData.mockResolvedValueOnce({
      error: "PERMISSION_DENIED",
      message: "Từ chối quyền truy cập.",
      ok: false,
    });

    const response = await payslipPdfRouteHandler(
      {} as NextRequest,
      {
        params: Promise.resolve({
          periodId: "period-uuid-1",
          statementId: "stmt-uuid-1",
        }),
      },
    );

    expect(response.status).toBe(403);
  });

  // Value: protects=a payslip whose lines do not reconcile is refused as a conflict (409), not served as a PDF or reported as missing;
  // fails_when=the route maps STATEMENT_CALCULATION_MISMATCH to 404 or renders the PDF;
  // why_new=the loader now fails closed on unreconciled lines;
  // seam=getPayslipDocumentData mocked; no_claim=does not cover when the loader returns this error (payslip-data.test does)
  it("returns 409 when the statement lines do not reconcile", async () => {
    mockGetPayslipDocumentData.mockResolvedValueOnce({
      error: "STATEMENT_CALCULATION_MISMATCH",
      message: "Các dòng lương chưa khớp với tổng của phiếu lương.",
      ok: false,
    });

    const response = await payslipPdfRouteHandler(
      {} as NextRequest,
      {
        params: Promise.resolve({
          periodId: "period-uuid-1",
          statementId: "stmt-uuid-1",
        }),
      },
    );

    expect(response.status).toBe(409);
  });
});
