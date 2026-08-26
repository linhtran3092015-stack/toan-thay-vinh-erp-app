import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffRateVersionDialog } from "@/features/staff/components/staff-rate-version-dialog";

const actions = vi.hoisted(() => ({ createStaffRateVersionAction: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("@/features/staff/staff-actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const staffId = "11111111-1111-4111-8111-111111111111";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Staff rate-version presentation", () => {
  it("keeps the mounted form fields required where required and leaves note optional", () => {
    render(<StaffRateVersionDialog staffId={staffId} />);

    fireEvent.click(screen.getByRole("button", { name: "Thêm mức lương ngày" }));

    expect(screen.getByRole("dialog", { name: "Thêm mức lương ngày" })).toBeInTheDocument();
    expect(screen.getByLabelText("Hiệu lực từ")).toBeRequired();
    expect(screen.getByLabelText("Lương ngày offline 9 giờ (VND)")).toBeRequired();
    expect(screen.getByLabelText("Lý do thêm phiên bản")).toBeRequired();
    expect(screen.getByLabelText("Ghi chú")).not.toBeRequired();
    expect(screen.getByLabelText("Ghi chú")).toHaveAttribute("maxlength", "1000");
    expect(screen.getByLabelText("Lý do thêm phiên bản")).toHaveAttribute("maxlength", "2000");
    const offlineRate = screen.getByLabelText("Lương ngày offline 9 giờ (VND)");
    expect(offlineRate).toHaveAttribute("step", "1");

    fireEvent.click(screen.getByRole("button", { name: "Lưu mức lương ngày" }));
    expect(actions.createStaffRateVersionAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Hiệu lực từ"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Lý do thêm phiên bản"), { target: { value: "Bổ sung phiên bản mới." } });
    fireEvent.change(offlineRate, { target: { value: "-2" } });
    expect(offlineRate).toBeInvalid();
    fireEvent.click(screen.getByRole("button", { name: "Lưu mức lương ngày" }));
    expect(actions.createStaffRateVersionAction).not.toHaveBeenCalled();

    fireEvent.change(offlineRate, { target: { value: "10000.5" } });
    expect(offlineRate).toBeInvalid();
    fireEvent.click(screen.getByRole("button", { name: "Lưu mức lương ngày" }));
    expect(actions.createStaffRateVersionAction).not.toHaveBeenCalled();
  });

  it("preserves the offline-only payload, preview, server error association, and pending-safe Dialog behavior", async () => {
    const pending = deferred<{
      fieldErrors: { effectiveFrom: string[] };
      message: string;
      status: "error";
    }>();
    actions.createStaffRateVersionAction.mockReturnValueOnce(pending.promise);
    render(<StaffRateVersionDialog staffId={staffId} />);

    const trigger = screen.getByRole("button", { name: "Thêm mức lương ngày" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Thêm mức lương ngày" });
    await waitFor(() => expect(screen.getByLabelText("Hiệu lực từ")).toHaveFocus());

    fireEvent.change(screen.getByLabelText("Hiệu lực từ"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Lương ngày offline 9 giờ (VND)"), { target: { value: "120000" } });
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Áp dụng kỳ mới" } });
    fireEvent.change(screen.getByLabelText("Lý do thêm phiên bản"), { target: { value: "Điều chỉnh đơn giá theo chính sách." } });
    expect(screen.getByText(/60\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/thu nhập|gross|net/i)).not.toBeInTheDocument();

    const submit = within(dialog).getByRole("button", { name: "Lưu mức lương ngày" });
    fireEvent.click(submit);

    await waitFor(() => expect(actions.createStaffRateVersionAction).toHaveBeenCalledWith({
      effectiveFrom: "2026-09-01",
      note: "Áp dụng kỳ mới",
      offlineDailyRateVnd: 120_000,
      reason: "Điều chỉnh đơn giá theo chính sách.",
      staffId,
    }));
    expect(submit).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    expect(dialog).toHaveTextContent("Đang lưu...");

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(submit);
    expect(screen.getByRole("dialog", { name: "Thêm mức lương ngày" })).toBeInTheDocument();
    expect(actions.createStaffRateVersionAction).toHaveBeenCalledOnce();

    pending.resolve({
      fieldErrors: { effectiveFrom: ["Đã có phiên bản đơn giá với ngày hiệu lực này."] },
      message: "Đã có phiên bản đơn giá với ngày hiệu lực này.",
      status: "error",
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Đã có phiên bản đơn giá với ngày hiệu lực này."));
    const effectiveFrom = screen.getByLabelText("Hiệu lực từ");
    const error = document.getElementById(effectiveFrom.getAttribute("aria-describedby") ?? "");
    if (!error) throw new Error("Expected the effective-date error association.");
    expect(error).toHaveTextContent("Đã có phiên bản đơn giá với ngày hiệu lực này.");
    expect(error.closest("label")).toBeNull();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("closes and refreshes authoritative history after a successful create without duplicate submission", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.createStaffRateVersionAction.mockReturnValueOnce(pending.promise);
    render(<StaffRateVersionDialog staffId={staffId} />);

    const trigger = screen.getByRole("button", { name: "Thêm mức lương ngày" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Thêm mức lương ngày" });
    fireEvent.change(screen.getByLabelText("Hiệu lực từ"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Lương ngày offline 9 giờ (VND)"), { target: { value: "140000" } });
    fireEvent.change(screen.getByLabelText("Lý do thêm phiên bản"), { target: { value: "Thiết lập đơn giá kỳ mới." } });

    const submit = within(dialog).getByRole("button", { name: "Lưu mức lương ngày" });
    fireEvent.click(submit);
    await waitFor(() => expect(actions.createStaffRateVersionAction).toHaveBeenCalledWith({
      effectiveFrom: "2026-10-01",
      note: "",
      offlineDailyRateVnd: 140_000,
      reason: "Thiết lập đơn giá kỳ mới.",
      staffId,
    }));
    fireEvent.click(submit);
    expect(actions.createStaffRateVersionAction).toHaveBeenCalledOnce();

    pending.resolve({ message: "Đã thêm phiên bản đơn giá mới.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

});
