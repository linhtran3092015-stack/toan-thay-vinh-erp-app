// Value: protects=the staff check-in card (step 12, design 14a/14b/14e, decisions D1-D6/D12): an idle card offers "Tại trung tâm"/"Trực tuyến" as a real radiogroup (aria-checked, roving tabindex, arrow keys move selection and focus, wrap-around) that starts from the mode remembered in localStorage "timekeeping.lastMode" (written only by the sheet after a successful check-in/out, never by a tap here) and hands the tapped choice to the existing check-in sheet as initialMode; the checklist shows the policy's own numbers per mode and always ends with the 22:30/22:45 check-in cutoff; the big "Vào ca" is the sheet trigger, never disabled, and is the only control carrying the pulse; an open shift shows "Đang trong ca · mode", HH:MM:SS elapsed with an sr-only label, evidence and rule lines, the unscheduled badge and a "Ra ca" trigger bound to the entry, without the mode choice or pay vocabulary; the heartbeat hook stays disabled unless the shift is offline AND the policy requires continuous tracking, and receives the overrides; the evidence dl sits in a collapsed details; the server render has no clock, "--:--:--" elapsed and the offline default (no hydration mismatch); the panel runs without next/navigation;
// fails_when=the radios lose their roles/state or keyboard handling, a tap writes localStorage again or the choice is not passed to the sheet (or a stale stored value wins over a click), the checklist shows rules for the wrong mode or without the policy numbers, the pulse moves to "Ra ca" or disappears from idle "Vào ca", the open card shows the radiogroup or drops "Ra ca"/the elapsed label/the unscheduled badge, the heartbeat turns on for online or endpoint-only policies (or loses the overrides), or the panel starts calling useRouter;
// why_new=timekeeping-day-audit.test.tsx pins only the labels that existed before the redesign and mocks the sheet without reading its props;
// seam=TimekeepingEntryDialog mocked to a trigger that records its props, useAttendanceHeartbeat mocked to record options, next/navigation NOT mocked (the panel must not need an app router), Date faked (toFake Date only) for the clock and elapsed tests, react-dom/server renderToString for the server snapshot; no_claim=does not prove the sheet honours initialMode (timekeeping-entry-dialog.test.tsx does) or that the server accepts the chosen mode
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TimekeepingActionOverrides } from "@/features/timekeeping/timekeeping-action-overrides";
import type { AttendanceVerificationPolicy, TimekeepingMyEntry } from "@/features/timekeeping/types";

interface RecordedDialogProps {
  actions?: TimekeepingActionOverrides;
  attendancePolicy?: AttendanceVerificationPolicy;
  initialMode?: "offline" | "online";
  onExceptionSubmitted?: (message: string) => void;
  operation: "check-in" | "check-out";
  timeEntryId?: string;
  triggerChildren?: ReactNode;
  triggerClassName?: string;
}

const dialogProps = vi.hoisted(() => vi.fn());
const heartbeat = vi.hoisted(() => ({ useAttendanceHeartbeat: vi.fn() }));

vi.mock("@/features/timekeeping/components/timekeeping-entry-dialog", () => ({
  TimekeepingEntryDialog: (props: RecordedDialogProps) => {
    dialogProps(props);
    return (
      <button className={props.triggerClassName} type="button">
        {props.triggerChildren}
      </button>
    );
  },
}));
vi.mock("@/features/timekeeping/hooks/use-attendance-heartbeat", () => heartbeat);

import { MyTimekeepingPanel } from "@/features/timekeeping/components/my-timekeeping-panel";

const LAST_MODE_KEY = "timekeeping.lastMode";
const CHECKIN_CUTOFF_TEXT = "Không vào ca được sau 22:30 (trợ giảng) hoặc 22:45 (vị trí khác).";

const configuredPolicy: AttendanceVerificationPolicy = {
  attendanceRadiusM: 150,
  centerName: "Cơ sở chính",
  configured: true,
  continuousGpsTrackingRequired: false,
  gpsMaxAccuracyM: 60,
  gpsRequiredForOffline: true,
  wifiRequiredForOffline: false,
};

const checkedOutEntry: TimekeepingMyEntry = {
  autoEndedAt: null,
  checkInAt: "2026-08-11T01:30:00.000Z",
  checkInMode: "offline",
  checkOutAt: "2026-08-11T10:30:00.000Z",
  checkOutMode: "online",
  hasCheckInGpsEvidence: true,
  hasCheckInWifiEvidence: false,
  hasCheckOutGpsEvidence: false,
  hasCheckOutWifiEvidence: true,
  id: "entry-1",
  scheduledEndTime: "18:00:00",
  scheduledStartTime: "09:00:00",
  status: "checked_out",
  workDate: "2026-08-11",
  workShiftCode: "HC",
  workShiftName: "Hành chính",
};

const openEntry: TimekeepingMyEntry = {
  ...checkedOutEntry,
  checkOutAt: null,
  checkOutMode: null,
  hasCheckOutWifiEvidence: false,
  id: "entry-open",
  status: "open",
};

const unscheduledOpenEntry: TimekeepingMyEntry = {
  ...openEntry,
  isUnscheduled: true,
  scheduledEndTime: null,
  scheduledStartTime: null,
  workShiftCode: null,
  workShiftName: null,
};

const overrides: TimekeepingActionOverrides = {
  checkInTimeEntry: vi.fn(),
  checkOutTimeEntry: vi.fn(),
  geolocation: null,
  submitAttendanceHeartbeat: vi.fn(),
};

function lastDialogProps(operation: "check-in" | "check-out"): RecordedDialogProps {
  const calls = dialogProps.mock.calls
    .map(([props]) => props as RecordedDialogProps)
    .filter((props) => props.operation === operation);
  const last = calls.at(-1);
  if (!last) throw new Error(`TimekeepingEntryDialog was never rendered for ${operation}.`);
  return last;
}

function conditionTexts(): string[] {
  const list = screen.getByRole("list", { name: "Điều kiện chấm công" });
  return within(list).getAllByRole("listitem").map((item) => item.textContent ?? "");
}

beforeEach(() => {
  window.localStorage.clear();
  heartbeat.useAttendanceHeartbeat.mockReturnValue({
    distanceM: 42,
    serverMessage: null,
    status: "confirmed_inside",
    statusLabel: "Đã xác nhận tại Trung tâm",
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("MyTimekeepingPanel idle card: mode radiogroup", () => {
  it("renders an accessible two-option radiogroup with offline checked and a roving tabindex", () => {
    render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);

    const group = screen.getByRole("radiogroup", { name: "Hình thức chấm công" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["Tại trung tâm", "Trực tuyến"]);

    const offline = within(group).getByRole("radio", { name: "Tại trung tâm" });
    const online = within(group).getByRole("radio", { name: "Trực tuyến" });
    expect(offline).toBeChecked();
    expect(offline).toHaveAttribute("aria-checked", "true");
    expect(offline).toHaveAttribute("tabindex", "0");
    expect(online).not.toBeChecked();
    expect(online).toHaveAttribute("aria-checked", "false");
    expect(online).toHaveAttribute("tabindex", "-1");

    expect(lastDialogProps("check-in")).toMatchObject({ initialMode: "offline", operation: "check-in", triggerChildren: "Vào ca" });
    expect(window.localStorage.getItem(LAST_MODE_KEY)).toBeNull();
  });

  // Intentional change (pre-landing review cycle 1): a tap no longer writes "timekeeping.lastMode";
  // only the sheet remembers a mode, after the server accepted a check-in/out.
  it("hands a clicked choice to the check-in sheet as initialMode without writing it to localStorage", () => {
    const { unmount } = render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);

    fireEvent.click(screen.getByRole("radio", { name: "Trực tuyến" }));

    expect(screen.getByRole("radio", { name: "Trực tuyến" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Tại trung tâm" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Trực tuyến" })).toHaveAttribute("tabindex", "0");
    expect(lastDialogProps("check-in").initialMode).toBe("online");
    expect(window.localStorage.getItem(LAST_MODE_KEY)).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Tại trung tâm" }));
    expect(lastDialogProps("check-in").initialMode).toBe("offline");
    expect(window.localStorage.getItem(LAST_MODE_KEY)).toBeNull();
    unmount();

    // A remembered value stays as the sheet left it, whatever is tapped here.
    window.localStorage.setItem(LAST_MODE_KEY, "online");
    render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Tại trung tâm" }));
    expect(screen.getByRole("radio", { name: "Tại trung tâm" })).toBeChecked();
    expect(lastDialogProps("check-in").initialMode).toBe("offline");
    expect(window.localStorage.getItem(LAST_MODE_KEY)).toBe("online");
  });

  it("moves selection and focus with the arrow keys, wrapping at both ends", () => {
    render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);
    const offline = screen.getByRole("radio", { name: "Tại trung tâm" });
    const online = screen.getByRole("radio", { name: "Trực tuyến" });
    offline.focus();

    fireEvent.keyDown(offline, { key: "ArrowRight" });
    expect(online).toBeChecked();
    expect(online).toHaveFocus();
    expect(online).toHaveAttribute("tabindex", "0");
    expect(offline).toHaveAttribute("tabindex", "-1");
    expect(lastDialogProps("check-in").initialMode).toBe("online");
    // Intentional change (review cycle 1): arrow-key selection is not written to localStorage either.
    expect(window.localStorage.getItem(LAST_MODE_KEY)).toBeNull();

    fireEvent.keyDown(online, { key: "ArrowLeft" });
    expect(offline).toBeChecked();
    expect(offline).toHaveFocus();
    expect(lastDialogProps("check-in").initialMode).toBe("offline");
    expect(window.localStorage.getItem(LAST_MODE_KEY)).toBeNull();

    // Wrap: left from the first option selects the last, right from the last selects the first.
    fireEvent.keyDown(offline, { key: "ArrowLeft" });
    expect(online).toBeChecked();
    expect(online).toHaveFocus();
    fireEvent.keyDown(online, { key: "ArrowRight" });
    expect(offline).toBeChecked();
    expect(offline).toHaveFocus();

    // Up/Down behave like Left/Right; other keys change nothing.
    fireEvent.keyDown(offline, { key: "ArrowDown" });
    expect(online).toBeChecked();
    fireEvent.keyDown(online, { key: "ArrowUp" });
    expect(offline).toBeChecked();
    fireEvent.keyDown(offline, { key: "a" });
    expect(offline).toBeChecked();
    expect(lastDialogProps("check-in").initialMode).toBe("offline");
    expect(window.localStorage.getItem(LAST_MODE_KEY)).toBeNull();
  });

  it("starts from a remembered online choice and ignores an unknown stored value", () => {
    window.localStorage.setItem(LAST_MODE_KEY, "online");
    const { unmount } = render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);

    expect(screen.getByRole("radio", { name: "Trực tuyến" })).toBeChecked();
    expect(lastDialogProps("check-in").initialMode).toBe("online");
    expect(conditionTexts().join(" ")).toContain("15 phút");
    unmount();

    window.localStorage.setItem(LAST_MODE_KEY, "auto_end");
    render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);
    expect(screen.getByRole("radio", { name: "Tại trung tâm" })).toBeChecked();
    expect(lastDialogProps("check-in").initialMode).toBe("offline");
  });

  it("follows a choice stored by another tab until the person picks one here", () => {
    render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);
    expect(screen.getByRole("radio", { name: "Tại trung tâm" })).toBeChecked();

    act(() => {
      window.localStorage.setItem(LAST_MODE_KEY, "online");
      window.dispatchEvent(new StorageEvent("storage", { key: LAST_MODE_KEY, newValue: "online" }));
    });
    expect(screen.getByRole("radio", { name: "Trực tuyến" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Tại trung tâm" }));
    act(() => {
      window.localStorage.setItem(LAST_MODE_KEY, "online");
      window.dispatchEvent(new StorageEvent("storage", { key: LAST_MODE_KEY, newValue: "online" }));
    });
    expect(screen.getByRole("radio", { name: "Tại trung tâm" })).toBeChecked();
  });
});

describe("MyTimekeepingPanel idle card: checklist and trigger", () => {
  it("lists the configured radius, accuracy and centre for on-site attendance", () => {
    render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);

    expect(conditionTexts()).toEqual([
      "Vị trí: trong bán kính 150 m quanh Cơ sở chính, sai số tối đa 60 m. Kiểm tra khi bấm Vào ca.",
      "Vị trí chỉ được xác minh lúc vào ca và lúc ra ca.",
      // Intentional change (review cycle 1): the daily check-in cutoff closes the list.
      CHECKIN_CUTOFF_TEXT,
    ]);
  });

  it("shows the 15-minute assigned-shift rule and no location lines for online attendance", () => {
    render(<MyTimekeepingPanel attendancePolicy={{ ...configuredPolicy, wifiRequiredForOffline: true }} canCheck entries={[]} />);

    fireEvent.click(screen.getByRole("radio", { name: "Trực tuyến" }));

    expect(conditionTexts()).toEqual([
      "Trực tuyến chỉ nhận khi bạn có ca được xếp hôm nay, trong 15 phút trước hoặc sau giờ ca.",
      "Không cần lấy vị trí khi chấm công trực tuyến.",
      // Intentional change (review cycle 1): online lists end with the same cutoff.
      CHECKIN_CUTOFF_TEXT,
    ]);
  });

  it("leads with the not-configured warning under the default policy and adds Wi-Fi only when required", () => {
    const { rerender } = render(<MyTimekeepingPanel canCheck entries={[]} />);

    const texts = conditionTexts();
    expect(texts[0]).toMatch(/^Chưa cấu hình vị trí Trung tâm/);
    expect(texts.some((text) => text.startsWith("Wi-Fi"))).toBe(false);
    // Review cycle 1: without saved coordinates there is no verification-timing claim; the cutoff stays last.
    expect(texts).toEqual([
      "Chưa cấu hình vị trí Trung tâm: chấm công tại Trung tâm có thể bị từ chối cho đến khi chủ trung tâm lưu tọa độ.",
      CHECKIN_CUTOFF_TEXT,
    ]);
    expect(texts.some((text) => /xác minh|theo dõi liên tục/.test(text))).toBe(false);

    rerender(<MyTimekeepingPanel attendancePolicy={{ ...configuredPolicy, wifiRequiredForOffline: true }} canCheck entries={[]} />);
    expect(conditionTexts()).toContain("Wi-Fi: nhập tên mạng Trung tâm đã đăng ký khi xác nhận.");
    expect(conditionTexts().at(-1)).toBe(CHECKIN_CUTOFF_TEXT);

    const panel = screen.getByRole("heading", { name: "Chấm công của tôi" }).closest("section");
    if (!panel) throw new Error("Expected the personal timekeeping panel.");
    expect(within(panel).queryByText(/latitude|longitude|ssid|bssid|hợp lệ|đủ điều kiện/i)).not.toBeInTheDocument();
  });

  it("makes the big Vào ca the sheet trigger: enabled, pulsing, with the policy and overrides", () => {
    render(<MyTimekeepingPanel actions={overrides} attendancePolicy={configuredPolicy} canCheck entries={[]} />);

    const trigger = screen.getByRole("button", { name: "Vào ca" });
    expect(trigger).toBeEnabled();
    expect(trigger).toHaveClass("shift-action-pulse");

    const props = lastDialogProps("check-in");
    expect(props.triggerClassName).toContain("shift-action-pulse");
    expect(props.attendancePolicy).toBe(configuredPolicy);
    expect(props.actions).toBe(overrides);
    expect(props.timeEntryId).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Ra ca" })).not.toBeInTheDocument();
    expect(document.querySelector(".shift-live-dot")).toBeNull();
    // The heartbeat belongs to an open shift only.
    expect(heartbeat.useAttendanceHeartbeat).not.toHaveBeenCalled();
  });

  it("keeps the latest entry's evidence in a collapsed details below a still-available Vào ca", () => {
    render(<MyTimekeepingPanel canCheck entries={[checkedOutEntry]} />);

    expect(screen.getByRole("button", { name: "Vào ca" })).toBeInTheDocument();
    expect(screen.getByText("Hôm nay đã có lượt chấm công. Nếu bạn có ca khác, vào ca mới.")).toBeInTheDocument();
    expect(screen.getByText("Đã check-out")).toBeInTheDocument();

    const details = screen.getByText("Chi tiết lượt chấm công gần nhất").closest("details");
    if (!details) throw new Error("Expected the evidence details.");
    expect(details.open).toBe(false);
    const gpsLabel = within(details).getByText("Dữ liệu GPS khi vào");
    expect(gpsLabel.tagName).toBe("DT");
    expect(gpsLabel.nextElementSibling?.tagName).toBe("DD");
    expect(gpsLabel.closest("dl")).not.toBeNull();
  });

  it("shows the Vietnam clock line from the current minute", () => {
    vi.useFakeTimers({ now: new Date("2026-10-12T09:58:30.000Z"), toFake: ["Date"] });
    render(<MyTimekeepingPanel canCheck entries={[]} />);

    const clock = screen.getByText("Thứ Hai, 12/10/2026 · 16:58");
    expect(clock.tagName).toBe("TIME");
    expect(clock).toHaveAttribute("datetime", "2026-10-12T09:58:00.000Z");
  });
});

describe("MyTimekeepingPanel open shift card", () => {
  it("replaces the mode choice with the open-shift state, evidence, rules and a Ra ca trigger bound to the entry", () => {
    vi.useFakeTimers({ now: new Date("2026-08-11T02:45:05.000Z"), toFake: ["Date"] });
    render(<MyTimekeepingPanel actions={overrides} attendancePolicy={configuredPolicy} canCheck entries={[openEntry]} />);

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Điều kiện chấm công" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vào ca" })).not.toBeInTheDocument();
    expect(screen.getByText("Đang trong ca · Tại trung tâm")).toBeInTheDocument();

    const elapsedLabel = screen.getByText("Thời gian đã làm việc");
    expect(elapsedLabel).toHaveClass("sr-only");
    expect(elapsedLabel.parentElement).toHaveTextContent("Thời gian đã làm việc 01:15:05");

    expect(screen.getByText(/HC · Hành chính 09:00–18:00/)).toHaveTextContent("Vào ca 08:30 · HC · Hành chính 09:00–18:00");
    expect(screen.getByText("Đã ghi nhận vị trí lúc vào ca")).toBeInTheDocument();
    expect(screen.getByText("Ra ca tại Trung tâm cần lấy lại vị trí trong bán kính 150 m.")).toBeInTheDocument();
    expect(screen.getByText("Quên ra ca? Hệ thống tự kết thúc ca lúc 22:30 (trợ giảng) hoặc 22:45 (vị trí khác).")).toBeInTheDocument();
    expect(screen.queryByText("Không có ca được phân công hôm nay")).not.toBeInTheDocument();
    expect(document.querySelector(".shift-live-dot")).not.toBeNull();

    const checkout = screen.getByRole("button", { name: "Ra ca" });
    expect(checkout).not.toHaveClass("shift-action-pulse");
    const props = lastDialogProps("check-out");
    expect(props).toMatchObject({ operation: "check-out", timeEntryId: "entry-open", triggerChildren: "Ra ca" });
    expect(props.triggerClassName).not.toContain("shift-action-pulse");
    expect(props.initialMode).toBeUndefined();
    expect(props.actions).toBe(overrides);
    expect(dialogProps.mock.calls.some(([call]) => (call as RecordedDialogProps).operation === "check-in")).toBe(false);

    expect(screen.queryByText(/giờ làm|9 giờ|lương|đơn giá/i)).not.toBeInTheDocument();
  });

  it("labels an unscheduled offline shift and keeps the evidence and rules truthful without a configured centre", () => {
    render(<MyTimekeepingPanel canCheck entries={[{ ...unscheduledOpenEntry, hasCheckInGpsEvidence: false }]} />);

    expect(screen.getByText("Không có ca được phân công hôm nay")).toBeInTheDocument();
    expect(screen.getByText("Vào ca không kèm dữ liệu vị trí")).toBeInTheDocument();
    expect(screen.queryByText(/Ra ca tại Trung tâm cần lấy lại vị trí/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Quên ra ca\?/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ra ca" })).toBeInTheDocument();
    expect(screen.queryByText(/giờ làm|9 giờ|lương|đơn giá/i)).not.toBeInTheDocument();
  });

  it("shows online open shifts without the radius note even at a configured centre", () => {
    render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[{ ...unscheduledOpenEntry, checkInMode: "online" }]} />);

    expect(screen.getByText("Đang trong ca · Trực tuyến")).toBeInTheDocument();
    expect(screen.getByText("Trực tuyến · theo ca được xếp")).toBeInTheDocument();
    expect(screen.getByText("Không có ca được phân công hôm nay")).toBeInTheDocument();
    expect(screen.queryByText(/Ra ca tại Trung tâm cần lấy lại vị trí/)).not.toBeInTheDocument();
  });
});

describe("MyTimekeepingPanel server render", () => {
  it("renders no clock, a placeholder elapsed time and the offline default so hydration cannot mismatch", () => {
    window.localStorage.setItem(LAST_MODE_KEY, "online");

    const idleHtml = renderToString(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);
    expect(idleHtml).not.toContain("<time");
    expect(idleHtml).toMatch(/aria-checked="true"[^>]*>Tại trung tâm</);

    const openHtml = renderToString(<MyTimekeepingPanel canCheck entries={[openEntry]} />);
    expect(openHtml).toContain("--:--:--");
    expect(openHtml).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

describe("MyTimekeepingPanel heartbeat gating", () => {
  it("keeps the heartbeat disabled for an offline shift when continuous tracking is not required", () => {
    render(<MyTimekeepingPanel actions={overrides} attendancePolicy={configuredPolicy} canCheck entries={[openEntry]} />);

    expect(heartbeat.useAttendanceHeartbeat).toHaveBeenLastCalledWith(expect.objectContaining({
      activeSessionId: "entry-open",
      enabled: false,
    }));
    expect(screen.queryByText(/Trạng thái định vị GPS/)).not.toBeInTheDocument();
  });

  it("enables the heartbeat with the overrides only for an offline shift under continuous tracking", () => {
    const trackedPolicy = { ...configuredPolicy, continuousGpsTrackingRequired: true };
    const { rerender } = render(<MyTimekeepingPanel actions={overrides} attendancePolicy={trackedPolicy} canCheck entries={[openEntry]} />);

    expect(heartbeat.useAttendanceHeartbeat).toHaveBeenLastCalledWith(expect.objectContaining({
      actions: overrides,
      activeSessionId: "entry-open",
      enabled: true,
    }));
    expect(screen.getByText("Trạng thái định vị GPS: Đã xác nhận tại Trung tâm (khoảng 42m từ Trung tâm)")).toBeInTheDocument();

    rerender(<MyTimekeepingPanel actions={overrides} attendancePolicy={trackedPolicy} canCheck entries={[{ ...openEntry, checkInMode: "online" }]} />);
    expect(heartbeat.useAttendanceHeartbeat).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    expect(screen.queryByText(/Trạng thái định vị GPS/)).not.toBeInTheDocument();
  });
});

describe("MyTimekeepingPanel without timekeeping.check", () => {
  it("offers no mode choice, no trigger and no heartbeat", () => {
    const { rerender } = render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck={false} entries={[]} />);

    expect(screen.getByText("Bạn chưa có quyền chấm công.")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vào ca|Ra ca/ })).not.toBeInTheDocument();

    rerender(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck={false} entries={[openEntry]} />);
    expect(screen.queryByRole("button", { name: /Vào ca|Ra ca/ })).not.toBeInTheDocument();
    expect(dialogProps).not.toHaveBeenCalled();
    expect(heartbeat.useAttendanceHeartbeat).not.toHaveBeenCalled();
  });
});

describe("MyTimekeepingPanel card swap: announcement and focus", () => {
  function liveRegion(container: HTMLElement): HTMLElement {
    const region = container.querySelector<HTMLElement>("p[aria-live='polite']");
    if (!region) throw new Error("Expected the panel's polite live region.");
    return region;
  }

  // Value: protects=after router.refresh() swaps the idle card for the open-shift card (or back), the panel announces "Đã vào ca." / "Ca đã kết thúc." in its sr-only polite region and, when focus fell to <body> with the unmounted trigger, moves it to the "Thao tác chấm công" group;
  // fails_when=the open-entry id is no longer tracked between renders, the messages are swapped or dropped, the region stops being polite/sr-only, or focus stays on <body> after the trigger disappears;
  // why_new=the panel tests above render one state at a time and never rerender across a check-in/out;
  // seam=TimekeepingEntryDialog mocked (its trigger is a plain button), heartbeat mocked; no_claim=does not prove a screen reader speaks the change or that router.refresh() delivers the new entries
  it("announces the check-in and moves focus from body to the action group, then announces the end of the shift", () => {
    const { container, rerender } = render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);
    const region = liveRegion(container);
    expect(region).toHaveClass("sr-only");
    expect(region.textContent).toBe("");
    expect(document.activeElement).toBe(document.body);

    rerender(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[openEntry]} />);

    const group = screen.getByRole("group", { name: "Thao tác chấm công" });
    expect(region).toHaveTextContent("Đã vào ca.");
    expect(group).toHaveAttribute("tabindex", "-1");
    expect(group).toHaveFocus();
    expect(within(group).getByRole("button", { name: "Ra ca" })).toBeInTheDocument();

    rerender(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[checkedOutEntry]} />);

    expect(region).toHaveTextContent("Ca đã kết thúc.");
    expect(within(screen.getByRole("group", { name: "Thao tác chấm công" })).getByRole("button", { name: "Vào ca" })).toBeInTheDocument();
  });

  // Value: protects=the swap never steals focus from something the person is using (only a focus lost to <body> is moved), and nothing is announced or focused on the first render of either card;
  // fails_when=the effect focuses the group unconditionally, or the first-render guard is lost so every page load announces "Đã vào ca." and jumps focus;
  // why_new=the test above covers only the body-focus path;
  // seam=TimekeepingEntryDialog and heartbeat mocked; no_claim=does not cover focus inside a still-open sheet (the sheet closes before refresh)
  it("leaves focus on another element and announces nothing on the first render", () => {
    const { container, rerender } = render(
      <>
        <input aria-label="Ô khác" />
        <MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />
      </>,
    );
    const other = screen.getByRole("textbox", { name: "Ô khác" });
    other.focus();

    rerender(
      <>
        <input aria-label="Ô khác" />
        <MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[openEntry]} />
      </>,
    );
    expect(liveRegion(container)).toHaveTextContent("Đã vào ca.");
    expect(other).toHaveFocus();
    expect(screen.getByRole("group", { name: "Thao tác chấm công" })).not.toHaveFocus();
    cleanup();

    for (const entries of [[], [openEntry], [checkedOutEntry]]) {
      const first = render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={entries} />);
      expect(liveRegion(first.container).textContent).toBe("");
      expect(document.activeElement).toBe(document.body);
      first.unmount();
    }
  });
});

describe("MyTimekeepingPanel exception confirmation", () => {
  // Value: protects=the "chờ duyệt" confirmation from either card's sheet is lifted into the panel as a visible role=status above (outside) the action group, so it survives router.refresh() swapping the idle card for the open-shift card;
  // fails_when=the panel stops passing onExceptionSubmitted to a card's sheet, renders the message inside the swapped card (lost on swap), or drops role=status;
  // why_new=the sheet's own status line (timekeeping-entry-dialog.test.tsx) unmounts with the card on /timekeeping;
  // seam=TimekeepingEntryDialog mocked to record props, the captured onExceptionSubmitted called directly; no_claim=does not prove the sheet calls it (timekeeping-entry-dialog.test.tsx does) or that the server queued the exception
  it("shows the confirmation from the idle card's sheet above the group and keeps it after the card swap", () => {
    const message = "Đã ghi nhận chấm công chờ duyệt. Quản lý sẽ xác minh.";
    const { rerender } = render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />);
    // The status region is always mounted (so the confirmation is announced when it arrives) and starts empty.
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    // In the accessibility tree while empty (sr-only keeps it out of the grid gap), never display:none.
    expect(screen.getByRole("status")).toHaveClass("empty:sr-only");
    expect(screen.getByRole("status")).not.toHaveClass("empty:hidden");

    const notify = lastDialogProps("check-in").onExceptionSubmitted;
    expect(notify).toEqual(expect.any(Function));
    act(() => notify?.(message));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(message);
    const group = screen.getByRole("group", { name: "Thao tác chấm công" });
    expect(group.contains(status)).toBe(false);
    expect(status.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rerender(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[openEntry]} />);

    expect(screen.getByRole("button", { name: "Ra ca" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(message);

    const checkoutMessage = "Đã ghi nhận ra ca chờ duyệt.";
    act(() => lastDialogProps("check-out").onExceptionSubmitted?.(checkoutMessage));
    expect(screen.getByRole("status")).toHaveTextContent(checkoutMessage);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});

describe("MyTimekeepingPanel with blocked storage", () => {
  // Value: protects=a browser that blocks site data (localStorage throws SecurityError) still gets a working card: offline checked by default, a tap selects online and reaches the sheet as initialMode, nothing throws;
  // fails_when=the panel reads (or writes) localStorage outside readRememberedTimekeepingMode's try/catch, or the tapped choice depends on storage;
  // why_new=every other test runs with a working jsdom localStorage;
  // seam=Storage.prototype.getItem/setItem spied to throw (restored in finally), TimekeepingEntryDialog mocked; no_claim=does not prove the sheet's rememberTimekeepingMode swallows the error (its module try/catch does)
  it("renders the offline default and passes a tapped online choice to the sheet without throwing", () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);

    try {
      expect(() => render(<MyTimekeepingPanel attendancePolicy={configuredPolicy} canCheck entries={[]} />)).not.toThrow();
      expect(getItem).toHaveBeenCalled();
      expect(screen.getByRole("radio", { name: "Tại trung tâm" })).toBeChecked();
      expect(lastDialogProps("check-in").initialMode).toBe("offline");

      expect(() => fireEvent.click(screen.getByRole("radio", { name: "Trực tuyến" }))).not.toThrow();
      expect(screen.getByRole("radio", { name: "Trực tuyến" })).toBeChecked();
      expect(lastDialogProps("check-in").initialMode).toBe("online");
      expect(conditionTexts()[0]).toMatch(/^Trực tuyến chỉ nhận/);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
