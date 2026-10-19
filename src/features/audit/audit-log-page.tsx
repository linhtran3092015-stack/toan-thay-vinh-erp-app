import Link from "next/link";

import {
  DataTableFrame,
  TableState,
} from "@/components/patterns/data-table-frame";
import {
  FilterBar,
  FilterField,
  FilterInput,
  FilterSelect,
} from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { Button, getButtonClassName } from "@/components/ui/button";
import {
  AUDIT_FILTER_CAPTION,
  AUDIT_FILTER_KEYS,
  AUDIT_OLDER_ROWS_NOTE,
  AUDIT_READ_ONLY_NOTE,
  countActiveAuditFilters,
  getAuditCountLine,
  getAuditSelectOptions,
  isAuditDateRangeInverted,
  type AuditSelectOption,
} from "@/features/audit/audit-log-models";
import {
  AUDIT_CARDS_SWITCH_CLASS,
  AUDIT_EMPTY_FRAME_CLASS,
  AUDIT_EMPTY_HEADER_ROW_CLASS,
  AUDIT_EMPTY_TABLE_CLASS,
  AUDIT_FILTER_TRACKS_CLASS,
  AUDIT_TABLE_CLASS,
  AUDIT_TABLE_SWITCH_CLASS,
  AuditLogTableHeader,
} from "@/features/audit/components/audit-log-cells";
import { AuditLogRecords } from "@/features/audit/components/audit-log-records";
import { AuditLogTableRows } from "@/features/audit/components/audit-log-table-rows";
import type { AuditLogReadModel } from "@/features/audit/read-models";
import { cn } from "@/lib/utils";

interface AuditLogPageProps {
  model: AuditLogReadModel;
  /** Target of the GET filter form and of "Xóa lọc"; the /dev/lists preview passes "/dev/lists". */
  formAction?: string;
  /**
   * Extra query params the form keeps as hidden inputs and the reset link
   * keeps in its URL (the preview's `view`/`role`/`state`). Never one of the
   * seven filter names.
   */
  hiddenParams?: Readonly<Record<string, string>>;
}

const LIST_LABEL = "Nhật ký hệ thống";

/*
 * Responsive switch without globals.css: the page root is a Tailwind container
 * (`@container`); the table/cards switch and the filter tracks are shared with
 * the loading skeleton (audit-log-cells). Below 880px the filter controls are
 * 44px tall. Class names are spelled out in full so the scanner sees them.
 */
const FILTER_BAR_CLASS = cn(
  AUDIT_FILTER_TRACKS_CLASS,
  "@max-[880px]:[&_input]:h-11 @max-[880px]:[&_select]:h-11",
);
const TOUCH_BUTTON_CLASS = "@max-[880px]:h-11";

/**
 * /audit (design 16a row "Nhật ký"): a read-only, append-only log. Header with
 * the exact filtered count and the rows shown, the existing GET filter form
 * (same seven param names, reset = a link), then a framed table (cards when
 * narrow) whose before/after JSON stays collapsed until asked for. No primary
 * action, no row actions, no paging (the read is the newest
 * AUDIT_LOG_ROW_LIMIT rows). No hooks: it renders as a server component on the
 * route and inside the client /dev/lists preview alike; only the table rows
 * (the "Xem / Ẩn" toggle) and each card's `<details>` body are client islands,
 * both rendering the JSON only once opened.
 */
export function AuditLogPage({
  formAction = "/audit",
  hiddenParams,
  model,
}: AuditLogPageProps) {
  const activeFilterCount = countActiveAuditFilters(model.filters);
  const isFiltered = activeFilterCount > 0;
  const shown = model.entries.length;
  const preserved = Object.entries(hiddenParams ?? {});
  const resetHref = preserved.length > 0
    ? `${formAction}?${new URLSearchParams(preserved).toString()}`
    : formAction;

  return (
    <div className="@container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="Nhật ký hệ thống">
        <p className="mt-1 text-secondary tabular-nums text-text-muted" id="audit-log-result-context">
          {getAuditCountLine(model.totalCount, shown, isFiltered)}
        </p>
        <p className="mt-0.5 text-caption text-text-muted">
          {AUDIT_READ_ONLY_NOTE}
          {model.totalCount > shown ? ` ${AUDIT_OLDER_ROWS_NOTE}` : null}
        </p>
      </PageHeader>

      <AuditFilterForm
        activeFilterCount={activeFilterCount}
        formAction={formAction}
        model={model}
        preserved={preserved}
        resetHref={resetHref}
      />

      <section
        aria-labelledby="audit-log-result-context"
        className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3"
      >
        {shown === 0 ? (
          // Rendered once at every width (no table/card switch, no record list); the
          // table geometry and header row only from the table's own 1042px up.
          <DataTableFrame
            body={null}
            caption={LIST_LABEL}
            className={AUDIT_EMPTY_FRAME_CLASS}
            empty={
              <TableState>
                <p className="text-body font-semibold text-text-strong">
                  {isFiltered ? "Không có nhật ký phù hợp" : "Chưa có nhật ký"}
                </p>
                <p className="max-w-xl text-secondary text-text-muted">
                  {isFiltered
                    ? "Thay đổi hoặc xóa bộ lọc để xem các thao tác khác."
                    : "Các thao tác được ghi nhận sẽ xuất hiện tại đây."}
                </p>
              </TableState>
            }
            header={<AuditLogTableHeader className={AUDIT_EMPTY_HEADER_ROW_CLASS} />}
            status="empty"
            tableClassName={AUDIT_EMPTY_TABLE_CLASS}
          />
        ) : (
          <>
            <DataTableFrame
              body={<AuditLogTableRows entries={model.entries} />}
              caption={LIST_LABEL}
              className={AUDIT_TABLE_SWITCH_CLASS}
              header={<AuditLogTableHeader />}
              tableClassName={AUDIT_TABLE_CLASS}
            />
            <AuditLogRecords
              className={AUDIT_CARDS_SWITCH_CLASS}
              entries={model.entries}
              label={LIST_LABEL}
            />
          </>
        )}
      </section>
    </div>
  );
}

function AuditFilterForm({
  activeFilterCount,
  formAction,
  model,
  preserved,
  resetHref,
}: {
  activeFilterCount: number;
  formAction: string;
  model: AuditLogReadModel;
  preserved: readonly (readonly [string, string])[];
  resetHref: string;
}) {
  const { filters } = model;
  const options = getAuditSelectOptions(model);
  const isInverted = isAuditDateRangeInverted(filters);

  return (
    // Keyed by the applied filters: "Xóa lọc" (next/link) and back/forward are soft navigations
    // that keep this page mounted, and React never re-applies a changed `defaultValue`, so
    // without a remount the selects would keep (and the next "Áp dụng" re-send) the old values.
    <form
      action={formAction}
      className="grid min-w-0 gap-2"
      key={JSON.stringify(AUDIT_FILTER_KEYS.map((key) => filters[key]))}
      method="get"
    >
      {preserved.map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}

      <FilterBar className={FILTER_BAR_CLASS} label="Bộ lọc nhật ký">
        <FilterField label="Từ ngày">
          <FilterInput
            active={filters.fromDate !== ""}
            defaultValue={filters.fromDate}
            name="fromDate"
            type="date"
          />
        </FilterField>
        <FilterField label="Đến ngày">
          <FilterInput
            active={filters.toDate !== ""}
            defaultValue={filters.toDate}
            name="toDate"
            type="date"
          />
        </FilterField>
        <AuditSelectField label="Module" name="module" options={options.modules} value={filters.module} />
        <AuditSelectField label="Hành động" name="action" options={options.actions} value={filters.action} />
        <AuditSelectField label="Người thực hiện" name="actorId" options={options.actors} value={filters.actorId} />
        <AuditSelectField
          label="Loại đối tượng"
          name="entityType"
          options={options.entityTypes}
          value={filters.entityType}
        />
        <FilterField label="Mã đối tượng">
          <FilterInput
            active={filters.entityId !== ""}
            autoComplete="off"
            defaultValue={filters.entityId}
            name="entityId"
            placeholder="UUID hoặc mã nghiệp vụ"
            type="text"
          />
        </FilterField>

        <div className="flex flex-wrap items-end gap-2">
          <Button className={TOUCH_BUTTON_CLASS} type="submit" variant="secondary">
            Áp dụng
          </Button>
          {activeFilterCount > 0 ? (
            <Link
              className={getButtonClassName({
                className: cn(TOUCH_BUTTON_CLASS, "text-action-primary! hover:text-action-primary-hover!"),
                variant: "ghost",
              })}
              href={resetHref}
            >
              Xóa lọc <span className="font-medium tabular-nums">({activeFilterCount})</span>
            </Link>
          ) : null}
        </div>
      </FilterBar>

      <p className="text-caption text-text-muted">{AUDIT_FILTER_CAPTION}</p>

      {isInverted ? (
        <p className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-secondary text-warning-ink">
          Từ ngày sau Đến ngày nên không có bản ghi nào khớp.
        </p>
      ) : null}
    </form>
  );
}

function AuditSelectField({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: readonly AuditSelectOption[];
  value: string;
}) {
  return (
    <FilterField label={label}>
      <FilterSelect active={value !== ""} defaultValue={value} name={name}>
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>
    </FilterField>
  );
}
