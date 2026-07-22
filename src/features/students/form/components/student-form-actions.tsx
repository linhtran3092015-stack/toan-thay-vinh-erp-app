import { Button } from "@/components/ui/button";

interface StudentFormActionsProps {
  currentStepIndex: number;
  isLastStep: boolean;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
  totalSteps: number;
}

export function StudentFormActions({
  currentStepIndex,
  isLastStep,
  onBack,
  onCancel,
  onNext,
  totalSteps,
}: StudentFormActionsProps) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 border-t border-hairline bg-canvas/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:rounded-lg md:border md:bg-surface-1 md:shadow-card">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button className="min-h-11" onClick={onCancel} variant="ghost">
          Hủy
        </Button>
        <div className="flex gap-2">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            disabled={currentStepIndex === 0}
            onClick={onBack}
            variant="outline"
          >
            Quay lại
          </Button>
          {isLastStep ? (
            <Button className="min-h-11 flex-1 sm:flex-none" type="submit" variant="secondary">
              Xem lại
            </Button>
          ) : (
            <Button
              className="min-h-11 flex-1 sm:flex-none"
              onClick={onNext}
              variant="secondary"
            >
              Tiếp tục
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-ink-muted sm:text-right">
        Bước {currentStepIndex + 1}/{totalSteps} · Chỉ mô phỏng lưu hồ sơ
      </p>
    </div>
  );
}
