"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";

import { GuardedActionPanel, type GuardedCondition } from "@/components/patterns/guarded-action-panel";
import { PageHeader } from "@/components/patterns/page-header";
import { Stepper, type StepperStep, type StepperStepState } from "@/components/patterns/stepper";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { formatImportTimestamp } from "@/features/imports/components/import-labels";
import { ImportReviewTable, type ImportReviewColumn } from "@/features/imports/components/import-review-table";
import { ImportSummaryStrip, type ImportSummaryCell } from "@/features/imports/components/import-summary-strip";
import {
  approveSessionBalanceImportBatchAction,
  excludeSessionBalanceImportRowAction,
  postSessionBalanceImportBatchAction,
  reconcileSessionBalanceImportBatchAction,
} from "@/features/imports/session-balances/actions";
import type { SessionBalanceBatchDetailActions } from "@/features/imports/session-balances/session-balance-import-action-overrides";
import {
  formatSessionBalance,
  formatSignedSessions,
  getSessionBalanceBatchStatus,
  getSessionBalanceRowIssue,
  getSessionBalanceRowSeverity,
} from "@/features/imports/session-balances/session-balance-import-labels";
import type {
  SessionBalanceImportBatchDetail,
  SessionBalanceImportBatchStatus,
  SessionBalanceImportRowRecord,
} from "@/features/imports/session-balances/types";
import { formatIsoDate } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";

/** Typed confirmation of the post step; validated by the server schema (`postSessionBalanceImportBatchInputSchema`), frozen. */
export const SESSION_BALANCE_POST_PHRASE = "GHI SO DU";

const UNKNOWN_RESULT = "Không rõ kết quả. Mở lại trang lô để kiểm tra trước khi thử lại.";

/** Prefilled exclusion reasons of a review row (kept as they were). */
const EXCLUDE_REASON_FRACTIONAL = "Số dư nguồn có phần lẻ; sổ buổi hiện chỉ hỗ trợ số nguyên.";
const EXCLUDE_REASON_ENROLLMENT = "Chưa có enrollment đang active.";

export interface SessionBalanceBatchDetailPageProps {
  /** imports.session_balances.approve: approve and post. */
  canApprove: boolean;
  /**
   * imports.session_balances: exclude review rows and reconcile. Defaults to
   * true; without it the reconcile panel explains who does this step.
   */
  canReconcile?: boolean;
  currentUserId: string | null;
  detail: SessionBalanceImportBatchDetail;
  /** Replaces the real server actions (the /dev preview passes inert stubs). */
  actions?: SessionBalanceBatchDetailActions;
  /** Back link to the batch list; previews keep it under /dev. */
  listHref?: string;
  /** The session ledger, linked once the batch is posted. */
  ledgerHref?: string;
}

const STAGES = ["Tạo lô", "Đối soát", "Phê duyệt", "Ghi sổ"] as const;

/** How many stages are finished for each batch status ("Tạo lô" is always done on this page). */
const DONE_STAGES: Readonly<Partial<Record<SessionBalanceImportBatchStatus, number>>> = {
  approved: 3,
  awaiting_approval: 2,
  awaiting_reconciliation: 1,
  posted: 4,
};

/** Stepper "Tạo lô · Đối soát · Phê duyệt · Ghi sổ" from the batch status; an unknown or rejected batch stops after "Tạo lô". */
export function getSessionBalanceBatchSteps(status: string): StepperStep[] {
  const done = Object.hasOwn(DONE_STAGES, status) ? (DONE_STAGES[status as SessionBalanceImportBatchStatus] ?? 1) : 1;
  const hasCurrent = Object.hasOwn(DONE_STAGES, status) && done < STAGES.length;
  return STAGES.map((title, index) => {
    const state: StepperStepState = index < done ? "done" : index === done && hasCurrent ? "current" : "upcoming";
    return { state, title };
  });
}

function getPersonName(detail: SessionBalanceImportBatchDetail, userId: string | null): string {
  if (!userId) return "Hệ thống";
  const profile = Object.hasOwn(detail.profiles, userId) ? detail.profiles[userId] : undefined;
  return profile?.full_name?.trim() || profile?.email?.trim() || "Tài khoản không rõ tên";
}

/**
 * /imports/session-balances/[batchId] (design 17c + HANDOFF §5): the batch's
 * header and status, a Stepper "Tạo lô · Đối soát · Phê duyệt · Ghi sổ" from
 * the status, the batch facts, the row counts, then ONE guarded panel for the
 * current stage (reconcile, approve, post) or the posted callout, and the
 * rows (one rendering) with the server exclusion of review rows while the
 * batch awaits reconciliation. The screen keeps the four-eyes rule: the
 * creator cannot approve their own batch here.
 */
export function SessionBalanceBatchDetailPage({
  actions,
  canApprove,
  canReconcile = true,
  currentUserId,
  detail,
  ledgerHref = "/finance/session-ledger",
  listHref = "/imports/session-balances",
}: SessionBalanceBatchDetailPageProps) {
  const router = useRouter();
  const excludeRow = actions?.excludeSessionBalanceImportRow ?? excludeSessionBalanceImportRowAction;
  const reconcileBatch = actions?.reconcileSessionBalanceImportBatch ?? reconcileSessionBalanceImportBatchAction;
  const approveBatch = actions?.approveSessionBalanceImportBatch ?? approveSessionBalanceImportBatchAction;
  const postBatch = actions?.postSessionBalanceImportBatch ?? postSessionBalanceImportBatchAction;
  const { batch, rows } = detail;
  const ids = {
    confirm: useId(),
    phrase: useId(),
    reconcileReason: useId(),
    rowsHeading: useId(),
    title: useId(),
  };

  const [reconcileReason, setReconcileReason] = useState("");
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [postConfirmedCheck, setPostConfirmedCheck] = useState(false);
  const [postConfirmationText, setPostConfirmationText] = useState("");
  const [postError, setPostError] = useState<string | null>(null);
  const [activeExcludeRowId, setActiveExcludeRowId] = useState<string | null>(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [excludeError, setExcludeError] = useState<string | null>(null);

  const [isReconciling, startReconcileTransition] = useTransition();
  const [isApproving, startApproveTransition] = useTransition();
  const [isPosting, startPostTransition] = useTransition();
  const [isExcluding, startExcludeTransition] = useTransition();

  const isCreator = currentUserId === batch.created_by;
  const remainingReviewCount = batch.review_count ?? 0;
  const remainingInvalidCount = batch.invalid_count ?? 0;
  const validCount = batch.valid_count ?? 0;
  const postedCount = batch.posted_count ?? 0;
  const status = getSessionBalanceBatchStatus(batch.status);
  const canExcludeRows = batch.status === "awaiting_reconciliation" && canReconcile;
  const totalDeltaSessions = rows
    .filter((row) => row.validation_status === "valid" || row.validation_status === "posted")
    .reduce((sum, row) => sum + (row.delta_sessions ?? 0), 0);

  /** Runs a write; a lost answer is reported as unknown and the page reloads to show the truth. */
  function runWrite<T>(
    start: (callback: () => Promise<void>) => void,
    setError: (message: string | null) => void,
    write: () => Promise<{ ok: true; data: T } | { ok: false; message: string }>,
    onDone?: () => void,
  ): void {
    setError(null);
    start(async () => {
      let result: { ok: true; data: T } | { ok: false; message: string };
      try {
        result = await write();
      } catch {
        setError(UNKNOWN_RESULT);
        router.refresh();
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  function handleExcludeRow(rowId: string): void {
    if (!excludeReason.trim()) return;
    runWrite(startExcludeTransition, setExcludeError, () => excludeRow({ excludedReason: excludeReason.trim(), rowId }), () => {
      setActiveExcludeRowId(null);
      setExcludeReason("");
    });
  }

  function handleReconcile(): void {
    if (!reconcileReason.trim()) return;
    runWrite(startReconcileTransition, setReconcileError, () => reconcileBatch({ batchId: batch.id, reason: reconcileReason.trim() }));
  }

  function handleApprove(): void {
    runWrite(startApproveTransition, setApproveError, () => approveBatch({ batchId: batch.id }));
  }

  function handlePost(): void {
    if (!postConfirmedCheck || postConfirmationText.trim() !== SESSION_BALANCE_POST_PHRASE) return;
    runWrite(startPostTransition, setPostError, () =>
      postBatch({ batchId: batch.id, confirmationText: postConfirmationText.trim(), confirmedCheck: postConfirmedCheck }),
    );
  }

  function openExcludeEditor(row: SessionBalanceImportRowRecord): void {
    setExcludeError(null);
    setActiveExcludeRowId(row.id);
    setExcludeReason(row.validation_code === "BALANCE_HAS_FRACTIONAL_PART" ? EXCLUDE_REASON_FRACTIONAL : EXCLUDE_REASON_ENROLLMENT);
  }

  const summaryCells: ImportSummaryCell[] = [
    { label: "Tổng dòng", value: batch.row_count ?? 0 },
    { label: "Hợp lệ", tone: "success", value: validCount },
    { label: "Cần xem lại", tone: "warning", value: remainingReviewCount },
    { label: "Không hợp lệ", tone: "danger", value: remainingInvalidCount },
    { label: "Không thay đổi", tone: "muted", value: batch.no_change_count ?? 0 },
    { label: "Đã loại", tone: "muted", value: batch.excluded_count ?? 0 },
  ];
  if (batch.status === "posted" || postedCount > 0) summaryCells.push({ label: "Đã ghi sổ", tone: "success", value: postedCount });

  const columns: ImportReviewColumn<SessionBalanceImportRowRecord>[] = [
    {
      align: "right",
      header: "Dòng",
      hideInCard: true,
      key: "row",
      render: (row) => <span className="text-text-muted">{row.source_row_number}</span>,
      width: "64px",
    },
    {
      header: "Mã học viên",
      hideInCard: true,
      key: "code",
      render: (row) => <span className="whitespace-nowrap font-semibold text-text-strong">{row.student_public_code}</span>,
    },
    { header: "Họ tên nguồn", key: "name", render: (row) => row.source_student_name ?? "—" },
    { align: "right", header: "Số dư nguồn", key: "balance", render: (row) => formatSessionBalance(row.source_balance) },
    { align: "right", header: "Số buổi ghi", key: "delta", render: (row) => formatSignedSessions(row.delta_sessions) },
    { align: "right", header: "Hiện tại", key: "before", render: (row) => formatSessionBalance(row.current_balance_before) },
    { align: "right", header: "Dự kiến sau", key: "after", render: (row) => formatSessionBalance(row.expected_balance_after) },
  ];
  if (canExcludeRows) {
    columns.push({
      header: "Xử lý",
      key: "action",
      render: (row) => (
        <ExcludeCell
          error={activeExcludeRowId === row.id ? excludeError : null}
          isEditing={activeExcludeRowId === row.id}
          isExcluding={isExcluding}
          onCancel={() => {
            setActiveExcludeRowId(null);
            setExcludeReason("");
            setExcludeError(null);
          }}
          onConfirm={() => handleExcludeRow(row.id)}
          onOpen={() => openExcludeEditor(row)}
          onReasonChange={setExcludeReason}
          reason={excludeReason}
          row={row}
        />
      ),
      width: "240px",
    });
  }

  let panel: ReactNode = null;

  if (batch.status === "awaiting_reconciliation") {
    const reconcileConditions: GuardedCondition[] = [
      remainingInvalidCount > 0
        ? { label: `Còn ${formatNumber(remainingInvalidCount)} dòng không hợp lệ: lô này không đối soát được. Sửa file Excel rồi tạo lô mới.`, state: "unmet" }
        : { label: "Không còn dòng không hợp lệ", state: "met" },
      remainingReviewCount > 0
        ? { label: `Còn ${formatNumber(remainingReviewCount)} dòng cần xem lại: bấm “Loại khỏi lô” ở bảng dòng bên dưới.`, state: "unmet" }
        : { label: "Không còn dòng cần xem lại", state: "met" },
      reconcileReason.trim() ? { label: "Đã nhập lý do đối soát", state: "met" } : { label: "Nhập lý do đối soát", state: "unmet" },
    ];
    const reconcileBlocked = remainingReviewCount > 0 || remainingInvalidCount > 0;
    panel = (
      <GuardedActionPanel
        action={
          canReconcile ? (
            <Button
              className="max-md:h-11"
              disabled={isReconciling || reconcileBlocked || !reconcileReason.trim()}
              disabledReason={
                reconcileBlocked
                  ? "Xử lý hết dòng cần xem lại và không hợp lệ trước."
                  : !reconcileReason.trim()
                    ? "Nhập lý do đối soát trước."
                    : undefined
              }
              isLoading={isReconciling}
              onClick={handleReconcile}
            >
              Hoàn tất đối soát -&gt; Gửi phê duyệt
            </Button>
          ) : undefined
        }
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
        conditions={reconcileConditions}
        consequence={
          <>
            Hoàn tất đối soát chuyển lô sang <strong>chờ phê duyệt</strong>. Dòng hợp lệ sẽ được ghi sổ sau khi lô được phê duyệt và ghi
            sổ; dòng không thay đổi (số dư 0) không tạo bút toán.
          </>
        }
        result={reconcileError ? <ResultBanner description={reconcileError} title="Chưa hoàn tất đối soát." tone="error" /> : undefined}
        title="Bước đối soát Batch"
        titleId={ids.title}
      >
        {canReconcile ? (
          <div className="mt-4 grid max-w-2xl gap-1.5">
            <Label htmlFor={ids.reconcileReason} required>
              Lý do hoàn tất đối soát
            </Label>
            <Textarea
              id={ids.reconcileReason}
              maxLength={2000}
              onChange={(event) => setReconcileReason(event.target.value)}
              value={reconcileReason}
            />
          </div>
        ) : (
          <p className="mt-4 text-secondary text-text-muted">
            Tài khoản này không có quyền nhập số dư buổi học nên không đối soát được; người có quyền đó sẽ thực hiện bước này.
          </p>
        )}
      </GuardedActionPanel>
    );
  } else if (batch.status === "awaiting_approval") {
    const rowsClear = remainingReviewCount === 0 && remainingInvalidCount === 0;
    panel = (
      <GuardedActionPanel
        action={
          <Button
            className="max-md:h-11"
            disabled={isApproving || !canApprove || isCreator || !rowsClear}
            disabledReason={
              isCreator
                ? "Người tạo lô không tự phê duyệt được."
                : !canApprove
                  ? "Cần quyền duyệt số dư buổi học đã nhập."
                  : !rowsClear
                    ? "Lô còn dòng cần xem lại hoặc không hợp lệ."
                    : undefined
            }
            isLoading={isApproving}
            onClick={handleApprove}
          >
            Phê duyệt batch
          </Button>
        }
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
        conditions={[
          rowsClear
            ? { label: "Không còn dòng cần xem lại hoặc không hợp lệ", state: "met" }
            : { label: "Lô còn dòng cần xem lại hoặc không hợp lệ", state: "unmet" },
          isCreator ? { label: "Người duyệt phải khác người tạo lô", state: "unmet" } : { label: "Người duyệt khác người tạo lô", state: "met" },
          canApprove
            ? { label: "Tài khoản có quyền duyệt số dư buổi học đã nhập", state: "met" }
            : { label: "Tài khoản chưa có quyền duyệt số dư buổi học đã nhập", state: "unmet" },
        ]}
        consequence={
          <>
            Phê duyệt chuyển lô sang <strong>chờ ghi sổ</strong>: {formatNumber(validCount)} dòng hợp lệ, {formatNumber(batch.excluded_count ?? 0)} dòng
            đã loại, {formatNumber(batch.no_change_count ?? 0)} dòng không thay đổi. Chưa có bút toán nào ở bước này; ghi sổ là bước sau.
          </>
        }
        result={approveError ? <ResultBanner description={approveError} title="Chưa phê duyệt được." tone="error" /> : undefined}
        title="Bước phê duyệt số dư đầu kỳ"
        titleId={ids.title}
      >
        {!canApprove ? (
          <p className="mt-4 text-body text-warning-ink">
            Tài khoản hiện tại chỉ xem thông tin read-only. Bạn không có quyền phê duyệt lô số dư.
          </p>
        ) : null}
        {isCreator ? (
          <p className="mt-4 text-body text-warning-ink">
            Nguyên tắc 4 mắt (Maker/Checker): Người tạo batch không được tự phê duyệt batch của mình. Cần một tài khoản khác có quyền duyệt.
          </p>
        ) : null}
      </GuardedActionPanel>
    );
  } else if (batch.status === "approved") {
    const phraseOk = postConfirmationText.trim() === SESSION_BALANCE_POST_PHRASE;
    const isArmed = postConfirmedCheck && phraseOk;
    const postBlockedReason =
      !canApprove
        ? "Cần quyền duyệt số dư buổi học đã nhập."
        : validCount === 0
          ? "Lô không có dòng hợp lệ để ghi."
          : postedCount > 0
            ? "Lô đã có bút toán được ghi."
            : !postConfirmedCheck
              ? "Đánh dấu ô xác nhận."
              : !phraseOk
                ? `Gõ đúng ${SESSION_BALANCE_POST_PHRASE}.`
                : undefined;
    panel = (
      <GuardedActionPanel
        action={
          // The page's single primary at this stage (HANDOFF §5: danger is never a page primary):
          // primary styling, the irreversible consequence in words, and a danger border once armed.
          <Button className="max-md:h-11" disabled={isPosting || Boolean(postBlockedReason)} disabledReason={postBlockedReason} isLoading={isPosting} onClick={handlePost}>
            Ghi số dư vào sổ buổi
          </Button>
        }
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
        conditions={[
          validCount > 0
            ? { label: `${formatNumber(validCount)} dòng hợp lệ sẽ được ghi`, state: "met" }
            : { label: "Không có dòng hợp lệ để ghi", state: "unmet" },
          canApprove
            ? { label: "Tài khoản có quyền ghi sổ số dư buổi", state: "met" }
            : { label: "Tài khoản chưa có quyền ghi sổ số dư buổi", state: "unmet" },
          postConfirmedCheck ? { label: "Đã đánh dấu xác nhận", state: "met" } : { label: "Đánh dấu ô xác nhận", state: "unmet" },
          phraseOk
            ? { label: "Đã gõ đúng cụm xác nhận", state: "met" }
            : { label: `Gõ cụm xác nhận ${SESSION_BALANCE_POST_PHRASE}`, state: "unmet" },
        ]}
        consequence={
          <>
            Ghi sổ tạo <strong>{formatNumber(validCount)} bút toán</strong> điều chỉnh số buổi (tổng {formatSignedSessions(totalDeltaSessions)} buổi), ngày
            hiệu lực {formatIsoDate(batch.effective_on)}. Đây là bước <strong>không hoàn tác</strong>: bút toán đã ghi không sửa hay xóa trực tiếp được và lô
            không đổi được nữa.
          </>
        }
        emphasized={isArmed}
        result={postError ? <ResultBanner description={postError} title="Chưa ghi sổ được." tone="error" /> : undefined}
        title="Ghi số dư vào sổ buổi"
        titleId={ids.title}
      >
        {!canApprove ? (
          <p className="mt-4 text-body text-warning-ink">Tài khoản hiện tại không có quyền ghi sổ số dư buổi.</p>
        ) : null}
        <div className="mt-4 grid max-w-xl gap-3">
          <label className="flex min-h-11 items-start gap-2.5 py-2 text-body text-text-strong md:min-h-10" htmlFor={ids.confirm}>
            <input
              checked={postConfirmedCheck}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--action-primary)]"
              id={ids.confirm}
              onChange={(event) => setPostConfirmedCheck(event.target.checked)}
              type="checkbox"
            />
            Tôi xác nhận đã kiểm tra lô đã phê duyệt và đồng ý ghi các số dư hợp lệ vào sổ buổi.
          </label>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.phrase}>
              Gõ <span className="font-mono">{SESSION_BALANCE_POST_PHRASE}</span> để xác nhận
            </Label>
            <Input
              autoComplete="off"
              className="max-w-xs font-mono"
              id={ids.phrase}
              onChange={(event) => setPostConfirmationText(event.target.value)}
              spellCheck={false}
              value={postConfirmationText}
            />
          </div>
        </div>
      </GuardedActionPanel>
    );
  } else if (batch.status === "posted") {
    panel = (
      <ResultBanner
        action={
          <Link className={getButtonClassName({ className: "max-md:h-11", size: "sm", variant: "secondary" })} href={ledgerHref}>
            Xem sổ buổi
          </Link>
        }
        description={`${formatNumber(postedCount)} bút toán, ghi bởi ${getPersonName(detail, batch.posted_by)} lúc ${formatImportTimestamp(batch.posted_at)}.`}
        title="Đã ghi số dư đầu kỳ vào sổ buổi."
        tone="success"
      />
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader
        actions={
          <Link className={getButtonClassName({ className: "max-md:h-11", variant: "secondary" })} href={listHref}>
            <span aria-hidden="true">←</span> Danh sách lô
          </Link>
        }
        context={<Badge tone={status.tone}>{status.label}</Badge>}
        title="Lô số dư buổi đầu kỳ"
      >
        <p className="mt-1 text-secondary text-text-muted">
          <span className="break-all">{batch.source_filename}</span> · {formatNumber(batch.row_count ?? 0)} dòng · hiệu lực{" "}
          <span className="tabular-nums">{formatIsoDate(batch.effective_on)}</span>
        </p>
      </PageHeader>

      <Stepper label="Các bước của lô số dư" steps={getSessionBalanceBatchSteps(batch.status)} />

      <section className="@container rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
        <h2 className="border-b border-border-row px-5 py-3 text-body font-semibold text-text-strong">Thông tin lô</h2>
        <dl className="m-0 grid gap-x-6 gap-y-3 p-5 @min-[640px]:grid-cols-2 @min-[960px]:grid-cols-4">
          <Fact label="Tạo lô">
            {getPersonName(detail, batch.created_by)}
            <Time value={batch.created_at} />
          </Fact>
          <Fact label="Đối soát">
            {batch.reconciled_by ? (
              <>
                {getPersonName(detail, batch.reconciled_by)}
                <Time value={batch.reconciled_at} />
              </>
            ) : (
              <span className="text-text-muted">Chưa đối soát</span>
            )}
          </Fact>
          <Fact label="Phê duyệt">
            {batch.approved_by ? (
              <>
                {getPersonName(detail, batch.approved_by)}
                <Time value={batch.approved_at} />
              </>
            ) : (
              <span className="text-text-muted">Chưa phê duyệt</span>
            )}
          </Fact>
          <Fact label="Ghi sổ">
            {batch.posted_by ? (
              <>
                {getPersonName(detail, batch.posted_by)}
                <Time value={batch.posted_at} />
              </>
            ) : (
              <span className="text-text-muted">Chưa ghi sổ</span>
            )}
          </Fact>
          <Fact className="@min-[640px]:col-span-2" label="Lý do tạo lô">
            <span className="break-words">{batch.reason || "—"}</span>
          </Fact>
          <Fact label="SHA-256 của file">
            <span className="font-mono text-secondary font-normal" title={batch.source_sha256}>
              {batch.source_sha256.length > 12 ? `${batch.source_sha256.slice(0, 12)}…` : batch.source_sha256}
            </span>
          </Fact>
          <Fact label="Mã lô">
            <span className="break-all font-mono text-secondary font-normal">{batch.id}</span>
          </Fact>
        </dl>
      </section>

      <ImportSummaryStrip cells={summaryCells} label="Số dòng của lô" />

      {panel}

      <section aria-labelledby={ids.rowsHeading} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <div>
          <h2 className="text-section-title font-semibold text-text-strong" id={ids.rowsHeading}>
            Các dòng của lô
          </h2>
          <p className="mt-0.5 text-secondary text-text-muted">
            {canExcludeRows
              ? "Dòng cần xem lại phải được loại khỏi lô (kèm lý do, không hoàn tác) trước khi hoàn tất đối soát."
              : "Dòng hợp lệ được ghi sổ; dòng đã loại hoặc không thay đổi không tạo bút toán."}
          </p>
        </div>
        <ImportReviewTable<SessionBalanceImportRowRecord>
          caption={`Các dòng của lô (${formatNumber(rows.length)} dòng)`}
          cardTitle={(row) => `Dòng ${row.source_row_number} · ${row.student_public_code}`}
          chips={{ needsReviewLabel: "Cần xử lý" }}
          columns={columns}
          emptyText="Lô không có dòng nào."
          getRowIssue={(row) => getSessionBalanceRowIssue(row)}
          getRowKey={(row) => row.id}
          getRowSeverity={(row) => getSessionBalanceRowSeverity(row.validation_status)}
          issueHeader="Trạng thái"
          rows={rows}
        />
      </section>
    </div>
  );
}

function Fact({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={className ? `min-w-0 ${className}` : "min-w-0"}>
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="m-0 mt-0.5 text-body text-text-strong">{children}</dd>
    </div>
  );
}

function Time({ value }: { value: string | null }) {
  return <span className="block text-caption tabular-nums text-text-muted">{formatImportTimestamp(value)}</span>;
}

function ExcludeCell({
  error,
  isEditing,
  isExcluding,
  onCancel,
  onConfirm,
  onOpen,
  onReasonChange,
  reason,
  row,
}: {
  error: string | null;
  isEditing: boolean;
  isExcluding: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onOpen: () => void;
  onReasonChange: (value: string) => void;
  reason: string;
  row: SessionBalanceImportRowRecord;
}) {
  if (row.validation_status === "invalid") {
    return <span className="text-secondary font-medium text-danger">Sửa file, tạo lô mới</span>;
  }
  if (row.validation_status !== "review") {
    return <span className="text-text-muted">—</span>;
  }
  if (!isEditing) {
    return (
      <Button className="max-md:h-11" onClick={onOpen} size="sm" variant="secondary">
        Loại khỏi lô <span className="sr-only">dòng {row.source_row_number}</span>
      </Button>
    );
  }
  return (
    <div className="grid min-w-[200px] gap-1.5 py-2">
      <Input
        aria-label={`Lý do loại dòng ${row.source_row_number}`}
        className="md:min-h-8 md:text-secondary"
        maxLength={2000}
        onChange={(event) => onReasonChange(event.target.value)}
        value={reason}
      />
      {error ? (
        <p className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button className="max-md:h-11" disabled={isExcluding} onClick={onCancel} size="sm" variant="ghost">
          Hủy
        </Button>
        <Button className="max-md:h-11" disabled={!reason.trim()} isLoading={isExcluding} onClick={onConfirm} size="sm" variant="danger-outline">
          Xác nhận loại
        </Button>
      </div>
    </div>
  );
}
