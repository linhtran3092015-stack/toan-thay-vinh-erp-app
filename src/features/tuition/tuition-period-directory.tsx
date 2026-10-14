"use client";

/**
 * Tuition period list (design 07, frame 7a). Kept from the design: header with
 * "Mẫu thông báo" + the create primary, the period table (md+ container) or
 * record list (narrow), real status badge (Nháp / Đã khóa) with derived text
 * beside it, and "Mở". Dropped for lack of data: the placeholder "Chưa tạo"
 * future-period row, the KT-xxxx period codes, the "Chưa khớp" per-period
 * column (no link between a period and unmatched SePay transactions) and the
 * school-year context ("Năm học 2026–2027"). Drafts show lock readiness
 * instead of money, and each draft keeps its lock panel under the table.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow, TableState } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/field";
import { createTuitionPeriodAction, lockTuitionPeriodAction, type TuitionActionResult } from "@/features/tuition/actions";
import type { TuitionPeriodListItem, TuitionPreviewRow, TuitionSystemBlocker } from "@/features/tuition/data";
import { getTuitionPeriodProgress, type TuitionPeriodPaymentSummary } from "@/features/tuition/period-summary";
import { OverdueCaption } from "@/features/tuition/overdue-caption";
import { getTuitionLockReadiness, type TuitionLockReadiness } from "@/features/tuition/readiness";
import { getTuitionReadinessLabel, TuitionPeriodLockPanel } from "@/features/tuition/tuition-period-lock-panel";
import { formatIsoDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TuitionPeriodDirectoryProps {
  canLock: boolean;
  canManage: boolean;
  /** settings.receipts.manage: the "Mẫu thông báo" link. */
  canManageTemplates?: boolean;
  /** Default to the real server actions; the /dev preview passes inert stubs. */
  createAction?: typeof createTuitionPeriodAction;
  lockAction?: typeof lockTuitionPeriodAction;
  /** The period read failed: the error shows inside the table frame. */
  loadError?: boolean;
  periods: TuitionPeriodListItem[];
  previewByPeriod: Record<string, TuitionPreviewRow[]>;
  /** Locked periods' totals; `null` = that period's read failed. */
  summaries?: Record<string, TuitionPeriodPaymentSummary | null>;
  systemBlockersByPeriod: Record<string, TuitionSystemBlocker[]>;
}

const emptyRows: TuitionPreviewRow[] = [];
const emptyBlockers: TuitionSystemBlocker[] = [];

export function TuitionPeriodDirectory({
  canLock,
  canManage,
  canManageTemplates = false,
  createAction = createTuitionPeriodAction,
  lockAction = lockTuitionPeriodAction,
  loadError = false,
  periods,
  previewByPeriod,
  summaries = {},
  systemBlockersByPeriod,
}: TuitionPeriodDirectoryProps) {
  const [created, setCreated] = useState<TuitionActionResult | null>(null);
  // A locked draft leaves this list (revalidation) with its panel: keep the latest success here.
  const [locked, setLocked] = useState<{ periodId: string; periodName: string; result: TuitionActionResult } | null>(null);
  const drafts = periods.filter((period) => period.status === "draft");
  const readinessByPeriod = new Map(
    drafts.map((period) => [period.id, getTuitionLockReadiness(previewByPeriod[period.id] ?? emptyRows, systemBlockersByPeriod[period.id] ?? emptyBlockers)]),
  );
  const collecting = periods.filter((period) => {
    const summary = summaries[period.id];
    // Unknown requests may still be owed: the period counts as still collecting.
    return period.status === "locked" && summary?.paymentsVisible && (summary.remainingVnd > 0 || summary.counts.unknown > 0);
  }).length;
  const anyHidden = periods.some((period) => period.status === "locked" && summaries[period.id]?.paymentsVisible === false);
  const anyFailed = periods.some((period) => period.status === "locked" && summaries[period.id] === null);
  const status = loadError ? "error" : periods.length === 0 ? "empty" : "ready";

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader
        actions={
          canManageTemplates || canManage ? (
            <>
              {canManageTemplates ? (
                <Link className={getButtonClassName({ className: "max-md:h-11", variant: "secondary" })} href="/finance/tuition-periods/templates">
                  Mẫu thông báo
                </Link>
              ) : null}
              {canManage ? <CreatePeriodButton action={createAction} onCreated={setCreated} /> : null}
            </>
          ) : null
        }
        title="Kỳ thu học phí"
      >
        <p className="mt-1 text-secondary text-text-muted">
          {loadError
            ? "Tạo kỳ, kiểm tra học phí từng học viên, rồi khóa kỳ để tạo hàng loạt phiếu và yêu cầu thanh toán."
            : `${periods.length} kỳ thu · ${drafts.length} kỳ nháp · ${collecting} kỳ đang thu`}
        </p>
      </PageHeader>

      {created ? <ResultBanner title={created.message} tone={created.status === "success" ? "success" : "error"} /> : null}
      {anyFailed ? <ResultBanner description="Tải lại trang để thử lại." title="Chưa tải được số đã thu của một số kỳ." tone="warning" /> : null}

      <div className="@container grid min-w-0 gap-2">
        <div className="hidden @min-[880px]:block">
          <DataTableFrame
            body={periods.map((period) => (
              <TableRow key={period.id} tall>
                <TableCell>
                  <Link className="font-semibold text-text-strong! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" href={`/finance/tuition-periods/${period.id}`}>
                    {period.name}
                  </Link>
                  <span className="block text-caption tabular-nums text-text-muted">{formatRange(period)}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{period.dueOn ? formatIsoDate(period.dueOn) : <span className="text-text-muted">Chưa đặt</span>}</TableCell>
                <PeriodCells period={period} readiness={readinessByPeriod.get(period.id)} summary={summaries[period.id]} />
                <TableCell className="text-right">
                  <Link
                    aria-label={`Mở ${period.name}`}
                    className="text-secondary font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                    href={`/finance/tuition-periods/${period.id}`}
                  >
                    Mở
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            caption="Danh sách kỳ thu học phí"
            empty={<EmptyPeriods canManage={canManage} />}
            error={<TableState>Chưa tải được danh sách kỳ thu. Tải lại trang để thử lại.</TableState>}
            footer={
              status === "ready" ? (
                <>
                  <span>{periods.length} kỳ thu</span>
                  {anyHidden ? <span>Cần quyền xem thanh toán để thấy số đã thu và còn lại.</span> : null}
                </>
              ) : undefined
            }
            header={
              <tr>
                <TableHeaderCell>Kỳ thu</TableHeaderCell>
                <TableHeaderCell className="w-[120px]">Hạn thu</TableHeaderCell>
                <TableHeaderCell className="w-[90px]" numeric>Học sinh</TableHeaderCell>
                <TableHeaderCell className="w-[140px]" numeric>Phải thu</TableHeaderCell>
                <TableHeaderCell className="w-[140px]" numeric>Đã thu</TableHeaderCell>
                <TableHeaderCell className="w-[140px]" numeric>Còn lại</TableHeaderCell>
                <TableHeaderCell className="w-[190px]">Trạng thái</TableHeaderCell>
                <TableHeaderCell className="w-[72px]"><span className="sr-only">Mở kỳ thu</span></TableHeaderCell>
              </tr>
            }
            status={status}
            tableClassName="min-w-[860px]"
          />
        </div>

        <div className="grid @min-[880px]:hidden">
          {status === "ready" ? (
            <ResponsiveRecordList label="Danh sách kỳ thu học phí">
              {periods.map((period) => {
                const summary = summaries[period.id];
                const readiness = readinessByPeriod.get(period.id);
                return (
                  <RecordListItem
                    ariaLabel={`Mở ${period.name}`}
                    badge={<PeriodStatus period={period} readiness={readiness} summary={summary} />}
                    href={`/finance/tuition-periods/${period.id}`}
                    key={period.id}
                    meta={`${formatRange(period)}${period.dueOn ? ` · Hạn ${formatIsoDate(period.dueOn)}` : ""}`}
                    metrics={<PeriodMetrics period={period} readiness={readiness} summary={summary} />}
                    title={period.name}
                  />
                );
              })}
            </ResponsiveRecordList>
          ) : (
            <div className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
              {status === "error" ? <TableState>Chưa tải được danh sách kỳ thu. Tải lại trang để thử lại.</TableState> : <EmptyPeriods canManage={canManage} />}
            </div>
          )}
        </div>
      </div>

      {/* Stays mounted while a lock result shows, even once no draft remains. */}
      {drafts.length > 0 || locked ? (
        <section aria-label="Khóa kỳ nháp" className="grid min-w-0 gap-3">
          {locked ? (
            <ResultBanner
              action={
                <Link
                  className="inline-flex min-h-11 items-center font-semibold text-action-link! md:min-h-0"
                  href={`/finance/tuition-periods/${locked.periodId}`}
                >
                  Mở kỳ thu
                </Link>
              }
              description={`${locked.periodName} đã chuyển sang Đã khóa.`}
              title={locked.result.message}
              tone="success"
            />
          ) : null}
          {drafts.map((period) => (
            <TuitionPeriodLockPanel
              canLock={canLock}
              key={period.id}
              lockAction={lockAction}
              onLocked={(result) => setLocked({ periodId: period.id, periodName: period.name, result })}
              period={period}
              preview={previewByPeriod[period.id] ?? emptyRows}
              reviewHref={`/finance/tuition-periods/${period.id}`}
              systemBlockers={systemBlockersByPeriod[period.id] ?? emptyBlockers}
              variant="secondary"
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function formatRange(period: TuitionPeriodListItem): string {
  return `${formatIsoDate(period.startsOn)} – ${formatIsoDate(period.endsOn)}`;
}

function EmptyPeriods({ canManage }: { canManage: boolean }) {
  return (
    <TableState>
      <p className="text-body font-semibold text-text-strong">Chưa có kỳ thu học phí.</p>
      <p className="text-secondary text-text-muted">
        {canManage ? "Tạo kỳ đầu tiên bằng nút “Tạo kỳ thu”." : "Người có quyền quản lý kỳ thu sẽ tạo kỳ mới."}
      </p>
    </TableState>
  );
}

function Dash({ label }: { label: string }) {
  return (
    <span className="text-text-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function PeriodCells({
  period,
  readiness,
  summary,
}: {
  period: TuitionPeriodListItem;
  readiness: TuitionLockReadiness | undefined;
  summary: TuitionPeriodPaymentSummary | null | undefined;
}) {
  if (period.status === "draft") {
    return (
      <>
        <TableCell numeric>
          {readiness?.previewUnavailable ? (
            <Dash label="Chưa tải được" />
          ) : readiness && readiness.sessionCount > 0 ? (
            readiness.studentCount
          ) : (
            <Dash label="Chưa có học sinh" />
          )}
        </TableCell>
        <TableCell numeric><Dash label="Chưa khóa kỳ" /></TableCell>
        <TableCell numeric><Dash label="Chưa khóa kỳ" /></TableCell>
        <TableCell numeric><Dash label="Chưa khóa kỳ" /></TableCell>
        <TableCell><PeriodStatus period={period} readiness={readiness} summary={summary} /></TableCell>
      </>
    );
  }

  if (!summary) {
    return (
      <>
        {[0, 1, 2, 3].map((index) => (
          <TableCell key={index} numeric><Dash label="Chưa tải được" /></TableCell>
        ))}
        <TableCell><PeriodStatus period={period} readiness={readiness} summary={summary} /></TableCell>
      </>
    );
  }

  // Past the due date with money still owed (summary.isPastDue uses the server's business date).
  const overdue = summary.isPastDue && summary.remainingVnd > 0;

  return (
    <>
      <TableCell numeric>{summary.studentCount}</TableCell>
      <TableCell numeric>{formatVnd(summary.payableVnd)}</TableCell>
      <TableCell className="text-success" numeric>{summary.paymentsVisible ? formatVnd(summary.collectedVnd) : <Dash label="Cần quyền xem thanh toán" />}</TableCell>
      <TableCell className={cn("font-semibold", overdue ? "text-danger" : "text-text-strong")} numeric>
        {summary.paymentsVisible ? formatVnd(summary.remainingVnd) : <Dash label="Cần quyền xem thanh toán" />}
        {overdue && summary.paymentsVisible ? <OverdueCaption /> : null}
      </TableCell>
      <TableCell><PeriodStatus period={period} readiness={readiness} summary={summary} /></TableCell>
    </>
  );
}

/** Real status badge (Nháp / Đã khóa) with the derived state beside it, always in words. */
function PeriodStatus({
  period,
  readiness,
  summary,
}: {
  period: TuitionPeriodListItem;
  readiness: TuitionLockReadiness | undefined;
  summary: TuitionPeriodPaymentSummary | null | undefined;
}) {
  if (period.status === "draft") {
    const derived = readiness ? getTuitionReadinessLabel(readiness) : null;
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">Nháp</Badge>
        {derived ? <span className={cn("text-caption font-medium", derived.tone === "success" ? "text-success" : "text-warning")}>{derived.label}</span> : null}
      </span>
    );
  }

  const progress = summary ? getTuitionPeriodProgress(summary) : null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone="info">Đã khóa</Badge>
      {!summary ? <span className="text-caption text-text-muted">Chưa tải được số thu</span> : null}
      {progress?.kind === "complete" ? <Badge tone="success">{progress.label}</Badge> : null}
      {progress?.kind === "inactive" ? <Badge tone="neutral">{progress.label}</Badge> : null}
      {progress?.kind === "unknown" ? <Badge tone="neutral">{progress.label}</Badge> : null}
      {progress?.kind === "overdue" ? <Badge tone="warning">{progress.label}</Badge> : null}
      {progress?.kind === "collecting" ? (
        <span className="inline-flex items-center gap-1.5 text-caption text-text-muted">
          {progress.label}
          <span aria-hidden="true" className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-sunken">
            <span className="block h-full rounded-full bg-success" style={{ width: `${progress.percent}%` }} />
          </span>
        </span>
      ) : null}
    </span>
  );
}

function PeriodMetrics({
  period,
  readiness,
  summary,
}: {
  period: TuitionPeriodListItem;
  readiness: TuitionLockReadiness | undefined;
  summary: TuitionPeriodPaymentSummary | null | undefined;
}) {
  if (period.status === "draft") {
    if (readiness?.previewUnavailable) return <span>Chưa tải được học sinh</span>;
    return <span>{readiness && readiness.sessionCount > 0 ? `${readiness.studentCount} học sinh dự kiến` : "Chưa có học sinh tính phí"}</span>;
  }
  if (!summary) return <span className="text-text-muted">Chưa tải được số thu</span>;

  const overdue = summary.isPastDue && summary.remainingVnd > 0;

  return (
    <>
      <span>{summary.studentCount} học sinh</span>
      <span>
        Phải thu <strong className="tabular-nums text-text-strong">{formatVnd(summary.payableVnd)}</strong>
      </span>
      {summary.paymentsVisible ? (
        <>
          <span>
            Đã thu <strong className="tabular-nums text-success">{formatVnd(summary.collectedVnd)}</strong>
          </span>
          <span>
            Còn lại <strong className={cn("tabular-nums", overdue ? "text-danger" : "text-text-strong")}>{formatVnd(summary.remainingVnd)}</strong>
            {overdue ? <span className="font-medium text-danger"> · quá hạn</span> : null}
          </span>
        </>
      ) : null}
    </>
  );
}

/** Primary "Tạo kỳ thu": the existing create form and action, in a dialog. */
function CreatePeriodButton({ action, onCreated }: { action: typeof createTuitionPeriodAction; onCreated: (result: TuitionActionResult) => void }) {
  const titleId = useId();
  const descriptionId = useId();
  const nameId = useId();
  const startsId = useId();
  const endsId = useId();
  const dueId = useId();
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close(): void {
    if (isPending) return;
    setIsOpen(false);
    setError(null);
  }

  function createPeriod(formData: FormData): void {
    setError(null);
    startTransition(async () => {
      let result: TuitionActionResult;
      try {
        result = await action({
          dueOn: String(formData.get("dueOn") || ""),
          endsOn: String(formData.get("endsOn") || ""),
          name: String(formData.get("name") || ""),
          startsOn: String(formData.get("startsOn") || ""),
        });
      } catch {
        // The request may have reached the server: never claim it was not created.
        result = { message: "Không rõ kỳ thu đã được tạo chưa; tải lại trang để kiểm tra trước khi thử lại.", status: "error" };
        router.refresh();
      }
      if (result.status === "success") {
        setIsOpen(false);
        onCreated(result);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <>
      <Button className="max-md:h-11" onClick={() => setIsOpen(true)} ref={triggerRef}>
        Tạo kỳ thu
      </Button>
      <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-lg" isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
        {/* onSubmit, not a function `action`: React 19 resets uncontrolled fields after an action, which would wipe the input on an error. */}
        <form
          aria-label="Tạo kỳ thu học phí"
          className="grid gap-4 p-4 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            createPeriod(new FormData(event.currentTarget));
          }}
        >
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>Tạo kỳ thu học phí</h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              Kỳ mới ở trạng thái nháp: chưa phát sinh khoản phải thu cho đến khi khóa kỳ.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={nameId}>Tên kỳ</Label>
            <Input id={nameId} name="name" placeholder="Học phí tháng 08/2026" required />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={startsId}>Từ ngày</Label>
              <Input id={startsId} name="startsOn" required type="date" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={endsId}>Đến ngày</Label>
              <Input id={endsId} name="endsOn" required type="date" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={dueId}>Hạn thanh toán (tuỳ chọn)</Label>
            <Input id={dueId} name="dueOn" type="date" />
          </div>
          {error ? <ResultBanner title={error} tone="error" /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button className="max-md:h-11" disabled={isPending} onClick={close} variant="ghost">Hủy</Button>
            <Button className="max-md:h-11" isLoading={isPending} type="submit">Tạo kỳ nháp</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
