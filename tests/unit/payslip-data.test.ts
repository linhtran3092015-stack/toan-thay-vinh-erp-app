import { describe, expect, it, vi } from "vitest";

import {
  getPayslipDocumentData,
  getPayslipPdfFilename,
} from "@/features/payroll/payslip/payslip-data";
import { generatePayslipPdf } from "@/features/payroll/payslip/pdf-generator";
import type { PayrollPeriodRead } from "@/features/payroll/read-models";

const mockPermissions = vi.fn();
const mockAuthUser = vi.fn();
const mockPeriods = vi.fn();
const mockSupabaseClient = vi.fn();

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: () => mockPermissions(),
}));

vi.mock("@/features/auth/current-user", () => ({
  getCurrentAuthUser: () => mockAuthUser(),
}));

vi.mock("@/features/payroll/data", () => ({
  getPayrollPeriodsWithDetailsResult: () => mockPeriods(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockSupabaseClient(),
}));

const testPeriodId = "11111111-1111-4111-8111-111111111111";
const testStatementId = "22222222-2222-4222-8222-222222222222";
const staffId = "33333333-3333-4333-8333-333333333333";

const samplePeriod: PayrollPeriodRead = {
  blockingIssueCount: 0,
  currentRevision: 2,
  feedbackClosedAt: null,
  feedbackOpenedAt: "2026-07-15T00:00:00Z",
  id: testPeriodId,
  lastCalculatedAt: "2026-07-28T08:00:00Z",
  payDate: "2026-08-28",
  pendingCorrectionCount: 0,
  periodMonth: "2026-07-01",
  statements: [
    {
      id: testStatementId,
      lines: [
        {
          amountVnd: 6_000_000,
          direction: "earning",
          evidenceSnapshot: {},
          formulaSnapshot: {
            daily_rate_vnd: 200_000,
            minutes_per_day: 480,
            worked_minutes: 14_400,
          },
          id: "line-earning-1",
          lineType: "base_offline",
          note: "Lương công offline chuẩn",
          payrollStatementId: testStatementId,
          policyCode: "POL-01",
          quantity: 30,
          sourceKind: "timekeeping",
          unitCount: 30,
          unitLabel: "ngày",
          unitRateVnd: 200_000,
          workMinutes: 14_400,
        },
        {
          amountVnd: 500_000,
          direction: "earning",
          evidenceSnapshot: {},
          formulaSnapshot: {},
          id: "line-reward-1",
          lineType: "manual_reward",
          note: "Thưởng hỗ trợ dự án",
          payrollStatementId: testStatementId,
          policyCode: null,
          quantity: null,
          sourceKind: "manual_adjustment",
          unitCount: null,
          unitLabel: null,
          unitRateVnd: null,
          workMinutes: null,
        },
        {
          amountVnd: 200_000,
          direction: "deduction",
          evidenceSnapshot: {},
          formulaSnapshot: {},
          id: "line-deduction-1",
          lineType: "manual_deduction",
          note: "Khấu trừ đi muộn",
          payrollStatementId: testStatementId,
          policyCode: null,
          quantity: null,
          sourceKind: "manual_adjustment",
          unitCount: null,
          unitLabel: null,
          unitRateVnd: null,
          workMinutes: null,
        },
      ],
      payableAmountVnd: 6_300_000,
      payrollPeriodId: testPeriodId,
      staffDisplayName: "Trần Văn Linh",
      staffEmployeeCode: "NV17",
      staffId: staffId,
      totalDeductionsVnd: 200_000,
      totalEarningsVnd: 6_500_000,
      workHours: 240,
      workMinutes: 14_400,
      workUnits: 30,
    },
  ],
  status: "draft",
};

describe("getPayslipDocumentData", () => {
  it("TEST 1: returns normalized payslip data for CURRENT statement with math integrity", async () => {
    mockPermissions.mockResolvedValue({
      ok: true,
      permissions: ["payroll.view", "payroll.manage"],
    });
    mockAuthUser.mockResolvedValue({
      ok: true,
      user: { id: "admin-user" },
    });
    mockPeriods.mockResolvedValue({
      data: [samplePeriod],
      ok: true,
    });
    mockSupabaseClient.mockResolvedValue({
      from: () => ({
        insert: () => Promise.resolve({ error: null }),
        select: () => ({
          eq: () => ({
            limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
            maybeSingle: () => Promise.resolve({ data: null }),
            order: () => ({
              limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
            }),
          }),
        }),
      }),
    });

    const result = await getPayslipDocumentData(testPeriodId, testStatementId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // TEST 1: Current statement rendering
    expect(result.data.employee.displayName).toBe("Trần Văn Linh");
    expect(result.data.employee.employeeCode).toBe("NV17");
    expect(result.data.period.periodMonthFormatted).toBe("THÁNG 07/2026");
    expect(result.data.period.status).toBe("draft");

    // TEST 11: Gross - Deductions = Net consistency
    expect(result.data.totals.grossVnd).toBe(6_500_000);
    expect(result.data.totals.totalDeductionsVnd).toBe(200_000);
    expect(result.data.totals.netVnd).toBe(6_300_000);
    expect(
      result.data.totals.grossVnd - result.data.totals.totalDeductionsVnd,
    ).toBe(result.data.totals.netVnd);
    expect(result.data.totals.amountInWords).toBe(
      "Sáu triệu ba trăm nghìn đồng chẵn./.",
    );

    // TEST 3: Manual reward appears in earnings
    const reward = result.data.earnings.find(
      (e) => e.lineType === "manual_reward",
    );
    expect(reward).toBeDefined();
    expect(reward?.amountVnd).toBe(500_000);

    // TEST 4: Manual deduction appears in deductions
    const deduction = result.data.deductions.find(
      (d) => d.lineType === "manual_deduction",
    );
    expect(deduction).toBeDefined();
    expect(deduction?.amountVnd).toBe(200_000);

    // TEST 5: No grading line -> grading breakdown is null
    expect(result.data.breakdowns.grading).toBeNull();

    // TEST 6: Work hours breakdown has accurate numbers
    expect(result.data.breakdowns.workHours).toHaveLength(1);
    expect(result.data.breakdowns.workHours[0].dailyRateVnd).toBe(200_000);
    expect(result.data.breakdowns.workHours[0].subtotalVnd).toBe(6_000_000);
  });

  it("TEST 2: detects STALE statement and reports STATEMENT_STALE with current statement ID", async () => {
    const staleStatementId = "stale-statement-uuid-9999";
    mockPermissions.mockResolvedValue({
      ok: true,
      permissions: ["payroll.view", "payroll.manage"],
    });
    mockAuthUser.mockResolvedValue({
      ok: true,
      user: { id: "admin-user" },
    });
    mockPeriods.mockResolvedValue({
      data: [samplePeriod],
      ok: true,
    });
    mockSupabaseClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  calculation_run_id: "old-run-uuid",
                  id: staleStatementId,
                  payroll_period_id: testPeriodId,
                  staff_id: staffId,
                },
              }),
          }),
        }),
      }),
    });

    const result = await getPayslipDocumentData(testPeriodId, staleStatementId);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe("STATEMENT_STALE");
    expect(result.suggestedCurrentStatementId).toBe(testStatementId);
  });

  it("TEST 7: Admin / Payroll manager can view any staff's payslip", async () => {
    mockPermissions.mockResolvedValue({
      ok: true,
      permissions: ["payroll.view", "payroll.manage"],
    });
    mockAuthUser.mockResolvedValue({
      ok: true,
      user: { id: "admin-other-uuid" },
    });
    mockPeriods.mockResolvedValue({
      data: [samplePeriod],
      ok: true,
    });
    mockSupabaseClient.mockResolvedValue({
      from: () => ({
        insert: () => Promise.resolve({ error: null }),
        select: () => ({
          eq: () => ({
            limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
            maybeSingle: () => Promise.resolve({ data: null }),
            order: () => ({
              limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
            }),
          }),
        }),
      }),
    });

    const result = await getPayslipDocumentData(testPeriodId, testStatementId);

    expect(result.ok).toBe(true);
  });

  it("TEST 8: Non-manager staff cannot view another staff's payslip (IDOR rejected server-side)", async () => {
    mockPermissions.mockResolvedValue({
      ok: true,
      permissions: ["payroll.view"], // Only view permission, no manage/reconcile/approve
    });
    mockAuthUser.mockResolvedValue({
      ok: true,
      user: { id: "different-staff-uuid" }, // Not matching statement staffId
    });
    mockPeriods.mockResolvedValue({
      data: [samplePeriod],
      ok: true,
    });

    const result = await getPayslipDocumentData(testPeriodId, testStatementId);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe("PERMISSION_DENIED");
    expect(result.message).toContain("không có quyền xem phiếu lương");
  });

  it("TEST 9 & 10: generates valid PDF binary and correct filename convention", () => {
    const documentData = {
      breakdowns: {
        commissions: [],
        grading: null,
        workHours: [],
      },
      deductions: [],
      earnings: [],
      employee: {
        avatarUrl: null,
        bankAccount: {
          accountHolderName: "TRAN VAN LINH",
          accountNumberMasked: "•••• •••• 0011",
          bankName: "Techcombank",
        },
        department: null,
        displayName: "Trần Văn Linh",
        employeeCode: "NV17",
        joinedAt: null,
        positionLabel: "Trợ lý vận hành",
        staffId: "staff-12345678",
      },
      isStale: false,
      period: {
        currentRevision: 1,
        feedbackClosedAt: null,
        feedbackOpenedAt: null,
        id: "period-1",
        lastCalculatedAt: null,
        payDate: "2026-08-28",
        payDateFormatted: "28/08/2026",
        periodEndDate: "31/07/2026",
        periodMonth: "2026-07-01",
        periodMonthFormatted: "THÁNG 07/2026",
        periodStartDate: "01/07/2026",
        status: "draft",
        statusLabel: "Bản nháp",
      },
      statementId: "statement-1",
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

    // TEST 10: Filename convention
    const filename = getPayslipPdfFilename(documentData);
    expect(filename).toBe("Phieu-luong-NV17-2026-07.pdf");

    // TEST 9: PDF binary starts with %PDF-1.4
    const pdfBinary = generatePayslipPdf(documentData);
    expect(ArrayBuffer.isView(pdfBinary)).toBe(true);
    expect(pdfBinary.byteLength).toBeGreaterThan(100);
    const pdfHeader = new TextDecoder().decode(pdfBinary.slice(0, 8));
    expect(pdfHeader).toContain("%PDF-1.4");
  });
});
