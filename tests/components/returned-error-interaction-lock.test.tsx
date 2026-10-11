import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionLifecycleActions } from "@/features/sessions/components/session-lifecycle-actions";
import { TimekeepingAdjustmentDecisionDialog } from "@/features/timekeeping/components/timekeeping-adjustment-decision-dialog";
import { TimekeepingAdjustmentRequestDialog } from "@/features/timekeeping/components/timekeeping-adjustment-request-dialog";
import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";
import type {
  TimekeepingAdjustableEntry,
  TimekeepingAdjustmentApprovalQueueEntry,
} from "@/features/timekeeping/types";

const adjustmentActions = vi.hoisted(() => ({
  decideTimeEntryAdjustmentAction: vi.fn(),
  requestTimeEntryAdjustmentAction: vi.fn(),
}));
const entryActions = vi.hoisted(() => ({
  checkInTimeEntryAction: vi.fn(),
  checkOutTimeEntryAction: vi.fn(),
}));
const lifecycleActions = vi.hoisted(() => ({
  cancelSessionAction: vi.fn(),
  completeSessionAction: vi.fn(),
  startSessionAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useTransition: () => {
      const [isPending, setIsPending] = actual.useState(false);

      return [
        isPending,
        (action: () => void | Promise<void>) => {
          setIsPending(true);
          void action();
        },
      ] as const;
    },
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock(
  "@/features/timekeeping/timekeeping-adjustment-actions",
  () => adjustmentActions,
);
vi.mock("@/features/timekeeping/time-entry-actions", () => entryActions);
vi.mock(
  "@/features/sessions/actions/session-lifecycle-actions",
  () => lifecycleActions,
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

const adjustableEntry: TimekeepingAdjustableEntry = {
  adjustmentStatus: null,
  checkInAt: "2026-08-01T08:00:00+07:00",
  checkInMode: "offline",
  checkOutAt: "2026-08-01T17:00:00+07:00",
  checkOutMode: "offline",
  id: "entry-1",
  status: "checked_out",
  workDate: "2026-08-01",
  workShiftCode: "HS01",
  workShiftName: "Ca sáng",
};

const adjustmentRequest: TimekeepingAdjustmentApprovalQueueEntry = {
  createdAt: "2026-08-02T09:00:00+07:00",
  id: "request-1",
  originalCheckInAt: "2026-08-01T08:00:00+07:00",
  originalCheckInMode: "offline",
  originalCheckOutAt: "2026-08-01T17:00:00+07:00",
  originalCheckOutMode: "offline",
  requestReason: "Quên check-in sớm hơn",
  requestedCheckInAt: "2026-08-01T07:30:00+07:00",
  requestedCheckInMode: "offline",
  requestedCheckOutAt: "2026-08-01T17:00:00+07:00",
  requestedCheckOutMode: "offline",
  requesterDisplayName: "Nhân viên",
  requesterEmployeeCode: "NV001",
  requesterId: "staff-1",
  timeEntryId: "entry-1",
  workDate: "2026-08-01",
};

function lifecycleProps(
  overrides: Partial<ComponentProps<typeof SessionLifecycleActions>> = {},
) {
  return {
    classCode: "7A",
    lockedAt: null,
    sessionDate: "2026-08-10",
    sessionId: "session-1",
    status: "scheduled" as const,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("returned-error interaction locks", () => {
  it("allows Escape after a request error while the transition remains pending", async () => {
    adjustmentActions.requestTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: "Không thể gửi yêu cầu điều chỉnh.",
      status: "error",
    });

    render(<TimekeepingAdjustmentRequestDialog entries={[adjustableEntry]} />);
    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu điều chỉnh" }));
    fireEvent.change(screen.getByLabelText(/Lý do điều chỉnh/), {
      target: { value: "Quên check-in sớm hơn" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Không thể gửi yêu cầu điều chỉnh.",
      ),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Yêu cầu điều chỉnh công",
    });
    expect(screen.getByRole("button", { name: "Gửi yêu cầu" })).not.toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("allows backdrop dismissal after a decision error while the transition remains pending", async () => {
    adjustmentActions.decideTimeEntryAdjustmentAction.mockResolvedValueOnce({
      message: "Không thể xử lý yêu cầu điều chỉnh.",
      status: "error",
    });

    render(<TimekeepingAdjustmentDecisionDialog request={adjustmentRequest} />);
    fireEvent.click(screen.getByRole("button", { name: "Xử lý" }));
    fireEvent.click(screen.getByRole("button", { name: "Duyệt yêu cầu" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Không thể xử lý yêu cầu điều chỉnh.",
      ),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Xử lý yêu cầu điều chỉnh",
    });
    fireEvent.mouseDown(dialog.parentElement!);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("allows Cancel after an entry error while preserving independent GPS locking", async () => {
    entryActions.checkInTimeEntryAction.mockResolvedValueOnce({
      message: "Không thể ghi nhận vào ca.",
      status: "error",
    });

    render(<TimekeepingEntryDialog operation="check-in" />);
    fireEvent.click(screen.getByRole("button", { name: "Vào ca" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận vào ca" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Không thể ghi nhận vào ca.",
      ),
    );

    const dialog = screen.getByRole("dialog", { name: "Xác nhận vào ca" });
    expect(within(dialog).getByRole("button", { name: "Hủy" })).not.toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows lifecycle errors in the active Dialog and re-locks while retry is unresolved", async () => {
    const retry = deferred<{ message: string; status: "success" }>();
    lifecycleActions.startSessionAction
      .mockResolvedValueOnce({
        message: "Không thể bắt đầu buổi học.",
        status: "error",
      })
      .mockReturnValueOnce(retry.promise);

    render(<SessionLifecycleActions {...lifecycleProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu buổi học" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    const dialog = screen.getByRole("dialog", {
      name: "Xác nhận bắt đầu buổi học?",
    });
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Không thể bắt đầu buổi học.",
      ),
    );
    const confirm = within(dialog).getByRole("button", { name: "Xác nhận" });
    expect(confirm).not.toBeDisabled();

    fireEvent.click(confirm);

    await waitFor(() =>
      expect(lifecycleActions.startSessionAction).toHaveBeenCalledTimes(2),
    );
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Đang xử lý..." })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Quay lại" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Đang xử lý..." }));
    expect(lifecycleActions.startSessionAction).toHaveBeenCalledTimes(2);

    retry.resolve({ message: "Đã bắt đầu buổi học.", status: "success" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});
