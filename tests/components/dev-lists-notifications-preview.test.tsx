// Value: protects=the /dev/lists notifications preview is inert and truthful per role: opening a row, "Đánh dấu đã đọc" and "Đánh dấu tất cả đã đọc" run the preview stubs and never the real actions (the preview runs on localhost where .env.local may point at production); every link and pager write stays on /dev; the owner gets the ops alerts and approval rows, the TA and the accountant neither; "capped" is a full page with an older short page and a header total larger than the page's chip; "empty" stays in the frame; the shell's bell gets the same unread total as the header;
// fails_when=the list stops accepting the injected actions, the preview stops passing previewNotificationActions/basePath/preservedParams, a new action reachable from the list ships without a stub, a fixture href leaves /dev (or reaches /dev/session, whose buttons call real actions), a non-owner sees an ops alert, or the fixture pages disagree with the unread total;
// why_new=step 14d adds a notifications view to /dev/lists whose rows write read state;
// seam=the notifications actions module is mocked so any real call is observable; next/navigation offers useRouter and a useSearchParams carrying the preview URL; the body has no AppShell (the controller wraps it); no_claim=the /dev/lists page wiring, AppShell navigation and the production 404 (dev-lists-preview.test.tsx)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getNotificationPreviewPage, getNotificationPreviewRecent } from "@/app/dev/lists/notification-fixtures";
import {
  getNotificationPreviewUnreadCount,
  NotificationsPreviewBody,
  previewNotificationActions,
} from "@/app/dev/lists/notifications-preview";
import * as notificationActions from "@/features/notifications/actions/notification-actions";
import { getNotificationEventLabel } from "@/features/notifications/notification-models";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const search = vi.hoisted(() => ({ value: "view=notifications" }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock("@/features/notifications/actions/notification-actions", () => ({
  markAllNotificationsReadAction: vi.fn(),
  markNotificationReadAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
const roles = ["owner", "ta", "accountant"] as const;
const states = ["normal", "capped", "empty"] as const;

afterEach(() => {
  cleanup();
  search.value = "view=notifications";
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const action of Object.values(notificationActions)) {
    expect(action).not.toHaveBeenCalled();
  }
  expect(router.refresh).not.toHaveBeenCalled();
}

const list = () => screen.getByRole("list", { name: "Danh sách thông báo" });
const rows = () => within(list()).getAllByRole("listitem");
const chips = () => screen.getByRole("group", { name: "Lọc nhanh thông báo" });
const pager = () => screen.getByRole("navigation", { name: "Phân trang thông báo" });

/** Every page of a role/state, as the fixture "server" serves them. */
function allPages(role: (typeof roles)[number], state: (typeof states)[number]) {
  const pages = [];
  for (let page = 1; page <= 5; page += 1) pages.push(getNotificationPreviewPage(role, state, page));
  return pages;
}

describe("/dev/lists notifications preview", () => {
  it("stubs every notifications action the list can reach", () => {
    // The list's own modules, not this file's mock keys: a new action imported there fails here until it gets a stub.
    const root = join(process.cwd(), "src/features/notifications");
    const files = [
      join(root, "notification-list-page.tsx"),
      ...readdirSync(join(root, "components"))
        .filter((name) => /\.tsx?$/.test(name))
        .map((name) => join(root, "components", name)),
    ];
    const reachable = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/features\/notifications\/actions\/notification-actions"/g)) {
        for (const name of match[1].split(",").map((part) => part.trim()).filter(Boolean)) reachable.add(name.replace(/Action$/, ""));
      }
    }
    expect([...reachable].sort()).toEqual(["markAllNotificationsRead", "markNotificationRead"]);
    expect(Object.keys(previewNotificationActions).sort()).toEqual([...reachable].sort());
  });

  it("fixtures: real codes (one unsupported), every family, one row without a link, /dev hrefs only, newest first, unique ids", () => {
    const owner = getNotificationPreviewRecent("owner");
    const families = new Set(owner.map((entry) => entry.eventCode.split(".")[0]));
    expect([...families].sort()).toEqual(["crm", "ops", "payroll", "salary_advance", "session", "student_care"]);
    const unsupported = new Set(
      roles.flatMap((role) => getNotificationPreviewRecent(role)).filter((entry) => getNotificationEventLabel(entry.eventCode).startsWith("Sự kiện chưa hỗ trợ")).map((entry) => entry.eventCode),
    );
    expect([...unsupported]).toEqual(["payroll.period_locked"]);
    expect(owner.filter((entry) => entry.href === null)).toHaveLength(1);

    for (const role of roles) {
      for (const state of states) {
        const pages = allPages(role, state);
        const entries = pages.flatMap((page) => page.entries);
        for (const entry of entries) {
          if (entry.href !== null) {
            expect(entry.href).toMatch(/^\/dev\//);
            expect(entry.href).not.toMatch(/^\/dev\/session\b/);
          }
        }
        const created = entries.map((entry) => entry.createdAt);
        expect(created).toEqual([...created].sort((a, b) => b.localeCompare(a)));
        expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
        // The header total is exactly the unread rows over every page.
        const unread = entries.filter((entry) => entry.readAt === null).length;
        for (const page of pages) expect(page.unreadCount).toBe(unread);
        expect(getNotificationPreviewUnreadCount(role, state)).toBe(unread);
      }
    }
  });

  it("owner (normal): ops alerts and approvals, 4 unread on the page and in the header, no pager", () => {
    render(<NotificationsPreviewBody role="owner" state="normal" />);

    const recent = getNotificationPreviewRecent("owner");
    expect(rows()).toHaveLength(recent.length);
    expect(getNotificationPreviewUnreadCount("owner", "normal")).toBe(4);
    expect(screen.getByText("4 chưa đọc · trang 1")).toBeInTheDocument();
    expect(within(chips()).getByRole("button", { name: "Chưa đọc4" })).toBeInTheDocument();
    expect(screen.getAllByText("Cảnh báo vận hành").length).toBeGreaterThan(0);
    expect(screen.getByText("Chờ duyệt")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Phân trang thông báo" })).not.toBeInTheDocument();
    expectNothingReal();
  });

  it.each(["ta", "accountant"] as const)("%s: no ops alert and no approval row they would not receive", (role) => {
    render(<NotificationsPreviewBody role={role} state="normal" />);

    expect(rows().length).toBeGreaterThan(0);
    expect(screen.queryByText("Cảnh báo vận hành")).not.toBeInTheDocument();
    expect(screen.queryByText("Chờ duyệt")).not.toBeInTheDocument();
    for (const entry of allPages(role, "capped").flatMap((page) => page.entries)) {
      expect(entry.eventCode).not.toMatch(/^ops\./);
      expect(entry.eventCode).not.toBe("salary_advance.review");
    }
    // The accountant reconciles requests; the TA does not.
    expect(screen.queryAllByText("Yêu cầu mới").length > 0).toBe(role === "accountant");
    expect(screen.getByText(`${getNotificationPreviewUnreadCount(role, "normal")} chưa đọc · trang 1`)).toBeInTheDocument();
  });

  it("opening an unread row runs the stub, then navigates inside /dev; nothing real runs", async () => {
    const markOne = vi.spyOn(previewNotificationActions, "markNotificationRead");
    search.value = "view=notifications&role=ta";
    render(<NotificationsPreviewBody role="ta" state="normal" />);

    const row = rows().find((item) => within(item).queryByText("Yêu cầu tạm ứng đã bị từ chối"));
    fireEvent.click(within(row!).getByRole("link"));
    await waitFor(() => expect(router.push).toHaveBeenCalledExactlyOnceWith("/dev/lists?view=advances&role=ta"));
    expect(markOne).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^f2000000-/));
    expectNothingReal();
  });

  it("Đánh dấu đã đọc and Đánh dấu tất cả đã đọc answer from the stubs: one alert, no refresh", async () => {
    const markOne = vi.spyOn(previewNotificationActions, "markNotificationRead");
    const markAll = vi.spyOn(previewNotificationActions, "markAllNotificationsRead");
    render(<NotificationsPreviewBody role="owner" state="normal" />);

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    // The row button's failure stays in its row.
    expect(within(rows().find((item) => within(item).queryByText("Bảng lương tháng 9/2026 đã chốt"))!).getByRole("alert")).toHaveTextContent(STUB);
    expect(markOne).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Đánh dấu đã đọc: Bảng lương tháng 9/2026 đã chốt" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }));
    await waitFor(() => expect(markAll).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" })).toBeEnabled());
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(STUB);
    expect(router.push).not.toHaveBeenCalled();
    expectNothingReal();
  });

  it("capped: a full page of 50 with 'Cũ hơn', the header total above the page's chip, writes kept on /dev/lists", () => {
    search.value = "view=notifications&state=capped";
    render(<NotificationsPreviewBody role="owner" state="capped" />);

    expect(rows()).toHaveLength(50);
    expect(screen.getByText("6 chưa đọc · trang 1")).toBeInTheDocument();
    expect(within(chips()).getByRole("button", { name: "Chưa đọc4" })).toBeInTheDocument();
    expect(screen.getByText("Số trên chip tính trong 50 thông báo của trang này.")).toBeInTheDocument();
    expect(within(pager()).getByRole("link", { name: "Cũ hơn" })).toHaveAttribute("href", "/dev/lists?view=notifications&state=capped&page=2");
    expect(within(pager()).queryByRole("link", { name: "Mới hơn" })).not.toBeInTheDocument();
  });

  it("capped page 2 (read from the URL by the body): a short older page with the 2 remaining unread, back to page 1", () => {
    search.value = "view=notifications&role=accountant&state=capped&page=2";
    render(<NotificationsPreviewBody role="accountant" state="capped" />);

    expect(rows()).toHaveLength(7);
    expect(within(chips()).getByRole("button", { name: "Chưa đọc2" })).toBeInTheDocument();
    expect(screen.getByText(`${getNotificationPreviewUnreadCount("accountant", "capped")} chưa đọc · trang 2`)).toBeInTheDocument();
    expect(within(pager()).getByRole("link", { name: "Mới hơn" })).toHaveAttribute(
      "href",
      "/dev/lists?view=notifications&role=accountant&state=capped&page=1",
    );
    expect(within(pager()).queryByRole("link", { name: "Cũ hơn" })).not.toBeInTheDocument();
  });

  it("a page past the end says there is nothing older, inside the frame", () => {
    search.value = "view=notifications&state=capped&page=3";
    render(<NotificationsPreviewBody role="owner" state="capped" />);

    expect(screen.getByText("Không còn thông báo cũ hơn.")).toBeInTheDocument();
    expect(within(pager()).getByRole("link", { name: "Mới hơn" })).toHaveAttribute("href", "/dev/lists?view=notifications&state=capped&page=2");
  });

  // Value: protects=following "Cũ hơn" inside /dev/lists (a soft navigation: the body re-reads ?page=) keeps the same list and pager mounted (no key) while page 1's alert and chip are dropped, like the real route;
  // fails_when=the body keys the list by page again (the pager remounts and drops focus) or the list stops resetting its page state on a new page (QA ship-s14d-p2 ISSUE-002: page 2 kept page 1's alert);
  // why_new=red-team R4 / QA ISSUE-002 (cycle 1), reworked by review cycle 2 R2-1; seam=useSearchParams is mocked and re-read on rerender; no_claim=the route (notifications-route.test.tsx)
  it("a new ?page= keeps the list mounted but resets it: no stale alert, chip back on Tất cả", async () => {
    search.value = "view=notifications&state=capped";
    const { rerender } = render(<NotificationsPreviewBody role="owner" state="capped" />);
    const nav = pager();

    fireEvent.click(within(chips()).getByRole("button", { name: "Chưa đọc4" }));
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);

    search.value = "view=notifications&state=capped&page=2";
    rerender(<NotificationsPreviewBody role="owner" state="capped" />);
    expect(screen.getByText("6 chưa đọc · trang 2")).toBeInTheDocument();
    expect(pager()).toBe(nav);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(within(chips()).getByRole("button", { name: /^Tất cả/ })).toHaveAttribute("aria-pressed", "true");
    expectNothingReal();
  });

  it.each(roles)("empty (%s): the empty text once in the frame, nothing to mark, bell at 0", (role) => {
    render(<NotificationsPreviewBody role={role} state="empty" />);

    expect(screen.getAllByText("Không có thông báo")).toHaveLength(1);
    expect(screen.queryByRole("list", { name: "Danh sách thông báo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Lọc nhanh thông báo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" })).toBeDisabled();
    expect(getNotificationPreviewUnreadCount(role, "empty")).toBe(0);
  });
});
