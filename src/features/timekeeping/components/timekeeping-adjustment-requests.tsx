import type { ReactNode } from "react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { TimekeepingAdjustmentRequestDialog } from "@/features/timekeeping/components/timekeeping-adjustment-request-dialog";
import {
  formatVietnamDate,
  formatVietnamDateTime,
  getAdjustmentStatusLabel,
  getTimeEntryModeLabel,
} from "@/features/timekeeping/timekeeping-adjustment-utils";
import type {
  TimekeepingAdjustableEntry,
  TimekeepingAdjustmentRequest,
  TimekeepingAdjustmentStatus,
} from "@/features/timekeeping/types";

interface TimekeepingAdjustmentRequestsProps {
  canCheck: boolean;
  entries: readonly TimekeepingAdjustableEntry[];
  requests: readonly TimekeepingAdjustmentRequest[];
}

function getStatusTone(
  status: TimekeepingAdjustmentStatus,
): "danger" | "success" | "warning" {
  const tones: Record<
    TimekeepingAdjustmentStatus,
    "danger" | "success" | "warning"
  > = {
    approved: "success",
    pending: "warning",
    rejected: "danger",
  };

  return tones[status];
}

function OriginalCheckInOut({
  request,
}: {
  request: TimekeepingAdjustmentRequest;
}) {
  return (
    <div className="grid gap-1">
      <p className="text-secondary text-text-muted">
        Vào: {formatVietnamDateTime(request.originalCheckInAt)} ·{" "}
        {getTimeEntryModeLabel(request.originalCheckInMode)}
      </p>
      <p className="text-secondary text-text-muted">
        Ra: {formatVietnamDateTime(request.originalCheckOutAt)} ·{" "}
        {getTimeEntryModeLabel(request.originalCheckOutMode)}
      </p>
    </div>
  );
}

function RequestedCheckInOut({
  request,
}: {
  request: TimekeepingAdjustmentRequest;
}) {
  return (
    <div className="grid gap-1">
      <p className="text-secondary text-text-muted">
        Vào: {formatVietnamDateTime(request.requestedCheckInAt)} ·{" "}
        {getTimeEntryModeLabel(request.requestedCheckInMode)}
      </p>
      <p className="text-secondary text-text-muted">
        Ra: {formatVietnamDateTime(request.requestedCheckOutAt)} ·{" "}
        {getTimeEntryModeLabel(request.requestedCheckOutMode)}
      </p>
    </div>
  );
}

function DecisionContext({
  request,
}: {
  request: TimekeepingAdjustmentRequest;
}) {
  if (!request.reviewedAt) {
    return <span className="text-secondary text-text-muted">Chưa xử lý</span>;
  }

  return (
    <div className="grid gap-1">
      <p className="font-medium text-text-strong">
        {formatVietnamDateTime(request.reviewedAt)}
      </p>
      <p className="text-secondary text-text-muted">
        {request.reviewerDisplayName || "Người có thẩm quyền"}
      </p>
      {request.decisionReason ? (
        <p className="text-secondary text-text-muted">
          {request.decisionReason}
        </p>
      ) : null}
    </div>
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

export function TimekeepingAdjustmentRequests({
  canCheck,
  entries,
  requests,
}: TimekeepingAdjustmentRequestsProps) {
  const hasAdjustableEntry = entries.length > 0;

  const tableHeader = (
    <tr>
      <TableHeader>Ngày công</TableHeader>
      <TableHeader>Dữ liệu gốc</TableHeader>
      <TableHeader>Đề xuất</TableHeader>
      <TableHeader>Lý do</TableHeader>
      <TableHeader>Trạng thái</TableHeader>
      <TableHeader>Kết quả xử lý</TableHeader>
    </tr>
  );

  const tableBody =
    requests.length === 0 ? (
      <tr>
        <td
          className="px-4 py-10 text-center text-secondary text-text-muted"
          colSpan={6}
        >
          Chưa có yêu cầu điều chỉnh công.
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
              <span className="font-medium text-text-strong">
                {formatVietnamDate(request.workDate)}
              </span>
            </TableCell>
            <TableCell>
              <OriginalCheckInOut request={request} />
            </TableCell>
            <TableCell>
              <RequestedCheckInOut request={request} />
            </TableCell>
            <TableCell className="max-w-[220px]">
              <p className="text-secondary text-text-muted">
                {request.requestReason}
              </p>
            </TableCell>
            <TableCell>
              <Badge tone={getStatusTone(request.status)}>
                {getAdjustmentStatusLabel(request.status)}
              </Badge>
            </TableCell>
            <TableCell className="max-w-[200px]">
              <DecisionContext request={request} />
            </TableCell>
          </tr>
        ))}
      </>
    );

  return (
    <section
      aria-labelledby="adj-requests-heading"
      className="adj-history-work-area grid min-w-0 gap-4 overflow-hidden rounded-xl border border-border-subtle bg-surface-base shadow-[var(--elevation-1)]"
    >
      <div className="flex flex-col gap-4 border-b border-border-subtle px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className="text-section-title font-semibold text-text-strong"
            id="adj-requests-heading"
          >
            Điều chỉnh chấm công
          </h2>
          <p className="mt-0.5 max-w-2xl text-secondary text-text-muted">
            Yêu cầu chỉ áp dụng cho lượt đã kết thúc; dữ liệu gốc luôn được
            lưu giữ để đối chiếu.
          </p>
        </div>
        {canCheck ? (
          <TimekeepingAdjustmentRequestDialog entries={entries} />
        ) : null}
      </div>

      {!canCheck ? (
        <p className="px-6 pb-4 text-secondary text-text-muted">
          Tài khoản hiện tại không có quyền timekeeping.check để gửi yêu cầu
          điều chỉnh.
        </p>
      ) : !hasAdjustableEntry ? (
        <p className="px-6 pb-4 text-secondary text-text-muted">
          Chưa có lượt chấm công đã kết thúc có thể gửi yêu cầu điều chỉnh.
        </p>
      ) : null}

      {/* Zero-padding container: CSS query controls table/list visibility. */}
      <DataTableFrame
        body={tableBody}
        caption="Lịch sử yêu cầu điều chỉnh công"
        className="adj-history-table rounded-none border-0 border-t border-border-subtle"
        header={tableHeader}
        tableClassName="min-w-[1040px] table-fixed text-table-body text-text-default"
      />

      <ResponsiveRecordList
        className="adj-history-record-list px-4 pb-4"
        label="Lịch sử yêu cầu điều chỉnh công"
      >
        {requests.length === 0 ? (
          <p
            className="rounded-lg border border-dashed border-border-subtle p-5 text-center text-secondary text-text-muted"
            role="listitem"
          >
            Chưa có yêu cầu điều chỉnh công.
          </p>
        ) : (
          requests.map((request) => (
            <article
              className="rounded-lg border border-border-subtle bg-surface-base p-4"
              key={request.id}
              role="listitem"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-label font-semibold uppercase tracking-[0.04em] text-text-muted">
                    Ngày công
                  </p>
                  <p className="mt-1 font-semibold text-text-strong">
                    {formatVietnamDate(request.workDate)}
                  </p>
                </div>
                <Badge tone={getStatusTone(request.status)}>
                  {getAdjustmentStatusLabel(request.status)}
                </Badge>
              </div>

              <dl className="mt-4 grid gap-3 rounded-md bg-surface-raised p-3">
                <div className="grid gap-1">
                  <dt className="text-label text-text-muted">Dữ liệu gốc</dt>
                  <dd>
                    <OriginalCheckInOut request={request} />
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-label text-text-muted">Đề xuất</dt>
                  <dd>
                    <RequestedCheckInOut request={request} />
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-label text-text-muted">Lý do</dt>
                  <dd className="text-secondary text-text-strong">
                    {request.requestReason}
                  </dd>
                </div>
                {request.reviewedAt ? (
                  <div className="grid gap-1">
                    <dt className="text-label text-text-muted">Kết quả xử lý</dt>
                    <dd>
                      <DecisionContext request={request} />
                    </dd>
                  </div>
                ) : null}
              </dl>
            </article>
          ))
        )}
      </ResponsiveRecordList>
    </section>
  );
}
