import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GradingSubmissionsPreview } from "./grading-submissions-preview";

export const metadata: Metadata = {
  title: "Bài nộp chưa ghép · dev",
  robots: { index: false, follow: false },
};

/**
 * "Bài nộp chưa ghép" with fixture data (`?status=ignored` for "Đã bỏ qua", `?state=empty` for the
 * empty page). Development only.
 */
export default async function DevGradingSubmissionsPage({ searchParams }: { searchParams: Promise<{ state?: string; status?: string }> }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const { state, status } = await searchParams;
  return <GradingSubmissionsPreview empty={state === "empty"} status={status === "ignored" ? "ignored" : "needs_review"} />;
}
