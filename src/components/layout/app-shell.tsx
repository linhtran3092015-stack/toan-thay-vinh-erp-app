"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  getActiveNavigationDomain,
  getVisibleNavigationDomains,
} from "@/config/navigation";
import { ModuleNavigation } from "@/components/layout/module-navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { AuthUser } from "@/features/auth/types";
import type { PermissionCode } from "@/lib/permissions/types";

interface AppShellProps {
  authUser: AuthUser;
  canCheckTimekeeping?: boolean;
  centerDisplayName: string;
  children: ReactNode;
  hasOpenTimekeepingEntry?: boolean;
  openOfflineEntryId?: string | null;
  permissions: readonly PermissionCode[];
  unreadNotificationCount: number;
}

export function AppShell({
  authUser,
  canCheckTimekeeping = false,
  centerDisplayName,
  children,
  hasOpenTimekeepingEntry = false,
  permissions,
  unreadNotificationCount,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavPath, setMobileNavPath] = useState<string | null>(null);
  const isMobileNavOpen = mobileNavPath === pathname;
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const visibleDomains = getVisibleNavigationDomains(permissions);
  const activeDomain = getActiveNavigationDomain(pathname, visibleDomains);

  if (mobileNavPath !== null && mobileNavPath !== pathname) {
    // Forget the old open menu so browser Back cannot reopen it later.
    setMobileNavPath(null);
  }

  const closeMobileNavigation = (restoreFocus = true) => {
    setMobileNavPath(null);
    if (restoreFocus) {
      requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus());
    }
  };

  return (
    <div className="min-h-screen bg-surface-canvas text-text-strong">
      <Sidebar
        activeDomainKey={activeDomain?.key}
        centerDisplayName={centerDisplayName}
        domains={visibleDomains}
        isMobileOpen={isMobileNavOpen}
        onClose={closeMobileNavigation}
      />

      <div className="min-h-screen md:pl-[72px] xl:pl-[var(--sidebar-width)]">
        <Topbar
          canCheckTimekeeping={canCheckTimekeeping}
          hasOpenTimekeepingEntry={hasOpenTimekeepingEntry}
          mobileMenuTriggerRef={mobileMenuTriggerRef}
          onMenuClick={() => setMobileNavPath(pathname)}
          unreadNotificationCount={unreadNotificationCount}
          user={authUser}
        />
        <ModuleNavigation domain={activeDomain} />

        <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-5 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
