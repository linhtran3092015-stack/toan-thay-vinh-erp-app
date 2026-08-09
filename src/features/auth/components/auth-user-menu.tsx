"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { signOutAction } from "@/features/auth/auth-actions";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import type { AuthUser } from "@/features/auth/types";

interface AuthUserMenuProps {
  user: AuthUser;
}

export function AuthUserMenu({ user }: AuthUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <span className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-pill bg-action-primary text-xs font-bold text-text-on-primary">
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
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex h-11 max-w-[250px] items-center gap-3 rounded-lg px-2 hover:bg-canvas"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {avatar}
        <span className="hidden min-w-0 text-left lg:block">
          <span className="block truncate text-sm font-semibold text-ink">
            {user.displayName}
          </span>
          <span className="block truncate text-xs text-ink-muted">
            Nhân sự trung tâm
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="hidden text-ink-muted lg:block"
          size={18}
          strokeWidth={1.8}
        />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] overflow-hidden rounded-lg border border-hairline bg-surface-raised shadow-modal"
          role="menu"
        >
          <div className="flex gap-3 border-b border-hairline p-4">
            {avatar}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {user.displayName}
              </p>
              <p className="mt-1 truncate text-xs text-ink-muted">
                {user.email}
              </p>
              <p className="mt-1 text-xs text-ink-muted">Nhân sự trung tâm</p>
            </div>
          </div>
          <form action={signOutAction}>
            <SignOutButton />
          </form>
        </div>
      ) : null}
    </div>
  );
}
