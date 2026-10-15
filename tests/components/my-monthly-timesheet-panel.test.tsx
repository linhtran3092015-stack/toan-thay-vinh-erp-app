import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MyMonthlyTimesheetPanel } from "@/features/timekeeping/components/my-monthly-timesheet-panel";
import { fetchMyMonthlyTimesheetAction } from "@/features/timekeeping/timekeeping-admin-actions";
import { requestTimeEntryAdjustmentAction } from "@/features/timekeeping/timekeeping-adjustment-actions";
import type { TimekeepingMonthlyEntry } from "@/features/timekeeping/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/features/timekeeping/timekeeping-admin-actions", () => ({
  fetchMyMonthlyTimesheetAction: vi.fn(),
}));

vi.mock("@/features/timekeeping/timekeeping-adjustment-actions", () => ({
  requestTimeEntryAdjustmentAction: vi.fn(),
}));

const mockEntries: TimekeepingMonthlyEntry[] = [
  {
    adjustedCheckInAt: null,
    adjustedCheckOutAt: null,
    adjustmentStatus: "none",
    autoEndedAt: null,
    checkInAt: "2026-09-01T08:00:00+07:00",
    checkInMode: "offline",
    checkOutAt: "2026-09-01T17:00:00+07:00",
    checkOutMode: "offline",
    clockOutReason: "manual",
    hasCheckInGpsEvidence: true,
    hasCheckInWifiEvidence: true,
    hasCheckOutGpsEvidence: true,
    hasCheckOutWifiEvidence: true,
    id: "entry-1",
    isUnscheduled: false,
    status: "checked_out",
    totalMinutes: 540,
    workDate: "2026-09-01",
    workShiftCode: "CA-SANG",
    workShiftName: "Ca Sáng Chuẩn",
  },
  {
    adjustedCheckInAt: null,
    adjustedCheckOutAt: null,
    adjustmentStatus: "none",
    autoEndedAt: "2026-09-02T15:30:00+07:00",
    checkInAt: "2026-09-02T08:00:00+07:00",
    checkInMode: "offline",
    checkOutAt: "2026-09-02T15:30:00+07:00",
    checkOutMode: "auto_end",
    clockOutReason: "left_geofence",
    hasCheckInGpsEvidence: true,
    hasCheckInWifiEvidence: false,
    hasCheckOutGpsEvidence: false,
    hasCheckOutWifiEvidence: false,
    id: "entry-2",
    isUnscheduled: false,
    status: "auto_ended",
    totalMinutes: 450,
    workDate: "2026-09-02",
    workShiftCode: "CA-SANG",
    workShiftName: "Ca Sáng Chuẩn",
  },
  {
    adjustedCheckInAt: "2026-09-03T08:00:00+07:00",
    adjustedCheckOutAt: "2026-09-03T17:00:00+07:00",
    adjustmentStatus: "approved",
    autoEndedAt: null,
    checkInAt: "2026-09-03T08:30:00+07:00",
    checkInMode: "online",
    checkOutAt: "2026-09-03T16:30:00+07:00",
    checkOutMode: "online",
    clockOutReason: "manual",
    hasCheckInGpsEvidence: false,
    hasCheckInWifiEvidence: false,
    hasCheckOutGpsEvidence: false,
    hasCheckOutWifiEvidence: false,
    id: "entry-3",
    isUnscheduled: true,
    status: "checked_out",
    totalMinutes: 540,
    workDate: "2026-09-03",
    workShiftCode: null,
    workShiftName: null,
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MyMonthlyTimesheetPanel", () => {
  it("renders panel header and KPI summary cards correctly", () => {
    render(
      <MyMonthlyTimesheetPanel
        canCheck={true}
        initialEntries={mockEntries}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    expect(screen.getByText("Bảng công cá nhân theo tháng")).toBeInTheDocument();

    // KPI 1: Distinct work days: 3
    expect(screen.getByText("Số ngày đi làm")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    // KPI 2: Total hours: (540 + 450 + 540) = 1530 mins = 25.5 hours
    expect(screen.getByText("Tổng giờ làm việc")).toBeInTheDocument();
    expect(screen.getByText("25.5")).toBeInTheDocument();

    // KPI 3: Auto-ended count: 1 & KPI 4: Adjusted count: 1
    expect(screen.getByText("Ca tự động ngắt")).toBeInTheDocument();
    expect(screen.getByText("Ca đã điều chỉnh")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("displays auto-ended status with geofence exit reason", () => {
    render(
      <MyMonthlyTimesheetPanel
        canCheck={true}
        initialEntries={mockEntries}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    expect(screen.getByText("Rời khỏi trung tâm")).toBeInTheDocument();
  });

  it("displays approved adjustment indicator", () => {
    render(
      <MyMonthlyTimesheetPanel
        canCheck={true}
        initialEntries={mockEntries}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    expect(screen.getByText("Đã duyệt sửa giờ")).toBeInTheDocument();
  });
});

 it("keeps the page usable when a monthly server action rejects and permits retry", async () => {
   vi.mocked(fetchMyMonthlyTimesheetAction).mockRejectedValueOnce(new Error("network"));
   render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);
   fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "8" } });
   expect(await screen.findByText("Không thể tải bảng công. Vui lòng chọn lại tháng để thử lại.")).toBeInTheDocument();
   expect(screen.queryByText("25.5")).not.toBeInTheDocument();
   vi.mocked(fetchMyMonthlyTimesheetAction).mockResolvedValueOnce({ ok: true, entries: mockEntries });
   fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "9" } });
   expect(await screen.findByText("25.5")).toBeInTheDocument();
 });

// Step 12 (design 14c, D7–D9): mobile cards, the per-card adjustment entry
// point, re-sync after router.refresh() and the preview's fetch override.
describe("MyMonthlyTimesheetPanel mobile cards (design 14c)", () => {
  const pendingAutoEnded: TimekeepingMonthlyEntry = {
    ...mockEntries[1],
    adjustedCheckInAt: "2026-09-02T08:00:00+07:00",
    adjustedCheckOutAt: "2026-09-02T17:00:00+07:00",
    adjustmentStatus: "pending",
  };
  const augustEntry: TimekeepingMonthlyEntry = {
    ...mockEntries[0],
    checkInAt: "2026-08-15T08:00:00+07:00",
    checkOutAt: "2026-08-15T12:00:00+07:00",
    id: "entry-aug",
    totalMinutes: 240,
    workDate: "2026-08-15",
  };

  function cardList() {
    return screen.getByRole("list", { name: "Bảng công cá nhân Tháng 9/2026" });
  }

  function cardFor(heading: string): HTMLElement {
    const card = screen.getByRole("heading", { level: 3, name: heading }).closest("[role='listitem']");
    if (!(card instanceof HTMLElement)) throw new Error(`Expected a card for ${heading}.`);
    return card;
  }

  function kpi(label: string): Element | null {
    return screen.getByText(label).nextElementSibling;
  }

  it("renders one card per entry with date, shift, duration, times, mode, evidence and badges", () => {
    render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);

    expect(within(cardList()).getAllByRole("listitem")).toHaveLength(3);

    const first = cardFor("T3 01/09 · Ca Sáng Chuẩn");
    expect(first).toHaveTextContent("9 giờ");
    expect(first).toHaveTextContent("08:00 → 17:00 · Tại trung tâm · GPS + Wi-Fi");
    expect(within(first).getByText("Đã check-out")).toBeInTheDocument();

    const autoEnded = cardFor("T4 02/09 · Ca Sáng Chuẩn");
    expect(within(autoEnded).getByText("7 giờ 30")).toBeInTheDocument();
    expect(autoEnded).toHaveTextContent("08:00 → 15:30 · Tại trung tâm · GPS · tự kết thúc · rời khu vực Trung tâm");
    const reason = within(autoEnded).getByText("tự kết thúc · rời khu vực Trung tâm");
    expect(reason.tagName).toBe("STRONG");
    expect(within(autoEnded).getByText("Tự động kết thúc")).toBeInTheDocument();

    const unscheduled = cardFor("T5 03/09 · Ngoài lịch");
    expect(unscheduled).toHaveTextContent("08:00 → 17:00 (đã sửa) · Trực tuyến");
    expect(unscheduled).not.toHaveTextContent(/GPS|không kèm vị trí/);
    expect(within(unscheduled).getByText("Ca ngoài lịch")).toBeInTheDocument();
    expect(within(unscheduled).getByText("Điều chỉnh · đã duyệt")).toBeInTheDocument();

    // The table keeps the single pinned occurrences; the cards word them differently.
    expect(screen.getAllByText("Rời khỏi trung tâm")).toHaveLength(1);
    expect(screen.getAllByText("Đã duyệt sửa giờ")).toHaveLength(1);
    expect(screen.getAllByText("1")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" })).toBeEnabled();
  });

  it("offers a per-card request only on the auto-ended card and opens the sheet on that entry", () => {
    render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);

    const cardTriggers = screen.getAllByRole("button", { name: /^Yêu cầu điều chỉnh ca / });
    expect(cardTriggers).toHaveLength(1);
    const cardTrigger = within(cardFor("T4 02/09 · Ca Sáng Chuẩn")).getByRole("button", { name: "Yêu cầu điều chỉnh ca T4 02/09" });
    expect(cardTrigger).toBe(cardTriggers[0]);
    expect(cardTrigger).toHaveTextContent("Yêu cầu điều chỉnh");

    fireEvent.click(cardTrigger);
    const dialog = screen.getByRole("dialog", { name: "Yêu cầu điều chỉnh công" });
    expect(within(dialog).getByLabelText("Lượt chấm công cần điều chỉnh")).toHaveValue("entry-2");
    expect(within(dialog).getByText("T4 02/09 · ghi nhận 08:00 → 15:30 (tự động kết thúc)")).toBeInTheDocument();

    // The header trigger still opens on the first closed entry.
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));
    expect(screen.getByLabelText("Lượt chấm công cần điều chỉnh")).toHaveValue("entry-1");
  });

  it("hides the per-card request without timekeeping.check", () => {
    render(<MyMonthlyTimesheetPanel canCheck={false} initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);

    expect(screen.queryByRole("button", { name: /Yêu cầu điều chỉnh/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "T4 02/09 · Ca Sáng Chuẩn" })).toBeInTheDocument();
  });

  it("shows a pending request with its proposed times instead of the per-card trigger", () => {
    render(
      <MyMonthlyTimesheetPanel
        canCheck
        initialEntries={[mockEntries[0], pendingAutoEnded, mockEntries[2]]}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    const card = cardFor("T4 02/09 · Ca Sáng Chuẩn");
    expect(within(card).getByText("Yêu cầu điều chỉnh · chờ duyệt")).toBeInTheDocument();
    expect(within(card).getByText("đề nghị 08:00 → 17:00")).toBeInTheDocument();
    // Pending times are a proposal: the recorded times stay on the card.
    expect(card).toHaveTextContent("08:00 → 15:30 · Tại trung tâm");
    expect(screen.queryByRole("button", { name: /^Yêu cầu điều chỉnh ca / })).not.toBeInTheDocument();
    // The header trigger keeps listing every closed entry (server stays authoritative).
    expect(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" })).toBeEnabled();
  });

  it("keeps the per-card request after a rejection and drops it after an approval", () => {
    const { rerender } = render(
      <MyMonthlyTimesheetPanel
        canCheck
        initialEntries={[{ ...mockEntries[1], adjustmentStatus: "rejected" }]}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    expect(screen.getByText("Điều chỉnh · bị từ chối")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yêu cầu điều chỉnh ca T4 02/09" })).toBeInTheDocument();

    rerender(
      <MyMonthlyTimesheetPanel
        canCheck
        initialEntries={[{ ...mockEntries[1], adjustmentStatus: "approved" }]}
        initialMonth={9}
        initialYear={2026}
      />,
    );
    expect(screen.getByText("Điều chỉnh · đã duyệt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Yêu cầu điều chỉnh ca / })).not.toBeInTheDocument();
  });

  it("re-syncs cards and KPIs from a new initialEntries array while the loaded month is selected", () => {
    const { rerender } = render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);
    expect(screen.getByText("25.5")).toBeInTheDocument();

    // router.refresh() after a request: the server sends a fresh array for the same month.
    rerender(<MyMonthlyTimesheetPanel canCheck initialEntries={[mockEntries[0], pendingAutoEnded]} initialMonth={9} initialYear={2026} />);

    expect(within(cardList()).getAllByRole("listitem")).toHaveLength(2);
    expect(within(cardFor("T4 02/09 · Ca Sáng Chuẩn")).getByText("Yêu cầu điều chỉnh · chờ duyệt")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "T5 03/09 · Ngoài lịch" })).not.toBeInTheDocument();
    expect(kpi("Số ngày đi làm")).toHaveTextContent("2 ngày");
    expect(screen.getByText("16.5")).toBeInTheDocument();
    expect(kpi("Ca đã điều chỉnh")).toHaveTextContent("0");
    expect(fetchMyMonthlyTimesheetAction).not.toHaveBeenCalled();
  });

  it("does not let a refreshed initialEntries overwrite another month the person switched to", async () => {
    vi.mocked(fetchMyMonthlyTimesheetAction).mockResolvedValueOnce({ entries: [augustEntry], ok: true });
    const { rerender } = render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);

    fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "8" } });
    expect(await screen.findByRole("heading", { level: 3, name: "T7 15/08 · Ca Sáng Chuẩn" })).toBeInTheDocument();
    expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledWith(8, 2026);

    rerender(<MyMonthlyTimesheetPanel canCheck initialEntries={[...mockEntries]} initialMonth={9} initialYear={2026} />);

    expect(screen.getByRole("heading", { level: 3, name: "T7 15/08 · Ca Sáng Chuẩn" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "T3 01/09 · Ca Sáng Chuẩn" })).not.toBeInTheDocument();
    expect(screen.queryByText("25.5")).not.toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
  });

  // Value: protects=each auto-ended card names why the system closed the shift (daily cutoff, lost signal, left the area, unknown) in its own card wording;
  // fails_when=the reason mapping is swapped or collapsed, e.g. a 22:30/22:45 cutoff (the only auto-end since 2026-09-15) reads "rời khu vực Trung tâm" or a null reason crashes/blanks the line;
  // why_new=the cards test above covers only left_geofence and the /dev preview test asserts the sheet summary, not the card reason;
  // seam=none; no_claim=does not prove the server records the right clockOutReason
  it.each([
    ["daily_cutoff", "tự kết thúc · quên ra ca, tự đóng theo giờ chốt"],
    ["location_lost", "tự kết thúc · mất tín hiệu vị trí"],
    ["left_geofence", "tự kết thúc · rời khu vực Trung tâm"],
    [null, "tự kết thúc · hệ thống tự động"],
  ] as const)("words the auto-end reason %s on the card", (clockOutReason, expected) => {
    render(
      <MyMonthlyTimesheetPanel
        canCheck
        initialEntries={[{ ...mockEntries[1], clockOutReason }]}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    const card = cardFor("T4 02/09 · Ca Sáng Chuẩn");
    const reason = within(card).getByText(expected);
    expect(reason.tagName).toBe("STRONG");
    expect(within(card).getAllByText(/^tự kết thúc · /)).toHaveLength(1);
  });

  // Value: protects=cards never claim evidence or a check-out that does not exist: an on-site shift without GPS reads "không kèm vị trí" (Wi-Fi alone is not location) and an open shift reads "→ đang làm" with a "—" duration and no per-card request;
  // fails_when=getEvidenceText falls back to "GPS"/"GPS + Wi-Fi" for an entry without GPS, or an open shift shows a formatted check-out time/duration or a request trigger;
  // why_new=the cards test above only renders GPS-backed and online entries, all closed;
  // seam=none; no_claim=does not prove the monthly RPC returns today's open shift
  it("words an on-site shift without GPS and an open shift truthfully", () => {
    const noGps: TimekeepingMonthlyEntry = { ...mockEntries[0], hasCheckInGpsEvidence: false, hasCheckInWifiEvidence: true };
    const open: TimekeepingMonthlyEntry = {
      ...mockEntries[0],
      checkInAt: "2026-09-04T08:00:00+07:00",
      checkOutAt: null,
      checkOutMode: null,
      clockOutReason: null,
      id: "entry-open",
      status: "open",
      totalMinutes: null,
      workDate: "2026-09-04",
    };
    render(<MyMonthlyTimesheetPanel canCheck initialEntries={[noGps, open]} initialMonth={9} initialYear={2026} />);

    const noGpsCard = cardFor("T3 01/09 · Ca Sáng Chuẩn");
    expect(noGpsCard).toHaveTextContent("08:00 → 17:00 · Tại trung tâm · không kèm vị trí");
    expect(noGpsCard).not.toHaveTextContent(/GPS/);

    const openCard = cardFor("T6 04/09 · Ca Sáng Chuẩn");
    expect(openCard).toHaveTextContent("08:00 → đang làm · Tại trung tâm · GPS");
    expect(within(openCard).getByText("—")).toBeInTheDocument();
    expect(within(openCard).getByText("Đang trong ca")).toBeInTheDocument();
    expect(openCard).not.toHaveTextContent(/tự kết thúc|giờ/);
    expect(within(openCard).queryByRole("button")).not.toBeInTheDocument();
  });

  it("fetches other months through the override instead of the server action", async () => {
    const fetchMyMonthlyTimesheet = vi.fn().mockResolvedValue({ entries: [augustEntry], ok: true });
    render(
      <MyMonthlyTimesheetPanel
        actions={{ fetchMyMonthlyTimesheet }}
        canCheck
        initialEntries={mockEntries}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "8" } });

    expect(await screen.findByRole("heading", { level: 3, name: "T7 15/08 · Ca Sáng Chuẩn" })).toBeInTheDocument();
    expect(fetchMyMonthlyTimesheet).toHaveBeenCalledWith(8, 2026);
    expect(fetchMyMonthlyTimesheetAction).not.toHaveBeenCalled();
  });

  const SENT_TEXT = "Đã gửi yêu cầu điều chỉnh, chờ quản lý duyệt.";
  const augustAutoEnded: TimekeepingMonthlyEntry = {
    ...mockEntries[1],
    autoEndedAt: "2026-08-14T22:30:00+07:00",
    checkInAt: "2026-08-14T08:00:00+07:00",
    checkOutAt: "2026-08-14T22:30:00+07:00",
    clockOutReason: "daily_cutoff",
    id: "entry-aug-auto",
    totalMinutes: 870,
    workDate: "2026-08-14",
  };

  async function sendCardRequest(cardLabel: string): Promise<void> {
    fireEvent.click(screen.getByRole("button", { name: `Yêu cầu điều chỉnh ca ${cardLabel}` }));
    const dialog = screen.getByRole("dialog", { name: "Yêu cầu điều chỉnh công" });
    fireEvent.change(within(dialog).getByLabelText(/Lý do điều chỉnh/), { target: { value: "Quên ra ca" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gửi yêu cầu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  }

  // Value: protects=after a card's own request succeeds, that card drops its trigger, says "Đã gửi yêu cầu điều chỉnh, chờ quản lý duyệt." in a polite live region and takes focus itself (tabIndex -1 article) instead of letting focus fall to <body>; with the initially loaded month selected nothing is re-fetched (router.refresh() covers it);
  // fails_when=the card ignores onSubmitted (trigger stays, a second request can be sent), the confirmation is missing or not polite, focus is lost, or the initial month is fetched again on top of router.refresh();
  // why_new=onSubmitted and the card's sent state are new in review cycle 1; the card tests above stop at opening the sheet;
  // seam=requestTimeEntryAdjustmentAction module mock (success), fetchMyMonthlyTimesheetAction module mock, next/navigation router mock; no_claim=does not prove the server stored the request or that the refreshed entry comes back pending
  it("confirms a sent card request on that card, hides its trigger and focuses the card", async () => {
    vi.mocked(requestTimeEntryAdjustmentAction).mockResolvedValueOnce({ message: "Đã gửi yêu cầu điều chỉnh.", status: "success" });
    const { rerender } = render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);
    const card = cardFor("T4 02/09 · Ca Sáng Chuẩn");
    expect(card).toHaveAttribute("tabindex", "-1");
    expect(within(card).queryByText(SENT_TEXT)).not.toBeInTheDocument();

    await sendCardRequest("T4 02/09");

    expect(requestTimeEntryAdjustmentAction).toHaveBeenCalledWith(expect.objectContaining({ timeEntryId: "entry-2" }));
    expect(within(card).queryByRole("button", { name: /Yêu cầu điều chỉnh/ })).not.toBeInTheDocument();
    const sent = within(card).getByText(SENT_TEXT);
    expect(sent).toHaveAttribute("aria-live", "polite");
    await waitFor(() => expect(card).toHaveFocus());
    expect(card).toHaveAttribute("role", "listitem");
    expect(sent).toHaveClass("empty:sr-only");
    expect(sent).not.toHaveClass("empty:hidden");
    // The initially loaded month comes back in the server snapshot itself
    // (router.refresh()); a snapshot while it is selected fetches nothing.
    rerender(<MyMonthlyTimesheetPanel canCheck initialEntries={[...mockEntries]} initialMonth={9} initialYear={2026} />);
    expect(fetchMyMonthlyTimesheetAction).not.toHaveBeenCalled();
    // The header trigger stays (server stays authoritative about duplicates).
    expect(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" })).toBeEnabled();
  });

  // Value: protects=after a request (card or header trigger) the server's refreshed snapshot, which covers only the initially loaded month, makes a switched-to month fetch again, so its card shows the server's pending state; the request alone fetches nothing;
  // fails_when=the snapshot effect is removed, re-fetches the initial month instead of the selected one, fetches on the dialog callback instead of the snapshot, or always/never fetches;
  // why_new=the snapshot-driven re-fetch replaced the per-trigger callback in review cycle 2 (it also covers the history panel's trigger and check-in/out refreshes);
  // seam=fetchMyMonthlyTimesheetAction and requestTimeEntryAdjustmentAction module mocks; no_claim=does not prove the RPC returns the request as pending
  it("re-fetches a switched-to month after a card or header request, but not the initial month", async () => {
    vi.mocked(fetchMyMonthlyTimesheetAction)
      .mockResolvedValueOnce({ entries: [augustAutoEnded], ok: true })
      .mockResolvedValueOnce({ entries: [{ ...augustAutoEnded, adjustmentStatus: "pending" }], ok: true })
      .mockResolvedValueOnce({ entries: [{ ...augustAutoEnded, adjustmentStatus: "pending" }], ok: true });
    vi.mocked(requestTimeEntryAdjustmentAction).mockResolvedValue({ message: "Đã gửi yêu cầu điều chỉnh.", status: "success" });
    const { rerender } = render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);
    // router.refresh() after a request re-renders the server page with a new
    // snapshot of the initially loaded month (September) only.
    const refreshServerSnapshot = () =>
      rerender(<MyMonthlyTimesheetPanel canCheck initialEntries={[...mockEntries]} initialMonth={9} initialYear={2026} />);

    fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "8" } });
    expect(await screen.findByRole("heading", { level: 3, name: "T6 14/08 · Ca Sáng Chuẩn" })).toBeInTheDocument();
    expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledTimes(1);

    await sendCardRequest("T6 14/08");
    refreshServerSnapshot();

    await waitFor(() => expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledTimes(2));
    expect(fetchMyMonthlyTimesheetAction).toHaveBeenLastCalledWith(8, 2026);
    expect(await screen.findByText("Yêu cầu điều chỉnh · chờ duyệt")).toBeInTheDocument();
    // Pending now: the card's own "sent" line gives way to the server state.
    expect(screen.queryByText(SENT_TEXT)).not.toBeInTheDocument();

    // The trigger is the server snapshot, not the dialog: a header request on
    // its own fetches nothing until the refreshed snapshot arrives.
    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));
    const dialog = screen.getByRole("dialog", { name: "Yêu cầu điều chỉnh công" });
    fireEvent.change(within(dialog).getByLabelText(/Lý do điều chỉnh/), { target: { value: "Sửa giờ vào" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gửi yêu cầu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledTimes(2);
    refreshServerSnapshot();
    await waitFor(() => expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledTimes(3));
    expect(fetchMyMonthlyTimesheetAction).toHaveBeenLastCalledWith(8, 2026);
  });

  // Value: protects=a refused month fetch is announced as an alert with the server's message (not a silent empty month);
  // fails_when=the error box loses role="alert" or shows a generic text instead of result.error.message;
  // why_new=role="alert" is new in review cycle 1; the rejection test above checks only the text of the transport branch;
  // seam=fetchMyMonthlyTimesheetAction module mock; no_claim=does not prove which errors the RPC returns
  it("announces a refused month fetch as an alert with the server message", async () => {
    vi.mocked(fetchMyMonthlyTimesheetAction).mockResolvedValueOnce({
      error: { code: "monthly_entries_query_failed", message: "Không thể tải bảng công cá nhân. Vui lòng thử lại." },
      ok: false,
    });
    render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "7" } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không thể tải bảng công cá nhân. Vui lòng thử lại.");
    expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledWith(7, 2026);
    expect(screen.queryByRole("heading", { level: 3, name: "T3 01/09 · Ca Sáng Chuẩn" })).not.toBeInTheDocument();
  });

  // Value: protects=a fresh server snapshot of the initially loaded month is authoritative while that month is selected: it replaces an earlier failed re-fetch of the month (rows back, error cleared) instead of leaving the person stuck on the error through every refresh;
  // fails_when=the re-sync ignores fresh snapshots while an error is shown (the pre-cycle-2 `!fetchError` guard) or keeps the stale error above fresh rows;
  // why_new=review cycle 2 (red team) changed the contract from "keep the error" to "the snapshot wins";
  // seam=fetchMyMonthlyTimesheetAction module mock (resolve then reject); no_claim=does not prove the server snapshot itself is current
  it("lets a fresh snapshot of the initial month replace a failed re-fetch of it", async () => {
    vi.mocked(fetchMyMonthlyTimesheetAction)
      .mockResolvedValueOnce({ entries: [augustEntry], ok: true })
      .mockRejectedValueOnce(new Error("network"));
    const { rerender } = render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);

    fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "8" } });
    expect(await screen.findByRole("heading", { level: 3, name: "T7 15/08 · Ca Sáng Chuẩn" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "9" } });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không thể tải bảng công. Vui lòng chọn lại tháng để thử lại.");
    expect(fetchMyMonthlyTimesheetAction).toHaveBeenLastCalledWith(9, 2026);

    rerender(<MyMonthlyTimesheetPanel canCheck initialEntries={[mockEntries[0], mockEntries[1]]} initialMonth={9} initialYear={2026} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "T3 01/09 · Ca Sáng Chuẩn" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "T4 02/09 · Ca Sáng Chuẩn" })).toBeInTheDocument();
    // The initial month's snapshot is not fetched again on top of the server's.
    expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledTimes(2);
  });

  // Value: protects=a background re-fetch of a switched-to month (after a server snapshot) that fails keeps the cards on screen and says so, instead of blanking the month the person is reading;
  // fails_when=the background path empties entries on failure like an explicit month pick does;
  // why_new=review cycle 2 (red team) added the background flag to the snapshot-driven re-fetch;
  // seam=fetchMyMonthlyTimesheetAction module mock (resolve then reject) and a rerender standing in for router.refresh(); no_claim=does not prove the shown rows are still current
  it("keeps a switched-to month on screen when its background re-fetch fails, says so politely and retries", async () => {
    vi.mocked(fetchMyMonthlyTimesheetAction)
      .mockResolvedValueOnce({ entries: [augustEntry], ok: true })
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ entries: [augustEntry], ok: true });
    const { rerender } = render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);

    fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "8" } });
    expect(await screen.findByRole("heading", { level: 3, name: "T7 15/08 · Ca Sáng Chuẩn" })).toBeInTheDocument();

    rerender(<MyMonthlyTimesheetPanel canCheck initialEntries={[...mockEntries]} initialMonth={9} initialYear={2026} />);

    const stale = "Chưa cập nhật được bảng công Tháng 8/2026; số liệu bên dưới có thể chưa mới nhất.";
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(stale));
    // Not an alert: nothing the person did failed, and the rows stay.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMyMonthlyTimesheetAction).toHaveBeenLastCalledWith(8, 2026);
    expect(screen.getByRole("heading", { level: 3, name: "T7 15/08 · Ca Sáng Chuẩn" })).toBeInTheDocument();
    // A background refresh never locks the month selects.
    expect(screen.getByLabelText("Chọn tháng")).toBeEnabled();

    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Tải lại" }));
    await waitFor(() => expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledTimes(3));
    expect(fetchMyMonthlyTimesheetAction).toHaveBeenLastCalledWith(8, 2026);
    await waitFor(() => expect(screen.getByRole("status")).toBeEmptyDOMElement());
  });

  // Value: protects=background refreshes of a switched-to month never overlap and never lock the month selects: a snapshot arriving while one runs starts nothing, and the delayed snapshot causes at most one follow-up fetch;
  // fails_when=every snapshot starts its own fetch while one runs, background refreshes go back to the foreground transition (overlay + disabled selects), or follow-ups repeat;
  // why_new=review cycle 3 (performance/red team) moved background refreshes to their own transition with an in-flight check;
  // seam=fetchMyMonthlyTimesheetAction module mock with one deferred per call; no_claim=React may commit a snapshot only after the running fetch ends (seen here), so one mutation can still cost two sequential fetches (TODOS: drop the dialogs' extra router.refresh())
  it("never overlaps background fetches of the switched-to month and keeps the selects usable", async () => {
    type FetchResult = Awaited<ReturnType<typeof fetchMyMonthlyTimesheetAction>>;
    const pending: Array<(value: FetchResult) => void> = [];
    vi.mocked(fetchMyMonthlyTimesheetAction).mockImplementation(
      () => new Promise<FetchResult>((resolve) => { pending.push(resolve); }),
    );
    try {
      const { rerender } = render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);
      fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "8" } });
      await waitFor(() => expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledTimes(1));
      await act(async () => pending[0]({ entries: [augustEntry], ok: true }));
      expect(await screen.findByRole("heading", { level: 3, name: "T7 15/08 · Ca Sáng Chuẩn" })).toBeInTheDocument();

      // First snapshot of the mutation: one background fetch, still running.
      rerender(<MyMonthlyTimesheetPanel canCheck initialEntries={[...mockEntries]} initialMonth={9} initialYear={2026} />);
      await waitFor(() => expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledTimes(2));
      expect(screen.getByLabelText("Chọn tháng")).toBeEnabled();
      // Second snapshot while it runs: nothing new starts.
      rerender(<MyMonthlyTimesheetPanel canCheck initialEntries={[...mockEntries]} initialMonth={9} initialYear={2026} />);
      expect(fetchMyMonthlyTimesheetAction).toHaveBeenCalledTimes(2);

      await act(async () => pending[1]({ entries: [augustEntry], ok: true }));
      // At most one follow-up for the snapshot React committed after the fetch ended.
      expect(vi.mocked(fetchMyMonthlyTimesheetAction).mock.calls.length).toBeLessThanOrEqual(3);
      if (pending[2]) {
        await act(async () => pending[2]({ entries: [augustEntry], ok: true }));
      }
      expect(vi.mocked(fetchMyMonthlyTimesheetAction).mock.calls.length).toBeLessThanOrEqual(3);
      expect(vi.mocked(fetchMyMonthlyTimesheetAction).mock.calls.every(([month, year]) => month === 8 && year === 2026)).toBe(true);
      expect(screen.getByRole("heading", { level: 3, name: "T7 15/08 · Ca Sáng Chuẩn" })).toBeInTheDocument();
    } finally {
      // clearAllMocks keeps implementations; do not leak the deferred one.
      vi.mocked(fetchMyMonthlyTimesheetAction).mockReset();
    }
  });

  // Value: protects=the card's duration matches the HH:MM it prints (recorded seconds do not shave a minute) and uses the shown times rather than the RPC total that counts a pending request's proposed times;
  // fails_when=the card goes back to entry.totalMinutes, or subtracts raw instants (08:00:30 → 22:30:00 printed as 14 giờ 29);
  // why_new=review cycle 3 changed minutesBetween to minute-truncated instants; every other fixture uses :00 seconds and totals equal to the times;
  // seam=none; no_claim=does not prove the desktop table or KPI (still RPC total_minutes, TODOS) agree for pending/rejected rows
  it("derives each card duration from the times it shows", () => {
    render(
      <MyMonthlyTimesheetPanel
        canCheck
        initialEntries={[
          { ...mockEntries[1], checkInAt: "2026-09-02T08:00:30+07:00", checkOutAt: "2026-09-02T22:30:00+07:00", totalMinutes: 870 },
          {
            ...mockEntries[0],
            adjustedCheckInAt: "2026-09-01T08:00:00+07:00",
            adjustedCheckOutAt: "2026-09-01T17:00:00+07:00",
            adjustmentStatus: "pending",
            checkInAt: "2026-09-01T08:00:00+07:00",
            checkOutAt: "2026-09-01T15:30:00+07:00",
            totalMinutes: 540,
          },
        ]}
        initialMonth={9}
        initialYear={2026}
      />,
    );

    expect(within(cardFor("T4 02/09 · Ca Sáng Chuẩn")).getByText("14 giờ 30")).toBeInTheDocument();
    // Pending: the card shows the recorded 08:00 → 15:30, not the proposed times the RPC total uses.
    expect(within(cardFor("T3 01/09 · Ca Sáng Chuẩn")).getByText("7 giờ 30")).toBeInTheDocument();
  });

  // Value: protects=only the card whose shift the request was actually sent for counts as sent: a card's sheet moved to another shift leaves the opening card's trigger in place and shows no "Đã gửi…" on it;
  // fails_when=onSubmitted ignores the submitted entry id and marks the opening card;
  // why_new=review cycle 2 (red team CRITICAL) made onSubmitted carry the entry id;
  // seam=requestTimeEntryAdjustmentAction module mock (success); no_claim=does not prove the other shift's card updates before the server snapshot arrives
  it("does not mark the opening card as sent when its sheet was moved to another shift", async () => {
    vi.mocked(requestTimeEntryAdjustmentAction).mockResolvedValueOnce({ message: "Đã gửi yêu cầu điều chỉnh.", status: "success" });
    render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh ca T4 02/09" }));
    const dialog = screen.getByRole("dialog", { name: "Yêu cầu điều chỉnh công" });
    fireEvent.change(within(dialog).getByLabelText("Lượt chấm công cần điều chỉnh"), { target: { value: mockEntries[0].id } });
    fireEvent.change(within(dialog).getByLabelText(/Lý do điều chỉnh/), { target: { value: "Sửa ca hôm trước" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gửi yêu cầu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(requestTimeEntryAdjustmentAction).toHaveBeenCalledWith(expect.objectContaining({ timeEntryId: mockEntries[0].id }));
    const card = cardFor("T4 02/09 · Ca Sáng Chuẩn");
    expect(within(card).queryByText(SENT_TEXT)).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Yêu cầu điều chỉnh ca T4 02/09" })).toBeInTheDocument();
  });

  // Value: protects=a card's "sent" state lasts only until the server reports a new status: once the request is pending the sent line gives way to the badge, and after a rejection the card offers a new request again;
  // fails_when=the sent state is a one-way boolean (the line reappears next to "Điều chỉnh · bị từ chối" and the trigger stays hidden after a rejection) or ignores the server status;
  // why_new=review cycle 2 keyed the sent state to the adjustment status it was sent from;
  // seam=requestTimeEntryAdjustmentAction module mock (success) and rerenders standing in for router.refresh(); no_claim=does not prove the server's decision flow
  it("lets a rejected card offer a new request after its first one was sent", async () => {
    vi.mocked(requestTimeEntryAdjustmentAction).mockResolvedValueOnce({ message: "Đã gửi yêu cầu điều chỉnh.", status: "success" });
    const withStatus = (adjustmentStatus: TimekeepingMonthlyEntry["adjustmentStatus"]) => [
      mockEntries[0],
      { ...mockEntries[1], adjustmentStatus },
      mockEntries[2],
    ];
    const { rerender } = render(
      <MyMonthlyTimesheetPanel canCheck initialEntries={withStatus("none")} initialMonth={9} initialYear={2026} />,
    );

    await sendCardRequest("T4 02/09");
    const card = () => cardFor("T4 02/09 · Ca Sáng Chuẩn");
    expect(within(card()).getByText(SENT_TEXT)).toBeInTheDocument();
    expect(within(card()).queryByRole("button", { name: "Yêu cầu điều chỉnh ca T4 02/09" })).not.toBeInTheDocument();

    rerender(<MyMonthlyTimesheetPanel canCheck initialEntries={withStatus("pending")} initialMonth={9} initialYear={2026} />);
    expect(within(card()).getByText("Yêu cầu điều chỉnh · chờ duyệt")).toBeInTheDocument();
    expect(within(card()).queryByText(SENT_TEXT)).not.toBeInTheDocument();

    rerender(<MyMonthlyTimesheetPanel canCheck initialEntries={withStatus("rejected")} initialMonth={9} initialYear={2026} />);
    expect(within(card()).getByText("Điều chỉnh · bị từ chối")).toBeInTheDocument();
    expect(within(card()).queryByText(SENT_TEXT)).not.toBeInTheDocument();
    expect(within(card()).getByRole("button", { name: "Yêu cầu điều chỉnh ca T4 02/09" })).toBeInTheDocument();
  });

  // Value: protects=the month-switch loading state is announced: an always-mounted status region is empty at rest and says "Đang cập nhật bảng công…" only while a fetch is pending (the visual overlay is aria-hidden);
  // fails_when=the status region is mounted together with its text (unreliable announcement), never clears, or the overlay is exposed twice;
  // why_new=review cycle 2 made the loading status always mounted; no test held a fetch pending;
  // seam=fetchMyMonthlyTimesheetAction module mock held on a pending promise; no_claim=does not prove a screen reader speaks it
  it("announces the pending month fetch through an always-mounted status region", async () => {
    let resolveFetch: (value: Awaited<ReturnType<typeof fetchMyMonthlyTimesheetAction>>) => void = () => undefined;
    vi.mocked(fetchMyMonthlyTimesheetAction).mockImplementationOnce(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    );
    render(<MyMonthlyTimesheetPanel canCheck initialEntries={mockEntries} initialMonth={9} initialYear={2026} />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    // In the accessibility tree while empty (sr-only), never display:none.
    expect(status).toHaveClass("empty:sr-only");
    expect(status).not.toHaveClass("empty:hidden");

    fireEvent.change(screen.getByLabelText("Chọn tháng"), { target: { value: "8" } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đang cập nhật bảng công…"));
    expect(screen.getByRole("status")).toBe(status);
    expect(screen.getByLabelText("Chọn tháng")).toBeDisabled();

    resolveFetch({ entries: [], ok: true });
    await waitFor(() => expect(screen.getByRole("status")).toBeEmptyDOMElement());
    expect(screen.getByLabelText("Chọn tháng")).toBeEnabled();
  });
});
