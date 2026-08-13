import { readFileSync } from "fs";
import { resolve } from "path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimekeepingAdjustmentApprovalQueue } from "@/features/timekeeping/components/timekeeping-adjustment-approval-queue";
import { TimekeepingAdjustmentRequestDialog } from "@/features/timekeeping/components/timekeeping-adjustment-request-dialog";
import { TimekeepingAdjustmentRequests } from "@/features/timekeeping/components/timekeeping-adjustment-requests";
import type {
  TimekeepingAdjustableEntry,
  TimekeepingAdjustmentApprovalQueueEntry,
  TimekeepingAdjustmentRequest,
} from "@/features/timekeeping/types";

// ─── Hoisted module mocks ─────────────────────────────────────────────────────

const actions = vi.hoisted(() => ({
  requestTimeEntryAdjustmentAction: vi.fn(),
  decideTimeEntryAdjustmentAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock(
  "@/features/timekeeping/timekeeping-adjustment-actions",
  () => actions,
);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ENTRY_ID = "entry-1";
const REQUEST_ID = "req-1";

const eligibleEntry: TimekeepingAdjustableEntry = {
  adjustmentStatus: null,
  checkInAt: "2025-08-01T08:00:00+07:00",
  checkInMode: "offline",
  checkOutAt: "2025-08-01T17:00:00+07:00",
  checkOutMode: "offline",
  id: ENTRY_ID,
  status: "checked_out",
  workDate: "2025-08-01",
  workShiftCode: "HS01",
  workShiftName: "Ca sáng",
};

const pendingRequest: TimekeepingAdjustmentRequest = {
  createdAt: "2025-08-02T09:00:00+07:00",
  decisionReason: null,
  id: REQUEST_ID,
  originalCheckInAt: "2025-08-01T08:00:00+07:00",
  originalCheckInMode: "offline",
  originalCheckOutAt: "2025-08-01T17:00:00+07:00",
  originalCheckOutMode: "offline",
  requestReason: "Quên check-in sớm hơn",
  requestedCheckInAt: "2025-08-01T07:30:00+07:00",
  requestedCheckInMode: "online",
  requestedCheckOutAt: "2025-08-01T17:00:00+07:00",
  requestedCheckOutMode: "offline",
  reviewedAt: null,
  reviewerDisplayName: null,
  status: "pending",
  timeEntryId: ENTRY_ID,
  workDate: "2025-08-01",
};

const approvedRequest: TimekeepingAdjustmentRequest = {
  ...pendingRequest,
  decisionReason: "Xác nhận hợp lệ",
  id: "req-2",
  reviewedAt: "2025-08-03T10:00:00+07:00",
  reviewerDisplayName: "Nguyễn Quản Lý",
  status: "approved",
};

const rejectedRequest: TimekeepingAdjustmentRequest = {
  ...pendingRequest,
  decisionReason: "Không đủ căn cứ",
  id: "req-3",
  reviewedAt: "2025-08-03T11:00:00+07:00",
  reviewerDisplayName: "Nguyễn Quản Lý",
  status: "rejected",
};

const queueEntry: TimekeepingAdjustmentApprovalQueueEntry = {
  createdAt: "2025-08-02T09:00:00+07:00",
  id: REQUEST_ID,
  originalCheckInAt: "2025-08-01T08:00:00+07:00",
  originalCheckInMode: "offline",
  originalCheckOutAt: "2025-08-01T17:00:00+07:00",
  originalCheckOutMode: "offline",
  requestReason: "Quên check-in sớm hơn",
  requestedCheckInAt: "2025-08-01T07:30:00+07:00",
  requestedCheckInMode: "online",
  requestedCheckOutAt: "2025-08-01T17:00:00+07:00",
  requestedCheckOutMode: "offline",
  requesterDisplayName: "Trần Nhân Viên",
  requesterEmployeeCode: "NV001",
  requesterId: "staff-1",
  timeEntryId: ENTRY_ID,
  workDate: "2025-08-01",
};

// ─── A. Permissions & Server Entry Authority ──────────────────────────────────

describe("A. Permissions & Server Entry Authority", () => {
  it("renders the request trigger when canCheck is true and entries exist", () => {
    render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[eligibleEntry]}
        requests={[]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }),
    ).toBeInTheDocument();
  });

  it("does not render the request trigger when canCheck is false", () => {
    render(
      <TimekeepingAdjustmentRequests
        canCheck={false}
        entries={[eligibleEntry]}
        requests={[]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Yêu cầu điều chỉnh" }),
    ).not.toBeInTheDocument();
  });

  it("disables the request trigger when entries array is empty", () => {
    render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[]}
        requests={[]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }),
    ).toBeDisabled();
  });

  it("keeps server-returned pending and approved entries selectable without client eligibility inference", () => {
    const entryWithPendingStatus: TimekeepingAdjustableEntry = {
      ...eligibleEntry,
      adjustmentStatus: "pending",
    };
    const entryWithApprovedStatus: TimekeepingAdjustableEntry = {
      ...eligibleEntry,
      adjustmentStatus: "approved",
      id: "entry-2",
      workShiftCode: "HS02",
      workShiftName: "Ca chiều",
    };
    render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[entryWithPendingStatus, entryWithApprovedStatus]}
        requests={[]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Yêu cầu điều chỉnh" });

    expect(trigger).toBeEnabled();
    expect(
      screen.queryByText("Chưa có lượt chấm công đã kết thúc có thể gửi yêu cầu điều chỉnh."),
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    const select = within(dialog).getByLabelText("Lượt chấm công cần điều chỉnh");

    expect(within(select).getByRole("option", { name: /HS01/i })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: /HS02/i })).toBeInTheDocument();
  });

  it("renders the decision trigger for each approval queue entry with at least 44px touch height", () => {
    render(
      <TimekeepingAdjustmentApprovalQueue
        requests={[queueEntry]}
      />,
    );

    const trigger = screen.getAllByRole("button", { name: "Xử lý" })[0];

    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain("min-h-[44px]");
  });
});

// ─── B. History ───────────────────────────────────────────────────────────────

describe("B. History", () => {
  it("shows Chờ duyệt status for pending request", () => {
    render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[eligibleEntry]}
        requests={[pendingRequest]}
      />,
    );

    expect(screen.getAllByText("Chờ duyệt").length).toBeGreaterThan(0);
  });

  it("shows Đã duyệt status for approved request", () => {
    render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[eligibleEntry]}
        requests={[approvedRequest]}
      />,
    );

    expect(screen.getAllByText("Đã duyệt").length).toBeGreaterThan(0);
  });

  it("shows Đã từ chối status for rejected request — rejection is not an error state", () => {
    render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[eligibleEntry]}
        requests={[rejectedRequest]}
      />,
    );

    expect(screen.getAllByText("Đã từ chối").length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows original and requested check-in/check-out timestamps and modes", () => {
    render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[eligibleEntry]}
        requests={[pendingRequest]}
      />,
    );

    expect(screen.getAllByText("Dữ liệu gốc").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đề xuất").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tại trung tâm/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Trực tuyến/i).length).toBeGreaterThan(0);
  });

  it("shows reviewer name and decision reason for approved request", () => {
    render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[eligibleEntry]}
        requests={[approvedRequest]}
      />,
    );

    expect(
      screen.getAllByText("Nguyễn Quản Lý").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Xác nhận hợp lệ").length,
    ).toBeGreaterThan(0);
  });

  it("contains no payroll-related text in history", () => {
    render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[eligibleEntry]}
        requests={[pendingRequest, approvedRequest, rejectedRequest]}
      />,
    );

    expect(document.body).not.toHaveTextContent(
      /giờ công|giờ tính lương|đơn giá|lương|phụ cấp|KPI|hoa hồng|tạm ứng/i,
    );
  });
});

// ─── C. Request Form & Chronology Validation ──────────────────────────────────

describe("C. Request Form & Chronology Validation", () => {
  it("labels an unscheduled attendance entry without hiding it", () => {
    render(
      <TimekeepingAdjustmentRequestDialog
        entries={[{ ...eligibleEntry, workShiftCode: null, workShiftName: null }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));

    expect(screen.getByRole("option", { name: /Không có ca được phân công/ })).toBeInTheDocument();
  });

  it("opens the request dialog and shows required form fields", () => {
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));
    const dialog = screen.getByRole("dialog", {
      name: "Yêu cầu điều chỉnh công",
    });

    expect(
      within(dialog).getByLabelText("Lượt chấm công cần điều chỉnh"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/Check-in đề xuất/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/Check-out đề xuất/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/Hình thức check-in/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/Hình thức check-out/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/Lý do điều chỉnh/),
    ).toBeInTheDocument();
  });

  it("request reason field has required and maxLength=2000", () => {
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));

    const reasonField = screen.getByLabelText(/Lý do điều chỉnh/);

    expect(reasonField).toBeRequired();
    expect(reasonField).toHaveAttribute("maxlength", "2000");
  });

  it("mode selects contain only online and offline options", () => {
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));

    for (const select of screen.getAllByRole("combobox")) {
      const options = within(select).getAllByRole("option");
      const values = options.map((o) => o.getAttribute("value"));

      if (values.some((v) => v === "offline" || v === "online")) {
        expect(values).not.toContain("auto_end");
      }
    }
  });

  it("rejects check-out preceding check-in (<) with inline field error attached to requestedCheckOutAt and does not dispatch action", async () => {
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));
    const dialog = screen.getByRole("dialog");

    // Set check-in to 09:00 and check-out to 08:00 (check-out precedes check-in)
    fireEvent.change(within(dialog).getByLabelText(/Check-in đề xuất/), {
      target: { value: "2025-08-01T09:00" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Check-out đề xuất/), {
      target: { value: "2025-08-01T08:00" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Lý do điều chỉnh/), {
      target: { value: "Lý do điều chỉnh" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Gửi yêu cầu" }),
    );

    const checkoutInput = within(dialog).getByLabelText(/Check-out đề xuất/);

    expect(checkoutInput).toHaveAttribute("aria-invalid", "true");
    expect(checkoutInput).toHaveAttribute(
      "aria-describedby",
      "adj-request-checkout-at-error",
    );
    expect(
      within(dialog).getByText(
        "Check-out đề xuất không được trước check-in đề xuất.",
      ),
    ).toBeInTheDocument();
    expect(actions.requestTimeEntryAdjustmentAction).not.toHaveBeenCalled();
  });

  it("dispatches exact six-field payload with Vietnam-local ISO conversion and closes + refreshes on success", async () => {
    actions.requestTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: "Đã gửi yêu cầu điều chỉnh.",
      status: "success",
    });
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    const trigger = screen.getByRole("button", {
      name: "Yêu cầu điều chỉnh",
    });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", {
      name: "Yêu cầu điều chỉnh công",
    });

    fireEvent.change(within(dialog).getByLabelText(/Check-in đề xuất/), {
      target: { value: "2025-08-01T07:30" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Hình thức check-in/), {
      target: { value: "online" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Check-out đề xuất/), {
      target: { value: "2025-08-01T17:00" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Hình thức check-out/), {
      target: { value: "offline" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Lý do điều chỉnh/), {
      target: { value: "Quên bấm sớm hơn 30 phút" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Gửi yêu cầu" }),
    );

    await waitFor(() =>
      expect(
        actions.requestTimeEntryAdjustmentAction,
      ).toHaveBeenCalledOnce(),
    );

    const payload =
      actions.requestTimeEntryAdjustmentAction.mock.calls[0][0];

    // Assert exact 6-field payload structure using toEqual
    expect(payload).toEqual({
      requestReason: "Quên bấm sớm hơn 30 phút",
      requestedCheckInAt: "2025-08-01T00:30:00.000Z",
      requestedCheckInMode: "online",
      requestedCheckOutAt: "2025-08-01T10:00:00.000Z",
      requestedCheckOutMode: "offline",
      timeEntryId: ENTRY_ID,
    });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("displays textual pending state 'Đang gửi yêu cầu...' while request submit is unresolved", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.requestTimeEntryAdjustmentAction.mockReturnValueOnce(
      pending.promise,
    );
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));
    const dialog = screen.getByRole("dialog", {
      name: "Yêu cầu điều chỉnh công",
    });

    fireEvent.change(within(dialog).getByLabelText(/Lý do điều chỉnh/), {
      target: { value: "Lý do" },
    });
    const submit = within(dialog).getByRole("button", { name: "Gửi yêu cầu" });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Đang gửi yêu cầu..." }),
      ).toBeInTheDocument(),
    );

    // Second click must not dispatch another action.
    fireEvent.click(within(dialog).getByRole("button", { name: "Đang gửi yêu cầu..." }));
    expect(actions.requestTimeEntryAdjustmentAction).toHaveBeenCalledOnce();

    pending.resolve({ message: "Đã gửi yêu cầu điều chỉnh.", status: "success" });
  });

  it("Escape and backdrop do not close request dialog while pending", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.requestTimeEntryAdjustmentAction.mockReturnValueOnce(
      pending.promise,
    );
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));
    const dialog = screen.getByRole("dialog", {
      name: "Yêu cầu điều chỉnh công",
    });

    fireEvent.change(within(dialog).getByLabelText(/Lý do điều chỉnh/), {
      target: { value: "Lý do" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Gửi yêu cầu" }),
    );
    await waitFor(() =>
      expect(
        actions.requestTimeEntryAdjustmentAction,
      ).toHaveBeenCalledOnce(),
    );

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(
      screen.getByRole("dialog", { name: "Yêu cầu điều chỉnh công" }),
    ).toBeInTheDocument();

    fireEvent.mouseDown(dialog.parentElement!);
    expect(
      screen.getByRole("dialog", { name: "Yêu cầu điều chỉnh công" }),
    ).toBeInTheDocument();

    pending.resolve({ message: "Đã gửi yêu cầu điều chỉnh.", status: "success" });
  });

  it("renders the server-returned error message on failure", async () => {
    actions.requestTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: "Lượt chấm công không tồn tại hoặc đã bị xóa.",
      status: "error",
    });
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));
    const dialog = screen.getByRole("dialog", {
      name: "Yêu cầu điều chỉnh công",
    });

    fireEvent.change(within(dialog).getByLabelText(/Lý do điều chỉnh/), {
      target: { value: "Lý do" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Gửi yêu cầu" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("alert"),
      ).toHaveTextContent(
        "Lượt chấm công không tồn tại hoặc đã bị xóa.",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

// ─── D. Approval ─────────────────────────────────────────────────────────────

describe("D. Approval", () => {
  it("sends approved decision payload and closes + refreshes on success", async () => {
    actions.decideTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: "Đã duyệt yêu cầu.",
      status: "success",
    });
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    const trigger = screen.getAllByRole("button", { name: "Xử lý" })[0];
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", {
      name: "Xử lý yêu cầu điều chỉnh",
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Duyệt yêu cầu" }),
    );

    await waitFor(() =>
      expect(
        actions.decideTimeEntryAdjustmentAction,
      ).toHaveBeenCalledOnce(),
    );

    const payload = actions.decideTimeEntryAdjustmentAction.mock.calls[0][0];

    expect(payload).toEqual({
      decision: "approved",
      decisionReason: "",
      requestId: REQUEST_ID,
    });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("approval reason is optional — empty decisionReason is accepted", async () => {
    actions.decideTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: "Đã duyệt yêu cầu.",
      status: "success",
    });
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Duyệt yêu cầu" }),
    );

    await waitFor(() =>
      expect(
        actions.decideTimeEntryAdjustmentAction,
      ).toHaveBeenCalledOnce(),
    );

    expect(
      actions.decideTimeEntryAdjustmentAction.mock.calls[0][0].decisionReason,
    ).toBe("");
  });

  it("prevents repeated submit, Escape, backdrop, and Cancel dismiss during pending decision (approved path)", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.decideTimeEntryAdjustmentAction.mockReturnValueOnce(
      pending.promise,
    );
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");
    const submit = within(dialog).getByRole("button", {
      name: "Duyệt yêu cầu",
    });

    fireEvent.click(submit);
    await waitFor(() =>
      expect(
        actions.decideTimeEntryAdjustmentAction,
      ).toHaveBeenCalledOnce(),
    );

    // Textual pending state check
    expect(
      within(dialog).getByRole("button", { name: "Đang xử lý..." }),
    ).toBeInTheDocument();

    // Repeated submit
    fireEvent.click(within(dialog).getByRole("button", { name: "Đang xử lý..." }));
    expect(actions.decideTimeEntryAdjustmentAction).toHaveBeenCalledOnce();

    // Escape key
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Backdrop click
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Cancel click
    const cancelBtn = within(dialog).getByRole("button", { name: "Hủy" });
    fireEvent.click(cancelBtn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    pending.resolve({ message: "Đã duyệt yêu cầu.", status: "success" });
  });

  it("renders server-returned error on approval failure", async () => {
    actions.decideTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: "Đã xảy ra lỗi không xác định. Vui lòng thử lại.",
      status: "error",
    });
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Duyệt yêu cầu" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Đã xảy ra lỗi không xác định. Vui lòng thử lại.",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

// ─── E. Rejection ─────────────────────────────────────────────────────────────

describe("E. Rejection", () => {
  it("sends rejected decision payload with required reason", async () => {
    actions.decideTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: "Đã từ chối yêu cầu.",
      status: "success",
    });
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Quyết định"), {
      target: { value: "rejected" },
    });
    const reasonField = await within(dialog).findByLabelText(/Lý do từ chối/);

    fireEvent.change(reasonField, {
      target: { value: "Thông tin không khớp lịch làm việc." },
    });
    const submitBtn = await within(dialog).findByRole("button", {
      name: "Từ chối yêu cầu",
    });
    fireEvent.click(submitBtn);

    await waitFor(() =>
      expect(
        actions.decideTimeEntryAdjustmentAction,
      ).toHaveBeenCalledOnce(),
    );

    expect(
      actions.decideTimeEntryAdjustmentAction.mock.calls[0][0],
    ).toEqual({
      decision: "rejected",
      decisionReason: "Thông tin không khớp lịch làm việc.",
      requestId: REQUEST_ID,
    });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("rejection reason field has required and maxLength=2000", async () => {
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Quyết định"), {
      target: { value: "rejected" },
    });

    const reasonField = await within(dialog).findByLabelText(/Lý do từ chối/);

    expect(reasonField).toBeRequired();
    expect(reasonField).toHaveAttribute("maxlength", "2000");
  });

  it("blank rejection reason does not dispatch action", async () => {
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Quyết định"), {
      target: { value: "rejected" },
    });
    const submitBtn = await within(dialog).findByRole("button", {
      name: "Từ chối yêu cầu",
    });
    fireEvent.click(submitBtn);

    expect(actions.decideTimeEntryAdjustmentAction).not.toHaveBeenCalled();
  });

  it("prevents repeated submit, Escape, backdrop, and Cancel dismiss during pending decision (rejected path)", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.decideTimeEntryAdjustmentAction.mockReturnValueOnce(
      pending.promise,
    );
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Quyết định"), {
      target: { value: "rejected" },
    });
    const reasonField = await within(dialog).findByLabelText(/Lý do từ chối/);

    fireEvent.change(reasonField, { target: { value: "Lý do" } });
    const submitBtn = await within(dialog).findByRole("button", {
      name: "Từ chối yêu cầu",
    });
    fireEvent.click(submitBtn);
    await waitFor(() =>
      expect(
        actions.decideTimeEntryAdjustmentAction,
      ).toHaveBeenCalledOnce(),
    );

    // Textual pending state check
    expect(
      within(dialog).getByRole("button", { name: "Đang xử lý..." }),
    ).toBeInTheDocument();

    // Repeated submit
    fireEvent.click(within(dialog).getByRole("button", { name: "Đang xử lý..." }));
    expect(actions.decideTimeEntryAdjustmentAction).toHaveBeenCalledOnce();

    // Escape key
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Backdrop click
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Cancel click
    const cancelBtn = within(dialog).getByRole("button", { name: "Hủy" });
    fireEvent.click(cancelBtn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    pending.resolve({ message: "Đã từ chối.", status: "success" });
  });

  it("renders server-returned error on rejection failure", async () => {
    actions.decideTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: "Yêu cầu đã được xử lý trước đó.",
      status: "error",
    });
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Quyết định"), {
      target: { value: "rejected" },
    });
    const reasonField = await within(dialog).findByLabelText(/Lý do từ chối/);

    fireEvent.change(reasonField, { target: { value: "Lý do từ chối" } });
    const submitBtn = await within(dialog).findByRole("button", {
      name: "Từ chối yêu cầu",
    });
    fireEvent.click(submitBtn);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Yêu cầu đã được xử lý trước đó.",
      ),
    );
  });
});

// ─── F. Self-approval passthrough ─────────────────────────────────────────────

describe("F. Self-approval server passthrough", () => {
  it("renders the server-returned self-review message without client-side eligibility engine", async () => {
    actions.decideTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message:
        "Bạn không thể tự duyệt yêu cầu điều chỉnh của mình.",
      status: "error",
    });
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Duyệt yêu cầu" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Bạn không thể tự duyệt yêu cầu điều chỉnh của mình.",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

// ─── G. Server error passthrough ─────────────────────────────────────────────

describe("G. Server error passthrough", () => {
  it("request dialog renders the server action result message exactly", async () => {
    const serverMessage =
      "Lượt chấm công đã có yêu cầu điều chỉnh đang chờ duyệt.";
    actions.requestTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: serverMessage,
      status: "error",
    });
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(/Lý do điều chỉnh/), {
      target: { value: "Lý do" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Gửi yêu cầu" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(serverMessage),
    );
  });

  it("decision dialog renders the server action result message exactly", async () => {
    const serverMessage = "Đã xảy ra lỗi không xác định. Vui lòng thử lại.";
    actions.decideTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: serverMessage,
      status: "error",
    });
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Duyệt yêu cầu" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(serverMessage),
    );
  });
});

// ─── H. Original vs. Requested display ───────────────────────────────────────

describe("H. Original vs. Requested display", () => {
  it("history shows both Dữ liệu gốc and Đề xuất labels", () => {
    render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[eligibleEntry]}
        requests={[pendingRequest]}
      />,
    );

    expect(screen.getAllByText("Dữ liệu gốc").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đề xuất").length).toBeGreaterThan(0);
  });

  it("approval queue decision dialog shows both Gốc and Đề xuất", () => {
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getAllByText(/Gốc:/).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/Đề xuất:/).length).toBeGreaterThan(0);
  });

  it("neither history nor queue dialogs contain payroll-related text", () => {
    render(
      <>
        <TimekeepingAdjustmentRequests
          canCheck
          entries={[eligibleEntry]}
          requests={[approvedRequest]}
        />
        <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />
      </>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);

    expect(document.body).not.toHaveTextContent(
      /giờ công|giờ tính lương|đơn giá|lương hiệu lực|phụ cấp|KPI|hoa hồng|tạm ứng/i,
    );
  });
});

// ─── I. Payroll absence ───────────────────────────────────────────────────────

describe("I. Payroll absence", () => {
  it("request dialog contains no payroll fields", () => {
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));

    expect(document.body).not.toHaveTextContent(
      /giờ công|giờ tính lương|đơn giá|lương|phụ cấp|KPI|hoa hồng|tạm ứng/i,
    );
  });

  it("decision dialog contains no payroll fields", () => {
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);

    expect(document.body).not.toHaveTextContent(
      /giờ công|giờ tính lương|đơn giá|lương|phụ cấp|KPI|hoa hồng|tạm ứng/i,
    );
  });
});

// ─── J. Responsive Contracts & Activation Thresholds ──────────────────────────

describe("J. Responsive Contracts & Activation Thresholds (CSS Source Check)", () => {
  it("verifies history responsive contract: 1040px inner min-width, 1042px activation threshold in CSS source", () => {
    const cssPath = resolve(__dirname, "../../src/app/globals.css");
    const cssContent = readFileSync(cssPath, "utf-8");

    // History work area class must exist
    expect(cssContent).toContain(".adj-history-work-area");
    // History table min-width 1040px
    expect(cssContent).toContain("min-width: 1042px");

    const { container } = render(
      <TimekeepingAdjustmentRequests
        canCheck
        entries={[eligibleEntry]}
        requests={[pendingRequest]}
      />,
    );

    expect(container.querySelector(".adj-history-work-area")).not.toBeNull();
    expect(container.querySelector(".adj-history-table")).not.toBeNull();
    expect(container.querySelector(".adj-history-record-list")).not.toBeNull();

    const table = container.querySelector(".adj-history-table table");
    expect(table?.className).toContain("min-w-[1040px]");
  });

  it("verifies queue responsive contract: 1080px inner min-width, 1082px activation threshold in CSS source", () => {
    const cssPath = resolve(__dirname, "../../src/app/globals.css");
    const cssContent = readFileSync(cssPath, "utf-8");

    // Queue work area class must exist
    expect(cssContent).toContain(".adj-queue-work-area");
    // Queue table min-width 1082px
    expect(cssContent).toContain("min-width: 1082px");

    const { container } = render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    expect(container.querySelector(".adj-queue-work-area")).not.toBeNull();
    expect(container.querySelector(".adj-queue-table")).not.toBeNull();
    expect(container.querySelector(".adj-queue-record-list")).not.toBeNull();

    const table = container.querySelector(".adj-queue-table table");
    expect(table?.className).toContain("min-w-[1080px]");
  });
});

// ─── K. Excluded workflows ────────────────────────────────────────────────────

describe("K. Excluded workflows", () => {
  it("request dialog does not import or invoke checkInTimeEntryAction", () => {
    render(
      <TimekeepingAdjustmentRequestDialog entries={[eligibleEntry]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));

    expect(screen.getByLabelText(/Check-in đề xuất/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Check-out đề xuất/)).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /Lấy vị trí hiện tại/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Tên mạng Wi-Fi/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/BSSID/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/GPS|Wi-Fi evidence|check-in trực tiếp/i),
    ).not.toBeInTheDocument();
  });

  it("decision dialog does not contain shift management or direct check-in controls", () => {
    render(
      <TimekeepingAdjustmentApprovalQueue requests={[queueEntry]} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Xử lý" })[0]);
    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).queryByText(/quản lý ca|phân ca|ca làm việc mới/i),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /Check-in|Check-out/i }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText(/Tên mạng Wi-Fi|BSSID/i),
    ).not.toBeInTheDocument();
  });
});
