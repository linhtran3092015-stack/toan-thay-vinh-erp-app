import Link from "next/link";
import type { ReactNode } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
} from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";

import type { CareDashboard, CareStudents } from "../models";
import type { StudentCareActionOverrides } from "../student-care-action-overrides";
import { getCareLifecycleLabel } from "../student-care-presentation";
import { CareDialogAction } from "./care-dialog-action";
import { CareDateTimeField, CareNoteField, CareOwnerSelect } from "./care-form-fields";

type CareStudentRow = CareStudents["rows"][number];

interface CareStudentsTableProps {
  actions?: StudentCareActionOverrides;
  assignees: CareDashboard["assignees"];
  canAssign: boolean;
  canHandle: boolean;
  empty: ReactNode;
  error: ReactNode;
  footer?: ReactNode;
  inactive: boolean;
  rows: CareStudentRow[];
  status: "ready" | "empty" | "error";
}

/**
 * "Phân công lâu dài" / "Theo dõi riêng" tabs: students with their long-term
 * care owner. The assign (student_care.assign) and follow-up (inactive
 * students) commands keep their forms, now in dialogs; both also need
 * student_care.handle, which mutateCare and the RPC check for every command.
 */
export function CareStudentsTable({ actions, assignees, canAssign, canHandle, empty, error, footer, inactive, rows, status }: CareStudentsTableProps) {
  const label = inactive ? "Học sinh theo dõi riêng" : "Phân công phụ trách lâu dài";
  return (
    <div className="grid gap-2">
      <DataTableFrame
        body={rows.map((row) => (
          <TableRow key={row.id} tall>
            <TableCell>
              <StudentName row={row} />
            </TableCell>
            <TableCell>
              <OwnerName row={row} />
            </TableCell>
            <TableCell>
              <StudentActions actions={actions} assignees={assignees} canAssign={canAssign} canHandle={canHandle} inactive={inactive} row={row} />
            </TableCell>
          </TableRow>
        ))}
        caption={label}
        className="student-care-task-table"
        empty={empty}
        error={error}
        footer={footer}
        header={
          <tr>
            <TableHeaderCell>Học sinh</TableHeaderCell>
            <TableHeaderCell className="w-[240px]">Người phụ trách lâu dài</TableHeaderCell>
            <TableHeaderCell className="w-[460px]">Hành động</TableHeaderCell>
          </tr>
        }
        status={status}
        tableClassName="min-w-[900px]"
      />
      <div className="student-care-task-record-list grid gap-2">
        {status === "ready" ? (
          <ResponsiveRecordList label={label}>
            {rows.map((row) => (
              <article
                className="grid min-w-0 gap-2 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]"
                key={row.id}
                role="listitem"
              >
                <div className="min-w-0">
                  <StudentName row={row} />
                </div>
                <p className="border-t border-border-row pt-2 text-secondary text-text-default">
                  Phụ trách lâu dài: <OwnerName row={row} />
                </p>
                <StudentActions actions={actions} assignees={assignees} canAssign={canAssign} canHandle={canHandle} inactive={inactive} row={row} />
              </article>
            ))}
          </ResponsiveRecordList>
        ) : (
          <div className="rounded-lg border border-border-subtle bg-surface-base">{status === "error" ? error : empty}</div>
        )}
        {footer ? <div className="rounded-lg border border-border-subtle bg-surface-base px-4 py-2.5">{footer}</div> : null}
      </div>
    </div>
  );
}

function StudentName({ row }: { row: CareStudentRow }) {
  return (
    <>
      <Link
        className="block font-semibold text-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        href={`/students/${row.id}`}
      >
        {row.full_name}
      </Link>
      <span className="block text-caption tabular-nums text-text-muted">
        {row.public_code} · {getCareLifecycleLabel(row.lifecycle_status)}
      </span>
    </>
  );
}

function OwnerName({ row }: { row: CareStudentRow }) {
  return row.owner_id ? <span>{row.owner_name ?? "Nhân sự"}</span> : <Badge tone="neutral">Chưa có người phụ trách</Badge>;
}

function StudentActions({
  actions,
  assignees,
  canAssign,
  canHandle,
  inactive,
  row,
}: {
  actions?: StudentCareActionOverrides;
  assignees: CareDashboard["assignees"];
  canAssign: boolean;
  canHandle: boolean;
  inactive: boolean;
  row: CareStudentRow;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2 py-2">
      <Link
        className="inline-flex h-8 items-center rounded-md px-2 text-secondary max-md:h-11 font-semibold text-action-link! hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        href={`/student-care?student_id=${row.id}`}
      >
        Xem công việc
      </Link>
      {canAssign && canHandle ? (
        <CareDialogAction
          action={actions?.mutateCare}
          base={{ op: "assign_student", student_id: row.id }}
          description="Người phụ trách lâu dài nhận các việc Coaching tháng và theo dõi đang mở của học sinh này."
          submitLabel="Lưu phân công"
          title={`Phân công phụ trách · ${row.full_name}`}
          triggerLabel="Phân công"
          triggerClassName="max-md:h-11"
          triggerSize="sm"
        >
          <CareOwnerSelect assignees={assignees} />
          <CareNoteField label="Lý do" />
        </CareDialogAction>
      ) : null}
      {inactive && canHandle ? (
        <CareDialogAction
          action={actions?.mutateCare}
          base={{ op: "create_followup", student_id: row.id }}
          description="Tạo một việc theo dõi do anh/chị phụ trách, hẹn theo giờ Việt Nam."
          submitLabel="Tạo việc theo dõi"
          title={`Tạo lịch theo dõi · ${row.full_name}`}
          triggerLabel="Tạo lịch theo dõi"
          triggerClassName="max-md:h-11"
          triggerSize="sm"
        >
          <CareNoteField />
          <CareDateTimeField label="Hẹn liên hệ (giờ Việt Nam)" required />
        </CareDialogAction>
      ) : null}
    </div>
  );
}
