"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import {
  assignStaffRoleAction,
  revokeStaffRoleAction,
} from "@/features/staff/role-actions";
import {
  initialStaffRoleActionState,
  type StaffRoleActionState,
} from "@/features/staff/role-action-types";
import type {
  StaffDirectoryMember,
  StaffRoleOption,
  StaffRoleSummary,
} from "@/features/staff/types";

/**
 * Optional replacements for the two role server actions. The real pages pass
 * nothing (the real actions run); the /dev/lists preview passes inert stubs
 * because it runs on localhost where .env.local may point at production.
 */
export interface StaffRoleActionOverrides {
  assign?: typeof assignStaffRoleAction;
  revoke?: typeof revokeStaffRoleAction;
}

interface StaffRoleManagementProps {
  actions?: StaffRoleActionOverrides;
  /**
   * Table rows (design 16a): the heading stays for assistive tech but is
   * visually hidden and the closed toggle is a 32px line, so a row does not
   * grow by a whole panel. Cards keep the full 44px version.
   */
  compact?: boolean;
  member: StaffDirectoryMember;
  roleOptions: readonly StaffRoleOption[];
}

export function StaffRoleManagement({
  actions,
  compact = false,
  member,
  roleOptions,
}: StaffRoleManagementProps) {
  const headingId = useId();
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const onPendingChange = useCallback((actionId: string, pending: boolean) => {
    setPendingActionId((current) => {
      if (pending) {
        return actionId;
      }

      return current === actionId ? null : current;
    });
  }, []);

  if (member.roles === null) {
    return null;
  }

  if (member.employmentStatus !== "active") {
    return (
      <p className="mt-2 text-secondary text-text-muted">
        Chỉ có thể cấp vai trò cho nhân sự đang hoạt động.
      </p>
    );
  }

  const assignedRoleCodes = new Set(
    member.roles.map((role) => role.code),
  );

  const availableRoles = roleOptions.filter(
    (role) => !assignedRoleCodes.has(role.code),
  );

  return (
    <section aria-busy={Boolean(pendingActionId) || undefined} aria-labelledby={headingId} className={compact ? "mt-1.5 grid gap-2" : "mt-3 grid gap-2"}>
      <h3 className={compact ? "sr-only" : "text-label text-text-muted"} id={headingId}>
        Quản lý vai trò
      </h3>

      <details className="rounded-lg border border-border-subtle bg-surface-base">
        <summary
          aria-disabled={pendingActionId ? true : undefined}
          className={`flex cursor-pointer select-none items-center font-semibold text-action-link focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-focus-ring ${compact ? "min-h-8 px-2.5 py-1 text-secondary" : "min-h-11 px-3 py-2 text-control"}`}
          onClick={(event) => {
            if (pendingActionId) {
              event.preventDefault();
            }
          }}
        >
          Mở quản lý vai trò
        </summary>

        <div className="grid gap-4 border-t border-border-subtle p-3">
          <AssignRoleForm
            action={actions?.assign ?? assignStaffRoleAction}
            availableRoles={availableRoles}
            member={member}
            onPendingChange={onPendingChange}
          />

          {member.roles.length > 0 ? (
            <section aria-labelledby={`${headingId}-revoke`} className="grid gap-2 border-t border-border-subtle pt-3">
              <h4 className="text-label text-text-muted" id={`${headingId}-revoke`}>
                Thu hồi vai trò đang có
              </h4>

              {member.roles.map((role) => (
                <RevokeRoleForm
                  action={actions?.revoke ?? revokeStaffRoleAction}
                  key={role.assignmentId}
                  onPendingChange={onPendingChange}
                  role={role}
                />
              ))}
            </section>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function AssignRoleForm({
  action,
  availableRoles,
  member,
  onPendingChange,
}: {
  action: typeof assignStaffRoleAction;
  availableRoles: readonly StaffRoleOption[];
  member: StaffDirectoryMember;
  onPendingChange: (actionId: string, pending: boolean) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const roleId = useId();
  const roleErrorId = useId();
  const reasonId = useId();
  const reasonErrorId = useId();

  const [state, formAction, pending] = useActionState(
    action,
    initialStaffRoleActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  useEffect(() => {
    onPendingChange("assign", pending);

    return () => onPendingChange("assign", false);
  }, [onPendingChange, pending]);

  return (
    <form
      action={formAction}
      className="grid gap-3"
      ref={formRef}
    >
      <input name="userId" type="hidden" value={member.id} />

      <div>
        <label
          className="text-label text-text-muted"
          htmlFor={roleId}
        >
          Vai trò cần cấp <span aria-hidden="true" className="text-danger">*</span>
        </label>

        <select
          aria-describedby={state.fieldErrors?.roleCode?.length ? roleErrorId : undefined}
          aria-invalid={Boolean(state.fieldErrors?.roleCode?.length)}
          className="mt-1 h-11 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-control text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled"
          defaultValue=""
          disabled={pending || availableRoles.length === 0}
          id={roleId}
          name="roleCode"
          required
        >
          <option disabled value="">
            {availableRoles.length === 0
              ? "Đã có tất cả vai trò"
              : "Chọn vai trò"}
          </option>

          {availableRoles.map((role) => (
            <option key={role.id} value={role.code}>
              {role.name}
            </option>
          ))}
        </select>

        <FieldErrors errors={state.fieldErrors?.roleCode} id={roleErrorId} />
      </div>

      <div>
        <label
          className="text-label text-text-muted"
          htmlFor={reasonId}
        >
          Lý do cấp vai trò <span aria-hidden="true" className="text-danger">*</span>
        </label>

        <input
          aria-describedby={state.fieldErrors?.reason?.length ? reasonErrorId : undefined}
          aria-invalid={Boolean(state.fieldErrors?.reason?.length)}
          className="mt-1 h-11 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-control text-text-strong outline-none transition placeholder:text-text-muted focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled"
          disabled={pending || availableRoles.length === 0}
          id={reasonId}
          maxLength={500}
          name="reason"
          placeholder="Ví dụ: Phân công nhiệm vụ từ tháng 8/2026"
          required
          type="text"
        />

        <FieldErrors errors={state.fieldErrors?.reason} id={reasonErrorId} />
        <FieldErrors errors={state.fieldErrors?.userId} />
      </div>

      <ActionMessage state={state} />

      <Button
        className="min-h-11 w-full"
        disabled={pending || availableRoles.length === 0}
        size="sm"
        type="submit"
      >
        {pending ? "Đang cấp vai trò..." : "Cấp vai trò"}
      </Button>
    </form>
  );
}

function RevokeRoleForm({
  action,
  onPendingChange,
  role,
}: {
  action: typeof revokeStaffRoleAction;
  onPendingChange: (actionId: string, pending: boolean) => void;
  role: StaffRoleSummary;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const reasonId = useId();
  const reasonErrorId = useId();

  const [state, formAction, pending] = useActionState(
    action,
    initialStaffRoleActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  useEffect(() => {
    onPendingChange(role.assignmentId, pending);

    return () => onPendingChange(role.assignmentId, false);
  }, [onPendingChange, pending, role.assignmentId]);

  return (
    <details className="rounded-md border border-border-subtle bg-surface-base">
      <summary
        aria-disabled={pending || undefined}
        className="flex min-h-11 cursor-pointer select-none items-center px-3 py-2 text-control font-semibold text-danger focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-focus-ring"
        onClick={(event) => {
          if (pending) {
            event.preventDefault();
          }
        }}
      >
        Thu hồi: {role.name}
      </summary>

      <form
        action={formAction}
        className="grid gap-3 border-t border-border-subtle p-3"
        ref={formRef}
      >
        <input
          name="assignmentId"
          type="hidden"
          value={role.assignmentId}
        />

        <div>
          <label
            className="text-label text-text-muted"
            htmlFor={reasonId}
          >
            Lý do thu hồi <span aria-hidden="true" className="text-danger">*</span>
          </label>

          <input
            aria-describedby={state.fieldErrors?.reason?.length ? reasonErrorId : undefined}
            aria-invalid={Boolean(state.fieldErrors?.reason?.length)}
            className="mt-1 h-11 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-control text-text-strong outline-none transition placeholder:text-text-muted focus:border-danger focus:ring-[3px] focus:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled"
            disabled={pending}
            id={reasonId}
            maxLength={500}
            name="reason"
            placeholder="Nhập lý do thu hồi vai trò"
            required
            type="text"
          />

          <FieldErrors errors={state.fieldErrors?.reason} id={reasonErrorId} />
          <FieldErrors errors={state.fieldErrors?.assignmentId} />
        </div>

        <ActionMessage state={state} />

        <Button
          className="min-h-11 w-full border-danger text-danger hover:border-danger hover:bg-danger-bg"
          disabled={pending}
          size="sm"
          type="submit"
          variant="outline"
        >
          {pending ? "Đang thu hồi..." : `Xác nhận thu hồi ${role.name}`}
        </Button>
      </form>
    </details>
  );
}

function FieldErrors({
  errors,
  id,
}: {
  errors: string[] | undefined;
  id?: string;
}) {
  if (!errors?.length) {
    return null;
  }

  return (
    <div className="mt-1 grid gap-1" id={id}>
      {errors.map((error) => (
        <p className="text-caption text-danger" key={error}>
          {error}
        </p>
      ))}
    </div>
  );
}

function ActionMessage({
  state,
}: {
  state: StaffRoleActionState;
}) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <ResultBanner
      title={state.message}
      tone={state.status === "success" ? "success" : "error"}
    />
  );
}
