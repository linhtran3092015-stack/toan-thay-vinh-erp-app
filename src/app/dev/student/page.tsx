import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudentPreview, type StudentPreviewState } from "./student-preview";

export const metadata: Metadata = {
  title: "Hồ sơ học sinh · dev",
  robots: { index: false, follow: false },
};

const states: StudentPreviewState[] = ["debt", "clean", "new", "reserved"];

/**
 * Student profile preview mirroring `05-ho-so-hoc-sinh.dc.html` with fixture
 * data inside the shell. Enrollment buttons open the real dialogs but the
 * server actions would fail on fixture ids. Development only: 404 in production.
 */
export default async function DevStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; role?: string; tab?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { role, state, tab } = await searchParams;
  const resolved = states.includes(state as StudentPreviewState) ? (state as StudentPreviewState) : "debt";

  return <StudentPreview initialTab={tab} role={role === "ta" ? "ta" : "owner"} state={resolved} />;
}
