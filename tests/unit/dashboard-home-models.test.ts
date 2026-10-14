// Value: protects=the home dashboard picks its layout from permission codes, lists work only for viewers who can act on it (an accountant sees finance items only), counts the summary strip from the right feeds, and says "Không có việc tồn" only when every permitted source loaded;
// fails_when=a TA gets the centre layout, payroll approval reaches a viewer without payroll.owner_approve, a failed source is shown as "no backlog", a forbidden source becomes a failure, tuition progress counts cancelled or expired requests or overdue before the due date, or missing results count absent students;
//   also when an approval item reaches a viewer without the executive RPC's read permission (payroll.view, advances.view, coaching.view), the work count drops rows hidden by the personal 4-row cap or loses its "+" floor, a TA's not-completed or not-started row is worded wrongly, or tuition shares stop summing to 100;
// why_new=home-models is new pure logic shared by the route, the dev preview and the components;
// seam=none (pure functions); no_claim=does not prove the loader's queries or that the RPC counts are correct
import { describe, expect, it } from "vitest";

import {
  buildMyMonthStats,
  buildNeedsAction,
  buildSummaryStrip,
  buildWeekStats,
  computeTuitionProgress,
  failedFeed,
  findMissingResults,
  forbiddenFeed,
  formatLongWeekdayDate,
  formatTimeUntil,
  fromSection,
  getDashboardFeedAccess,
  getDashboardLayout,
  getTuitionShares,
  getWeekRange,
  formatBacklogCount,
  getOverdueReceivablesVnd,
  hasNoBacklog,
  pickCurrentTuitionPeriod,
  pickNextSession,
  readyFeed,
  summarizeMyMonth,
  summarizeTodaySessions,
  type DashboardHomeReadModel,
  type DashboardSessionRow,
} from "@/features/dashboard/home-models";
import type { PermissionCode } from "@/lib/permissions/types";

const today = "2026-10-12";

const owner: PermissionCode[] = [
  "dashboard.view",
  "classes.view",
  "sessions.view",
  "sessions.manage",
  "attendance.view",
  "attendance.mark",
  "finance.view",
  "payments.view",
  "sepay.view",
  "sepay.allocate",
  "tuition_periods.view",
  "payroll.view",
  "payroll.owner_approve",
  "advances.view",
  "advances.review",
  "students.view",
  "crm.view",
  "crm.update",
];
const accountant: PermissionCode[] = [
  "dashboard.view",
  "sessions.view",
  "finance.view",
  "payments.view",
  "sepay.view",
  "sepay.accountant_confirm",
  "tuition_periods.view",
  "payroll.view",
  "payroll.accountant_reconcile",
  "students.view",
];
const ta: PermissionCode[] = [
  "dashboard.view",
  "classes.view",
  "sessions.view",
  "sessions.manage",
  "sessions.lock",
  "attendance.view",
  "attendance.mark",
  "results.view",
  "results.manage",
  "timekeeping.check",
];

function row(id: string, start: string, end: string, status: DashboardSessionRow["status"], date = today): DashboardSessionRow {
  return {
    attendance: { absent: 0, additional: 0, present: 0, unmarked: 10 },
    classCode: `L-${id}`,
    classId: `class-${id}`,
    className: `Lớp ${id}`,
    endTime: end,
    id,
    learningMode: "offline",
    lockedAt: null,
    roomName: "P.101",
    rosterCount: 10,
    sessionDate: date,
    startTime: start,
    status,
  };
}

function model(permissions: PermissionCode[], overrides: Partial<DashboardHomeReadModel> = {}): DashboardHomeReadModel {
  return {
    awaitingLock: forbiddenFeed,
    careOverdue: forbiddenFeed,
    crmFollowUps: readyFeed(0),
    executive: {
      attention: readyFeed([
        { count: 1, description: "", href: "/payroll", id: "payroll-review", module: "", severity: "danger", title: "" },
        { count: 2, description: "", href: "/advances", id: "advances-pending", module: "", severity: "warning", title: "" },
      ]),
      receivablesAging: readyFeed({ collectedVnd: 0, from31To60DaysVnd: 1_000_000, items: [], over60DaysVnd: 500_000, totalReceivablesVnd: 3_000_000, under30DaysVnd: 1_500_000 }),
      studentStatus: readyFeed({ activeCount: 300, completedCount: 0, items: [], reservedCount: 4, totalCount: 320, waitingCount: 16 }),
    },
    layout: getDashboardLayout(permissions),
    missingResults: forbiddenFeed,
    myMonth: forbiddenFeed,
    newLeads: readyFeed(3),
    newStudents: readyFeed(5),
    nowTime: "16:00:00",
    permissions,
    sepay: readyFeed({ count: 3, oldestAt: "2026-10-12T01:14:00.000Z", totalIsPartial: false, totalVnd: 4_800_000 }),
    timekeeping: forbiddenFeed,
    today,
    todaySessions: readyFeed({
      rows: [row("a", "08:00:00", "10:00:00", "completed"), row("b", "15:00:00", "17:00:00", "in_progress"), row("c", "17:30:00", "19:30:00", "scheduled"), row("d", "19:30:00", "21:30:00", "cancelled")],
      truncated: false,
    }),
    tuition: readyFeed(null),
    unmarked: readyFeed({
      items: [
        { classCode: "L-x", className: "Lớp x", id: "x", reason: "not_started", recorded: null, roster: null, sessionDate: today, startTime: "13:30:00" },
        { classCode: "L-y", className: "Lớp y", id: "y", reason: "incomplete", recorded: 18, roster: 20, sessionDate: "2026-10-11", startTime: "19:30:00" },
      ],
      truncated: false,
    }),
    upcomingSession: readyFeed(null),
    weekAttendance: readyFeed({ absent: 7, present: 93 }),
    weekEnd: "2026-10-18",
    weekStart: "2026-10-12",
    ...overrides,
  };
}

describe("layout and feed access", () => {
  it("chooses the centre layout from oversight permissions and the personal layout otherwise", () => {
    expect(getDashboardLayout(owner)).toBe("center");
    expect(getDashboardLayout(accountant)).toBe("center");
    // sessions.lock alone is not oversight: teaching assistants hold it.
    expect(getDashboardLayout(ta)).toBe("personal");
  });

  it("reads centre money and week feeds only in the centre layout and own shift feeds only in the personal one", () => {
    const centre = getDashboardFeedAccess(owner);
    expect(centre).toMatchObject({ missingResults: false, myMonth: false, sepay: true, timekeeping: false, tuition: true, weekAttendance: true });

    const personal = getDashboardFeedAccess(ta);
    expect(personal).toMatchObject({ missingResults: true, myMonth: true, newStudents: false, sepay: false, timekeeping: true, tuition: false, unmarked: true });

    expect(getDashboardFeedAccess(["dashboard.view", "finance.view", "tuition_periods.view"]).tuition).toBe(false);
  });

  // Value: protects=session feeds need sessions.view only (classes.view is seeded to the owner alone, so gating on it would hide a TA's whole schedule and fake "Không có việc tồn"), the unmarked queue is read only for the centre cell or a viewer who can mark or start sessions, and CRM follow-ups only for a viewer who can open /crm and update it;
  // fails_when=a classes.view gate returns, a sessions.view-only viewer triggers the unmarked/lock-queue read, a viewer without sessions.view reads it, or a crm.update holder without crm.view gets a /crm link they cannot open;
  // why_new=review settled these access rules; seam=none; no_claim=does not prove the loader honours the flags (see dashboard-home-data.test.ts)
  it("reads session feeds with sessions.view alone, unmarked sessions only for the centre or a viewer who can mark or start them, and CRM follow-ups only with crm.view and crm.update", () => {
    const none = { crmFollowUps: false, todaySessions: false, unmarked: false };
    const cases: Array<[PermissionCode[], { crmFollowUps: boolean; todaySessions: boolean; unmarked: boolean }]> = [
      [["dashboard.view", "sessions.view"], { ...none, todaySessions: true }],
      [["dashboard.view", "sessions.view", "attendance.mark"], { ...none, todaySessions: true, unmarked: true }],
      [["dashboard.view", "sessions.view", "sessions.manage"], { ...none, todaySessions: true, unmarked: true }],
      [["dashboard.view", "sessions.view", "classes.manage_schedule"], { ...none, todaySessions: true, unmarked: true }],
      [["dashboard.view", "classes.view", "attendance.mark", "sessions.manage", "classes.manage_schedule"], none],
      [["dashboard.view", "crm.update"], none],
      [["dashboard.view", "crm.view"], none],
      [["dashboard.view", "crm.view", "crm.update"], { ...none, crmFollowUps: true }],
    ];

    for (const [permissions, expected] of cases) {
      expect(getDashboardFeedAccess(permissions), permissions.join(",")).toMatchObject(expected);
    }
  });

  it("maps executive sections onto feeds: hidden is forbidden, error is failed", () => {
    expect(fromSection({ status: "hidden" })).toEqual(forbiddenFeed);
    expect(fromSection({ status: "error" })).toEqual(failedFeed);
    expect(fromSection({ data: 1, status: "ready" })).toEqual(readyFeed(1));
  });
});

describe("summary strip", () => {
  it("counts today's sessions, unmarked sessions, overdue debt and the SePay backlog", () => {
    const cells = buildSummaryStrip(model(owner));

    expect(cells.map((cell) => [cell.key, cell.value])).toEqual([
      ["today", "3"],
      ["unmarked", "2"],
      ["debt", expect.stringContaining("1.500.000")],
      ["sepay", "3"],
    ]);
    expect(cells[0].caption).toBe("1 đã kết thúc · 1 đang diễn ra");
    // The cell also counts started sessions never completed, not only missing marks.
    expect(cells[1].caption).toBe("Đã qua giờ kết thúc, chưa điểm danh đủ hoặc chưa hoàn thành");
  });

  // Value: protects=the strip's "Công nợ quá hạn" and the debt work item use one definition of overdue (31–60 days plus over 60 days); fails_when=the helper includes the under-30 bucket or the strip and item drift apart; why_new=getOverdueReceivablesVnd is a new shared helper; seam=none; no_claim=does not prove the aging buckets themselves
  it("defines overdue receivables as 31–60 days plus over 60 days for both the strip and the debt item", () => {
    const aging = { collectedVnd: 0, from31To60DaysVnd: 1_000_000, items: [], over60DaysVnd: 500_000, totalReceivablesVnd: 3_000_000, under30DaysVnd: 1_500_000 };
    expect(getOverdueReceivablesVnd(aging)).toBe(1_500_000);
    expect(getOverdueReceivablesVnd({ ...aging, from31To60DaysVnd: 0, over60DaysVnd: 0 })).toBe(0);

    const centre = model(owner, { executive: { ...model(owner).executive, receivablesAging: readyFeed(aging) } });
    const cell = buildSummaryStrip(centre).find((entry) => entry.key === "debt");
    const item = buildNeedsAction(centre).items.find((entry) => entry.key === "debt");
    expect(cell?.value).toMatch(/^1\.500\.000/);
    expect(item?.title).toMatch(/^Công nợ quá 30 ngày: 1\.500\.000/);
  });

  it("drops forbidden cells and keeps failed ones visible", () => {
    const cells = buildSummaryStrip(model(owner, { sepay: forbiddenFeed, unmarked: failedFeed }));

    expect(cells.map((cell) => cell.key)).toEqual(["today", "unmarked", "debt"]);
    expect(cells[1]).toMatchObject({ caption: "Chưa tải được", state: "failed", value: "—" });
  });

  it("marks a truncated not-started read with a plus", () => {
    const cells = buildSummaryStrip(model(owner, { unmarked: readyFeed({ items: [], truncated: true }) }));
    expect(cells.find((cell) => cell.key === "unmarked")?.value).toBe("0+");
  });

  // Value: protects=today's count is non-cancelled sessions split into finished and live, with no stray cancelled count; fails_when=a cancelled session is counted or the summary shape grows a field the strip does not show; why_new=summarizeTodaySessions dropped `cancelled` in review; seam=none; no_claim=none
  it("summarises today's sessions without counting cancelled ones", () => {
    const rows = [row("a", "08:00:00", "10:00:00", "completed"), row("b", "15:00:00", "17:00:00", "in_progress"), row("c", "17:30:00", "19:30:00", "scheduled"), row("d", "19:30:00", "21:30:00", "cancelled")];
    expect(summarizeTodaySessions(rows)).toEqual({ finished: 1, live: 1, total: 3 });
  });

  // Value: protects=a SePay backlog summed from only the first rows is shown as a floor ("+") in the strip and the work list; fails_when=a partial sum reads as the exact total; why_new=totalIsPartial was never set in a model test; seam=none; no_claim=does not prove the loader's partial detection (see dashboard-home-data.test.ts)
  it("marks a partial SePay total with a plus in the strip caption and the work item", () => {
    const partial = model(owner, { sepay: readyFeed({ count: 600, oldestAt: "2026-10-12T01:14:00.000Z", totalIsPartial: true, totalVnd: 4_800_000 }) });

    const cell = buildSummaryStrip(partial).find((entry) => entry.key === "sepay");
    expect(cell).toMatchObject({ tone: "warning", value: "600" });
    expect(cell?.caption).toMatch(/^Tổng [^·]+\+ · từ /);
    expect(buildNeedsAction(partial).items.find((item) => item.key === "sepay")?.detail).toMatch(/^[^·]+\+ · cũ nhất /);

    const exact = buildSummaryStrip(model(owner)).find((entry) => entry.key === "sepay");
    expect(exact?.caption).not.toContain("+");
  });
});

describe("needs-action list", () => {
  it("gives the owner one aggregated session item, finance items and approvals, each with one link", () => {
    const list = buildNeedsAction(model(owner));

    expect(list.items.map((item) => item.key)).toEqual(["sessions-unmarked", "sepay", "payroll-review", "advances-pending", "debt"]);
    expect(list.items[0]).toMatchObject({ href: "/sessions?lock=unlocked&to=2026-10-12", title: "2 buổi quá giờ chưa xong điểm danh" });
    expect(list.items[0].detail).toBe("Lớp x (13:30 hôm nay) · Lớp y (hôm qua)");
    expect(list.items.find((item) => item.key === "sepay")?.href).toBe("/finance/sepay?queue=review");
    expect(list.complete).toBe(true);
  });

  it("gives the accountant finance items only", () => {
    const list = buildNeedsAction(model(accountant, { crmFollowUps: forbiddenFeed }));

    expect(list.items.map((item) => item.kind)).toEqual(["sepay", "debt"]);
  });

  it("lists a TA's sessions one by one with direct links and missing results", () => {
    const list = buildNeedsAction(
      model(ta, {
        crmFollowUps: forbiddenFeed,
        missingResults: readyFeed([{ classCode: "L-z", className: "Lớp z", id: "z", missing: 2, present: 18, sessionDate: "2026-10-10", startTime: "17:30:00" }]),
        sepay: forbiddenFeed,
      }),
    );

    expect(list.items.map((item) => [item.key, item.actionLabel, item.href])).toEqual([
      ["unmarked-x", "Mở buổi", "/sessions/x"],
      ["unmarked-y", "Điểm danh", "/sessions/y"],
      ["results-z", "Nhập kết quả", "/sessions/z"],
    ]);
    expect(list.items[1].detail).toContain("điểm danh 18/20, còn thiếu 2");
    expect(list.items[2].title).toBe("Buổi Lớp z thiếu 2 kết quả");
  });

  // Value: protects=the centre's aggregated unmarked item links straight to a lone session, summarises more than two, and marks a truncated read as a floor;
  // fails_when=a single overdue session still sends the owner to the filtered list, the "và N buổi khác" tail miscounts, a truncated count loses its "+" in the title, or the centre list total gains a second "+" for it;
  // why_new=only the two-session centre item was asserted; seam=none; no_claim=does not prove the /sessions filters exist
  it("links a lone overdue session directly and summarises a truncated set in the centre item", () => {
    const item = (overrides: Partial<{ id: string; sessionDate: string; startTime: string }>) => ({
      classCode: `L-${overrides.id}`,
      className: `Lớp ${overrides.id}`,
      id: "x",
      reason: "not_started" as const,
      recorded: null,
      roster: null,
      sessionDate: today,
      startTime: "13:30:00",
      ...overrides,
    });

    const single = buildNeedsAction(model(owner, { unmarked: readyFeed({ items: [item({ id: "x" })], truncated: false }) }));
    expect(single.items[0]).toMatchObject({ actionLabel: "Mở buổi học", href: "/sessions/x", key: "sessions-unmarked", title: "1 buổi quá giờ chưa xong điểm danh" });
    expect(single.totalIsFloor).toBe(false);

    const many = buildNeedsAction(
      model(owner, {
        unmarked: readyFeed({
          items: [item({ id: "z", sessionDate: "2026-10-10", startTime: "17:30:00" }), item({ id: "x" }), item({ id: "y", sessionDate: "2026-10-11", startTime: "19:30:00" })],
          truncated: true,
        }),
      }),
    );
    expect(many.items[0]).toMatchObject({ actionLabel: "Xem buổi học", href: "/sessions?lock=unlocked&to=2026-10-12", title: "3+ buổi quá giờ chưa xong điểm danh" });
    expect(many.items[0].detail).toBe("Lớp x (13:30 hôm nay) · Lớp y (hôm qua) · và 1 buổi khác");
    // The item's own title carries the "+"; the list total counts items, so it stays exact.
    expect(many).toMatchObject({ total: many.items.length, totalIsFloor: false });
    expect(formatBacklogCount(many)).toBe(String(many.items.length));
  });

  // Value: protects=a TA's overdue rows say what is actually wrong (started but not completed vs never started) and only offer "start or cancel" wording to someone with sessions.manage;
  // fails_when=an in-progress session past its end is reported as not started, loses its "Chưa hoàn thành" badge, or a viewer without sessions.manage is told to start/cancel a session they cannot;
  // why_new=not_completed is a new reason and the not_started wording now depends on sessions.manage; seam=none; no_claim=does not prove the session page's own gates
  it("words a TA's overdue rows by reason and by whether the viewer may start the session", () => {
    const unmarked = readyFeed({
      items: [
        { classCode: "L-n", className: "Lớp n", id: "n", reason: "not_started" as const, recorded: null, roster: null, sessionDate: today, startTime: "13:30:00" },
        { classCode: "L-p", className: "Lớp p", id: "p", reason: "not_completed" as const, recorded: null, roster: null, sessionDate: today, startTime: "14:00:00" },
      ],
      truncated: false,
    });
    const quiet = { crmFollowUps: forbiddenFeed, sepay: forbiddenFeed, unmarked } satisfies Partial<DashboardHomeReadModel>;

    const manager = buildNeedsAction(model(ta, quiet));
    const [notStarted, notCompleted] = manager.items;
    expect(notStarted).toMatchObject({ actionLabel: "Mở buổi", badge: "Chưa bắt đầu", href: "/sessions/n", title: "Buổi Lớp n chưa bắt đầu" });
    expect(notStarted.detail).toMatch(/ · 13:30 · đã qua giờ, cần bắt đầu để điểm danh hoặc hủy buổi$/);
    expect(notCompleted).toMatchObject({ actionLabel: "Mở buổi", badge: "Chưa hoàn thành", href: "/sessions/p", kind: "sessions", title: "Buổi Lớp p chưa hoàn thành", tone: "danger" });
    expect(notCompleted.detail).toMatch(/ · 14:00 · đã qua giờ kết thúc, cần điểm danh đủ rồi hoàn thành buổi$/);

    const marker = buildNeedsAction(model(ta.filter((code) => code !== "sessions.manage"), quiet));
    expect(marker.items[0].detail).toMatch(/ · 13:30 · đã qua giờ nhưng buổi chưa được bắt đầu$/);
    expect(marker.items[0].detail).not.toContain("hủy");
    expect(marker.items[1].badge).toBe("Chưa hoàn thành");
  });

  // Value: protects=the personal list shows at most four rows per kind, notes the rest, and still counts them in the backlog total (a floor when a read was truncated);
  // fails_when=the cap is dropped or changed, the notes miscount or lose the "+", or the header count shows only the visible rows;
  // why_new=total/totalIsFloor are new and the cap and notes were never exercised; seam=none; no_claim=does not prove the rendered header (see dashboard-home.test.tsx)
  it("caps a TA's list at four rows per kind, notes the rest and counts them in the total", () => {
    const unmarkedItems = Array.from({ length: 6 }, (_, index) => ({
      classCode: `L-u${index}`,
      className: `Lớp u${index}`,
      id: `u${index}`,
      reason: "not_started" as const,
      recorded: null,
      roster: null,
      sessionDate: "2026-10-11",
      startTime: `0${index + 1}:00:00`,
    }));
    const results = Array.from({ length: 5 }, (_, index) => ({ classCode: `L-r${index}`, className: `Lớp r${index}`, id: `r${index}`, missing: 1, present: 10, sessionDate: "2026-10-10", startTime: "17:30:00" }));
    const base = { crmFollowUps: forbiddenFeed, missingResults: readyFeed(results), sepay: forbiddenFeed } satisfies Partial<DashboardHomeReadModel>;

    const floor = buildNeedsAction(model(ta, { ...base, unmarked: readyFeed({ items: unmarkedItems, truncated: true }) }));
    expect(floor.items.map((item) => item.key)).toEqual(["unmarked-u0", "unmarked-u1", "unmarked-u2", "unmarked-u3", "results-r0", "results-r1", "results-r2", "results-r3"]);
    expect(floor.notes).toEqual(["Còn 2+ buổi chưa điểm danh khác ở trang Buổi học.", "Còn 1 buổi thiếu kết quả khác."]);
    expect(floor).toMatchObject({ total: 11, totalIsFloor: true });
    expect(formatBacklogCount(floor)).toBe("11+");

    const exact = buildNeedsAction(model(ta, { ...base, unmarked: readyFeed({ items: unmarkedItems, truncated: false }) }));
    expect(exact.notes[0]).toBe("Còn 2 buổi chưa điểm danh khác ở trang Buổi học.");
    expect(exact).toMatchObject({ total: 11, totalIsFloor: false });
    expect(formatBacklogCount(exact)).toBe("11");

    // A truncated read with no hidden rows still says more exist.
    const short = buildNeedsAction(model(ta, { ...base, missingResults: readyFeed([]), unmarked: readyFeed({ items: unmarkedItems.slice(0, 2), truncated: true }) }));
    expect(short.notes).toEqual(["Còn buổi chưa điểm danh khác ở trang Buổi học."]);
    expect(short).toMatchObject({ total: 2, totalIsFloor: true });

    expect(formatBacklogCount({ total: 12, totalIsFloor: false })).toBe("12");
    expect(formatBacklogCount({ total: 12, totalIsFloor: true })).toBe("12+");
  });

  // Value: protects=payroll and advance approvals reach only a viewer who can both read the executive count and approve; fails_when=payroll.owner_approve or advances.review alone surfaces a hidden (null) count as work, or a valid approver loses the item;
  // why_new=permits now also require payroll.view / advances.view; seam=none; no_claim=does not prove the executive RPC's own gating
  it("lists payroll and advance approvals only with the executive read permission plus an approve one", () => {
    const cases: Array<[PermissionCode[], string[]]> = [
      [["dashboard.view", "payroll.owner_approve"], []],
      [["dashboard.view", "payroll.view"], []],
      [["dashboard.view", "payroll.view", "payroll.owner_approve"], ["payroll-review"]],
      [["dashboard.view", "advances.review"], []],
      [["dashboard.view", "advances.owner_approve"], []],
      [["dashboard.view", "advances.view"], []],
      [["dashboard.view", "advances.view", "advances.review"], ["advances-pending"]],
      [["dashboard.view", "advances.view", "advances.owner_approve"], ["advances-pending"]],
    ];

    for (const [permissions, expected] of cases) {
      expect(buildNeedsAction(model(permissions, { crmFollowUps: forbiddenFeed })).items.map((item) => item.key), permissions.join(",")).toEqual(expected);
    }
  });

  it("says there is no backlog only when every permitted source loaded empty", () => {
    const quiet = {
      executive: { attention: readyFeed([]), receivablesAging: forbiddenFeed, studentStatus: forbiddenFeed },
      sepay: readyFeed({ count: 0, oldestAt: null, totalIsPartial: false, totalVnd: 0 }),
      unmarked: readyFeed({ items: [], truncated: false }),
    } satisfies Partial<DashboardHomeReadModel>;

    expect(hasNoBacklog(buildNeedsAction(model(owner, quiet)))).toBe(true);

    const withFailure = buildNeedsAction(model(owner, { ...quiet, sepay: failedFeed }));
    expect(withFailure.items).toEqual([]);
    expect(withFailure.failed).toEqual(["giao dịch SePay"]);
    expect(hasNoBacklog(withFailure)).toBe(false);
  });

  // Value: protects=each approval, CRM, care and debt item reaches only the viewer who can act on it, with its own route, and an attention failure is reported only to someone it concerns;
  // fails_when=a timekeeping viewer without approve_adjustment (or an approver who cannot open /timekeeping) sees adjustments, coaching/import/CRM/care items lose either half of their two-permission gate or their link, the stale-request-only debt item disappears, or an unrelated viewer is told approvals failed;
  // why_new=only payroll-review, advances and the aging debt item were exercised; seam=none; no_claim=does not prove the executive RPC's counts
  it("routes each approval, CRM, care and debt item only to the viewer who can act on it", () => {
    const attention = readyFeed([
      { count: 2, description: "", href: "/payroll", id: "timekeeping-adj", module: "", severity: "warning" as const, title: "" },
      { count: 3, description: "", href: "/coaching", id: "coaching-urgent", module: "", severity: "warning" as const, title: "" },
      { count: 1, description: "", href: "/payroll", id: "import-conflicted", module: "", severity: "info" as const, title: "" },
      { count: 5, description: "", href: "/finance", id: "payments-overdue", module: "", severity: "danger" as const, title: "" },
    ]);
    const base = {
      careOverdue: readyFeed(6),
      crmFollowUps: readyFeed(4),
      executive: { attention, receivablesAging: readyFeed({ collectedVnd: 0, from31To60DaysVnd: 0, items: [], over60DaysVnd: 0, totalReceivablesVnd: 100_000, under30DaysVnd: 100_000 }), studentStatus: forbiddenFeed },
      sepay: forbiddenFeed,
      unmarked: forbiddenFeed,
    } satisfies Partial<DashboardHomeReadModel>;
    const cases: Array<[PermissionCode[], Array<[string, string, string]>]> = [
      [["dashboard.view", "timekeeping.view"], []],
      // approve_adjustment alone cannot open /timekeeping (needs view, check or manage_verification).
      [["dashboard.view", "timekeeping.approve_adjustment"], []],
      [["dashboard.view", "timekeeping.approve_adjustment", "timekeeping.view"], [["timekeeping-adj", "2 yêu cầu điều chỉnh công chờ duyệt", "/timekeeping"]]],
      [["dashboard.view", "timekeeping.approve_adjustment", "timekeeping.check"], [["timekeeping-adj", "2 yêu cầu điều chỉnh công chờ duyệt", "/timekeeping"]]],
      [["dashboard.view", "timekeeping.approve_adjustment", "timekeeping.manage_verification"], [["timekeeping-adj", "2 yêu cầu điều chỉnh công chờ duyệt", "/timekeeping"]]],
      [["dashboard.view", "coaching.view"], []],
      // coaching.manage alone: the executive RPC hides the count without coaching.view.
      [["dashboard.view", "coaching.manage"], []],
      [["dashboard.view", "coaching.view", "coaching.manage"], [["coaching-urgent", "3 học sinh có phiếu coaching ưu tiên cao", "/coaching"]]],
      // payroll.import alone: the executive RPC hides the count without payroll.view.
      [["dashboard.view", "payroll.import"], []],
      [["dashboard.view", "payroll.view", "payroll.import"], [["import-conflicted", "1 đợt nhập bảng lương có xung đột", "/payroll"]]],
      [["dashboard.view", "payments.view"], [["debt", "5 yêu cầu thanh toán quá 14 ngày", "/finance/payment-requests"]]],
      [["dashboard.view", "crm.update"], []],
      [["dashboard.view", "crm.view"], []],
      [["dashboard.view", "crm.view", "crm.update"], [["crm", "4 lịch hẹn theo dõi lead đến hạn", "/crm"]]],
      [["dashboard.view", "student_care.handle"], []],
      [["dashboard.view", "student_care.view"], []],
      [["dashboard.view", "student_care.view", "student_care.handle"], [["care", "6 việc chăm sóc quá hạn của bạn", "/student-care?mine=true&overdue=true"]]],
    ];

    for (const [permissions, expected] of cases) {
      const list = buildNeedsAction(model(permissions, base));
      expect(list.items.map((item) => [item.key, item.title, item.href]), permissions.join(",")).toEqual(expected);
    }

    // A failed attention read is news only to a viewer who could act on one of its items.
    const failedAttention = { ...base, crmFollowUps: forbiddenFeed, careOverdue: forbiddenFeed, executive: { ...base.executive, attention: failedFeed, receivablesAging: forbiddenFeed } };
    expect(buildNeedsAction(model(["dashboard.view", "timekeeping.view"], failedAttention))).toMatchObject({ failed: [], sourceCount: 0 });
    expect(buildNeedsAction(model(["dashboard.view", "coaching.manage"], failedAttention))).toMatchObject({ failed: [], sourceCount: 0 });
    expect(buildNeedsAction(model(["dashboard.view", "coaching.view", "coaching.manage"], failedAttention))).toMatchObject({ complete: false, failed: ["việc chờ duyệt"] });
  });

  it("ignores sources the viewer may not read and reports none when nothing is permitted", () => {
    const list = buildNeedsAction(model(["dashboard.view"], { crmFollowUps: forbiddenFeed, unmarked: forbiddenFeed }));

    expect(list.sourceCount).toBe(0);
    expect(hasNoBacklog(list)).toBe(false);
  });

  // The pre-step-6 home linked every completed unlocked session for sessions.lock holders; keep that queue reachable.
  it("lists fully marked sessions waiting for a lock only for a sessions.lock holder, and only when there are some", () => {
    const awaiting = readyFeed({ count: 3, truncated: true });
    const lockItem = (list: ReturnType<typeof buildNeedsAction>) => list.items.find((item) => item.key === "sessions-awaiting-lock");

    const item = lockItem(buildNeedsAction(model([...ta], { awaitingLock: awaiting })));
    expect(item).toMatchObject({ href: "/sessions?status=completed&lock=unlocked", kind: "sessions", title: "3+ buổi đã kết thúc chờ khóa" });

    expect(lockItem(buildNeedsAction(model(ta.filter((code) => code !== "sessions.lock"), { awaitingLock: awaiting })))).toBeUndefined();
    expect(lockItem(buildNeedsAction(model([...ta], { awaitingLock: readyFeed({ count: 0, truncated: false }) })))).toBeUndefined();

    const failedList = buildNeedsAction(model([...ta], { awaitingLock: { reason: "failed", status: "unavailable" } }));
    expect(failedList.failed).toContain("buổi chờ khóa");
    expect(hasNoBacklog(failedList)).toBe(false);
  });
});

describe("week and month stats", () => {
  it("builds the week rows from the executive status and the week feeds, hiding forbidden ones", () => {
    const rows = buildWeekStats(model(owner, { newLeads: forbiddenFeed, newStudents: failedFeed }));

    expect(rows.map((row) => [row.key, row.value, row.state])).toEqual([
      ["active", "300", "ready"],
      ["new-students", "—", "failed"],
      ["reserved", "4", "ready"],
      ["attendance", "93%", "ready"],
    ]);
  });

  it("summarises the viewer's timekeeping month", () => {
    const entry = { adjustmentStatus: "none", hasCheckInGpsEvidence: true, totalMinutes: 120 } as const;
    const month = summarizeMyMonth(
      [entry, { ...entry, hasCheckInGpsEvidence: false, totalMinutes: 90 }, { ...entry, adjustmentStatus: "pending", totalMinutes: null }] as never,
      "2026-10",
    );

    expect(month).toEqual({ gpsShiftCount: 2, month: "2026-10", pendingAdjustmentCount: 1, shiftCount: 3, workedMinutes: 210 });
    expect(buildMyMonthStats(model(ta, { myMonth: readyFeed(month) })).map((row) => row.value)).toEqual(["3", "3 giờ 30 phút", "2 / 3", "1"]);
  });
});

describe("tuition progress", () => {
  const period = { dueOn: "2026-10-15", endsOn: "2026-10-31", id: "p", name: "tháng 10/2026", startsOn: "2026-10-01", status: "locked" as const };
  const requests = [
    { expectedVnd: 1_000_000, paidVnd: 1_000_000, status: "paid" },
    { expectedVnd: 1_000_000, paidVnd: 1_500_000, status: "paid" },
    { expectedVnd: 1_000_000, paidVnd: 250_000, status: "partially_paid" },
    { expectedVnd: 1_000_000, paidVnd: 0, status: "pending" },
    { expectedVnd: 9_000_000, paidVnd: 0, status: "cancelled" },
    // Same rule as the tuition period pages (isTuitionRequestInForce): an expired request is not payable.
    { expectedVnd: 7_000_000, paidVnd: 0, status: "expired" },
  ];

  it("leaves cancelled and expired requests out, caps overpayment and keeps the rest not due before the due date", () => {
    const progress = computeTuitionProgress(period, requests, "2026-10-12");

    expect(progress).toMatchObject({ collectedVnd: 2_250_000, notDueVnd: 1_750_000, overdueVnd: 0, payableVnd: 4_000_000, requestCount: 4 });
    expect(getTuitionShares(progress)).toEqual({ collected: 56, notDue: 44, overdue: 0 });
  });

  it("turns the unpaid rest overdue once the due date has passed", () => {
    const progress = computeTuitionProgress(period, requests, "2026-10-16");
    expect(progress).toMatchObject({ notDueVnd: 0, overdueVnd: 1_750_000 });
  });

  // Value: protects=the due date itself is not overdue, a period without a due date never turns overdue, and zero/negative requests are not counted; fails_when=the comparison becomes <=, a null due date is treated as past, or a 0 ₫ request inflates the request count;
  // why_new=only before/after the due date were exercised; seam=none; no_claim=none
  it("keeps the unpaid rest not due on the due date and without one, and skips non-positive requests", () => {
    expect(computeTuitionProgress(period, requests, "2026-10-15")).toMatchObject({ notDueVnd: 1_750_000, overdueVnd: 0 });
    expect(computeTuitionProgress({ ...period, dueOn: null }, requests, "2027-06-01")).toMatchObject({ notDueVnd: 1_750_000, overdueVnd: 0 });

    const skipped = computeTuitionProgress(
      period,
      [
        { expectedVnd: 0, paidVnd: 0, status: "pending" },
        { expectedVnd: -500_000, paidVnd: 0, status: "pending" },
        { expectedVnd: 1_000_000, paidVnd: 400_000, status: "partially_paid" },
      ],
      "2026-10-12",
    );
    expect(skipped).toMatchObject({ collectedVnd: 400_000, notDueVnd: 600_000, payableVnd: 1_000_000, requestCount: 1 });
  });

  // Value: protects=the three bar shares are whole numbers that always add up to 100 when anything is payable; fails_when=collected and overdue both round up (x.5) and the bar passes 100 or "chưa đến hạn" goes negative;
  // why_new=overdue now gives way to the collected share; seam=none; no_claim=none
  it("rounds tuition shares so they always sum to 100", () => {
    const base = computeTuitionProgress(period, [], "2026-10-12");
    const halves = getTuitionShares({ ...base, collectedVnd: 505, notDueVnd: 0, overdueVnd: 495, payableVnd: 1_000 });
    expect(halves).toEqual({ collected: 51, notDue: 0, overdue: 49 });

    const thirds = getTuitionShares({ ...base, collectedVnd: 1, notDueVnd: 1, overdueVnd: 1, payableVnd: 3 });
    expect(thirds).toEqual({ collected: 33, notDue: 34, overdue: 33 });

    for (const shares of [halves, thirds]) expect(shares.collected + shares.overdue + shares.notDue).toBe(100);
    expect(getTuitionShares(base)).toEqual({ collected: 0, notDue: 0, overdue: 0 });
  });

  it("follows the latest started locked period", () => {
    const periods = [
      { id: "nov", startsOn: "2026-11-01", status: "draft" as const },
      { id: "oct", startsOn: "2026-10-01", status: "locked" as const },
      { id: "sep", startsOn: "2026-09-01", status: "locked" as const },
    ];
    expect(pickCurrentTuitionPeriod(periods, "2026-10-12")?.id).toBe("oct");
    expect(pickCurrentTuitionPeriod([{ id: "oct", startsOn: "2026-10-01", status: "draft" as const }], "2026-10-12")?.id).toBe("oct");
    expect(pickCurrentTuitionPeriod([], "2026-10-12")).toBeNull();
    // Nothing has started yet: the newest period (first in the input) is followed.
    expect(
      pickCurrentTuitionPeriod(
        [
          { id: "dec", startsOn: "2026-12-01", status: "draft" as const },
          { id: "nov", startsOn: "2026-11-01", status: "locked" as const },
        ],
        "2026-10-12",
      )?.id,
    ).toBe("dec");
  });
});

describe("helpers", () => {
  it("counts only present students without a result as missing", () => {
    const missing = findMissingResults(
      [{ classCode: "L", className: "Lớp", id: "s", sessionDate: today, startTime: "17:30:00" }],
      [
        { attendance_status: "present", class_session_id: "s", student_id: "a" },
        { attendance_status: "present", class_session_id: "s", student_id: "b" },
        { attendance_status: "unexcused_absence", class_session_id: "s", student_id: "c" },
      ],
      [{ class_session_id: "s", student_id: "a" }],
    );

    expect(missing).toEqual([expect.objectContaining({ id: "s", missing: 1, present: 2 })]);
  });

  // Value: protects=a student studying in as additional_study is present and needs a result; fails_when=only "present" counts, so make-up students never show as missing results; why_new=additional_study was not exercised; seam=none; no_claim=none
  it("counts additional-study students as present when looking for missing results", () => {
    const missing = findMissingResults(
      [{ classCode: "L", className: "Lớp", id: "s", sessionDate: today, startTime: "17:30:00" }],
      [
        { attendance_status: "present", class_session_id: "s", student_id: "a" },
        { attendance_status: "additional_study", class_session_id: "s", student_id: "d" },
      ],
      [{ class_session_id: "s", student_id: "a" }],
    );

    expect(missing).toEqual([expect.objectContaining({ id: "s", missing: 1, present: 2 })]);
  });

  it("picks the session in progress, else the next one today, else the coming week's", () => {
    expect(pickNextSession(model(owner))?.row.id).toBe("b");
    const upcoming = row("w", "17:30:00", "19:30:00", "scheduled", "2026-10-13");
    const evening = model(owner, {
      nowTime: "22:00:00",
      todaySessions: readyFeed({ rows: [row("a", "08:00:00", "10:00:00", "completed"), row("c", "17:30:00", "19:30:00", "scheduled")], truncated: false }),
      upcomingSession: readyFeed(upcoming),
    });
    expect(pickNextSession(evening)).toEqual({ isToday: false, row: upcoming });
  });

  it("formats dates and countdowns in Vietnamese", () => {
    expect(formatLongWeekdayDate("2026-10-12")).toBe("Thứ Hai, 12/10/2026");
    expect(formatTimeUntil("17:30:00", "16:05:00")).toBe("Còn 1 giờ 25 phút");
    expect(formatTimeUntil("16:30:00", "16:05:00")).toBe("Còn 25 phút");
    expect(formatTimeUntil("16:00:00", "16:05:00")).toBeNull();
    expect(getWeekRange("2026-10-14")).toEqual({ weekEnd: "2026-10-18", weekStart: "2026-10-12" });
    expect(getWeekRange("2026-10-18").weekStart).toBe("2026-10-12");
  });
});
