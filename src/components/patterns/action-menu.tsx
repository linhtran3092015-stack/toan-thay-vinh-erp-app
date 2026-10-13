"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActionMenuItem<T extends string = string> {
  danger?: boolean;
  enabled: boolean;
  label: string;
  /** Plain-language reason shown under a disabled item. */
  reason: string | null;
  value: T;
}

/** Elements that take focus themselves when pressed, so an outside press must not steal it back. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), label, summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

interface ActionMenuProps<T extends string> {
  items: readonly ActionMenuItem<T>[];
  label?: string;
  onSelect: (value: T, trigger: HTMLButtonElement) => void;
}

/**
 * Overflow "…" menu for consequential record actions (designs 03, 05): the page
 * keeps one primary button; secondary operations live here, each with its
 * availability reason written out. The feature decides which items exist.
 *
 * Keyboard follows the WAI-ARIA menu button pattern: opening focuses the first
 * enabled item, arrows/Home/End move focus (wrapping), Escape closes and returns
 * to the trigger, Tab closes and continues the page's tab order. Disabled items
 * stay focusable so their reason is read, but they do nothing when activated.
 */
export function ActionMenu<T extends string>({
  items,
  label = "Thêm hành động",
  onSelect,
}: ActionMenuProps<T>) {
  /** Index of the item focused when the menu opened; `null` while closed. */
  const [openFocus, setOpenFocus] = useState<number | null>(null);
  const isOpen = openFocus !== null;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const refocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = useId();

  useEffect(
    () => () => {
      if (refocusTimerRef.current) clearTimeout(refocusTimerRef.current);
    },
    [],
  );

  function close({ returnFocus }: { returnFocus: boolean }) {
    setOpenFocus(null);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (openFocus !== null) {
      itemRefs.current[openFocus]?.focus();
    }
  }, [openFocus]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const container = containerRef.current;

      if (!container || container.contains(event.target as Node)) {
        return;
      }

      // Closing unmounts the focused item. Unless the press lands on something that
      // takes focus itself, hand focus back to the trigger once the press settles,
      // so keyboard users do not restart from the top of the page.
      const focusWasInside = container.contains(document.activeElement);
      const pressedFocusable = event.target instanceof Element && event.target.closest(FOCUSABLE_SELECTOR) !== null;
      setOpenFocus(null);

      if (focusWasInside && !pressedFocusable) {
        if (refocusTimerRef.current) clearTimeout(refocusTimerRef.current);
        refocusTimerRef.current = setTimeout(() => {
          refocusTimerRef.current = null;
          const active = document.activeElement;
          if (!active || active === document.body) triggerRef.current?.focus();
        }, 0);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenFocus(null);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (items.length === 0) {
    return null;
  }

  function getOpenFocus(edge: "first" | "last"): number {
    const enabled = items.flatMap((item, index) => (item.enabled ? [index] : []));
    return edge === "last" ? (enabled.at(-1) ?? items.length - 1) : (enabled[0] ?? 0);
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpenFocus(getOpenFocus(event.key === "ArrowUp" ? "last" : "first"));
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const nodes = itemRefs.current.slice(0, items.length);
    const current = nodes.findIndex((node) => node === document.activeElement);
    const focusAt = (index: number) => nodes[(index + nodes.length) % nodes.length]?.focus();

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(current < 0 ? 0 : current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(current < 0 ? nodes.length - 1 : current - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(nodes.length - 1);
        break;
      case "Tab":
        // Hand focus back to the trigger first so the browser's Tab continues
        // from there instead of from a menu item that is about to unmount.
        close({ returnFocus: true });
        break;
      default:
        break;
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        iconOnly
        onClick={() => setOpenFocus(isOpen ? null : getOpenFocus("first"))}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
        variant="secondary"
      >
        <MoreHorizontal aria-hidden="true" size={18} strokeWidth={2} />
      </Button>

      {isOpen ? (
        <div
          aria-label={label}
          className="panel-rise absolute top-[calc(100%+8px)] max-md:left-0 md:right-0 z-40 w-72 rounded-lg border border-border-subtle bg-surface-raised p-1.5 shadow-[var(--elevation-2)]"
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          role="menu"
        >
          {items.map((item, index) => (
            <button
              aria-disabled={!item.enabled || undefined}
              className={cn(
                "flex min-h-11 w-full flex-col items-start justify-center gap-0.5 rounded-md px-2.5 py-2 text-left text-body md:min-h-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
                item.enabled
                  ? cn("hover:bg-interactive-hover", item.danger ? "text-danger" : "text-text-strong")
                  : "cursor-not-allowed text-text-disabled",
              )}
              key={item.value}
              onClick={(event) => {
                if (!item.enabled) {
                  return;
                }

                setOpenFocus(null);
                onSelect(item.value, triggerRef.current ?? event.currentTarget);
              }}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              role="menuitem"
              tabIndex={-1}
              type="button"
            >
              <span className="font-medium">{item.label}</span>
              {!item.enabled && item.reason ? (
                <span className="text-caption text-text-muted">{item.reason}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
