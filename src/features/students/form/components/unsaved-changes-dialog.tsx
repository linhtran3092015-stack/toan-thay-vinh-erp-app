import { Button } from "@/components/ui/button";

interface UnsavedChangesDialogProps {
  onConfirmLeave: () => void;
  onStay: () => void;
}

export function UnsavedChangesDialog({
  onConfirmLeave,
  onStay,
}: UnsavedChangesDialogProps) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-end bg-ink/40 p-0 md:items-center md:p-6"
      role="dialog"
    >
      <div className="w-full rounded-t-lg border border-hairline bg-surface-1 p-5 shadow-modal md:mx-auto md:max-w-md md:rounded-lg">
        <h2 className="text-section-title font-semibold text-ink">
          Có thay đổi chưa lưu
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Nếu rời khỏi biểu mẫu, các thay đổi chưa lưu sẽ bị bỏ.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button className="min-h-11" onClick={onStay} variant="outline">
            Ở lại
          </Button>
          <Button className="min-h-11" onClick={onConfirmLeave} variant="secondary">
            Rời khỏi form
          </Button>
        </div>
      </div>
    </div>
  );
}
