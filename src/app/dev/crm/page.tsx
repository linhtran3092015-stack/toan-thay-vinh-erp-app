import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CrmPreview, type CrmPreviewRole, type CrmPreviewState, type CrmPreviewView } from "./crm-preview";

export const metadata: Metadata = {
  title: "CRM · dev",
  robots: { index: false, follow: false },
};

const views: CrmPreviewView[] = ["list", "detail"];
const roles: CrmPreviewRole[] = ["sale", "leader", "owner"];
const states: CrmPreviewState[] = ["normal", "empty", "errors", "converted", "dropped"];

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * CRM preview mirroring `12-crm.dc.html` (frames 12a, 12b) with fixture data
 * inside the shell.
 * `?view=list|detail&state=normal|empty|errors|converted|dropped&role=sale|leader|owner`
 * (plus `status`, written by the list's own chips and filters).
 * Every CRM server action is an inert stub (previewCrmActions): the preview
 * never calls a server action. Development only: 404 in production.
 */
export default async function DevCrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const view = first(params.view);
  const role = first(params.role);
  const state = first(params.state);

  return (
    <CrmPreview
      role={roles.includes(role as CrmPreviewRole) ? (role as CrmPreviewRole) : "owner"}
      state={states.includes(state as CrmPreviewState) ? (state as CrmPreviewState) : "normal"}
      statusFilter={first(params.status) ?? null}
      view={views.includes(view as CrmPreviewView) ? (view as CrmPreviewView) : "list"}
    />
  );
}
