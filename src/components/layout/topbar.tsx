"use client";

import { Bell, Menu } from "lucide-react";
import type { RefObject } from "react";

import { AuthUserMenu } from "@/features/auth/components/auth-user-menu";
import type { AuthUser } from "@/features/auth/types";
import { TopbarTimekeepingButton } from "@/components/layout/topbar-timekeeping-button";
import type { AttendanceVerificationPolicy } from "@/features/timekeeping/types";
import { NavigationLink } from "@/components/layout/navigation-link";
import type { NavigationBreadcrumb } from "@/config/navigation";

interface TopbarProps {
  attendancePolicy?: AttendanceVerificationPolicy;
  breadcrumb?: NavigationBreadcrumb;
  canCheckTimekeeping?: boolean;
  hasOpenTimekeepingEntry?: boolean;
  openTimekeepingEntryId?: string | null;
  mobileMenuTriggerRef: RefObject<HTMLButtonElement | null>;
  onMenuClick: () => void;
  unreadNotificationCount: number;
  user: AuthUser;
}

/**
 * 64px topbar (design 01): real-route breadcrumb on the left, bell with an
 * 18px count and the user menu on the right. No search, no calendar.
 */
export function Topbar({
  attendancePolicy,
  breadcrumb,
  canCheckTimekeeping = false,
  hasOpenTimekeepingEntry = false,
  openTimekeepingEntryId = null,
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
    <header className="sticky top-[var(--safe-area-top)] z-30 flex h-[var(--topbar-h)] items-center gap-3 border-b border-border-subtle bg-surface-base px-4 md:px-5 lg:px-6 print:hidden">
      <button
        aria-label="Mở điều hướng chính"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-md text-text-strong hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:hidden"
        onClick={onMenuClick}
        ref={mobileMenuTriggerRef}
        title="Mở điều hướng chính"
        type="button"
      >
        <Menu aria-hidden="true" size={22} strokeWidth={1.8} />
      </button>

      {breadcrumb?.item ? (
        <nav aria-label="Vị trí hiện tại" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-2 text-body text-text-muted">
            {breadcrumb.domain ? (
              <>
                <li className="hidden truncate sm:block">
                  <NavigationLink
                    className="hover:text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                    href={breadcrumb.domain.href}
                  >
                    {breadcrumb.domain.label}
                  </NavigationLink>
                </li>
                <li aria-hidden="true" className="hidden text-border-strong-hover sm:block">
                  /
                </li>
              </>
            ) : null}
            <li className="truncate font-semibold text-text-strong">
              <span aria-current="page">{breadcrumb.item.label}</span>
            </li>
          </ol>
        </nav>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {canCheckTimekeeping ? (
          <TopbarTimekeepingButton
            attendancePolicy={attendancePolicy}
            hasOpenEntry={hasOpenTimekeepingEntry}
            openEntryId={openTimekeepingEntryId}
          />
        ) : null}

        <NavigationLink
          aria-label={
            unreadNotificationCount > 0
              ? `Thông báo, ${unreadNotificationCount} chưa đọc`
              : "Thông báo"
          }
          className="relative flex h-10 w-10 items-center justify-center rounded-md bg-interactive-hover text-text-default hover:bg-surface-sunken hover:text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          href="/notifications"
          title="Thông báo"
        >
          <Bell aria-hidden="true" size={20} strokeWidth={1.8} />
          {unreadNotificationCount > 0 ? (
            <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-action-primary px-[5px] text-[11px] font-semibold leading-none tabular-nums text-text-on-primary">
              {notificationBadge}
            </span>
          ) : null}
        </NavigationLink>
        <AuthUserMenu user={user} />
      </div>
    </header>
  );
}
