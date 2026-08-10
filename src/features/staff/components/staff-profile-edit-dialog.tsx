"use client";

import { cloneElement, isValidElement, type ReactElement, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Dialog } from "@/components/ui/dialog";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { updateStaffProfileAction } from "@/features/staff/staff-actions";
import {
  initialStaffManagementActionState,
  type StaffManagementActionState,
} from "@/features/staff/staff-action-types";
import type { StaffDetailReadModel } from "@/features/staff/types";

interface StaffProfileEditDialogProps {
  detail: StaffDetailReadModel;
}

const inputClassName = "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

/** The dialog presents existing profile policy; validation and mutation remain Staff-owned. */
export function StaffProfileEditDialog({ detail }: StaffProfileEditDialogProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const displayNameId = useId();
  const employeeCodeId = useId();
  const phoneId = useId();
  const statusId = useId();
  const joinedAtId = useId();
  const leftAtId = useId();
  const reasonId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(detail.profileDisplayName ?? "");
  const [employeeCode, setEmployeeCode] = useState(detail.employeeCode ?? "");
  const [phone, setPhone] = useState(detail.phone ?? "");
  const [employmentStatus, setEmploymentStatus] = useState<"active" | "inactive" | "suspended">(
    detail.employmentStatus === "unknown" ? "active" : detail.employmentStatus,
  );
  const [joinedAt, setJoinedAt] = useState(detail.joinedAt ?? "");
  const [leftAt, setLeftAt] = useState(detail.leftAt ?? "");
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<StaffManagementActionState>(initialStaffManagementActionState);
  const [isPending, startTransition] = useTransition();
  const fieldErrors = actionState.status === "error" ? actionState.fieldErrors ?? {} : {};

  const openDialog = (): void => {
    setDisplayName(detail.profileDisplayName ?? "");
    setEmployeeCode(detail.employeeCode ?? "");
    setPhone(detail.phone ?? "");
    setEmploymentStatus(detail.employmentStatus === "unknown" ? "active" : detail.employmentStatus);
    setJoinedAt(detail.joinedAt ?? "");
    setLeftAt(detail.leftAt ?? "");
    setReason("");
    setActionState(initialStaffManagementActionState);
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (isPending) return;
    setIsOpen(false);
    setReason("");
    setActionState(initialStaffManagementActionState);
  };

  const handleSubmit = (): void => {
    if (isPending) return;
    startTransition(async () => {
      const result = await updateStaffProfileAction({
        displayName,
        employeeCode,
        employmentStatus,
        joinedAt,
        leftAt: employmentStatus === "inactive" ? leftAt : "",
        phone,
        reason,
        staffId: detail.id,
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
      <Button className="min-h-11" onClick={openDialog} ref={triggerRef} type="button" variant="outline">Chỉnh sửa hồ sơ</Button>
      <Dialog
        ariaDescribedBy={dialogDescriptionId}
        ariaLabelledBy={dialogTitleId}
        className="max-w-2xl"
        initialFocusRef={displayNameRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <div>
            <h2 className="text-section-title text-text-strong" id={dialogTitleId}>Chỉnh sửa hồ sơ nhân sự</h2>
            <p className="mt-1 text-secondary text-text-muted" id={dialogDescriptionId}>Email và ảnh đại diện được quản lý bởi tài khoản đăng nhập. Các thay đổi hồ sơ cần có lý do.</p>
          </div>

          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
            <ReadOnlyField label="Email" value={detail.email} />
            <InputField disabled={isPending} error={fieldErrors.displayName?.[0]} id={displayNameId} inputRef={displayNameRef} label="Tên hiển thị" onChange={setDisplayName} value={displayName} />
            <InputField disabled={isPending} error={fieldErrors.employeeCode?.[0]} id={employeeCodeId} label="Mã nhân sự" onChange={setEmployeeCode} value={employeeCode} />
            <InputField disabled={isPending} error={fieldErrors.phone?.[0]} id={phoneId} label="Số điện thoại" onChange={setPhone} value={phone} />
            <ControlField error={fieldErrors.employmentStatus?.[0]} id={statusId} label="Trạng thái làm việc">
              <select className={inputClassName} disabled={isPending} id={statusId} onChange={(event) => { const value = event.target.value as "active" | "inactive" | "suspended"; setEmploymentStatus(value); if (value !== "inactive") setLeftAt(""); }} value={employmentStatus}>
                <option value="active">Đang làm việc</option><option value="suspended">Tạm khóa</option><option value="inactive">Đã nghỉ</option>
              </select>
            </ControlField>
            <InputField disabled={isPending} error={fieldErrors.joinedAt?.[0]} id={joinedAtId} label="Ngày vào làm" onChange={setJoinedAt} type="date" value={joinedAt} />
            {employmentStatus === "inactive" ? <InputField disabled={isPending} error={fieldErrors.leftAt?.[0]} id={leftAtId} label="Ngày nghỉ" onChange={setLeftAt} required type="date" value={leftAt} /> : null}
            <ControlField className="sm:col-span-2" error={fieldErrors.reason?.[0]} id={reasonId} label="Lý do cập nhật">
              <textarea className={`${inputClassName} min-h-24 resize-y py-3`} disabled={isPending} id={reasonId} maxLength={2000} onChange={(event) => setReason(event.target.value)} required value={reason} />
            </ControlField>

            {actionState.status === "error" ? <ResultBanner className="sm:col-span-2" description={actionState.message} title="Không thể cập nhật hồ sơ" tone="error" /> : null}

            <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" disabled={isPending} onClick={closeDialog} type="button" variant="ghost">Hủy</Button>
              <Button className="min-h-11" disabled={isPending} isLoading={isPending} type="submit">{isPending ? "Đang lưu..." : "Lưu hồ sơ"}</Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}

function ControlField({ children, className, error, id, label }: { children: ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>; className?: string; error?: string; id: string; label: string }) {
  const errorId = `${id}-error`;
  return <div className={`grid gap-1.5 ${className ?? ""}`}><label className="text-label text-text-default" htmlFor={id}>{label}</label>{isValidElement(children) ? cloneElement(children, { "aria-describedby": error ? errorId : undefined, "aria-invalid": Boolean(error) }) : children}{error ? <p className="text-caption font-medium text-danger" id={errorId}>{error}</p> : null}</div>;
}

function InputField({ disabled, error, id, inputRef, label, onChange, required = false, type = "text", value }: { disabled: boolean; error?: string; id: string; inputRef?: React.RefObject<HTMLInputElement | null>; label: string; onChange: (value: string) => void; required?: boolean; type?: "date" | "text"; value: string }) {
  const errorId = `${id}-error`;
  return <div className="grid gap-1.5"><label className="text-label text-text-default" htmlFor={id}>{label}</label><input aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} className={inputClassName} disabled={disabled} id={id} onChange={(event) => onChange(event.target.value)} ref={inputRef} required={required} type={type} value={value} />{error ? <p className="text-caption font-medium text-danger" id={errorId}>{error}</p> : null}</div>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) { return <div className="grid gap-1.5"><p className="text-label text-text-muted">{label}</p><p className="min-h-11 break-all rounded-md border border-border-subtle bg-surface-raised px-3 py-2.5 text-control text-text-muted">{value}</p></div>; }
