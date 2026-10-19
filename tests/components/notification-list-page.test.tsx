// Value: protects=the /notifications list (design 16a "Thông báo"): the header names the exact unread total and the page, the page's only primary marks every unread notification (disabled with a reason at 0), chips count the loaded page and say so, one framed strip list renders each row once with its event label (session/CRM/ops codes now labelled, unknown codes keep the pinned fallback), opening an unread row opens its link at once and marks it read in the background (nothing navigates after the action settles, failed or not), modified/middle clicks never block the browser (nor any click that follows them), rows without a link get their own button whose result stays on the row (alert in the row, focus on the row), mark-all reports under the header, the page never holds two alerts, empty and past-the-end pages stay in the frame, and the pager keeps the caller's params;
// fails_when=an action runs during render, a plain click on an unread row is held until its mark-read settles or anything pushes after an await (a slow action pulling the user back), a failure shows an alert instead of only leaving the row unread, a second click starts a second action, a read row calls an action, a chip count stops matching the loaded rows, the empty text renders twice or outside the frame, the pager drops basePath/preservedParams, a second primary appears, the time column loses its grid/dot slot, or a legacy token / outline-none returns to the feature folder;
// why_new=step 14d rewrites the list (the only existing pin is the constructor fallback in prototype-safe-metadata-presentation.test.tsx);
// seam=next/navigation offers useRouter with push and refresh only (like production code may rely on; no useSearchParams/usePathname); the real actions module is mocked so a default call is observable; no_claim=the server actions, the RPCs, revalidatePath or the topbar badge refresh
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as realActions from "@/features/notifications/actions/notification-actions";
import { NotificationListPage, type NotificationListPageProps } from "@/features/notifications/notification-list-page";
import type { NotificationActionResult, NotificationEntry } from "@/features/notifications/read-models";
import { formatDateTime } from "@/lib/datetime";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/notifications/actions/notification-actions", () => ({
  markAllNotificationsReadAction: vi.fn(),
  markNotificationReadAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TODAY = "2026-10-16";

function entry(overrides: Partial<NotificationEntry> & Pick<NotificationEntry, "id">): NotificationEntry {
  return {
    createdAt: "2026-10-16T02:40:00.000Z",
    entityId: null,
    entityType: null,
    eventCode: "salary_advance.review",
    href: "/advances",
    message: "Một yêu cầu tạm ứng đã được đối soát và đang chờ duyệt.",
    readAt: null,
    title: "Yêu cầu tạm ứng chờ duyệt",
    ...overrides,
  };
}

const unreadLinked = entry({ id: "n-1" });
const unreadDigest = entry({
  createdAt: "2026-10-16T01:00:30.000Z",
  eventCode: "session.lock_queue_digest",
  href: "/sessions?status=completed&lock=unlocked",
  id: "n-2",
  message: "Có 3 buổi học hoàn thành hơn 1 ngày nhưng chưa khóa.",
  title: "3 buổi học đã hoàn thành chưa khóa",
});
const unreadWithoutLink = entry({
  eventCode: "payroll.period_locked",
  href: null,
  id: "n-3",
  message: "Bảng lương tháng 9/2026 đã chốt.",
  title: "Bảng lương tháng 9/2026 đã chốt",
});
const readLinked = entry({
  createdAt: "2025-12-30T03:00:00.000Z",
  eventCode: "crm.lead_assigned",
  href: "/crm/case-1",
  id: "n-4",
  message: "Lead CRM-2512-001 vừa được giao cho bạn.",
  readAt: "2025-12-30T04:00:00.000Z",
  title: "Bạn được giao lead mới",
});
const readOps = entry({
  eventCode: "ops.cron_job_failed",
  href: "/settings",
  id: "n-5",
  message: "Lần chạy 1 lúc 06:30 16/10: lỗi",
  readAt: "2026-10-16T03:00:00.000Z",
  title: "Tác vụ nền thất bại: student-care-worker",
});

const allEntries = [unreadLinked, unreadDigest, unreadWithoutLink, readLinked, readOps];

function actionsReturning(result: NotificationActionResult = { message: "Đã đánh dấu thông báo là đã đọc.", status: "success" }) {
  return {
    markAllNotificationsRead: vi.fn(async (): Promise<NotificationActionResult> => ({ message: "Đã đánh dấu 3 thông báo là đã đọc.", status: "success" })),
    markNotificationRead: vi.fn(async (): Promise<NotificationActionResult> => result),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

function renderList(props: Partial<NotificationListPageProps> = {}) {
  return render(<NotificationListPage entries={allEntries} today={TODAY} unreadCount={7} {...props} />);
}

const list = () => screen.getByRole("list", { name: "Danh sách thông báo" });
const rows = () => within(list()).getAllByRole("listitem");
const chips = () => screen.getByRole("group", { name: "Lọc nhanh thông báo" });
const rowOf = (title: string) => {
  const row = rows().find((item) => within(item).queryByText(title));
  if (!row) throw new Error(`no row ${title}`);
  return row;
};

/**
 * The browser's focus fixup when the focused control turns disabled (loading): focus falls to <body>.
 * jsdom cannot blur a disabled element, so tests drop focus right before the click.
 */
function dropFocus() {
  (document.activeElement as HTMLElement | null)?.blur();
  expect(document.activeElement).toBe(document.body);
}

const pagerNav = () => screen.getByRole("navigation", { name: "Phân trang thông báo" });

/** A click on the element, returning whether a handler prevented its default. */
function click(element: Element, init: MouseEventInit = {}): boolean {
  const event = createEvent.click(element, { button: 0, ...init });
  fireEvent(element, event);
  return event.defaultPrevented;
}

describe("NotificationListPage (step 14d)", () => {
  it("header: exact unread total and page, one primary that marks everything, disabled with a reason at 0", () => {
    const { container, rerender } = renderList({ page: 2, unreadCount: 1234 });

    expect(screen.getByRole("heading", { level: 1, name: "Thông báo" })).toBeInTheDocument();
    expect(screen.getByText("1.234 chưa đọc · trang 2")).toBeInTheDocument();
    const markAll = screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" });
    expect(markAll).toBeEnabled();
    // The page's only primary: no other button or link wears the primary fill.
    const primaries = [...container.querySelectorAll("button, a")].filter((element) => /(^|\s)bg-action-primary(\s|$)/.test(element.className));
    expect(primaries).toEqual([markAll]);
    expect(screen.queryByText(/trên trang này/, { selector: "button" })).not.toBeInTheDocument();

    rerender(<NotificationListPage entries={[readLinked]} today={TODAY} unreadCount={0} />);
    const disabled = screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAccessibleDescription("Không còn thông báo chưa đọc.");
    expect(screen.getByText("0 chưa đọc · trang 1")).toBeInTheDocument();
  });

  it("chips count the loaded page, default to Tất cả, say their scope and filter locally", () => {
    renderList();

    const all = within(chips()).getByRole("button", { name: "Tất cả5" });
    const unread = within(chips()).getByRole("button", { name: "Chưa đọc3" });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(unread).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Số trên chip tính trong 5 thông báo của trang này.")).toBeInTheDocument();
    expect(rows()).toHaveLength(5);

    fireEvent.click(unread);
    expect(rows()).toHaveLength(3);
    expect(within(list()).queryByText("Bạn được giao lead mới")).not.toBeInTheDocument();
    fireEvent.click(all);
    expect(rows()).toHaveLength(5);
  });

  it("keeps a read row visible by default when nothing is unread (Chưa đọc 0 is disabled, Tất cả stays usable)", () => {
    renderList({ entries: [readLinked, readOps], unreadCount: 0 });

    expect(rows()).toHaveLength(2);
    expect(within(chips()).getByRole("button", { name: "Chưa đọc0" })).toBeDisabled();
    expect(within(chips()).getByRole("button", { name: "Tất cả2" })).toBeEnabled();
  });

  it("rows: one rendering each, event label as one caption, new codes labelled, unknown codes on the pinned fallback, Vietnam time with the full stamp in title", () => {
    renderList({ entries: [...allEntries, entry({ eventCode: "payroll.constructor", href: null, id: "n-6", readAt: "2026-10-16T03:00:00.000Z", title: "Kiểm thử" })] });

    expect(rows()).toHaveLength(6);
    expect(screen.getAllByText("Yêu cầu tạm ứng chờ duyệt")).toHaveLength(1);
    for (const label of ["Chờ duyệt", "Buổi chờ khóa", "Lead mới được giao", "Cảnh báo vận hành", "Sự kiện chưa hỗ trợ: period_locked", "Sự kiện chưa hỗ trợ: constructor"]) {
      expect(screen.getAllByText(label), label).toHaveLength(1);
    }
    expect(screen.queryByText(/function constructor/)).not.toBeInTheDocument();
    // No badge repeats the label.
    expect(list().querySelector('[class*="rounded-full"][class*="px-"]')).toBeNull();

    const today = within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByText("16/10 09:40");
    expect(today.tagName).toBe("TIME");
    expect(today).toHaveAttribute("title", formatDateTime(unreadLinked.createdAt));
    // Another year keeps its year.
    expect(within(rowOf("Bạn được giao lead mới")).getByText("30/12/2025 10:00")).toBeInTheDocument();
  });

  it("marks unread rows with a dot plus hidden text and a heavier title; read rows have neither", () => {
    renderList();

    expect(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByText("Chưa đọc")).toHaveClass("sr-only");
    expect(within(rowOf("Bạn được giao lead mới")).queryByText("Chưa đọc")).not.toBeInTheDocument();
    expect(screen.getAllByText("Chưa đọc", { selector: ".sr-only" })).toHaveLength(3);
    expect(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByText("Yêu cầu tạm ứng chờ duyệt").closest("p")).toHaveClass("font-semibold");
    expect(within(rowOf("Bạn được giao lead mới")).getByText("Bạn được giao lead mới").closest("p")).toHaveClass("font-medium");
  });

  it("a linked row is one link named by its title, stretched over the row", () => {
    renderList();

    const link = within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link");
    expect(link).toHaveAccessibleName("Yêu cầu tạm ứng chờ duyệt");
    expect(link).toHaveAttribute("href", "/advances");
    expect(link.className).toMatch(/after:absolute/);
    expect(within(rowOf("Bảng lương tháng 9/2026 đã chốt")).queryByRole("link")).not.toBeInTheDocument();
  });

  // Value: protects=opening a notification never waits on the server: the link opens at once (next/link handles the unprevented click) while the existing mark-read action runs behind it, once;
  // fails_when=the click is prevented and navigation waits for the action (a slow action can then pull the user back from where they went meanwhile, a hung one leaves the link dead), the code pushes after an await, or a second click starts a second action;
  // why_new=step 14d owner-approved fourth review cycle (performance P2, red team R2-5, binding B1, adversarial A1); seam=actions injected with a deferred result, router mocked; no_claim=next/link's own navigation or that Next keeps the action running across it
  it("plain click on an unread row: opens at once and marks it read in the background; never twice while pending", async () => {
    const actions = actionsReturning();
    const pending = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(pending.promise);
    renderList({ actions });

    const link = within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link");
    expect(click(link)).toBe(false);
    expect(actions.markNotificationRead).toHaveBeenCalledWith("n-1");
    expect(rowOf("Yêu cầu tạm ứng chờ duyệt")).toHaveAttribute("aria-busy", "true");
    // Optimistic: the row reads as read and the chip count follows.
    expect(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).queryByText("Chưa đọc")).not.toBeInTheDocument();
    expect(within(chips()).getByRole("button", { name: "Chưa đọc2" })).toBeInTheDocument();

    expect(click(link)).toBe(false);
    expect(actions.markNotificationRead).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ message: "ok", status: "success" }));
    expect(router.push).not.toHaveBeenCalled();
    expect(rowOf("Yêu cầu tạm ứng chờ duyệt")).not.toHaveAttribute("aria-busy");
    expect(realActions.markNotificationReadAction).not.toHaveBeenCalled();
    // Navigation is the feedback: no banner.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([
    ["an error result", () => Promise.resolve<NotificationActionResult>({ message: "Không thể cập nhật trạng thái thông báo.", status: "error" })],
    ["a rejected call", () => Promise.reject(new Error("network"))],
  ])("after %s the link has already opened: no alert, no push (the row is simply unread next time)", async (_, outcome) => {
    const actions = actionsReturning();
    actions.markNotificationRead.mockImplementationOnce(outcome);
    renderList({ actions });

    expect(click(within(rowOf("3 buổi học đã hoàn thành chưa khóa")).getByRole("link"))).toBe(false);
    await waitFor(() => expect(rowOf("3 buổi học đã hoàn thành chưa khóa")).not.toHaveAttribute("aria-busy"));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Shift", { shiftKey: true }],
  ])("%s-click lets the browser open it and marks read in the background", (_, init) => {
    const actions = actionsReturning();
    renderList({ actions });

    const link = within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link");
    expect(click(link, init)).toBe(false);
    expect(actions.markNotificationRead).toHaveBeenCalledExactlyOnceWith("n-1");
    expect(router.push).not.toHaveBeenCalled();
    expect(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).queryByText("Chưa đọc")).not.toBeInTheDocument();
  });

  it("middle click marks read without navigating; a right click does nothing", () => {
    const actions = actionsReturning();
    renderList({ actions });

    const link = within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link");
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 2, cancelable: true }));
    expect(actions.markNotificationRead).not.toHaveBeenCalled();
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 1, cancelable: true }));
    expect(actions.markNotificationRead).toHaveBeenCalledExactlyOnceWith("n-1");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("a read row is a plain link: no action, no prevented default", () => {
    const actions = actionsReturning();
    renderList({ actions });

    expect(click(within(rowOf("Bạn được giao lead mới")).getByRole("link"), { ctrlKey: true })).toBe(false);
    expect(actions.markNotificationRead).not.toHaveBeenCalled();
  });

  it("a row without a link: its own labelled button marks it read, refreshes and moves focus to the row (no page-top banner, no scroll)", async () => {
    const actions = actionsReturning();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    renderList({ actions });

    const button = screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" });
    fireEvent.click(button);
    expect(actions.markNotificationRead).toHaveBeenCalledExactlyOnceWith("n-3");
    // A second click while pending starts nothing.
    fireEvent.click(button);
    expect(actions.markNotificationRead).toHaveBeenCalledTimes(1);

    const row = rowOf("Bảng lương tháng 9/2026 đã chốt");
    await waitFor(() => expect(row).toHaveFocus());
    expect(row).toHaveAttribute("tabindex", "-1");
    expect(focus.mock.contexts.at(-1)).toBe(row);
    expect(focus.mock.calls.at(-1)).toEqual([{ preventScroll: true }]);
    focus.mockRestore();
    // The row itself is the result: read now, its button gone, nothing said at the top of the page.
    expect(within(row).queryByText("Chưa đọc")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Đánh dấu đã đọc:/ })).not.toBeInTheDocument();
  });

  it("a refused mark-read keeps the row unread and shows exactly one alert, in that row, with focus back on its button", async () => {
    const actions = actionsReturning({ message: "Mã thông báo không hợp lệ.", status: "error" });
    renderList({ actions });

    const button = screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" });
    button.focus();
    dropFocus();
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Mã thông báo không hợp lệ.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(router.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" })).toBeEnabled();
    // Next to the control, not at the top of the page.
    const row = rowOf("Bảng lương tháng 9/2026 đã chốt");
    expect(within(row).getByRole("alert")).toHaveTextContent("Mã thông báo không hợp lệ.");
    expect(within(row).getByText("Chưa đọc")).toHaveClass("sr-only");
    await waitFor(() => expect(button).toHaveFocus());
    expect(button).toHaveAccessibleDescription("Mã thông báo không hợp lệ.");

    // The next action clears it: still one alert on the page (mark-all's, under the header).
    actions.markAllNotificationsRead.mockResolvedValueOnce({ message: "Không thể kết nối tới hệ thống thông báo.", status: "error" });
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể kết nối tới hệ thống thông báo."));
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(within(row).queryByRole("alert")).toBeNull();
  });

  it("mark all: success says the action's message and refreshes; failure is one alert; never two calls at once", async () => {
    const actions = actionsReturning();
    const pending = deferred<NotificationActionResult>();
    actions.markAllNotificationsRead.mockReturnValueOnce(pending.promise);
    const { unmount } = renderList({ actions });

    const markAll = screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" });
    fireEvent.click(markAll);
    fireEvent.click(markAll);
    expect(actions.markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(markAll).toHaveAttribute("aria-busy", "true");
    await act(async () => pending.resolve({ message: "Đã đánh dấu 3 thông báo là đã đọc.", status: "success" }));
    expect(screen.getByRole("status")).toHaveTextContent("Đã đánh dấu 3 thông báo là đã đọc.");
    expect(router.refresh).toHaveBeenCalledOnce();
    // The loaded rows read as read at once.
    expect(screen.queryAllByText("Chưa đọc", { selector: ".sr-only" })).toHaveLength(0);
    unmount();

    actions.markAllNotificationsRead.mockResolvedValueOnce({ message: "Không thể kết nối tới hệ thống thông báo.", status: "error" });
    renderList({ actions });
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể kết nối tới hệ thống thông báo.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("without overrides it calls the real actions with the same arguments", async () => {
    vi.mocked(realActions.markNotificationReadAction).mockResolvedValue({ message: "ok", status: "success" });
    renderList();

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" }));
    await waitFor(() => expect(rowOf("Bảng lương tháng 9/2026 đã chốt")).toHaveFocus());
    expect(realActions.markNotificationReadAction).toHaveBeenCalledExactlyOnceWith("n-3");
  });

  it("filtered empty: Chưa đọc with nothing unread left on the page stays in the frame", async () => {
    const actions = actionsReturning();
    renderList({ actions, entries: [unreadWithoutLink, readLinked], unreadCount: 9 });

    fireEvent.click(within(chips()).getByRole("button", { name: "Chưa đọc1" }));
    fireEvent.click(screen.getByRole("button", { name: /^Đánh dấu đã đọc:/ }));
    const empty = await screen.findByText("Không có thông báo chưa đọc trên trang này.");
    expect(empty).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Danh sách thông báo" })).not.toBeInTheDocument();
    // The marked row left with the filter and no list is left: focus lands on the in-frame empty message, not on the page.
    await waitFor(() => expect(empty).toHaveFocus());
    expect(empty).toHaveAttribute("tabindex", "-1");
    // The other pages' unread rows are not counted or promised.
    expect(screen.queryByText(/ở trang khác/)).not.toBeInTheDocument();
  });

  it("empty page 1: the design's empty text once, inside the frame, no chips, no pager", () => {
    renderList({ entries: [], unreadCount: 0 });

    expect(screen.getAllByText("Không có thông báo")).toHaveLength(1);
    expect(screen.getByText("Các cập nhật cần chú ý trong quá trình vận hành sẽ xuất hiện tại đây.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Lọc nhanh thông báo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByText("Không có thông báo").closest('[class*="rounded-lg"][class*="border-border-subtle"]')).not.toBeNull();
  });

  it("a page past the end says there is nothing older and links back to the newer page", () => {
    renderList({ entries: [], page: 3, unreadCount: 2 });

    expect(screen.getByText("Không còn thông báo cũ hơn.")).toBeInTheDocument();
    expect(screen.queryByText("Không có thông báo")).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Phân trang thông báo" });
    expect(within(nav).getByRole("link", { name: "Mới hơn" })).toHaveAttribute("href", "/notifications?page=2");
    expect(within(nav).queryByRole("link", { name: "Cũ hơn" })).not.toBeInTheDocument();
  });

  it("pager in the frame footer: newer/older links keep basePath and preserved params, the page number between them", () => {
    const { rerender } = renderList({ hasNextPage: true, page: 2 });

    let nav = screen.getByRole("navigation", { name: "Phân trang thông báo" });
    expect(within(nav).getByRole("link", { name: "Mới hơn" })).toHaveAttribute("href", "/notifications?page=1");
    expect(within(nav).getByRole("link", { name: "Cũ hơn" })).toHaveAttribute("href", "/notifications?page=3");
    expect(within(nav).getByText("Trang 2")).toBeInTheDocument();

    rerender(
      <NotificationListPage
        basePath="/dev/lists"
        entries={allEntries}
        hasNextPage
        page={1}
        preservedParams={{ page: "9", role: "ta", state: "capped", view: "notifications" }}
        today={TODAY}
        unreadCount={7}
      />,
    );
    nav = screen.getByRole("navigation", { name: "Phân trang thông báo" });
    expect(within(nav).queryByRole("link", { name: "Mới hơn" })).not.toBeInTheDocument();
    // The preserved `page` keeps its slot; the pager's own value wins.
    expect(within(nav).getByRole("link", { name: "Cũ hơn" })).toHaveAttribute("href", "/dev/lists?page=2&role=ta&state=capped&view=notifications");

    rerender(<NotificationListPage entries={allEntries} today={TODAY} unreadCount={7} />);
    expect(screen.queryByRole("navigation", { name: "Phân trang thông báo" })).not.toBeInTheDocument();
  });

  it("calls no action and no router method while rendering", () => {
    const actions = actionsReturning();
    renderList({ actions, hasNextPage: true, page: 2 });

    expect(actions.markNotificationRead).not.toHaveBeenCalled();
    expect(actions.markAllNotificationsRead).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  // Value: protects=each row's icon tile wears its event's tone surface (danger ops alert, warning session digest/advance review, info CRM lead, success approved advance, neutral unknown code) and stays hidden from assistive tech;
  // fails_when=the row stops passing the event tone to the shared IconTile, the tile's tone chain mis-maps or drops a tone (e.g. danger falls through to neutral), or the tile loses aria-hidden;
  // why_new=notification-models.test.ts checks getNotificationEventTone alone; no test renders the moved IconTile or reads a tile's surface;
  // seam=none; no_claim=the token colours themselves or which lucide glyph a family uses (the brief lets the lane pick the session icon)
  it("gives each row's icon tile its event tone, decorative only", () => {
    const approved = entry({ eventCode: "salary_advance.approved", id: "n-7", readAt: "2026-10-16T03:00:00.000Z", title: "Tạm ứng đã được duyệt" });
    renderList({ entries: [...allEntries, approved] });

    for (const [title, surface, ink] of [
      ["Tác vụ nền thất bại: student-care-worker", "bg-danger-bg", "text-danger"],
      ["3 buổi học đã hoàn thành chưa khóa", "bg-warning-bg", "text-warning"],
      ["Yêu cầu tạm ứng chờ duyệt", "bg-warning-bg", "text-warning"],
      ["Bạn được giao lead mới", "bg-info-bg", "text-info"],
      ["Tạm ứng đã được duyệt", "bg-success-bg", "text-success"],
      ["Bảng lương tháng 9/2026 đã chốt", "bg-neutral-bg", "text-neutral"],
    ] as const) {
      const tile = rowOf(title).querySelector(":scope > span");
      expect(tile, title).toHaveAttribute("aria-hidden", "true");
      expect(tile, title).toHaveClass(surface, ink);
      expect(tile?.querySelector("svg"), title).not.toBeNull();
    }
  });

  // Value: protects=rows marked read in this tab hold only against the entries they were marked on: when fresh entries arrive (router.refresh after an action), the server's readAt wins, so a row whose background mark failed reads unread again and the chip counts it;
  // fails_when=the local read marks move to state that outlives the entries (e.g. a plain Set of ids), so a failed background mark keeps a row looking read after a refresh and "Chưa đọc" undercounts, or the marks reset on any re-render;
  // why_new=the existing tests cover the optimistic mark and mark-all, never a re-render with fresh entries;
  // seam=none (actions injected through the actions prop); no_claim=that router.refresh delivers new entries (Next revalidation)
  it("drops this tab's read marks when fresh entries arrive, so the server's unread state wins", async () => {
    const actions = actionsReturning({ message: "Không thể cập nhật trạng thái thông báo.", status: "error" });
    const { rerender } = renderList({ actions });

    // Ctrl-click: read locally at once, marked in the background, and that call fails.
    click(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link"), { ctrlKey: true });
    await waitFor(() => expect(rowOf("Yêu cầu tạm ứng chờ duyệt")).not.toHaveAttribute("aria-busy"));
    expect(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).queryByText("Chưa đọc")).not.toBeInTheDocument();
    expect(within(chips()).getByRole("button", { name: "Chưa đọc2" })).toBeInTheDocument();

    // A re-render with the same entries keeps the mark.
    rerender(<NotificationListPage actions={actions} entries={allEntries} today={TODAY} unreadCount={7} />);
    expect(within(chips()).getByRole("button", { name: "Chưa đọc2" })).toBeInTheDocument();

    // The refreshed read (a new array, the row still unread on the server) wins.
    rerender(<NotificationListPage actions={actions} entries={[...allEntries]} today={TODAY} unreadCount={7} />);
    expect(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByText("Chưa đọc")).toHaveClass("sr-only");
    expect(within(chips()).getByRole("button", { name: "Chưa đọc3" })).toBeInTheDocument();
  });

  // Value: protects=a row whose background mark is still running stays read when another action's refresh replaces the entries (the server has not written it yet); once that mark settled, the next fresh entries win again;
  // fails_when=fresh entries drop every local mark, so a row being opened flips back to "Chưa đọc" mid-flight, or settled marks are kept forever;
  // why_new=step 14d adversarial A9, fixed in the owner-approved fourth cycle; seam=deferred action + rerender with a new entries array; no_claim=the order Next applies refreshes in
  it("keeps a row read across a refresh while its background mark is still running", async () => {
    const actions = actionsReturning();
    const pending = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(pending.promise);
    const { rerender } = renderList({ actions });

    click(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link"));
    rerender(<NotificationListPage actions={actions} entries={[...allEntries]} today={TODAY} unreadCount={7} />);
    expect(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).queryByText("Chưa đọc")).not.toBeInTheDocument();
    expect(within(chips()).getByRole("button", { name: "Chưa đọc2" })).toBeInTheDocument();

    await act(async () => pending.resolve({ message: "ok", status: "success" }));
    rerender(<NotificationListPage actions={actions} entries={[...allEntries]} today={TODAY} unreadCount={7} />);
    expect(within(chips()).getByRole("button", { name: "Chưa đọc3" })).toBeInTheDocument();
  });

  // Value: protects=a server action that throws (network failure) ends in exactly one alert "Không thể kết nối tới hệ thống thông báo.", no refresh, the row still unread, and the control enabled again for a retry;
  // fails_when=the try/catch around markAll or markOne is removed (the rejection escapes, "Đánh dấu tất cả đã đọc" stays busy and nothing is said) or a thrown mark-read marks the row read;
  // why_new=the existing failure tests use resolved error results; only the open-row path rejects, and it shows no message by design;
  // seam=none (actions injected through the actions prop); no_claim=how Next surfaces a failed server-action fetch in production
  it.each([
    ["Đánh dấu tất cả đã đọc", "markAllNotificationsRead"],
    ["Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt", "markNotificationRead"],
  ] as const)("a thrown call from %s shows one connection alert and leaves the control usable", async (name, action) => {
    const actions = actionsReturning();
    actions[action].mockRejectedValueOnce(new Error("fetch failed"));
    renderList({ actions });

    fireEvent.click(screen.getByRole("button", { name }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể kết nối tới hệ thống thông báo.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(router.refresh).not.toHaveBeenCalled();
    expect(within(rowOf("Bảng lương tháng 9/2026 đã chốt")).getByText("Chưa đọc")).toHaveClass("sr-only");

    const control = screen.getByRole("button", { name });
    expect(control).toBeEnabled();
    expect(control).not.toHaveAttribute("aria-busy");
    fireEvent.click(control);
    await waitFor(() => expect(actions[action]).toHaveBeenCalledTimes(2));
  });

  // Value: protects=a mark-read that settles after the list is gone (the user already left) does nothing: no push, no alert;
  // fails_when=anything after the awaited action navigates or throws once the list unmounted;
  // why_new=red-team R1 (pre-landing review cycle 1), kept through the fourth cycle's open-at-once rework; seam=actions injected through the actions prop, router mocked; no_claim=what Next does with an action from an unmounted tree
  it("does not navigate when the list unmounted before the mark-read settled", async () => {
    const actions = actionsReturning();
    const pending = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(pending.promise);
    const { unmount } = renderList({ actions });

    expect(click(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link"))).toBe(false);
    expect(actions.markNotificationRead).toHaveBeenCalledExactlyOnceWith("n-1");
    unmount();
    await act(async () => pending.resolve({ message: "ok", status: "success" }));
    expect(router.push).not.toHaveBeenCalled();
  });

  // Value: protects=a row whose read mark is still running (from any open: plain, Ctrl/Cmd/Shift or middle click) opens normally on every later click: no prevented default (next/link navigates), no second action;
  // fails_when=any pending mark swallows a click (the row cannot be opened until the action returns) or lets a click start a second action;
  // why_new=red-team R2 (pre-landing review cycle 1), reworked by the fourth cycle (no plain-click hold any more); seam=actions injected through the actions prop; jsdom has no app router context so next/link leaves an unprevented click to the browser; no_claim=next/link's own navigation
  it("a click while the row's mark is running follows the link without a second action", async () => {
    const actions = actionsReturning();
    const background = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(background.promise);
    renderList({ actions });

    const link = within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link");
    expect(click(link, { ctrlKey: true })).toBe(false);
    expect(rowOf("Yêu cầu tạm ứng chờ duyệt")).toHaveAttribute("aria-busy", "true");
    expect(click(link)).toBe(false);
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 1, cancelable: true }));
    expect(actions.markNotificationRead).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => background.resolve({ message: "ok", status: "success" }));
    expect(router.push).not.toHaveBeenCalled();

    const opening = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(opening.promise);
    const digest = within(rowOf("3 buổi học đã hoàn thành chưa khóa")).getByRole("link");
    expect(click(digest)).toBe(false);
    expect(click(digest)).toBe(false);
    expect(click(digest, { ctrlKey: true })).toBe(false);
    expect(actions.markNotificationRead).toHaveBeenCalledTimes(2);
    await act(async () => opening.resolve({ message: "ok", status: "success" }));
    expect(router.push).not.toHaveBeenCalled();
  });

  // Value: protects=a pager link is a soft navigation that keeps the list mounted with a new `page`: the page's own state starts over (no previous page's alert, chip back to "Tất cả") while the activated pager link keeps keyboard focus;
  // fails_when=the list stops resetting its chip/results when `page` changes (QA ship-s14d-p2 ISSUE-002: page 2 showed page 1's alert), or the reset is done by remounting (a key) so the pager link loses focus to <body>;
  // why_new=QA ISSUE-002 / red-team R4 (cycle 1), reworked by review cycle 2 R2-1 (no key); seam=the test rerenders like a soft navigation; no_claim=Next's soft-navigation reconciliation
  it("a new page (same mounted list) has no stale alert, its chip back on Tất cả, and the pager link keeps focus", async () => {
    const actions = actionsReturning();
    actions.markAllNotificationsRead.mockResolvedValueOnce({ message: "Không thể kết nối tới hệ thống thông báo.", status: "error" });
    const { rerender } = render(<NotificationListPage actions={actions} entries={allEntries} hasNextPage page={1} today={TODAY} unreadCount={7} />);

    fireEvent.click(within(chips()).getByRole("button", { name: "Chưa đọc3" }));
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể kết nối tới hệ thống thông báo.");
    const older = within(screen.getByRole("navigation", { name: "Phân trang thông báo" })).getByRole("link", { name: "Cũ hơn" });
    older.focus();

    rerender(<NotificationListPage actions={actions} entries={[readLinked, readOps]} hasNextPage page={2} today={TODAY} unreadCount={7} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(within(chips()).getByRole("button", { name: "Tất cả2" })).toHaveAttribute("aria-pressed", "true");
    expect(rows()).toHaveLength(2);
    expect(older).toHaveFocus();
    expect(older).toHaveAttribute("href", "/notifications?page=3");
  });

  // Value: protects=a mark-read settling after the user moved to another page of the same mounted list never pulls them back (cycle 2 removed the remount that used to end it);
  // fails_when=anything navigates after the awaited mark-read, so a slow action moves the user from page 2 to page 1's notification;
  // why_new=review cycle 2 R2-1 (no key: the list survives a pager link), kept through the fourth cycle; seam=actions injected, router mocked; no_claim=Next's navigation queue
  it("does not navigate when the page changed before the mark-read settled", async () => {
    const actions = actionsReturning();
    const pending = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(pending.promise);
    const { rerender } = renderList({ actions, hasNextPage: true });

    expect(click(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link"))).toBe(false);
    rerender(<NotificationListPage actions={actions} entries={[readLinked]} page={2} today={TODAY} unreadCount={7} />);
    await act(async () => pending.resolve({ message: "ok", status: "success" }));
    expect(router.push).not.toHaveBeenCalled();
  });

  // Value: protects=a row "Đánh dấu đã đọc" and "Đánh dấu tất cả đã đọc" in flight together never show two alerts: the latest failure to settle replaces the other one, whatever order they started in; and never a row error on a row that reads as read;
  // fails_when=each failure is added next to the other (two role="alert"), an older failure replaces the newer one, or a row error renders on a row mark-all or a refresh already made read;
  // why_new=review cycle 2 C1, reworked by cycle 3 (latest failure shows instead of latest started action); seam=actions injected with deferred results; no_claim=the server's ordering of the two writes
  it.each([
    ["row then mark-all started, the row fails first", ["row", "all"], ["row", "all"], "all"],
    ["row then mark-all started, mark-all fails first", ["row", "all"], ["all", "row"], "row"],
    ["mark-all then row started, the row fails first", ["all", "row"], ["row", "all"], "all"],
  ] as const)("overlapping row mark and mark-all both failing (%s): exactly one alert, the latest failure", async (_, starts, settles, shown) => {
    const actions = actionsReturning();
    const row = deferred<NotificationActionResult>();
    const all = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(row.promise);
    actions.markAllNotificationsRead.mockReturnValueOnce(all.promise);
    renderList({ actions });

    const start = {
      all: () => fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" })),
      row: () => fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" })),
    };
    for (const which of starts) start[which]();
    const settle = { all: () => all.resolve({ message: "Không thể kết nối tới hệ thống thông báo.", status: "error" }), row: () => row.resolve({ message: "Mã thông báo không hợp lệ.", status: "error" }) };
    for (const which of settles) await act(async () => settle[which]());

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    const rowAlert = within(rowOf("Bảng lương tháng 9/2026 đã chốt")).queryByRole("alert");
    if (shown === "all") {
      expect(screen.getByRole("alert")).toHaveTextContent("Không thể kết nối tới hệ thống thông báo.");
      expect(rowAlert).toBeNull();
    } else {
      expect(rowAlert).toHaveTextContent("Mã thông báo không hợp lệ.");
    }
    expect(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" })).toBeEnabled();
  });

  // Value: protects=a row failure is never hidden by a newer success: a success clears only its own row's error, so row A's failure shows whether row B's success settles before or after it;
  // fails_when=results are kept only for the latest started action (cycle 2's gate) or a row success clears every row's error;
  // why_new=review cycle 3 (R3-3 vs C1); seam=two rows without links, deferred actions; no_claim=the server
  it.each([
    ["B succeeds, then A fails", ["b", "a"]],
    ["A fails, then B succeeds", ["a", "b"]],
  ] as const)("row A's failure stays when row B succeeds (%s)", async (_, settles) => {
    const other = entry({ eventCode: "payroll.period_locked", href: null, id: "n-8", message: "Bảng lương tháng 8/2026 đã chốt.", title: "Bảng lương tháng 8/2026 đã chốt" });
    const actions = actionsReturning();
    const a = deferred<NotificationActionResult>();
    const b = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    renderList({ actions, entries: [unreadWithoutLink, other, readLinked] });

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" }));
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 8/2026 đã chốt" }));
    const settle = { a: () => a.resolve({ message: "Mã thông báo không hợp lệ.", status: "error" }), b: () => b.resolve({ message: "ok", status: "success" }) };
    for (const which of settles) await act(async () => settle[which]());

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(within(rowOf("Bảng lương tháng 9/2026 đã chốt")).getByRole("alert")).toHaveTextContent("Mã thông báo không hợp lệ.");
    expect(within(rowOf("Bảng lương tháng 8/2026 đã chốt")).queryByText("Chưa đọc")).not.toBeInTheDocument();
  });

  // Value: protects=mark-all is account-wide (a failure settling after a page change still shows on the new page) while row results are page-scoped (a row failure from the previous page never shows, even on the same row);
  // fails_when=mark-all results are dropped on a page change, or a row result started on another page lands on the new one;
  // why_new=review cycle 3 (results scope); seam=rerender with a new page like a soft navigation; no_claim=the server
  it("a mark-all failure settling after a page change shows; a row failure from the previous page does not", async () => {
    const actions = actionsReturning();
    const all = deferred<NotificationActionResult>();
    const row = deferred<NotificationActionResult>();
    actions.markAllNotificationsRead.mockReturnValueOnce(all.promise);
    actions.markNotificationRead.mockReturnValueOnce(row.promise);
    const { rerender } = renderList({ actions, hasNextPage: true });

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" }));
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }));
    // The row shifted onto page 2 (newer notifications arrived).
    rerender(<NotificationListPage actions={actions} entries={[unreadWithoutLink, readLinked]} page={2} today={TODAY} unreadCount={7} />);
    await act(async () => row.resolve({ message: "Mã thông báo không hợp lệ.", status: "error" }));
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => all.resolve({ message: "Không thể kết nối tới hệ thống thông báo.", status: "error" }));
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Không thể kết nối tới hệ thống thông báo.");
  });

  it("a late row failure after mark-all succeeded says nothing on the now-read row; a refreshed read row drops its error", async () => {
    const actions = actionsReturning();
    const row = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(row.promise);
    const { rerender } = renderList({ actions });

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" }));
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã đánh dấu 3 thông báo là đã đọc.");
    await act(async () => row.resolve({ message: "Mã thông báo không hợp lệ.", status: "error" }));
    expect(screen.queryByRole("alert")).toBeNull();

    // A row error shown while unread disappears once fresh entries say the row is read.
    actions.markNotificationRead.mockResolvedValueOnce({ message: "Mã thông báo không hợp lệ.", status: "error" });
    rerender(<NotificationListPage actions={actions} entries={[...allEntries]} today={TODAY} unreadCount={7} />);
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" }));
    expect(await within(rowOf("Bảng lương tháng 9/2026 đã chốt")).findByRole("alert")).toBeInTheDocument();
    rerender(
      <NotificationListPage
        actions={actions}
        entries={allEntries.map((item) => (item.id === "n-3" ? { ...item, readAt: "2026-10-16T05:00:00.000Z" } : item))}
        today={TODAY}
        unreadCount={6}
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Value: protects=after "Đánh dấu tất cả đã đọc" fails, keyboard focus lands on its result (the button was disabled while loading, so the browser dropped focus), the same as after success;
  // fails_when=only the success path requests focus on the result;
  // why_new=review cycle 2 R2-3; seam=focus is moved off the loading button by hand (jsdom has no focus fixup); no_claim=screen-reader announcement timing
  it("a failed mark-all moves focus to its result", async () => {
    const actions = actionsReturning();
    actions.markAllNotificationsRead.mockResolvedValueOnce({ message: "Không thể kết nối tới hệ thống thông báo.", status: "error" });
    renderList({ actions });

    const markAll = screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" });
    markAll.focus();
    dropFocus();
    fireEvent.click(markAll);
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert.parentElement).toHaveFocus());
    expect(alert.parentElement).toHaveAttribute("tabindex", "-1");
  });

  // Value: protects=a modified activation (Ctrl/Cmd/Shift click, Ctrl+Enter) of a FOCUSED unread link under "Chưa đọc" removes the row and its link; focus lands on the labelled list instead of dropping to <body>; a modified click on a link that did not hold focus moves nothing;
  // fails_when=the background-mark branch stops requesting the fallback, the fallback targets an unnamed element, or it fires when the link never held focus;
  // why_new=review cycle 2 R2-2, cycle 3 (fallback target C3, held-focus check R3-5); seam=the link is focused by hand, then Ctrl-clicked; no_claim=the new tab
  it("Ctrl-activating a focused unread link under Chưa đọc keeps focus on the labelled list; an unfocused one moves nothing", () => {
    const actions = actionsReturning();
    renderList({ actions });

    fireEvent.click(within(chips()).getByRole("button", { name: "Chưa đọc3" }));
    const link = within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link");
    link.focus();
    expect(click(link, { ctrlKey: true })).toBe(false);
    expect(within(list()).queryByText("Yêu cầu tạm ứng chờ duyệt")).not.toBeInTheDocument();
    expect(list()).toHaveFocus();
    expect(list()).toHaveAttribute("tabindex", "-1");

    dropFocus();
    expect(click(within(rowOf("3 buổi học đã hoàn thành chưa khóa")).getByRole("link"), { ctrlKey: true })).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });

  // Value: protects=the full timestamp tooltip (the time's title) stays reachable on linked rows: only the <time> sits above the stretched link overlay (the dot and gap still open the row) and lets touch taps through; and an unread link tells keyboard/screen-reader users it is unread (description "Chưa đọc") while its name stays the title;
  // fails_when=the time loses `relative z-10` (the link's after:inset-0 overlay covers it), the whole slot is raised again (a dead zone around the dot), touch taps on the time stop opening the row, or the unread link loses aria-describedby to the hidden "Chưa đọc" (or a read link keeps one);
  // why_new=review cycle 2 C6 and C7, narrowed by cycle 3; seam=class names (jsdom has no hit testing) and the accessible description; no_claim=pixel stacking
  it("only the time sits above the stretched link (touch passes through); unread links described as Chưa đọc, read links not", () => {
    renderList();

    for (const item of rows()) {
      const time = item.querySelector("time");
      expect(time).toHaveClass("relative", "z-10", "pointer-coarse:pointer-events-none");
      expect(time?.parentElement).not.toHaveClass("z-10");
    }
    const unread = within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link");
    expect(unread).toHaveAccessibleName("Yêu cầu tạm ứng chờ duyệt");
    expect(unread).toHaveAccessibleDescription("Chưa đọc");
    const read = within(rowOf("Bạn được giao lead mới")).getByRole("link");
    expect(read).toHaveAccessibleName("Bạn được giao lead mới");
    expect(read).toHaveAccessibleDescription("");
    expect(read).not.toHaveAttribute("aria-describedby");
  });

  // Value: protects=a result moves focus only if focus was lost or is still on the control that started the action inside this page: never off a chip the user moved to, never out of an element outside the page (a topbar dialog);
  // fails_when=a result focuses its target unconditionally (pulling focus out of a dialog or off the user's control), or stops moving it when focus never left the control;
  // why_new=review cycle 3 (C3-5, R3-2); seam=an outside button stands in for the topbar dialog; jsdom keeps focus on a disabled button (the "still there" path); no_claim=real focus fixup
  it("a result never takes focus from a control the user moved to, inside the page or outside it", async () => {
    const actions = actionsReturning();
    const row = deferred<NotificationActionResult>();
    const all = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(row.promise);
    actions.markAllNotificationsRead.mockReturnValueOnce(all.promise).mockResolvedValueOnce({ message: "Không thể kết nối tới hệ thống thông báo.", status: "error" });
    render(
      <>
        <button type="button">Hộp thoại ngoài trang</button>
        <NotificationListPage actions={actions} entries={allEntries} today={TODAY} unreadCount={7} />
      </>,
    );

    const rowButton = screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" });
    rowButton.focus();
    fireEvent.click(rowButton);
    const chip = within(chips()).getByRole("button", { name: "Tất cả5" });
    chip.focus();
    await act(async () => row.resolve({ message: "Mã thông báo không hợp lệ.", status: "error" }));
    expect(within(rowOf("Bảng lương tháng 9/2026 đã chốt")).getByRole("alert")).toHaveTextContent("Mã thông báo không hợp lệ.");
    expect(chip).toHaveFocus();

    const markAll = screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" });
    markAll.focus();
    fireEvent.click(markAll);
    const outside = screen.getByRole("button", { name: "Hộp thoại ngoài trang" });
    outside.focus();
    await act(async () => all.resolve({ message: "Không thể kết nối tới hệ thống thông báo.", status: "error" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Không thể kết nối tới hệ thống thông báo.");
    expect(outside).toHaveFocus();

    // Focus still on the control that started it: the result takes it.
    markAll.focus();
    fireEvent.click(markAll);
    await waitFor(() => expect(screen.getByRole("alert").parentElement).toHaveFocus());
  });

  // Value: protects=a keyboard user paging with the pager keeps focus in the pager when the activated link does not exist on the new page (2→1 via "Mới hơn", a short last page via "Cũ hơn"); a page change that no pager click started (browser back) moves nothing;
  // fails_when=the list does not restore focus after a pager link unmounts (focus falls to <body>), or focuses the pager on any page change;
  // why_new=review cycle 3 (both reviewers, pager boundary pages); seam=rerender with a new page like a soft navigation (jsdom has no app router, so the link click only records the pager click); no_claim=Next's scroll restoration
  it("after a pager link leaves the page, focus goes to the remaining pager link", () => {
    const { rerender } = renderList({ hasNextPage: true, page: 2 });

    const newer = within(pagerNav()).getByRole("link", { name: "Mới hơn" });
    newer.focus();
    click(newer);
    rerender(<NotificationListPage entries={allEntries} hasNextPage page={1} today={TODAY} unreadCount={7} />);
    const older = within(pagerNav()).getByRole("link", { name: "Cũ hơn" });
    expect(older).toHaveFocus();

    click(older);
    rerender(<NotificationListPage entries={[readLinked]} page={2} today={TODAY} unreadCount={7} />);
    expect(within(pagerNav()).getByRole("link", { name: "Mới hơn" })).toHaveFocus();

    // No pager click (e.g. the browser's back button): nothing is focused for the user.
    dropFocus();
    rerender(<NotificationListPage entries={allEntries} hasNextPage page={1} today={TODAY} unreadCount={7} />);
    expect(document.activeElement).toBe(document.body);
  });

  // Value: protects=after 1→2→1 an old open still running never pushes, and its row (carried onto the new page) opens on a plain click without a second action;
  // fails_when=a late mark-read navigates, or a carried-over pending mark holds plain clicks or starts a second action;
  // why_new=review cycle 3 (C3-4, R3-6), reworked by the fourth cycle (opens no longer navigate after an await); seam=rerender with new pages; no_claim=Next's navigation
  it("a stale open never pushes after 1→2→1; a carried-over mark lets a plain click follow the link", async () => {
    const actions = actionsReturning();
    const pending = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(pending.promise);
    const { rerender } = renderList({ actions, hasNextPage: true });

    expect(click(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link"))).toBe(false);
    rerender(<NotificationListPage actions={actions} entries={allEntries} hasNextPage page={2} today={TODAY} unreadCount={7} />);
    expect(click(within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link"))).toBe(false);
    expect(actions.markNotificationRead).toHaveBeenCalledTimes(1);

    rerender(<NotificationListPage actions={actions} entries={allEntries} hasNextPage page={1} today={TODAY} unreadCount={7} />);
    await act(async () => pending.resolve({ message: "ok", status: "success" }));
    expect(router.push).not.toHaveBeenCalled();
  });

  // Value: protects=two opens in flight each mark their own row once and neither navigates when it settles, whatever order they settle in;
  // fails_when=a settled mark pushes (two pushes, the last one winning by accident), or a row with a running mark holds plain clicks;
  // why_new=review cycle 3 (C3-3), reworked by the fourth cycle; seam=deferred actions; no_claim=Next's navigation queue
  it("two opens in flight: one mark per row, no push when they settle", async () => {
    const actions = actionsReturning();
    const first = deferred<NotificationActionResult>();
    const second = deferred<NotificationActionResult>();
    actions.markNotificationRead.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    renderList({ actions });

    const advance = within(rowOf("Yêu cầu tạm ứng chờ duyệt")).getByRole("link");
    expect(click(advance)).toBe(false);
    expect(click(within(rowOf("3 buổi học đã hoàn thành chưa khóa")).getByRole("link"))).toBe(false);
    expect(click(advance)).toBe(false);
    expect(actions.markNotificationRead).toHaveBeenCalledTimes(2);

    await act(async () => second.resolve({ message: "ok", status: "success" }));
    await act(async () => first.resolve({ message: "ok", status: "success" }));
    expect(router.push).not.toHaveBeenCalled();
  });

  // Value: protects=times line up on every row and width: the title row is a two-column grid (title wraps in its column, time + dot slot always top-right) and read rows keep an invisible dot slot so their times end where unread rows' do;
  // fails_when=the title row goes back to flex-wrap/justify-between (time drops under long titles on phones) or the dot slot exists only on unread rows (read rows' times shift right);
  // why_new=design review D1 (pre-landing review cycle 1); seam=class names (jsdom has no layout); no_claim=pixel positions
  it("title row: a two-column grid with the time and a reserved dot slot top-right on every row", () => {
    renderList();

    for (const item of rows()) {
      const time = item.querySelector("time");
      const slot = time?.parentElement;
      const titleRow = slot?.parentElement;
      expect(titleRow).toHaveClass("grid", "grid-cols-[minmax(0,1fr)_auto]");
      expect(titleRow?.children).toHaveLength(2);
      expect(titleRow?.lastElementChild).toBe(slot);
      expect(slot?.querySelectorAll('span[aria-hidden="true"].h-2.w-2')).toHaveLength(1);
    }
    const unreadDot = rowOf("Yêu cầu tạm ứng chờ duyệt").querySelector('time + span[aria-hidden="true"]');
    expect(unreadDot).toHaveClass("bg-action-primary");
    expect(unreadDot).not.toHaveClass("invisible");
    const readDot = rowOf("Bạn được giao lead mới").querySelector('time + span[aria-hidden="true"]');
    expect(readDot).toHaveClass("invisible", "h-2", "w-2");
    expect(readDot).not.toHaveClass("bg-action-primary");
  });

  it("uses the shared focus outline and design tokens only in the notifications sources", () => {
    const roots = [
      join(process.cwd(), "src/features/notifications"),
      join(process.cwd(), "src/features/notifications/components"),
      join(process.cwd(), "src/app/(app)/notifications"),
    ];
    const legacy =
      /\b(text-ink[\w-]*|border-hairline[\w-]*|divide-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-primary-soft|bg-white)\b|\b(?:bg|text|border)-primary\/\d+|#[0-9a-fA-F]{3,8}\b/;

    for (const root of roots) {
      for (const file of readdirSync(root).filter((name) => /\.tsx?$/.test(name))) {
        const source = readFileSync(join(root, file), "utf8");
        expect(source, file).not.toMatch(/outline-none|focus-visible:ring|focus-ring/);
        expect(source, file).not.toMatch(legacy);
        expect(source, file).not.toMatch(/variant="(outline|danger)"/);
      }
    }
  });
});
