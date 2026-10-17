import { Badge } from "@/components/ui/badge";
import { getAdvanceStatusPresentation } from "@/features/advances/advance-directory-models";
import { cn } from "@/lib/utils";

/**
 * Pinned badge vocabulary (Chờ đối soát · Chờ phê duyệt · Đã phê duyệt · Đã từ
 * chối · Đã khấu trừ · Trạng thái chưa hỗ trợ: …). The label sits in its own
 * span so a long unsupported raw status truncates inside a fixed column.
 */
export function AdvanceStatusBadge({ className, status }: { className?: string; status: string }) {
  const presentation = getAdvanceStatusPresentation(status);

  return (
    <Badge className={cn("max-w-full", className)} title={presentation.label} tone={presentation.tone}>
      <span className="min-w-0 truncate">{presentation.label}</span>
    </Badge>
  );
}
