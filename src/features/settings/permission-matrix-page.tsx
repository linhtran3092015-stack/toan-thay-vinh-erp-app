"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type {
  SettingsPermission,
  SettingsPermissionMatrix,
  SettingsRole,
} from "@/features/settings/types";

interface PermissionMatrixPageProps {
  matrix: SettingsPermissionMatrix;
}

export function PermissionMatrixPage({ matrix }: PermissionMatrixPageProps) {
  const activeRoles = useMemo(
    () => matrix.roles.filter((role) => role.isActive),
    [matrix.roles],
  );
  const activePermissions = useMemo(
    () => matrix.permissions.filter((permission) => permission.isActive),
    [matrix.permissions],
  );
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState(
    activeRoles[0]?.id ?? "",
  );

  const grantKeys = useMemo(
    () =>
      new Set(
        matrix.grants.map(
          (grant) => `${grant.roleId}:${grant.permissionId}`,
        ),
      ),
    [matrix.grants],
  );

  const moduleOptions = useMemo(
    () =>
      Array.from(
        new Set(activePermissions.map((permission) => permission.module)),
      ).sort((left, right) => left.localeCompare(right, "vi")),
    [activePermissions],
  );

  const filteredPermissions = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);

    return activePermissions.filter((permission) => {
      const searchable = normalizeSearch(
        `${permission.code} ${permission.name} ${permission.description ?? ""}`,
      );

      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (!module || permission.module === module)
      );
    });
  }, [activePermissions, module, search]);

  const selectedRole =
    activeRoles.find((role) => role.id === selectedRoleId) ?? activeRoles[0];
  const hasFilters = Boolean(search || module);

  const resetFilters = () => {
    setSearch("");
    setModule("");
  };

  if (activeRoles.length === 0 || activePermissions.length === 0) {
    return (
      <EmptyState
        description="Hệ thống chưa có vai trò hoặc permission đang hoạt động để đối chiếu."
        title="Ma trận quyền đang trống"
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-section font-semibold text-ink">
            Ma trận vai trò và quyền
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {activeRoles.length} vai trò · {filteredPermissions.length}/
            {activePermissions.length} quyền đang hiển thị
          </p>
        </div>
        <span className="w-fit rounded-pill border border-hairline bg-neutral-bg px-2.5 py-1 text-xs font-semibold text-ink-muted">
          Chỉ đọc
        </span>
      </header>

      <section
        aria-label="Bộ lọc ma trận quyền"
        className="grid gap-3 border-y border-hairline bg-surface-1 py-4 md:grid-cols-[minmax(0,1fr)_220px_auto]"
      >
        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Tìm quyền</span>
          <input
            className={controlClassName}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tên hoặc mã permission..."
            type="search"
            value={search}
          />
        </label>

        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Module</span>
          <select
            className={controlClassName}
            onChange={(event) => setModule(event.target.value)}
            value={module}
          >
            <option value="">Tất cả module</option>
            {moduleOptions.map((option) => (
              <option key={option} value={option}>
                {formatModuleName(option)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <Button
            className="min-h-11 w-full"
            disabled={!hasFilters}
            onClick={resetFilters}
            type="button"
            variant="outline"
          >
            Xóa lọc
          </Button>
        </div>
      </section>

      {filteredPermissions.length === 0 ? (
        <EmptyState
          actionLabel="Xóa bộ lọc"
          description="Không có permission nào phù hợp với điều kiện đang chọn."
          onAction={resetFilters}
          title="Không tìm thấy permission"
        />
      ) : (
        <>
          <PermissionDesktopTable
            grantKeys={grantKeys}
            permissions={filteredPermissions}
            roles={activeRoles}
          />

          <PermissionMobileList
            grantKeys={grantKeys}
            onRoleChange={setSelectedRoleId}
            permissions={filteredPermissions}
            role={selectedRole}
            roles={activeRoles}
            selectedRoleId={selectedRole?.id ?? ""}
          />
        </>
      )}
    </div>
  );
}

function PermissionDesktopTable({
  grantKeys,
  permissions,
  roles,
}: {
  grantKeys: ReadonlySet<string>;
  permissions: readonly SettingsPermission[];
  roles: readonly SettingsRole[];
}) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-hairline bg-surface-1 shadow-card lg:block">
      <table className="min-w-[1480px] border-collapse text-left text-sm">
        <thead className="bg-surface-2 text-xs font-semibold text-ink-muted">
          <tr>
            <th className="sticky left-0 z-10 w-[320px] border-r border-hairline bg-surface-2 px-4 py-3">
              Permission
            </th>
            {roles.map((role) => (
              <th className="min-w-[128px] px-3 py-3 text-center" key={role.id}>
                <span className="block text-ink">{role.name}</span>
                <span className="mt-1 block font-normal text-ink-muted">
                  {role.code}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {permissions.map((permission) => (
            <tr className="hover:bg-surface-2/50" key={permission.id}>
              <td className="sticky left-0 z-[5] border-r border-hairline bg-surface-1 px-4 py-3">
                <p className="font-semibold text-ink">{permission.name}</p>
                <p className="mt-1 font-mono text-xs text-ink-muted">
                  {permission.code}
                </p>
                <p className="mt-1 text-xs text-ink-subtle">
                  {formatModuleName(permission.module)}
                </p>
              </td>
              {roles.map((role) => {
                const granted = grantKeys.has(`${role.id}:${permission.id}`);

                return (
                  <td className="px-3 py-3 text-center" key={role.id}>
                    <GrantBadge granted={granted} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermissionMobileList({
  grantKeys,
  onRoleChange,
  permissions,
  role,
  roles,
  selectedRoleId,
}: {
  grantKeys: ReadonlySet<string>;
  onRoleChange: (roleId: string) => void;
  permissions: readonly SettingsPermission[];
  role: SettingsRole | undefined;
  roles: readonly SettingsRole[];
  selectedRoleId: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card lg:hidden">
      <div className="border-b border-hairline p-4">
        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Vai trò cần đối chiếu</span>
          <select
            className={controlClassName}
            onChange={(event) => onRoleChange(event.target.value)}
            value={selectedRoleId}
          >
            {roles.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.code})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="divide-y divide-hairline">
        {permissions.map((permission) => {
          const granted = role
            ? grantKeys.has(`${role.id}:${permission.id}`)
            : false;

          return (
            <article
              className="flex items-start justify-between gap-3 px-4 py-4"
              key={permission.id}
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{permission.name}</p>
                <p className="mt-1 break-all font-mono text-xs text-ink-muted">
                  {permission.code}
                </p>
                <p className="mt-1 text-xs text-ink-subtle">
                  {formatModuleName(permission.module)}
                </p>
              </div>
              <GrantBadge granted={granted} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GrantBadge({ granted }: { granted: boolean }) {
  return (
    <span
      className={`inline-flex min-w-[76px] flex-none justify-center rounded-pill border px-2.5 py-1 text-xs font-semibold ${
        granted
          ? "border-success-border bg-success-bg text-success"
          : "border-hairline bg-neutral-bg text-ink-muted"
      }`}
    >
      {granted ? "Có quyền" : "Không có"}
    </span>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .trim();
}

function formatModuleName(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toLocaleUpperCase("vi") + part.slice(1))
    .join(" ");
}

const controlClassName =
  "h-11 min-w-0 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20";
