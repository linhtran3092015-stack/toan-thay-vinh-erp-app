import { composeComment, type CommentPhrases, type WrongQuestion } from "@/features/ai-grading/comment";
import { finalScore, rawScore, roundHalfUp, type Verdict } from "@/features/ai-grading/scoring";
import { rankLabelForScore, type RankBand } from "@/features/parent-messages/comment-template";
import type { AnswerKey } from "@/features/session-tests/answer-key";

/**
 * What approving a submission would write (phase 3b), computed the same way as
 * approve_grading_submission so the review panel previews exactly what is saved: points of the
 * questions marked correct, rounded (.5 up), +1 when "Tích cực tương tác" is ticked (not above 10),
 * the rank of the final score, and a draft comment from the phrase library.
 */

export interface ReviewAiQuestion {
  errorLocation: string;
  extractedFinalAnswer: string;
  label: string;
  noteForParent: string;
  verdict: Verdict;
}

export interface ReviewPreview {
  bonusApplied: boolean;
  finalScore: number;
  paperScore: number;
  rankLabel: string;
  rawScore: number;
}

export function previewReview({
  bands,
  key,
  praise,
  verdicts,
}: {
  bands: readonly RankBand[];
  key: AnswerKey;
  praise: boolean;
  verdicts: Readonly<Record<string, Verdict>>;
}): ReviewPreview {
  const raw = rawScore(
    key.questions.map((question) => ({ label: question.label, max_points: question.maxPoints })),
    verdicts,
  );
  const paper = roundHalfUp(raw);
  const final = finalScore(raw, praise);
  return { bonusApplied: praise && paper < 10, finalScore: final, paperScore: paper, rankLabel: rankLabelForScore(final, bands), rawScore: raw };
}

/** Starting verdicts: the AI's, or "missing" for every question when the AI has none. */
export function initialVerdicts(key: AnswerKey, aiQuestions: readonly ReviewAiQuestion[], saved?: Record<string, Verdict> | null): Record<string, Verdict> {
  const byLabel = new Map(aiQuestions.map((question) => [question.label, question.verdict]));
  return Object.fromEntries(key.questions.map((question) => [question.label, saved?.[question.label] ?? byLabel.get(question.label) ?? "missing"]));
}

export function draftComment({
  aiQuestions,
  key,
  phrases,
  praise,
  seed,
  verdicts,
}: {
  aiQuestions: readonly ReviewAiQuestion[];
  key: AnswerKey;
  phrases?: CommentPhrases;
  praise: boolean;
  seed: string;
  verdicts: Readonly<Record<string, Verdict>>;
}): string {
  const byLabel = new Map(aiQuestions.map((question) => [question.label, question]));
  const wrong: WrongQuestion[] = key.questions
    .filter((question) => verdicts[question.label] !== "correct")
    .map((question) => {
      const ai = byLabel.get(question.label);
      // The AI's note only fits when the reviewer kept the AI's verdict for that question.
      const keepsAi = ai !== undefined && ai.verdict === verdicts[question.label];
      return {
        correctAnswer: question.finalAnswer,
        errorLocation: keepsAi ? ai.errorLocation : "",
        label: question.label,
        noteForParent: keepsAi ? ai.noteForParent : "",
        studentAnswer: ai?.extractedFinalAnswer ?? "",
        verdict: verdicts[question.label] === "missing" ? "missing" : "incorrect",
      };
    });
  // A right answer with a wrong unit stays right but keeps the AI's reminder (owner ruling 23/10).
  const reminders = key.questions.flatMap((question) => {
    const ai = byLabel.get(question.label);
    return verdicts[question.label] === "correct" && ai?.verdict === "correct" && ai.noteForParent.trim()
      ? [{ label: question.label, note: ai.noteForParent }]
      : [];
  });
  const paper = roundHalfUp(
    rawScore(
      key.questions.map((question) => ({ label: question.label, max_points: question.maxPoints })),
      verdicts,
    ),
  );
  return composeComment({ paperScore: paper, phrases, praised: praise, questionCount: key.questions.length, reminders, seed, wrong });
}
