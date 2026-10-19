import type { ReactNode } from "react";

import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import type { AuditLogEntry } from "@/features/audit/read-models";

import {
  AuditActionName,
  AuditActorIdentity,
  AuditEntity,
  AuditModuleName,
  AuditTimestamp,
} from "./audit-log-cells";
import { AuditRecordDataDisclosure } from "./audit-log-record-data";

/**
 * Cards for work areas narrower than the table (below 1042px): the same facts
 * in a `dl` and a native `<details>` for the before/after JSON (collapsed by
 * default; a small client island renders the panels once it is opened).
 * Non-link cards: an entry has no detail route.
 */
export function AuditLogRecords({
  className,
  entries,
  label,
}: {
  className?: string;
  entries: readonly AuditLogEntry[];
  label: string;
}) {
  return (
    <ResponsiveRecordList className={className} label={label}>
      {entries.map((entry) => (
        <AuditLogRecord entry={entry} key={entry.id} />
      ))}
    </ResponsiveRecordList>
  );
}

function AuditLogRecord({ entry }: { entry: AuditLogEntry }) {
  return (
    <article
      className="min-w-0 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-3">
        <AuditActionName action={entry.action} variant="card" />
        <AuditTimestamp className="shrink-0 text-right text-secondary" occurredAt={entry.occurredAt} />
      </div>

      <dl className="mt-2 grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-border-row pt-2 text-secondary">
        <CardField label="Người thực hiện">
          <AuditActorIdentity entry={entry} />
        </CardField>
        <CardField label="Module">
          <AuditModuleName module={entry.module} />
        </CardField>
        <CardField label="Đối tượng">
          <AuditEntity entry={entry} />
        </CardField>
        <CardField label="Lý do">
          {entry.reason ? (
            <span className="break-words text-text-default">{entry.reason}</span>
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </CardField>
      </dl>

      <AuditRecordDataDisclosure entry={entry} />
    </article>
  );
}

function CardField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}
