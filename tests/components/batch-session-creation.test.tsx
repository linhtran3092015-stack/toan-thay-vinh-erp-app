import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// Value (extension, step 15a — design 17b BatchPreviewGrid): protects=the chips ARE the per-session checkboxes (pinned label prefix, dd/mm/yyyy), the per-session edits sit in a closed "Chỉnh từng buổi" disclosure without a second checkbox column, the route's Vietnam `today` seeds the start date and the past flag, client holidays and out-of-window drafts are unticked, worded and never sent, more than 100 selected disables the only primary with the schema's reason, the created count shown is the server's message (never the requested count), learning modes read in Vietnamese, the kind of session is stated read-only, and the preview seams (actions, onClassChange) replace the real action and navigation;
// fails_when=a holiday/out-of-window session reaches createBatchSessionsAction, the cap stops disabling the primary, the banner echoes the requested count, a raw enum (offline) shows, the edits table regains checkboxes or opens by default, `today` is ignored for the UTC date, or an override still calls the real module / router;
// why_new=step 15a rewrites the workspace around BatchPreviewGrid (B1–B8); seam=same mocks as above (next/navigation useRouter, the actions module); no_claim=server-side dedupe or the RPC (session-batch-actions.test.ts), the route's key/today wiring (batch-sessions-route.test.tsx)
describe("BatchSessionCreateWorkspace — design 17b preview", () => {
  const TODAY = "2026-10-19"; // a Monday

  // A queued answer from a failed test must not leak into the next one.
  beforeEach(() => {
    mocks.createBatchSessionsAction.mockReset();
  });

  function renderWorkspace(props: Partial<Parameters<typeof BatchSessionCreateWorkspace>[0]> = {}) {
    return render(
      <BatchSessionCreateWorkspace
        classes={defaultClasses}
        existingSessionCount={0}
        existingSessions={[]}
        schedules={defaultSchedules}
        selectedClassId="cls-1"
        today={TODAY}
        {...props}
      />,
    );
  }

  const selection = () => screen.getByText(/Đã chọn:/);
  const chip = (date: string) => screen.getByLabelText(`Chọn buổi học ngày ${date}`) as HTMLInputElement;

  async function confirmCreate(count: number) {
    fireEvent.click(screen.getByRole("button", { name: `Tạo hàng loạt (${count} buổi học)` }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận tạo" }));
    await waitFor(() => expect(mocks.createBatchSessionsAction).toHaveBeenCalledOnce());
    return mocks.createBatchSessionsAction.mock.calls[0][0] as { sessions: Array<{ sessionDate: string }> };
  }

  it("makes each chip the session's checkbox and keeps per-session edits in a closed disclosure", () => {
    renderWorkspace();

    const chips = screen.getAllByLabelText(/Chọn buổi học ngày/);
    expect(chips).toHaveLength(10);
    expect(chips[0]).toHaveAttribute("aria-label", "Chọn buổi học ngày 19/10/2026");
    expect(chips[0].closest("label")).toHaveTextContent("T2 19/10");
    expect(chips[1].closest("label")).toHaveTextContent("T5 22/10");
    expect(chips.every((input) => (input as HTMLInputElement).checked)).toBe(true);

    const disclosure = screen.getByText("Chỉnh từng buổi").closest("details")!;
    expect(disclosure.open).toBe(false);
    expect(within(disclosure).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(disclosure).getAllByLabelText("Sửa giờ bắt đầu")).toHaveLength(10);
    expect(within(disclosure).getAllByLabelText("Sửa giờ kết thúc")).toHaveLength(10);
    expect(screen.getByText(/buổi sẽ tạo/)).toHaveTextContent("10 buổi sẽ tạo · 0 ngày nghỉ bỏ qua · 0 trùng buổi đã có (bỏ qua)");
    expect(screen.getByText("Kiểm tra trùng trên 300 buổi gần nhất của lớp; máy chủ kiểm tra lại khi tạo.")).toBeInTheDocument();
  });

  it("starts from the route's Vietnam date and flags earlier dates as past but keeps them selected", () => {
    renderWorkspace();
    const start = screen.getByLabelText("Bắt đầu từ ngày") as HTMLInputElement;
    expect(start.value).toBe(TODAY);

    fireEvent.change(start, { target: { value: "2026-10-12" } });
    expect(chip("12/10/2026").checked).toBe(true);
    expect(chip("12/10/2026").closest("label")).toHaveTextContent("đã qua");
    expect(selection()).toHaveTextContent("10 / 10 buổi");
  });

  it("unticks client holidays, says so on the chip and never sends them", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 9, message: "Đã tạo thành công 9 buổi học cho lớp 10A1.", status: "success" });
    renderWorkspace();

    const holidayInput = screen.getByLabelText("Ngày nghỉ (bỏ qua)");
    expect(holidayInput).toHaveAccessibleDescription("Chỉ dùng để bỏ chọn buổi trong lần tạo này; không lưu vào hệ thống.");
    fireEvent.change(holidayInput, { target: { value: "2026-10-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));

    expect(chip("22/10/2026")).toBeDisabled();
    expect(chip("22/10/2026").checked).toBe(false);
    expect(chip("22/10/2026").closest("label")).toHaveTextContent("nghỉ");
    expect(selection()).toHaveTextContent("9 / 10 buổi");
    expect(within(screen.getByRole("list", { name: "Ngày nghỉ đã thêm" })).getByRole("listitem")).toHaveTextContent("22/10/2026 · bỏ 1 buổi");

    // Removing the holiday restores the session; adding it again blocks it again.
    fireEvent.click(screen.getByRole("button", { name: "Bỏ ngày nghỉ 22/10/2026" }));
    expect(chip("22/10/2026").checked).toBe(true);
    fireEvent.change(holidayInput, { target: { value: "2026-10-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));

    const payload = await confirmCreate(9);
    expect(payload.sessions).toHaveLength(9);
    expect(payload.sessions.map((session) => session.sessionDate)).not.toContain("2026-10-22");
  });

  it("unticks sessions outside their template's effective window instead of letting the RPC abort", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 9, message: "Đã tạo thành công 9 buổi học cho lớp 10A1.", status: "success" });
    renderWorkspace({ schedules: [defaultSchedules[0], { ...defaultSchedules[1], effectiveFrom: "2026-10-26" }] });

    expect(chip("22/10/2026")).toBeDisabled();
    expect(chip("22/10/2026").closest("label")).toHaveTextContent("ngoài hiệu lực");
    expect(chip("29/10/2026")).toBeEnabled();
    expect(screen.getByText(/buổi sẽ tạo/)).toHaveTextContent("1 buổi ngoài thời gian hiệu lực của lịch (bỏ qua)");
    expect(screen.getByText(/hiệu lực từ 26\/10\/2026/)).toBeInTheDocument();

    const payload = await confirmCreate(9);
    expect(payload.sessions.map((session) => session.sessionDate)).not.toContain("2026-10-22");
  });

  it("disables the only primary above 100 sessions with the schema's reason", () => {
    renderWorkspace();
    fireEvent.click(screen.getByLabelText("Theo khoảng ngày"));
    fireEvent.change(screen.getByLabelText("Đến hết ngày"), { target: { value: "2027-10-18" } });

    expect(selection()).toHaveTextContent("105 / 105 buổi");
    const primary = screen.getByRole("button", { name: "Tạo hàng loạt (105 buổi học)" });
    expect(primary).toBeDisabled();
    expect(primary).toHaveAccessibleDescription("Mỗi đợt tạo tối đa 100 buổi học.");

    for (const input of screen.getAllByLabelText(/Chọn buổi học ngày/).slice(0, 5)) fireEvent.click(input);
    expect(screen.getByRole("button", { name: "Tạo hàng loạt (100 buổi học)" })).toBeEnabled();
  });

  it("shows the server's created count, never the requested one", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({
      createdCount: 7,
      message: "Đã tạo thành công 7 buổi học cho lớp 10A1 (đã tự động bỏ qua 3 buổi bị trùng).",
      status: "success",
    });
    renderWorkspace();

    const payload = await confirmCreate(10);
    expect(payload.sessions).toHaveLength(10);
    await waitFor(() => expect(screen.getByText("Đã tạo thành công 7 buổi học cho lớp 10A1 (đã tự động bỏ qua 3 buổi bị trùng).")).toBeInTheDocument());
    expect(screen.queryByText(/Đã tạo thành công 10/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem danh sách buổi học" })).toHaveAttribute("href", "/sessions");
    expect(screen.getByRole("link", { name: "Mở lớp 10A1" })).toHaveAttribute("href", "/classes/cls-1");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("reads learning modes and the session kind in words, with one primary on the page", () => {
    const { container } = renderWorkspace();

    expect(screen.queryByText(/\b(offline|online|hybrid)\b/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Tại lớp/).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Loại buổi:/)).toHaveTextContent("Loại buổi: Buổi chính (theo lịch cố định)");
    fireEvent.click(screen.getByRole("button", { name: "Lịch lặp tùy chỉnh" }));
    expect(screen.getByText(/^Loại buổi:/)).toHaveTextContent("Loại buổi: Buổi bổ sung (lịch lặp tùy chỉnh)");
    expect(screen.getByRole("option", { name: "Tại lớp" })).toBeInTheDocument();

    expect(container.querySelectorAll("button.bg-action-primary, a.bg-action-primary")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Về danh sách buổi học" })).toHaveAttribute("href", "/sessions");
    expect(screen.queryByText("ClassIn Batch Creator")).not.toBeInTheDocument();
  });

  it("keeps the directory query on its links and in the class switch", () => {
    renderWorkspace({ directoryQuery: "status=cancelled" });
    expect(screen.getByRole("link", { name: "Hủy" })).toHaveAttribute("href", "/sessions?status=cancelled");
    fireEvent.change(screen.getByLabelText(/Chọn lớp học áp dụng/), { target: { value: "cls-2" } });
    expect(mocks.replace).toHaveBeenCalledWith("/sessions/batch?classId=cls-2&status=cancelled");
  });

  it("uses the preview seams instead of the real action and navigation", async () => {
    const createBatchSessions = vi.fn().mockResolvedValue({ message: "Bản xem trước không ghi dữ liệu.", status: "error" });
    const onClassChange = vi.fn();
    renderWorkspace({ actions: { createBatchSessions }, onClassChange });

    fireEvent.change(screen.getByLabelText(/Chọn lớp học áp dụng/), { target: { value: "cls-2" } });
    expect(onClassChange).toHaveBeenCalledWith("cls-2");
    expect(mocks.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Tạo hàng loạt (10 buổi học)" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận tạo" }));
    await waitFor(() => expect(screen.getByText("Bản xem trước không ghi dữ liệu.")).toBeInTheDocument());
    expect(createBatchSessions).toHaveBeenCalledOnce();
    expect(mocks.createBatchSessionsAction).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

