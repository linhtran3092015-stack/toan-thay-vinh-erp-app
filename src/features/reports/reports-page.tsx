import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  REPORT_CATALOG,
  type ReportCatalogItem,
} from "@/features/reports/catalog";
import type { PermissionCode } from "@/lib/permissions/types";

interface ReportsPageProps {
  permissions: readonly PermissionCode[];
}

export function ReportsPage({
  permissions,
}: ReportsPageProps) {
  const permissionSet =
    new Set<PermissionCode>(permissions);

  const visibleReports =
    REPORT_CATALOG.filter((report) =>
      permissionSet.has(
        report.requiredPermission,
      ),
    );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          Báo cáo
        </p>

        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
          Báo cáo & Xuất dữ liệu
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">
          Mỗi báo cáo chỉ xuất hiện khi tài
          khoản có quyền xem module nghiệp
          vụ tương ứng. Dữ liệu tiếp tục bị
          giới hạn bởi quyền database và RLS.
        </p>
      </header>

      {visibleReports.length === 0 ? (
        <section className="rounded-xl border border-dashed border-hairline-strong bg-surface-1 p-8 text-center shadow-xs">
          <h2 className="font-display text-lg font-bold text-ink">
            Chưa có báo cáo phù hợp
          </h2>

          <p className="mt-2 text-sm text-ink-muted">
            Tài khoản hiện tại chưa có quyền
            xem module nghiệp vụ nào được đưa
            vào trung tâm Báo cáo.
          </p>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {visibleReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  report,
}: {
  report: ReportCatalogItem;
}) {
  const exportHref =
    report.availability === "available"
      ? report.exportHref
      : undefined;

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">
            {report.title}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            {report.description}
          </p>
        </div>

        <span
          className={
            exportHref
              ? "rounded-full bg-success-bg px-3 py-1 text-xs font-semibold text-success"
              : "rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-muted"
          }
        >
          {exportHref
            ? "Có thể xuất"
            : "Sắp triển khai"}
        </span>
      </div>

      <p className="mt-4 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-muted">
        {report.scopeNote}
      </p>

      {exportHref ? (
        <SessionsExportForm
          action={exportHref}
        />
      ) : (
        <p className="mt-5 text-sm text-ink-muted">
          Bộ cột xuất dữ liệu đang chờ review
          bảo mật trước khi được kích hoạt.
        </p>
      )}
    </section>
  );
}

function SessionsExportForm({
  action,
}: {
  action: string;
}) {
  return (
    <form
      action={action}
      className="mt-5 space-y-4"
      method="get"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Từ ngày</span>

          <input
            className={inputClassName}
            name="dateFrom"
            type="date"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Đến ngày</span>

          <input
            className={inputClassName}
            name="dateTo"
            type="date"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">
          Tải CSV buổi học
        </Button>

        <Link
          className="text-sm font-semibold text-primary hover:underline"
          href="/sessions"
        >
          Mở danh sách buổi học
        </Link>
      </div>

      <p className="text-xs leading-relaxed text-ink-muted">
        File dùng UTF-8, tương thích Excel và
        chỉ chứa tối đa 300 buổi gần nhất
        trong phạm vi truy cập.
      </p>
    </form>
  );
}

const inputClassName =
  "h-11 min-w-0 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20";
