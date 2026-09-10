import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BatchSessionCreateWorkspace } from "@/features/sessions/components/batch-session-create-workspace";

const mocks = vi.hoisted(() => ({
  createBatchSessionsAction: vi.fn(),
  checkBatchSessionConflictsAction: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/features/sessions/actions/session-batch-actions", () => ({
  createBatchSessionsAction: mocks.createBatchSessionsAction,
  checkBatchSessionConflictsAction: mocks.checkBatchSessionConflictsAction,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const defaultClasses = [
  {
    id: "cls-1",
    code: "10A1",
    name: "Toán Nâng Cao 10",
    grade: 10,
    level: "Nâng cao",
    defaultLearningMode: "offline" as const,
    academicYearId: "ay-1",
  },
  {
    id: "cls-2",
    code: "11A1",
    name: "Toán Cơ Bản 11",
    grade: 11,
    level: "Cơ bản",
    defaultLearningMode: "online" as const,
    academicYearId: "ay-1",
  },
];

const defaultSchedules = [
  {
    id: "sch-1",
    classId: "cls-1",
    weekday: 1, // Thứ Hai
    startTime: "18:00:00",
    endTime: "19:30:00",
    learningMode: "offline" as const,
    roomName: "Phòng 201",
    meetingUrl: null,
    componentCode: "DS",
    effectiveFrom: "2026-09-01",
    effectiveTo: null,
  },
  {
    id: "sch-2",
    classId: "cls-1",
    weekday: 4, // Thứ Năm
    startTime: "18:00:00",
    endTime: "19:30:00",
    learningMode: "offline" as const,
    roomName: "Phòng 201",
    meetingUrl: null,
    componentCode: "HH",
    effectiveFrom: "2026-09-01",
    effectiveTo: null,
  },
];

describe("BatchSessionCreateWorkspace", () => {
  it("renders workspace with class details and preview table", () => {
    render(
      <BatchSessionCreateWorkspace
        classes={defaultClasses}
        existingSessionCount={5}
        existingSessions={[]}
        schedules={defaultSchedules}
        selectedClassId="cls-1"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Tạo buổi học hàng loạt" })).toBeInTheDocument();
    expect(screen.getByText("10A1 — Toán Nâng Cao 10 (Khối 10)")).toBeInTheDocument();
    expect(screen.getByText("Đã có 5 buổi")).toBeInTheDocument();
    expect(screen.getByText("3. Bảng xem trước danh sách buổi học")).toBeInTheDocument();

    // Default count is 10, so 10 sessions generated
    expect(screen.getByText(/Đã chọn:/)).toHaveTextContent("10 / 10 buổi");
  });

  it("navigates to new classId when class selector changes", () => {
    render(
      <BatchSessionCreateWorkspace
        classes={defaultClasses}
        existingSessionCount={0}
        existingSessions={[]}
        schedules={defaultSchedules}
        selectedClassId="cls-1"
      />,
    );

    const select = screen.getByLabelText(/Chọn lớp học áp dụng/);
    fireEvent.change(select, { target: { value: "cls-2" } });

    expect(mocks.replace).toHaveBeenCalledWith("/sessions/batch?classId=cls-2");
  });

  it("allows deselecting a session before batch creation", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({
      status: "success",
      message: "Đã tạo thành công 9 buổi học cho lớp 10A1.",
      createdCount: 9,
      sessionIds: ["sess-1", "sess-2"],
    });

    render(
      <BatchSessionCreateWorkspace
        classes={defaultClasses}
        existingSessionCount={0}
        existingSessions={[]}
        schedules={defaultSchedules}
        selectedClassId="cls-1"
      />,
    );

    // Uncheck first session checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    // checkboxes[0] is template checkbox or select all, find row checkbox
    const rowCheckboxes = screen.getAllByLabelText(/Chọn buổi học ngày/);
    expect(rowCheckboxes.length).toBeGreaterThanOrEqual(10);

    // Uncheck the first row
    fireEvent.click(rowCheckboxes[0]);

    expect(screen.getByText(/Đã chọn:/)).toHaveTextContent("9 / 10 buổi");

    // Click submit button to open confirmation dialog
    const createButton = screen.getByRole("button", { name: /Tạo hàng loạt \(9 buổi học\)/ });
    fireEvent.click(createButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Xác nhận tạo 9 buổi học")).toBeInTheDocument();

    // Confirm creation
    const confirmButton = screen.getByRole("button", { name: "Xác nhận tạo" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mocks.createBatchSessionsAction).toHaveBeenCalledOnce();
    });

    const callPayload = mocks.createBatchSessionsAction.mock.calls[0][0];
    expect(callPayload.classId).toBe("cls-1");
    expect(callPayload.sessions).toHaveLength(9);

    await waitFor(() => {
      expect(screen.getByText("Đã tạo thành công 9 buổi học cho lớp 10A1.")).toBeInTheDocument();
    });
  });

  it("switches to custom recurrence mode and updates preview", () => {
    render(
      <BatchSessionCreateWorkspace
        classes={defaultClasses}
        existingSessionCount={0}
        existingSessions={[]}
        schedules={defaultSchedules}
        selectedClassId="cls-1"
      />,
    );

    // Click "Lịch lặp tùy chỉnh"
    const customButton = screen.getByRole("button", { name: "Lịch lặp tùy chỉnh" });
    fireEvent.click(customButton);

    expect(screen.getByText("Chọn các ngày học trong tuần")).toBeInTheDocument();
    expect(screen.getByLabelText("Giờ bắt đầu")).toBeInTheDocument();
    expect(screen.getByLabelText("Giờ kết thúc")).toBeInTheDocument();
  });
});
