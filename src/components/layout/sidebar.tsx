"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationSections } from "@/config/navigation";
import type { PermissionCode } from "@/lib/permissions/types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  academicYear: string;
  isDesktopCollapsed: boolean;
  isMobileOpen: boolean;
  onClose: () => void;
  onToggleDesktopCollapse: () => void;
  organizationName: string;
  permissions: readonly PermissionCode[];
}

export function Sidebar({
  academicYear,
  isDesktopCollapsed,
  isMobileOpen,
  onClose,
  onToggleDesktopCollapse,
  organizationName,
  permissions,
}: SidebarProps) {
  const pathname = usePathname();

  const renderSidebar = (isCollapsed: boolean) => (
    <aside className="flex h-full flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] shadow-[4px_0_24px_rgba(0,0,0,0.1)] transition-colors duration-200">
      <div className="flex h-[74px] items-center gap-3 border-b border-[var(--sidebar-border)] px-4 lg:px-5">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-white/20 to-white/5 text-sm font-bold text-white shadow-sm backdrop-blur-sm">
          TV
        </div>

        <div
          className={cn(
            "min-w-0",
            isCollapsed ? "hidden" : "md:hidden lg:block",
          )}
        >
          <div className="font-display text-sm font-bold tracking-wide text-white">
            {organizationName}
          </div>
          <div className="mt-0.5 truncate text-xs font-medium text-[var(--sidebar-muted)]">
            Management System
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigationSections.map((section, sectionIndex) => {
          const items = section.items.filter(
            (item) =>
              item.available &&
              (!item.permission || permissions.includes(item.permission)),
          );

          if (items.length === 0) {
            return null;
          }

          return (
            <div className="mb-4" key={section.label ?? sectionIndex}>
              {section.label ? (
                <div
                  className={cn(
                    "px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--sidebar-muted)]",
                    isCollapsed ? "hidden" : "md:hidden lg:block",
                  )}
                >
                  {section.label}
                </div>
              ) : null}

              <div className="space-y-1">
                {items.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      className={cn(
                        "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--sidebar-fg)]/80 transition-all hover:bg-[var(--sidebar-hover)] hover:text-white active:scale-[0.99]",
                        isCollapsed
                          ? "justify-center px-2"
                          : "md:justify-center md:px-2 lg:justify-start lg:px-3",
                        isActive &&
                          "bg-[var(--sidebar-active)] font-semibold text-white shadow-sm border-l-4 border-secondary pl-2.5",
                      )}
                      href={item.href}
                      key={item.href}
                      onClick={onClose}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 flex-none items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-white transition-transform group-hover:scale-105 md:h-9 md:w-9 lg:h-7 lg:w-7",
                          isActive && "bg-secondary text-white shadow-xs",
                        )}
                      >
                        {item.shortLabel}
                      </span>

                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          isCollapsed ? "hidden" : "md:hidden lg:block",
                        )}
                      >
                        {item.label}
                      </span>

                      {item.badge ? (
                        <span
                          className={cn(
                            "rounded-pill bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger border border-danger-border",
                            isCollapsed ? "hidden" : "md:hidden lg:block",
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--sidebar-border)] p-3">
        <div
          className={cn(
            "mb-3 hidden items-center gap-2 rounded-lg border border-[var(--sidebar-border)] bg-white/5 px-3 py-2 text-xs text-[var(--sidebar-muted)] lg:flex",
            isCollapsed && "lg:hidden",
          )}
        >
          <span className="font-semibold text-white">Năm học:</span>
          <span className="truncate font-medium">{academicYear}</span>
        </div>

        <button
          className="hidden h-9 w-full items-center justify-center rounded-lg border border-transparent text-xs font-semibold text-[var(--sidebar-muted)] transition-colors hover:border-[var(--sidebar-border)] hover:bg-[var(--sidebar-hover)] hover:text-white lg:flex active:scale-98"
          onClick={onToggleDesktopCollapse}
          type="button"
        >
          {isCollapsed ? "Mở rộng ➔" : "Thu gọn ↵"}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 md:block",
          isDesktopCollapsed ? "w-[72px]" : "desktop-sidebar",
        )}
      >
        {renderSidebar(isDesktopCollapsed)}
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity md:hidden",
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-200 ease-in-out md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {renderSidebar(false)}
      </div>
    </>
  );
}
