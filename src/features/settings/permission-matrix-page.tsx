"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  initialSettingsActionState,
  type SettingsActionState,
} from "@/features/settings/action-types";
import { setRolePermissionsAction } from "@/features/settings/actions";
import { SettingsActionMessage } from "@/features/settings/components/settings-action-message";
import type {
  SettingsPermission,
  SettingsPermissionMatrix,
  SettingsRole,
} from "@/features/settings/types";
import { cn } from "@/lib/utils";

interface PermissionMatrixPageProps {
  canManage: boolean;
  matrix: SettingsPermissionMatrix;
}

export function PermissionMatrixPage({
  canManage,
  matrix,
}: PermissionMatrixPageProps) {
  const activeRoles = useMemo(
    () => matrix.roles.filter((role) => role.isActive),
    [matrix.roles],
  );
  const activePermissions = useMemo(
    () => matrix.permissions.filter((permission) => permission.isActive),
    [matrix.permissions],
  );
  const defaultRole =
    (canManage && activeRoles.find((role) => role.code !== "owner")) ||
    activeRoles[0];
  const [selectedRoleId, setSelectedRoleId] = useState(defaultRole?.id ?? "");
  const selectedRole =
    activeRoles.find((role) => role.id === selectedRoleId) ?? defaultRole;
  const grantedPermissionIds = useMemo(
    () =>
      new Set(
        matrix.grants
          .filter((grant) => grant.roleId === selectedRole?.id)
          .map((grant) => grant.permissionId),
      ),
    [matrix.grants, selectedRole?.id],
  );

  if (activeRoles.length === 0 || activePermissions.length === 0) {
    return (
      <EmptyState
        description="Hệ thống chưa có vai trò hoặc quyền đang hoạt động để cấu hình."
        title="Ma trận quyền đang trống"
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      <header className="flex flex-col gap-2 border-b border-hairline pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-page-title font-bold text-ink">Ma trận phân quyền</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">
            Chọn một vai trò, đánh dấu các quyền cần cấp và lưu toàn bộ thay đổi trong một lần.
          </p>
        </div>
        <span className={cn(
          "w-fit rounded-pill border px-2.5 py-1 text-xs font-semibold",
          canManage
            ? "border-success-border bg-success-bg text-success"
            : "border-hairline bg-neutral-bg text-ink-muted",
        )}>
          {canManage ? "Owner · Có thể chỉnh sửa" : "Chỉ đọc"}
        </span>
      </header>

      <div className="md:grid md:grid-cols-[230px_minmax(0,1fr)] md:gap-5">
        <aside className="hidden md:block" aria-label="Danh sách vai trò">
          <p className="mb-2 text-xs font-semibold uppercase text-ink-muted">Vai trò</p>
          <div className="grid gap-1">
            {activeRoles.map((role) => {
              const grantCount = matrix.grants.filter(
                (grant) => grant.roleId === role.id,
              ).length;

              return (
                <button
                  className={cn(
                    "min-h-12 rounded-md border px-3 py-2 text-left transition-colors",
                    selectedRole?.id === role.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink",
                  )}
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{role.name}</span>
                  <span className="mt-0.5 block text-xs">
                    {role.code === "owner" ? "Toàn quyền bắt buộc" : `${grantCount} quyền`}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0">
          <label className="mb-4 grid gap-1.5 text-xs font-semibold text-ink-muted md:hidden">
            <span>Vai trò cần cấu hình</span>
            <select
              className={controlClassName}
              onChange={(event) => setSelectedRoleId(event.target.value)}
              value={selectedRole?.id ?? ""}
            >
              {activeRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} ({role.code})
                </option>
              ))}
            </select>
          </label>

          {selectedRole ? (
            <RolePermissionEditor
              canManage={canManage}
              initialPermissionIds={grantedPermissionIds}
              key={`${selectedRole.id}:${Array.from(grantedPermissionIds).sort().join(",")}`}
              permissions={activePermissions}
              role={selectedRole}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RolePermissionEditor({
  canManage,
  initialPermissionIds,
  permissions,
  role,
}: {
  canManage: boolean;
  initialPermissionIds: ReadonlySet<string>;
  permissions: readonly SettingsPermission[];
  role: SettingsRole;
}) {
  const router = useRouter();
  const [selectedPermissionIds, setSelectedPermissionIds] = useState(
    new Set(initialPermissionIds),
  );
  const [savedPermissionIds, setSavedPermissionIds] = useState(
    new Set(initialPermissionIds),
  );
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<SettingsActionState>(
    initialSettingsActionState,
  );
  const [isPending, startTransition] = useTransition();
  const isOwnerRole = role.code === "owner";
  const editable = canManage && !isOwnerRole;

  const modules = useMemo(
    () => Array.from(new Set(permissions.map((permission) => permission.module))).sort(),
    [permissions],
  );
  const filteredPermissions = useMemo(() => {
    const query = normalizeSearch(search);

    return permissions.filter((permission) => {
      const content = normalizeSearch(
        `${permission.name} ${permission.code} ${permission.description ?? ""}`,
      );
      return (
        (!query || content.includes(query)) &&
        (!moduleFilter || permission.module === moduleFilter)
      );
    });
  }, [moduleFilter, permissions, search]);
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, SettingsPermission[]>();
    for (const permission of filteredPermissions) {
      const group = groups.get(permission.module) ?? [];
      group.push(permission);
      groups.set(permission.module, group);
    }
    return Array.from(groups.entries());
  }, [filteredPermissions]);
  const hasChanges = !setsEqual(selectedPermissionIds, savedPermissionIds);

  const togglePermission = (permissionId: string): void => {
    if (!editable) return;
    setSelectedPermissionIds((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
    setActionState(initialSettingsActionState);
  };

  const toggleGroup = (groupPermissions: readonly SettingsPermission[]): void => {
    if (!editable) return;
    setSelectedPermissionIds((current) => {
      const next = new Set(current);
      const allSelected = groupPermissions.every((permission) => next.has(permission.id));
      for (const permission of groupPermissions) {
        if (allSelected) next.delete(permission.id);
        else next.add(permission.id);
      }
      return next;
    });
    setActionState(initialSettingsActionState);
  };

  const handleSave = (): void => {
    startTransition(async () => {
      const result = await setRolePermissionsAction({
        permissionIds: Array.from(selectedPermissionIds),
        reason,
        roleId: role.id,
      });
      setActionState(result);

      if (result.status === "success") {
        setSavedPermissionIds(new Set(selectedPermissionIds));
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
      <div className="border-b border-hairline p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink">{role.name}</h3>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              {role.description ?? role.code}
            </p>
          </div>
          <span className="w-fit rounded-pill border border-hairline bg-neutral-bg px-2.5 py-1 text-xs font-semibold text-ink-muted">
            {selectedPermissionIds.size}/{permissions.length} quyền
          </span>
        </div>

        {isOwnerRole ? (
          <p className="mt-4 rounded-md border border-primary/20 bg-primary-soft px-3 py-2 text-sm font-medium text-primary">
            Owner luôn có toàn bộ quyền đang hoạt động. Cấu hình này được khóa để bảo vệ quyền quản trị hệ thống.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 border-b border-hairline bg-surface-2 p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Tìm quyền</span>
          <input
            className={controlClassName}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tên hoặc mã quyền..."
            type="search"
            value={search}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Nhóm chức năng</span>
          <select
            className={controlClassName}
            onChange={(event) => setModuleFilter(event.target.value)}
            value={moduleFilter}
          >
            <option value="">Tất cả nhóm</option>
            {modules.map((module) => (
              <option key={module} value={module}>{formatModuleName(module)}</option>
            ))}
          </select>
        </label>
      </div>

      {groupedPermissions.length === 0 ? (
        <EmptyState
          actionLabel="Xóa bộ lọc"
          description="Không có quyền nào phù hợp với điều kiện đang chọn."
          onAction={() => {
            setSearch("");
            setModuleFilter("");
          }}
          title="Không tìm thấy quyền"
        />
      ) : (
        <div className="divide-y divide-hairline">
          {groupedPermissions.map(([module, groupPermissions]) => {
            const selectedCount = groupPermissions.filter((permission) =>
              selectedPermissionIds.has(permission.id),
            ).length;
            const allSelected = selectedCount === groupPermissions.length;

            return (
              <section key={module}>
                <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 bg-canvas px-4 py-2.5 sm:px-5">
                  <div>
                    <h4 className="text-sm font-bold text-ink">{formatModuleName(module)}</h4>
                    <p className="text-xs text-ink-muted">{selectedCount}/{groupPermissions.length} quyền đang chọn</p>
                  </div>
                  {editable ? (
                    <Button
                      onClick={() => toggleGroup(groupPermissions)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {allSelected ? "Bỏ chọn nhóm" : "Chọn cả nhóm"}
                    </Button>
                  ) : null}
                </div>
                <div className="divide-y divide-hairline">
                  {groupPermissions.map((permission) => {
                    const checked = selectedPermissionIds.has(permission.id);

                    return (
                      <label
                        className={cn(
                          "flex min-h-16 items-start gap-3 px-4 py-3 sm:px-5",
                          editable && "cursor-pointer hover:bg-surface-2/60",
                        )}
                        key={permission.id}
                      >
                        <input
                          checked={checked}
                          className="mt-1 h-5 w-5 flex-none accent-primary"
                          disabled={!editable || isPending}
                          onChange={() => togglePermission(permission.id)}
                          type="checkbox"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink">{permission.name}</span>
                          <span className="mt-0.5 block break-all font-mono text-xs text-ink-muted">{permission.code}</span>
                          {permission.description ? (
                            <span className="mt-1 block text-xs leading-5 text-ink-subtle">{permission.description}</span>
                          ) : null}
                        </span>
                        <span className={cn(
                          "mt-0.5 flex-none rounded-pill border px-2 py-0.5 text-[11px] font-semibold",
                          checked
                            ? "border-success-border bg-success-bg text-success"
                            : "border-hairline bg-neutral-bg text-ink-muted",
                        )}>
                          {checked ? "Đã cấp" : "Chưa cấp"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editable ? (
        <form
          className="grid gap-3 border-t border-hairline bg-surface-2 p-4 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          <label className="grid gap-1.5 text-sm font-semibold text-ink">
            <span>Lý do thay đổi</span>
            <textarea
              className={`${controlClassName} min-h-20 resize-y py-3`}
              disabled={isPending}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Mô tả quyết định cấp quyền hoặc thu hồi quyền"
              required={hasChanges}
              value={reason}
            />
          </label>
          <SettingsActionMessage state={actionState} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-ink-muted">
              {hasChanges ? "Có thay đổi chưa lưu." : "Cấu hình đã đồng bộ."}
            </p>
            <Button disabled={!hasChanges || isPending} isLoading={isPending} size="lg" type="submit">
              Lưu quyền của vai trò
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && Array.from(left).every((value) => right.has(value));
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .trim();
}

function formatModuleName(value: string): string {
  const labels: Record<string, string> = {
    advances: "Tạm ứng lương",
    app: "Truy cập hệ thống",
    attendance: "Điểm danh",
    audit: "Nhật ký hệ thống",
    cashflow: "Dòng tiền",
    classes: "Lớp học",
    coaching: "Coaching",
    commissions: "Hoa hồng",
    crm: "Tuyển sinh & CRM",
    dashboard: "Tổng quan",
    finance: "Tài chính",
    grading_credits: "Tín chỉ chấm bài",
    guardians: "Phụ huynh",
    imports: "Nhập dữ liệu",
    notifications: "Thông báo",
    payments: "Thanh toán",
    payroll: "Bảng lương",
    refunds: "Hoàn tiền",
    reports: "Báo cáo",
    results: "Kết quả học tập",
    sepay: "SePay",
    session_ledger: "Sổ buổi học",
    sessions: "Buổi học",
    staff: "Nhân sự",
    students: "Học viên",
    timekeeping: "Chấm công",
  };

  if (labels[value]) {
    return labels[value];
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toLocaleUpperCase("vi") + part.slice(1))
    .join(" ");
}

const controlClassName =
  "min-h-11 min-w-0 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:bg-canvas";
