import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { RequestSalaryAdvanceDialog } from "@/features/advances/components/request-salary-advance-dialog";
import { SalaryAdvanceDecisionDialog } from "@/features/advances/components/salary-advance-decision-dialog";
import type {
  KnownSalaryAdvanceStatus,
  SalaryAdvanceDashboardEntry,
} from "@/features/advances/read-models";
import type { ReactNode } from "react";

interface AdvanceListPageProps {
  canApprove: boolean;
  canRequest: boolean;
  canReview: boolean;
  entries: readonly SalaryAdvanceDashboardEntry[];
}

type AdvanceStatusPresentation = {
  label: string;
  tone: "danger" | "info" | "neutral" | "success" | "warning";
};

const statusMetadata: Record<KnownSalaryAdvanceStatus, AdvanceStatusPresentation> = {
  approved: { label: "Đã phê duyệt", tone: "success" },
  deducted: { label: "Đã khấu trừ", tone: "info" },
  rejected: { label: "Đã từ chối", tone: "danger" },
  requested: { label: "Chờ đối soát", tone: "warning" },
  review: { label: "Chờ phê duyệt", tone: "warning" },
};

function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getStatusPresentation(status: string): AdvanceStatusPresentation {
  if (Object.hasOwn(statusMetadata, status)) {
    return statusMetadata[status as KnownSalaryAdvanceStatus];
  }

  return {
    label: `Trạng thái chưa hỗ trợ: ${status}`,
    tone: "neutral",
  };
}

/** Presents the server-provided Salary Advance directory without deriving financial state. */
export function AdvanceListPage({
  canApprove,
  canRequest,
  canReview,
  entries,
}: AdvanceListPageProps) {
  const canManageLifecycle = canReview || canApprove;

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        actions={canRequest ? <RequestSalaryAdvanceDialog /> : undefined}
        title="Tạm ứng lương"
      >
        <p className="mt-1 max-w-3xl text-secondary text-text-muted">
          Theo dõi yêu cầu tạm ứng và trạng thái khấu trừ do hệ thống Payroll ghi nhận.
        </p>
      </PageHeader>

      {entries.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border-strong bg-surface-base px-6 py-12 text-center">
          <h2 className="text-section-title text-text-strong">Chưa có yêu cầu tạm ứng</h2>
          <p className="mx-auto mt-2 max-w-lg text-secondary leading-6 text-text-muted">
            Các yêu cầu trong phạm vi dữ liệu của tài khoản hiện tại sẽ xuất hiện tại đây.
          </p>
        </section>
      ) : (
        <section aria-labelledby="salary-advance-directory-heading" className="grid gap-4">
          <div>
            <h2 className="text-section-title text-text-strong" id="salary-advance-directory-heading">
              Danh sách yêu cầu tạm ứng
            </h2>
            <p className="mt-1 text-secondary text-text-muted">
              Trạng thái và thông tin theo dõi được cung cấp bởi hệ thống.
            </p>
          </div>

          <AdvanceDirectory
            canApprove={canApprove}
            canManageLifecycle={canManageLifecycle}
            canReview={canReview}
            entries={entries}
          />
        </section>
      )}
    </div>
  );
}

function AdvanceDirectory({
  canApprove,
  canManageLifecycle,
  canReview,
  entries,
}: {
  canApprove: boolean;
  canManageLifecycle: boolean;
  canReview: boolean;
  entries: readonly SalaryAdvanceDashboardEntry[];
}) {
  return (
    <div className="salary-advance-directory-work-area min-w-0">
      <DataTableFrame
        body={entries.map((entry) => (
          <AdvanceTableRow
            canApprove={canApprove}
            canReview={canReview}
            entry={entry}
            key={entry.id}
          />
        ))}
        caption="Danh sách yêu cầu tạm ứng lương"
        className="salary-advance-directory-table"
        header={
          <tr>
            <TableHeader>Nhân sự</TableHeader>
            <TableHeader className="text-right">Số tiền</TableHeader>
            <TableHeader>Kỳ khấu trừ</TableHeader>
            <TableHeader>Trạng thái</TableHeader>
            <TableHeader>Yêu cầu</TableHeader>
            <TableHeader>Theo dõi</TableHeader>
            {canManageLifecycle ? <TableHeader>Thao tác</TableHeader> : null}
          </tr>
        }
        tableClassName="min-w-[1200px] table-fixed text-table-body text-text-default"
      />

      <ResponsiveRecordList
        className="salary-advance-directory-record-list p-4"
        label="Danh sách yêu cầu tạm ứng lương"
      >
        {entries.map((entry) => (
          <AdvanceRecord
            canApprove={canApprove}
            canReview={canReview}
            entry={entry}
            key={entry.id}
          />
        ))}
      </ResponsiveRecordList>
    </div>
  );
}

function AdvanceTableRow({
  canApprove,
  canReview,
  entry,
}: {
  canApprove: boolean;
  canReview: boolean;
  entry: SalaryAdvanceDashboardEntry;
}) {
  const status = getStatusPresentation(entry.status);

  return (
    <tr className="align-top hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[190px]">
        <StaffIdentity entry={entry} />
      </TableCell>
      <TableCell className="w-[144px] text-right tabular-nums font-semibold text-text-strong">
        {formatCurrency(entry.amountVnd)}
      </TableCell>
      <TableCell className="w-[154px] tabular-nums">{formatMonth(entry.deductionPeriodMonth)}</TableCell>
      <TableCell className="w-[150px]">
        <Badge tone={status.tone}>{status.label}</Badge>
      </TableCell>
      <TableCell className="w-[242px]">
        <RequestContext entry={entry} />
      </TableCell>
      <TableCell className="w-[250px]">
        <AdvanceLifecycle entry={entry} />
      </TableCell>
      {canReview || canApprove ? (
        <TableCell className="w-[150px]">
          <AdvanceAction canApprove={canApprove} canReview={canReview} entry={entry} />
        </TableCell>
      ) : null}
    </tr>
  );
}

function AdvanceRecord({
  canApprove,
  canReview,
  entry,
}: {
  canApprove: boolean;
  canReview: boolean;
  entry: SalaryAdvanceDashboardEntry;
}) {
  const status = getStatusPresentation(entry.status);

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base p-4" role="listitem">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StaffIdentity entry={entry} />
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <p className="mt-3 text-lg font-semibold tabular-nums text-text-strong">
        {formatCurrency(entry.amountVnd)}
      </p>

      <dl className="mt-4 grid gap-3 text-secondary text-text-default">
        <RecordField label="Kỳ khấu trừ" value={formatMonth(entry.deductionPeriodMonth)} />
        <RecordField content={<RequestContext entry={entry} />} label="Yêu cầu" />
        <RecordField content={<AdvanceLifecycle entry={entry} />} label="Theo dõi" />
      </dl>

      {canReview || canApprove ? (
        <div className="mt-4 border-t border-border-subtle pt-4">
          <AdvanceAction canApprove={canApprove} canReview={canReview} entry={entry} />
        </div>
      ) : null}
    </article>
  );
}

function StaffIdentity({ entry }: { entry: SalaryAdvanceDashboardEntry }) {
  return (
    <div>
      <p className="font-semibold text-text-strong">{entry.staffDisplayName}</p>
      {entry.staffEmployeeCode ? (
        <p className="mt-0.5 text-caption font-medium tabular-nums text-text-muted">
          {entry.staffEmployeeCode}
        </p>
      ) : null}
    </div>
  );
}

function RequestContext({ entry }: { entry: SalaryAdvanceDashboardEntry }) {
  return (
    <div className="grid gap-1.5">
      <p className="break-words text-text-default">{entry.requestNote}</p>
      <p className="text-caption tabular-nums text-text-muted">
        {formatDateTime(entry.requestedAt)}
      </p>
    </div>
  );
}

function AdvanceAction({
  canApprove,
  canReview,
  entry,
}: {
  canApprove: boolean;
  canReview: boolean;
  entry: SalaryAdvanceDashboardEntry;
}) {
  if (entry.status === "requested" && canReview) {
    return <SalaryAdvanceDecisionDialog advance={entry} stage="review" />;
  }

  if (entry.status === "review" && canApprove) {
    return <SalaryAdvanceDecisionDialog advance={entry} stage="approve" />;
  }

  return <span className="text-secondary text-text-muted">Không có thao tác</span>;
}

function AdvanceLifecycle({ entry }: { entry: SalaryAdvanceDashboardEntry }) {
  if (entry.status === "requested") {
    return <p>Đang chờ đối soát.</p>;
  }

  if (entry.status === "review") {
    return (
      <LifecycleDetail
        actor={entry.reviewedByDisplayName}
        note={entry.reviewNote}
        timestamp={entry.reviewedAt}
        verb="Đã đối soát"
      />
    );
  }

  if (entry.status === "approved") {
    return (
      <LifecycleDetail
        actor={entry.approvedByDisplayName}
        note={entry.approvalNote}
        timestamp={entry.approvedAt}
        verb="Đã phê duyệt"
      />
    );
  }

  if (entry.status === "deducted") {
    return <p>Đã khấu trừ {formatDateTime(entry.deductedAt)}.</p>;
  }

  if (entry.status === "rejected") {
    return (
      <LifecycleDetail
        actor={entry.rejectedByDisplayName}
        note={entry.rejectionReason}
        timestamp={entry.rejectedAt}
        verb="Đã từ chối"
      />
    );
  }

  return <p>Không thể diễn giải trạng thái này.</p>;
}

function LifecycleDetail({
  actor,
  note,
  timestamp,
  verb,
}: {
  actor: string | null;
  note: string | null;
  timestamp: string | null;
  verb: string;
}) {
  return (
    <div className="grid gap-1.5">
      <p>
        {verb} {actor ? `bởi ${actor} ` : ""}{formatDateTime(timestamp)}.
      </p>
      {note ? <p className="break-words text-caption text-text-muted">{note}</p> : null}
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
