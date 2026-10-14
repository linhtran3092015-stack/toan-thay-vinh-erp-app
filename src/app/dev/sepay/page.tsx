import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SepayPreview, type SepayPreviewRole, type SepayPreviewState, type SepayPreviewTab } from "./sepay-preview";

export const metadata: Metadata = {
  title: "Giao dịch SePay · dev",
  robots: { index: false, follow: false },
};

const tabs: SepayPreviewTab[] = ["review", "all"];
const roles: SepayPreviewRole[] = ["owner", "accountant"];
const states: SepayPreviewState[] = ["normal", "empty", "errors"];

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * SePay reconciliation preview mirroring `07-tai-chinh.dc.html` (frame 7c)
 * with fixture data inside the shell.
 * `?tab=review|all&role=owner|accountant&state=normal|empty|errors`
 * (plus `tx` and `status`, written and read by the queue itself).
 * Every write and read action is an inert stub (previewSepayActions): the
 * preview never calls a server action. Development only: 404 in production.
 */
export default async function DevSepayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const tab = first(params.tab);
  const role = first(params.role);
  const state = first(params.state);

  return (
    <SepayPreview
      role={roles.includes(role as SepayPreviewRole) ? (role as SepayPreviewRole) : "owner"}
      state={states.includes(state as SepayPreviewState) ? (state as SepayPreviewState) : "normal"}
      tab={tabs.includes(tab as SepayPreviewTab) ? (tab as SepayPreviewTab) : "review"}
    />
  );
}
