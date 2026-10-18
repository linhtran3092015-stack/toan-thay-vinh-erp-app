import Link from "next/link";
import type { ReactNode } from "react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getButtonClassName } from "@/components/ui/button";
import { PaymentRequestStatusBadge } from "@/features/finance/components/payment-request-status-badge";
import { getFinanceOverviewResult } from "@/features/finance/data";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function FinanceOverviewPage() {
  const permissionResult = await getCachedDatabasePermissions();
  if (!permissionResult.ok) return <ErrorState description="Hệ thống chưa tải được quyền truy cập Tài chính." title="Không tải được quyền truy cập" />;
  if (!permissionResult.permissions.includes("finance.view")) return <PermissionDeniedState description={permissionDeniedDescription("finance.view")} title="Không có quyền xem Tổng quan Tài chính" />;

  // students.view gates every student hop: /finance/payment-requests/new and /students/{id} refuse without it.
  const canViewStudents = permissionResult.permissions.includes("students.view");
  // Same gate as the list's "Tạo yêu cầu".
  const canCreatePaymentRequests =
    (permissionResult.permissions.includes("payments.create_request") || permissionResult.permissions.includes("payments.manage")) && canViewStudents;
  const canViewPaymentRequests = permissionResult.permissions.includes("payments.view") || permissionResult.permissions.includes("payments.manage");
  const overviewResult = await getFinanceOverviewResult();
  if (!overviewResult.ok) return <ErrorState description="Hệ thống chưa tải được dữ liệu học phí. Vui lòng thử lại sau." title="Không tải được dữ liệu tài chính" />;
  const overview = overviewResult.data;

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader
        actions={canCreatePaymentRequests ? <Link className={getButtonClassName({ className: "max-md:h-11" })} href="/finance/payment-requests/new">Tạo yêu cầu thanh toán</Link> : undefined}
        title="Học phí & Tài chính"
      >
        <p className="mt-1 text-secondary text-text-muted">Theo dõi số liệu học phí hiện có và các yêu cầu thanh toán gần đây.</p>
      </PageHeader>

      <section aria-label="Tóm tắt tài chính hiện có" className="grid gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle sm:grid-cols-3">
        <OverviewMetric label="Tổng thu học phí thực tế" value={formatCurrency(overview.cashflowSummary.receiptVnd)} />
        <OverviewMetric label="Tổng chi hoàn phí" value={formatCurrency(overview.cashflowSummary.refundVnd)} />
        <OverviewMetric label="Số yêu cầu nạp tiền" value={String(overview.totalPaymentRequestsCount)} />
      </section>

      <section className="finance-overview-recent grid min-w-0 gap-3" aria-labelledby="recent-payment-requests-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-section-title font-semibold text-text-strong" id="recent-payment-requests-title">Yêu cầu thanh toán gần đây</h2><p className="mt-1 text-secondary text-text-muted">Danh sách yêu cầu VietQR mới nhất đang có trong hệ thống.</p></div>
          {canViewPaymentRequests ? <Link className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-control font-semibold text-action-link! hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href="/finance/payment-requests">Xem tất cả</Link> : null}
        </div>
        {overview.recentPaymentRequests.length === 0 ? <p className="rounded-lg border border-border-subtle bg-surface-base px-4 py-5 text-secondary text-text-muted">Chưa có yêu cầu nạp tiền nào được khởi tạo.</p> : <RecentPaymentRequests canViewStudents={canViewStudents} items={overview.recentPaymentRequests} />}
      </section>
    </div>
  );
}

function RecentPaymentRequests({ canViewStudents, items }: { canViewStudents: boolean; items: PaymentRequestReadModel[] }) {
  return <>
    <DataTableFrame
      body={items.map((item) => <tr className="hover:bg-[var(--table-row-hover)]" key={item.id}><td className="h-14 px-3 font-mono text-caption font-semibold text-text-muted">{item.publicCode}</td><td className="h-14 px-3"><StudentName canViewStudents={canViewStudents} item={item} /><p className="mt-0.5 font-mono text-caption text-text-muted">{item.studentPublicCode}</p></td><td className="h-14 px-3 break-all font-mono text-caption font-semibold text-action-link">{item.transferCode}</td><td className="h-14 px-3 text-right tabular-nums font-semibold text-text-strong">{formatCurrency(item.expectedAmountVnd)}</td><td className="h-14 px-3 text-secondary text-text-muted"><span className="tabular-nums font-semibold text-text-default">{item.purchasedSessions}</span> buổi{item.bonusSessions > 0 ? ` · +${item.bonusSessions} tặng` : ""}</td><td className="h-14 px-3"><PaymentRequestStatusBadge status={item.status} /></td></tr>)}
      caption="Yêu cầu thanh toán gần đây"
      className="finance-overview-recent-table"
      header={<tr><Header>Mã yêu cầu</Header><Header>Học viên</Header><Header>Nội dung chuyển khoản</Header><Header className="text-right">Số tiền dự kiến</Header><Header>Buổi học</Header><Header>Trạng thái</Header></tr>}
      tableClassName="min-w-[960px] text-table-body text-text-default"
    />
    <ResponsiveRecordList className="finance-overview-recent-record-list" label="Yêu cầu thanh toán gần đây">
      {items.map((item) => <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3" key={item.id} role="listitem"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><StudentName canViewStudents={canViewStudents} item={item} /><p className="mt-0.5 font-mono text-caption text-text-muted">{item.publicCode} · {item.studentPublicCode}</p></div><PaymentRequestStatusBadge status={item.status} /></div><p className="mt-3 tabular-nums font-semibold text-text-strong">{formatCurrency(item.expectedAmountVnd)}</p><p className="mt-1 break-all font-mono text-caption text-action-link">{item.transferCode}</p><p className="mt-1 text-secondary text-text-muted">{item.purchasedSessions} buổi mua{item.bonusSessions > 0 ? ` · +${item.bonusSessions} buổi tặng` : ""}</p></article>)}
    </ResponsiveRecordList>
  </>;
}

/** The profile link only for viewers who can open /students/{id}; plain text otherwise. */
function StudentName({ canViewStudents, item }: { canViewStudents: boolean; item: PaymentRequestReadModel }) {
  if (!canViewStudents) return <span className="font-semibold text-text-strong">{item.studentFullName}</span>;
  return <Link className="font-semibold text-action-link! hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={`/students/${item.studentId}`}>{item.studentFullName}</Link>;
}

function OverviewMetric({ label, value }: { label: string; value: string }) { return <div className="bg-surface-base px-4 py-3"><p className="text-label text-text-muted">{label}</p><p className="mt-1 tabular-nums text-numeric text-text-strong">{value}</p></div>; }
function Header({ children, className = "" }: { children: ReactNode; className?: string }) { return <th className={`h-10 border-b border-border-subtle px-3 text-left font-semibold ${className}`} scope="col">{children}</th>; }
const currencyFormatter = new Intl.NumberFormat("vi-VN", { currency: "VND", maximumFractionDigits: 0, style: "currency" });
function formatCurrency(value: number) { return currencyFormatter.format(value); }
