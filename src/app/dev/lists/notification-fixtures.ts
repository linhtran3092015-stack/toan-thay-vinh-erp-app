import { NOTIFICATION_PAGE_SIZE } from "@/features/notifications/notification-models";
import type { NotificationEntry } from "@/features/notifications/read-models";

import type { ListsPreviewRole, ListsPreviewState } from "./lists-preview";

/*
 * Every href points at a /dev preview so a click never leaves /dev (the real
 * writers' targets are in the comments). /dev/session is not used: its
 * buttons call real server actions.
 */
/** Production: `/advances`. */
const ADVANCES_HREF = "/dev/lists?view=advances";
/** Production: `/sessions/{id}` (lock reminder) and `/sessions?status=completed&lock=unlocked` (digest). */
const SESSIONS_HREF = "/dev/lists?view=sessions";
/** Production: `/crm/{caseId}`. */
const CRM_HREF = "/dev/crm";
/** Production: `/student-care/{taskId}`, `/student-care?kind=monthly`, `/student-care`. */
const STUDENT_CARE_HREF = "/dev/student-care";
/** Production: `/settings` (the ops alert default). */
const SETTINGS_HREF = "/dev/settings";
/** Production: `/finance/sepay?queue=review`. */
const SEPAY_HREF = "/dev/sepay";

interface NotificationTemplate {
  /**
   * Who receives it per the writers (map-rules §A.3): ops alerts go to
   * `settings.manage` (owner only), "chờ duyệt" to `advances.owner_approve`,
   * "yêu cầu mới" to `advances.review`, the digest to `sessions.manage`, a lock
   * reminder to the session's completer, approved/rejected to the requester.
   */
  audience: readonly ListsPreviewRole[];
  createdAt: string;
  eventCode: string;
  href: string | null;
  id: string;
  message: string;
  /** Read in the newest page (normal state). */
  read: boolean;
  title: string;
}

function templateId(index: number): string {
  return `f2000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

/** Newest first; titles and messages follow the real writers' formats (§A.3). */
const templates: readonly NotificationTemplate[] = [
  {
    audience: ["owner"],
    createdAt: "2026-10-16T04:41:00.000Z",
    eventCode: "ops.sepay_webhook_processing_failed",
    href: SEPAY_HREF,
    id: templateId(1),
    message: "Webhook SePay #48213 (1.800.000 ₫) không ghi nhận được: canceling statement due to statement timeout. Dùng Đồng bộ lịch sử SePay để bù.",
    read: false,
    title: "Webhook SePay xử lý lỗi",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-16T03:15:00.000Z",
    eventCode: "salary_advance.review",
    href: ADVANCES_HREF,
    id: templateId(2),
    message: "Một yêu cầu tạm ứng đã được đối soát và đang chờ duyệt.",
    read: false,
    title: "Yêu cầu tạm ứng chờ duyệt",
  },
  {
    audience: ["accountant"],
    createdAt: "2026-10-16T02:10:00.000Z",
    eventCode: "salary_advance.requested",
    href: ADVANCES_HREF,
    id: templateId(3),
    message: "Một yêu cầu tạm ứng mới đang chờ đối soát.",
    read: false,
    title: "Có yêu cầu tạm ứng mới",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-16T01:00:30.000Z",
    eventCode: "session.lock_queue_digest",
    href: SESSIONS_HREF,
    id: templateId(4),
    message: "Có 3 buổi học hoàn thành hơn 1 ngày nhưng chưa khóa. Buổi chưa khóa chưa trừ buổi học sinh và chưa tính thưởng chấm bài.",
    read: false,
    title: "3 buổi học đã hoàn thành chưa khóa",
  },
  {
    audience: ["ta"],
    createdAt: "2026-10-16T01:00:05.000Z",
    eventCode: "session.lock_reminder",
    href: SESSIONS_HREF,
    id: templateId(5),
    message: "Buổi L-8B26 ngày 14/10/2026 đã hoàn thành hơn 1 ngày nhưng chưa khóa. Khóa buổi để trừ buổi và tính thưởng chấm bài.",
    read: false,
    title: "Buổi học chưa khóa",
  },
  {
    // No writer emits this code today (a future one): the fallback label and the bell.
    // No href either, as when the loader drops a link that is not a safe internal path.
    audience: ["owner", "ta", "accountant"],
    createdAt: "2026-10-16T00:30:00.000Z",
    eventCode: "payroll.period_locked",
    href: null,
    id: templateId(6),
    message: "Bảng lương tháng 9/2026 đã chốt.\nMở Bảng lương để xem phần của bạn.",
    read: false,
    title: "Bảng lương tháng 9/2026 đã chốt",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-16T00:00:20.000Z",
    eventCode: "crm.follow_up_due",
    href: CRM_HREF,
    id: templateId(7),
    message: "Lead CRM-2610-014 · Lê Ngọc Hân: Gọi lại xác nhận lịch học thử tối thứ 3.",
    read: true,
    title: "Hôm nay có hẹn theo dõi lead",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-15T23:35:00.000Z",
    eventCode: "ops.cron_job_failed",
    href: SETTINGS_HREF,
    id: templateId(8),
    message: "Lần chạy 18342 lúc 06:30 16/10: ERROR: canceling statement due to statement timeout",
    read: true,
    title: "Tác vụ nền thất bại: student-care-worker",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-15T10:05:00.000Z",
    eventCode: "student_care.escalated",
    href: STUDENT_CARE_HREF,
    id: templateId(10),
    message: "Phạm Thu Hà · Cảnh báo học tập / chuyên cần",
    read: true,
    title: "Chăm sóc học viên cần điều phối",
  },
  {
    audience: ["ta"],
    createdAt: "2026-10-15T09:30:00.000Z",
    eventCode: "salary_advance.rejected",
    href: ADVANCES_HREF,
    id: templateId(9),
    message: "Yêu cầu tạm ứng của bạn đã bị từ chối. Mở mục Tạm ứng để xem chi tiết.",
    read: false,
    title: "Yêu cầu tạm ứng đã bị từ chối",
  },
  {
    audience: ["owner", "accountant"],
    createdAt: "2026-10-15T08:20:00.000Z",
    eventCode: "salary_advance.requested",
    href: ADVANCES_HREF,
    id: templateId(11),
    message: "Một yêu cầu tạm ứng mới đang chờ đối soát.",
    read: true,
    title: "Có yêu cầu tạm ứng mới",
  },
  {
    audience: ["owner", "ta"],
    createdAt: "2026-10-15T01:00:10.000Z",
    eventCode: "session.lock_reminder",
    href: SESSIONS_HREF,
    id: templateId(12),
    message: "Buổi L-9A26 ngày 13/10/2026 đã hoàn thành hơn 1 ngày nhưng chưa khóa. Khóa buổi để trừ buổi và tính thưởng chấm bài.",
    read: true,
    title: "Buổi học chưa khóa",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-14T09:12:00.000Z",
    eventCode: "crm.lead_assigned",
    href: CRM_HREF,
    id: templateId(13),
    message: "Lead CRM-2610-011 · Trần Minh Khang (khối 8) vừa được giao cho bạn. Liên hệ phụ huynh và ghi chú lịch theo dõi.",
    read: true,
    title: "Bạn được giao lead mới",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-14T01:00:00.000Z",
    eventCode: "student_care.monthly_due",
    href: STUDENT_CARE_HREF,
    id: templateId(14),
    message: "4 công việc Coaching tháng cần phân công hoặc đã đến hạn.",
    read: true,
    title: "Coaching tháng cần theo dõi",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-12T02:00:00.000Z",
    eventCode: "student_care.initialized",
    href: STUDENT_CARE_HREF,
    id: templateId(15),
    message: "7 học viên có cảnh báo cần hỗ trợ. Mở danh sách để nhận xử lý.",
    read: true,
    title: "Danh sách chăm sóc đã sẵn sàng",
  },
  {
    audience: ["ta", "accountant"],
    createdAt: "2026-10-10T07:45:00.000Z",
    eventCode: "salary_advance.approved",
    href: ADVANCES_HREF,
    id: templateId(16),
    message: "Yêu cầu tạm ứng của bạn đã được duyệt.",
    read: true,
    title: "Yêu cầu tạm ứng đã được duyệt",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-09T04:00:00.000Z",
    eventCode: "ops.cron_job_stale",
    href: SETTINGS_HREF,
    id: templateId(17),
    message: "Lần chạy gần nhất: 08:00 08/10. Kiểm tra pg_cron trên Supabase.",
    read: true,
    title: "Tác vụ nền không chạy: session-lock-reminders",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-08T06:30:00.000Z",
    eventCode: "ops.sepay_webhook_failed",
    href: SEPAY_HREF,
    id: templateId(18),
    message: "Có 2 webhook SePay bị lỗi trong 30 phút qua. Tiền có thể đã về nhưng chưa ghi nhận; kiểm tra Giao dịch SePay và đồng bộ lịch sử nếu cần.",
    read: true,
    title: "2 webhook SePay xử lý lỗi",
  },
  {
    audience: ["owner"],
    createdAt: "2026-10-07T03:20:00.000Z",
    eventCode: "student_care.assigned",
    href: STUDENT_CARE_HREF,
    id: templateId(19),
    message: "Vũ Đức Huy · Theo dõi học viên",
    read: true,
    title: "Công việc chăm sóc được phân công",
  },
];

/** `/dev/lists` targets keep the viewer's role so the next preview matches (owner is the default). */
function previewHref(href: string | null, role: ListsPreviewRole): string | null {
  if (href === null || role === "owner" || !href.startsWith("/dev/lists?")) return href;
  return `${href}&role=${role}`;
}

function readAtFor(createdAt: string): string {
  return new Date(Date.parse(createdAt) + 25 * 60 * 1000).toISOString();
}

function toEntry(template: NotificationTemplate, role: ListsPreviewRole, overrides: Partial<NotificationEntry> = {}): NotificationEntry {
  return {
    createdAt: template.createdAt,
    entityId: null,
    entityType: null,
    eventCode: template.eventCode,
    href: previewHref(template.href, role),
    id: template.id,
    message: template.message,
    readAt: template.read ? readAtFor(template.createdAt) : null,
    title: template.title,
    ...overrides,
  };
}

function templatesFor(role: ListsPreviewRole): readonly NotificationTemplate[] {
  return templates.filter((template) => template.audience.includes(role));
}

/** The role's newest notifications (normal state, page 1). */
export function getNotificationPreviewRecent(role: ListsPreviewRole): NotificationEntry[] {
  return templatesFor(role).map((template) => toEntry(template, role));
}

const HOUR = 60 * 60 * 1000;
/** Older copies start before the oldest template and step back 7 hours each. */
const OLDER_START = Date.parse("2026-10-06T00:00:00.000Z");
/** Rows on the short page 2 of the capped state, the first two still unread. */
const CAPPED_SECOND_PAGE_SIZE = 7;
const CAPPED_SECOND_PAGE_UNREAD = 2;

function olderCopies(role: ListsPreviewRole, page: number, count: number, offset: number, unread: number): NotificationEntry[] {
  const pool = templatesFor(role);
  return Array.from({ length: count }, (_, index) => {
    const template = pool[(offset + index) % pool.length];
    const createdAt = new Date(OLDER_START - (offset + index) * 7 * HOUR).toISOString();
    return toEntry(template, role, {
      createdAt,
      id: `f2${page}00000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      readAt: index < unread ? null : readAtFor(createdAt),
    });
  });
}

export interface NotificationPreviewPage {
  entries: NotificationEntry[];
  hasNextPage: boolean;
  /** The exact unread total over every page, like the route's count read. */
  unreadCount: number;
}

/**
 * The fixture "server" for one `?page=`:
 * - normal: the role's recent rows on page 1 (owner: 4 unread), nothing older.
 * - capped: page 1 is a full page of 50 (the recent rows + older read copies), so
 *   "Cũ hơn" shows; page 2 is a short older page with 2 more unread, so the header's
 *   total (page-1 unread + 2) is larger than the page's chip; nothing after it.
 * - empty: no notification at all.
 */
export function getNotificationPreviewPage(
  role: ListsPreviewRole,
  state: ListsPreviewState,
  page: number,
): NotificationPreviewPage {
  if (state === "empty") return { entries: [], hasNextPage: false, unreadCount: 0 };

  const recent = getNotificationPreviewRecent(role);
  const recentUnread = recent.filter((entry) => entry.readAt === null).length;

  if (state === "normal") {
    return { entries: page === 1 ? recent : [], hasNextPage: false, unreadCount: recentUnread };
  }

  const unreadCount = recentUnread + CAPPED_SECOND_PAGE_UNREAD;
  if (page === 1) {
    const filler = olderCopies(role, 1, NOTIFICATION_PAGE_SIZE - recent.length, 0, 0);
    return { entries: [...recent, ...filler], hasNextPage: true, unreadCount };
  }
  if (page === 2) {
    const offset = NOTIFICATION_PAGE_SIZE - recent.length;
    return {
      entries: olderCopies(role, 2, CAPPED_SECOND_PAGE_SIZE, offset, CAPPED_SECOND_PAGE_UNREAD),
      hasNextPage: false,
      unreadCount,
    };
  }
  return { entries: [], hasNextPage: false, unreadCount };
}
