/**
 * Draft comment for an AI-graded paper (plan §4.5, appendix A; owner decisions 17/10/2026). One
 * line per part, as teaching assistants write today:
 *   [bonus line when "Tích cực tương tác" is ticked]
 *   Ý 1 – result: praise when every question is right, otherwise each wrong question with the
 *         right answer and where it went wrong (from the AI result);
 *   Ý 2 – what parents can do (right / wrong phrase);
 *   Ý 3 – participation (praised / quiet phrase; never mentions the bonus again);
 *   Ý 4 – closing wish.
 * Phrases come from grading_comment_phrases and rotate per student so a class does not get the
 * same sentence. No icons or emoji, nothing about cameras. The TA edits the draft before approving.
 */

export const COMMENT_MAX_CHARS = 1200;

export const PHRASE_SLOTS = ["y1_correct", "y2_correct", "y2_wrong", "y3_praised", "y3_quiet", "y4"] as const;
export type PhraseSlot = (typeof PHRASE_SLOTS)[number];
export type CommentPhrases = Record<PhraseSlot, readonly string[]>;

/** Seed phrases (appendix A); the database copy in grading_comment_phrases is what the app uses. */
export const DEFAULT_COMMENT_PHRASES: CommentPhrases = {
  y1_correct: ["Con làm bài đạt kết quả rất tốt, rất đáng được khen ngợi."],
  y2_correct: [
    "Ba mẹ tiếp tục động viên, đồng hành để con thêm tự tin, mạnh dạn hơn trong học tập.",
    "Mong ba mẹ tiếp tục khích lệ để con giữ vững phong độ và tự tin hơn mỗi buổi học.",
    "Ba mẹ hãy khen ngợi và đồng hành cùng con để con thêm hứng thú, mạnh dạn hơn với môn Toán.",
  ],
  y2_wrong: [
    "Nhờ phụ huynh hỗ trợ, nhắc nhở con xem lại video/slide bài giảng và làm lại bài thi đầu ra cho đến khi đúng với đáp án thầy đã chữa.",
    "Phụ huynh giúp thầy nhắc con xem lại video và slide buổi học, rồi làm lại bài thi đầu ra đến khi khớp với đáp án thầy đã chữa.",
    "Ba mẹ nhắc con dành thời gian xem lại bài giảng và tự làm lại bài thi đầu ra cho đến khi đúng như phần thầy chữa.",
  ],
  y3_praised: [
    "Hôm nay con học tập rất sôi nổi, hăng hái phát biểu và tích cực nhắn tin tương tác với thầy.",
    "Buổi học hôm nay con rất chủ động, hăng hái trả lời và nhắn tin trao đổi bài cùng thầy.",
    "Thầy rất vui vì hôm nay con tham gia bài học sôi nổi, mạnh dạn phát biểu ý kiến.",
  ],
  y3_quiet: [
    "Hôm nay con còn hơi trầm, ít tham gia nhắn tin trả lời bài; thầy mong buổi sau con mạnh dạn và tương tác nhiều hơn.",
    "Buổi này con chưa tham gia trả lời nhiều; thầy khích lệ con mạnh dạn nhắn tin phát biểu ở buổi sau.",
    "Con còn hơi rụt rè trong giờ học hôm nay; thầy mong con tự tin tương tác với thầy nhiều hơn vào buổi tới.",
  ],
  y4: [
    "Cố gắng phát huy kết quả này, thầy tin con sẽ ngày càng tiến bộ.",
    "Thầy luôn theo sát và tin rằng con sẽ tiến bộ hơn nữa trong những buổi tới.",
    "Chúc con giữ vững tinh thần học tập, thầy tin con sẽ ngày càng vững vàng hơn.",
  ],
};

/** Stable small hash (FNV-1a) so the same student gets the same phrase on every render. */
export function phraseIndex(seed: string, count: number): number {
  if (count <= 1) return 0;
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % count;
}

function pick(phrases: CommentPhrases, slot: PhraseSlot, seed: string): string {
  const list = phrases[slot].filter((phrase) => phrase.trim() !== "");
  const fallback = DEFAULT_COMMENT_PHRASES[slot];
  const options = list.length > 0 ? list : fallback;
  return options[phraseIndex(`${seed}:${slot}`, options.length)].trim();
}

export interface WrongQuestion {
  correctAnswer: string;
  errorLocation: string;
  label: string;
  /** The AI's one-line note for parents; preferred when present. */
  noteForParent: string;
  studentAnswer: string;
  verdict: "incorrect" | "missing";
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function wrongLine(question: WrongQuestion): string {
  if (question.noteForParent.trim()) return `Câu ${question.label}: ${ensureSentence(question.noteForParent)}`;
  if (question.verdict === "missing" || !question.studentAnswer.trim()) {
    return `Câu ${question.label}: con chưa làm, đáp án đúng là ${question.correctAnswer.trim()}.`;
  }
  const where = question.errorLocation.trim() ? ` (sai ở ${question.errorLocation.trim()})` : "";
  return `Câu ${question.label}: con ghi "${question.studentAnswer.trim()}", đáp án đúng là ${question.correctAnswer.trim()}${where}.`;
}

/** Line about the +1, placed first. A paper already at 10 gets praise only (owner decision 17/10). */
export function bonusLine(paperScore: number, praised: boolean): string | null {
  if (!praised) return null;
  if (paperScore >= 10) return "Hôm nay con rất tích cực tương tác.";
  return `Hôm nay con được cộng 1 điểm vì tích cực tương tác (điểm bài làm ${paperScore}, sau khi cộng là ${Math.min(10, paperScore + 1)}).`;
}

export function composeComment({
  paperScore,
  phrases = DEFAULT_COMMENT_PHRASES,
  praised,
  questionCount,
  seed,
  wrong,
}: {
  /** Rounded paper score before the bonus. */
  paperScore: number;
  phrases?: CommentPhrases;
  praised: boolean;
  questionCount: number;
  /** Rotates the phrases; use student id + session id. */
  seed: string;
  wrong: readonly WrongQuestion[];
}): string {
  const lines: string[] = [];
  const bonus = bonusLine(paperScore, praised);
  if (bonus) lines.push(bonus);
  if (wrong.length === 0) {
    lines.push(pick(phrases, "y1_correct", seed));
  } else {
    lines.push(`Con làm đúng ${questionCount - wrong.length}/${questionCount} câu. ${wrong.map(wrongLine).join(" ")}`);
  }
  lines.push(pick(phrases, wrong.length === 0 ? "y2_correct" : "y2_wrong", seed));
  lines.push(pick(phrases, praised ? "y3_praised" : "y3_quiet", seed));
  lines.push(pick(phrases, "y4", seed));
  const text = lines.join("\n");
  return text.length <= COMMENT_MAX_CHARS ? text : `${text.slice(0, COMMENT_MAX_CHARS - 1).trimEnd()}…`;
}
