"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { transferLeadAction } from "@/features/crm/actions/crm-actions";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";
import type { SaleOwnerOption } from "@/features/crm/read-models";

interface CrmLeadTransferDialogProps {
  crmCaseId: string;
  currentSaleOwnerId: string | null;
  saleOwners: SaleOwnerOption[];
}

export function CrmLeadTransferDialog({
  crmCaseId,
  currentSaleOwnerId,
  saleOwners,
}: CrmLeadTransferDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [newSaleOwnerId, setNewSaleOwnerId] = useState("");
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<CrmActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleTransfer = () => {
    setActionState(null);
    startTransition(async () => {
      const result = await transferLeadAction({
        crmCaseId,
        newSaleOwnerId,
        reason,
      });
      setActionState(result);
      if (result.status === "success") {
        setIsOpen(false);
        setReason("");
        setNewSaleOwnerId("");
        router.refresh();
      }
    });
  };

  const eligibleOwners = saleOwners.filter((s) => s.id !== currentSaleOwnerId);

  return (
    <>
      <Button onClick={() => setIsOpen(true)} size="sm" variant="outline">
        Chuyển giao Lead
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-hairline bg-surface-1 p-6 shadow-popover">
            <h2 className="text-lg font-bold text-ink">Chuyển giao Lead cho Sale mới</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Lịch sử chuyển giao lead sẽ được lưu vết trong audit trail.
            </p>

            {actionState?.status === "error" ? (
              <div className="mt-3 rounded-md bg-danger/10 p-3 text-xs font-semibold text-danger">
                {actionState.message}
              </div>
            ) : null}

            <div className="mt-4 grid gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-subtle">
                  Chọn Sale nhận Lead <span className="text-danger">*</span>
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  onChange={(e) => setNewSaleOwnerId(e.target.value)}
                  value={newSaleOwnerId}
                >
                  <option value="">-- Chọn nhân sự Sale --</option>
                  {eligibleOwners.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-subtle">
                  Lý do chuyển giao <span className="text-danger">*</span>
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-hairline bg-canvas p-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập lý do chuyển giao..."
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
                disabled={isPending || !newSaleOwnerId || reason.trim().length < 3}
                onClick={handleTransfer}
              >
                {isPending ? "Đang xử lý..." : "Xác nhận chuyển giao"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
