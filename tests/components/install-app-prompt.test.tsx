import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InstallAppPrompt } from "@/components/shared/install-app-prompt";
import { INSTALL_PROMPT_DISMISSED_KEY } from "@/config/pwa";

const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IOS_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36";

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: userAgent });
}

function setStandalone(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)" ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  });
}

function dispatchBeforeInstallPrompt(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  localStorage.clear();
  setStandalone(false);
  setUserAgent(ANDROID_CHROME_UA);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("InstallAppPrompt", () => {
  it("renders nothing until the browser offers an install prompt", () => {
    render(<InstallAppPrompt />);

    expect(screen.queryByRole("dialog", { name: "Cài ứng dụng" })).not.toBeInTheDocument();
  });

  it("shows an install button on Android and forwards to the native prompt", async () => {
    render(<InstallAppPrompt />);

    const event = dispatchBeforeInstallPrompt("accepted");
    expect(event.defaultPrevented).toBe(true);

    const button = await screen.findByRole("button", { name: "Cài app" });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Cài ứng dụng" })).not.toBeInTheDocument();
  });

  it("shows the Share → Add to Home Screen hint on iOS Safari", () => {
    setUserAgent(IOS_SAFARI_UA);

    render(<InstallAppPrompt />);

    expect(screen.getByRole("dialog", { name: "Cài ứng dụng" })).toHaveTextContent(
      "Thêm vào MH chính",
    );
    expect(screen.queryByRole("button", { name: "Cài app" })).not.toBeInTheDocument();
  });

  it("does not show the iOS hint in third-party iOS browsers", () => {
    setUserAgent(IOS_CHROME_UA);

    render(<InstallAppPrompt />);

    expect(screen.queryByRole("dialog", { name: "Cài ứng dụng" })).not.toBeInTheDocument();
  });

  it("stays hidden when already running as an installed app", () => {
    setUserAgent(IOS_SAFARI_UA);
    setStandalone(true);

    render(<InstallAppPrompt />);
    dispatchBeforeInstallPrompt("accepted");

    expect(screen.queryByRole("dialog", { name: "Cài ứng dụng" })).not.toBeInTheDocument();
  });

  it("snoozes the banner after dismissal", () => {
    setUserAgent(IOS_SAFARI_UA);

    const { unmount } = render(<InstallAppPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "Đóng gợi ý cài ứng dụng" }));

    expect(screen.queryByRole("dialog", { name: "Cài ứng dụng" })).not.toBeInTheDocument();
    expect(localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY)).not.toBeNull();

    unmount();
    render(<InstallAppPrompt />);

    expect(screen.queryByRole("dialog", { name: "Cài ứng dụng" })).not.toBeInTheDocument();
  });
});
