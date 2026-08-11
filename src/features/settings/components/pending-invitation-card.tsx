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
import { revokeInvitationAction } from "@/features/settings/actions";
import type {
  SettingsAccountInvitation,
  SettingsRole,
} from "@/features/settings/types";

export function PendingInvitationCard({
  invitation,
  rolesById,
}: {
  invitation: SettingsAccountInvitation;
  rolesById: ReadonlyMap<string, SettingsRole>;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const reasonErrorId = `${reasonId}-error`;
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<SettingsActionState>(
    initialSettingsActionState,
  );
  const [isPending, startTransition] = useTransition();
  const isInteractionLocked = isPending && actionState.status !== "error";
  const reasonError = actionState.status === "error"
    ? actionState.fieldErrors?.reason?.[0]
    : undefined;

  if (invitation.status !== "pending") {
    return null;
  }

  const openDialog = (): void => {
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

  const handleRevoke = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isInteractionLocked) {
      return;
    }

    setActionState(initialSettingsActionState);
    startTransition(async () => {
      const result = await revokeInvitationAction({
        invitationId: invitation.id,
        reason,
      });
      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <article className="grid gap-3 rounded-lg border border-hairline bg-surface-1 p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-all font-semibold text-ink">{invitation.email}</p>
          <span className="rounded-pill border border-warning-border bg-warning-bg px-2.5 py-1 text-xs font-semibold text-warning">
            Chờ đăng nhập
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          Đã thêm {formatDateTime(invitation.invitedAt)}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {invitation.roleIds.map((roleId) => (
            <span
              className="rounded-pill border border-hairline bg-neutral-bg px-2.5 py-1 text-xs font-semibold text-ink-muted"
              key={roleId}
            >
              {rolesById.get(roleId)?.name ?? "Vai trò không còn hoạt động"}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-ink-muted">
          Lý do: {invitation.invitationReason}
        </p>
      </div>

      <Button
        className="min-h-11"
        onClick={openDialog}
        ref={triggerRef}
        size="sm"
        type="button"
        variant="outline"
      >
        Thu hồi
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        initialFocusRef={reasonRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Thu hồi lời mời
          </h2>
          <p className="mt-1 break-all text-secondary text-text-muted" id={descriptionId}>
            {invitation.email} sẽ không thể nhận vai trò từ lời mời này.
          </p>

          <form className="mt-5 grid gap-4" onSubmit={handleRevoke}>
            <div className="grid gap-1.5">
              <label className="text-label text-text-default" htmlFor={reasonId}>
                Lý do thu hồi
              </label>
              <textarea
                aria-describedby={reasonError ? reasonErrorId : undefined}
                aria-invalid={Boolean(reasonError)}
                className="min-h-24 w-full resize-y rounded-md border border-border-subtle bg-surface-base px-3 py-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled"
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
                title="Không thể thu hồi lời mời"
                tone="error"
              />
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" disabled={isInteractionLocked} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} size="lg" type="submit" variant="danger">
                {isInteractionLocked ? "Đang thu hồi…" : "Thu hồi lời mời"}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </article>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
