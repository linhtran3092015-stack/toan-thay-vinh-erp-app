"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import {
  FilterBar,
  FilterField,
  FilterInput,
  FilterSelect,
  FilterSheet,
  FilterTrigger,
} from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { Pagination } from "@/components/patterns/pagination";
import { QuickFilterChips, type QuickFilterChip } from "@/components/patterns/quick-filter-chips";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import {
  countActiveClassFilters,
  filterClasses,
  hasActiveClassFilters,
  paginateClasses,
  type ClassDirectoryFiltersState,
} from "./class-filters";
import {
  getClassDirectoryHref,
  getClassDirectoryQuery,
  mergePendingClassDirectoryFilter,
  parseClassDirectoryViewState,
  resetClassDirectoryViewState,
  serializeClassDirectoryViewState,
  type ClassDirectoryViewState,
} from "./class-directory-url-state";
import type { ClassDirectoryItem } from "./read-models";
import { formatLearningMode } from "@/lib/format";

interface ClassListPageProps { canCreateClass: boolean; canImportClasses?: boolean; classes: ClassDirectoryItem[]; }

const classStatusMeta = {
  active: { label: "Đang hoạt động", tone: "success" as const },
  archived: { label: "Lưu trữ", tone: "neutral" as const },
  closed: { label: "Đã đóng", tone: "neutral" as const },
  draft: { label: "Nháp", tone: "warning" as const },
};
const quickStatusValues = ["all", "active", "draft", "closed", "archived"] as const;
type QuickStatusValue = (typeof quickStatusValues)[number];

/** Classes directory (design 06b): one table to compare roster, schedule and status across classes. */
export function ClassListPage({ canCreateClass, canImportClasses = false, classes }: ClassListPageProps) {
  const searchParams = useSearchParams();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingFiltersRef = useRef<ClassDirectoryFiltersState | null>(null);
  const years = useMemo(() => Array.from(new Set(classes.map((item) => item.academicYear?.code).filter((value): value is string => Boolean(value)))).sort((a, b) => b.localeCompare(a, "vi")), [classes]);
  // Inputs render local state, never search params: Next applies History API URLs inside
  // startTransition, so a field fed from useSearchParams would lag (and fight IME composition).
  const [viewState, setViewState] = useState<ClassDirectoryViewState>(() => parseClassDirectoryViewState(searchParams, years));
  // Queries this page wrote that Next may not have applied yet, so their late arrival is not mistaken for Back/Forward.
  const [localQueries, setLocalQueries] = useState<readonly string[]>([]);
  const [syncedQuery, setSyncedQuery] = useState(() => searchParams.toString());
  const urlQuery = searchParams.toString();
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (!localQueries.includes(urlQuery)) {
      // Back/Forward or an outside navigation: the URL wins.
      setViewState(parseClassDirectoryViewState(searchParams, years));
      setLocalQueries([]);
    } else if (localQueries.at(-1) === urlQuery) {
      setLocalQueries([]);
    }
  }
  // Event handlers merge onto the latest written filters, even before the page re-renders; Back/Forward re-bases it here.
  useEffect(() => { pendingFiltersRef.current = viewState.filters; }, [viewState.filters]);
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setViewState(parseClassDirectoryViewState(params, years));
      setLocalQueries([params.toString()]);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [years]);
  const filteredClasses = useMemo(() => filterClasses(classes, viewState.filters), [classes, viewState.filters]);
  const pagination = useMemo(() => paginateClasses(filteredClasses, viewState.page), [filteredClasses, viewState.page]);
  const activeFilterCount = countActiveClassFilters(viewState.filters);
  const hasFilters = hasActiveClassFilters(viewState.filters);
  const directoryQuery = getClassDirectoryQuery(serializeClassDirectoryViewState(searchParams, viewState));

  const statusCounts = useMemo(() => {
    const base = filterClasses(classes, { ...viewState.filters, status: "all" });
    const counts = new Map<string, number>();
    for (const item of base) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    return { counts, total: base.length };
  }, [classes, viewState.filters]);
  const quickChips: QuickFilterChip<QuickStatusValue>[] = quickStatusValues.map((value) => ({
    value,
    label: value === "all" ? "Tất cả" : classStatusMeta[value].label,
    count: value === "all" ? statusCounts.total : (statusCounts.counts.get(value) ?? 0),
  }));
  const summary = `${classes.filter((item) => item.status === "active").length} đang hoạt động · ${classes.filter((item) => item.status === "draft").length} nháp · ${classes.filter((item) => item.status === "closed" || item.status === "archived").length} đã kết thúc`;

  // Filtering is client-side over the `classes` prop, so update the URL through the
  // History API instead of a server round trip per keystroke. The state must be `null`:
  // Next skips its own sync (and useSearchParams never updates) when it sees its internal state.
  const writeUrl = (state: ClassDirectoryViewState, mode: "push" | "replace") => {
    const href = getClassDirectoryHref(searchParams, state);
    setViewState(state);
    setLocalQueries((current) => [...current, href.split("?")[1] ?? ""]);
    if (mode === "push") window.history.pushState(null, "", href);
    else window.history.replaceState(null, "", href);
  };
  const updateFilter = (key: keyof ClassDirectoryFiltersState, value: string) => {
    const filters = mergePendingClassDirectoryFilter(pendingFiltersRef.current, viewState.filters, key, value);
    pendingFiltersRef.current = filters;
    writeUrl({ filters, page: 1 }, "replace");
  };
  const resetFilters = () => {
    const state = resetClassDirectoryViewState();
    pendingFiltersRef.current = state.filters;
    writeUrl(state, "replace");
  };
  const updatePage = (page: number) => writeUrl({ filters: pendingFiltersRef.current ?? viewState.filters, page }, "push");
  const createHref = directoryQuery ? `/classes/new?${directoryQuery}` : "/classes/new";
  const isEmptyByFilter = filteredClasses.length === 0 && hasFilters;
  const emptyByFilterState = (
    <TableState>
      <p className="text-body font-semibold text-text-strong">Không có lớp học khớp bộ lọc</p>
      <p className="text-secondary text-text-muted">Nới rộng điều kiện hoặc xóa bộ lọc để xem lại danh sách.</p>
      <Button className="mt-2" onClick={resetFilters} size="sm" variant="secondary">Xóa lọc</Button>
    </TableState>
  );

  return <div className="classes-directory grid gap-5">
    <PageHeader
      actions={<>
        <FilterTrigger activeCount={activeFilterCount} className="classes-filter-trigger" onClick={() => setIsFilterDrawerOpen(true)} ref={filterTriggerRef} />
        {canImportClasses ? <Link className={getButtonClassName({ variant: "secondary" })} href="/imports/classes">Nhập lớp từ file</Link> : null}
        {canCreateClass ? <Link className={getButtonClassName()} href={createHref}>Tạo lớp mới</Link> : null}
      </>}
      title="Lớp học"
    >
      <p className="mt-1 text-secondary text-text-muted">{summary}{filteredClasses.length !== classes.length ? ` · ${filteredClasses.length} khớp bộ lọc` : ""}</p>
    </PageHeader>

    <div className="classes-mobile-search"><FilterInput active={viewState.filters.search.trim().length > 0} aria-label="Tìm lớp học" autoComplete="off" className="h-11" onChange={(event) => updateFilter("search", event.target.value)} placeholder="Tên lớp hoặc mã lớp" type="search" value={viewState.filters.search} /></div>

    <ClassFilters activeFilterCount={activeFilterCount} filters={viewState.filters} isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onFilterChange={updateFilter} onReset={resetFilters} resultCount={filteredClasses.length} returnFocusRef={filterTriggerRef} years={years} />

    <QuickFilterChips chips={quickChips} label="Lọc nhanh theo trạng thái" onChange={(value) => updateFilter("status", value)} value={(quickStatusValues as readonly string[]).includes(viewState.filters.status) ? (viewState.filters.status as QuickStatusValue) : "all"} />

    {filteredClasses.length === 0 && !hasFilters ? <EmptyState description="Chưa có lớp học nào." title="Chưa có lớp học" /> : <div className="classes-directory-results grid gap-3">
      <p aria-live="polite" className="sr-only">Hiển thị {pagination.start}-{pagination.end} của {filteredClasses.length} lớp học</p>
      <ClassTable classes={pagination.rows} directoryQuery={directoryQuery} empty={emptyByFilterState} footer={<Pagination itemLabel="lớp" label="Phân trang lớp học" onPageChange={updatePage} page={pagination.page} pageCount={pagination.pageCount} rangeEnd={pagination.end} rangeStart={pagination.start} summarySuffix={viewState.filters.year !== "all" ? `năm học ${viewState.filters.year}` : undefined} total={filteredClasses.length} variant="frame" />} status={isEmptyByFilter ? "empty" : "ready"} />
      <div className="classes-directory-record-list grid gap-2">
        <p className="flex items-center justify-between text-secondary text-text-muted"><span>{filteredClasses.length} lớp học</span>{hasFilters ? <button className="-my-3 min-h-11 rounded-md px-2 font-semibold text-action-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" onClick={resetFilters} type="button">Xóa lọc</button> : null}</p>
        {isEmptyByFilter ? <div className="rounded-lg border border-border-subtle bg-surface-base">{emptyByFilterState}</div> : <>
          <ResponsiveRecordList label="Danh sách lớp học">
            {pagination.rows.map((item) => <ClassRecord directoryQuery={directoryQuery} item={item} key={item.id} />)}
          </ResponsiveRecordList>
          <Pagination itemLabel="lớp" label="Phân trang lớp học (danh sách gọn)" onPageChange={updatePage} page={pagination.page} pageCount={pagination.pageCount} rangeEnd={pagination.end} rangeStart={pagination.start} total={filteredClasses.length} />
        </>}
      </div>
    </div>}
  </div>;
}

export function ClassFilters({ activeFilterCount, filters, isOpen, onClose, onFilterChange, onReset, resultCount, returnFocusRef, years }: { activeFilterCount: number; filters: ClassDirectoryFiltersState; isOpen: boolean; onClose: () => void; onFilterChange: (key: keyof ClassDirectoryFiltersState, value: string) => void; onReset: () => void; resultCount?: number; returnFocusRef: React.RefObject<HTMLElement | null>; years: string[]; }) {
  const titleId = useId();
  const fields = (scope: "desktop" | "mobile") => <ClassFilterFields filters={filters} onFilterChange={onFilterChange} scope={scope} years={years} />;
  return <>
    <FilterBar activeCount={activeFilterCount} className="classes-filter-bar" fieldCount={5} label="Bộ lọc lớp học" onReset={onReset}>{fields("desktop")}</FilterBar>
    <FilterSheet activeCount={activeFilterCount} isOpen={isOpen} onClose={onClose} onReset={onReset} resetTestId="mobile-class-reset-filters" resultLabel={resultCount === undefined ? "Xem kết quả" : `Xem ${resultCount} lớp`} returnFocusRef={returnFocusRef} subject="lớp học" titleId={titleId}>{fields("mobile")}</FilterSheet>
  </>;
}

function ClassFilterFields({ filters, onFilterChange, scope, years }: { filters: ClassDirectoryFiltersState; onFilterChange: (key: keyof ClassDirectoryFiltersState, value: string) => void; scope: "desktop" | "mobile"; years: string[]; }) {
  const update = (key: keyof ClassDirectoryFiltersState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onFilterChange(key, event.target.value);
  return <>
    <FilterField label="Tìm kiếm"><FilterInput active={filters.search.trim().length > 0} data-testid={`${scope}-class-search`} onChange={update("search")} placeholder="Tên lớp hoặc mã lớp" type="search" value={filters.search} /></FilterField>
    <SelectField label="Năm học" testId={`${scope}-class-year`} value={filters.year} onChange={update("year")}><option value="all">Tất cả năm học</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</SelectField>
    <SelectField label="Khối" testId={`${scope}-class-grade`} value={filters.grade} onChange={update("grade")}><option value="all">Khối 1–12</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Khối {index + 1}</option>)}</SelectField>
    <SelectField label="Mức" testId={`${scope}-class-level`} value={filters.level} onChange={update("level")}><option value="all">A/B/CLC</option><option value="A">Mức A</option><option value="B">Mức B</option><option value="CLC">CLC</option></SelectField>
    <SelectField label="Hình thức" testId={`${scope}-class-mode`} value={filters.mode} onChange={update("mode")}><option value="all">Tất cả</option><option value="offline">Tại lớp</option><option value="online">Trực tuyến</option><option value="hybrid">Kết hợp</option></SelectField>
    <SelectField label="Trạng thái" testId={`${scope}-class-status`} value={filters.status} onChange={update("status")}><option value="all">Tất cả</option><option value="draft">Nháp</option><option value="active">Đang hoạt động</option><option value="closed">Đã đóng</option><option value="archived">Lưu trữ</option></SelectField>
  </>;
}

function SelectField({ children, label, onChange, testId, value }: { children: ReactNode; label: string; onChange: (event: ChangeEvent<HTMLSelectElement>) => void; testId: string; value: string }) { return <FilterField label={label}><FilterSelect active={value !== "all"} data-testid={testId} onChange={onChange} value={value}>{children}</FilterSelect></FilterField>; }

function ClassTable({ classes, directoryQuery, empty, footer, status }: { classes: ClassDirectoryItem[]; directoryQuery: string; empty: ReactNode; footer: ReactNode; status: "ready" | "empty" }) {
  return <DataTableFrame body={classes.map((item) => <ClassTableRow directoryQuery={directoryQuery} item={item} key={item.id} />)} caption="Danh sách lớp học" className="classes-directory-table" empty={empty} footer={footer} header={<tr><TableHeaderCell>Lớp</TableHeaderCell><TableHeaderCell>Năm học</TableHeaderCell><TableHeaderCell>Khối · mức · hình thức</TableHeaderCell><TableHeaderCell numeric>Buổi/tuần</TableHeaderCell><TableHeaderCell numeric>Lịch hiệu lực</TableHeaderCell><TableHeaderCell numeric>Sĩ số</TableHeaderCell><TableHeaderCell>Trạng thái</TableHeaderCell><TableHeaderCell numeric>Thao tác</TableHeaderCell></tr>} status={status} tableClassName="min-w-[1080px]" />;
}
function ClassTableRow({ directoryQuery, item }: { directoryQuery: string; item: ClassDirectoryItem }) {
  const href = classHref(item.id, directoryQuery);
  return <TableRow tall>
    <TableCell><Link className="font-semibold text-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" href={href}>{item.name}</Link><span className="block text-caption leading-[14px] tabular-nums text-text-muted">{item.code}</span></TableCell>
    <TableCell className="w-[120px] text-secondary text-text-default">{item.academicYear?.code ?? <span className="text-text-muted">Chưa xác định</span>}</TableCell>
    <TableCell className="w-[200px] text-secondary text-text-default">{item.grade} · {item.level} · {formatLearningMode(item.defaultLearningMode)}</TableCell>
    <TableCell className="w-[96px]" numeric>{item.weeklySessionCount}</TableCell>
    <TableCell className="w-[112px]" numeric>{item.activeScheduleCount === 0 ? <Badge tone="warning">Chưa xếp</Badge> : item.activeScheduleCount}</TableCell>
    <TableCell className="w-[104px]" numeric>{item.activeStudentCount ?? <span className="text-caption text-text-muted">Không có quyền</span>}</TableCell>
    <TableCell className="w-[150px]"><ClassStatusBadge status={item.status} /></TableCell>
    <TableCell className="w-[80px]" numeric><Link aria-label={`Mở lớp ${item.name}`} className="inline-flex h-8 items-center rounded-md px-2 text-secondary font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" href={href}>Mở</Link></TableCell>
  </TableRow>;
}
function ClassRecord({ directoryQuery, item }: { directoryQuery: string; item: ClassDirectoryItem }) {
  const href = classHref(item.id, directoryQuery);
  return <RecordListItem ariaLabel={`Mở lớp ${item.name}`} badge={<ClassStatusBadge status={item.status} />} href={href} meta={`${item.code} · ${item.academicYear?.code ?? "Chưa xác định"} · Khối ${item.grade} · ${item.level} · ${formatLearningMode(item.defaultLearningMode)}`} metrics={<>
    <span>Buổi/tuần <strong className="font-semibold">{item.weeklySessionCount}</strong></span>
    <span>Lịch <strong className="font-semibold">{item.activeScheduleCount === 0 ? "Chưa xếp" : item.activeScheduleCount}</strong></span>
    <span className="ml-auto">Học viên: <strong className="font-semibold">{item.activeStudentCount ?? "Không có quyền"}</strong></span>
  </>} title={item.name} />;
}
function ClassStatusBadge({ status }: { status: string }) { const value = Object.hasOwn(classStatusMeta, status) ? classStatusMeta[status as keyof typeof classStatusMeta] : { label: `Trạng thái chưa hỗ trợ: ${status}`, tone: "neutral" as const }; return <Badge tone={value.tone}>{value.label}</Badge>; }
function classHref(id: string, query: string) { return query ? `/classes/${id}?${query}` : `/classes/${id}`; }
