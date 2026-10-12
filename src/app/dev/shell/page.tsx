import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ShellPreview } from "./shell-preview";

export const metadata: Metadata = {
  title: "Khung ứng dụng · dev",
  robots: { index: false, follow: false },
};

/**
 * Shell preview mirroring `01-khung-ung-dung.dc.html` with a fake user and
 * owner permissions. Development only: production builds answer 404.
 */
export default async function DevShellPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; role?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { path, role } = await searchParams;

  return (
    <ShellPreview
      path={path?.startsWith("/") ? path : "/finance/tuition-periods"}
      role={role === "ta" ? "ta" : "owner"}
    />
  );
}
