import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ImportsPreview } from "./imports-preview";
import { parseImportsPreviewParams } from "./imports-preview-params";

export const metadata: Metadata = {
  title: "Nhập dữ liệu · dev",
  robots: { index: false, follow: false },
};

/**
 * Import wizard previews mirroring `17-form-va-wizard.dc.html` (frame 17c)
 * with fixture data inside the shell.
 * `?view=students|enrollments|classes|class-batch|balances|balance-batch&role=owner|maker|viewer&state=…`;
 * `state` depends on the view (students: file|mapping|review-errors|review-clean|done;
 * enrollments: file|review|batch|done; classes: file|mapping|review-conflicts|review-clean;
 * class-batch: ready|committed|previewed; balances: file|review|list;
 * balance-batch: reconcile|approve|approve-own|post|posted) and every param
 * falls back to its first value. Every write is an inert stub in the lane
 * bodies. Development only: production answers 404.
 */
export default async function DevImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[]; state?: string | string[]; view?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ImportsPreview {...parseImportsPreviewParams(await searchParams)} />;
}
