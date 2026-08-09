import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AcademicYearStatusActions } from "@/features/classes/management/academic-year-management-actions";
import { ClassScheduleReplaceAction } from "@/features/classes/management/class-schedule-replace-action";
import type {
  AcademicYearManagementItem,
  ClassScheduleReadModel,
} from "@/features/classes/read-models";

const mocks = vi.hoisted(() => ({
  activateAcademicYearAction: vi.fn(),
  changeAcademicYearStatusAction: vi.fn(),
  replaceClassScheduleAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/features/classes/actions/class-schedule-actions", () => ({
  replaceClassScheduleAction: mocks.replaceClassScheduleAction,
}));

vi.mock("@/features/classes/actions/academic-year-actions", () => ({
  activateAcademicYearAction: mocks.activateAcademicYearAction,
  changeAcademicYearStatusAction: mocks.changeAcademicYearStatusAction,
  createAcademicYearAction: vi.fn(),
}));

const schedule: ClassScheduleReadModel = {
  componentCode: "MATH-01",
  effectiveFrom: "2020-01-01",
  effectiveTo: null,
  endReason: null,
  endTime: "18:30:00",
  id: "schedule-1",
  isActive: true,
  learningMode: "offline",
  meetingUrl: null,
  roomName: "Phòng 3",
  startTime: "17:00:00",
  weekday: 2,
};

const academicYear: AcademicYearManagementItem = {
  classCounts: { active: 0, archived: 0, closed: 0, draft: 0, total: 0 },
  code: "2026-2027",
  endsOn: "2027-05-31",
  id: "year-1",
  isCurrent: false,
  name: "Năm học 2026-2027",
  startsOn: "2026-08-01",
  status: "draft",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

const errorResult = {
  message: "Không thể hoàn tất thao tác.",
  status: "error" as const,
};

describe("Classes high-trust dialog presentation", () => {
  it("keeps a pending schedule replacement dialog open and prevents duplicate submission", async () => {
    const pending = deferred<typeof errorResult>();
    mocks.replaceClassScheduleAction.mockReturnValueOnce(pending.promise);
    render(<ClassScheduleReplaceAction schedule={schedule} />);

    const trigger = screen.getByRole("button", { name: "Thay đổi lịch" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Lý do thay đổi"), { target: { value: "Điều chỉnh khung giờ" } });

    const submit = screen.getByRole("button", { name: "Xác nhận thay đổi" });
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.replaceClassScheduleAction).toHaveBeenCalledOnce());
    await waitFor(() => expect(submit).toBeDisabled());

    const dialog = screen.getByRole("dialog", { name: "Thay đổi lịch học" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(submit);

    expect(screen.getByRole("dialog", { name: "Thay đổi lịch học" })).toBeInTheDocument();
    expect(mocks.replaceClassScheduleAction).toHaveBeenCalledOnce();

    pending.resolve(errorResult);
    await waitFor(() => expect(screen.getByRole("button", { name: "Hủy" })).not.toBeDisabled());
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Thay đổi lịch học" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("keeps a pending academic-year action open and restores focus after it can close", async () => {
    const pending = deferred<typeof errorResult>();
    mocks.activateAcademicYearAction.mockReturnValueOnce(pending.promise);
    render(<AcademicYearStatusActions academicYear={academicYear} />);

    const trigger = screen.getByRole("button", { name: "Kích hoạt" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Lý do thao tác"), { target: { value: "Mở năm học mới" } });

    const submit = screen.getByRole("button", { name: "Xác nhận kích hoạt" });
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.activateAcademicYearAction).toHaveBeenCalledOnce());
    await waitFor(() => expect(submit).toBeDisabled());

    const dialog = screen.getByRole("dialog", { name: "Kích hoạt năm học" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(submit);

    expect(screen.getByRole("dialog", { name: "Kích hoạt năm học" })).toBeInTheDocument();
    expect(mocks.activateAcademicYearAction).toHaveBeenCalledOnce();

    pending.resolve(errorResult);
    await waitFor(() => expect(screen.getByRole("button", { name: "Hủy" })).not.toBeDisabled());
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kích hoạt năm học" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
