import type { ReactNode } from "react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { TimekeepingAdjustmentDecisionDialog } from "@/features/timekeeping/components/timekeeping-adjustment-decision-dialog";
import {
  formatVietnamDate,
  formatVietnamDateTime,
  getTimeEntryModeLabel,
} from "@/features/timekeeping/timekeeping-adjustment-utils";
import type { TimekeepingAdjustmentApprovalQueueEntry } from "@/features/timekeeping/types";

interface TimekeepingAdjustmentApprovalQueueProps {
  requests: readonly TimekeepingAdjustmentApprovalQueueEntry[];
}

function getRequesterLabel(
  request: TimekeepingAdjustmentApprovalQueueEntry,
): string {
  return (
    request.requesterDisplayName ||
    request.requesterEmployeeCode ||
    "Nhân sự"
  );
}

/**
 * Presents Dữ liệu gốc and Đề xuất clearly side-by-side using the existing
 * read-model fields. Does not synthesize effective state.
 */
function ChangeSummary({
  request,
}: {
  request: TimekeepingAdjustmentApprovalQueueEntry;
}) {
  return (
    <dl className="grid gap-2.5">
      <div>
        <dt className="text-label font-semibold text-text-muted">Dữ liệu gốc</dt>
        <dd className="mt-0.5 grid gap-0.5 text-secondary text-text-muted">
          <p>
            Vào: {formatVietnamDateTime(request.originalCheckInAt)} ·{" "}
            {getTimeEntryModeLabel(request.originalCheckInMode)}
          </p>
          <p>
            Ra: {formatVietnamDateTime(request.originalCheckOutAt)} ·{" "}
            {getTimeEntryModeLabel(request.originalCheckOutMode)}
          </p>
        </dd>
      </div>
      <div>
        <dt className="text-label font-semibold text-text-strong">Đề xuất</dt>
        <dd className="mt-0.5 grid gap-0.5 text-secondary text-text-strong">
          <p>
            Vào: {formatVietnamDateTime(request.requestedCheckInAt)} ·{" "}
            {getTimeEntryModeLabel(request.requestedCheckInMode)}
          </p>
          <p>
            Ra: {formatVietnamDateTime(request.requestedCheckOutAt)} ·{" "}
            {getTimeEntryModeLabel(request.requestedCheckOutMode)}
          </p>
        </dd>
      </div>
    </dl>
  );
}

function TableHeader({ children }: { children: string }) {
  return (
    <th
      className="h-10 border-b border-border-subtle px-4 text-left font-semibold"
      scope="col"
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-top text-table-body ${className}`}>
      {children}
    </td>
  );
}

export function TimekeepingAdjustmentApprovalQueue({
  requests,
}: TimekeepingAdjustmentApprovalQueueProps) {
  const tableHeader = (
    <tr>
      <TableHeader>Nhân sự</TableHeader>
      <TableHeader>Ngày công</TableHeader>
      <TableHeader>Thay đổi đề xuất</TableHeader>
      <TableHeader>Lý do</TableHeader>
      <TableHeader>Gửi lúc</TableHeader>
      <TableHeader>Thao tác</TableHeader>
    </tr>
  );

  const tableBody =
    requests.length === 0 ? (
      <tr>
        <td
          className="px-4 py-10 text-center text-secondary text-text-muted"
          colSpan={6}
        >
          Không có yêu cầu điều chỉnh nào chờ duyệt.
        </td>
      </tr>
    ) : (
      <>
        {requests.map((request) => (
          <tr
            className="hover:bg-[var(--table-row-hover)]"
            key={request.id}
          >
            <TableCell>
              <p className="font-semibold text-text-strong">
                {getRequesterLabel(request)}
              </p>
              {request.requesterEmployeeCode ? (
                <p className="mt-0.5 font-mono text-caption text-text-muted">
                  {request.requesterEmployeeCode}
                </p>
              ) : null}
            </TableCell>
            <TableCell>
              <span className="font-medium text-text-strong">
                {formatVietnamDate(request.workDate)}
              </span>
            </TableCell>
            <TableCell>
              <ChangeSummary request={request} />
            </TableCell>
            <TableCell className="max-w-[220px]">
              <p className="text-secondary text-text-muted">
                {request.requestReason}
              </p>
            </TableCell>
            <TableCell>
              <span className="text-secondary text-text-muted">
                {formatVietnamDateTime(request.createdAt)}
              </span>
            </TableCell>
            <TableCell>
              <TimekeepingAdjustmentDecisionDialog request={request} />
            </TableCell>
          </tr>
        ))}
      </>
    );

  return (
    <section
      aria-labelledby="adj-queue-heading"
      className="adj-queue-work-area grid min-w-0 gap-4 overflow-hidden rounded-xl border border-border-subtle bg-surface-base shadow-[var(--elevation-1)]"
    >
      <div className="flex flex-col gap-2 border-b border-border-subtle px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className="text-section-title font-semibold text-text-strong"
            id="adj-queue-heading"
          >
            Hàng chờ duyệt điều chỉnh
          </h2>
          <p className="mt-0.5 text-secondary text-text-muted">
            Người duyệt không thể tự xử lý yêu cầu do chính mình gửi.
          </p>
        </div>
        <Badge tone="warning">{requests.length} chờ duyệt</Badge>
      </div>

      {/* Zero-padding container: CSS query controls table/list visibility. */}
      <DataTableFrame
        body={tableBody}
        caption="Hàng chờ duyệt điều chỉnh công"
        className="adj-queue-table rounded-none border-0 border-t border-border-subtle"
        header={tableHeader}
        tableClassName="min-w-[1080px] table-fixed text-table-body text-text-default"
      />

      <ResponsiveRecordList
        className="adj-queue-record-list px-4 pb-4"
        label="Hàng chờ duyệt điều chỉnh công"
      >
        {requests.length === 0 ? (
          <p
            className="rounded-lg border border-dashed border-border-subtle p-5 text-center text-secondary text-text-muted"
            role="listitem"
          >
            Không có yêu cầu điều chỉnh nào chờ duyệt.
          </p>
        ) : (
          requests.map((request) => (
            <article
              className="rounded-lg border border-border-subtle bg-surface-base p-4"
              key={request.id}
              role="listitem"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-label font-semibold uppercase tracking-[0.04em] text-text-muted">
                    Nhân sự
                  </p>
                  <p className="mt-1 font-semibold text-text-strong">
                    {getRequesterLabel(request)}
                  </p>
                  {request.requesterEmployeeCode ? (
                    <p className="mt-0.5 font-mono text-caption text-text-muted">
                      {request.requesterEmployeeCode}
                    </p>
                  ) : null}
                  <p className="mt-1 text-secondary text-text-muted">
                    {formatVietnamDate(request.workDate)}
                  </p>
                </div>
                <Badge tone="warning">Chờ duyệt</Badge>
              </div>

              <div className="mt-4 rounded-md bg-surface-raised p-3">
                <ChangeSummary request={request} />
              </div>

              <p className="mt-3 text-secondary leading-6 text-text-muted">
                {request.requestReason}
              </p>

              <p className="mt-2 text-caption text-text-muted">
                Gửi lúc: {formatVietnamDateTime(request.createdAt)}
              </p>

              <div className="mt-4 border-t border-border-subtle pt-3">
                <TimekeepingAdjustmentDecisionDialog request={request} />
              </div>
            </article>
          ))
        )}
      </ResponsiveRecordList>
    </section>
  );
}
