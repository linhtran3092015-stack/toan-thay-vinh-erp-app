"use client";

import Link from "next/link";
import { useId, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  /** Plain count shown in 12px muted text (e.g. 36 sessions). */
  count?: number;
  /** Pending-work count: 6px primary dot + number, announced as "n việc tồn". */
  pending?: number;
  /** Link tabs navigate; omit to drive panels through `onValueChange`. */
  href?: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange?: (value: string) => void;
  /** Accessible name of the tablist, e.g. "Mục trong hồ sơ học sinh". */
  label: string;
  /** Shared id prefix so `TabPanel` can reference its tab. Defaults to a generated id. */
  id?: string;
  className?: string;
}

export function tabId(tabsId: string, value: string): string {
  return `${tabsId}-${value}-tab`;
}

export function tabPanelId(tabsId: string, value: string): string {
  return `${tabsId}-${value}-panel`;
}

const tabClassName =
  "flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-control font-medium text-text-default hover:text-text-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus disabled:text-text-disabled";
const activeTabClassName =
  "font-semibold text-action-primary shadow-[inset_0_-2px_0_var(--action-primary)] hover:text-action-primary";

/**
 * Page-level tabs: 40px row, 1px bottom rule, active = 2px inset underline in
 * the primary color. Scrolls horizontally on narrow screens. The component
 * never decides which tabs exist or whether they may be opened.
 */
export function Tabs({
  items,
  value,
  onValueChange,
  label,
  id,
  className,
}: TabsProps) {
  const generatedId = useId();
  const tabsId = id ?? generatedId;

  function moveFocus(event: KeyboardEvent<HTMLElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    const enabled = items
      .map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ item }) => !item.disabled);

    if (enabled.length === 0) {
      return;
    }

    event.preventDefault();
    const position = enabled.findIndex(({ itemIndex }) => itemIndex === index);
    const nextPosition =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? enabled.length - 1
          : (position + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) %
            enabled.length;
    const next = enabled[nextPosition].item;

    document.getElementById(tabId(tabsId, next.value))?.focus();

    if (!next.href) {
      onValueChange?.(next.value);
    }
  }

  return (
    <div
      aria-label={label}
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-border-subtle",
        className,
      )}
      role="tablist"
    >
      {items.map((item, index) => {
        const isActive = item.value === value;
        const content = (
          <>
            {item.label}
            {item.count !== undefined ? (
              <>
                {" "}
                <span className="text-caption font-normal tabular-nums text-text-muted">
                  {item.count}
                </span>
              </>
            ) : null}
            {item.pending !== undefined ? (
              <>
                {" "}
                <span className="inline-flex items-center gap-1 text-caption font-semibold tabular-nums text-action-primary">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-action-primary"
                  />
                  {item.pending}{" "}
                  <span className="sr-only">việc tồn</span>
                </span>
              </>
            ) : null}
          </>
        );
        const shared = {
          "aria-selected": isActive,
          className: cn(tabClassName, isActive && activeTabClassName),
          id: tabId(tabsId, item.value),
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => moveFocus(event, index),
          role: "tab" as const,
          tabIndex: isActive ? 0 : -1,
        };

        if (item.href) {
          return (
            <Link
              key={item.value}
              {...shared}
              aria-current={isActive ? "page" : undefined}
              aria-disabled={item.disabled || undefined}
              href={item.href}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={item.value}
            {...shared}
            aria-controls={tabPanelId(tabsId, item.value)}
            disabled={item.disabled}
            onClick={() => onValueChange?.(item.value)}
            type="button"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  tabsId: string;
  value: string;
  activeValue: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({
  tabsId,
  value,
  activeValue,
  children,
  className,
}: TabPanelProps) {
  return (
    <div
      aria-labelledby={tabId(tabsId, value)}
      className={className}
      hidden={value !== activeValue}
      id={tabPanelId(tabsId, value)}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
