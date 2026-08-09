import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";

describe("shared presentation states", () => {
  it("renders loading, empty, error, permission, and result feedback with accessible text", () => {
    const { rerender } = render(<LoadingState title="Đang tải học viên" />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải học viên");

    rerender(<EmptyState description="Chưa có học viên." title="Danh sách trống" />);
    expect(screen.getByRole("heading", { name: "Danh sách trống" })).toBeVisible();

    rerender(<ErrorState description="Không thể kết nối." title="Có lỗi" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Không thể kết nối.");

    rerender(<PermissionDeniedState description="Không đủ quyền." />);
    expect(screen.getByRole("heading", { name: "Bạn không có quyền truy cập" })).toBeVisible();

    rerender(<ResultBanner title="Xung đột dữ liệu" tone="conflict" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Xung đột dữ liệu");
  });

  it("keeps action and pending presentation separate from feature policy", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <>
        <EmptyState
          actionLabel="Thử lại"
          description="Chưa có dữ liệu."
          onAction={onAction}
          title="Danh sách trống"
        />
        <Button isLoading>Đang lưu</Button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Đang lưu" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Đang lưu" })).toBeDisabled();
  });
});
