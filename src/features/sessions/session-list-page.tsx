"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

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
import { SortableTableHeader } from "@/components/patterns/sortable-table-header";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { getVietnamTime, getVietnamToday } from "@/lib/datetime";
import { useSortedRows, type SortState } from "@/lib/sorting";
import { cn } from "@/lib/utils";

import type { SessionDirectoryItem, SessionStatus } from "./read-models";
import {
  applySessionDirectoryFilters,
  applySessionQuickFilter,
  countSessionQuickFilters,
  createSessionQueueMap,
  deriveSessionQuickFilter,
  formatSessionClassCaption,
  formatSessionCountCell,
  formatSessionDateTime,
  formatSessionKindShort,
  formatSessionModeRoom,
  getSessionAttendanceCell,
  getSessionLockReadiness,
  getSessionLockReadinessLabel,
  getSessionOverdueCaption,
  getSessionResultCell,
  getSessionRowAction,
  getSessionWeekLabel,
  getSessionWindowNotice,
  isSessionAttendanceCountKnown,
  isSessionQuickFilterCountComplete,
  needsSessionAttendance,
  SESSION_DIRECTORY_WINDOW_LIMIT,
  SESSION_QUEUE_LIMIT,
  sessionQuickFilterLabels,
  sessionQuickFilters,
  sessionRowActionLabels,
  type SessionCountCell,
  type SessionDirectoryClock,
  type SessionLoadedWindow,
  type SessionLockReadiness,
  type SessionQueueFacts,
  type SessionQueueStatus,
  type SessionQuickFilter,
} from "./session-directory-models";
import {
  getSessionDirectoryHref,
  getSessionDirectoryQuery,
  mergePendingSessionDirectoryFilter,
  parseSessionAttendanceFilter,
  parseSessionDirectoryViewState,
  resetSessionDirectoryViewState,
  serializeSessionDirectoryViewState,
  type SessionAttendanceFilter,
  type SessionDirectoryViewState,
} from "./session-directory-url-state";
import {
  countActiveSessionFilters,
  hasActiveSessionFilters,
  paginateSessions,
  type SessionDirectoryFiltersState,
} from "./session-filters";

type SessionSortKey = "class" | "date" | "status";

function getSessionSortValue(session: SessionDirectoryItem, key: SessionSortKey): unknown {
  if (key === "date") return `${session.sessionDate} ${session.startTime}`;
  if (key === "class") return session.classCode;
  return session.status;
}

/** The seven URL filters, the page and the separate `attendance=missing` param. */
type SessionDirectoryPageState = SessionDirectoryViewState & { attendance: SessionAttendanceFilter };

interface SessionListPageProps {
  /**
   * The list's own path for its URL writes and "Tải lại danh sách" (the /dev
   * preview passes `/dev/lists` so a reload stays on fixtures). Row, create
   * and class links always point at the real routes.
   */
  basePath?: string;
  /** sessions.lock: rows the queue reports lockable get a "Khóa" link (to the session page). */
  canLock?: boolean;
  canManageSessions: boolean;
  /** attendance.mark: started rows that still need attendance get a "Điểm danh" link. */
  canMarkAttendance?: boolean;
  canViewAttendance: boolean;
  /** classes.view: the class name links to its class page. */
  canViewClasses?: boolean;
  canViewResults: boolean;
  /** Date bounds the server applied to the query (`from`/`to` of the request); omitted = the unbounded newest window. */
  loadedRange?: { dateFrom: string | null; dateTo: string | null };
  /** Vietnam wall-clock HH:MM:SS from the server page. */
  nowTime?: string;
  /** Lock-queue items (completed, unlocked sessions); a row without one shows no readiness. */
  queueItems?: readonly SessionQueueFacts[];
  queuePanel?: ReactNode;
  /**
   * Row cap the lock queue was read with, for the partial notice ("từ N buổi trở
   * lên"); defaults to the route's `SESSION_QUEUE_LIMIT`. The /dev preview passes
   * the same limit it gives the panel, so both say the same number.
   */
  queueLimit?: number;
  /** How far `queueItems` can be trusted; omitted = "ok". `failed`/`partial` show a notice and drop the counts the queue decides. */
  queueStatus?: SessionQueueStatus;
  sessions: SessionDirectoryItem[];
  /** Vietnam business date YYYY-MM-DD from the server page. */
  today?: string;
}

const sessionStatusMeta: Record<SessionStatus, { label: string; tone: "info" | "neutral" }> = {
  cancelled: { label: "Đã hủy", tone: "neutral" },
  completed: { label: "Đã hoàn thành", tone: "neutral" },
  in_progress: { label: "Đang diễn ra", tone: "info" },
  scheduled: { label: "Đã lên lịch", tone: "info" },
};

/** Sessions directory (design 16b): one table to see, across classes, which sessions still need attendance or a lock. */
export function SessionListPage({
  basePath = "/sessions",
  canLock = false,
  canManageSessions,
  canMarkAttendance = false,
  canViewAttendance,
  canViewClasses = false,
  canViewResults,
  loadedRange,
  nowTime,
  queueItems,
  queuePanel,
  queueLimit = SESSION_QUEUE_LIMIT,
  queueStatus = "ok",
  sessions,
  today,
}: SessionListPageProps) {
  const searchParams = useSearchParams();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef<{ attendance: SessionAttendanceFilter; filters: SessionDirectoryFiltersState } | null>(null);
  // Tests and previews may omit the server clock; read it once so renders agree.
  const [fallbackClock] = useState(() => ({ nowTime: getVietnamTime(), today: getVietnamToday() }));
  const currentToday = today ?? fallbackClock.today;
  const currentNowTime = nowTime ?? (today ? undefined : fallbackClock.nowTime);
  const queue = useMemo(() => createSessionQueueMap(queueItems), [queueItems]);
  const clock = useMemo<SessionDirectoryClock>(() => ({ nowTime: currentNowTime, queue, queueStatus, today: currentToday }), [currentNowTime, currentToday, queue, queueStatus]);
  const classOptions = useMemo(() => Array.from(new Map(sessions.map((item) => [item.classId, { code: item.classCode, name: item.className }])).entries()).sort(([, left], [, right]) => left.code.localeCompare(right.code, "vi")), [sessions]);
  const classIds = useMemo(() => classOptions.map(([id]) => id), [classOptions]);
  const parseState = (params: URLSearchParams | ReturnType<typeof useSearchParams>, ids: readonly string[]): SessionDirectoryPageState => ({
    ...parseSessionDirectoryViewState(params, ids),
    attendance: parseSessionAttendanceFilter(params),
  });
  // Inputs render local state, never search params: Next applies History API URLs inside
  // startTransition, so a field fed from useSearchParams would lag (class-list precedent).
  const [viewState, setViewState] = useState<SessionDirectoryPageState>(() => parseState(searchParams, classIds));
  // Queries this page wrote that Next may not have applied yet, so their late arrival is not mistaken for Back/Forward.
  const [localQueries, setLocalQueries] = useState<readonly string[]>([]);
  const [syncedQuery, setSyncedQuery] = useState(() => searchParams.toString());
  const urlQuery = searchParams.toString();
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (!localQueries.includes(urlQuery)) {
      // Back/Forward or an outside navigation: the URL wins.
      setViewState(parseState(searchParams, classIds));
      setLocalQueries([]);
    } else if (localQueries.at(-1) === urlQuery) {
      setLocalQueries([]);
    }
  }
  // Event handlers merge onto the latest written state, even before the page re-renders.
  useEffect(() => { pendingRef.current = { attendance: viewState.attendance, filters: viewState.filters }; }, [viewState.attendance, viewState.filters]);
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setViewState({ ...parseSessionDirectoryViewState(params, classIds), attendance: parseSessionAttendanceFilter(params) });
      setLocalQueries([params.toString()]);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [classIds]);

  const { attendance, filters } = viewState;
  const filteredSessions = useMemo(() => applySessionDirectoryFilters(sessions, filters, attendance, clock), [attendance, clock, filters, sessions]);
  const { sort, sortedRows, toggleSort } = useSortedRows(filteredSessions, getSessionSortValue);
  const pagination = useMemo(() => paginateSessions(sortedRows, viewState.page), [sortedRows, viewState.page]);
  const activeFilterCount = countActiveSessionFilters(filters) + (attendance === "missing" ? 1 : 0);
  const hasFilters = hasActiveSessionFilters(filters) || attendance === "missing";
  const directoryQuery = getSessionDirectoryQuery(serializeSessionDirectoryViewState(searchParams, viewState, attendance));
  const currentHref = getSessionDirectoryHref(searchParams, viewState, attendance, basePath);

  const loadedWindow: SessionLoadedWindow = { limit: SESSION_DIRECTORY_WINDOW_LIMIT, loadedFrom: loadedRange?.dateFrom ?? null, loadedTo: loadedRange?.dateTo ?? null };
  const chipCounts = useMemo(() => countSessionQuickFilters(sessions, filters, clock), [clock, filters, sessions]);
  // A chip gets a number only when it covers every session it would show (its range loaded, the queue known).
  const quickChips: QuickFilterChip<SessionQuickFilter>[] = sessionQuickFilters.map((value) => ({
    count: isSessionQuickFilterCountComplete(value, { clock, filters, loaded: loadedWindow, sessions }) ? chipCounts[value] : undefined,
    label: sessionQuickFilterLabels[value],
    value,
  }));
  const quickValue = deriveSessionQuickFilter(filters, attendance, currentToday);

  const windowNotice = getSessionWindowNotice({
    ...loadedWindow,
    requestedFrom: filters.dateFrom,
    requestedTo: filters.dateTo,
    sessions,
  });
  const weekLabel = getSessionWeekLabel(filters.dateFrom, filters.dateTo);
  const missingCount = filteredSessions.filter((row) => needsSessionAttendance(row, clock)).length;
  const pendingLockCount = filteredSessions.filter((row) => row.status === "completed" && row.lockedAt === null).length;
  // Without the queue facts of every completed, unlocked row the number would undercount: leave it out.
  const missingSummary = isSessionAttendanceCountKnown(applySessionDirectoryFilters(sessions, filters, "all", clock), clock) ? ` · ${missingCount} chưa điểm danh` : "";
  // The week's counts only when the whole week was read; otherwise the label alone (the cut caption or reload notice says why).
  const weekSummary = windowNotice === "complete" ? `${weekLabel} · ${filteredSessions.length} buổi${missingSummary} · ${pendingLockCount} chờ khóa` : weekLabel;
  const summary = weekLabel
    ? weekSummary
    : hasFilters
      ? `${filteredSessions.length} / ${sessions.length} buổi`
      : `${sessions.length} buổi`;

  // Filtering is client-side over the loaded rows, so URL writes go through the History API
  // (no server round trip, and a /dev preview never navigates). The state must be `null`:
  // Next skips its own sync (and useSearchParams never updates) when it sees its internal state.
  const writeUrl = (state: SessionDirectoryPageState, mode: "push" | "replace") => {
    const href = getSessionDirectoryHref(searchParams, state, state.attendance, basePath);
    setViewState(state);
    setLocalQueries((current) => [...current, href.split("?")[1] ?? ""]);
    if (mode === "push") window.history.pushState(null, "", href);
    else window.history.replaceState(null, "", href);
  };
  const updateFilter = (key: keyof SessionDirectoryFiltersState, value: string) => {
    const nextFilters = mergePendingSessionDirectoryFilter(pendingRef.current?.filters ?? null, filters, key, value);
    const nextAttendance = pendingRef.current?.attendance ?? attendance;
    pendingRef.current = { attendance: nextAttendance, filters: nextFilters };
    writeUrl({ attendance: nextAttendance, filters: nextFilters, page: 1 }, "replace");
  };
  const applyQuickFilter = (chip: SessionQuickFilter) => {
    const next = applySessionQuickFilter(pendingRef.current?.filters ?? filters, chip, currentToday);
    pendingRef.current = next;
    writeUrl({ ...next, page: 1 }, "replace");
  };
  const resetFilters = () => {
    const state = resetSessionDirectoryViewState();
    pendingRef.current = { attendance: "all", filters: state.filters };
    writeUrl({ ...state, attendance: "all" }, "replace");
  };
  const updatePage = (page: number) => {
    const current = pendingRef.current ?? { attendance, filters };
    writeUrl({ ...current, page }, "push");
  };
  const createHref = directoryQuery ? `/sessions/new?${directoryQuery}` : "/sessions/new";
  const batchCreateHref = directoryQuery ? `/sessions/batch?${directoryQuery}` : "/sessions/batch";
  const isEmptyByFilter = filteredSessions.length === 0 && hasFilters;
  const hasNoSessions = sessions.length === 0 && !hasFilters;
  const rowContext: SessionRowContext = { canLock, canMarkAttendance, canViewAttendance, canViewClasses, canViewResults, clock, directoryQuery };
  const emptyByFilterState = (
    <TableState>
      <p className="text-body font-semibold text-text-strong">Không có buổi học khớp bộ lọc</p>
      <p className="text-secondary text-text-muted">Nới rộng điều kiện hoặc xóa bộ lọc để xem lại danh sách.</p>
      <Button className="mt-2 max-md:h-11" onClick={resetFilters} size="sm" variant="secondary">Xóa lọc</Button>
    </TableState>
  );
  const noSessionsState = (
    <TableState>
      <p className="text-body font-semibold text-text-strong">Chưa có buổi học</p>
      <p className="text-secondary text-text-muted">{canManageSessions ? "Buổi học xuất hiện khi tạo từ lịch lớp hoặc bằng nút Tạo buổi học." : "Buổi học xuất hiện khi được tạo từ lịch lớp."}</p>
    </TableState>
  );

  return <div className="sessions-directory grid grid-cols-[minmax(0,1fr)] gap-5">
    <PageHeader
      actions={<>
        <FilterTrigger activeCount={activeFilterCount} className="sessions-filter-trigger" onClick={() => setIsFilterDrawerOpen(true)} ref={filterTriggerRef} />
        {canManageSessions ? <>
          <Link className={getButtonClassName({ className: "max-md:h-11", variant: "secondary" })} href={batchCreateHref}>Tạo hàng loạt</Link>
          <Link className={getButtonClassName({ className: "max-md:h-11" })} href={createHref}>Tạo buổi học</Link>
        </> : null}
      </>}
      title="Buổi học"
    >
      <p className="mt-1 text-secondary tabular-nums text-text-muted">{summary}</p>
      {windowNotice === "truncated" ? (
        <p className="mt-0.5 text-caption text-text-muted">
          {loadedRange?.dateFrom || loadedRange?.dateTo
            ? `Khoảng ngày này có hơn ${SESSION_DIRECTORY_WINDOW_LIMIT} buổi: đang hiển thị ${SESSION_DIRECTORY_WINDOW_LIMIT} buổi mới nhất theo ngày; thu hẹp khoảng ngày để xem đủ.`
            : `Đang hiển thị ${SESSION_DIRECTORY_WINDOW_LIMIT} buổi mới nhất theo ngày; chọn khoảng ngày để xem đủ.`}
        </p>
      ) : null}
    </PageHeader>

    {queueStatus === "failed" ? (
      <p className="rounded-lg border border-warning-border bg-warning-bg px-4 py-2.5 text-secondary text-warning-ink" role="status">
        Không tải được hàng đợi khóa: trạng thái sẵn sàng khóa và số chưa điểm danh của các buổi đã hoàn thành có thể thiếu.
      </p>
    ) : queueStatus === "partial" ? (
      <p className="rounded-lg border border-warning-border bg-warning-bg px-4 py-2.5 text-secondary text-warning-ink" role="status">
        Hàng đợi khóa có từ {queueLimit} buổi trở lên; các buổi hoàn thành gần đây có thể chưa có trạng thái sẵn sàng khóa và chưa được tính vào Chưa điểm danh.
      </p>
    ) : null}

    {queuePanel}

    <SessionFilters activeFilterCount={activeFilterCount} classOptions={classOptions} filters={filters} isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onFilterChange={updateFilter} onReset={resetFilters} resultCount={filteredSessions.length} returnFocusRef={filterTriggerRef} />

    <QuickFilterChips chips={quickChips} className="max-md:[&_button]:h-11" disableEmpty={false} label="Lọc nhanh buổi học" onChange={applyQuickFilter} value={quickValue} />

    {windowNotice === "reload" ? (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-border bg-warning-bg px-4 py-2.5" role="status">
        <p className="text-secondary text-warning-ink">Khoảng ngày đang chọn chưa được tải đủ, số buổi và số đếm bên dưới có thể thiếu.</p>
        {/* A plain anchor: a full load is the one navigation sure to re-run the server query for the new range. */}
        <a className={getButtonClassName({ className: "max-md:h-11", size: "sm", variant: "secondary" })} href={currentHref}>Tải lại danh sách</a>
      </div>
    ) : null}

    <div className="sessions-directory-results grid grid-cols-[minmax(0,1fr)] gap-3">
      <p aria-live="polite" className="sr-only">Hiển thị {pagination.start}-{pagination.end} của {filteredSessions.length} buổi học</p>
      {/* No sessions at all still renders the frame, so the page keeps its geometry (empty state in the frame). */}
      <SessionTable
        context={rowContext}
        empty={hasNoSessions ? noSessionsState : emptyByFilterState}
        footer={hasNoSessions ? undefined : <Pagination itemLabel="buổi" label="Phân trang buổi học" onPageChange={updatePage} page={pagination.page} pageCount={pagination.pageCount} rangeEnd={pagination.end} rangeStart={pagination.start} total={filteredSessions.length} variant="frame" />}
        onSort={toggleSort}
        rows={pagination.rows}
        sort={sort}
        status={isEmptyByFilter || hasNoSessions ? "empty" : "ready"}
      />
      <div className="sessions-directory-record-list gap-2">
        {hasNoSessions ? <div className="rounded-lg border border-border-subtle bg-surface-base">{noSessionsState}</div> : <>
          <p className="flex items-center justify-between text-secondary text-text-muted"><span>{filteredSessions.length} buổi</span>{hasFilters ? <button className="-my-3 min-h-11 rounded-md px-2 font-semibold text-action-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" onClick={resetFilters} type="button">Xóa lọc</button> : null}</p>
          {isEmptyByFilter ? <div className="rounded-lg border border-border-subtle bg-surface-base">{emptyByFilterState}</div> : <>
            <ResponsiveRecordList label="Danh sách buổi học">
              {pagination.rows.map((row) => <SessionRecord context={rowContext} key={row.id} row={row} />)}
            </ResponsiveRecordList>
            <Pagination itemLabel="buổi" label="Phân trang buổi học (danh sách gọn)" onPageChange={updatePage} page={pagination.page} pageCount={pagination.pageCount} rangeEnd={pagination.end} rangeStart={pagination.start} total={filteredSessions.length} />
          </>}
        </>}
      </div>
    </div>
  </div>;
}

/**
 * Tìm kiếm · Từ ngày · Đến ngày · Lớp · Trạng thái · Loại buổi · Khóa. The date
 * inputs get a 148px floor so a full dd/mm/yyyy shows. At the 1120px container
 * threshold the bar's inner width is 1086px; minus 7 × 12px gaps and the ~100px
 * "Xóa lọc (n)" button, 902px remain: 180 + 2 × 148 floors leave 106px per select.
 */
const SESSION_FILTER_COLUMNS = "minmax(180px, 1.3fr) repeat(2, minmax(148px, 0.9fr)) repeat(4, minmax(0, 1fr))";

export function SessionFilters({ activeFilterCount, classOptions, filters, isOpen, onClose, onFilterChange, onReset, resultCount, returnFocusRef }: { activeFilterCount: number; classOptions: [string, { code: string; name: string }][]; filters: SessionDirectoryFiltersState; isOpen: boolean; onClose: () => void; onFilterChange: (key: keyof SessionDirectoryFiltersState, value: string) => void; onReset: () => void; resultCount?: number; returnFocusRef: React.RefObject<HTMLElement | null>; }) {
  const titleId = useId();
  const fields = (scope: "desktop" | "mobile") => <SessionFilterFields classOptions={classOptions} filters={filters} onFilterChange={onFilterChange} scope={scope} />;
  return <>
    <FilterBar activeCount={activeFilterCount} className="sessions-filter-bar" columns={SESSION_FILTER_COLUMNS} label="Bộ lọc buổi học" onReset={onReset}>{fields("desktop")}</FilterBar>
    <FilterSheet activeCount={activeFilterCount} isOpen={isOpen} onClose={onClose} onReset={onReset} resetTestId="mobile-session-reset-filters" resultLabel={resultCount === undefined ? "Xem kết quả" : `Xem ${resultCount} buổi`} returnFocusRef={returnFocusRef} subject="buổi học" titleId={titleId}>{fields("mobile")}</FilterSheet>
  </>;
}

function SessionFilterFields({ classOptions, filters, onFilterChange, scope }: { classOptions: [string, { code: string; name: string }][]; filters: SessionDirectoryFiltersState; onFilterChange: (key: keyof SessionDirectoryFiltersState, value: string) => void; scope: "desktop" | "mobile"; }) {
  const update = (key: keyof SessionDirectoryFiltersState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onFilterChange(key, event.target.value);
  return <>
    <FilterField label="Tìm kiếm"><FilterInput active={filters.search.trim().length > 0} data-testid={`${scope}-session-search`} onChange={update("search")} placeholder="Tên lớp, mã lớp, thành phần" type="search" value={filters.search} /></FilterField>
    <FilterField label="Từ ngày"><FilterInput active={filters.dateFrom.length > 0} data-testid={`${scope}-session-from`} onChange={update("dateFrom")} type="date" value={filters.dateFrom} /></FilterField>
    <FilterField label="Đến ngày"><FilterInput active={filters.dateTo.length > 0} data-testid={`${scope}-session-to`} onChange={update("dateTo")} type="date" value={filters.dateTo} /></FilterField>
    <SelectField label="Lớp" onChange={update("classId")} testId={`${scope}-session-class`} value={filters.classId}><option value="all">Tất cả</option>{classOptions.map(([id, item]) => <option key={id} value={id}>{item.code} – {item.name}</option>)}</SelectField>
    <SelectField label="Trạng thái" onChange={update("status")} testId={`${scope}-session-status`} value={filters.status}><option value="all">Tất cả</option><option value="scheduled">Đã lên lịch</option><option value="in_progress">Đang diễn ra</option><option value="completed">Đã hoàn thành</option><option value="cancelled">Đã hủy</option></SelectField>
    <SelectField label="Loại buổi" onChange={update("kind")} testId={`${scope}-session-kind`} value={filters.kind}><option value="all">Tất cả</option><option value="regular">Chính</option><option value="makeup">Bù</option><option value="additional">Bổ sung</option></SelectField>
    <SelectField label="Khóa" onChange={update("lock")} testId={`${scope}-session-lock`} value={filters.lock}><option value="all">Tất cả</option><option value="unlocked">Chưa khóa</option><option value="locked">Đã khóa</option></SelectField>
  </>;
}

function SelectField({ children, label, onChange, testId, value }: { children: ReactNode; label: string; onChange: (event: ChangeEvent<HTMLSelectElement>) => void; testId: string; value: string }) {
  return <FilterField label={label}><FilterSelect active={value !== "all"} data-testid={testId} onChange={onChange} value={value}>{children}</FilterSelect></FilterField>;
}

interface SessionRowContext {
  canLock: boolean;
  canMarkAttendance: boolean;
  canViewAttendance: boolean;
  canViewClasses: boolean;
  canViewResults: boolean;
  clock: SessionDirectoryClock;
  directoryQuery: string;
}

function SessionTable({ context, empty, footer, onSort, rows, sort, status }: { context: SessionRowContext; empty: ReactNode; footer: ReactNode; onSort: (key: SessionSortKey) => void; rows: SessionDirectoryItem[]; sort: SortState<SessionSortKey> | null; status: "empty" | "ready" }) {
  return <DataTableFrame
    body={rows.map((row) => <SessionTableRow context={context} key={row.id} row={row} />)}
    caption="Danh sách buổi học"
    className="sessions-directory-table"
    empty={empty}
    footer={footer}
    header={<tr>
      <SortableTableHeader className="w-[188px]" onSort={onSort} sort={sort} sortKey="date">Ngày · giờ</SortableTableHeader>
      <SortableTableHeader onSort={onSort} sort={sort} sortKey="class">Lớp</SortableTableHeader>
      <TableHeaderCell className="w-[80px]">Loại</TableHeaderCell>
      <TableHeaderCell className="w-[136px]">Hình thức · phòng</TableHeaderCell>
      {context.canViewAttendance ? <TableHeaderCell className="w-[96px]" numeric title="Học sinh trong danh sách đã được điểm danh có mặt hoặc vắng">Điểm danh</TableHeaderCell> : null}
      {context.canViewResults ? <TableHeaderCell className="w-[88px]" numeric title={context.canViewAttendance ? "Kết quả đã ghi / học sinh có mặt hoặc học bổ sung" : undefined}>Kết quả</TableHeaderCell> : null}
      <SortableTableHeader className="w-[224px]" onSort={onSort} sort={sort} sortKey="status">Trạng thái</SortableTableHeader>
      <TableHeaderCell className="relative w-[112px]" numeric><span className="sr-only">Thao tác</span></TableHeaderCell>
    </tr>}
    status={status}
    tableClassName="min-w-[1108px] table-fixed"
  />;
}

function getRowFacts(row: SessionDirectoryItem, context: SessionRowContext) {
  const { clock } = context;
  const readiness = getSessionLockReadiness(row, clock.queue);
  const overdue = getSessionOverdueCaption(row, clock.today, clock.nowTime);
  const reason = row.status === "cancelled" ? row.cancellationReason?.trim() || null : null;
  const action = getSessionRowAction(row, clock, { canLock: context.canLock, canMarkAttendance: context.canMarkAttendance });
  return {
    action,
    attendance: getSessionAttendanceCell(row, clock.queue),
    href: sessionHref(row.id, context.directoryQuery),
    needsAttention: needsSessionAttendance(row, clock),
    overdue,
    readiness,
    reason,
    result: getSessionResultCell(row, context.canViewAttendance),
  };
}

function SessionTableRow({ context, row }: { context: SessionRowContext; row: SessionDirectoryItem }) {
  const facts = getRowFacts(row, context);
  const isCancelled = row.status === "cancelled";
  const caption = formatSessionClassCaption(row);
  const classTitle = `${row.classCode} · ${row.className}`;
  const actionLabel = sessionRowActionLabels[facts.action];
  return <TableRow className={cn(facts.needsAttention && "bg-warning-bg/40", isCancelled && "text-text-muted")} tall={Boolean(facts.readiness || facts.overdue || facts.reason)}>
    <TableCell className="whitespace-nowrap tabular-nums">{formatSessionDateTime(row)}</TableCell>
    <TableCell>
      {/* The name keeps its width (truncating only past the cell); the caption gives way first. */}
      <div className="flex min-w-0 items-baseline gap-1.5">
        {context.canViewClasses && !isCancelled
          ? <Link className="flex max-w-full shrink-0 rounded-sm text-text-strong! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" href={`/classes/${row.classId}`}><span className="min-w-0 truncate font-semibold" title={classTitle}>{row.className}</span></Link>
          : <span className="max-w-full shrink-0 truncate font-semibold" title={classTitle}>{row.className}</span>}
        <span className="min-w-0 truncate text-caption tabular-nums text-text-muted" title={caption}>{caption}</span>
      </div>
    </TableCell>
    <TableCell className="text-secondary">{formatSessionKindShort(row.sessionKind)}</TableCell>
    <TableCell className="text-secondary"><span className="block truncate" title={formatSessionModeRoom(row)}>{formatSessionModeRoom(row)}</span></TableCell>
    {context.canViewAttendance ? <TableCell className="relative" numeric><CountCell cell={facts.attendance} /></TableCell> : null}
    {context.canViewResults ? <TableCell className="relative" numeric><CountCell cell={facts.result} /></TableCell> : null}
    <TableCell><SessionStateCell overdue={facts.overdue} readiness={facts.readiness} reason={facts.reason} row={row} /></TableCell>
    <TableCell numeric>
      <Link aria-label={`${actionLabel} buổi học ${formatDate(row.sessionDate)} lớp ${row.classCode}`} className="inline-flex h-8 items-center whitespace-nowrap rounded-md px-2 text-secondary font-semibold text-action-link! hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" href={facts.href}>{actionLabel}</Link>
    </TableCell>
  </TableRow>;
}

function SessionRecord({ context, row }: { context: SessionRowContext; row: SessionDirectoryItem }) {
  const facts = getRowFacts(row, context);
  const showAttendance = context.canViewAttendance && facts.attendance.kind !== "dash";
  const showResult = context.canViewResults && facts.result.kind !== "dash";
  const lock = <LockState row={row} />;
  const hasMetrics = row.status === "completed" || facts.overdue || facts.reason || showAttendance || showResult;
  return <RecordListItem
    ariaLabel={`Mở buổi học ${formatDate(row.sessionDate)} lớp ${row.classCode}`}
    badge={<SessionStatusBadge status={row.status} />}
    href={facts.href}
    meta={<>
      <span className="block truncate">{row.classCode} · {row.className} · {formatSessionClassCaption(row)}</span>
      <span className="block truncate">{formatSessionKindShort(row.sessionKind)} · {formatSessionModeRoom(row)}</span>
    </>}
    metrics={hasMetrics ? <>
      {lock}
      {facts.readiness ? <ReadinessBadge readiness={facts.readiness} /> : null}
      {facts.overdue ? <span className="font-medium text-warning">{facts.overdue}</span> : null}
      {facts.reason ? <span className="line-clamp-2 w-full text-text-muted">Lý do hủy: {facts.reason}</span> : null}
      {showAttendance ? <span>Điểm danh <strong className={cn("font-semibold tabular-nums", facts.attendance.kind === "ratio" && facts.attendance.incomplete && "text-warning")}>{formatSessionCountCell(facts.attendance)}</strong></span> : null}
      {showResult ? <span>Kết quả <strong className="font-semibold tabular-nums">{formatSessionCountCell(facts.result)}</strong></span> : null}
    </> : undefined}
    title={formatSessionDateTime(row)}
  />;
}

function SessionStateCell({ overdue, readiness, reason, row }: { overdue: string | null; readiness: SessionLockReadiness | null; reason: string | null; row: SessionDirectoryItem }) {
  return <div className="grid min-w-0 gap-0.5">
    <div className="flex flex-wrap items-center gap-1.5"><SessionStatusBadge status={row.status} /><LockState row={row} /></div>
    {readiness ? <div><ReadinessBadge readiness={readiness} /></div> : null}
    {overdue ? <span className="text-caption font-medium text-warning">{overdue}</span> : null}
    {reason ? <span className="block truncate text-caption text-text-muted" title={reason}>{reason}</span> : null}
  </div>;
}

function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const value = Object.hasOwn(sessionStatusMeta, status) ? sessionStatusMeta[status] : { label: `Trạng thái chưa hỗ trợ: ${status}`, tone: "neutral" as const };
  return <Badge tone={value.tone}>{value.label}</Badge>;
}

/** The lock flag stays its own element: "Đã khóa" badge, or "Chưa khóa" for a completed session. */
function LockState({ row }: { row: Pick<SessionDirectoryItem, "lockedAt" | "status"> }) {
  if (row.lockedAt) return <Badge icon={<Lock strokeWidth={2.2} />} tone="neutral">Đã khóa</Badge>;
  if (row.status !== "completed") return null;
  return <span className="text-caption text-text-muted">Chưa khóa</span>;
}

function ReadinessBadge({ readiness }: { readiness: SessionLockReadiness }) {
  const meta = getSessionLockReadinessLabel(readiness);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function CountCell({ cell }: { cell: SessionCountCell }) {
  if (cell.kind === "dash") {
    return cell.reason
      ? <span className="text-text-subtle" title={cell.reason}><span aria-hidden="true">—</span><span className="sr-only">{cell.reason}</span></span>
      : <span className="text-text-subtle">—</span>;
  }
  if (cell.kind === "ratio") return <span className={cell.incomplete ? "font-semibold text-warning" : undefined}>{cell.value}/{cell.total}</span>;
  if (cell.kind === "recorded") return <span>{cell.value} <span className="text-caption text-text-muted">đã ghi</span></span>;
  return <span>{cell.value}</span>;
}

function sessionHref(id: string, query: string) { return query ? `/sessions/${id}?${query}` : `/sessions/${id}`; }

const VI_SHORT_WEEKDAYS = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"] as const;
export function formatDate(value: string) {
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = VI_SHORT_WEEKDAYS[date.getUTCDay()];
  const formattedDay = String(day).padStart(2, "0");
  const formattedMonth = String(month).padStart(2, "0");
  return `${weekday}, ${formattedDay}/${formattedMonth}/${year}`;
}
