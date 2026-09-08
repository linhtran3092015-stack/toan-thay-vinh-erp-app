import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttendanceHeartbeatWatcher } from "@/features/timekeeping/components/attendance-heartbeat-watcher";

const mockRefresh = vi.fn();
let mockPathname = "/dashboard";
let capturedHeartbeatOptions: any = null;

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/features/timekeeping/hooks/use-attendance-heartbeat", () => ({
  useAttendanceHeartbeat: (options: any) => {
    capturedHeartbeatOptions = options;
    return {
      distanceM: 50,
      serverMessage: null,
      status: "confirmed_inside",
      statusLabel: "Tại Trung tâm",
    };
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  capturedHeartbeatOptions = null;
  mockPathname = "/dashboard";
});

describe("AttendanceHeartbeatWatcher", () => {
  it("does not enable tracking when activeSessionId is null", () => {
    render(<AttendanceHeartbeatWatcher activeSessionId={null} />);
    expect(capturedHeartbeatOptions.enabled).toBe(false);
    expect(capturedHeartbeatOptions.activeSessionId).toBe(null);
  });

  it("enables tracking when activeSessionId is present on other pages", () => {
    mockPathname = "/classes";
    render(<AttendanceHeartbeatWatcher activeSessionId="session-123" />);

    expect(capturedHeartbeatOptions.enabled).toBe(true);
    expect(capturedHeartbeatOptions.activeSessionId).toBe("session-123");
  });

  it("does not enable background watcher on /timekeeping page to avoid duplicate tracking", () => {
    mockPathname = "/timekeeping";
    render(<AttendanceHeartbeatWatcher activeSessionId="session-123" />);

    expect(capturedHeartbeatOptions.enabled).toBe(false);
    expect(capturedHeartbeatOptions.activeSessionId).toBe(null);
  });

  it("triggers onSessionClosed and displays alert notification when geofence exit occurs", () => {
    mockPathname = "/students";
    render(<AttendanceHeartbeatWatcher activeSessionId="session-123" />);

    expect(capturedHeartbeatOptions.onSessionClosed).toBeDefined();

    // Simulate geofence exit callback
    act(() => {
      capturedHeartbeatOptions.onSessionClosed({
        messageVi: "Đã tự động kết thúc ca do rời khỏi khu vực trung tâm",
        sessionActive: false,
      });
    });

    expect(mockRefresh).toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Tự động ngắt chấm công")).toBeInTheDocument();
    expect(
      screen.getByText("Đã tự động kết thúc ca do rời khỏi khu vực trung tâm"),
    ).toBeInTheDocument();
  });
});
