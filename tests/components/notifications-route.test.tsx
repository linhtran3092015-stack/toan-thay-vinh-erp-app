// Value: protects=/notifications keeps its gate, titles and error copy, parses ?page= as before, renders the list (in-frame empty, not a bare page EmptyState) for an empty page 1 and for a page past the end, and passes page, the "Cũ hơn" heuristic (a full page of NOTIFICATION_PAGE_SIZE) and the Vietnam business date;
// fails_when=the route returns its old EmptyState or raw <nav>, hasNextPage stops following a full page, the page reaching the loader differs from the one passed to the list, the gate or its copy drifts from the shared constant, or today is the UTC date;
// why_new=step 14d moves the empty state and the pager into the list and adds page/hasNextPage/today; seam=permissions, the notifications loaders and the list component are mocked (the list captures its props); no_claim=the list's rendering (notification-list-page.test.tsx) or the loaders' query (notification-load-limits.test.ts)
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import NotificationsLoading from "@/app/(app)/notifications/loading";
import NotificationsRoute from "@/app/(app)/notifications/page";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { NotificationListPage } from "@/features/notifications/notification-list-page";
import { NOTIFICATION_PAGE_SIZE } from "@/features/notifications/notification-models";
import type { NotificationEntry } from "@/features/notifications/read-models";

const dependencies = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getCachedUnreadNotificationCountResult: vi.fn(),
  getNotificationsResult: vi.fn(),
  NotificationListPage: vi.fn(() => null),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/notifications/data", () => ({
  getCachedUnreadNotificationCountResult: dependencies.getCachedUnreadNotificationCountResult,
  getNotificationsResult: dependencies.getNotificationsResult,
}));
vi.mock("@/features/notifications/notification-list-page", () => ({
  NotificationListPage: dependencies.NotificationListPage,
}));

type ListElement = ReactElement<ComponentProps<typeof NotificationListPage>>;

function rows(count: number): NotificationEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    createdAt: "2026-10-16T02:40:00.000Z",
    entityId: null,
    entityType: null,
    eventCode: "salary_advance.review",
    href: "/advances",
    id: `n-${index}`,
    message: "Một yêu cầu tạm ứng đã được đối soát và đang chờ duyệt.",
    readAt: null,
    title: "Yêu cầu tạm ứng chờ duyệt",
  }));
}

async function renderRoute({
  entries = [],
  permissions = ["notifications.view"],
  search,
  unreadCount = 3,
}: { entries?: NotificationEntry[]; permissions?: string[]; search?: Record<string, unknown>; unreadCount?: number } = {}) {
  dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions });
  dependencies.getNotificationsResult.mockResolvedValue({ data: entries, ok: true });
  dependencies.getCachedUnreadNotificationCountResult.mockResolvedValue({ data: unreadCount, ok: true });
  const element = search === undefined
    ? await NotificationsRoute({})
    : await NotificationsRoute({ searchParams: Promise.resolve(search as { page?: string }) });
  return element as ListElement;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("Notifications route (step 14d wiring)", () => {
  it("renders the list, not a bare page empty state, when page 1 has no notification", async () => {
    const element = await renderRoute({ unreadCount: 0 });

    expect(element.type).toBe(dependencies.NotificationListPage);
    expect(element.props).toMatchObject({ entries: [], hasNextPage: false, page: 1, unreadCount: 0 });
  });

  it("passes the exact unread total and the loaded rows; a full page offers an older one", async () => {
    const full = rows(NOTIFICATION_PAGE_SIZE);
    const element = await renderRoute({ entries: full, search: { page: "2" }, unreadCount: 120 });

    expect(dependencies.getNotificationsResult).toHaveBeenCalledExactlyOnceWith(2);
    expect(element.props).toMatchObject({ entries: full, hasNextPage: true, page: 2, unreadCount: 120 });
  });

  it("a short page has no older page", async () => {
    const element = await renderRoute({ entries: rows(NOTIFICATION_PAGE_SIZE - 1) });
    expect(element.props.hasNextPage).toBe(false);
  });

  it("a page past the end still renders the list (its in-frame empty and pager)", async () => {
    const element = await renderRoute({ search: { page: "4" } });
    expect(element.type).toBe(dependencies.NotificationListPage);
    expect(element.props).toMatchObject({ entries: [], hasNextPage: false, page: 4 });
  });

  it.each([
    [undefined, 1],
    [{}, 1],
    [{ page: "3" }, 3],
    [{ page: "a" }, 1],
    [{ page: "0" }, 1],
    [{ page: "1.5" }, 1],
    [{ page: "999999" }, 100000],
    [{ page: ["1", "2"] }, 1],
  ])("searchParams %j reads and passes page %d", async (search, page) => {
    const element = await renderRoute({ search });
    expect(dependencies.getNotificationsResult).toHaveBeenCalledExactlyOnceWith(page);
    expect(element.props.page).toBe(page);
  });

  // Value: protects=a pager link (a soft navigation to this same segment) keeps the same list mounted, so the activated "Cũ hơn"/"Mới hơn" link keeps keyboard focus; the new page reaches the list as its `page` prop, which resets the page's own state (notification-list-page.test.tsx);
  // fails_when=the route keys the list by page again (the whole list, pager included, remounts and focus falls to <body>) or stops passing the page it read;
  // why_new=review cycle 2 R2-1 replaces cycle 1's key={page} (QA ship-s14d-p2 ISSUE-002 is now fixed inside the list); seam=the list is mocked and the returned element read directly; no_claim=Next's reconciliation itself
  it("does not key the list by page (pager focus survives); each page reaches it as a prop", async () => {
    const first = await renderRoute({ search: { page: "1" } });
    const second = await renderRoute({ search: { page: "2" } });

    expect(first.key).toBeNull();
    expect(second.key).toBeNull();
    expect(first.props.page).toBe(1);
    expect(second.props.page).toBe(2);
  });

  it("passes the Vietnam business date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 17:30 UTC on 15/10 is already 16 October in Vietnam.
    vi.setSystemTime(new Date("2026-10-15T17:30:00Z"));
    const element = await renderRoute();
    expect(element.props.today).toBe("2026-10-16");
  });

  it("denies without notifications.view, with the shared title and the standard description", async () => {
    const element = (await renderRoute({ permissions: ["app.access"] })) as unknown as ReactElement<ComponentProps<typeof PermissionDeniedState>>;

    expect(element.type).toBe(PermissionDeniedState);
    expect(element.props).toEqual({
      description: "Tài khoản hiện tại chưa được cấp quyền xem thông báo. Liên hệ quản trị viên nếu bạn cần quyền này.",
      title: "Không có quyền xem thông báo",
    });
    expect(dependencies.getNotificationsResult).not.toHaveBeenCalled();
  });

  it("keeps the permission error copy", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: false });
    const element = (await NotificationsRoute({})) as ReactElement<ComponentProps<typeof ErrorState>>;

    expect(element.type).toBe(ErrorState);
    expect(element.props).toEqual({
      description: "Hệ thống chưa tải được quyền truy cập thông báo.",
      title: "Không tải được quyền truy cập",
    });
  });

  it.each([
    ["the list read", { ok: false }, { data: 3, ok: true }],
    ["the unread count", { data: [], ok: true }, { ok: false }],
  ])("keeps the load error copy when %s fails", async (_, list, count) => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["notifications.view"] });
    dependencies.getNotificationsResult.mockResolvedValue(list);
    dependencies.getCachedUnreadNotificationCountResult.mockResolvedValue(count);
    const element = (await NotificationsRoute({})) as ReactElement<ComponentProps<typeof ErrorState>>;

    expect(element.type).toBe(ErrorState);
    expect(element.props).toEqual({
      description: "Không tải được dữ liệu thông báo từ hệ thống.",
      title: "Không tải được thông báo",
    });
  });

  // Value: protects=/notifications loading still announces "Đang tải thông báo" as its only status (brief N9 keeps the LoadingNotice), and the placeholder list stays hidden from assistive tech;
  // fails_when=the skeleton redraw drops or renames the LoadingNotice, or the placeholder <ul> loses aria-hidden (a screen reader hears an empty six-item list);
  // why_new=the audit and reports loading files are checked (audit-log-page.test.tsx, reports-route.test.tsx); the rewritten notifications loading had no test;
  // seam=none; no_claim=the skeleton's geometry matching the list
  it("its loading state announces 'Đang tải thông báo' and hides the placeholder list", () => {
    render(<NotificationsLoading />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải thông báo");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
