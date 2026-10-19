// Value: protects=the StickySaveBar contract from design 09a/17a: clean shows "Chưa có thay đổi" with a disabled save linked to a text reason and no Hủy; dirty shows "n thay đổi chưa lưu", the changed field names, Hủy and an enabled save; a save error renders inside the bar region above the controls; a submit-type bar submits its enclosing form;
// fails_when=the clean save button becomes clickable or loses its described-by reason, Hủy appears while clean, the changed labels or count disappear, the error renders elsewhere, or the submit type is dropped;
// why_new=step 9 adds the shared save bar for the settings hub;
// seam=none (presentational component rendered directly); no_claim=does not prove the fixed position or the shell-width offsets visually (checked in /dev/settings) nor which pages render it for read-only users (covered by the feature tests)
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StickySaveBar } from "@/components/patterns/sticky-save-bar";
import { InstallAppPrompt } from "@/components/shared/install-app-prompt";
import { ResultBanner } from "@/components/shared/result-banner";

afterEach(cleanup);

describe("StickySaveBar", () => {
  it("shows the clean state with a disabled save and the reason linked to it", () => {
    render(<StickySaveBar dirtyCount={0} onCancel={vi.fn()} onSave={vi.fn()} saveLabel="Lưu thay đổi" />);
    const bar = screen.getByRole("region", { name: "Thanh lưu thay đổi" });
    const save = within(bar).getByRole("button", { name: "Lưu thay đổi" });

    expect(bar).toHaveTextContent("Chưa có thay đổi");
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription("Chưa có thay đổi");
    expect(within(bar).queryByRole("button", { name: "Hủy" })).not.toBeInTheDocument();
  });

  it("uses an explicit disabled reason when the feature gives one", () => {
    render(<StickySaveBar dirtyCount={2} onCancel={vi.fn()} saveDisabled saveDisabledReason="Sửa trường lỗi trước khi lưu." saveLabel="Lưu" />);
    expect(screen.getByRole("button", { name: "Lưu" })).toHaveAccessibleDescription("Sửa trường lỗi trước khi lưu.");
  });

  it("shows the dirty count, the changed fields, Hủy and an enabled save", () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(<StickySaveBar changedLabels={["Màu nhấn", "Bo góc"]} dirtyCount={2} onCancel={onCancel} onSave={onSave} saveLabel="Lưu thay đổi" />);
    const bar = screen.getByRole("region", { name: "Thanh lưu thay đổi" });

    expect(bar).toHaveTextContent("2 thay đổi chưa lưu");
    expect(bar).toHaveTextContent("Màu nhấn, Bo góc");
    fireEvent.click(within(bar).getByRole("button", { name: "Hủy" }));
    fireEvent.click(within(bar).getByRole("button", { name: "Lưu thay đổi" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("renders the save error inside the bar region and the saving label while busy", () => {
    render(
      <StickySaveBar
        dirtyCount={1}
        error={<ResultBanner description="Không thể kết nối." title="Chưa lưu được." tone="danger" />}
        isSaving
        onCancel={vi.fn()}
        saveLabel="Lưu thay đổi"
        savingLabel="Đang lưu…"
      />,
    );
    const bar = screen.getByRole("region", { name: "Thanh lưu thay đổi" });

    expect(within(bar).getByRole("alert")).toHaveTextContent("Chưa lưu được. Không thể kết nối.");
    expect(within(bar).getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
    expect(within(bar).getByRole("button", { name: "Hủy" })).toBeDisabled();
  });

  it("submits the enclosing form when it is a submit bar", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <StickySaveBar dirtyCount={1} onCancel={vi.fn()} saveLabel="Lưu cài đặt" saveType="submit" />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu cài đặt" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // Value: protects=the bar always renders exactly one polite live region (role="status", aria-live="polite") and only its text changes: present and empty before any result, then showing the feature's result message in the same node, then empty again;
  // fails_when=the status node is mounted only together with its text (often not announced by screen readers), a second status node appears, or the message stops showing as text;
  // why_new=accessibility review: features mounted and unmounted their own role="status" line; seam=none (rerender with a new statusMessage); no_claim=what a given screen reader speaks
  it("keeps one live region and changes only its text", () => {
    const { rerender } = render(<StickySaveBar dirtyCount={0} onCancel={vi.fn()} onSave={vi.fn()} saveLabel="Lưu" />);
    const bar = screen.getByRole("region", { name: "Thanh lưu thay đổi" });
    const status = within(bar).getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status.textContent).toBe("");

    rerender(<StickySaveBar dirtyCount={0} onCancel={vi.fn()} onSave={vi.fn()} saveLabel="Lưu" statusMessage="Đã lưu bản nháp." />);
    expect(within(bar).getAllByRole("status")).toEqual([status]);
    expect(status).toHaveTextContent("Đã lưu bản nháp.");

    rerender(<StickySaveBar dirtyCount={1} onCancel={vi.fn()} onSave={vi.fn()} saveLabel="Lưu" />);
    expect(within(bar).getAllByRole("status")).toEqual([status]);
    expect(status.textContent).toBe("");
  });
});

// Value: protects=the bar reserves its own height in the page flow (an aria-hidden spacer before it) so the last field is never hidden: 96px before measuring or without ResizeObserver, then the measured height (e.g. 171px with an error banner on a phone); the bar sits above the install prompt (z-40) and below dialogs; the disabled-save reason is visible text on phones, on its own line, still linked by aria-describedby;
// fails_when=pages go back to a fixed bottom padding that the taller bar covers, the spacer stops following the bar, the bar drops under the install prompt, or the reason is hidden below sm again;
// why_new=QA found the 171px bar (375px, error banner) covering the last field by 42px with a fixed pb-24, the bar under InstallAppPrompt, and the reason hidden on phones; seam=ResizeObserver is stubbed (jsdom has none) and the bar height comes from a stubbed getBoundingClientRect; no_claim=real layout at 375px (checked in /dev/settings) or the z-order against every overlay
describe("StickySaveBar layout", () => {
  it("reserves 96px in the flow when the bar cannot be measured", () => {
    render(<StickySaveBar dirtyCount={0} onCancel={vi.fn()} onSave={vi.fn()} saveLabel="Lưu" />);
    const bar = screen.getByRole("region", { name: "Thanh lưu thay đổi" });
    const spacer = bar.previousElementSibling as HTMLElement;

    expect(spacer).toHaveAttribute("aria-hidden", "true");
    expect(spacer.style.height).toBe("96px");
    expect(bar).toHaveClass("fixed", "z-[41]");
  });

  it("follows the measured bar height", () => {
    let notify: (() => void) | undefined;
    class FakeResizeObserver {
      constructor(callback: () => void) {
        notify = callback;
      }
      disconnect() {}
      observe() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 170.4 } as DOMRect);
    try {
      render(
        <StickySaveBar
          dirtyCount={1}
          error={<ResultBanner description="Không thể kết nối." title="Chưa lưu được." tone="danger" />}
          onCancel={vi.fn()}
          saveLabel="Lưu"
        />,
      );
      act(() => notify?.());
      const spacer = screen.getByRole("region", { name: "Thanh lưu thay đổi" }).previousElementSibling as HTMLElement;
      expect(spacer.style.height).toBe("171px");
    } finally {
      rect.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("shows the disabled reason as text on phones too, on its own line", () => {
    render(<StickySaveBar dirtyCount={0} onCancel={vi.fn()} saveDisabled saveDisabledReason="Nhập lý do trước." saveLabel="Lưu" />);
    const reason = screen.getByText("Nhập lý do trước.");

    expect(reason).not.toHaveClass("hidden");
    expect(reason).toHaveClass("basis-full", "truncate");
    expect(screen.getByRole("button", { name: "Lưu" })).toHaveAccessibleDescription("Nhập lý do trước.");
  });
});

// Value: protects=the bar publishes its reserved height as --save-bar-h on <html> (96px before measuring, then the measured height) and clears it on unmount; the install prompt's bottom offset adds that variable so it sits above the bar; the bar's contents sit in the same 1600px column (and side padding) as <main> while its background spans the content area;
// fails_when=the variable is not published, keeps a stale value after the bar unmounts (the prompt would float over an empty page), the prompt stops reading it, or the contents lose the main column wrapper;
// why_new=QA found the install prompt half under the bar and the bar contents misaligned with the page on very wide screens; seam=ResizeObserver stubbed with a manual notify; the prompt is shown through the iOS Safari user agent; no_claim=the real stacking or pixel alignment (checked in /dev/settings)
describe("StickySaveBar page integration", () => {
  it("publishes --save-bar-h while mounted and clears it on unmount", () => {
    let notify: (() => void) | undefined;
    class FakeResizeObserver {
      constructor(callback: () => void) {
        notify = callback;
      }
      disconnect() {}
      observe() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 120 } as DOMRect);
    try {
      const { unmount } = render(<StickySaveBar dirtyCount={0} onCancel={vi.fn()} onSave={vi.fn()} saveLabel="Lưu" />);
      expect(document.documentElement.style.getPropertyValue("--save-bar-h")).toBe("96px");
      act(() => notify?.());
      expect(document.documentElement.style.getPropertyValue("--save-bar-h")).toBe("120px");
      unmount();
      expect(document.documentElement.style.getPropertyValue("--save-bar-h")).toBe("");
    } finally {
      rect.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("lifts the install prompt above the bar", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    });
    vi.stubGlobal("matchMedia", vi.fn(() => ({ addEventListener: vi.fn(), matches: false, removeEventListener: vi.fn() })));
    try {
      render(<InstallAppPrompt />);
      expect(screen.getByRole("dialog", { name: "Cài ứng dụng" }).className).toContain("bottom-[calc(var(--save-bar-h,0px)+var(--safe-area-bottom)+12px)]");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("puts the contents in the same column as <main>", () => {
    render(<StickySaveBar dirtyCount={1} onCancel={vi.fn()} saveLabel="Lưu" />);
    const save = screen.getByRole("button", { name: "Lưu" });
    const row = save.closest(".max-w-\\[1600px\\]");
    expect(row).toHaveClass("mx-auto", "max-w-[1600px]", "px-4", "md:px-5", "lg:px-6");
    // The background and hairline stay on the full-width wrapper around the column.
    expect(row?.parentElement).toHaveClass("border-t", "bg-surface-base");
  });
});

// Value: protects=the additive props for long create forms (design 17a): a secondary action renders as a secondary button between Hủy and the save button whenever the save button renders (clean or dirty), calls its handler, and is disabled while saving or when the feature disables it; stateLabel replaces the state text in any state (the changed labels still follow while dirty, and it remains the fallback reason of a disabled save); stateTone colours the dot (danger/warning forced, default keeps grey-when-clean and warning-when-dirty); without the new props nothing changes;
// fails_when=the secondary action is missing, out of order, clickable while saving, styled as a second primary, or hidden while clean; stateLabel is ignored or drops the changed labels; the dot ignores stateTone or the default rule changes;
// why_new=step 15a adds "Lưu và thêm tiếp" and "Đang nhập · n lỗi cần sửa" for the student form; seam=none (presentational component rendered directly); no_claim=what the feature's secondary action does or when it disables it (lane tests)
describe("StickySaveBar secondary action and state overrides", () => {
  function dot(text: string) {
    return screen.getByText(text).previousElementSibling as HTMLElement;
  }

  it("renders the secondary action between Hủy and the save button and calls it", () => {
    const onSecondary = vi.fn();
    render(<StickySaveBar dirtyCount={2} onCancel={vi.fn()} onSave={vi.fn()} saveLabel="Lưu học sinh" secondaryAction={{ label: "Lưu và thêm tiếp", onClick: onSecondary }} />);
    const bar = screen.getByRole("region", { name: "Thanh lưu thay đổi" });
    const buttons = within(bar).getAllByRole("button");

    expect(buttons.map((button) => button.textContent)).toEqual(["Hủy", "Lưu và thêm tiếp", "Lưu học sinh"]);
    // One primary: the secondary uses the secondary variant, never the primary fill.
    expect(buttons[1].className).not.toContain("bg-action-primary");
    expect(buttons[2].className).toContain("bg-action-primary");
    fireEvent.click(buttons[1]);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("keeps the secondary action next to a disabled save while clean, and lets the feature disable it with the same reason", () => {
    render(
      <StickySaveBar dirtyCount={0} onCancel={vi.fn()} onSave={vi.fn()} saveLabel="Lưu học sinh" secondaryAction={{ disabled: true, label: "Lưu và thêm tiếp", onClick: vi.fn() }} />,
    );
    const secondary = screen.getByRole("button", { name: "Lưu và thêm tiếp" });

    expect(screen.queryByRole("button", { name: "Hủy" })).not.toBeInTheDocument();
    expect(secondary).toBeDisabled();
    expect(secondary).toHaveAccessibleDescription("Chưa có thay đổi");
    expect(screen.getByRole("button", { name: "Lưu học sinh" })).toBeDisabled();
  });

  it("enables the secondary action by default, also while clean", () => {
    render(<StickySaveBar dirtyCount={0} onCancel={vi.fn()} saveLabel="Lưu" secondaryAction={{ label: "Xem trước", onClick: vi.fn() }} />);
    expect(screen.getByRole("button", { name: "Xem trước" })).toBeEnabled();
  });

  it("disables the secondary action while saving", () => {
    render(
      <StickySaveBar dirtyCount={1} isSaving onCancel={vi.fn()} saveLabel="Lưu học sinh" savingLabel="Đang lưu…" secondaryAction={{ label: "Lưu và thêm tiếp", onClick: vi.fn() }} />,
    );
    expect(screen.getByRole("button", { name: "Lưu và thêm tiếp" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  });

  it("replaces the state text with stateLabel while dirty and keeps the changed labels", () => {
    render(
      <StickySaveBar
        changedLabels={["Số điện thoại phụ huynh"]}
        dirtyCount={3}
        onCancel={vi.fn()}
        saveLabel="Lưu học sinh"
        stateLabel="Đang nhập · 1 lỗi cần sửa"
        stateTone="danger"
      />,
    );
    const bar = screen.getByRole("region", { name: "Thanh lưu thay đổi" });

    expect(bar).toHaveTextContent("Đang nhập · 1 lỗi cần sửa");
    expect(bar).not.toHaveTextContent("3 thay đổi chưa lưu");
    expect(bar).toHaveTextContent("Số điện thoại phụ huynh");
    expect(dot("Đang nhập · 1 lỗi cần sửa")).toHaveClass("bg-danger");
    expect(dot("Đang nhập · 1 lỗi cần sửa")).toHaveAttribute("data-tone", "danger");
    // Validation errors do not disable the save: submitting focuses the first invalid field.
    expect(within(bar).getByRole("button", { name: "Lưu học sinh" })).toBeEnabled();
  });

  it("replaces the clean text with stateLabel, which stays the disabled save's reason", () => {
    render(<StickySaveBar dirtyCount={0} onCancel={vi.fn()} saveLabel="Lưu" stateLabel="Chưa nhập gì" stateTone="warning" />);
    const bar = screen.getByRole("region", { name: "Thanh lưu thay đổi" });

    expect(bar).toHaveTextContent("Chưa nhập gì");
    expect(bar).not.toHaveTextContent("Chưa có thay đổi");
    expect(screen.getByRole("button", { name: "Lưu" })).toHaveAccessibleDescription("Chưa nhập gì");
    expect(dot("Chưa nhập gì")).toHaveClass("bg-warning");
  });

  it("keeps the default dot rule: grey when clean, warning when dirty", () => {
    const { rerender } = render(<StickySaveBar dirtyCount={0} onCancel={vi.fn()} saveLabel="Lưu" />);
    expect(dot("Chưa có thay đổi")).toHaveClass("bg-text-subtle");
    expect(dot("Chưa có thay đổi")).not.toHaveClass("bg-warning");

    rerender(<StickySaveBar dirtyCount={2} onCancel={vi.fn()} saveLabel="Lưu" stateTone="default" />);
    expect(dot("2 thay đổi chưa lưu")).toHaveClass("bg-warning");
    expect(dot("2 thay đổi chưa lưu")).not.toHaveClass("bg-text-subtle");
  });

  it("lets three buttons wrap instead of overflowing a phone-width bar", () => {
    render(<StickySaveBar dirtyCount={1} onCancel={vi.fn()} saveLabel="Lưu học sinh" secondaryAction={{ label: "Lưu và thêm tiếp", onClick: vi.fn() }} />);
    expect(screen.getByRole("button", { name: "Lưu học sinh" }).parentElement).toHaveClass("ml-auto", "max-w-full", "flex-wrap", "justify-end");
  });
});
