// Value: protects=useAttendanceHeartbeat under continuous tracking (step 12 routed its device and server access through TimekeepingActionOverrides): it watches the injected geolocation, sends each sample (rounded accuracy) through the injected heartbeat, reports "Đã xác nhận tại Trung tâm" with the distance, throttles samples under 3 s, reports a server-closed shift with its message and onSessionClosed, and on unmount clears the watch on the SAME geolocation object; the real device and the real server action are never touched;
// fails_when=the hook goes back to navigator.geolocation or submitAttendanceHeartbeatAction while overrides are given (the /dev preview would touch the device/production), clearWatch is called on another object (watch leak), the throttle or the closed-session branch is lost, or accuracy is sent unrounded;
// why_new=every existing test mocks the hook (attendance-heartbeat-watcher, my-timekeeping-panel-redesign) and the /dev preview never enables tracking;
// seam=none (the hook's own `actions` option; the server action module is mocked only so a real call is observable; Date faked alone for the 3 s throttle); no_claim=does not prove continuous tracking is enabled anywhere today (off since 2026-09-15) or how the server judges a sample
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AttendanceHeartbeatResult } from "@/features/timekeeping/time-entry-action-types";

const serverActions = vi.hoisted(() => ({
  checkInTimeEntryAction: vi.fn(),
  checkOutTimeEntryAction: vi.fn(),
  submitAttendanceHeartbeatAction: vi.fn(),
}));

vi.mock("@/features/timekeeping/time-entry-actions", () => serverActions);

import { useAttendanceHeartbeat } from "@/features/timekeeping/hooks/use-attendance-heartbeat";

const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");

function position(accuracy: number): GeolocationPosition {
  return { coords: { accuracy, latitude: 21.0362, longitude: 105.7906 } } as GeolocationPosition;
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  if (originalGeolocation) {
    Object.defineProperty(navigator, "geolocation", originalGeolocation);
  } else {
    Reflect.deleteProperty(navigator, "geolocation");
  }
});

describe("useAttendanceHeartbeat with overrides", () => {
  it("watches the injected device, reports through the injected heartbeat and clears the same watch", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-12T10:00:00.000Z"), toFake: ["Date"] });
    const device = { clearWatch: vi.fn(), getCurrentPosition: vi.fn(), watchPosition: vi.fn() };
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: device });

    let onSample: PositionCallback = () => undefined;
    const geolocation = {
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn((success: PositionCallback) => {
        onSample = success;
        return 7;
      }),
    };
    const closed: AttendanceHeartbeatResult = { closedByServer: true, messageVi: "Ca đã được hệ thống kết thúc.", reason: "daily_cutoff", sessionActive: false };
    const submitAttendanceHeartbeat = vi.fn()
      .mockResolvedValueOnce({ distanceM: 38, sessionActive: true, verifiedInside: true })
      .mockResolvedValueOnce(closed);
    const onSessionClosed = vi.fn();
    const actions = { geolocation, submitAttendanceHeartbeat };

    const { result, unmount } = renderHook(() =>
      useAttendanceHeartbeat({ actions, activeSessionId: "entry-open", enabled: true, onSessionClosed }),
    );

    expect(geolocation.watchPosition).toHaveBeenCalledOnce();
    expect(geolocation.watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });
    expect(result.current.statusLabel).toBe("Đang xác định vị trí");

    act(() => onSample(position(12.6)));
    await waitFor(() => expect(result.current.statusLabel).toBe("Đã xác nhận tại Trung tâm"));
    expect(result.current.distanceM).toBe(38);
    expect(submitAttendanceHeartbeat).toHaveBeenCalledWith({ gpsAccuracyMeters: 13, gpsLatitude: 21.0362, gpsLongitude: 105.7906 });

    // A second sample inside 3 s is dropped.
    act(() => onSample(position(9)));
    expect(submitAttendanceHeartbeat).toHaveBeenCalledOnce();

    vi.setSystemTime(new Date("2026-10-12T10:00:03.500Z"));
    act(() => onSample(position(9)));
    await waitFor(() => expect(onSessionClosed).toHaveBeenCalledWith(closed));
    expect(result.current.statusLabel).toBe("Ngoài khu vực Trung tâm");
    expect(result.current.serverMessage).toBe("Ca đã được hệ thống kết thúc.");
    expect(submitAttendanceHeartbeat).toHaveBeenCalledTimes(2);

    unmount();
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7);
    expect(serverActions.submitAttendanceHeartbeatAction).not.toHaveBeenCalled();
    for (const call of Object.values(device)) {
      expect(call).not.toHaveBeenCalled();
    }
  });

  // Value: protects=the 25 s keep-alive under continuous tracking: it asks the INJECTED geolocation for a FRESH high-accuracy fix ({enableHighAccuracy:true, maximumAge:0, timeout:10000}), sends a good sample (rounded accuracy) through the injected heartbeat and shows "Đã xác nhận tại Trung tâm", turns a failed fix into "Mất tín hiệu vị trí", and stops on unmount; the device and the real server action are never touched;
  // fails_when=the interval goes back to navigator.geolocation or submitAttendanceHeartbeatAction, reuses a cached fix (maximumAge > 0) or another cadence, drops the error branch, or keeps firing after unmount (interval leak);
  // why_new=the watch test above never advances the 25 s interval (testing specialist finding, review cycle 1);
  // seam=Date + setInterval/clearInterval faked (setTimeout and the React scheduler stay real), the hook's own `actions` option; no_claim=does not prove watchPosition alone would detect a slow drift or how the server judges the sample
  it("polls a fresh fix every 25 s through the injected device and stops after unmount", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-12T10:00:00.000Z"), toFake: ["Date", "setInterval", "clearInterval"] });
    const device = { clearWatch: vi.fn(), getCurrentPosition: vi.fn(), watchPosition: vi.fn() };
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: device });

    const fixRequests: Array<{ error: PositionErrorCallback; success: PositionCallback }> = [];
    const geolocation = {
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
        fixRequests.push({ error: error ?? (() => undefined), success });
      }),
      watchPosition: vi.fn(() => 11),
    };
    const submitAttendanceHeartbeat = vi.fn().mockResolvedValue({ distanceM: 24, sessionActive: true, verifiedInside: true });
    const actions = { geolocation, submitAttendanceHeartbeat };

    const { result, unmount } = renderHook(() =>
      useAttendanceHeartbeat({ actions, activeSessionId: "entry-open", enabled: true }),
    );

    act(() => vi.advanceTimersByTime(24_999));
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce();
    expect(geolocation.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    });

    await act(async () => {
      fixRequests[0].success(position(7.4));
    });
    expect(submitAttendanceHeartbeat).toHaveBeenCalledOnce();
    expect(submitAttendanceHeartbeat).toHaveBeenCalledWith({ gpsAccuracyMeters: 7, gpsLatitude: 21.0362, gpsLongitude: 105.7906 });
    expect(result.current.statusLabel).toBe("Đã xác nhận tại Trung tâm");
    expect(result.current.distanceM).toBe(24);

    act(() => vi.advanceTimersByTime(25_000));
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    act(() => fixRequests[1].error({ code: 3, message: "Timeout" } as GeolocationPositionError));
    expect(result.current.statusLabel).toBe("Mất tín hiệu vị trí");
    expect(submitAttendanceHeartbeat).toHaveBeenCalledOnce();

    unmount();
    expect(geolocation.clearWatch).toHaveBeenCalledWith(11);
    act(() => vi.advanceTimersByTime(50_000));
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(submitAttendanceHeartbeat).toHaveBeenCalledOnce();
    expect(serverActions.submitAttendanceHeartbeatAction).not.toHaveBeenCalled();
    for (const call of Object.values(device)) {
      expect(call).not.toHaveBeenCalled();
    }
  });

  // Value: protects=C14: an override that says "this device has no geolocation" (actions.geolocation null) reports "Mất tín hiệu vị trí" with "Trình duyệt không hỗ trợ định vị GPS." and never falls back to navigator.geolocation or sends a heartbeat;
  // fails_when=resolveTimekeepingGeolocation treats null like "not overridden" (the /dev preview would touch the real device), the unsupported branch stops setting the status/message, or a heartbeat is sent without a sample;
  // why_new=only the entry dialog tests the null override; the hook's unsupported branch had no test;
  // seam=the hook's own `actions` option, real timers (the branch defers its update with setTimeout 0); no_claim=does not prove what a real browser without geolocation exposes
  it("reports a device without geolocation when the override is null and never touches the device", async () => {
    const device = { clearWatch: vi.fn(), getCurrentPosition: vi.fn(), watchPosition: vi.fn() };
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: device });
    const submitAttendanceHeartbeat = vi.fn();
    const actions = { geolocation: null, submitAttendanceHeartbeat };

    const { result } = renderHook(() =>
      useAttendanceHeartbeat({ actions, activeSessionId: "entry-open", enabled: true }),
    );

    await waitFor(() => expect(result.current.statusLabel).toBe("Mất tín hiệu vị trí"));
    expect(result.current.status).toBe("signal_lost");
    expect(result.current.serverMessage).toBe("Trình duyệt không hỗ trợ định vị GPS.");
    expect(submitAttendanceHeartbeat).not.toHaveBeenCalled();
    expect(serverActions.submitAttendanceHeartbeatAction).not.toHaveBeenCalled();
    for (const call of Object.values(device)) {
      expect(call).not.toHaveBeenCalled();
    }
  });
});
