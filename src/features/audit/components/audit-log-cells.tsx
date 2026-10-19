import type { ReactNode } from "react";

import { TableHeaderCell } from "@/components/patterns/data-table-frame";
import {
  AUDIT_ENTITY_ID_FALLBACK,
  formatAuditEntityType,
  formatAuditTimestamp,
  getAuditActorPresentation,
  hasAuditMetadata,
  humanizeCode,
  stringifyAuditJson,
} from "@/features/audit/audit-log-models";
import type { AuditLogEntry } from "@/features/audit/read-models";
import { formatModuleLabel } from "@/lib/module-labels";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database.generated";

/*
 * Header and cell content shared by the table rows (a client component, for the
 * "Xem / Ẩn" disclosure), the page (server) and the cards (server). No hooks
 * here, so every tree can use it.
 *
 * Columns: Thời điểm 150 · Người thực hiện 170 · Module 130 · Hành động 170 ·
 * Đối tượng 170 · Trước / Sau 110 are fixed; Lý do takes the rest (140px at the
 * 1040px floor, which + the frame's 2px border is the page's 1042px switch).
 */
export const AUDIT_TABLE_COLUMN_COUNT = 7;
export const AUDIT_TABLE_CLASS = "min-w-[1040px] table-fixed";
/**
 * The empty frame keeps the table geometry and its header row only where the
 * table itself would show; below that it is a plain framed message (no 1040px
 * strip of cut-off headers on a phone) and the state slot's top rule goes too.
 */
export const AUDIT_EMPTY_TABLE_CLASS = "@min-[1042px]:min-w-[1040px] @min-[1042px]:table-fixed";
export const AUDIT_EMPTY_HEADER_ROW_CLASS = "hidden @min-[1042px]:table-row";
export const AUDIT_EMPTY_FRAME_CLASS = "@max-[1042px]:[&>div]:border-t-0";

/*
 * Table/cards switch on the page's own container (`@container` on the root, no
 * globals.css hook): the table from 1042px = the 1040px floor + the frame's 2px
 * border, the cards below it. The filter bar goes 1 → 2 → 4 tracks on the same
 * container. Shared by the page and its loading skeleton; full literals so the
 * Tailwind scanner sees them.
 */
export const AUDIT_TABLE_SWITCH_CLASS = "hidden @min-[1042px]:block";
export const AUDIT_CARDS_SWITCH_CLASS = "@min-[1042px]:hidden";
export const AUDIT_FILTER_TRACKS_CLASS = "grid-cols-1 @min-[560px]:grid-cols-2 @min-[880px]:grid-cols-4";

export function AuditLogTableHeader({ className }: { className?: string }) {
  return (
    <tr className={className}>
      <TableHeaderCell className="w-[150px]">Thời điểm</TableHeaderCell>
      <TableHeaderCell className="w-[170px]">Người thực hiện</TableHeaderCell>
      <TableHeaderCell className="w-[130px]">Module</TableHeaderCell>
      <TableHeaderCell className="w-[170px]">Hành động</TableHeaderCell>
      <TableHeaderCell className="w-[170px]">Đối tượng</TableHeaderCell>
      <TableHeaderCell>Lý do</TableHeaderCell>
      <TableHeaderCell className="w-[110px]">Trước / Sau</TableHeaderCell>
    </tr>
  );
}

/** Date line + time line (seconds), Vietnam time; the full value stays in the `title`. */
export function AuditTimestamp({ className, occurredAt }: { className?: string; occurredAt: string }) {
  const timestamp = formatAuditTimestamp(occurredAt);

  return (
    <time className={cn("block tabular-nums", className)} dateTime={occurredAt} title={timestamp.full}>
      <span className="block font-medium text-text-strong">{timestamp.date}</span>
      {timestamp.time ? <span className="block text-caption text-text-muted">{timestamp.time}</span> : null}
    </time>
  );
}

export function AuditActorIdentity({ entry }: { entry: AuditLogEntry }) {
  const actor = getAuditActorPresentation(entry);

  return (
    <div className="min-w-0">
      <p className="break-words font-semibold text-text-strong">{actor.name}</p>
      {/* One line: an e-mail or uuid broken mid-word reads as two values; the full text stays in the title. */}
      <p className={cn("truncate text-caption text-text-muted", actor.detailIsCode && "font-mono")} title={actor.detail}>
        {actor.detail}
      </p>
      {actor.automaticCaption ? <p className="text-caption text-text-muted">{actor.automaticCaption}</p> : null}
    </div>
  );
}

export function AuditModuleName({ module }: { module: string }) {
  return (
    <span className="break-words text-text-default" title={module}>
      {formatModuleLabel(module)}
    </span>
  );
}

/**
 * Humanised action + the raw code in mono (actions have no Vietnamese
 * vocabulary yet), the code cut to one line with the full code in `title`.
 * `card` makes the first line the card's title.
 */
export function AuditActionName({ action, variant = "cell" }: { action: string; variant?: "card" | "cell" }) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "break-words text-text-strong",
          variant === "card" ? "text-body font-semibold" : "font-medium",
        )}
      >
        {humanizeCode(action)}
      </p>
      <p className="truncate font-mono text-caption text-text-muted" title={action}>
        {action}
      </p>
    </div>
  );
}

/** Humanised entity type + the id in mono, cut to one line with the full id in `title`. */
export function AuditEntity({ entry }: { entry: AuditLogEntry }) {
  const id = entry.entityId ?? AUDIT_ENTITY_ID_FALLBACK;

  return (
    <div className="min-w-0">
      <p className="break-words text-text-default">{formatAuditEntityType(entry.entityType)}</p>
      <p
        className={cn("truncate text-caption text-text-muted", entry.entityId !== null && "font-mono")}
        title={id}
      >
        {id}
      </p>
    </div>
  );
}

/**
 * "Dữ liệu trước" | "Dữ liệu sau" (side by side from 720px of the panel's own
 * width), then "Metadata" (when not an empty object) and "Request ID". The JSON
 * is printed verbatim: rows can hold whole student/guardian records, so it is
 * only ever rendered behind an explicit expand and never summarised.
 */
export function AuditDataPanels({ entry }: { entry: AuditLogEntry }) {
  return (
    <div className="@container min-w-0">
      <div className="grid min-w-0 gap-3">
        <div className="grid min-w-0 gap-3 @min-[720px]:grid-cols-2">
          <JsonPanel label="Dữ liệu trước" value={entry.oldData} />
          <JsonPanel label="Dữ liệu sau" value={entry.newData} />
        </div>
        {hasAuditMetadata(entry.metadata) ? <JsonPanel label="Metadata" value={entry.metadata} /> : null}
        {entry.requestId ? (
          <PanelBlock label="Request ID">
            <code className="block break-all rounded-md border border-border-subtle bg-surface-base px-3 py-2 font-mono text-caption text-text-default">
              {entry.requestId}
            </code>
          </PanelBlock>
        ) : null}
      </div>
    </div>
  );
}

function JsonPanel({ label, value }: { label: string; value: Json | null }) {
  return (
    <PanelBlock label={label}>
      {value === null ? (
        <p className="rounded-md border border-dashed border-border-subtle px-3 py-2 text-secondary text-text-muted">
          Không có dữ liệu
        </p>
      ) : (
        // Focusable so a keyboard can scroll a long record (max 288px tall).
        <pre
          className="max-h-72 overflow-auto whitespace-pre-wrap wrap-anywhere rounded-md border border-border-subtle bg-surface-base px-3 py-2 font-mono text-caption text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          tabIndex={0}
        >
          {stringifyAuditJson(value)}
        </pre>
      )}
    </PanelBlock>
  );
}

function PanelBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <p className="text-label font-semibold text-text-strong">{label}</p>
      {children}
    </div>
  );
}
