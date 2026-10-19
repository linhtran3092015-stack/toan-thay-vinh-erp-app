"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FormTocTone = "default" | "muted" | "danger" | "success";

export interface FormTocItem {
  /** Id of the `FormSection` this item points at; the link is `#{id}`. */
  id: string;
  label: string;
  /** Short state text on the right, e.g. "5/7", "1 lỗi", "tùy chọn". Feature-owned. */
  status?: string;
  /** Colour of the status text: danger (600) for errors, success when complete, muted otherwise. */
  tone?: FormTocTone;
}

const statusToneClassName: Record<FormTocTone, string> = {
  danger: "font-semibold text-danger",
  default: "text-text-muted",
  muted: "text-text-muted",
  success: "text-success",
};

/** How long a click on an item owns the active state while the page scrolls to its section. */
const CLICK_SPY_PAUSE_MS = 1000;
const FALLBACK_TOPBAR_HEIGHT = 64;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function topbarHeight(): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h"));
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_TOPBAR_HEIGHT;
}

/**
 * Long form with an in-page table of contents (design 17a): a 240px sticky
 * card beside the sections at lg+, a horizontally scrolling row of 44px
 * anchors above them below lg. Each item links to its `FormSection` (`#id`)
 * and may show a short status on the right ("5/7", "1 lỗi", "tùy chọn") in a
 * tone. Activating an item scrolls to the section (instantly with reduced
 * motion), puts its id in the URL hash and moves focus to the section
 * heading, so keyboard users continue from there. The item of the section at
 * the top of the viewport is marked `aria-current="location"` (scroll-spy;
 * without IntersectionObserver, e.g. jsdom, the first item). Presentation
 * only: the feature owns the sections, their order and every status.
 */
export function FormWithToc({
  children,
  className,
  items,
  label = "Mục trong form",
}: {
  children: ReactNode;
  className?: string;
  items: readonly FormTocItem[];
  label?: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  // While a click scrolls the page to its section, the clicked item stays active.
  const spyPaused = useRef(false);
  const spyPauseTimer = useRef<number | undefined>(undefined);
  const [spyId, setSpyId] = useState<string | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  // Section ids never contain whitespace, so a space-joined key is unambiguous.
  const idsKey = items.map((item) => item.id).join(" ");
  const activeId = spyId !== null && items.some((item) => item.id === spyId) ? spyId : (items[0]?.id ?? null);

  useEffect(() => {
    // jsdom (and very old browsers) have no IntersectionObserver: the first item stays active.
    if (typeof IntersectionObserver === "undefined" || !idsKey) return;
    const ids = idsKey.split(" ");
    const sections = ids.map((id) => document.getElementById(id)).filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) return;
    const visible = new Set<string>();
    // The band under the sticky topbar down to 45% of the viewport: the first section in it is "here".
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        if (spyPaused.current) return;
        const current = ids.find((id) => visible.has(id));
        if (current) setSpyId(current);
      },
      { rootMargin: `-${Math.round(topbarHeight() + 16)}px 0px -55% 0px`, threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [idsKey]);

  useEffect(() => {
    const nav = navRef.current;
    // Below lg only (the row scrolls sideways); jsdom has no layout. Scroll the row itself,
    // never the page: scrollIntoView would pull the window back up to an off-screen row.
    if (!nav || !activeId || nav.scrollWidth <= nav.clientWidth || typeof nav.scrollTo !== "function") return;
    const active = nav.querySelector<HTMLElement>('[aria-current="location"]');
    if (!active) return;
    const navBox = nav.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    if (box.left >= navBox.left && box.right <= navBox.right) return;
    nav.scrollTo({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      left: nav.scrollLeft + box.left - navBox.left - (navBox.width - box.width) / 2,
    });
  }, [activeId]);

  useEffect(() => () => window.clearTimeout(spyPauseTimer.current), []);

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

  function onItemClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    // New tab / window and other modified clicks keep the browser's own behaviour.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const section = document.getElementById(id);
    if (!section) return;
    event.preventDefault();
    spyPaused.current = true;
    window.clearTimeout(spyPauseTimer.current);
    spyPauseTimer.current = window.setTimeout(() => {
      spyPaused.current = false;
    }, CLICK_SPY_PAUSE_MS);
    setSpyId(id);
    if (typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    }
    const headingId = section.getAttribute("aria-labelledby");
    const heading = headingId ? document.getElementById(headingId) : null;
    (heading ?? section).focus({ preventScroll: true });
    // Next syncs a null-state replaceState with its router; replace, so in-form jumps add no history.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
  }

  return (
    <div className={cn("grid min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start", className)}>
      <div className="relative min-w-0 lg:sticky lg:top-[calc(var(--topbar-h)+24px)]">
        <nav
          aria-label={label}
          className="relative -mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5 lg:mx-0 lg:overflow-visible lg:rounded-lg lg:border lg:border-border-subtle lg:bg-surface-base lg:p-2 lg:shadow-[var(--panel-shadow)]"
          ref={navRef}
        >
          <ul className="m-0 flex min-w-max list-none gap-1 p-0 lg:min-w-0 lg:flex-col lg:gap-0.5">
            {items.map((item) => {
              const active = item.id === activeId;
              const tone = item.tone ?? "default";
              return (
                <li className="min-w-0" key={item.id}>
                  <a
                    aria-current={active ? "location" : undefined}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-3 whitespace-nowrap rounded-md px-3 text-body transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus lg:min-h-10 lg:px-2.5",
                      active
                        ? "bg-surface-selected font-semibold text-action-primary!"
                        : "text-text-default! hover:bg-interactive-hover hover:text-text-strong!",
                    )}
                    href={`#${item.id}`}
                    onClick={(event) => onItemClick(event, item.id)}
                  >
                    <span className="lg:min-w-0 lg:truncate">{item.label}</span>
                    {item.status ? (
                      <span
                        className={cn(
                          "shrink-0 text-caption tabular-nums",
                          // On the active item a neutral status takes the item's primary colour; danger and success keep theirs.
                          active && (tone === "default" || tone === "muted") ? "font-medium text-action-primary" : statusToneClassName[tone],
                        )}
                        data-tone={tone}
                      >
                        {/* Read as "Hồ sơ: 5/7"; the space sits outside the hidden colon so it survives name trimming. */}
                        <span className="sr-only">:</span> {item.status}
                      </span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        {canScrollRight ? (
          // Scroll cue below lg: the row continues past the right edge.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -right-4 w-8 bg-gradient-to-l from-surface-canvas to-transparent md:-right-5 lg:hidden"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </div>
  );
}

/**
 * One section of a long form (design 17a): a card with an 18/600 heading and
 * an optional 13px muted description over a hairline, then the body (the
 * feature lays out its own field grid). `id` is the anchor `FormWithToc`
 * links to; the section is labelled by its heading, and the heading takes
 * focus (tabIndex -1) when a table-of-contents item is activated. `scroll-mt`
 * keeps the heading below the sticky topbar after an anchor jump.
 */
export function FormSection({
  children,
  className,
  description,
  headerAction,
  id,
  title,
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  /** Optional control on the right of the header (e.g. a secondary "Kiểm tra hồ sơ trùng"). */
  headerAction?: ReactNode;
  id: string;
  title: string;
}) {
  const headingId = `${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 scroll-mt-[calc(var(--topbar-h)+16px)] rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]",
        className,
      )}
      id={id}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-row px-5 py-4 max-sm:px-4">
        <div className="min-w-0">
          <h2
            className="rounded-sm text-section-title font-semibold text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            id={headingId}
            tabIndex={-1}
          >
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-secondary text-text-muted">{description}</p> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <div className="p-5 max-sm:p-4">{children}</div>
    </section>
  );
}
