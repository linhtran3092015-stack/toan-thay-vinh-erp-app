import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UiGallery } from "./ui-gallery";

export const metadata: Metadata = {
  title: "Thư viện component · dev",
  robots: { index: false, follow: false },
};

/**
 * Component preview mirroring `10-thu-vien-component.dc.html`. Development
 * only: production builds answer 404 and the proxy never treats it as public.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <UiGallery />;
}
