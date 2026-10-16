import { createRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionFilters, SessionListPage } from "@/features/sessions/session-list-page";
import { countActiveSessionFilters, defaultSessionFilters } from "@/features/sessions/session-filters";
import type { SessionDirectoryItem } from "@/features/sessions/read-models";

/**
 * Still only useRouter and useSearchParams (any other next/navigation import would throw).
 * The params are empty unless a test sets them; the page writes the URL through the
 * History API and the spies feed the href back like Next would (class directory harness).
 * useSearchParams returns a fresh object per call, as before.
 */
const navigation = vi.hoisted(() => {
  const state = { params: new URLSearchParams() };
  const router = { push: vi.fn(), replace: vi.fn() };
  const apply = (_state: unknown, _unused: string, href?: string | URL | null) => {
    state.params = new URLSearchParams(String(href ?? "").split("?")[1] ?? "");
  };
  return { apply, router, state };
});
vi.mock("next/navigation", () => ({ useRouter: () => navigation.router, useSearchParams: () => new URLSearchParams(navigation.state.params) }));
const historySpies = {
  push: vi.spyOn(window.history, "pushState").mockImplementation(navigation.apply),
  replace: vi.spyOn(window.history, "replaceState").mockImplementation(navigation.apply),
};
afterEach(() => {
  cleanup();
  navigation.state.params = new URLSearchParams();
  navigation.router.push.mockClear();
  navigation.router.replace.mockClear();
  historySpies.push.mockClear();
  historySpies.replace.mockClear();
});
const session: SessionDirectoryItem = { attendanceCount: 2, classCode: "7A", classId: "class-1", className: "Toán 7A", componentCode: "MATH-01", endTime: "18:30:00", grade: 7, id: "session-1", learningMode: "offline", level: "A", lockedAt: "2026-08-11T00:00:00Z", resultCount: 1, roomName: "P3", sessionDate: "2026-08-10", sessionKind: "regular", startTime: "17:00:00", status: "completed" };

describe("Sessions directory presentation", () => {
  it("announces active filters and clears them", () => {
    function Harness() { const [filters, setFilters] = useState(defaultSessionFilters); return <SessionFilters activeFilterCount={countActiveSessionFilters(filters)} classOptions={[]} filters={filters} isOpen onClose={vi.fn()} onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))} onReset={() => setFilters(defaultSessionFilters)} returnFocusRef={createRef()} />; }
    render(<Harness />);
    fireEvent.change(screen.getByTestId("mobile-session-status"), { target: { value: "scheduled" } });
    fireEvent.change(screen.getByTestId("mobile-session-kind"), { target: { value: "regular" } });
    expect(screen.getByText("2 bộ lọc đang áp dụng")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("mobile-session-reset-filters"));
    expect(screen.getByText("Lọc danh sách buổi học hiện có")).toBeInTheDocument();
  });

  it("presents a compact textual lifecycle and separate locked state", () => {
    render(<SessionListPage canManageSessions={false} canViewAttendance canViewResults sessions={[session]} />);
    const record = screen.getByRole("listitem");
    expect(record).toHaveTextContent("Đã hoàn thành");
    expect(record).toHaveTextContent("Đã khóa");
    expect(screen.getAllByRole("link", { name: /Mở buổi học/i })).not.toHaveLength(0);
  });

  it("keeps a completed but unlocked session separate from lock readiness", () => {
    render(<SessionListPage canManageSessions={false} canViewAttendance={false} canViewResults={false} sessions={[{ ...session, lockedAt: null }]} />);
    const record = screen.getByRole("listitem");
    expect(record).toHaveTextContent("Đã hoàn thành");
    expect(record).toHaveTextContent("Chưa khóa");
    expect(record).not.toHaveTextContent("Đã khóa");
  });
});

// Value: protects=design 16b on /sessions: chip counts over the loaded rows and only for chips whose range was loaded in full, "Tuần này"/"Chưa điểm danh" written to the URL through the History API (null state, no router call) under the list's own path (basePath), "Chờ khóa"/"Chưa điểm danh" bounded at today and pressed (with numbers) on the lock-queue panel and dashboard landings and on the digest's undated link (no number on a cut window), the week header line (its counts only for a fully loaded week), readiness badges and Khóa/Điểm danh links only from queue data, a failed or full lock queue announced with the counts it decides left out, the D4 x/y cells, the cancel reason, the online link, one record per session on narrow widths, the in-frame empty state, and both window captions;
// fails_when=a chip miscounts, shows a number for a range that was not loaded, or writes the wrong range or path, the page calls router.replace/push, a completed row without a queue item reads "Sẵn sàng khóa" or offers "Khóa", a failed/full queue is silent or still counts "Chưa điểm danh", a walk-in-inflated count shows as x/y, a scheduled session past its end offers "Điểm danh", a record list gains extra list items, no sessions drops the table frame, or a cut window/unloaded range is presented as complete, a `…&to=<today>` or undated digest landing presses no chip, or the header gives counts for a week that was not fully loaded;
// why_new=step 14a rebuilds the list (D1–D12) and its review fixes; the cases above keep the original pins; seam=next/navigation (useRouter, useSearchParams) and window.history spies; no_claim=does not prove Next re-renders on history.replaceState; "Tải lại danh sách" is only checked as an href (a plain anchor, full load), not followed
describe("Sessions directory 16b (step 14a)", () => {
  const today = "2026-08-12";
  const nowTime = "12:00:00";
  const make = (patch: Partial<SessionDirectoryItem> & Pick<SessionDirectoryItem, "classCode" | "id">): SessionDirectoryItem => ({ ...session, classId: `class-${patch.classCode}`, className: `Toán ${patch.classCode}`, componentCode: null, lockedAt: null, ...patch });
  const rows: SessionDirectoryItem[] = [
    make({ classCode: "6A", id: "locked", lockedAt: "2026-08-10T12:00:00Z", markedRosterCount: 16, resultCount: 16, resultEligibleCount: 16, sessionDate: "2026-08-10", status: "completed" }),
    make({ attendanceCount: 17, classCode: "7B", id: "ready", markedRosterCount: 15, resultCount: 14, resultEligibleCount: 14, sessionDate: "2026-08-10", status: "completed" }),
    make({ classCode: "9C", id: "missing", markedRosterCount: 13, resultCount: 0, resultEligibleCount: 13, sessionDate: "2026-08-10", status: "completed" }),
    make({ classCode: "7D", endTime: "10:00:00", id: "live", markedRosterCount: 12, resultCount: 4, resultEligibleCount: 12, sessionDate: today, startTime: "08:00:00", status: "in_progress" }),
    make({ classCode: "8B", id: "upcoming", sessionDate: "2026-08-13", status: "scheduled" }),
    make({ classCode: "8C", id: "overdue", sessionDate: "2026-08-11", status: "scheduled" }),
    make({ classCode: "7O", hasMeetingUrl: true, id: "online", learningMode: "online", roomName: null, sessionDate: "2026-08-14", status: "scheduled" }),
    make({ cancellationReason: "Trùng lịch thi học kỳ của trường", classCode: "10N", id: "cancelled", sessionDate: "2026-08-14", status: "cancelled" }),
    make({ classCode: "6A", id: "older", lockedAt: "2026-08-04T12:00:00Z", markedRosterCount: 16, sessionDate: "2026-08-03", status: "completed" }),
  ];
  const queueItems = [
    { id: "ready", missingAttendanceCount: 0, rosterCount: 15 },
    { id: "missing", missingAttendanceCount: 2, rosterCount: 15 },
  ];
  const chip = (label: string, count: number) => new RegExp(`^${label}\\s?${count}$`);
  const table = () => screen.getByRole("table", { name: "Danh sách buổi học" });
  const header = () => screen.getByRole("heading", { level: 1, name: "Buổi học" }).closest("header") as HTMLElement;
  const tableRow = (code: string) => {
    const match = within(table()).getAllByRole("row").find((item) => item.textContent?.includes(`Toán ${code}`) && within(item).queryByRole("link", { name: new RegExp(`lớp ${code}$`) }));
    if (!match) throw new Error(`No table row for ${code}`);
    return match;
  };
  const page = (props: Partial<Parameters<typeof SessionListPage>[0]> = {}) => <SessionListPage canLock canManageSessions={false} canMarkAttendance canViewAttendance canViewResults nowTime={nowTime} queueItems={queueItems} sessions={rows} today={today} {...props} />;

  it("counts chips over the loaded rows and writes Tuần này as from/to through the History API", () => {
    const view = render(page());
    const chips = screen.getByRole("group", { name: "Lọc nhanh buổi học" });
    expect(within(chips).getByRole("button", { name: chip("Tất cả", 9) })).toHaveAttribute("aria-pressed", "true");
    expect(within(chips).getByRole("button", { name: chip("Hôm nay", 1) })).toBeEnabled();
    expect(within(chips).getByRole("button", { name: chip("Tuần này", 8) })).toBeEnabled();
    expect(within(chips).getByRole("button", { name: chip("Chưa điểm danh", 3) })).toBeEnabled();
    expect(within(chips).getByRole("button", { name: chip("Chờ khóa", 2) })).toBeEnabled();
    expect(within(chips).getByRole("button", { name: chip("Đã khóa", 2) })).toBeEnabled();
    expect(within(chips).getByRole("button", { name: chip("Đã hủy", 1) })).toBeEnabled();
    expect(header()).toHaveTextContent("9 buổi");

    fireEvent.click(within(chips).getByRole("button", { name: chip("Tuần này", 8) }));
    expect(historySpies.replace).toHaveBeenLastCalledWith(null, "", "/sessions?from=2026-08-10&to=2026-08-16");
    view.rerender(page());

    expect(within(chips).getByRole("button", { name: chip("Tuần này", 8) })).toHaveAttribute("aria-pressed", "true");
    expect(within(header()).getByText("Tuần 10–16/08/2026 · 8 buổi · 3 chưa điểm danh · 2 chờ khóa")).toBeInTheDocument();
    expect(within(table()).getAllByRole("row")).toHaveLength(9);
    expect(screen.getByTestId("desktop-session-from")).toHaveValue("2026-08-10");

    fireEvent.click(within(chips).getByRole("button", { name: chip("Chưa điểm danh", 3) }));
    // "Chưa điểm danh" ends at today (its sessions are past their end time), like the dashboard link.
    expect(historySpies.replace).toHaveBeenLastCalledWith(null, "", "/sessions?to=2026-08-12&attendance=missing");
    view.rerender(page());
    expect(within(table()).getAllByRole("row").slice(1).map((item) => within(item).getAllByRole("link").at(-1)?.getAttribute("aria-label"))).toEqual([
      "Điểm danh buổi học Thứ 2, 10/08/2026 lớp 9C",
      "Điểm danh buổi học Thứ 4, 12/08/2026 lớp 7D",
      "Mở buổi học Thứ 3, 11/08/2026 lớp 8C",
    ]);
    expect(within(header()).getByText("3 / 9 buổi")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Bộ lọc buổi học" })).getByRole("button", { name: /^Xóa lọc/ })).toHaveTextContent("Xóa lọc (2)");
    expect(navigation.router.replace).not.toHaveBeenCalled();
    expect(navigation.router.push).not.toHaveBeenCalled();
  });

  it("shows readiness, the lock-rule attendance and the Khóa link only from queue data", () => {
    const view = render(page());
    const ready = tableRow("7B");
    expect(ready).toHaveTextContent("Đã hoàn thành");
    expect(ready).toHaveTextContent("Chưa khóa");
    expect(ready).toHaveTextContent("Sẵn sàng khóa");
    expect(ready).toHaveTextContent("15/15");
    expect(ready).not.toHaveTextContent("17/15");
    expect(within(ready).getByRole("link", { name: "Khóa buổi học Thứ 2, 10/08/2026 lớp 7B" })).toHaveAttribute("href", "/sessions/ready");
    const missing = tableRow("9C");
    expect(missing).toHaveTextContent("Thiếu 2 điểm danh");
    expect(missing).toHaveTextContent("13/15");
    expect(missing).toHaveTextContent("0/13");
    expect(missing).toHaveClass("bg-warning-bg/40");
    expect(within(missing).getByRole("link", { name: "Điểm danh buổi học Thứ 2, 10/08/2026 lớp 9C" })).toBeInTheDocument();

    view.rerender(page({ queueItems: undefined }));
    const unknown = tableRow("7B");
    expect(unknown).toHaveTextContent("Chưa khóa");
    expect(unknown).not.toHaveTextContent("Sẵn sàng khóa");
    expect(unknown).toHaveTextContent("15 đã ghi");
    expect(within(unknown).getByRole("link", { name: "Mở buổi học Thứ 2, 10/08/2026 lớp 7B" })).toBeInTheDocument();
    expect(within(table()).queryByText(/Thiếu \d+ điểm danh/)).not.toBeInTheDocument();
    expect(tableRow("9C")).not.toHaveClass("bg-warning-bg/40");
  });

  it("renders the D4 cells, the overdue captions, the cancel reason and the online link", () => {
    render(page({ canLock: false, canMarkAttendance: false }));
    const locked = tableRow("6A");
    expect(locked).toHaveTextContent("Đã khóa");
    expect(within(locked).getAllByText("16/16")).toHaveLength(2);
    const live = tableRow("7D");
    expect(live).toHaveTextContent("Đang diễn ra");
    expect(live).toHaveTextContent("Chưa hoàn thành");
    expect(live).toHaveTextContent("12 đã ghi");
    expect(live).toHaveTextContent("4/12");
    expect(within(live).getByRole("link", { name: "Mở buổi học Thứ 4, 12/08/2026 lớp 7D" })).toBeInTheDocument();
    expect(tableRow("8C")).toHaveTextContent("Chưa bắt đầu");
    expect(within(tableRow("8B")).getAllByText("—")).toHaveLength(2);
    expect(tableRow("7O")).toHaveTextContent("Online · có link");
    const cancelled = tableRow("10N");
    expect(cancelled).toHaveTextContent("Đã hủy");
    expect(within(cancelled).getByText("Trùng lịch thi học kỳ của trường")).toHaveAttribute("title", "Trùng lịch thi học kỳ của trường");
    expect(tableRow("6A")).toHaveTextContent("K7 · A");
    // The caption truncates before the class name, so its full text stays in the title.
    expect(within(tableRow("6A")).getByTitle("K7 · A")).toHaveTextContent("K7 · A");
    expect(within(table()).queryByRole("link", { name: /^Khóa buổi học/ })).not.toBeInTheDocument();
    expect(within(table()).queryByRole("link", { name: "Toán 6A" })).not.toBeInTheDocument();
  });

  it("keeps exactly one record per session in the narrow list, each opening the session", () => {
    render(page({ canViewClasses: true }));
    const list = screen.getByRole("list", { name: "Danh sách buổi học" });
    expect(screen.getAllByRole("listitem")).toHaveLength(rows.length);
    expect(within(list).getAllByRole("link", { name: /^Mở buổi học/ })).toHaveLength(rows.length);
    const ready = within(list).getByRole("link", { name: "Mở buổi học Thứ 2, 10/08/2026 lớp 7B" });
    expect(ready).toHaveTextContent("Sẵn sàng khóa");
    expect(ready).toHaveTextContent("Điểm danh 15/15");
    expect(within(tableRow("7B")).getByRole("link", { name: "Toán 7B" })).toHaveAttribute("href", "/classes/class-7B");
  });

  it("says when the newest-300 window was cut and offers a reload when the range was not loaded", () => {
    const many = Array.from({ length: 300 }, (_, index) => make({ classCode: `C${index}`, id: `many-${index}`, sessionDate: "2026-09-01", status: "scheduled" }));
    const first = render(page({ sessions: many }));
    expect(screen.getByText("Đang hiển thị 300 buổi mới nhất theo ngày; chọn khoảng ngày để xem đủ.")).toBeInTheDocument();
    expect(screen.queryByText(/Khoảng ngày này có hơn/)).not.toBeInTheDocument();
    // The cut window is not every session: "Tất cả" shows no number.
    expect(within(screen.getByRole("group", { name: "Lọc nhanh buổi học" })).getByRole("button", { name: "Tất cả" })).toBeEnabled();
    first.unmount();

    navigation.state.params = new URLSearchParams("from=2026-08-10&to=2026-08-16");
    const view = render(page({ loadedRange: { dateFrom: "2026-08-10", dateTo: "2026-08-16" }, sessions: rows.slice(0, 8) }));
    expect(screen.queryByText(/chưa được tải đủ/)).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Lọc nhanh buổi học" })).getByRole("button", { name: /^Tất cả/ }));
    expect(historySpies.replace).toHaveBeenLastCalledWith(null, "", "/sessions");
    view.rerender(page({ loadedRange: { dateFrom: "2026-08-10", dateTo: "2026-08-16" }, sessions: rows.slice(0, 8) }));
    expect(screen.getByRole("status")).toHaveTextContent("Khoảng ngày đang chọn chưa được tải đủ");
    expect(screen.getByRole("link", { name: "Tải lại danh sách" })).toHaveAttribute("href", "/sessions");
  });

  it("says a server-bounded range was cut with its own caption, not the unbounded one", () => {
    navigation.state.params = new URLSearchParams("from=2026-09-01&to=2026-09-30");
    const many = Array.from({ length: 300 }, (_, index) => make({ classCode: `C${index}`, id: `many-${index}`, sessionDate: "2026-09-15", status: "scheduled" }));
    render(page({ loadedRange: { dateFrom: "2026-09-01", dateTo: "2026-09-30" }, sessions: many }));
    expect(screen.getByText("Khoảng ngày này có hơn 300 buổi: đang hiển thị 300 buổi mới nhất theo ngày; thu hẹp khoảng ngày để xem đủ.")).toBeInTheDocument();
    expect(screen.queryByText("Đang hiển thị 300 buổi mới nhất theo ngày; chọn khoảng ngày để xem đủ.")).not.toBeInTheDocument();
  });

  it("shows a chip's number only when the server loaded that chip's whole range", () => {
    navigation.state.params = new URLSearchParams("from=2026-08-10&to=2026-08-16");
    render(page({ loadedRange: { dateFrom: "2026-08-10", dateTo: "2026-08-16" }, sessions: rows.slice(0, 8) }));
    const chips = screen.getByRole("group", { name: "Lọc nhanh buổi học" });
    // Only this week was read: today's and this week's chips are full counts…
    expect(within(chips).getByRole("button", { name: chip("Hôm nay", 1) })).toBeEnabled();
    expect(within(chips).getByRole("button", { name: chip("Tuần này", 8) })).toHaveAttribute("aria-pressed", "true");
    // …the chips that drop the range would only count this week, so they carry no number (and stay usable).
    for (const label of ["Tất cả", "Chưa điểm danh", "Chờ khóa", "Đã khóa", "Đã hủy"]) {
      expect(within(chips).getByRole("button", { name: label })).toBeEnabled();
    }
  });

  it("announces a failed or full lock queue and leaves out the counts the queue decides", () => {
    const chips = () => screen.getByRole("group", { name: "Lọc nhanh buổi học" });
    const view = render(page({ queueItems: undefined, queueStatus: "failed" }));
    expect(screen.getByRole("status")).toHaveTextContent("Không tải được hàng đợi khóa: trạng thái sẵn sàng khóa và số chưa điểm danh của các buổi đã hoàn thành có thể thiếu.");
    expect(within(chips()).getByRole("button", { name: "Chưa điểm danh" })).toBeEnabled();
    // "Chờ khóa" is status + lock over the loaded rows, not a queue fact: still counted.
    expect(within(chips()).getByRole("button", { name: chip("Chờ khóa", 2) })).toBeEnabled();
    expect(within(table()).queryByText(/Thiếu \d+ điểm danh|Sẵn sàng khóa/)).not.toBeInTheDocument();
    expect(within(table()).queryByRole("link", { name: /^Khóa buổi học/ })).not.toBeInTheDocument();
    fireEvent.click(within(chips()).getByRole("button", { name: chip("Tuần này", 8) }));
    view.rerender(page({ queueItems: undefined, queueStatus: "failed" }));
    expect(within(header()).getByText("Tuần 10–16/08/2026 · 8 buổi · 2 chờ khóa")).toBeInTheDocument();

    // A full queue page: every completed, unlocked row still has its item, so the count stands.
    view.rerender(page({ queueStatus: "partial" }));
    expect(screen.getByRole("status")).toHaveTextContent("Hàng đợi khóa có từ 500 buổi trở lên; các buổi hoàn thành gần đây có thể chưa có trạng thái sẵn sàng khóa và chưa được tính vào Chưa điểm danh.");
    expect(within(chips()).getByRole("button", { name: chip("Chưa điểm danh", 3) })).toBeEnabled();
    expect(within(header()).getByText("Tuần 10–16/08/2026 · 8 buổi · 3 chưa điểm danh · 2 chờ khóa")).toBeInTheDocument();

    // 9C fell outside the full page: its attendance is unknown, so neither the chip nor the header counts.
    view.rerender(page({ queueItems: queueItems.slice(0, 1), queueStatus: "partial" }));
    expect(within(chips()).getByRole("button", { name: "Chưa điểm danh" })).toBeEnabled();
    expect(within(header()).getByText("Tuần 10–16/08/2026 · 8 buổi · 2 chờ khóa")).toBeInTheDocument();
    expect(tableRow("9C")).not.toHaveTextContent(/Thiếu \d+ điểm danh/);
  });

  it("presses Chờ khóa and Chưa điểm danh, with their numbers, on the lock-queue panel and dashboard landings", () => {
    const chips = () => screen.getByRole("group", { name: "Lọc nhanh buổi học" });
    // These links end at today, so the server read stops there too.
    const props = { loadedRange: { dateFrom: null, dateTo: today }, sessions: rows.filter((item) => item.sessionDate <= today) };

    // The panel's "Lọc danh sách" and the dashboard's awaiting-lock item.
    navigation.state.params = new URLSearchParams(`status=completed&lock=unlocked&to=${today}`);
    const panelLanding = render(page(props));
    expect(within(chips()).getByRole("button", { name: chip("Chờ khóa", 2) })).toHaveAttribute("aria-pressed", "true");
    expect(within(chips()).getByRole("button", { name: chip("Chưa điểm danh", 3) })).toHaveAttribute("aria-pressed", "false");
    // A chip that drops the bound was only read up to today: no number.
    expect(within(chips()).getByRole("button", { name: "Tất cả" })).toBeEnabled();
    expect(screen.queryByText(/chưa được tải đủ/)).not.toBeInTheDocument();
    panelLanding.unmount();

    // The dashboard's unmarked item; switching to Chờ khóa keeps the bound, so nothing asks for a reload.
    navigation.state.params = new URLSearchParams(`attendance=missing&to=${today}`);
    const view = render(page(props));
    expect(within(chips()).getByRole("button", { name: chip("Chưa điểm danh", 3) })).toHaveAttribute("aria-pressed", "true");
    expect(within(table()).getAllByRole("row")).toHaveLength(4);
    fireEvent.click(within(chips()).getByRole("button", { name: chip("Chờ khóa", 2) }));
    expect(historySpies.replace).toHaveBeenLastCalledWith(null, "", `/sessions?status=completed&lock=unlocked&to=${today}`);
    view.rerender(page(props));
    expect(within(chips()).getByRole("button", { name: chip("Chờ khóa", 2) })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/chưa được tải đủ/)).not.toBeInTheDocument();
  });

  it("presses Chờ khóa on the digest's undated link: with its number on a full window, without one (and a bounded reload on press) on a cut one", () => {
    const chips = () => screen.getByRole("group", { name: "Lọc nhanh buổi học" });
    // The stored lock-queue digest notifications link here, with no `to`.
    navigation.state.params = new URLSearchParams("status=completed&lock=unlocked");
    const full = render(page());
    expect(within(chips()).getByRole("button", { name: chip("Chờ khóa", 2) })).toHaveAttribute("aria-pressed", "true");
    expect(within(table()).getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByText(/chưa được tải đủ/)).not.toBeInTheDocument();
    full.unmount();

    navigation.state.params = new URLSearchParams("attendance=missing");
    const unmarked = render(page());
    expect(within(chips()).getByRole("button", { name: chip("Chưa điểm danh", 3) })).toHaveAttribute("aria-pressed", "true");
    unmarked.unmount();

    // A cut newest-300 window: the chip is pressed but carries no number; the cut caption says why.
    navigation.state.params = new URLSearchParams("status=completed&lock=unlocked");
    const many = [
      ...Array.from({ length: 299 }, (_, index) => make({ classCode: `C${index}`, id: `many-${index}`, sessionDate: "2026-09-01", status: "scheduled" })),
      make({ classCode: "7B", id: "ready", sessionDate: "2026-08-10", status: "completed" }),
    ];
    const cut = render(page({ sessions: many }));
    expect(within(chips()).getByRole("button", { name: "Chờ khóa" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Đang hiển thị 300 buổi mới nhất theo ngày; chọn khoảng ngày để xem đủ.")).toBeInTheDocument();
    // Pressing it writes the bounded state; the reload then reads (…, today] from the server.
    fireEvent.click(within(chips()).getByRole("button", { name: "Chờ khóa" }));
    expect(historySpies.replace).toHaveBeenLastCalledWith(null, "", `/sessions?status=completed&lock=unlocked&to=${today}`);
    cut.rerender(page({ sessions: many }));
    expect(screen.getByRole("status")).toHaveTextContent("Khoảng ngày đang chọn chưa được tải đủ");
    expect(screen.getByRole("link", { name: "Tải lại danh sách" })).toHaveAttribute("href", `/sessions?status=completed&lock=unlocked&to=${today}`);
  });

  it("writes to=<today> for Chờ khóa and Chưa điểm danh on an unbounded load and keeps their numbers", () => {
    const chips = () => screen.getByRole("group", { name: "Lọc nhanh buổi học" });
    const view = render(page());
    fireEvent.click(within(chips()).getByRole("button", { name: chip("Chờ khóa", 2) }));
    expect(historySpies.replace).toHaveBeenLastCalledWith(null, "", `/sessions?status=completed&lock=unlocked&to=${today}`);
    view.rerender(page());
    expect(within(chips()).getByRole("button", { name: chip("Chờ khóa", 2) })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("desktop-session-to")).toHaveValue(today);
    expect(screen.queryByText(/chưa được tải đủ/)).not.toBeInTheDocument();

    fireEvent.click(within(chips()).getByRole("button", { name: chip("Chưa điểm danh", 3) }));
    view.rerender(page());
    expect(within(chips()).getByRole("button", { name: chip("Chưa điểm danh", 3) })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/chưa được tải đủ/)).not.toBeInTheDocument();
  });

  it("shows the week's counts in the header only when that whole week was loaded", () => {
    const chips = () => screen.getByRole("group", { name: "Lọc nhanh buổi học" });
    const countsPattern = /buổi ·|chưa điểm danh|chờ khóa/;
    // A to=<today> landing on Wednesday 12/08: the week runs to Sunday 16/08, past what the server read.
    navigation.state.params = new URLSearchParams(`status=completed&lock=unlocked&to=${today}`);
    const props = { loadedRange: { dateFrom: null, dateTo: today }, sessions: rows.filter((item) => item.sessionDate <= today) };
    const bounded = render(page(props));
    fireEvent.click(within(chips()).getByRole("button", { name: /^Tuần này/ }));
    bounded.rerender(page(props));
    expect(screen.getByRole("status")).toHaveTextContent("Khoảng ngày đang chọn chưa được tải đủ");
    expect(within(header()).getByText("Tuần 10–16/08/2026")).toBeInTheDocument();
    expect(header()).not.toHaveTextContent(countsPattern);
    bounded.unmount();

    // A cut newest-300 window whose oldest loaded date falls inside the week.
    navigation.state.params = new URLSearchParams();
    const many = Array.from({ length: 300 }, (_, index) => make({ classCode: `C${index}`, id: `many-${index}`, sessionDate: "2026-08-14", status: "scheduled" }));
    const cut = render(page({ sessions: many }));
    fireEvent.click(within(chips()).getByRole("button", { name: /^Tuần này/ }));
    cut.rerender(page({ sessions: many }));
    expect(within(header()).getByText("Tuần 10–16/08/2026")).toBeInTheDocument();
    expect(header()).not.toHaveTextContent(countsPattern);
  });

  it("writes the preview's own path, keeping row links on the real routes", () => {
    navigation.state.params = new URLSearchParams("view=sessions&from=2026-08-10&to=2026-08-16");
    const props = { basePath: "/dev/lists", loadedRange: { dateFrom: "2026-08-10", dateTo: "2026-08-16" }, sessions: rows.slice(0, 8) };
    const view = render(page(props));
    fireEvent.click(within(screen.getByRole("group", { name: "Lọc nhanh buổi học" })).getByRole("button", { name: "Tất cả" }));
    expect(historySpies.replace).toHaveBeenLastCalledWith(null, "", "/dev/lists?view=sessions");
    view.rerender(page(props));
    expect(screen.getByRole("link", { name: "Tải lại danh sách" })).toHaveAttribute("href", "/dev/lists?view=sessions");
    expect(within(tableRow("7B")).getByRole("link", { name: "Khóa buổi học Thứ 2, 10/08/2026 lớp 7B" })).toHaveAttribute("href", "/sessions/ready");
  });

  it("keeps the table frame with an in-frame empty state when there are no sessions", () => {
    const view = render(page({ queueItems: [], sessions: [] }));
    const frame = table().parentElement as HTMLElement;
    expect(frame).toHaveTextContent("Chưa có buổi học");
    expect(frame).toHaveTextContent("Buổi học xuất hiện khi được tạo từ lịch lớp.");
    // The narrow layout gets the same state in its place, and no empty list.
    expect(screen.getAllByText("Chưa có buổi học")).toHaveLength(2);
    expect(screen.queryByRole("list", { name: "Danh sách buổi học" })).not.toBeInTheDocument();
    view.rerender(page({ canManageSessions: true, queueItems: [], sessions: [] }));
    expect(table().parentElement).toHaveTextContent("Buổi học xuất hiện khi tạo từ lịch lớp hoặc bằng nút Tạo buổi học.");
  });
});

// Generated by /ship coverage audit (Claude) — 2026-10-16
// Value: protects=after the move from router writes to local state + History API, an outside URL change or Back still wins (also a Back that changes only the address bar, before useSearchParams updates) and row/create links keep the filter context;
// fails_when=the URL-sync block is dropped (an outside change or the queue's Lọc danh sách link leaves stale filters), the popstate listener is dropped, or row/create/batch links lose the query;
// why_new=existing cases only rerender after the page's own writes; seam=next/navigation and window.history spies (as above); no_claim=the first case updates the mocked params before popstate, so only the second proves the popstate listener; not Next's own traversal
describe("Sessions directory URL ownership (step 14a regression)", () => {
  const make = (patch: Partial<SessionDirectoryItem> & Pick<SessionDirectoryItem, "classCode" | "id">): SessionDirectoryItem => ({ ...session, classId: `class-${patch.classCode}`, className: `Toán ${patch.classCode}`, componentCode: null, lockedAt: null, ...patch });
  const rows: SessionDirectoryItem[] = [
    make({ classCode: "7B", id: "ready", sessionDate: "2026-08-10", status: "completed" }),
    make({ classCode: "9C", id: "missing", sessionDate: "2026-08-10", status: "completed" }),
    make({ classCode: "6A", id: "locked", lockedAt: "2026-08-10T12:00:00Z", sessionDate: "2026-08-10", status: "completed" }),
    make({ classCode: "8B", id: "upcoming", sessionDate: "2026-08-13", status: "scheduled" }),
    make({ classCode: "10N", id: "cancelled", sessionDate: "2026-08-14", status: "cancelled" }),
  ];
  const page = () => <SessionListPage canManageSessions canViewAttendance={false} canViewResults={false} sessions={rows} />;
  const hrefs = (name: string) => screen.getAllByRole("link", { name }).map((link) => link.getAttribute("href"));

  it("lets an outside URL change or Back win over its own writes and keeps the filters in its links (URL wins)", () => {
    // Base-compatible harness: a router write lands in the URL too (the list no longer calls the router).
    navigation.router.replace.mockImplementation((href: string) => navigation.apply(null, "", href));
    try {
      const view = render(page());
      fireEvent.change(screen.getByTestId("desktop-session-status"), { target: { value: "cancelled" } });
      view.rerender(page());
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(new Set(hrefs("Mở buổi học Thứ 6, 14/08/2026 lớp 10N"))).toEqual(new Set(["/sessions/cancelled?status=cancelled"]));
      expect(screen.getByRole("link", { name: "Tạo buổi học" })).toHaveAttribute("href", "/sessions/new?status=cancelled");
      expect(screen.getByRole("link", { name: "Tạo hàng loạt" })).toHaveAttribute("href", "/sessions/batch?status=cancelled");

      // A soft navigation from outside the list (the lock queue's "Lọc danh sách" link).
      navigation.state.params = new URLSearchParams("status=completed&lock=unlocked");
      view.rerender(page());
      expect(screen.getByTestId("desktop-session-status")).toHaveValue("completed");
      expect(screen.getByTestId("desktop-session-lock")).toHaveValue("unlocked");
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      expect(new Set(hrefs("Mở buổi học Thứ 2, 10/08/2026 lớp 7B"))).toEqual(new Set(["/sessions/ready?status=completed&lock=unlocked"]));

      // Back: the browser restores the earlier URL and fires popstate.
      History.prototype.replaceState.call(window.history, null, "", "/sessions?status=cancelled");
      navigation.state.params = new URLSearchParams("status=cancelled");
      act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
      view.rerender(page());
      expect(screen.getByTestId("desktop-session-status")).toHaveValue("cancelled");
      expect(screen.getByTestId("desktop-session-lock")).toHaveValue("all");
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(new Set(hrefs("Mở buổi học Thứ 6, 14/08/2026 lớp 10N"))).toEqual(new Set(["/sessions/cancelled?status=cancelled"]));
    } finally {
      navigation.router.replace.mockReset();
      History.prototype.replaceState.call(window.history, null, "", "/");
    }
  });

  it("follows the address bar on popstate even before useSearchParams changes", () => {
    try {
      render(page());
      expect(screen.getAllByRole("listitem")).toHaveLength(rows.length);
      // Back to an entry the list wrote earlier: only the address bar changes, the mocked params stay empty.
      History.prototype.replaceState.call(window.history, null, "", "/sessions?status=cancelled");
      act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
      expect(screen.getByTestId("desktop-session-status")).toHaveValue("cancelled");
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(new Set(hrefs("Mở buổi học Thứ 6, 14/08/2026 lớp 10N"))).toEqual(new Set(["/sessions/cancelled?status=cancelled"]));
    } finally {
      History.prototype.replaceState.call(window.history, null, "", "/");
    }
  });
});
