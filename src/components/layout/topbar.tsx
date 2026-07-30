"use client";

import Link from "next/link";

import { AuthUserMenu } from "@/features/auth/components/auth-user-menu";
import type { AuthUser } from "@/features/auth/types";
import { ThemeToggle } from "@/components/shared/theme-toggle";

interface TopbarProps {
  user: AuthUser;
  onMenuClick: () => void;
  onSidebarToggle: () => void;
  unreadNotificationCount: number;
}

export function Topbar({
  user,
  onMenuClick,
  onSidebarToggle,
  unreadNotificationCount,
}: TopbarProps) {
  const notificationBadge =
    unreadNotificationCount > 99
      ? "99+"
      : String(unreadNotificationCount);

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center gap-3 border-b border-hairline bg-surface-1/95 px-4 shadow-topbar backdrop-blur-md transition-colors duration-200 sm:px-5 lg:px-6">
      <button
        aria-label="Mở menu"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-surface-1 text-xl font-semibold text-primary transition-colors hover:bg-primary-soft md:hidden"
        onClick={onMenuClick}
        type="button"
      >
        ≡
      </button>
      <button
        aria-label="Thu gọn menu"
        className="hidden h-10 w-10 items-center justify-center rounded-lg border border-transparent text-xl font-semibold text-primary transition-colors hover:border-hairline hover:bg-primary-soft md:flex"
        onClick={onSidebarToggle}
        type="button"
      >
        ≡
      </button>

      <div className="hidden h-10 min-w-0 max-w-[520px] flex-1 items-center gap-3 rounded-lg border border-hairline bg-surface-2 px-4 text-sm text-ink-muted transition-colors sm:flex focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="text-base text-primary">⌕</span>
        <span className="truncate">Tìm kiếm học viên, phụ huynh, lớp học, ...</span>
        <span className="ml-auto rounded-md border border-hairline bg-surface-1 px-2 py-0.5 text-xs font-semibold text-ink-subtle">
          ⌘ K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />

        <Link
          aria-label={
            unreadNotificationCount > 0
              ? `Thông báo, ${unreadNotificationCount} chưa đọc`
              : "Thông báo"
          }
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-lg text-primary transition-colors hover:border-hairline hover:bg-primary-soft"
          href="/notifications"
        >
          <span aria-hidden="true">🔔</span>
          {unreadNotificationCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-bold leading-none text-white shadow-sm">
              {notificationBadge}
            </span>
          ) : null}
        </Link>
        <button
          aria-label="Lịch hôm nay"
          className="hidden h-10 w-10 items-center justify-center rounded-lg border border-transparent text-xl text-primary transition-colors hover:border-hairline hover:bg-primary-soft sm:flex"
          type="button"
        >
          □
        </button>
        <div className="mx-1 hidden h-8 w-px bg-hairline sm:block" />
        <AuthUserMenu user={user} />
      </div>
    </header>
  );
}
