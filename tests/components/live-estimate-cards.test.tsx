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
    expect(screen.getByText("Bù trừ lương khoán")).toBeInTheDocument();
    expect(screen.getByText("−185.741 VND")).toBeInTheDocument();
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
