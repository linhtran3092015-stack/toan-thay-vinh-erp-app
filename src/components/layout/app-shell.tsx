"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  getActiveNavigationDomain,
  getNavigationBreadcrumb,
  getVisibleNavigationGroups,
} from "@/config/navigation";
import { ModuleNavigation } from "@/components/layout/module-navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { AttendanceVerificationPolicy } from "@/features/timekeeping/types";
import { InstallAppPrompt } from "@/components/shared/install-app-prompt";
import { StudentCareRefresh } from "@/features/student-care/refresh";
import type { AuthUser } from "@/features/auth/types";
import type { PermissionCode } from "@/lib/permissions/types";

interface AppShellProps {
  authUser: AuthUser;
  attendancePolicy?: AttendanceVerificationPolicy;
  canCheckTimekeeping?: boolean;
  centerDisplayName: string;
  children: ReactNode;
  hasOpenTimekeepingEntry?: boolean;
  openOfflineEntryId?: string | null;
  openTimekeepingEntryId?: string | null;
  permissions: readonly PermissionCode[];
  /** Dev previews only: pretend the shell is on this route. */
  previewPathname?: string;
  unreadNotificationCount: number;
}

/**
 * Shell (design 01): 240px grouped sidebar from xl, 72px rail on tablet,
 * drawer on mobile; 64px topbar; module strip only for multi-module domains.
 */
export function AppShell({
  authUser,
  attendancePolicy,
  canCheckTimekeeping = false,
  centerDisplayName,
  children,
  hasOpenTimekeepingEntry = false,
  openTimekeepingEntryId = null,
  permissions,
  previewPathname,
  unreadNotificationCount,
}: AppShellProps) {
  const routePathname = usePathname();
  const pathname = previewPathname ?? routePathname;
  const [mobileNavPath, setMobileNavPath] = useState<string | null>(null);
  const isMobileNavOpen = mobileNavPath === pathname;
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const visibleGroups = getVisibleNavigationGroups(permissions);
  const visibleDomains = visibleGroups.flatMap((group) => group.domains);
  const activeDomain = getActiveNavigationDomain(pathname, visibleDomains);
  const breadcrumb = getNavigationBreadcrumb(pathname, visibleDomains);

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
    <div className="min-h-screen bg-surface-canvas text-text-strong print:min-h-0 print:bg-white">
      {permissions.includes("student_care.view") ? <StudentCareRefresh /> : null}
      <Sidebar
        activeDomainKey={activeDomain?.key}
        centerDisplayName={centerDisplayName}
        groups={visibleGroups}
        isMobileOpen={isMobileNavOpen}
        onClose={closeMobileNavigation}
        pathname={pathname}
      />

      <div className="min-h-screen md:pl-[var(--rail-w)] xl:pl-[var(--sidebar-w)] print:min-h-0 print:pl-0">
        <Topbar
          attendancePolicy={attendancePolicy}
          breadcrumb={breadcrumb}
          canCheckTimekeeping={canCheckTimekeeping}
          hasOpenTimekeepingEntry={hasOpenTimekeepingEntry}
          openTimekeepingEntryId={openTimekeepingEntryId}
          mobileMenuTriggerRef={mobileMenuTriggerRef}
          onMenuClick={() => setMobileNavPath(pathname)}
          unreadNotificationCount={unreadNotificationCount}
          user={authUser}
        />
        <ModuleNavigation domain={activeDomain} pathname={pathname} />

        <main className="mx-auto max-w-[1600px] px-4 py-4 md:px-5 md:py-5 lg:p-6 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
      <InstallAppPrompt />
    </div>
  );
}
