"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  FilterBar,
  FilterField,
  FilterInput,
  FilterSelect,
  FilterSheet,
  FilterTrigger,
} from "@/components/patterns/filter-bar";
import { QuickFilterChips, type QuickFilterChip } from "@/components/patterns/quick-filter-chips";

import { careKindLabels, careStatusLabels, type CareDashboard } from "../models";
import { CARE_UNASSIGNED_LABEL } from "../student-care-presentation";
import {
  applyCareChip,
  CARE_SEARCH_MAX_LENGTH,
  countCareActiveFilters,
  getCareActiveChip,
  getCareSearchParamValues,
  getCareTab,
  parseCareFilter,
  parseCareMonthInput,
  toCareRouteSearchParams,
  withCareQuery,
  type CareChip,
  type CareFilter,
} from "../student-care-url-state";

interface CareQueueFiltersProps {
  /** `YYYY-MM-01` the dashboard used; shown in the month field when the URL has none. */
  month: string;
  /** Matching rows on this tab, for the sheet's confirm button; `undefined` while unknown. */
  resultCount?: number;
  /** Dashboard summary for the chip counts; chips hide on the error state (`null`). */
  summary: CareDashboard["summary"] | null;
}

/** Search typing settles for this long before the URL (and the dashboard RPC) follows. */
export const CARE_SEARCH_DEBOUNCE_MS = 300;

/**
 * Queue filters (design 13a): quick chips on the "Công việc" tab, then the
 * URL-backed FilterBar (search, kind, coaching month, status) on a wide work
 * area and the same fields in a bottom sheet otherwise. Every change rewrites
 * only the page's own query keys and goes back to page 1.
 *
 * Search and month keep a local draft: the search reaches the URL 300ms after
 * typing stops (at once on Enter or with another filter change), so no
 * character is lost to a pending navigation and each keystroke is not a
 * dashboard read; the month reaches it only as a whole `YYYY-MM` (or empty).
 * A URL change from elsewhere (reset, tab, back/forward) replaces the draft.
 */
export function CareQueueFilters({ month, resultCount, summary }: CareQueueFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingQueryRef = useRef<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetTitleId = useId();
  const queryString = searchParams?.toString() ?? "";

  const pushedQueryRef = useRef<string | null>(null);

  useEffect(() => {
    pendingQueryRef.current = queryString;
  }, [queryString]);
  useEffect(() => () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  const raw = new URLSearchParams(queryString);
  const values = getCareSearchParamValues(toCareRouteSearchParams(raw));
  const tab = getCareTab(values.tab);
  const filter = parseCareFilter(values);
  // The URL keeps what was typed (a trailing space included); the loader trims it.
  const urlSearch = values.search ?? "";
  const urlMonth = (filter.month ?? month).slice(0, 7);
  const activeCount = countCareActiveFilters(filter, tab);

  // `sent`: search values this component put in the URL that have not landed
  // yet. When one lands the draft stays (the user may have typed on); any
  // other URL value is an outside change and replaces the draft.
  const [search, setSearch] = useState({ draft: urlSearch, sent: [] as string[], url: urlSearch });
  if (search.url !== urlSearch) {
    const own = search.sent.indexOf(urlSearch);
    setSearch(own === -1
      ? { draft: urlSearch, sent: [], url: urlSearch }
      : { draft: search.draft, sent: search.sent.slice(own + 1), url: urlSearch });
  }
  useEffect(() => {
    // Our own push landing is not an outside change; it is forgotten once it
    // lands, so Back to that same URL later still counts as one.
    if (queryString === pushedQueryRef.current) {
      pushedQueryRef.current = null;
      return;
    }
    // A URL change this component did not push (tab, reset link, back/forward)
    // drops a waiting search: sending it later would rebuild the old tab's URL.
    if (!searchTimerRef.current) return;
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = null;
    const landed = new URLSearchParams(queryString).get("search") ?? "";
    setSearch({ draft: landed, sent: [], url: landed });
  }, [queryString]);
  const [monthInput, setMonthInput] = useState({ draft: urlMonth, url: urlMonth });
  if (monthInput.url !== urlMonth) setMonthInput({ draft: urlMonth, url: urlMonth });

  const navigate = (next: Partial<CareFilter>) => {
    const base = pendingQueryRef.current ?? queryString;
    // The tab of the URL being edited, not of the render that scheduled this call (a debounced search).
    const baseTab = getCareTab(getCareSearchParamValues(toCareRouteSearchParams(base)).tab);
    const query = withCareQuery(base, { ...next, page: 1 }, baseTab);
    const sentSearch = new URLSearchParams(query).get("search") ?? "";
    if (sentSearch !== (new URLSearchParams(base).get("search") ?? "")) {
      setSearch((current) => ({ ...current, sent: [...current.sent, sentSearch] }));
    }
    pendingQueryRef.current = query;
    pushedQueryRef.current = query;
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };
  /** Cancels a waiting search push; returns the draft to send with the next change instead. */
  const takePendingSearch = (): { search?: string } | null => {
    if (!searchTimerRef.current) return null;
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = null;
    return { search: search.draft || undefined };
  };
  // Read pending edits back so two quick changes do not drop the first.
  const latest = (): Partial<CareFilter> & { search?: string } => {
    const pendingValues = getCareSearchParamValues(toCareRouteSearchParams(pendingQueryRef.current ?? queryString));
    return { ...parseCareFilter(pendingValues), search: pendingValues.search || undefined };
  };
  const update = (patch: Partial<CareFilter>) => navigate({ ...latest(), ...takePendingSearch(), ...patch });
  const reset = () => {
    takePendingSearch();
    setSearch((current) => ({ ...current, draft: "" }));
    navigate({});
  };
  const pushSearch = (value: string) => {
    takePendingSearch();
    navigate({ ...latest(), search: value || undefined });
  };
  const typeSearch = (value: string) => {
    setSearch((current) => ({ ...current, draft: value }));
    takePendingSearch();
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null;
      navigate({ ...latest(), search: value || undefined });
    }, CARE_SEARCH_DEBOUNCE_MS);
  };
  const typeMonth = (value: string) => {
    const next = parseCareMonthInput(value);
    // Clearing a month the URL does not hold changes nothing: the dashboard
    // keeps its default month, so the field shows it again instead of a blank.
    if (next === undefined && !latest().month) {
      setMonthInput({ draft: urlMonth, url: urlMonth });
      return;
    }
    setMonthInput((current) => ({ ...current, draft: value }));
    if (next !== null) update({ month: next });
  };

  const fields = (scope: "desktop" | "mobile") => (
    <>
      <FilterField label="Tìm học sinh">
        <FilterInput
          active={Boolean(filter.search)}
          autoComplete="off"
          data-testid={`${scope}-care-search`}
          maxLength={CARE_SEARCH_MAX_LENGTH}
          onChange={(event) => typeSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              pushSearch(event.currentTarget.value);
            }
          }}
          placeholder="Tên hoặc mã học sinh"
          type="search"
          value={search.draft}
        />
      </FilterField>
      {tab === "tasks" ? (
        <>
          <FilterField label="Loại công việc">
            <FilterSelect
              active={Boolean(filter.kind)}
              onChange={(event) => update({ kind: (event.target.value || undefined) as CareFilter["kind"] })}
              value={filter.kind ?? ""}
            >
              <option value="">Tất cả</option>
              {(Object.keys(careKindLabels) as (keyof typeof careKindLabels)[]).map((kind) => (
                <option key={kind} value={kind}>
                  {careKindLabels[kind]}
                </option>
              ))}
            </FilterSelect>
          </FilterField>
          <FilterField label="Tháng Coaching">
            <FilterInput
              active={Boolean(filter.month)}
              onChange={(event) => typeMonth(event.target.value)}
              placeholder="YYYY-MM"
              type="month"
              value={monthInput.draft}
            />
          </FilterField>
          <FilterField label="Trạng thái">
            <FilterSelect
              active={Boolean(filter.status)}
              onChange={(event) => update({ status: (event.target.value || undefined) as CareFilter["status"] })}
              value={filter.status ?? ""}
            >
              <option value="">Tất cả</option>
              <option value="unassigned">{CARE_UNASSIGNED_LABEL}</option>
              {(Object.keys(careStatusLabels) as (keyof typeof careStatusLabels)[]).map((status) => (
                <option key={status} value={status}>
                  {careStatusLabels[status]}
                </option>
              ))}
            </FilterSelect>
          </FilterField>
        </>
      ) : null}
    </>
  );

  const chips: QuickFilterChip<CareChip>[] | null = summary
    ? [
        { label: "Tất cả", value: "all" },
        { count: summary.open_alerts, label: careKindLabels.alert, value: "alert" },
        {
          count: summary.monthly_total,
          countLabel: `${summary.monthly_completed}/${summary.monthly_total}`,
          label: careKindLabels.monthly,
          value: "monthly",
        },
        { label: careKindLabels.followup, value: "followup" },
        { count: summary.unassigned, label: CARE_UNASSIGNED_LABEL, separatorBefore: true, value: "unassigned" },
        { count: summary.overdue, countTone: "danger", label: "Quá hạn", value: "overdue" },
        { label: "Của tôi", value: "mine" },
      ]
    : null;

  return (
    <div aria-busy={isPending || undefined} className="grid gap-3">
      {tab === "tasks" && chips ? (
        <QuickFilterChips
          chips={chips}
          // Counts are month-scoped totals from the dashboard summary and can lag
          // the list, so a zero count never blocks the filter.
          disableEmpty={false}
          label="Lọc nhanh công việc chăm sóc"
          onChange={(chip) => navigate(applyCareChip({ ...latest(), ...takePendingSearch() }, chip))}
          value={getCareActiveChip(filter)}
        />
      ) : null}
      {filter.student_id ? (
        <p className="text-secondary text-text-muted">
          Đang xem công việc của một học sinh.{" "}
          <button
            className="font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            onClick={() => update({ student_id: undefined })}
            type="button"
          >
            Xem tất cả học sinh
          </button>
        </p>
      ) : null}
      <div className="student-care-filter-trigger-row">
        <FilterTrigger activeCount={activeCount} onClick={() => setIsSheetOpen(true)} ref={triggerRef} />
      </div>
      <FilterBar
        activeCount={activeCount}
        className="student-care-filter-bar"
        fieldCount={tab === "tasks" ? 3 : 1}
        label="Bộ lọc chăm sóc học sinh"
        onReset={reset}
      >
        {fields("desktop")}
        {tab === "tasks" ? null : <span aria-hidden="true" />}
      </FilterBar>
      <FilterSheet
        activeCount={activeCount}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onReset={reset}
        resultLabel={resultCount === undefined ? "Xem kết quả" : `Xem ${resultCount} ${tab === "tasks" ? "công việc" : "học sinh"}`}
        returnFocusRef={triggerRef}
        subject={tab === "tasks" ? "công việc" : "học sinh"}
        titleId={sheetTitleId}
      >
        {fields("mobile")}
      </FilterSheet>
    </div>
  );
}
