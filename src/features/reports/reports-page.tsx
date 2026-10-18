import Link from "next/link";

import { TableState } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  REPORT_CATALOG,
  type ReportCatalogItem,
} from "@/features/reports/catalog";
import { SessionExportDialog } from "@/features/reports/components/session-export-dialog";
import { formatNumber } from "@/lib/format";
import { permissionLabel } from "@/lib/permissions/labels";
import type { PermissionCode } from "@/lib/permissions/types";

interface ReportsPageProps {
  /**
   * /dev preview only: the export dialog validates, then announces this instead
   * of submitting to the production-backed export route.
   */
  exportPreviewNotice?: string;
  permissions: readonly PermissionCode[];
  /** /dev preview only: keeps "Mở danh sách buổi học" on /dev. Defaults to the real list. */
  sessionListHref?: string;
}

/**
 * /reports (design 16a "Báo cáo"): the catalog as a card grid. Cards the user
 * lacks the module permission for stay hidden (they would advertise exports the
 * account can never run); planned cards show a disabled "Xuất CSV". No primary
 * action: there are several cards. Server-renderable; the export form is the
 * only client island.
 */
export function ReportsPage({
  exportPreviewNotice,
  permissions,
  sessionListHref = "/sessions",
}: ReportsPageProps) {
  const permissionSet = new Set<PermissionCode>(permissions);
  const visibleReports = REPORT_CATALOG.filter((report) =>
    permissionSet.has(report.requiredPermission),
  );
  // Same test as the card's badge and footer, so the header never counts a card that shows "Dự kiến".
  const availableCount = visibleReports.filter((report) => getExportHref(report) !== undefined).length;

  return (
    <div className="@container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="Báo cáo & Xuất dữ liệu">
        <p className="mt-1 text-secondary tabular-nums text-text-muted">
          {`${formatNumber(visibleReports.length)} báo cáo theo quyền của bạn · ${formatNumber(availableCount)} có sẵn`}
        </p>
        <p className="mt-1 text-caption text-text-muted">
          Báo cáo chỉ hiện khi tài khoản có quyền xem module tương ứng; dữ liệu xuất vẫn theo quyền database.
        </p>
      </PageHeader>

      {visibleReports.length === 0 ? (
        <section
          aria-labelledby="reports-empty-title"
          className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]"
        >
          <TableState>
            <h2 className="text-body font-semibold text-text-strong" id="reports-empty-title">
              Chưa có báo cáo phù hợp
            </h2>
            <p className="max-w-xl text-secondary text-text-muted">
              Tài khoản hiện tại chưa có quyền xem module nghiệp vụ nào được đưa vào trung tâm Báo cáo.
            </p>
          </TableState>
        </section>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @min-[720px]:grid-cols-2">
          {visibleReports.map((report) => (
            <ReportCard
              exportPreviewNotice={exportPreviewNotice}
              key={report.id}
              report={report}
              sessionListHref={sessionListHref}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** An available report with a route to export from; anything else renders as planned. */
function getExportHref(report: ReportCatalogItem): string | undefined {
  return report.availability === "available" ? report.exportHref : undefined;
}

function ReportCard({
  exportPreviewNotice,
  report,
  sessionListHref,
}: {
  exportPreviewNotice?: string;
  report: ReportCatalogItem;
  sessionListHref: string;
}) {
  const titleId = `report-${report.id.replaceAll(".", "-")}-title`;
  const exportHref = getExportHref(report);
  const columnNote = report.exportColumnNote ?? null;

  return (
    <Card aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h2 className="min-w-0 text-section-title font-semibold text-text-strong" id={titleId}>
          {report.title}
        </h2>
        {exportHref ? (
          <Badge tone="success">Có sẵn</Badge>
        ) : (
          <Badge tone="neutral">Dự kiến</Badge>
        )}
      </div>

      <p className="text-secondary text-text-default">{report.description}</p>

      <div className="grid gap-1.5 rounded-md bg-surface-raised px-3 py-2.5">
        <p className="text-secondary text-text-default">
          <span className="font-medium text-text-strong">Phạm vi: </span>
          {report.scopeNote}
        </p>
        <p className="text-secondary text-text-muted">
          {`Cần quyền: ${permissionLabel(report.requiredPermission)}`}
        </p>
        {columnNote ? (
          <p className="text-caption text-text-muted">{columnNote}</p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle pt-4">
        {exportHref ? (
          <>
            <SessionExportDialog
              exportHref={exportHref}
              previewNotice={exportPreviewNotice}
              reportTitle={report.title}
            />
            <Link
              className="inline-flex min-h-10 items-center rounded-sm text-secondary font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus max-md:min-h-11"
              href={sessionListHref}
            >
              Mở danh sách buổi học
            </Link>
          </>
        ) : (
          <>
            <Button
              aria-label={`Xuất CSV: ${report.title}`}
              disabled
              disabledReason="Chưa phát hành"
              variant="secondary"
            >
              Xuất CSV
            </Button>
            <p className="min-w-0 basis-full text-secondary text-text-muted">
              Bộ cột xuất dữ liệu đang chờ review bảo mật trước khi được kích hoạt.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
