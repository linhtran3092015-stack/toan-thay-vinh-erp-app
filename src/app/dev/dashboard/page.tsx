import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardPreview, type DashboardPreviewRole, type DashboardPreviewState } from "./dashboard-preview";

export const metadata: Metadata = {
  title: "Tổng quan · dev",
  robots: { index: false, follow: false },
};

const roles: DashboardPreviewRole[] = ["owner", "accountant", "ta"];
const states: DashboardPreviewState[] = ["normal", "empty", "errors"];

/**
 * Home dashboard preview mirroring `02-tong-quan.dc.html` with fixture data
 * inside the shell. `?role=owner|accountant|ta&state=normal|empty|errors`.
 * Development only: 404 in production.
 */
export default async function DevDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; state?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { role, state } = await searchParams;

  return (
    <DashboardPreview
      role={roles.includes(role as DashboardPreviewRole) ? (role as DashboardPreviewRole) : "owner"}
      state={states.includes(state as DashboardPreviewState) ? (state as DashboardPreviewState) : "normal"}
    />
  );
}
