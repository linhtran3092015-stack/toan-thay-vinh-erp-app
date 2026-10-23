import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { AiGradingQueuePage } from "@/features/ai-grading/components/ai-grading-queue-page";
import type { AiGradingQueueSession, QueueStage } from "@/features/ai-grading/queue";
import { DATABASE_PERMISSION_CODES } from "@/lib/permissions/types";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Chấm bài AI · dev",
};

const base: Omit<AiGradingQueueSession, "id" | "classCode" | "className"> = {
  answerKeyVersion: 1,
  approved: 0,
  autoLockAt: null,
  endTime: "19:30:00",
  grading: 0,
  greenPending: 0,
  lockedAt: null,
  redPending: 0,
  resubmittedPending: 0,
  sessionDate: "2026-10-20",
  sessionStatus: "completed",
  skipped: 0,
  startTime: "18:00:00",
  submissions: 0,
  suspectQuestions: 0,
  testStatus: "key_confirmed",
  waitingKey: 0,
  yellowPending: 0,
};

const sessions: AiGradingQueueSession[] = [
  { ...base, autoLockAt: new Date(Date.now() + 6 * 3_600_000).toISOString(), classCode: "L-9A26", className: "Toán 9A tối 2-4-6", greenPending: 14, id: "dev-1", redPending: 1, submissions: 22, suspectQuestions: 1, yellowPending: 3 },
  { ...base, classCode: "L-7CLC1", className: "Toán 7 CLC1", greenPending: 9, id: "dev-2", resubmittedPending: 1, sessionDate: "2026-10-21", sessionStatus: "in_progress", submissions: 12, yellowPending: 1, grading: 2 },
  { ...base, classCode: "L-6B", className: "Toán 6B", grading: 4, id: "dev-3", sessionDate: "2026-10-21", sessionStatus: "in_progress", submissions: 8, waitingKey: 4 },
  { ...base, classCode: "L-5A", className: "Toán 5A", id: "dev-4", submissions: 6, testStatus: "key_review", waitingKey: 6 },
  { ...base, approved: 18, classCode: "L-8B", className: "Toán 8B", id: "dev-5", sessionDate: "2026-10-19", skipped: 1, submissions: 19 },
];

const stages: ReadonlyArray<QueueStage | "all"> = ["review", "in_progress", "done", "all"];

/** `/dev/ai-grading?stage=review|in_progress|done|all`: the "Chấm bài AI" queue with fixtures. */
export default async function DevAiGradingPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const { stage } = await searchParams;
  const resolved = stages.includes(stage as QueueStage | "all") ? (stage as QueueStage | "all") : "review";
  return (
    <AppShell
      authUser={{ displayName: "Lê Bích Ngọc", email: "ngoc@example.com", id: "dev-user", initials: "LN" }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view")}
      previewPathname="/ai-grading"
      unreadNotificationCount={1}
    >
      <AiGradingQueuePage
        range={{ from: "2026-10-15", to: "2026-10-21" }}
        sessions={sessions}
        stage={resolved}
        today={{ approved: 41, graded: 63, green: 52, red: 2, yellow: 9 }}
      />
    </AppShell>
  );
}
