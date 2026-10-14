import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SystemSettingsForm } from "@/features/settings/system-settings-form";
import { SYSTEM_SETTING_DEFAULTS } from "@/features/settings/system-settings";

const actions = vi.hoisted(() => ({ updateSystemSettingsAction: vi.fn() }));
vi.mock("@/features/settings/actions", () => actions);

describe("SystemSettingsForm", () => {
  it("sends typed safe values and shows the server result", async () => {
    actions.updateSystemSettingsAction.mockResolvedValueOnce({ message: "Đã lưu cài đặt hệ thống.", status: "success" });
    const { unmount } = render(<SystemSettingsForm initialValues={SYSTEM_SETTING_DEFAULTS} />);
    fireEvent.change(screen.getByLabelText("Tên hiển thị trung tâm"), { target: { value: "Trung tâm QA" } });
    fireEvent.change(screen.getByLabelText("Thời hạn liên kết mặc định (ngày)"), { target: { value: "14" } });
    fireEvent.submit(screen.getByRole("button", { name: "Lưu cài đặt" }).closest("form")!);
    await waitFor(() => expect(actions.updateSystemSettingsAction).toHaveBeenCalledWith(expect.objectContaining({ defaultPublicLinkExpiryDays: 14, displayName: "Trung tâm QA" })));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu cài đặt hệ thống.");
    // The result shows before the save transition settles; let it finish and
    // unmount so no React work runs after jsdom is torn down ("window is not defined").
    await waitFor(() => expect(screen.queryByText("Đang lưu…")).not.toBeInTheDocument());
    unmount();
  });
});
