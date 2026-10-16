// Value: protects=the reissue form on a Phiếu học phí (design 15b, tuition_periods.adjust): its labelled fields and consequence copy, the injected action receiving (itemId, amount, reason), a focused result banner whose tone follows the action's status (error = alert, success = status) with no banner at rest and an "uncertain" error when the request throws, the typed amount and reason kept after an error or a throw (cleared only after a success), and the result surviving the notice turning replaced (fields gone, link to the current replacement) while a replaced notice with no result renders nothing;
// fails_when=an error result renders as a polite status, a success renders as an alert, an alert shows before submitting, the amount is sent as text, the real action is called when a stand-in is given, a thrown request is swallowed, an error puts the original amount back in the field (React's form-action reset) or clears the reason, focus stays on the vanished button, the success banner disappears when the page re-renders the notice as replaced, or a replaced notice still offers a reissue;
// why_new=step 13 restyled TuitionReissueForm, added the reissueAction, replaced and replacementHref props, and moved it from a function action to onSubmit;
// seam=the "use server" actions module mocked at its boundary; no_claim=does not prove the reissue RPC
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reissueTuitionItemAction } from "@/features/tuition/actions";
import { TuitionReissueForm } from "@/features/tuition/reissue-form";

vi.mock("@/features/tuition/actions", () => ({ reissueTuitionItemAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fillAndSubmit(amount: string, reason: string) {
  fireEvent.change(screen.getByLabelText("Số tiền mới (₫)"), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText("Lý do điều chỉnh"), { target: { value: reason } });
  fireEvent.submit(screen.getByRole("form", { name: "Điều chỉnh / phát hành lại" }));
}

describe("TuitionReissueForm", () => {
  it("shows the consequence and the current amount, and stays quiet at rest", () => {
    render(<TuitionReissueForm amountVnd={1_600_000} itemId="item-1" reissueAction={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Điều chỉnh / phát hành lại" })).toBeInTheDocument();
    expect(screen.getByText(/Phiếu gốc không bị sửa; yêu cầu thanh toán cũ bị hủy\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Số tiền mới (₫)")).toHaveValue(1_600_000);
    expect(screen.getByLabelText("Số tiền mới (₫)")).toHaveAccessibleDescription(/Hiện tại 1\.600\.000\s₫/);
    expect(screen.getByPlaceholderText("Ví dụ: Giảm 2 buổi nghỉ có phép")).toBeRequired();
    expect(screen.getByRole("button", { name: "Tạo phiếu thay thế" })).not.toHaveClass("bg-action-primary");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("sends the numeric amount and reason to the injected action and shows success as a status", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Đã tạo phiếu thay thế và giữ nguyên lịch sử phiếu gốc.", status: "success" });
    render(<TuitionReissueForm amountVnd={1_600_000} itemId="item-1" reissueAction={action} />);
    fillAndSubmit("1200000", "Giảm 2 buổi nghỉ có phép");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã tạo phiếu thay thế và giữ nguyên lịch sử phiếu gốc."));
    expect(action).toHaveBeenCalledWith("item-1", 1_200_000, "Giảm 2 buổi nghỉ có phép");
    expect(reissueTuitionItemAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.activeElement).toContainElement(screen.getByRole("status"));
  });

  it("keeps the success banner when the page re-renders the notice as replaced, with a link to the current replacement", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Đã tạo phiếu thay thế và giữ nguyên lịch sử phiếu gốc.", status: "success" });
    const { rerender } = render(<TuitionReissueForm amountVnd={1_600_000} itemId="item-1" reissueAction={action} />);
    fillAndSubmit("1200000", "Giảm 2 buổi nghỉ có phép");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã tạo phiếu thay thế"));
    const focused = document.activeElement;

    rerender(<TuitionReissueForm amountVnd={1_600_000} itemId="item-1" reissueAction={action} replaced replacementHref="/finance/tuition-periods/p/items/item-2/notice" />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Đã tạo phiếu thay thế và giữ nguyên lịch sử phiếu gốc.");
    expect(within(banner).getByRole("link", { name: "Mở bản thay thế hiện hành" })).toHaveAttribute("href", "/finance/tuition-periods/p/items/item-2/notice");
    expect(document.activeElement).toBe(focused);
    expect(focused).toContainElement(banner);
    expect(screen.queryByLabelText("Số tiền mới (₫)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo phiếu thay thế" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Điều chỉnh / phát hành lại" })).not.toBeInTheDocument();
  });

  it("accepts an exact amount that is not a multiple of 1.000 (e.g. 13 buổi × 187.500 ₫)", () => {
    render(<TuitionReissueForm amountVnd={2_437_500} itemId="item-1" reissueAction={vi.fn()} />);
    const amount = screen.getByLabelText(/Số tiền mới/) as HTMLInputElement;
    expect(amount.value).toBe("2437500");
    // The browser refuses to submit a field whose value breaks its step.
    expect(amount.validity.stepMismatch).toBe(false);
    expect(amount.checkValidity()).toBe(true);
  });

  it("renders nothing for a replaced notice without a result", () => {
    const { container } = render(<TuitionReissueForm amountVnd={1_600_000} itemId="item-1" reissueAction={vi.fn()} replaced replacementHref="/x" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an error result as an alert", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Không thể phát hành lại phiếu. Phiếu gốc vẫn không bị thay đổi.", status: "error" });
    render(<TuitionReissueForm amountVnd={1_600_000} itemId="item-1" reissueAction={action} />);
    fillAndSubmit("0", "Miễn học phí");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể phát hành lại phiếu. Phiếu gốc vẫn không bị thay đổi."));
    expect(action).toHaveBeenCalledWith("item-1", 0, "Miễn học phí");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.activeElement).toContainElement(screen.getByRole("alert"));
    // The fields stay for a retry while the notice is not replaced.
    expect(screen.getByRole("button", { name: "Tạo phiếu thay thế" })).toBeInTheDocument();
  });

  it("keeps the typed amount and reason after an error so a retry does not send the original amount", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Không thể phát hành lại phiếu. Phiếu gốc vẫn không bị thay đổi.", status: "error" });
    render(<TuitionReissueForm amountVnd={1_600_000} itemId="item-1" reissueAction={action} />);
    fillAndSubmit("1200000", "Giảm 2 buổi nghỉ có phép");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể phát hành lại phiếu."));
    expect(screen.getByLabelText("Số tiền mới (₫)")).toHaveValue(1_200_000);
    expect(screen.getByLabelText("Lý do điều chỉnh")).toHaveValue("Giảm 2 buổi nghỉ có phép");

    // A plain retry sends what is on screen, not the notice's original amount.
    fireEvent.submit(screen.getByRole("form", { name: "Điều chỉnh / phát hành lại" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action).toHaveBeenLastCalledWith("item-1", 1_200_000, "Giảm 2 buổi nghỉ có phép");
  });

  it("keeps the typed values when the request throws", async () => {
    const action = vi.fn().mockRejectedValue(new Error("network"));
    render(<TuitionReissueForm amountVnd={1_600_000} itemId="item-1" reissueAction={action} />);
    fillAndSubmit("900000", "Giảm 3 buổi");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không rõ phiếu đã được phát hành lại chưa"));
    expect(screen.getByLabelText("Số tiền mới (₫)")).toHaveValue(900_000);
    expect(screen.getByLabelText("Lý do điều chỉnh")).toHaveValue("Giảm 3 buổi");
  });

  it("clears the fields only after a success", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Đã tạo phiếu thay thế và giữ nguyên lịch sử phiếu gốc.", status: "success" });
    render(<TuitionReissueForm amountVnd={1_600_000} itemId="item-1" reissueAction={action} />);
    fillAndSubmit("1200000", "Giảm 2 buổi nghỉ có phép");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã tạo phiếu thay thế"));
    expect(screen.getByLabelText("Số tiền mới (₫)")).toHaveValue(1_600_000);
    expect(screen.getByLabelText("Lý do điều chỉnh")).toHaveValue("");
  });

  it("does not claim either outcome when the request throws", async () => {
    const action = vi.fn().mockRejectedValue(new Error("network"));
    render(<TuitionReissueForm amountVnd={1_600_000} itemId="item-1" reissueAction={action} />);
    fillAndSubmit("1000000", "Điều chỉnh");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Không rõ phiếu đã được phát hành lại chưa; tải lại trang để kiểm tra trước khi thử lại."),
    );
  });

  it("falls back to the real server action", async () => {
    // Once: clearAllMocks keeps implementations, so a persistent value would leak into later tests.
    vi.mocked(reissueTuitionItemAction).mockResolvedValueOnce({ message: "Đã tạo phiếu thay thế và giữ nguyên lịch sử phiếu gốc.", status: "success" });
    render(<TuitionReissueForm amountVnd={500_000} itemId="item-9" />);
    fillAndSubmit("400000", "Giảm 1 buổi");
    await waitFor(() => expect(reissueTuitionItemAction).toHaveBeenCalledWith("item-9", 400_000, "Giảm 1 buổi"));
  });
});
