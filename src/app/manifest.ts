import type { MetadataRoute } from "next";

import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR } from "@/config/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Toán Thầy Vinh ERP",
    short_name: "TTV ERP",
    description: "Hệ thống quản trị giáo dục Toán Thầy Vinh",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
