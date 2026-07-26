"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createPaymentRequestAction } from "@/features/finance/actions/finance-actions";
import type { FinanceActionResultState } from "@/features/finance/forms/finance-action-types";

interface CreatePaymentRequestDialogProps {
  students: { id: string; name: string; publicCode: string }[];
}

export function CreatePaymentRequestDialog({ students }: CreatePaymentRequestDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [expectedAmountVnd, setExpectedAmountVnd] = useState(1400000);
  const [purchasedSessions, setPurchasedSessions] = useState(10);
  const [bonusSessions, setBonusSessions] = useState(0);
  const [topupType, setTopupType] = useState<"new" | "renewal">("new");
  const [notes, setNotes] = useState("");

  const [actionState, setActionState] = useState<FinanceActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    setActionState(null);
    startTransition(async () => {
      const calculatedUnitPriceVnd = Math.round(expectedAmountVnd / Math.max(purchasedSessions, 1));
      const result = await createPaymentRequestAction({
        bonusSessions,
        calculatedUnitPriceVnd,
        expectedAmountVnd,
        notes,
        purchasedSessions,
        studentId,
        topupType,
      });
      setActionState(result);
      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>+ Tạo Yêu cầu Nạp học phí (VietQR)</Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-hairline bg-surface-1 p-6 shadow-popover">
            <h2 className="text-xl font-bold text-ink">Tạo Yêu cầu Nạp học phí (VietQR)</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Cú pháp chuyển khoản sẽ được tự động tạo dạng TTV HV-XXXX để SePay quét tự động.
            </p>

            {actionState?.status === "error" ? (
              <div className="mt-3 rounded-md bg-danger/10 p-3 text-xs font-semibold text-danger">
                {actionState.message}
              </div>
            ) : null}

            <div className="mt-4 grid gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-subtle">
                  Chọn Học viên <span className="text-danger">*</span>
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
                    Số tiền dự kiến nạp (VND) <span className="text-danger">*</span>
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    onChange={(e) => setExpectedAmountVnd(Number(e.target.value))}
                    step={10000}
                    type="number"
                    value={expectedAmountVnd}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-subtle">
                    Số buổi chính mua <span className="text-danger">*</span>
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    min={1}
                    onChange={(e) => setPurchasedSessions(Number(e.target.value))}
                    type="number"
                    value={purchasedSessions}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-subtle">
                    Số buổi tặng kèm (Bonus)
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    min={0}
                    onChange={(e) => setBonusSessions(Number(e.target.value))}
                    type="number"
                    value={bonusSessions}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-subtle">
                    Loại nạp tiền <span className="text-danger">*</span>
                  </label>
                  <select
                    className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    onChange={(e) => setTopupType(e.target.value as "new" | "renewal")}
                    value={topupType}
                  >
                    <option value="new">Tuyển mới (New)</option>
                    <option value="renewal">Tái phí (Renewal)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-md border border-hairline bg-canvas p-3 text-xs">
                <span className="font-semibold text-ink">Đơn giá thực tế tính toán: </span>
                <span className="font-bold text-primary">
                  {Math.round(expectedAmountVnd / Math.max(purchasedSessions, 1)).toLocaleString("vi-VN")} đ / buổi
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-subtle">Ghi chú</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-hairline bg-canvas p-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú thêm về gói nạp..."
                  rows={2}
                  value={notes}
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
                disabled={isPending || !studentId || expectedAmountVnd <= 0 || purchasedSessions <= 0}
                onClick={handleCreate}
              >
                {isPending ? "Đang khởi tạo..." : "Xác nhận tạo Yêu cầu"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
