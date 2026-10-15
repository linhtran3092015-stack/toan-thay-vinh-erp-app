import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import type { CoachingActionOverrides } from "@/features/coaching/coaching-action-overrides";
import type {
  CoachingFormSummary,
  CoachingPublicLinkSummary,
  CoachingRecordResponseSummary,
} from "@/features/coaching/coaching-form-data";
import { CoachingStatusBadge } from "@/features/coaching/coaching-list-page";
import {
  buildCoachingTimeline,
  coachingEventLabels,
  formatCoachingDate,
  formatCoachingDateTime,
  formatCoachingReviewDate,
  formatCoachingShortDateTime,
  getCoachingPriorityPresentation,
  summarizeCoachingReason,
  type CoachingTimelineEntry,
} from "@/features/coaching/coaching-presentation";
import { CoachingEventActions } from "@/features/coaching/components/coaching-event-actions";
import { CoachingPublicLinkPanel } from "@/features/coaching/components/coaching-public-link-panel";
import type { CoachingRecordDashboardEntry, CoachingRecordEvent } from "@/features/coaching/read-models";

interface CoachingDetailPageProps {
  /** Inert stubs in the /dev preview; the real page passes nothing. */
  actions?: CoachingActionOverrides;
  canManage: boolean;
  canManageLinks?: boolean;
  /** coaching_forms.view, for the link panel's version picker; defaults to true for callers that predate it. */
  canViewForms?: boolean;
  /**
   * Whether the viewer may open responses (coaching_responses.view); the list
   * is only loaded with it. Fails closed: callers that omit it show no card.
   */
  canViewResponses?: boolean;
  defaultPublicLinkExpiryDays?: number;
  events: readonly CoachingRecordEvent[];
  forms?: CoachingFormSummary[];
  /** The permitted forms loader failed: the panel says so instead of asking to publish a form. */
  formsUnavailable?: boolean;
  links?: CoachingPublicLinkSummary[];
  /** The permitted links loader failed: the panel says so instead of reading as "no link yet". */
  linksUnavailable?: boolean;
  /** Back link target; defaults to the Coaching list. */
  listHref?: string;
  record: CoachingRecordDashboardEntry;
  responses?: CoachingRecordResponseSummary[];
  /** The permitted responses loader failed: the card says so instead of showing the empty line. */
  responsesUnavailable?: boolean;
}

/**
 * /coaching/[coachingId] (design 13c, left canvas). Header with the campaign
 * and student, priority and status badges, a context line (code, opened,
 * owner, review date, first line of the reason) and the state's actions
 * (only with coaching.manage and only while open or in progress, so closed
 * or unknown states get no empty actions slot). Below,
 * two columns from lg: public links and responses on the left, the event
 * timeline (newest first) and the full "Lý do theo dõi" on the right.
 */
export function CoachingDetailPage({
  actions,
  canManage,
  canManageLinks = false,
  canViewForms = true,
  canViewResponses = false,
  defaultPublicLinkExpiryDays = 7,
  events,
  forms = [],
  formsUnavailable = false,
  links = [],
  linksUnavailable = false,
  listHref = "/coaching",
  record,
  responses = [],
  responsesUnavailable = false,
}: CoachingDetailPageProps) {
  const priority = getCoachingPriorityPresentation(record.priority);
  const openedYear = formatCoachingDate(record.openedAt).slice(-4);
  const reasonSummary = summarizeCoachingReason(record.reason);
  const context = [
    record.studentPublicCode,
    `mở ${formatCoachingDate(record.openedAt)}`,
    `phụ trách ${record.assistantOwnerDisplayName}`,
    record.reviewAt ? `xem lại ${formatCoachingReviewDate(record.reviewAt, openedYear)}` : "chưa đặt lịch xem lại",
    reasonSummary ? `lý do: ${reasonSummary}` : null,
  ].filter(Boolean);
  const hasLeftColumn = canManageLinks || canViewResponses;
  // CoachingEventActions renders nothing for other states; a truthy element would still add PageHeader's empty slot.
  const hasEventActions = canManage && (record.currentStatus === "open" || record.currentStatus === "in_progress");

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <nav aria-label="Điều hướng Coaching" className="text-secondary">
        <Link
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-0"
          href={listHref}
        >
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          Coaching
        </Link>
      </nav>

      <PageHeader
        actions={
          hasEventActions ? (
            <CoachingEventActions
              actions={actions}
              coachingRecordId={record.id}
              currentStatus={record.currentStatus}
            />
          ) : undefined
        }
        context={
          <>
            <Badge tone={priority.tone}>{priority.label}</Badge>
            <CoachingStatusBadge status={record.currentStatus} />
          </>
        }
        title={`${record.campaignName} · ${record.studentFullName}`}
      >
        <p className="mt-1 break-words text-secondary tabular-nums text-text-muted">{context.join(" · ")}</p>
      </PageHeader>

      <div
        className={
          hasLeftColumn
            ? "grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] xl:grid-cols-[minmax(0,1fr)_420px]"
            : "grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:max-w-[720px]"
        }
      >
        {hasLeftColumn ? (
          <div className="grid min-w-0 gap-5">
            {canManageLinks ? (
              <CoachingPublicLinkPanel
                actions={actions}
                canViewForms={canViewForms}
                coachingRecordId={record.id}
                defaultExpiryDays={defaultPublicLinkExpiryDays}
                forms={forms}
                formsUnavailable={formsUnavailable}
                links={links}
                linksUnavailable={linksUnavailable}
              />
            ) : null}
            {canViewResponses ? <ResponsesCard responses={responses} unavailable={responsesUnavailable} /> : null}
          </div>
        ) : null}

        <div className="grid min-w-0 gap-5">
          <EventsCard events={events} />
          <RecordCard title="Lý do theo dõi">
            <p className="whitespace-pre-wrap break-words px-4 py-3 text-body text-text-default">{record.reason}</p>
          </RecordCard>
        </div>
      </div>
    </div>
  );
}

function RecordCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      <h2 className="border-b border-border-row px-4 py-3 text-body font-semibold text-text-strong">{title}</h2>
      {children}
    </section>
  );
}

function ResponsesCard({
  responses,
  unavailable,
}: {
  responses: readonly CoachingRecordResponseSummary[];
  unavailable: boolean;
}) {
  return (
    <RecordCard title="Phản hồi Phiếu Coaching">
      {unavailable ? (
        <p className="px-4 py-3 text-secondary font-medium text-danger">Không tải được phản hồi.</p>
      ) : responses.length === 0 ? (
        <p className="px-4 py-3 text-secondary text-text-muted">Chưa có phản hồi công khai nào.</p>
      ) : (
        <ul className="grid">
          {responses.map((response) => {
            const submittedAt = formatCoachingDateTime(response.submittedAt);
            return (
              <li
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-row px-4 py-3 text-secondary"
                key={response.id}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-text-strong">
                    {response.formName} · v{response.versionNumber}
                  </span>
                  <span className="block tabular-nums text-text-muted">nộp {submittedAt}</span>
                </span>
                <Link
                  className="inline-flex min-h-11 items-center font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-0"
                  href={`/coaching/responses/${response.id}`}
                >
                  {/* Every row's link would otherwise be announced as the same "Xem phản hồi". The space sits
                      outside the sr-only span: accessible-name computation trims a span's own leading space. */}
                  Xem phản hồi{" "}
                  <span className="sr-only">
                    {response.formName} v{response.versionNumber}, nộp {submittedAt}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div className="px-4 py-3">
        <Link
          className="inline-flex min-h-11 items-center text-secondary font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-0"
          href="/coaching/responses"
        >
          Xem tất cả phản hồi
        </Link>
      </div>
    </RecordCard>
  );
}

function EventsCard({ events }: { events: readonly CoachingRecordEvent[] }) {
  const timeline = buildCoachingTimeline(events);
  return (
    <RecordCard title="Sự kiện">
      {timeline.length === 0 ? (
        <p className="px-4 py-3 text-secondary text-text-muted">Chưa có sự kiện nào được ghi nhận.</p>
      ) : (
        <ol aria-label="Sự kiện của phiếu, mới nhất trước" className="grid">
          {timeline.map((entry) => (
            <EventRow entry={entry} key={entry.event.id} />
          ))}
        </ol>
      )}
    </RecordCard>
  );
}

function EventRow({ entry }: { entry: CoachingTimelineEntry }) {
  const { event, previousStatus } = entry;
  const quoted = event.eventType === "outcome_recorded" ? event.outcome : event.note;
  const extraNote = event.eventType === "outcome_recorded" ? event.note : null;

  return (
    <li className="grid gap-0.5 border-b border-border-row px-4 py-2.5 text-secondary last:border-b-0">
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-text-default">
        <strong className="font-semibold text-text-strong">{coachingEventLabels[event.eventType]}</strong>
        {event.eventType === "status_changed" && event.status ? (
          <>
            {previousStatus ? (
              <>
                <CoachingStatusBadge status={previousStatus} />
                <span aria-hidden="true">→</span>
                <span className="sr-only">sang</span>
              </>
            ) : null}
            <CoachingStatusBadge status={event.status} />
          </>
        ) : null}
      </p>
      {quoted ? (
        <p className="whitespace-pre-wrap break-words text-text-default">“{quoted}”</p>
      ) : null}
      {extraNote ? (
        <p className="whitespace-pre-wrap break-words text-text-muted">Ghi chú: {extraNote}</p>
      ) : null}
      <p className="tabular-nums text-text-muted">
        <time dateTime={event.occurredAt}>{formatCoachingShortDateTime(event.occurredAt)}</time> ·{" "}
        {event.occurredByDisplayName}
      </p>
    </li>
  );
}
