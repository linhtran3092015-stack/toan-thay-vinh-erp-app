// Value: protects=the /dev/timekeeping preview is inert: checking in and out, the "Gửi chấm công chờ duyệt" exception path, the adjustment sheet, the month switch and the review list all run the preview's stubs and never the real timekeeping server actions or the device location (the preview runs on localhost where .env.local may point at production); each state renders its design-14 frame from fixtures; the page 404s in production;
// fails_when=a staff timekeeping component stops accepting an injected action or geolocation and falls back to the real one, the preview stops passing its overrides, a new staff-reachable server action is added without a stub, manager sections (which call unstubbed actions) start rendering in the preview, or the production guard is removed;
// why_new=step 12 adds a preview of the staff timekeeping screens whose every control writes time entries;
// seam=every timekeeping action module is mocked so any real call is observable; navigator.geolocation is replaced by a spy; AppShell is replaced by a marked wrapper around its children (the shell is not under test); next/navigation notFound throws a marker; no_claim=does not prove stubs cover controls added later or that /dev is unreachable in production at the proxy
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DevTimekeepingPage from "@/app/dev/timekeeping/page";
import { TimekeepingPreview, type TimekeepingPreviewState } from "@/app/dev/timekeeping/timekeeping-preview";
import * as attendanceExceptionActions from "@/features/timekeeping/attendance-exception-actions";
import * as timeEntryActions from "@/features/timekeeping/time-entry-actions";
import * as timekeepingActions from "@/features/timekeeping/timekeeping-actions";
import * as timekeepingAdminActions from "@/features/timekeeping/timekeeping-admin-actions";
import * as timekeepingAdjustmentActions from "@/features/timekeeping/timekeeping-adjustment-actions";
import * as weeklyScheduleActions from "@/features/timekeeping/weekly-schedule-actions";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/dev/timekeeping",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/features/timekeeping/time-entry-actions", () => ({
  checkInTimeEntryAction: vi.fn(),
  checkOutTimeEntryAction: vi.fn(),
  submitAttendanceHeartbeatAction: vi.fn(),
}));
vi.mock("@/features/timekeeping/attendance-exception-actions", () => ({
  decideAttendanceExceptionAction: vi.fn(),
  getAttendanceExceptionReviewsAction: vi.fn(),
  requestAttendanceExceptionAction: vi.fn(),
}));
vi.mock("@/features/timekeeping/timekeeping-adjustment-actions", () => ({
  decideTimeEntryAdjustmentAction: vi.fn(),
  requestTimeEntryAdjustmentAction: vi.fn(),
}));
vi.mock("@/features/timekeeping/timekeeping-admin-actions", () => ({
  adminAdjustTimeEntryAction: vi.fn(),
  adminCreateTimeEntryAction: vi.fn(),
  fetchCenterMonthlyOverviewAction: vi.fn(),
  fetchMyMonthlyTimesheetAction: vi.fn(),
  fetchStaffMonthlyTimesheetAction: vi.fn(),
}));
vi.mock("@/features/timekeeping/timekeeping-actions", () => ({
  createStaffShiftAssignmentAction: vi.fn(),
  createWorkShiftAction: vi.fn(),
  endStaffShiftAssignmentAction: vi.fn(),
  replaceStaffShiftAssignmentAction: vi.fn(),
  retireWorkShiftAction: vi.fn(),
  updateWorkShiftAction: vi.fn(),
}));
vi.mock("@/features/timekeeping/weekly-schedule-actions", () => ({
  saveWeeklyAssignmentAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
// Fixed so fixtures (relative dates, elapsed time) are deterministic: Thứ Hai 12/10/2026 16:58 in Vietnam.
const NOW = "2026-10-12T09:58:00.000Z";
// Every module the staff page reaches; the preview's overrides must cover each export.
const STAFF_ACTION_SOURCES = [
  "src/features/timekeeping/time-entry-actions.ts",
  "src/features/timekeeping/attendance-exception-actions.ts",
];

const geolocationSpy = {
  clearWatch: vi.fn(),
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
};
let originalGeolocation: PropertyDescriptor | undefined;

beforeEach(() => {
  originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: geolocationSpy });
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  if (originalGeolocation) {
    Object.defineProperty(navigator, "geolocation", originalGeolocation);
  } else {
    Reflect.deleteProperty(navigator, "geolocation");
  }
});

function expectNothingReal() {
  for (const actionsModule of [
    attendanceExceptionActions,
    timeEntryActions,
    timekeepingActions,
    timekeepingAdminActions,
    timekeepingAdjustmentActions,
    weeklyScheduleActions,
  ]) {
    for (const action of Object.values(actionsModule)) {
      expect(action).not.toHaveBeenCalled();
    }
  }
  for (const call of Object.values(geolocationSpy)) {
    expect(call).not.toHaveBeenCalled();
  }
  // A real success would refresh the route.
  expect(router.refresh).not.toHaveBeenCalled();
}

function renderPreview(state: TimekeepingPreviewState) {
  return render(<TimekeepingPreview now={NOW} state={state} />);
}

describe("/dev/timekeeping preview", () => {
  // Value: protects=the preview overrides keep covering every export of the staff-reachable "use server" modules, so a new check-in/exception action cannot reach production from /dev without a stub;
  // fails_when=time-entry-actions or attendance-exception-actions gains an exported action the overrides type does not name;
  // why_new=the mock keys above are this file's, not the modules'; seam=source scan of the real modules + the overrides type file; no_claim=does not prove every component passes the override
  it("names every staff-reachable timekeeping server action in the overrides", () => {
    const overrides = readFileSync(join(process.cwd(), "src/features/timekeeping/timekeeping-action-overrides.ts"), "utf8");
    const realActions = STAFF_ACTION_SOURCES.flatMap((file) =>
      Array.from(readFileSync(join(process.cwd(), file), "utf8").matchAll(/export async function (\w+)Action/g), (match) => match[1]),
    );
    expect(realActions.length).toBeGreaterThan(0);
    for (const name of realActions) {
      // checkInTimeEntryAction -> checkInTimeEntry?: typeof checkInTimeEntryAction
      expect(overrides).toContain(`${name}?: typeof ${name}Action;`);
    }
    // The two other actions the staff page reaches live in modules shared with managers.
    expect(overrides).toContain("requestTimeEntryAdjustment?: typeof requestTimeEntryAdjustmentAction;");
    expect(overrides).toContain("fetchMyMonthlyTimesheet?: typeof fetchMyMonthlyTimesheetAction;");
  });

  it("renders the teaching assistant's page only: no manager sections", () => {
    renderPreview("idle");
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Chấm công" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chấm công của tôi" })).toBeInTheDocument();
    // The clock is the device's (fixtures alone use NOW).
    expect(screen.getByText(/^Thứ .+, \d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}$|^Chủ Nhật, /)).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Hình thức chấm công" })).toBeInTheDocument();
    expect(screen.getByText(/trong bán kính 100 m quanh Cơ sở Cầu Giấy, sai số tối đa 50 m/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bảng công cá nhân theo tháng" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Điều chỉnh chấm công" })).toBeInTheDocument();
    // Manager sections call actions the preview does not stub.
    expect(screen.queryByText("Chấm công & Ca làm")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Danh mục ca làm" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phân công lịch" })).not.toBeInTheDocument();
    expectNothingReal();
  });

  it("checks in through stubs and the fake device location only", async () => {
    const user = userEvent.setup();
    renderPreview("idle");
    await user.click(screen.getByRole("button", { name: "Vào ca" }));
    const dialog = screen.getByRole("dialog", { name: "Xác nhận vào ca" });
    expect(await within(dialog).findByText(/sai số khoảng 12 m \(cho phép tối đa 50 m\)/, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Sai số lớn hơn mức cho phép/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận vào ca" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("shows the blocked check-in reasons from the fixtures (design 14e)", async () => {
    const user = userEvent.setup();
    renderPreview("blocked");
    await user.click(screen.getByRole("button", { name: "Vào ca" }));
    const dialog = screen.getByRole("dialog", { name: "Xác nhận vào ca" });
    expect(await within(dialog).findByText(/Sai số lớn hơn mức cho phép/, {}, { timeout: 2000 })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận vào ca" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Bạn đang ở ngoài khu vực Trung tâm.");

    await user.type(within(dialog).getByLabelText("Lý do cần duyệt"), "Đang ở phòng học tầng 3.");
    await user.click(within(dialog).getByRole("button", { name: "Gửi chấm công chờ duyệt" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("shows the open shift and checks out through a stub only (design 14b)", async () => {
    const user = userEvent.setup();
    renderPreview("open");
    expect(screen.getByText("Đang trong ca · Tại trung tâm")).toBeInTheDocument();
    expect(screen.getByText(/CC · Ca chiều 17:00–21:30/)).toBeInTheDocument();
    expect(screen.getByText("Đã ghi nhận vị trí lúc vào ca")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByText(/lương|đơn giá/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ra ca" }));
    const dialog = screen.getByRole("dialog", { name: "Xác nhận ra ca" });
    // The sheet locates on open (last mode: on site); wait for the fake device.
    expect(await within(dialog).findByText(/sai số khoảng 12 m/, {}, { timeout: 2000 })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận ra ca" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("shows the other card states", () => {
    const online = renderPreview("open-online");
    expect(screen.getByText("Đang trong ca · Trực tuyến")).toBeInTheDocument();
    expect(screen.getByText("Trực tuyến · theo ca được xếp")).toBeInTheDocument();
    online.unmount();

    const ended = renderPreview("ended");
    expect(screen.getByRole("button", { name: "Vào ca" })).toBeInTheDocument();
    expect(screen.getByText("Hôm nay đã có lượt chấm công. Nếu bạn có ca khác, vào ca mới.")).toBeInTheDocument();
    ended.unmount();

    const unconfigured = renderPreview("unconfigured");
    expect(screen.getByText(/Chưa cấu hình vị trí Trung tâm/)).toBeInTheDocument();
    unconfigured.unmount();

    renderPreview("wifi");
    expect(screen.getByText("Wi-Fi: nhập tên mạng Trung tâm đã đăng ký khi xác nhận.")).toBeInTheDocument();
    expectNothingReal();
  });

  it("sends an adjustment from a shift card and switches month through stubs only (design 14c/14d)", async () => {
    const user = userEvent.setup();
    renderPreview("idle");
    expect(await screen.findByText("Điện thoại báo sai vị trí trong phòng học tầng 3.", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Yêu cầu điều chỉnh · chờ duyệt")).toBeInTheDocument();
    expect(screen.getByText("Ca ngoài lịch")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Yêu cầu điều chỉnh ca / }));
    const sheet = screen.getByRole("dialog", { name: "Yêu cầu điều chỉnh công" });
    expect(within(sheet).getByText(/ghi nhận 19:12 → 22:30 \(tự động kết thúc\)/)).toBeInTheDocument();
    // The sheet focuses its first field on the next animation frame; typing before
    // that frame sends the rest of the reason to the select and leaves it empty.
    await waitFor(() => expect(within(sheet).getByLabelText("Lượt chấm công cần điều chỉnh")).toHaveFocus());
    await user.type(within(sheet).getByLabelText(/Lý do điều chỉnh/), "Quên ra ca, dạy tới 21:30.");
    await user.click(within(sheet).getByRole("button", { name: "Gửi yêu cầu" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(STUB);
    await user.click(within(sheet).getByRole("button", { name: "Hủy" }));

    await user.selectOptions(screen.getByLabelText("Chọn tháng"), "9");
    expect((await screen.findAllByText("Chưa có lượt chấm công nào trong Tháng 9/2026.")).length).toBeGreaterThan(0);
    expectNothingReal();
  });

  it("picks the state from the query and 404s in production", async () => {
    const page = async (params: Record<string, string | string[] | undefined>) =>
      (await DevTimekeepingPage({ searchParams: Promise.resolve(params) })) as ReactElement<{ state: string; now: string }>;

    expect((await page({})).props.state).toBe("idle");
    expect((await page({ state: "open" })).props.state).toBe("open");
    expect((await page({ state: ["blocked", "open"] })).props.state).toBe("blocked");
    expect((await page({ state: "nope" })).props.state).toBe("idle");
    expect(Number.isNaN(Date.parse((await page({})).props.now))).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    await expect(page({})).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
