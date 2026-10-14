import Link from "next/link";
import type { ReactNode } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
  type DataTableFrameStatus,
} from "@/components/patterns/data-table-frame";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { StudentCareActionOverrides } from "../student-care-action-overrides";
import {
  CARE_UNASSIGNED_LABEL,
  formatCareOverdue,
  formatCareShortDateTime,
  getCareDueAt,
  getCareLifecycleLabel,
  getCareRowAction,
  getCareSignalLines,
  type CareTaskRow,
} from "../student-care-presentation";
import { CareActionForm } from "./care-action-form";
import { CareStatusBadge } from "./care-status-badge";

export const CARE_TASK_TABLE_LABEL = "Hàng đợi công việc chăm sóc học sinh";

interface CareTaskTableProps {
  actions?: StudentCareActionOverrides;
  canHandle: boolean;
  empty: ReactNode;
  error: ReactNode;
  /** Pager + "a–b trong N task" for the frame footer. */
  footer?: ReactNode;
  now: number;
  rows: CareTaskRow[];
  status: Exclude<DataTableFrameStatus, "loading" | "forbidden">;
}

/**
 * Queue table (design 13a) on a wide work area and the record list otherwise;
 * every row carries exactly one control: "Nhận việc" for an unowned task not
 * yet started when the viewer may handle care, otherwise "Mở".
 */
export function CareTaskTable({ actions, canHandle, empty, error, footer, now, rows, status }: CareTaskTableProps) {
  return (
    <div className="grid gap-2">
      <DataTableFrame
        body={rows.map((row) => (
          <CareTaskTableRow actions={actions} canHandle={canHandle} key={row.id} now={now} row={row} />
        ))}
        caption={CARE_TASK_TABLE_LABEL}
        className="student-care-task-table"
        empty={empty}
        error={error}
        footer={footer}
        header={
          <tr>
            <TableHeaderCell>Học sinh</TableHeaderCell>
            <TableHeaderCell className="w-[230px]">Dấu hiệu (bằng chứng)</TableHeaderCell>
            <TableHeaderCell className="w-[110px]">Phát hiện</TableHeaderCell>
            <TableHeaderCell className="w-[120px]">Hạn liên hệ</TableHeaderCell>
            <TableHeaderCell className="w-[140px]">Người xử lý</TableHeaderCell>
            <TableHeaderCell className="w-[150px]">Trạng thái</TableHeaderCell>
            <TableHeaderCell className="w-[110px] text-right">
              <span className="sr-only">Thao tác</span>
            </TableHeaderCell>
          </tr>
        }
        status={status}
        tableClassName="min-w-[1040px]"
      />
      <div className="student-care-task-record-list grid gap-2">
        {status === "ready" ? (
          <ResponsiveRecordList label={CARE_TASK_TABLE_LABEL}>
            {rows.map((row) => (
              <CareTaskRecord actions={actions} canHandle={canHandle} key={row.id} now={now} row={row} />
            ))}
          </ResponsiveRecordList>
        ) : (
          <div className="rounded-lg border border-border-subtle bg-surface-base">{status === "error" ? error : empty}</div>
        )}
        {/* Also under an empty page past the last one, so the pager can lead back. */}
        {footer ? <div className="rounded-lg border border-border-subtle bg-surface-base px-4 py-2.5">{footer}</div> : null}
      </div>
    </div>
  );
}

function taskHref(row: CareTaskRow) {
  return `/student-care/${row.id}`;
}

function SignalCell({ row }: { row: CareTaskRow }) {
  const lines = getCareSignalLines(row);
  return (
    <div className="grid gap-0.5 py-2 text-secondary">
      {lines.map((line) => (
        <p key={line.label}>
          <span className="text-text-strong">{line.label}</span>
          {line.detail ? <span className="tabular-nums text-text-muted"> · {line.detail}</span> : null}
        </p>
      ))}
      {row.kind === "alert" && !row.evidence_current ? (
        <span>
          <Badge tone="warning">bằng chứng đã thay đổi</Badge>
        </span>
      ) : null}
    </div>
  );
}

function DueText({ now, row }: { now: number; row: CareTaskRow }) {
  if (row.overdue) return <span className="font-semibold text-danger">{formatCareOverdue(row, now)}</span>;
  return <span>{formatCareShortDateTime(getCareDueAt(row))}</span>;
}

function Owner({ row }: { row: CareTaskRow }) {
  if (row.owner_id === null) return <Badge tone="neutral">{CARE_UNASSIGNED_LABEL}</Badge>;
  return <span className="text-text-default">{row.owner_name ?? "Nhân sự"}</span>;
}

function RowAction({ actions, canHandle, compactClassName, row }: { actions?: StudentCareActionOverrides; canHandle: boolean; compactClassName?: string; row: CareTaskRow }) {
  if (getCareRowAction(row, canHandle) === "claim") {
    return (
      <CareActionForm
        action={actions?.mutateCare}
        base={{ op: "claim", student_id: row.student_id, task_id: row.id, version: row.version }}
        className={compactClassName}
        compact
        label="Nhận việc"
        submitAriaLabel={`Nhận việc · ${row.full_name}`}
        submitVariant="primary"
      />
    );
  }
  return (
    <Link
      aria-label={`Mở công việc · ${row.full_name}`}
      className="inline-flex h-8 items-center rounded-md px-2 text-secondary font-semibold text-action-link! hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      href={taskHref(row)}
    >
      Mở
    </Link>
  );
}

function CareTaskTableRow({ actions, canHandle, now, row }: { actions?: StudentCareActionOverrides; canHandle: boolean; now: number; row: CareTaskRow }) {
  return (
    <TableRow tall>
      <TableCell>
        <Link
          className="block font-semibold text-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          href={taskHref(row)}
        >
          {row.full_name}
        </Link>
        <span className="block text-caption tabular-nums text-text-muted">
          {row.public_code} · {getCareLifecycleLabel(row.lifecycle_status)}
        </span>
      </TableCell>
      <TableCell>
        <SignalCell row={row} />
      </TableCell>
      <TableCell className="tabular-nums text-text-muted">{formatCareShortDateTime(row.detected_at)}</TableCell>
      <TableCell className="tabular-nums">
        <DueText now={now} row={row} />
      </TableCell>
      <TableCell>
        <Owner row={row} />
      </TableCell>
      <TableCell>
        <CareStatusBadge status={row.status} />
      </TableCell>
      <TableCell className="text-right">
        <RowAction actions={actions} canHandle={canHandle} compactClassName="justify-items-end py-2" row={row} />
      </TableCell>
    </TableRow>
  );
}

function CareTaskRecord({ actions, canHandle, now, row }: { actions?: StudentCareActionOverrides; canHandle: boolean; now: number; row: CareTaskRow }) {
  const claim = getCareRowAction(row, canHandle) === "claim";
  const lines = getCareSignalLines(row);
  return (
    <RecordListItem
      ariaLabel={`Mở công việc · ${row.full_name}`}
      badge={<CareStatusBadge status={row.status} />}
      href={taskHref(row)}
      meta={`${row.public_code} · ${getCareLifecycleLabel(row.lifecycle_status)} · phát hiện ${formatCareShortDateTime(row.detected_at)}`}
      metrics={
        <>
          <span>{lines.map((line) => (line.detail ? `${line.label} · ${line.detail}` : line.label)).join("; ")}</span>
          {row.kind === "alert" && !row.evidence_current ? <Badge tone="warning">bằng chứng đã thay đổi</Badge> : null}
          <span className="tabular-nums">
            Hạn liên hệ: <DueText now={now} row={row} />
          </span>
          <span>
            Người xử lý: <Owner row={row} />
          </span>
        </>
      }
      title={row.full_name}
      trailing={claim ? <RowAction actions={actions} canHandle={canHandle} row={row} /> : undefined}
    />
  );
}

export function CareTableMessage({ children, title, tone = "default" }: { children?: ReactNode; title: string; tone?: "default" | "danger" }) {
  return (
    <TableState>
      <p className={cn("text-body font-semibold", tone === "danger" ? "text-danger" : "text-text-strong")}>{title}</p>
      {children ? <div className="max-w-xl text-secondary text-text-muted">{children}</div> : null}
    </TableState>
  );
}
