import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import type { UnlockedSessionQueue } from "@/features/sessions/unlocked-sessions-data";
import { formatIsoDate } from "@/lib/datetime";

import { formatSessionCompactDate, getSessionLockReadinessLabel, getSessionQueueItemReadiness } from "../session-directory-models";

const linkFocusClassName = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

/** Server-rendered queue of completed-but-unlocked sessions with the missing-attendance reason. */
export function UnlockedSessionQueue({
  canLock,
  canMarkAttendance,
  limit,
  listPath = "/sessions",
  queue,
  today,
}: {
  canLock: boolean;
  /** attendance.mark; omitted keeps the old behaviour (the lock permission gates both links). */
  canMarkAttendance?: boolean;
  /** RPC row cap the page asked for: a full page means more sessions may wait. */
  limit?: number;
  /**
   * The list "Lọc danh sách" filters: the real route by default; the /dev
   * preview passes its own `/dev/lists?view=sessions` so the link stays on
   * fixtures. A path that already has a query gets the filter appended with `&`.
   */
  listPath?: string;
  queue: UnlockedSessionQueue;
  /**
   * Vietnam business date: "Lọc danh sách" then adds `to=today`, the list's
   * "Chờ khóa" chip state (so the chip is pressed on arrival), and the list's
   * server read ends at today, spending its row cap on past sessions rather
   * than scheduled future ones. Omitted keeps the unbounded link.
   */
  today?: string;
}) {
  if (queue.items.length === 0) {
    return null;
  }

  const readiness = queue.items.map((item) => getSessionQueueItemReadiness(item));
  const missingCount = readiness.filter((value) => value.kind === "missing").length;
  const noRosterCount = readiness.filter((value) => value.kind === "no_roster").length;
  const blockedSentence =
    missingCount > 0 && noRosterCount > 0
      ? ` ${missingCount} buổi còn thiếu điểm danh, ${noRosterCount} buổi không có học sinh nên không thể khóa.`
      : missingCount > 0
        ? ` ${missingCount} buổi còn thiếu điểm danh nên không thể khóa.`
        : noRosterCount > 0
          ? ` ${noRosterCount} buổi không có học sinh nên không thể khóa.`
          : "";
  const mayHaveMore = limit !== undefined && queue.items.length >= limit;
  const canMark = canMarkAttendance ?? canLock;
  const filterQuery = today ? `status=completed&lock=unlocked&to=${today}` : "status=completed&lock=unlocked";
  const filterHref = `${listPath}${listPath.includes("?") ? "&" : "?"}${filterQuery}`;

  return (
    <section
      aria-labelledby="unlocked-session-queue-title"
      className="rounded-lg border border-warning-border bg-warning-bg px-4 py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-section-title font-semibold text-text-strong" id="unlocked-session-queue-title">
            {queue.items.length}{mayHaveMore ? "+" : ""} buổi đã hoàn thành chưa khóa
          </h2>
          <p className="mt-1 text-secondary text-text-default">
            Buổi chưa khóa chưa trừ buổi của học sinh và chưa tính thưởng chấm bài.{" "}
            {queue.autoLockAfterDays > 0
              ? `Hệ thống tự khóa sau ${queue.autoLockAfterDays} ngày nếu đã điểm danh đủ.`
              : "Tự khóa đang tắt (Cài đặt → Buổi học)."}
            {blockedSentence}
          </p>
        </div>
        <Link
          className={getButtonClassName({ className: "max-md:h-11", size: "md", variant: "secondary" })}
          href={filterHref}
        >
          Lọc danh sách
        </Link>
      </div>

      <ul className="mt-3 grid gap-2">
        {queue.items.slice(0, 8).map((item) => {
          // The lock rule: every roster student present or absent. attendance_count also counts
          // walk-ins, so it is not the numerator (it can exceed the roster).
          const recorded = Math.max(0, item.rosterCount - item.missingAttendanceCount);
          const state = getSessionQueueItemReadiness(item);
          const action = state.kind === "missing" ? (canMark ? "Điểm danh" : null) : state.kind === "ready" && canLock ? "Khóa" : null;
          // Same badge words and tones as the list rows; only the auto-lock date is the panel's own.
          const badge = state.kind === "ready" && item.autoLockOn ? { label: `Tự khóa ${formatIsoDate(item.autoLockOn)}`, tone: "info" as const } : getSessionLockReadinessLabel(state);

          return (
            <li
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-base px-3 py-2"
              key={item.id}
            >
              <div className="min-w-0">
                <Link className={`rounded-sm font-semibold tabular-nums text-action-link! hover:underline ${linkFocusClassName}`} href={`/sessions/${item.id}`}>
                  {item.classCode} · {formatSessionCompactDate(item.sessionDate)} · {item.startTime.slice(0, 5)}
                </Link>
                <p className="text-caption tabular-nums text-text-muted">
                  Hoàn thành {item.daysSinceCompleted === 0 ? "hôm nay" : `${item.daysSinceCompleted} ngày trước`}
                  {item.completedByName ? ` bởi ${item.completedByName}` : ""}
                  {item.rosterCount > 0 ? ` · Điểm danh ${recorded}/${item.rosterCount}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={badge.tone}>{badge.label}</Badge>
                {action ? (
                  <Link
                    aria-label={`${action} buổi ${item.classCode} ${formatSessionCompactDate(item.sessionDate)} ${item.startTime.slice(0, 5)}`}
                    className={`inline-flex h-8 items-center rounded-md px-2 text-secondary font-semibold text-action-link! hover:bg-interactive-hover max-md:h-11 ${linkFocusClassName}`}
                    href={`/sessions/${item.id}`}
                  >
                    {action}
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {/* Not "in the filtered list": its newest-first window may not hold these older sessions. */}
      {queue.items.length > 8 ? (
        <p className="mt-2 text-caption text-text-muted">Còn {queue.items.length - 8}{mayHaveMore ? "+" : ""} buổi khác chờ khóa.</p>
      ) : null}
    </section>
  );
}
