/* eslint-disable @next/next/no-img-element -- Images are validated inline data URLs; no remote optimizer is needed. */
"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
export function PersonalAppearance() {
  const [message, setMessage] = useState("");
  return <section className="brand-panel"><h2>Giao diện của riêng anh</h2><p className="text-text-muted">Lưu trên trình duyệt này; không đổi màu thương hiệu của trung tâm.</p><div className="mt-4 flex flex-wrap gap-2">{Object.entries(palettePresets).map(([key, color]) => <button type="button" key={key} className="brand-choice" onClick={() => {
    try { localStorage.setItem(storageKey, key); window.dispatchEvent(new Event("erp-appearance-change")); setMessage("Đã áp dụng trên trình duyệt này."); } catch { setMessage("Trình duyệt không cho lưu tùy chọn."); }
  }}><span aria-hidden="true" style={{ background: color }} className="inline-block h-5 w-5 rounded-full" />{paletteLabels[key as Palette]}</button>)}<button className="brand-choice" type="button" onClick={() => { try { localStorage.removeItem(storageKey); window.dispatchEvent(new Event("erp-appearance-change")); setMessage("Đã dùng giao diện mặc định của trung tâm."); } catch { setMessage("Không thể lưu tùy chọn."); } }}>Theo trung tâm</button></div><p role="status" className="mt-3 text-sm">{message}</p></section>;
}
export const paletteLabels: Record<Palette, string> = { terracotta: "Đỏ ấm", navy: "Xanh navy", mint: "Bạc hà", ocean: "Trời xanh", plum: "Tím mận" };

const BrandingContext = createContext<Branding | null>(null);
export function BrandingProvider({ branding, children }: { branding: Branding; children: ReactNode }) { return <BrandingContext.Provider value={branding}><AppAppearance branding={branding} />{children}</BrandingContext.Provider>; }
export function BrandLogo({ fallback }: { fallback: ReactNode }) { const branding = useContext(BrandingContext); return branding?.logo ? ( <img alt="Logo trung tâm" src={branding.logo} className="h-8 w-8 flex-none object-contain" />) : fallback; }
