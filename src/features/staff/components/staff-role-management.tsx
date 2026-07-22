"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
} from "react";

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
import { cn } from "@/lib/utils";

interface StaffRoleManagementProps {
  member: StaffDirectoryMember;
  roleOptions: readonly StaffRoleOption[];
}

export function StaffRoleManagement({
  member,
  roleOptions,
}: StaffRoleManagementProps) {
  if (member.roles === null) {
    return null;
  }

  if (member.employmentStatus !== "active") {
    return (
      <p className="mt-2 text-xs leading-5 text-ink-muted">
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
    <details className="mt-3 rounded-lg border border-hairline bg-canvas">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-primary">
        Quản lý vai trò
      </summary>

      <div className="grid gap-4 border-t border-hairline p-3">
        <AssignRoleForm
          availableRoles={availableRoles}
          member={member}
        />

        {member.roles.length > 0 ? (
          <div className="grid gap-2 border-t border-hairline pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Thu hồi vai trò đang có
            </p>

            {member.roles.map((role) => (
              <RevokeRoleForm key={role.assignmentId} role={role} />
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function AssignRoleForm({
  availableRoles,
  member,
}: {
  availableRoles: readonly StaffRoleOption[];
  member: StaffDirectoryMember;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const roleId = useId();
  const reasonId = useId();

  const [state, formAction, pending] = useActionState(
    assignStaffRoleAction,
    initialStaffRoleActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form
      action={formAction}
      className="grid gap-3"
      ref={formRef}
    >
      <input name="userId" type="hidden" value={member.id} />

      <div>
        <label
          className="text-xs font-semibold text-ink"
          htmlFor={roleId}
        >
          Vai trò cần cấp
        </label>

        <select
          className="mt-1 h-10 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:bg-neutral-bg disabled:text-ink-subtle"
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

        <FieldErrors errors={state.fieldErrors?.roleCode} />
      </div>

      <div>
        <label
          className="text-xs font-semibold text-ink"
          htmlFor={reasonId}
        >
          Lý do cấp vai trò
        </label>

        <input
          className="mt-1 h-10 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:bg-neutral-bg"
          disabled={pending || availableRoles.length === 0}
          id={reasonId}
          maxLength={500}
          name="reason"
          placeholder="Ví dụ: Phân công nhiệm vụ từ tháng 8/2026"
          required
          type="text"
        />

        <FieldErrors errors={state.fieldErrors?.reason} />
        <FieldErrors errors={state.fieldErrors?.userId} />
      </div>

      <ActionMessage state={state} />

      <Button
        className="w-full"
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
  role,
}: {
  role: StaffRoleSummary;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const reasonId = useId();

  const [state, formAction, pending] = useActionState(
    revokeStaffRoleAction,
    initialStaffRoleActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <details className="rounded-md border border-hairline bg-white">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-danger">
        Thu hồi: {role.name}
      </summary>

      <form
        action={formAction}
        className="grid gap-3 border-t border-hairline p-3"
        ref={formRef}
      >
        <input
          name="assignmentId"
          type="hidden"
          value={role.assignmentId}
        />

        <div>
          <label
            className="text-xs font-semibold text-ink"
            htmlFor={reasonId}
          >
            Lý do thu hồi
          </label>

          <input
            className="mt-1 h-10 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-danger focus:ring-[3px] focus:ring-danger/15 disabled:bg-neutral-bg"
            disabled={pending}
            id={reasonId}
            maxLength={500}
            name="reason"
            placeholder="Nhập lý do thu hồi vai trò"
            required
            type="text"
          />

          <FieldErrors errors={state.fieldErrors?.reason} />
          <FieldErrors errors={state.fieldErrors?.assignmentId} />
        </div>

        <ActionMessage state={state} />

        <Button
          className="w-full border-danger text-danger hover:border-danger hover:bg-danger-bg"
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
}: {
  errors: string[] | undefined;
}) {
  if (!errors?.length) {
    return null;
  }

  return (
    <div className="mt-1 grid gap-1">
      {errors.map((error) => (
        <p className="text-xs text-danger" key={error}>
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
    <p
      aria-live="polite"
      className={cn(
        "rounded-md border px-3 py-2 text-xs font-medium leading-5",
        state.status === "success"
          ? "border-success-border bg-success-bg text-success"
          : "border-danger-border bg-danger-bg text-danger",
      )}
      role="status"
    >
      {state.message}
    </p>
  );
}
