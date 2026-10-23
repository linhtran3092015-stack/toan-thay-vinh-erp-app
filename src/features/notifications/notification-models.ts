import type { QuickFilterChip } from "@/components/patterns/quick-filter-chips";
import type { IconTileTone } from "@/components/ui/icon-tile";
import type { NotificationEntry } from "@/features/notifications/read-models";
import { formatNumber } from "@/lib/format";

/**
 * Rows per `/notifications?page=N`: the loader's `.range(...)` window and the
 * route's "Cũ hơn" heuristic (a full page may have an older one). There is no
 * total: an exact multiple of this size ends on one empty page.
 */
export const NOTIFICATION_PAGE_SIZE = 50;

/** The real list's own path; the /dev/lists preview passes its own. */
export const NOTIFICATIONS_PATH = "/notifications";

/**
 * Highest `?page=` the route and the loader accept (a larger request reads this
 * page). The same cap guards `parseNotificationPage` and the loader's
 * `.range(...)` window.
 */
export const NOTIFICATION_MAX_PAGE = 100000;

/**
 * `?page=` → 1-based page: an integer clamped to 1–NOTIFICATION_MAX_PAGE,
 * anything else (missing, `a`, `1.5`, a repeated param) → 1. The route's parse,
 * shared with the /dev/lists preview.
 */
export function parseNotificationPage(value: unknown): number {
  const requestedPage = Number(value ?? 1);
  return Number.isInteger(requestedPage) ? Math.max(1, Math.min(NOTIFICATION_MAX_PAGE, requestedPage)) : 1;
}

/**
 * The route's gate and denial title, shared with the /dev/lists preview so
 * the copy cannot drift (route files cannot export them).
 */
export const NOTIFICATIONS_ACCESS = {
  deniedTitle: "Không có quyền xem thông báo",
  permission: "notifications.view",
} as const;

export type NotificationTone = IconTileTone;

/** Event family = the first segment of `event_code`; `other` for anything unknown. */
export type NotificationFamily = "ai_grading" | "salary_advance" | "student_care" | "session" | "crm" | "ops" | "other";

export type NotificationChip = "all" | "unread";

interface NotificationEventPresentation {
  label: string;
  tone: NotificationTone;
}

/**
 * Every event code a database writer or the SePay webhook emits (map-rules
 * §A.3), keyed by the FULL code. The salary-advance and student-care labels and
 * tones are the pre-14d ones; session, CRM and ops codes were written since
 * phase 2a/2b/2e and used to fall back to "Sự kiện chưa hỗ trợ". The AI-grading
 * codes (the review reminder and the worker's ops alerts) arrived in phase 3.
 */
const EVENT_PRESENTATION: Readonly<Record<string, NotificationEventPresentation>> = {
  "ai_grading.resubmitted_after_review": { label: "Nộp lại bài đã duyệt", tone: "warning" },
  "ai_grading.review_due": { label: "Bài chấm AI chờ duyệt", tone: "warning" },
  "crm.follow_up_due": { label: "Hẹn theo dõi lead", tone: "warning" },
  "crm.lead_assigned": { label: "Lead mới được giao", tone: "info" },
  "ops.ai_grading_daily_budget": { label: "Cảnh báo vận hành", tone: "danger" },
  "ops.ai_grading_failure_rate": { label: "Cảnh báo vận hành", tone: "danger" },
  "ops.ai_grading_kick_failed": { label: "Cảnh báo vận hành", tone: "danger" },
  "ops.ai_grading_paused": { label: "Cảnh báo vận hành", tone: "danger" },
  "ops.ai_grading_queue_stalled": { label: "Cảnh báo vận hành", tone: "danger" },
  "ops.ai_grading_review_due": { label: "Bài chấm AI chờ duyệt", tone: "warning" },
  "ops.cron_job_failed": { label: "Cảnh báo vận hành", tone: "danger" },
  "ops.cron_job_stale": { label: "Cảnh báo vận hành", tone: "danger" },
  "ops.sepay_webhook_failed": { label: "Cảnh báo vận hành", tone: "danger" },
  "ops.sepay_webhook_processing_failed": { label: "Cảnh báo vận hành", tone: "danger" },
  "salary_advance.approved": { label: "Đã duyệt", tone: "success" },
  "salary_advance.rejected": { label: "Từ chối", tone: "danger" },
  "salary_advance.requested": { label: "Yêu cầu mới", tone: "info" },
  "salary_advance.review": { label: "Chờ duyệt", tone: "warning" },
  "session.lock_queue_digest": { label: "Buổi chờ khóa", tone: "warning" },
  "session.lock_reminder": { label: "Buổi chưa khóa", tone: "warning" },
  "student_care.assigned": { label: "Đã phân công", tone: "neutral" },
  "student_care.detected": { label: "Học viên cần hỗ trợ", tone: "warning" },
  "student_care.escalated": { label: "Cần điều phối", tone: "danger" },
  "student_care.initialized": { label: "Danh sách chăm sóc đã sẵn sàng", tone: "neutral" },
  "student_care.monthly_due": { label: "Coaching đến hạn", tone: "neutral" },
  "student_care.overdue": { label: "Chăm sóc quá hạn", tone: "warning" },
};

const FAMILIES: ReadonlySet<string> = new Set<Exclude<NotificationFamily, "other">>([
  "ai_grading",
  "crm",
  "ops",
  "salary_advance",
  "session",
  "student_care",
]);

function getEventPresentation(eventCode: string): NotificationEventPresentation | null {
  // Own keys only: a code such as `payroll.constructor` must never read Object.prototype.
  return Object.hasOwn(EVENT_PRESENTATION, eventCode) ? EVENT_PRESENTATION[eventCode] : null;
}

/** Known code → its label; unknown → "Sự kiện chưa hỗ trợ: {last segment}" (pinned fallback). */
export function getNotificationEventLabel(eventCode: string): string {
  const presentation = getEventPresentation(eventCode);
  if (presentation) return presentation.label;
  const segment = eventCode.split(".").pop() || eventCode;
  return `Sự kiện chưa hỗ trợ: ${segment}`;
}

/** Known code → its tone; unknown → neutral. Drives the icon tile. */
export function getNotificationEventTone(eventCode: string): NotificationTone {
  return getEventPresentation(eventCode)?.tone ?? "neutral";
}

/** First segment of the code when it is a known family (a Set: no prototype lookup), else `other`. */
export function getNotificationFamily(eventCode: string): NotificationFamily {
  const prefix = eventCode.split(".")[0] ?? "";
  return FAMILIES.has(prefix) ? (prefix as Exclude<NotificationFamily, "other">) : "other";
}

/** Unread on the server and not marked read in this tab. */
export function isNotificationUnread(entry: Pick<NotificationEntry, "id" | "readAt">, locallyRead: ReadonlySet<string>): boolean {
  return entry.readAt === null && !locallyRead.has(entry.id);
}

/** Counts over the LOADED page only (≤ NOTIFICATION_PAGE_SIZE rows), never the account's total. */
export function countLoadedNotifications(
  entries: readonly Pick<NotificationEntry, "id" | "readAt">[],
  locallyRead: ReadonlySet<string>,
): { all: number; unread: number } {
  return {
    all: entries.length,
    unread: entries.filter((entry) => isNotificationUnread(entry, locallyRead)).length,
  };
}

export function buildNotificationChips(counts: { all: number; unread: number }): QuickFilterChip<NotificationChip>[] {
  return [
    { count: counts.all, label: "Tất cả", value: "all" },
    { count: counts.unread, label: "Chưa đọc", value: "unread" },
  ];
}

export function filterNotificationsByChip<T extends Pick<NotificationEntry, "id" | "readAt">>(
  entries: readonly T[],
  chip: NotificationChip,
  locallyRead: ReadonlySet<string>,
): readonly T[] {
  return chip === "unread" ? entries.filter((entry) => isNotificationUnread(entry, locallyRead)) : entries;
}

/** Header context: the exact server unread total (all pages) and the page number; nothing narrower. */
export function describeNotificationContext(unreadCount: number, page: number): string {
  return `${formatNumber(unreadCount)} chưa đọc · trang ${formatNumber(page)}`;
}

/** Caption under the chips: their numbers cover the loaded page only. */
export function describeNotificationChipScope(loadedCount: number): string {
  return `Số trên chip tính trong ${formatNumber(loadedCount)} thông báo của trang này.`;
}

/**
 * `basePath?{preserved params}&page=N`: the preserved params (the preview's
 * `view/role/state`) are kept, and the pager's own `page` always wins over a
 * preserved one.
 */
export function getNotificationPageHref(basePath: string, preservedParams: Readonly<Record<string, string>>, page: number): string {
  return `${basePath}?${new URLSearchParams({ ...preservedParams, page: String(page) }).toString()}`;
}
