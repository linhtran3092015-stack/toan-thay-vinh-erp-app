import { ResultBanner } from "@/components/shared/result-banner";
import type { SessionTestKeyWarning } from "@/features/session-tests/types";

/** "Câu 15: 9/11 bài sai (82%); 6 em cùng ghi “41”, đáp án đang chốt “42”." */
export function keyWarningLine(warning: SessionTestKeyWarning): string {
  const percent = Math.round((warning.wrong / Math.max(warning.papers, 1)) * 100);
  const common =
    warning.commonAnswer && warning.commonAnswerCount ? `; ${warning.commonAnswerCount} em cùng ghi “${warning.commonAnswer}”` : "";
  const key = warning.keyAnswer ? `, đáp án đang chốt “${warning.keyAnswer}”` : "";
  return `Câu ${warning.label}: ${warning.wrong}/${warning.papers} bài sai (${percent}%)${common}${key}.`;
}

/**
 * Questions most graded papers got wrong on the confirmed key: usually a typo in the key, so the
 * whole class would be marked down. Shown next to the key and above "Duyệt N bài xanh".
 */
export function KeyWarnings({ canEdit, warnings }: { canEdit: boolean; warnings: SessionTestKeyWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <ResultBanner
      description={
        canEdit
          ? "Nhiều bài sai cùng một câu thường do đáp án chốt nhầm. Nếu đáp án sai, bấm Sửa đáp án: AI chấm lại các bài chưa duyệt theo đáp án mới."
          : "Nhiều bài sai cùng một câu thường do đáp án chốt nhầm. Báo người chốt đáp án kiểm tra lại trước khi duyệt."
      }
      title="Kiểm tra lại đáp án"
      tone="warning"
    >
      <ul className="mt-1 grid gap-0.5">
        {warnings.map((warning) => (
          <li key={warning.label}>{keyWarningLine(warning)}</li>
        ))}
      </ul>
    </ResultBanner>
  );
}
