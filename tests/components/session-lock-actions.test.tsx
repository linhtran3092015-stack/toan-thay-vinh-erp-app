import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionLockActions } from "@/features/sessions/components/session-lock-actions";

const actions = vi.hoisted(() => ({ lockSessionAction: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/sessions/actions/session-result-actions", () => actions);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

function lockProps(
  overrides: Partial<ComponentProps<typeof SessionLockActions>> = {},
) {
  return {
    lockedAt: null,
    lockReason: null,
    sessionId: "session-1",
    sessionStatus: "completed" as const,
    ...overrides,
  };
}

describe("Session lock presentation", () => {
  it("keeps sessions.lock visibility at the existing Session detail permission boundary", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/features/sessions/session-detail-page.tsx"),
      "utf8",
    );

    expect(pageSource).toMatch(
      /\{canLockSession \? \(\s*<SessionLockActions/,
    );
  });

  it("exposes Lock for completed, unlocked sessions without client result or score readiness", () => {
    render(<SessionLockActions {...lockProps()} />);

    expect(screen.getByRole("button", { name: "Khóa buổi học" })).toBeInTheDocument();
    expect(screen.getByText(/Kết quả và điểm kiểm tra không phải là điều kiện khóa/)).toBeInTheDocument();
    expect(screen.queryByText(/Thiếu kết quả|Thiếu điểm kiểm tra|phải có điểm kiểm tra/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ghi nhận sổ cái|delta_sessions|0\.5/i)).not.toBeInTheDocument();
  });

  it("suppresses the lock action for a clearly ineligible lifecycle state", () => {
    render(<SessionLockActions {...lockProps({ sessionStatus: "in_progress" })} />);

    expect(screen.queryByRole("button", { name: "Khóa buổi học" })).not.toBeInTheDocument();
    expect(screen.getByText(/Chỉ buổi học đã hoàn thành mới có thể khóa dữ liệu/)).toBeInTheDocument();
  });

  it("keeps lifecycle separate from immutable locked state and removes editing controls", () => {
    render(
      <SessionLockActions
        {...lockProps({
          lockedAt: "2026-08-10T12:15:00Z",
          lockReason: "Đã đối soát điểm danh.",
        })}
      />,
    );

    expect(screen.getByText("Đã khóa")).toBeInTheDocument();
    expect(screen.getByText("Trạng thái buổi học: Đã hoàn thành")).toBeInTheDocument();
    expect(screen.getByText("Đã đối soát điểm danh.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Khóa|Xác nhận|Mở khóa|Đặt lại/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Lý do khóa")).not.toBeInTheDocument();
  });

  it("associates server reason validation with its explicit label", async () => {
    actions.lockSessionAction.mockResolvedValueOnce({
      fieldErrors: { reason: ["Lý do khóa phải có ít nhất 3 ký tự."] },
      message: "Vui lòng kiểm tra lại lý do khóa buổi học.",
      status: "error",
    });

    render(<SessionLockActions {...lockProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Khóa buổi học" }));
    const reason = screen.getByLabelText(/Lý do khóa/);
    fireEvent.change(reason, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận khóa" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng kiểm tra lại lý do khóa buổi học."));

    const reasonError = screen.getByText("Lý do khóa phải có ít nhất 3 ký tự.");
    const label = screen.getByText("Lý do khóa").closest("label");

    expect(label).toHaveAttribute("for", reason.id);
    expect(reason).toHaveAttribute("aria-describedby", expect.stringContaining(reasonError.id));
    expect(reasonError.closest("label")).toBeNull();
  });

  it("presents a server readiness rejection without creating a client blocker", async () => {
    actions.lockSessionAction.mockResolvedValueOnce({
      message: "Chưa điểm danh đầy đủ roster của buổi học.",
      status: "error",
    });

    render(<SessionLockActions {...lockProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Khóa buổi học" }));
    fireEvent.change(screen.getByLabelText(/Lý do khóa/), {
      target: { value: "Đã đối soát điểm danh." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận khóa" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Chưa điểm danh đầy đủ roster của buổi học."));
    expect(screen.getByRole("button", { name: "Xác nhận khóa" })).not.toBeDisabled();
  });

  it("allows Escape to dismiss immediately after a returned action error", async () => {
    actions.lockSessionAction.mockResolvedValueOnce({
      message: "Buổi học đã thay đổi trạng thái.",
      status: "error",
    });

    render(<SessionLockActions {...lockProps()} />);
    const trigger = screen.getByRole("button", { name: "Khóa buổi học" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText(/Lý do khóa/), {
      target: { value: "Đã đối soát điểm danh." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận khóa" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Buổi học đã thay đổi trạng thái."));

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Xác nhận khóa vĩnh viễn" }), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("allows backdrop and Cancel dismissal immediately after a returned action error", async () => {
    actions.lockSessionAction
      .mockResolvedValueOnce({
        message: "Buổi học đã thay đổi trạng thái.",
        status: "error",
      })
      .mockResolvedValueOnce({
        message: "Buổi học đã thay đổi trạng thái.",
        status: "error",
      });

    render(<SessionLockActions {...lockProps()} />);
    const trigger = screen.getByRole("button", { name: "Khóa buổi học" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText(/Lý do khóa/), {
      target: { value: "Đã đối soát điểm danh." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận khóa" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Buổi học đã thay đổi trạng thái."));
    const firstDialog = screen.getByRole("dialog", { name: "Xác nhận khóa vĩnh viễn" });
    fireEvent.mouseDown(firstDialog.parentElement!);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText(/Lý do khóa/), {
      target: { value: "Đã đối soát điểm danh." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận khóa" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Buổi học đã thay đổi trạng thái."));
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("restores focus to the lock trigger after an ordinary confirmation dismissal", async () => {
    render(<SessionLockActions {...lockProps()} />);
    const trigger = screen.getByRole("button", { name: "Khóa buổi học" });

    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Xác nhận khóa vĩnh viễn" }), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("keeps the confirmation open and submission singular while the server decision is pending", async () => {
    const pending = deferred<{ message: string; sessionId: string; status: "success" }>();
    actions.lockSessionAction.mockReturnValueOnce(pending.promise);

    render(<SessionLockActions {...lockProps()} />);
    const trigger = screen.getByRole("button", { name: "Khóa buổi học" });
    trigger.focus();
    fireEvent.click(trigger);
    const reason = screen.getByLabelText(/Lý do khóa/);
    fireEvent.change(reason, { target: { value: "Đã đối soát điểm danh." } });
    const submit = screen.getByRole("button", { name: "Xác nhận khóa" });
    fireEvent.click(submit);

    await waitFor(() => expect(actions.lockSessionAction).toHaveBeenCalledOnce());
    expect(submit).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quay lại" })).toBeDisabled();
    expect(screen.getByLabelText(/Lý do khóa/)).toBeDisabled();
    expect(screen.getByText("Đang khóa...")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "Xác nhận khóa vĩnh viễn" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    fireEvent.click(submit);

    expect(screen.getByRole("dialog", { name: "Xác nhận khóa vĩnh viễn" })).toBeInTheDocument();
    expect(actions.lockSessionAction).toHaveBeenCalledOnce();

    pending.resolve({
      message: "Đã khóa buổi học. Dữ liệu không thể thay đổi thêm.",
      sessionId: "session-1",
      status: "success",
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("retries after a returned error and locks interaction again until the retry resolves", async () => {
    const retry = deferred<{ message: string; sessionId: string; status: "success" }>();
    actions.lockSessionAction
      .mockResolvedValueOnce({
        message: "Buổi học đã thay đổi trạng thái.",
        status: "error",
      })
      .mockReturnValueOnce(retry.promise);

    render(<SessionLockActions {...lockProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Khóa buổi học" }));
    fireEvent.change(screen.getByLabelText(/Lý do khóa/), {
      target: { value: "Đã đối soát điểm danh." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận khóa" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Buổi học đã thay đổi trạng thái."));
    const retryButton = screen.getByRole("button", { name: "Xác nhận khóa" });
    expect(retryButton).not.toBeDisabled();
    fireEvent.click(retryButton);

    await waitFor(() => expect(actions.lockSessionAction).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang khóa..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quay lại" })).toBeDisabled();

    const dialog = screen.getByRole("dialog", { name: "Xác nhận khóa vĩnh viễn" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    fireEvent.click(screen.getByRole("button", { name: "Đang khóa..." }));

    expect(actions.lockSessionAction).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("dialog", { name: "Xác nhận khóa vĩnh viễn" })).toBeInTheDocument();

    retry.resolve({
      message: "Đã khóa buổi học. Dữ liệu không thể thay đổi thêm.",
      sessionId: "session-1",
      status: "success",
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});
