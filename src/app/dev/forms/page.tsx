import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormsPreview } from "./forms-preview";
import { parseFormsPreviewParams } from "./forms-preview-params";

export const metadata: Metadata = {
  title: "Form · dev",
  robots: { index: false, follow: false },
};

/**
 * Form previews mirroring `17-form-va-wizard.dc.html` (frames 17a, 17b) with
 * fixture data inside the shell.
 * `?view=student|student-edit|class|class-edit|batch&role=owner|ta|viewer&state=…`;
 * `state` depends on the view (student: clean|dirty|error|duplicate|sibling;
 * class: clean|error|no-year; batch: default|holidays|capped|empty) and every
 * param falls back to its first value. Every write is an inert stub in the
 * lane bodies. Development only: production answers 404.
 */
export default async function DevFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[]; state?: string | string[]; view?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <FormsPreview {...parseFormsPreviewParams(await searchParams)} />;
}
