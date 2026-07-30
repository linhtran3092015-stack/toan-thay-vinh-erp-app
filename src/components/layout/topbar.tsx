"use client";

import { AuthUserMenu } from "@/features/auth/components/auth-user-menu";
import type { AuthUser } from "@/features/auth/types";
import { ThemeToggle } from "@/components/shared/theme-toggle";

interface TopbarProps {
  user: AuthUser;
  onMenuClick: () => void;
  onSidebarToggle: () => void;
}

export function Topbar({ user, onMenuClick, onSidebarToggle }: TopbarProps) {
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

        <button
          aria-label="Thông báo"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-xl text-primary transition-colors hover:border-hairline hover:bg-primary-soft"
          type="button"
        >
          ♢
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-bold leading-none text-white shadow-sm">
            12
          </span>
        </button>
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
