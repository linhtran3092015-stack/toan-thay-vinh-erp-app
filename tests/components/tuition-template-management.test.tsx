// Value: protects=the Mẫu Phiếu học phí editor (design 15b): the header (current version badge, code · publish stamp · publisher, usage line, consequence) with the page's one primary "Xuất bản phiên bản v{n+1}" submitting the form through its form attribute, disabled with a visible reason in a fixed order (unchanged → blank required field → blank reason), the trimmed publish payload sent to the injected action (or the real one by default), the result tone taken from the action's status (success = status, error or a thrown request = alert, nothing at rest), the editor remounting from the newly published version while the result stays and takes focus (the remount would otherwise drop focus to the page body), the version history newest first, the read-only QR line instead of the design's toggle, and the live A5 sample fed by the form;
// fails_when=the result shows as info whatever the outcome (the old bug), a second primary appears, the button submits while unchanged or blank, a stale reason survives a publish, the payload keeps padding or misses a key, the outcome banner is not focused after a publish, the QR toggle comes back, or the preview stops following the fields or reaches the VietQR service;
// why_new=step 13 rewrote TuitionTemplateManagement (no test covered it);
// seam=the "use server" actions module mocked at its boundary; no_claim=does not prove the publish RPC or the route's reads (tuition-templates-route covers the route)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { publishTuitionTemplateAction } from "@/features/tuition/actions";
import { FEE_NOTICE_PLACEHOLDER_QR } from "@/features/tuition/fee-notice-model";
import { TuitionTemplateManagement } from "@/features/tuition/template-management";
import type { TuitionTemplateVersion } from "@/features/tuition/receipt-template-models";

vi.mock("@/features/tuition/actions", () => ({ publishTuitionTemplateAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const v3: TuitionTemplateVersion = {
  content: {
    announcement: "Kính gửi quý phụ huynh, trung tâm xin thông báo học phí tháng tới.",
    centerDisplayName: "Trung tâm Toán Thầy Vinh",
    footer: "Thắc mắc liên hệ 0988 123 456 (cô Hằng) · Trân trọng cảm ơn!",
    title: "PHIẾU HỌC PHÍ",
  },
  id: "version-3",
  publishedAt: "2026-09-25T03:12:00Z",
  publisherName: "Nguyễn Thu Hằng",
  reason: "Đổi chân trang sang số cô Hằng",
  version: 3,
};
const v2: TuitionTemplateVersion = { ...v3, id: "version-2", publishedAt: "2026-08-28T02:05:00Z", publisherName: "người khác (không xem được tên)", reason: "Thêm đoạn thông báo", version: 2 };
const v1: TuitionTemplateVersion = {
  content: { announcement: "", centerDisplayName: "Trung tâm Toán Thầy Vinh", footer: "Phụ huynh vui lòng kiểm tra thông tin học phí trước khi thanh toán.", title: "HỌC PHÍ {PERIOD_NAME}" },
  id: "version-1",
  publishedAt: "2026-07-30T01:00:00Z",
  publisherName: "Hệ thống",
  reason: "Default Wave A template",
  version: 1,
};
const versions = [v3, v2, v1];
const usage = { draftCount: 1, lockedPeriodNames: ["Học phí tháng 10/2026"] };

function primaries(container: HTMLElement) {
  return container.querySelectorAll('a[class~="bg-action-primary"], button[class~="bg-action-primary"]');
}

const publishButton = (version: number) => screen.getByRole("button", { name: `Xuất bản phiên bản v${version}` });
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("TuitionTemplateManagement", () => {
  it("heads the page with the version in use, who published it, where it is used and what publishing does", () => {
    const { container } = render(<TuitionTemplateManagement publishAction={vi.fn()} usage={usage} versions={versions} />);

    expect(screen.getByRole("heading", { level: 1, name: "Mẫu Phiếu học phí" })).toBeInTheDocument();
    expect(screen.getByText("v3 đang dùng")).toBeInTheDocument();
    expect(screen.getByText("TUITION_NOTICE_DEFAULT · xuất bản 25/09/2026 10:12 bởi Nguyễn Thu Hằng")).toBeInTheDocument();
    expect(screen.getByText("Kỳ đã khóa dùng v3: Học phí tháng 10/2026 · 1 kỳ nháp sẽ dùng phiên bản mới nhất khi khóa")).toBeInTheDocument();
    expect(
      screen.getByText("Xuất bản tạo v4. Kỳ thu khóa sau đó dùng phiên bản mới nhất; kỳ đã khóa giữ nguyên phiếu đã tạo."),
    ).toBeInTheDocument();

    const publish = publishButton(4);
    expect(primaries(container)).toHaveLength(1);
    expect(primaries(container)[0]).toBe(publish);
    expect(publish).toHaveAttribute("type", "submit");
    expect(publish).toHaveAttribute("form", screen.getByRole("form", { name: "Nội dung mẫu Phiếu học phí" }).id);
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription("Chưa có thay đổi so với v3.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("starts the form from the current version with the UI limits and hints, and shows QR as a fixed rule", () => {
    render(<TuitionTemplateManagement publishAction={vi.fn()} usage={usage} versions={versions} />);

    expect(screen.getByLabelText("Tiêu đề phiếu")).toHaveValue("PHIẾU HỌC PHÍ");
    expect(screen.getByLabelText("Tiêu đề phiếu")).toHaveAccessibleDescription("{PERIOD_NAME} được thay bằng tên kỳ thu");
    expect(screen.getByLabelText("Tên trung tâm hiển thị")).toHaveValue("Trung tâm Toán Thầy Vinh");
    expect(screen.getByLabelText("Đoạn thông báo")).toHaveValue(v3.content.announcement);
    expect(screen.getByLabelText("Chân trang")).toHaveValue(v3.content.footer);
    expect(screen.getByLabelText("Chân trang")).toHaveAccessibleDescription("Ghi số điện thoại liên hệ ở đây — phiếu không tự lấy số trung tâm.");
    expect(screen.getByLabelText("Lý do xuất bản")).toHaveValue("");
    expect(screen.getByPlaceholderText("VD: đổi số điện thoại liên hệ")).toBeRequired();

    expect(screen.getByLabelText("Tiêu đề phiếu")).toHaveAttribute("maxLength", "120");
    expect(screen.getByLabelText("Tên trung tâm hiển thị")).toHaveAttribute("maxLength", "120");
    expect(screen.getByLabelText("Đoạn thông báo")).toHaveAttribute("maxLength", "1000");
    expect(screen.getByLabelText("Chân trang")).toHaveAttribute("maxLength", "300");
    expect(screen.getByLabelText("Lý do xuất bản")).toHaveAttribute("maxLength", "500");
    expect(screen.getByLabelText("Đoạn thông báo")).not.toBeRequired();

    // The design's "Hiển thị mã QR VietQR" toggle is not honoured anywhere: a fixed line instead.
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("Mã QR VietQR luôn in trên phiếu cần thanh toán.")).toBeInTheDocument();
  });

  it("explains why publishing is disabled: unchanged, then a blank required field, then a blank reason", () => {
    render(<TuitionTemplateManagement publishAction={vi.fn()} usage={usage} versions={versions} />);

    change("Chân trang", "   ");
    expect(publishButton(4)).toBeDisabled();
    expect(publishButton(4)).toHaveAccessibleDescription("Điền tiêu đề, tên trung tâm và chân trang.");

    change("Chân trang", "Thắc mắc liên hệ 0901 234 567 (cô Hằng)");
    expect(publishButton(4)).toHaveAccessibleDescription("Nhập lý do xuất bản.");

    change("Lý do xuất bản", "Đổi số liên hệ");
    expect(publishButton(4)).toBeEnabled();
    expect(publishButton(4)).not.toHaveAccessibleDescription();

    // Back to the stored text (padding aside): nothing to publish again.
    change("Chân trang", ` ${v3.content.footer} `);
    expect(publishButton(4)).toHaveAccessibleDescription("Chưa có thay đổi so với v3.");
  });

  it("sends the trimmed content and reason to the injected action and shows success as a status", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Đã xuất bản phiên bản mẫu mới.", status: "success" });
    render(<TuitionTemplateManagement publishAction={action} usage={usage} versions={versions} />);

    change("Chân trang", "  Thắc mắc liên hệ 0901 234 567 (cô Hằng)  ");
    change("Lý do xuất bản", " Đổi số liên hệ ");
    fireEvent.click(publishButton(4));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã xuất bản phiên bản mẫu mới."));
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith({
      announcement: v3.content.announcement,
      centerDisplayName: "Trung tâm Toán Thầy Vinh",
      footer: "Thắc mắc liên hệ 0901 234 567 (cô Hằng)",
      reason: "Đổi số liên hệ",
      title: "PHIẾU HỌC PHÍ",
    });
    expect(publishTuitionTemplateAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error result as an alert and keeps what was typed", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Không thể xuất bản phiên bản mẫu.", status: "error" });
    render(<TuitionTemplateManagement publishAction={action} usage={usage} versions={versions} />);

    change("Tiêu đề phiếu", "HỌC PHÍ {PERIOD_NAME}");
    change("Lý do xuất bản", "Đổi tiêu đề");
    fireEvent.submit(screen.getByRole("form", { name: "Nội dung mẫu Phiếu học phí" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể xuất bản phiên bản mẫu."));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tiêu đề phiếu")).toHaveValue("HỌC PHÍ {PERIOD_NAME}");
    expect(screen.getByLabelText("Lý do xuất bản")).toHaveValue("Đổi tiêu đề");
  });

  it("does not claim either outcome when the request throws", async () => {
    const action = vi.fn().mockRejectedValue(new Error("network"));
    render(<TuitionTemplateManagement publishAction={action} usage={usage} versions={versions} />);

    change("Tiêu đề phiếu", "HỌC PHÍ {PERIOD_NAME}");
    change("Lý do xuất bản", "Đổi tiêu đề");
    fireEvent.click(publishButton(4));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Không rõ phiên bản mẫu đã được xuất bản chưa; tải lại trang để kiểm tra trước khi thử lại."),
    );
  });

  it("never submits while the button is disabled", () => {
    const action = vi.fn();
    render(<TuitionTemplateManagement publishAction={action} usage={usage} versions={versions} />);

    change("Lý do xuất bản", "Không đổi gì");
    fireEvent.submit(screen.getByRole("form", { name: "Nội dung mẫu Phiếu học phí" }));
    expect(action).not.toHaveBeenCalled();
  });

  it("remounts the form from the newly published version and keeps the result", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Đã xuất bản phiên bản mẫu mới.", status: "success" });
    const { rerender } = render(<TuitionTemplateManagement publishAction={action} usage={usage} versions={versions} />);

    change("Chân trang", "Liên hệ 0901 234 567");
    change("Lý do xuất bản", "Đổi số liên hệ");
    fireEvent.click(publishButton(4));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã xuất bản phiên bản mẫu mới."));

    // What revalidatePath brings back after the publish.
    const v4: TuitionTemplateVersion = { ...v3, content: { ...v3.content, footer: "Liên hệ 0901 234 567" }, id: "version-4", publishedAt: "2026-10-16T02:00:00Z", reason: "Đổi số liên hệ", version: 4 };
    rerender(<TuitionTemplateManagement publishAction={action} usage={{ draftCount: 1, lockedPeriodNames: [] }} versions={[v4, ...versions]} />);

    expect(screen.getByRole("status")).toHaveTextContent("Đã xuất bản phiên bản mẫu mới.");
    expect(screen.getByText("v4 đang dùng")).toBeInTheDocument();
    expect(screen.getByLabelText("Chân trang")).toHaveValue("Liên hệ 0901 234 567");
    expect(screen.getByLabelText("Lý do xuất bản")).toHaveValue("");
    expect(publishButton(5)).toHaveAccessibleDescription("Chưa có thay đổi so với v4.");
  });

  it("puts focus on the outcome banner after a publish, also once the editor has remounted", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Đã xuất bản phiên bản mẫu mới.", status: "success" });
    const { rerender } = render(<TuitionTemplateManagement publishAction={action} usage={usage} versions={versions} />);

    change("Chân trang", "Liên hệ 0901 234 567");
    change("Lý do xuất bản", "Đổi số liên hệ");
    fireEvent.click(publishButton(4));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    // The wrapper around the banner is the focus target: programmatic only, not a tab stop.
    const wrapper = screen.getByRole("status").parentElement;
    expect(wrapper).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(wrapper);

    const v4: TuitionTemplateVersion = { ...v3, content: { ...v3.content, footer: "Liên hệ 0901 234 567" }, id: "version-4", publishedAt: "2026-10-16T02:00:00Z", reason: "Đổi số liên hệ", version: 4 };
    rerender(<TuitionTemplateManagement publishAction={action} usage={usage} versions={[v4, ...versions]} />);

    // The editor remounted (the old wrapper left the page): focus did not fall back to the body.
    expect(wrapper).not.toBeInTheDocument();
    const remountedWrapper = screen.getByRole("status").parentElement;
    expect(screen.getByRole("status")).toHaveTextContent("Đã xuất bản phiên bản mẫu mới.");
    expect(remountedWrapper).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(remountedWrapper);
  });

  it("focuses an error banner too, and leaves focus alone when there is no result", async () => {
    const action = vi.fn().mockResolvedValue({ message: "Không thể xuất bản phiên bản mẫu.", status: "error" });
    render(<TuitionTemplateManagement publishAction={action} usage={usage} versions={versions} />);
    expect(document.activeElement).toBe(document.body);

    change("Tiêu đề phiếu", "HỌC PHÍ {PERIOD_NAME}");
    change("Lý do xuất bản", "Đổi tiêu đề");
    fireEvent.submit(screen.getByRole("form", { name: "Nội dung mẫu Phiếu học phí" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(document.activeElement).toBe(screen.getByRole("alert").parentElement);
  });

  it("lists every version newest first with its reason, date and publisher; only the first is in use", () => {
    render(<TuitionTemplateManagement publishAction={vi.fn()} usage={usage} versions={versions} />);

    const history = screen.getByRole("region", { name: "Lịch sử phiên bản" });
    const rows = within(history).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent(/^v3Đổi chân trang sang số cô HằngĐang dùng25\/09\/2026 · Nguyễn Thu Hằng$/);
    expect(rows[1]).toHaveTextContent(/^v2Thêm đoạn thông báo28\/08\/2026 · người khác \(không xem được tên\)$/);
    expect(rows[2]).toHaveTextContent(/^v1Default Wave A template30\/07\/2026 · Hệ thống$/);
    expect(within(history).getAllByText("Đang dùng")).toHaveLength(1);
  });

  it("previews the form's text on a clearly labelled sample notice with a local QR", () => {
    render(<TuitionTemplateManagement publishAction={vi.fn()} usage={usage} versions={versions} />);

    const preview = screen.getByRole("region", { name: "Xem trước (dữ liệu mẫu)" });
    const sheet = within(preview).getByRole("article", { name: "Phiếu học phí mẫu" });
    expect(sheet).not.toHaveClass("fee-notice-a5");
    expect(within(sheet).getByRole("heading", { name: "PHIẾU HỌC PHÍ" })).toBeInTheDocument();
    expect(within(sheet).getByRole("img", { name: "Mã QR thanh toán tái phí" })).toHaveAttribute("src", FEE_NOTICE_PLACEHOLDER_QR);

    change("Tiêu đề phiếu", "HỌC PHÍ {PERIOD_NAME}");
    change("Tên trung tâm hiển thị", "Toán Thầy Vinh · Cơ sở Cầu Giấy");
    change("Chân trang", "Liên hệ 0901 234 567");
    expect(within(sheet).getByRole("heading", { name: "HỌC PHÍ Học phí tháng 11/2026" })).toBeInTheDocument();
    expect(within(sheet).getByText("Toán Thầy Vinh · Cơ sở Cầu Giấy")).toBeInTheDocument();
    expect(within(sheet).getByText("Liên hệ 0901 234 567")).toBeInTheDocument();
  });

  it("offers v1 when nothing is published yet and hides the usage line", () => {
    render(<TuitionTemplateManagement publishAction={vi.fn()} usage={usage} versions={[]} />);

    expect(screen.getByText("Chưa có phiên bản")).toBeInTheDocument();
    expect(screen.getByText("TUITION_NOTICE_DEFAULT · chưa xuất bản phiên bản nào; kỳ thu chỉ khóa được khi đã có mẫu.")).toBeInTheDocument();
    expect(screen.queryByText(/kỳ nháp sẽ dùng/)).not.toBeInTheDocument();
    expect(publishButton(1)).toHaveAccessibleDescription("Điền tiêu đề, tên trung tâm và chân trang.");
    expect(screen.getByText("Chưa có phiên bản nào được xuất bản.")).toBeInTheDocument();
  });

  it("hides the usage line when periods could not be read", () => {
    render(<TuitionTemplateManagement publishAction={vi.fn()} usage={null} versions={versions} />);
    expect(screen.queryByText(/Kỳ đã khóa dùng|kỳ nháp|Chưa có kỳ thu nào/)).not.toBeInTheDocument();
  });

  it("falls back to the real server action when none is injected", async () => {
    // Once: clearAllMocks keeps implementations, so a persistent value would leak into later tests.
    vi.mocked(publishTuitionTemplateAction).mockResolvedValueOnce({ message: "Đã xuất bản phiên bản mẫu mới.", status: "success" });
    render(<TuitionTemplateManagement usage={usage} versions={versions} />);

    change("Chân trang", "Liên hệ 0901 234 567");
    change("Lý do xuất bản", "Đổi số liên hệ");
    fireEvent.click(publishButton(4));

    await waitFor(() => expect(publishTuitionTemplateAction).toHaveBeenCalledTimes(1));
  });
});
