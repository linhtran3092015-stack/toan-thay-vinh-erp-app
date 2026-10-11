import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";

const actions = vi.hoisted(() => ({ requestAttendanceExceptionAction: vi.fn(), checkInTimeEntryAction: vi.fn(), checkOutTimeEntryAction: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/timekeeping/attendance-exception-actions", () => ({ requestAttendanceExceptionAction: actions.requestAttendanceExceptionAction }));
vi.mock("@/features/timekeeping/time-entry-actions", () => ({ checkInTimeEntryAction: actions.checkInTimeEntryAction, checkOutTimeEntryAction: actions.checkOutTimeEntryAction }));
const policy = { configured: true, centerName: "Trung tâm", attendanceRadiusM: 100, gpsMaxAccuracyM: 100, gpsRequiredForOffline: true as const, wifiRequiredForOffline: true, continuousGpsTrackingRequired: false, exceptionReviewEnabled: true };
const originalGeo = Object.getOwnPropertyDescriptor(navigator, "geolocation");
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.clearAllMocks();
  if (originalGeo) Object.defineProperty(navigator, "geolocation", originalGeo);
  else delete (navigator as { geolocation?: Geolocation }).geolocation;
});

describe("attendance exception submission", () => {
  it("records checkout intent with the current shift ID even without GPS or required Wi-Fi", async () => {
    actions.requestAttendanceExceptionAction.mockResolvedValue({ status: "success", message: "Đã ghi nhận chờ duyệt" });
    render(<TimekeepingEntryDialog autoLocate={false} operation="check-out" timeEntryId="13000000-0000-0000-0000-000000000001" attendancePolicy={policy} />);
    fireEvent.click(screen.getByRole("button", { name: "Ra ca" }));
    expect(screen.getByRole("button", { name: "Gửi chấm công chờ duyệt" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Lý do cần duyệt"), { target: { value: "Máy tính không lấy được vị trí" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi chấm công chờ duyệt" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(actions.requestAttendanceExceptionAction).toHaveBeenCalledWith({ operation: "check-out", timeEntryId: "13000000-0000-0000-0000-000000000001", reason: "Máy tính không lấy được vị trí", requestId: expect.any(String) });
    expect(actions.checkOutTimeEntryAction).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Đã ghi nhận chờ duyệt");
  });
  it("reuses the request ID on network retry and never reports success before acknowledgement", async () => {
    actions.requestAttendanceExceptionAction.mockResolvedValueOnce({ status: "error", message: "Mất mạng" }).mockResolvedValueOnce({ status: "success", message: "Đã gửi" });
    render(<TimekeepingEntryDialog autoLocate={false} operation="check-in" attendancePolicy={policy} />);
    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    fireEvent.change(screen.getByLabelText("Lý do cần duyệt"), { target: { value: "GPS không khả dụng" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi chấm công chờ duyệt" }));
    await screen.findByText("Mất mạng");
    expect(router.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Gửi chấm công chờ duyệt" }));
    await waitFor(() => expect(actions.requestAttendanceExceptionAction).toHaveBeenCalledTimes(2));
    expect(actions.requestAttendanceExceptionAction.mock.calls[0][0].requestId).toBe(actions.requestAttendanceExceptionAction.mock.calls[1][0].requestId);
  });
  it("rejects captured location older than 60 seconds", async () => {
    let success!: PositionCallback;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (cb: PositionCallback) => { success = cb; } } });
    const now = vi.spyOn(Date, "now").mockReturnValue(100_000);
    render(<TimekeepingEntryDialog autoLocate={false} operation="check-in" attendancePolicy={{ ...policy, wifiRequiredForOffline: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    fireEvent.click(screen.getByRole("button", { name: "Lấy vị trí hiện tại" }));
    act(() => success({ coords: { latitude: 10, longitude: 106, accuracy: 5 } } as GeolocationPosition));
    now.mockReturnValue(160_001);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận vào ca" }));
    expect(actions.checkInTimeEntryAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Vị trí đã quá 60 giây/)).toBeInTheDocument();
  });
});
