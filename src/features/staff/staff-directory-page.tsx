"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import { FilterBar, FilterField, FilterInput, FilterSelect } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { Pagination } from "@/components/patterns/pagination";
import { QuickFilterChips, type QuickFilterChip } from "@/components/patterns/quick-filter-chips";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import {
  EmploymentStatusBadge,
  employmentStatusLabels,
} from "@/features/staff/components/employment-status-badge";
import {
  StaffRoleManagement,
  type StaffRoleActionOverrides,
} from "@/features/staff/components/staff-role-management";
import {
  ALL_STAFF_OPTION,
  buildStaffRoleOptions,
  countActiveStaffFilters,
  countStaffStatuses,
  defaultStaffDirectoryFilters,
  filterStaffMembers,
  paginateStaffMembers,
  resolveStaffDirectoryFilters,
  summarizeStaffDirectory,
  visibleStaffStatusChips,
  type StaffDirectoryFilters,
  type StaffStatusFilter,
} from "@/features/staff/staff-directory-models";
import type { StaffDirectoryMember, StaffRoleOption } from "@/features/staff/types";
import { formatIsoDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

interface StaffDirectoryPageProps {
  /** Inert role-action stubs for the /dev/lists preview. Real routes pass nothing. */
  actions?: StaffRoleActionOverrides;
  canManageRoles: boolean;
  /**
   * Viewer holds `settings.view`, so /settings/users (whose layout also
   * requires it) opens. Without it the "Tài khoản và lời mời" link is hidden.
   */
  canOpenAccounts?: boolean;
  canViewRoles: boolean;
  description?: string;
  eyebrow?: string;
  headingLevel?: 1 | 2;
  members: readonly StaffDirectoryMember[];
  roleOptions: readonly StaffRoleOption[];
  title?: string;
}

/*
 * Responsive switch: `.staff-directory-work-area` is the container (globals.css).
 * From 1042px (the 1040px table + 2px frame border) the table shows, below it
 * the card list. The filter bar uses Tailwind container variants against the
 * same container: one column on phones, two equal fields from 640px, the
 * design 06 grid (search 1.4fr, role 1fr, reset auto) from 1042px. No inline
 * `gridTemplateColumns` (`fieldCount`/`columns`): it would overflow on phones.
 * Class names are spelled out in full so the Tailwind scanner sees them.
 */
const FILTER_BAR_WITH_ROLE =
  "grid-cols-[minmax(0,1fr)] @min-[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] @min-[1042px]:grid-cols-[minmax(220px,1.4fr)_minmax(0,1fr)_auto] max-md:[&_button]:h-11";
const FILTER_BAR_SEARCH_ONLY =
  "grid-cols-[minmax(0,1fr)] @min-[640px]:grid-cols-[minmax(0,1fr)_auto] @min-[1042px]:grid-cols-[minmax(220px,480px)_auto] max-md:[&_button]:h-11";

/**
 * Staff directory (design 16a row "Nhân sự"): status chips and an inline
 * filter bar over the loaded members, one table (cards when narrow) and a
 * pager. Filters are local state, not the URL. Rows keep the loader's order.
 * Role management stays mounted inline per member for `staff.roles.manage`:
 * it is the only assign/revoke UI in the app.
 */
export function StaffDirectoryPage({
  actions,
  canManageRoles,
  canOpenAccounts = false,
  canViewRoles,
  description,
  eyebrow,
  headingLevel = 1,
  members,
  roleOptions,
  title = "Nhân sự",
}: StaffDirectoryPageProps) {
  const [requestedFilters, setRequestedFilters] = useState<StaffDirectoryFilters>(defaultStaffDirectoryFilters);
  const [requestedPage, setRequestedPage] = useState(1);

  const roleFilterOptions = useMemo(
    () => (canViewRoles ? buildStaffRoleOptions(members, roleOptions) : []),
    [canViewRoles, members, roleOptions],
  );
  const filters = useMemo(
    () => resolveStaffDirectoryFilters(requestedFilters, roleFilterOptions),
    [requestedFilters, roleFilterOptions],
  );
  const filtered = useMemo(
    () => filterStaffMembers(members, filters, { canViewRoles }),
    [canViewRoles, filters, members],
  );
  const statusCounts = useMemo(
    () => countStaffStatuses(members, filters, { canViewRoles }),
    [canViewRoles, filters, members],
  );
  const pagination = useMemo(
    () => paginateStaffMembers(filtered, requestedPage),
    [filtered, requestedPage],
  );
  const summary = useMemo(() => summarizeStaffDirectory(members), [members]);

  const activeFilterCount = countActiveStaffFilters(filters, { canViewRoles });
  const hasNoData = members.length === 0;

  const updateFilters = (patch: Partial<StaffDirectoryFilters>) => {
    setRequestedFilters({ ...filters, ...patch });
    setRequestedPage(1);
  };
  const resetFilters = () => {
    setRequestedFilters(defaultStaffDirectoryFilters);
    setRequestedPage(1);
  };

  const chips: QuickFilterChip<StaffStatusFilter>[] = visibleStaffStatusChips(statusCounts, filters.status).map(
    (value) => ({
      count: statusCounts[value],
      label: value === ALL_STAFF_OPTION ? "Tất cả" : employmentStatusLabels[value],
      value,
    }),
  );

  const contextLine = (
    <p className="mt-1 text-secondary tabular-nums text-text-muted">
      {summary.total} nhân sự · {summary.active} đang làm việc
      {canViewRoles ? null : " · vai trò ẩn theo quyền hiện tại"}
    </p>
  );
  // /settings/users sits behind the settings layout (`settings.view`) as well
  // as `staff.view`, so the link shows only when the viewer can open it.
  // Inviting stays owner-only on that screen.
  const accountsLink = canOpenAccounts ? (
    <Link
      className={getButtonClassName({ className: "text-text-strong! max-md:h-11", variant: "secondary" })}
      href="/settings/users"
    >
      Tài khoản và lời mời
    </Link>
  ) : null;

  const emptyState = (
    <TableState>
      {hasNoData ? (
        <>
          <p className="text-body font-semibold text-text-strong">Chưa có hồ sơ nhân sự</p>
          <p className="text-secondary text-text-muted">
            Chưa có hồ sơ nhân sự nào được đồng bộ từ tài khoản đăng nhập.
          </p>
        </>
      ) : (
        <>
          <p className="text-body font-semibold text-text-strong">Không có nhân sự khớp bộ lọc</p>
          <p className="text-secondary text-text-muted">Nới rộng điều kiện hoặc xóa bộ lọc để xem lại danh sách.</p>
          <Button className="mt-2 max-md:h-11" onClick={resetFilters} size="sm" variant="secondary">
            Xóa lọc
          </Button>
        </>
      )}
    </TableState>
  );

  const pager = (variant: "frame" | "standalone") => (
    <Pagination
      itemLabel="nhân sự"
      label={variant === "frame" ? "Phân trang nhân sự" : "Phân trang nhân sự (danh sách gọn)"}
      onPageChange={setRequestedPage}
      page={pagination.page}
      pageCount={pagination.pageCount}
      rangeEnd={pagination.end}
      rangeStart={pagination.start}
      total={filtered.length}
      variant={variant}
    />
  );

  const rowProps = { actions, canManageRoles, canViewRoles, roleOptions };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      {headingLevel === 1 ? (
        <PageHeader actions={accountsLink} title={title}>
          {eyebrow ? <p className="text-label text-text-muted">{eyebrow}</p> : null}
          {contextLine}
          {description ? <p className="mt-1 max-w-3xl text-secondary text-text-muted">{description}</p> : null}
        </PageHeader>
      ) : (
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            {eyebrow ? <p className="text-label text-text-muted">{eyebrow}</p> : null}
            <h2 className="mt-1 text-section-title text-text-strong">{title}</h2>
            {contextLine}
            {description ? <p className="mt-1 max-w-3xl text-secondary text-text-muted">{description}</p> : null}
          </div>
          {accountsLink ? <div className="flex shrink-0 flex-wrap gap-2">{accountsLink}</div> : null}
        </header>
      )}

      <div className="staff-directory-work-area grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        {/* Counts follow search + role; a status without rows is hidden unless it is the active one. */}
        <QuickFilterChips
          chips={chips}
          className="max-md:[&_button]:h-11"
          disableEmpty={false}
          label="Lọc nhanh nhân sự"
          onChange={(status) => updateFilters({ status })}
          value={filters.status}
        />

        <FilterBar
          activeCount={activeFilterCount}
          className={canViewRoles ? FILTER_BAR_WITH_ROLE : FILTER_BAR_SEARCH_ONLY}
          label="Bộ lọc nhân sự"
          onReset={resetFilters}
        >
          <FilterField label="Tìm nhân sự">
            <FilterInput
              active={filters.search.trim().length > 0}
              autoComplete="off"
              className="max-md:h-11"
              disabled={hasNoData}
              onChange={(event) => updateFilters({ search: event.target.value })}
              placeholder="Tên, mã, email hoặc SĐT"
              type="search"
              value={filters.search}
            />
          </FilterField>
          {canViewRoles ? (
            <FilterField label="Vai trò">
              <FilterSelect
                active={filters.role !== ALL_STAFF_OPTION}
                className="max-md:h-11"
                disabled={hasNoData}
                onChange={(event) => updateFilters({ role: event.target.value })}
                value={filters.role}
              >
                <option value={ALL_STAFF_OPTION}>Tất cả vai trò</option>
                {roleFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FilterSelect>
            </FilterField>
          ) : null}
        </FilterBar>

        <p aria-live="polite" className="sr-only">
          {filtered.length === 0
            ? "Không có nhân sự nào để hiển thị"
            : `Hiển thị ${pagination.start}–${pagination.end} trong ${filtered.length} nhân sự`}
        </p>

        {/* Both layouts stay in the DOM; the container query in globals.css shows one. */}
        <DataTableFrame
          body={pagination.rows.map((member) => (
            <StaffTableRow key={member.id} member={member} {...rowProps} />
          ))}
          caption="Danh sách nhân sự"
          className="staff-directory-table"
          empty={emptyState}
          footer={hasNoData ? undefined : pager("frame")}
          header={
            <tr>
              <TableHeaderCell className="w-[280px]">Nhân sự</TableHeaderCell>
              {/* Vai trò takes what the fixed columns leave: 274px at the 1040px floor. */}
              <TableHeaderCell>Vai trò</TableHeaderCell>
              <TableHeaderCell className="w-[150px]">Trạng thái</TableHeaderCell>
              <TableHeaderCell className="w-[120px]">Vào làm</TableHeaderCell>
              <TableHeaderCell className="w-[120px]">SĐT</TableHeaderCell>
              <TableHeaderCell className="w-[96px]" numeric>
                Thao tác
              </TableHeaderCell>
            </tr>
          }
          status={filtered.length === 0 ? "empty" : "ready"}
          tableClassName="min-w-[1040px] table-fixed"
        />

        <div className="staff-directory-record-list gap-2">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
              {emptyState}
            </div>
          ) : (
            <>
              <ResponsiveRecordList label="Danh sách nhân sự">
                {pagination.rows.map((member) => (
                  <StaffCard key={member.id} member={member} {...rowProps} />
                ))}
              </ResponsiveRecordList>
              {pager("standalone")}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface StaffRowProps {
  actions?: StaffRoleActionOverrides;
  canManageRoles: boolean;
  canViewRoles: boolean;
  member: StaffDirectoryMember;
  roleOptions: readonly StaffRoleOption[];
}

function StaffTableRow({ actions, canManageRoles, canViewRoles, member, roleOptions }: StaffRowProps) {
  // Role management makes a row tall: top-align every cell so the name stays level with it.
  const cell = canManageRoles ? "py-3! align-top!" : "py-2!";

  return (
    <TableRow tall>
      <TableCell className={cell}>
        <StaffIdentity member={member} />
      </TableCell>
      <TableCell className={cell}>
        <StaffRoles canViewRoles={canViewRoles} member={member} />
        {canManageRoles ? <StaffRoleManagement actions={actions} compact member={member} roleOptions={roleOptions} /> : null}
      </TableCell>
      <TableCell className={cell}>
        <EmploymentStatusBadge status={member.employmentStatus} />
        <LeftAtCaption leftAt={member.leftAt} />
      </TableCell>
      <TableCell className={cn(cell, "whitespace-nowrap text-secondary tabular-nums")}>
        <JoinedAt joinedAt={member.joinedAt} />
      </TableCell>
      <TableCell className={cn(cell, "whitespace-nowrap text-secondary tabular-nums")}>
        <Phone phone={member.phone} />
      </TableCell>
      <TableCell className={cell} numeric>
        <Link
          aria-label={`Mở hồ sơ nhân sự ${member.displayName}`}
          className="inline-flex h-8 items-center whitespace-nowrap rounded-md px-1.5 text-secondary font-semibold text-action-link! hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          href={`/staff/${member.id}`}
        >
          Mở hồ sơ
        </Link>
      </TableCell>
    </TableRow>
  );
}

/** The card must stay a plain `article`: a whole-card link could not host the role forms. */
function StaffCard({ actions, canManageRoles, canViewRoles, member, roleOptions }: StaffRowProps) {
  return (
    <article
      className="min-w-0 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-3">
        <StaffIdentity member={member} />
        <div className="flex shrink-0 flex-col items-end">
          <EmploymentStatusBadge status={member.employmentStatus} />
          <LeftAtCaption leftAt={member.leftAt} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-border-row pt-3 text-secondary">
        <CardField label="Vai trò">
          <StaffRoles canViewRoles={canViewRoles} member={member} />
        </CardField>
        <CardField label="Vào làm">
          <span className="tabular-nums text-text-default">
            <JoinedAt joinedAt={member.joinedAt} />
          </span>
        </CardField>
        <CardField label="SĐT">
          <span className="tabular-nums text-text-default">
            <Phone phone={member.phone} />
          </span>
        </CardField>
      </dl>
      {canManageRoles ? (
        <div className="mt-3 border-t border-border-subtle pt-1">
          <StaffRoleManagement actions={actions} member={member} roleOptions={roleOptions} />
        </div>
      ) : null}
      <Link
        aria-label={`Mở hồ sơ nhân sự ${member.displayName}`}
        className={getButtonClassName({ className: "mt-3 w-full text-text-strong!", size: "lg", variant: "secondary" })}
        href={`/staff/${member.id}`}
      >
        Mở hồ sơ nhân sự
      </Link>
    </article>
  );
}

function CardField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function StaffIdentity({ member }: { member: StaffDirectoryMember }) {
  const caption = `${member.employeeCode || "Chưa có mã nhân sự"} · ${member.email}`;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-caption font-semibold text-text-muted"
      >
        {getInitials(member.displayName)}
      </span>
      <div className="min-w-0">
        <Link
          className="block max-w-full truncate rounded-sm font-semibold text-text-strong! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          href={`/staff/${member.id}`}
          title={member.displayName}
        >
          {member.displayName}
        </Link>
        <p className="truncate text-caption text-text-muted" title={caption}>
          {caption}
        </p>
      </div>
    </div>
  );
}

function StaffRoles({ canViewRoles, member }: { canViewRoles: boolean; member: StaffDirectoryMember }) {
  if (!canViewRoles || member.roles === null) {
    return <span className="text-secondary text-text-muted">Ẩn theo phân quyền</span>;
  }

  if (member.roles.length === 0) {
    return <span className="text-secondary text-warning">Chưa được cấp vai trò</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {member.roles.map((role) => (
        <Badge key={role.assignmentId} title={`Mã vai trò: ${role.code}`}>
          {role.name}
        </Badge>
      ))}
    </div>
  );
}

function LeftAtCaption({ leftAt }: { leftAt: string | null }) {
  return leftAt ? (
    <p className="mt-0.5 whitespace-nowrap text-caption tabular-nums text-text-muted">nghỉ từ {formatIsoDate(leftAt)}</p>
  ) : null;
}

function JoinedAt({ joinedAt }: { joinedAt: string | null }) {
  return joinedAt ? <>{formatIsoDate(joinedAt)}</> : <span className="text-text-muted">Chưa cập nhật</span>;
}

function Phone({ phone }: { phone: string | null }) {
  if (phone) return <>{phone}</>;

  return (
    <>
      <span aria-hidden="true" className="text-text-subtle">
        —
      </span>
      <span className="sr-only">Chưa có số điện thoại</span>
    </>
  );
}

function getInitials(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
  return initials || "TV";
}
