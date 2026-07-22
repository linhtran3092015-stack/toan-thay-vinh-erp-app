"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationSections } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions/mock-current-user";
import type { CurrentUser } from "@/types/domain";

interface SidebarProps {
  user: CurrentUser;
  isDesktopCollapsed: boolean;
  isMobileOpen: boolean;
  onClose: () => void;
  onToggleDesktopCollapse: () => void;
}

export function Sidebar({
  user,
  isDesktopCollapsed,
  isMobileOpen,
  onClose,
  onToggleDesktopCollapse,
}: SidebarProps) {
  const pathname = usePathname();

  const renderSidebar = (isCollapsed: boolean) => (
    <aside className="flex h-full flex-col overflow-hidden bg-primary text-white shadow-[8px_0_24px_rgba(36,52,139,0.12)]">
      <div className="flex h-[74px] items-center gap-3 px-4 lg:px-5">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white text-sm font-bold text-primary">
          TV
        </div>
        <div
          className={cn(
            "min-w-0",
            isCollapsed ? "hidden" : "md:hidden lg:block",
          )}
        >
          <div className="truncate text-sm font-bold tracking-wide">
            {user.organizationName}
          </div>
          <div className="mt-0.5 truncate text-xs text-white/[0.65]">
            Management System
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {navigationSections.map((section, sectionIndex) => {
          const items = section.items.filter((item) =>
            hasPermission(user, item.permission),
          );

          if (items.length === 0) {
            return null;
          }

          return (
            <div className="mb-2" key={section.label ?? sectionIndex}>
              {section.label ? (
                <div
                  className={cn(
                    "px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/[0.45]",
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
                        "group flex h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-white/[0.88] transition-colors hover:bg-white/10 hover:text-white",
                        isCollapsed
                          ? "justify-center px-2"
                          : "md:justify-center md:px-2 lg:justify-start lg:px-3",
                        isActive && "bg-white/[0.18] font-semibold text-white",
                      )}
                      href={item.href}
                      key={item.href}
                      onClick={onClose}
                    >
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-white md:h-9 md:w-9 lg:h-7 lg:w-7">
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
                            "rounded-pill bg-danger-bg px-2 py-1 text-xs font-bold text-danger",
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

      <div className="border-t border-white/10 p-3">
        <div
          className={cn(
            "mb-3 hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white/75 lg:flex",
            isCollapsed && "lg:hidden",
          )}
        >
          <span className="font-semibold text-white">2024</span>
          <span className="truncate">{user.academicYear}</span>
        </div>
        <button
          className="hidden h-9 w-full items-center justify-center rounded-lg text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white lg:flex"
          onClick={onToggleDesktopCollapse}
          type="button"
        >
          {isCollapsed ? "Mở" : "Thu gọn"}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden transition-[width] md:block",
          isDesktopCollapsed ? "w-[72px]" : "desktop-sidebar",
        )}
      >
        {renderSidebar(isDesktopCollapsed)}
      </div>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-ink/[0.35] transition-opacity md:hidden",
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {renderSidebar(false)}
      </div>
    </>
  );
}
