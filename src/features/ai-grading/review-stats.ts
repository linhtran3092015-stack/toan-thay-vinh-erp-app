import { z } from "zod";

/**
 * Cài đặt → Chấm bài AI → "Duyệt bài 30 ngày": per reviewer, how many AI-graded papers they approved
 * and how often they changed the AI's right/wrong on a question. Blank forms (the test was done on
 * paper, the reviewer ticks every question) are counted apart and left out of the change rate.
 */

export const REVIEW_STATS_DAYS = 30;

export interface ReviewerStats {
  approved: number;
  blank: number;
  /** Papers with an AI result the reviewer could change (blank forms left out). */
  compared: number;
  /** Green papers among changedPapers: how far "green" can be trusted. */
  changedGreen: number;
  changedPapers: number;
  changedQuestions: number;
  green: number;
  lastReviewedAt: string | null;
  praiseBonus: number;
  red: number;
  reviewerId: string;
  reviewerName: string;
  yellow: number;
}

const count = z.coerce.number().int().catch(0);

export const reviewerStatsRowSchema = z
  .object({
    approved: count,
    blank: count,
    changed_green: count,
    changed_papers: count,
    changed_questions: count,
    compared: count,
    green: count,
    last_reviewed_at: z.string().nullable().catch(null),
    praise_bonus: count,
    red: count,
    reviewer_id: z.string().uuid(),
    reviewer_name: z.string().nullable().catch(null),
    yellow: count,
  })
  .transform(
    (row): ReviewerStats => ({
      approved: row.approved,
      blank: row.blank,
      changedGreen: row.changed_green,
      changedPapers: row.changed_papers,
      changedQuestions: row.changed_questions,
      compared: row.compared,
      green: row.green,
      lastReviewedAt: row.last_reviewed_at,
      praiseBonus: row.praise_bonus,
      red: row.red,
      reviewerId: row.reviewer_id,
      reviewerName: row.reviewer_name ?? "Nhân sự",
      yellow: row.yellow,
    }),
  );

/** Sum of every reviewer, for the summary line and the "Tổng" row. */
export function totalReviewerStats(rows: ReviewerStats[]): Omit<ReviewerStats, "lastReviewedAt" | "reviewerId" | "reviewerName"> {
  const keys = ["approved", "blank", "changedGreen", "changedPapers", "changedQuestions", "compared", "green", "praiseBonus", "red", "yellow"] as const;
  return Object.fromEntries(keys.map((key) => [key, rows.reduce((sum, row) => sum + row[key], 0)])) as Omit<
    ReviewerStats,
    "lastReviewedAt" | "reviewerId" | "reviewerName"
  >;
}

/** "2/15 (13%)", or "–" when there is nothing to compare. */
export function changeRate(changed: number, compared: number): string {
  if (compared === 0) return "–";
  return `${changed}/${compared} (${Math.round((changed / compared) * 100)}%)`;
}
