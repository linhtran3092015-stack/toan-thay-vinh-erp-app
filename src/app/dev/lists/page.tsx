import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ListsPreview, type ListsPreviewRole, type ListsPreviewState, type ListsPreviewView } from "./lists-preview";

export const metadata: Metadata = {
  title: "Danh sách · dev",
  robots: { index: false, follow: false },
};

const views: readonly ListsPreviewView[] = ["students", "classes", "sessions", "results", "credits", "advances", "staff", "commissions"];
const roles: readonly ListsPreviewRole[] = ["owner", "ta", "accountant"];
const states: readonly ListsPreviewState[] = ["normal", "capped", "empty"];

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const first = Array.isArray(value) ? value[0] : value;
  return allowed.find((item) => item === first) ?? fallback;
}

/**
 * Directory previews mirroring `06-danh-sach-hoc-sinh-va-lop.dc.html` and
 * `16-danh-sach-theo-lo.dc.html` with fixture data inside the shell.
 * Development only: production answers 404.
 */
export default async function DevListsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[]; state?: string | string[]; view?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;

  return (
    <ListsPreview
      role={pick(params.role, roles, "owner")}
      state={pick(params.state, states, "normal")}
      view={pick(params.view, views, "students")}
    />
  );
}
