import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ZaloGroupsPreview, type ZaloGroupsPreviewState } from "./zalo-groups-preview";

export const metadata: Metadata = {
  title: "Liên kết nhóm Zalo · dev",
  robots: { index: false, follow: false },
};

const states: ZaloGroupsPreviewState[] = ["ready", "not-configured", "crm-error", "nick-offline"];

/**
 * Bulk Zalo group link page with fixture students and ZaloCRM groups inside the shell.
 * `?state=ready|not-configured|crm-error|nick-offline`. Saving is an inert stub
 * that reports one failed row; the per-row "Tìm nhóm" dialog still calls its
 * real (permission-checked) action. Development only: 404 in production.
 */
export default async function DevZaloGroupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const params = await searchParams;
  const state = typeof params.state === "string" ? params.state : undefined;
  return <ZaloGroupsPreview state={states.includes(state as ZaloGroupsPreviewState) ? (state as ZaloGroupsPreviewState) : "ready"} />;
}
