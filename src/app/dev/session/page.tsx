import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SessionPreview, type SessionPreviewState } from "./session-preview";

export const metadata: Metadata = {
  title: "Buổi học · dev",
  robots: { index: false, follow: false },
};

const states: SessionPreviewState[] = ["live", "pending", "ready", "locked"];

/**
 * Session workbench preview mirroring `04-chi-tiet-buoi-hoc.dc.html` with
 * fixture data. Buttons call real server actions, so only look here.
 * Development only: production answers 404.
 */
export default async function DevSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; role?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { role, state } = await searchParams;
  const resolved = states.includes(state as SessionPreviewState) ? (state as SessionPreviewState) : "pending";

  return <SessionPreview role={role === "ta" ? "ta" : "owner"} state={resolved} />;
}
