import { ResultBanner } from "@/components/shared/result-banner";
import type { AdvanceActionState } from "@/features/advances/forms/advance-action-types";

export function AdvanceActionMessage({
  actionState,
}: {
  actionState: AdvanceActionState | null;
}) {
  if (!actionState?.message) {
    return null;
  }

  return (
    <ResultBanner
      description={actionState.message}
      title={actionState.status === "error" ? "Không thể cập nhật tạm ứng" : "Đã cập nhật tạm ứng"}
      tone={actionState.status === "error" ? "error" : "success"}
    />
  );
}
