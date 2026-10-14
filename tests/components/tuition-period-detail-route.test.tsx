// Value: protects=the tuition period page (design 07b) for a draft (stepper on step 1, readiness table kept, GuardedActionPanel lock with the exact label as the page's one primary and its blocked reason linked by aria-describedby, success reloads the period with ?locked=1, errors inline, a network error refreshes) and a locked period (success banner only for ?locked=1 and the flag then dropped from the URL, step 4 not done when every request was voided, stepper on step 4 with the SePay queue link, KPI strip with "Chưa đến hạn" before the due date and the payable definition, chips in the payment badges' vocabulary with counts disabled at zero, class filter, notice links, "quá hạn" in words after the due date, print controls, the payment-request link behind its permission, one primary), and a failed period read as an error;
// fails_when=the lock button text changes, locking is allowed with unmet conditions, the action is not called with the period id, a lock success is lost, the locked flag accepts other values, survives a reload or takes other query parameters/the hash with it, a failed item read shows zeros in the stepper, a network error does not refresh, voided requests mark collection done, a reissued item's original gets its own row or link, a payable row without a readable request reads "Không phải thu" or completes the collection, an unknown row shows an amount in Đã thu/Còn lại, chips disagree with the rows or the badges, a zero chip stays clickable, the due date counts as overdue, overdue is colour only, the review link shows without sepay.view, "Yêu cầu thanh toán" shows without payments.view/manage (finance.view alone included) or hides with payments.manage, the SePay primary is lost when payments are unreadable, a failed read says "Không tìm thấy", or a page renders two primaries;
// why_new=step 7a recomposed both branches of /finance/tuition-periods/[periodId];
// seam=data loaders, permissions, today and the "use server" actions mocked at their module boundaries; no_claim=does not prove the loaders' queries (tuition-period-summary-data tests) or the RPCs' behaviour
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TuitionPeriodDetailPage from "@/app/(app)/finance/tuition-periods/[periodId]/page";
import { lockTuitionPeriodAction } from "@/features/tuition/actions";
import type { TuitionPeriodListItem, TuitionPreviewRow } from "@/features/tuition/data";
import { toCurrentTuitionItemRows, type TuitionPeriodItemQueryRow } from "@/features/tuition/period-summary";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getTuitionPeriodItemRows: vi.fn(),
  getTuitionPeriodReadiness: vi.fn(),
  loadTuitionPeriods: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/datetime")>()),
  getVietnamToday: vi.fn(() => "2026-10-14"),
}));
vi.mock("@/lib/permissions/database-permissions", () => ({ getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions }));
vi.mock("@/features/tuition/data", () => ({
  getTuitionLeadSources: vi.fn(async () => []),
  getTuitionPeriodReadiness: dependencies.getTuitionPeriodReadiness,
  loadTuitionPeriods: dependencies.loadTuitionPeriods,
  getTuitionStudentDetails: vi.fn(async () => ({ s1: { fullName: "Nguyễn An", id: "s1", publicCode: "TTV-1" } })),
  getTuitionStudentLabels: vi.fn(async () => ({ s1: "Nguyễn An (TTV-1)" })),
}));
vi.mock("@/features/tuition/period-summary-data", () => ({
  getTuitionPeriodItemRows: dependencies.getTuitionPeriodItemRows,
}));
vi.mock("@/features/tuition/actions", () => ({
  lockTuitionPeriodAction: vi.fn(),
  setTuitionPeriodRatesAction: vi.fn(),
  setTuitionPeriodSourcesAction: vi.fn(),
}));
vi.mock("@/features/tuition/tuition-template-browser", () => ({
  downloadTuitionRateExcel: vi.fn(),
  downloadTuitionSourceExcel: vi.fn(),
}));

const draft: TuitionPeriodListItem = { dueOn: "2026-11-15", endsOn: "2026-11-30", id: "nov", name: "Học phí tháng 11/2026", startsOn: "2026-11-01", status: "draft" };
const locked: TuitionPeriodListItem = { dueOn: "2026-10-15", endsOn: "2026-10-31", id: "oct", lockedAt: "2026-09-28T02:40:00Z", name: "Học phí tháng 10/2026", startsOn: "2026-10-01", status: "locked" };

const previewRow = (overrides: Partial<TuitionPreviewRow> = {}): TuitionPreviewRow => ({
  acquisitionSourceId: "source",
  blockerCode: null,
  classId: "class",
  classSessionId: "session-1",
  enrollmentId: "enrollment",
  openingBalanceSessions: 0,
  sessionDate: "2026-11-02",
  sessionKind: "regular",
  studentId: "s1",
  unitPriceVnd: 200_000,
  ...overrides,
});

const item = (id: string, name: string, className: string, request: [string, number, number] | null, from: string | null = null): TuitionPeriodItemQueryRow => ({
  id,
  payable_amount_vnd: request ? request[1] : 0,
  payable_sessions: 8,
  payment_request: request ? { expected_amount_vnd: request[1], paid_amount_vnd: request[2], status: request[0] } : null,
  period_id: "oct",
  reissued_from_item_id: from,
  student_id: name,
  student_snapshot: { class_name: className, current_grade: 9, full_name: name, public_code: `TTV-${id}` },
});

const lockedRows = toCurrentTuitionItemRows([
  item("i1", "An", "Toán 9A", ["paid", 2_000_000, 2_000_000]),
  item("i2", "Bình", "Toán 9A", ["partially_paid", 2_000_000, 500_000]),
  item("i3", "Chi", "Toán 8B", ["pending", 1_000_000, 0]),
  item("i4", "Dũng", "Toán 8B", ["cancelled", 3_000_000, 0]),
  item("i4r", "Dũng", "Toán 8B", ["pending", 1_500_000, 0], "i4"),
  item("i5", "Em", "Toán 8B", null),
]);

/** Page-level primary controls (the stepper's current-step number also uses the primary fill but is not a control). */
const primaries = (container: HTMLElement) => container.querySelectorAll('a[class~="bg-action-primary"], button[class~="bg-action-primary"]');

beforeEach(() => {
  dependencies.loadTuitionPeriods.mockResolvedValue([draft, locked]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const route = (periodId: string, search: { locked?: string } = {}) =>
  TuitionPeriodDetailPage({ params: Promise.resolve({ periodId }), searchParams: Promise.resolve(search) });

describe("tuition period page · draft", () => {
  it("keeps the readiness table, puts the stepper on step 1 and the lock as the one primary, disabled with its reason", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "tuition_periods.lock", "students.manage_tuition_rates"] });
    dependencies.getTuitionPeriodReadiness.mockResolvedValue({ rows: [previewRow({ unitPriceVnd: null })], systemBlockers: [] });

    const { container } = render(await route("nov"));

    expect(screen.getByRole("heading", { level: 1, name: "Học phí tháng 11/2026" })).toBeInTheDocument();
    expect(screen.getByText("Nháp")).toBeInTheDocument();
    expect(screen.getByText("01/11/2026 – 30/11/2026 · Hạn 15/11/2026 · 1 học sinh")).toBeInTheDocument();

    const stepper = screen.getByRole("list", { name: "Các bước của kỳ thu" });
    expect(within(stepper).getAllByRole("listitem")).toHaveLength(4);
    expect(stepper.querySelector('[aria-current="step"]')).toHaveTextContent("1. Nháp · chuẩn bị");

    const lock = screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" });
    expect(lock).toBeDisabled();
    expect(primaries(container)).toHaveLength(1);
    expect(primaries(container)[0]).toBe(lock);
    expect(lock.getAttribute("aria-describedby")).toContain(screen.getByText("Xử lý hết điều kiện chưa đạt rồi mới khóa được kỳ.").id);
    expect(screen.getByText(/1 học viên thiếu đơn giá/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Xem học viên cần bổ sung" })).not.toBeInTheDocument();
    // TuitionReadinessTable is still the page's preparation table.
    expect(screen.getByRole("heading", { name: /^Bổ sung đơn giá/ })).toBeInTheDocument();
  });

  it("locks a ready period through the existing action and reloads it with the locked flag", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "tuition_periods.lock"] });
    dependencies.getTuitionPeriodReadiness.mockResolvedValue({ rows: [previewRow()], systemBlockers: [] });
    vi.mocked(lockTuitionPeriodAction).mockResolvedValueOnce({ message: "Đã khóa kỳ thu và tạo yêu cầu tái phí hợp lệ.", status: "success" });

    render(await route("nov"));
    fireEvent.click(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/finance/tuition-periods/nov?locked=1"));
    expect(lockTuitionPeriodAction).toHaveBeenCalledWith("nov");
  });

  it("keeps a lock network error inline, refreshes, and does not navigate", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "tuition_periods.lock"] });
    dependencies.getTuitionPeriodReadiness.mockResolvedValue({ rows: [previewRow()], systemBlockers: [] });
    vi.mocked(lockTuitionPeriodAction).mockRejectedValueOnce(new Error("network"));

    render(await route("nov"));
    fireEvent.click(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không rõ kỳ thu đã được khóa chưa; tải lại trang để kiểm tra trước khi thử lại."));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows no lock button without tuition_periods.lock and says who locks", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view"] });
    dependencies.getTuitionPeriodReadiness.mockResolvedValue({ rows: [previewRow()], systemBlockers: [] });

    render(await route("nov"));

    expect(screen.queryByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" })).not.toBeInTheDocument();
    expect(screen.getByText(/không có quyền khóa kỳ thu/)).toBeInTheDocument();
  });
});

describe("tuition period page · locked", () => {
  it("shows the stepper on step 4, the KPI strip before the due date and one primary to the SePay queue", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "payments.view", "sepay.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(lockedRows);

    const { container } = render(await route("oct"));

    expect(dependencies.getTuitionPeriodItemRows).toHaveBeenCalledWith("oct", { canViewPayments: true });
    expect(screen.getByText("Đã khóa")).toBeInTheDocument();
    expect(screen.getByText(/· 5 học sinh · Khóa lúc 09:40 28\/09\/2026$/)).toBeInTheDocument();

    const stepper = screen.getByRole("list", { name: "Các bước của kỳ thu" });
    const current = stepper.querySelector('[aria-current="step"]') as HTMLElement;
    expect(current).toHaveTextContent("4. Thu & đối soát");
    expect(current).toHaveTextContent("1 đã thanh toán · 1 thanh toán một phần · 2 chờ thanh toán");
    expect(within(current).getByRole("link", { name: "Mở hàng đợi đối soát SePay" })).toHaveAttribute("href", "/finance/sepay?queue=review");

    const kpis = screen.getByLabelText("Tổng quan thu");
    expect(kpis).toHaveTextContent("Phải thu6.500.000 ₫Không tính yêu cầu đã hủy hoặc hết hạn");
    expect(kpis).toHaveTextContent("Đã thu2.500.000 ₫");
    expect(kpis).toHaveTextContent("Còn lại4.000.000 ₫");
    expect(kpis).toHaveTextContent("Quá hạn (sau 15/10/2026)Chưa đến hạn");
    expect(within(kpis).getByText("Chưa đến hạn")).toHaveClass("text-text-muted");
    expect(screen.queryByText("quá hạn")).not.toBeInTheDocument();

    expect(primaries(container)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Đối soát giao dịch SePay" })).toHaveAttribute("href", "/finance/sepay?queue=review");
    expect(screen.getByRole("link", { name: "Yêu cầu thanh toán" })).toHaveAttribute("href", "/finance/payment-requests");
    // No ?locked=1: no lock confirmation.
    expect(screen.queryByText("Đã khóa kỳ thu và tạo yêu cầu tái phí hợp lệ.")).not.toBeInTheDocument();
  });

  it("filters rows with counted chips and the class filter, and links each current notice once", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "payments.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(lockedRows);

    render(await route("oct"));

    const table = screen.getByRole("table", { name: "Phiếu học phí của Học phí tháng 10/2026" });
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(within(table).getByRole("link", { name: "Mở Phiếu học phí của Dũng" })).toHaveAttribute("href", "/finance/tuition-periods/oct/items/i4r/notice");
    expect(within(table).getByText("Thanh toán một phần")).toBeInTheDocument();
    // Chips use the badges' vocabulary.
    expect(screen.getByRole("button", { name: /^Đã thanh toán\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Thanh toán một phần\s*1$/ })).toBeInTheDocument();
    expect(within(table).getByText("Không phải thu")).toBeInTheDocument();
    expect(within(table).getByText("đã phát hành lại")).toBeInTheDocument();

    const chips = screen.getByRole("group", { name: "Lọc theo trạng thái thanh toán" });
    expect(within(chips).getByRole("button", { name: /^Tất cả\s*5$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(chips).getByRole("button", { name: /^Đã hủy\/hết hạn\s*0$/ })).toBeDisabled();

    fireEvent.click(within(chips).getByRole("button", { name: /^Chờ thanh toán\s*2$/ }));
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText(/2 trong 5 học sinh/)).toHaveTextContent("2 trong 5 học sinh · tổng còn lại 2.500.000 ₫");

    fireEvent.change(screen.getByLabelText("Lớp"), { target: { value: "Toán 9A" } });
    expect(within(chips).getByRole("button", { name: /^Tất cả\s*2$/ })).toBeEnabled();
    expect(table.parentElement).toHaveTextContent("Không có học sinh khớp bộ lọc.");
    fireEvent.click(within(table.parentElement as HTMLElement).getByRole("button", { name: "Xóa lọc" }));
    expect(within(table).getAllByRole("row")).toHaveLength(6);

    // Printing keeps the bulk controls over the current notices only.
    expect(screen.getByRole("button", { name: "In đã chọn / cả khối" })).toBeInTheDocument();
    expect(screen.getByText("In phiếu học phí").closest("details")).toHaveTextContent("Chưa chọn: in toàn bộ 5 phiếu.");
    // No SePay permission: no review link anywhere and no page primary.
    expect(screen.queryByRole("link", { name: /đối soát/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Yêu cầu thanh toán" })).toBeInTheDocument();
  });

  it("marks every step done and drops the primary once nothing is owed; hides payment columns without a payment permission", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "payments.view", "sepay.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(toCurrentTuitionItemRows([item("i1", "An", "Toán 9A", ["paid", 2_000_000, 2_000_000])]));

    const { container, unmount } = render(await route("oct"));
    expect(screen.getByRole("list", { name: "Các bước của kỳ thu" }).querySelector('[aria-current="step"]')).toBeNull();
    expect(primaries(container)).toHaveLength(0);
    unmount();

    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(lockedRows);
    render(await route("oct"));
    expect(dependencies.getTuitionPeriodItemRows).toHaveBeenLastCalledWith("oct", { canViewPayments: false });
    expect(screen.queryByRole("group", { name: "Lọc theo trạng thái thanh toán" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Đã thu" })).not.toBeInTheDocument();
    expect(screen.getByText("Cần quyền xem thanh toán để thấy số đã thu, còn lại và trạng thái từng yêu cầu.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Yêu cầu thanh toán" })).not.toBeInTheDocument();
    expect(screen.queryByText("Không tính yêu cầu đã hủy hoặc hết hạn")).not.toBeInTheDocument();
  });

  it("keeps a failed item read inside the table frame", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "payments.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(null);

    render(await route("oct"));

    expect(screen.getByRole("table", { name: "Phiếu học phí của Học phí tháng 10/2026" }).parentElement).toHaveTextContent("Chưa tải được danh sách phiếu học phí.");
  });

  it("says the stepper counts were not loaded instead of showing zeros when the item read fails", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "payments.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(null);

    render(await route("oct"));

    const items = within(screen.getByRole("list", { name: "Các bước của kỳ thu" })).getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("Chưa tải được số yêu cầu");
    expect(items[2]).toHaveTextContent("Chưa tải được số phiếu");
    expect(items[3]).toHaveTextContent("Chưa tải được số đã thu");
    expect(items[3]).not.toHaveTextContent("Cần quyền xem thanh toán");
    for (const item of items.slice(1)) expect(item).not.toHaveTextContent(/\b0 (yêu cầu|phiếu|đã thanh toán)/);
  });
  it("confirms the lock only for ?locked=1, then drops the flag from the address bar", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "payments.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(lockedRows);
    window.history.replaceState(null, "", "/finance/tuition-periods/oct?tab=x&locked=1#items");
    const replaceState = vi.spyOn(window.history, "replaceState");

    const { unmount } = render(await route("oct", { locked: "1" }));
    expect(screen.getByRole("status")).toHaveTextContent("Đã khóa kỳ thu và tạo yêu cầu tái phí hợp lệ.");
    // A reload or back navigation must not replay the confirmation.
    // Only the flag goes; other parameters and the hash stay.
    await waitFor(() => expect(window.location.search).toBe("?tab=x"));
    expect(window.location.pathname).toBe("/finance/tuition-periods/oct");
    expect(window.location.hash).toBe("#items");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/finance/tuition-periods/oct?tab=x#items");
    replaceState.mockRestore();
    unmount();

    render(await route("oct", { locked: "true" }));
    expect(screen.queryByText("Đã khóa kỳ thu và tạo yêu cầu tái phí hợp lệ.")).not.toBeInTheDocument();
  });

  it("says quá hạn in words next to each amount still owed after the due date", async () => {
    dependencies.loadTuitionPeriods.mockResolvedValue([{ ...locked, dueOn: "2026-10-01" }]);
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "payments.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(lockedRows);

    render(await route("oct"));

    const table = screen.getByRole("table", { name: "Phiếu học phí của Học phí tháng 10/2026" });
    const binh = within(table).getByText("Bình").closest("tr") as HTMLElement;
    expect(within(binh).getByText("1.500.000 ₫")).toHaveClass("text-danger");
    // Table: the list's block caption under the amount.
    expect(within(binh).getByText("quá hạn")).toHaveClass("block", "text-caption", "text-danger");
    // Owed rows only: Bình, Chi, Dũng (paid An and no-request Em have nothing overdue).
    expect(within(table).getAllByText("quá hạn")).toHaveLength(3);
    // Record list: inline after the amount.
    const mobile = screen.getByRole("list", { name: "Phiếu học phí của Học phí tháng 10/2026" });
    expect(within(mobile).getByRole("link", { name: "Mở Phiếu học phí của Bình" })).toHaveTextContent("Còn lại 1.500.000 ₫ · quá hạn");
  });

  it("keeps the SePay primary when what is owed is unknown (sepay.view without a payment permission, failed item read)", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "sepay.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(null);

    const { container } = render(await route("oct"));

    expect(dependencies.getTuitionPeriodItemRows).toHaveBeenCalledWith("oct", { canViewPayments: false });
    expect(primaries(container)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Đối soát giao dịch SePay" })).toHaveAttribute("href", "/finance/sepay?queue=review");
    expect(screen.queryByRole("link", { name: "Yêu cầu thanh toán" })).not.toBeInTheDocument();
  });
  it("shows payment columns and KPIs with finance.view, without the payment-request link (its route needs payments.view/manage)", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "finance.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(lockedRows);

    render(await route("oct"));

    expect(dependencies.getTuitionPeriodItemRows).toHaveBeenCalledWith("oct", { canViewPayments: true });
    expect(screen.getByRole("columnheader", { name: "Đã thu" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tổng quan thu")).toHaveTextContent("Đã thu2.500.000 ₫");
    expect(screen.queryByRole("link", { name: "Yêu cầu thanh toán" })).not.toBeInTheDocument();
  });

  it("shows the payment-request link with payments.manage", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "payments.manage"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(lockedRows);

    render(await route("oct"));

    expect(screen.getByRole("link", { name: "Yêu cầu thanh toán" })).toHaveAttribute("href", "/finance/payment-requests");
  });

  it("keeps exactly one SePay primary when items load but payments are unreadable (sepay.view only)", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "sepay.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(toCurrentTuitionItemRows([item("i1", "An", "Toán 9A", null)]));

    const { container } = render(await route("oct"));

    expect(dependencies.getTuitionPeriodItemRows).toHaveBeenCalledWith("oct", { canViewPayments: false });
    expect(screen.getByRole("table", { name: "Phiếu học phí của Học phí tháng 10/2026" })).toBeInTheDocument();
    const found = primaries(container);
    expect(found).toHaveLength(1);
    expect(found[0]).toHaveAttribute("href", "/finance/sepay?queue=review");
  });

  it("keeps step 4 current, without the green complete state, when every request was cancelled or expired", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "payments.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(
      toCurrentTuitionItemRows([item("i1", "An", "Toán 9A", ["cancelled", 2_000_000, 0]), item("i2", "Bình", "Toán 9A", ["expired", 1_000_000, 0])]),
    );

    render(await route("oct"));

    const current = screen.getByRole("list", { name: "Các bước của kỳ thu" }).querySelector('[aria-current="step"]') as HTMLElement;
    expect(current).toHaveTextContent("4. Thu & đối soát");
    expect(current).toHaveTextContent("Không còn yêu cầu hiệu lực");
  });
  it("does not call a payable row without a readable request 'Không phải thu', and keeps it out of Hoàn tất", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view", "payments.view"] });
    dependencies.getTuitionPeriodItemRows.mockResolvedValue(
      toCurrentTuitionItemRows([
        item("i1", "An", "Toán 9A", ["paid", 2_000_000, 2_000_000]),
        // Payable, but its request was not returned.
        { ...item("i2", "Bình", "Toán 9A", null), payable_amount_vnd: 1_500_000 },
        item("i3", "Chi", "Toán 9A", null),
        // A request with a status this screen does not know: also unknown.
        item("i4", "Dũng", "Toán 9A", ["mystery", 800_000, 300_000]),
      ]),
    );

    render(await route("oct"));

    // Đã thu and Còn lại are unknown ("—", named for screen readers), never 0 ₫, in the table and the record list.
    const unknownTable = screen.getByRole("table", { name: "Phiếu học phí của Học phí tháng 10/2026" });
    for (const name of ["Bình", "Dũng"]) {
      const row = within(unknownTable).getByText(name).closest("tr") as HTMLElement;
      const cells = within(row).getAllByRole("cell");
      expect(cells[3]).toHaveTextContent(/^—Chưa tải được$/);
      expect(cells[4]).toHaveTextContent(/^—Chưa tải được$/);
    }
    const mobile = screen.getByRole("list", { name: "Phiếu học phí của Học phí tháng 10/2026" });
    for (const name of ["Bình", "Dũng"]) {
      expect(within(mobile).getByRole("link", { name: `Mở Phiếu học phí của ${name}` })).toHaveTextContent(/Đã thu —Chưa tải được\s*Còn lại —Chưa tải được/);
    }

    const table = screen.getByRole("table", { name: "Phiếu học phí của Học phí tháng 10/2026" });
    // The status cell's badge (the amount cells also carry a screen-reader "Chưa tải được").
    expect(within((within(table).getByText("Bình").closest("tr") as HTMLElement).querySelectorAll("td")[5] as HTMLElement).getByText("Chưa tải được")).toBeInTheDocument();
    expect(within(within(table).getByText("Chi").closest("tr") as HTMLElement).getByText("Không phải thu")).toBeInTheDocument();
    expect(screen.getByText("2 học sinh có khoản phải thu nhưng chưa tải được yêu cầu thanh toán; các số trên chưa gồm các em.")).toBeInTheDocument();
    const current = screen.getByRole("list", { name: "Các bước của kỳ thu" }).querySelector('[aria-current="step"]') as HTMLElement;
    expect(current).toHaveTextContent("4. Thu & đối soát");
    expect(current).toHaveTextContent("· 2 chưa rõ");
  });
});

describe("tuition period page · failed period read", () => {
  it("shows an error, not 'not found', when the periods cannot be read", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view"] });
    dependencies.loadTuitionPeriods.mockResolvedValue(null);

    render(await route("oct"));

    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được kỳ thu");
    expect(screen.queryByText("Không tìm thấy kỳ thu học phí")).not.toBeInTheDocument();
    expect(dependencies.getTuitionPeriodItemRows).not.toHaveBeenCalled();
  });

  it("still says not found for an unknown id", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["tuition_periods.view"] });

    render(await route("missing"));

    expect(screen.getByRole("heading", { name: "Không tìm thấy kỳ thu học phí" })).toBeInTheDocument();
  });
});
