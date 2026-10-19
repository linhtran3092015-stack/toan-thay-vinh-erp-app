"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useState } from "react";

import { getAuditEntryContext } from "@/features/audit/audit-log-models";
import type { AuditLogEntry } from "@/features/audit/read-models";
import { cn } from "@/lib/utils";

import { AuditDataPanels } from "./audit-log-cells";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

/**
 * A card's native `<details>` "Xem dữ liệu trước / sau". The panels render
 * only once it is opened (`onToggle`), so a collapsed card carries no JSON in
 * the server HTML: the before/after rows (whole student/guardian records) reach
 * the client once, as the `entry` props the table rows share. Opened before
 * hydration, the panels appear as soon as the island mounts.
 */
export function AuditRecordDataDisclosure({ entry }: { entry: AuditLogEntry }) {
  const [isOpen, setIsOpen] = useState(false);
  // Stable, so it runs on mount only: picks up a card opened before hydration.
  const syncOpenOnMount = useCallback((node: HTMLDetailsElement | null) => {
    if (node?.open) setIsOpen(true);
  }, []);

  return (
    <details
      className="group/data mt-2 border-t border-border-row pt-1"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      ref={syncOpenOnMount}
    >
      <summary
        className={cn(
          "inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-sm text-secondary font-semibold text-action-link! [&::-webkit-details-marker]:hidden",
          FOCUS,
        )}
      >
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 motion-safe:transition-transform group-open/data:rotate-180"
        />
        Xem dữ liệu trước / sau{" "}
        <span className="sr-only">{getAuditEntryContext(entry)}</span>
      </summary>
      <div className="pb-2 pt-1">{isOpen ? <AuditDataPanels entry={entry} /> : null}</div>
    </details>
  );
}
