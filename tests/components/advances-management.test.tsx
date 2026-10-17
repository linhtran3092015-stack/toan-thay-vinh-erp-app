import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdvanceListPage } from "@/features/advances/advance-list-page";
import { RequestSalaryAdvanceDialog } from "@/features/advances/components/request-salary-advance-dialog";
import { SalaryAdvanceDecisionDialog } from "@/features/advances/components/salary-advance-decision-dialog";
import type { SalaryAdvanceDashboardEntry } from "@/features/advances/read-models";

const actions = vi.hoisted(() => ({
  approveSalaryAdvanceAction: vi.fn(),
  requestSalaryAdvanceAction: vi.fn(),
  reviewSalaryAdvanceAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/advances/actions/advance-actions", () => actions);

const advance = (overrides: Partial<SalaryAdvanceDashboardEntry> = {}): SalaryAdvanceDashboardEntry => ({
  amountVnd: 125_000,
  approvalNote: null,
  approvedAt: null,
  approvedByDisplayName: null,
  deductedAt: null,
  deductionPayrollPeriodId: null,
  deductionPeriodMonth: "2026-09-01",
  id: "11111111-1111-4111-8111-111111111111",
  rejectedAt: null,
  rejectedByDisplayName: null,
  rejectionReason: null,
  requestNote: "Chi phí đi lại",
  requestedAt: "2026-08-11T08:00:00.000Z",
  reviewNote: null,
  reviewedAt: null,
  reviewedByDisplayName: null,
  staffDisplayName: "Nguyễn Minh An",
  staffEmployeeCode: "NS-001",
  staffId: "22222222-2222-4222-8222-222222222222",
  status: "requested",
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Advances presentation", () => {
  it("renders supplied records in server order, all known textual statuses, and no unsupported aggregate", () => {
    const entries = [
      advance({ id: "requested", requestNote: "Yêu cầu đầu tiên", status: "requested" }),
      advance({ id: "review", requestNote: "Yêu cầu thứ hai", status: "review" }),
      advance({ id: "approved", requestNote: "Yêu cầu thứ ba", status: "approved" }),
      advance({ id: "rejected", requestNote: "Yêu cầu thứ tư", status: "rejected" }),
      advance({ id: "deducted", requestNote: "Yêu cầu thứ năm", status: "deducted" }),
    ];

    render(<AdvanceListPage canApprove canRequest canReview entries={entries} />);

    const table = screen.getByRole("table", { name: "Danh sách yêu cầu tạm ứng lương" });
    const text = table.textContent ?? "";
    expect(text.indexOf("Yêu cầu đầu tiên")).toBeLessThan(text.indexOf("Yêu cầu thứ hai"));
    expect(text.indexOf("Yêu cầu thứ hai")).toBeLessThan(text.indexOf("Yêu cầu thứ ba"));
    expect(screen.getAllByText("Chờ đối soát")).not.toHaveLength(0);
    expect(screen.getAllByText("Chờ phê duyệt")).not.toHaveLength(0);
    expect(screen.getAllByText("Đã phê duyệt")).not.toHaveLength(0);
    expect(screen.getAllByText("Đã từ chối")).not.toHaveLength(0);
    expect(screen.getAllByText("Đã khấu trừ")).not.toHaveLength(0);
    expect(screen.queryByText("Chờ khấu trừ")).not.toBeInTheDocument();
  });

  it("fails closed for ordinary and prototype-property raw statuses without lifecycle decisions", () => {
    render(<AdvanceListPage
      canApprove
      canRequest={false}
      canReview
      entries={[
        advance({ id: "ordinary-unknown", status: "archived_for_audit" }),
        advance({ id: "prototype-unknown", status: "constructor" }),
      ]}
    />);

    expect(screen.getAllByText("Trạng thái chưa hỗ trợ: archived_for_audit")).not.toHaveLength(0);
    expect(screen.getAllByText("Trạng thái chưa hỗ trợ: constructor")).not.toHaveLength(0);
    expect(screen.getAllByText("Không thể diễn giải trạng thái này.")).not.toHaveLength(0);
    expect(screen.queryByText("Chờ đối soát")).not.toBeInTheDocument();
    expect(screen.queryByText("Chờ phê duyệt")).not.toBeInTheDocument();
    expect(screen.queryByText("Đã phê duyệt")).not.toBeInTheDocument();
    expect(screen.queryByText("Đã từ chối")).not.toBeInTheDocument();
    expect(screen.queryByText("Đã khấu trừ")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phê duyệt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /từ chối/i })).not.toBeInTheDocument();
  });

  it("keeps lifecycle controls constrained to direct status and independent permissions", () => {
    const entries = [
      advance({ id: "requested", status: "requested" }),
      advance({ id: "review", status: "review" }),
      advance({ id: "approved", status: "approved" }),
      advance({ id: "rejected", status: "rejected" }),
      advance({ id: "deducted", status: "deducted" }),
    ];

    const { rerender } = render(<AdvanceListPage canApprove={false} canRequest={false} canReview entries={entries} />);
    expect(screen.getAllByRole("button", { name: "Đối soát" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Phê duyệt" })).not.toBeInTheDocument();

    rerender(<AdvanceListPage canApprove canRequest={false} canReview={false} entries={entries} />);
    expect(screen.queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Phê duyệt" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /khấu trừ/i })).not.toBeInTheDocument();
  });

  it("uses the approved 1040/1042 container contract without client financial aggregation", () => {
    render(<AdvanceListPage canApprove={false} canRequest={false} canReview={false} entries={[advance()]} />);

    expect(screen.getByRole("table", { name: "Danh sách yêu cầu tạm ứng lương" }).closest(".salary-advance-directory-work-area")).not.toBeNull();
    expect(screen.getByRole("list", { name: "Danh sách yêu cầu tạm ứng lương" })).toBeInTheDocument();
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const source = readFileSync(resolve(process.cwd(), "src/features/advances/advance-list-page.tsx"), "utf8");
    expect(globals).toMatch(/\.salary-advance-directory-work-area\s*\{\s*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 1042px\)[\s\S]*\.salary-advance-directory-table/);
    expect(source).toContain('min-w-[1040px]');
    expect(source).not.toContain(".reduce(");
    expect(source).not.toContain("approvedAmount");
    expect(source).not.toMatch(/lg:(block|hidden)/);
  });
});

// Step 14b (design 16a/16c): chips, filters, captions, row actions, pagers and in-frame empty states.
describe("Advances list redesign", () => {
  const TODAY = "2026-10-16";
  const VIEWER = "33333333-3333-4333-8333-333333333333";

  const lifecycle = () => [
    advance({ id: "r-own", requestNote: "Đơn của tôi", staffDisplayName: "Lê Thu Hằng", staffEmployeeCode: "NS-003", staffId: VIEWER }),
    advance({ id: "r-1", requestNote: "Học phí cho con", requestedAt: "2026-10-12T02:40:00.000Z" }),
    advance({ id: "v-1", requestNote: "Việc gia đình", reviewedAt: "2026-10-10T03:15:00.000Z", reviewedByDisplayName: "Lê Thu Hằng", staffDisplayName: "Đặng Phương Thảo", staffEmployeeCode: "NS-009", status: "review" }),
    advance({ approvedAt: "2026-10-03T08:00:00.000Z", approvedByDisplayName: "Nguyễn Văn Vinh", id: "a-1", requestNote: "Sửa xe", status: "approved" }),
    advance({ deductedAt: "2026-10-05T03:00:00.000Z", deductionPayrollPeriodId: "period-09", id: "d-1", requestNote: "Đặt cọc phòng", status: "deducted" }),
    advance({ id: "x-1", rejectionReason: "Thiếu chứng từ chi phí", requestNote: "Mua điện thoại", status: "rejected" }),
  ];

  const tableRows = () => within(screen.getByRole("table", { name: "Danh sách yêu cầu tạm ứng lương" })).getAllByRole("row").slice(1);

  it("shows count-only context, design captions under pinned badges and the latest event in Vietnam time", () => {
    render(<AdvanceListPage canApprove canRequest canReview entries={lifecycle()} today={TODAY} viewerId={VIEWER} />);

    expect(screen.getByRole("heading", { level: 1, name: "Tạm ứng lương" })).toBeInTheDocument();
    expect(screen.getByText("6 đơn · 2 chờ đối soát · 1 chờ phê duyệt")).toBeInTheDocument();
    // 02:40 UTC is 09:40 in Vietnam; the code segment comes first.
    expect(screen.getAllByText("NS-001 · gửi 12/10 09:40")).toHaveLength(2);
    expect(screen.getAllByText("NS-009 · đối soát 10/10 bởi Lê Thu Hằng")).toHaveLength(2);
    expect(screen.getAllByText("NS-001 · duyệt 03/10 bởi Nguyễn Văn Vinh")).toHaveLength(2);
    expect(screen.getAllByText("NS-001 · trừ kỳ 09/2026")).toHaveLength(2);
    expect(screen.getAllByText("đã gửi, chờ kế toán đối soát")).not.toHaveLength(0);
    expect(screen.getAllByText("đã đối soát, chờ chủ duyệt")).toHaveLength(2);
    expect(screen.getAllByText("chưa trừ vào lương")).toHaveLength(2);
    expect(screen.getAllByText("tính lương 05/10")).toHaveLength(2);
    expect(screen.getAllByText("Thiếu chứng từ chi phí")).toHaveLength(2);
    expect(screen.getAllByText(/^125\.000\s₫$/)).toHaveLength(12);
    expect(screen.queryByText(/tổng|VND/)).not.toBeInTheDocument();
  });

  it("keeps the viewer's own pending request out of Cần xử lý and out of the decision controls", () => {
    render(<AdvanceListPage canApprove canRequest={false} canReview entries={lifecycle()} today={TODAY} viewerId={VIEWER} />);

    const chips = screen.getByRole("group", { name: "Lọc nhanh tạm ứng" });
    expect(within(chips).getAllByRole("button").map((chip) => chip.textContent)).toEqual([
      "Tất cả6", "Cần xử lý2", "Đã duyệt, chưa trừ1", "Đã trừ1", "Từ chối1",
    ]);
    expect(within(chips).getByRole("button", { name: "Tất cả6" })).toHaveAttribute("aria-pressed", "true");
    // One requested + one reviewed row of others, each in the table and the card list.
    expect(screen.getAllByRole("button", { name: "Đối soát" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Phê duyệt" })).toHaveLength(2);
    expect(screen.getAllByText("Đơn của bạn · cần người khác xử lý")).toHaveLength(2);
    expect(within(tableRows()[0]).queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
    // The own row is still readable: caption plus the read-only "Xem", in the table and the card.
    expect(screen.getAllByRole("button", { name: "Xem chi tiết tạm ứng của Lê Thu Hằng" })).toHaveLength(2);
    fireEvent.click(within(tableRows()[0]).getByRole("button", { name: "Xem chi tiết tạm ứng của Lê Thu Hằng" }));
    const ownDetail = screen.getByRole("dialog", { name: "Chi tiết tạm ứng" });
    expect(within(ownDetail).getAllByRole("button").map((button) => button.textContent)).toEqual(["Đóng"]);
    fireEvent.click(within(ownDetail).getByRole("button", { name: "Đóng" }));

    fireEvent.click(within(chips).getByRole("button", { name: "Cần xử lý2" }));
    expect(within(chips).getByRole("button", { name: "Cần xử lý2" })).toHaveAttribute("aria-pressed", "true");
    expect(tableRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("Học phí cho con"),
      expect.stringContaining("Việc gia đình"),
    ]);
    // The status select and the chips are one state.
    expect(screen.getByLabelText("Trạng thái")).toHaveValue("actionable");
  });

  it("offers Đang chờ instead of Cần xử lý to a viewer without review or approval", () => {
    render(<AdvanceListPage canApprove={false} canRequest canReview={false} entries={lifecycle().slice(1)} today={TODAY} viewerId={VIEWER} />);

    expect(screen.getByText("5 đơn của bạn · 2 đang chờ duyệt")).toBeInTheDocument();
    const chips = screen.getByRole("group", { name: "Lọc nhanh tạm ứng" });
    expect(within(chips).queryByRole("button", { name: /Cần xử lý/ })).not.toBeInTheDocument();
    fireEvent.click(within(chips).getByRole("button", { name: "Đang chờ2" }));
    expect(tableRows()).toHaveLength(2);
    // Own scope only: no staff search, and every row offers "Xem" (no decision).
    expect(screen.queryByLabelText("Tìm nhân sự")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Xem chi tiết tạm ứng của / })).toHaveLength(4);
    // "Xóa lọc" is 44px on phones like every other control of the bar.
    expect(screen.getByRole("region", { name: "Bộ lọc tạm ứng" })).toHaveClass("max-md:[&_button]:h-11");
  });

  it("links a deducted row to its payroll period only with payroll.view", () => {
    const { rerender } = render(<AdvanceListPage canApprove={false} canRequest={false} canReview={false} canViewPayroll entries={lifecycle()} today={TODAY} />);

    const links = screen.getAllByRole("link", { name: "Mở kỳ lương 09/2026" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/payroll#payroll-period-period-09");
    expect(links[0]).toHaveTextContent("Kỳ lương");

    rerender(<AdvanceListPage canApprove={false} canRequest={false} canReview={false} entries={lifecycle()} today={TODAY} />);
    expect(screen.queryByRole("link", { name: /kỳ lương/i })).not.toBeInTheDocument();
  });

  it("filters by status, deduction month and accent-insensitive staff search, then resets in place", () => {
    render(<AdvanceListPage canApprove canRequest={false} canReview entries={[
      ...lifecycle(),
      advance({ deductionPeriodMonth: "2026-10-01", id: "oct", requestNote: "Kỳ tháng mười", staffDisplayName: "Vũ Minh Đức", staffEmployeeCode: "NS-014" }),
    ]} today={TODAY} viewerId={VIEWER} />);

    expect(screen.getByRole("region", { name: "Bộ lọc tạm ứng" })).toHaveClass("max-md:[&_button]:h-11");
    const period = screen.getByLabelText("Trừ vào kỳ");
    expect(within(period).getAllByRole("option").map((option) => option.textContent)).toEqual(["Tất cả kỳ", "10/2026", "09/2026"]);
    fireEvent.change(period, { target: { value: "2026-10" } });
    expect(tableRows()).toHaveLength(1);
    expect(screen.getByText("Kỳ trừ 10/2026 · 1 đơn · 1 chờ đối soát · 0 chờ phê duyệt")).toBeInTheDocument();

    fireEvent.change(period, { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Tìm nhân sự"), { target: { value: "dang phuong" } });
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Đặng Phương Thảo");

    fireEvent.change(screen.getByLabelText("Tìm nhân sự"), { target: { value: "khong co ai" } });
    expect(screen.getAllByText("Không có đơn khớp bộ lọc")).toHaveLength(2);
    expect(screen.queryByRole("list", { name: "Danh sách yêu cầu tạm ứng lương" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc (1)" }));
    expect(tableRows()).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /^Xóa lọc/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "rejected" } });
    expect(within(screen.getByRole("group", { name: "Lọc nhanh tạm ứng" })).getByRole("button", { name: "Từ chối1" })).toHaveAttribute("aria-pressed", "true");
    expect(tableRows()).toHaveLength(1);
  });

  it("builds status options from loaded rows only", () => {
    render(<AdvanceListPage canApprove={false} canRequest={false} canReview entries={[
      advance({ id: "r", status: "requested" }),
      advance({ id: "x", status: "rejected" }),
    ]} today={TODAY} />);

    expect(within(screen.getByLabelText("Trạng thái")).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Tất cả trạng thái", "Cần xử lý", "Chờ đối soát", "Đã từ chối",
    ]);
  });

  it("guards the unknown-status contract: only Tất cả among the chips and no lifecycle button", () => {
    render(<AdvanceListPage canApprove canRequest={false} canReview entries={[
      advance({ id: "u-1", status: "archived_for_audit" }),
      advance({ id: "u-2", status: "constructor" }),
    ]} today={TODAY} />);

    const chips = screen.getByRole("group", { name: "Lọc nhanh tạm ứng" });
    expect(within(chips).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["Tất cả2"]);
    expect(screen.queryByRole("button", { name: /từ chối|khấu trừ|^Đối soát$|^Phê duyệt$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Xem chi tiết tạm ứng của Nguyễn Minh An" })).toHaveLength(4);
  });

  it("opens a read-only detail with the recorded steps in Vietnam time", () => {
    render(<AdvanceListPage canApprove={false} canRequest={false} canReview={false} entries={[
      advance({
        approvalNote: "Đồng ý",
        approvedAt: "2026-09-07T03:00:00.000Z",
        approvedByDisplayName: "Nguyễn Văn Vinh",
        deductedAt: "2026-10-05T03:00:00.000Z",
        id: "d-1",
        reviewedAt: "2026-09-06T02:00:00.000Z",
        reviewedByDisplayName: "Lê Thu Hằng",
        status: "deducted",
      }),
    ]} today={TODAY} />);

    const trigger = screen.getAllByRole("button", { name: "Xem chi tiết tạm ứng của Nguyễn Minh An" })[0];
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Chi tiết tạm ứng" });
    expect(dialog).toHaveTextContent("Gửi yêu cầu");
    expect(dialog).toHaveTextContent("15:00 11/08/2026");
    expect(dialog).toHaveTextContent("09:00 06/09/2026 · bởi Lê Thu Hằng");
    expect(dialog).toHaveTextContent("10:00 07/09/2026 · bởi Nguyễn Văn Vinh");
    expect(dialog).toHaveTextContent("kỳ 09/2026 · tính lương lúc 10:00 05/10/2026");
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole("button").map((button) => button.textContent)).toEqual(["Đóng"]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the request facts, other requests of the same month and the real rules in the decision dialog", () => {
    render(<AdvanceListPage canApprove={false} canRequest={false} canReview entries={[
      advance({ amountVnd: 3_000_000, id: "r-1", requestNote: "Học phí cho con", requestedAt: "2026-10-12T02:40:00.000Z", deductionPeriodMonth: "2026-10-01" }),
      advance({ amountVnd: 1_000_000, deductionPeriodMonth: "2026-10-01", id: "a-1", requestedAt: "2026-10-04T01:00:00.000Z", status: "approved" }),
      advance({ deductionPeriodMonth: "2026-09-01", id: "other-month", status: "deducted" }),
    ]} today={TODAY} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Đối soát" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Đối soát yêu cầu tạm ứng" });
    expect(dialog).toHaveAccessibleDescription(/^Nguyễn Minh An · 3\.000\.000\s₫ · trừ vào kỳ 10\/2026 · gửi 12\/10 09:40$/);
    const related = within(dialog).getAllByRole("listitem");
    expect(related).toHaveLength(1);
    expect(related[0].textContent).toMatch(/^1\.000\.000\s₫ · Đã phê duyệt · gửi 04\/10$/);
    expect(dialog).toHaveTextContent("Không tự đối soát hoặc tự duyệt đơn của chính mình. Từ chối cần lý do.");
    // Approval does not touch a payroll already calculated for that month.
    expect(dialog).toHaveTextContent("Khoản đã duyệt được trừ khi tính bảng lương kỳ đã chọn; nếu bảng lương kỳ đó đã tính rồi thì phải tính lại mới trừ.");
    expect(dialog).not.toHaveTextContent(/Lương tạm tính|50%|dự kiến/);
    expect(screen.getByLabelText("Ghi chú")).toHaveAttribute("placeholder", "VD: Đủ chứng từ, chuyển chủ duyệt");
  });

  // Value (review cycle 1, T6): protects=the "Đơn khác cùng kỳ" fact says "Không có" when the staff member has no other request that month (other months and other staff do not count) and is left out entirely when the caller passes no relatedEntries; fails_when=the empty branch renders an empty list or nothing, buildRelatedAdvances groups by staff or month alone, or the standalone dialog claims "Không có" without knowing; why_new=only the one-related-row branch was tested; seam=none; no_claim=the related-row wording (tested above)
  it("says Không có when no other request shares the staff and month, and omits the fact without relatedEntries", () => {
    const { unmount } = render(<AdvanceListPage canApprove={false} canRequest={false} canReview entries={[
      advance({ id: "r-1" }),
      advance({ deductionPeriodMonth: "2026-10-01", id: "same-staff-other-month", status: "approved" }),
      advance({ id: "other-staff", staffDisplayName: "Đặng Phương Thảo", staffId: "44444444-4444-4444-8444-444444444444", status: "approved" }),
    ]} today={TODAY} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Đối soát" })[0]);
    let dialog = screen.getByRole("dialog", { name: "Đối soát yêu cầu tạm ứng" });
    expect(within(dialog).getByText("Đơn khác cùng kỳ").nextElementSibling).toHaveTextContent(/^Không có$/);
    expect(within(dialog).queryAllByRole("listitem")).toHaveLength(0);
    unmount();

    render(<SalaryAdvanceDecisionDialog advance={advance()} stage="review" />);
    fireEvent.click(screen.getByRole("button", { name: "Đối soát" }));
    dialog = screen.getByRole("dialog", { name: "Đối soát yêu cầu tạm ứng" });
    expect(within(dialog).queryByText("Đơn khác cùng kỳ")).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("Không có");
    expect(within(dialog).getByText("Quy tắc")).toBeInTheDocument();
  });

  // Value (review cycle 1, R5): protects=a way back to every row when the active chip and the search match nothing; fails_when=the chips disable zero-count chips again (disableEmpty left at its default), so "Tất cả 0" is dead and only "Xóa lọc" recovers; why_new=no test combined an active status chip with an empty search result; seam=none; no_claim=QuickFilterChips' own disabling rules
  it("keeps Tất cả clickable when the active chip and the search match nothing", () => {
    render(<AdvanceListPage canApprove canRequest={false} canReview entries={lifecycle()} today={TODAY} viewerId={VIEWER} />);

    const chips = screen.getByRole("group", { name: "Lọc nhanh tạm ứng" });
    fireEvent.click(within(chips).getByRole("button", { name: "Đã trừ1" }));
    fireEvent.change(screen.getByLabelText("Tìm nhân sự"), { target: { value: "khong co ai" } });

    // Zero-count status chips stay hidden unless active, so only "Tất cả" is newly enabled at 0.
    expect(within(chips).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["Tất cả0", "Đã trừ0"]);
    const all = within(chips).getByRole("button", { name: "Tất cả0" });
    expect(all).toBeEnabled();
    fireEvent.click(all);
    expect(within(chips).getByRole("button", { name: "Tất cả0" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Trạng thái")).toHaveValue("all");
    expect(screen.getByLabelText("Tìm nhân sự")).toHaveValue("khong co ai");
  });

  // Value (review cycle 1, R1): protects=a request sent while a chip or search hides it is not lost: the page drops its filters back to the defaults and confirms with the action's message above the chips, and the next filter change dismisses that note; fails_when=RequestSalaryAdvanceDialog stops calling onSuccess, the page keeps the old filters, or the note is an alert / sits below the chips / never goes away; why_new=the request dialog was only tested standalone; seam=the mocked requestSalaryAdvanceAction resolves success (router.refresh is the mock's spy); no_claim=the refreshed rows themselves (router.refresh is not simulated)
  it("resets the filters and confirms on the page after a request sent under an active chip", async () => {
    actions.requestSalaryAdvanceAction.mockResolvedValueOnce({ message: "Đã gửi yêu cầu tạm ứng để đối soát.", status: "success" });
    render(<AdvanceListPage canApprove canRequest canReview entries={lifecycle()} today={TODAY} viewerId={VIEWER} />);

    const chips = screen.getByRole("group", { name: "Lọc nhanh tạm ứng" });
    fireEvent.click(within(chips).getByRole("button", { name: "Đã trừ1" }));
    fireEvent.change(screen.getByLabelText("Tìm nhân sự"), { target: { value: "minh an" } });
    expect(tableRows()).toHaveLength(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "Yêu cầu tạm ứng" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Yêu cầu tạm ứng lương" });
    fireEvent.change(within(dialog).getByLabelText("Số tiền (VND)"), { target: { value: "500000" } });
    fireEvent.change(within(dialog).getByLabelText("Lý do tạm ứng"), { target: { value: "Đóng học cho con" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gửi yêu cầu" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Đã gửi yêu cầu tạm ứng để đối soát.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(notice.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(chips).getByRole("button", { name: "Tất cả6" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Trạng thái")).toHaveValue("all");
    expect(screen.getByLabelText("Tìm nhân sự")).toHaveValue("");
    expect(tableRows()).toHaveLength(6);
    expect(screen.queryByRole("button", { name: /^Xóa lọc/ })).not.toBeInTheDocument();

    // The next filter change dismisses the note.
    fireEvent.click(within(chips).getByRole("button", { name: "Từ chối1" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // Value (extension, coverage pass 1): protects=a filter change sends the list back to page 1; fails_when=updateFilters stops resetting the page, so a chip pressed on page 2 opens mid-list (21–25) instead of at the top; why_new=paging was only tested without a filter change; seam=none; no_claim=the Pagination component's own buttons
  it("pages 20 rows per page in both layouts", () => {
    const entries = Array.from({ length: 25 }, (_, index) => advance({ id: `row-${index}`, requestNote: `Đơn số ${index + 1}`, status: "approved" }));
    render(<AdvanceListPage canApprove={false} canRequest={false} canReview={false} entries={entries} today={TODAY} />);

    expect(tableRows()).toHaveLength(20);
    expect(screen.getAllByText("1–20 trong 25 đơn")).toHaveLength(2);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Phân trang tạm ứng" })).getByRole("button", { name: "Sau" }));
    expect(tableRows()).toHaveLength(5);
    expect(screen.getAllByText("21–25 trong 25 đơn")).toHaveLength(2);
    expect(screen.getByRole("navigation", { name: "Phân trang tạm ứng (danh sách gọn)" })).toBeInTheDocument();

    // Same 25 rows after the chip, but a new filter starts at the top.
    fireEvent.click(within(screen.getByRole("group", { name: "Lọc nhanh tạm ứng" })).getByRole("button", { name: "Đã duyệt, chưa trừ25" }));
    expect(tableRows()).toHaveLength(20);
    expect(screen.getAllByText("1–20 trong 25 đơn")).toHaveLength(2);
  });

  // Value: protects=after a decision refreshes the rows, a status or deduction month the new rows no longer offer falls back to "all" so the select, header, chips and rows agree instead of a blank select over an empty list; fails_when=the page filters or binds the selects with the raw requested filters instead of resolveAdvanceFilters' result; why_new=resolveAdvanceFilters is unit-tested but no test re-renders the page with refreshed entries; seam=none (rerender with new props stands in for router.refresh); no_claim=the router.refresh round trip itself
  it("falls back to all when refreshed rows no longer offer the selected status or month", () => {
    const before = [
      ...lifecycle(),
      advance({ deductionPeriodMonth: "2026-10-01", id: "oct", requestNote: "Kỳ tháng mười", staffDisplayName: "Vũ Minh Đức", staffEmployeeCode: "NS-014" }),
    ];
    const props = { canApprove: true, canRequest: false, canReview: true, today: TODAY, viewerId: VIEWER };
    const { rerender } = render(<AdvanceListPage {...props} entries={before} />);

    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "requested" } });
    fireEvent.change(screen.getByLabelText("Trừ vào kỳ"), { target: { value: "2026-10" } });
    expect(tableRows()).toHaveLength(1);
    expect(screen.getByText("Kỳ trừ 10/2026 · 1 đơn · 1 chờ đối soát · 0 chờ phê duyệt")).toBeInTheDocument();

    // Every requested row was decided and the list refreshed: no "Chờ đối soát" row and no 10/2026 row remain.
    rerender(<AdvanceListPage {...props} entries={before.filter((entry) => entry.status !== "requested")} />);

    expect(screen.getByLabelText("Trạng thái")).toHaveValue("all");
    expect(screen.getByLabelText("Trừ vào kỳ")).toHaveValue("all");
    expect(tableRows()).toHaveLength(4);
    expect(screen.getByText("4 đơn · 0 chờ đối soát · 1 chờ phê duyệt")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Lọc nhanh tạm ứng" })).getByRole("button", { name: "Tất cả4" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Không có đơn khớp bộ lọc")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Xóa lọc/ })).not.toBeInTheDocument();
  });

  it("keeps an empty list inside the frame with the request action in the header", () => {
    render(<AdvanceListPage canApprove={false} canRequest canReview={false} entries={[]} today={TODAY} />);

    expect(screen.getByRole("table", { name: "Danh sách yêu cầu tạm ứng lương" })).toBeInTheDocument();
    expect(screen.getAllByText("Chưa có yêu cầu tạm ứng")).toHaveLength(2);
    expect(screen.getByText("0 đơn của bạn · 0 đang chờ duyệt")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Lọc nhanh tạm ứng" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yêu cầu tạm ứng" })).toBeInTheDocument();
  });

  it("defaults the request month to the Vietnam month, not the browser's", () => {
    const hostTimeZone = process.env.TZ;
    // A browser west of Vietnam, whatever zone this host runs in (Node re-reads TZ for new Date math).
    process.env.TZ = "America/Los_Angeles";
    vi.useFakeTimers({ toFake: ["Date"] });
    // 00:30 on 1 Nov in Vietnam, 10:30 on 31 Oct in Los Angeles.
    vi.setSystemTime(new Date("2026-10-31T17:30:00.000Z"));
    try {
      // Precondition: the browser-local month is October, so only the Vietnam month yields "2026-11".
      expect(new Date().getMonth()).toBe(9);
      render(<RequestSalaryAdvanceDialog />);
      fireEvent.click(screen.getByRole("button", { name: "Yêu cầu tạm ứng" }));
      expect(screen.getByLabelText("Kỳ khấu trừ")).toHaveValue("2026-11");
    } finally {
      vi.useRealTimers();
      if (hostTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = hostTimeZone;
    }
  });
});

describe("Salary Advance dialogs", () => {
  it("serializes the exact request payload and protects an unresolved request before refresh", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.requestSalaryAdvanceAction.mockReturnValueOnce(pending.promise);
    render(<RequestSalaryAdvanceDialog />);

    const trigger = screen.getByRole("button", { name: "Yêu cầu tạm ứng" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Yêu cầu tạm ứng lương" });
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "125000" } });
    fireEvent.change(screen.getByLabelText("Kỳ khấu trừ"), { target: { value: "2026-09" } });
    fireEvent.change(screen.getByLabelText("Lý do tạm ứng"), { target: { value: "Chi phí đi lại" } });
    const submit = within(dialog).getByRole("button", { name: "Gửi yêu cầu" });
    fireEvent.click(submit);

    await waitFor(() => expect(actions.requestSalaryAdvanceAction).toHaveBeenCalledWith({
      amountVnd: 125000,
      deductionPeriodMonth: "2026-09-01",
      requestNote: "Chi phí đi lại",
    }));
    expect(dialog).toHaveTextContent("Đang gửi yêu cầu…");
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(submit);
    expect(actions.requestSalaryAdvanceAction).toHaveBeenCalledOnce();

    pending.resolve({ message: "Đã gửi.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("associates returned request field errors and restores dismissal after an error", async () => {
    actions.requestSalaryAdvanceAction.mockResolvedValueOnce({
      fieldErrors: {
        amountVnd: ["Số tiền không hợp lệ."],
        deductionPeriodMonth: ["Kỳ khấu trừ không hợp lệ."],
        requestNote: ["Lý do không hợp lệ."],
      },
      message: "Vui lòng kiểm tra lại yêu cầu.",
      status: "error",
    });
    render(<RequestSalaryAdvanceDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu tạm ứng" }));
    const dialog = screen.getByRole("dialog", { name: "Yêu cầu tạm ứng lương" });
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Kỳ khấu trừ"), { target: { value: "2026-09" } });
    fireEvent.change(screen.getByLabelText("Lý do tạm ứng"), { target: { value: "Lý do" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gửi yêu cầu" }));
    await screen.findByRole("alert");

    for (const [label, message] of [
      ["Số tiền (VND)", "Số tiền không hợp lệ."],
      ["Kỳ khấu trừ", "Kỳ khấu trừ không hợp lệ."],
      ["Lý do tạm ứng", "Lý do không hợp lệ."],
    ]) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute("aria-invalid", "true");
      const error = document.getElementById(field.getAttribute("aria-describedby")?.split(" ").at(-1) ?? "");
      expect(error).toHaveTextContent(message);
    }

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("preserves exact Review and Reject payloads", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.reviewSalaryAdvanceAction
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ message: "Đã từ chối.", status: "success" });
    render(<SalaryAdvanceDecisionDialog advance={advance()} stage="review" />);

    fireEvent.click(screen.getByRole("button", { name: "Đối soát" }));
    let dialog = screen.getByRole("dialog", { name: "Đối soát yêu cầu tạm ứng" });
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Đủ thông tin" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Chuyển bước phê duyệt" }));
    await waitFor(() => expect(actions.reviewSalaryAdvanceAction).toHaveBeenLastCalledWith({
      decision: "review",
      note: "Đủ thông tin",
      salaryAdvanceId: advance().id,
    }));
    expect(dialog).toHaveTextContent("Đang xử lý đối soát…");
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(actions.reviewSalaryAdvanceAction).toHaveBeenCalledOnce();
    pending.resolve({ message: "Đã đối soát.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Đối soát" }));
    dialog = screen.getByRole("dialog", { name: "Đối soát yêu cầu tạm ứng" });
    fireEvent.change(screen.getByLabelText("Quyết định"), { target: { value: "rejected" } });
    fireEvent.change(screen.getByLabelText("Lý do từ chối"), { target: { value: "Thiếu chứng từ" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await waitFor(() => expect(actions.reviewSalaryAdvanceAction).toHaveBeenLastCalledWith({
      decision: "rejected",
      note: "Thiếu chứng từ",
      salaryAdvanceId: advance().id,
    }));
  });

  it("preserves exact Approve and Reject payloads", async () => {
    actions.approveSalaryAdvanceAction
      .mockResolvedValueOnce({ message: "Đã phê duyệt.", status: "success" })
      .mockResolvedValueOnce({ message: "Đã từ chối.", status: "success" });
    render(<SalaryAdvanceDecisionDialog advance={advance({ status: "review" })} stage="approve" />);

    fireEvent.click(screen.getByRole("button", { name: "Phê duyệt" }));
    let dialog = screen.getByRole("dialog", { name: "Phê duyệt yêu cầu tạm ứng" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Phê duyệt tạm ứng" }));
    await waitFor(() => expect(actions.approveSalaryAdvanceAction).toHaveBeenLastCalledWith({
      decision: "approved",
      note: "",
      salaryAdvanceId: advance().id,
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Phê duyệt" }));
    dialog = screen.getByRole("dialog", { name: "Phê duyệt yêu cầu tạm ứng" });
    fireEvent.change(screen.getByLabelText("Quyết định"), { target: { value: "rejected" } });
    fireEvent.change(screen.getByLabelText("Lý do từ chối"), { target: { value: "Không phù hợp" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await waitFor(() => expect(actions.approveSalaryAdvanceAction).toHaveBeenLastCalledWith({
      decision: "rejected",
      note: "Không phù hợp",
      salaryAdvanceId: advance().id,
    }));
  });

  it("unlocks a returned decision error, associates its note error, and locks safely again on retry", async () => {
    const retry = deferred<{ message: string; status: "success" }>();
    actions.approveSalaryAdvanceAction
      .mockResolvedValueOnce({
        fieldErrors: { note: ["Cần nêu lý do từ chối."] },
        message: "Cần nêu lý do từ chối.",
        status: "error",
      })
      .mockReturnValueOnce(retry.promise);
    render(<SalaryAdvanceDecisionDialog advance={advance({ status: "review" })} stage="approve" />);

    const trigger = screen.getByRole("button", { name: "Phê duyệt" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Phê duyệt yêu cầu tạm ứng" });
    fireEvent.change(screen.getByLabelText("Quyết định"), { target: { value: "rejected" } });
    fireEvent.change(screen.getByLabelText("Lý do từ chối"), { target: { value: "Thiếu dữ liệu" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await screen.findByRole("alert");
    const note = screen.getByLabelText("Lý do từ chối");
    expect(note).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(note.getAttribute("aria-describedby") ?? "")).toHaveTextContent("Cần nêu lý do từ chối.");

    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await waitFor(() => expect(actions.approveSalaryAdvanceAction).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    retry.resolve({ message: "Đã phê duyệt.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });
});
