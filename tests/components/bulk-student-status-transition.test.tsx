import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BulkStatusTransitionDialog } from "@/features/students/components/bulk-status-transition-dialog";
import * as bulkActions from "@/features/students/bulk-status-actions";

vi.mock("@/features/students/bulk-status-actions", () => ({
  executeBulkStudentStatusTransitionAction: vi.fn(),
  previewBulkStudentStatusTransitionAction: vi.fn(),
}));

afterEach(cleanup);

describe("BulkStatusTransitionDialog UI & Workflow", () => {
  it("renders modal content when isOpen is true", () => {
    render(
      <BulkStatusTransitionDialog
        initialSourceStatus="interested"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText("Chuyển trạng thái học viên hàng loạt")
    ).toBeInTheDocument();
    expect(screen.getByText("Trạng thái hiện tại (Nguồn)")).toBeInTheDocument();
    expect(screen.getByText("Trạng thái đích (Chuyển sang)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview chuyển trạng thái" })
    ).toBeInTheDocument();
  });

  it("calls preview action and displays read-only count summary upon clicking Preview", async () => {
    vi.mocked(
      bulkActions.previewBulkStudentStatusTransitionAction
    ).mockResolvedValueOnce({
      data: {
        count: 42,
        sourceStatus: "interested",
      },
      ok: true,
    });

    render(
      <BulkStatusTransitionDialog
        initialSourceStatus="interested"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const previewBtn = screen.getByRole("button", {
      name: "Preview chuyển trạng thái",
    });
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Xác nhận chuyển 42 học sinh" })
      ).toBeInTheDocument();
    });
  });

  it("displays error message if preview action fails or returns permission error", async () => {
    vi.mocked(
      bulkActions.previewBulkStudentStatusTransitionAction
    ).mockResolvedValueOnce({
      code: "forbidden",
      message: "Bạn không có quyền chuyển trạng thái học viên (students.manage_status).",
      ok: false,
    });

    render(
      <BulkStatusTransitionDialog
        initialSourceStatus="interested"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const previewBtn = screen.getByRole("button", {
      name: "Preview chuyển trạng thái",
    });
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Bạn không có quyền chuyển trạng thái học viên/i)
      ).toBeInTheDocument();
    });
  });

  it("displays concurrency count mismatch error when execute RPC aborts", async () => {
    vi.mocked(
      bulkActions.previewBulkStudentStatusTransitionAction
    ).mockResolvedValueOnce({
      data: {
        count: 682,
        sourceStatus: "interested",
      },
      ok: true,
    });

    vi.mocked(
      bulkActions.executeBulkStudentStatusTransitionAction
    ).mockResolvedValueOnce({
      code: "rpc_failed",
      message: "Dữ liệu đã thay đổi kể từ lúc preview. Vui lòng thực hiện preview lại.",
      ok: false,
    });

    render(
      <BulkStatusTransitionDialog
        initialSourceStatus="interested"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // 1. Click Preview
    fireEvent.click(
      screen.getByRole("button", { name: "Preview chuyển trạng thái" })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Xác nhận chuyển 682 học sinh" })
      ).toBeInTheDocument();
    });

    // 2. Click Execute
    const confirmBtn = screen.getByRole("button", {
      name: "Xác nhận chuyển 682 học sinh",
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Dữ liệu đã thay đổi kể từ lúc preview/i)
      ).toBeInTheDocument();
    });
  });
});
