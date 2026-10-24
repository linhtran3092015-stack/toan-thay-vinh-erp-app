// Value: protects=the /payroll/dashboard header and live estimate presentation (design 8a): title "Quỹ lương tháng MM/YYYY" with the live status badge, the only primary is "Xem kỳ MM/YYYY chờ duyệt" when a period is in review and the viewer can approve, the figures strip leaves out tuition figures it does not have, staff the estimate cannot calculate read "Chưa tính được" with no amount, the analytics live under "Phân tích", and the staff table stacks into labelled rows with 44px actions below md;
// fails_when=a primary is shown with nothing to do, the empty-state link is styled as a second primary, restricted finance renders as 0 ₫, a blocked staff row shows a payable amount, or the mobile row labels / 44px action classes are dropped;
// why_new=step 8 redesigns the dashboard header, figures strip and staff table;
// seam=the page renders with an initial estimate and an inert transport (no fetch, no realtime); class names stand in for media queries jsdom cannot apply; no_claim=does not prove pixel layout at 375px (checked in the /dev/payroll preview)
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OwnerPayrollDashboardPage } from "@/features/payroll/dashboard/payroll-dashboard-page";
import type { PayrollDashboardData } from "@/features/payroll/dashboard/read-models";
import type { OwnerPayrollEstimate } from "@/features/payroll/estimate/types";
import type { PayrollEstimateTransport } from "@/features/payroll/estimate/use-payroll-live-estimate";

const transport: PayrollEstimateTransport = {
  load: vi.fn(() => new Promise<never>(() => {})),
  subscribe: () => () => {},
};

function dashboard(overrides: Partial<PayrollDashboardData> = {}): PayrollDashboardData {
  return {
    byPosition: [],
    composition: [],
    filters: {
      availableMonths: [{ month: "2026-10-01", status: "draft" }],
      positions: [],
      selectedMonth: "2026-10-01",
      selectedPositionCode: null,
    },
    insights: [],
    periodStatus: "draft",
    significantChanges: { decreases: [], increases: [] },
    summary: {
      averageSalary: 0,
      employeeChange: 0,
      employeeCount: 0,
      highestPaidEmployee: null,
      payrollChange: 0,
      payrollChangePercent: null,
      previousMonthPayroll: 0,
      totalPayroll: 0,
    },
    topEmployees: [],
    trend: [],
    ...overrides,
  };
}

const estimate: OwnerPayrollEstimate = {
  asOf: "2026-10-12T08:30:00Z",
  byPosition: [{ payableVnd: 2_000_000, positionCode: "teaching_assistant", staffCount: 2, totalDeductionsVnd: 0, totalEarningsVnd: 2_000_000 }],
  calculatedAt: "2026-10-12T08:30:00Z",
  completeness: "partial",
  finance: { status: "restricted" },
  // Issues are raised per work date; a staff member without a payroll position
  // has no statement (the RPC inner-joins effective positions).
  issues: [
    { details: { work_date: "2026-10-05" }, issueCode: "missing_daily_rate", staffId: "00000000-0000-4000-8000-000000000002" },
    { details: { work_date: "2026-10-06" }, issueCode: "missing_payroll_position", staffId: "00000000-0000-4000-8000-000000000003" },
    { details: { work_date: "2026-10-07" }, issueCode: "missing_payroll_position", staffId: "00000000-0000-4000-8000-000000000003" },
  ],
  latestCompletedWorkAt: null,
  month: "2026-10-01",
  selectedPositionCode: null,
  statements: [
    {
      advanceDeductionsVnd: 0,
      payableVnd: 2_000_000,
      pendingVerificationCount: 1,
      positionCode: "teaching_assistant",
      staffDisplayName: "Trần Thanh Tùng",
      staffEmployeeCode: "NV07",
      staffId: "00000000-0000-4000-8000-000000000001",
      totalDeductionsVnd: 0,
      totalEarningsVnd: 2_000_000,
      workHours: 20,
      workUnits: 5,
      workedMinutes: 1_200,
    },
    {
      advanceDeductionsVnd: 0,
      payableVnd: 0,
      pendingVerificationCount: 0,
      positionCode: "teaching_assistant",
      staffDisplayName: "Đặng Phương Thảo",
      staffEmployeeCode: "NV15",
      staffId: "00000000-0000-4000-8000-000000000002",
      totalDeductionsVnd: 0,
      totalEarningsVnd: 0,
      workHours: 10,
      workUnits: 2,
      workedMinutes: 600,
    },
  ],
  status: "estimated",
  summary: {
    advanceDeductionsVnd: 0,
    payableVnd: 2_000_000,
    pendingVerificationCount: 1,
    staffCount: 2,
    totalDeductionsVnd: 0,
    totalEarningsVnd: 2_000_000,
  },
};

afterEach(cleanup);

describe("Payroll dashboard header (8a)", () => {
  it("makes the period waiting for approval the only primary action", () => {
    render(
      <OwnerPayrollDashboardPage
        canApprove
        dashboard={dashboard({ filters: { ...dashboard().filters, availableMonths: [{ month: "2026-10-01", status: "draft" }, { month: "2026-09-01", status: "review" }] } })}
        estimateTransport={transport}
        initialOwnerEstimate={estimate}
      />,
    );

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("heading", { level: 1, name: "Quỹ lương tháng 10/2026" })).toBeInTheDocument();
    expect(within(header).getByText("Tạm tính · đến 12/10")).toBeInTheDocument();
    expect(within(header).getByText(/2 nhân sự · 1 vị trí \(Trợ giảng\) · 30 giờ công ghi nhận · 1 ca chờ xác minh/)).toBeInTheDocument();

    const primary = within(header).getByRole("link", { name: "Xem kỳ 09/2026 chờ duyệt" });
    expect(primary).toHaveAttribute("href", "/payroll");
    expect(primary.className).toContain("bg-action-primary");
    // The filter submit is secondary: one primary per page.
    expect(within(header).getByRole("button", { name: "Áp dụng" }).className).not.toContain("bg-action-primary");
  });

  it("has no primary when nothing is waiting for this viewer", () => {
    render(
      <OwnerPayrollDashboardPage
        dashboard={dashboard({ filters: { ...dashboard().filters, availableMonths: [{ month: "2026-09-01", status: "review" }] } })}
        estimateTransport={transport}
        initialOwnerEstimate={estimate}
      />,
    );

    expect(screen.queryByRole("link", { name: /chờ duyệt/ })).not.toBeInTheDocument();
    expect(document.querySelectorAll("a.bg-action-primary, button.bg-action-primary")).toHaveLength(0);
  });

  it("keeps the empty-state link secondary under Phân tích", () => {
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={null} />);

    const analysis = screen.getByRole("region", { name: "Phân tích" });
    expect(within(analysis).getByRole("heading", { name: "Chưa có dữ liệu lương cho tháng 10/2026" })).toBeInTheDocument();
    expect(within(analysis).getByRole("link", { name: "Xem bảng lương" }).className).not.toContain("bg-action-primary");
  });
  // Value: protects=a month with live estimate activity but no period statements says the analysis is not available yet instead of the "no payroll data" empty state or zero-valued analytics;
  // fails_when=the isEmpty / employeeCount branching changes so the page claims there is no payroll data while the live figures show money, or renders the statement figures strip with 0 ₫;
  // why_new=the third Phân tích branch is new in step 8 and earlier rows reach it without asserting it;
  // seam=inert transport (as above); no_claim=none beyond protects
  it("says the period analysis is not ready when only the live estimate has data", () => {
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={estimate} />);

    const analysis = screen.getByRole("region", { name: "Phân tích" });
    expect(within(analysis).getByText(/Chưa có bảng lương kỳ 10\/2026 để phân tích/)).toBeInTheDocument();
    expect(within(analysis).queryByRole("heading", { name: /Chưa có dữ liệu lương/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Chỉ số quỹ lương chính")).not.toBeInTheDocument();
  });
});

describe("Live estimate figures and staff table (8a)", () => {
  it("omits tuition figures the viewer does not have and never shows them as 0", () => {
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={estimate} />);

    const strip = screen.getByLabelText("Số liệu lương tạm tính");
    expect(within(strip).getByText("Lương tạm tính phải trả")).toBeInTheDocument();
    expect(within(strip).getByText("1 ca")).toBeInTheDocument();
    expect(within(strip).queryByText("Thực thu sau hoàn")).not.toBeInTheDocument();
    expect(within(strip).queryByText("Lương phải trả / Thực thu")).not.toBeInTheDocument();
  });

  it("shows 'Chưa tính được' with the reason instead of a 0 amount", () => {
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={estimate} />);

    const table = screen.getByRole("table", { name: /Lương tạm tính theo nhân sự/ });
    expect(screen.getByRole("heading", { name: "Theo nhân sự" }).parentElement).toHaveTextContent("· 2 người");
    const blocked = within(table).getByText("Đặng Phương Thảo").closest("tr") as HTMLElement;
    expect(within(blocked).getByText("Chưa tính được")).toBeInTheDocument();
    expect(within(blocked).getByText("Thiếu mức lương ngày")).toBeInTheDocument();
    expect(within(blocked).queryByText(/0 ₫/)).not.toBeInTheDocument();
    // Blocked staff come first so they get fixed before the period closes.
    expect(within(table).getAllByRole("row")[1]).toBe(blocked);

    const calculated = within(table).getByText("Trần Thanh Tùng").closest("tr") as HTMLElement;
    expect(within(calculated).getAllByText("2.000.000 ₫").length).toBeGreaterThanOrEqual(1);
    expect(within(calculated).getByRole("button", { name: "Xem lương theo ngày của Trần Thanh Tùng" })).toHaveTextContent("Xem");
  });

  // Value: protects=a staff row with a blocking issue on some work dates still shows its calculated income and payable with a "Chưa đủ dữ liệu · <reason>" warning tag in words, stays first, and the visible rows add up to the footer total;
  // fails_when=a partly calculated row is blanked to "Chưa tính được" while its money is inside the footer total, the warning is colour-only, or the footer counts rows that are not shown;
  // why_new=review fix RT1/RT4: blocked rows used to hide every amount;
  // seam=inert transport (as above); no_claim=does not prove the RPC totals equal the statement sums (the fixture keeps them equal, as the RPC does)
  it("keeps the calculated amounts of a partly blocked row and reconciles with the footer", () => {
    const partly: OwnerPayrollEstimate = {
      ...estimate,
      statements: estimate.statements.map((item) => (
        item.staffDisplayName === "Đặng Phương Thảo" ? { ...item, payableVnd: 500_000, totalEarningsVnd: 500_000 } : item
      )),
      summary: { ...estimate.summary, payableVnd: 2_500_000, totalEarningsVnd: 2_500_000 },
    };
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={partly} />);

    const table = screen.getByRole("table", { name: /Lương tạm tính theo nhân sự/ });
    const blocked = within(table).getByText("Đặng Phương Thảo").closest("tr") as HTMLElement;
    expect(within(table).getAllByRole("row")[1]).toBe(blocked);
    expect(within(blocked).getByText("Chưa đủ dữ liệu · Thiếu mức lương ngày")).toBeInTheDocument();
    expect(within(blocked).queryByText("Chưa tính được")).not.toBeInTheDocument();
    expect(within(blocked).getAllByText("500.000 ₫")).toHaveLength(2);

    const frame = table.parentElement as HTMLElement;
    expect(frame).toHaveTextContent("Tổng 2 nhân sự");
    expect(frame).toHaveTextContent("Tạm tính 2.500.000 ₫");
  });

  // Value: protects=staff who clocked work but have no payroll position (no statement, only issues) are reported inside the staff table frame with a secondary link to fix their position;
  // fails_when=they vanish from the dashboard because they have no row, are counted once per work date, or the link becomes a primary / loses its href;
  // why_new=review fix RT2: the RPC gives them no statement, so the table could never show them;
  // seam=inert transport (as above); no_claim=does not prove /staff lets the owner set the position
  it("reports staff without a payroll position under the table with a link to fix it", () => {
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={estimate} />);

    const table = screen.getByRole("table", { name: /Lương tạm tính theo nhân sự/ });
    const frame = table.parentElement as HTMLElement;
    const line = within(frame).getByTestId("staff-without-position");
    expect(line).toHaveTextContent("1 nhân sự có chấm công nhưng chưa có vị trí tính lương nên chưa tính được.");
    const link = within(line).getByRole("link", { name: "Cập nhật vị trí" });
    expect(link).toHaveAttribute("href", "/staff");
    expect(link.className).not.toContain("bg-action-primary");
  });

  // Value: protects=the payroll/tuition ratio footnote appears only when the ratio figure is shown;
  // fails_when=the footnote explains a ratio the viewer cannot see (restricted finance) or disappears when the ratio is shown;
  // why_new=review fix M4: the footnote was unconditional;
  // seam=inert transport (as above); no_claim=none beyond protects
  it("shows the ratio footnote only with the ratio figure", () => {
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={estimate} />);
    expect(screen.queryByText(/Tỷ lệ lương \/ thực thu/)).not.toBeInTheDocument();
    cleanup();

    render(
      <OwnerPayrollDashboardPage
        dashboard={dashboard()}
        estimateTransport={transport}
        initialOwnerEstimate={{ ...estimate, finance: { payrollRatioPercent: 4, status: "available", tuitionNetVnd: 50_000_000, tuitionReceivedVnd: 50_000_000, tuitionRefundedVnd: 0 } }}
      />,
    );
    expect(screen.getByText(/Tỷ lệ lương \/ thực thu/)).toBeInTheDocument();
  });

  // Value: protects=the live estimate meta row says when figures are partial ("Chưa tính đủ dữ liệu (N cảnh báo)"), switches to "Số liệu đã chốt" / "Chốt: …" for an approved month, and the pending-verification banner shows only when summary.pendingVerificationCount > 0;
  // fails_when=an approved month still reads "Tính đến hiện tại" / "Dữ liệu tính lúc", the partial badge or its issue count is dropped, or the pending banner shows at 0 / vanishes at N > 0;
  // why_new=existing rows render only an estimated, partial month and never assert the meta row or the pending banner;
  // seam=none (inert transport, as above); no_claim=the approved timestamp is formatted in Vietnam time (formatDateTime pins Asia/Ho_Chi_Minh); only the date part is asserted here
  it("labels partial, approved and pending-verification states in the live estimate header", () => {
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={estimate} />);
    expect(screen.getByText("Tính đến hiện tại")).toBeInTheDocument();
    expect(screen.getByText("Chưa tính đủ dữ liệu (3 cảnh báo)")).toBeInTheDocument();
    expect(screen.getByText("Có 1 ca làm việc đang chờ xác minh công nằm trong số tạm tính.")).toBeInTheDocument();
    cleanup();

    const approved: OwnerPayrollEstimate = {
      ...estimate,
      approvedAt: null,
      completeness: "complete",
      issues: [],
      status: "approved",
      summary: { ...estimate.summary, pendingVerificationCount: 0 },
    };
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={approved} />);
    expect(screen.getByText("Số liệu đã chốt")).toBeInTheDocument();
    expect(screen.getByText("Chốt: Đã duyệt")).toBeInTheDocument();
    expect(screen.queryByText("Tính đến hiện tại")).not.toBeInTheDocument();
    expect(screen.queryByText(/Dữ liệu tính lúc/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chưa tính đủ dữ liệu/)).not.toBeInTheDocument();
    expect(screen.queryByText(/đang chờ xác minh công/)).not.toBeInTheDocument();
    cleanup();

    render(
      <OwnerPayrollDashboardPage
        dashboard={dashboard()}
        estimateTransport={transport}
        initialOwnerEstimate={{ ...approved, approvedAt: "2026-10-05T12:00:00Z" }}
      />,
    );
    expect(screen.getByText(/^Chốt: \d{2}:\d{2},? 05\/10\/2026$/)).toBeInTheDocument();
  });

  // Value: protects=viewing a past month with no live estimate points back to the current month (Vietnam time) via /payroll/dashboard?month=YYYY-MM, and an empty staff table says no staff has accrued pay instead of an empty grid;
  // fails_when=the banner links to the viewed month or a malformed month param, shows for the current month or a past month that has money, or the empty state text is dropped;
  // why_new=no test renders a past month or an estimate with no staff rows;
  // seam=none (inert transport; Date faked to a fixed clock); no_claim=does not prove the route parses ?month=2026-10 (owner-payroll-dashboard-url-state covers that)
  it("points a past empty month back to the current month and shows the empty staff state", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T18:30:00Z")); // 01:30 on 01/11 in Vietnam
    try {
      const empty: OwnerPayrollEstimate = {
        ...estimate,
        byPosition: [],
        completeness: "complete",
        issues: [],
        month: "2026-09-01",
        statements: [],
        summary: { advanceDeductionsVnd: 0, payableVnd: 0, pendingVerificationCount: 0, staffCount: 0, totalDeductionsVnd: 0, totalEarningsVnd: 0 },
      };
      const septemberFilters = { ...dashboard().filters, availableMonths: [{ month: "2026-09-01", status: "draft" }], selectedMonth: "2026-09-01" };
      render(<OwnerPayrollDashboardPage dashboard={dashboard({ filters: septemberFilters })} estimateTransport={transport} initialOwnerEstimate={empty} />);

      expect(screen.getByText("Bạn đang xem Tháng 09/2026.")).toBeInTheDocument();
      const link = screen.getByRole("link", { name: /Chuyển sang Tháng 11\/2026 \(Tháng hiện tại\)/ });
      expect(link).toHaveAttribute("href", "/payroll/dashboard?month=2026-11");
      expect(link.className).toContain("max-md:min-h-11");
      expect(link.className).toContain("text-action-link!");
      expect(screen.getByText("Chưa có nhân sự phát sinh lương tạm tính")).toBeInTheDocument();
      expect(screen.queryByText(/^Tổng \d+ nhân sự$/)).not.toBeInTheDocument();
      cleanup();

      // A past month that already has money keeps its figures without the redirect banner.
      render(
        <OwnerPayrollDashboardPage
          dashboard={dashboard({ filters: septemberFilters })}
          estimateTransport={transport}
          initialOwnerEstimate={{ ...estimate, month: "2026-09-01" }}
        />,
      );
      expect(screen.queryByText(/Bạn đang xem/)).not.toBeInTheDocument();
      cleanup();

      // Under a position filter the link keeps the filter.
      const filteredSeptember = { ...septemberFilters, selectedPositionCode: "teaching_assistant" };
      render(<OwnerPayrollDashboardPage dashboard={dashboard({ filters: filteredSeptember })} estimateTransport={transport} initialOwnerEstimate={empty} />);
      expect(screen.getByRole("link", { name: /Chuyển sang Tháng 11\/2026/ })).toHaveAttribute(
        "href",
        "/payroll/dashboard?month=2026-11&position=teaching_assistant",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // Value: protects=a page filtered to one position shows only that position's by-position row (rows add up to the filtered "Tổng cộng") and hides the "no payroll position" line, since byPosition and issues come back unfiltered;
  // fails_when=other positions' rows appear above a filtered total, or staff without a position are reported on a single-position page;
  // why_new=review pass 2 (fixes 3 and 7): get_owner_payroll_estimate filters statements/summary but not byPosition/issues;
  // seam=inert transport (as above); no_claim=does not prove the RPC filter itself
  it("keeps only the selected position's row and hides the no-position line under a position filter", () => {
    const filtered: OwnerPayrollEstimate = {
      ...estimate,
      byPosition: [
        ...estimate.byPosition,
        { payableVnd: 9_000_000, positionCode: "admissions_manager", staffCount: 3, totalDeductionsVnd: 0, totalEarningsVnd: 9_000_000 },
      ],
      selectedPositionCode: "teaching_assistant",
    };
    const filters = { ...dashboard().filters, selectedPositionCode: "teaching_assistant" };
    render(<OwnerPayrollDashboardPage dashboard={dashboard({ filters })} estimateTransport={transport} initialOwnerEstimate={filtered} />);

    const byPosition = screen.getByRole("table", { name: /Tạm tính theo vị trí/ });
    expect(within(byPosition).getByText("Trợ giảng")).toBeInTheDocument();
    expect(within(byPosition).queryByText("Quản lý tuyển sinh")).not.toBeInTheDocument();
    expect(within(byPosition).queryByText("9.000.000 ₫")).not.toBeInTheDocument();
    expect(screen.queryByTestId("staff-without-position")).not.toBeInTheDocument();
  });

  // Value: protects=an approved month never shows the "nằm trong số tạm tính" pending banner or a "Đã tính tạm" helper even if the summary still reports pending shifts, zero deductions in the by-position table are not red, and "Cập nhật vị trí" is a 44px link on mobile;
  // fails_when=the approved page tells the owner unverified work is in provisional pay, a 0 ₫ deduction reads as a red loss, or the fix-position link drops its touch target / link colour;
  // why_new=review pass 2 (fixes 9, 12 and 13);
  // seam=inert transport (as above); class names stand in for colours and media queries; no_claim=none beyond protects
  it("gates pending copy on approval, keeps zero deductions neutral and sizes the fix link", () => {
    render(
      <OwnerPayrollDashboardPage
        dashboard={dashboard()}
        estimateTransport={transport}
        initialOwnerEstimate={{ ...estimate, approvedAt: "2026-10-05T12:00:00Z", status: "approved" }}
      />,
    );
    expect(screen.queryByText(/đang chờ xác minh công/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đã tính tạm/)).not.toBeInTheDocument();

    const byPosition = screen.getByRole("table", { name: /Tạm tính theo vị trí/ });
    const zeroDeductions = within(byPosition).getAllByText("0 ₫");
    expect(zeroDeductions.length).toBeGreaterThan(0);
    for (const cell of zeroDeductions) {
      expect(cell.className).not.toContain("text-danger");
      // Muted, not subtle: "0 ₫" is data (no advance taken), so it keeps readable contrast.
      expect(cell.className).toContain("text-text-muted");
    }

    const fixLink = within(screen.getByTestId("staff-without-position")).getByRole("link", { name: "Cập nhật vị trí" });
    expect(fixLink.className).toContain("max-md:min-h-11");
    expect(fixLink.className).toContain("text-action-link!");
  });

  it("stacks staff rows below md with inline labels and a 44px action", () => {
    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={estimate} />);

    const table = screen.getByRole("table", { name: /Lương tạm tính theo nhân sự/ });
    expect(table.className).toContain("max-md:block");
    expect(within(table).getAllByRole("row")[0].className).toContain("max-md:hidden");

    const row = within(table).getByText("Trần Thanh Tùng").closest("tr") as HTMLElement;
    expect(row.className).toContain("max-md:grid");
    for (const label of ["Vị trí", "Giờ công", "Chờ xác minh", "Thu nhập", "Khấu trừ", "Tạm tính"]) {
      expect(within(row).getByText(label).className).toContain("md:hidden");
    }
    expect(within(row).getByRole("button", { name: /Xem lương theo ngày/ }).className).toContain("max-md:h-11");
    expect(screen.getByRole("button", { name: "Làm mới tổng quan lương tạm tính" }).className).toContain("max-md:h-11");
  });
});

// Value: protects=an approved month rendered from the approved get_owner_payroll_estimate shape (approvedAt, no calculatedAt) labels the staff table "Phải trả" / "Lương đã duyệt" instead of "Tạm tính", and an estimate without calculatedAt shows "Dữ liệu tính lúc" from asOf in Vietnam time (never "Invalid Date");
// fails_when=calculatedAt is required again, the approved table keeps provisional wording, or the fallback renders an invalid date;
// why_new=final review: the approved branch omits calculatedAt and no render test covered approved wording;
// seam=inert transport; no_claim=payload shape copied from migration 20260918160000 by hand
describe("Approved month and missing calculatedAt (8a)", () => {
  it("labels an approved month as payable and falls back to asOf for the calculation time", () => {
    const { calculatedAt: _omit, ...withoutCalculatedAt } = estimate;
    void _omit;
    render(
      <OwnerPayrollDashboardPage
        dashboard={dashboard()}
        estimateTransport={transport}
        initialOwnerEstimate={{ ...withoutCalculatedAt, approvedAt: "2026-10-05T12:00:00Z", issues: [], status: "approved" }}
      />,
    );
    expect(screen.getByRole("table", { name: /Lương đã duyệt theo nhân sự/ })).toBeInTheDocument();
    expect(screen.getAllByText("Phải trả").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Lương tạm tính theo nhân sự/)).not.toBeInTheDocument();
    cleanup();

    render(<OwnerPayrollDashboardPage dashboard={dashboard()} estimateTransport={transport} initialOwnerEstimate={withoutCalculatedAt} />);
    expect(screen.getByText(/Dữ liệu tính lúc: 15:30,? 12\/10\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });
});
