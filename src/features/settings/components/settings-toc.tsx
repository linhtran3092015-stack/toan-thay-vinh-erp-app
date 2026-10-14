"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { useGuardedNavigation } from "./leave-guard";
import { getSettingsTocGroups, type SettingsTocAccess } from "./settings-toc-items";

function isActive(pathname: string, href: string, exact = false): boolean {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

/**
 * Left table of contents of the settings hub: a 240px card at lg+, a
 * horizontally scrolling row of 44px links above the content below lg (the
 * current link is scrolled into view and, while the row can still scroll
 * right, a fade on the right edge hints at more). While a form on the page has
 * unsaved changes, following a link asks first (the dialog lives in the
 * LeaveGuardProvider).
 */
export function SettingsToc({
  canViewAudit,
  canViewUsers,
  pathname: pathnameOverride,
}: SettingsTocAccess & {
  /** Dev previews only: pretend the hub is on this route. */
  pathname?: string;
}) {
  const routePathname = usePathname();
  const pathname = pathnameOverride ?? routePathname ?? "";
  const { onLinkClick } = useGuardedNavigation();
  const navRef = useRef<HTMLElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const groups = getSettingsTocGroups({ canViewAudit, canViewUsers });

  useEffect(() => {
    const nav = navRef.current;
    // Only the horizontal scroller (below lg) needs it; jsdom has no layout or scrollIntoView.
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (typeof active?.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [pathname]);

  useEffect(() => {
    const nav = navRef.current;
    // jsdom has no ResizeObserver or layout: no fade there.
    if (!nav || typeof ResizeObserver === "undefined") return;
    const update = () => setCanScrollRight(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
    // The observer reports the first size right after observe(), then every change.
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    nav.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      nav.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div className="relative min-w-0 lg:sticky lg:top-[calc(var(--topbar-h)+24px)]">
      <nav
        aria-label="Mục cài đặt"
        className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5 lg:mx-0 lg:overflow-visible lg:rounded-lg lg:border lg:border-border-subtle lg:bg-surface-base lg:p-2 lg:shadow-[var(--panel-shadow)]"
        ref={navRef}
      >
        <div className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col lg:gap-0.5">
          {groups.map((group, groupIndex) => (
            <div className="contents lg:block" key={group.label} role="group" aria-label={group.label}>
              <p
                aria-hidden="true"
                className={cn(
                  "hidden px-2.5 pb-1 text-caption font-semibold uppercase tracking-[.02em] text-text-subtle lg:block",
                  groupIndex === 0 ? "pt-2" : "pt-3",
                )}
              >
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-body transition-colors duration-150 lg:min-h-10 lg:px-2.5",
                      active
                        ? "bg-action-primary-soft font-semibold text-action-primary!"
                        : "text-text-default! hover:bg-interactive-hover hover:text-text-strong!",
                    )}
                    href={item.href}
                    key={item.href}
                    onClick={(event) => onLinkClick(event, item.href)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </nav>
      {canScrollRight ? (
        // Scroll cue below lg: the row continues past the right edge.
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -right-4 w-8 bg-gradient-to-l from-surface-canvas to-transparent md:-right-5 lg:hidden"
        />
      ) : null}
    </div>
  );
}
