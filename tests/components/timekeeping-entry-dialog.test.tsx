import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";

const actions = vi.hoisted(() => ({
  checkInTimeEntryAction: vi.fn(),
  checkOutTimeEntryAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const initialGeolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, "geolocation");

vi.mock("@/features/timekeeping/time-entry-actions", () => actions);
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

    const trigger = screen.getByRole("button", { name: "Check-in" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Xác nhận check-in" });
    expect(screen.getByLabelText("Hình thức")).toHaveValue("offline");
    expect(screen.getByLabelText("Tên mạng Wi-Fi")).toBeInTheDocument();
    expect(screen.getByLabelText("BSSID")).toBeInTheDocument();
    expect(screen.queryByText(/vị trí hợp lệ|wi-fi hợp lệ|đủ điều kiện chấm công/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Hình thức"), { target: { value: "online" } });
    fireEvent.change(screen.getByLabelText("Tên mạng Wi-Fi"), { target: { value: "Campus" } });
    fireEvent.change(screen.getByLabelText("BSSID"), { target: { value: "AA:BB:CC:DD:EE:FF" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận check-in" }));

    await waitFor(() => expect(actions.checkInTimeEntryAction).toHaveBeenCalledWith({
      gpsAccuracyMeters: null,
      gpsLatitude: null,
      gpsLongitude: null,
      mode: "online",
      wifiBssid: "AA:BB:CC:DD:EE:FF",
      wifiSsid: "Campus",
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

    const trigger = screen.getByRole("button", { name: "Check-out" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Xác nhận check-out" });
    const submit = within(dialog).getByRole("button", { name: "Xác nhận check-out" });
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

    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    fireEvent.click(screen.getByRole("button", { name: "Lấy vị trí hiện tại" }));

    expect(screen.getByText("Đã lấy dữ liệu vị trí từ thiết bị.")).toBeInTheDocument();
    expect(screen.getByText(/Đã có dữ liệu vị trí, sai số khoảng 13 m/)).toBeInTheDocument();
    expect(screen.queryByText(/vị trí hợp lệ|đúng địa điểm|đủ điều kiện/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận check-in" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    const dialog = screen.getByRole("dialog", { name: "Xác nhận check-in" });
    const submit = within(dialog).getByRole("button", { name: "Xác nhận check-in" });
    fireEvent.click(submit);
    await waitFor(() => expect(actions.checkInTimeEntryAction).toHaveBeenCalledOnce());

    expect(dialog).toHaveTextContent("Đang check-in…");
    expect(submit).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(submit);
    expect(screen.getByRole("dialog", { name: "Xác nhận check-in" })).toBeInTheDocument();
    expect(actions.checkInTimeEntryAction).toHaveBeenCalledOnce();

    pending.resolve({ message: "Bạn đang có một lượt chấm công chưa kết thúc.", status: "error" });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Bạn đang có một lượt chấm công chưa kết thúc."));
  });

  it("keeps capture state visible and guarded while the browser is locating", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    render(<TimekeepingEntryDialog operation="check-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    const dialog = screen.getByRole("dialog", { name: "Xác nhận check-in" });
    fireEvent.click(screen.getByRole("button", { name: "Lấy vị trí hiện tại" }));

    expect(dialog).toHaveTextContent("Đang lấy vị trí…");
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole("dialog", { name: "Xác nhận check-in" })).toBeInTheDocument();
    expect(actions.checkInTimeEntryAction).not.toHaveBeenCalled();
  });

  it("uses neutral evidence-capture wording when geolocation is unavailable", () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
    render(<TimekeepingEntryDialog operation="check-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
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

    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    fireEvent.click(screen.getByRole("button", { name: "Lấy vị trí hiện tại" }));

    expect(screen.getByText("Không lấy được vị trí. Bạn vẫn có thể ghi nhận không kèm GPS.")).toBeInTheDocument();
    expect(screen.queryByText(/gps không hợp lệ|vị trí không hợp lệ|sai vị trí|không đủ điều kiện chấm công/i)).not.toBeInTheDocument();
  });
});
