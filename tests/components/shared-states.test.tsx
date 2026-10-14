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
  // Value: protects=the success tone of EmptyState (used for "Tất cả giao dịch đã khớp") paints its icon tile in the success family while the title still carries the meaning, and the default tone stays primary-soft;
  // fails_when=tone is ignored, success reuses the primary tile, or the default tone changes for existing empty states;
  // why_new=step 7 part 2 added the tone prop and only titles were asserted; seam=classes stand in for colour (jsdom has no CSS); no_claim=contrast of the success tokens
  it("paints the success tone on the icon tile and keeps the default tone primary", () => {
    const { container, rerender, unmount } = render(<EmptyState description="Không còn giao dịch." title="Tất cả giao dịch đã khớp" tone="success" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.firstElementChild).toHaveClass("bg-success-bg", "text-success");
    expect(root.firstElementChild).not.toHaveClass("bg-action-primary-soft");
    expect(screen.getByRole("heading", { name: "Tất cả giao dịch đã khớp" })).toBeVisible();

    rerender(<EmptyState description="Chưa có học viên." title="Danh sách trống" />);
    expect(root.firstElementChild).toHaveClass("bg-action-primary-soft", "text-action-primary");
    expect(root.firstElementChild).not.toHaveClass("bg-success-bg");
    unmount();
  });

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
