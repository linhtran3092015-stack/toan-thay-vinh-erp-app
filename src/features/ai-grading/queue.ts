import { z } from "zod";

/**
 * "Chấm bài AI" queue (phase 3c): sessions with a test or form submissions in a date range and how
 * far their papers got (AI grading, waiting for a key, to review by colour, approved, skipped).
 */

export interface AiGradingQueueSession {
  answerKeyVersion: number;
  approved: number;
  /** When an unlocked completed session locks itself (null when not scheduled). */
  autoLockAt: string | null;
  classCode: string;
  className: string;
  endTime: string;
  grading: number;
  greenPending: number;
  id: string;
  lockedAt: string | null;
  redPending: number;
  /** Papers handed in again after an earlier attempt was approved, still to review. */
  resubmittedPending: number;
  sessionDate: string;
  sessionStatus: string;
  skipped: number;
  startTime: string;
  submissions: number;
  /** Questions over 70% of the graded papers got wrong (the key may be off). */
  suspectQuestions: number;
  testStatus: "none" | "draft" | "key_review" | "key_confirmed";
  waitingKey: number;
  yellowPending: number;
}

export type QueueStage = "review" | "in_progress" | "done" | "no_submissions";

export interface AiGradingToday {
  approved: number;
  graded: number;
  green: number;
  red: number;
  yellow: number;
}

const count = z.coerce.number().int().catch(0);

export const queueRowSchema = z
  .object({
    answer_key_version: count,
    approved: count,
    auto_lock_at: z.string().nullable().catch(null),
    class_code: z.string(),
    class_name: z.string(),
    class_session_id: z.string().uuid(),
    end_time: z.string(),
    grading: count,
    green_pending: count,
    locked_at: z.string().nullable().catch(null),
    red_pending: count,
    resubmitted_pending: count,
    session_date: z.string(),
    session_status: z.string(),
    skipped: count,
    start_time: z.string(),
    submissions: count,
    suspect_questions: count,
    test_status: z.enum(["none", "draft", "key_review", "key_confirmed"]).catch("none"),
    waiting_key: count,
    yellow_pending: count,
  })
  .transform(
    (row): AiGradingQueueSession => ({
      answerKeyVersion: row.answer_key_version,
      approved: row.approved,
      autoLockAt: row.auto_lock_at,
      classCode: row.class_code,
      className: row.class_name,
      endTime: row.end_time,
      grading: row.grading,
      greenPending: row.green_pending,
      id: row.class_session_id,
      lockedAt: row.locked_at,
      redPending: row.red_pending,
      resubmittedPending: row.resubmitted_pending,
      sessionDate: row.session_date,
      sessionStatus: row.session_status,
      skipped: row.skipped,
      startTime: row.start_time,
      submissions: row.submissions,
      suspectQuestions: row.suspect_questions,
      testStatus: row.test_status,
      waitingKey: row.waiting_key,
      yellowPending: row.yellow_pending,
    }),
  );

export const todaySchema = z.object({ approved: count, graded: count, green: count, red: count, yellow: count });

export function toReview(session: AiGradingQueueSession): number {
  return session.greenPending + session.yellowPending + session.redPending;
}

export function queueStage(session: AiGradingQueueSession): QueueStage {
  if (session.submissions === 0) return "no_submissions";
  if (toReview(session) > 0) return "review";
  if (session.approved + session.skipped >= session.submissions) return "done";
  return "in_progress";
}

/** Default range: the last 7 days up to today (Vietnam dates). */
export function defaultQueueRange(today: string): { from: string; to: string } {
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end.getTime() - 6 * 86_400_000);
  return { from: start.toISOString().slice(0, 10), to: today };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Range from the query string, clamped to at most 62 days; falls back to the default. */
export function parseQueueRange(params: { from?: string; to?: string }, today: string): { from: string; to: string } {
  const fallback = defaultQueueRange(today);
  const from = params.from && DATE.test(params.from) ? params.from : fallback.from;
  const to = params.to && DATE.test(params.to) ? params.to : fallback.to;
  if (to < from) return fallback;
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(span) || span > 62) return fallback;
  return { from, to };
}
