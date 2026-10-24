import { describe, expect, it, vi } from "vitest";

import {
  getPayslipDocumentData,
  getPayslipPdfFilename,
} from "@/features/payroll/payslip/payslip-data";
import { generatePayslipPdf } from "@/features/payroll/payslip/pdf-generator";
import type { PayrollPeriodRead } from "@/features/payroll/read-models";

const mockPermissions = vi.fn();
const mockAuthUser = vi.fn();
const mockStatementDetails = vi.fn();
const mockSupabaseClient = vi.fn();

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: () => mockPermissions(),
}));

vi.mock("@/features/auth/current-user", () => ({
  getCurrentAuthUser: () => mockAuthUser(),
}));

vi.mock("@/features/payroll/data", () => ({
  getPayrollStatementDetailsResult: (...args: unknown[]) => mockStatementDetails(...args),
}));

/** What the scoped statement read returns: the period with only the requested statement. */
function statementDetails(
  periods: PayrollPeriodRead[],
  staleStatement: { currentStatementId: string | null } | null = null,
) {
  return { data: { olderPeriodCount: 0, periods, staleStatement }, ok: true as const };
}

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

function emptySupabaseClient() {
  return {
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
      select: () => ({
        eq: () => ({
          limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
          maybeSingle: () => Promise.resolve({ data: null }),
          order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
        }),
      }),
    }),
  };
}

/** A lương cứng + lương khoán statement: 900.000 of bonuses, a 900.000 offset whose snapshot records `pieceworkVnd`. */
function pieceworkPeriod(pieceworkVnd: number): PayrollPeriodRead {
  const base = samplePeriod.statements[0].lines[0];
  const plain = { formulaSnapshot: {}, note: null, quantity: null, unitCount: null, unitLabel: null, unitRateVnd: null, workMinutes: null };
  return {
    ...samplePeriod,
    statements: [{
      ...samplePeriod.statements[0],
      lines: [
        { ...base, amountVnd: 1_500_000, id: "p-base" },
        { ...base, ...plain, amountVnd: 900_000, id: "p-renewal", lineType: "operations_grade_renewal_bonus" },
        {
          ...base,
          ...plain,
          amountVnd: 900_000,
          direction: "deduction",
          formulaSnapshot: { base_salary_vnd: 1_500_000, basis_points: 8_500, piecework_vnd: pieceworkVnd },
          id: "p-offset",
          lineType: "piecework_offset",
        },
      ],
      payableAmountVnd: 1_500_000,
      totalDeductionsVnd: 900_000,
      totalEarningsVnd: 2_400_000,
    }],
  };
}

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
    mockStatementDetails.mockResolvedValue(statementDetails([samplePeriod]));
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

    // TEST 11: Gross - Deductions = Net consistency. The manual deduction is a
    // correction netted into income, so "Khấu trừ" keeps real deductions only.
    expect(result.data.totals.grossVnd).toBe(6_300_000);
    expect(result.data.totals.totalDeductionsVnd).toBe(0);
    expect(result.data.totals.netVnd).toBe(6_300_000);
    expect(
      result.data.totals.grossVnd - result.data.totals.totalDeductionsVnd,
    ).toBe(result.data.totals.netVnd);
    expect(result.data.totals.amountInWords).toBe(
      "Sáu triệu ba trăm nghìn đồng chẵn./.",
    );

    // TEST 3: Manual reward appears under adjustments, not earnings
    const reward = result.data.adjustments.find(
      (e) => e.lineType === "manual_reward",
    );
    expect(reward).toBeDefined();
    expect(reward?.amountVnd).toBe(500_000);
    expect(result.data.earnings.some((e) => e.lineType === "manual_reward")).toBe(false);

    // TEST 4: Manual deduction appears under adjustments, not deductions
    const deduction = result.data.adjustments.find(
      (d) => d.lineType === "manual_deduction",
    );
    expect(deduction).toBeDefined();
    expect(deduction?.amountVnd).toBe(200_000);
    expect(result.data.deductions).toHaveLength(0);
    expect(result.data.piecework).toBeNull();

    // TEST 5: No grading line -> grading breakdown is null
    expect(result.data.breakdowns.grading).toBeNull();

    // TEST 6: Work hours breakdown has accurate numbers
    expect(result.data.breakdowns.workHours).toHaveLength(1);
    expect(result.data.breakdowns.workHours[0].dailyRateVnd).toBe(200_000);
    expect(result.data.breakdowns.workHours[0].subtotalVnd).toBe(6_000_000);
  });

  it("TEST 2: detects STALE statement and reports STATEMENT_STALE with current statement ID", async () => {
    const staleStatementId = "99999999-9999-4999-8999-999999999999";
    mockPermissions.mockResolvedValue({
      ok: true,
      permissions: ["payroll.view", "payroll.manage"],
    });
    mockAuthUser.mockResolvedValue({
      ok: true,
      user: { id: "admin-user" },
    });
    // The reader returns the period without the old statement and points at the current one.
    mockStatementDetails.mockResolvedValue(
      statementDetails([{ ...samplePeriod, statements: [] }], { currentStatementId: testStatementId }),
    );

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
    mockStatementDetails.mockResolvedValue(statementDetails([samplePeriod]));
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
    mockStatementDetails.mockResolvedValue(statementDetails([samplePeriod]));

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
      adjustments: [],
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
      piecework: null,
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

  // Value: protects=for a statement from a period calculation run (offset snapshot key `base_floor_basis_points`), the loader keeps the piecework offset out of `deductions`, builds the lương khoán summary with its threshold, and reports display totals that still reconcile to the stored payable;
  // fails_when=the `piecework_offset` filter on deductionLines is dropped (the offset is listed twice: in Lương khoán and under Khấu trừ), the `base_floor_basis_points` fallback is removed (the threshold disappears from every period-run payslip), or gross/deductions stop netting the offset;
  // why_new=the loader tests only cover manual lines (piecework is null there); payslip-sections tests only use the live-estimate key `basis_points`;
  // seam=module mocks for permissions, auth, periods and the Supabase client (same as TEST 1); no_claim=does not prove the engine's offset amount or the shape of older run snapshots beyond migration 20260915170000
  it("TEST 11: keeps the piecework offset out of deductions and summarizes lương khoán from a period-run snapshot", async () => {
    mockPermissions.mockResolvedValue({ ok: true, permissions: ["payroll.view", "payroll.manage"] });
    mockAuthUser.mockResolvedValue({ ok: true, user: { id: "admin-user" } });
    const base = samplePeriod.statements[0].lines[0];
    mockStatementDetails.mockResolvedValue(statementDetails([{
        ...samplePeriod,
        statements: [{
          ...samplePeriod.statements[0],
          lines: [
            { ...base, amountVnd: 1_500_000, id: "p-base" },
            { ...base, amountVnd: 900_000, formulaSnapshot: {}, id: "p-renewal", lineType: "operations_grade_renewal_bonus", note: null, quantity: null, unitCount: null, unitLabel: null, unitRateVnd: null, workMinutes: null },
            {
              ...base,
              amountVnd: 900_000,
              direction: "deduction",
              formulaSnapshot: { base_floor_basis_points: 8_500, base_salary_vnd: 1_500_000, offset_vnd: 900_000, piecework_vnd: 900_000, position_code: "operations_assistant" },
              id: "p-offset",
              lineType: "piecework_offset",
              note: "Bù trừ lương khoán đến ngưỡng 85% lương cứng.",
              quantity: null,
              unitCount: null,
              unitLabel: null,
              unitRateVnd: null,
              workMinutes: null,
            },
            { ...base, amountVnd: 200_000, direction: "deduction", formulaSnapshot: {}, id: "p-advance", lineType: "advance_deduction", note: null, quantity: null, unitCount: null, unitLabel: null, unitRateVnd: null, workMinutes: null },
          ],
          payableAmountVnd: 1_300_000,
          totalDeductionsVnd: 1_100_000,
          totalEarningsVnd: 2_400_000,
        }],
      }]));
    mockSupabaseClient.mockResolvedValue({
      from: () => ({
        insert: () => Promise.resolve({ error: null }),
        select: () => ({
          eq: () => ({
            limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
            maybeSingle: () => Promise.resolve({ data: null }),
            order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
          }),
        }),
      }),
    });

    const result = await getPayslipDocumentData(testPeriodId, testStatementId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deductions.map((line) => line.lineType)).toEqual(["advance_deduction"]);
    expect(result.data.earnings.map((line) => line.lineType)).toEqual(["base_offline", "operations_grade_renewal_bonus"]);
    expect(result.data.adjustments).toEqual([]);
    expect(result.data.piecework).toEqual({
      absorbedVnd: 900_000,
      addedVnd: 0,
      baseSalaryVnd: 1_500_000,
      earnedVnd: 900_000,
      floorBasisPoints: 8_500,
      kind: "summary",
      thresholdVnd: 1_275_000,
    });
    expect(result.data.totals.grossVnd).toBe(1_500_000);
    expect(result.data.totals.totalDeductionsVnd).toBe(200_000);
    expect(result.data.totals.grossVnd - result.data.totals.totalDeductionsVnd).toBe(result.data.totals.netVnd);
  });

  // Value: protects=the payslip page and PDF read only the requested statement (period id + statement id) instead of every period's lines;
  // fails_when=the loader goes back to a whole-history read or swaps the two ids;
  // why_new=the scoped read replaces the paged all-periods read of v0.39;
  // seam=@/features/payroll/data mocked; no_claim=does not prove the RPC's own filtering (pgTAP payroll-period-details covers it)
  it("TEST 13: reads only the requested statement", async () => {
    mockPermissions.mockResolvedValue({ ok: true, permissions: ["payroll.view", "payroll.manage"] });
    mockAuthUser.mockResolvedValue({ ok: true, user: { id: "admin-user" } });
    mockStatementDetails.mockResolvedValue(statementDetails([samplePeriod]));
    mockSupabaseClient.mockResolvedValue(emptySupabaseClient());

    await getPayslipDocumentData(testPeriodId, testStatementId);

    expect(mockStatementDetails).toHaveBeenLastCalledWith(testPeriodId, testStatementId);
  });

  // Value: protects=a statement whose lines did not add up to its totals on both reads is not rendered or printed;
  // fails_when=the loader maps the "unreconciled" failure to a rendered payslip or to the generic read error;
  // why_new=reconciliation is new: totals on the payslip are summed from lines;
  // seam=@/features/payroll/data mocked to return the reconcile failure; no_claim=the re-read itself is covered in payroll-period-details-data.test.ts
  it("TEST 14: fails closed when the statement lines do not reconcile", async () => {
    mockPermissions.mockResolvedValue({ ok: true, permissions: ["payroll.view", "payroll.manage"] });
    mockAuthUser.mockResolvedValue({ ok: true, user: { id: "admin-user" } });
    mockStatementDetails.mockResolvedValue({ ok: false, reason: "unreconciled" });

    const result = await getPayslipDocumentData(testPeriodId, testStatementId);

    expect(result).toMatchObject({ error: "STATEMENT_CALCULATION_MISMATCH", ok: false });
  });

  // Value: protects=a printed payslip never shows lương khoán below the part already paid in lương cứng (a negative "cộng thêm");
  // fails_when=summarizePiecework stops flagging a negative added amount, or the loader renders the payslip anyway;
  // why_new=v0.39 printed earned − absorbed even when negative;
  // seam=module mocks as in TEST 11; no_claim=does not cover the /payroll dialog or live card (component tests do)
  it("TEST 15: fails closed when lương khoán is below the offset", async () => {
    mockPermissions.mockResolvedValue({ ok: true, permissions: ["payroll.view", "payroll.manage"] });
    mockAuthUser.mockResolvedValue({ ok: true, user: { id: "admin-user" } });
    mockSupabaseClient.mockResolvedValue(emptySupabaseClient());
    mockStatementDetails.mockResolvedValue(statementDetails([pieceworkPeriod(600_000)]));

    const result = await getPayslipDocumentData(testPeriodId, testStatementId);

    expect(result).toMatchObject({ error: "STATEMENT_CALCULATION_MISMATCH", ok: false });
  });

  // Value: protects=the printed Lương khoán section adds up: the engine's piecework_vnd is used when it equals the listed rows, and a payslip whose rows disagree (hourly pay the engine counted, a missing line) is refused;
  // fails_when=the loader prints a snapshot figure the listed rows do not reach (LUONG KHOAN subtotal ≠ rows − offset) or ignores a matching snapshot;
  // why_new=the snapshot rule is new, and the engine counts hourly_wage while the payslip lists it under Lương theo công;
  // seam=module mocks as in TEST 11; no_claim=does not prove which lines the engine counted
  it("TEST 16: uses the offset snapshot when it matches the listed rows and refuses when it does not", async () => {
    mockPermissions.mockResolvedValue({ ok: true, permissions: ["payroll.view", "payroll.manage"] });
    mockAuthUser.mockResolvedValue({ ok: true, user: { id: "admin-user" } });
    mockSupabaseClient.mockResolvedValue(emptySupabaseClient());
    mockStatementDetails.mockResolvedValueOnce(statementDetails([pieceworkPeriod(900_000)]));

    const result = await getPayslipDocumentData(testPeriodId, testStatementId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.piecework).toMatchObject({ absorbedVnd: 900_000, addedVnd: 0, earnedVnd: 900_000, kind: "summary" });

    // The engine's 1.000.000 also counts 100.000 of hourly pay listed under Lương theo công.
    const period = pieceworkPeriod(1_000_000);
    const statement = period.statements[0];
    const hourly = { ...statement.lines[0], amountVnd: 100_000, id: "p-hourly", lineType: "hourly_wage" };
    mockStatementDetails.mockResolvedValueOnce(statementDetails([{
      ...period,
      statements: [{ ...statement, lines: [...statement.lines, hourly], payableAmountVnd: 1_600_000, totalEarningsVnd: 2_500_000 }],
    }]));
    expect(await getPayslipDocumentData(testPeriodId, testStatementId)).toMatchObject({ error: "STATEMENT_CALCULATION_MISMATCH", ok: false });
  });

  // Generated by /ship test coverage audit (pass 1).
  // Value: protects=a failed statement read stays "không tải được" (PDF 404) and a statement the reader neither returns nor reports stale is STATEMENT_NOT_FOUND;
  // fails_when=the loader maps reason "unavailable" to STATEMENT_CALCULATION_MISMATCH (an outage would ask for a recalculation) or treats staleStatement null as stale;
  // why_new=TEST 14 covers only reason "unreconciled", and no test reaches STATEMENT_NOT_FOUND since the stale lookup moved into the reader;
  // seam=none; no_claim=@/features/payroll/data is mocked; does not prove when the RPC reports staleStatement (pgTAP payroll-period-details does)
  it("TEST 17: reports a failed read and an unknown statement as not found, not as a mismatch or a stale revision", async () => {
    mockPermissions.mockResolvedValue({ ok: true, permissions: ["payroll.view", "payroll.manage"] });
    mockAuthUser.mockResolvedValue({ ok: true, user: { id: "admin-user" } });

    mockStatementDetails.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    expect(await getPayslipDocumentData(testPeriodId, testStatementId)).toMatchObject({ error: "PERIOD_NOT_FOUND", ok: false });

    mockStatementDetails.mockResolvedValueOnce(statementDetails([{ ...samplePeriod, statements: [] }], null));
    const missing = await getPayslipDocumentData(testPeriodId, testStatementId);
    expect(missing).toMatchObject({ error: "STATEMENT_NOT_FOUND", ok: false });
    expect(missing).not.toHaveProperty("suggestedCurrentStatementId");

    // Extended by /ship test coverage audit (pass 2).
    // Value: protects=a payslip link to a period the reader does not return (not visible to this viewer, or gone) is "Không tìm thấy kỳ lương yêu cầu.", not a crash;
    // fails_when=the loader takes the scoped read's periods[0] without checking it (TypeError on [], a 500) or reports the empty read as STATEMENT_NOT_FOUND / a read failure;
    // why_new=every other case here returns the requested period, so the !period branch was never reached;
    // seam=none; no_claim=@/features/payroll/data is mocked; when the RPC returns no period is pgTAP's (ordinary viewer cannot read a period without their statement)
    mockStatementDetails.mockResolvedValueOnce(statementDetails([], null));
    expect(await getPayslipDocumentData(testPeriodId, testStatementId)).toEqual({
      error: "PERIOD_NOT_FOUND",
      message: "Không tìm thấy kỳ lương yêu cầu.",
      ok: false,
    });
  });

  // Generated by /ship test coverage audit (pass 2).
  // Value: protects=a payslip request without a session or without payroll.view still gets NOT_AUTHENTICATED / PERMISSION_DENIED (PDF 401/403) now that the read runs alongside those checks;
  // fails_when=the loader drops its own payroll.view check because the RPC enforces it, or handles the read result before the session checks (both give PERIOD_NOT_FOUND, a 404);
  // why_new=no loader test reaches NOT_AUTHENTICATED or the payroll.view denial; before this change the read started only after both checks passed;
  // seam=none; no_claim=permissions, auth and @/features/payroll/data are mocked (the read fails as the RPC's 42501 would); the RPC's own refusal is pgTAP's
  it("TEST 19: session checks still decide the result while the statement read runs alongside them", async () => {
    mockStatementDetails.mockResolvedValue({ ok: false, reason: "unavailable" });

    mockPermissions.mockResolvedValueOnce({ ok: true, permissions: ["payroll.view"] });
    mockAuthUser.mockResolvedValueOnce({ error: "session_expired", ok: false });
    expect(await getPayslipDocumentData(testPeriodId, testStatementId)).toMatchObject({ error: "NOT_AUTHENTICATED", ok: false });

    mockPermissions.mockResolvedValueOnce({ ok: true, permissions: [] });
    mockAuthUser.mockResolvedValueOnce({ ok: true, user: { id: staffId } });
    expect(await getPayslipDocumentData(testPeriodId, testStatementId)).toEqual({
      error: "PERMISSION_DENIED",
      message: "Tài khoản hiện tại không có quyền xem phiếu lương.",
      ok: false,
    });
  });

  // Value: protects=a payslip link whose ids are not uuids reads as "không tìm thấy", not as a system failure, and never reaches the uuid-typed read;
  // fails_when=the loader passes a malformed id to the RPC (Postgres 22P02 → reason "unavailable" → "Không tải được phiếu lương") or swaps the period/statement errors;
  // why_new=the old loader searched periods in memory, so a bad id was simply not found;
  // seam=@/features/payroll/data mocked; no_claim=does not prove Postgres's uuid parsing (the pattern accepts what the routes generate)
  it("TEST 18: treats a malformed period or statement id as not found without reading", async () => {
    mockPermissions.mockResolvedValue({ ok: true, permissions: ["payroll.view", "payroll.manage"] });
    mockAuthUser.mockResolvedValue({ ok: true, user: { id: "admin-user" } });
    mockStatementDetails.mockClear();

    expect(await getPayslipDocumentData("not-a-period", testStatementId)).toMatchObject({ error: "PERIOD_NOT_FOUND", message: "Không tìm thấy kỳ lương yêu cầu.", ok: false });
    expect(await getPayslipDocumentData(testPeriodId, "statement-x")).toMatchObject({ error: "STATEMENT_NOT_FOUND", ok: false });
    expect(mockStatementDetails).not.toHaveBeenCalled();
  });

  // Value: protects=the downloaded PDF payslip lists the 85% floor inside "LUONG KHOAN", manual corrections under "DIEU CHINH", and keeps "KHAU TRU" to real deductions (advances);
  // fails_when=the PDF stops rendering `adjustments` (manual lines vanish from the printed payslip), the offset row moves back under KHAU TRU, or LUONG KHOAN loses its offset row;
  // why_new=the only PDF test checks the %PDF header of an empty payslip, so none of the new PDF sections is asserted;
  // seam=none (pure generator; the content stream is uncompressed text); no_claim=does not check layout coordinates or page breaks
  it("TEST 12: PDF shows lương khoán and điều chỉnh under income, advances only under KHAU TRU", () => {
    const item = (id: string, lineType: string, label: string, amountVnd: number, direction: "earning" | "deduction" = "earning") => ({
      amountFormatted: `${new Intl.NumberFormat("vi-VN").format(amountVnd)} VND`,
      amountVnd,
      direction,
      formulaExplanation: null,
      id,
      label,
      lineType,
      note: null,
      quantity: null,
      unitLabel: null,
      unitRateFormatted: null,
      unitRateVnd: null,
    });
    const pdf = new TextDecoder().decode(generatePayslipPdf({
      adjustments: [
        item("a1", "manual_reward", "Điều chỉnh tăng", 80_000),
        item("a2", "manual_deduction", "Điều chỉnh giảm", 50_000, "deduction"),
      ],
      breakdowns: { commissions: [], grading: null, workHours: [] },
      deductions: [item("d1", "advance_deduction", "Khấu trừ tạm ứng", 200_000, "deduction")],
      earnings: [
        item("e1", "base_offline", "Lương công offline", 1_500_000),
        item("e2", "operations_grade_renewal_bonus", "Thưởng tái phí khối phụ trách", 900_000),
      ],
      employee: { avatarUrl: null, bankAccount: null, department: null, displayName: "Trần Văn Linh", employeeCode: "NV17", joinedAt: null, positionLabel: "Trợ lý vận hành", staffId: "staff-1" },
      isStale: false,
      period: { currentRevision: 1, feedbackClosedAt: null, feedbackOpenedAt: null, id: "period-1", lastCalculatedAt: null, payDate: "2026-10-05", payDateFormatted: "05/10/2026", periodEndDate: "30/09/2026", periodMonth: "2026-09-01", periodMonthFormatted: "THÁNG 09/2026", periodStartDate: "01/09/2026", status: "draft", statusLabel: "Bản nháp" },
      piecework: { absorbedVnd: 900_000, addedVnd: 0, baseSalaryVnd: 1_500_000, earnedVnd: 900_000, floorBasisPoints: 8_500, kind: "summary", thresholdVnd: 1_275_000 },
      statementId: "statement-1",
      totals: { amountInWords: "-", grossFormatted: "1.530.000 VND", grossVnd: 1_530_000, netFormatted: "1.330.000 VND", netVnd: 1_330_000, totalDeductionsFormatted: "200.000 VND", totalDeductionsVnd: 200_000, workHours: 0, workMinutes: 0, workUnits: 0 },
    }));

    const income = pdf.slice(pdf.indexOf("(LUONG THEO CONG)"), pdf.indexOf("(TONG THU NHAP)"));
    const deductions = pdf.slice(pdf.indexOf("(KHAU TRU)"), pdf.indexOf("(TONG KHAU TRU)"));

    expect(income).toContain("(LUONG KHOAN)");
    expect(income).toContain("(Thuong tai phi khoi phu trach)");
    expect(income).toContain("(Phan luong khoan da tinh trong luong cung)");
    expect(income).toContain("(-900.000 VND)");
    expect(income).toContain("(DIEU CHINH)");
    expect(income).toContain("(Dieu chinh tang)");
    expect(income).toContain("(Dieu chinh giam)");
    expect(income).toContain("(-50.000 VND)");
    expect(deductions).toContain("(Khau tru tam ung)");
    expect(deductions).not.toMatch(/luong khoan|Dieu chinh/i);
  });
});

type PayslipPdfData = Parameters<typeof generatePayslipPdf>[0];

function pdfItem(id: string, lineType: string, label: string, amountVnd: number, direction: "earning" | "deduction" = "earning", note: string | null = null) {
  return {
    amountFormatted: `${new Intl.NumberFormat("vi-VN").format(amountVnd)} VND`,
    amountVnd,
    direction,
    formulaExplanation: null,
    id,
    label,
    lineType,
    note,
    quantity: null,
    unitLabel: null,
    unitRateFormatted: null,
    unitRateVnd: null,
  };
}

function pdfData(overrides: Partial<PayslipPdfData>): PayslipPdfData {
  return {
    adjustments: [],
    breakdowns: { commissions: [], grading: null, workHours: [] },
    deductions: [],
    earnings: [pdfItem("e1", "base_offline", "Lương công offline", 2_400_000)],
    employee: { avatarUrl: null, bankAccount: null, department: null, displayName: "Nhân sự mẫu", employeeCode: "NV90", joinedAt: null, positionLabel: "Trợ lý vận hành", staffId: "staff-90" },
    isStale: false,
    period: { currentRevision: 1, feedbackClosedAt: null, feedbackOpenedAt: null, id: "period-1", lastCalculatedAt: null, payDate: "2026-10-05", payDateFormatted: "05/10/2026", periodEndDate: "30/09/2026", periodMonth: "2026-09-01", periodMonthFormatted: "THÁNG 09/2026", periodStartDate: "01/09/2026", status: "draft", statusLabel: "Bản nháp" },
    piecework: null,
    statementId: "statement-1",
    // The generator prints these as given; only the sections are under test here.
    totals: { amountInWords: "-", grossFormatted: "0 VND", grossVnd: 0, netFormatted: "0 VND", netVnd: 0, totalDeductionsFormatted: "0 VND", totalDeductionsVnd: 0, workHours: 0, workMinutes: 0, workUnits: 0 },
    ...overrides,
  };
}

/** Text operands drawn from the `title` heading up to the `end` heading, unescaped, in drawing order. */
function pdfSectionTexts(data: PayslipPdfData, title: string, end: string): string[] {
  const pdf = new TextDecoder().decode(generatePayslipPdf(data));
  const start = pdf.indexOf(`(${title}) Tj`);
  const stop = pdf.indexOf(`(${end}) Tj`, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(stop).toBeGreaterThan(start);
  return [...pdf.slice(start, stop).matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((match) => match[1].replace(/\\(.)/g, "$1"));
}

describe("generatePayslipPdf sections", () => {
  // Value: protects=above the floor, the PDF "LUONG KHOAN" subtotal is the part added on top of lương cứng (addedVnd), followed by the offset row and the explanation of what was added;
  // fails_when=renderSection ignores `subtotal` and prints the bonus sum (2.800.000 VND), the offset extra row is dropped, or the footnote is not drawn after it;
  // why_new=TEST 12 is below the floor (addedVnd 0) and never reads the subtotal, so a subtotal of 0 or of the bonus sum passes it;
  // seam=none (pure generator; the content stream is uncompressed text); no_claim=does not check wrapping width or page breaks
  it("subtotals LUONG KHOAN above the floor with the amount added and explains it after the offset row", () => {
    const texts = pdfSectionTexts(pdfData({
      earnings: [
        pdfItem("k1", "base_offline", "Lương công offline", 2_100_000),
        pdfItem("k2", "base_online", "Lương công online", 300_000),
        pdfItem("k3", "center_renewal_duty_bonus", "Thưởng quản lý và trực tin nhắn", 1_200_000),
        pdfItem("k4", "operations_grade_renewal_bonus", "Thưởng tái phí khối phụ trách", 1_075_000),
        pdfItem("k5", "payroll_processing_bonus", "Thưởng tính lương nhân sự", 525_000),
      ],
      piecework: { absorbedVnd: 2_040_000, addedVnd: 760_000, baseSalaryVnd: 2_400_000, earnedVnd: 2_800_000, floorBasisPoints: 8_500, kind: "summary", thresholdVnd: 2_040_000 },
    }), "LUONG KHOAN", "TONG THU NHAP");

    expect(texts.slice(0, 2)).toEqual(["LUONG KHOAN", "760.000 VND"]);
    const offset = texts.indexOf("Phan luong khoan da tinh trong luong cung");
    expect(offset).toBeGreaterThan(1);
    expect(texts[offset + 1]).toBe("-2.040.000 VND");
    expect(texts.slice(offset + 2).join(" ")).toBe(
      "Luong khoan dat 2.800.000 VND. Phan den 85% luong cung (2.400.000 VND x 85% = 2.040.000 VND) da duoc tra trong luong cung; phan vuot 760.000 VND duoc cong them.",
    );
  });

  // Value: protects=when manual decreases outweigh increases the PDF "DIEU CHINH" subtotal is a signed net decrease;
  // fails_when=the subtotal sums amounts without direction (70.000 VND) or loses the minus sign of a negative net (30.000 VND);
  // why_new=TEST 12's corrections net positive and its assertions never read the DIEU CHINH subtotal;
  // seam=none (pure generator); no_claim=does not check the TONG THU NHAP figure, which the loader supplies
  it("signs a net-negative DIEU CHINH subtotal", () => {
    const texts = pdfSectionTexts(pdfData({
      adjustments: [
        pdfItem("a1", "manual_reward", "Điều chỉnh tăng", 20_000),
        pdfItem("a2", "manual_deduction", "Điều chỉnh giảm", 50_000, "deduction"),
      ],
    }), "DIEU CHINH", "TONG THU NHAP");

    expect(texts).toEqual(["DIEU CHINH", "-30.000 VND", "Dieu chinh tang", "20.000 VND", "Dieu chinh giam", "-50.000 VND"]);
  });

  // Value: protects=each manual correction in the PDF keeps its own row with the manager's note under it, even when two share a line type;
  // fails_when=DIEU CHINH stops passing `perLine` (lines are grouped into one "Dieu chinh tang 390.000 VND" row) or the per-line branch stops drawing `note`;
  // why_new=TEST 12 has one correction per type and no notes, so grouped and per-line output looked the same;
  // seam=none (pure generator); no_claim=does not check how long notes wrap
  it("lists each correction on its own row with its note", () => {
    const texts = pdfSectionTexts(pdfData({
      adjustments: [
        pdfItem("a1", "manual_reward", "Điều chỉnh tăng", 150_000, "earning", "Phụ cấp điện thoại tháng 9"),
        pdfItem("a2", "manual_reward", "Điều chỉnh tăng", 240_000, "earning", "Hỗ trợ đi lại sự kiện tuyển sinh"),
      ],
    }), "DIEU CHINH", "TONG THU NHAP");

    expect(texts).toEqual([
      "DIEU CHINH", "390.000 VND",
      "Dieu chinh tang", "150.000 VND", "Phu cap dien thoai thang 9",
      "Dieu chinh tang", "240.000 VND", "Ho tro di lai su kien tuyen sinh",
    ]);
  });

  // Value: protects=on a lương khoán PDF every bonus, grading included, is drawn once inside LUONG KHOAN, never again under CHAM BAI or THUONG & PHU CAP;
  // fails_when=the PDF's CHAM BAI or THUONG & PHU CAP filter goes back to line type alone, so a bonus is drawn twice;
  // why_new=the PDF piecework fixtures had no grading_bonus line;
  // seam=none (pure generator); no_claim=does not check the TONG THU NHAP figure, which the loader supplies
  it("draws grading and other bonuses only inside LUONG KHOAN", () => {
    const pdf = new TextDecoder().decode(generatePayslipPdf(pdfData({
      earnings: [
        pdfItem("g1", "base_offline", "Lương công offline", 1_500_000),
        pdfItem("g2", "grading_bonus", "Thưởng chấm bài", 244_660),
        pdfItem("g3", "operations_grade_renewal_bonus", "Thưởng tái phí khối phụ trách", 700_000),
      ],
      piecework: { absorbedVnd: 900_000, addedVnd: 0, baseSalaryVnd: 1_500_000, earnedVnd: 900_000, floorBasisPoints: 8_500, kind: "summary", thresholdVnd: 1_275_000 },
    })));

    expect(pdf).not.toContain("(CHAM BAI) Tj");
    expect(pdf).not.toContain("(THUONG & PHU CAP) Tj");
    expect(pdf.match(/\(Thuong cham bai\) Tj/g)).toHaveLength(1);
    expect(pdf.match(/\(Thuong tai phi khoi phu trach\) Tj/g)).toHaveLength(1);
  });

  // Value: protects=long correction notes wrap onto further pages without dropping words or drawing into the footer band (y < 100);
  // fails_when=addWrapped stops calling ensureSpace before each line, or the page break drops the line that triggered it;
  // why_new=notes of up to 2.000 characters now print, and no PDF test produced a second page;
  // seam=none (pure generator); no_claim=does not render glyph widths
  it("wraps long correction notes across pages without dropping words", () => {
    const note = Array.from({ length: 300 }, (_, index) => `tu${index}`).join(" ");
    const pdf = new TextDecoder().decode(generatePayslipPdf(pdfData({
      adjustments: Array.from({ length: 4 }, (_, index) => pdfItem(`a${index}`, "manual_reward", "Điều chỉnh tăng", 10_000, "earning", note)),
    })));

    expect(Number(/\/Count (\d+)/.exec(pdf)?.[1])).toBeGreaterThan(1);
    const noteRows = [...pdf.matchAll(/BT \/F1 8 Tf 70 (-?[\d.]+) Td \(([^)]*)\) Tj/g)];
    expect(Math.min(...noteRows.map((match) => Number(match[1])))).toBeGreaterThanOrEqual(100);
    expect(noteRows.flatMap((match) => match[2].split(" "))).toHaveLength(4 * 300);
  });

  // Value: protects=every character drawn in the PDF is printable ASCII, which Helvetica under /WinAnsiEncoding shows as written;
  // fails_when=toAsciiReadable stops mapping "×", "−", "–", curly quotes or "…" (the lương khoán explanation and manager notes then print as "Ã—" and similar), or lets any other non-ASCII byte through;
  // why_new=the PDF now prints the lương khoán explanation (which contains "×") and free-text manager notes, and the content stream is written as UTF-8 bytes;
  // seam=none (pure generator); no_claim=does not render the PDF in a viewer
  it("draws only printable ASCII bytes, mapping ×, dashes and quotes", () => {
    const bytes = generatePayslipPdf(pdfData({
      adjustments: [pdfItem("a1", "manual_reward", "Điều chỉnh tăng", 150_000, "earning", "Phụ cấp “điện thoại” 10 ca × 15.000 – tháng 9…")],
      piecework: { absorbedVnd: 2_040_000, addedVnd: 760_000, baseSalaryVnd: 2_400_000, earnedVnd: 2_800_000, floorBasisPoints: 8_500, kind: "summary", thresholdVnd: 2_040_000 },
    }));

    expect([...bytes].filter((byte) => byte > 0x7e)).toEqual([]);
    expect(pdfSectionTexts(pdfData({
      adjustments: [pdfItem("a1", "manual_reward", "Điều chỉnh tăng", 150_000, "earning", "Phụ cấp “điện thoại” 10 ca × 15.000 – tháng 9…")],
    }), "DIEU CHINH", "TONG THU NHAP")).toContain('Phu cap "dien thoai" 10 ca x 15.000 - thang 9...');
  });

  // Value: protects=a manager note cannot close a PDF string or inject content-stream operators: "(", ")" and "\" stay escaped inside the Tj literal;
  // fails_when=escapePdfText stops escaping the backslash or the parentheses, or addWrapped draws a note without escaping it;
  // why_new=manager notes are the first free text printed into the PDF content stream;
  // seam=none (pure generator); no_claim=does not parse the PDF with a real reader
  it("keeps parentheses and backslashes in a note escaped", () => {
    const pdf = new TextDecoder().decode(generatePayslipPdf(pdfData({
      adjustments: [pdfItem("a1", "manual_reward", "Điều chỉnh tăng", 150_000, "earning", "ca (bù) ngày 11\\9) Tj ET")],
    })));

    expect(pdf).toContain("(ca \\(bu\\) ngay 11\\\\9\\) Tj ET) Tj");
  });

  // Value: protects=a note with no spaces (a pasted link) is cut into line-sized pieces instead of running off the page;
  // fails_when=addWrapped stops splitting words longer than a line (90 characters), so one Tj draws all 250 characters;
  // why_new=notes can be up to 2.000 characters and were never printed before;
  // seam=none (pure generator); no_claim=does not measure glyph widths
  it("splits a note word longer than a line", () => {
    const texts = pdfSectionTexts(pdfData({
      adjustments: [pdfItem("a1", "manual_reward", "Điều chỉnh tăng", 150_000, "earning", "x".repeat(250))],
    }), "DIEU CHINH", "TONG THU NHAP");

    expect(texts.slice(4)).toEqual(["x".repeat(90), "x".repeat(90), "x".repeat(70)]);
  });

  // Value: protects=the PDF prints the deduction totals with the same minus sign as the deduction rows (and as the HTML payslip);
  // fails_when="Khau tru:" or "TONG KHAU TRU" go back to the unsigned total while the KHAU TRU rows are signed;
  // why_new=deduction rows became signed in this change; the totals were still unsigned;
  // seam=none (pure generator); no_claim=does not check a zero total beyond the unsigned "0 VND"
  it("signs the deduction totals like the deduction rows", () => {
    const pdf = new TextDecoder().decode(generatePayslipPdf(pdfData({
      deductions: [pdfItem("d1", "advance_deduction", "Khấu trừ tạm ứng", 500_000, "deduction")],
      totals: { amountInWords: "-", grossFormatted: "0 VND", grossVnd: 0, netFormatted: "0 VND", netVnd: 0, totalDeductionsFormatted: "500.000 VND", totalDeductionsVnd: 500_000, workHours: 0, workMinutes: 0, workUnits: 0 },
    })));

    expect(pdf).toContain("(Khau tru: -500.000 VND) Tj");
    expect(pdf).toMatch(/\(TONG KHAU TRU\) Tj ET\nBT \/F2 10 Tf 435 \d+ Td \(-500.000 VND\) Tj/);
  });
});
