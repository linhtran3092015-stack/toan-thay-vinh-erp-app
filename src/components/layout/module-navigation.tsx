"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
  getActiveNavigationItem,
  type VisibleNavigationDomain,
} from "@/config/navigation";
import { cn } from "@/lib/utils";
import { NavigationLink } from "@/components/layout/navigation-link";

interface ModuleNavigationProps {
  domain?: VisibleNavigationDomain;
}

export function ModuleNavigation({ domain }: ModuleNavigationProps) {
  if (!domain || domain.items.length <= 1) {
    return null;
  }

  return <ModuleNavigationContent domain={domain} />;
}

function ModuleNavigationContent({ domain }: { domain: VisibleNavigationDomain }) {
  const pathname = usePathname();
  const navigationLabel = `Mô-đun trong ${domain.label}`;

  return (
    <>
      <div className="hidden border-b border-border-subtle bg-surface-base md:block">
        <DesktopModuleNavigation
          domain={domain}
          navigationLabel={navigationLabel}
          pathname={pathname}
        />
      </div>
      <div className="border-b border-border-subtle bg-surface-base px-4 py-2 md:hidden">
        <MobileModuleSelector
          key={pathname}
          domain={domain}
          navigationLabel={navigationLabel}
          pathname={pathname}
        />
      </div>
    </>
  );
}

interface NavigationContentProps {
  domain: VisibleNavigationDomain;
  navigationLabel: string;
  pathname: string;
}

function DesktopModuleNavigation({
  domain,
  navigationLabel,
  pathname,
}: NavigationContentProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const activeItem = getActiveNavigationItem(domain.items, pathname);

  const updateScrollControls = () => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) {
      return;
    }

    const maximumScroll = scrollArea.scrollWidth - scrollArea.clientWidth;
    setCanScrollBack(scrollArea.scrollLeft > 1);
    setCanScrollForward(maximumScroll - scrollArea.scrollLeft > 1);
  };

  useEffect(() => {
    updateScrollControls();
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) {
      return;
    }

    const observer = new ResizeObserver(updateScrollControls);
    observer.observe(scrollArea);
    scrollArea.addEventListener("scroll", updateScrollControls, { passive: true });

    return () => {
      observer.disconnect();
      scrollArea.removeEventListener("scroll", updateScrollControls);
    };
  }, [domain]);

  useEffect(() => {
    const activeLink = scrollAreaRef.current?.querySelector<HTMLAnchorElement>(
      '[aria-current="page"]',
    );
    activeLink?.scrollIntoView({ block: "nearest", inline: "nearest" });
    updateScrollControls();
  }, [pathname]);

  const scrollByPage = (direction: -1 | 1) => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollArea.scrollBy({
      behavior: reduceMotion ? "auto" : "smooth",
      left: direction * Math.max(180, scrollArea.clientWidth * 0.6),
    });
  };

  const hasOverflow = canScrollBack || canScrollForward;

  return (
    <nav
      aria-label={navigationLabel}
      className="mx-auto flex h-12 max-w-[1600px] items-center gap-2 px-5 lg:px-6"
    >
      {hasOverflow ? (
        <button
          aria-label={`Xem mô-đun trước trong ${domain.label}`}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-border-subtle bg-surface-base text-text-muted transition-colors hover:bg-interactive-hover disabled:cursor-not-allowed disabled:text-text-disabled focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
          disabled={!canScrollBack}
          onClick={() => scrollByPage(-1)}
          title={`Xem mô-đun trước trong ${domain.label}`}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
        </button>
      ) : null}

      <div
        className="scrollbar-none min-w-0 flex-1 overflow-x-auto"
        ref={scrollAreaRef}
      >
        <div className="flex min-w-max items-center gap-1 py-1">
          {domain.items.map((item) => {
            const isActive = item.href === activeItem?.href;

            return (
              <NavigationLink
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-md px-3 text-control font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring",
                  isActive
                    ? "bg-action-primary-soft text-action-primary"
                    : "text-text-muted hover:bg-interactive-hover hover:text-text-strong",
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </NavigationLink>
            );
          })}
        </div>
      </div>

      {hasOverflow ? (
        <button
          aria-label={`Xem mô-đun tiếp theo trong ${domain.label}`}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-border-subtle bg-surface-base text-text-muted transition-colors hover:bg-interactive-hover disabled:cursor-not-allowed disabled:text-text-disabled focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
          disabled={!canScrollForward}
          onClick={() => scrollByPage(1)}
          title={`Xem mô-đun tiếp theo trong ${domain.label}`}
          type="button"
        >
          <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} />
        </button>
      ) : null}
    </nav>
  );
}

function MobileModuleSelector({
  domain,
  navigationLabel,
  pathname,
}: NavigationContentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeItem = getActiveNavigationItem(domain.items, pathname);

  const close = (restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const firstLink = menuRef.current?.querySelector<HTMLAnchorElement>("a");
    firstLink?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab" || !menuRef.current) {
        return;
      }

      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  }, [isOpen]);

  return (
    <nav aria-label={navigationLabel} className="relative">
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Chuyển mô-đun trong ${domain.label}`}
        className="flex h-11 w-full items-center justify-between rounded-md border border-border-subtle bg-surface-base px-3 text-left text-control font-semibold text-text-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        type="button"
      >
        <span className="truncate">{activeItem?.label ?? domain.label}</span>
        <ChevronDown aria-hidden="true" className="ml-3 flex-none text-text-muted" size={18} strokeWidth={1.8} />
      </button>

      {isOpen ? (
        <div
          aria-label={`Chuyển mô-đun trong ${domain.label}`}
          className="absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-[min(360px,calc(100vh-180px))] overflow-y-auto rounded-lg border border-border-subtle bg-surface-raised p-2 shadow-[var(--elevation-2)]"
          id={menuId}
          ref={menuRef}
        >
          {domain.items.map((item) => {
            const isActive = item.href === activeItem?.href;

            return (
              <NavigationLink
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-3 text-control font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring",
                  isActive
                    ? "bg-action-primary-soft text-action-primary"
                    : "text-text-default hover:bg-interactive-hover",
                )}
                href={item.href}
                key={item.href}
                onClick={() => {
                  if (item.href === pathname) close(false);
                }}
              >
                {item.label}
              </NavigationLink>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}
