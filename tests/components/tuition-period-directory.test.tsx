// Value: protects=the tuition period list (design 07a): locked rows show money and the derived state beside the real "Đã khóa" badge, drafts show readiness instead of money (or "Chưa tải được" when the preview failed), overdue remaining is danger and says "quá hạn" in words, "Hoàn tất" only after something was collected, a period with unknown requests still counts as collecting, hidden payments show a reason, load errors and the empty list stay inside the table frame, the create flow keeps its action and validation message, a lock success survives the draft panel unmounting (first in the draft-lock section, with "Mở kỳ thu"), a lock network error refreshes, and the page has exactly one primary;
// fails_when=a draft shows "0 ₫", a failed preview reads as "no students", the derived text replaces the real status, an all-cancelled period shows the green "Hoàn tất", overdue is colour only, "Mẫu thông báo" shows without settings.receipts.manage, the create dialog does not call createTuitionPeriodAction with the form values or loses the typed values on an error, swallows its error or claims a transport failure created nothing, the lock success is lost or lands outside the draft-lock section, a lock network error does not refresh, an error renders as "no periods", or a second primary appears;
// why_new=step 7a rewrote TuitionPeriodDirectory from cards into the table/record list;
// seam=createTuitionPeriodAction / lockTuitionPeriodAction mocked at the "use server" module; no_claim=does not prove the aggregates' source (tuition-period-summary tests) or the container-query switch between table and list (CSS)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTuitionPeriodAction, lockTuitionPeriodAction } from "@/features/tuition/actions";
import type { TuitionPeriodListItem } from "@/features/tuition/data";
import { summarizeTuitionPeriodRows, toCurrentTuitionItemRows, type TuitionPeriodItemQueryRow } from "@/features/tuition/period-summary";
import { TuitionPeriodDirectory } from "@/features/tuition/tuition-period-directory";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/tuition/actions", () => ({ createTuitionPeriodAction: vi.fn(), lockTuitionPeriodAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const draft: TuitionPeriodListItem = { dueOn: "2026-11-15", endsOn: "2026-11-30", id: "nov", name: "Học phí tháng 11/2026", startsOn: "2026-11-01", status: "draft" };
const october: TuitionPeriodListItem = { dueOn: "2026-10-15", endsOn: "2026-10-31", id: "oct", name: "Học phí tháng 10/2026", startsOn: "2026-10-01", status: "locked" };
const september: TuitionPeriodListItem = { dueOn: "2026-09-15", endsOn: "2026-09-30", id: "sep", name: "Học phí tháng 09/2026", startsOn: "2026-09-01", status: "locked" };
const august: TuitionPeriodListItem = { dueOn: "2026-08-15", endsOn: "2026-08-31", id: "aug", name: "Học phí tháng 08/2026", startsOn: "2026-08-01", status: "locked" };

const item = (id: string, status: string, expected: number, paid: number): TuitionPeriodItemQueryRow => ({
  id,
  payable_amount_vnd: expected,
  payment_request: { expected_amount_vnd: expected, paid_amount_vnd: paid, status },
  period_id: "x",
  reissued_from_item_id: null,
  student_id: id,
});

function summary(periodItem: TuitionPeriodListItem, items: TuitionPeriodItemQueryRow[], paymentsVisible = true) {
  return summarizeTuitionPeriodRows(toCurrentTuitionItemRows(items), { dueOn: periodItem.dueOn, paymentsVisible, today: "2026-10-14" });
}

const draftRow = { acquisitionSourceId: "source", blockerCode: null, classId: "class", classSessionId: "s1", enrollmentId: "e", openingBalanceSessions: 0, sessionDate: "2026-11-02", sessionKind: "regular", studentId: "student", unitPriceVnd: 200_000 };

function renderList(overrides: Partial<Parameters<typeof TuitionPeriodDirectory>[0]> = {}) {
  return render(
    <TuitionPeriodDirectory
      canLock
      canManage
      canManageTemplates
      periods={[draft, october, september, august]}
      previewByPeriod={{ nov: [draftRow, { ...draftRow, classSessionId: "s2", unitPriceVnd: null }] }}
      summaries={{
        aug: summary(august, [item("a", "paid", 1_000_000, 1_000_000)]),
        oct: summary(october, [item("a", "paid", 3_000_000, 3_000_000), item("b", "pending", 1_000_000, 0)]),
        sep: summary(september, [item("a", "paid", 1_000_000, 1_000_000), item("b", "partially_paid", 1_000_000, 400_000), item("c", "pending", 1_000_000, 0)]),
      }}
      systemBlockersByPeriod={{ nov: [] }}
      {...overrides}
    />,
  );
}

function tableRow(name: string) {
  const table = screen.getByRole("table", { name: "Danh sách kỳ thu học phí" });
  return within(table).getByRole("link", { name }).closest("tr") as HTMLElement;
}

describe("TuitionPeriodDirectory", () => {
  it("shows money and derived progress beside the real status for locked periods, readiness for drafts", () => {
    renderList();

    const oct = tableRow("Học phí tháng 10/2026");
    expect(within(oct).getByText("Đã khóa")).toBeInTheDocument();
    expect(within(oct).getByText("thu 75%")).toBeInTheDocument();
    expect(within(oct).getByText("4.000.000 ₫")).toBeInTheDocument();
    expect(within(oct).getByText("1.000.000 ₫")).not.toHaveClass("text-danger");

    const sep = tableRow("Học phí tháng 09/2026");
    expect(within(sep).getByText("Quá hạn · 2 HS")).toBeInTheDocument();
    expect(within(sep).getByText("1.600.000 ₫")).toHaveClass("text-danger");
    expect(within(sep).getByText("quá hạn")).toBeInTheDocument();
    expect(within(oct).queryByText("quá hạn")).not.toBeInTheDocument();
    const mobile = screen.getByRole("list", { name: "Danh sách kỳ thu học phí" });
    expect(within(mobile).getByRole("link", { name: "Mở Học phí tháng 09/2026" })).toHaveTextContent("Còn lại 1.600.000 ₫ · quá hạn");

    expect(within(tableRow("Học phí tháng 08/2026")).getByText("Hoàn tất")).toBeInTheDocument();

    const nov = tableRow("Học phí tháng 11/2026");
    expect(within(nov).getByText("Nháp")).toBeInTheDocument();
    expect(within(nov).getByText("Còn 1 điều kiện")).toBeInTheDocument();
    expect(within(nov).queryByText(/₫/)).not.toBeInTheDocument();
    expect(within(nov).getAllByText("Chưa khóa kỳ")).toHaveLength(3);

    expect(screen.getByText("4 kỳ thu · 1 kỳ nháp · 2 kỳ đang thu")).toBeInTheDocument();
  });

  it("keeps one primary (create), the template link behind its permission and the draft lock as a secondary", () => {
    const { container, unmount } = renderList();
    expect(container.querySelectorAll('[class~="bg-action-primary"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Tạo kỳ thu" })).toHaveClass("bg-action-primary");
    expect(screen.getByRole("link", { name: "Mẫu thông báo" })).toHaveAttribute("href", "/finance/tuition-periods/templates");
    expect(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" })).toBeDisabled();
    const lock = screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" });
    const reason = screen.getByText("Xử lý hết điều kiện chưa đạt rồi mới khóa được kỳ.");
    expect(lock.getAttribute("aria-describedby")).toContain(reason.id);
    unmount();

    renderList({ canManage: false, canManageTemplates: false });
    expect(screen.queryByRole("link", { name: "Mẫu thông báo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo kỳ thu" })).not.toBeInTheDocument();
  });

  it("says why amounts are hidden without a payment permission", () => {
    renderList({ periods: [october], summaries: { oct: summary(october, [item("a", "pending", 1_000_000, 0)], false) } });

    const oct = tableRow("Học phí tháng 10/2026");
    expect(within(oct).getByText("1.000.000 ₫")).toBeInTheDocument();
    expect(within(oct).getAllByText("Cần quyền xem thanh toán")).toHaveLength(2);
    expect(screen.getByText("Cần quyền xem thanh toán để thấy số đã thu và còn lại.")).toBeInTheDocument();
  });

  it("keeps load errors and the empty list inside the table frame", () => {
    const { unmount } = renderList({ loadError: true, periods: [] });
    const table = screen.getByRole("table", { name: "Danh sách kỳ thu học phí" });
    expect(table.parentElement).toHaveTextContent("Chưa tải được danh sách kỳ thu. Tải lại trang để thử lại.");
    expect(screen.queryByText("Chưa có kỳ thu học phí.")).not.toBeInTheDocument();
    unmount();

    renderList({ periods: [] });
    expect(screen.getByRole("table", { name: "Danh sách kỳ thu học phí" }).parentElement).toHaveTextContent("Chưa có kỳ thu học phí.");
  });

  it("flags a locked period whose totals failed to load instead of showing zero", () => {
    renderList({ periods: [october], summaries: { oct: null } });
    expect(within(tableRow("Học phí tháng 10/2026")).getByText("Chưa tải được số thu")).toBeInTheDocument();
    expect(screen.getByText("Chưa tải được số đã thu của một số kỳ.")).toBeInTheDocument();
  });

  it("creates a draft period through the existing action and keeps its error in the dialog", async () => {
    vi.mocked(createTuitionPeriodAction)
      .mockResolvedValueOnce({ message: "Không thể tạo kỳ thu. Hãy kiểm tra khoảng ngày và quyền truy cập.", status: "error" })
      .mockResolvedValueOnce({ message: "Đã tạo kỳ thu nháp.", status: "success" });
    renderList();

    fireEvent.click(screen.getByRole("button", { name: "Tạo kỳ thu" }));
    const dialog = screen.getByRole("dialog", { name: "Tạo kỳ thu học phí" });
    fireEvent.change(within(dialog).getByLabelText("Tên kỳ"), { target: { value: "Học phí tháng 12/2026" } });
    fireEvent.change(within(dialog).getByLabelText("Từ ngày"), { target: { value: "2026-12-01" } });
    fireEvent.change(within(dialog).getByLabelText("Đến ngày"), { target: { value: "2026-12-31" } });
    fireEvent.submit(within(dialog).getByRole("form", { name: "Tạo kỳ thu học phí" }));

    await waitFor(() => expect(within(dialog).getByText("Không thể tạo kỳ thu. Hãy kiểm tra khoảng ngày và quyền truy cập.")).toBeInTheDocument());
    expect(createTuitionPeriodAction).toHaveBeenCalledWith({ dueOn: "", endsOn: "2026-12-31", name: "Học phí tháng 12/2026", startsOn: "2026-12-01" });
    // The server's error must not wipe what was typed (React 19 resets fields after a function `action`).
    expect(within(dialog).getByLabelText("Tên kỳ")).toHaveValue("Học phí tháng 12/2026");
    expect(within(dialog).getByLabelText("Từ ngày")).toHaveValue("2026-12-01");
    expect(within(dialog).getByLabelText("Đến ngày")).toHaveValue("2026-12-31");

    fireEvent.submit(within(dialog).getByRole("form", { name: "Tạo kỳ thu học phí" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Đã tạo kỳ thu nháp.");
  });
  it("says a failed draft preview was not loaded instead of showing no students", () => {
    renderList({ periods: [draft], systemBlockersByPeriod: { nov: [{ code: "PREVIEW_UNAVAILABLE", message: "Không tải được đầy đủ dữ liệu kỳ thu. Vui lòng tải lại trước khi khóa kỳ." }] }, previewByPeriod: { nov: [] } });

    const nov = tableRow("Học phí tháng 11/2026");
    expect(within(nov).getByText("Chưa tải được")).toBeInTheDocument();
    expect(within(nov).queryByText("Chưa có học sinh")).not.toBeInTheDocument();
    const mobile = screen.getByRole("list", { name: "Danh sách kỳ thu học phí" });
    expect(within(mobile).getByText("Chưa tải được học sinh")).toBeInTheDocument();
  });

  it("shows Hoàn tất only after a collection, and a neutral state when every request was cancelled or expired", () => {
    renderList({
      periods: [october],
      summaries: { oct: summary(october, [item("a", "cancelled", 1_000_000, 0), item("b", "expired", 1_000_000, 0)]) },
    });

    const oct = tableRow("Học phí tháng 10/2026");
    expect(within(oct).getByText("Không còn yêu cầu hiệu lực")).toBeInTheDocument();
    expect(within(oct).queryByText("Hoàn tất")).not.toBeInTheDocument();
  });

  it("keeps a lock success first in the draft-lock section after its panel is gone, and an error inline in the panel", async () => {
    vi.mocked(lockTuitionPeriodAction)
      .mockResolvedValueOnce({ message: "Không thể khóa kỳ thu. Không có dữ liệu nào được khóa một phần.", status: "error" })
      .mockResolvedValueOnce({ message: "Đã khóa kỳ thu và tạo yêu cầu tái phí hợp lệ.", status: "success" });
    const props = { previewByPeriod: { nov: [draftRow] } };
    const { rerender } = renderList(props);

    fireEvent.click(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" }));
    const panel = screen.getByRole("region", { name: "Khóa kỳ thu · Học phí tháng 11/2026" });
    await waitFor(() => expect(within(panel).getByRole("alert")).toHaveTextContent("Không thể khóa kỳ thu."));

    await waitFor(() => expect(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" }));
    await waitFor(() => expect(lockTuitionPeriodAction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(panel).queryByRole("alert")).not.toBeInTheDocument());
    expect(lockTuitionPeriodAction).toHaveBeenLastCalledWith("nov");

    // Revalidation re-renders the list with the period now locked: its draft panel unmounts.
    rerender(
      <TuitionPeriodDirectory
        canLock
        canManage
        periods={[{ ...draft, status: "locked" }]}
        previewByPeriod={{}}
        summaries={{ nov: summary(draft, [item("a", "pending", 1_000_000, 0)]) }}
        systemBlockersByPeriod={{}}
      />,
    );
    expect(screen.queryByRole("region", { name: "Khóa kỳ thu · Học phí tháng 11/2026" })).not.toBeInTheDocument();
    // No draft remains, but the section stays for the result, which comes first in it with a link to the period.
    const section = screen.getByRole("region", { name: "Khóa kỳ nháp" });
    const banner = within(section).getByRole("status");
    expect(section.firstElementChild).toBe(banner);
    expect(banner).toHaveTextContent("Đã khóa kỳ thu và tạo yêu cầu tái phí hợp lệ.");
    expect(banner).toHaveTextContent("Học phí tháng 11/2026 đã chuyển sang Đã khóa.");
    expect(within(banner).getByRole("link", { name: "Mở kỳ thu" })).toHaveAttribute("href", "/finance/tuition-periods/nov");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("does not claim a lock outcome when the request itself failed, and refreshes the list", async () => {
    vi.mocked(lockTuitionPeriodAction).mockRejectedValueOnce(new Error("network"));
    renderList({ previewByPeriod: { nov: [draftRow] } });

    fireEvent.click(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" }));

    const panel = screen.getByRole("region", { name: "Khóa kỳ thu · Học phí tháng 11/2026" });
    await waitFor(() => expect(within(panel).getByRole("alert")).toHaveTextContent("Không rõ kỳ thu đã được khóa chưa; tải lại trang để kiểm tra trước khi thử lại."));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not claim a period was not created when the request itself failed, and refreshes the list", async () => {
    vi.mocked(createTuitionPeriodAction).mockRejectedValueOnce(new Error("network"));
    renderList();

    fireEvent.click(screen.getByRole("button", { name: "Tạo kỳ thu" }));
    const dialog = screen.getByRole("dialog", { name: "Tạo kỳ thu học phí" });
    fireEvent.change(within(dialog).getByLabelText("Tên kỳ"), { target: { value: "Học phí tháng 12/2026" } });
    fireEvent.submit(within(dialog).getByRole("form", { name: "Tạo kỳ thu học phí" }));

    await waitFor(() => expect(within(dialog).getByText("Không rõ kỳ thu đã được tạo chưa; tải lại trang để kiểm tra trước khi thử lại.")).toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
  it("counts a period with unknown requests as still collecting and says so beside the percentage", () => {
    const unknownRow: TuitionPeriodItemQueryRow = { ...item("b", "pending", 1_000_000, 0), payment_request: null };
    renderList({
      periods: [october, august],
      summaries: {
        aug: summary(august, [item("a", "paid", 1_000_000, 1_000_000)]),
        // Nothing readable is owed, but one payable request could not be read.
        oct: summary(october, [item("a", "paid", 1_000_000, 1_000_000), unknownRow]),
      },
    });

    expect(screen.getByText("2 kỳ thu · 0 kỳ nháp · 1 kỳ đang thu")).toBeInTheDocument();
    const oct = tableRow("Học phí tháng 10/2026");
    expect(within(oct).getByText("Chưa rõ 1 yêu cầu")).toBeInTheDocument();
    expect(within(oct).queryByText("Hoàn tất")).not.toBeInTheDocument();
  });
});
