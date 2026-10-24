import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PayrollDailyBreakdownTable } from "@/features/payroll/estimate/components/payroll-daily-breakdown-table";
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

afterEach(() => {
  cleanup();
});

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
    shifts: [],
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
    // Position codes are shown as Vietnamese labels, never raw codes.
    expect(screen.getByText("Trợ giảng")).toBeInTheDocument();
    expect(screen.queryByText("teaching_assistant")).not.toBeInTheDocument();
  });

  it("renders retry button when fetch fails and estimate is null", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<StaffLiveEstimateCard initialEstimate={null} month="2026-09-01" />);

    const retryBtn = await screen.findByRole("button", { name: /thử lại/i });
    expect(retryBtn).toBeInTheDocument();
    expect(screen.getByText(/chưa tải được dữ liệu lương tạm tính/i)).toBeInTheDocument();
  });

  // Value: protects="Xem nguồn công gần nhất" reads each shift's pay state with the same helper and labels as the daily ledger: an unverified shift with no time_entry pay line is "Chưa tính · chưa xác minh" (never "đã tính tạm"), and a shift with a linked base line is "Đã xác minh";
  // fails_when=the recent-shifts list again labels every unverified shift "Chờ xác minh · đã tính tạm" from isPendingVerification alone, so one shift reads "đã tính tạm" there and "Chưa tính" in the ledger;
  // why_new=review pass 3 (fix 3): the list used its own label outside the ledger's pay-state logic;
  // seam=fetch stubbed to never resolve so the card keeps the initial estimate; no_claim=does not cover the realtime refresh
  // Also protects=shift times in Vietnam time, and the card's "đã tính vào số tạm tính" banner counts only shifts with a provisional pay line; fails_when=the list slices UTC ISO strings again, or the banner uses the raw statement count while the list says "Chưa tính".
  it("labels recent shifts with the ledger's pay state", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    try {
      const unpaidId = "a0000000-0000-4000-8000-000000000011";
      const paidId = "a0000000-0000-4000-8000-000000000012";
      const user = userEvent.setup();
      render(
        <StaffLiveEstimateCard
          initialEstimate={{
            ...mockStaffEstimate,
            lines: [{ ...mockStaffEstimate.lines[0], sourceId: paidId, sourceKind: "time_entry", workDate: "2026-09-17" }],
            // The RPC counts every pending entry, including one with no pay line.
            statement: mockStaffEstimate.statement ? { ...mockStaffEstimate.statement, pendingVerificationCount: 1 } : null,
            shifts: [
              { checkInAt: "2026-09-18T08:00:00Z", checkOutAt: "2026-09-18T11:00:00Z", id: unpaidId, isPendingVerification: true, status: "checked_out", workDate: "2026-09-18", workedMinutes: 180, workMode: "offline" },
            ],
            recentShifts: [
              { ...mockStaffEstimate.recentShifts[0], id: unpaidId, isPendingVerification: true, workDate: "2026-09-18" },
              { ...mockStaffEstimate.recentShifts[0], id: paidId, isPendingVerification: false, workDate: "2026-09-17" },
            ],
          }}
          month="2026-09-01"
          today="2026-09-18"
        />,
      );

      await user.click(screen.getByRole("button", { name: /Xem nguồn công gần nhất/ }));
      const recent = screen.getByRole("columnheader", { name: "Trạng thái xác minh" }).closest("table") as HTMLElement;
      const rows = within(recent).getAllByRole("row").slice(1);
      expect(rows[0]).toHaveTextContent("Chưa tính · chưa xác minh");
      expect(rows[1]).toHaveTextContent("Đã xác minh");
      expect(recent).not.toHaveTextContent(/tính tạm/);
      // Shift times read in Vietnam time (08:00Z = 15:00), not the UTC slice of the ISO string.
      expect(rows[0]).toHaveTextContent("(15:00–");
      expect(rows[0]).not.toHaveTextContent("(08:00–");
      // The pending banner counts only shifts actually in provisional pay (none here).
      expect(screen.queryByText(/đã tính vào số tạm tính/)).not.toBeInTheDocument();
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  // Value: protects=the home live estimate card of a staff member on lương cứng + lương khoán shows a "Lương khoán" row (earned, part inside lương cứng, amount added), manual corrections as one net "Điều chỉnh" row, "Tổng thu nhập" net of both, and only the advance under deductions, so Tổng thu nhập − tạm ứng = Lương tạm tính;
  // fails_when=the card goes back to statement.totalDeductionsVnd (a "Khấu trừ khác" row shows the offset and the manual deduction as cuts), "Tổng thu nhập" uses the stored totalEarningsVnd, or manual lines fall back into "Thưởng & Hoa hồng";
  // why_new=existing card fixtures have no offset, manual or advance line, so the old and new card render the same;
  // seam=fetch stubbed to never resolve so the card keeps the initial estimate; no_claim=does not prove the estimate engine's offset or advance amounts
  it("shows lương khoán and corrections as income, and only the advance as a deduction", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    try {
      const monthly = { note: null, policyCode: null, unitLabel: null, unitRateVnd: null, workDate: "2026-09-01", workedMinutes: null };
      render(
        <StaffLiveEstimateCard
          initialEstimate={{
            ...mockStaffEstimate,
            lines: [
              { ...mockStaffEstimate.lines[0], amountVnd: 1_500_000 },
              { ...monthly, amountVnd: 900_000, direction: "earning", lineType: "operations_grade_renewal_bonus" },
              { ...monthly, amountVnd: 900_000, direction: "deduction", lineType: "piecework_offset", note: "Bù trừ lương khoán đến ngưỡng 85% lương cứng.", sourceKind: "piecework_floor" },
              { ...monthly, amountVnd: 80_000, direction: "earning", lineType: "manual_reward", note: "Phụ cấp ăn tối" },
              { ...monthly, amountVnd: 50_000, direction: "deduction", lineType: "manual_deduction", note: "Trả lại phần tính dư" },
              { ...monthly, amountVnd: 200_000, direction: "deduction", lineType: "advance_deduction", sourceKind: "salary_advance" },
            ],
            statement: mockStaffEstimate.statement ? {
              ...mockStaffEstimate.statement,
              advanceDeductionsVnd: 200_000,
              payableVnd: 1_330_000,
              positionCode: "operations_assistant",
              totalDeductionsVnd: 1_150_000,
              totalEarningsVnd: 2_480_000,
            } : null,
          }}
          month="2026-09-01"
          today="2026-09-18"
        />,
      );

      const table = screen.getByRole("columnheader", { name: "Khoản lương" }).closest("table") as HTMLElement;
      const row = (label: string) => within(table).getByText(label).closest("tr") as HTMLElement;

      expect(row("Lương khoán")).toHaveTextContent("Đạt 900.000 VND; 900.000 VND đã nằm trong lương cứng");
      expect(row("Lương khoán")).toHaveTextContent("Không phải khoản bị trừ.");
      expect(row("Lương khoán").lastElementChild).toHaveTextContent("0 VND");
      expect(row("Điều chỉnh")).toHaveTextContent("2 khoản điều chỉnh tăng hoặc giảm");
      expect(row("Điều chỉnh").lastElementChild).toHaveTextContent("30.000 VND");
      expect(row("Tổng thu nhập").lastElementChild).toHaveTextContent("1.530.000 VND");
      expect(row("Khấu trừ tạm ứng").lastElementChild).toHaveTextContent("−200.000 VND");
      expect(row("Lương tạm tính").lastElementChild).toHaveTextContent("1.330.000 VND");
      expect(within(table).queryByText("Khấu trừ khác")).not.toBeInTheDocument();
      expect(within(table).queryByText("Thưởng & Hoa hồng")).not.toBeInTheDocument();
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  // Value: protects=the home card never shows a negative "Lương khoán" amount: when the offset exceeds the bonuses it read, it warns instead;
  // fails_when=the card prints piecework.addedVnd for a mismatch (−500.000 VND) or keeps the "Đạt … đã nằm trong lương cứng" sentence;
  // why_new=summarizePiecework now reports a negative added amount as a mismatch;
  // seam=fetch stubbed to never resolve so the card keeps the initial estimate; no_claim=does not prove why the estimate lines disagree
  it("warns instead of showing a negative lương khoán", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    try {
      const monthly = { note: null, policyCode: null, unitLabel: null, unitRateVnd: null, workDate: "2026-09-01", workedMinutes: null };
      render(
        <StaffLiveEstimateCard
          initialEstimate={{
            ...mockStaffEstimate,
            lines: [
              { ...mockStaffEstimate.lines[0], amountVnd: 1_500_000 },
              { ...monthly, amountVnd: 400_000, direction: "earning", lineType: "operations_grade_renewal_bonus" },
              { ...monthly, amountVnd: 900_000, direction: "deduction", lineType: "piecework_offset", sourceKind: "piecework_floor" },
            ],
            statement: mockStaffEstimate.statement ? {
              ...mockStaffEstimate.statement,
              payableVnd: 1_000_000,
              positionCode: "operations_assistant",
              totalDeductionsVnd: 900_000,
              totalEarningsVnd: 1_900_000,
            } : null,
          }}
          month="2026-09-01"
          today="2026-09-18"
        />,
      );

      const table = screen.getByRole("columnheader", { name: "Khoản lương" }).closest("table") as HTMLElement;
      const row = within(table).getByText("Lương khoán").closest("tr") as HTMLElement;
      expect(row).toHaveTextContent("Lương khoán tạm tính chưa khớp với phần đã trả trong lương cứng; số liệu sẽ được đối chiếu khi chốt kỳ lương.");
      expect(row).not.toHaveTextContent("đã nằm trong lương cứng");
      expect(row.lastElementChild).toHaveTextContent("—");
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  // Value: protects=on the home card, manual decreases that outweigh increases read as one signed net "Điều chỉnh" row;
  // fails_when=the Điều chỉnh row sums amounts without direction (70.000 VND) or drops the minus sign of a negative net (30.000 VND);
  // why_new=the existing card fixture nets positive (80.000 − 50.000), so the negative branch never renders;
  // seam=fetch stubbed to never resolve so the card keeps the initial estimate; no_claim=does not prove the estimate engine's manual lines
  it("signs a net-negative Điều chỉnh row", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    try {
      const monthly = { note: null, policyCode: null, unitLabel: null, unitRateVnd: null, workDate: "2026-09-01", workedMinutes: null };
      render(
        <StaffLiveEstimateCard
          initialEstimate={{
            ...mockStaffEstimate,
            lines: [
              mockStaffEstimate.lines[0],
              { ...monthly, amountVnd: 20_000, direction: "earning", lineType: "manual_reward", note: "Phụ cấp gửi xe" },
              { ...monthly, amountVnd: 50_000, direction: "deduction", lineType: "manual_deduction", note: "Trả lại phần tính dư" },
            ],
            statement: mockStaffEstimate.statement ? {
              ...mockStaffEstimate.statement,
              payableVnd: 470_000,
              totalDeductionsVnd: 50_000,
              totalEarningsVnd: 520_000,
            } : null,
          }}
          month="2026-09-01"
          today="2026-09-18"
        />,
      );

      const table = screen.getByRole("columnheader", { name: "Khoản lương" }).closest("table") as HTMLElement;
      const row = (label: string) => within(table).getByText(label).closest("tr") as HTMLElement;
      expect(row("Điều chỉnh").lastElementChild?.textContent).toBe("−30.000 VND");
      expect(row("Tổng thu nhập").lastElementChild?.textContent).toBe("470.000 VND");
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  // Value: protects=a staff member with a piecework offset and a teaching allowance (moved from trợ giảng to vận hành in the month) sees the allowance inside "Lương khoán" with the bonuses it names, no separate "Phụ cấp trợ giảng" row, the grading caveat, and rows above "Tổng thu nhập" that add up to it;
  // fails_when=the "Phụ cấp trợ giảng" row renders alongside "Lương khoán" (the allowance is counted twice and the rows no longer add up), the Lương khoán labels are built from bonusLines (the allowance is not named), or the grading caveat is dropped from the Lương khoán row;
  // why_new=the existing piecework card fixture has neither a teaching allowance nor a grading bonus, so the `!piecework` guard and the caveat never run there;
  // seam=fetch stubbed to never resolve so the card keeps the initial estimate; no_claim=does not prove the engine counts the allowance as lương khoán
  it("keeps a teaching allowance inside lương khoán so the rows add up to Tổng thu nhập", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    try {
      const monthly = { note: null, policyCode: null, unitLabel: null, unitRateVnd: null, workDate: "2026-09-01", workedMinutes: null };
      render(
        <StaffLiveEstimateCard
          initialEstimate={{
            ...mockStaffEstimate,
            lines: [
              { ...mockStaffEstimate.lines[0], amountVnd: 1_200_000 },
              { ...monthly, amountVnd: 150_000, direction: "earning", lineType: "teaching_allowance", workDate: "2026-09-03" },
              { ...monthly, amountVnd: 900_000, direction: "earning", lineType: "operations_grade_renewal_bonus" },
              { ...monthly, amountVnd: 100_000, direction: "earning", lineType: "grading_bonus" },
              { ...monthly, amountVnd: 1_020_000, direction: "deduction", lineType: "piecework_offset", note: "Bù trừ lương khoán đến ngưỡng 85% lương cứng.", sourceKind: "piecework_floor" },
            ],
            statement: mockStaffEstimate.statement ? {
              ...mockStaffEstimate.statement,
              payableVnd: 1_330_000,
              positionCode: "operations_assistant",
              totalDeductionsVnd: 1_020_000,
              totalEarningsVnd: 2_350_000,
            } : null,
          }}
          month="2026-09-01"
          today="2026-09-18"
        />,
      );

      const table = screen.getByRole("columnheader", { name: "Khoản lương" }).closest("table") as HTMLElement;
      const bodyRows = within(table).getAllByRole("row").slice(1);
      const totalIndex = bodyRows.findIndex((row) => row.firstElementChild?.textContent === "Tổng thu nhập");
      const incomeRows = bodyRows.slice(0, totalIndex);
      const amount = (row: HTMLElement) => Number((row.lastElementChild?.textContent ?? "").replace(/\D/g, ""));

      expect(incomeRows.map((row) => row.firstElementChild?.textContent)).toEqual(["Lương theo công", "Lương khoán"]);
      expect(incomeRows.map(amount)).toEqual([1_200_000, 130_000]);
      expect(amount(bodyRows[totalIndex])).toBe(1_330_000);
      expect(incomeRows.reduce((sum, row) => sum + amount(row), 0)).toBe(amount(bodyRows[totalIndex]));

      const piecework = incomeRows[1];
      expect(piecework).toHaveTextContent("Phụ cấp trợ giảng, Thưởng tái phí khối phụ trách, Thưởng chấm bài");
      expect(piecework).toHaveTextContent("Đạt 1.150.000 VND; 1.020.000 VND đã nằm trong lương cứng");
      expect(piecework).toHaveTextContent("*Thưởng quỹ chấm bài tạm tính theo tỷ trọng hiện tại, có thể tăng hoặc giảm.");
      expect(within(table).queryByText("Phụ cấp trợ giảng")).not.toBeInTheDocument();
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
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

  // Value: protects=the owner live estimate (figures strip, staff row, position row, footer) shows income = payable + advances and Khấu trừ = advances only for a staff member whose stored deductions also hold the piecework offset and a manual deduction, so every surface reconciles to the payable;
  // fails_when=any of the four surfaces goes back to totalEarningsVnd / totalDeductionsVnd (the offset reappears as a deduction), or the position row reads advances from the wrong position;
  // why_new=every owner fixture has totalDeductionsVnd equal to advanceDeductionsVnd (or 0), so the old and new formulas render the same numbers;
  // seam=fetch stubbed to never resolve so the overview keeps the initial estimate; no_claim=does not prove the RPC's advance totals
  it("nets the piecework offset and manual deductions into income on every owner surface", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    try {
      const totals = { advanceDeductionsVnd: 200_000, payableVnd: 1_330_000, totalDeductionsVnd: 1_150_000, totalEarningsVnd: 2_480_000 };
      render(
        <OwnerLiveEstimateOverview
          initialEstimate={{
            ...mockOwnerEstimate,
            byPosition: [{ payableVnd: totals.payableVnd, positionCode: "operations_assistant", staffCount: 1, totalDeductionsVnd: totals.totalDeductionsVnd, totalEarningsVnd: totals.totalEarningsVnd }],
            finance: { status: "restricted" },
            statements: [{
              ...totals,
              pendingVerificationCount: 0,
              positionCode: "operations_assistant",
              staffDisplayName: "Trần Văn Linh",
              staffEmployeeCode: "NV17",
              staffId: "db57d08d-4cbf-42ba-84e8-20fd52c90599",
              workHours: 40,
              workUnits: 5,
              workedMinutes: 2_400,
            }],
            summary: { ...totals, pendingVerificationCount: 0, staffCount: 1 },
          }}
          month="2026-08-01"
        />,
      );

      const figures = screen.getByLabelText("Số liệu lương tạm tính");
      expect(figures).toHaveTextContent(/Tổng thu nhập\s*1\.530\.000/);
      expect(figures).toHaveTextContent(/Khấu trừ\s*−200\.000/);

      const staffRow = within(screen.getByRole("table", { name: /theo nhân sự/ })).getByText("Trần Văn Linh").closest("tr") as HTMLElement;
      expect(staffRow).toHaveTextContent(/Thu nhập\s*1\.530\.000/);
      expect(staffRow).toHaveTextContent(/Khấu trừ\s*−200\.000.*tạm ứng/);

      const positionRows = within(screen.getByRole("table", { name: /Tạm tính theo vị trí/ })).getAllByRole("row").slice(1);
      // The operations row and the "Tổng cộng" row.
      expect(positionRows).toHaveLength(2);
      for (const positionRow of positionRows) {
        expect(positionRow).toHaveTextContent(/1\.530\.000.*−200\.000.*1\.330\.000/);
      }

      expect(document.body).not.toHaveTextContent(/2\.480\.000|1\.150\.000/);
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  // Value: protects=with two positions, each "Tạm tính theo vị trí" row reads Thu nhập / Khấu trừ from its own staff's advances, and "Tổng cộng" equals the sum of the rows;
  // fails_when=advancesByPosition is keyed or summed wrongly (the trợ giảng row borrows the vận hành advance, or every row shows the summary advance), a row falls back to totalEarningsVnd / totalDeductionsVnd, or the total row stops adding the summary advance;
  // why_new=the existing owner fixture has a single position, so a row reading the summary advance renders the same numbers;
  // seam=fetch stubbed to never resolve so the overview keeps the initial estimate; no_claim=does not prove the RPC's per-position payable or the summary totals
  it("reads each position row's income and deductions from its own statements", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    try {
      const operations = { advanceDeductionsVnd: 200_000, payableVnd: 1_330_000, totalDeductionsVnd: 1_150_000, totalEarningsVnd: 2_480_000 };
      const teaching = { advanceDeductionsVnd: 0, payableVnd: 500_000, totalDeductionsVnd: 0, totalEarningsVnd: 500_000 };
      const statement = { pendingVerificationCount: 0, workHours: 40, workUnits: 5, workedMinutes: 2_400 };
      render(
        <OwnerLiveEstimateOverview
          initialEstimate={{
            ...mockOwnerEstimate,
            byPosition: [
              { payableVnd: operations.payableVnd, positionCode: "operations_assistant", staffCount: 1, totalDeductionsVnd: operations.totalDeductionsVnd, totalEarningsVnd: operations.totalEarningsVnd },
              { payableVnd: teaching.payableVnd, positionCode: "teaching_assistant", staffCount: 1, totalDeductionsVnd: teaching.totalDeductionsVnd, totalEarningsVnd: teaching.totalEarningsVnd },
            ],
            finance: { status: "restricted" },
            statements: [
              { ...operations, ...statement, positionCode: "operations_assistant", staffDisplayName: "Nhân sự vận hành", staffEmployeeCode: "NV81", staffId: "db57d08d-4cbf-42ba-84e8-20fd52c90581" },
              { ...teaching, ...statement, positionCode: "teaching_assistant", staffDisplayName: "Nhân sự trợ giảng", staffEmployeeCode: "NV82", staffId: "db57d08d-4cbf-42ba-84e8-20fd52c90582" },
            ],
            summary: {
              advanceDeductionsVnd: 200_000,
              payableVnd: 1_830_000,
              pendingVerificationCount: 0,
              staffCount: 2,
              totalDeductionsVnd: 1_150_000,
              totalEarningsVnd: 2_980_000,
            },
          }}
          month="2026-08-01"
        />,
      );

      const table = screen.getByRole("table", { name: /Tạm tính theo vị trí/ });
      const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent);
      const cells = (label: string) => {
        const cellsOfRow = (within(table).getByText(label).closest("tr") as HTMLTableRowElement).cells;
        return {
          deductions: cellsOfRow[headers.indexOf("Khấu trừ")].textContent,
          income: cellsOfRow[headers.indexOf("Thu nhập")].textContent,
          payable: cellsOfRow[headers.indexOf("Tạm tính phải trả")].textContent,
        };
      };
      const vnd = (text: string | null) => Number((text ?? "").replace(/[^\d]/g, "")) * ((text ?? "").startsWith("−") ? -1 : 1);

      const rows = [cells("Trợ lý vận hành"), cells("Trợ giảng")];
      expect(rows).toEqual([
        { deductions: "−200.000 ₫", income: "1.530.000 ₫", payable: "1.330.000 ₫" },
        { deductions: "0 ₫", income: "500.000 ₫", payable: "500.000 ₫" },
      ]);
      const total = cells("Tổng cộng");
      expect(total).toEqual({ deductions: "−200.000 ₫", income: "2.030.000 ₫", payable: "1.830.000 ₫" });
      for (const key of ["deductions", "income", "payable"] as const) {
        expect(vnd(total[key])).toBe(rows.reduce((sum, row) => sum + vnd(row[key]), 0));
      }
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  // Value: protects=the "Chưa phân loại" position row counts the advances of staff without a payroll position, so its Thu nhập and Khấu trừ reconcile to its payable like every other row;
  // fails_when=advancesByPosition skips statements without positionCode again (the row shows Khấu trừ 0 and Thu nhập equal to the payable);
  // why_new=the two-position fixture gives every statement a position, so the "__unassigned__" key never received an advance;
  // seam=fetch stubbed to never resolve so the overview keeps the initial estimate; no_claim=does not prove the RPC groups unassigned staff under "__unassigned__"
  it("adds advances of staff without a payroll position to the Chưa phân loại row", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    try {
      const unassigned = { advanceDeductionsVnd: 100_000, payableVnd: 400_000, totalDeductionsVnd: 100_000, totalEarningsVnd: 500_000 };
      render(
        <OwnerLiveEstimateOverview
          initialEstimate={{
            ...mockOwnerEstimate,
            byPosition: [{ payableVnd: unassigned.payableVnd, positionCode: "__unassigned__", staffCount: 1, totalDeductionsVnd: unassigned.totalDeductionsVnd, totalEarningsVnd: unassigned.totalEarningsVnd }],
            finance: { status: "restricted" },
            statements: [{
              ...unassigned,
              pendingVerificationCount: 0,
              positionCode: null,
              staffDisplayName: "Nhân sự chưa xếp vị trí",
              staffEmployeeCode: "NV83",
              staffId: "db57d08d-4cbf-42ba-84e8-20fd52c90583",
              workHours: 9,
              workUnits: 1,
              workedMinutes: 540,
            }],
            summary: { ...unassigned, pendingVerificationCount: 0, staffCount: 1 },
          }}
          month="2026-08-01"
        />,
      );

      const table = screen.getByRole("table", { name: /Tạm tính theo vị trí/ });
      const row = within(table).getByText("Chưa phân loại").closest("tr") as HTMLElement;
      expect(row).toHaveTextContent(/500\.000.*−100\.000.*400\.000/);
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it("renders retry button when fetch fails and estimate is null", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<OwnerLiveEstimateOverview initialEstimate={null} month="2026-08-01" />);

    const retryBtn = await screen.findByRole("button", { name: /thử lại/i });
    expect(retryBtn).toBeInTheDocument();
    expect(screen.getByText(/chưa tải được tổng quan lương tạm tính/i)).toBeInTheDocument();
  });
});

describe("PayrollDailyBreakdownTable", () => {
  const estimate: Pick<StaffPayrollEstimate, "lines" | "month" | "shifts" | "statement" | "status"> = {
    lines: [
      {
        amountVnd: 300000,
        direction: "earning",
        lineType: "base_offline",
        note: null,
        policyCode: "daily_base_salary",
        sourceId: "10000000-0000-4000-8000-000000000001",
        sourceKind: "time_entry",
        unitLabel: "phút",
        unitRateVnd: 300000,
        workDate: "2026-10-02",
        workedMinutes: 540,
      },
      {
        amountVnd: 50000,
        direction: "earning",
        lineType: "teaching_allowance",
        note: null,
        policyCode: "teaching_allowance",
        sourceId: "30000000-0000-4000-8000-000000000001",
        sourceKind: "payroll_source_fact",
        unitLabel: "lần",
        unitRateVnd: 50000,
        workDate: "2026-10-02",
        workedMinutes: null,
      },
      {
        amountVnd: 185741,
        direction: "deduction",
        lineType: "piecework_offset",
        note: "Bù trừ lương khoán đến ngưỡng 85% lương cứng.",
        policyCode: "operations_piecework_floor",
        sourceId: "2026-10-01:x",
        sourceKind: "piecework_floor",
        unitLabel: null,
        unitRateVnd: null,
        workDate: "2026-10-01",
        workedMinutes: null,
      },
    ],
    month: "2026-10-01",
    shifts: [
      {
        checkInAt: "2026-10-02T01:00:00Z",
        checkOutAt: "2026-10-02T10:00:00Z",
        id: "10000000-0000-4000-8000-000000000001",
        isPendingVerification: false,
        status: "checked_out",
        workDate: "2026-10-02",
        workedMinutes: 540,
        workMode: "offline",
      },
      {
        checkInAt: "2026-10-10T01:00:00Z",
        checkOutAt: null,
        id: "10000000-0000-4000-8000-000000000003",
        isPendingVerification: false,
        status: "open",
        workDate: "2026-10-10",
        workedMinutes: 0,
        workMode: "offline",
      },
    ],
    statement: {
      advanceDeductionsVnd: 0,
      payableVnd: 164259,
      pendingVerificationCount: 0,
      positionCode: "operations_assistant",
      staffDisplayName: "Trần Văn Linh",
      staffEmployeeCode: "NV30",
      staffId: "00000000-0000-4000-8000-000000000001",
      totalDeductionsVnd: 185741,
      totalEarningsVnd: 350000,
      workHours: 9,
      workUnits: 1,
      workedMinutes: 540,
    },
    status: "estimated",
  };

  it("renders one row per day with per-day pay, open shifts and monthly items", () => {
    render(<PayrollDailyBreakdownTable estimate={estimate} today="2026-10-10" />);

    expect(screen.getByText("Lương theo ngày · Tháng 10/2026")).toBeInTheDocument();
    expect(screen.getAllByTestId(/daily-row-2026-10-/)).toHaveLength(31);

    const second = screen.getByTestId("daily-row-2026-10-02");
    expect(within(second).getByText("08:00–17:00")).toBeInTheDocument();
    expect(within(second).getAllByText("350.000 VND").length).toBeGreaterThanOrEqual(1);
    expect(within(second).getByText("Phụ cấp trợ giảng")).toBeInTheDocument();

    const today = screen.getByTestId("daily-row-2026-10-10");
    expect(within(today).getByText("Hôm nay")).toBeInTheDocument();
    expect(within(today).getByText(/Đang làm · chưa tính tiền/)).toBeInTheDocument();

    const idle = screen.getByTestId("daily-row-2026-10-05");
    expect(within(idle).getByText("Không có ca")).toBeInTheDocument();

    expect(screen.getByText("Khoản tính theo tháng")).toBeInTheDocument();
    expect(screen.getByText("Phần lương khoán đã tính trong lương cứng")).toBeInTheDocument();
    expect(screen.getByText("Không phải khoản bị trừ: phần lương khoán này đã được trả trong lương cứng.")).toBeInTheDocument();
    expect(screen.getByText("−185.741 VND")).not.toHaveClass("text-danger");
    expect(screen.getByText("164.259 VND")).toBeInTheDocument();
    expect(screen.getByText(/1 ngày có phát sinh|2 ngày có phát sinh/)).toBeInTheDocument();
  });

  it("is embedded in the staff live estimate card", () => {
    render(
      <StaffLiveEstimateCard
        initialEstimate={{
          asOf: "2026-10-10T10:00:00Z",
          calculatedAt: "2026-10-10T10:00:00Z",
          completeness: "complete",
          issues: [],
          latestCompletedWorkAt: "2026-10-02T10:00:00Z",
          openShifts: [],
          recentShifts: [],
          ...estimate,
        }}
        month="2026-10-01"
        today="2026-10-10"
      />,
    );

    expect(screen.getByRole("heading", { name: "Lương theo ngày · Tháng 10/2026" })).toBeInTheDocument();
    expect(screen.getByTestId("daily-row-2026-10-02")).toBeInTheDocument();
  });
});

describe("Owner daily estimate dialog", () => {
  const ownerEstimate: OwnerPayrollEstimate = {
    asOf: "2026-10-10T10:00:00Z",
    byPosition: [],
    calculatedAt: "2026-10-10T10:00:00Z",
    completeness: "complete",
    finance: { status: "restricted" },
    issues: [],
    latestCompletedWorkAt: null,
    month: "2026-10-01",
    selectedPositionCode: null,
    statements: [
      {
        advanceDeductionsVnd: 0,
        payableVnd: 300000,
        pendingVerificationCount: 0,
        positionCode: "teaching_assistant",
        staffDisplayName: "Trợ lý hai",
        staffEmployeeCode: "NV02",
        staffId: "00000000-0000-4000-8000-000000000002",
        totalDeductionsVnd: 0,
        totalEarningsVnd: 300000,
        workHours: 9,
        workUnits: 1,
        workedMinutes: 540,
      },
    ],
    status: "estimated",
    summary: {
      advanceDeductionsVnd: 0,
      payableVnd: 300000,
      pendingVerificationCount: 0,
      staffCount: 1,
      totalDeductionsVnd: 0,
      totalEarningsVnd: 300000,
    },
  };

  const staffEstimate: StaffPayrollEstimate = {
    asOf: "2026-10-10T10:00:00Z",
    calculatedAt: "2026-10-10T10:00:00Z",
    completeness: "complete",
    issues: [],
    latestCompletedWorkAt: "2026-10-02T10:00:00Z",
    lines: [
      {
        amountVnd: 300000,
        direction: "earning",
        lineType: "base_offline",
        note: null,
        policyCode: null,
        sourceId: "10000000-0000-4000-8000-000000000001",
        sourceKind: "time_entry",
        unitLabel: null,
        unitRateVnd: null,
        workDate: "2026-10-02",
        workedMinutes: 540,
      },
    ],
    month: "2026-10-01",
    openShifts: [],
    recentShifts: [],
    shifts: [
      {
        checkInAt: "2026-10-02T01:00:00Z",
        checkOutAt: "2026-10-02T10:00:00Z",
        id: "10000000-0000-4000-8000-000000000001",
        isPendingVerification: false,
        status: "checked_out",
        workDate: "2026-10-02",
        workedMinutes: 540,
        workMode: "offline",
      },
    ],
    staffDisplayName: "Trợ lý hai",
    staffId: "00000000-0000-4000-8000-000000000002",
    statement: {
      advanceDeductionsVnd: 0,
      payableVnd: 300000,
      pendingVerificationCount: 0,
      positionCode: "teaching_assistant",
      staffDisplayName: "Trợ lý hai",
      staffEmployeeCode: "NV02",
      staffId: "00000000-0000-4000-8000-000000000002",
      totalDeductionsVnd: 0,
      totalEarningsVnd: 300000,
      workHours: 9,
      workUnits: 1,
      workedMinutes: 540,
    },
    status: "estimated",
  };

  it("opens a realtime daily breakdown for the clicked staff member", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/api/payroll/staff-estimate") ? staffEstimate : ownerEstimate;
      return Promise.resolve(new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status: 200 }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<OwnerLiveEstimateOverview initialEstimate={ownerEstimate} month="2026-10-01" today="2026-10-10" />);

    await user.click(screen.getByRole("button", { name: "Xem lương theo ngày của Trợ lý hai" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /Lương theo ngày · Trợ lý hai/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("staffId=00000000-0000-4000-8000-000000000002"))).toBe(true);
    });
    expect(await within(dialog).findByTestId("daily-row-2026-10-02")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Hồ sơ nhân sự/ })).toHaveAttribute("href", "/staff/00000000-0000-4000-8000-000000000002");

    await user.click(within(dialog).getByRole("button", { name: "Đóng bảng lương theo ngày" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  // Value: protects=when the staff estimate endpoint refuses (403/500) the owner's daily dialog leaves the skeleton for an in-dialog error with Thử lại, and the retry loads the ledger;
  // fails_when=the dialog's loading/error/ready derivation regresses (stuck skeleton or ledger with no data), the non-ok response is treated as data, or Thử lại stops re-fetching;
  // why_new=the dialog was rebuilt on StaffPayrollLedger; existing tests cover only its success path and the presentational error state;
  // seam=none (real default transport; global fetch mocked); no_claim=does not prove the API's permission check (route tests own the 403)
  it("shows an in-dialog error with a working retry when the staff estimate cannot be loaded", async () => {
    let staffStatus = 403;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/payroll/staff-estimate")) {
        return Promise.resolve(
          staffStatus === 200
            ? new Response(JSON.stringify(staffEstimate), { headers: { "Content-Type": "application/json" }, status: 200 })
            : new Response("forbidden", { status: staffStatus }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify(ownerEstimate), { headers: { "Content-Type": "application/json" }, status: 200 }));
    });
    // Stubbed (not assigned) so the mock and the console spy never leak into later tests.
    vi.stubGlobal("fetch", fetchMock);

    try {
      const user = userEvent.setup();
      render(<OwnerLiveEstimateOverview initialEstimate={ownerEstimate} month="2026-10-01" today="2026-10-10" />);

      await user.click(screen.getByRole("button", { name: "Xem lương theo ngày của Trợ lý hai" }));
      const dialog = await screen.findByRole("dialog");

      expect(await within(dialog).findByText("Chưa tải được lương theo ngày của nhân sự")).toBeInTheDocument();
      expect(within(dialog).queryByText("Đang tải lương theo ngày")).not.toBeInTheDocument();
      expect(within(dialog).queryByRole("table")).not.toBeInTheDocument();

      staffStatus = 200;
      await user.click(within(dialog).getByRole("button", { name: /Thử lại/ }));

      expect(await within(dialog).findByTestId("daily-row-2026-10-02")).toBeInTheDocument();
      expect(within(dialog).queryByText("Chưa tải được lương theo ngày của nhân sự")).not.toBeInTheDocument();
    } finally {
      cleanup();
      vi.unstubAllGlobals();
      consoleError.mockRestore();
    }
  });
});
