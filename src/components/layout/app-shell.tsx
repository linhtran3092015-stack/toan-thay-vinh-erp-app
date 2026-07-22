"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { AuthUser } from "@/features/auth/types";
import { mockCurrentUser } from "@/lib/permissions/mock-current-user";
import { cn } from "@/lib/utils";

interface AppShellProps {
  authUser: AuthUser;
  children: ReactNode;
}

export function AppShell({ authUser, children }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Sidebar
        isDesktopCollapsed={isDesktopCollapsed}
        isMobileOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        onToggleDesktopCollapse={() =>
          setIsDesktopCollapsed((isCollapsed) => !isCollapsed)
        }
        user={mockCurrentUser}
      />
      <div
        className={cn(
          "min-h-screen md:pl-[72px]",
          isDesktopCollapsed
            ? "lg:pl-[72px]"
            : "lg:pl-[var(--sidebar-width)]",
        )}
      >
        <Topbar
          onMenuClick={() => setIsMobileNavOpen(true)}
          onSidebarToggle={() =>
            setIsDesktopCollapsed((isCollapsed) => !isCollapsed)
          }
          user={authUser}
        />
        <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-5 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
