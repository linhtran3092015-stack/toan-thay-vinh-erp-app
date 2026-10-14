// Value: protects=the home dashboard renders the centre layout without a primary button, the personal layout with at most one primary ("Điểm danh buổi này" while live, "Bắt đầu buổi học" once a session the viewer can start is due), hides blocks the viewer may not read, keeps failed blocks visible with "Thử lại", and shows "Không có việc tồn" only when every source loaded;
// fails_when=a forbidden block renders a placeholder, a failed block disappears or claims emptiness, the TA's check-in becomes a second primary, an accountant sees payroll approvals, the attendance link points elsewhere, a session not yet started offers "Điểm danh", a checked-out viewer is told they have not checked in, or the work count omits rows hidden by the per-kind cap;
// why_new=DashboardHome and its blocks are new presentation over the home read model;
// seam=the timekeeping dialog is mocked at its module boundary (it binds server actions); no_claim=does not prove layout at real viewport widths or the loader's data
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/timekeeping/components/timekeeping-entry-dialog", () => ({
  TimekeepingEntryDialog: ({
    operation,
    timeEntryId,
    triggerChildren,
    triggerClassName,
  }: {
    operation?: string;
    timeEntryId?: string;
    triggerChildren?: string;
    triggerClassName?: string;
  }) => (
    <button className={triggerClassName} data-entry={timeEntryId} data-operation={operation} type="button">
      {triggerChildren}
    </button>
  ),
}));

import { DashboardHome } from "@/features/dashboard/components/home/dashboard-home";
import {
  failedFeed,
  forbiddenFeed,
  getDashboardFeedAccess,
  getDashboardLayout,
  readyFeed,
  type DashboardHomeReadModel,
  type DashboardSessionRow,
} from "@/features/dashboard/home-models";
import type { PermissionCode } from "@/lib/permissions/types";

afterEach(() => {
  cleanup();
});

const today = "2026-10-12";
const retryHref = "/dev/dashboard?role=owner";

const owner: PermissionCode[] = [
  "dashboard.view",
  "reports.view",
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
  "students.view",
];
const accountant: PermissionCode[] = ["dashboard.view", "sessions.view", "finance.view", "payments.view", "sepay.view", "sepay.accountant_confirm", "tuition_periods.view", "payroll.view", "students.view"];
const ta: PermissionCode[] = ["dashboard.view", "classes.view", "sessions.view", "sessions.manage", "attendance.view", "attendance.mark", "results.view", "results.manage", "timekeeping.check"];

function session(id: string, start: string, end: string, status: DashboardSessionRow["status"]): DashboardSessionRow {
  return {
    attendance: { absent: 0, additional: 0, present: status === "completed" ? 10 : 0, unmarked: status === "completed" ? 0 : 18 },
    classCode: `L-${id}`,
    classId: `class-${id}`,
    className: `Toán ${id}`,
    endTime: end,
    id,
    learningMode: "offline",
    lockedAt: null,
    roomName: "P.201",
    rosterCount: status === "completed" ? 10 : 18,
    sessionDate: today,
    startTime: start,
    status,
  };
}

function model(permissions: PermissionCode[], overrides: Partial<DashboardHomeReadModel> = {}): DashboardHomeReadModel {
  const layout = getDashboardLayout(permissions);
  const centre = layout === "center";
  return {
    awaitingLock: forbiddenFeed,
    careOverdue: forbiddenFeed,
    crmFollowUps: forbiddenFeed,
    executive: {
      attention: readyFeed([{ count: 1, description: "", href: "/payroll", id: "payroll-review", module: "", severity: "danger", title: "" }]),
      receivablesAging: centre ? readyFeed({ collectedVnd: 0, from31To60DaysVnd: 400_000, items: [], over60DaysVnd: 0, totalReceivablesVnd: 900_000, under30DaysVnd: 500_000 }) : forbiddenFeed,
      studentStatus: readyFeed({ activeCount: 312, completedCount: 0, items: [], reservedCount: 3, totalCount: 320, waitingCount: 5 }),
    },
    layout,
    missingResults: centre ? forbiddenFeed : readyFeed([]),
    myMonth: centre ? forbiddenFeed : readyFeed({ gpsShiftCount: 13, month: "2026-10", pendingAdjustmentCount: 0, shiftCount: 14, workedMinutes: 600 }),
    newLeads: forbiddenFeed,
    newStudents: centre ? readyFeed(7) : forbiddenFeed,
    nowTime: "16:05:00",
    permissions,
    sepay: centre ? readyFeed({ count: 3, oldestAt: null, totalIsPartial: false, totalVnd: 4_800_000 }) : forbiddenFeed,
    timekeeping: centre ? forbiddenFeed : readyFeed({ lastCheckOutAt: null, openEntry: null, policy: null }),
    today,
    todaySessions: readyFeed({ rows: [session("6A", "08:00:00", "10:00:00", "completed"), session("8B", "17:30:00", "19:30:00", "scheduled")], truncated: false }),
    tuition: centre
      ? readyFeed({ collectedVnd: 3_000_000, dueOn: "2026-10-15", endsOn: "2026-10-31", name: "tháng 10/2026", notDueVnd: 1_000_000, overdueVnd: 0, payableVnd: 4_000_000, periodId: "oct", requestCount: 4, startsOn: "2026-10-01", status: "locked" })
      : forbiddenFeed,
    unmarked: readyFeed({ items: [], truncated: false }),
    upcomingSession: readyFeed(null),
    weekAttendance: centre ? readyFeed({ absent: 1, present: 9 }) : forbiddenFeed,
    weekEnd: "2026-10-18",
    weekStart: "2026-10-12",
    ...overrides,
  };
}

function primaryControls(container: HTMLElement): string[] {
  return [...container.querySelectorAll("a, button")]
    .filter((element) => element.className.split(/\s+/).includes("bg-action-primary"))
    .map((element) => element.textContent ?? "");
}

describe("DashboardHome", () => {
  it("renders the centre layout with a summary strip, today's schedule, tuition and a work list but no primary button", () => {
    const { container } = render(<DashboardHome centerDisplayName="Cơ sở Cầu Giấy" model={model(owner)} retryHref={retryHref} />);

    expect(screen.getByRole("heading", { level: 1, name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.getByText(/Thứ Hai, 12\/10\/2026 · Cơ sở Cầu Giấy · cập nhật 16:05/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở Báo cáo" })).toHaveAttribute("href", "/reports");
    expect(primaryControls(container)).toEqual([]);

    const strip = screen.getByRole("region", { name: "Tóm tắt hôm nay" });
    expect(within(strip).getByText("Buổi học hôm nay")).toBeInTheDocument();
    expect(within(strip).getByText("Giao dịch SePay chưa khớp")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Buổi học tiếp theo" })).toBeInTheDocument();
    expect(screen.getByText("Còn 1 giờ 25 phút")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Các buổi học hôm nay" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kỳ thu học phí tháng 10/2026" })).toBeInTheDocument();
    expect(screen.getByText(/75% đã thu · 0% quá hạn · 25% chưa đến hạn/)).toBeInTheDocument();

    const work = screen.getByRole("region", { name: /Cần bạn xử lý/ });
    expect(within(work).getByText("1 kỳ lương chờ duyệt")).toBeInTheDocument();
    expect(within(work).getByRole("link", { name: "Đối soát ngay" })).toHaveAttribute("href", "/finance/sepay?queue=review");
    expect(within(work).getByText("3 việc tồn")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tuần này" })).toBeInTheDocument();
  });

  it("shows the accountant finance items only and no reports link without reports.view", () => {
    render(<DashboardHome centerDisplayName="Trung tâm" model={model(accountant)} retryHref={retryHref} />);

    const work = screen.getByRole("region", { name: /Cần bạn xử lý/ });
    expect(within(work).getByText("3 giao dịch SePay chưa khớp")).toBeInTheDocument();
    expect(within(work).getByText(/Công nợ quá 30 ngày/)).toBeInTheDocument();
    expect(within(work).queryByText("1 kỳ lương chờ duyệt")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mở Báo cáo" })).not.toBeInTheDocument();
  });

  it("gives the teaching assistant no primary before the next session starts, a secondary 'Mở buổi học' and a secondary check-in", () => {
    const { container } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(ta)} retryHref={retryHref} />);

    expect(screen.getByRole("heading", { level: 1, name: "Hôm nay của bạn" })).toBeInTheDocument();
    // 8B starts at 17:30 and it is 16:05: nothing to mark or start yet.
    expect(primaryControls(container)).toEqual([]);
    expect(screen.getByRole("heading", { name: "Buổi học tiếp theo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở buổi học" })).toHaveAttribute("href", "/sessions/8B");
    expect(screen.getByRole("link", { name: "Xem lớp" })).toHaveAttribute("href", "/classes/class-8B");
    expect(screen.getByRole("button", { name: "Chấm công vào ca" })).toBeInTheDocument();
    expect(screen.getByText("Chưa chấm công vào ca")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tháng 10 của bạn" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lịch hôm nay của trung tâm" })).toBeInTheDocument();
    // Centre money blocks never reach the personal layout.
    expect(screen.queryByRole("region", { name: "Tóm tắt hôm nay" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Kỳ thu học phí/)).not.toBeInTheDocument();
  });

  // Value: protects=a TA already in a shift sees since when and can only check out of that entry; fails_when=the strip offers check-in again, drops the entry id or misreads the UTC check-in time; why_new=only the not-checked-in strip was rendered; seam=none; no_claim=does not prove the dialog's GPS check or the check-out action
  it("shows an open shift in Vietnam time and offers check-out of that entry", () => {
    render(
      <DashboardHome
        centerDisplayName="Trung tâm"
        model={model(ta, {
          timekeeping: readyFeed({ lastCheckOutAt: null, openEntry: { checkInAt: "2026-10-12T07:58:00.000Z", checkInMode: "offline", id: "entry-1", workShiftName: "Ca chiều" }, policy: null }),
        })}
        retryHref={retryHref}
      />,
    );

    const strip = screen.getByRole("region", { name: "Chấm công" });
    expect(within(strip).getByText("Đang trong ca từ 14:58")).toBeInTheDocument();
    expect(within(strip).getByText("Tại trung tâm · Ca chiều")).toBeInTheDocument();
    const button = within(strip).getByRole("button", { name: "Chấm công ra ca" });
    expect(button).toHaveAttribute("data-operation", "check-out");
    expect(button).toHaveAttribute("data-entry", "entry-1");
    expect(within(strip).queryByRole("button", { name: "Chấm công vào ca" })).not.toBeInTheDocument();
  });

  // REGRESSION (red at HEAD): base showed every timekeeping.check holder the home check-in card and every payroll.view holder their live estimate; design 2a dropped both for centre-layout staff.
  // Value: protects=an accountant or manager (centre layout) who checks in and is paid keeps the home check-in and own live pay estimate they had before step 6; fails_when=the loader gates timekeeping to the personal layout or the centre layout drops the strip or estimate; why_new=no test covered centre staff's own shift; seam=none; no_claim=a product decision may accept this removal (then delete this test)
  it("keeps the shift check-in and the live pay estimate for centre-layout staff who hold timekeeping.check and payroll.view", () => {
    const staff: PermissionCode[] = [...accountant, "timekeeping.check"];
    expect(getDashboardFeedAccess(staff).timekeeping).toBe(true);

    render(
      <DashboardHome
        centerDisplayName="Trung tâm"
        model={model(staff, { timekeeping: readyFeed({ lastCheckOutAt: null, openEntry: null, policy: null }) })}
        payrollEstimate={<p>Lương tạm tính của bạn</p>}
        retryHref={retryHref}
      />,
    );

    expect(screen.getByRole("button", { name: "Chấm công vào ca" })).toBeInTheDocument();
    expect(screen.getByText("Lương tạm tính của bạn")).toBeInTheDocument();
  });

  it("does not offer the primary for a session on another day", () => {
    const tomorrow = { ...session("9A", "19:30:00", "21:30:00", "scheduled"), sessionDate: "2026-10-13" };
    const { container } = render(
      <DashboardHome
        centerDisplayName="Trung tâm"
        model={model(ta, { todaySessions: readyFeed({ rows: [], truncated: false }), upcomingSession: readyFeed(tomorrow) })}
        retryHref={retryHref}
      />,
    );

    expect(primaryControls(container)).toEqual([]);
    expect(screen.getByRole("link", { name: "Mở buổi học" })).toHaveAttribute("href", "/sessions/9A");
  });

  // Value: protects=the personal primary "Điểm danh buổi này" appears for a live session today (with no countdown) and never for a viewer without attendance.mark;
  // fails_when=the attendance.mark check is dropped (primary links to a page the viewer cannot act on) or a running session gets a countdown or loses its primary;
  // why_new=only the upcoming-today and other-day cases were rendered; seam=none; no_claim=does not prove the session page's own permission gate
  it("offers the primary for a live session the viewer can mark, and never without attendance.mark", () => {
    const live = { rows: [session("6A", "15:30:00", "17:30:00", "in_progress")], truncated: false };
    const { container, unmount } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(ta, { todaySessions: readyFeed(live) })} retryHref={retryHref} />);

    expect(primaryControls(container)).toEqual(["Điểm danh buổi này"]);
    expect(screen.getByRole("link", { name: "Điểm danh buổi này" })).toHaveAttribute("href", "/sessions/6A");
    expect(screen.queryByText(/^Còn /)).not.toBeInTheDocument();
    unmount();

    const viewer: PermissionCode[] = ["dashboard.view", "classes.view", "sessions.view", "timekeeping.check"];
    const { container: viewerContainer } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(viewer)} retryHref={retryHref} />);

    expect(primaryControls(viewerContainer)).toEqual([]);
    expect(screen.getByRole("link", { name: "Mở buổi học" })).toHaveAttribute("href", "/sessions/8B");
  });

  // Value: protects=once a scheduled session today reaches its start time, a viewer who can start it (sessions.manage) gets "Bắt đầu buổi học" as the one primary; anyone else, the centre layout and a live session without attendance.mark get a secondary "Mở buổi học";
  // fails_when=the start primary appears without sessions.manage, before the start time or in the centre layout, or a live session offers a primary to a viewer who cannot mark;
  // why_new=the start primary is new; seam=none; no_claim=does not prove the session page's start action
  it("offers 'Bắt đầu buổi học' as the primary once a session is due and the viewer can start it", () => {
    const due = { nowTime: "17:35:00" } satisfies Partial<DashboardHomeReadModel>;
    const { container, unmount } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(ta, due)} retryHref={retryHref} />);

    expect(primaryControls(container)).toEqual(["Bắt đầu buổi học"]);
    expect(screen.getByRole("link", { name: "Bắt đầu buổi học" })).toHaveAttribute("href", "/sessions/8B");
    expect(screen.queryByText(/^Còn /)).not.toBeInTheDocument();
    unmount();

    const marker: PermissionCode[] = ta.filter((code) => code !== "sessions.manage");
    const { container: markerContainer, unmount: unmountMarker } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(marker, due)} retryHref={retryHref} />);
    expect(primaryControls(markerContainer)).toEqual([]);
    expect(screen.getByRole("link", { name: "Mở buổi học" })).toHaveAttribute("href", "/sessions/8B");
    unmountMarker();

    const { container: centreContainer, unmount: unmountCentre } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(owner, due)} retryHref={retryHref} />);
    expect(primaryControls(centreContainer)).toEqual([]);
    unmountCentre();

    const starter: PermissionCode[] = ta.filter((code) => code !== "attendance.mark");
    const live = { rows: [session("6A", "15:30:00", "17:30:00", "in_progress")], truncated: false };
    const { container: starterContainer } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(starter, { todaySessions: readyFeed(live) })} retryHref={retryHref} />);
    expect(primaryControls(starterContainer)).toEqual([]);
    expect(screen.getByRole("link", { name: "Mở buổi học" })).toHaveAttribute("href", "/sessions/6A");
  });

  // Value: protects=the next-session card names an in-progress session past its end time "Chưa hoàn thành" (danger, as in the work list) instead of "Đang học", says "Đã đến giờ bắt đầu" once a session today is due but not started, and sizes its headline by layout;
  // fails_when=an overrunning session still reads as live, a due session shows no countdown text or a stale one, or the personal headline loses its page-title size;
  // why_new=the stage override, the due text and the layout-sized headline are new; seam=none; no_claim=does not prove colours or real typography
  it("labels an overrunning session 'Chưa hoàn thành' and a due one 'Đã đến giờ bắt đầu'", () => {
    const live = { rows: [session("6A", "15:30:00", "17:30:00", "in_progress"), session("8B", "17:30:00", "19:30:00", "scheduled")], truncated: false };

    const { unmount } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(ta, { nowTime: "18:00:00", todaySessions: readyFeed(live) })} retryHref={retryHref} />);
    let next = screen.getByRole("region", { name: "Buổi học tiếp theo" });
    expect(within(next).getByText("15:30 · Toán 6A")).toBeInTheDocument();
    expect(within(next).getByText("Chưa hoàn thành")).toBeInTheDocument();
    expect(within(next).queryByText("Đang học")).not.toBeInTheDocument();
    unmount();

    const { unmount: unmountRunning } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(ta, { nowTime: "16:00:00", todaySessions: readyFeed(live) })} retryHref={retryHref} />);
    next = screen.getByRole("region", { name: "Buổi học tiếp theo" });
    expect(within(next).getByText("Đang học")).toBeInTheDocument();
    expect(within(next).queryByText("Chưa hoàn thành")).not.toBeInTheDocument();
    unmountRunning();

    const { unmount: unmountDue } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(ta, { nowTime: "17:35:00" })} retryHref={retryHref} />);
    next = screen.getByRole("region", { name: "Buổi học tiếp theo" });
    expect(within(next).getByText("Đã đến giờ bắt đầu")).toBeInTheDocument();
    expect(within(next).getByText("Sắp tới")).toBeInTheDocument();
    expect(within(next).getByText("17:30 · Toán 8B")).toHaveClass("text-page-title");
    unmountDue();

    render(<DashboardHome centerDisplayName="Trung tâm" model={model(owner, { nowTime: "16:05:00" })} retryHref={retryHref} />);
    next = screen.getByRole("region", { name: "Buổi học tiếp theo" });
    expect(within(next).getByText("Còn 1 giờ 25 phút")).toBeInTheDocument();
    expect(within(next).queryByText("Đã đến giờ bắt đầu")).not.toBeInTheDocument();
    expect(within(next).getByText("17:30 · Toán 8B")).toHaveClass("text-section-title");
  });

  // Value: protects=a viewer who already checked out today sees a neutral "Đã ra ca lúc HH:MM" in Vietnam time and can still start another shift;
  // fails_when=the strip warns "Chưa chấm công vào ca" after a finished shift, misreads the UTC check-out time, or drops the check-in button; why_new=lastCheckOutAt is new; seam=none; no_claim=does not prove the dialog's check-in rules
  it("shows a finished shift neutrally and still offers check-in", () => {
    render(<DashboardHome centerDisplayName="Trung tâm" model={model(ta, { timekeeping: readyFeed({ lastCheckOutAt: "2026-10-12T08:30:00.000Z", openEntry: null, policy: null }) })} retryHref={retryHref} />);

    const strip = screen.getByRole("region", { name: "Chấm công" });
    expect(within(strip).getByText("Đã ra ca lúc 15:30")).toBeInTheDocument();
    expect(within(strip).getByText("Ca hôm nay đã ghi nhận. Nếu bạn có ca khác, chấm công vào ca mới.")).toBeInTheDocument();
    expect(within(strip).queryByText("Chưa chấm công vào ca")).not.toBeInTheDocument();
    const button = within(strip).getByRole("button", { name: "Chấm công vào ca" });
    expect(button).toHaveAttribute("data-operation", "check-in");
    expect(button).not.toHaveAttribute("data-entry");
  });

  // Value: protects=the "N việc tồn" header and the block count include rows hidden by the four-per-kind cap and show "+" when a read was truncated;
  // fails_when=either count uses the visible rows only or drops the floor; why_new=NeedsActionList.total/totalIsFloor are new; seam=none; no_claim=does not prove the cap itself (see dashboard-home-models.test.ts)
  it("counts hidden rows in the personal header and the work-list count", () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      classCode: `L-u${index}`,
      className: `Toán u${index}`,
      id: `u${index}`,
      reason: "not_started" as const,
      recorded: null,
      roster: null,
      sessionDate: "2026-10-11",
      startTime: `0${index + 1}:00:00`,
    }));
    render(<DashboardHome centerDisplayName="Trung tâm" model={model(ta, { unmarked: readyFeed({ items, truncated: true }) })} retryHref={retryHref} />);

    expect(screen.getByText("Thứ Hai, 12/10/2026 · 2 buổi học hôm nay · 6+ việc tồn")).toBeInTheDocument();
    const work = screen.getByRole("region", { name: /Việc của bạn/ });
    expect(within(work).getByText("6+ việc tồn")).toBeInTheDocument();
    expect(within(work).getAllByRole("link", { name: "Mở buổi" })).toHaveLength(4);
    expect(within(work).getByText("Còn 2+ buổi chưa điểm danh khác ở trang Buổi học.")).toBeInTheDocument();
  });

  // Value: protects=failed own-shift, next-session and own-month feeds stay visible as failures with "Thử lại", never as "not checked in" or "no session" claims, and a forbidden shift strip renders nothing;
  // fails_when=the strip treats a failed read as "Chưa chấm công vào ca" (offering a duplicate check-in), the next-session card says nothing is scheduled when the week's read failed, or month rows vanish;
  // why_new=failed rendering was covered for the schedule and tuition only; seam=none; no_claim=does not prove which loader failures map to failed (see dashboard-home-data.test.ts)
  it("shows failed shift, next-session and month feeds as failures, not as empty or not-checked-in states", () => {
    const { unmount } = render(
      <DashboardHome
        centerDisplayName="Trung tâm"
        model={model(ta, { myMonth: failedFeed, timekeeping: failedFeed, todaySessions: readyFeed({ rows: [], truncated: false }), upcomingSession: failedFeed })}
        retryHref={retryHref}
      />,
    );

    const strip = screen.getByRole("region", { name: "Chấm công" });
    expect(within(strip).getByRole("alert")).toHaveTextContent("Chưa tải được trạng thái chấm công hôm nay.");
    expect(within(strip).getByRole("link", { name: "Thử lại" })).toHaveAttribute("href", retryHref);
    // The retry link sits on the warning banner: its warning colour must be important to beat homeLinkClassName's link colour.
    expect(within(strip).getByRole("link", { name: "Thử lại" }).className.split(/\s+/)).toContain("text-warning-ink!");
    expect(within(strip).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa chấm công vào ca")).not.toBeInTheDocument();

    const next = screen.getByRole("region", { name: "Buổi học tiếp theo" });
    expect(within(next).getByRole("alert")).toHaveTextContent("Chưa tải được lịch buổi học nên chưa biết buổi tiếp theo.");
    expect(within(next).queryByText(/không còn buổi học nào/)).not.toBeInTheDocument();

    const month = screen.getByRole("region", { name: "Tháng 10 của bạn" });
    expect(within(month).getByText("Ca đã chấm công")).toBeInTheDocument();
    expect(within(month).getByRole("alert")).toHaveTextContent("Một số số liệu chưa tải được.");
    unmount();

    render(<DashboardHome centerDisplayName="Trung tâm" model={model(owner)} retryHref={retryHref} />);
    expect(screen.queryByRole("region", { name: "Chấm công" })).not.toBeInTheDocument();
  });

  it("hides a forbidden block entirely but keeps a failed one visible with a reload", () => {
    const { unmount } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(owner, { tuition: forbiddenFeed })} retryHref={retryHref} />);
    expect(screen.queryByText(/Kỳ thu học phí/)).not.toBeInTheDocument();
    unmount();

    render(<DashboardHome centerDisplayName="Trung tâm" model={model(owner, { todaySessions: failedFeed, tuition: failedFeed })} retryHref={retryHref} />);
    expect(screen.getByRole("heading", { name: "Kỳ thu học phí" })).toBeInTheDocument();
    expect(screen.getByText("Chưa tải được tiến độ kỳ thu học phí.")).toBeInTheDocument();
    expect(screen.getByText("Chưa tải được lịch hôm nay.")).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Thử lại" })) expect(link).toHaveAttribute("href", retryHref);
  });

  it("says 'Không có việc tồn' only when every work source loaded", () => {
    const quiet = {
      executive: { attention: readyFeed([]), receivablesAging: forbiddenFeed, studentStatus: forbiddenFeed },
      sepay: readyFeed({ count: 0, oldestAt: null, totalIsPartial: false, totalVnd: 0 }),
    } satisfies Partial<DashboardHomeReadModel>;

    const { unmount } = render(<DashboardHome centerDisplayName="Trung tâm" model={model(owner, quiet)} retryHref={retryHref} />);
    expect(screen.getByText("Không có việc tồn.")).toBeInTheDocument();
    unmount();

    render(<DashboardHome centerDisplayName="Trung tâm" model={model(owner, { ...quiet, unmarked: failedFeed })} retryHref={retryHref} />);
    const work = screen.getByRole("region", { name: /Cần bạn xử lý/ });
    expect(within(work).queryByText("Không có việc tồn.")).not.toBeInTheDocument();
    expect(within(work).getByRole("alert")).toHaveTextContent("Chưa tải được buổi chưa điểm danh");
  });

  it("hides the work list when the viewer may read none of its sources", () => {
    render(
      <DashboardHome
        centerDisplayName="Trung tâm"
        model={model(["dashboard.view", "sessions.view"], { executive: { attention: readyFeed([]), receivablesAging: forbiddenFeed, studentStatus: forbiddenFeed }, timekeeping: forbiddenFeed, myMonth: forbiddenFeed, missingResults: forbiddenFeed })}
        retryHref={retryHref}
      />,
    );

    expect(screen.queryByText("Việc của bạn")).not.toBeInTheDocument();
    expect(screen.queryByText("Không có việc tồn.")).not.toBeInTheDocument();
  });
});
