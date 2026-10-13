import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClassPreview, type ClassPreviewState } from "./class-preview";

export const metadata: Metadata = {
  title: "Chi tiết lớp · dev",
  robots: { index: false, follow: false },
};

const states: ClassPreviewState[] = ["active", "unscheduled", "draft", "closed", "composite"];

/**
 * Class detail preview mirroring `03-chi-tiet-lop.dc.html` with fixture data
 * inside the shell. Development only: 404 in production.
 */
export default async function DevClassPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; role?: string; tab?: string; period?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { period, role, state, tab } = await searchParams;
  const resolved = states.includes(state as ClassPreviewState) ? (state as ClassPreviewState) : "active";

  return (
    <ClassPreview initialTab={tab} role={role === "ta" ? "ta" : "owner"} state={resolved} tuitionPeriod={period === "draft" ? "draft" : "locked"} />
  );
}
