"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { FilterBar } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  countActiveClassFilters,
  filterClasses,
  hasActiveClassFilters,
  paginateClasses,
  type ClassDirectoryFiltersState,
} from "./class-filters";
import {
  areClassDirectoryFiltersEqual,
  getClassDirectoryHref,
  getClassDirectoryQuery,
  mergePendingClassDirectoryFilter,
  parseClassDirectoryViewState,
  resetClassDirectoryViewState,
} from "./class-directory-url-state";
import type { ClassDirectoryItem } from "./read-models";

interface ClassListPageProps { canCreateClass: boolean; classes: ClassDirectoryItem[]; }

export function ClassListPage({ canCreateClass, classes }: ClassListPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingFiltersRef = useRef<ClassDirectoryFiltersState | null>(null);
  const years = useMemo(() => Array.from(new Set(classes.map((item) => item.academicYear?.code).filter((value): value is string => Boolean(value)))).sort((a, b) => b.localeCompare(a, "vi")), [classes]);
  const viewState = useMemo(() => parseClassDirectoryViewState(searchParams, years), [searchParams, years]);
  useEffect(() => { if (pendingFiltersRef.current === null || areClassDirectoryFiltersEqual(pendingFiltersRef.current, viewState.filters)) pendingFiltersRef.current = viewState.filters; }, [viewState.filters]);
  const filteredClasses = useMemo(() => filterClasses(classes, viewState.filters), [classes, viewState.filters]);
  const pagination = useMemo(() => paginateClasses(filteredClasses, viewState.page), [filteredClasses, viewState.page]);
  const activeFilterCount = countActiveClassFilters(viewState.filters);
  const directoryQuery = getClassDirectoryQuery(searchParams);

  const updateFilter = (key: keyof ClassDirectoryFiltersState, value: string) => {
    const filters = mergePendingClassDirectoryFilter(pendingFiltersRef.current, viewState.filters, key, value);
    pendingFiltersRef.current = filters;
    router.replace(getClassDirectoryHref(searchParams, { filters, page: 1 }), { scroll: false });
  };
  const resetFilters = () => {
    const state = resetClassDirectoryViewState();
    pendingFiltersRef.current = state.filters;
    router.replace(getClassDirectoryHref(searchParams, state), { scroll: false });
  };
  const updatePage = (page: number) => router.push(getClassDirectoryHref(searchParams, { filters: viewState.filters, page }), { scroll: false });
  const createHref = directoryQuery ? `/classes/new?${directoryQuery}` : "/classes/new";

  return <div className="classes-directory grid gap-6">
    <PageHeader
      actions={<>
        <Button className="classes-filter-trigger min-h-11" onClick={() => setIsFilterDrawerOpen(true)} ref={filterTriggerRef} variant="outline">
          {activeFilterCount ? `Bộ lọc (${activeFilterCount})` : "Bộ lọc"}
        </Button>
        {canCreateClass ? <Link className="inline-flex h-10 items-center justify-center rounded-md border border-action-primary bg-action-primary px-4 text-control font-semibold text-text-on-primary hover:bg-action-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={createHref}>Tạo lớp</Link> : null}
      </>}
      context={<span className="text-secondary text-text-muted">{filteredClasses.length}/{classes.length} kết quả</span>}
      title="Lớp học"
    />

    <ClassFilters activeFilterCount={activeFilterCount} filters={viewState.filters} isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onFilterChange={updateFilter} onReset={resetFilters} returnFocusRef={filterTriggerRef} years={years} />

    {filteredClasses.length === 0 ? <EmptyState description={hasActiveClassFilters(viewState.filters) ? "Không có lớp học phù hợp với bộ lọc hiện tại." : "Chưa có lớp học nào."} title="Không có lớp học phù hợp" /> : <>
      <div className="classes-directory-results">
        <p aria-live="polite" className="mb-3 text-secondary text-text-muted">Hiển thị {pagination.start}-{pagination.end} của {filteredClasses.length} lớp học</p>
        <ClassTable classes={pagination.rows} directoryQuery={directoryQuery} />
        <ResponsiveRecordList className="classes-directory-record-list" label="Danh sách lớp học">
          {pagination.rows.map((item) => <ClassRecord directoryQuery={directoryQuery} item={item} key={item.id} />)}
        </ResponsiveRecordList>
      </div>
      <ClassPagination {...pagination} onPageChange={updatePage} total={filteredClasses.length} />
    </>}
  </div>;
}

export function ClassFilters({ activeFilterCount, filters, isOpen, onClose, onFilterChange, onReset, returnFocusRef, years }: { activeFilterCount: number; filters: ClassDirectoryFiltersState; isOpen: boolean; onClose: () => void; onFilterChange: (key: keyof ClassDirectoryFiltersState, value: string) => void; onReset: () => void; returnFocusRef: React.RefObject<HTMLElement | null>; years: string[]; }) {
  const fields = (scope: "desktop" | "mobile") => <ClassFilterFields filters={filters} onFilterChange={onFilterChange} onReset={onReset} scope={scope} years={years} />;
  return <>
    <FilterBar className="classes-filter-bar">{fields("desktop")}</FilterBar>
    <Dialog ariaLabelledBy="class-filter-drawer-title" className="ml-auto flex h-full max-h-none max-w-[360px] flex-col rounded-none sm:max-h-[92vh] sm:rounded-xl" isOpen={isOpen} onClose={onClose} returnFocusRef={returnFocusRef}>
      <div className="flex h-16 items-center justify-between border-b border-border-subtle px-4"><div><h2 className="text-section-title font-semibold text-text-strong" id="class-filter-drawer-title">Bộ lọc</h2><p className="text-caption text-text-muted">{activeFilterCount ? `${activeFilterCount} bộ lọc đang áp dụng` : "Lọc danh sách lớp học hiện có"}</p></div><button aria-label="Đóng bộ lọc" className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" onClick={onClose} type="button"><X aria-hidden="true" size={20} strokeWidth={1.8} /></button></div>
      <div className="flex-1 overflow-y-auto p-4">{fields("mobile")}</div>
    </Dialog>
  </>;
}

function ClassFilterFields({ filters, onFilterChange, onReset, scope, years }: { filters: ClassDirectoryFiltersState; onFilterChange: (key: keyof ClassDirectoryFiltersState, value: string) => void; onReset: () => void; scope: "desktop" | "mobile"; years: string[]; }) {
  const update = (key: keyof ClassDirectoryFiltersState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onFilterChange(key, event.target.value);
  return <div className="classes-filter-fields grid gap-3">
    <FilterField label="Tìm kiếm"><input className={fieldClassName} data-testid={`${scope}-class-search`} onChange={update("search")} placeholder="Tên lớp hoặc mã lớp" type="search" value={filters.search} /></FilterField>
    <SelectField label="Năm học" testId={`${scope}-class-year`} value={filters.year} onChange={update("year")}><option value="all">Tất cả năm học</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</SelectField>
    <SelectField label="Khối" testId={`${scope}-class-grade`} value={filters.grade} onChange={update("grade")}><option value="all">Khối 1–12</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Khối {index + 1}</option>)}</SelectField>
    <SelectField label="Mức" testId={`${scope}-class-level`} value={filters.level} onChange={update("level")}><option value="all">A/B/CLC</option><option value="A">Mức A</option><option value="B">Mức B</option><option value="CLC">CLC</option></SelectField>
    <SelectField label="Hình thức" testId={`${scope}-class-mode`} value={filters.mode} onChange={update("mode")}><option value="all">Tất cả</option><option value="offline">Offline</option><option value="online">Online</option><option value="hybrid">Kết hợp</option></SelectField>
    <SelectField label="Trạng thái" testId={`${scope}-class-status`} value={filters.status} onChange={update("status")}><option value="all">Tất cả</option><option value="draft">Nháp</option><option value="active">Đang hoạt động</option><option value="closed">Đã đóng</option><option value="archived">Lưu trữ</option></SelectField>
    {hasActiveClassFilters(filters) ? <div className="flex items-end"><Button className="min-h-10 w-full" data-testid={`${scope}-class-reset-filters`} onClick={onReset} variant="ghost">Xóa lọc</Button></div> : null}
  </div>;
}

const fieldClassName = "h-10 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";
function FilterField({ children, label }: { children: ReactNode; label: string }) { return <label className="grid gap-1.5 text-label font-medium text-text-muted">{label}{children}</label>; }
function SelectField({ children, label, onChange, testId, value }: { children: ReactNode; label: string; onChange: (event: ChangeEvent<HTMLSelectElement>) => void; testId: string; value: string }) { return <FilterField label={label}><select className={fieldClassName} data-testid={testId} onChange={onChange} value={value}>{children}</select></FilterField>; }

function ClassTable({ classes, directoryQuery }: { classes: ClassDirectoryItem[]; directoryQuery: string }) { return <DataTableFrame body={classes.map((item) => <ClassTableRow directoryQuery={directoryQuery} item={item} key={item.id} />)} caption="Danh sách lớp học" className="classes-directory-table" header={<tr><TableHeader>Mã / tên lớp</TableHeader><TableHeader>Năm học</TableHeader><TableHeader>Khối · mức · hình thức</TableHeader><TableHeader className="text-right">Buổi/tuần</TableHeader><TableHeader className="text-right">Lịch hiệu lực</TableHeader><TableHeader className="text-right">Học viên</TableHeader><TableHeader>Trạng thái</TableHeader><TableHeader className="text-right">Thao tác</TableHeader></tr>} tableClassName="min-w-[1200px] table-fixed text-table-body text-text-default" />; }
function ClassTableRow({ directoryQuery, item }: { directoryQuery: string; item: ClassDirectoryItem }) { const href = classHref(item.id, directoryQuery); return <tr className="transition-colors hover:bg-[var(--table-row-hover)]"><TableCell className="w-[236px]"><Link className="font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={href}>{item.name}</Link><p className="mt-0.5 tabular-nums text-caption text-text-muted">{item.code}</p></TableCell><TableCell className="w-[124px] text-secondary text-text-default">{item.academicYear?.code ?? "Chưa xác định"}</TableCell><TableCell className="w-[190px] text-secondary text-text-muted">Khối {item.grade} · Mức {item.level} · {formatMode(item.defaultLearningMode)}</TableCell><TableCell className="w-[100px] text-right tabular-nums">{item.weeklySessionCount}</TableCell><TableCell className="w-[120px] text-right tabular-nums">{item.activeScheduleCount}</TableCell><TableCell className="w-[112px] text-right tabular-nums">{item.activeStudentCount ?? "Không có quyền"}</TableCell><TableCell className="w-[150px]"><ClassStatusBadge status={item.status} /></TableCell><TableCell className="w-[112px] text-right"><Link aria-label={`Mở lớp ${item.name}`} className="inline-flex h-8 items-center justify-center rounded-md px-2 text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={href}>Mở lớp</Link></TableCell></tr>; }
function ClassRecord({ directoryQuery, item }: { directoryQuery: string; item: ClassDirectoryItem }) { const href = classHref(item.id, directoryQuery); return <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3" role="listitem"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link className="block text-body font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={href}>{item.name}</Link><p className="mt-0.5 tabular-nums text-caption text-text-muted">{item.code}</p></div><ClassStatusBadge status={item.status} /></div><div className="mt-3 grid gap-1.5 text-secondary text-text-muted"><p>Khối {item.grade} · Mức {item.level} · {formatMode(item.defaultLearningMode)} · {item.academicYear?.code ?? "Chưa xác định"}</p><p>{item.weeklySessionCount} buổi/tuần · {item.activeScheduleCount} lịch hiệu lực</p><p><span className="font-medium text-text-default">Học viên:</span> {item.activeStudentCount ?? "Không có quyền"}</p></div><Link aria-label={`Mở lớp ${item.name}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-subtle px-4 text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={href}>Mở lớp</Link></article>; }
function ClassPagination({ end, onPageChange, page, pageCount, start, total }: { end: number; onPageChange: (page: number) => void; page: number; pageCount: number; start: number; total: number }) { return <nav aria-label="Phân trang lớp học" className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 text-body text-text-muted md:flex-row md:items-center md:justify-between"><p>Hiển thị {start}-{end} của {total} lớp học · Trang {page}/{pageCount}</p><div className="flex flex-wrap gap-2"><Button disabled={page <= 1} onClick={() => onPageChange(page - 1)} variant="outline">Trước</Button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((value) => <Button aria-current={value === page ? "page" : undefined} className="min-w-10" key={value} onClick={() => onPageChange(value)} variant={value === page ? "secondary" : "ghost"}>{value}</Button>)}<Button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} variant="outline">Sau</Button></div></nav>; }
function ClassStatusBadge({ status }: { status: string }) { const values = { active: { label: "Đang hoạt động", tone: "success" as const }, archived: { label: "Lưu trữ", tone: "neutral" as const }, closed: { label: "Đã đóng", tone: "neutral" as const }, draft: { label: "Nháp", tone: "warning" as const } }; const value = Object.hasOwn(values, status) ? values[status as keyof typeof values] : { label: `Trạng thái chưa hỗ trợ: ${status}`, tone: "neutral" as const }; return <Badge tone={value.tone}>{value.label}</Badge>; }
function TableHeader({ children, className }: { children: ReactNode; className?: string }) { return <th className={`h-10 border-b border-border-subtle px-3 text-left font-semibold ${className ?? ""}`} scope="col">{children}</th>; }
function TableCell({ children, className }: { children: ReactNode; className?: string }) { return <td className={`h-14 px-3 align-middle text-table-body ${className ?? ""}`}>{children}</td>; }
function classHref(id: string, query: string) { return query ? `/classes/${id}?${query}` : `/classes/${id}`; }
function formatMode(mode: ClassDirectoryItem["defaultLearningMode"]) { return mode === "offline" ? "Offline" : mode === "online" ? "Online" : "Kết hợp"; }
