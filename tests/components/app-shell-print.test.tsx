// Value: protects=printing from inside the app shell (Phiếu học phí A5 sheets, design 15b): every shell landmark around the page (sidebar rail, mobile drawer, topbar, module strip, their navs) sits under a print:hidden element, and the page's wrappers drop the rail padding, the min-height and main's padding and max width for print, so only the page content reaches paper;
// fails_when=a shell aside, header or nav loses print:hidden (it prints above the first sheet), the content column keeps its rail padding or min-height in print, or main keeps its padding or max width in print;
// why_new=step 13 made the shell print-clean for the fee-notice print tab and notice page; no test rendered the real shell for print;
// seam=next/navigation, next/link's useLinkStatus, the sign-out server action and the timekeeping button mocked at their module boundaries; the real AppShell, Sidebar, Topbar and ModuleNavigation; no_claim=does not prove how a browser paginates the print or that the print: variant compiles to @media print
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/timekeeping" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ back: vi.fn(), forward: vi.fn(), prefetch: vi.fn(), push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/link")>();
  return { ...actual, useLinkStatus: () => ({ pending: false }) };
});
vi.mock("@/features/auth/auth-actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/components/layout/topbar-timekeeping-button", () => ({ TopbarTimekeepingButton: () => null }));
vi.mock("@/features/timekeeping/components/attendance-heartbeat-watcher", () => ({ AttendanceHeartbeatWatcher: () => null }));

import { AppShell } from "@/components/layout/app-shell";

const PRINT_HIDDEN = '[class~="print:hidden"]';

beforeEach(() => {
  navigation.pathname = "/timekeeping";
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ addEventListener() {}, matches: false, removeEventListener() {} }));
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AppShell print", () => {
  it("hides every shell landmark for print and lets main span the page without padding", () => {
    const { container } = render(
      <AppShell
        authUser={{ displayName: "Test", email: "test@example.invalid", id: "test", initials: "T" }}
        centerDisplayName="Trung tâm"
        permissions={["app.access", "students.view", "staff.view", "timekeeping.view"]}
        unreadNotificationCount={2}
      >
        <p>Nội dung trang</p>
      </AppShell>,
    );
    // Open the mobile drawer too, so its aside is in the DOM.
    fireEvent.click(screen.getByRole("button", { name: "Mở điều hướng chính" }));
    expect(screen.getByRole("dialog", { name: "Điều hướng chính" })).toBeInTheDocument();

    const chrome = [...container.querySelectorAll("aside, header, nav")];
    expect(chrome.filter((element) => element.tagName === "ASIDE")).toHaveLength(2);
    expect(chrome.filter((element) => element.tagName === "HEADER").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("navigation", { name: "Mô-đun trong Nhân sự" }).length).toBeGreaterThan(0);
    for (const element of chrome) {
      expect(element.closest(PRINT_HIDDEN), `${element.tagName.toLowerCase()} ${element.getAttribute("aria-label") ?? element.className}`).not.toBeNull();
    }

    const main = screen.getByRole("main");
    expect(main).toHaveClass("print:p-0", "print:max-w-none");
    expect(main.closest(PRINT_HIDDEN)).toBeNull();
    expect(main).toContainElement(screen.getByText("Nội dung trang"));
    expect(main.parentElement).toHaveClass("print:pl-0", "print:min-h-0");
    expect(main.parentElement?.parentElement).toHaveClass("print:min-h-0");
  });
});
