import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { SessionBalanceBadge } from "@/features/students/components/session-balance-badge";
import { formatDeltaSessions } from "@/features/students/detail/helpers";
import { formatLedgerEntryType } from "@/features/students/ledger-labels";
import type { StudentLedgerReadModel } from "@/features/students/ledger-data";
import { formatIsoDate } from "@/lib/datetime";

interface StudentSessionLedgerCardProps {
  summary: StudentLedgerReadModel | null;
  /** Rows shown before the footer notes the rest. */
  limit?: number;
}

const header = (
  <tr>
    <TableHeaderCell className="w-[110px]">Ngày</TableHeaderCell>
    <TableHeaderCell>Loại phát sinh</TableHeaderCell>
    <TableHeaderCell className="w-[90px]" numeric>
      Số buổi
    </TableHeaderCell>
    <TableHeaderCell className="w-[90px]" numeric>
      Số dư sau
    </TableHeaderCell>
    <TableHeaderCell className="w-[140px]">Tham chiếu</TableHeaderCell>
    <TableHeaderCell>Ghi chú</TableHeaderCell>
  </tr>
);

/** Session ledger (design 05a): alerts, three totals, then the entries in a table frame. */
export function StudentSessionLedgerCard({ limit = 30, summary }: StudentSessionLedgerCardProps) {
  const visible = summary?.entries.slice(0, limit) ?? [];

  return (
    <section aria-labelledby="student-ledger-title" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-body font-semibold text-text-strong" id="student-ledger-title">
          Sổ cái số buổi học
        </h3>
        {summary ? <SessionBalanceBadge balance={summary.balanceSessions} /> : null}
      </div>

      {summary?.alerts.map((alert, index) => (
        <ResultBanner description={alert.description} key={`${alert.alertType}-${index}`} title={alert.title} tone={alert.severity} />
      ))}

      {summary ? (
        <dl className="grid grid-cols-3 divide-x divide-border-row rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
          <LedgerTotal label="Số dư hiện tại" value={`${summary.balanceSessions} buổi`} />
          <LedgerTotal label="Tổng đã cộng" tone="success" value={`+${summary.totalCreditSessions} buổi`} />
          <LedgerTotal label="Tổng đã trừ" tone="danger" value={`−${summary.totalDebitSessions} buổi`} />
        </dl>
      ) : null}

      <DataTableFrame
        body={visible.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="whitespace-nowrap text-text-muted">{formatIsoDate(entry.effectiveOn)}</TableCell>
            <TableCell>
              <Badge tone="neutral">{formatLedgerEntryType(entry.entryType)}</Badge>
            </TableCell>
            <TableCell
              className={entry.deltaSessions > 0 ? "font-semibold text-success" : "font-semibold text-danger"}
              numeric
            >
              {formatDeltaSessions(entry.deltaSessions)}
            </TableCell>
            <TableCell className="font-semibold text-text-strong" numeric>
              {entry.balanceAfter}
            </TableCell>
            <TableCell className="whitespace-nowrap text-text-muted">{entry.referenceCode ?? "—"}</TableCell>
            <TableCell className="max-w-[240px] truncate text-text-muted">{entry.note}</TableCell>
          </TableRow>
        ))}
        caption="Sổ cái số buổi học của học sinh"
        empty={<TableState>Học viên chưa có lịch sử phát sinh số buổi.</TableState>}
        error={<TableState>Không tải được dữ liệu sổ cái số buổi.</TableState>}
        footer={
          summary && summary.entries.length > 0 ? (
            <span>
              Hiển thị {visible.length}/{summary.ledgerEntryCount} phát sinh
              {summary.latestEntryAt ? ` · mới nhất ${formatIsoDate(summary.latestEntryAt)}` : ""}
            </span>
          ) : undefined
        }
        header={header}
        status={!summary ? "error" : visible.length === 0 ? "empty" : "ready"}
      />
    </section>
  );
}

function LedgerTotal({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "success" | "danger";
  value: string;
}) {
  const valueClassName =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-text-strong";

  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="text-secondary text-text-muted">{label}</dt>
      <dd className={`mt-0.5 text-body font-semibold tabular-nums ${valueClassName}`}>{value}</dd>
    </div>
  );
}
