"use client";

import { BrandLogo } from "@/features/website/appearance";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import {
  getActiveNavigationItem,
  type VisibleNavigationDomain,
  type VisibleNavigationGroup,
} from "@/config/navigation";
import { NavigationLink } from "@/components/layout/navigation-link";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeDomainKey?: string;
  centerDisplayName: string;
  groups: readonly VisibleNavigationGroup[];
  isMobileOpen: boolean;
  onClose: (restoreFocus?: boolean) => void;
  /** Defaults to the current route; the shell passes its own (preview-aware) value. */
  pathname?: string;
}

const focusableSelector =
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** 28px brand mark (three bars on the accent) used when the center has no logo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-7 w-7 flex-none place-items-center rounded-md bg-action-primary",
        className,
      )}
    >
      <span className="h-0.5 w-3 bg-white shadow-[0_-4px_0_#fff,0_4px_0_#fff]" />
    </span>
  );
}

export function Sidebar({
  activeDomainKey,
  centerDisplayName,
  groups,
  isMobileOpen,
  onClose,
  pathname: pathnameOverride,
}: SidebarProps) {
  const routePathname = usePathname();
  const pathname = pathnameOverride ?? routePathname;
  const mobilePanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isMobileOpen || !mobilePanelRef.current) {
      return;
    }

    const panel = mobilePanelRef.current;
    panel.querySelector<HTMLElement>(focusableSelector)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
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
      {/* Tablet rail (72px) grows into the 240px sidebar from xl. */}
      <aside className="fixed inset-y-0 left-[var(--safe-area-left)] z-40 hidden w-[var(--rail-w)] border-r border-[var(--nav-sidebar-border)] bg-[var(--nav-sidebar-bg)] pb-[var(--safe-area-bottom)] pt-[var(--safe-area-top)] text-[var(--nav-sidebar-fg)] md:block xl:w-[var(--sidebar-w)] print:hidden">
        <SidebarContents
          activeDomainKey={activeDomainKey}
          centerDisplayName={centerDisplayName}
          groups={groups}
          pathname={pathname}
          variant="desktop"
        />
      </aside>

      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-50 bg-[var(--overlay-scrim)] transition-opacity duration-150 md:hidden print:hidden",
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
          className="fixed inset-y-0 left-0 z-50 w-[min(320px,calc(100vw-32px))] bg-[var(--nav-sidebar-bg)] pb-[var(--safe-area-bottom)] pl-[var(--safe-area-left)] pt-[var(--safe-area-top)] text-[var(--nav-sidebar-fg)] shadow-[var(--elevation-2)] md:hidden print:hidden"
          ref={mobilePanelRef}
          role="dialog"
        >
          <SidebarContents
            activeDomainKey={activeDomainKey}
            centerDisplayName={centerDisplayName}
            groups={groups}
            onClose={() => onClose()}
            onNavigate={(href) => {
              // Keep the clicked link mounted until Next commits the navigation.
              if (href === pathname) onClose(false);
            }}
            pathname={pathname}
            variant="drawer"
          />
        </aside>
      ) : null}
    </>
  );
}

interface SidebarContentsProps {
  activeDomainKey?: string;
  centerDisplayName: string;
  groups: readonly VisibleNavigationGroup[];
  onClose?: () => void;
  onNavigate?: (href: string) => void;
  pathname: string;
  variant: "desktop" | "drawer";
}

function SidebarContents({
  activeDomainKey,
  centerDisplayName,
  groups,
  onClose,
  onNavigate,
  pathname,
  variant,
}: SidebarContentsProps) {
  const isDrawer = variant === "drawer";
  const mainGroups = groups.filter((group) => group.placement === "main");
  const footerGroups = groups.filter((group) => group.placement === "footer");

  const renderDomain = (domain: VisibleNavigationDomain) => {
    const target = domain.items[0];
    const isActive = domain.key === activeDomainKey;
    const DomainIcon = domain.icon;
    const activeItem = isActive ? getActiveNavigationItem(domain.items, pathname) : undefined;

    return (
      <li key={domain.key}>
        <DomainLink
          domainLabel={domain.label}
          href={target.href}
          icon={<DomainIcon aria-hidden="true" size={20} strokeWidth={1.8} />}
          isActive={isActive}
          isDrawer={isDrawer}
          onNavigate={() => onNavigate?.(target.href)}
        />
        {/* Drawer: the active domain lists its modules right under the domain. */}
        {isDrawer && isActive && domain.items.length > 1 ? (
          <ul className="mb-1 mt-0.5 flex flex-col gap-0.5 pl-9">
            {domain.items.map((item) => {
              const isItemActive = item.href === activeItem?.href;

              return (
                <li key={item.href}>
                  <NavigationLink
                    aria-current={isItemActive ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center rounded-md px-2 text-control font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
                      isItemActive
                        ? "bg-[var(--nav-sidebar-active-bg)] font-semibold text-[var(--nav-sidebar-active-fg)]"
                        : "text-text-default hover:bg-[var(--nav-sidebar-hover)] hover:text-text-strong",
                    )}
                    href={item.href}
                    onClick={() => onNavigate?.(item.href)}
                  >
                    {item.label}
                  </NavigationLink>
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className={cn(
          "flex h-16 flex-none items-center gap-2.5 border-b border-[var(--nav-sidebar-border)] px-4",
          !isDrawer && "max-xl:justify-center max-xl:px-0",
        )}
      >
        <BrandLogo fallback={<BrandMark />} />
        <p
          className={cn(
            "min-w-0 truncate text-[15px] font-bold leading-5 text-text-strong",
            !isDrawer && "max-xl:hidden",
          )}
        >
          {centerDisplayName}
        </p>
        {isDrawer ? (
          <button
            aria-label="Đóng điều hướng chính"
            className="ml-auto flex h-10 w-10 flex-none items-center justify-center rounded-md text-text-default hover:bg-[var(--nav-sidebar-hover)] hover:text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            onClick={onClose}
            title="Đóng điều hướng chính"
            type="button"
          >
            <X aria-hidden="true" size={20} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      <nav
        aria-label="Điều hướng chính"
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          !isDrawer && "max-xl:items-center",
        )}
      >
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2",
            !isDrawer && "max-xl:w-full max-xl:px-3",
          )}
        >
          {mainGroups.map((group, index) => (
            <div key={group.key}>
              {index > 0 && !isDrawer ? (
                <div aria-hidden="true" className="mx-auto my-1.5 h-px w-8 bg-border-subtle xl:hidden" />
              ) : null}
              {group.label ? (
                <p
                  className={cn(
                    "px-2.5 pb-1 pt-2.5 text-caption font-semibold tracking-[0.02em] text-text-subtle",
                    !isDrawer && "max-xl:hidden",
                  )}
                >
                  {group.label}
                </p>
              ) : null}
              <ul className="flex flex-col gap-0.5">{group.domains.map(renderDomain)}</ul>
            </div>
          ))}
        </div>

        {footerGroups.length > 0 ? (
          <div
            className={cn(
              "flex-none border-t border-[var(--nav-sidebar-border)] px-2 py-3",
              !isDrawer && "max-xl:w-full max-xl:px-3 max-xl:py-2",
            )}
          >
            {footerGroups.map((group) => (
              <ul className="flex flex-col gap-0.5" key={group.key}>
                {group.domains.map(renderDomain)}
              </ul>
            ))}
          </div>
        ) : null}
      </nav>
    </div>
  );
}

interface DomainLinkProps {
  domainLabel: string;
  href: string;
  icon: ReactNode;
  isActive: boolean;
  isDrawer: boolean;
  onNavigate?: () => void;
}

function DomainLink({
  domainLabel,
  href,
  icon,
  isActive,
  isDrawer,
  onNavigate,
}: DomainLinkProps) {
  const tooltipId = useId();

  return (
    <NavigationLink
      aria-current={isActive ? "page" : undefined}
      aria-describedby={!isDrawer ? tooltipId : undefined}
      aria-label={domainLabel}
      className={cn(
        "group relative flex h-11 items-center gap-2 rounded-md px-2 text-control font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
        !isDrawer && "max-xl:w-12 max-xl:justify-center max-xl:px-0",
        isActive
          ? "bg-[var(--nav-sidebar-active-bg)] font-semibold text-[var(--nav-sidebar-active-fg)] shadow-[inset_3px_0_0_var(--nav-sidebar-indicator)]"
          : "text-text-default hover:bg-[var(--nav-sidebar-hover)] hover:text-text-strong",
      )}
      href={href}
      onClick={onNavigate}
    >
      <span className="flex h-5 w-5 flex-none items-center justify-center">{icon}</span>
      <span className={cn("min-w-0 truncate", !isDrawer && "max-xl:hidden")}>
        {domainLabel}
      </span>
      {!isDrawer ? (
        <span
          className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-sm bg-[var(--toast-bg)] px-2 py-1 text-caption font-medium text-white shadow-[var(--elevation-2)] group-hover:block group-focus-visible:block xl:hidden"
          id={tooltipId}
          role="tooltip"
        >
          {domainLabel}
        </span>
      ) : null}
    </NavigationLink>
  );
}
