/* eslint-disable @next/next/no-img-element -- Images are validated inline data URLs; no remote optimizer is needed. */
"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { cn } from "@/lib/utils";
import { palettePresets, type Branding, type Palette } from "./schema";

const storageKey = "erp-appearance";
export function applyAppearance(palette: Palette, rounded: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-erp-palette", palette);
  root.setAttribute("data-erp-rounded", String(rounded));
}
export function AppAppearance({ branding }: { branding: Branding }) {
  useEffect(() => {
    const apply = () => {
      let choice = branding.appPalette;
      try { const value = localStorage.getItem(storageKey); if (value && Object.hasOwn(palettePresets, value)) choice = value as Palette; } catch { /* Browser storage may be unavailable. */ }
      applyAppearance(choice, branding.rounded);
    };
    apply(); window.addEventListener("erp-appearance-change", apply); window.addEventListener("storage", apply);
    let icon = document.querySelector<HTMLLinkElement>('link[data-brand-icon]');
    if (branding.favicon) { if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; icon.dataset.brandIcon = "true"; document.head.append(icon); } icon.href = branding.favicon; }
    else icon?.remove();
    return () => { window.removeEventListener("erp-appearance-change", apply); window.removeEventListener("storage", apply); };
  }, [branding]);
  return null;
}
/** Writes the personal palette for this browser. `null` follows the centre's default. */
export function applyPersonalAppearance(palette: Palette | null): string {
  try {
    if (palette) localStorage.setItem(storageKey, palette);
    else localStorage.removeItem(storageKey);
    window.dispatchEvent(new Event("erp-appearance-change"));
    return palette ? "Đã áp dụng trên trình duyệt này." : "Đã dùng giao diện mặc định của trung tâm.";
  } catch {
    return palette ? "Trình duyệt không cho lưu tùy chọn." : "Không thể lưu tùy chọn.";
  }
}

/** Selected look for `brand-choice` chips with `aria-pressed` (primary border + primary-soft fill). */
export const choiceSelectedClassName =
  "aria-pressed:border-action-primary! aria-pressed:bg-action-primary-soft! aria-pressed:text-action-primary!";

function readPersonalPalette(): Palette | null {
  try {
    const value = localStorage.getItem(storageKey);
    return value && Object.hasOwn(palettePresets, value) ? (value as Palette) : null;
  } catch {
    return null;
  }
}

function subscribePersonalPalette(onChange: () => void): () => void {
  window.addEventListener("erp-appearance-change", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("erp-appearance-change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Personal accent for this browser only (never the centre's branding).
 * `apply` replaces the localStorage write (the /dev/settings preview passes a stub).
 * The current choice is read from this browser (null = follow the centre) and
 * marked with aria-pressed; a click marks its chip even when `apply` is a stub.
 */
export function PersonalAppearance({ apply = applyPersonalAppearance }: { apply?: (palette: Palette | null) => string } = {}) {
  const [message, setMessage] = useState("");
  const stored = useSyncExternalStore(subscribePersonalPalette, readPersonalPalette, () => null);
  const [picked, setPicked] = useState<{ palette: Palette | null } | null>(null);
  const currentChoice = picked ? picked.palette : stored;
  const choose = (palette: Palette | null) => {
    setPicked({ palette });
    setMessage(apply(palette));
  };
  return (
    <SettingsCard description="Lưu trên trình duyệt này; không đổi màu thương hiệu của trung tâm." title="Giao diện của riêng anh">
      <div className="flex flex-wrap gap-2">
        {Object.entries(palettePresets).map(([key, color]) => (
          <button aria-pressed={currentChoice === key} className={cn("brand-choice", choiceSelectedClassName)} key={key} onClick={() => choose(key as Palette)} type="button">
            <span aria-hidden="true" className="inline-block h-5 w-5 rounded-full" style={{ background: color }} />
            {paletteLabels[key as Palette]}
          </button>
        ))}
        <button aria-pressed={currentChoice === null} className={cn("brand-choice", choiceSelectedClassName)} onClick={() => choose(null)} type="button">Theo trung tâm</button>
      </div>
      <p className="mt-3 text-sm" role="status">{message}</p>
    </SettingsCard>
  );
}
export const paletteLabels: Record<Palette, string> = { moss: "Xanh rêu", terracotta: "Đất nung", navy: "Xanh navy", mint: "Bạc hà", ocean: "Trời xanh", plum: "Tím mận" };

const BrandingContext = createContext<Branding | null>(null);
export function BrandingProvider({ branding, children }: { branding: Branding; children: ReactNode }) { return <BrandingContext.Provider value={branding}><AppAppearance branding={branding} />{children}</BrandingContext.Provider>; }
export function BrandLogo({ fallback }: { fallback: ReactNode }) { const branding = useContext(BrandingContext); return branding?.logo ? ( <img alt="Logo trung tâm" src={branding.logo} className="h-8 w-8 flex-none object-contain" />) : fallback; }
