import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";
import type { TimekeepingActionOverrides } from "@/features/timekeeping/timekeeping-action-overrides";
import type { AttendanceVerificationPolicy } from "@/features/timekeeping/types";

const actions = vi.hoisted(() => ({
  checkInTimeEntryAction: vi.fn(),
  checkOutTimeEntryAction: vi.fn(),
}));
const exceptionActions = vi.hoisted(() => ({ requestAttendanceExceptionAction: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const initialGeolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, "geolocation");

vi.mock("@/features/timekeeping/time-entry-actions", () => actions);
// Stubbed so a broken `actions.requestAttendanceException` override can never reach the real server action.
vi.mock("@/features/timekeeping/attendance-exception-actions", () => exceptionActions);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  if (initialGeolocationDescriptor) {
    Object.defineProperty(navigator, "geolocation", initialGeolocationDescriptor);
  } else {
    delete (navigator as { geolocation?: Geolocation }).geolocation;
  }
});

describe("Timekeeping entry dialog", () => {
  it("keeps the check-in evidence payload server-shaped and refreshes only after authoritative success", async () => {
    actions.checkInTimeEntryAction.mockResolvedValueOnce({ message: "Đã ghi nhận check-in.", status: "success" });
    render(<TimekeepingEntryDialog operation="check-in" />);

    const trigger = screen.getByRole("button", { name: "Vào ca" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Xác nhận vào ca" });
    expect(screen.getByLabelText("Hình thức")).toHaveValue("offline");
    // Wi-Fi fields are hidden unless the owner requires them: phones cannot read SSID/BSSID.
    expect(screen.queryByLabelText("Tên mạng Wi-Fi")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("BSSID")).not.toBeInTheDocument();
    expect(screen.queryByText(/vị trí hợp lệ|wi-fi hợp lệ|đủ điều kiện chấm công/i)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận vào ca" }));

    await waitFor(() => expect(actions.checkInTimeEntryAction).toHaveBeenCalledWith({
      gpsAccuracyMeters: null,
      gpsLatitude: null,
      gpsLongitude: null,
      mode: "offline",
      wifiBssid: "",
      wifiSsid: "",
    }));
    expect(actions.checkInTimeEntryAction).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("keeps checkout binding separate, prevents duplicates, and refreshes only after authoritative success", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.checkOutTimeEntryAction.mockReturnValueOnce(pending.promise);
    render(<TimekeepingEntryDialog operation="check-out" />);

    const trigger = screen.getByRole("button", { name: "Ra ca" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Xác nhận ra ca" });
    const submit = within(dialog).getByRole("button", { name: "Xác nhận ra ca" });
    fireEvent.click(submit);

    await waitFor(() => expect(actions.checkOutTimeEntryAction).toHaveBeenCalledWith({
      gpsAccuracyMeters: null,
      gpsLatitude: null,
      gpsLongitude: null,
      mode: "offline",
      wifiBssid: "",
      wifiSsid: "",
    }));
    fireEvent.click(submit);
    expect(actions.checkOutTimeEntryAction).toHaveBeenCalledOnce();
    expect(actions.checkInTimeEntryAction).not.toHaveBeenCalled();

    pending.resolve({ message: "Đã ghi nhận check-out.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("captures GPS as evidence without claiming it is valid or eligible", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { accuracy: 12.6, latitude: 10.777, longitude: 106.699 } } as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    actions.checkInTimeEntryAction.mockResolvedValueOnce({ message: "Đã ghi nhận check-in.", status: "success" });
    render(<TimekeepingEntryDialog operation="check-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    fireEvent.click(screen.getByRole("button", { name: "Lấy vị trí hiện tại" }));

    expect(screen.getByText("Đã lấy dữ liệu vị trí từ thiết bị.")).toBeInTheDocument();
    expect(screen.getByText(/Đã có dữ liệu vị trí, sai số khoảng 13 m/)).toBeInTheDocument();
    expect(screen.queryByText(/vị trí hợp lệ|đúng địa điểm|đủ điều kiện/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận vào ca" }));

    await waitFor(() => expect(actions.checkInTimeEntryAction).toHaveBeenCalledWith(expect.objectContaining({
      gpsAccuracyMeters: 13,
      gpsLatitude: 10.777,
      gpsLongitude: 106.699,
    })));
  });

  it("keeps the shared Dialog open and prevents duplicate check-in while the mutation is pending", async () => {
    const pending = deferred<{ message: string; status: "error" }>();
    actions.checkInTimeEntryAction.mockReturnValueOnce(pending.promise);
    render(<TimekeepingEntryDialog operation="check-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    const dialog = screen.getByRole("dialog", { name: "Xác nhận vào ca" });
    const submit = within(dialog).getByRole("button", { name: "Xác nhận vào ca" });
    fireEvent.click(submit);
    await waitFor(() => expect(actions.checkInTimeEntryAction).toHaveBeenCalledOnce());

    expect(dialog).toHaveTextContent("Đang vào ca…");
    expect(submit).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(submit);
    expect(screen.getByRole("dialog", { name: "Xác nhận vào ca" })).toBeInTheDocument();
    expect(actions.checkInTimeEntryAction).toHaveBeenCalledOnce();

    pending.resolve({ message: "Bạn đang có một lượt chấm công chưa kết thúc.", status: "error" });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Bạn đang có một lượt chấm công chưa kết thúc."));
  });

  it("keeps capture state visible and guarded while the browser is locating", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    render(<TimekeepingEntryDialog operation="check-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    const dialog = screen.getByRole("dialog", { name: "Xác nhận vào ca" });
    fireEvent.click(screen.getByRole("button", { name: "Lấy vị trí hiện tại" }));

    expect(dialog).toHaveTextContent("Đang lấy vị trí…");
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole("dialog", { name: "Xác nhận vào ca" })).toBeInTheDocument();
    expect(actions.checkInTimeEntryAction).not.toHaveBeenCalled();
  });

  it("uses neutral evidence-capture wording when geolocation is unavailable", () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
    render(<TimekeepingEntryDialog operation="check-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    fireEvent.click(screen.getByRole("button", { name: "Lấy vị trí hiện tại" }));

    expect(screen.getByText("Trình duyệt hiện tại không hỗ trợ định vị.")).toBeInTheDocument();
    expect(screen.queryByText(/gps không hợp lệ|vị trí không hợp lệ|sai vị trí|không đủ điều kiện chấm công/i)).not.toBeInTheDocument();
  });

  it("uses neutral evidence-capture wording when a geolocation request is rejected", () => {
    const getCurrentPosition = vi.fn((_: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, message: "Permission denied" } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    render(<TimekeepingEntryDialog operation="check-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    fireEvent.click(screen.getByRole("button", { name: "Lấy vị trí hiện tại" }));

    expect(screen.getByText("Trình duyệt chưa được cấp quyền vị trí. Hãy cấp quyền hoặc gửi chấm công chờ duyệt.")).toBeInTheDocument();
    expect(screen.queryByText(/gps không hợp lệ|vị trí không hợp lệ|sai vị trí|không đủ điều kiện chấm công/i)).not.toBeInTheDocument();
  });

  it("shows configured offline requirements and hides evidence fields for online attendance", () => {
    render(
      <TimekeepingEntryDialog
        attendancePolicy={{
          attendanceRadiusM: 150,
          centerName: "Cơ sở chính",
          configured: true,
          continuousGpsTrackingRequired: false,
          gpsMaxAccuracyM: 60,
          gpsRequiredForOffline: true,
          wifiRequiredForOffline: true,
        }}
        operation="check-in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    expect(screen.getByText(/bán kính 150 m và sai số không quá 60 m/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Tên mạng Wi-Fi")).toBeRequired();
    expect(screen.getByLabelText("BSSID")).toBeRequired();

    fireEvent.change(screen.getByLabelText("Hình thức"), { target: { value: "online" } });
    expect(screen.queryByText("Dữ liệu vị trí GPS")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tên mạng Wi-Fi")).not.toBeInTheDocument();
  });
  it.each(["check-in", "check-out"] as const)("keeps %s transport failures inside the dialog", async (operation) => {
    const action = operation === "check-in" ? actions.checkInTimeEntryAction : actions.checkOutTimeEntryAction;
    action.mockRejectedValueOnce(new Error("transport unavailable"));
    render(<TimekeepingEntryDialog operation={operation} />);
    fireEvent.click(screen.getByRole("button", { name: operation === "check-in" ? "Vào ca" : "Ra ca" }));
    fireEvent.click(screen.getByRole("button", { name: operation === "check-in" ? "Xác nhận vào ca" : "Xác nhận ra ca" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể kết nối tới hệ thống chấm công");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

});

// Step 12 (D2/D4/D13): the /timekeeping card pre-fills the sheet's mode, the
// sheet shows the accuracy limit next to the captured accuracy, and the
// /dev/timekeeping preview swaps the server actions and the device location.
describe("Timekeeping entry dialog — card mode, accuracy hint and overrides", () => {
  const LAST_MODE_KEY = "timekeeping.lastMode";
  const BANNED_DIALOG_TEXT = /vị trí hợp lệ|wi-fi hợp lệ|đủ điều kiện chấm công|đủ điều kiện|đúng địa điểm|gps không hợp lệ|vị trí không hợp lệ|sai vị trí|không đủ điều kiện chấm công/i;
  const ACCURACY_WARNING = "Sai số lớn hơn mức cho phép. Thử ra chỗ thoáng rồi lấy lại vị trí.";
  const configuredPolicy: AttendanceVerificationPolicy = {
    attendanceRadiusM: 150,
    centerName: "Cơ sở chính",
    configured: true,
    continuousGpsTrackingRequired: false,
    gpsMaxAccuracyM: 50,
    gpsRequiredForOffline: true,
    wifiRequiredForOffline: false,
  };

  function positionAt(accuracy: number) {
    return vi.fn((success: PositionCallback) => {
      success({ coords: { accuracy, latitude: 10.777, longitude: 106.699 } } as GeolocationPosition);
    });
  }

  function stubGeolocation(getCurrentPosition: Geolocation["getCurrentPosition"]) {
    return { clearWatch: vi.fn(), getCurrentPosition, watchPosition: vi.fn() };
  }

  function installDeviceGeolocation() {
    const getCurrentPosition = positionAt(5);
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    return getCurrentPosition;
  }

  afterEach(() => {
    window.localStorage.clear();
  });

  it("opens in the card's online choice without auto-locating, even with a configured centre", () => {
    const deviceGetCurrentPosition = installDeviceGeolocation();
    render(<TimekeepingEntryDialog attendancePolicy={configuredPolicy} initialMode="online" operation="check-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));

    expect(screen.getByLabelText("Hình thức")).toHaveValue("online");
    expect(screen.queryByText("Dữ liệu vị trí GPS")).not.toBeInTheDocument();
    expect(deviceGetCurrentPosition).not.toHaveBeenCalled();
  });

  it("lets the card's offline choice win over a remembered online mode and auto-locate", () => {
    window.localStorage.setItem(LAST_MODE_KEY, "online");
    const deviceGetCurrentPosition = installDeviceGeolocation();
    render(<TimekeepingEntryDialog attendancePolicy={configuredPolicy} initialMode="offline" operation="check-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));

    expect(screen.getByLabelText("Hình thức")).toHaveValue("offline");
    expect(deviceGetCurrentPosition).toHaveBeenCalledOnce();
    expect(screen.getByText("Đã lấy dữ liệu vị trí từ thiết bị.")).toBeInTheDocument();
  });

  it("keeps the remembered mode when no initialMode is given (topbar and dashboard callers)", () => {
    window.localStorage.setItem(LAST_MODE_KEY, "online");
    render(<TimekeepingEntryDialog attendancePolicy={configuredPolicy} operation="check-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));

    expect(screen.getByLabelText("Hình thức")).toHaveValue("online");
  });

  it.each(["check-in", "check-out"] as const)("sends %s through the override instead of the server action", async (operation) => {
    const override = vi.fn().mockResolvedValue({ message: "Đã ghi nhận.", status: "success" });
    const overrides: TimekeepingActionOverrides = operation === "check-in"
      ? { checkInTimeEntry: override }
      : { checkOutTimeEntry: override };
    render(<TimekeepingEntryDialog actions={overrides} initialMode="online" operation={operation} timeEntryId="entry-open" />);

    fireEvent.click(screen.getByRole("button", { name: operation === "check-in" ? "Vào ca" : "Ra ca" }));
    fireEvent.click(screen.getByRole("button", { name: operation === "check-in" ? "Xác nhận vào ca" : "Xác nhận ra ca" }));

    await waitFor(() => expect(override).toHaveBeenCalledWith({
      gpsAccuracyMeters: null,
      gpsLatitude: null,
      gpsLongitude: null,
      mode: "online",
      wifiBssid: "",
      wifiSsid: "",
    }));
    expect(override).toHaveBeenCalledOnce();
    expect(actions.checkInTimeEntryAction).not.toHaveBeenCalled();
    expect(actions.checkOutTimeEntryAction).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem(LAST_MODE_KEY)).toBe("online");
  });

  it("locates through the geolocation override and never touches the device", async () => {
    const deviceGetCurrentPosition = installDeviceGeolocation();
    const stubGetCurrentPosition = positionAt(12.6);
    const checkInTimeEntry = vi.fn().mockResolvedValue({ message: "Đã ghi nhận.", status: "success" });
    render(
      <TimekeepingEntryDialog
        actions={{ checkInTimeEntry, geolocation: stubGeolocation(stubGetCurrentPosition) }}
        attendancePolicy={configuredPolicy}
        operation="check-in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));

    expect(stubGetCurrentPosition).toHaveBeenCalledOnce();
    expect(stubGetCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    });
    expect(deviceGetCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByText("Đã có dữ liệu vị trí, sai số khoảng 13 m (cho phép tối đa 50 m).")).toBeInTheDocument();
    expect(screen.queryByText(ACCURACY_WARNING)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lấy vị trí hiện tại" }));
    expect(stubGetCurrentPosition).toHaveBeenCalledTimes(2);
    expect(deviceGetCurrentPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận vào ca" }));
    await waitFor(() => expect(checkInTimeEntry).toHaveBeenCalledWith(expect.objectContaining({
      gpsAccuracyMeters: 13,
      gpsLatitude: 10.777,
      gpsLongitude: 106.699,
      mode: "offline",
    })));
    expect(actions.checkInTimeEntryAction).not.toHaveBeenCalled();
  });

  it("treats a null geolocation override as a browser without location support", () => {
    const deviceGetCurrentPosition = installDeviceGeolocation();
    render(<TimekeepingEntryDialog actions={{ geolocation: null }} attendancePolicy={configuredPolicy} operation="check-in" />);

    // Auto-locate on open already reports the missing support; the retry button does too.
    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    expect(screen.getByText("Trình duyệt hiện tại không hỗ trợ định vị.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lấy vị trí hiện tại" }));
    expect(screen.getByText("Trình duyệt hiện tại không hỗ trợ định vị.")).toBeInTheDocument();
    expect(deviceGetCurrentPosition).not.toHaveBeenCalled();
    expect(screen.queryByText(BANNED_DIALOG_TEXT)).not.toBeInTheDocument();
  });

  it("warns when the captured accuracy exceeds the policy limit, without blocking submit or judging eligibility", () => {
    const getCurrentPosition = positionAt(85.2);
    render(
      <TimekeepingEntryDialog
        actions={{ geolocation: stubGeolocation(getCurrentPosition) }}
        attendancePolicy={configuredPolicy}
        operation="check-in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));

    const dialog = screen.getByRole("dialog", { name: "Xác nhận vào ca" });
    expect(within(dialog).getByText("Đã có dữ liệu vị trí, sai số khoảng 85 m (cho phép tối đa 50 m).")).toBeInTheDocument();
    expect(within(dialog).getByText(ACCURACY_WARNING)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Xác nhận vào ca" })).toBeEnabled();
    expect(within(dialog).queryByText(BANNED_DIALOG_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(BANNED_DIALOG_TEXT)).not.toBeInTheDocument();

    // A better sample at the limit (50.4 rounds to 50, not over) clears the warning.
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { accuracy: 50.4, latitude: 10.777, longitude: 106.699 } } as GeolocationPosition);
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lấy vị trí hiện tại" }));
    expect(within(dialog).getByText("Đã có dữ liệu vị trí, sai số khoảng 50 m (cho phép tối đa 50 m).")).toBeInTheDocument();
    expect(within(dialog).queryByText(ACCURACY_WARNING)).not.toBeInTheDocument();

    // Clearing the sample removes both lines.
    fireEvent.click(within(dialog).getByRole("button", { name: "Bỏ dữ liệu vị trí" }));
    expect(within(dialog).queryByText(/Đã có dữ liệu vị trí/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(ACCURACY_WARNING)).not.toBeInTheDocument();
  });

  it("sends the review request through the override instead of the server action", async () => {
    const requestAttendanceException = vi.fn().mockResolvedValue({ message: "Đã ghi nhận chờ duyệt", status: "success" });
    render(
      <TimekeepingEntryDialog
        actions={{ requestAttendanceException }}
        attendancePolicy={{ ...configuredPolicy, exceptionReviewEnabled: true }}
        autoLocate={false}
        operation="check-in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    fireEvent.change(screen.getByLabelText("Lý do cần duyệt"), { target: { value: "Không lấy được vị trí" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi chấm công chờ duyệt" }));

    await waitFor(() => expect(requestAttendanceException).toHaveBeenCalledWith({
      operation: "check-in",
      reason: "Không lấy được vị trí",
      requestId: expect.any(String),
      timeEntryId: null,
    }));
    expect(exceptionActions.requestAttendanceExceptionAction).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Đã ghi nhận chờ duyệt");
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  // Value: protects=on /timekeeping the "chờ duyệt" confirmation goes to the caller's onExceptionSubmitted (the panel keeps it above the card that router.refresh() replaces) INSTEAD of the sheet's own role=status line, with the server's exact message, after which the sheet closes and the route refreshes;
  // fails_when=the sheet renders its own status as well (two confirmations, one lost on the card swap), drops the callback, passes a different text, or calls it for an error result;
  // why_new=onExceptionSubmitted is new in review cycle 1; the test above pins only the uncontrolled path (own status line);
  // seam=actions.requestAttendanceException override, router mock; no_claim=does not prove the panel renders the message (my-timekeeping-panel-redesign.test.tsx does)
  it("hands a successful review request's message to onExceptionSubmitted instead of rendering its own status", async () => {
    const message = "Đã ghi nhận chấm công chờ duyệt. Quản lý sẽ xác minh.";
    const requestAttendanceException = vi.fn().mockResolvedValue({ message, status: "success" });
    const onExceptionSubmitted = vi.fn();
    render(
      <TimekeepingEntryDialog
        actions={{ requestAttendanceException }}
        attendancePolicy={{ ...configuredPolicy, exceptionReviewEnabled: true }}
        autoLocate={false}
        onExceptionSubmitted={onExceptionSubmitted}
        operation="check-in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    fireEvent.change(screen.getByLabelText("Lý do cần duyệt"), { target: { value: "Không lấy được vị trí" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi chấm công chờ duyệt" }));

    await waitFor(() => expect(onExceptionSubmitted).toHaveBeenCalledOnce());
    expect(onExceptionSubmitted).toHaveBeenCalledWith(message);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(exceptionActions.requestAttendanceExceptionAction).not.toHaveBeenCalled();
  });

  // Value: protects=an error result for the review request stays in the sheet and never reaches onExceptionSubmitted;
  // fails_when=the callback is invoked on any settled result;
  // why_new=onExceptionSubmitted is new in review cycle 1;
  // seam=actions.requestAttendanceException override; no_claim=does not cover transport rejections of the review request
  it("keeps a refused review request in the sheet without calling onExceptionSubmitted", async () => {
    const requestAttendanceException = vi.fn().mockResolvedValue({ message: "Chưa bật duyệt ngoại lệ.", status: "error" });
    const onExceptionSubmitted = vi.fn();
    render(
      <TimekeepingEntryDialog
        actions={{ requestAttendanceException }}
        attendancePolicy={{ ...configuredPolicy, exceptionReviewEnabled: true }}
        autoLocate={false}
        onExceptionSubmitted={onExceptionSubmitted}
        operation="check-in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    fireEvent.change(screen.getByLabelText("Lý do cần duyệt"), { target: { value: "Lý do" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi chấm công chờ duyệt" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa bật duyệt ngoại lệ.");
    expect(screen.getByRole("dialog", { name: "Xác nhận vào ca" })).toBeInTheDocument();
    expect(onExceptionSubmitted).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  // Value: protects=the capture result, the accuracy line and its over-limit warning are announced: all sit inside ONE always-mounted aria-live="polite" container in the GPS fieldset (a live region added together with its content is not reliably announced);
  // fails_when=the lines move out of the polite container, the container is mounted only once a sample exists, or each line gets its own nested live region again;
  // why_new=the accuracy tests above only check the text, not that it is announced;
  // seam=actions.geolocation stub (the device is never touched); no_claim=does not prove a screen reader speaks the lines
  it("announces the accuracy line, the over-limit warning and the capture message from one polite region", () => {
    let respond: PositionCallback = () => undefined;
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      respond = success;
    });
    render(
      <TimekeepingEntryDialog
        actions={{ geolocation: stubGeolocation(getCurrentPosition) }}
        attendancePolicy={configuredPolicy}
        autoLocate={false}
        operation="check-in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    const dialog = screen.getByRole("dialog", { name: "Xác nhận vào ca" });
    const regions = dialog.querySelectorAll("[aria-live='polite']");
    expect(regions).toHaveLength(1);
    const region = regions[0];
    // Mounted before any sample exists.
    expect(region.textContent).toBe("");
    expect(region.closest("fieldset")).toHaveTextContent("Dữ liệu vị trí GPS");

    fireEvent.click(within(dialog).getByRole("button", { name: "Lấy vị trí hiện tại" }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    act(() => respond({ coords: { accuracy: 85.2, latitude: 10.777, longitude: 106.699 } } as GeolocationPosition));

    const accuracyLine = within(dialog).getByText("Đã có dữ liệu vị trí, sai số khoảng 85 m (cho phép tối đa 50 m).");
    const warning = within(dialog).getByText(ACCURACY_WARNING);
    const captured = within(dialog).getByText("Đã lấy dữ liệu vị trí từ thiết bị.");
    for (const line of [accuracyLine, warning, captured]) {
      expect(region.contains(line)).toBe(true);
      expect(line.closest("[aria-live]")).toBe(region);
      expect(line).not.toHaveAttribute("aria-live");
    }
    expect(dialog.querySelectorAll("[aria-live]")).toHaveLength(1);
    // Kept in the accessibility tree while empty (sr-only), never display:none.
    expect(region).toHaveClass("empty:sr-only");
    expect(region).not.toHaveClass("empty:hidden");
  });
});
