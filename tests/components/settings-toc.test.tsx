// Value: protects=the settings hub table of contents (design 09a): three groups in order, "Tổng quan" (/settings) first and active only on the landing itself, Người dùng only with staff.view and Nhật ký only with audit.view (hidden, never disabled), aria-current on the current section only, and the leave-while-dirty guard: a dirty form makes a TOC click open "Thay đổi chưa lưu sẽ mất" instead of navigating, "Ở lại" keeps the page, "Rời trang" navigates, and a beforeunload listener exists only while dirty;
// fails_when=an item shows without its permission, a group heading or order changes, aria-current lands on the wrong item, "Tổng quan" stays active on every /settings/* page or nothing is active on the landing, the guard navigates without asking, "Rời trang" does not navigate, or beforeunload stays registered after the form is clean;
// why_new=step 9 replaces the horizontal settings strip with the hub TOC and adds the leave guard;
// seam=next/navigation is mocked (pathname and router.push observable); a probe component stands in for a settings form through useLeaveGuard; no_claim=does not prove sidebar links or browser back are guarded (out of scope by design) nor the sticky/scroll layout visually
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuardedLink, LeaveGuardProvider, useLeaveGuard } from "@/features/settings/components/leave-guard";
import { SettingsHub } from "@/features/settings/components/settings-hub";
import { SettingsToc } from "@/features/settings/components/settings-toc";

const navigation = vi.hoisted(() => ({ pathname: "/settings/branding", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, refresh: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => {
  navigation.pathname = "/settings/branding";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function linkNames(): string[] {
  return within(screen.getByRole("navigation", { name: "Mục cài đặt" })).getAllByRole("link").map((link) => link.textContent ?? "");
}

describe("SettingsToc", () => {
  it("lists the three groups and every section for a person with staff.view and audit.view", () => {
    render(<SettingsToc canViewAudit canViewUsers />);
    const nav = screen.getByRole("navigation", { name: "Mục cài đặt" });

    expect(within(nav).getAllByRole("group").map((group) => group.getAttribute("aria-label"))).toEqual([
      "Trung tâm & thương hiệu",
      "Con người & phân quyền",
      "Hệ thống",
    ]);
    expect(linkNames()).toEqual(["Tổng quan", "Chung", "Tin Zalo", "Thương hiệu & giao diện", "Trang web công khai", "Người dùng", "Phân quyền", "Nhật ký"]);
    expect(within(nav).getByRole("link", { name: "Tổng quan" })).toHaveAttribute("href", "/settings");
    expect(within(nav).getByRole("link", { name: "Nhật ký" })).toHaveAttribute("href", "/audit");
  });

  it("hides sections the person cannot open instead of disabling them", () => {
    render(<SettingsToc canViewAudit={false} canViewUsers={false} />);
    expect(linkNames()).toEqual(["Tổng quan", "Chung", "Tin Zalo", "Thương hiệu & giao diện", "Trang web công khai", "Phân quyền"]);
    expect(within(screen.getByRole("navigation", { name: "Mục cài đặt" })).getAllByRole("group")).toHaveLength(2);
  });

  it("marks only the current section, and only Tổng quan on the /settings landing", () => {
    const { rerender } = render(<SettingsToc canViewAudit canViewUsers />);
    expect(screen.getByRole("link", { name: "Thương hiệu & giao diện" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);

    navigation.pathname = "/settings";
    rerender(<SettingsToc canViewAudit canViewUsers />);
    // The landing highlights its own "Tổng quan" item (it used to highlight nothing).
    expect(screen.getAllByRole("link").filter((link) => link.hasAttribute("aria-current")).map((link) => link.textContent)).toEqual(["Tổng quan"]);
  });

  // Value: protects=the hub header counts real settings sections only: "Tổng quan" is the landing and is not counted;
  // fails_when=adding the landing item to the TOC inflates "n mục cài đặt" by one, or a hidden section is still counted;
  // why_new=the TOC gained a "Tổng quan" landing item that is not a section; seam=next/navigation mocked; no_claim=the layout's permission reads (server)
  it("counts settings sections in the hub header without the Tổng quan landing", () => {
    const { rerender } = render(<SettingsHub canViewAudit canViewUsers centerName="Trung tâm A"><p>Nội dung</p></SettingsHub>);
    expect(screen.getByText("Trung tâm A · 7 mục cài đặt")).toBeInTheDocument();
    rerender(<SettingsHub canViewAudit={false} canViewUsers={false} centerName="Trung tâm A"><p>Nội dung</p></SettingsHub>);
    expect(screen.getByText("Trung tâm A · 5 mục cài đặt")).toBeInTheDocument();
  });

  // Value: protects=below lg the TOC is a horizontal scroller: on mount the current link is scrolled to the centre of the row (nearest block, so the page does not jump);
  // fails_when=the effect stops running, targets another link, or scrolls vertically (block other than nearest);
  // why_new=the below-lg row now scrolls the current link into view on mount; seam=jsdom has no layout, so scrollWidth/clientWidth and scrollIntoView are stubbed; no_claim=the visual fade or the real scroll position (checked in /dev/settings at 375px)
  it("scrolls the current link into view when the row overflows", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView, writable: true });
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(375);
    navigation.pathname = "/settings/permissions";
    try {
      render(<SettingsToc canViewAudit canViewUsers />);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "center" });
      expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole("link", { name: "Phân quyền" }));
    } finally {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it("does not scroll when the row fits (lg+ column, jsdom)", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView, writable: true });
    try {
      render(<SettingsToc canViewAudit canViewUsers />);
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  // Value: protects=the right-edge fade of the below-lg row shows only while the row can still scroll right: present when it overflows at the start, gone once scrolled to the end, absent when there is no ResizeObserver (jsdom) or nothing overflows;
  // fails_when=the fade is always rendered (it covers the last link at the end of the row), the scroll listener is dropped, or the effect crashes without ResizeObserver;
  // why_new=review found the fade drawn over the last link even when the row was fully scrolled; seam=ResizeObserver stubbed with a manual notify, scrollWidth/clientWidth/scrollLeft stubbed (jsdom has no layout); no_claim=the gradient's look
  it("shows the right-edge fade only while the row can scroll right", () => {
    let notify: (() => void) | undefined;
    class FakeResizeObserver {
      constructor(callback: () => void) {
        notify = callback;
      }
      disconnect() {}
      observe() {}
      unobserve() {}
    }
    const fade = () => screen.getByRole("navigation", { name: "Mục cài đặt" }).nextElementSibling;

    render(<SettingsToc canViewAudit canViewUsers />);
    expect(fade()).toBeNull();
    cleanup();

    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    let scrollLeft = 0;
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(375);
    vi.spyOn(HTMLElement.prototype, "scrollLeft", "get").mockImplementation(() => scrollLeft);
    try {
      render(<SettingsToc canViewAudit canViewUsers />);
      act(() => notify?.());
      expect(fade()).toHaveAttribute("aria-hidden", "true");

      scrollLeft = 525;
      fireEvent.scroll(screen.getByRole("navigation", { name: "Mục cài đặt" }));
      expect(fade()).toBeNull();

      scrollLeft = 100;
      fireEvent.scroll(screen.getByRole("navigation", { name: "Mục cài đặt" }));
      expect(fade()).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function DirtyProbe() {
  const [dirty, setDirty] = useState(true);
  useLeaveGuard(dirty);
  return <button onClick={() => setDirty(false)} type="button">Đánh dấu đã lưu</button>;
}

describe("leave-while-dirty guard", () => {
  it("asks before following a TOC link while a form is dirty", () => {
    render(
      <LeaveGuardProvider>
        <SettingsToc canViewAudit canViewUsers />
        <DirtyProbe />
      </LeaveGuardProvider>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Phân quyền" }));
    const dialog = screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ở lại" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Phân quyền" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Rời trang" }));
    expect(navigation.push).toHaveBeenCalledWith("/settings/permissions");
  });

  it("registers beforeunload only while dirty", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    render(
      <LeaveGuardProvider>
        <DirtyProbe />
      </LeaveGuardProvider>,
    );
    const registered = add.mock.calls.find(([type]) => String(type) === "beforeunload");
    expect(registered).toBeDefined();

    const event = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã lưu" }));
    expect(remove.mock.calls.some(([type, listener]) => String(type) === "beforeunload" && listener === registered?.[1])).toBe(true);
  });

  // Value: protects=once a registered form turns clean (saved or cancelled) the TOC stops asking: its link follows without the leave dialog;
  // fails_when=useLeaveGuard's cleanup stops calling setDirty(id, false) or the provider keeps stale ids, so every later TOC click shows the dialog after a save;
  // why_new=existing guard tests cover dirty-asks and never-dirty only, not dirty-then-clean; seam=none; no_claim=real Next navigation (next/navigation mocked; jsdom click)
  it("stops asking once the form that was dirty is clean again", () => {
    render(
      <LeaveGuardProvider>
        <SettingsToc canViewAudit canViewUsers />
        <DirtyProbe />
      </LeaveGuardProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã lưu" }));

    let preventedByApp: boolean | null = null;
    const record = (event: MouseEvent) => {
      preventedByApp = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener("click", record);
    fireEvent.click(screen.getByRole("link", { name: "Phân quyền" }));
    window.removeEventListener("click", record);
    expect(preventedByApp).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lets the link navigate when nothing is dirty", () => {
    render(
      <LeaveGuardProvider>
        <SettingsToc canViewAudit canViewUsers />
      </LeaveGuardProvider>,
    );
    let preventedByApp: boolean | null = null;
    // Runs after React's handlers (window is last in the bubble path); then stops jsdom's document navigation.
    const record = (event: MouseEvent) => {
      preventedByApp = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener("click", record);
    fireEvent.click(screen.getByRole("link", { name: "Chung" }));
    window.removeEventListener("click", record);
    expect(preventedByApp).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// Value: protects=GuardedLink (used outside the TOC, e.g. the branding card's "Sửa ở Cài đặt chung") asks before leaving while a form is dirty, navigates on "Rời trang", and lets modifier and middle clicks (new tab/window) through without the dialog;
// fails_when=GuardedLink stops consulting the leave guard, navigates while dirty without asking, or swallows Ctrl/Cmd/middle clicks;
// why_new=the TOC click guard is exposed as a reusable link for in-page links; seam=next/navigation mocked (router.push observable); no_claim=the browser actually opening a new tab (jsdom)
describe("GuardedLink", () => {
  function renderGuarded() {
    return render(
      <LeaveGuardProvider>
        <GuardedLink href="/settings/general">Sửa ở Cài đặt chung</GuardedLink>
        <DirtyProbe />
      </LeaveGuardProvider>,
    );
  }

  it("asks before leaving while dirty and navigates on Rời trang", () => {
    renderGuarded();
    fireEvent.click(screen.getByRole("link", { name: "Sửa ở Cài đặt chung" }));
    const dialog = screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rời trang" }));
    expect(navigation.push).toHaveBeenCalledWith("/settings/general");
  });

  it("lets modifier and middle clicks through without asking", () => {
    renderGuarded();
    const link = screen.getByRole("link", { name: "Sửa ở Cài đặt chung" });
    const prevented: boolean[] = [];
    const record = (event: MouseEvent) => {
      prevented.push(event.defaultPrevented);
      event.preventDefault();
    };
    window.addEventListener("click", record);
    window.addEventListener("auxclick", record);
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    fireEvent.click(link, { shiftKey: true });
    fireEvent.click(link, { button: 1 });
    window.removeEventListener("click", record);
    window.removeEventListener("auxclick", record);
    expect(prevented).toEqual([false, false, false, false]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  // Value: protects=outside a LeaveGuardProvider (e.g. a page rendered on its own) GuardedLink is a plain link: it never holds the click, even with a dirty form registered nowhere;
  // fails_when=GuardedLink requires the provider (crash) or prevents navigation without one;
  // why_new=the dialog moved into the provider, so the link must degrade to next/link without it; seam=next/navigation mocked; no_claim=Next's own navigation
  it("is a plain link outside a provider", () => {
    render(
      <>
        <GuardedLink href="/settings/general">Sửa ở Cài đặt chung</GuardedLink>
        <DirtyProbe />
      </>,
    );
    let preventedByApp: boolean | null = null;
    const record = (event: MouseEvent) => {
      preventedByApp = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener("click", record);
    fireEvent.click(screen.getByRole("link", { name: "Sửa ở Cài đặt chung" }));
    window.removeEventListener("click", record);
    expect(preventedByApp).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("follows the link without asking when nothing is dirty", () => {
    render(
      <LeaveGuardProvider>
        <GuardedLink href="/settings/general">Sửa ở Cài đặt chung</GuardedLink>
      </LeaveGuardProvider>,
    );
    let preventedByApp: boolean | null = null;
    const record = (event: MouseEvent) => {
      preventedByApp = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener("click", record);
    fireEvent.click(screen.getByRole("link", { name: "Sửa ở Cài đặt chung" }));
    window.removeEventListener("click", record);
    expect(preventedByApp).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
