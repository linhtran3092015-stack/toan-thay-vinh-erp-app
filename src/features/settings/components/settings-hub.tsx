import type { ReactNode } from "react";

import { LeaveGuardProvider } from "./leave-guard";
import { SettingsToc } from "./settings-toc";
import { getSettingsTocGroups, SETTINGS_OVERVIEW_HREF, type SettingsTocAccess } from "./settings-toc-items";

/**
 * Settings hub frame (design 09a): page title, then the left table of
 * contents beside the section content (stacked below lg). No primary action
 * here: each section saves through its own StickySaveBar.
 */
export function SettingsHub({
  canViewAudit,
  canViewUsers,
  centerName,
  children,
  previewPathname,
}: SettingsTocAccess & {
  centerName: string;
  children: ReactNode;
  /** Dev previews only: route the table of contents should treat as current. */
  previewPathname?: string;
}) {
  // "Tổng quan" is the landing, not a section of its own.
  const sectionCount = getSettingsTocGroups({ canViewAudit, canViewUsers }).reduce(
    (total, group) => total + group.items.filter((item) => item.href !== SETTINGS_OVERVIEW_HREF).length,
    0,
  );

  return (
    <LeaveGuardProvider>
      <div className="grid min-w-0 gap-5">
        <header>
          <h1 className="text-page-title font-semibold tracking-[-.01em] text-text-strong">Cài đặt hệ thống</h1>
          <p className="mt-1 text-secondary text-text-muted">
            {centerName} · {sectionCount} mục cài đặt
          </p>
        </header>
        <div className="grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <SettingsToc canViewAudit={canViewAudit} canViewUsers={canViewUsers} pathname={previewPathname} />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </LeaveGuardProvider>
  );
}
