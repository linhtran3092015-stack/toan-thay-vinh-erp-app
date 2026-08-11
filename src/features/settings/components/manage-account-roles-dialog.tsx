"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  initialSettingsActionState,
  type SettingsActionState,
} from "@/features/settings/action-types";
import { setAccountRolesAction } from "@/features/settings/actions";
import { RoleSelectionList } from "@/features/settings/components/role-selection-list";
import type {
  StaffDirectoryMember,
  StaffRoleOption,
} from "@/features/staff/types";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

export function ManageAccountRolesDialog({
  member,
  roles,
}: {
  member: StaffDirectoryMember;
  roles: readonly StaffRoleOption[];
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const roleGroupLabelId = useId();
  const roleGroupErrorId = `${roleGroupLabelId}-error`;
  const reasonId = useId();
  const reasonErrorId = `${reasonId}-error`;
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [actionState, setActionState] = useState<SettingsActionState>(
    initialSettingsActionState,
  );
  const [isPending, startTransition] = useTransition();
  const isInteractionLocked = isPending && actionState.status !== "error";
  const roleIdsError = actionState.status === "error"
    ? actionState.fieldErrors?.roleIds?.[0]
    : undefined;
  const reasonError = actionState.status === "error"
    ? actionState.fieldErrors?.reason?.[0]
    : undefined;

  const openDialog = (): void => {
    setSelectedRoleIds(new Set(member.roles?.map((role) => role.id) ?? []));
    setReason("");
    setActionState(initialSettingsActionState);
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
      const result = await setAccountRolesAction({
        reason,
        roleIds: Array.from(selectedRoleIds),
        userId: member.id,
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
      <Button className="min-h-11" onClick={openDialog} ref={triggerRef} size="sm" type="button" variant="outline">
        Thiết lập vai trò
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-2xl"
        initialFocusRef={reasonRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Thiết lập vai trò
          </h2>
          <p className="mt-1 break-words text-secondary text-text-muted" id={descriptionId}>
            {member.displayName} · {member.email}
          </p>

          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <div
              aria-describedby={roleIdsError ? roleGroupErrorId : undefined}
              aria-labelledby={roleGroupLabelId}
              className="grid gap-1.5"
              role="group"
            >
              <p className="text-label text-text-default" id={roleGroupLabelId}>Vai trò hiệu lực</p>
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

            <div className="grid gap-1.5">
              <label className="text-label text-text-default" htmlFor={reasonId}>
                Lý do thay đổi
              </label>
              <textarea
                aria-describedby={reasonError ? reasonErrorId : undefined}
                aria-invalid={Boolean(reasonError)}
                className={`${inputClassName} min-h-24 resize-y py-3`}
                disabled={isInteractionLocked}
                id={reasonId}
                maxLength={2000}
                onChange={(event) => setReason(event.target.value)}
                ref={reasonRef}
                required
                value={reason}
              />
              {reasonError ? <p className="text-caption font-medium text-danger" id={reasonErrorId}>{reasonError}</p> : null}
            </div>

            {actionState.status === "error" ? (
              <ResultBanner
                description={actionState.message}
                title="Không thể lưu vai trò"
                tone="error"
              />
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" disabled={isInteractionLocked} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} size="lg" type="submit">
                {isInteractionLocked ? "Đang lưu vai trò…" : "Lưu vai trò"}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}
