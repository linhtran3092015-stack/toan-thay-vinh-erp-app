import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  permissions: vi.fn(),
  entries: vi.fn(),
  notifications: vi.fn(),
  centerName: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: () => null }));
vi.mock("@/features/website/data", () => ({ readAppBranding: async () => null }));
vi.mock("@/features/auth/current-user", () => ({ getCachedCurrentAuthUser: mocks.auth }));
vi.mock("@/lib/permissions/database-permissions", () => ({ getCachedDatabasePermissions: mocks.permissions }));
vi.mock("@/features/timekeeping/data", () => ({ getAttendanceVerificationPolicy: () => Promise.resolve({ ok: false as const, error: { code: "verification_policy_query_failed" as const, message: "mock" } }),  getCachedMyTimekeepingEntries: mocks.entries }));
vi.mock("@/features/notifications/data", () => ({ getCachedUnreadNotificationCountResult: mocks.notifications }));
vi.mock("@/features/settings/system-settings-data", () => ({ getCenterDisplayName: mocks.centerName }));

import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, user: { id: "user" } });
  mocks.permissions.mockResolvedValue({ ok: true, permissions: ["app.access", "timekeeping.check", "notifications.view"] });
  mocks.entries.mockResolvedValue({ ok: true, entries: [{ status: "open" }] });
  mocks.notifications.mockResolvedValue({ ok: true, data: 3 });
  mocks.centerName.mockResolvedValue("Trung tâm");
});

describe("Authenticated shell loading", () => {
  it("starts independent shell reads before any of them finishes", async () => {
    let finishEntries!: (value: unknown) => void;
    let finishNotifications!: (value: unknown) => void;
    mocks.entries.mockReturnValue(new Promise((resolve) => { finishEntries = resolve; }));
    mocks.notifications.mockReturnValue(new Promise((resolve) => { finishNotifications = resolve; }));

    const shell = AuthenticatedAppShell({ children: "module content" });

    // Fail on the old waterfall: neither notifications nor branding can start
    // until the held timekeeping request resolves.
    try {
      await vi.waitFor(() => {
        expect(mocks.entries).toHaveBeenCalledOnce();
        expect(mocks.notifications).toHaveBeenCalledOnce();
        expect(mocks.centerName).toHaveBeenCalledOnce();
      });
    } finally {
      finishEntries?.({ ok: true, entries: [{ status: "open" }] });
      finishNotifications?.({ ok: true, data: 3 });
    }

    const result = await shell;
    const appShell = result.props.children;
    expect(appShell.props).toMatchObject({
      children: "module content", hasOpenTimekeepingEntry: true,
      unreadNotificationCount: 3, centerDisplayName: "Trung tâm",
    });
  });

  it("does not read protected shell data before app access is granted", async () => {
    mocks.permissions.mockResolvedValue({ ok: true, permissions: [] });
    await AuthenticatedAppShell({ children: "private content" });
    expect(mocks.entries).not.toHaveBeenCalled();
    expect(mocks.notifications).not.toHaveBeenCalled();
    expect(mocks.centerName).not.toHaveBeenCalled();
  });

  it("skips reads without the corresponding permission", async () => {
    mocks.permissions.mockResolvedValue({ ok: true, permissions: ["app.access"] });
    const result = await AuthenticatedAppShell({ children: "content" });
    expect(mocks.entries).not.toHaveBeenCalled();
    expect(mocks.notifications).not.toHaveBeenCalled();
    const appShell = result.props.children;
    expect(appShell.props).toMatchObject({ hasOpenTimekeepingEntry: false, unreadNotificationCount: 0 });
  });

  it("preserves sign-in redirects without starting supplementary reads", async () => {
    mocks.auth.mockResolvedValue({ ok: false, error: "session_expired" });
    await expect(AuthenticatedAppShell({ children: "private" })).rejects.toThrow("redirect:/login?error=session_expired");
    expect(mocks.permissions).not.toHaveBeenCalled();
    expect(mocks.entries).not.toHaveBeenCalled();
    expect(mocks.notifications).not.toHaveBeenCalled();
  });
});
