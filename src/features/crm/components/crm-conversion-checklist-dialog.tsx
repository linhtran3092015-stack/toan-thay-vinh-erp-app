"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { convertStudentAction } from "@/features/crm/actions/crm-actions";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";
import type { EnrollmentChecklistReadModel } from "@/features/crm/read-models";

interface CrmConversionChecklistDialogProps {
  checklist: EnrollmentChecklistReadModel | null;
  classes: { id: string; name: string; code: string }[];
  crmCaseId: string;
  hasAccountantPermission: boolean;
}

export function CrmConversionChecklistDialog({
  checklist,
  classes,
  crmCaseId,
  hasAccountantPermission,
}: CrmConversionChecklistDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [officialStartDate, setOfficialStartDate] = useState("");
  const [registeredMode, setRegisteredMode] = useState<"online" | "offline" | "hybrid">("offline");

  const [items, setItems] = useState({
    item10CommunicationGroupReady: checklist?.item10CommunicationGroupReady ?? false,
    item1PaymentReceived: checklist?.item1PaymentReceived ?? false,
    item2SourceConfirmed: checklist?.item2SourceConfirmed ?? false,
    item3SaleConfirmed: checklist?.item3SaleConfirmed ?? false,
    item4ClassSelected: checklist?.item4ClassSelected ?? false,
    item5ModeConfirmed: checklist?.item5ModeConfirmed ?? false,
    item6FeeConfirmed: checklist?.item6FeeConfirmed ?? false,
    item7AssistantSessionsConfirmed: checklist?.item7AssistantSessionsConfirmed ?? false,
    item8AccountantTransactionConfirmed: checklist?.item8AccountantTransactionConfirmed ?? false,
    item9OfficialStartDateEntered: checklist?.item9OfficialStartDateEntered ?? false,
  });

  const [actionState, setActionState] = useState<CrmActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleItem = (key: keyof typeof items) => {
    if (key === "item8AccountantTransactionConfirmed" && !hasAccountantPermission) {
      return;
    }
    setItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecked = Object.values(items).every(Boolean);

  const handleConvert = () => {
    setActionState(null);
    startTransition(async () => {
      const result = await convertStudentAction({
        checklistItems: items,
        classId,
        crmCaseId,
        officialStartDate,
        registeredMode,
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
      <Button onClick={() => setIsOpen(true)} size="sm">
        Xác nhận & Chuyển thành Học viên Chính thức
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-6 shadow-popover">
            <h2 className="text-xl font-bold text-ink">Checklist Chuyển thành Học viên Chính thức</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Đủ 10 tiêu chí checklist bên dưới mới có thể hoàn tất transaction chuyển đổi.
            </p>

            {actionState?.status === "error" ? (
              <div className="mt-3 rounded-md bg-danger/10 p-3 text-xs font-semibold text-danger">
                {actionState.message}
              </div>
            ) : null}

            <div className="mt-4 grid gap-4">
              {/* Target Class Selection */}
              <div className="grid gap-3 rounded-md border border-hairline bg-canvas p-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink-subtle">
                    Chọn Lớp chính thức <span className="text-danger">*</span>
                  </label>
                  <select
                    className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    onChange={(e) => {
                      setClassId(e.target.value);
                      if (e.target.value) {
                        setItems((prev) => ({ ...prev, item4ClassSelected: true }));
                      }
                    }}
                    value={classId}
                  >
                    <option value="">-- Chọn lớp học --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-subtle">
                    Ngày bắt đầu học chính <span className="text-danger">*</span>
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    onChange={(e) => {
                      setOfficialStartDate(e.target.value);
                      if (e.target.value) {
                        setItems((prev) => ({ ...prev, item9OfficialStartDateEntered: true }));
                      }
                    }}
                    type="date"
                    value={officialStartDate}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-ink-subtle">
                    Hình thức đăng ký <span className="text-danger">*</span>
                  </label>
                  <select
                    className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    onChange={(e) => {
                      setRegisteredMode(e.target.value as "online" | "offline" | "hybrid");
                      setItems((prev) => ({ ...prev, item5ModeConfirmed: true }));
                    }}
                    value={registeredMode}
                  >
                    <option value="offline">Offline (Tại trung tâm)</option>
                    <option value="online">Online (Trực tuyến)</option>
                    <option value="hybrid">Hybrid (Kết hợp)</option>
                  </select>
                </div>
              </div>

              {/* 10 Checklist Items */}
              <div className="grid gap-2">
                <h3 className="text-sm font-bold text-ink">Chi tiết 10 tiêu chí nhập học:</h3>

                <ChecklistItem
                  checked={items.item1PaymentReceived}
                  label="1. Đã nhận học phí ban đầu"
                  onToggle={() => toggleItem("item1PaymentReceived")}
                />
                <ChecklistItem
                  checked={items.item2SourceConfirmed}
                  label="2. Đã xác nhận nguồn lead"
                  onToggle={() => toggleItem("item2SourceConfirmed")}
                />
                <ChecklistItem
                  checked={items.item3SaleConfirmed}
                  label="3. Đã xác nhận nhân sự Sale chốt"
                  onToggle={() => toggleItem("item3SaleConfirmed")}
                />
                <ChecklistItem
                  checked={items.item4ClassSelected}
                  label="4. Đã chọn lớp chính"
                  onToggle={() => toggleItem("item4ClassSelected")}
                />
                <ChecklistItem
                  checked={items.item5ModeConfirmed}
                  label="5. Đã xác nhận hình thức online/offline"
                  onToggle={() => toggleItem("item5ModeConfirmed")}
                />
                <ChecklistItem
                  checked={items.item6FeeConfirmed}
                  label="6. Đã xác nhận mức học phí và ưu đãi"
                  onToggle={() => toggleItem("item6FeeConfirmed")}
                />
                <ChecklistItem
                  checked={items.item7AssistantSessionsConfirmed}
                  label="7. Trợ lý đã xác nhận số buổi học"
                  onToggle={() => toggleItem("item7AssistantSessionsConfirmed")}
                />
                <ChecklistItem
                  checked={items.item8AccountantTransactionConfirmed}
                  disabled={!hasAccountantPermission}
                  hint={!hasAccountantPermission ? "(Yêu cầu quyền kế toán sepay.accountant_confirm)" : undefined}
                  label="8. Kế toán xác nhận giao dịch học phí"
                  onToggle={() => toggleItem("item8AccountantTransactionConfirmed")}
                />
                <ChecklistItem
                  checked={items.item9OfficialStartDateEntered}
                  label="9. Đã nhập ngày học chính thức"
                  onToggle={() => toggleItem("item9OfficialStartDateEntered")}
                />
                <ChecklistItem
                  checked={items.item10CommunicationGroupReady}
                  label="10. Sổ liên lạc / Nhóm Zalo phụ huynh đã sẵn sàng"
                  onToggle={() => toggleItem("item10CommunicationGroupReady")}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4">
              <span className="text-xs font-semibold text-ink-muted">
                Trạng thái: {allChecked ? "✅ Đã đủ 10 tiêu chí" : "⚠️ Chưa đủ 10 tiêu chí"}
              </span>

              <div className="flex gap-2">
                <Button
                  disabled={isPending}
                  onClick={() => setIsOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Hủy
                </Button>
                <Button
                  disabled={isPending || !allChecked || !classId || !officialStartDate}
                  onClick={handleConvert}
                >
                  {isPending ? "Đang xử lý..." : "Xác nhận chuyển đổi"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ChecklistItem({
  checked,
  disabled = false,
  hint,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex items-center justify-between rounded-md border p-3 text-sm transition-colors ${
        disabled
          ? "cursor-not-allowed border-hairline bg-canvas/50 text-ink-subtle"
          : checked
            ? "border-success/40 bg-success/5 text-ink font-medium"
            : "border-hairline bg-surface-1 text-ink cursor-pointer hover:bg-canvas"
      }`}
    >
      <div className="flex items-center gap-3">
        <input
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          type="checkbox"
        />
        <span>{label}</span>
      </div>
      {hint ? <span className="text-xs text-warning">{hint}</span> : null}
    </label>
  );
}
