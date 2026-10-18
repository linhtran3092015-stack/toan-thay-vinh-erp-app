"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { TableCell, TableRow } from "@/components/patterns/data-table-frame";
import { Button } from "@/components/ui/button";
import { getAuditDataToggleContext } from "@/features/audit/audit-log-models";
import type { AuditLogEntry } from "@/features/audit/read-models";
import { cn } from "@/lib/utils";

import {
  AUDIT_TABLE_COLUMN_COUNT,
  AuditActionName,
  AuditActorIdentity,
  AuditDataPanels,
  AuditEntity,
  AuditModuleName,
  AuditTimestamp,
} from "./audit-log-cells";

/** Two-line cells: top-aligned with room above and below (the 14c ledger rhythm). */
const CELL = "py-2! align-top!";

/**
 * The table body: one row per entry and, under it, a full-width detail row the
 * "Xem" / "Ẩn" button toggles. Collapsed by default; the JSON is only rendered
 * once a row is opened (the detail row stays in the DOM, `hidden`, so
 * `aria-controls` always points at an element).
 */
export function AuditLogTableRows({ entries }: { entries: readonly AuditLogEntry[] }) {
  return entries.map((entry) => <AuditLogTableRow entry={entry} key={entry.id} />);
}

function AuditLogTableRow({ entry }: { entry: AuditLogEntry }) {
  const [isOpen, setIsOpen] = useState(false);
  const detailId = useId();

  return (
    <>
      <TableRow tall>
        <TableCell className={CELL}>
          <AuditTimestamp occurredAt={entry.occurredAt} />
        </TableCell>
        <TableCell className={CELL}>
          <AuditActorIdentity entry={entry} />
        </TableCell>
        <TableCell className={CELL}>
          <AuditModuleName module={entry.module} />
        </TableCell>
        <TableCell className={CELL}>
          <AuditActionName action={entry.action} />
        </TableCell>
        <TableCell className={CELL}>
          <AuditEntity entry={entry} />
        </TableCell>
        <TableCell className={cn(CELL, "text-secondary text-text-default")}>
          {entry.reason ? (
            <span className="line-clamp-2 break-words" title={entry.reason}>
              {entry.reason}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </TableCell>
        <TableCell className={CELL}>
          <Button
            aria-controls={detailId}
            aria-expanded={isOpen}
            // The visible word first, so the name contains the label sighted users see.
            aria-label={`${isOpen ? "Ẩn" : "Xem"} ${getAuditDataToggleContext(entry)}`}
            className="-ml-3"
            onClick={() => setIsOpen((open) => !open)}
            size="sm"
            variant="ghost"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn("h-4 w-4 motion-safe:transition-transform", isOpen && "rotate-180")}
            />
            {isOpen ? "Ẩn" : "Xem"}
          </Button>
        </TableCell>
      </TableRow>
      <tr hidden={!isOpen} id={detailId}>
        <td className="bg-surface-sunken px-4 py-3" colSpan={AUDIT_TABLE_COLUMN_COUNT}>
          {isOpen ? <AuditDataPanels entry={entry} /> : null}
        </td>
      </tr>
    </>
  );
}
