import { Badge } from "@/components/ui/badge";
import type { SubmissionAi } from "@/features/grading-submissions/data";

const verdictLabels: Record<SubmissionAi["questions"][number]["verdict"], string> = {
  correct: "Đúng",
  incorrect: "Sai",
  missing: "Bỏ trống",
};

const flagLabels: Record<string, string> = {
  ambiguous_notation: "Ký hiệu có thể hiểu hai cách",
  contains_instructions: "Bài có câu nhắn AI (đã bỏ qua)",
  empty: "Bài trống",
  off_topic: "Không liên quan đề",
  wrong_test: "Có vẻ làm đề khác",
};

function formatPoints(value: number): string {
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

/**
 * AI result of one submission on the session page (phase 3a, read-only). Green: two runs agreed
 * and nothing was flagged; yellow: a TA should look; red: the AI gave no usable result, grade by
 * hand. Approving an AI score into the session result comes in phase 3b.
 */
export function SubmissionAiSummary({ ai }: { ai: SubmissionAi }) {
  if (ai.state === "not_counted") return null;
  if (ai.state === "grading") return <Badge tone="info">AI đang chấm</Badge>;
  if (ai.state === "waiting_key") return <Badge tone="neutral">Chưa chấm AI</Badge>;
  if (ai.state === "failed" || ai.color === "red" || ai.rawScore === null) {
    return <Badge tone="danger">AI không chấm được · chấm tay</Badge>;
  }

  const score = formatPoints(ai.rawScore);
  const wrong = ai.questions.filter((question) => question.verdict !== "correct");
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={ai.color === "green" ? "success" : "warning"}>
          AI: {score} điểm · {ai.color === "green" ? "chấm 2 lần khớp" : "cần trợ giảng xem"}
        </Badge>
        {ai.flags.map((flag) => (
          <Badge key={flag} tone="warning">
            {flagLabels[flag] ?? flag}
          </Badge>
        ))}
        <span className="text-caption text-text-muted">
          {ai.questions.length - wrong.length}/{ai.questions.length} câu đúng · chưa cộng điểm tích cực
        </span>
      </div>
      {ai.questions.length > 0 ? (
        <details className="text-caption text-text-muted">
          <summary className="cursor-pointer">Kết quả AI từng câu</summary>
          <ul className="mt-2 grid gap-2">
            {ai.questions.map((question) => (
              <li className="grid gap-0.5" key={question.label}>
                <span className={question.verdict === "correct" ? "text-text-default" : "font-semibold text-text-strong"}>
                  Câu {question.label}: {verdictLabels[question.verdict]}
                  {question.extractedFinalAnswer ? ` · em ghi "${question.extractedFinalAnswer}"` : ""}
                </span>
                {question.reasonForTeacher ? <span>{question.reasonForTeacher}</span> : null}
                {question.errorLocation ? <span>Chỗ sai: {question.errorLocation}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
