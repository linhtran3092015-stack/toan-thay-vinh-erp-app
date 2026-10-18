"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { StickySaveBar } from "@/components/patterns/sticky-save-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { controlClassName } from "@/components/ui/field";
import type { SettingsActionState } from "@/features/settings/action-types";
import { setRolePermissionsAction } from "@/features/settings/actions";
import { useLeaveGuard } from "@/features/settings/components/leave-guard";
import type { SettingsActionOverrides } from "@/features/settings/settings-action-overrides";
import type {
  SettingsPermission,
  SettingsPermissionMatrix,
  SettingsRole,
  SettingsRolePermissionGrant,
} from "@/features/settings/types";
import { formatModuleLabel } from "@/lib/module-labels";
import { cn } from "@/lib/utils";

interface PermissionMatrixPageProps {
  actions?: Pick<SettingsActionOverrides, "setRolePermissions">;
  canManage: boolean;
  /** Dev previews only: start with these unsaved role grants (role id → permission ids). */
  initialDraft?: Readonly<Record<string, readonly string[]>>;
  matrix: SettingsPermissionMatrix;
}

/** Per-role cell changes on top of the saved grants: ids to grant and ids to revoke. */
interface RoleDraft {
  added: ReadonlySet<string>;
  removed: ReadonlySet<string>;
}

type Draft = Readonly<Record<string, RoleDraft>>;

interface RoleChange {
  added: number;
  removed: number;
  role: SettingsRole;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/** Column labels from the role names (design 9b); unknown roles keep their name. */
const ROLE_SHORT_LABELS: Record<string, string> = {
  accountant: "Kế toán",
  admissions_leader: "Trưởng TS",
  admissions_manager: "QL tuyển sinh",
  admissions_specialist: "CV tuyển sinh",
  assistant_manager: "QL trợ lý",
  collaborator: "CTV",
  operations_manager: "QL vận hành",
  owner: "Chủ TT",
  teaching_assistant: "Trợ giảng",
};

function roleShortLabel(role: SettingsRole): string {
  return ROLE_SHORT_LABELS[role.code] ?? role.name;
}

function grantsByRole(grants: readonly SettingsRolePermissionGrant[]): ReadonlyMap<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();
  for (const grant of grants) {
    const set = map.get(grant.roleId) ?? new Set<string>();
    set.add(grant.permissionId);
    map.set(grant.roleId, set);
  }
  return map;
}

/**
 * Drops changes that already match the saved grants (e.g. after a refresh
 * brought the same grant from elsewhere) and roles left without changes.
 */
function pruneDraft(draft: Draft, baseline: ReadonlyMap<string, ReadonlySet<string>>): Draft {
  const next: Record<string, RoleDraft> = {};
  for (const [roleId, change] of Object.entries(draft)) {
    const saved = baseline.get(roleId) ?? EMPTY_SET;
    const added = new Set(Array.from(change.added).filter((id) => !saved.has(id)));
    const removed = new Set(Array.from(change.removed).filter((id) => saved.has(id)));
    if (added.size + removed.size > 0) next[roleId] = { added, removed };
  }
  return next;
}

/** Saved grants of a role with its draft changes applied. */
function applyRoleDraft(saved: ReadonlySet<string>, change: RoleDraft | undefined): ReadonlySet<string> {
  if (!change) return saved;
  const next = new Set(saved);
  for (const id of change.added) next.add(id);
  for (const id of change.removed) next.delete(id);
  return next;
}

/**
 * Phân quyền (design 9b). From lg: one roles × permissions grid; below lg:
 * pick a role, then its permission list. Both edit one draft across roles.
 * The Owner column is locked (the RPC refuses it). Saving asks for one reason,
 * then calls the existing per-role action once per changed role, in order;
 * roles that fail keep their draft and are named above the save bar.
 */
export function PermissionMatrixPage({
  actions,
  canManage,
  initialDraft,
  matrix,
}: PermissionMatrixPageProps) {
  const setRolePermissions = actions?.setRolePermissions ?? setRolePermissionsAction;
  const router = useRouter();
  const activeRoles = useMemo(() => {
    const roles = matrix.roles.filter((role) => role.isActive);
    return [...roles.filter((role) => role.code === "owner"), ...roles.filter((role) => role.code !== "owner")];
  }, [matrix.roles]);
  const activePermissions = useMemo(
    () => matrix.permissions.filter((permission) => permission.isActive),
    [matrix.permissions],
  );
  const [grantsSource, setGrantsSource] = useState(matrix.grants);
  const [baseline, setBaseline] = useState(() => grantsByRole(matrix.grants));
  const [draft, setDraft] = useState<Draft>(() => {
    if (!canManage || !initialDraft) return {};
    const saved = grantsByRole(matrix.grants);
    const next: Record<string, RoleDraft> = {};
    for (const [roleId, permissionIds] of Object.entries(initialDraft)) {
      const role = matrix.roles.find((item) => item.id === roleId);
      if (!role || role.code === "owner") continue;
      const wanted = new Set(permissionIds);
      const current = saved.get(roleId) ?? EMPTY_SET;
      next[roleId] = {
        added: new Set(Array.from(wanted).filter((id) => !current.has(id))),
        removed: new Set(Array.from(current).filter((id) => !wanted.has(id))),
      };
    }
    return pruneDraft(next, saved);
  });
  if (grantsSource !== matrix.grants) {
    // A refresh (after saving here or elsewhere) brings new grants: they become
    // the saved state. Untouched cells follow them; only toggled cells stay
    // changed, and a change the new grants already contain disappears.
    const nextBaseline = grantsByRole(matrix.grants);
    setGrantsSource(matrix.grants);
    setBaseline(nextBaseline);
    setDraft(pruneDraft(draft, nextBaseline));
  }
  const defaultRole = (canManage && activeRoles.find((role) => role.code !== "owner")) || activeRoles[0];
  const [selectedRoleId, setSelectedRoleId] = useState(defaultRole?.id ?? "");
  const selectedRole = activeRoles.find((role) => role.id === selectedRoleId) ?? defaultRole;
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saveError, setSaveError] = useState<{ description: string; title: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState("");

  // Effective grants (saved + draft) once per render; every cell reads this map.
  const effectiveGrants = useMemo(() => {
    const map = new Map<string, ReadonlySet<string>>();
    for (const role of activeRoles) map.set(role.id, applyRoleDraft(baseline.get(role.id) ?? EMPTY_SET, draft[role.id]));
    return map;
  }, [activeRoles, baseline, draft]);
  const grantedFor = (roleId: string): ReadonlySet<string> => effectiveGrants.get(roleId) ?? EMPTY_SET;
  // The save loop awaits each role; a refresh may land in between, so it reads the latest saved grants from here.
  const baselineRef = useRef(baseline);
  useEffect(() => {
    baselineRef.current = baseline;
  });
  const isChanged = (roleId: string, permissionId: string): boolean =>
    Boolean(draft[roleId]?.added.has(permissionId) || draft[roleId]?.removed.has(permissionId));
  const isLocked = (role: SettingsRole) => role.code === "owner";
  const isEditable = (role: SettingsRole) => canManage && !isLocked(role) && !isSaving;

  const changes: RoleChange[] = activeRoles.flatMap((role) => {
    const change = draft[role.id];
    if (!change) return [];
    const added = change.added.size;
    const removed = change.removed.size;
    return added + removed > 0 ? [{ added, removed, role }] : [];
  });
  const dirtyCount = changes.reduce((total, change) => total + change.added + change.removed, 0);
  const changeSummaries = changes.map((change) => formatRoleChange(change));
  // Set synchronously when a save starts (state lags a render behind).
  const savingRef = useRef(false);
  /** Hủy and "Rời trang": drop the draft, the typed reason and the error. Never while saving. */
  const discardDraft = () => {
    if (savingRef.current) return;
    setDraft({});
    setReason("");
    setSaveError(null);
  };
  // Not while saving: leaving then must not discard or cut short the save.
  useLeaveGuard(canManage && dirtyCount > 0 && !isSaving, discardDraft);
  // While the roles are saved one by one, hub links ask first ("Đang lưu phân
  // quyền"): leaving is allowed and never discards (the loop works on its own
  // snapshot, so every confirmed role is still saved), but a failure could no
  // longer be shown. Like every guard it also asks on reload/close (beforeunload).
  useLeaveGuard(isSaving, undefined, { variant: "saving" });

  const modules = useMemo(
    () => Array.from(new Set(activePermissions.map((permission) => permission.module))).sort(),
    [activePermissions],
  );
  const groupedPermissions = useMemo(() => {
    const query = normalizeSearch(search);
    const groups = new Map<string, SettingsPermission[]>();
    for (const permission of activePermissions) {
      const content = normalizeSearch(`${permission.name} ${permission.code} ${permission.description ?? ""}`);
      if ((query && !content.includes(query)) || (moduleFilter && permission.module !== moduleFilter)) continue;
      const group = groups.get(permission.module) ?? [];
      group.push(permission);
      groups.set(permission.module, group);
    }
    return Array.from(groups.entries());
  }, [activePermissions, moduleFilter, search]);

  /** Sets the wanted state of some cells of one role; a cell back at its saved state is no longer a change. */
  const setCells = (role: SettingsRole, permissionIds: readonly string[], granted: boolean) => {
    if (!isEditable(role)) return;
    setDraft((current) => {
      const saved = baseline.get(role.id) ?? EMPTY_SET;
      const added = new Set(current[role.id]?.added);
      const removed = new Set(current[role.id]?.removed);
      for (const permissionId of permissionIds) {
        added.delete(permissionId);
        removed.delete(permissionId);
        if (granted && !saved.has(permissionId)) added.add(permissionId);
        if (!granted && saved.has(permissionId)) removed.add(permissionId);
      }
      const result = { ...current };
      if (added.size + removed.size === 0) delete result[role.id];
      else result[role.id] = { added, removed };
      return result;
    });
    setSaveMessage("");
  };
  const toggle = (role: SettingsRole, permissionId: string) =>
    setCells(role, [permissionId], !grantedFor(role.id).has(permissionId));
  const toggleGroup = (role: SettingsRole, permissions: readonly SettingsPermission[]) => {
    const granted = grantedFor(role.id);
    const allSelected = permissions.every((permission) => granted.has(permission.id));
    setCells(role, permissions.map((permission) => permission.id), !allSelected);
  };

  const saveAll = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason || changes.length === 0 || savingRef.current) return;
    // What was confirmed: each changed role with its cell changes, copied now so
    // nothing that clears the draft later (Hủy, leaving) can skip a role.
    const confirmed = changes.map(({ role }) => ({
      added: new Set(draft[role.id]?.added),
      removed: new Set(draft[role.id]?.removed),
      role,
    }));
    savingRef.current = true;
    setIsDialogOpen(false);
    setIsSaving(true);
    setSaveError(null);
    setSaveMessage("");
    const failures: { message: string; role: SettingsRole }[] = [];
    const saved: SettingsRole[] = [];
    // Deliberately sequential: one set_role_permissions call per role, awaited in
    // role order, so each role gets its own audit entry with the reason, in that order.
    for (const { added, removed, role } of confirmed) {
      // Rebased right before the call on the latest saved grants: a refresh during
      // an earlier await must not be overwritten with stale grants, and a change
      // the refresh already contains is no longer sent.
      const change = pruneDraft({ [role.id]: { added, removed } }, baselineRef.current)[role.id];
      if (!change) continue;
      const permissionIds = Array.from(applyRoleDraft(baselineRef.current.get(role.id) ?? EMPTY_SET, change));
      let result: SettingsActionState;
      try {
        result = await setRolePermissions({ permissionIds, reason: trimmedReason, roleId: role.id });
      } catch {
        result = { message: "Không thể kết nối hệ thống phân quyền.", status: "error" };
      }
      if (result.status === "success") {
        saved.push(role);
        setBaseline((current) => new Map(current).set(role.id, new Set(permissionIds)));
        setDraft((current) => {
          const next = { ...current };
          delete next[role.id];
          return next;
        });
      } else {
        failures.push({ message: result.message, role });
        // A failed role keeps its change for a retry, even if the draft was cleared meanwhile.
        setDraft((current) => (current[role.id] ? current : { ...current, [role.id]: change }));
      }
    }
    savingRef.current = false;
    setIsSaving(false);
    if (failures.length > 0) {
      const messages = Array.from(new Set(failures.map((failure) => failure.message)));
      setSaveError({
        description: `${messages.join(" ")} Các ô đã chọn của ${failures.length === 1 ? "vai trò này" : "các vai trò này"} vẫn được giữ để thử lại.${saved.length > 0 ? ` Đã lưu: ${saved.map((role) => role.name).join(", ")}.` : ""}`,
        title: `Chưa lưu được quyền cho ${failures.map((failure) => failure.role.name).join(", ")}.`,
      });
    } else {
      setReason("");
      // Every change can vanish before its turn (a refresh brought the same grants): nothing to report then.
      if (saved.length > 0) setSaveMessage(`Đã lưu quyền cho ${saved.map((role) => role.name).join(", ")}.`);
    }
    if (saved.length > 0) router.refresh();
  };

  if (activeRoles.length === 0 || activePermissions.length === 0) {
    return (
      <EmptyState
        description="Hệ thống chưa có vai trò hoặc quyền đang hoạt động để cấu hình."
        title="Ma trận quyền đang trống"
      />
    );
  }

  const filtersEmpty = groupedPermissions.length === 0;
  const clearFilters = () => {
    setSearch("");
    setModuleFilter("");
  };

  return (
    <div className="grid min-w-0 gap-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-section-title font-semibold text-text-strong">Phân quyền theo vai trò</h2>
          <p className="mt-0.5 text-secondary text-text-muted">
            {activeRoles.length} vai trò · {activePermissions.length} mã quyền · người dùng giữ nhiều vai trò, quyền là hợp của các vai trò
          </p>
          {canManage ? null : (
            <p className="mt-1 text-secondary text-text-muted">Chỉ Owner được sửa phân quyền. Trang đang ở chế độ chỉ đọc.</p>
          )}
        </div>
        <Badge className="w-fit" tone={canManage ? "success" : "neutral"}>
          {canManage ? "Owner · Có thể chỉnh sửa" : "Chỉ đọc"}
        </Badge>
      </header>

      <ResultBanner
        description="Mỗi lần lưu được ghi vào nhật ký hệ thống kèm lý do. Quyền mới có hiệu lực từ lần tải trang kế tiếp của người dùng."
        title="Thay đổi phân quyền được ghi nhật ký."
        tone="warning"
      />

      <div className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-3 sm:grid-cols-[minmax(0,1fr)_240px] sm:p-4">
        <label className="grid gap-1.5 text-label font-medium text-text-strong">
          <span>Tìm quyền</span>
          <input
            className={controlClassName}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tên hoặc mã quyền..."
            type="search"
            value={search}
          />
        </label>
        <label className="grid gap-1.5 text-label font-medium text-text-strong">
          <span>Nhóm chức năng</span>
          <select
            className={controlClassName}
            onChange={(event) => setModuleFilter(event.target.value)}
            value={moduleFilter}
          >
            <option value="">Tất cả nhóm</option>
            {modules.map((module) => (
              <option key={module} value={module}>{formatModuleLabel(module)}</option>
            ))}
          </select>
        </label>
      </div>

      {filtersEmpty ? (
        <div className="grid justify-items-center gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-10 text-center">
          <p className="text-body font-semibold text-text-strong">Không tìm thấy quyền</p>
          <p className="text-secondary text-text-muted">Không có quyền nào phù hợp với điều kiện đang chọn.</p>
          <Button onClick={clearFilters} variant="secondary">Xóa bộ lọc</Button>
        </div>
      ) : (
        <>
          <PermissionGrid
            canManage={canManage}
            grants={effectiveGrants}
            groups={groupedPermissions}
            isChanged={isChanged}
            isSaving={isSaving}
            onToggle={toggle}
            roles={activeRoles}
          />
          <div className="grid gap-3 lg:hidden">
            <label className="grid gap-1.5 text-label font-medium text-text-strong">
              <span>Vai trò cần cấu hình</span>
              <select
                className={controlClassName}
                onChange={(event) => setSelectedRoleId(event.target.value)}
                value={selectedRole?.id ?? ""}
              >
                {activeRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name} ({role.code})</option>
                ))}
              </select>
            </label>
            {selectedRole ? (
              <RolePermissionList
                editable={isEditable(selectedRole)}
                granted={grantedFor(selectedRole.id)}
                groups={groupedPermissions}
                onToggle={(permissionId) => toggle(selectedRole, permissionId)}
                onToggleGroup={(permissions) => toggleGroup(selectedRole, permissions)}
                role={selectedRole}
                total={activePermissions.length}
              />
            ) : null}
          </div>
        </>
      )}

      {canManage ? (
        <>
          <StickySaveBar
            changedLabels={changeSummaries}
            dirtyCount={dirtyCount}
            error={saveError ? <ResultBanner description={saveError.description} title={saveError.title} tone="danger" /> : null}
            isSaving={isSaving}
            onCancel={discardDraft}
            onSave={() => setIsDialogOpen(true)}
            saveLabel="Lưu phân quyền"
            savingLabel="Đang lưu…"
            statusMessage={saveMessage}
          />
          <SaveReasonDialog
            changes={changes}
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            onConfirm={() => void saveAll()}
            onReasonChange={setReason}
            reason={reason}
          />
        </>
      ) : null}
    </div>
  );
}

function formatRoleChange({ added, removed, role }: RoleChange): string {
  return [roleShortLabel(role), added > 0 ? `+${added}` : null, removed > 0 ? `−${removed}` : null].filter(Boolean).join(" ");
}

function PermissionGrid({
  canManage,
  grants,
  groups,
  isChanged,
  isSaving,
  onToggle,
  roles,
}: {
  canManage: boolean;
  /** Effective grants per role (saved + draft), built once per render. */
  grants: ReadonlyMap<string, ReadonlySet<string>>;
  groups: readonly (readonly [string, SettingsPermission[]])[];
  isChanged: (roleId: string, permissionId: string) => boolean;
  isSaving: boolean;
  onToggle: (role: SettingsRole, permissionId: string) => void;
  roles: readonly SettingsRole[];
}) {
  return (
    <div className="hidden overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] lg:block">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-table-body">
          <caption className="sr-only">Ma trận quyền theo vai trò</caption>
          <thead className="sticky top-0 z-20">
            <tr className="bg-table-header text-left text-table-header font-semibold text-text-muted">
              <th className="sticky left-0 z-10 min-w-[260px] bg-table-header px-4 py-2.5" scope="col">Quyền</th>
              {roles.map((role) => (
                <th className="w-[72px] min-w-[72px] px-1 py-2.5 text-center text-[11px]/4" key={role.id} scope="col" title={role.name}>
                  <span className="inline-flex items-center justify-center gap-1">
                    {role.code === "owner" ? <Lock aria-hidden="true" size={12} /> : null}
                    <span aria-hidden="true">{roleShortLabel(role)}</span>
                  </span>
                  <span className="sr-only">{role.name}{role.code === "owner" ? " (khóa)" : ""}</span>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map(([module, permissions]) => (
            <tbody key={module}>
              <tr className="border-t border-border-row bg-surface-raised">
                <th
                  className="sticky left-0 bg-surface-raised px-4 py-2 text-left text-caption font-semibold uppercase tracking-[.02em] text-text-muted"
                  colSpan={roles.length + 1}
                  scope="rowgroup"
                >
                  {formatModuleLabel(module)}
                </th>
              </tr>
              {permissions.map((permission) => (
                <tr className="group h-12 border-t border-border-row hover:bg-table-row-hover" key={permission.id}>
                  <th className="sticky left-0 z-[1] bg-surface-base px-4 py-1.5 text-left font-normal group-hover:bg-table-row-hover" scope="row">
                    <span className="block text-body text-text-strong">{permission.name}</span>
                    <span className="block break-all font-mono text-caption text-text-subtle">{permission.code}</span>
                  </th>
                  {roles.map((role) => {
                    const locked = role.code === "owner";
                    const checked = grants.get(role.id)?.has(permission.id) ?? false;
                    const changed = isChanged(role.id, permission.id);
                    return (
                      <td
                        className={cn("relative text-center", changed && "bg-warning-bg")}
                        data-changed={changed || undefined}
                        key={role.id}
                      >
                        <input
                          aria-label={`${role.name}: ${permission.name}${locked ? " (Owner luôn có toàn quyền, không sửa)" : ""}${changed ? " (thay đổi chưa lưu)" : ""}`}
                          checked={checked}
                          className={cn("h-4 w-4 align-middle accent-[var(--action-primary)]", locked && "opacity-60")}
                          disabled={!canManage || locked || isSaving}
                          onChange={() => onToggle(role, permission.id)}
                          type="checkbox"
                        />
                        {changed ? (
                          // Non-colour cue next to the yellow fill.
                          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warning">
                            <span className="sr-only">chưa lưu</span>
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border-row px-4 py-2.5 text-secondary text-text-muted">
        <span>☐ chưa cấp · ☑ đã cấp · ☑ mờ = Owner luôn có toàn quyền, không sửa</span>
        {canManage ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />
            Ô nền vàng = thay đổi chưa lưu
          </span>
        ) : null}
      </p>
    </div>
  );
}

function RolePermissionList({
  editable,
  granted,
  groups,
  onToggle,
  onToggleGroup,
  role,
  total,
}: {
  editable: boolean;
  granted: ReadonlySet<string>;
  groups: readonly (readonly [string, SettingsPermission[]])[];
  onToggle: (permissionId: string) => void;
  onToggleGroup: (permissions: readonly SettingsPermission[]) => void;
  role: SettingsRole;
  total: number;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base">
      <div className="border-b border-border-row p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-body font-semibold text-text-strong">{role.name}</h3>
            <p className="mt-0.5 text-secondary text-text-muted">{role.description ?? role.code}</p>
          </div>
          <Badge>{granted.size}/{total} quyền</Badge>
        </div>
        {role.code === "owner" ? (
          <p className="mt-3 rounded-md border border-action-primary-soft-border bg-action-primary-soft px-3 py-2 text-secondary font-medium text-action-primary">
            Owner luôn có toàn bộ quyền đang hoạt động. Cấu hình này được khóa để bảo vệ quyền quản trị hệ thống.
          </p>
        ) : null}
      </div>
      <div className="divide-y divide-border-row">
        {groups.map(([module, permissions]) => {
          const selectedCount = permissions.filter((permission) => granted.has(permission.id)).length;
          return (
            <section key={module}>
              <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 bg-surface-raised px-4 py-2">
                <div>
                  <h4 className="text-caption font-semibold uppercase tracking-[.02em] text-text-muted">{formatModuleLabel(module)}</h4>
                  <p className="text-caption text-text-muted">{selectedCount}/{permissions.length} quyền đang chọn</p>
                </div>
                {editable ? (
                  <Button className="h-11" onClick={() => onToggleGroup(permissions)} size="sm" variant="ghost">
                    {selectedCount === permissions.length ? "Bỏ chọn nhóm" : "Chọn cả nhóm"}
                  </Button>
                ) : null}
              </div>
              <div className="divide-y divide-border-row">
                {permissions.map((permission) => {
                  const checked = granted.has(permission.id);
                  return (
                    <label className={cn("flex min-h-14 items-start gap-3 px-4 py-3", editable && "cursor-pointer")} key={permission.id}>
                      <input
                        checked={checked}
                        className="mt-0.5 h-5 w-5 flex-none accent-[var(--action-primary)]"
                        disabled={!editable}
                        onChange={() => onToggle(permission.id)}
                        type="checkbox"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-semibold text-text-strong">{permission.name}</span>
                        <span className="mt-0.5 block break-all font-mono text-caption text-text-subtle">{permission.code}</span>
                      </span>
                      <Badge tone={checked ? "success" : "neutral"}>{checked ? "Đã cấp" : "Chưa cấp"}</Badge>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function SaveReasonDialog({
  changes,
  isOpen,
  onClose,
  onConfirm,
  onReasonChange,
  reason,
}: {
  changes: readonly RoleChange[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReasonChange: (value: string) => void;
  reason: string;
}) {
  const titleId = useId();
  const reasonId = useId();
  const missingReason = reason.trim().length === 0;
  // A refresh can make every change match the saved grants while the dialog is open.
  const nothingToSave = changes.length === 0;
  const confirmDisabledReason = nothingToSave ? "Không còn thay đổi để lưu" : "Nhập lý do để lưu.";

  return (
    <Dialog ariaLabelledBy={titleId} className="p-5 sm:max-w-lg" isOpen={isOpen} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!missingReason && !nothingToSave) onConfirm();
        }}
      >
        <div>
          <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>Lưu phân quyền</h2>
          <p className="mt-1 text-secondary text-text-muted">
            Lưu lần lượt từng vai trò dưới đây. Người dùng giữ các vai trò này nhận quyền mới từ lần tải trang kế tiếp.
          </p>
        </div>
        <ul className="grid gap-1.5 text-body text-text-strong">
          {changes.map((change) => (
            <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-surface-raised px-3 py-2" key={change.role.id}>
              <span className="font-semibold">{change.role.name}</span>
              <span className="text-secondary tabular-nums text-text-muted">
                {[change.added > 0 ? `cấp thêm ${change.added}` : null, change.removed > 0 ? `thu hồi ${change.removed}` : null].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
        <div className="grid gap-1.5">
          <label className="text-label font-medium text-text-strong" htmlFor={reasonId}>Lý do thay đổi</label>
          <textarea
            aria-describedby={`${reasonId}-hint`}
            className={cn(controlClassName, "min-h-20 resize-y py-2")}
            id={reasonId}
            maxLength={2000}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Mô tả quyết định cấp quyền hoặc thu hồi quyền"
            required
            value={reason}
          />
          <p className="text-caption text-text-muted" id={`${reasonId}-hint`}>Bắt buộc. Ghi vào nhật ký cùng mỗi vai trò được lưu.</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-start sm:justify-end">
          <Button className="max-sm:h-11" onClick={onClose} variant="secondary">Hủy</Button>
          <Button
            className="max-sm:h-11"
            disabled={missingReason || nothingToSave}
            disabledReason={confirmDisabledReason}
            type="submit"
          >
            Xác nhận lưu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .trim();
}

