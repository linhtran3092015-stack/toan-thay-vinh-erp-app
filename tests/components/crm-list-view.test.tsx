// Value: protects=the redesigned lead list (design 12a): the header context line and single "Thêm lead" primary, status chips whose counts ignore the status filter and write only `status`, "Xóa lọc (n)" counting active filters and clearing only CRM keys, table cells (warning "Chưa phân công", status suffixes, the converted lead's "Hồ sơ học viên" link, the "Hiển thị n / total lead" footer), a failed load shown as an in-frame error instead of an empty list, and the 1042px container threshold that lets the table show at a 1440 desktop;
// fails_when=chip counts or "Tất cả" are computed from the filtered rows, a chip drops unrelated query state, the reset clears foreign params, an unassigned lead reads as a sale name, a directory error looks like "no leads", the header shows two primaries, or the CRM breakpoint creeps back above the ≈1152px work area of a 1440 screen;
// why_new=step 10 replaces the list header, filters and table presentation;
// seam=next/navigation is mocked (router.replace records the URL); globals.css is read as text for the container query; no_claim=does not render real container queries (jsdom has no layout) or prove server counts (crm-directory-counts covers the loaders)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CrmListView, type CrmListViewProps } from "@/features/crm/components/crm-list-view";
import { getCrmDirectoryQuery } from "@/features/crm/crm-directory-url-state";
import type { CrmLeadItemReadModel } from "@/features/crm/read-models";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
const navigation = vi.hoisted(() => ({ query: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

beforeEach(() => { navigation.query = ""; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

/** Visible copies only: the sr-only live region repeats the count or the state title once. */
function visible(elements: HTMLElement[]) {
  return elements.filter((element) => !element.hasAttribute("aria-live"));
}

function liveRegion(container: HTMLElement) {
  const regions = container.querySelectorAll('[aria-live="polite"]');
  expect(regions).toHaveLength(1);
  return regions[0];
}

function lead(overrides: Partial<CrmLeadItemReadModel> & Pick<CrmLeadItemReadModel, "fullName" | "id" | "status">): CrmLeadItemReadModel {
  return {
    birthYear: 2013,
    createdAt: "2026-10-12T02:00:00Z",
    expectedGrade: 8,
    expectedLevel: "B",
    expectedMode: "offline",
    guardianFullName: "Nguyễn Thị Thu",
    guardianPhone: "0905123456",
    leadSourceName: "MMA · Facebook",
    publicCode: `LD-${overrides.id}`,
    saleOwnerId: "sale-1",
    saleOwnerName: "Hoàng Minh Khôi",
    studentId: null,
    ...overrides,
  };
}

// Status dates getTrustedStatusChangedAt keeps: equal to created_at (same insert), or from CRM_STATUS_TRACKING_SINCE on.
const items: CrmLeadItemReadModel[] = [
  lead({ createdAt: "2026-09-30T03:00:00Z", fullName: "Nguyễn Gia Hân", id: "case-1", saleOwnerId: null, saleOwnerName: "Chưa phân công", status: "interested", statusChangedAt: "2026-09-30T03:00:00Z" }),
  lead({ fullName: "Trần Minh Quân", id: "case-2", nextTrialDate: "2026-10-14", status: "trial_booked" }),
  lead({ fullName: "Đỗ Hoàng Long", id: "case-3", status: "converted", statusChangedAt: "2026-10-14T03:00:00Z", studentId: "student-318" }),
  lead({ dropReason: "học nơi khác", fullName: "Bùi Thanh Tâm", id: "case-4", status: "dropped" }),
];

function props(overrides: Partial<CrmListViewProps> = {}): CrmListViewProps {
  return {
    canCreateLead: true,
    createHref: "/crm/new",
    directory: { items, totalCount: 4 },
    directoryQuery: "",
    leadSources: [{ code: "mma_fanpage", groupCode: "mma", id: "source-1", name: "MMA · Facebook" }],
    overview: { monthLabel: "10/2026", newLeadsThisMonth: 48, pendingConfirmation: 11 },
    saleOwners: [{ fullName: "Hoàng Minh Khôi", id: "5a1e0000-0000-4000-8000-000000000001" }],
    statusCounts: { converted: 5, dropped: 2, interested: 14, pending_enrollment_confirmation: 11, trial_booked: 9, trial_completed: 7 },
    todayIso: "2026-10-14",
    ...overrides,
  };
}

describe("CRM lead list", () => {
  it("heads the page with this month's context and one primary to add a lead", () => {
    render(<CrmListView {...props()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Lead tuyển sinh" })).toBeInTheDocument();
    expect(screen.getByText("Tháng 10/2026 · 48 lead mới · 11 chờ xác nhận nhập học")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Thêm lead" })).toHaveAttribute("href", "/crm/new");
    expect(screen.queryByText(/tỉ lệ chuyển đổi/)).not.toBeInTheDocument();
  });

  it("hides the add action without crm.update and leaves out a context count that failed", () => {
    render(<CrmListView {...props({ canCreateLead: false, overview: { monthLabel: "10/2026", newLeadsThisMonth: null, pendingConfirmation: 3 } })} />);
    expect(screen.queryByRole("link", { name: "Thêm lead" })).not.toBeInTheDocument();
    expect(screen.getByText("Tháng 10/2026 · 3 chờ xác nhận nhập học")).toBeInTheDocument();
  });

  it("shows status chips with server counts, Tất cả as their sum, and writes only status", () => {
    navigation.query = "status=dropped&source=mma_fanpage&theme=dark";
    render(<CrmListView {...props({ directory: { items: [items[3]], totalCount: 1 }, directoryQuery: "status=dropped&source=mma_fanpage" })} />);

    const chips = screen.getByRole("group", { name: "Lọc nhanh theo trạng thái" });
    expect(within(chips).getByRole("button", { name: /^Tất cả\s*48$/ })).toHaveAttribute("aria-pressed", "false");
    expect(within(chips).getByRole("button", { name: /^Đã dừng\s*2$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(chips).getByRole("button", { name: /^Đang quan tâm\s*14$/ })).toBeEnabled();

    fireEvent.click(within(chips).getByRole("button", { name: /^Đang quan tâm\s*14$/ }));
    expect(router.replace).toHaveBeenLastCalledWith("/crm?status=interested&source=mma_fanpage&theme=dark", { scroll: false });
    fireEvent.click(within(chips).getByRole("button", { name: /^Tất cả\s*48$/ }));
    expect(router.replace).toHaveBeenLastCalledWith("/crm?source=mma_fanpage&theme=dark", { scroll: false });
  });

  it("hides the chips when counts failed instead of showing zeros", () => {
    render(<CrmListView {...props({ statusCounts: null })} />);
    expect(screen.queryByRole("group", { name: "Lọc nhanh theo trạng thái" })).not.toBeInTheDocument();
  });

  it("counts active filters on Xóa lọc and clears only CRM-owned keys", () => {
    navigation.query = "search=An&sale=5a1e0000-0000-4000-8000-000000000001&theme=dark";
    render(<CrmListView {...props()} />);

    const bar = screen.getByRole("region", { name: "Bộ lọc lead" });
    expect(within(bar).getByLabelText("Sale phụ trách")).toHaveAttribute("data-active", "true");
    expect(within(bar).getByLabelText("Nguồn")).not.toHaveAttribute("data-active");
    expect(within(bar).getByRole("searchbox")).toHaveValue("An");
    fireEvent.click(within(bar).getByRole("button", { name: "Xóa lọc (2)" }));
    expect(router.replace).toHaveBeenLastCalledWith("/crm?theme=dark", { scroll: false });
    expect(screen.getByRole("button", { name: "Bộ lọc, 2 đang áp dụng" })).toBeInTheDocument();
  });

  // Value (fix pass 2, G5): protects=a status or sale value the loaders ignore (hand-edited URL) is not shown as an active filter: "Tất cả" stays pressed and "Xóa lọc" stays hidden, matching the unfiltered list on screen;
  // fails_when=the filter bar reads the raw status/sale params again (shows "Xóa lọc (2)" and no pressed chip over an unfiltered list);
  // why_new=pass 1 normalised the params only on the server; seam=next/navigation mocked as in this file; no_claim=none beyond protects
  it("treats an unknown status and a non-id sale as no filter", () => {
    navigation.query = "status=foo&sale=sale-1";
    render(<CrmListView {...props()} />);

    const chips = screen.getByRole("group", { name: "Lọc nhanh theo trạng thái" });
    expect(within(chips).getByRole("button", { name: /^Tất cả\s*48$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(chips).getAllByRole("button").filter((chip) => chip.getAttribute("aria-pressed") === "true")).toHaveLength(1);
    const bar = screen.getByRole("region", { name: "Bộ lọc lead" });
    expect(within(bar).queryByRole("button", { name: /Xóa lọc/ })).not.toBeInTheDocument();
    expect(within(bar).getByLabelText("Trạng thái")).not.toHaveAttribute("data-active");
    expect(within(bar).getByLabelText("Sale phụ trách")).not.toHaveAttribute("data-active");
    expect(screen.getByRole("button", { name: "Bộ lọc" })).toBeInTheDocument();
  });

  // Value (extension, fix pass 3, H1/H2): protects=a grade the loaders ignore (`?grade=13`) is not an active filter, and a non-id `?sale=foo` over an empty directory reads as the unfiltered "Chưa có lead nào" (the page's query string drops it as the loaders do) rather than "Không có lead phù hợp";
  // fails_when=the filter bar counts the raw grade param, or getCrmDirectoryQuery keeps a sale value the loaders ignore;
  // why_new=H1/H2; seam=next/navigation mocked as in this file; directoryQuery is built with the page's helper; no_claim=does not render the page itself (crm-directory-live-count covers the page's loader arguments)
  it("ignores a grade outside 1–12 and a non-id sale like the loaders do", () => {
    navigation.query = "grade=13";
    const { unmount } = render(<CrmListView {...props()} />);
    const bar = screen.getByRole("region", { name: "Bộ lọc lead" });
    expect(within(bar).queryByRole("button", { name: /Xóa lọc/ })).not.toBeInTheDocument();
    expect(within(bar).getByLabelText("Khối dự kiến")).not.toHaveAttribute("data-active");
    unmount();

    navigation.query = "sale=foo";
    render(<CrmListView {...props({ directory: { items: [], totalCount: 0 }, directoryQuery: getCrmDirectoryQuery(new URLSearchParams(navigation.query)) })} />);
    expect(visible(screen.getAllByText("Chưa có lead nào"))).toHaveLength(2);
    expect(screen.queryByText("Không có lead phù hợp")).not.toBeInTheDocument();
  });

  // Value: protects=a search that sanitises to nothing (`?search=()`) is not an active filter: no "Xóa lọc", the search box is not marked active, and an empty directory reads as unfiltered, while the typed text stays in the box;
  // fails_when=the filter bar counts the raw search with trim() only, or getCrmDirectoryQuery keeps a punctuation-only search the loader ignores;
  // why_new=step 10 fix pass 4 (P4); seam=next/navigation mocked as in this file; directoryQuery is built with the page's helper; no_claim=does not run the loader (crm-directory-url-state covers the shared sanitiser)
  it("does not count a search that sanitises to nothing as a filter", () => {
    navigation.query = "search=()";
    render(<CrmListView {...props({ directory: { items: [], totalCount: 0 }, directoryQuery: getCrmDirectoryQuery(new URLSearchParams(navigation.query)) })} />);
    const bar = screen.getByRole("region", { name: "Bộ lọc lead" });
    expect(within(bar).queryByRole("button", { name: /Xóa lọc/ })).not.toBeInTheDocument();
    const search = within(bar).getByPlaceholderText("Tên học sinh, phụ huynh, SĐT, mã lead");
    expect(search).toHaveValue("()");
    expect(search).not.toHaveAttribute("data-active");
    expect(visible(screen.getAllByText("Chưa có lead nào"))).toHaveLength(2);
    expect(screen.queryByText("Không có lead phù hợp")).not.toBeInTheDocument();
  });

  it("orders the five filters like the design and keeps the reset hidden when nothing is filtered", () => {
    render(<CrmListView {...props()} />);
    const bar = screen.getByRole("region", { name: "Bộ lọc lead" });
    const labels = Array.from(bar.querySelectorAll("label")).map((label) => label.firstChild?.textContent);
    expect(labels).toEqual(["Tìm kiếm", "Trạng thái", "Nguồn", "Sale phụ trách", "Khối dự kiến"]);
    expect(within(bar).getByPlaceholderText("Tên học sinh, phụ huynh, SĐT, mã lead")).toBeInTheDocument();
    expect(within(bar).queryByRole("button", { name: /Xóa lọc/ })).not.toBeInTheDocument();
  });

  it("renders unassigned, suffixed and converted rows in the table", () => {
    render(<CrmListView {...props()} />);
    const table = screen.getByRole("table", { name: "Danh sách hồ sơ CRM và tuyển sinh" });
    const row = (name: string) => within(table).getByRole("link", { name }).closest("tr")!;

    expect(within(row("Nguyễn Gia Hân")).getByText("Chưa phân công")).toHaveClass("bg-warning-bg");
    expect(within(row("Nguyễn Gia Hân")).getByText("Đang quan tâm · 14 ngày")).toBeInTheDocument();
    expect(within(row("Nguyễn Gia Hân")).getByText("LD-case-1 · sinh 2013")).toBeInTheDocument();
    expect(within(row("Trần Minh Quân")).getByText("Đã đặt học thử · 14/10")).toBeInTheDocument();
    expect(within(row("Trần Minh Quân")).getByText("Hoàng Minh Khôi")).toBeInTheDocument();
    expect(within(row("Trần Minh Quân")).getByText("Khối 8 · B · Offline")).toBeInTheDocument();
    expect(within(row("Đỗ Hoàng Long")).getByText("Đã nhập học · 14/10")).toBeInTheDocument();
    expect(within(row("Đỗ Hoàng Long")).getByRole("link", { name: "Hồ sơ học viên" })).toHaveAttribute("href", "/students/student-318");
    expect(within(row("Bùi Thanh Tâm")).getByText("Đã dừng · học nơi khác")).toBeInTheDocument();
    expect(within(row("Bùi Thanh Tâm")).getByText("12/10/2026")).toBeInTheDocument();
    expect(visible(screen.getAllByText("Hiển thị 4 / 4 lead"))).toHaveLength(2);

    // Only an open-ended stop reason is capped: fixed suffixes show in full.
    for (const text of ["Đang quan tâm · 14 ngày", "Đã đặt học thử · 14/10", "Đã nhập học · 14/10"]) {
      const badge = within(table).getByText(text);
      expect(badge.className).not.toMatch(/max-w-|truncate/);
      expect(badge.querySelector(".truncate")).toBeNull();
      expect(badge).not.toHaveAttribute("title");
    }
  });

  it("says when only the newest 100 leads are shown", () => {
    render(<CrmListView {...props({ directory: { items, totalCount: 180 } })} />);
    expect(screen.getAllByText("Hiển thị 4 / 180 lead · chỉ hiện 4 lead mới nhất, lọc thêm để thu hẹp")).toHaveLength(2);
  });

  it("keeps a failed load and an empty filter result inside the table frame, worded differently", () => {
    const { container, unmount } = render(<CrmListView {...props({ directory: { failed: true, items: [], totalCount: 0 }, statusCounts: null })} />);
    const table = screen.getByRole("table", { name: "Danh sách hồ sơ CRM và tuyển sinh" });
    expect(liveRegion(container)).toHaveTextContent("Không tải được danh sách lead");
    expect(within(table.parentElement!).getByText("Tải lại trang hoặc xóa bộ lọc để thử lại.")).toBeInTheDocument();
    // One announcer for the error: the live region, not also an alert on each visible copy.
    const announcers = Array.from(container.querySelectorAll("[aria-live],[role=alert]"))
      .filter((element) => element.textContent?.includes("Không tải được danh sách lead"));
    expect(announcers).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Không có lead phù hợp")).not.toBeInTheDocument();
    unmount();

    render(<CrmListView {...props({ directory: { items: [], totalCount: 0 }, directoryQuery: "status=converted" })} />);
    expect(visible(screen.getAllByText("Không có lead phù hợp"))).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // Value (extension, coverage pass 2): protects=every link from a list row to the lead page (name, "Mở", mobile record) carries the safe directory filter query so "Lead tuyển sinh" returns to the same filtered list, and a truncated stop reason keeps its full text as the badge title;
  // fails_when=crmCaseHref drops directoryQuery or always appends "?" (pre-redesign table kept the filters), or the row stops passing dropReason as the badge title;
  // why_new=no test asserts a detail href (crm-directory-presentation only counts links) or the badge title; seam=next/navigation mocked as in this file; no_claim=does not prove the detail page reads the query back (crm-detail-action-gate covers the return link)
  it("keeps the directory filters on every detail link and titles a truncated stop reason with its full text", () => {
    const reason = "Phụ huynh chọn học nơi khác gần nhà hơn";
    const query = "status=dropped&source=mma_fanpage";
    navigation.query = query;
    const { unmount } = render(<CrmListView {...props({ directory: { items: [lead({ dropReason: reason, fullName: "Bùi Thanh Tâm", id: "case-4", status: "dropped" })], totalCount: 1 }, directoryQuery: query })} />);

    const table = screen.getByRole("table", { name: "Danh sách hồ sơ CRM và tuyển sinh" });
    expect(within(table).getByRole("link", { name: "Bùi Thanh Tâm" })).toHaveAttribute("href", `/crm/case-4?${query}`);
    const openLinks = screen.getAllByRole("link", { name: "Mở hồ sơ CRM Bùi Thanh Tâm" });
    expect(openLinks).toHaveLength(2);
    for (const link of openLinks) expect(link).toHaveAttribute("href", `/crm/case-4?${query}`);
    const tableText = within(table).getByText("Đã dừng · Phụ huynh chọn học nơi…");
    expect(tableText).toHaveClass("truncate");
    expect(tableText.parentElement).toHaveAttribute("title", `Đã dừng · ${reason}`);
    expect(tableText.parentElement).toHaveClass("max-w-[152px]");
    const record = screen.getByRole("list", { name: "Danh sách hồ sơ CRM và tuyển sinh" });
    const recordText = within(record).getByText("Đã dừng · Phụ huynh chọn học nơi…");
    expect(recordText).toHaveClass("truncate");
    expect(recordText.parentElement).toHaveAttribute("title", `Đã dừng · ${reason}`);
    expect(recordText.parentElement).toHaveClass("max-w-[160px]");
    unmount();

    navigation.query = "";
    render(<CrmListView {...props()} />);
    for (const link of screen.getAllByRole("link", { name: "Mở hồ sơ CRM Nguyễn Gia Hân" })) expect(link).toHaveAttribute("href", "/crm/case-1");
  });

  // Value (extension, coverage pass 2): protects=an unfiltered empty list says "Chưa có lead nào" (with the Thêm lead hint only for crm.update), not the filtered "Không có lead phù hợp" that tells the user to remove filters they never set;
  // fails_when=isFiltered is inverted or always true, or the creator hint shows to a user without crm.update;
  // why_new=the empty-state test above only renders a filtered empty result; seam=none; no_claim=none beyond protects (directory loader mocked by fixture props)
  it("says no lead exists yet when nothing is filtered, pointing only a creator at Thêm lead", () => {
    const { container, unmount } = render(<CrmListView {...props({ directory: { items: [], totalCount: 0 } })} />);
    expect(visible(screen.getAllByText("Chưa có lead nào"))).toHaveLength(2);
    expect(liveRegion(container)).toHaveTextContent("Chưa có lead nào");
    expect(screen.getAllByText("Lead mới từ nút “Thêm lead” sẽ hiện ở đây.")).toHaveLength(2);
    expect(screen.queryByText("Không có lead phù hợp")).not.toBeInTheDocument();
    expect(screen.queryByText(/Bỏ bớt bộ lọc/)).not.toBeInTheDocument();
    unmount();

    render(<CrmListView {...props({ canCreateLead: false, directory: { items: [], totalCount: 0 } })} />);
    expect(visible(screen.getAllByText("Chưa có lead nào"))).toHaveLength(2);
    expect(screen.getAllByText("Lead mới sẽ hiện ở đây khi được tạo.")).toHaveLength(2);
    expect(screen.queryByText(/Thêm lead/)).not.toBeInTheDocument();
  });

  // Value (extension, coverage pass 1): protects=the mobile filter sheet's confirm button names the matching lead count, and says "Xem kết quả" (no number) when the directory failed to load;
  // fails_when=resultCount stops being passed, uses the shown rows instead of totalCount, or a failed load reads "Xem 0 lead";
  // why_new=no test opens the sheet; the failed-load test only checks the table frame; seam=next/navigation mocked as in this file; no_claim=does not prove the sheet only shows below 1042px (jsdom has no container queries)
  it("labels the filter sheet's confirm button with the total, or neutrally when the load failed", () => {
    const { unmount } = render(<CrmListView {...props({ directory: { items, totalCount: 180 } })} />);
    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    expect(within(screen.getByRole("dialog", { name: "Bộ lọc" })).getByRole("button", { name: "Xem 180 lead" })).toBeInTheDocument();
    unmount();

    render(<CrmListView {...props({ directory: { failed: true, items: [], totalCount: 0 }, statusCounts: null })} />);
    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    const sheet = screen.getByRole("dialog", { name: "Bộ lọc" });
    expect(within(sheet).getByRole("button", { name: "Xem kết quả" })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /Xem 0 lead/ })).not.toBeInTheDocument();
  });

  it("switches table and record list on a 1042px work area, below a 1440 desktop's ≈1152px", () => {
    const { container } = render(<CrmListView {...props()} />);
    expect(container.querySelector(".crm-directory .crm-directory-table")).not.toBeNull();
    expect(container.querySelector(".crm-directory .crm-directory-record-list")).not.toBeNull();
    expect(screen.getByRole("table")).toHaveClass("min-w-[1030px]");

    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const block = css.slice(css.indexOf(".crm-directory {"), css.indexOf("/* Wave 6A"));
    expect(block).toMatch(/@container \(min-width: 1042px\)/);
    expect(block).not.toMatch(/@container \(min-width: 1200px\)/);
  });
});
