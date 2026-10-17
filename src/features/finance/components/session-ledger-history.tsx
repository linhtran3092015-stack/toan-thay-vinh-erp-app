import Link from "next/link";
import type { ReactNode } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { Badge } from "@/components/ui/badge";
import type { CenterSessionLedgerEntryReadModel } from "@/features/finance/read-models";
import {
  SESSION_LEDGER_ENTRY_LIMIT,
  formatDeltaSessions,
  formatLedgerUnitPrice,
  getLedgerEntryLabel,
  getLedgerEntryTone,
  getLedgerPaymentRequestHref,
} from "@/features/finance/session-ledger-models";
import { formatDateTime, formatIsoDate, formatShortDateTime, getVietnamToday } from "@/lib/datetime";
import { permissionDeniedDescription } from "@/lib/permissions/labels";
import { cn } from "@/lib/utils";

export { getLedgerEntryLabel } from "@/features/finance/session-ledger-models";

interface SessionLedgerHistoryProps {
  entries: CenterSessionLedgerEntryReadModel[];
  /** `payments.view || payments.manage`: a `PAY-…` reference opens the payment-request list filtered to it. */
  canViewPaymentRequests?: boolean;
  /** `sessions.view`: rows tied to a class session get a "Mở buổi học" link. */
  canViewSessions?: boolean;
  /** `students.view`: the name links to the student profile (default true, the pre-14c behaviour). */
  canViewStudents?: boolean;
  /** Vietnam `YYYY-MM-DD` for the short "ghi nhận" time; defaults to today in Vietnam. */
  today?: string;
}

interface LedgerRowContext {
  canViewPaymentRequests: boolean;
  canViewSessions: boolean;
  canViewStudents: boolean;
  today: string;
}

const LIST_LABEL = "Danh sách mục sổ cái số buổi mới nhất";

/*
 * Ngày hiệu lực 150 · Học sinh 180 · Loại 150 · Số buổi 96 · Đơn giá 120 ·
 * Tham chiếu 150 are fixed; Ghi chú takes the rest (194px at the floor). The
 * 1040px floor + the frame's 2px border is the 1042px container switch in globals.css.
 */
const TABLE_CLASS = "min-w-[1040px] table-fixed";
/** Wrapped notes and two-line cells: top-aligned with room above and below. */
const CELL = "py-2! align-top!";
const LINK_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

/** The route's `session_ledger.view` denial, shared with the /dev/lists preview so the copy cannot drift. */
export function SessionLedgerPermissionDenied() {
  return (
    <PermissionDeniedState
      description={permissionDeniedDescription("session_ledger.view")}
      title="Không có quyền xem Sổ cái số buổi"
    />
  );
}

/**
 * Read-only audit presentation for the existing latest-100 ledger-entry read
 * (design 16a row "Sổ cái số buổi"). On purpose it has no filters, chips,
 * pager, totals or row actions: the read is capped at the newest 100 entries
 * by recording time, so a filter over it would mislead, and "Hoàn buổi" needs
 * data this read does not carry (owner decisions, TODOS). No hooks and no
 * router: it renders as a server component on the route and inside the client
 * /dev/lists preview alike.
 * `.session-ledger-operational-work-area` is the container: the table shows
 * from 1042px, cards below it.
 */
export function SessionLedgerHistory({
  canViewPaymentRequests = false,
  canViewSessions = false,
  canViewStudents = true,
  entries,
  today,
}: SessionLedgerHistoryProps) {
  const context: LedgerRowContext = {
    canViewPaymentRequests,
    canViewSessions,
    canViewStudents,
    today: today ?? getVietnamToday(),
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="Sổ cái số buổi">
        <p className="mt-1 text-secondary tabular-nums text-text-muted">
          <span id="session-ledger-result-context">
            {`Hiển thị ${entries.length} mục sổ cái mới nhất (tối đa ${SESSION_LEDGER_ENTRY_LIMIT}).`}
          </span>{" "}
          <span>Mới ghi nhận trước.</span>
        </p>
      </PageHeader>

      <section
        aria-labelledby="session-ledger-result-context"
        className="session-ledger-operational-work-area grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3"
      >
        {entries.length === 0 ? (
          // Rendered once at every width (no responsive hook class, no record list).
          <DataTableFrame
            body={null}
            caption={LIST_LABEL}
            empty={
              <TableState>
                <p className="text-body font-semibold text-text-strong">Chưa có mục sổ cái</p>
                <p className="max-w-xl text-secondary text-text-muted">
                  Chưa có mục sổ cái số buổi nào được ghi nhận.
                </p>
              </TableState>
            }
            header={<LedgerTableHeader />}
            status="empty"
            tableClassName={TABLE_CLASS}
          />
        ) : (
          <div className="session-ledger-results-work-area grid min-w-0 grid-cols-[minmax(0,1fr)]">
            <DataTableFrame
              body={entries.map((entry) => (
                <SessionLedgerTableRow context={context} entry={entry} key={entry.id} />
              ))}
              caption={LIST_LABEL}
              className="session-ledger-directory-table"
              header={<LedgerTableHeader />}
              tableClassName={TABLE_CLASS}
            />

            <ResponsiveRecordList className="session-ledger-directory-record-list" label={LIST_LABEL}>
              {entries.map((entry) => (
                <SessionLedgerRecord context={context} entry={entry} key={entry.id} />
              ))}
            </ResponsiveRecordList>
          </div>
        )}
      </section>
    </div>
  );
}

function LedgerTableHeader() {
  return (
    <tr>
      <TableHeaderCell className="w-[150px]">Ngày hiệu lực</TableHeaderCell>
      <TableHeaderCell className="w-[180px]">Học sinh</TableHeaderCell>
      <TableHeaderCell className="w-[150px]">Loại</TableHeaderCell>
      <TableHeaderCell className="w-[96px]" numeric>
        Số buổi
      </TableHeaderCell>
      <TableHeaderCell className="w-[120px]" numeric>
        Đơn giá
      </TableHeaderCell>
      <TableHeaderCell className="w-[150px]">Tham chiếu</TableHeaderCell>
      <TableHeaderCell>Ghi chú</TableHeaderCell>
    </tr>
  );
}

function SessionLedgerTableRow({
  context,
  entry,
}: {
  context: LedgerRowContext;
  entry: CenterSessionLedgerEntryReadModel;
}) {
  return (
    <TableRow tall>
      <TableCell className={CELL}>
        <span className="block font-medium tabular-nums text-text-strong">{formatIsoDate(entry.effectiveOn)}</span>
        <span className="block text-caption tabular-nums text-text-muted" title={formatDateTime(entry.createdAt)}>
          {/* A no-break space keeps "16/10 10:20" on one line when the caption wraps. */}
          ghi nhận {formatShortDateTime(entry.createdAt, context.today).replace(" ", "\u00a0")}
        </span>
      </TableCell>
      <TableCell className={CELL}>
        <StudentIdentity canViewStudents={context.canViewStudents} entry={entry} />
      </TableCell>
      <TableCell className={CELL}>
        <EntryTypeBadge entryType={entry.entryType} />
      </TableCell>
      <TableCell className={cn(CELL, "font-semibold text-text-strong")} numeric>
        {formatDeltaSessions(entry.deltaSessions)}
      </TableCell>
      <TableCell className={CELL} numeric>
        {formatLedgerUnitPrice(entry.unitPriceVnd)}
      </TableCell>
      <TableCell className={CELL}>
        <LedgerReference context={context} entry={entry} />
      </TableCell>
      <TableCell className={cn(CELL, "break-words text-secondary text-text-default")}>{entry.note ?? "—"}</TableCell>
    </TableRow>
  );
}

/** Non-link card: an entry has no detail route, and its text must stay ordinary selectable text. */
function SessionLedgerRecord({
  context,
  entry,
}: {
  context: LedgerRowContext;
  entry: CenterSessionLedgerEntryReadModel;
}) {
  return (
    <article
      className="min-w-0 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-3">
        <StudentIdentity canViewStudents={context.canViewStudents} entry={entry} touch />
        <span className="shrink-0 text-body font-semibold tabular-nums text-text-strong">
          {formatDeltaSessions(entry.deltaSessions)}
        </span>
      </div>
      <div className="mt-2">
        <EntryTypeBadge entryType={entry.entryType} />
      </div>
      <dl className="mt-2 grid grid-cols-[104px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 border-t border-border-row pt-2 text-secondary">
        <CardField label="Ngày hiệu lực">
          <span className="tabular-nums text-text-default">{formatIsoDate(entry.effectiveOn)}</span>
        </CardField>
        <CardField label="Ghi nhận">
          <span className="tabular-nums text-text-default" title={formatDateTime(entry.createdAt)}>
            {formatShortDateTime(entry.createdAt, context.today)}
          </span>
        </CardField>
        <CardField label="Tham chiếu">
          <LedgerReference context={context} entry={entry} touch />
        </CardField>
        {entry.unitPriceVnd > 0 ? (
          <CardField label="Đơn giá">
            <span className="tabular-nums text-text-default">{formatLedgerUnitPrice(entry.unitPriceVnd)}</span>
          </CardField>
        ) : null}
      </dl>
      <p className="mt-2 break-words text-secondary text-text-default">{entry.note ?? "—"}</p>
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

/** The pinned event label as the badge's own text; tones never use danger (see getLedgerEntryTone). */
function EntryTypeBadge({ entryType }: { entryType: string }) {
  return (
    <Badge className="max-w-full whitespace-normal! break-words" tone={getLedgerEntryTone(entryType)}>
      {getLedgerEntryLabel(entryType)}
    </Badge>
  );
}

/** Name (profile link only with `students.view`) + mono code; the loader falls back to "Học viên" and no code under RLS. */
function StudentIdentity({
  canViewStudents,
  entry,
  touch = false,
}: {
  canViewStudents: boolean;
  entry: CenterSessionLedgerEntryReadModel;
  /** Card layout: a 44px link target on phones. */
  touch?: boolean;
}) {
  return (
    <div className="min-w-0">
      {canViewStudents ? (
        <Link
          aria-label={`Mở hồ sơ học viên ${entry.studentFullName}`}
          className={cn(
            "rounded-sm font-semibold break-words text-text-strong! hover:underline",
            LINK_FOCUS,
            touch && "inline-flex items-center max-md:min-h-11",
          )}
          href={`/students/${entry.studentId}`}
        >
          {entry.studentFullName}
        </Link>
      ) : (
        <span className="block font-semibold break-words text-text-strong">{entry.studentFullName}</span>
      )}
      {entry.studentPublicCode ? (
        <span className="block font-mono text-caption text-text-muted">{entry.studentPublicCode}</span>
      ) : null}
    </div>
  );
}

/**
 * `referenceCode` (a `PAY-…` code links to the payment-request list with
 * `payments.view`) and, with `sessions.view`, "Mở buổi học" for rows tied to a
 * class session (charges and reversals carry no code). "—" only when neither exists.
 */
function LedgerReference({
  context,
  entry,
  touch = false,
}: {
  context: LedgerRowContext;
  entry: CenterSessionLedgerEntryReadModel;
  touch?: boolean;
}) {
  const code = entry.referenceCode;
  const paymentRequestHref = context.canViewPaymentRequests ? getLedgerPaymentRequestHref(code) : null;
  const sessionHref =
    context.canViewSessions && entry.classSessionId ? `/sessions/${entry.classSessionId}` : null;

  if (!code && !sessionHref) {
    return <span className="text-text-muted">—</span>;
  }

  const linkClassName = cn(
    "rounded-sm font-semibold text-action-link! hover:underline",
    LINK_FOCUS,
    touch && "inline-flex items-center max-md:min-h-11",
  );

  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      {code ? (
        paymentRequestHref ? (
          <Link
            aria-label={`Xem yêu cầu thanh toán ${code}`}
            className={cn(linkClassName, "break-all font-mono text-caption")}
            href={paymentRequestHref}
          >
            {code}
          </Link>
        ) : (
          <span className="break-all font-mono text-caption text-text-default">{code}</span>
        )
      ) : null}
      {sessionHref ? (
        <Link
          aria-label={`Mở buổi học của ${entry.studentFullName}, mục ngày ${formatIsoDate(entry.effectiveOn)}`}
          className={cn(linkClassName, "text-secondary")}
          href={sessionHref}
        >
          Mở buổi học
        </Link>
      ) : null}
    </span>
  );
}
