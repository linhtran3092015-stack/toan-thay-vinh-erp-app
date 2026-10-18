import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { PaymentRequestStatusBadge } from "@/features/finance/components/payment-request-status-badge";
import { PaymentRequestTable } from "@/features/finance/components/payment-request-table";
import { PaymentRequestDirectory, countActivePaymentRequestFilters } from "@/features/finance/payment-request-directory";
import { paymentRequestStatusLabels } from "@/features/finance/payment-request-directory-models";
import { defaultPaymentRequestFilters } from "@/features/finance/payment-request-url-state";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";

// Run as a UTC host (like the production server): a date formatted without the Vietnam
// time zone then shows the wrong day/hour here too, not only in CI. Set before any import.
// The runner's own TZ is restored after this file, so later files in the same worker keep it.
const timeZone = vi.hoisted(() => {
  const original = process.env.TZ;
  process.env.TZ = "UTC";
  return { original };
});

afterAll(() => {
  if (timeZone.original === undefined) delete process.env.TZ;
  else process.env.TZ = timeZone.original;
});

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
// The URL the directory reads; "" (the original fixed mock) unless a test sets it.
const search = vi.hoisted(() => ({ value: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search.value),
}));

afterEach(() => {
  cleanup();
  search.value = "";
  vi.clearAllMocks();
});

const item: PaymentRequestReadModel = { bonusSessions: 2, calculatedUnitPriceVnd: 140000, createdAt: "2026-08-10T00:00:00Z", expectedAmountVnd: 1_400_000, guardianFullName: "Nguyễn Thị Mai", guardianPhone: "0900000000", id: "request-1", notes: null, paidAmountVnd: 400_000, paidAt: null, publicCode: "YC-001", purchasedSessions: 10, status: "partially_paid", studentFullName: "Nguyễn Minh An", studentId: "student-1", studentPublicCode: "HV001", topupType: "new", transferCode: "TTVC YC001" };

describe("Payment request directory presentation", () => {
  it("uses the shared table frame and labelled responsive records while keeping money and sessions distinct", () => {
    render(<PaymentRequestTable items={[item]} />);
    expect(screen.getByRole("table", { name: "Danh sách yêu cầu thanh toán" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Danh sách yêu cầu thanh toán" })).toBeInTheDocument();
    expect(screen.getAllByText("Thanh toán một phần")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Mở hồ sơ học viên Nguyễn Minh An" })).toHaveLength(2);
    expect(screen.getAllByText(/buổi mua/i)).not.toHaveLength(0);
  });

  it("maps only the existing payment-request lifecycle status semantically", () => {
    render(<PaymentRequestStatusBadge status="expired" />);
    expect(screen.getByText("Hết hạn")).toBeInTheDocument();
  });

  it("counts only active Finance-owned filters and never treats pagination as a filter", () => {
    expect(countActivePaymentRequestFilters(defaultPaymentRequestFilters)).toBe(0);
    expect(countActivePaymentRequestFilters({ ...defaultPaymentRequestFilters, search: "An", status: "pending" })).toBe(2);
  });

  it("scopes the outstanding summary to the loaded directory data and keeps unbound finance workflows absent", () => {
    render(<PaymentRequestDirectory canCreatePaymentRequests items={[item]} />);

    expect(screen.getByText("Còn chờ nhận")).toBeInTheDocument();
    expect(screen.getByText("Trong danh sách yêu cầu đang tải")).toBeInTheDocument();
    expect(screen.queryByText(/Tổng công nợ|Công nợ toàn trung tâm|tổng phải thu toàn trung tâm/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /phân bổ|đối soát|hoàn phí|hoàn tiền/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /phân bổ|đối soát|hoàn phí|hoàn tiền/i })).not.toBeInTheDocument();
  });
});

// Step 14c: columns, captions, chips, filters, pagers and permission gates of the redesigned list.
const TODAY = "2026-10-16";
// 12:00 on 16/10 in Vietnam: the route's `now` for "chờ quá 14 ngày".
const NOW = "2026-10-16T05:00:00Z";
const TABLE = "Danh sách yêu cầu thanh toán";
const request = (overrides: Partial<PaymentRequestReadModel>): PaymentRequestReadModel => ({ ...item, ...overrides });
const table = () => screen.getByRole("table", { name: TABLE });
const list = () => screen.getByRole("list", { name: TABLE });
const tableRows = () => within(table()).getAllByRole("row").slice(1);

describe("Payment request list (step 14c)", () => {
  it("shows the slip's sessions and unit price, Vietnam times, Còn only while owed, Thừa on overpay and the 14-day caption", () => {
    render(
      <PaymentRequestTable
        items={[
          // 18:00 UTC on 09/08 is 01:00 on 10/08 in Vietnam.
          request({ createdAt: "2026-08-09T18:00:00Z" }),
          request({ bonusSessions: 0, createdAt: "2026-10-14T08:15:00Z", expectedAmountVnd: 1_400_000, id: "request-2", paidAmountVnd: 1_500_000, paidAt: "2026-10-14T10:02:00Z", publicCode: "YC-002", status: "paid" }),
          request({ bonusSessions: 0, createdAt: "2026-10-12T03:00:00Z", expectedAmountVnd: 1_300_000, id: "request-3", paidAmountVnd: 0, publicCode: "YC-003", status: "cancelled" }),
          // Pending 15 days before NOW: overdue. The next one is 13 days 23 hours old: not yet.
          request({ bonusSessions: 0, createdAt: "2026-10-01T03:00:00Z", id: "request-4", paidAmountVnd: 0, publicCode: "YC-004", status: "pending" }),
          request({ bonusSessions: 0, createdAt: "2026-10-02T06:00:00Z", id: "request-5", paidAmountVnd: 0, publicCode: "YC-005", status: "pending" }),
        ]}
        now={NOW}
        today={TODAY}
      />,
    );

    // Columns: Mã 0 · Học sinh 1 · Phụ huynh 2 · Số buổi 3 · Phải thu 4 · Đã thu 5 · Trạng thái 6 (no "Thời gian").
    expect(within(table()).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Mã", "Học sinh", "Phụ huynh", "Số buổi", "Phải thu", "Đã thu", "Trạng thái"]);
    const [partial, overpaid, cancelled] = tableRows() as HTMLTableRowElement[];
    const cellOf = (element: HTMLElement) => element.closest("td");

    // Số buổi: bought + bonus only ("buổi mua" never splits); the unit price sits under Phải thu.
    expect(cellOf(within(partial).getByText("+2 tặng"))).toBe(partial.cells[3]);
    expect(within(partial.cells[3]).getByText(/buổi mua/).textContent).toBe("10 buổi\u00a0mua");
    expect(partial.cells[3]).not.toHaveTextContent("/buổi");
    expect(cellOf(within(partial).getByText("140.000 ₫/buổi"))).toBe(partial.cells[4]);
    expect(within(table()).getAllByText("140.000 ₫/buổi")).toHaveLength(5);
    expect(within(list()).getByText("10 buổi mua · +2 tặng · 140.000 ₫/buổi")).toBeInTheDocument();

    // Mã: full code (transfer code in its title) over "loại · tạo {Vietnam time}", the full time in a title.
    const code = within(partial).getByText("YC-001");
    expect(code).toHaveAttribute("title", "Mã chuyển khoản: TTVC YC001");
    const created = within(partial).getByText("tạo 10/08 01:00");
    expect(cellOf(created)).toBe(partial.cells[0]);
    expect(created.textContent).toBe("tạo 10/08\u00a001:00");
    expect(created.parentElement).toHaveTextContent("Tuyển mới · tạo 10/08 01:00");
    expect(created.parentElement).toHaveAttribute("title", "Tạo lúc 01:00 10/08/2026");
    expect(within(list()).getAllByText("10/08 01:00")).toHaveLength(1);
    expect(screen.queryByText(/09\/08/)).not.toBeInTheDocument();

    // Đã thu: Còn while owed, Thừa on overpay plus the Vietnam payment time (both lines), nothing on a cancelled row.
    expect(cellOf(within(partial).getByText("Còn 1.000.000 ₫"))).toBe(partial.cells[5]);
    expect(cellOf(within(overpaid).getByText("Thừa 100.000 ₫"))).toBe(overpaid.cells[5]);
    const paidAt = within(overpaid).getByText("14/10 17:02");
    expect(cellOf(paidAt)).toBe(overpaid.cells[5]);
    expect(paidAt.textContent).toBe("14/10\u00a017:02");
    expect(paidAt.parentElement).toHaveTextContent("thanh toán 14/10 17:02");
    expect(paidAt.parentElement).toHaveAttribute("title", "Thanh toán lúc 17:02 14/10/2026");
    expect(cancelled.cells[5]).toHaveTextContent(/^0 ₫$/);
    expect(screen.queryByText(/Còn 1\.300\.000/)).not.toBeInTheDocument();
    expect(within(list()).getByText("· thanh toán 14/10 17:02")).toBeInTheDocument();

    expect(screen.getAllByText("chờ quá 14 ngày")).toHaveLength(2);
    expect(screen.queryByText("Hết hạn")).not.toBeInTheDocument();
  });

  it("gates profile links on students.view and offers Hủy phiếu only on pending requests with nothing paid", () => {
    const pending = request({ id: "request-9", paidAmountVnd: 0, publicCode: "YC-009", status: "pending" });
    const { unmount } = render(<PaymentRequestTable canCancel canViewStudents={false} items={[pending, item]} today={TODAY} />);

    expect(screen.queryByRole("link", { name: /Mở hồ sơ học viên/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Hủy phiếu thu YC-009" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Hủy phiếu thu YC-001" })).not.toBeInTheDocument();
    expect(within(table()).getByRole("columnheader", { name: "Thao tác" })).toBeInTheDocument();
    for (const trigger of screen.getAllByRole("button", { name: "Hủy phiếu thu YC-009" })) {
      expect(trigger).toHaveTextContent("Hủy phiếu");
      expect(trigger).toHaveClass("border-danger");
      expect(trigger).not.toHaveClass("bg-danger");
    }
    unmount();

    render(<PaymentRequestTable items={[pending]} today={TODAY} />);
    expect(screen.queryByRole("columnheader", { name: "Thao tác" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hủy phiếu/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Mở hồ sơ học viên Nguyễn Minh An" })[0]).toHaveAttribute("href", "/students/student-1");
  });

  it("counts status chips over the loaded rows and writes the chosen chip as the status filter", () => {
    const items = [
      request({ id: "a", publicCode: "YC-A", status: "pending", paidAmountVnd: 0 }),
      request({ id: "b", publicCode: "YC-B" }),
      request({ id: "c", paidAmountVnd: 1_400_000, paidAt: "2026-10-01T03:00:00Z", publicCode: "YC-C", status: "paid", topupType: "renewal" }),
      request({ id: "d", paidAmountVnd: 0, publicCode: "YC-D", status: "cancelled" }),
    ];
    render(<PaymentRequestDirectory canCreatePaymentRequests items={items} today={TODAY} />);

    const chips = screen.getByRole("group", { name: "Lọc nhanh yêu cầu thanh toán" });
    expect(within(chips).getByRole("button", { name: "Tất cả4" })).toHaveAttribute("aria-pressed", "true");
    expect(within(chips).getByRole("button", { name: "Chờ thanh toán1" })).toBeEnabled();
    expect(within(chips).getByRole("button", { name: "Thanh toán một phần1" })).toBeInTheDocument();
    expect(within(chips).getByRole("button", { name: "Đã hủy1" })).toBeInTheDocument();
    expect(within(chips).queryByRole("button", { name: /Hết hạn/ })).not.toBeInTheDocument();
    // Chips live in the directory, never in PaymentRequestTable (its status text stays table + card).
    expect(within(table()).getAllByText("Thanh toán một phần")).toHaveLength(1);

    fireEvent.click(within(chips).getByRole("button", { name: "Đã thanh toán1" }));
    expect(router.replace).toHaveBeenLastCalledWith("/finance/payment-requests?status=paid", { scroll: false });
    expect(tableRows()).toHaveLength(1);
    expect(within(chips).getByRole("button", { name: "Đã thanh toán1" })).toHaveAttribute("aria-pressed", "true");

    // The other filters narrow the chip counts; the status itself does not.
    fireEvent.change(screen.getByTestId("desktop-payment-request-topup"), { target: { value: "renewal" } });
    expect(router.replace).toHaveBeenLastCalledWith("/finance/payment-requests?status=paid&topupType=renewal", { scroll: false });
    expect(within(chips).getByRole("button", { name: "Tất cả1" })).toBeEnabled();
    expect(within(chips).getByRole("button", { name: "Chờ thanh toán0" })).toBeDisabled();

    fireEvent.click(within(chips).getByRole("button", { name: "Tất cả1" }));
    expect(router.replace).toHaveBeenLastCalledWith("/finance/payment-requests?topupType=renewal", { scroll: false });
  });

  it("keeps the money strip to the loaded rows: Phải thu leaves cancelled requests out", () => {
    render(
      <PaymentRequestDirectory
        canCreatePaymentRequests={false}
        items={[
          request({ expectedAmountVnd: 1_400_000, id: "a", paidAmountVnd: 0, status: "pending" }),
          request({ expectedAmountVnd: 2_600_000, id: "b", paidAmountVnd: 1_000_000, status: "partially_paid" }),
          request({ expectedAmountVnd: 1_300_000, id: "c", paidAmountVnd: 0, status: "cancelled" }),
          request({ expectedAmountVnd: 1_400_000, id: "d", paidAmountVnd: 1_500_000, paidAt: "2026-10-01T03:00:00Z", status: "paid" }),
        ]}
        today={TODAY}
      />,
    );

    const strip = screen.getByRole("region", { name: "Tóm tắt danh sách yêu cầu đang tải" });
    expect(within(strip).getByText("Phải thu").nextElementSibling).toHaveTextContent("5.400.000 ₫");
    expect(within(strip).getByText("Đã thu").nextElementSibling).toHaveTextContent("2.500.000 ₫");
    expect(within(strip).getByText("Còn chờ nhận").nextElementSibling).toHaveTextContent("3.000.000 ₫");
    expect(screen.queryByText(/Tổng dự kiến|Đã nhận/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tạo yêu cầu" })).not.toBeInTheDocument();
  });

  it("reads the URL, writes filters with router.replace on page 1 and pages with router.push, and keeps the create round trip", () => {
    search.value = "notice=created&page=2";
    const items = Array.from({ length: 25 }, (_, index) => request({ id: `r-${index}`, publicCode: `YC-${100 + index}`, studentFullName: index === 0 ? "Trần An" : `Học sinh ${index}` }));
    render(<PaymentRequestDirectory canCreatePaymentRequests items={items} today={TODAY} />);

    expect(screen.getByText("25/25 yêu cầu trong danh sách đã tải")).toBeInTheDocument();
    expect(screen.getAllByText("21–25 trong 25 yêu cầu")).toHaveLength(2);
    expect(tableRows()).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Tạo yêu cầu" })).toHaveAttribute("href", "/finance/payment-requests/new?page=2");

    fireEvent.click(within(screen.getByRole("navigation", { name: "Phân trang yêu cầu thanh toán" })).getByRole("button", { name: "1" }));
    expect(router.push).toHaveBeenLastCalledWith("/finance/payment-requests?notice=created", { scroll: false });
    expect(screen.getAllByText("1–20 trong 25 yêu cầu")).toHaveLength(2);

    fireEvent.change(screen.getByTestId("desktop-payment-request-search"), { target: { value: "tran an" } });
    expect(router.replace).toHaveBeenLastCalledWith("/finance/payment-requests?notice=created&search=tran+an", { scroll: false });
    expect(screen.getByTestId("desktop-payment-request-search")).toHaveValue("tran an");
    expect(screen.getByText("1/25 yêu cầu trong danh sách đã tải")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tạo yêu cầu" })).toHaveAttribute("href", "/finance/payment-requests/new?search=tran+an");
    expect(screen.getByRole("button", { name: /Xóa lọc/ })).toHaveTextContent("Xóa lọc (1)");
  });

  it("writes to basePath and keeps unrelated params such as the preview's view", () => {
    search.value = "view=payment-requests&role=accountant";
    render(<PaymentRequestDirectory basePath="/dev/lists" canCreatePaymentRequests items={[item]} today={TODAY} />);

    fireEvent.change(screen.getByTestId("desktop-payment-request-status"), { target: { value: "pending" } });
    expect(router.replace).toHaveBeenLastCalledWith("/dev/lists?view=payment-requests&role=accountant&status=pending", { scroll: false });
    // Two quick changes before a re-render (one act) compose instead of dropping the first.
    act(() => {
      fireEvent.change(screen.getByTestId("desktop-payment-request-topup"), { target: { value: "new" } });
      fireEvent.change(screen.getByTestId("desktop-payment-request-from"), { target: { value: "2026-08-01" } });
    });
    expect(router.replace).toHaveBeenLastCalledWith("/dev/lists?view=payment-requests&role=accountant&status=pending&topupType=new&createdFrom=2026-08-01", { scroll: false });
  });

  it("lets a URL it did not write (Back/Forward) win, while its own late-arriving writes never undo newer input", () => {
    const items = [request({ id: "a", paidAmountVnd: 0, status: "pending" }), request({ id: "b", paidAmountVnd: 1_400_000, paidAt: "2026-10-01T03:00:00Z", status: "paid" })];
    search.value = "status=paid";
    const { rerender } = render(<PaymentRequestDirectory canCreatePaymentRequests items={items} today={TODAY} />);
    const chip = (name: RegExp) => within(screen.getByRole("group", { name: "Lọc nhanh yêu cầu thanh toán" })).getByRole("button", { name });
    expect(chip(/^Đã thanh toán/)).toHaveAttribute("aria-pressed", "true");

    // Two writes; Next then applies the first one late: the newer input stays.
    fireEvent.click(chip(/^Chờ thanh toán/));
    fireEvent.change(screen.getByTestId("desktop-payment-request-search"), { target: { value: "An" } });
    search.value = "status=pending";
    rerender(<PaymentRequestDirectory canCreatePaymentRequests items={items} today={TODAY} />);
    expect(screen.getByTestId("desktop-payment-request-search")).toHaveValue("An");
    search.value = "status=pending&search=An";
    rerender(<PaymentRequestDirectory canCreatePaymentRequests items={items} today={TODAY} />);
    expect(chip(/^Chờ thanh toán/)).toHaveAttribute("aria-pressed", "true");

    // Back to a URL this page did not just write: the URL wins.
    search.value = "status=paid";
    rerender(<PaymentRequestDirectory canCreatePaymentRequests items={items} today={TODAY} />);
    expect(chip(/^Đã thanh toán/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("desktop-payment-request-search")).toHaveValue("");
  });

  it("opens the same fields in the filter sheet below the desktop threshold", () => {
    render(<PaymentRequestDirectory canCreatePaymentRequests items={[item]} today={TODAY} />);

    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    const sheet = screen.getByRole("dialog", { name: "Bộ lọc" });
    fireEvent.change(within(sheet).getByTestId("drawer-payment-request-search"), { target: { value: "An" } });
    expect(router.replace).toHaveBeenLastCalledWith("/finance/payment-requests?search=An", { scroll: false });
    expect(within(sheet).getByRole("button", { name: "Xem 1 yêu cầu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bộ lọc, 1 đang áp dụng" })).toBeInTheDocument();
  });

  it("keeps the filtered-empty and no-data states inside the frame", () => {
    search.value = "search=khong-co";
    const { unmount } = render(<PaymentRequestDirectory canCreatePaymentRequests items={[item]} today={TODAY} />);

    expect(table()).toBeInTheDocument();
    expect(screen.getAllByText("Không tìm thấy yêu cầu")).toHaveLength(2);
    // The strip stays (0 ₫) so the page keeps its geometry.
    const strip = screen.getByRole("region", { name: "Tóm tắt danh sách yêu cầu đang tải" });
    expect(within(strip).getByText("Còn chờ nhận").nextElementSibling).toHaveTextContent(/^0 ₫$/);
    expect(within(strip).getByText("Phải thu").nextElementSibling).toHaveTextContent(/^0 ₫$/);
    fireEvent.click(screen.getAllByRole("button", { name: "Xóa lọc" })[0]);
    expect(router.replace).toHaveBeenLastCalledWith("/finance/payment-requests", { scroll: false });
    expect(tableRows()).toHaveLength(1);
    unmount();

    render(<PaymentRequestDirectory canCreatePaymentRequests items={[]} today={TODAY} />);
    expect(table()).toBeInTheDocument();
    expect(screen.getAllByText("Chưa có yêu cầu thanh toán")).toHaveLength(2);
    expect(screen.queryByRole("group", { name: "Lọc nhanh yêu cầu thanh toán" })).not.toBeInTheDocument();
    expect(screen.getByText("0/0 yêu cầu trong danh sách đã tải")).toBeInTheDocument();
  });

  it("forgets its own writes once they land, so Back to an earlier page shows that page", () => {
    const items = Array.from({ length: 45 }, (_, index) => request({ id: `r-${index}`, publicCode: `YC-${100 + index}` }));
    const { rerender } = render(<PaymentRequestDirectory canCreatePaymentRequests items={items} today={TODAY} />);
    const land = (query: string) => {
      search.value = query;
      rerender(<PaymentRequestDirectory canCreatePaymentRequests items={items} today={TODAY} />);
    };
    const pager = () => within(screen.getByRole("navigation", { name: "Phân trang yêu cầu thanh toán" }));

    fireEvent.click(pager().getByRole("button", { name: "2" }));
    land("page=2");
    fireEvent.click(pager().getByRole("button", { name: "3" }));
    land("page=3");
    expect(screen.getAllByText("41–45 trong 45 yêu cầu")).toHaveLength(2);

    land("page=2");
    expect(screen.getAllByText("21–40 trong 45 yêu cầu")).toHaveLength(2);
  });

  it("decides the 14-day caption on the route's now, not the browser clock", () => {
    const old = request({ createdAt: "2026-09-01T03:00:00Z", id: "old", paidAmountVnd: 0, status: "pending" });
    const { unmount } = render(<PaymentRequestDirectory canCreatePaymentRequests items={[old]} now="2026-09-10T00:00:00Z" today="2026-09-10" />);
    expect(screen.queryByText("chờ quá 14 ngày")).not.toBeInTheDocument();
    unmount();

    render(<PaymentRequestDirectory canCreatePaymentRequests items={[old]} now="2026-09-16T00:00:00Z" today="2026-09-16" />);
    expect(screen.getAllByText("chờ quá 14 ngày")).toHaveLength(2);
  });

  it("pairs the 1118px table floor with the 1120px container threshold of its hooks", () => {
    render(<PaymentRequestTable canCancel items={[item]} today={TODAY} />);
    expect(table()).toHaveClass("min-w-[1118px]", "table-fixed");
    // Column floors (the doc comment's budget): Học sinh takes the rest, 172px at the 1118px floor.
    const floors = Object.fromEntries(within(table()).getAllByRole("columnheader").map((header) => [header.textContent, Number(/\bw-\[(\d+)px\]/.exec(header.className)?.[1] ?? 0)]));
    expect(floors).toEqual({ "Học sinh": 0, "Mã": 200, "Phải thu": 124, "Phụ huynh": 110, "Số buổi": 108, "Thao tác": 108, "Trạng thái": 164, "Đã thu": 132 });
    expect(1118 - Object.values(floors).reduce((sum, width) => sum + width, 0)).toBe(172);
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/@container \(min-width: 1120px\)\s*\{\s*\.payment-request-filter-bar,\s*\.payment-request-directory-table/);
  });

  it("takes every status word from the badge, and builds the status filter from the same words", () => {
    for (const [status, label] of Object.entries(paymentRequestStatusLabels)) {
      const { unmount } = render(<PaymentRequestStatusBadge status={status as keyof typeof paymentRequestStatusLabels} />);
      expect(document.body).toHaveTextContent(label);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }

    render(<PaymentRequestDirectory canCreatePaymentRequests items={[item]} today={TODAY} />);
    const options = within(screen.getByTestId("desktop-payment-request-status")).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Tất cả trạng thái", "Chờ thanh toán", "Thanh toán một phần", "Đã thanh toán", "Hết hạn", "Đã hủy"]);
    expect(options.slice(1).sort()).toEqual(Object.values(paymentRequestStatusLabels).sort());
  });

  it("keeps the desktop filter selects wide enough for their longest option", () => {
    render(<PaymentRequestDirectory canCreatePaymentRequests items={[item]} today={TODAY} />);
    const bar = screen.getByRole("region", { name: "Bộ lọc yêu cầu thanh toán" });
    expect(bar.getAttribute("style")).toContain("minmax(220px, 1fr) repeat(2, minmax(196px, 1fr)) repeat(2, minmax(140px, 0.8fr)) auto");
  });

  it("lays out cards with a wrapping name and auto-width actions on the right (they stretch only in a narrow container)", () => {
    const pending = request({ id: "request-9", paidAmountVnd: 0, publicCode: "YC-009", status: "pending", studentFullName: "Tôn Nữ Hoàng Bảo Ngọc Khánh Linh" });
    render(<PaymentRequestTable canCancel items={[pending]} today={TODAY} />);

    const name = within(list()).getByText("Tôn Nữ Hoàng Bảo Ngọc Khánh Linh");
    expect(name).not.toHaveClass("truncate");
    expect(name).toHaveClass("break-words");
    const profile = within(list()).getByRole("link", { name: "Mở hồ sơ học viên Tôn Nữ Hoàng Bảo Ngọc Khánh Linh" });
    const cancel = within(list()).getByRole("button", { name: "Hủy phiếu thu YC-009" });
    for (const control of [profile, cancel]) {
      expect(control).toHaveClass("h-11", "@max-[480px]:flex-1");
      expect(control).not.toHaveClass("flex-1");
    }
    expect(profile.parentElement).toHaveClass("justify-end");
  });
});
