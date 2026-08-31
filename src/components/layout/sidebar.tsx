"use client";

import { School, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import type { VisibleNavigationDomain } from "@/config/navigation";
import { NavigationLink } from "@/components/layout/navigation-link";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeDomainKey?: string;
  centerDisplayName: string;
  domains: readonly VisibleNavigationDomain[];
  isMobileOpen: boolean;
  onClose: (restoreFocus?: boolean) => void;
}

export function Sidebar({
  activeDomainKey,
  centerDisplayName,
  domains,
  isMobileOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const mobilePanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isMobileOpen || !mobilePanelRef.current) {
      return;
    }

    const panel = mobilePanelRef.current;
    const firstFocusable = panel.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onClose]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] border-r border-[var(--nav-sidebar-border)] bg-[var(--nav-sidebar-bg)] text-[var(--nav-sidebar-fg)] md:block xl:w-[var(--sidebar-width)]">
        <SidebarContents
          activeDomainKey={activeDomainKey}
          centerDisplayName={centerDisplayName}
          domains={domains}
          isMobile={false}
        />
      </aside>

      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-50 bg-[var(--overlay-scrim)] transition-opacity duration-150 md:hidden",
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={() => onClose()}
      />

      {isMobileOpen ? (
        <aside
          aria-label="Điều hướng chính"
          aria-modal="true"
          className="fixed inset-y-0 left-0 z-50 w-[min(320px,calc(100vw-32px))] bg-[var(--nav-sidebar-bg)] text-[var(--nav-sidebar-fg)] shadow-[var(--elevation-2)] md:hidden"
          ref={mobilePanelRef}
          role="dialog"
        >
          <SidebarContents
            activeDomainKey={activeDomainKey}
            centerDisplayName={centerDisplayName}
            domains={domains}
            isMobile
            onClose={() => onClose()}
            onNavigate={(href) => {
              // Keep the clicked link mounted until Next commits the navigation.
              if (href === pathname) onClose(false);
            }}
          />
        </aside>
      ) : null}
    </>
  );
}

interface SidebarContentsProps {
  activeDomainKey?: string;
  centerDisplayName: string;
  domains: readonly VisibleNavigationDomain[];
  isMobile: boolean;
  onClose?: () => void;
  onNavigate?: (href: string) => void;
}

function SidebarContents({
  activeDomainKey,
  centerDisplayName,
  domains,
  isMobile,
  onClose,
  onNavigate,
}: SidebarContentsProps) {
  const navigationLabel = "Điều hướng chính";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-16 items-center border-b border-[var(--nav-sidebar-border)] px-3 xl:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <School aria-hidden="true" className="h-5 w-5 flex-none" strokeWidth={1.8} />
          <div className={cn("min-w-0", !isMobile && "hidden xl:block")}>
            <p className="truncate text-sm font-semibold tracking-[0.01em]">{centerDisplayName}</p>
            <p className="mt-0.5 text-caption text-[var(--nav-sidebar-muted)]">ERP vận hành</p>
          </div>
        </div>
        {isMobile ? (
          <button
            aria-label="Đóng điều hướng chính"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-md text-[var(--nav-sidebar-fg)] transition-colors hover:bg-[var(--nav-sidebar-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            onClick={onClose}
            title="Đóng điều hướng chính"
            type="button"
          >
            <X aria-hidden="true" size={20} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      <nav aria-label={navigationLabel} className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {domains.map((domain) => {
            const target = domain.items[0];
            const isActive = domain.key === activeDomainKey;
            const DomainIcon = domain.icon;

            return (
              <DomainLink
                domainLabel={domain.label}
                href={target.href}
                icon={<DomainIcon aria-hidden="true" size={20} strokeWidth={1.8} />}
                isActive={isActive}
                isMobile={isMobile}
                key={domain.key}
                onNavigate={() => onNavigate?.(target.href)}
              />
            );
          })}
        </div>

      </nav>
    </div>
  );
}

interface DomainLinkProps {
  domainLabel: string;
  href: string;
  icon: ReactNode;
  isActive: boolean;
  isMobile: boolean;
  onNavigate?: () => void;
}

function DomainLink({
  domainLabel,
  href,
  icon,
  isActive,
  isMobile,
  onNavigate,
}: DomainLinkProps) {
  const tooltipId = useId();

  return (
    <NavigationLink
      aria-current={isActive ? "page" : undefined}
      aria-describedby={!isMobile ? tooltipId : undefined}
      aria-label={domainLabel}
      className={cn(
        "group relative flex h-11 items-center rounded-md text-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
        isMobile ? "gap-3 px-3" : "justify-center px-2 xl:justify-start xl:gap-3 xl:px-3",
        isActive
          ? "bg-[var(--nav-sidebar-active)] text-[var(--nav-sidebar-fg)] before:absolute before:left-0 before:h-6 before:w-[3px] before:rounded-r before:bg-[var(--nav-sidebar-active-indicator)]"
          : "text-[var(--nav-sidebar-muted)] hover:bg-[var(--nav-sidebar-hover)] hover:text-[var(--nav-sidebar-fg)]",
      )}
      href={href}
      onClick={onNavigate}
    >
      <span className="flex h-5 w-5 flex-none items-center justify-center">{icon}</span>
      <span className={cn("min-w-0 truncate", !isMobile && "hidden xl:block")}>
        {domainLabel}
      </span>
      {!isMobile ? (
        <span
          className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-border-subtle bg-surface-raised px-2 py-1 text-caption font-medium text-text-strong shadow-[var(--elevation-2)] group-hover:block group-focus-visible:block xl:hidden"
          id={tooltipId}
          role="tooltip"
        >
          {domainLabel}
        </span>
      ) : null}
    </NavigationLink>
  );
}
