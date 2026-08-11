"use client";

import { useRouter } from "next/navigation";
import {
  cloneElement,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactElement,
} from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  initialSettingsActionState,
  type SettingsActionState,
} from "@/features/settings/action-types";
import { inviteAccountAction } from "@/features/settings/actions";
import { RoleSelectionList } from "@/features/settings/components/role-selection-list";
import type { StaffRoleOption } from "@/features/staff/types";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition placeholder:text-text-muted focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

export function InviteAccountDialog({
  roles,
}: {
  roles: readonly StaffRoleOption[];
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const emailId = useId();
  const roleGroupLabelId = useId();
  const roleGroupErrorId = `${roleGroupLabelId}-error`;
  const reasonId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [actionState, setActionState] = useState<SettingsActionState>(
    initialSettingsActionState,
  );
  const [isPending, startTransition] = useTransition();
  const isInteractionLocked = isPending && actionState.status !== "error";
  const fieldErrors = actionState.status === "error" ? actionState.fieldErrors ?? {} : {};
  const emailError = fieldErrors.email?.[0];
  const reasonError = fieldErrors.reason?.[0];
  const roleIdsError = fieldErrors.roleIds?.[0];

  const reset = (): void => {
    setEmail("");
    setReason("");
    setSelectedRoleIds(new Set());
    setActionState(initialSettingsActionState);
  };

  const openDialog = (): void => {
    reset();
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (isInteractionLocked) {
      return;
    }

    setIsOpen(false);
    setActionState(initialSettingsActionState);
  };

  const toggleRole = (roleId: string): void => {
    setSelectedRoleIds((current) => {
      const next = new Set(current);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isInteractionLocked) {
      return;
    }

    setActionState(initialSettingsActionState);
    startTransition(async () => {
      const result = await inviteAccountAction({
        email,
        reason,
        roleIds: Array.from(selectedRoleIds),
      });
      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        reset();
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button className="min-h-11" onClick={openDialog} ref={triggerRef} size="lg" type="button">
        Thêm tài khoản
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-2xl"
        initialFocusRef={emailRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Thêm tài khoản truy cập
          </h2>
          <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
            Khai báo email Google và vai trò. Tài khoản được kích hoạt khi người dùng đăng nhập lần đầu bằng đúng email này.
          </p>

          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <FieldError id={emailId} error={emailError} label="Email Google">
              <input
                autoComplete="email"
                className={inputClassName}
                disabled={isInteractionLocked}
                id={emailId}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tennguoidung@gmail.com"
                ref={emailRef}
                required
                type="email"
                value={email}
              />
            </FieldError>

            <div
              aria-describedby={roleIdsError ? roleGroupErrorId : undefined}
              aria-labelledby={roleGroupLabelId}
              className="grid gap-1.5"
              role="group"
            >
              <p className="text-label text-text-default" id={roleGroupLabelId}>Vai trò ban đầu</p>
              <RoleSelectionList
                disabled={isInteractionLocked}
                errorId={roleGroupErrorId}
                hasError={Boolean(roleIdsError)}
                onToggle={toggleRole}
                roles={roles}
                selectedRoleIds={selectedRoleIds}
              />
              {roleIdsError ? <p className="text-caption font-medium text-danger" id={roleGroupErrorId}>{roleIdsError}</p> : null}
            </div>

            <FieldError id={reasonId} error={reasonError} label="Lý do cấp truy cập">
              <textarea
                className={`${inputClassName} min-h-24 resize-y py-3`}
                disabled={isInteractionLocked}
                id={reasonId}
                maxLength={2000}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ví dụ: Bổ sung nhân sự kế toán từ tháng 8/2026"
                required
                value={reason}
              />
            </FieldError>

            {actionState.status === "error" ? (
              <ResultBanner
                description={actionState.message}
                title="Không thể thêm tài khoản"
                tone="error"
              />
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" disabled={isInteractionLocked} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} size="lg" type="submit">
                {isInteractionLocked ? "Đang thêm tài khoản…" : "Thêm tài khoản"}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}

function FieldError({
  children,
  error,
  id,
  label,
}: {
  children: ReactElement<{
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
  error?: string;
  id: string;
  label: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1.5">
      <label className="text-label text-text-default" htmlFor={id}>{label}</label>
      {cloneElement(children, {
        "aria-describedby": error ? errorId : undefined,
        "aria-invalid": Boolean(error),
      })}
      {error ? <p className="text-caption font-medium text-danger" id={errorId}>{error}</p> : null}
    </div>
  );
}
