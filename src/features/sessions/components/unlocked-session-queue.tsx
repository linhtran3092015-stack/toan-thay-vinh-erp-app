import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { UnlockedSessionQueue } from "@/features/sessions/unlocked-sessions-data";

const VI_SHORT_WEEKDAYS = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"] as const;

/** Server-rendered queue of completed-but-unlocked sessions with the missing-attendance reason. */
export function UnlockedSessionQueue({
  canLock,
  queue,
}: {
  canLock: boolean;
  queue: UnlockedSessionQueue;
}) {
  if (queue.items.length === 0) {
    return null;
  }

  const blocked = queue.items.filter((item) => item.missingAttendanceCount > 0 || item.rosterCount === 0).length;

  return (
    <section
      aria-labelledby="unlocked-session-queue-title"
      className="rounded-lg border border-warning-border bg-warning-bg px-4 py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-section-title text-text-strong" id="unlocked-session-queue-title">
            {queue.items.length} buổi đã hoàn thành chưa khóa
          </h2>
          <p className="mt-1 text-secondary text-text-muted">
            Buổi chưa khóa chưa trừ buổi của học sinh và chưa tính thưởng chấm bài.{" "}
            {queue.autoLockAfterDays > 0
              ? `Hệ thống tự khóa sau ${queue.autoLockAfterDays} ngày nếu đã điểm danh đủ.`
              : "Tự khóa đang tắt (Cài đặt → Buổi học)."}
            {blocked > 0 ? ` ${blocked} buổi còn thiếu điểm danh nên không thể khóa.` : ""}
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center rounded-md border border-border-subtle bg-surface-base px-3 text-control font-semibold text-text-strong hover:bg-interactive-hover"
          href="/sessions?status=completed&lock=unlocked"
        >
          Lọc danh sách
        </Link>
      </div>

      <ul className="mt-3 grid gap-2">
        {queue.items.slice(0, 8).map((item) => (
          <li
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-base px-3 py-2"
            key={item.id}
          >
            <div className="min-w-0">
              <Link className="font-semibold text-action-link hover:underline" href={`/sessions/${item.id}`}>
                {item.classCode} · {formatDate(item.sessionDate)} · {item.startTime.slice(0, 5)}
              </Link>
              <p className="text-caption text-text-muted">
                Hoàn thành {item.daysSinceCompleted === 0 ? "hôm nay" : `${item.daysSinceCompleted} ngày trước`}
                {item.completedByName ? ` bởi ${item.completedByName}` : ""} · Điểm danh {item.attendanceCount}/{item.rosterCount}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {item.rosterCount === 0 ? (
                <Badge tone="warning">Không có học sinh</Badge>
              ) : item.missingAttendanceCount > 0 ? (
                <Badge tone="warning">Thiếu {item.missingAttendanceCount} điểm danh</Badge>
              ) : item.autoLockOn ? (
                <Badge tone="info">Tự khóa {formatShortDate(item.autoLockOn)}</Badge>
              ) : (
                <Badge tone="neutral">Sẵn sàng khóa</Badge>
              )}
              {canLock ? (
                <Link
                  className="inline-flex h-8 items-center rounded-md px-2 text-control font-semibold text-action-link hover:bg-interactive-hover"
                  href={`/sessions/${item.id}`}
                >
                  {item.missingAttendanceCount > 0 ? "Điểm danh" : "Khóa"}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {queue.items.length > 8 ? (
        <p className="mt-2 text-caption text-text-muted">Còn {queue.items.length - 8} buổi khác trong danh sách lọc.</p>
      ) : null}
    </section>
  );
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const weekday = VI_SHORT_WEEKDAYS[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];
  return `${weekday}, ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function formatShortDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
