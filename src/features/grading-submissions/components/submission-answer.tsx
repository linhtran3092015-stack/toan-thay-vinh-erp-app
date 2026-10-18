/** The student's typed answer, line breaks kept, folded by default. */
export function SubmissionAnswer({
  open = false,
  text,
  truncated,
}: {
  open?: boolean;
  text: string;
  truncated: boolean;
}) {
  const trimmed = text.trim();
  return (
    <details className="group rounded-md border border-border-subtle bg-surface-subtle" open={open}>
      <summary className="cursor-pointer px-3 py-2 text-caption font-semibold text-text-muted">
        Bài làm ({trimmed.length.toLocaleString("vi-VN")} ký tự{truncated ? ", đã cắt bớt" : ""})
      </summary>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 font-sans text-secondary text-text-strong">
        {trimmed || "(trống)"}
      </pre>
    </details>
  );
}
