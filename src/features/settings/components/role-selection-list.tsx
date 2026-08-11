import type { StaffRoleOption } from "@/features/staff/types";
import { cn } from "@/lib/utils";

interface RoleSelectionListProps {
  errorId?: string;
  hasError?: boolean;
  disabled?: boolean;
  onToggle: (roleId: string) => void;
  roles: readonly StaffRoleOption[];
  selectedRoleIds: ReadonlySet<string>;
}

export function RoleSelectionList({
  disabled = false,
  errorId,
  hasError = false,
  onToggle,
  roles,
  selectedRoleIds,
}: RoleSelectionListProps) {
  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline bg-surface-1">
      {roles.map((role) => {
        const checked = selectedRoleIds.has(role.id);

        return (
          <label
            className={cn(
              "flex min-h-14 cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2",
              disabled && "cursor-not-allowed opacity-60",
            )}
            key={role.id}
          >
            <input
              aria-describedby={hasError ? errorId : undefined}
              aria-invalid={hasError}
              checked={checked}
              className="mt-1 h-5 w-5 flex-none accent-primary"
              disabled={disabled}
              onChange={() => onToggle(role.id)}
              type="checkbox"
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                {role.name}
                {role.code === "owner" ? (
                  <span className="rounded-pill border border-primary/20 bg-primary-soft px-2 py-0.5 text-[11px] text-primary">
                    Toàn quyền
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
                {role.description ?? role.code}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
