import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionCreateForm } from "@/features/sessions/components/session-create-form";
import { SessionWorkspace } from "@/features/sessions/components/session-workspace";
const mocks = vi.hoisted(() => ({ createSessionAction: vi.fn(), startSessionAction: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/features/sessions/actions/session-lifecycle-actions", () => mocks);
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const props = { cancelledSessions: [], schedules: [], classes: [{ id: "class-1", code: "7A", name: "Toán 7", defaultLearningMode: "offline" as const, grade: 7, level: "A" }] };
const created = { status: "success", sessionId: "session-1", message: "Đã tạo buổi học." };

describe("Fast session entry", () => {
  it("creates and starts before opening attendance", async () => {
    mocks.createSessionAction.mockResolvedValueOnce(created);
    mocks.startSessionAction.mockResolvedValueOnce(created);
    render(<SessionCreateForm {...props} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Bắt đầu ngay/ }));
    fireEvent.submit(screen.getByRole("button", { name: "Tạo và vào điểm danh" }).closest("form")!);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/sessions/session-1"), { timeout: 4000 });
    expect(mocks.createSessionAction).toHaveBeenCalledOnce();
    expect(mocks.startSessionAction).toHaveBeenCalledWith({ sessionId: "session-1" });
  });
  it("retries starting the created session without creating a duplicate", async () => {
    mocks.createSessionAction.mockResolvedValueOnce(created);
    mocks.startSessionAction.mockResolvedValueOnce({ status: "error", message: "Chưa đến giờ học." }).mockResolvedValueOnce(created);
    render(<SessionCreateForm {...props} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Bắt đầu ngay/ }));
    fireEvent.submit(screen.getByRole("button", { name: "Tạo và vào điểm danh" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Buổi học đã được tạo nhưng chưa bắt đầu"), { timeout: 4000 });
    expect(mocks.push).not.toHaveBeenCalled();
    const retryButton = screen.getByRole("button", { name: "Thử bắt đầu lại" });
    await waitFor(() => expect(retryButton).not.toBeDisabled(), { timeout: 4000 });
    fireEvent.click(retryButton);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/sessions/session-1"), { timeout: 4000 });
    expect(mocks.createSessionAction).toHaveBeenCalledOnce();
    expect(mocks.startSessionAction).toHaveBeenCalledTimes(2);
  });
  it("keeps schedule-only creation available", async () => {
    mocks.createSessionAction.mockResolvedValueOnce(created);
    render(<SessionCreateForm {...props} />);
    fireEvent.submit(screen.getByRole("button", { name: "Tạo buổi học" }).closest("form")!);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/sessions/session-1"), { timeout: 4000 });
    expect(mocks.startSessionAction).not.toHaveBeenCalled();
  });
  it("keeps drafts when switching the beginning/end-of-session tabs", () => {
    render(<SessionWorkspace attendance={<input aria-label="Tìm đầu giờ" defaultValue="Ngọc" />} results={<input aria-label="Tìm cuối giờ" />} />);
    fireEvent.click(screen.getByRole("tab", { name: "Cuối giờ · Kết quả" }));
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Cuối giờ · Kết quả");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Cuối giờ · Kết quả" }), { key: "ArrowLeft" });
    expect(screen.getByRole("textbox", { name: "Tìm đầu giờ" })).toHaveValue("Ngọc");
  });
});
