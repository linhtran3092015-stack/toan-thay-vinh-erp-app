import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, use } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/students", pending: false }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/link")>();
  return { ...actual, useLinkStatus: () => ({ pending: navigation.pending }) };
});
vi.mock("@/features/auth/auth-actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/components/layout/topbar-timekeeping-button", () => ({ TopbarTimekeepingButton: () => null }));
vi.mock("@/features/timekeeping/components/attendance-heartbeat-watcher", () => ({ AttendanceHeartbeatWatcher: () => null }));

import ModuleLoading from "@/app/(app)/loading";
import { AppShell } from "@/components/layout/app-shell";
import { NavigationLink } from "@/components/layout/navigation-link";

function Shell({ children }: { children: React.ReactNode }) {
  return <AppShell authUser={{ id: "test", displayName: "Test", email: "test@example.invalid", initials: "T" }} centerDisplayName="Trung tâm" permissions={["app.access", "students.view", "classes.view", "dashboard.view"]} unreadNotificationCount={0}>{children}</AppShell>;
}

beforeEach(() => {
  navigation.pathname = "/students";
  navigation.pending = false;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Module loading experience", () => {
  it("keeps navigation available while the module suspends, then replaces the fallback", async () => {
    let resolve!: (value: string) => void;
    const data = new Promise<string>((done) => { resolve = done; });
    function SlowModule() { return <h1>{use(data)}</h1>; }

    await act(async () => {
      render(<Shell><Suspense fallback={<ModuleLoading />}><SlowModule /></Suspense></Shell>);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải nội dung");
    expect(screen.getByRole("link", { name: "Lớp học" })).toBeVisible();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mở điều hướng chính" }));
    });
    expect(screen.getByRole("dialog", { name: "Điều hướng chính" })).toBeVisible();

    await act(async () => { resolve("Lớp học đã tải"); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lớp học đã tải" })).toBeVisible();
  });

  it("dismisses the mobile menu on route commit and keeps it closed on Back", () => {
    const { rerender } = render(<Shell>Content</Shell>);
    fireEvent.click(screen.getByRole("button", { name: "Mở điều hướng chính" }));
    expect(screen.getByRole("dialog")).toBeVisible();

    navigation.pathname = "/classes";
    rerender(<Shell>Classes</Shell>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    navigation.pathname = "/students";
    rerender(<Shell>Students</Shell>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("only shows navigation feedback while Next reports an actual pending transition", () => {
    const { rerender } = render(<NavigationLink href="/classes">Lớp học</NavigationLink>);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    navigation.pending = true;
    rerender(<NavigationLink href="/classes">Lớp học</NavigationLink>);
    expect(screen.getByRole("status")).toHaveTextContent("Đang mở mô-đun");
    // Portaling feedback outside the link keeps its accessible name stable.
    expect(screen.getByRole("link", { name: "Lớp học" })).toBeVisible();
    navigation.pending = false;
    rerender(<NavigationLink href="/classes">Lớp học</NavigationLink>);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
