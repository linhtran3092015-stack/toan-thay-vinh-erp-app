"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button, type ButtonSize } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Longest wait for the sheets' QR images before asking whether to print anyway. */
const IMAGE_WAIT_MS = 8_000;

const MISSING_QR_WARNING = "Một số mã QR chưa tải được; kiểm tra trước khi in.";

/** The images on the page's A5 sheets (the locked VietQR codes). */
function noticeImages(): HTMLImageElement[] {
  return Array.from(document.querySelectorAll<HTMLImageElement>(".fee-notice-a5 img"));
}

/** true when the image has (or gets) pixels; false when it failed. */
function settleImage(image: HTMLImageElement): Promise<boolean> {
  if (image.complete) return Promise.resolve(image.naturalWidth > 0);
  if (typeof image.decode === "function") return image.decode().then(() => true, () => false);
  return new Promise((resolve) => {
    image.addEventListener("load", () => resolve(true), { once: true });
    image.addEventListener("error", () => resolve(false), { once: true });
  });
}

/** Waits for every image, at most IMAGE_WAIT_MS overall; false when one failed or was still loading. */
async function waitForImages(images: readonly HTMLImageElement[]): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), IMAGE_WAIT_MS);
  });
  try {
    return await Promise.race([Promise.all(images.map(settleImage)).then((loaded) => loaded.every(Boolean)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Opens the browser print dialog (payslip-toolbar precedent) once the QR
 * images on the page's sheets have loaded, so no sheet prints with an empty QR
 * box by accident. When every image has already loaded it prints within the
 * click; otherwise the button shows its loading state while it waits. When an
 * image failed or the wait ran out it does not print: it shows a warning under
 * the button and relabels it (`anywayLabel`), and the next click prints
 * anyway. Nothing prints once the button has unmounted.
 *
 * Previews pass `onPrint`: it runs at once instead of `window.print()` (their
 * QR is a local placeholder), so nothing calls the real dialog there.
 */
export function TuitionPrintButton({
  anywayLabel = "Vẫn in",
  children,
  className,
  onPrint,
  size = "md",
  variant = "secondary",
}: {
  /** The label once some QR failed to load: the next click prints anyway. */
  anywayLabel?: ReactNode;
  children: ReactNode;
  className?: string;
  onPrint?: () => void;
  size?: ButtonSize;
  variant?: "primary" | "secondary";
}) {
  const [waiting, setWaiting] = useState(false);
  const [imagesMissing, setImagesMissing] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const print = async () => {
    if (onPrint) {
      onPrint();
      return;
    }
    if (imagesMissing) {
      // Second click after the warning: print as is, and check again next time.
      setImagesMissing(false);
      window.print();
      return;
    }
    const images = noticeImages();
    if (images.every((image) => image.complete)) {
      if (images.some((image) => image.naturalWidth === 0)) setImagesMissing(true);
      else window.print();
      return;
    }
    setWaiting(true);
    const loaded = await waitForImages(images);
    if (!mounted.current) return;
    setWaiting(false);
    if (loaded) window.print();
    else setImagesMissing(true);
  };

  return (
    // Stacked, so the warning wraps under the button instead of widening the
    // header actions. Left-aligned on phones (where the actions are), right-aligned from md.
    <div className="flex flex-col items-start md:items-end">
      <Button className={cn("max-md:h-11", className)} isLoading={waiting} onClick={() => void print()} size={size} type="button" variant={variant}>
        {waiting ? null : <Printer aria-hidden="true" className="h-4 w-4" />}
        <span>{imagesMissing ? anywayLabel : children}</span>
      </Button>
      {/* Always mounted (and never display:none) so the warning is announced
          when it appears; the gap only exists while it has text. */}
      <p aria-live="polite" className="max-w-xs text-left text-caption text-warning-ink md:text-right [&:not(:empty)]:mt-1">
        {imagesMissing ? MISSING_QR_WARNING : null}
      </p>
    </div>
  );
}
