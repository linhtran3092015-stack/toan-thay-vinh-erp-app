import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Gate for every `/dev/*` design preview: 404 in production so fixture pages
 * never ship, even if a new preview forgets its own page-level check.
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return children;
}
