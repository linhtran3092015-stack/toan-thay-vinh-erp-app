// Value: protects=the notification vocabulary and page helpers: every code a writer emits (§A.3) gets its Vietnamese label, tone and family, unknown codes keep "Sự kiện chưa hỗ trợ: {last segment}" without ever reading Object.prototype, chip counts cover only the loaded rows (minus rows read in this tab), the header line says the exact total and page, pager hrefs keep preserved params and always carry their own page, and ?page= parses like the route always did;
// fails_when=a writer's code falls back to "chưa hỗ trợ", a label/tone of the pre-14d codes changes, a prototype key leaks through a map, a chip counts beyond the page, a preserved `page` overrides the pager's, or the page parse accepts a fraction, zero or a repeated param;
// why_new=step 14d moves the labels into notification-models.ts and adds session/CRM/ops codes, chips and pager hrefs; seam=pure functions; no_claim=how the list renders them (notification-list-page.test.tsx)
import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_MAX_PAGE,
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATIONS_ACCESS,
  buildNotificationChips,
  countLoadedNotifications,
  describeNotificationChipScope,
  describeNotificationContext,
  filterNotificationsByChip,
  getNotificationEventLabel,
  getNotificationEventTone,
  getNotificationFamily,
  getNotificationPageHref,
  isNotificationUnread,
  parseNotificationPage,
} from "@/features/notifications/notification-models";

describe("notification event vocabulary", () => {
  it.each([
    ["salary_advance.requested", "Yêu cầu mới", "info", "salary_advance"],
    ["salary_advance.review", "Chờ duyệt", "warning", "salary_advance"],
    ["salary_advance.approved", "Đã duyệt", "success", "salary_advance"],
    ["salary_advance.rejected", "Từ chối", "danger", "salary_advance"],
    ["student_care.initialized", "Danh sách chăm sóc đã sẵn sàng", "neutral", "student_care"],
    ["student_care.detected", "Học viên cần hỗ trợ", "warning", "student_care"],
    ["student_care.overdue", "Chăm sóc quá hạn", "warning", "student_care"],
    ["student_care.escalated", "Cần điều phối", "danger", "student_care"],
    ["student_care.assigned", "Đã phân công", "neutral", "student_care"],
    ["student_care.monthly_due", "Coaching đến hạn", "neutral", "student_care"],
    ["session.lock_reminder", "Buổi chưa khóa", "warning", "session"],
    ["session.lock_queue_digest", "Buổi chờ khóa", "warning", "session"],
    ["crm.lead_assigned", "Lead mới được giao", "info", "crm"],
    ["crm.follow_up_due", "Hẹn theo dõi lead", "warning", "crm"],
    ["ops.cron_job_failed", "Cảnh báo vận hành", "danger", "ops"],
    ["ops.cron_job_stale", "Cảnh báo vận hành", "danger", "ops"],
    ["ops.sepay_webhook_failed", "Cảnh báo vận hành", "danger", "ops"],
    ["ops.sepay_webhook_processing_failed", "Cảnh báo vận hành", "danger", "ops"],
    ["ai_grading.review_due", "Bài chấm AI chờ duyệt", "warning", "ai_grading"],
    ["ai_grading.resubmitted_after_review", "Nộp lại bài đã duyệt", "warning", "ai_grading"],
    ["ops.ai_grading_review_due", "Bài chấm AI chờ duyệt", "warning", "ops"],
    ["ops.ai_grading_daily_budget", "Cảnh báo vận hành", "danger", "ops"],
    ["ops.ai_grading_failure_rate", "Cảnh báo vận hành", "danger", "ops"],
    ["ops.ai_grading_kick_failed", "Cảnh báo vận hành", "danger", "ops"],
    ["ops.ai_grading_paused", "Cảnh báo vận hành", "danger", "ops"],
    ["ops.ai_grading_queue_stalled", "Cảnh báo vận hành", "danger", "ops"],
  ])("%s → %s (%s, %s)", (code, label, tone, family) => {
    expect(getNotificationEventLabel(code)).toBe(label);
    expect(getNotificationEventTone(code)).toBe(tone);
    expect(getNotificationFamily(code)).toBe(family);
  });

  it("keys labels by the full code: a known last segment in another family is still unsupported", () => {
    expect(getNotificationEventLabel("payroll.approved")).toBe("Sự kiện chưa hỗ trợ: approved");
    expect(getNotificationEventTone("payroll.approved")).toBe("neutral");
    expect(getNotificationFamily("payroll.approved")).toBe("other");
    // A new code in a known family keeps its family icon but not a label.
    expect(getNotificationEventLabel("crm.lead_lost")).toBe("Sự kiện chưa hỗ trợ: lead_lost");
    expect(getNotificationEventTone("crm.lead_lost")).toBe("neutral");
    expect(getNotificationFamily("crm.lead_lost")).toBe("crm");
  });

  it.each(["payroll.constructor", "constructor.toString", "__proto__.hasOwnProperty", "valueOf", "toString.__proto__"])(
    "never reads Object.prototype for %s",
    (code) => {
      const segment = code.split(".").pop();
      expect(getNotificationEventLabel(code)).toBe(`Sự kiện chưa hỗ trợ: ${segment}`);
      expect(getNotificationEventLabel(code)).not.toMatch(/function/);
      expect(getNotificationEventTone(code)).toBe("neutral");
      expect(getNotificationFamily(code)).toBe("other");
    },
  );
});

describe("notification page helpers", () => {
  const entries = [
    { id: "a", readAt: null },
    { id: "b", readAt: "2026-10-16T01:00:00.000Z" },
    { id: "c", readAt: null },
  ];

  it("counts and filters the loaded rows only, treating rows read in this tab as read", () => {
    expect(countLoadedNotifications(entries, new Set())).toEqual({ all: 3, unread: 2 });
    expect(countLoadedNotifications(entries, new Set(["a"]))).toEqual({ all: 3, unread: 1 });
    expect(isNotificationUnread(entries[0], new Set(["a"]))).toBe(false);
    expect(isNotificationUnread(entries[2], new Set(["a"]))).toBe(true);
    expect(filterNotificationsByChip(entries, "unread", new Set(["a"])).map((entry) => entry.id)).toEqual(["c"]);
    expect(filterNotificationsByChip(entries, "all", new Set(["a"]))).toBe(entries);
    expect(buildNotificationChips({ all: 3, unread: 1 })).toEqual([
      { count: 3, label: "Tất cả", value: "all" },
      { count: 1, label: "Chưa đọc", value: "unread" },
    ]);
  });

  it("words the header and the chip scope", () => {
    expect(describeNotificationContext(1234, 2)).toBe("1.234 chưa đọc · trang 2");
    expect(describeNotificationContext(0, 1)).toBe("0 chưa đọc · trang 1");
    expect(describeNotificationChipScope(50)).toBe("Số trên chip tính trong 50 thông báo của trang này.");
  });

  it("builds pager hrefs with the preserved params and the pager's own page", () => {
    expect(getNotificationPageHref("/notifications", {}, 1)).toBe("/notifications?page=1");
    expect(getNotificationPageHref("/notifications", {}, 3)).toBe("/notifications?page=3");
    // A preserved `page` keeps its slot but the pager's own value wins (it is never written twice).
    expect(getNotificationPageHref("/dev/lists", { page: "7", state: "capped", view: "notifications" }, 2)).toBe(
      "/dev/lists?page=2&state=capped&view=notifications",
    );
    expect(getNotificationPageHref("/dev/lists", { state: "capped", view: "notifications" }, 2)).toBe(
      "/dev/lists?state=capped&view=notifications&page=2",
    );
    expect(getNotificationPageHref("/dev/lists", { view: "a&b=c" }, 2)).toBe("/dev/lists?view=a%26b%3Dc&page=2");
  });

  it.each([
    [undefined, 1],
    [null, 1],
    ["3", 3],
    ["0", 1],
    ["-4", 1],
    ["1.5", 1],
    ["a", 1],
    ["999999", 100000],
    [["1", "2"], 1],
  ])("parses ?page=%j as %d", (value, page) => {
    expect(parseNotificationPage(value)).toBe(page);
  });

  it("keeps the page size, the page cap and the route's gate", () => {
    expect(NOTIFICATION_PAGE_SIZE).toBe(50);
    expect(NOTIFICATION_MAX_PAGE).toBe(100000);
    expect(parseNotificationPage(String(NOTIFICATION_MAX_PAGE + 1))).toBe(NOTIFICATION_MAX_PAGE);
    expect(parseNotificationPage(String(NOTIFICATION_MAX_PAGE))).toBe(NOTIFICATION_MAX_PAGE);
    expect(NOTIFICATIONS_ACCESS).toEqual({ deniedTitle: "Không có quyền xem thông báo", permission: "notifications.view" });
  });
});
