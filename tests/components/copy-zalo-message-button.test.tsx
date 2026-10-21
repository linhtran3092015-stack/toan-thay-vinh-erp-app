// Value: protects=TAs copying the parent comment message by hand while students are not linked to Zalo: one click copies the whole rendered message, a long message offers each 2–3 part separately, and a refusal (no comment, no permission) shows its reason instead of copying nothing silently;
// fails_when=the button copies the bare comment instead of the rendered message, only part 1 of a long message can be copied, or a failure is swallowed;
// why_new=21/10 live use needed manual Zalo sending; seam=server action and clipboard stubbed; no_claim=the SQL renderer (zalo-comment-message-v2 pgTAP)
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyZaloMessageButton } from "@/features/sessions/components/copy-zalo-message-button";

afterEach(cleanup);

function stubClipboard() {
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return writeText;
}

describe("CopyZaloMessageButton", () => {
  it("copies the whole rendered message", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    const load = vi.fn(async () => ({ ok: true as const, parts: ["THẦY VINH VÀ THẦY CÔ CỘNG SỰ...\n- Nhận xét cho học sinh:\nCon làm tốt."] }));
    render(<CopyZaloMessageButton load={load} resultId="11111111-1111-4111-8111-111111111111" />);
    await user.click(screen.getByRole("button", { name: "Sao chép tin Zalo" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("THẦY VINH VÀ THẦY CÔ CỘNG SỰ...\n- Nhận xét cho học sinh:\nCon làm tốt."));
    expect(load).toHaveBeenCalledWith({ resultId: "11111111-1111-4111-8111-111111111111" });
    expect(await screen.findByRole("button", { name: "Đã chép tin Zalo" })).toBeTruthy();
  });

  it("offers each part of a long message", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    render(<CopyZaloMessageButton load={async () => ({ ok: true, parts: ["Phần đầu", "(tiếp theo 2/2)\nPhần sau"] })} resultId="r" />);
    await user.click(screen.getByRole("button", { name: "Sao chép tin Zalo" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Phần đầu"));
    await user.click(await screen.findByRole("button", { name: "Chép phần 2/2" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("(tiếp theo 2/2)\nPhần sau"));
  });

  it("shows why nothing was copied", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    render(<CopyZaloMessageButton load={async () => ({ message: "Kết quả này chưa có nhận xét.", ok: false })} resultId="r" />);
    await user.click(screen.getByRole("button", { name: "Sao chép tin Zalo" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Kết quả này chưa có nhận xét.");
    expect(writeText).not.toHaveBeenCalled();
  });
});
