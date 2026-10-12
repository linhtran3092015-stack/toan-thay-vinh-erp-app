import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TopbarTimekeepingButton } from "@/components/layout/topbar-timekeeping-button";
import { Topbar } from "@/components/layout/topbar";

afterEach(() => {
  cleanup();
});

describe("TopbarTimekeepingButton", () => {
  it("renders default attendance button with explicit white text styling when no open entry exists", () => {
    render(<TopbarTimekeepingButton hasOpenEntry={false} />);

    const link = screen.getByRole("link", { name: "Chấm công ngay" });
    expect(link).toHaveAttribute("href", "/timekeeping");
    expect(link).toHaveTextContent("Chấm công");
    expect(link.className).toContain("text-white");
  });

  it("renders active attendance status button with explicit white text styling when an open entry exists", () => {
    render(<TopbarTimekeepingButton hasOpenEntry />);

    const link = screen.getByRole("link", { name: "Đang trong ca chấm công - Ra ca" });
    expect(link).toHaveAttribute("href", "/timekeeping");
    expect(link).toHaveTextContent("Đang chấm công");
    expect(link.className).toContain("text-white");
  });

  it("renders Topbar with the attendance button next to the bell and user menu when user has timekeeping permission", () => {
    render(
      <Topbar
        canCheckTimekeeping
        hasOpenTimekeepingEntry={false}
        mobileMenuTriggerRef={{ current: null }}
        onMenuClick={() => {}}
        unreadNotificationCount={0}
        user={{ displayName: "Test Assistant", email: "ta@example.com", id: "user-1", initials: "TA" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Chấm công ngay" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Thông báo" })).toHaveAttribute("href", "/notifications");
    fireEvent.click(screen.getByRole("button", { name: "Tài khoản: Test Assistant" }));
    expect(screen.getByRole("menuitem", { name: /Giao diện/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Đăng xuất" })).toBeInTheDocument();
  });

  it("hides attendance button when user lacks timekeeping permission", () => {
    render(
      <Topbar
        canCheckTimekeeping={false}
        mobileMenuTriggerRef={{ current: null }}
        onMenuClick={() => {}}
        unreadNotificationCount={0}
        user={{ displayName: "Unauthorized Staff", email: "unauth@example.com", id: "user-2", initials: "US" }}
      />,
    );

    expect(screen.queryByRole("link", { name: /Chấm công/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tài khoản: Unauthorized Staff" })).toBeInTheDocument();
  });
});
