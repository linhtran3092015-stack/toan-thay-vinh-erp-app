"use client";

import { Bell, Menu } from "lucide-react";
import type { RefObject } from "react";

import { AuthUserMenu } from "@/features/auth/components/auth-user-menu";
import type { AuthUser } from "@/features/auth/types";
import { TopbarTimekeepingButton } from "@/components/layout/topbar-timekeeping-button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { NavigationLink } from "@/components/layout/navigation-link";

interface TopbarProps {
  canCheckTimekeeping?: boolean;
  hasOpenTimekeepingEntry?: boolean;
  mobileMenuTriggerRef: RefObject<HTMLButtonElement | null>;
  onMenuClick: () => void;
  unreadNotificationCount: number;
  user: AuthUser;
}

export function Topbar({
  canCheckTimekeeping = false,
  hasOpenTimekeepingEntry = false,
  onMenuClick,
  mobileMenuTriggerRef,
  unreadNotificationCount,
  user,
}: TopbarProps) {
  const notificationBadge =
    unreadNotificationCount > 99
      ? "99+"
      : String(unreadNotificationCount);

  return (
    <header className="sticky top-[var(--safe-area-top)] z-30 flex h-[var(--topbar-height)] items-center gap-3 border-b border-border-subtle bg-surface-base px-4 transition-colors duration-150 sm:px-5 lg:px-6">
      <button
        aria-label="Mở điều hướng chính"
        className="flex h-11 w-11 items-center justify-center rounded-md text-text-strong transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring md:hidden"
        onClick={onMenuClick}
        ref={mobileMenuTriggerRef}
        title="Mở điều hướng chính"
        type="button"
      >
        <Menu aria-hidden="true" size={24} strokeWidth={1.8} />
      </button>

      <div className="ml-auto flex items-center gap-2">
        {canCheckTimekeeping ? (
          <TopbarTimekeepingButton hasOpenEntry={hasOpenTimekeepingEntry} />
        ) : null}

        <ThemeToggle />

        <NavigationLink
          aria-label={
            unreadNotificationCount > 0
              ? `Thông báo, ${unreadNotificationCount} chưa đọc`
              : "Thông báo"
          }
          className="relative flex h-11 w-11 items-center justify-center rounded-md text-text-strong transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
          href="/notifications"
          title="Thông báo"
        >
          <Bell aria-hidden="true" size={20} strokeWidth={1.8} />
          {unreadNotificationCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-text-on-danger">
              {notificationBadge}
            </span>
          ) : null}
        </NavigationLink>
        <div className="mx-1 hidden h-8 w-px bg-border-subtle sm:block" />
        <AuthUserMenu user={user} />
      </div>
    </header>
  );
}
