"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-canvas";

export function StaffProfileEditDialog({
  detail,
}: StaffProfileEditDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(detail.profileDisplayName ?? "");
  const [employeeCode, setEmployeeCode] = useState(detail.employeeCode ?? "");
  const [phone, setPhone] = useState(detail.phone ?? "");
  const [employmentStatus, setEmploymentStatus] = useState(
    detail.employmentStatus === "unknown" ? "active" : detail.employmentStatus,
  );
  const [joinedAt, setJoinedAt] = useState(detail.joinedAt ?? "");
  const [leftAt, setLeftAt] = useState(detail.leftAt ?? "");
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<StaffManagementActionState>(
    initialStaffManagementActionState,
  );
  const [isPending, startTransition] = useTransition();

  const closeDialog = (): void => {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    setReason("");
    setActionState(initialStaffManagementActionState);
  };

  const openDialog = (): void => {
    setDisplayName(detail.profileDisplayName ?? "");
    setEmployeeCode(detail.employeeCode ?? "");
    setPhone(detail.phone ?? "");
    setEmploymentStatus(
      detail.employmentStatus === "unknown" ? "active" : detail.employmentStatus,
    );
    setJoinedAt(detail.joinedAt ?? "");
    setLeftAt(detail.leftAt ?? "");
    setReason("");
    setActionState(initialStaffManagementActionState);
    setIsOpen(true);
  };

  const handleSubmit = (): void => {
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
      <Button onClick={openDialog} type="button" variant="outline">
        Chỉnh sửa hồ sơ
      </Button>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-4"
          role="dialog"
        >
          <div className="mx-auto my-6 w-full max-w-2xl rounded-lg border border-hairline bg-surface-1 p-5 shadow-xl">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-ink">Chỉnh sửa hồ sơ nhân sự</h2>
              <p className="text-sm text-ink-muted">
                Email và ảnh đại diện được quản lý bởi tài khoản đăng nhập.
              </p>
            </div>

            <form
              className="mt-5 grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <Field label="Email" value={detail.email} readOnly />
              <Field
                label="Tên hiển thị"
                onChange={setDisplayName}
                value={displayName}
              />
              <Field
                label="Mã nhân sự"
                onChange={setEmployeeCode}
                value={employeeCode}
              />
              <Field
                label="Số điện thoại"
                onChange={setPhone}
                value={phone}
              />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Trạng thái làm việc</span>
                <select
                  className={inputClassName}
                  disabled={isPending}
                  onChange={(event) => {
                    const value = event.target.value as "active" | "inactive" | "suspended";
                    setEmploymentStatus(value);
                    if (value !== "inactive") {
                      setLeftAt("");
                    }
                  }}
                  value={employmentStatus}
                >
                  <option value="active">Đang làm việc</option>
                  <option value="suspended">Tạm khóa</option>
                  <option value="inactive">Đã nghỉ</option>
                </select>
              </label>
              <Field
                label="Ngày vào làm"
                onChange={setJoinedAt}
                type="date"
                value={joinedAt}
              />
              {employmentStatus === "inactive" ? (
                <Field
                  label="Ngày nghỉ"
                  onChange={setLeftAt}
                  required
                  type="date"
                  value={leftAt}
                />
              ) : null}
              <label className="grid gap-2 text-sm font-semibold text-ink sm:col-span-2">
                <span>Lý do cập nhật</span>
                <textarea
                  className={`${inputClassName} min-h-24 resize-y py-3`}
                  disabled={isPending}
                  maxLength={2000}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  value={reason}
                />
              </label>

              {actionState.status !== "idle" ? (
                <p
                  className={`rounded-md px-3 py-2 text-sm font-medium sm:col-span-2 ${
                    actionState.status === "success"
                      ? "bg-success-bg text-success"
                      : "bg-danger-bg text-danger"
                  }`}
                  role="status"
                >
                  {actionState.message}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                <Button disabled={isPending} onClick={closeDialog} type="button" variant="ghost">
                  Hủy
                </Button>
                <Button disabled={isPending} type="submit">
                  {isPending ? "Đang lưu..." : "Lưu hồ sơ"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({
  label,
  onChange,
  readOnly = false,
  required = false,
  type = "text",
  value,
}: {
  label: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
  type?: "date" | "text";
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      <input
        className={inputClassName}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
