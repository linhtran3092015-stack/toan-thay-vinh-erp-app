import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CommissionListPage } from "@/features/commissions/commission-list-page";
import type { SalesCommissionAccrualDashboardEntry } from "@/features/commissions/read-models";

const accrual = (
  overrides: Partial<SalesCommissionAccrualDashboardEntry> = {},
): SalesCommissionAccrualDashboardEntry => ({
  id: "11111111-1111-4111-8111-111111111111",
  leadSourceCode: "MMA-REF",
  leadSourceGroup: "mma",
  leadSourceName: "MMA Referral",
  recognizedAt: "2026-08-11T08:00:00.000Z",
  recognizedOn: "2026-08-11",
  recognizedRevenueVnd: 150_000,
  saleOwnerDisplayName: "Nguyễn Minh An",
  saleOwnerEmployeeCode: "NS-001",
  saleOwnerId: "22222222-2222-4222-8222-222222222222",
  sourceCashflowRecordId: "33333333-3333-4333-8333-333333333333",
  status: "provisional",
  studentFullName: "Trần Gia Hân",
  studentId: "44444444-4444-4444-8444-444444444444",
  studentPublicCode: "HV-001",
  ...overrides,
});

afterEach(() => {
  cleanup();
});

describe("Commission eligible-revenue presentation", () => {
  it("preserves reader order and presents known source groups, provisional status, and individual VND values", () => {
    const entries = [
      accrual({ id: "first", recognizedRevenueVnd: 150_000, studentFullName: "Học sinh thứ nhất" }),
      accrual({
        id: "second",
        leadSourceCode: "SANDBOX-REF",
        leadSourceGroup: "sandbox",
        leadSourceName: "Sandbox Referral",
        recognizedRevenueVnd: 275_000,
        studentFullName: "Học sinh thứ hai",
      }),
    ];

    render(<CommissionListPage canManage entries={entries} />);

    const table = screen.getByRole("table", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" });
    const text = table.textContent ?? "";
    expect(text.indexOf("Học sinh thứ nhất")).toBeLessThan(text.indexOf("Học sinh thứ hai"));
    expect(screen.getAllByText("MMA")).not.toHaveLength(0);
    expect(screen.getAllByText("Sandbox")).not.toHaveLength(0);
    expect(screen.getAllByText("Chờ chính sách")).not.toHaveLength(0);
    // formatVnd (one currency symbol since step 13); the matcher sees its no-break space as a space.
    expect(screen.getAllByText("150.000 ₫")).not.toHaveLength(0);
    expect(screen.getAllByText("275.000 ₫")).not.toHaveLength(0);
    expect(text).toContain("150.000\u00a0₫");
    expect(text).toContain("275.000\u00a0₫");
  });

  it("fails closed for prototype-property raw source and status values without mutation UI", () => {
    render(<CommissionListPage
      canManage
      entries={[accrual({
        leadSourceGroup: "constructor",
        leadSourceName: "Nguồn không xác định",
        status: "constructor",
      })]}
    />);

    expect(screen.getAllByText("Nguồn chưa hỗ trợ: constructor")).not.toHaveLength(0);
    expect(screen.getAllByText("Trạng thái chưa hỗ trợ: constructor")).not.toHaveLength(0);
    expect(screen.queryByText("MMA", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Sandbox", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Chờ chính sách")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses the approved 1120/1122 container contract with no client aggregate or commission engine", () => {
    render(<CommissionListPage canManage={false} entries={[accrual()]} />);

    expect(screen.getByRole("table", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" }).closest(".commission-directory-work-area")).not.toBeNull();
    expect(screen.getByRole("list", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" })).toBeInTheDocument();
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const source = readFileSync(resolve(process.cwd(), "src/features/commissions/commission-list-page.tsx"), "utf8");

    expect(globals).toMatch(/\.commission-directory-work-area\s*\{\s*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 1122px\)[\s\S]*\.commission-directory-table/);
    expect(source).toContain('min-w-[1120px]');
    expect(source).not.toContain(".reduce(");
    expect(source).not.toContain(".filter(");
    expect(source).not.toContain(".sort(");
    expect(source).not.toContain("getPayroll");
    expect(source).not.toMatch(/lg:(block|hidden)/);
  });
});

// Value: protects=the step 14b list contract: read-only header (counts + the "not commission money" sentence, no money total), Month / Sale / source filters built from the loaded rows (Sale only with commissions.manage), month bucketing by recognizedOn (the Vietnam bank date) with the time caption in Vietnam time, "Xóa lọc" only once something is filtered, an in-frame empty state for no data and for a filtered-empty result, 20 rows per page, and the "có thể chưa đủ" notice only when the load is capped and the oldest loaded day is not before the selected month;
// fails_when=a month follows recognizedAt or the server timezone, a static MMA/Sandbox option appears, a non-manager gets the Sale column or filter, a default render gains a button, a cut month is presented as complete (or a complete one as cut), or an empty list collapses to a bare section;
// why_new=the page was a server component without filters or paging; seam=none (props only, no router); no_claim=the RPC scope/limit and the real container-query switch between table and cards (jsdom renders both layouts)
const monthSelect = () => screen.getByLabelText("Tháng ghi nhận") as HTMLSelectElement;
const sourceSelect = () => screen.getByLabelText("Nguồn") as HTMLSelectElement;
const optionTexts = (select: HTMLSelectElement) => within(select).getAllByRole("option").map((option) => option.textContent);
const tableBodyRows = () =>
  within(screen.getByRole("table", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" })).getAllByRole("row").slice(1);

const october = accrual({
  id: "october",
  recognizedAt: "2026-10-12T03:00:00.000Z",
  recognizedOn: "2026-10-12",
  studentFullName: "Học sinh tháng mười",
});
// 00:30 on 1 Oct in Vietnam (30 Sep in UTC): an October row.
const boundary = accrual({
  id: "boundary",
  leadSourceCode: "SANDBOX-REF",
  leadSourceGroup: "sandbox",
  leadSourceName: "Sandbox Referral",
  recognizedAt: "2026-09-30T17:30:00.000Z",
  recognizedOn: "2026-10-01",
  saleOwnerDisplayName: "Phạm Quốc Huy",
  saleOwnerEmployeeCode: null,
  saleOwnerId: "sale-2",
  studentFullName: "Học sinh nửa đêm",
});
const august = accrual({ id: "august", studentFullName: "Học sinh tháng tám" });
const ledger = [october, boundary, august];

describe("Commission eligible-revenue list (step 14b)", () => {
  it("keeps the truth sentence in a counts-only header and offers no button by default", () => {
    render(<CommissionListPage canManage entries={ledger} />);

    expect(screen.getByRole("heading", { level: 1, name: "Doanh thu đủ điều kiện hoa hồng" })).toBeInTheDocument();
    expect(screen.getByText("3 bản ghi · Dữ liệu này chưa phải khoản hoa hồng, lương hoặc chi trả.")).toBeInTheDocument();
    expect(screen.queryByText(/tổng/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("builds the month, Sale and source options from the loaded rows, newest month first", () => {
    render(<CommissionListPage canManage entries={ledger} />);

    expect(optionTexts(monthSelect())).toEqual(["Tất cả tháng", "Tháng 10/2026", "Tháng 08/2026"]);
    expect(optionTexts(screen.getByLabelText("Sale") as HTMLSelectElement)).toEqual([
      "Tất cả Sale",
      "Nguyễn Minh An · NS-001",
      "Phạm Quốc Huy",
    ]);
    expect(optionTexts(sourceSelect())).toEqual(["Tất cả nguồn", "MMA", "Sandbox"]);
  });

  it("offers only the unsupported source when no row has a known group", () => {
    render(<CommissionListPage canManage entries={[accrual({ leadSourceGroup: "constructor" })]} />);

    expect(optionTexts(sourceSelect())).toEqual(["Tất cả nguồn", "Nguồn chưa hỗ trợ: constructor"]);
  });

  it("hides the Sale column and filter without commissions.manage", () => {
    render(<CommissionListPage canManage={false} entries={ledger} />);

    expect(screen.queryByRole("columnheader", { name: "Sale" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Sale")).not.toBeInTheDocument();
    expect(screen.queryByText("Nguyễn Minh An")).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Ngày ghi nhận",
      "Học sinh",
      "Nguồn",
      "Doanh thu ghi nhận",
      "Trạng thái",
    ]);
  });

  it("buckets by recognizedOn and captions the bank time in Vietnam time", () => {
    render(<CommissionListPage canManage entries={ledger} />);

    const midnightRow = tableBodyRows()[1];
    expect(within(midnightRow).getByText("01/10/2026")).toBeInTheDocument();
    expect(within(midnightRow).getByText("lúc 00:30")).toBeInTheDocument();
    // Full Vietnam timestamp in the title (formatDateTime; its part order follows ICU).
    const title = within(midnightRow).getByText("01/10/2026").parentElement?.getAttribute("title") ?? "";
    expect(title).toMatch(/^Tiền về lúc /);
    expect(title).toContain("00:30");
    expect(title).toContain("01/10/2026");

    fireEvent.change(monthSelect(), { target: { value: "2026-10" } });

    expect(tableBodyRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("Học sinh tháng mười"),
      expect.stringContaining("Học sinh nửa đêm"),
    ]);
    expect(screen.getByText("2 trong 3 bản ghi · Dữ liệu này chưa phải khoản hoa hồng, lương hoặc chi trả.")).toBeInTheDocument();
  });

  it("filters by Sale and source in reader order, then resets with Xóa lọc", () => {
    render(<CommissionListPage canManage entries={ledger} />);

    fireEvent.change(screen.getByLabelText("Sale"), { target: { value: "22222222-2222-4222-8222-222222222222" } });
    expect(tableBodyRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("Học sinh tháng mười"),
      expect.stringContaining("Học sinh tháng tám"),
    ]);

    fireEvent.change(sourceSelect(), { target: { value: "sandbox" } });
    expect(screen.getAllByText("Không có bản ghi khớp bộ lọc")).not.toHaveLength(0);
    expect(within(screen.getByRole("table", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" })).getAllByRole("row")).toHaveLength(1);
    expect(screen.queryByRole("list", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc (2)" }));
    expect(tableBodyRows()).toHaveLength(3);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    fireEvent.change(sourceSelect(), { target: { value: "sandbox" } });
    fireEvent.change(monthSelect(), { target: { value: "2026-08" } });
    // The in-frame reset of the filtered-empty state (one per layout in jsdom).
    fireEvent.click(screen.getAllByRole("button", { name: "Xóa lọc" })[0]);
    expect(tableBodyRows()).toHaveLength(3);
    expect(sourceSelect().value).toBe("all");
  });

  it("keeps the frame with an in-frame empty state when nothing is loaded", () => {
    render(<CommissionListPage canManage entries={[]} />);

    const table = screen.getByRole("table", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" });
    expect(within(table).getAllByRole("row")).toHaveLength(1);
    expect(screen.getAllByText("Chưa có doanh thu đủ điều kiện")).not.toHaveLength(0);
    expect(screen.getByText("0 bản ghi · Dữ liệu này chưa phải khoản hoa hồng, lương hoặc chi trả.")).toBeInTheDocument();
    expect(monthSelect()).toBeDisabled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // Value (extension, coverage pass 1): protects=a filter change sends the list back to page 1; fails_when=updateFilter stops resetting the page, so picking a month on page 2 opens mid-list (21–25) instead of at the newest rows; why_new=paging was only tested without a filter change; seam=none; no_claim=the Pagination component's own buttons
  it("pages 20 rows at a time in both layouts", () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      accrual({ id: `row-${index}`, studentFullName: `Học sinh số ${index + 1}` }),
    );
    render(<CommissionListPage canManage={false} entries={many} />);

    expect(tableBodyRows()).toHaveLength(20);
    expect(within(screen.getByRole("list", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" })).getAllByRole("listitem")).toHaveLength(20);
    expect(screen.getAllByText("1–20 trong 25 bản ghi")).toHaveLength(2);

    fireEvent.click(within(screen.getByRole("navigation", { name: "Phân trang doanh thu đủ điều kiện hoa hồng" })).getByRole("button", { name: "Sau" }));

    expect(tableBodyRows()).toHaveLength(5);
    expect(tableBodyRows()[0]).toHaveTextContent("Học sinh số 21");

    // Every row is from 08/2026, so the month keeps all 25, but a new filter starts at the top.
    fireEvent.change(monthSelect(), { target: { value: "2026-08" } });
    expect(tableBodyRows()).toHaveLength(20);
    expect(tableBodyRows()[0]).toHaveTextContent("Học sinh số 1");
    expect(screen.getAllByText("1–20 trong 25 bản ghi")).toHaveLength(2);
  });

  it("flags a month only when the capped load may have cut it", () => {
    // Oldest loaded day is 1 Oct: October may be cut, a later load could not miss it.
    const capped = [october, boundary];
    render(<CommissionListPage canManage entries={capped} limit={2} />);

    expect(screen.getByText("2 bản ghi · chỉ tải 2 bản ghi mới nhất theo ngày tiền về · Dữ liệu này chưa phải khoản hoa hồng, lương hoặc chi trả.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.change(monthSelect(), { target: { value: "2026-10" } });
    expect(screen.getByRole("status")).toHaveTextContent("Tháng 10/2026 có thể chưa đủ: chỉ tải 2 bản ghi mới nhất.");
    cleanup();

    // The same month is complete when the oldest loaded row is strictly before it.
    render(<CommissionListPage canManage entries={ledger} limit={3} />);
    fireEvent.change(monthSelect(), { target: { value: "2026-10" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.change(monthSelect(), { target: { value: "2026-08" } });
    expect(screen.getByRole("status")).toHaveTextContent("Tháng 08/2026 có thể chưa đủ: chỉ tải 3 bản ghi mới nhất.");
    cleanup();

    // Below the limit nothing is cut (default limit 200).
    render(<CommissionListPage canManage entries={ledger} />);
    fireEvent.change(monthSelect(), { target: { value: "2026-08" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
