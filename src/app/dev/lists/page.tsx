import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ListsPreview } from "./lists-preview";

export const metadata: Metadata = {
  title: "Danh sách · dev",
  robots: { index: false, follow: false },
};

/**
 * Directory previews mirroring `06-danh-sach-hoc-sinh-va-lop.dc.html` with
 * fixture data inside the shell. Development only: production answers 404.
 */
export default async function DevListsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { view } = await searchParams;

  return <ListsPreview view={view === "classes" ? "classes" : "students"} />;
}
