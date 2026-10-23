import { formatPoints, type AnswerKey } from "@/features/session-tests/answer-key";

/** Read-only answer key: per question the points, final answer, accepted alternatives and steps. */
export function AnswerKeyView({
  answerKey,
  markingGuide,
  title,
}: {
  answerKey: AnswerKey;
  markingGuide: string | null;
  title: string | null;
}) {
  if (answerKey.questions.length === 0) {
    return <p className="text-secondary text-text-muted">Chưa có đáp án.</p>;
  }

  return (
    <div className="grid gap-3">
      {title ? <p className="text-secondary font-medium text-text-strong">{title}</p> : null}
      <ol className="grid gap-2">
        {answerKey.questions.map((question) => (
          <li className="grid gap-1 rounded-md border border-border-subtle p-3" key={question.label}>
            <p className="text-secondary text-text-strong">
              <span className="font-semibold">Câu {question.label}</span>
              <span className="text-text-muted">
                {" "}
                · {question.maxPoints === null ? "chưa có điểm" : `${formatPoints(question.maxPoints)} điểm`}
              </span>
            </p>
            {question.promptText ? <p className="whitespace-pre-line text-caption text-text-muted">{question.promptText}</p> : null}
            <p className="text-secondary text-text-default">
              Đáp án: <span className="font-semibold text-text-strong">{question.finalAnswer || "chưa có"}</span>
            </p>
            {question.acceptedEquivalents.length > 0 ? (
              <p className="text-caption text-text-muted">Cách viết khác được chấp nhận: {question.acceptedEquivalents.join("; ")}</p>
            ) : null}
            {question.solutionSteps.length > 0 ? (
              <details className="text-caption text-text-default">
                <summary className="cursor-pointer text-text-muted">Lời giải ({question.solutionSteps.length} bước)</summary>
                <ol className="mt-1 grid list-decimal gap-0.5 pl-5">
                  {question.solutionSteps.map((step, index) => (
                    <li key={`${index}-${step}`}>{step}</li>
                  ))}
                </ol>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
      {answerKey.methods?.trim() ? (
        <details className="grid gap-1 rounded-md border border-border-subtle p-3 text-caption text-text-default">
          <summary className="cursor-pointer font-medium text-text-strong">Phương pháp của thầy</summary>
          <p className="mt-1 whitespace-pre-line">{answerKey.methods}</p>
        </details>
      ) : null}
      {markingGuide ? (
        <p className="whitespace-pre-line text-caption text-text-muted">
          <span className="font-medium text-text-default">Ghi chú chấm: </span>
          {markingGuide}
        </p>
      ) : null}
    </div>
  );
}
