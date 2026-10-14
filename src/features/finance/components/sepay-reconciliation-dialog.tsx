"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  matchSepayHistoricalTransactionAction,
  resolveSepayHistoricalTransactionAction,
  searchSepayReconciliationCandidatesAction,
} from "@/features/finance/sepay-reconciliation-actions";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";
import type { SepayActionOverrides } from "@/features/finance/sepay-action-overrides";
import {
  getSepayAccountPurposePresentation,
  getSepayMatchPresentation,
} from "@/features/finance/components/sepay-transaction-history";

export interface SepayReconciliationCandidateView {
  expectedAmountVnd: number;
  id: string;
  publicCode: string;
  studentFullName: string;
  topupType: "new" | "renewal";
}

export function isSepayTransactionReconcilable(
  transaction: Pick<SepayTransactionReadModel, "matchStatus" | "sepayV2Id" | "transferType">,
): boolean {
  return Boolean(
    transaction.transferType === "in" &&
    (["unmatched", "amount_mismatch", "account_purpose_mismatch"].includes(transaction.matchStatus) || (Boolean(transaction.sepayV2Id) && transaction.matchStatus === "identity_conflict")),
  );
}

export type SepayReconciliationActionOverrides = Pick<
  SepayActionOverrides,
  "matchHistorical" | "resolveHistorical" | "searchReconciliationCandidates"
>;

export interface SepayReconciliationDialogProps {
  /** Replacements for the reconciliation server actions (dev preview only). */
  actions?: SepayReconciliationActionOverrides;
  candidates?: SepayReconciliationCandidateView[];
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  transaction: SepayTransactionReadModel | null;
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDateTime(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : dateTimeFormatter.format(timestamp);
}

function getSourceLabel(source: SepayTransactionReadModel["ingestionSource"]): string {
  switch (source) {
    case "api_v2": return "Lịch sử API";
    case "reconciled": return "Webhook + API";
    case "webhook": return "Webhook";
  }
}

export function SepayReconciliationDialog({
  actions,
  candidates = [],
  isOpen,
  onClose,
  returnFocusRef,
  transaction,
}: SepayReconciliationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!isOpen || !transaction) {
    return null;
  }

  return (
    <Dialog
      ariaDescribedBy={descriptionId}
      ariaLabelledBy={titleId}
      className="max-w-2xl p-0 overflow-hidden"
      isOpen={isOpen}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      <SepayReconciliationDialogContent
        actions={actions}
        candidates={candidates}
        descriptionId={descriptionId}
        key={transaction.id}
        onClose={onClose}
        titleId={titleId}
        transaction={transaction}
      />
    </Dialog>
  );
}

interface DialogContentProps {
  actions?: SepayReconciliationActionOverrides;
  candidates: SepayReconciliationCandidateView[];
  descriptionId: string;
  onClose: () => void;
  titleId: string;
  transaction: SepayTransactionReadModel;
}

type ReconciliationActionType = "already_accounted" | "ignored" | "match" | null;

function SepayReconciliationDialogContent({
  actions,
  candidates,
  descriptionId,
  onClose,
  titleId,
  transaction,
}: DialogContentProps) {
  const router = useRouter();
  const matchHistorical = actions?.matchHistorical ?? matchSepayHistoricalTransactionAction;
  const resolveHistorical = actions?.resolveHistorical ?? resolveSepayHistoricalTransactionAction;
  const searchCandidates = actions?.searchReconciliationCandidates ?? searchSepayReconciliationCandidatesAction;
  const [isPending, startTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<ReconciliationActionType>(null);

  const [availableCandidates, setAvailableCandidates] = useState<SepayReconciliationCandidateView[]>(candidates);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [reason, setReason] = useState("");
  const [paymentRequestId, setPaymentRequestId] = useState("");
  const [actionError, setActionError] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

  const searchSeqRef = useRef(0);
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);

  const hasIdentityConflict = transaction.matchStatus === "identity_conflict";
  // Any inbound transfer that has not produced money effects can be closed as
  // "already accounted" or "ignored" — not only API-history imports.
  const canResolveHistory = ["unmatched", "identity_conflict", "amount_mismatch", "account_purpose_mismatch"]
    .includes(transaction.matchStatus);
  const expectedTopupType = transaction.accountPurpose === "renewal" ? "renewal" : "new";

  const matchingCandidates = useMemo(() => {
    if (transaction.accountPurpose === "unknown") return [];
    return availableCandidates.filter((candidate) => (
      candidate.expectedAmountVnd === transaction.amountVnd &&
      candidate.topupType === expectedTopupType
    ));
  }, [availableCandidates, expectedTopupType, transaction.accountPurpose, transaction.amountVnd]);

  const selectedCandidate = useMemo(() => (
    matchingCandidates.find((item) => item.id === paymentRequestId) ?? null
  ), [matchingCandidates, paymentRequestId]);

  const purposePresentation = getSepayAccountPurposePresentation(transaction.accountPurpose);
  const matchPresentation = getSepayMatchPresentation(transaction.matchStatus);

  function handleSafeClose(): void {
    if (isPending) return;
    onClose();
  }

  async function executeAction(
    actionType: "already_accounted" | "ignored" | "match",
    fn: () => Promise<{ message: string; ok: boolean }>,
  ): Promise<void> {
    setActionError("");
    setActiveAction(actionType);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.ok) {
          router.refresh();
          onClose();
        } else {
          setActionError(result.message);
          setActiveAction(null);
        }
      } catch {
        setActionError("Lỗi kết nối khi gửi yêu cầu đối soát. Vui lòng thử lại.");
        setActiveAction(null);
      }
    });
  }

  function confirmPaymentMatch(): boolean {
    const amount = formatCurrency(transaction.amountVnd);
    return window.confirm(
      `Khớp giao dịch ${transaction.bankTransactionId}, số tiền ${amount} với ${selectedCandidate?.publicCode ?? "yêu cầu đã chọn"}? Hệ thống sẽ ghi nhận thanh toán, học phí và đơn hàng tương ứng.`,
    );
  }

  function confirmTerminalResolution(label: string): boolean {
    const amount = formatCurrency(transaction.amountVnd);
    return window.confirm(
      `${label} giao dịch ${transaction.bankTransactionId}, số tiền ${amount}? Giao dịch sẽ rời danh sách cần đối soát và lý do được lưu vào nhật ký.`,
    );
  }

  function handleSearchCandidates(): void {
    const query = candidateSearch.trim();
    if (query.length < 2) return;

    const currentSeq = ++searchSeqRef.current;
    setSearchMessage("");
    setActionError("");

    startSearchTransition(async () => {
      try {
        const result = await searchCandidates({
          query,
          transactionId: transaction.id,
        });

        if (currentSeq !== searchSeqRef.current) {
          return;
        }

        if (!result.ok) {
          setSearchMessage(result.message);
          return;
        }

        setAvailableCandidates((current) => {
          const merged = new Map(current.map((c) => [c.id, c]));
          for (const candidate of result.candidates) {
            merged.set(candidate.id, candidate);
          }
          return Array.from(merged.values());
        });

        if (result.candidates.length > 0) {
          setSearchMessage(`Đã tìm thấy ${result.candidates.length} yêu cầu phù hợp.`);
        } else {
          setSearchMessage("Không tìm thấy yêu cầu thanh toán nào phù hợp với từ khóa.");
        }
      } catch {
        if (currentSeq === searchSeqRef.current) {
          setSearchMessage("Lỗi kết nối khi tìm kiếm yêu cầu thanh toán. Vui lòng thử lại.");
        }
      }
    });
  }

  return (
    <div className="flex max-h-[90vh] flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border-subtle bg-surface-base px-5 py-4">
        <div>
          <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
            Đối soát giao dịch SePay
          </h2>
          <p className="mt-0.5 text-secondary text-text-muted" id={descriptionId}>
            Kiểm tra thông tin giao dịch và chọn phương án xử lý đối soát tương ứng.
          </p>
        </div>
        <button
          aria-label="Đóng cửa sổ đối soát"
          className="rounded-md p-1.5 text-text-muted hover:bg-interactive-hover hover:text-text-strong focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-40"
          disabled={isPending}
          onClick={handleSafeClose}
          type="button"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5 text-body">
        {/* Transaction Summary Card */}
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <div>
              <span className="text-caption font-medium text-text-muted">Số tiền giao dịch</span>
              <p className="tabular-nums text-2xl font-bold text-text-strong">
                {formatCurrency(transaction.amountVnd)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={purposePresentation.tone}>{purposePresentation.label}</Badge>
              <Badge tone={matchPresentation.tone}>{matchPresentation.label}</Badge>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-1 gap-2 text-secondary sm:grid-cols-2">
            <div>
              <dt className="text-caption text-text-muted">Ngân hàng & STK</dt>
              <dd className="font-medium text-text-strong">
                {transaction.bankBrand} · <span className="font-mono">{transaction.accountNumber}</span>
              </dd>
            </div>
            <div>
              <dt className="text-caption text-text-muted">Thời gian giao dịch</dt>
              <dd className="tabular-nums font-medium text-text-strong">
                {formatDateTime(transaction.transactionAt)}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-text-muted">Mã giao dịch ngân hàng</dt>
              <dd className="font-mono text-caption font-semibold text-text-strong">
                {transaction.bankTransactionId}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-text-muted">Nguồn & Số tham chiếu</dt>
              <dd className="text-text-default">
                {getSourceLabel(transaction.ingestionSource)}
                {transaction.referenceNumber ? ` · Ref: ${transaction.referenceNumber}` : ""}
              </dd>
            </div>
            {transaction.sepayV2Id ? (
              <div className="sm:col-span-2">
                <dt className="text-caption text-text-muted">Định danh SePay (UUID)</dt>
                <dd className="break-all font-mono text-caption text-text-muted">
                  {transaction.sepayV2Id}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-3 border-t border-border-subtle pt-3">
            <span className="text-caption font-medium text-text-muted">Nội dung chuyển khoản</span>
            <div className="mt-1 break-words rounded bg-surface-sunken p-2.5 font-mono text-caption text-text-default">
              {transaction.transferContent}
            </div>
          </div>
        </div>

        {/* Identity Conflict Warning */}
        {hasIdentityConflict ? (
          <div className="rounded-md border border-warning-border bg-warning-bg p-3 text-secondary text-warning" role="alert">
            <p className="font-semibold">Giao dịch trùng nhận diện</p>
            <p className="mt-0.5 text-caption">
              Chủ trung tâm chỉ có thể xác nhận đã hạch toán hoặc bỏ qua; không thể tạo học phí mới từ bản ghi này.
            </p>
          </div>
        ) : null}

        {/* Reason Input */}
        <div className="grid gap-1.5">
          <label className="text-label font-semibold text-text-strong" htmlFor="sepay-reconciliation-reason">
            Lý do / ghi chú bắt buộc <span className="text-danger">*</span>
          </label>
          <textarea
            className="min-h-20 w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-control text-text-default placeholder:text-text-subtle focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:bg-disabled-bg disabled:text-text-disabled"
            disabled={isPending}
            id="sepay-reconciliation-reason"
            maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nêu căn cứ đối soát (ví dụ: đã kiểm tra sao kê, học viên chuyển nhầm mã...)"
            ref={reasonInputRef}
            required
            rows={2}
            value={reason}
          />
          {reason.length > 0 && reason.trim().length < 3 ? (
            <p className="text-caption text-danger">Lý do phải có ít nhất 3 ký tự.</p>
          ) : null}
        </div>

        {/* Payment Request Matching Section (Hidden if Identity Conflict) */}
        {!hasIdentityConflict ? (
          <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-base p-4">
            <div className="grid gap-1.5">
              <label className="text-label font-semibold text-text-strong" htmlFor="sepay-candidate-select">
                Yêu cầu thanh toán phù hợp
              </label>
              <select
                className="h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:bg-disabled-bg disabled:text-text-disabled"
                disabled={isPending || matchingCandidates.length === 0}
                id="sepay-candidate-select"
                onChange={(e) => setPaymentRequestId(e.target.value)}
                value={paymentRequestId}
              >
                <option value="">-- Chọn yêu cầu thanh toán ({matchingCandidates.length} khả dụng) --</option>
                {matchingCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.publicCode} · {candidate.studentFullName} ({formatCurrency(candidate.expectedAmountVnd)})
                  </option>
                ))}
              </select>
              {matchingCandidates.length === 0 ? (
                <p className="text-caption text-warning">
                  Không có yêu cầu chờ nào cùng loại ({expectedTopupType === "renewal" ? "Tái phí" : "Tuyển mới"}) và đúng số tiền ({formatCurrency(transaction.amountVnd)}) trong danh sách nạp sẵn. Bạn có thể tìm kiếm bên dưới theo mã yêu cầu hoặc tên học viên.
                </p>
              ) : null}
            </div>

            {/* Candidate Search */}
            <div className="grid gap-1.5 border-t border-border-subtle pt-3">
              <label className="text-label font-semibold text-text-strong" htmlFor="sepay-candidate-search">
                Tìm kiếm yêu cầu thanh toán khác
              </label>
              <div className="flex gap-2">
                <input
                  aria-label="Tìm yêu cầu thanh toán"
                  className="h-11 flex-1 rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default placeholder:text-text-subtle focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:bg-disabled-bg disabled:text-text-disabled"
                  disabled={isPending || isSearching}
                  id="sepay-candidate-search"
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchCandidates();
                    }
                  }}
                  placeholder="Nhập mã yêu cầu (YC...) hoặc họ tên học viên"
                  value={candidateSearch}
                />
                <Button
                  disabled={isPending || isSearching || candidateSearch.trim().length < 2}
                  isLoading={isSearching}
                  onClick={handleSearchCandidates}
                  type="button"
                  variant="secondary"
                >
                  Tìm
                </Button>
              </div>
              {searchMessage ? (
                <p className="text-caption text-text-muted" role="status">
                  {searchMessage}
                </p>
              ) : null}
            </div>

            {/* Selected Consequence Preview */}
            {selectedCandidate ? (
              <div className="rounded-md border border-info-border bg-info-bg p-3 text-secondary text-info">
                <p className="font-semibold">Xác nhận khớp học phí:</p>
                <p className="mt-0.5 text-caption">
                  Giao dịch <span className="font-mono font-medium">{transaction.bankTransactionId}</span> ({formatCurrency(transaction.amountVnd)}) sẽ khớp với <span className="font-semibold">{selectedCandidate.publicCode}</span> ({selectedCandidate.studentFullName}). Hệ thống sẽ hoàn tất yêu cầu và ghi nhận học phí.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Consequence Note */}
        <div className="rounded-md bg-surface-sunken p-3 text-caption text-text-muted">
          <p className="font-medium text-text-strong">Lưu ý về các thao tác đối soát:</p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            <li><strong>Khớp và ghi nhận học phí:</strong> Ghi nhận thanh toán cho yêu cầu được chọn và phát sinh học phí tương ứng.</li>
            <li><strong>Đã hạch toán trước đây & Bỏ qua:</strong> Kết thúc đối soát cho giao dịch mà không tạo doanh thu, học phí hay tín dụng mới.</li>
          </ul>
        </div>

        {/* Action Error Message */}
        {actionError ? (
          <div className="rounded-md border border-danger-border bg-danger-bg p-3 text-secondary text-danger" role="alert">
            <p className="font-semibold">Không thể hoàn tất đối soát</p>
            <p className="mt-0.5 text-caption">{actionError}</p>
          </div>
        ) : null}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col-reverse gap-2 border-t border-border-subtle bg-surface-base p-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          disabled={isPending}
          onClick={handleSafeClose}
          type="button"
          variant="ghost"
        >
          Đóng
        </Button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!hasIdentityConflict ? (
            <Button
              disabled={!paymentRequestId || reason.trim().length < 3 || isPending}
              isLoading={isPending && activeAction === "match"}
              onClick={() => {
                if (!confirmPaymentMatch()) return;
                executeAction("match", () => matchHistorical({
                  paymentRequestId,
                  reason,
                  transactionId: transaction.id,
                }));
              }}
              type="button"
            >
              Khớp và ghi nhận học phí
            </Button>
          ) : null}

          {canResolveHistory ? <Button
            disabled={reason.trim().length < 3 || isPending}
            isLoading={isPending && activeAction === "already_accounted"}
            onClick={() => {
              if (!confirmTerminalResolution("Đánh dấu đã hạch toán trước đây cho")) return;
              executeAction("already_accounted", () => resolveHistorical({
                reason,
                resolution: "already_accounted",
                transactionId: transaction.id,
              }));
            }}
            type="button"
            variant="secondary"
          >
            Đã hạch toán trước đây
          </Button> : null}

          {canResolveHistory ? <Button
            disabled={reason.trim().length < 3 || isPending}
            isLoading={isPending && activeAction === "ignored"}
            onClick={() => {
              if (!confirmTerminalResolution("Bỏ qua")) return;
              executeAction("ignored", () => resolveHistorical({
                reason,
                resolution: "ignored",
                transactionId: transaction.id,
              }));
            }}
            type="button"
            variant="danger"
          >
            Bỏ qua
          </Button> : null}
        </div>
      </div>
    </div>
  );
}
