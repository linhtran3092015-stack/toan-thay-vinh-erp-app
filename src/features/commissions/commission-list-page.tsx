import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import type {
  KnownSalesCommissionAccrualStatus,
  KnownSalesCommissionSourceGroup,
  SalesCommissionAccrualDashboardEntry,
} from "@/features/commissions/read-models";
import type { ReactNode } from "react";

interface CommissionListPageProps {
  canManage: boolean;
  entries: readonly SalesCommissionAccrualDashboardEntry[];
}

type PresentationMetadata = {
  label: string;
  tone: "info" | "neutral" | "warning";
};

const sourceGroupMetadata: Record<KnownSalesCommissionSourceGroup, PresentationMetadata> = {
  mma: { label: "MMA", tone: "info" },
  sandbox: { label: "Sandbox", tone: "warning" },
};

const statusMetadata: Record<KnownSalesCommissionAccrualStatus, PresentationMetadata> = {
  provisional: { label: "Chờ chính sách", tone: "warning" },
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("vi-VN");

function getSourceGroupPresentation(value: string): PresentationMetadata {
  if (Object.hasOwn(sourceGroupMetadata, value)) {
    return sourceGroupMetadata[value as KnownSalesCommissionSourceGroup];
  }

  return {
    label: `Nguồn chưa hỗ trợ: ${value}`,
    tone: "neutral",
  };
}

function getStatusPresentation(value: string): PresentationMetadata {
  if (Object.hasOwn(statusMetadata, value)) {
    return statusMetadata[value as KnownSalesCommissionAccrualStatus];
  }

  return {
    label: `Trạng thái chưa hỗ trợ: ${value}`,
    tone: "neutral",
  };
}

/** Presents immutable, server-provided eligible revenue without calculating commission money. */
export function CommissionListPage({
  canManage,
  entries,
}: CommissionListPageProps) {
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader title="Doanh thu đủ điều kiện hoa hồng">
        <p className="mt-1 max-w-3xl text-secondary text-text-muted">
          Sổ ghi nhận doanh thu đủ điều kiện theo nguồn MMA và Sandbox. Dữ liệu này chưa phải khoản hoa hồng, lương hoặc chi trả.
        </p>
      </PageHeader>

      {entries.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border-strong bg-surface-base px-6 py-12 text-center">
          <h2 className="text-section-title text-text-strong">Chưa có doanh thu đủ điều kiện</h2>
          <p className="mx-auto mt-2 max-w-xl text-secondary leading-6 text-text-muted">
            Các khoản thu hợp lệ trong phạm vi dữ liệu của tài khoản hiện tại sẽ xuất hiện tại đây.
          </p>
        </section>
      ) : (
        <section aria-labelledby="commission-directory-heading" className="grid gap-4">
          <div>
            <h2 className="text-section-title text-text-strong" id="commission-directory-heading">
              Danh sách doanh thu đủ điều kiện
            </h2>
            <p className="mt-1 text-secondary text-text-muted">
              Hiển thị tối đa 200 bản ghi mới nhất theo thứ tự hệ thống ghi nhận.
            </p>
          </div>

          <CommissionDirectory canManage={canManage} entries={entries} />
        </section>
      )}
    </div>
  );
}

function CommissionDirectory({
  canManage,
  entries,
}: {
  canManage: boolean;
  entries: readonly SalesCommissionAccrualDashboardEntry[];
}) {
  return (
    <div className="commission-directory-work-area min-w-0">
      <DataTableFrame
        body={entries.map((entry) => (
          <CommissionTableRow canManage={canManage} entry={entry} key={entry.id} />
        ))}
        caption="Danh sách doanh thu đủ điều kiện hoa hồng"
        className="commission-directory-table"
        header={
          <tr>
            <TableHeader>Học sinh</TableHeader>
            {canManage ? <TableHeader>Người phụ trách</TableHeader> : null}
            <TableHeader>Nguồn</TableHeader>
            <TableHeader className="text-right">Doanh thu đủ điều kiện</TableHeader>
            <TableHeader>Trạng thái</TableHeader>
            <TableHeader>Ghi nhận lúc</TableHeader>
          </tr>
        }
        tableClassName="min-w-[1120px] table-fixed text-table-body text-text-default"
      />

      <ResponsiveRecordList
        className="commission-directory-record-list p-4"
        label="Danh sách doanh thu đủ điều kiện hoa hồng"
      >
        {entries.map((entry) => (
          <CommissionRecord canManage={canManage} entry={entry} key={entry.id} />
        ))}
      </ResponsiveRecordList>
    </div>
  );
}

function CommissionTableRow({
  canManage,
  entry,
}: {
  canManage: boolean;
  entry: SalesCommissionAccrualDashboardEntry;
}) {
  const source = getSourceGroupPresentation(entry.leadSourceGroup);
  const status = getStatusPresentation(entry.status);

  return (
    <tr className="align-top hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[190px]"><StudentIdentity entry={entry} /></TableCell>
      {canManage ? <TableCell className="w-[180px]"><SaleOwner entry={entry} /></TableCell> : null}
      <TableCell className="w-[190px]"><SourceContext entry={entry} source={source} /></TableCell>
      <TableCell className="w-[190px] text-right tabular-nums font-semibold text-text-strong">
        {formatCurrency(entry.recognizedRevenueVnd)}
      </TableCell>
      <TableCell className="w-[160px]"><Badge tone={status.tone}>{status.label}</Badge></TableCell>
      <TableCell className="w-[180px] tabular-nums">{formatDateTime(entry.recognizedAt)}</TableCell>
    </tr>
  );
}

function CommissionRecord({
  canManage,
  entry,
}: {
  canManage: boolean;
  entry: SalesCommissionAccrualDashboardEntry;
}) {
  const source = getSourceGroupPresentation(entry.leadSourceGroup);
  const status = getStatusPresentation(entry.status);

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base p-4" role="listitem">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StudentIdentity entry={entry} />
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <p className="mt-3 text-lg font-semibold tabular-nums text-text-strong">
        {formatCurrency(entry.recognizedRevenueVnd)}
      </p>

      <dl className="mt-4 grid gap-3 text-secondary text-text-default">
        <RecordField content={<SourceContext entry={entry} source={source} />} label="Nguồn" />
        {canManage ? <RecordField content={<SaleOwner entry={entry} />} label="Người phụ trách" /> : null}
        <RecordField label="Ghi nhận lúc" value={formatDateTime(entry.recognizedAt)} />
      </dl>
    </article>
  );
}

function StudentIdentity({ entry }: { entry: SalesCommissionAccrualDashboardEntry }) {
  return (
    <div>
      <p className="font-semibold text-text-strong">{entry.studentFullName}</p>
      <p className="mt-0.5 text-caption font-medium tabular-nums text-text-muted">
        {entry.studentPublicCode}
      </p>
    </div>
  );
}

function SaleOwner({ entry }: { entry: SalesCommissionAccrualDashboardEntry }) {
  return (
    <div>
      <p className="font-medium text-text-strong">{entry.saleOwnerDisplayName}</p>
      {entry.saleOwnerEmployeeCode ? (
        <p className="mt-0.5 text-caption tabular-nums text-text-muted">{entry.saleOwnerEmployeeCode}</p>
      ) : null}
    </div>
  );
}

function SourceContext({
  entry,
  source,
}: {
  entry: SalesCommissionAccrualDashboardEntry;
  source: PresentationMetadata;
}) {
  return (
    <div className="grid gap-1.5">
      <Badge tone={source.tone}>{source.label}</Badge>
      <p className="break-words text-caption text-text-default">{entry.leadSourceName}</p>
      <p className="text-caption tabular-nums text-text-muted">{entry.leadSourceCode}</p>
    </div>
  );
}

function RecordField({
  content,
  label,
  value,
}: {
  content?: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div>
      <dt className="text-caption font-semibold text-text-muted">{label}</dt>
      <dd className="mt-1">{content ?? value}</dd>
    </div>
  );
}

function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}

function TableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-semibold ${className ?? ""}`} scope="col">{children}</th>;
}

function formatCurrency(value: number): string {
  return `${currencyFormatter.format(value)} VND`;
}

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}
