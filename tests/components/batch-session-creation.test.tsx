import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type BatchPreviewRow, getBatchDraftRowStatus } from "@/features/sessions/batch-preview-models";
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

// Same output; the spy counts how many "Chỉnh từng buổi" rows render (only a row calls it).
vi.mock("@/features/sessions/batch-preview-models", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/sessions/batch-preview-models")>();
  return { ...actual, getBatchDraftRowStatus: vi.fn(actual.getBatchDraftRowStatus) };
});

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

  function workspace(props: Partial<Parameters<typeof BatchSessionCreateWorkspace>[0]> = {}) {
    return (
      <BatchSessionCreateWorkspace
        classes={defaultClasses}
        existingSessionCount={0}
        existingSessions={[]}
        schedules={defaultSchedules}
        selectedClassId="cls-1"
        today={TODAY}
        {...props}
      />
    );
  }

  function renderWorkspace(props: Partial<Parameters<typeof BatchSessionCreateWorkspace>[0]> = {}) {
    return render(workspace(props));
  }

  const selection = () => screen.getByText(/Đã chọn:/);
  const chip = (date: string) => screen.getByLabelText(`Chọn buổi học ngày ${date}`) as HTMLInputElement;
  const disclosure = () => screen.getByText("Chỉnh từng buổi").closest("details")!;
  /** An 18:00–19:30 session the class already has (blocks a draft of that date at 18:00). */
  const existingAt = (sessionDate: string) => ({ endTime: "19:30:00", scheduleTemplateId: null, sessionDate, startTime: "18:00:00" });

  /** Opens "Chỉnh từng buổi" (its rows render only while open) and waits for the rows. */
  async function openEditor() {
    fireEvent.click(disclosure().querySelector("summary")!);
    await within(disclosure()).findAllByLabelText("Sửa giờ bắt đầu");
    return disclosure();
  }

  /** Runs a disabled button's own onClick, as a forced click would: React drops clicks on disabled buttons. */
  function forceClick(element: HTMLElement) {
    const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
    expect(propsKey).toBeDefined();
    const props = (element as unknown as Record<string, { onClick?: () => void }>)[propsKey!];
    expect(props.onClick).toBeTypeOf("function");
    act(() => props.onClick!());
  }

  async function confirmCreate(count: number) {
    fireEvent.click(screen.getByRole("button", { name: `Tạo hàng loạt (${count} buổi học)` }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận tạo" }));
    await waitFor(() => expect(mocks.createBatchSessionsAction).toHaveBeenCalledOnce());
    return mocks.createBatchSessionsAction.mock.calls[0][0] as { sessions: Array<{ sessionDate: string }> };
  }

  it("makes each chip the session's checkbox and keeps per-session edits in a closed disclosure", async () => {
    renderWorkspace();

    const chips = screen.getAllByLabelText(/Chọn buổi học ngày/);
    expect(chips).toHaveLength(10);
    expect(chips[0]).toHaveAttribute("aria-label", "Chọn buổi học ngày 19/10/2026");
    expect(chips[0].closest("label")).toHaveTextContent("T2 19/10");
    expect(chips[1].closest("label")).toHaveTextContent("T5 22/10");
    expect(chips.every((input) => (input as HTMLInputElement).checked)).toBe(true);

    expect(disclosure().open).toBe(false);
    // Closed: no editor row is rendered at all (P2); opening shows one row per draft, still without checkboxes.
    expect(within(disclosure()).queryAllByLabelText("Sửa giờ bắt đầu")).toHaveLength(0);
    const editor = await openEditor();
    expect(editor.open).toBe(true);
    expect(within(editor).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(editor).getAllByLabelText("Sửa giờ bắt đầu")).toHaveLength(10);
    expect(within(editor).getAllByLabelText("Sửa giờ kết thúc")).toHaveLength(10);
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
    // review C2-6: 44px targets below md (DESIGN), inline text from md.
    for (const name of ["Xem danh sách buổi học", "Mở lớp 10A1"]) {
      expect(screen.getByRole("link", { name }), name).toHaveClass("inline-flex", "min-h-11", "items-center", "md:min-h-0");
    }
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

    // The custom rule's pressed weekday toggles use the quick counts' tint, not the primary's solid fill (review P3-5).
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

  // Value (extension, ship audit of step 15a): protects=the per-session edits moved into the closed "Chỉnh từng buổi" disclosure still reach the request: edited start/end times and names are sent for their own date, a removed row disappears from the chips, the count and the request, and an edit survives a holiday added and removed on that date;
  // fails_when=BatchDraftEditor's inputs stop calling onUpdate (or update the wrong field/row), the delete button stops removing the draft, the chip grid and the editor drift apart, or a holiday toggle regenerates the drafts and wipes the edits;
  // why_new=the existing cases only count the editor's inputs; no test ever edited or removed a row, before or after the rewrite; seam=none (same mocks as above); no_claim=server-side validation of edited times (session-batch-schema/RPC) or the disclosure's visual open/close
  it("sends the per-session edits and removals of 'Chỉnh từng buổi', and keeps an edit across a holiday", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 9, message: "Đã tạo thành công 9 buổi học cho lớp 10A1.", status: "success" });
    renderWorkspace();

    const opened = await openEditor();
    const editor = () => within(opened);
    fireEvent.change(editor().getAllByLabelText("Sửa giờ bắt đầu")[0], { target: { value: "17:45" } });
    fireEvent.change(editor().getAllByLabelText("Sửa giờ kết thúc")[0], { target: { value: "19:15" } });
    fireEvent.change(editor().getAllByLabelText("Tên hoặc ghi chú buổi học")[1], { target: { value: "Ôn tập chương 1" } });
    fireEvent.click(editor().getByRole("button", { name: "Xóa buổi 26/10/2026 khỏi danh sách" }));

    expect(screen.queryByLabelText("Chọn buổi học ngày 26/10/2026")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/Chọn buổi học ngày/)).toHaveLength(9);
    expect(editor().getAllByLabelText("Sửa giờ bắt đầu")).toHaveLength(9);
    expect(selection()).toHaveTextContent("9 / 9 buổi");

    // A holiday on the edited date unticks it; removing the holiday brings it back with the edit.
    fireEvent.change(screen.getByLabelText("Ngày nghỉ (bỏ qua)"), { target: { value: "2026-10-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));
    expect(selection()).toHaveTextContent("8 / 9 buổi");
    fireEvent.click(screen.getByRole("button", { name: "Bỏ ngày nghỉ 22/10/2026" }));
    expect(chip("22/10/2026").checked).toBe(true);
    expect(editor().getAllByLabelText("Tên hoặc ghi chú buổi học")[1]).toHaveValue("Ôn tập chương 1");

    fireEvent.click(screen.getByRole("button", { name: "Tạo hàng loạt (9 buổi học)" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận tạo" }));
    await waitFor(() => expect(mocks.createBatchSessionsAction).toHaveBeenCalledOnce());
    const payload = mocks.createBatchSessionsAction.mock.calls[0][0] as {
      sessions: Array<{ endTime: string; notes: string | null; sessionDate: string; startTime: string }>;
    };
    expect(payload.sessions.map((session) => session.sessionDate)).toEqual([
      "2026-10-19",
      "2026-10-22",
      "2026-10-29",
      "2026-11-02",
      "2026-11-05",
      "2026-11-09",
      "2026-11-12",
      "2026-11-16",
      "2026-11-19",
    ]);
    expect(payload.sessions[0]).toMatchObject({ endTime: "19:15", sessionDate: "2026-10-19", startTime: "17:45" });
    expect(payload.sessions[1]).toMatchObject({ notes: "Ôn tập chương 1", sessionDate: "2026-10-22" });
    // Untouched rows keep the template's times.
    expect(payload.sessions[2].startTime).toMatch(/^18:00/);
  });

  // Value (extension, ship audit of step 15a): protects=while the create runs, the confirmation stays open and locked (confirm reads "Đang tạo…" and is disabled, "Xem lại" and Escape cannot close it, a second confirm sends nothing); a rejected request closes it and shows "Lỗi kết nối khi gửi yêu cầu tạo buổi học." as an alert without success links or a refresh, keeping the selection for a retry;
  // fails_when=the dialog can be dismissed or re-confirmed mid-request (double batch), the catch is dropped (a rejected request escapes the transition), a failure refreshes or shows success links, or the selection resets after a failure;
  // why_new=the existing cases resolve the action at once, so neither the pending dialog nor the thrown path (kept from main through the rewrite) is ever rendered; seam=none (same mocks as above; the action returns a promise the test rejects); no_claim=what the server does with a request it received before the connection dropped
  it("locks the confirmation while creating, then reports a failed connection without refreshing", async () => {
    let fail!: (error: Error) => void;
    mocks.createBatchSessionsAction.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Tạo hàng loạt (10 buổi học)" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận tạo" }));

    const confirming = await within(dialog).findByRole("button", { name: "Đang tạo…" });
    expect(confirming).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Xem lại" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(confirming);
    expect(mocks.createBatchSessionsAction).toHaveBeenCalledOnce();

    await act(async () => fail(new Error("network")));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const banner = screen.getByText("Lỗi kết nối khi gửi yêu cầu tạo buổi học.").closest('[role="alert"]');
    expect(banner).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Xem danh sách buổi học" })).not.toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(selection()).toHaveTextContent("10 / 10 buổi");
    expect(screen.getByRole("button", { name: "Tạo hàng loạt (10 buổi học)" })).toBeEnabled();
    expect(mocks.createBatchSessionsAction).toHaveBeenCalledOnce();
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

  // Value (extension, review M1 of step 15a; pre-existing bug on main): protects=under "Lịch lặp tùy chỉnh" the chosen Hình thức, Phòng học, Link phòng and Mã thành phần reach every drafted session and the request (the drafts regenerate whenever any input of the calculation changes, not only the inputs a hand-built key listed);
  // fails_when=the drafts resync on a signature that leaves out the custom mode/room/link/component code (the request keeps the class's default mode and no room);
  // why_new=no test changed these four custom fields before creating; seam=none (same mocks as above); no_claim=server validation of the URL or the room
  it("sends the custom rule's learning mode, room, link and component code on every session", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 10, message: "Đã tạo thành công 10 buổi học cho lớp 10A1.", status: "success" });
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Lịch lặp tùy chỉnh" }));
    fireEvent.change(screen.getByLabelText("Hình thức"), { target: { value: "online" } });
    fireEvent.change(screen.getByLabelText("Phòng học"), { target: { value: "P.301" } });
    fireEvent.change(screen.getByLabelText("Link phòng (ClassIn / Meet)"), { target: { value: "https://classin.example/10a1" } });
    fireEvent.change(screen.getByLabelText("Mã thành phần"), { target: { value: "ds" } });

    const payload = (await confirmCreate(10)) as unknown as {
      sessions: Array<{ componentCode: string | null; learningMode: string; meetingUrl: string | null; roomName: string | null; sessionKind: string }>;
    };
    expect(payload.sessions).toHaveLength(10);
    for (const session of payload.sessions) {
      expect(session).toMatchObject({
        componentCode: "DS",
        learningMode: "online",
        meetingUrl: "https://classin.example/10a1",
        roomName: "P.301",
        sessionKind: "additional",
      });
    }
  });

  // Value (extension, review R1 of step 15a): protects=a session the class already has is blocked like a holiday: its chip is disabled and reads "đã có (bỏ qua)", "Chọn tất cả" never ticks it, it is not counted in "{n} buổi sẽ tạo", the button or the cap and never sent; and the flag follows "Chỉnh từng buổi" edits with the server's rule (a start time moved onto an existing session blocks the draft, moving it away unblocks it);
  // fails_when=a duplicate can be ticked (also through "Chọn tất cả") and is counted in the selection while the summary also says it is skipped, or the duplicate flag stays the generation-time one after a time edit while the server checks the edited time;
  // why_new=the chip grid made duplicates tickable; nothing tied the flag to edited times; seam=none (same mocks as above); no_claim=duplicates beyond the newest 300 sessions (the server re-checks)
  it("blocks sessions the class already has, also after a time edit, and never counts or sends them", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 8, message: "Đã tạo thành công 8 buổi học cho lớp 10A1.", status: "success" });
    renderWorkspace({
      existingSessions: [
        // The Thursday template's 22/10 session, and an additional 17:00 session on Monday 26/10.
        { endTime: "19:30:00", scheduleTemplateId: "sch-2", sessionDate: "2026-10-22", startTime: "18:00:00" },
        { endTime: "18:30:00", scheduleTemplateId: null, sessionDate: "2026-10-26", startTime: "17:00:00" },
      ],
    });

    expect(chip("22/10/2026")).toBeDisabled();
    expect(chip("22/10/2026").checked).toBe(false);
    expect(chip("22/10/2026").closest("label")).toHaveTextContent("đã có (bỏ qua)");
    expect(chip("26/10/2026")).toBeEnabled();
    expect(selection()).toHaveTextContent("9 / 10 buổi");
    expect(screen.getByText(/buổi sẽ tạo/)).toHaveTextContent("9 buổi sẽ tạo · 0 ngày nghỉ bỏ qua · 1 trùng buổi đã có (bỏ qua)");

    fireEvent.click(screen.getByRole("button", { name: "Bỏ chọn tất cả" }));
    expect(selection()).toHaveTextContent("0 / 10 buổi");
    fireEvent.click(screen.getByRole("button", { name: "Chọn tất cả" }));
    expect(selection()).toHaveTextContent("9 / 10 buổi");
    expect(chip("22/10/2026").checked).toBe(false);

    // 26/10 is the third draft (19/10, 22/10, 26/10).
    const editor = await openEditor();
    const start26 = () => within(editor).getAllByLabelText("Sửa giờ bắt đầu")[2];
    fireEvent.change(start26(), { target: { value: "17:00" } });
    expect(chip("26/10/2026")).toBeDisabled();
    expect(chip("26/10/2026").closest("label")).toHaveTextContent("đã có (bỏ qua)");
    expect(selection()).toHaveTextContent("8 / 10 buổi");
    fireEvent.change(start26(), { target: { value: "17:15" } });
    expect(chip("26/10/2026").checked).toBe(true);
    expect(selection()).toHaveTextContent("9 / 10 buổi");
    fireEvent.change(start26(), { target: { value: "17:00" } });

    const payload = await confirmCreate(8);
    expect(payload.sessions.map((session) => session.sessionDate)).not.toContain("2026-10-22");
    expect(payload.sessions.map((session) => session.sessionDate)).not.toContain("2026-10-26");
    expect(payload.sessions).toHaveLength(8);
  });

  // Value (extension, review P2 of step 15a): protects="Chỉnh từng buổi" renders its rows only while open and a keystroke in one row re-renders that row only (rows are memoized on their draft, flag and tick), and closing it removes the rows again;
  // fails_when=the closed disclosure renders every row (hundreds of inputs on a long range), or the rows lose memo / the handlers become per-render closures (every keystroke re-renders every row);
  // why_new=no test counted renders; seam=getBatchDraftRowStatus is the spy (called once per row render); no_claim=wall-clock time
  it("renders the editor rows only while open, and a keystroke re-renders one row", async () => {
    const rowRenders = vi.mocked(getBatchDraftRowStatus);
    renderWorkspace();
    expect(rowRenders).not.toHaveBeenCalled();

    const editor = await openEditor();
    rowRenders.mockClear();
    fireEvent.change(within(editor).getAllByLabelText("Tên hoặc ghi chú buổi học")[3], { target: { value: "Ôn tập" } });
    expect(rowRenders.mock.calls.map(([row]) => (row as BatchPreviewRow).draft.sessionDate)).toEqual(["2026-10-29"]);

    fireEvent.click(editor.querySelector("summary")!);
    await waitFor(() => expect(within(disclosure()).queryAllByLabelText("Sửa giờ bắt đầu")).toHaveLength(0));
  });

  // Value (extension, review T3 of step 15a): protects="Bỏ chọn tất cả" / "Chọn tất cả" set every choosable session at once and leave a holiday alone: the counts follow, an empty selection disables the only primary with "Cần chọn ít nhất 1 buổi học để tạo.", and the holiday's draft keeps its own tick, so removing the holiday brings it back ticked;
  // fails_when=the toggle reaches a blocked draft (the holiday's tick is cleared or set), the counts or the toggle's wording drift, or an empty selection can be submitted;
  // why_new=the toggle was only clicked in the grid test with a mocked handler; seam=none (same mocks as above); no_claim=keyboard use of the toggle
  it("selects and clears every choosable session at once and leaves a holiday's own tick alone", () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Ngày nghỉ (bỏ qua)"), { target: { value: "2026-10-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));
    expect(selection()).toHaveTextContent("9 / 10 buổi");

    fireEvent.click(screen.getByRole("button", { name: "Bỏ chọn tất cả" }));
    expect(selection()).toHaveTextContent("0 / 10 buổi");
    expect(screen.getByText(/buổi sẽ tạo/)).toHaveTextContent("0 buổi sẽ tạo · 1 ngày nghỉ bỏ qua · 0 trùng buổi đã có (bỏ qua)");
    const primary = screen.getByRole("button", { name: "Tạo hàng loạt (0 buổi học)" });
    expect(primary).toBeDisabled();
    expect(primary).toHaveAccessibleDescription("Cần chọn ít nhất 1 buổi học để tạo.");
    expect(chip("22/10/2026")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Chọn tất cả" }));
    expect(selection()).toHaveTextContent("9 / 10 buổi");
    expect(screen.getByRole("button", { name: "Tạo hàng loạt (9 buổi học)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ chọn tất cả" }));
    expect(selection()).toHaveTextContent("0 / 10 buổi");

    // The holiday's draft was never touched by either toggle: it comes back ticked.
    fireEvent.click(screen.getByRole("button", { name: "Bỏ ngày nghỉ 22/10/2026" }));
    expect(chip("22/10/2026").checked).toBe(true);
    expect(selection()).toHaveTextContent("1 / 10 buổi");
    expect(screen.getByRole("button", { name: "Chọn tất cả" })).toBeInTheDocument();
  });

  // Value (extension, review T4 of step 15a): protects=without the route's `today` (a preview or another caller), the start date and the past flag fall back to the Vietnam business date, not the UTC date;
  // fails_when=the fallback goes back to formatUtcDate(new Date()) (18:30 UTC on 19/10 is already 20/10 in Vietnam);
  // why_new=every other case passes `today`; seam=only Date is faked; no_claim=the route's own value (batch-sessions-route.test.tsx)
  it("falls back to the Vietnam business date when no today is passed", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-19T18:30:00Z"));
      render(
        <BatchSessionCreateWorkspace
          classes={defaultClasses}
          existingSessionCount={0}
          existingSessions={[]}
          schedules={defaultSchedules}
          selectedClassId="cls-1"
        />,
      );
      expect((screen.getByLabelText("Bắt đầu từ ngày") as HTMLInputElement).value).toBe("2026-10-20");
      // Monday 19/10 is not generated; the first session is Thursday 22/10, not flagged past.
      expect(chip("22/10/2026").closest("label")).not.toHaveTextContent("đã qua");
      expect(screen.queryByLabelText("Chọn buổi học ngày 19/10/2026")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Value (extension, cycle-2 review RT2-1 of step 15a): protects=a router.refresh() (the student-care poll every 60 s, a revalidating server action) hands the workspace freshly deserialized classes/schedules/existing sessions of equal content, and the user's unticked chips, edited times and names and removed rows survive it, so "Xác nhận tạo" sends only what the user chose; a session that appears in the fresh existing list blocks its own draft ("đã có (bỏ qua)", badge "Đã có (bỏ qua)") while every other edit stays;
  // fails_when=the drafts resync on the identity of the props (or of anything derived from them) instead of the calculation's content, or existing sessions join the resync signature (a refresh after another create wipes the edits), or the duplicate flag stops following the fresh list;
  // why_new=cycle 2 found every refresh wiping the per-session choices; seam=rerender with structuredClone'd props (what a refresh's deserialization produces); no_claim=the refresh timer itself (student-care/refresh.tsx)
  it("keeps unticked chips, edits and removals when a refresh hands over equal props in new objects", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 8, message: "Đã tạo thành công 8 buổi học cho lớp 10A1.", status: "success" });
    const { rerender } = renderWorkspace();

    fireEvent.click(chip("29/10/2026"));
    const opened = await openEditor();
    fireEvent.change(within(opened).getAllByLabelText("Sửa giờ bắt đầu")[0], { target: { value: "17:45" } });
    fireEvent.change(within(opened).getAllByLabelText("Tên hoặc ghi chú buổi học")[1], { target: { value: "Ôn tập chương 1" } });
    fireEvent.click(within(opened).getByRole("button", { name: "Xóa buổi 26/10/2026 khỏi danh sách" }));
    expect(selection()).toHaveTextContent("8 / 9 buổi");

    rerender(
      workspace({
        classes: structuredClone(defaultClasses),
        existingSessions: structuredClone([]),
        schedules: structuredClone(defaultSchedules),
      }),
    );

    expect(chip("29/10/2026").checked).toBe(false);
    expect(screen.queryByLabelText("Chọn buổi học ngày 26/10/2026")).not.toBeInTheDocument();
    expect(selection()).toHaveTextContent("8 / 9 buổi");
    expect(within(disclosure()).getAllByLabelText("Sửa giờ bắt đầu")[0]).toHaveValue("17:45");
    expect(within(disclosure()).getAllByLabelText("Tên hoặc ghi chú buổi học")[1]).toHaveValue("Ôn tập chương 1");

    const payload = (await confirmCreate(8)) as unknown as { sessions: Array<{ notes: string | null; sessionDate: string; startTime: string }> };
    const dates = payload.sessions.map((session) => session.sessionDate);
    expect(dates).toHaveLength(8);
    expect(dates).not.toContain("2026-10-29");
    expect(dates).not.toContain("2026-10-26");
    expect(payload.sessions[0]).toMatchObject({ sessionDate: "2026-10-19", startTime: "17:45" });
    expect(payload.sessions[1]).toMatchObject({ notes: "Ôn tập chương 1", sessionDate: "2026-10-22" });
  });

  it("blocks a draft the refreshed existing sessions now hold, keeping every other edit", async () => {
    const { rerender } = renderWorkspace();

    fireEvent.click(chip("29/10/2026"));
    const opened = await openEditor();
    fireEvent.change(within(opened).getAllByLabelText("Tên hoặc ghi chú buổi học")[0], { target: { value: "Buổi mở đầu" } });
    expect(selection()).toHaveTextContent("9 / 10 buổi");

    // Someone (or this page's own create) added Thursday 22/10 at 18:00; the refresh brings it in.
    rerender(
      workspace({
        classes: structuredClone(defaultClasses),
        existingSessions: [{ endTime: "19:30:00", scheduleTemplateId: null, sessionDate: "2026-10-22", startTime: "18:00:00" }],
        schedules: structuredClone(defaultSchedules),
      }),
    );

    expect(chip("22/10/2026")).toBeDisabled();
    expect(chip("22/10/2026").checked).toBe(false);
    expect(chip("22/10/2026").closest("label")).toHaveTextContent("đã có (bỏ qua)");
    expect(chip("29/10/2026")).toBeEnabled();
    expect(chip("29/10/2026").checked).toBe(false);
    expect(selection()).toHaveTextContent("8 / 10 buổi");
    expect(screen.getByText(/buổi sẽ tạo/)).toHaveTextContent("8 buổi sẽ tạo · 0 ngày nghỉ bỏ qua · 1 trùng buổi đã có (bỏ qua)");
    expect(within(disclosure()).getAllByLabelText("Tên hoặc ghi chú buổi học")[0]).toHaveValue("Buổi mở đầu");
    // review C2-10: the editor's badge uses the chip's wording (rows: header, 19/10, 22/10).
    const row22 = within(disclosure()).getAllByRole("row")[2];
    expect(row22).toHaveTextContent("22/10/2026");
    expect(within(row22).getByText("Đã có (bỏ qua)")).toBeInTheDocument();
    expect(within(disclosure()).queryByText("Trùng lịch")).not.toBeInTheDocument();
  });

  // Value (extension, review D1/D5 of step 15a): protects=every control of the workspace is a 44px target below md and keeps its desktop size from md (back link, Hủy, the primary, Thêm, the quick counts, weekday toggles 40px from md, holiday remove, Chọn tất cả, the editor's inputs and delete, the dialog buttons, the result banner's Đóng), and paired fields stack in one column on phones (start/end time stay side by side);
  // fails_when=a control drops back to 32/36px on touch, a touch class replaces the desktop size, or a two-column row returns on phones;
  // why_new=no test checked target sizes; seam=class names (jsdom has no layout; Tailwind's max-md:/md: variants are media queries); no_claim=rendered pixel sizes
  it("gives every control a touch-size target below md and stacks paired fields on phones", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ message: "Không tạo được buổi học.", status: "error" });
    renderWorkspace();

    expect(screen.getByRole("link", { name: "Về danh sách buổi học" })).toHaveClass("max-md:h-11", "h-10");
    expect(screen.getByRole("link", { name: "Hủy" })).toHaveClass("max-md:h-11", "h-10");
    expect(screen.getByRole("button", { name: "Tạo hàng loạt (10 buổi học)" })).toHaveClass("max-md:h-11", "h-10");
    expect(screen.getByRole("button", { name: "Bỏ chọn tất cả" })).toHaveClass("max-md:h-11", "h-8");
    expect(screen.getByRole("button", { name: "Thêm" })).toHaveClass("max-md:h-11", "h-10");
    expect(screen.getByRole("button", { name: "5 buổi" })).toHaveClass("h-11", "md:h-8");

    fireEvent.change(screen.getByLabelText("Ngày nghỉ (bỏ qua)"), { target: { value: "2026-10-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));
    // review C2-8: at least 32px from md (it was 28px).
    expect(screen.getByRole("button", { name: "Bỏ ngày nghỉ 22/10/2026" })).toHaveClass("h-11", "w-11", "md:h-8", "md:w-8");
    expect(screen.getByRole("button", { name: "Bỏ ngày nghỉ 22/10/2026" })).not.toHaveClass("md:h-7");

    const editor = await openEditor();
    expect(within(editor).getAllByLabelText("Sửa giờ bắt đầu")[0]).toHaveClass("h-11", "md:h-9", "text-control");
    expect(within(editor).getAllByLabelText("Tên hoặc ghi chú buổi học")[0]).toHaveClass("h-11", "md:h-9");
    expect(within(editor).getByRole("button", { name: "Xóa buổi 19/10/2026 khỏi danh sách" })).toHaveClass("h-11", "w-11", "md:h-8", "md:w-8");

    // Mẫu tên / Số bắt đầu: one column on phones.
    const rowOf = (label: string) => screen.getByLabelText(label).parentElement!.parentElement!;
    expect(rowOf("Mẫu tên ({n})")).toHaveClass("sm:grid-cols-2");
    expect(rowOf("Mẫu tên ({n})")).not.toHaveClass("grid-cols-2");

    fireEvent.click(screen.getByRole("button", { name: "Lịch lặp tùy chỉnh" }));
    const monday = screen.getByRole("button", { name: "T2" });
    expect(monday).toHaveClass("h-11", "w-11", "md:h-10");
    expect(monday).not.toHaveClass("md:h-9");
    // review P3-5 (replaces C2-7's solid fill, reserved for the one primary): "on" is the quick counts' pressed
    // look, border + tint AND a heavier weight, never hue alone; aria-pressed stays.
    const pressed = ["border-action-primary", "bg-surface-selected", "text-action-primary", "font-semibold"];
    const tuesday = screen.getByRole("button", { name: "T3" });
    expect(screen.getByRole("button", { name: "10 buổi" })).toHaveClass(...pressed);
    expect(monday).toHaveAttribute("aria-pressed", "true");
    expect(monday).toHaveClass(...pressed);
    expect(monday).not.toHaveClass("bg-action-primary", "font-normal");
    expect(tuesday).toHaveAttribute("aria-pressed", "false");
    expect(tuesday).toHaveClass("border-border-strong", "bg-surface-base", "font-normal");
    expect(tuesday).not.toHaveClass("bg-surface-selected", "font-semibold");
    fireEvent.click(tuesday);
    expect(tuesday).toHaveAttribute("aria-pressed", "true");
    expect(tuesday).toHaveClass(...pressed);
    expect(tuesday).not.toHaveClass("bg-action-primary");
    for (const label of ["Hình thức", "Link phòng (ClassIn / Meet)"]) {
      expect(rowOf(label), label).toHaveClass("sm:grid-cols-2");
      expect(rowOf(label), label).not.toHaveClass("grid-cols-2");
    }
    // Start and end time stay side by side.
    expect(rowOf("Giờ bắt đầu")).toHaveClass("grid-cols-2");

    fireEvent.click(screen.getByRole("button", { name: /^Tạo hàng loạt \(\d+ buổi học\)$/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Xem lại" })).toHaveClass("max-md:h-11", "h-10");
    expect(within(dialog).getByRole("button", { name: "Xác nhận tạo" })).toHaveClass("max-md:h-11", "h-10");
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận tạo" }));
    expect(await screen.findByRole("button", { name: "Đóng" })).toHaveClass("max-md:h-11", "h-8");
  });

  // Value (extension, cycle-3 review P3-1/R3-5 of step 15a): protects=every draft starts ticked and only the rows block duplicates, so a session that was already a duplicate when the preview was calculated comes back ticked ("Sẽ tạo") once the conflict clears — its time edited off the existing session, or that session cancelled and dropped by a refresh — exactly like a draft that became a duplicate later;
  // fails_when=the drafts are calculated against the existing sessions again (a calc-time duplicate is stored unticked and stays "Bỏ chọn" after its conflict clears);
  // why_new=cycle 3 found the two paths disagreeing; seam=rerender with a shorter existingSessions list (a refresh after a cancellation); no_claim=the server's own duplicate skip (session-batch-actions.test.ts)
  it("ticks a session that was a duplicate at calculation once its conflict clears, by a time edit or a refresh", async () => {
    const existing = { endTime: "19:30:00", scheduleTemplateId: null, sessionDate: "2026-10-22", startTime: "18:00:00" };
    const { rerender } = renderWorkspace({ existingSessions: [existing] });
    expect(chip("22/10/2026")).toBeDisabled();
    expect(chip("22/10/2026").checked).toBe(false);

    // 22/10 is the second draft (rows: header, 19/10, 22/10); 18:15 is off the existing 18:00 session.
    const editor = await openEditor();
    const start22 = () => within(editor).getAllByLabelText("Sửa giờ bắt đầu")[1];
    fireEvent.change(start22(), { target: { value: "18:15" } });
    expect(chip("22/10/2026")).toBeEnabled();
    expect(chip("22/10/2026").checked).toBe(true);
    expect(within(within(editor).getAllByRole("row")[2]).getByText("Sẽ tạo")).toBeInTheDocument();

    // Back onto it, then the existing session is cancelled and the refresh no longer lists it.
    fireEvent.change(start22(), { target: { value: "18:00" } });
    expect(chip("22/10/2026")).toBeDisabled();
    rerender(workspace({ existingSessions: [] }));
    expect(chip("22/10/2026")).toBeEnabled();
    expect(chip("22/10/2026").checked).toBe(true);
    expect(selection()).toHaveTextContent("10 / 10 buổi");
  });

  // Value (extension, cycle-3 review P3-2/R3-2 and P3-3 of step 15a): protects=the route hands a new `today` on the first refresh after Vietnam midnight, or a template's effective window changes, and either keeps the user's ticks (neither is a calculation input; the rows re-flag past and out-of-window drafts), while the rows follow the new values and the start date stays;
  // fails_when=today or the templates' windows join the calculation signature again (the first poll after midnight, or a window edit, wipes every choice);
  // why_new=cycle 3 found the midnight wipe; seam=rerender with the next day's `today`, then with a later effectiveFrom; no_claim=the route's own date (batch-sessions-route.test.tsx)
  it("keeps the user's choices when the Vietnam date moves on or a template's window changes, and re-flags the rows", () => {
    const { rerender } = renderWorkspace();
    fireEvent.click(chip("29/10/2026"));
    expect(selection()).toHaveTextContent("9 / 10 buổi");

    rerender(workspace({ today: "2026-10-20" }));
    expect(chip("29/10/2026").checked).toBe(false);
    expect(selection()).toHaveTextContent("9 / 10 buổi");
    expect(chip("19/10/2026").closest("label")).toHaveTextContent("đã qua");
    expect((screen.getByLabelText("Bắt đầu từ ngày") as HTMLInputElement).value).toBe(TODAY);

    // The Thursday template now takes effect from 26/10: 22/10 is blocked, the rest stays as chosen.
    rerender(workspace({ schedules: [defaultSchedules[0], { ...defaultSchedules[1], effectiveFrom: "2026-10-26" }], today: "2026-10-20" }));
    expect(chip("22/10/2026")).toBeDisabled();
    expect(chip("22/10/2026").closest("label")).toHaveTextContent("ngoài hiệu lực");
    expect(chip("29/10/2026").checked).toBe(false);
    expect(selection()).toHaveTextContent("8 / 10 buổi");
  });

  // Value (extension, cycle-3 review P3-3/P3-4 of step 15a): protects=templates tied on (weekday, start time) are taken in id order, so the loader returning them in another order neither recalculates the drafts (the user's ticks stay) nor swaps which template gets which session number;
  // fails_when=the slots follow the loader's order (a refresh that reorders ties wipes the ticks and renumbers "Buổi 1"/"Buổi 2");
  // why_new=Postgres gives tied rows no fixed order; seam=rerender with the same templates reordered (cloned); no_claim=the loader's ORDER BY (batch-data.ts)
  it("numbers tied templates by id, so the loader's order neither resets nor renumbers the drafts", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 9, message: "Đã tạo thành công 9 buổi học cho lớp 10A1.", status: "success" });
    // A second Monday 18:00 template (another component), listed before sch-1.
    const tied = { ...defaultSchedules[0], componentCode: "HH", id: "sch-3", roomName: "Phòng 202" };
    const { rerender } = renderWorkspace({ schedules: [tied, defaultSchedules[1], defaultSchedules[0]] });
    fireEvent.click(chip("22/10/2026"));
    expect(selection()).toHaveTextContent("9 / 10 buổi");

    rerender(workspace({ schedules: structuredClone([defaultSchedules[0], defaultSchedules[1], tied]) }));
    expect(chip("22/10/2026").checked).toBe(false);
    expect(selection()).toHaveTextContent("9 / 10 buổi");

    const payload = (await confirmCreate(9)) as unknown as {
      sessions: Array<{ notes: string | null; scheduleTemplateId: string | null; sessionDate: string }>;
    };
    expect(payload.sessions.slice(0, 2)).toMatchObject([
      { notes: "Buổi 1", scheduleTemplateId: "sch-1", sessionDate: "2026-10-19" },
      { notes: "Buổi 2", scheduleTemplateId: "sch-3", sessionDate: "2026-10-19" },
    ]);
  });

  // Value (extension, cycle-3 review P3-8 of step 15a): protects=the content signature is not over-stable: a refresh bringing a template whose rule changed (Thursday now 18:30) recalculates the drafts (ticks reset) and the request carries the new time;
  // fails_when=the signature stops covering the templates' content (e.g. ids only), so stale drafts with the old time are sent;
  // why_new=the refresh tests only covered equal content; seam=rerender with a changed template; no_claim=how the template edit reached the database
  it("recalculates when a refresh brings a template whose rule changed", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 10, message: "Đã tạo thành công 10 buổi học cho lớp 10A1.", status: "success" });
    const { rerender } = renderWorkspace();
    fireEvent.click(chip("29/10/2026"));
    expect(selection()).toHaveTextContent("9 / 10 buổi");

    rerender(workspace({ schedules: [defaultSchedules[0], { ...defaultSchedules[1], startTime: "18:30:00" }] }));
    expect(chip("29/10/2026").checked).toBe(true);
    expect(selection()).toHaveTextContent("10 / 10 buổi");

    const payload = (await confirmCreate(10)) as unknown as { sessions: Array<{ sessionDate: string; startTime: string }> };
    expect(payload.sessions.find((session) => session.sessionDate === "2026-10-22")).toMatchObject({ startTime: "18:30" });
    expect(payload.sessions.find((session) => session.sessionDate === "2026-10-19")).toMatchObject({ startTime: "18:00" });
  });

  // Value (extension, cycle-3 review R3-4, reworked by cycle-4 A1 and cycle-6 of step 15a): protects=a "Số bắt đầu" the user typed wins over the mount count + 1: the drafts are renamed from it, and neither a background refresh's new count nor this page's own create and its refresh puts the counted number back; the request names the sessions from the typed number;
  // fails_when=the typed number is ignored, or a refresh / the create puts the count + 1 back over it;
  // why_new=cycle 6 restores main's rule (count + 1 read once at mount, a typed number wins) and splits it into this case and the two that follow; seam=rerender with a new existingSessionCount (a refresh); no_claim=the count query (batch-data.ts)
  it("keeps a 'Số bắt đầu' the user typed across refreshes and this page's own create", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 10, message: "Đã tạo thành công 10 buổi học cho lớp 10A1.", status: "success" });
    const { rerender } = renderWorkspace({ existingSessionCount: 10 });
    const startNumber = () => screen.getByLabelText("Số bắt đầu") as HTMLInputElement;
    expect(startNumber().value).toBe("11");
    const editor = await openEditor();
    expect(within(editor).getAllByLabelText("Tên hoặc ghi chú buổi học")[0]).toHaveValue("Buổi 11");

    fireEvent.change(startNumber(), { target: { value: "5" } });
    fireEvent.blur(startNumber());
    expect(startNumber().value).toBe("5");
    expect(within(editor).getAllByLabelText("Tên hoặc ghi chú buổi học")[0]).toHaveValue("Buổi 5");
    rerender(workspace({ existingSessionCount: 30 }));
    expect(startNumber().value).toBe("5");
    expect(within(editor).getAllByLabelText("Tên hoặc ghi chú buổi học")[0]).toHaveValue("Buổi 5");

    // This page's own create and its refresh leave the user's number alone too.
    const payload = (await confirmCreate(10)) as unknown as { sessions: Array<{ notes: string | null; sessionDate: string }> };
    expect(payload.sessions[0]).toMatchObject({ notes: "Buổi 5", sessionDate: "2026-10-19" });
    await screen.findByText("Đã tạo thành công 10 buổi học cho lớp 10A1.");
    rerender(workspace({ existingSessionCount: 40, existingSessions: payload.sessions.map((session) => existingAt(session.sessionDate)) }));
    expect(startNumber().value).toBe("5");
  });

  // Value (extension, cycle-6 of step 15a; main's rule restored): protects="Số bắt đầu" is the class's session count + 1 read ONCE at mount: a refresh bringing a larger count, a smaller one (a cancellation) or 0 (the loader's `count ?? 0` when the count query fails) leaves the number, the drafts' names and every choice (unticked chip, removed row, edited time) alone, while "Đã có … buổi" follows the fresh count;
  // fails_when=the start number follows the refreshed count (it is in the calculation signature: the drafts are recalculated, re-ticking, restoring and renumbering them, or jumping to "Buổi 1" on a failed count);
  // why_new=cycle 6 replaces cycle 5's "follows only a larger count after its own create" (AD4) with main's mount-time rule; seam=rerender with each count (what the refresh hands over); no_claim=the count query (batch-data.ts)
  it("keeps 'Số bắt đầu' at the mount count + 1 and every choice when a refresh brings a larger, smaller or zero count", async () => {
    const { rerender } = renderWorkspace({ existingSessionCount: 10 });
    const startNumber = () => screen.getByLabelText("Số bắt đầu") as HTMLInputElement;
    expect(startNumber().value).toBe("11");

    fireEvent.click(chip("29/10/2026"));
    const opened = await openEditor();
    fireEvent.change(within(opened).getAllByLabelText("Sửa giờ bắt đầu")[0], { target: { value: "17:45" } });
    fireEvent.click(within(opened).getByRole("button", { name: "Xóa buổi 26/10/2026 khỏi danh sách" }));
    expect(selection()).toHaveTextContent("8 / 9 buổi");

    for (const count of [20, 3, 0]) {
      rerender(workspace({ existingSessionCount: count }));
      expect(screen.getByText(`Đã có ${count} buổi`), String(count)).toBeInTheDocument();
      expect(startNumber().value, String(count)).toBe("11");
      expect(selection(), String(count)).toHaveTextContent("8 / 9 buổi");
      expect(chip("29/10/2026").checked, String(count)).toBe(false);
      expect(screen.queryByLabelText("Chọn buổi học ngày 26/10/2026"), String(count)).not.toBeInTheDocument();
      expect(within(disclosure()).getAllByLabelText("Sửa giờ bắt đầu")[0], String(count)).toHaveValue("17:45");
      expect(within(disclosure()).getAllByLabelText("Tên hoặc ghi chú buổi học")[0], String(count)).toHaveValue("Buổi 11");
    }
  });

  // Value (extension, cycle-4 review A1 of step 15a): protects=a refresh after a colleague creates a session of this class (on a date outside the batch) or cancels one changes the class's count but not "Số bắt đầu", so the drafts are not recalculated: the unticked chip, the removed row and the edited time and name stay, the open confirmation keeps its count, and "Xác nhận tạo" sends exactly the user's choice with the names numbered from the mount count;
  // fails_when="Số bắt đầu" follows the refreshed count again (it is in the calculation signature: the refresh re-ticks, restores and renumbers every draft and the open dialog's count jumps to 10 / 9);
  // why_new=cycle 4 found cycle 3's following start number wiping choices on a colleague's refresh; seam=rerender with a new existingSessionCount AND existingSessions (what the refresh hands over); no_claim=the refresh timer (student-care/refresh.tsx)
  it("keeps the start number and every choice, even under the open confirmation, when a refresh brings a colleague's created or cancelled session", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 8, message: "Đã tạo thành công 8 buổi học cho lớp 10A1.", status: "success" });
    const before = [existingAt("2026-10-15"), existingAt("2026-10-12")];
    const { rerender } = renderWorkspace({ existingSessionCount: 10, existingSessions: before });
    const startNumber = () => screen.getByLabelText("Số bắt đầu") as HTMLInputElement;
    expect(startNumber().value).toBe("11");

    fireEvent.click(chip("29/10/2026"));
    const opened = await openEditor();
    fireEvent.change(within(opened).getAllByLabelText("Sửa giờ bắt đầu")[0], { target: { value: "17:45" } });
    fireEvent.change(within(opened).getAllByLabelText("Tên hoặc ghi chú buổi học")[1], { target: { value: "Ôn tập chương 1" } });
    fireEvent.click(within(opened).getByRole("button", { name: "Xóa buổi 26/10/2026 khỏi danh sách" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo hàng loạt (8 buổi học)" }));

    function expectChoicesKept(count: number) {
      expect(screen.getByText(`Đã có ${count} buổi`)).toBeInTheDocument();
      expect(startNumber().value).toBe("11");
      expect(within(screen.getByRole("dialog")).getByRole("heading")).toHaveTextContent("Xác nhận tạo 8 buổi học");
      expect(selection()).toHaveTextContent("8 / 9 buổi");
      expect(chip("29/10/2026").checked).toBe(false);
      expect(screen.queryByLabelText("Chọn buổi học ngày 26/10/2026")).not.toBeInTheDocument();
      expect(within(disclosure()).getAllByLabelText("Sửa giờ bắt đầu")[0]).toHaveValue("17:45");
      expect(within(disclosure()).getAllByLabelText("Tên hoặc ghi chú buổi học")[1]).toHaveValue("Ôn tập chương 1");
    }
    expectChoicesKept(10);

    // A colleague creates a session on Friday 16/10 (outside this batch)…
    rerender(workspace({ existingSessionCount: 11, existingSessions: [existingAt("2026-10-16"), ...before] }));
    expectChoicesKept(11);
    // …and, separately, cancels the 12/10 one (the refresh no longer lists it).
    rerender(workspace({ existingSessionCount: 9, existingSessions: [before[0]] }));
    expectChoicesKept(9);

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận tạo" }));
    await waitFor(() => expect(mocks.createBatchSessionsAction).toHaveBeenCalledOnce());
    const payload = mocks.createBatchSessionsAction.mock.calls[0][0] as {
      sessions: Array<{ notes: string | null; sessionDate: string; startTime: string }>;
    };
    expect(payload.sessions).toHaveLength(8);
    expect(payload.sessions.slice(0, 3)).toMatchObject([
      { notes: "Buổi 11", sessionDate: "2026-10-19", startTime: "17:45" },
      { notes: "Ôn tập chương 1", sessionDate: "2026-10-22" },
      // 26/10 (Buổi 13) removed, 29/10 (Buổi 14) unticked.
      { notes: "Buổi 15", sessionDate: "2026-11-02" },
    ]);
  });

  // Value (extension, cycle-6 of step 15a; main's rule restored): protects=after this page's own successful create (its refresh landing before or after the result is handled) "Số bắt đầu" and the drafts stay as they were: the created sessions come back in the refreshed list and their rows read "đã có (bỏ qua)" (disabled, unticked), the row the user unticked stays unticked and the one removed stays gone, so nothing is offered again: "Tạo hàng loạt" reads 0 and is disabled with its reason; a later background refresh leaves the number alone too;
  // fails_when=the create (or its refresh) moves the start number on, recalculating the drafts (the unticked row comes back ticked and offered, the removed row returns, the names jump), or the created rows stop being blocked by the refreshed list;
  // why_new=cycle 6 removes cycle 4's recount after an own create (A1) and restores main's mount-time rule; seam=a deferred action and a rerender with the refreshed count and the created sessions; no_claim=Next's own refresh after the action (revalidatePath / router.refresh), the server's duplicate skip (session-batch-actions.test.ts)
  it.each(["after", "before"] as const)(
    "keeps 'Số bắt đầu' and the drafts after this page's own create (its refresh landing %s the result): created rows read 'đã có (bỏ qua)', unticked ones stay unticked",
    async (order) => {
      let succeed!: (result: unknown) => void;
      mocks.createBatchSessionsAction.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            succeed = resolve;
          }),
      );
      const { rerender } = renderWorkspace({ existingSessionCount: 10 });
      const startNumber = () => screen.getByLabelText("Số bắt đầu") as HTMLInputElement;
      expect(startNumber().value).toBe("11");

      fireEvent.click(chip("29/10/2026"));
      const opened = await openEditor();
      fireEvent.click(within(opened).getByRole("button", { name: "Xóa buổi 26/10/2026 khỏi danh sách" }));
      expect(selection()).toHaveTextContent("8 / 9 buổi");

      const payload = await confirmCreate(8);
      expect(payload.sessions).toHaveLength(8);
      // The create's refresh: 10 + the 8 created.
      const created = payload.sessions.map((session) => existingAt(session.sessionDate));
      const refresh = () => rerender(workspace({ existingSessionCount: 18, existingSessions: created }));
      if (order === "before") {
        refresh();
        expect(startNumber().value).toBe("11");
      }
      await act(async () =>
        succeed({ createdCount: 8, message: "Đã tạo thành công 8 buổi học cho lớp 10A1.", status: "success" }),
      );
      await screen.findByText("Đã tạo thành công 8 buổi học cho lớp 10A1.");
      if (order === "after") refresh();

      expect(screen.getByText("Đã có 18 buổi")).toBeInTheDocument();
      expect(startNumber().value).toBe("11");
      expect(within(disclosure()).getAllByLabelText("Tên hoặc ghi chú buổi học")[0]).toHaveValue("Buổi 11");
      for (const session of payload.sessions) {
        const [year, month, day] = session.sessionDate.split("-");
        const createdChip = chip(`${day}/${month}/${year}`);
        expect(createdChip, session.sessionDate).toBeDisabled();
        expect(createdChip.checked, session.sessionDate).toBe(false);
        expect(createdChip.closest("label"), session.sessionDate).toHaveTextContent("đã có (bỏ qua)");
      }
      expect(chip("29/10/2026")).toBeEnabled();
      expect(chip("29/10/2026").checked).toBe(false);
      expect(screen.queryByLabelText("Chọn buổi học ngày 26/10/2026")).not.toBeInTheDocument();
      expect(selection()).toHaveTextContent("0 / 9 buổi");
      const primary = screen.getByRole("button", { name: "Tạo hàng loạt (0 buổi học)" });
      expect(primary).toBeDisabled();
      expect(primary).toHaveAccessibleDescription("Cần chọn ít nhất 1 buổi học để tạo.");

      rerender(workspace({ existingSessionCount: 25, existingSessions: created }));
      expect(startNumber().value).toBe("11");
      expect(chip("29/10/2026").checked).toBe(false);
    },
  );

  // Value (extension, cycle-4 review A3 of step 15a): protects=a refresh under the open confirmation that leaves nothing to create (a colleague created this whole batch) disables "Xác nhận tạo" with the opener's own reason, "Cần chọn ít nhất 1 buổi học để tạo.", instead of a live button whose click silently does nothing;
  // fails_when="Xác nhận tạo" is disabled only while a create runs again;
  // why_new=cycle 4 found the silent no-op; seam=rerender with every draft in existingSessions; no_claim=the over-100 reason (same getBatchCreateBlockReason, covered on the opener)
  it("disables 'Xác nhận tạo' with the opener's reason when a refresh under the open confirmation leaves nothing to create", () => {
    const { rerender } = renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Tạo hàng loạt (10 buổi học)" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Xác nhận tạo" })).toBeEnabled();

    const batch = ["2026-10-19", "2026-10-22", "2026-10-26", "2026-10-29", "2026-11-02", "2026-11-05", "2026-11-09", "2026-11-12", "2026-11-16", "2026-11-19"];
    rerender(workspace({ existingSessionCount: 10, existingSessions: batch.map((date) => existingAt(date)) }));

    expect(within(dialog).getByRole("heading")).toHaveTextContent("Xác nhận tạo 0 buổi học");
    const confirm = within(dialog).getByRole("button", { name: "Xác nhận tạo" });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription("Cần chọn ít nhất 1 buổi học để tạo.");
  });

  // Value (extension, cycle-3 review R3-6 of step 15a): protects=after "Xác nhận tạo" the confirmation closes while its opener is still disabled (pending, or every session now exists), and focus lands on the result banner (a focusable wrapper with a visible focus ring), for success and error alike, never on <body>;
  // fails_when=the result is shown without moving focus (keyboard and screen-reader users are dropped at the top of the page);
  // why_new=cycle 3 found focus lost after a create; seam=the opener is focused first, as a keyboard user's would be; no_claim=the browser's :focus-visible heuristic
  it.each([
    ["success", { createdCount: 10, message: "Đã tạo thành công 10 buổi học cho lớp 10A1.", status: "success" }],
    ["error", { message: "Không tạo được buổi học.", status: "error" }],
  ] as const)("moves focus to the %s result once the confirmation closes", async (_tone, result) => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce(result);
    renderWorkspace();
    screen.getByRole("button", { name: "Tạo hàng loạt (10 buổi học)" }).focus();

    await confirmCreate(10);
    const wrapper = (await screen.findByText(result.message)).closest<HTMLElement>('[tabindex="-1"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass("focus-visible:outline-2", "focus-visible:outline-border-focus");
    await waitFor(() => expect(document.activeElement).toBe(wrapper));
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Value (extension, cycle-3 review R3-9 of step 15a): protects="Số buổi học cần tạo" and "Số bắt đầu" can be emptied while typing (a phone's backspace then "8" reads 8, not 18), the preview keeps the last valid number while the field is empty, and blurring an empty field commits 1;
  // fails_when=the fields clamp on every keystroke again (an emptied field snaps back to 1 and the next digit is appended to it);
  // why_new=cycle 3 found the fields uneditable on phones; seam=user-event types into the number inputs (clear, type, tab away); no_claim=the phone keyboard itself
  it("lets the count and the start number be emptied while typing, and commits 1 for an empty field on blur", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const count = screen.getByLabelText("Số buổi học cần tạo") as HTMLInputElement;

    await user.clear(count);
    expect(count.value).toBe("");
    expect(selection()).toHaveTextContent("10 / 10 buổi");
    await user.type(count, "8");
    expect(count.value).toBe("8");
    expect(selection()).toHaveTextContent("8 / 8 buổi");
    await user.clear(count);
    await user.tab();
    expect(count.value).toBe("1");
    expect(selection()).toHaveTextContent("1 / 1 buổi");

    const startNumber = screen.getByLabelText("Số bắt đầu") as HTMLInputElement;
    await user.clear(startNumber);
    expect(startNumber.value).toBe("");
    await user.type(startNumber, "8");
    expect(startNumber.value).toBe("8");
    const editor = await openEditor();
    expect(within(editor).getAllByLabelText("Tên hoặc ghi chú buổi học")[0]).toHaveValue("Buổi 8");
    await user.clear(startNumber);
    await user.tab();
    expect(startNumber.value).toBe("1");
    expect(within(editor).getAllByLabelText("Tên hoặc ghi chú buổi học")[0]).toHaveValue("Buổi 1");
  });

  // Value (extension, cycle-5 review AD1 of step 15a; pre-existing on main): protects=a ?classId= that is not one of the active classes the loader lists (a draft or closed class, an unknown id; the loader still reads that class's schedules, sessions and count) selects nothing instead of falling back to the first active class: the frame says "Lớp này không tạo buổi hàng loạt được", no rule, template, count or preview of that class is shown, "Tạo hàng loạt" is disabled with a visible reason, a forced create sends nothing, and the select shows a placeholder so picking any active class (the first one too) navigates to it;
  // fails_when=the workspace falls back to classes[0] again (a batch built from the named class's data is written to another class), the notice or the reason goes missing, a forced click reaches the action, or the select shows the first class as chosen (picking it changes nothing in a browser);
  // why_new=cycle 5 found the silent fallback; seam=forceClick runs the disabled buttons' own onClick (React drops clicks on disabled buttons); no_claim=the loader's active filter (batch-data.ts) or the route passing the requested id through (batch-sessions-route.test.tsx)
  it("refuses a class the active list does not hold: notice, nothing of it shown, create disabled with its reason, nothing sent even when forced", async () => {
    renderWorkspace({ existingSessionCount: 7, selectedClassId: "cls-draft" });

    const notice = screen.getByText("Lớp này không tạo buổi hàng loạt được").closest<HTMLElement>('[role="status"]');
    expect(notice).not.toBeNull();
    expect(notice).toHaveTextContent(
      "Lớp được chọn chưa kích hoạt, đã đóng hoặc không tồn tại. Chỉ lớp đang hoạt động mới tạo được buổi học hàng loạt: hãy chọn một lớp trong danh sách.",
    );
    for (const text of ["Phương thức sinh lịch", "Lịch học cố định đang có của lớp", "Đã có 7 buổi", "3. Bảng xem trước danh sách buổi học", "Chỉnh từng buổi"]) {
      expect(screen.queryByText(text), text).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Số bắt đầu")).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText(/Chọn buổi học ngày/)).toHaveLength(0);

    const primary = screen.getByRole("button", { name: /^Tạo hàng loạt/ });
    expect(primary).toBeDisabled();
    expect(primary).toHaveAccessibleDescription("Chọn một lớp đang hoạt động để tạo buổi học.");
    expect(screen.getByText("Chọn một lớp đang hoạt động để tạo buổi học.")).toBeVisible();
    forceClick(primary);
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận tạo" });
    expect(confirm).toBeDisabled();
    forceClick(confirm);
    await act(async () => {});
    expect(mocks.createBatchSessionsAction).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();

    // The select stays usable and shows no class as chosen, so the first active class can be picked too.
    const select = screen.getByLabelText(/Chọn lớp học áp dụng/) as HTMLSelectElement;
    expect(select).toBeEnabled();
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: "Chọn một lớp đang hoạt động" })).toBeDisabled();
    fireEvent.change(select, { target: { value: "cls-1" } });
    expect(mocks.replace).toHaveBeenCalledWith("/sessions/batch?classId=cls-1");
  });

  // Value (extension, cycle-5 review AD1 of step 15a): protects=a class closed while the page is open (the next refresh lists it no longer, the URL still names it) is refused under the open confirmation too: the notice shows and "Xác nhận tạo" is disabled with the reason, and a forced confirm sends nothing, instead of the drafts being rebuilt for the first active class and sent to it;
  // fails_when=the fallback to classes[0] returns (the open dialog would send the named class's templates to another class);
  // why_new=cycle 5 (AD1); seam=rerender with that class missing from `classes`, forceClick as above; no_claim=the refresh timer
  it("refuses under the open confirmation when a refresh no longer lists the class as active", async () => {
    const { rerender } = renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Tạo hàng loạt (10 buổi học)" }));
    const dialog = screen.getByRole("dialog");

    rerender(workspace({ classes: [defaultClasses[1]] }));
    expect(screen.getByText("Lớp này không tạo buổi hàng loạt được")).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Xác nhận tạo" });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription("Chọn một lớp đang hoạt động để tạo buổi học.");
    forceClick(confirm);
    await act(async () => {});
    expect(mocks.createBatchSessionsAction).not.toHaveBeenCalled();
  });

  // Value (extension, cycle-5 review AD1 of step 15a): protects=a page that names no class still works on the first active class, as before (the route itself passes the first class's id then);
  // fails_when=the AD1 refusal also catches an empty classId (no class is ever selected without a ?classId=);
  // why_new=AD1 changed the class lookup; seam=selectedClassId ""; no_claim=the route's own fallback (batch-sessions-route.test.tsx)
  it("works on the first active class when the page names none", async () => {
    mocks.createBatchSessionsAction.mockResolvedValueOnce({ createdCount: 10, message: "Đã tạo thành công 10 buổi học cho lớp 10A1.", status: "success" });
    renderWorkspace({ selectedClassId: "" });

    expect((screen.getByLabelText(/Chọn lớp học áp dụng/) as HTMLSelectElement).value).toBe("cls-1");
    expect(screen.queryByText("Lớp này không tạo buổi hàng loạt được")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Chọn một lớp đang hoạt động" })).not.toBeInTheDocument();
    expect(screen.getByText("Đã có 0 buổi")).toBeInTheDocument();
    const payload = (await confirmCreate(10)) as unknown as { classId: string; sessions: unknown[] };
    expect(payload.classId).toBe("cls-1");
    expect(payload.sessions).toHaveLength(10);
  });
});

