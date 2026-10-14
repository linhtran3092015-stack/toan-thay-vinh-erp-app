// Value: protects=the per-staff daily ledger (design 8b): header with name, code, position and the offline daily rate, a warning banner naming the shifts pending verification that says they are still counted, ledger columns Ngày/Ca/Nguồn/Hình thức/Phút công/Đơn giá/Thành tiền/Xác minh, open shifts marked "Chưa tính" with no amount, and on narrow screens only Ngày/Ca/Thành tiền stay as columns with minutes and verification restated in words;
// fails_when=the banner disappears or stops saying pending work is counted, an open shift shows an amount or loses its "Chưa tính" badge, a pending shift reads as verified, the rate is invented, or the mobile restatement is dropped;
// why_new=step 8 restyles StaffDailyEstimateDialog / PayrollDailyBreakdownTable into the 8b ledger;
// seam=StaffPayrollLedger renders a fixture estimate directly (no fetch); class names stand in for media queries jsdom cannot apply; no_claim=does not cover the realtime refresh (live-estimate-cards covers the dialog fetch)
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StaffPayrollLedger } from "@/features/payroll/estimate/components/staff-payroll-ledger";
import type { StaffPayrollEstimate } from "@/features/payroll/estimate/types";

afterEach(cleanup);

const estimate: StaffPayrollEstimate = {
  asOf: "2026-10-12T08:30:00Z",
  calculatedAt: "2026-10-12T08:30:00Z",
  completeness: "complete",
  issues: [],
  latestCompletedWorkAt: "2026-10-08T10:04:00Z",
  lines: [
    {
      amountVnd: 176_000,
      direction: "earning",
      isPendingVerification: true,
      lineType: "base_offline",
      note: null,
      policyCode: "daily_base_salary",
      sourceId: "10000000-0000-4000-8000-000000000001",
      sourceKind: "time_entry",
      unitLabel: "phút",
      unitRateVnd: 720_000,
      workDate: "2026-10-08",
      workedMinutes: 132,
    },
  ],
  month: "2026-10-01",
  openShifts: [],
  recentShifts: [],
  shifts: [
    {
      checkInAt: "2026-10-08T07:52:00Z",
      checkOutAt: "2026-10-08T10:04:00Z",
      id: "10000000-0000-4000-8000-000000000001",
      isPendingVerification: true,
      status: "checked_out",
      workDate: "2026-10-08",
      workedMinutes: 132,
      workMode: "offline",
    },
    {
      checkInAt: "2026-10-12T08:00:00Z",
      checkOutAt: null,
      id: "10000000-0000-4000-8000-000000000002",
      isPendingVerification: false,
      status: "open",
      workDate: "2026-10-12",
      workedMinutes: 0,
      workMode: "online",
    },
  ],
  statement: {
    advanceDeductionsVnd: 0,
    payableVnd: 176_000,
    pendingVerificationCount: 1,
    positionCode: "teaching_assistant",
    staffDisplayName: "Trần Thanh Tùng",
    staffEmployeeCode: "NV07",
    staffId: "00000000-0000-4000-8000-000000000007",
    totalDeductionsVnd: 0,
    totalEarningsVnd: 176_000,
    workHours: 2,
    workUnits: 1,
    workedMinutes: 132,
  },
  status: "estimated",
};

const target = {
  positionLabel: "Trợ giảng",
  staffDisplayName: "Trần Thanh Tùng",
  staffEmployeeCode: "NV07",
  staffId: "00000000-0000-4000-8000-000000000007",
};

function renderLedger(data: StaffPayrollEstimate = estimate) {
  return render(
    <StaffPayrollLedger estimate={data} loadState="ready" month="2026-10-01" target={target} titleId="ledger" today="2026-10-12" variant="page" />,
  );
}

describe("Per-staff daily ledger (8b)", () => {
  it("shows the staff header with the rate the estimate carries", () => {
    renderLedger();

    expect(screen.getByRole("heading", { level: 2, name: "Lương theo ngày · Trần Thanh Tùng" })).toBeInTheDocument();
    expect(screen.getByText("Tạm tính 10/2026")).toBeInTheDocument();
    expect(screen.getByText(/NV07 · Trợ giảng · Đơn giá ngày công offline 720\.000 VND · Tháng 10\/2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Hồ sơ nhân sự/ })).toHaveAttribute("href", `/staff/${target.staffId}`);
  });

  it("warns that pending shifts are still counted and links to timekeeping", () => {
    renderLedger();

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("1 ca chờ xác minh");
    expect(banner).toHaveTextContent("08/10 ca 14:52–17:04");
    expect(banner).toHaveTextContent("vẫn được tính tạm");
    expect(within(banner).getByRole("link", { name: "Xem chấm công" })).toHaveAttribute("href", "/timekeeping");

    const pendingDay = screen.getByTestId("daily-row-2026-10-08");
    expect(within(pendingDay).getByText("Chờ xác minh (tính tạm)")).toBeInTheDocument();
    expect(within(pendingDay).queryByText("Đã xác minh")).not.toBeInTheDocument();
    expect(within(pendingDay).getByText("176.000 VND")).toBeInTheDocument();
  });

  it("has no banner when nothing is pending", () => {
    renderLedger({
      ...estimate,
      shifts: estimate.shifts.map((item) => ({ ...item, isPendingVerification: false })),
      statement: estimate.statement ? { ...estimate.statement, pendingVerificationCount: 0 } : null,
    });

    expect(screen.queryByText(/ca chờ xác minh/)).not.toBeInTheDocument();
  });

  it("uses the 8b ledger columns and marks an open shift 'Chưa tính' with no amount", () => {
    renderLedger();

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Ngày", "Ca", "Nguồn", "Hình thức", "Phút công", "Đơn giá", "Thành tiền", "Xác minh"]);

    const openDay = screen.getByTestId("daily-row-2026-10-12");
    expect(within(openDay).getByText("Chưa tính")).toBeInTheDocument();
    expect(within(openDay).getByText(/Đang làm · chưa tính tiền/)).toBeInTheDocument();
    expect(within(openDay).getByText("Online")).toBeInTheDocument();
    expect(within(openDay).queryByText(/VND/)).not.toBeInTheDocument();

    const pendingDay = screen.getByTestId("daily-row-2026-10-08");
    expect(within(pendingDay).getByText("Lương công offline")).toBeInTheDocument();
    expect(within(pendingDay).getByText("132")).toBeInTheDocument();
    expect(within(pendingDay).getByText("720.000 VND")).toBeInTheDocument();
  });

  it("keeps Ngày, Ca and Thành tiền on narrow screens and restates the rest in words", () => {
    renderLedger();

    const table = screen.getByRole("table");
    const hiddenBelowMd = within(table).getAllByRole("columnheader").filter((cell) => cell.className.includes("max-md:hidden")).map((cell) => cell.textContent);
    expect(hiddenBelowMd).toEqual(["Nguồn", "Hình thức", "Phút công", "Đơn giá", "Xác minh"]);

    const pendingDay = screen.getByTestId("daily-row-2026-10-08");
    const restated = within(pendingDay).getByText("132 phút công · 1 ca chờ xác minh (tính tạm)");
    expect(restated.className).toContain("md:hidden");
  });

  it("shows a retry inside the ledger when the estimate cannot load", () => {
    render(
      <StaffPayrollLedger estimate={null} loadState="error" month="2026-10-01" onRetry={() => {}} target={target} titleId="ledger" />,
    );

    expect(screen.getByText("Chưa tải được lương theo ngày của nhân sự")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thử lại/ })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  // Value: protects=8b ledger header and banner states: approved/stale/partial badges, no invented rate when the month has no offline base line, the banner lists at most 3 shifts then "và N ca khác", and a loading status before data;
  // fails_when=a stale or partial estimate loses its warning badge, an approved month still reads "Tạm tính", the rate is shown without a base_offline line, or the banner lists every shift / drops the remainder count;
  // why_new=existing rows render only an estimated, complete, connected month with one pending shift;
  // seam=none (StaffPayrollLedger renders fixtures directly); no_claim=does not prove the hook reports stale correctly (payroll-live-estimate-transport covers that)
  it("flags approved, stale and partial estimates and never invents a daily rate", () => {
    render(
      <StaffPayrollLedger
        connectionState="stale"
        estimate={{ ...estimate, completeness: "partial", lines: [], status: "approved" }}
        loadState="ready"
        month="2026-10-01"
        target={target}
        titleId="ledger"
        today="2026-10-12"
        variant="page"
      />,
    );

    expect(screen.getByText("Đã duyệt 10/2026")).toBeInTheDocument();
    expect(screen.queryByText("Tạm tính 10/2026")).not.toBeInTheDocument();
    expect(screen.getByText("Chưa cập nhật")).toBeInTheDocument();
    expect(screen.getByText("Chưa tính đủ cấu hình")).toBeInTheDocument();
    expect(screen.queryByText(/Đơn giá ngày công offline/)).not.toBeInTheDocument();
    expect(screen.getByText(/NV07 · Trợ giảng · Tháng 10\/2026/)).toBeInTheDocument();
  });

  it("lists at most three pending shifts in the banner and counts the rest", () => {
    const pending = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-06", "2026-10-07"].map((workDate, index) => ({
      checkInAt: `${workDate}T01:00:00Z`,
      checkOutAt: `${workDate}T03:00:00Z`,
      id: `20000000-0000-4000-8000-00000000000${index}`,
      isPendingVerification: true,
      status: "checked_out",
      workDate,
      workedMinutes: 120,
      workMode: "offline" as const,
    }));
    // Each shift is paid provisionally: a base line for its time entry is flagged pending.
    const provisionalLines = pending.map((item) => ({ ...estimate.lines[0], sourceId: item.id, workDate: item.workDate }));
    renderLedger({ ...estimate, lines: provisionalLines, shifts: pending, statement: estimate.statement ? { ...estimate.statement, pendingVerificationCount: 5 } : null });

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("5 ca chờ xác minh");
    expect(banner).toHaveTextContent("01/10 ca 08:00–10:00, 02/10 ca 08:00–10:00, 03/10 ca 08:00–10:00 và 2 ca khác.");
    expect(banner).not.toHaveTextContent("06/10");
  });

  // Value: protects=the banner counts the shifts actually paid provisionally (the statement count also includes unverified shifts that get no pay), so "N ca chờ xác minh … vẫn được tính tạm" never overstates; an old payload with no shift list still shows the statement count, with no invented names or remainder;
  // fails_when=the banner count follows statement.pendingVerificationCount while shifts are present (e.g. "4 ca … và 3 ca khác"), or an old payload without shifts loses its banner;
  // why_new=review pass 3 (fix 2): the count came from the statement; review pass 2 (fix 2) computed the remainder from that count;
  // seam=none (fixture estimate rendered directly); no_claim=does not prove the RPC's statement count (migration 20260929154500 owns it)
  it("counts the banner from provisionally paid shifts and falls back to the statement without shifts", () => {
    renderLedger({ ...estimate, statement: estimate.statement ? { ...estimate.statement, pendingVerificationCount: 4 } : null });

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("1 ca chờ xác minh");
    expect(banner).toHaveTextContent("08/10 ca 14:52–17:04. ");
    expect(banner).not.toHaveTextContent(/ca khác/);
    cleanup();

    renderLedger({ ...estimate, shifts: [], statement: estimate.statement ? { ...estimate.statement, pendingVerificationCount: 4 } : null });
    const legacyBanner = screen.getByRole("status");
    expect(legacyBanner).toHaveTextContent("4 ca chờ xác minh");
    expect(legacyBanner).not.toHaveTextContent(/ca khác/);
    expect(legacyBanner).not.toHaveTextContent(/08\/10/);
  });

  // Value: protects=an unverified shift with no paid base line reads "Chưa tính · chưa xác minh" in neutral, its minutes stay out of "phút công đã tính tiền", and the row has no warning tint;
  // fails_when=the ledger again claims every unverified shift is "tính tạm", counts its minutes as paid, or tints the row as pending;
  // why_new=review pass 2 (fix 1): pay includes an unverified time entry only in estimate mode with a pending attendance exception review;
  // seam=none (fixture estimate rendered directly); no_claim=does not prove the RPC flags the line (migration 20260929154500 does)
  it("marks an unverified shift without a paid line as not counted", () => {
    renderLedger({
      ...estimate,
      lines: [],
      shifts: [{ ...estimate.shifts[0] }],
      statement: estimate.statement ? { ...estimate.statement, payableVnd: 0, pendingVerificationCount: 0, totalEarningsVnd: 0 } : null,
    });

    const day = screen.getByTestId("daily-row-2026-10-08");
    expect(within(day).getByText("Chưa tính · chưa xác minh")).toBeInTheDocument();
    expect(within(day).queryByText("Chờ xác minh (tính tạm)")).not.toBeInTheDocument();
    expect(day.className).not.toContain("bg-warning-bg");
    expect(within(day).getByText("Chưa có phút công · 1 ca chưa xác minh chưa tính")).toBeInTheDocument();
    expect(screen.getByText(/Tổng theo ngày · 0 phút công · ca chưa xác minh chưa tính/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // Value: protects=a verified closed shift with no base pay line (estimated month: no daily rate) reads "Chưa tính · thiếu đơn giá" with no amount, not "Đã xác minh", and its minutes stay out of "phút công";
  // fails_when=a verified shift is counted as paid without a base line, or the not-in-pay badge says "Đã xác minh" / the approved wording in an estimated month;
  // why_new=review pass 3 (fix 1): every verified closed shift read "Đã xác minh" and added its minutes;
  // seam=none (fixture estimate rendered directly); no_claim=does not prove why the RPC left the shift without a line
  it("marks a verified shift without a base line as missing a rate", () => {
    renderLedger({
      ...estimate,
      issues: [{ details: { work_date: "2026-10-09" }, issueCode: "missing_daily_rate" }],
      shifts: [
        ...estimate.shifts,
        {
          checkInAt: "2026-10-09T01:00:00Z",
          checkOutAt: "2026-10-09T03:00:00Z",
          id: "10000000-0000-4000-8000-000000000004",
          isPendingVerification: false,
          status: "checked_out",
          workDate: "2026-10-09",
          workedMinutes: 120,
          workMode: "offline",
        },
      ],
    });

    const day = screen.getByTestId("daily-row-2026-10-09");
    expect(within(day).getByText("Chưa tính · thiếu đơn giá")).toBeInTheDocument();
    expect(within(day).queryByText("Đã xác minh")).not.toBeInTheDocument();
    expect(within(day).queryByText(/VND/)).not.toBeInTheDocument();
    expect(within(day).getByText("Chưa có phút công · 1 ca đã xác minh chưa tính tiền (thiếu đơn giá)")).toBeInTheDocument();
    expect(screen.getByText(/Tổng theo ngày · 132 phút công · ca đang mở không tính · ca đã xác minh nhưng chưa tính tiền/)).toBeInTheDocument();
  });

  // Value: protects=the header names the latest offline rate with "(mới nhất)" when the month had more than one rate;
  // fails_when=an older rate is shown after a rate change, or several rates read as a single rate;
  // why_new=review pass 2 (fix 6);
  // seam=none (fixture estimate rendered directly); no_claim=none beyond protects
  it("labels the latest of several offline rates", () => {
    renderLedger({
      ...estimate,
      lines: [
        { ...estimate.lines[0], unitRateVnd: 800_000, workDate: "2026-10-20" },
        ...estimate.lines,
      ],
    });

    expect(screen.getByText(/Đơn giá ngày công offline 800\.000 VND \(mới nhất\)/)).toBeInTheDocument();
  });

  // Value: protects=an approved month shows no "still counted provisionally" banner, because approved pay already excludes unverified time entries;
  // fails_when=the pending banner keeps telling staff that unverified work is "tính tạm" after the period is approved;
  // why_new=review fix RT3: the banner ignored estimate.status;
  // seam=none (fixture estimate rendered directly); no_claim=none beyond protects
  it("hides the pending banner once the month is approved", () => {
    renderLedger({ ...estimate, status: "approved" });

    expect(screen.queryByText("1 ca chờ xác minh")).not.toBeInTheDocument();
    expect(screen.queryByText(/vẫn được tính tạm/)).not.toBeInTheDocument();
    expect(screen.getByText("Đã duyệt 10/2026")).toBeInTheDocument();
  });

  // Value: protects=a day with a verified closed shift and a shift still open shows the closed shift's amount and "Đã xác minh" next to the open shift's "Chưa tính", never folding the open shift into the amount or hiding the day's money;
  // fails_when=the open shift makes the whole day read "—"/"Chưa tính", the verified shift loses its badge, or the open shift reads as verified;
  // why_new=review fix T4: only days with a single shift kind were covered;
  // seam=none (fixture estimate rendered directly); no_claim=does not cover the realtime refresh when the open shift closes
  it("shows a verified closed shift's amount beside an open shift on the same day", () => {
    renderLedger({
      ...estimate,
      lines: [
        ...estimate.lines,
        {
          amountVnd: 160_000,
          direction: "earning",
          isPendingVerification: false,
          lineType: "base_offline",
          note: null,
          policyCode: "daily_base_salary",
          sourceId: "10000000-0000-4000-8000-000000000003",
          sourceKind: "time_entry",
          unitLabel: "phút",
          unitRateVnd: 720_000,
          workDate: "2026-10-12",
          workedMinutes: 120,
        },
      ],
      shifts: [
        ...estimate.shifts,
        {
          checkInAt: "2026-10-12T01:00:00Z",
          checkOutAt: "2026-10-12T03:00:00Z",
          id: "10000000-0000-4000-8000-000000000003",
          isPendingVerification: false,
          status: "checked_out",
          workDate: "2026-10-12",
          workedMinutes: 120,
          workMode: "offline",
        },
      ],
    });

    const day = screen.getByTestId("daily-row-2026-10-12");
    expect(within(day).getByText("160.000 VND")).toBeInTheDocument();
    expect(within(day).getByText("Đã xác minh")).toBeInTheDocument();
    expect(within(day).getByText("Chưa tính")).toBeInTheDocument();
    expect(within(day).getByText(/Đang làm · chưa tính tiền/)).toBeInTheDocument();
    expect(within(day).queryByText(/Chờ xác minh/)).not.toBeInTheDocument();
  });

  // Value: protects=the ledger totals block says "Lương chính thức đã chốt" for an approved month and its formula line subtracts a negative monthly net ("Tổng theo ngày X − khoản theo tháng Y") with the deduction signed in the list;
  // fails_when=an approved month still reads "Lương tạm tính sau khấu trừ", the sign test flips so a deduction is shown as "+", or the monthly amount keeps its minus inside the absolute value;
  // why_new=existing rows have no monthly items and never assert the totals label or formula line;
  // seam=none (fixture estimate rendered directly); no_claim=does not prove statement.payableVnd equals daily total + monthly net (the fixture keeps them equal)
  it("labels approved totals and subtracts a negative monthly net in the formula", () => {
    renderLedger({
      ...estimate,
      lines: [
        ...estimate.lines,
        {
          amountVnd: 50_000,
          direction: "deduction",
          isPendingVerification: false,
          lineType: "advance_deduction",
          note: null,
          policyCode: null,
          sourceId: null,
          sourceKind: null,
          unitLabel: null,
          unitRateVnd: null,
          workDate: null,
          workedMinutes: null,
        },
      ],
      statement: estimate.statement ? { ...estimate.statement, advanceDeductionsVnd: 50_000, payableVnd: 126_000, totalDeductionsVnd: 50_000 } : null,
      status: "approved",
    });

    const monthly = screen.getByRole("heading", { level: 4, name: "Khoản tính theo tháng" }).closest("div")?.parentElement as HTMLElement;
    expect(within(monthly).getByText("Khấu trừ tạm ứng").parentElement?.nextElementSibling).toHaveTextContent("−50.000 VND");
    expect(within(monthly).getByText("Lương chính thức đã chốt").nextElementSibling).toHaveTextContent("126.000 VND");
    expect(within(monthly).queryByText("Lương tạm tính sau khấu trừ")).not.toBeInTheDocument();
    expect(monthly).toHaveTextContent("= Tổng theo ngày 176.000 VND − khoản theo tháng 50.000 VND");
    expect(monthly).not.toHaveTextContent("+ khoản theo tháng");
  });

  it("announces loading without rendering the ledger", () => {
    render(<StaffPayrollLedger estimate={null} loadState="loading" month="2026-10-01" target={target} titleId="ledger" />);

    expect(screen.getByRole("status")).toHaveTextContent("Đang tải lương theo ngày");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa tải được lương theo ngày của nhân sự")).not.toBeInTheDocument();
  });
});
