import { ZALO_MAX_PARTS, ZALO_PART_MAX_CHARS } from "@/features/parent-messages/comment-template";
import { cn } from "@/lib/utils";

const countFormatter = new Intl.NumberFormat("vi-VN");

export function formatCharCount(value: number): string {
  return countFormatter.format(value);
}

/** One line under an editor: total characters and how many Zalo messages the text becomes. */
export function MessageSplitSummary({ maxChars, parts, text }: { maxChars: number; parts: readonly string[]; text: string }) {
  const tooMany = parts.length > ZALO_MAX_PARTS;
  return (
    <p className={cn("text-caption", tooMany || text.length > maxChars ? "text-danger" : "text-text-muted")}>
      {formatCharCount(text.length)}/{formatCharCount(maxChars)} ký tự ·{" "}
      {parts.length <= 1
        ? "gửi thành 1 tin Zalo"
        : `tách thành ${parts.length} tin Zalo (${parts.map((part) => formatCharCount(part.length)).join(" + ")} ký tự)`}
      {tooMany ? ` · vượt ${ZALO_MAX_PARTS} tin, cần rút gọn` : ""}
    </p>
  );
}

/**
 * The message as it will arrive in Zalo: one box per part, each with its
 * number and length (≤ 2.000 characters). `sentCount` marks parts already sent.
 */
export function MessagePartsPreview({ parts, sentCount = 0 }: { parts: readonly string[]; sentCount?: number }) {
  if (parts.length <= 1) {
    return <p className="whitespace-pre-wrap break-words rounded-md bg-surface-sunken px-3 py-2 text-body text-text-default">{parts[0] ?? ""}</p>;
  }
  return (
    <ol className="grid gap-2" aria-label={`${parts.length} tin Zalo gửi liền nhau`}>
      {parts.map((part, index) => (
        <li className="grid gap-1" key={index}>
          <p className={cn("text-caption font-semibold", index + 1 > ZALO_MAX_PARTS ? "text-danger" : "text-text-muted")}>
            Tin {index + 1}/{parts.length} · {formatCharCount(part.length)}/{formatCharCount(ZALO_PART_MAX_CHARS)} ký tự
            {index < sentCount ? " · đã gửi" : ""}
          </p>
          <p className="whitespace-pre-wrap break-words rounded-md bg-surface-sunken px-3 py-2 text-body text-text-default">{part}</p>
        </li>
      ))}
    </ol>
  );
}
