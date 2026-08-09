import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionLifecycleActions } from "@/features/sessions/components/session-lifecycle-actions";

const mocks = vi.hoisted(() => ({ startSessionAction: vi.fn(), completeSessionAction: vi.fn(), cancelSessionAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/sessions/actions/session-lifecycle-actions", () => mocks);
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((next) => { resolve = next; }); return { promise, resolve }; }
const errorResult = { message: "Không thể hoàn tất thao tác.", status: "error" as const };

describe("Session lifecycle dialog presentation", () => {
  it("keeps a pending start confirmation open and restores focus after it may close", async () => {
    const pending = deferred<typeof errorResult>(); mocks.startSessionAction.mockReturnValueOnce(pending.promise);
    render(<SessionLifecycleActions classCode="7A" lockedAt={null} sessionDate="2026-08-10" sessionId="session-1" status="scheduled" />);
    const trigger = screen.getByRole("button", { name: "Bắt đầu buổi học" }); fireEvent.click(trigger);
    const submit = screen.getByRole("button", { name: "Xác nhận" }); fireEvent.click(submit);
    await waitFor(() => expect(mocks.startSessionAction).toHaveBeenCalledOnce()); expect(submit).toBeDisabled();
    const dialog = screen.getByRole("dialog", { name: "Xác nhận bắt đầu buổi học?" }); fireEvent.keyDown(dialog, { key: "Escape" }); fireEvent.mouseDown(dialog.parentElement!); fireEvent.click(submit);
    expect(screen.getByRole("dialog", { name: "Xác nhận bắt đầu buổi học?" })).toBeInTheDocument(); expect(mocks.startSessionAction).toHaveBeenCalledOnce();
    pending.resolve(errorResult); await waitFor(() => expect(screen.getByRole("button", { name: "Quay lại" })).not.toBeDisabled()); fireEvent.keyDown(dialog, { key: "Escape" }); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(trigger).toHaveFocus();
  });

  it("requires a reason before presenting cancel confirmation submission", () => {
    render(<SessionLifecycleActions classCode="7A" lockedAt={null} sessionDate="2026-08-10" sessionId="session-1" status="scheduled" />);
    fireEvent.click(screen.getByRole("button", { name: "Hủy buổi học" }));
    expect(screen.getByRole("dialog", { name: "Xác nhận hủy buổi học" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xác nhận hủy" })).toBeDisabled();
  });

  it("presents Complete only for its existing in-progress state and keeps the pending confirmation safe", async () => {
    const pending = deferred<typeof errorResult>(); mocks.completeSessionAction.mockReturnValueOnce(pending.promise);
    render(<SessionLifecycleActions classCode="7A" lockedAt={null} sessionDate="2026-08-10" sessionId="session-1" status="in_progress" />);
    expect(screen.queryByRole("button", { name: "Bắt đầu buổi học" })).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Hoàn thành buổi học" }); fireEvent.click(trigger);
    expect(screen.getByText(/Điểm danh và kết quả vẫn có thể được bổ sung trước khi khóa/)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Xác nhận" }); fireEvent.click(submit);
    await waitFor(() => expect(mocks.completeSessionAction).toHaveBeenCalledOnce()); expect(submit).toBeDisabled();
    const dialog = screen.getByRole("dialog", { name: "Xác nhận hoàn thành buổi học?" }); fireEvent.keyDown(dialog, { key: "Escape" }); fireEvent.mouseDown(dialog.parentElement!); fireEvent.click(submit);
    expect(mocks.completeSessionAction).toHaveBeenCalledOnce();
    pending.resolve(errorResult); await waitFor(() => expect(screen.getByRole("button", { name: "Quay lại" })).not.toBeDisabled());
  });

  it("suppresses lifecycle controls for a locked session without changing its underlying status", () => {
    render(<SessionLifecycleActions classCode="7A" lockedAt="2026-08-11T00:00:00Z" sessionDate="2026-08-10" sessionId="session-1" status="in_progress" />);
    expect(screen.getByText(/Buổi học đã khóa/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bắt đầu buổi học|Hoàn thành buổi học|Hủy buổi học/ })).not.toBeInTheDocument();
  });
});
