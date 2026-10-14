// Value: protects=the branding page (WebsiteEditor mode="branding", design 09a): "Lưu thay đổi" lives only in the StickySaveBar (none in the header), the bar names the changed branding fields, the ERP preview takes the chosen accent and corners on its own container and never on <html> before saving, Hủy restores the last saved values, a never-saved configuration (version 0) is saveable while clean, a save error keeps the typed values and shows a danger banner in the bar, the centre name is read-only with a link to Cài đặt chung, all six accent presets are offered, and read-only viewers get no bar;
// fails_when=the save button moves back to the header or duplicates, changed labels are wrong, picking an accent writes data-erp-palette/data-erp-rounded on the document, Hủy keeps edits, version 0 cannot be saved, a failed save drops the edits, a preset disappears, or viewers see the bar;
// why_new=step 9 restyles the branding page around the save bar and adds a scoped preview;
// seam=the website actions module and next/navigation are mocked; personal palette writes go through the injected apply stub; the preview is found by its visible caption (no test-only attributes); no_claim=does not prove the preview colours visually (checked in /dev/settings) nor that saved branding repaints the app (AppAppearance, unchanged)
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveGuardProvider } from "@/features/settings/components/leave-guard";
import { SettingsToc } from "@/features/settings/components/settings-toc";
import { WebsiteEditor } from "@/features/website/editor";
import { createDefaultWebsite } from "@/features/website/schema";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), save: vi.fn() }));
vi.mock("@/features/website/actions", () => ({ saveWebsite: mocks.save }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings/branding", useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

beforeEach(() => {
  document.documentElement.removeAttribute("data-erp-palette");
  document.documentElement.removeAttribute("data-erp-rounded");
  mocks.save.mockResolvedValue({ message: "Đã lưu bản nháp.", ok: true, version: 5 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const applyStub = vi.fn(() => "Bản xem trước không lưu lựa chọn trên trình duyệt.");

/** FileReader whose reads finish only when the test says so, in any order. */
function stubFileReader() {
  const readers: { finish: (result: string) => void }[] = [];
  class ControlledFileReader {
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;
    result: string | null = null;
    readAsDataURL() {
      readers.push({
        finish: (result) => {
          this.result = result;
          this.onload?.();
        },
      });
    }
  }
  vi.stubGlobal("FileReader", ControlledFileReader);
  return readers;
}

function renderBranding(version = 4, canManage = true) {
  return render(
    <WebsiteEditor
      actions={{ applyPersonalAppearance: applyStub }}
      canManage={canManage}
      centerName="Trung tâm Toán Thầy Vinh"
      initialSite={createDefaultWebsite()}
      initialVersion={version}
      initiallyPublished={false}
      mode="branding"
    />,
  );
}

function bar() {
  return screen.getByRole("region", { name: "Thanh lưu thay đổi" });
}

/** Clicks a link; true when the app held the click (leave dialog), false when the link was left to navigate. */
/** Fires a cancelable beforeunload; true when the page asked the browser to confirm leaving. */
function beforeUnloadIsPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

function clickIsHeld(link: HTMLElement): boolean {
  const seen = { held: false };
  // Runs after React's handlers (window is last in the bubble path); then stops jsdom's document navigation.
  const record = (event: MouseEvent) => {
    seen.held = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener("click", record);
  fireEvent.click(link);
  window.removeEventListener("click", record);
  return seen.held;
}

describe("branding page", () => {
  it("keeps the only save button in the bar and lists the changed fields", () => {
    renderBranding();
    expect(screen.getAllByRole("button", { name: "Lưu thay đổi" })).toHaveLength(1);
    expect(within(bar()).getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(bar()).toHaveTextContent("Chưa có thay đổi");

    const accents = within(screen.getByRole("radiogroup", { name: "Màu nhấn" })).getAllByRole("radio");
    expect(accents.map((radio) => radio.closest("label")?.textContent)).toEqual([
      "Xanh rêu#4F6B5A",
      "Đất nung#B83C30",
      "Xanh navy#24348B",
      "Bạc hà#16794C",
      "Trời xanh#215FC7",
      "Tím mận#795096",
    ]);

    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Màu nhấn" })).getByRole("radio", { name: /Đất nung/ }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Bo góc" })).getByRole("radio", { name: "Chuẩn" }));
    fireEvent.change(screen.getByLabelText("Mô tả thương hiệu"), { target: { value: "Học Toán vững vàng." } });

    expect(bar()).toHaveTextContent("3 thay đổi chưa lưu");
    expect(bar()).toHaveTextContent("Mô tả thương hiệu, Màu nhấn, Bo góc");
    expect(within(bar()).getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
  });

  it("previews the accent and corners on its own container, never on <html>", () => {
    renderBranding();
    // Found by its visible caption; the CSS variables replace the removed data-preview-* attributes.
    const preview = screen.getByText("Xem trước · cập nhật theo lựa chọn, chưa lưu").parentElement!;
    expect(preview.style.getPropertyValue("--action-primary")).toBe("#4F6B5A");
    expect(preview.style.getPropertyValue("--radius-md")).toBe("10px");

    fireEvent.click(screen.getByRole("radio", { name: /Xanh navy/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Chuẩn" }));

    expect(preview.style.getPropertyValue("--action-primary")).toBe("#24348B");
    expect(preview.style.getPropertyValue("--radius-md")).toBe("6px");
    expect(document.documentElement).not.toHaveAttribute("data-erp-palette");
    expect(document.documentElement).not.toHaveAttribute("data-erp-rounded");
    expect(document.documentElement.style.getPropertyValue("--action-primary")).toBe("");
  });

  it("restores the last saved values on Hủy", () => {
    renderBranding();
    fireEvent.click(screen.getByRole("radio", { name: /Tím mận/ }));
    fireEvent.click(within(bar()).getByRole("button", { name: "Hủy" }));

    expect(screen.getByRole("radio", { name: /Xanh rêu/ })).toBeChecked();
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    expect(within(bar()).queryByRole("button", { name: "Hủy" })).not.toBeInTheDocument();
  });

  it("lets a never-saved configuration be saved while clean", async () => {
    renderBranding(0);
    expect(bar()).toHaveTextContent("Chưa lưu lần nào");
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ branding: expect.objectContaining({ appPalette: "moss" }) }), 0, "save"));
    expect(await within(bar()).findByRole("status")).toHaveTextContent("Đã lưu bản nháp.");
    // The pending label clears when the transition ends, a tick after the result line.
    await waitFor(() => expect(within(bar()).getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled());
  });

  it("keeps the edits and shows a danger banner in the bar when saving fails", async () => {
    mocks.save.mockResolvedValueOnce({ message: "Không lưu được cài đặt. Nội dung của anh vẫn được giữ trên màn hình.", ok: false });
    renderBranding();
    fireEvent.click(screen.getByRole("radio", { name: /Bạc hà/ }));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));

    expect(await within(bar()).findByRole("alert")).toHaveTextContent("Không lưu được cài đặt.");
    expect(screen.getByRole("radio", { name: /Bạc hà/ })).toBeChecked();
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("shows the centre name read-only with a link to Cài đặt chung", () => {
    renderBranding();
    expect(screen.getByText("Trung tâm Toán Thầy Vinh")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sửa ở Cài đặt chung" })).toHaveAttribute("href", "/settings/general");
    expect(screen.queryByLabelText("Tên trung tâm")).not.toBeInTheDocument();
  });

  it("routes the personal palette through the injected writer", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderBranding();
    const personal = screen.getByRole("heading", { name: "Giao diện của riêng anh" }).closest("section")!;
    fireEvent.click(within(personal).getByRole("button", { name: "Đất nung" }));
    expect(applyStub).toHaveBeenCalledWith("terracotta");
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  // Value: protects=a branding draft that fails websiteSchema (bad HEX) is never sent; the schema message shows as a danger banner inside the save bar and the typed value stays;
  // fails_when=the save-path validation error is routed to the website-only publish banner (silent in branding mode), the guard is dropped and the server is called, or the edit is reset;
  // why_new=step 9 split run() errors into saveError (bar) and publishResult; no test drove a validation failure; seam=none; no_claim=server-side validation (mocked saveWebsite; unit only)
  it("refuses an invalid HEX before calling the server and explains why in the bar", () => {
    renderBranding();
    fireEvent.change(screen.getByLabelText("Mã màu HEX"), { target: { value: "#12" } });
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));

    const banner = within(bar()).getByRole("alert");
    expect(banner).toHaveTextContent("Chưa lưu được.");
    expect(banner).toHaveTextContent("Mã màu gồm # và 6 ký tự hex.");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Mã màu HEX")).toHaveValue("#12");
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
  });

  // Value: protects=without an injected writer the personal palette uses the real browser writer: a preset is stored under erp-appearance and announced, "Theo trung tâm" removes it, and blocked storage shows the fallback line;
  // fails_when=the extracted applyPersonalAppearance stops writing/removing the key, stops dispatching erp-appearance-change, or a storage exception escapes or shows the success line;
  // why_new=step 9 moved the inline writer into applyPersonalAppearance and tests only cover the injected stub; seam=none; no_claim=AppAppearance repaint after the event (unchanged, not exercised)
  it("stores the personal palette in this browser when no writer is injected", () => {
    localStorage.removeItem("erp-appearance");
    const onChange = vi.fn();
    window.addEventListener("erp-appearance-change", onChange);
    render(<WebsiteEditor canManage initialSite={createDefaultWebsite()} initialVersion={4} initiallyPublished={false} mode="branding" />);
    const personal = screen.getByRole("heading", { name: "Giao diện của riêng anh" }).closest("section")!;

    fireEvent.click(within(personal).getByRole("button", { name: "Đất nung" }));
    expect(localStorage.getItem("erp-appearance")).toBe("terracotta");
    expect(within(personal).getByRole("status")).toHaveTextContent("Đã áp dụng trên trình duyệt này.");
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.click(within(personal).getByRole("button", { name: "Theo trung tâm" }));
    expect(localStorage.getItem("erp-appearance")).toBeNull();
    expect(within(personal).getByRole("status")).toHaveTextContent("Đã dùng giao diện mặc định của trung tâm.");

    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    fireEvent.click(within(personal).getByRole("button", { name: "Bạc hà" }));
    expect(within(personal).getByRole("status")).toHaveTextContent("Trình duyệt không cho lưu tùy chọn.");
    setItem.mockRestore();
    window.removeEventListener("erp-appearance-change", onChange);
    localStorage.removeItem("erp-appearance");
  });

  it("gives read-only viewers disabled controls and no save bar", () => {
    renderBranding(4, false);
    expect(screen.queryByRole("region", { name: "Thanh lưu thay đổi" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Xanh rêu/ })).toBeDisabled();
    expect(screen.getByText("Chỉ đọc")).toBeInTheDocument();
  });

  // Value: protects=a branding save call that throws never reaches the error boundary: the danger banner sits in the bar, the edit and dirty count stay, nothing refreshes and the save works again;
  // fails_when=the try/catch around saveWebsite is removed, the edit resets, or the bar stays busy;
  // why_new=only resolved failures were covered; seam=saveWebsite mock rejects; no_claim=the real network failure
  it("keeps the edits and explains when the save call throws", async () => {
    mocks.save.mockRejectedValueOnce(new Error("fetch failed"));
    renderBranding();
    fireEvent.click(screen.getByRole("radio", { name: /Trời xanh/ }));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));

    const banner = await within(bar()).findByRole("alert");
    expect(banner).toHaveTextContent("Chưa lưu được.");
    expect(banner).toHaveTextContent("Không thể kết nối hệ thống.");
    expect(screen.getByRole("radio", { name: /Trời xanh/ })).toBeChecked();
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    expect(mocks.refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(within(bar()).getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled());
  });

  // Value: protects=inside the settings hub, "Sửa ở Cài đặt chung" on a dirty branding page asks before leaving instead of dropping the edits;
  // fails_when=the link goes back to a plain next/link (no leave guard) or the editor stops registering its dirty state;
  // why_new=the guard only covered TOC links; seam=next/navigation mocked (router.push observable); no_claim=browser back/sidebar links (not guarded by design)
  it("asks before following Sửa ở Cài đặt chung while dirty", () => {
    render(
      <LeaveGuardProvider>
        <WebsiteEditor actions={{ applyPersonalAppearance: applyStub }} canManage centerName="Trung tâm Toán Thầy Vinh" initialSite={createDefaultWebsite()} initialVersion={4} initiallyPublished={false} mode="branding" />
      </LeaveGuardProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Tím mận/ }));
    fireEvent.click(screen.getByRole("link", { name: "Sửa ở Cài đặt chung" }));
    const dialog = screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rời trang" }));
    expect(mocks.push).toHaveBeenCalledWith("/settings/general");
  });

  // Value: protects=image picks are validated before touching the draft (oversize or SVG shows the inline alert and leaves the bar clean), the file input is cleared after each pick so the same file can be chosen again after Bỏ ảnh, and a slower earlier read never lands after a newer pick;
  // fails_when=the input value is not reset (the same file cannot be re-picked), a rejected file still changes the draft, or a stale FileReader result overwrites a newer choice;
  // why_new=review found the same file could not be re-picked and a slow read could overwrite a newer pick; seam=jsdom FileReader reads the in-memory File, or a controlled FileReader stub finishes reads in a chosen order; the file list is set through fireEvent; no_claim=real browser file dialogs
  describe("image inputs", () => {
    const png = () => new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" });
    const logoInput = () => screen.getByLabelText("Logo") as HTMLInputElement;

    it("rejects oversize and wrong-type files with an inline alert and a clean draft", () => {
      renderBranding();
      fireEvent.change(logoInput(), { target: { files: [new File([new Uint8Array(250 * 1024 + 1)], "big.png", { type: "image/png" })] } });
      expect(screen.getByRole("alert")).toHaveTextContent("Chọn PNG, JPEG hoặc WebP tối đa 250 KB.");
      expect(bar()).toHaveTextContent("Chưa có thay đổi");

      fireEvent.change(logoInput(), { target: { files: [new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })] } });
      expect(screen.getByRole("alert")).toHaveTextContent("Chọn PNG, JPEG hoặc WebP tối đa 250 KB.");
      expect(screen.queryByRole("img", { name: "Xem trước Logo" })).not.toBeInTheDocument();
      expect(bar()).toHaveTextContent("Chưa có thay đổi");
    });

    it("clears the input after each pick so the same file fires again after Bỏ ảnh", async () => {
      renderBranding();
      const input = logoInput();
      // React tracks the value with an own accessor on the node; spy on that one.
      const valueSetter = Object.getOwnPropertyDescriptor(input, "value")
        ? vi.spyOn(input, "value", "set")
        : vi.spyOn(HTMLInputElement.prototype, "value", "set");
      fireEvent.change(input, { target: { files: [png()] } });
      expect(valueSetter).toHaveBeenCalledWith("");
      valueSetter.mockRestore();
      expect(await screen.findByRole("img", { name: "Xem trước Logo" })).toBeInTheDocument();
      expect(bar()).toHaveTextContent("Logo");

      fireEvent.click(screen.getByRole("button", { name: "Bỏ ảnh" }));
      expect(screen.queryByRole("img", { name: "Xem trước Logo" })).not.toBeInTheDocument();
      expect(bar()).toHaveTextContent("Chưa có thay đổi");

      fireEvent.change(logoInput(), { target: { files: [png()] } });
      expect(await screen.findByRole("img", { name: "Xem trước Logo" })).toBeInTheDocument();
    });

    it("keeps the newer pick when an earlier read finishes last", () => {
      const readers = stubFileReader();
      try {
        renderBranding();
        fireEvent.change(logoInput(), { target: { files: [png()] } });
        fireEvent.change(logoInput(), { target: { files: [png()] } });
        expect(readers).toHaveLength(2);

        act(() => readers[1].finish("data:image/png;base64,TkVX"));
        act(() => readers[0].finish("data:image/png;base64,T0xE"));
        expect(screen.getByRole("img", { name: "Xem trước Logo" })).toHaveAttribute("src", "data:image/png;base64,TkVX");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    // Value: protects=Hủy while an image is still being read drops that read (the image never lands, the bar stays clean) and clears an image error shown before Hủy;
    // fails_when=Hủy does not invalidate in-flight reads (the late result re-dirties a just-cancelled draft), the late result is merged into an old copy of the draft, or the error stays after Hủy;
    // why_new=red-team review: a FileReader result arriving after Hủy revived the cancelled edit; seam=controlled FileReader stub (no timers); no_claim=real file decoding
    it("drops a read in flight and clears image errors on Hủy", () => {
      const readers = stubFileReader();
      try {
        renderBranding();
        fireEvent.click(screen.getByRole("radio", { name: /Bạc hà/ }));
        fireEvent.change(screen.getByLabelText("Favicon"), { target: { files: [new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" })] } });
        expect(screen.getByRole("alert")).toHaveTextContent("Chọn PNG, JPEG hoặc WebP tối đa 250 KB.");
        fireEvent.change(logoInput(), { target: { files: [png()] } });

        fireEvent.click(within(bar()).getByRole("button", { name: "Hủy" }));
        act(() => readers[0].finish("data:image/png;base64,TEFURQ=="));

        expect(screen.queryByRole("img", { name: "Xem trước Logo" })).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(bar()).toHaveTextContent("Chưa có thay đổi");
        expect(screen.getByRole("radio", { name: /Xanh rêu/ })).toBeChecked();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  // Value: protects=a clean editor adopts new server values (site and version) when the page refreshes, so the next save sends the current version; a dirty editor keeps its edits and its version;
  // fails_when=version/saved never resync from props (the next save after an outside change sends a stale version or shows old values), or a refresh wipes unsaved edits;
  // why_new=version/saved never resynced from props after a refresh; seam=rerender with new props stands in for router.refresh; no_claim=the server's version conflict check
  it("adopts refreshed props while clean and keeps edits while dirty", async () => {
    const editor = (site: ReturnType<typeof createDefaultWebsite>, version: number) => (
      <WebsiteEditor actions={{ applyPersonalAppearance: applyStub }} canManage centerName="Trung tâm Toán Thầy Vinh" initialSite={site} initialVersion={version} initiallyPublished={false} mode="branding" />
    );
    const { rerender } = render(editor(createDefaultWebsite(), 4));
    const refreshed = createDefaultWebsite();
    refreshed.branding = { ...refreshed.branding, description: "Mô tả từ máy khác." };
    rerender(editor(refreshed, 6));
    expect(screen.getByLabelText("Mô tả thương hiệu")).toHaveValue("Mô tả từ máy khác.");
    expect(bar()).toHaveTextContent("Chưa có thay đổi");

    fireEvent.click(screen.getByRole("radio", { name: /Bạc hà/ }));
    const later = createDefaultWebsite();
    later.branding = { ...later.branding, description: "Lần thứ ba." };
    rerender(editor(later, 7));
    expect(screen.getByLabelText("Mô tả thương hiệu")).toHaveValue("Mô tả từ máy khác.");
    expect(screen.getByRole("radio", { name: /Bạc hà/ })).toBeChecked();

    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ branding: expect.objectContaining({ appPalette: "mint" }) }), 6, "save"));
  });

  // Value: protects=palette chips show the current choice: "Màu website" presets and the personal palette chips expose aria-pressed and move it on click ("Theo trung tâm" when this browser has no choice);
  // fails_when=chips lose aria-pressed or the pressed chip does not follow the value;
  // why_new=palette chips did not show the current choice; seam=personal writes go through the apply stub; no_claim=the selected colours visually
  it("marks the current palette chip with aria-pressed", () => {
    localStorage.removeItem("erp-appearance");
    renderBranding();
    const website = within(screen.getByRole("heading", { name: "Màu website" }).closest("section")!);
    expect(website.getByRole("button", { name: "Đất nung" })).toHaveAttribute("aria-pressed", "true");
    expect(website.getByRole("button", { name: "Xanh navy" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(website.getByRole("button", { name: "Xanh navy" }));
    expect(website.getByRole("button", { name: "Xanh navy" })).toHaveAttribute("aria-pressed", "true");
    expect(website.getByRole("button", { name: "Đất nung" })).toHaveAttribute("aria-pressed", "false");

    const personal = within(screen.getByRole("heading", { name: "Giao diện của riêng anh" }).closest("section")!);
    expect(personal.getByRole("button", { name: "Theo trung tâm" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(personal.getByRole("button", { name: "Tím mận" }));
    expect(personal.getByRole("button", { name: "Tím mận" })).toHaveAttribute("aria-pressed", "true");
    expect(personal.getByRole("button", { name: "Theo trung tâm" })).toHaveAttribute("aria-pressed", "false");
  });
  // Value: protects=when a newer server draft arrives while the editor is dirty, Hủy adopts that latest draft and its version (not the stale local snapshot), and the next save sends that version;
  // fails_when=Hủy restores the copy from before the refresh (showing outdated content) or keeps the old version so the next save is refused as a conflict;
  // why_new=api-contract review: cancel() restored the old local snapshot and version after a refresh landed during editing; seam=rerender with new props stands in for router.refresh; no_claim=the server's version check
  it("adopts the latest server draft and version on Hủy after a refresh while dirty", async () => {
    const editor = (site: ReturnType<typeof createDefaultWebsite>, version: number) => (
      <WebsiteEditor actions={{ applyPersonalAppearance: applyStub }} canManage centerName="Trung tâm Toán Thầy Vinh" initialSite={site} initialVersion={version} initiallyPublished={false} mode="branding" />
    );
    const { rerender } = render(editor(createDefaultWebsite(), 6));
    fireEvent.click(screen.getByRole("radio", { name: /Bạc hà/ }));
    const newer = createDefaultWebsite();
    newer.branding = { ...newer.branding, description: "Bản mới từ máy khác." };
    rerender(editor(newer, 7));
    expect(screen.getByLabelText("Mô tả thương hiệu")).toHaveValue("");

    fireEvent.click(within(bar()).getByRole("button", { name: "Hủy" }));
    expect(screen.getByLabelText("Mô tả thương hiệu")).toHaveValue("Bản mới từ máy khác.");
    expect(screen.getByRole("radio", { name: /Xanh rêu/ })).toBeChecked();
    expect(bar()).toHaveTextContent("Chưa có thay đổi");

    fireEvent.click(screen.getByRole("radio", { name: /Tím mận/ }));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ branding: expect.objectContaining({ appPalette: "plum", description: "Bản mới từ máy khác." }) }), 7, "save"));
  });

  // Value: protects=the leave dialog is hosted once by the provider, outside the page: with the TOC and the branding card's GuardedLink both mounted there is exactly one dialog, it is not inside the editor, a <p> or the branding <fieldset>, and its buttons are enabled;
  // fails_when=GuardedLink or a TOC link renders its own dialog again (two dialogs, invalid <p> nesting, buttons disabled by the fieldset, scrim under the save bar), or the provider stops hosting it;
  // why_new=QA confirmed the dialog DOM inside a <p> and the disabled fieldset, with the save bar drawn above its scrim; seam=next/navigation mocked; the real SettingsToc and editor are mounted under one provider; no_claim=the visual stacking (checked in /dev/settings)
  it("hosts one leave dialog outside the editor and the form", () => {
    const { container } = render(
      <LeaveGuardProvider>
        <SettingsToc canViewAudit canViewUsers />
        <div id="editor-host">
          <WebsiteEditor actions={{ applyPersonalAppearance: applyStub }} canManage centerName="Trung tâm Toán Thầy Vinh" initialSite={createDefaultWebsite()} initialVersion={4} initiallyPublished={false} mode="branding" />
        </div>
      </LeaveGuardProvider>,
    );
    const editorRoot = container.querySelector("#editor-host")!.firstElementChild!;
    fireEvent.click(screen.getByRole("radio", { name: /Tím mận/ }));
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);

    const link = screen.getByRole("link", { name: "Sửa ở Cài đặt chung" });
    expect(link.closest("p, fieldset")).toBeNull();
    fireEvent.click(link);
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    const dialog = screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" });
    expect(editorRoot.contains(dialog)).toBe(false);
    expect(dialog.closest("p, fieldset")).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Rời trang" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Ở lại" })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ở lại" }));
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);

    // The TOC asks through the same dialog.
    fireEvent.click(within(screen.getByRole("navigation", { name: "Mục cài đặt" })).getByRole("link", { name: "Chung" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(editorRoot.contains(screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" }))).toBe(false);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Ở lại" }));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /Tím mận/ })).toBeChecked();
  });

  // Value: protects=leaving during an in-flight save never discards or cuts it short: a hub link clicked while saving navigates without the dialog and without running Hủy, and when the save resolves the editor is clean, shows the submitted choice and announces the result in the bar's live region;
  // fails_when=the editor keeps its leave guard registered while saving (the dialog appears, or "Rời trang" runs Hủy and the save then marks the old values as saved), or the cancel callback runs during a save;
  // why_new=four reviewers found that leaving during a save discarded the draft the save was writing; seam=saveWebsite is a deferred promise; next/navigation mocked; a click the app does not hold is left to the link (jsdom); no_claim=Next's real navigation or route cache
  it("lets a hub link leave during a save without discarding it", async () => {
    let release: ((value: { message: string; ok: true; version: number }) => void) | undefined;
    mocks.save.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(
      <LeaveGuardProvider>
        <WebsiteEditor actions={{ applyPersonalAppearance: applyStub }} canManage centerName="Trung tâm Toán Thầy Vinh" initialSite={createDefaultWebsite()} initialVersion={4} initiallyPublished={false} mode="branding" />
      </LeaveGuardProvider>,
    );
    const status = within(bar()).getByRole("status");
    expect(status.textContent).toBe("");
    fireEvent.click(screen.getByRole("radio", { name: /Tím mận/ }));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));
    expect(screen.getByRole("radio", { name: /Tím mận/ })).toBeDisabled();

    expect(clickIsHeld(screen.getByRole("link", { name: "Sửa ở Cài đặt chung" }))).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /Tím mận/ })).toBeChecked();

    await act(async () => release?.({ message: "Đã lưu bản nháp.", ok: true, version: 5 }));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ branding: expect.objectContaining({ appPalette: "plum" }) }), 4, "save");
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    expect(screen.getByRole("radio", { name: /Tím mận/ })).toBeChecked();
    expect(within(bar()).getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Đã lưu bản nháp.");
  });

  // Value: protects=a reload or tab close while the branding save is in flight asks first (beforeunload is prevented although the leave guard is off during the save) without running Hủy, and stops asking once the save settles clean;
  // fails_when=the editor drops its save-in-flight guard (a reload silently cuts the request), the guard runs Hủy so the choice reverts, or the listener stays after the save so every later reload prompts;
  // why_new=adversarial review: turning the leave guard off while saving also removed the reload/close prompt during the save; seam=saveWebsite is a deferred promise; a synthetic cancelable beforeunload event stands in for the browser; no_claim=the browser's native prompt itself
  it("asks before a reload or close while the save is in flight", async () => {
    let release: ((value: { message: string; ok: true; version: number }) => void) | undefined;
    mocks.save.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(
      <LeaveGuardProvider>
        <WebsiteEditor actions={{ applyPersonalAppearance: applyStub }} canManage centerName="Trung tâm Toán Thầy Vinh" initialSite={createDefaultWebsite()} initialVersion={4} initiallyPublished={false} mode="branding" />
      </LeaveGuardProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Tím mận/ }));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));
    expect(screen.getByRole("radio", { name: /Tím mận/ })).toBeDisabled();

    expect(beforeUnloadIsPrevented()).toBe(true);
    expect(screen.getByRole("radio", { name: /Tím mận/ })).toBeChecked();

    await act(async () => release?.({ message: "Đã lưu bản nháp.", ok: true, version: 5 }));
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    expect(beforeUnloadIsPrevented()).toBe(false);
  });

  // Value: protects="Rời trang" really discards the branding draft before navigating: the editor is back at the saved values with a clean bar, so a hidden copy of the route cannot revive the draft later;
  // fails_when=the provider navigates without calling the registered discard, or the editor stops passing its Hủy as the discard;
  // why_new=red-team review: leaving kept the draft in Next's hidden route copy; seam=next/navigation mocked (router.push observable); no_claim=Next's route cache itself
  it("discards the draft on Rời trang", () => {
    render(
      <LeaveGuardProvider>
        <WebsiteEditor actions={{ applyPersonalAppearance: applyStub }} canManage centerName="Trung tâm Toán Thầy Vinh" initialSite={createDefaultWebsite()} initialVersion={4} initiallyPublished={false} mode="branding" />
      </LeaveGuardProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Tím mận/ }));
    fireEvent.click(screen.getByRole("link", { name: "Sửa ở Cài đặt chung" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Rời trang" }));

    expect(mocks.push).toHaveBeenCalledWith("/settings/general");
    expect(screen.getByRole("radio", { name: /Xanh rêu/ })).toBeChecked();
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
  });

  // Value: protects=read-only viewers see why the controls are disabled ("Cần quyền settings.manage để sửa thương hiệu và website." next to Chỉ đọc) and the centre-name link reads "Xem ở Cài đặt chung" instead of promising an edit;
  // fails_when=the text reason disappears (design hard rule: disabled needs a reason) or viewers are told to "Sửa";
  // why_new=design review of the read-only branding page; seam=none; no_claim=the server permission check
  it("explains the read-only state and links viewers to view Cài đặt chung", () => {
    renderBranding(4, false);
    expect(screen.getByText("Cần quyền settings.manage để sửa thương hiệu và website.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem ở Cài đặt chung" })).toHaveAttribute("href", "/settings/general");
    expect(screen.queryByRole("link", { name: "Sửa ở Cài đặt chung" })).not.toBeInTheDocument();
  });
});
