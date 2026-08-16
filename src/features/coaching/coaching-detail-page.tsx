import Link from "next/link";

import {
  CoachingPriorityBadge,
  CoachingStatusBadge,
} from "@/features/coaching/coaching-list-page";
import { CoachingEventActions } from "@/features/coaching/components/coaching-event-actions";
import type {
  CoachingRecordDashboardEntry,
  CoachingRecordEvent,
} from "@/features/coaching/read-models";
import { CoachingPublicLinkPanel } from "@/features/coaching/components/coaching-public-link-panel";
import type { CoachingFormSummary, CoachingPublicLinkSummary, CoachingRecordResponseSummary } from "@/features/coaching/coaching-form-data";

interface CoachingDetailPageProps {
  canManage: boolean;
  events: readonly CoachingRecordEvent[];
  record: CoachingRecordDashboardEntry;
  forms?: CoachingFormSummary[];
  responses?: CoachingRecordResponseSummary[];
  links?: CoachingPublicLinkSummary[];
  canManageLinks?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const eventLabels: Record<CoachingRecordEvent["eventType"], string> = {
  note_added: "Ghi chú",
  opened: "Mở phiếu",
  outcome_recorded: "Ghi nhận kết quả",
  status_changed: "Cập nhật trạng thái",
};

export function CoachingDetailPage({
  canManage,
  events,
  record,
  forms = [],
  responses = [],
  links = [],
  canManageLinks = false,
}: CoachingDetailPageProps) {
  return (
    <div className="grid gap-5">
      <header className="rounded-lg border border-hairline bg-surface-1 p-5 shadow-card">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Link className="font-semibold text-primary hover:underline" href="/coaching">
            Coaching
          </Link>
          <span>/</span>
          <span className="font-semibold text-ink">{record.campaignName}</span>
        </nav>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
              Phiếu coaching
            </p>
            <h1 className="mt-1 text-page-title font-bold text-ink">{record.campaignName}</h1>
            <p className="mt-2 text-sm text-ink-muted">
              {record.studentFullName} · {record.studentPublicCode}
            </p>
          </div>
          <div className="grid justify-items-start gap-3 md:justify-items-end">
            <div className="flex flex-wrap gap-2">
              <CoachingPriorityBadge priority={record.priority} />
              <CoachingStatusBadge status={record.currentStatus} />
            </div>
            {canManage ? (
              <CoachingEventActions
                coachingRecordId={record.id}
                currentStatus={record.currentStatus}
              />
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Thông tin coaching">
        <DetailCard label="Người phụ trách" value={record.assistantOwnerDisplayName} />
        <DetailCard label="Ngày mở" value={formatDateTime(record.openedAt)} />
        <DetailCard label="Ngày xem lại" value={formatDate(record.reviewAt)} />
        <DetailCard label="Kết quả gần nhất" value={record.latestOutcome ?? "Chưa ghi nhận"} />
      </section>

      <section className="rounded-lg border border-hairline bg-surface-1 p-5 shadow-card">
        <h2 className="text-section font-semibold text-ink">Lý do theo dõi</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">
          {record.reason}
        </p>
      </section>

      <section className="rounded-lg border border-hairline bg-surface-1 shadow-card">
        <div className="border-b border-hairline px-5 py-4">
          <h2 className="text-section font-semibold text-ink">Lịch sử phiếu</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Mọi thay đổi được ghi thành sự kiện mới; lịch sử cũ không bị ghi đè.
          </p>
        </div>
        {events.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-ink-muted">Chưa có sự kiện nào được ghi nhận.</p>
          </div>
        ) : (
          <ol className="divide-y divide-hairline">
            {events.map((event) => (
              <li className="grid gap-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto]" key={event.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">{eventLabels[event.eventType]}</h3>
                    {event.status ? <CoachingStatusBadge status={event.status} /> : null}
                  </div>
                  {event.note ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">
                      {event.note}
                    </p>
                  ) : null}
                  {event.outcome ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                      {event.outcome}
                    </p>
                  ) : null}
                </div>
                <div className="text-sm text-ink-muted md:text-right">
                  <p>{event.occurredByDisplayName}</p>
                  <p className="mt-1">{formatDateTime(event.occurredAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-lg border border-hairline bg-surface-1 p-5 shadow-card">
        <h2 className="text-section font-semibold text-ink">Phản hồi Phiếu Coaching</h2>
        <p className="mt-1 text-sm text-ink-muted">{responses.length ? `${responses.length} phản hồi đã gắn với lịch sử phiếu này.` : "Chưa có phản hồi công khai nào."}</p>
        {responses.length ? <ul className="mt-3 divide-y divide-hairline rounded-md border border-hairline">{responses.map((response) => <li className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm" key={response.id}><span>{response.formName} · v{response.versionNumber} · {formatDateTime(response.submittedAt)}</span><Link className="font-semibold text-primary hover:underline" href={`/coaching/responses/${response.id}`}>Xem phản hồi</Link></li>)}</ul> : null}
        <Link className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline" href="/coaching/responses">Xem tất cả phản hồi</Link>
      </section>
      {canManageLinks ? <CoachingPublicLinkPanel coachingRecordId={record.id} forms={forms} links={links} /> : null}

      <div className="flex justify-end">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-sm font-semibold text-ink transition hover:border-hairline-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/25"
          href="/coaching"
        >
          Quay lại danh sách
        </Link>
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold leading-6 text-ink">{value}</p>
    </div>
  );
}

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00`)) : "Chưa đặt lịch";
}

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}
