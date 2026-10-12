"use client";

import { ChevronDown, Moon, Sun } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { signOutAction } from "@/features/auth/auth-actions";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import type { AuthUser } from "@/features/auth/types";
import { useTheme } from "@/components/shared/theme-toggle";

interface AuthUserMenuProps {
  user: AuthUser;
}

const menuItemClassName =
  "flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-body text-text-strong hover:bg-interactive-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus";

/**
 * Topbar user menu (design 01): identity header, appearance, sign out in
 * danger text. Account routes (profile, password) are not ERP routes yet, so
 * they are intentionally absent rather than invented.
 */
export function AuthUserMenu({ user }: AuthUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { isClient, theme, toggle } = useTheme();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const avatar = (
    <span className="relative flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full bg-action-primary-soft text-caption font-bold text-action-primary">
      {user.initials}
      {user.avatarUrl && !avatarFailed ? (
        // Google profile images are external and intentionally bypass optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setAvatarFailed(true)}
          referrerPolicy="no-referrer"
          src={user.avatarUrl}
        />
      ) : null}
    </span>
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Tài khoản: ${user.displayName}`}
        className="flex h-10 max-w-[260px] items-center gap-2 rounded-md border border-border-subtle bg-surface-base py-0 pl-1 pr-2 hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {avatar}
        <span className="hidden min-w-0 text-left leading-4 lg:block">
          <span className="block truncate text-secondary font-semibold text-text-strong">
            {user.displayName}
          </span>
          <span className="block truncate text-caption text-text-muted">
            Nhân sự trung tâm
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="hidden flex-none text-text-muted lg:block"
          size={16}
          strokeWidth={1.8}
        />
      </button>

      {isOpen ? (
        <div
          className="panel-rise absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-lg border border-border-subtle bg-surface-raised p-1.5 shadow-[var(--elevation-2)]"
          id={menuId}
          role="menu"
        >
          <div className="mb-1.5 border-b border-border-row px-2.5 pb-2.5 pt-2">
            <p className="truncate text-body font-semibold text-text-strong">
              {user.displayName}
            </p>
            <p className="truncate text-caption text-text-muted">{user.email}</p>
          </div>
          <button
            className={menuItemClassName}
            disabled={!isClient}
            onClick={toggle}
            role="menuitem"
            type="button"
          >
            {theme === "dark" ? (
              <Sun aria-hidden="true" size={16} strokeWidth={1.8} />
            ) : (
              <Moon aria-hidden="true" size={16} strokeWidth={1.8} />
            )}
            {theme === "dark" ? "Giao diện: Tối → Sáng" : "Giao diện: Sáng → Tối"}
          </button>
          <div aria-hidden="true" className="my-1.5 h-px bg-border-row" />
          <form action={signOutAction}>
            <SignOutButton />
          </form>
        </div>
      ) : null}
    </div>
  );
}
