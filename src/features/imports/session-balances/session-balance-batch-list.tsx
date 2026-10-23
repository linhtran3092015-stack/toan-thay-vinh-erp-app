import Link from "next/link";
import { useId, type ReactNode } from "react";

import { TableState } from "@/components/patterns/data-table-frame";
import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import { formatImportTimestamp } from "@/features/imports/components/import-labels";
import { getSessionBalanceBatchListStatus } from "@/features/imports/session-balances/session-balance-import-labels";
import type { SessionBalanceImportBatchListItem } from "@/features/imports/session-balances/types";
import { formatIsoDate } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";

/** The route lists the newest 50 batches (`listSessionBalanceImportBatches`, `.limit(50)`). */
export const SESSION_BALANCE_BATCH_LIST_LIMIT = 50;

/** Real route of a batch page; previews pass their own `getBatchHref` under /dev. */
export function getSessionBalanceBatchHref(batchId: string): string {
  return `/imports/session-balances/${batchId}`;
}

export interface SessionBalanceBatchListProps {
  batches: readonly SessionBalanceImportBatchListItem[];
  canApprove: boolean;
  /** imports.session_balances: may reconcile ("Xem đối soát"). */
  canImport: boolean;
  currentUserId: string | null;
  getBatchHref: (batchId: string) => string;
}

/*
 * Column tracks from a 960px container: the same template for the header row
 * and every record, so one DOM rendering reads as a table there and as
 * stacked cards below it (no table + card double rendering).
 */
const COLUMNS = "@min-[960px]:grid-cols-[132px_minmax(0,1.6fr)_104px_minmax(0,1fr)_96px_minmax(0,1.1fr)]";

function getRowAction(
  batch: SessionBalanceImportBatchListItem,
  viewer: { canApprove: boolean; canImport: boolean; currentUserId: string | null },
): string {
  const isCreator = viewer.currentUserId === batch.created_by;
  if (batch.status === "awaiting_approval" && !isCreator && viewer.canApprove) return "Xem & Phê duyệt";
  if (batch.status === "awaiting_reconciliation" && viewer.canImport) return "Xem đối soát";
  if (batch.status === "approved" && viewer.canApprove) return "Xem & ghi sổ";
  return "Xem chi tiết";
}

/**
 * Batch list of the session-balance import page (newest first, at most 50):
 * time created, file and reason, effective date, creator, rows, the status
 * word for the viewer and one link per batch. Rendered once at every width:
 * a column header and aligned tracks from a 960px container, labelled cards
 * below. Server-safe (no client hooks besides `useId`).
 */
export function SessionBalanceBatchList({ batches, canApprove, canImport, currentUserId, getBatchHref }: SessionBalanceBatchListProps) {
  const headingId = useId();
  const isCapped = batches.length >= SESSION_BALANCE_BATCH_LIST_LIMIT;

  return (
    <section aria-labelledby={headingId} className="@container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <div>
        <h2 className="text-section-title font-semibold text-text-strong" id={headingId}>
          Danh sách Batch đối soát &amp; Phê duyệt ({formatNumber(batches.length)})
        </h2>
        <p className="mt-0.5 text-secondary text-text-muted">
          Mỗi lô đi qua đối soát → phê duyệt → ghi sổ ở trang lô.
          {isCapped ? ` Chỉ hiện ${formatNumber(SESSION_BALANCE_BATCH_LIST_LIMIT)} lô mới nhất.` : null}
        </p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
        {batches.length === 0 ? (
          <TableState>
            <p className="text-body text-text-muted">Chưa có lô số dư nào.</p>
          </TableState>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="hidden items-center gap-3 bg-table-header px-4 text-table-header font-semibold text-text-muted @min-[960px]:flex @min-[960px]:h-10"
            >
              <div className={`grid min-w-0 flex-1 gap-3 ${COLUMNS}`}>
                <span>Thời gian tạo</span>
                <span>File nguồn / Lý do</span>
                <span>Ngày hiệu lực</span>
                <span>Người tạo</span>
                <span className="text-right">Số dòng</span>
                <span>Trạng thái</span>
              </div>
              <span className="w-[148px] shrink-0" />
            </div>
            <ul aria-label="Các lô số dư buổi" className="m-0 list-none p-0" role="list">
              {batches.map((batch) => {
                const status = getSessionBalanceBatchListStatus(batch, { canApprove, currentUserId });
                const actionLabel = getRowAction(batch, { canApprove, canImport, currentUserId });

                return (
                  <li
                    className="flex min-w-0 flex-col gap-3 border-t border-border-row px-4 py-3 first:border-t-0 hover:bg-table-row-hover @min-[960px]:min-h-14 @min-[960px]:flex-row @min-[960px]:items-center @min-[960px]:py-2"
                    key={batch.id}
                  >
                    <dl className={`m-0 grid min-w-0 flex-1 gap-x-3 gap-y-2 @min-[480px]:grid-cols-2 @min-[960px]:items-center ${COLUMNS}`}>
                      <BatchCell label="Thời gian tạo">
                        <span className="tabular-nums">{formatImportTimestamp(batch.created_at)}</span>
                      </BatchCell>
                      <BatchCell label="File nguồn / Lý do">
                        <p className="break-all font-semibold text-text-strong">{batch.source_filename}</p>
                        {batch.reason ? (
                          <p className="truncate text-caption text-text-muted" title={batch.reason}>
                            {batch.reason}
                          </p>
                        ) : null}
                      </BatchCell>
                      <BatchCell label="Ngày hiệu lực">
                        <span className="tabular-nums">{formatIsoDate(batch.effective_on)}</span>
                      </BatchCell>
                      <BatchCell label="Người tạo">{batch.creator_name || "Không rõ tên"}</BatchCell>
                      <BatchCell align="right" label="Số dòng">
                        <span className="font-semibold tabular-nums text-text-strong">{formatNumber(batch.row_count ?? 0)}</span>
                        {batch.valid_count !== null && batch.valid_count !== undefined ? (
                          <span className="block text-caption tabular-nums text-text-muted">{formatNumber(batch.valid_count)} hợp lệ</span>
                        ) : null}
                      </BatchCell>
                      <BatchCell label="Trạng thái">
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </BatchCell>
                    </dl>
                    <div className="shrink-0 @min-[960px]:flex @min-[960px]:w-[148px] @min-[960px]:justify-end">
                      <Link
                        className={getButtonClassName({ className: "max-md:h-11", size: "sm", variant: "secondary" })}
                        href={getBatchHref(batch.id)}
                      >
                        {actionLabel}
                        <span className="sr-only">, lô {batch.source_filename}</span>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function BatchCell({ align = "left", children, label }: { align?: "left" | "right"; children: ReactNode; label: string }) {
  return (
    <div className={align === "right" ? "min-w-0 @min-[960px]:text-right" : "min-w-0"}>
      <dt className="text-caption text-text-muted @min-[960px]:sr-only">{label}</dt>
      <dd className="m-0 min-w-0 text-body text-text-default">{children}</dd>
    </div>
  );
}
