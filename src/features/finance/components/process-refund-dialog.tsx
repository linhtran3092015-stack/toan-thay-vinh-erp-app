"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { processRefundAction } from "@/features/finance/actions/finance-actions";
import type { FinanceActionResultState } from "@/features/finance/forms/finance-action-types";

interface ProcessRefundDialogProps {
  students: { id: string; name: string; publicCode: string }[];
}

export function ProcessRefundDialog({ students }: ProcessRefundDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [refundAmountVnd, setRefundAmountVnd] = useState(1400000);
  const [refundSessions, setRefundSessions] = useState(10);
  const [reason, setReason] = useState("");

  const [actionState, setActionState] = useState<FinanceActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRefund = () => {
    setActionState(null);
    startTransition(async () => {
      const result = await processRefundAction({
        reason,
        refundAmountVnd,
        refundSessions,
        studentId,
      });
      setActionState(result);
      if (result.status === "success") {
        setIsOpen(false);
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} size="sm" variant="outline">
        Xử lý Hoàn phí
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-hairline bg-surface-1 p-6 shadow-popover">
            <h2 className="text-lg font-bold text-ink">Lập chứng từ Hoàn phí Học viên</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Giao dịch này sẽ ghi nhận `refund_debit` vào Sổ cái số buổi và tạo chứng từ Chi hoàn phí vào Sổ quỹ.
            </p>

            {actionState?.status === "error" ? (
              <div className="mt-3 rounded-md bg-danger/10 p-3 text-xs font-semibold text-danger">
                {actionState.message}
              </div>
            ) : null}

            <div className="mt-4 grid gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-subtle">
                  Chọn Học viên hoàn phí <span className="text-danger">*</span>
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  onChange={(e) => setStudentId(e.target.value)}
                  value={studentId}
                >
                  <option value="">-- Chọn học viên --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.publicCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink-subtle">
                    Số tiền hoàn phí (VND) <span className="text-danger">*</span>
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    onChange={(e) => setRefundAmountVnd(Number(e.target.value))}
                    step={10000}
                    type="number"
                    value={refundAmountVnd}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-subtle">
                    Số buổi hoàn trả <span className="text-danger">*</span>
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    min={1}
                    onChange={(e) => setRefundSessions(Number(e.target.value))}
                    type="number"
                    value={refundSessions}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-subtle">
                  Lý do hoàn phí <span className="text-danger">*</span>
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-hairline bg-canvas p-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ghi rõ lý do phụ huynh xin rút học phí..."
                  rows={3}
                  value={reason}
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
              <Button
                disabled={isPending || !studentId || refundAmountVnd <= 0 || refundSessions <= 0 || reason.trim().length < 3}
                onClick={handleRefund}
              >
                {isPending ? "Đang xử lý..." : "Xác nhận Hoàn phí"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
