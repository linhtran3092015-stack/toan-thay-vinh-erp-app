import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttendanceVerificationSettings } from "@/features/timekeeping/components/attendance-verification-settings";

const actions = vi.hoisted(() => ({
  updateAttendanceVerificationConfigAction: vi.fn(),
}));
const initialGeolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, "geolocation");

vi.mock("@/features/timekeeping/attendance-verification-actions", () => actions);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  if (initialGeolocationDescriptor) {
    Object.defineProperty(navigator, "geolocation", initialGeolocationDescriptor);
  } else {
    delete (navigator as { geolocation?: Geolocation }).geolocation;
  }
});

const initialConfig = {
  attendanceRadiusM: 100,
  centerLatitude: null,
  centerLongitude: null,
  centerName: "Trung tâm Toán Thầy Vinh",
  configured: false,
  continuousGpsTrackingRequired: false,
  gpsMaxAccuracyM: 100,
  gpsRequiredForOffline: true as const,
  updatedAt: null,
  wifiNetworks: [],
  wifiRequiredForOffline: false,
};

describe("Attendance verification settings", () => {
  it("captures the owner location and saves normalized GPS and Wi-Fi policy", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) => success({
          coords: { accuracy: 12.4, latitude: 10.7771234, longitude: 106.6995678 },
        } as GeolocationPosition)),
      },
    });
    actions.updateAttendanceVerificationConfigAction.mockResolvedValueOnce({
      message: "Đã cập nhật điều kiện xác minh chấm công.",
      status: "success",
    });

    render(<AttendanceVerificationSettings initialConfig={initialConfig} />);

    fireEvent.click(screen.getByRole("button", { name: "Dùng vị trí hiện tại" }));
    expect(screen.getByLabelText("Vĩ độ")).toHaveValue(10.777123);
    expect(screen.getByLabelText("Kinh độ")).toHaveValue(106.699568);

    fireEvent.click(screen.getByRole("checkbox", { name: /Bắt buộc khớp Wi-Fi/i }));
    fireEvent.click(screen.getByRole("button", { name: /Thêm mạng Wi-Fi/i }));
    fireEvent.change(screen.getByLabelText("Tên Wi-Fi (SSID)"), { target: { value: "TTV-Staff" } });
    fireEvent.change(screen.getByLabelText("BSSID"), { target: { value: "aa:bb:cc:dd:ee:ff" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu điều kiện chấm công" }));

    await waitFor(() => expect(actions.updateAttendanceVerificationConfigAction).toHaveBeenCalledWith({
      attendanceRadiusM: 100,
      centerLatitude: 10.777123,
      centerLongitude: 106.699568,
      centerName: "Trung tâm Toán Thầy Vinh",
      gpsMaxAccuracyM: 100,
      wifiNetworks: [{ bssid: "AA:BB:CC:DD:EE:FF", ssid: "TTV-Staff" }],
      wifiRequiredForOffline: true,
    }));
    expect(await screen.findByText("Đã lưu cấu hình")).toBeInTheDocument();
  });

  it("explains that browser Wi-Fi data is supplemental", () => {
    render(<AttendanceVerificationSettings initialConfig={initialConfig} />);

    expect(screen.getByText(/Trình duyệt web không thể tự đọc SSID\/BSSID/i)).toBeInTheDocument();
    expect(screen.getByText(/GPS vẫn là bằng chứng vị trí chính/i)).toBeInTheDocument();
  });
});
