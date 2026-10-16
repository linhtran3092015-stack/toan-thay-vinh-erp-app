/**
 * Screens around FeeNoticeA5 (design 15b): the bulk print tab
 * (`/finance/tuition-periods/print`) and the single notice page
 * (`/finance/tuition-periods/[periodId]/items/[itemId]/notice`). Props only,
 * no hooks and no reads, so the routes stay thin and `/dev/fee-notices` can
 * render the same screens from fixtures with inert print/reissue stand-ins.
 *
 * Everything around the sheets is `print:hidden`; the shell chrome hides
 * itself for print, so only the A5 sheets reach paper. Wrappers turn into
 * plain blocks for print: named pages and forced page breaks only apply in
 * block flow, not inside grid or flex containers.
 */
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import type { reissueTuitionItemAction } from "@/features/tuition/actions";
import { FeeNoticeA5 } from "@/features/tuition/fee-notice-a5";
import { getFeeNoticeEditionBadge, getFeeNoticeKindLabel, type FeeNoticeModel } from "@/features/tuition/fee-notice-model";
import { TuitionPrintButton } from "@/features/tuition/print-button";
import { TuitionReissueForm } from "@/features/tuition/reissue-form";

const PERIODS_HREF = "/finance/tuition-periods";

function periodHref(periodId: string): string {
  return `${PERIODS_HREF}/${periodId}`;
}

function noticeHref(periodId: string, itemId: string): string {
  return `${periodHref(periodId)}/items/${itemId}/notice`;
}

/** Inline text link inside a banner: 44px touch target below md, focus ring like the controls. */
const BANNER_LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-sm font-semibold text-action-link! underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-0";

function BackLink({ href }: { href: string }) {
  return (
    <Link className={getButtonClassName({ className: "max-md:h-11", size: "sm", variant: "ghost" })} href={href}>
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      <span>Quay lại kỳ thu</span>
    </Link>
  );
}

export interface FeeNoticePrintScreenProps {
  /** Current notices to print, already sorted (sortFeeNoticesForPrint). */
  notices: readonly FeeNoticeModel[];
  /** Superseded notices left out because their current replacement is already in the batch. */
  skippedCount: number;
  /** Superseded notices swapped for their current replacement, which was read and is in `notices`. */
  replacedCount?: number;
  /** Requested ids that were not found or are not readable. */
  missingCount: number;
  /** Superseded notices whose current replacement could not be read (or was replaced again meanwhile), one per chain. */
  unresolvedCount?: number;
  /** The period of the requested notices, for the back link when no notice is left to print. */
  periodId?: string;
  onPrint?: () => void;
}

/** Bulk print tab: a screen-only toolbar, then one A5 sheet per page. */
export function FeeNoticePrintScreen({ missingCount, notices, onPrint, periodId, replacedCount = 0, skippedCount, unresolvedCount = 0 }: FeeNoticePrintScreenProps) {
  const count = notices.length;
  const nothingRequested = count === 0 && skippedCount === 0 && missingCount === 0 && unresolvedCount === 0;
  const backPeriodId = notices[0]?.periodId ?? periodId;

  return (
    <div className="grid gap-4 print:block">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)] print:hidden">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <BackLink href={backPeriodId ? periodHref(backPeriodId) : PERIODS_HREF} />
          <div className="min-w-0">
            <h1 className="text-section-title font-semibold text-text-strong">In Phiếu học phí</h1>
            {count > 0 ? <p className="text-secondary tabular-nums text-text-muted">{count} phiếu · mỗi phiếu một trang A5</p> : null}
          </div>
        </div>
        {count > 0 ? (
          <TuitionPrintButton anywayLabel={`Vẫn in ${count} phiếu`} onPrint={onPrint} variant="primary">
            In {count} phiếu
          </TuitionPrintButton>
        ) : null}
      </div>

      {skippedCount > 0 ? (
        <ResultBanner className="print:hidden" title={`Bỏ qua ${skippedCount} phiếu đã được thay thế (in bản thay thế hiện hành).`} tone="info" />
      ) : null}
      {replacedCount > 0 ? (
        <ResultBanner className="print:hidden" title={`Đã thay ${replacedCount} phiếu cũ bằng bản thay thế hiện hành.`} tone="info" />
      ) : null}
      {missingCount > 0 ? (
        <ResultBanner
          className="print:hidden"
          description="Phiếu không tồn tại hoặc tài khoản không có quyền xem."
          title={`Không tìm thấy ${missingCount} phiếu.`}
          tone="warning"
        />
      ) : null}
      {unresolvedCount > 0 ? (
        <ResultBanner
          className="print:hidden"
          title={`${unresolvedCount} phiếu đã được thay thế nhưng chưa đọc được bản hiện hành; tải lại trang kỳ thu rồi in lại.`}
          tone="warning"
        />
      ) : null}

      {count === 0 ? (
        <div className="print:hidden">
          <EmptyState
            description="Chọn phiếu trong mục “In phiếu học phí” của trang kỳ thu, rồi bấm “In đã chọn / cả khối”."
            title={nothingRequested ? "Chưa chọn phiếu nào để in." : "Không còn phiếu nào để in."}
          />
        </div>
      ) : (
        <section aria-label="Phiếu học phí cần in" className="grid justify-items-center gap-6 print:block">
          {notices.map((notice) => (
            <FeeNoticeA5 key={notice.itemId} model={notice} />
          ))}
        </section>
      )}
    </div>
  );
}

export interface FeeNoticeDetailScreenProps {
  notice: FeeNoticeModel;
  /**
   * `tuition_periods.adjust`. The reissue form stays mounted for adjusters
   * whether or not the notice is replaced, so a reissue's result survives the
   * re-render that marks this notice as replaced.
   */
  canAdjust?: boolean;
  onPrint?: () => void;
  reissueAction?: typeof reissueTuitionItemAction;
}

/** Single notice: staff header (screen only), the A5 sheet, then the reissue form. */
export function FeeNoticeDetailScreen({ canAdjust = false, notice, onPrint, reissueAction }: FeeNoticeDetailScreenProps) {
  const edition = getFeeNoticeEditionBadge(notice.edition);
  const currentHref = notice.edition.currentItemId ? noticeHref(notice.periodId, notice.edition.currentItemId) : null;

  return (
    <div className="grid w-full max-w-[1100px] gap-5 print:block print:max-w-none">
      <div className="grid gap-3 print:hidden">
        <div>
          <BackLink href={periodHref(notice.periodId)} />
        </div>
        <PageHeader
          actions={
            <TuitionPrintButton anywayLabel="Vẫn in phiếu" onPrint={onPrint}>
              In phiếu
            </TuitionPrintButton>
          }
          context={<Badge tone={edition.tone}>{edition.label}</Badge>}
          title={`Phiếu học phí · ${notice.student.fullName}`}
        >
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-secondary">
            <div className="flex gap-1.5">
              <dt className="text-text-muted">Nguồn học viên</dt>
              <dd className="font-medium text-text-strong">{notice.sourceName ?? "—"}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-text-muted">Mã yêu cầu</dt>
              <dd className="font-medium tabular-nums text-text-strong">{notice.requestCode ?? "—"}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-text-muted">Loại phiếu</dt>
              <dd className="font-medium text-text-strong">{getFeeNoticeKindLabel(notice)}</dd>
            </div>
          </dl>
        </PageHeader>
        {notice.edition.superseded ? (
          <ResultBanner
            action={
              currentHref ? (
                <Link className={BANNER_LINK_CLASS} href={currentHref}>
                  Mở bản thay thế hiện hành
                </Link>
              ) : undefined
            }
            description="Phụ huynh thanh toán theo bản thay thế hiện hành; phiếu này không in mã QR."
            title="Phiếu này đã được thay thế."
            tone="info"
          />
        ) : null}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[520px_minmax(0,1fr)] print:block">
        {/* Own wrapper: the sheet is its parent's last child, so no page break follows it. */}
        <div className="min-w-0">
          <FeeNoticeA5 model={notice} />
        </div>
        {/* Same position whether or not the notice is replaced: the form keeps its result. */}
        {canAdjust ? (
          <div className="min-w-0 print:hidden">
            <TuitionReissueForm
              amountVnd={notice.payableAmountVnd}
              itemId={notice.itemId}
              reissueAction={reissueAction}
              replaced={notice.edition.superseded}
              replacementHref={currentHref}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
