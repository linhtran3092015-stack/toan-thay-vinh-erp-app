"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  initialSettingsActionState,
  type SettingsActionState,
} from "@/features/settings/action-types";
import { setAccountRolesAction } from "@/features/settings/actions";
import { RoleSelectionList } from "@/features/settings/components/role-selection-list";
import { SettingsActionMessage } from "@/features/settings/components/settings-action-message";
import type {
  StaffDirectoryMember,
  StaffRoleOption,
} from "@/features/staff/types";

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-canvas";

export function ManageAccountRolesDialog({
  member,
  roles,
}: {
  member: StaffDirectoryMember;
  roles: readonly StaffRoleOption[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [actionState, setActionState] = useState<SettingsActionState>(
    initialSettingsActionState,
  );
  const [isPending, startTransition] = useTransition();

  const openDialog = (): void => {
    setSelectedRoleIds(new Set(member.roles?.map((role) => role.id) ?? []));
    setReason("");
    setActionState(initialSettingsActionState);
    setIsOpen(true);
  };

  const toggleRole = (roleId: string): void => {
    setSelectedRoleIds((current) => {
      const next = new Set(current);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSubmit = (): void => {
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
      <Button onClick={openDialog} size="sm" type="button" variant="outline">
        Thiết lập vai trò
      </Button>

      {isOpen ? (
        <div
          aria-labelledby={`manage-account-roles-${member.id}`}
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-4"
          role="dialog"
        >
          <div className="mx-auto my-5 w-full max-w-2xl rounded-lg border border-hairline bg-surface-1 p-5 shadow-xl">
            <h2
              className="text-lg font-bold text-ink"
              id={`manage-account-roles-${member.id}`}
            >
              Thiết lập vai trò
            </h2>
            <p className="mt-1 break-words text-sm text-ink-muted">
              {member.displayName} · {member.email}
            </p>

            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Vai trò hiệu lực</p>
                <RoleSelectionList
                  disabled={isPending}
                  onToggle={toggleRole}
                  roles={roles}
                  selectedRoleIds={selectedRoleIds}
                />
                {actionState.fieldErrors?.roleIds?.[0] ? (
                  <p className="mt-1 text-xs font-medium text-danger">
                    {actionState.fieldErrors.roleIds[0]}
                  </p>
                ) : null}
              </div>

              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Lý do thay đổi</span>
                <textarea
                  className={`${inputClassName} min-h-24 resize-y py-3`}
                  disabled={isPending}
                  maxLength={2000}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  value={reason}
                />
                {actionState.fieldErrors?.reason?.[0] ? (
                  <span className="text-xs font-medium text-danger">
                    {actionState.fieldErrors.reason[0]}
                  </span>
                ) : null}
              </label>

              <SettingsActionMessage state={actionState} />

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  disabled={isPending}
                  onClick={() => setIsOpen(false)}
                  size="lg"
                  type="button"
                  variant="ghost"
                >
                  Hủy
                </Button>
                <Button disabled={isPending} isLoading={isPending} size="lg" type="submit">
                  Lưu vai trò
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
