import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TuitionPreview, type TuitionPreviewRole, type TuitionPreviewState, type TuitionPreviewView } from "./tuition-preview";

export const metadata: Metadata = {
  title: "Kỳ thu học phí · dev",
  robots: { index: false, follow: false },
};

const views: TuitionPreviewView[] = ["list", "draft", "locked"];
const roles: TuitionPreviewRole[] = ["owner", "accountant"];
const states: TuitionPreviewState[] = ["normal", "ready", "empty", "errors"];

/**
 * Tuition period list and period page preview mirroring `07-tai-chinh.dc.html`
 * (frames 7a, 7b) with fixture data inside the shell.
 * `?view=list|draft|locked&role=owner|accountant&state=normal|ready|empty|errors`.
 * Every write is stubbed (previewActions): the preview never calls a server action.
 * Development only: 404 in production.
 */
export default async function DevTuitionPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; state?: string; view?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { role, state, view } = await searchParams;

  return (
    <TuitionPreview
      role={roles.includes(role as TuitionPreviewRole) ? (role as TuitionPreviewRole) : "owner"}
      state={states.includes(state as TuitionPreviewState) ? (state as TuitionPreviewState) : "normal"}
      view={views.includes(view as TuitionPreviewView) ? (view as TuitionPreviewView) : "list"}
    />
  );
}
