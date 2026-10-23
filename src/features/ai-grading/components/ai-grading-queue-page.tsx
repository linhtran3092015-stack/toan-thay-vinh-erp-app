import Link from "next/link";

import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { controlClassName } from "@/components/ui/field";
import { queueStage, toReview, type AiGradingQueueSession, type AiGradingToday, type QueueStage } from "@/features/ai-grading/queue";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const TABS: Array<{ label: string; value: QueueStage | "all" }> = [
  { label: "Cần duyệt", value: "review" },
  { label: "Đang chấm / chờ đáp án", value: "in_progress" },
  { label: "Đã xong", value: "done" },
  { label: "Tất cả", value: "all" },
];

const testLabels: Record<AiGradingQueueSession["testStatus"], { label: string; tone: "neutral" | "warning" | "success" }> = {
  draft: { label: "Đề nháp", tone: "warning" },
  key_confirmed: { label: "Đã chốt đáp án", tone: "success" },
  key_review: { label: "Chờ chốt đáp án", tone: "warning" },
  none: { label: "Chưa có đề", tone: "warning" },
};

function dateLabel(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function tabHref(stage: string, range: { from: string; to: string }): string {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (stage !== "review") params.set("stage", stage);
  return `/ai-grading?${params.toString()}`;
}

/**
 * Trang "Chấm bài AI" (phase 3c): every session with a test or form submissions in the chosen days,
 * grouped by how far its papers got, with today's AI numbers. Reviewing happens on the session page
 * ("Mở buổi"); sessions about to lock themselves with papers left are flagged.
 */
export function AiGradingQueuePage({
  now = new Date().toISOString(),
  range,
  sessions,
  stage,
  today,
}: {
  now?: string;
  range: { from: string; to: string };
  sessions: AiGradingQueueSession[];
  stage: QueueStage | "all";
  today: AiGradingToday | null;
}) {
  const counts = Object.fromEntries(TABS.map((tab) => [tab.value, tab.value === "all" ? sessions.length : sessions.filter((session) => queueStage(session) === tab.value).length]));
  const visible = stage === "all" ? sessions : sessions.filter((session) => queueStage(session) === stage);
  const soon = Date.parse(now) + 24 * 3_600_000;

  return (
    <div className="grid gap-5">
      <PageHeader title="Chấm bài AI">
        <p className="text-secondary text-text-muted">
          Các buổi có đề hoặc bài nộp qua form. Mở buổi để xem bài, sửa và duyệt; buổi tự khóa rồi thì không ghi điểm được nữa.
        </p>
      </PageHeader>

      {today ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tile label="AI chấm hôm nay" value={today.graded} />
          <Tile label="Xanh" tone="success" value={today.green} />
          <Tile label="Vàng" tone="warning" value={today.yellow} />
          <Tile label="Đỏ" tone="danger" value={today.red} />
          <Tile label="Đã duyệt hôm nay" value={today.approved} />
        </dl>
      ) : null}

      <form action="/ai-grading" className="flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-1 text-caption text-text-muted">
          Từ ngày
          <input className={controlClassName} defaultValue={range.from} name="from" type="date" />
        </label>
        <label className="grid gap-1 text-caption text-text-muted">
          Đến ngày
          <input className={controlClassName} defaultValue={range.to} name="to" type="date" />
        </label>
        {stage !== "review" ? <input name="stage" type="hidden" value={stage} /> : null}
        <button className={getButtonClassName({ variant: "secondary" })} type="submit">
          Xem
        </button>
        <span className="text-caption text-text-muted">Tối đa 62 ngày.</span>
      </form>

      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            aria-current={tab.value === stage ? "page" : undefined}
            className={cn(
              "rounded-sm border px-3 py-1.5 text-secondary",
              tab.value === stage ? "border-[var(--action-primary)] font-semibold text-text-strong" : "border-border-subtle text-text-muted",
            )}
            href={tabHref(tab.value, range)}
            key={tab.value}
          >
            {tab.label} ({counts[tab.value]})
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <EmptyState
          description={stage === "review" ? "Không có buổi nào còn bài AI chấm cần duyệt trong khoảng ngày này." : "Không có buổi nào trong khoảng ngày này."}
          title="Không có buổi nào"
        />
      ) : (
        <ul className="grid gap-3">
          {visible.map((session) => {
            const pending = toReview(session);
            const locksSoon = session.autoLockAt !== null && Date.parse(session.autoLockAt) <= soon && pending > 0;
            return (
              <li key={session.id}>
                <Card>
                  <CardContent className="grid gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-text-strong">{session.classCode}</span>
                      <span className="text-secondary text-text-muted">
                        {dateLabel(session.sessionDate)} · {formatTime(session.startTime)}–{formatTime(session.endTime)} · {session.className}
                      </span>
                      <Badge tone={testLabels[session.testStatus].tone}>{testLabels[session.testStatus].label}</Badge>
                      {session.lockedAt ? <Badge tone="neutral">Đã khóa</Badge> : null}
                      {locksSoon ? <Badge tone="danger">Tự khóa lúc {formatDateTime(session.autoLockAt!)}</Badge> : null}
                      {session.suspectQuestions > 0 ? (
                        <Badge tone="danger">Kiểm tra đáp án: {session.suspectQuestions} câu hơn 70% bài sai</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-secondary">
                      <span className="text-text-default">{session.submissions} bài tính điểm</span>
                      {session.greenPending > 0 ? <Badge tone="success">{session.greenPending} xanh chờ duyệt</Badge> : null}
                      {session.yellowPending > 0 ? <Badge tone="warning">{session.yellowPending} vàng chờ duyệt</Badge> : null}
                      {session.redPending > 0 ? <Badge tone="danger">{session.redPending} đỏ (chấm tay)</Badge> : null}
                      {session.resubmittedPending > 0 ? <Badge tone="warning">{session.resubmittedPending} nộp lại sau khi duyệt</Badge> : null}
                      {session.grading > 0 ? <Badge tone="info">{session.grading} AI đang chấm</Badge> : null}
                      {session.waitingKey > 0 ? <Badge tone="neutral">{session.waitingKey} chờ đáp án</Badge> : null}
                      {session.approved > 0 ? <Badge tone="neutral">{session.approved} đã duyệt</Badge> : null}
                      {session.skipped > 0 ? <Badge tone="neutral">{session.skipped} bỏ qua</Badge> : null}
                    </div>
                    <div>
                      <Link className={getButtonClassName({ size: "sm", variant: pending > 0 ? "primary" : "secondary" })} href={`/sessions/${session.id}`}>
                        {pending > 0 ? `Mở buổi để duyệt ${pending} bài` : "Mở buổi"}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Tile({ label, tone, value }: { label: string; tone?: "success" | "warning" | "danger"; value: number }) {
  return (
    <div className="grid gap-0.5 rounded-md border border-border-subtle p-3">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className={cn("text-section-title font-semibold", tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-text-strong")}>
        {value.toLocaleString("vi-VN")}
      </dd>
    </div>
  );
}
