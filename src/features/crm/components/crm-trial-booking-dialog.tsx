"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { bookTrialAction } from "@/features/crm/actions/crm-actions";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";

interface CrmTrialBookingDialogProps {
  crmCaseId: string;
}

export function CrmTrialBookingDialog({ crmCaseId }: CrmTrialBookingDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [trialDate, setTrialDate] = useState("");
  const [learningMode, setLearningMode] = useState<"online" | "offline">("offline");
  const [saleNotes, setSaleNotes] = useState("");
  const [actionState, setActionState] = useState<CrmActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleBookTrial = () => {
    setActionState(null);
    startTransition(async () => {
      const result = await bookTrialAction({
        crmCaseId,
        learningMode,
        saleNotes,
        trialDate,
      });
      setActionState(result);
      if (result.status === "success") {
        setIsOpen(false);
        setTrialDate("");
        setSaleNotes("");
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} size="sm" variant="outline">
        Đặt lịch Học thử
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-hairline bg-surface-1 p-6 shadow-popover">
            <h2 className="text-lg font-bold text-ink">Đặt lịch Học thử (Miễn phí 1 buổi)</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Lịch học thử không ảnh hưởng tới bảng điểm danh chính thức của lớp.
            </p>

            {actionState?.status === "error" ? (
              <div className="mt-3 rounded-md bg-danger/10 p-3 text-xs font-semibold text-danger">
                {actionState.message}
              </div>
            ) : null}

            <div className="mt-4 grid gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-subtle">
                  Ngày học thử dự kiến <span className="text-danger">*</span>
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  onChange={(e) => setTrialDate(e.target.value)}
                  type="date"
                  value={trialDate}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-subtle">
                  Hình thức học thử <span className="text-danger">*</span>
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  onChange={(e) => setLearningMode(e.target.value as "online" | "offline")}
                  value={learningMode}
                >
                  <option value="offline">Offline (Tại trung tâm)</option>
                  <option value="online">Online (Trực tuyến)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-subtle">
                  Ghi chú cho buổi học thử
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-hairline bg-canvas p-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  onChange={(e) => setSaleNotes(e.target.value)}
                  placeholder="Ghi chú về trình độ, mong muốn của phụ huynh..."
                  rows={3}
                  value={saleNotes}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                disabled={isPending}
                onClick={() => setIsOpen(false)}
                type="button"
                variant="outline"
              >
                Hủy
              </Button>
              <Button disabled={isPending || !trialDate} onClick={handleBookTrial}>
                {isPending ? "Đang lưu..." : "Xác nhận đặt lịch"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
