"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  INSTALL_PROMPT_DISMISSED_KEY,
  INSTALL_PROMPT_SNOOZE_MS,
} from "@/config/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallEnvironment = "unavailable" | "ios" | "browser";

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const isIphoneLike = /iPhone|iPad|iPod/i.test(userAgent);
  // iPadOS 13+ reports itself as a Mac but still has a touch screen.
  const isIpadDesktopMode = /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
  if (!isIphoneLike && !isIpadDesktopMode) return false;
  // Only Safari exposes "Add to Home Screen" from the share sheet.
  return /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
}

function isSnoozed(now: number): boolean {
  try {
    const raw = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return Number.isFinite(dismissedAt) && now - dismissedAt < INSTALL_PROMPT_SNOOZE_MS;
  } catch {
    return false;
  }
}

function snooze(now: number) {
  try {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, String(now));
  } catch {
    // Browser storage may be unavailable; the banner simply shows again next load.
  }
}

// Snapshots are primitive strings so useSyncExternalStore can compare them by value.
const subscribeToEnvironment = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
const getEnvironment = (): InstallEnvironment => {
  if (isStandalone() || isSnoozed(Date.now())) return "unavailable";
  return isIosSafari(navigator.userAgent, navigator.maxTouchPoints ?? 0) ? "ios" : "browser";
};
const getServerEnvironment = (): InstallEnvironment => "unavailable";

/**
 * Suggests installing the ERP as an app. Android/Chromium: wraps the native
 * `beforeinstallprompt` flow. iOS Safari (no such event): shows the manual
 * "Share → Add to Home Screen" instructions. Hidden once running standalone.
 */
export function InstallAppPrompt() {
  const environment = useSyncExternalStore(
    subscribeToEnvironment,
    getEnvironment,
    getServerEnvironment,
  );
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDismissed(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (environment === "unavailable" || dismissed) return null;

  const kind = installEvent ? "android" : environment === "ios" ? "ios" : null;
  if (kind === null) return null;

  const dismiss = () => {
    snooze(Date.now());
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      setDismissed(true);
    } else {
      dismiss();
    }
  };

  // A settings StickySaveBar publishes --save-bar-h: the prompt sits above it, not half under it.
  return (
    <div
      aria-label="Cài ứng dụng"
      className="fixed inset-x-3 bottom-[calc(var(--save-bar-h,0px)+var(--safe-area-bottom)+12px)] z-40 mx-auto flex max-w-md items-start gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3 text-sm text-text-strong shadow-[var(--elevation-2)] md:left-auto md:right-4 print:hidden"
      role="dialog"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Cài TTV ERP lên màn hình chính</p>
        {kind === "android" ? (
          <p className="mt-1 text-text-muted">
            Mở nhanh như ứng dụng, không cần tìm lại trình duyệt.
          </p>
        ) : (
          <p className="mt-1 text-text-muted">
            Trong Safari, bấm{" "}
            <span className="inline-flex items-center gap-1 font-medium text-text-strong">
              <Share aria-hidden="true" className="h-4 w-4" />
              Chia sẻ
            </span>{" "}
            rồi chọn <span className="font-medium text-text-strong">Thêm vào MH chính</span>.
          </p>
        )}
        {kind === "android" ? (
          <div className="mt-2">
            <Button onClick={install} size="sm" type="button">
              Cài app
            </Button>
          </div>
        ) : null}
      </div>
      <button
        aria-label="Đóng gợi ý cài ứng dụng"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
        onClick={dismiss}
        type="button"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
