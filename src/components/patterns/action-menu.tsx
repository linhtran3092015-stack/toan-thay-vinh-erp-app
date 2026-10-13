"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

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

interface ActionMenuProps<T extends string> {
  items: readonly ActionMenuItem<T>[];
  label?: string;
  onSelect: (value: T, trigger: HTMLButtonElement) => void;
}

/**
 * Overflow "…" menu for consequential record actions (designs 03, 05): the page
 * keeps one primary button; secondary operations live here, each with its
 * availability reason written out. The feature decides which items exist.
 */
export function ActionMenu<T extends string>({
  items,
  label = "Thêm hành động",
  onSelect,
}: ActionMenuProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
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

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        iconOnly
        onClick={() => setIsOpen((open) => !open)}
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
          role="menu"
        >
          {items.map((item) => (
            <button
              aria-disabled={!item.enabled || undefined}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left text-body focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
                item.enabled
                  ? cn("hover:bg-interactive-hover", item.danger ? "text-danger" : "text-text-strong")
                  : "cursor-not-allowed text-text-disabled",
              )}
              key={item.value}
              onClick={(event) => {
                if (!item.enabled) {
                  return;
                }

                setIsOpen(false);
                onSelect(item.value, triggerRef.current ?? event.currentTarget);
              }}
              role="menuitem"
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
