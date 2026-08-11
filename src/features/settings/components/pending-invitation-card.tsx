"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  initialSettingsActionState,
  type SettingsActionState,
} from "@/features/settings/action-types";
import { revokeInvitationAction } from "@/features/settings/actions";
import { SettingsActionMessage } from "@/features/settings/components/settings-action-message";
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
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<SettingsActionState>(
    initialSettingsActionState,
  );
  const [isPending, startTransition] = useTransition();

  if (invitation.status !== "pending") {
    return null;
  }

  const handleRevoke = (): void => {
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
        className="min-h-11 sm:min-h-8"
        onClick={() => {
          setReason("");
          setActionState(initialSettingsActionState);
          setIsOpen(true);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        Thu hồi
      </Button>

      {isOpen ? (
        <div
          aria-labelledby={`revoke-invitation-${invitation.id}`}
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-4"
          role="dialog"
        >
          <div className="mx-auto my-6 w-full max-w-lg rounded-lg border border-hairline bg-surface-1 p-5 shadow-xl">
            <h2
              className="text-lg font-bold text-ink"
              id={`revoke-invitation-${invitation.id}`}
            >
              Thu hồi lời mời
            </h2>
            <p className="mt-1 break-all text-sm text-ink-muted">
              {invitation.email} sẽ không thể nhận vai trò từ lời mời này.
            </p>

            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleRevoke();
              }}
            >
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Lý do thu hồi</span>
                <textarea
                  className="min-h-24 w-full resize-y rounded-md border border-hairline bg-white px-3 py-3 text-sm text-ink outline-none focus:border-danger focus:ring-[3px] focus:ring-danger/15"
                  disabled={isPending}
                  maxLength={2000}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  value={reason}
                />
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
                <Button disabled={isPending} isLoading={isPending} size="lg" type="submit" variant="danger">
                  Thu hồi lời mời
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
