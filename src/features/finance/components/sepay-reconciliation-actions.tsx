"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  matchSepayHistoricalTransactionAction,
  resolveSepayHistoricalTransactionAction,
  searchSepayReconciliationCandidatesAction,
} from "@/features/finance/sepay-reconciliation-actions";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";

export interface SepayReconciliationCandidateView {
  expectedAmountVnd: number;
  id: string;
  publicCode: string;
  studentFullName: string;
  topupType: "new" | "renewal";
}

export function SepayReconciliationActions({
  candidates,
  transaction,
}: {
  candidates: SepayReconciliationCandidateView[];
  transaction: SepayTransactionReadModel;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [availableCandidates, setAvailableCandidates] = useState(candidates);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [reason, setReason] = useState("");
  const [paymentRequestId, setPaymentRequestId] = useState("");
  const [message, setMessage] = useState("");

  const matchingCandidates = useMemo(() => {
    if (transaction.accountPurpose === "unknown") return [];
    const expectedTopupType = transaction.accountPurpose === "renewal" ? "renewal" : "new";
    return availableCandidates.filter((candidate) => (
      candidate.expectedAmountVnd === transaction.amountVnd
      && candidate.topupType === expectedTopupType
    ));
  }, [availableCandidates, transaction.accountPurpose, transaction.amountVnd]);

  const hasIdentityConflict = transaction.matchStatus === "identity_conflict";

  if (
    !transaction.sepayV2Id
    || transaction.transferType !== "in"
    || !["unmatched", "identity_conflict"].includes(transaction.matchStatus)
  ) return <span className="text-caption text-text-muted">Không cần thao tác</span>;

  async function finish(action: () => Promise<{ message: string; ok: boolean }>): Promise<void> {
    const result = await action();
    setMessage(result.message);
    if (result.ok) router.refresh();
  }

  function confirmTerminalResolution(label: string): boolean {
    const amount = new Intl.NumberFormat("vi-VN").format(transaction.amountVnd);
    return window.confirm(
      `${label} giao dịch ${transaction.bankTransactionId}, số tiền ${amount} ₫? Giao dịch sẽ rời danh sách cần đối soát và lý do được lưu vào nhật ký.`,
    );
  }

  function confirmPaymentMatch(): boolean {
    const candidate = matchingCandidates.find((item) => item.id === paymentRequestId);
    const amount = new Intl.NumberFormat("vi-VN").format(transaction.amountVnd);
    return window.confirm(
      `Khớp giao dịch ${transaction.bankTransactionId}, số tiền ${amount} ₫ với ${candidate?.publicCode ?? "yêu cầu đã chọn"}? Hệ thống sẽ ghi nhận thanh toán, học phí và đơn hàng tương ứng.`,
    );
  }

  return (
    <details className="min-w-[240px]">
      <summary className="cursor-pointer text-control font-semibold text-action-primary">Đối soát</summary>
      <div className="mt-2 grid gap-2 rounded-md border border-border-subtle bg-surface-base p-3">
        {hasIdentityConflict ? (
          <p className="rounded border border-warning-border bg-warning-bg p-2 text-caption text-warning">
            Giao dịch trùng nhận diện. Chủ trung tâm chỉ có thể xác nhận đã hạch toán hoặc bỏ qua; không thể tạo học phí mới từ bản ghi này.
          </p>
        ) : null}
        <label className="grid gap-1 text-caption font-semibold text-text-muted">
          Lý do / ghi chú bắt buộc
          <input
            className="h-11 rounded-md border border-border-subtle px-2 font-normal text-text-default"
            disabled={isPending}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nêu căn cứ đối soát"
            value={reason}
          />
        </label>
        <label className="grid gap-1 text-caption font-semibold text-text-muted">
          Yêu cầu thanh toán phù hợp
          <select
            className="h-11 rounded-md border border-border-subtle px-2 font-normal text-text-default"
            disabled={isPending || matchingCandidates.length === 0}
            onChange={(event) => setPaymentRequestId(event.target.value)}
            value={paymentRequestId}
          >
            <option value="">Chọn yêu cầu</option>
            {matchingCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.publicCode} · {candidate.studentFullName}
              </option>
            ))}
          </select>
        </label>
        {!hasIdentityConflict ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              aria-label="Tìm yêu cầu thanh toán"
              className="h-11 rounded-md border border-border-subtle px-2 text-caption text-text-default"
              disabled={isPending || isSearching}
              onChange={(event) => setCandidateSearch(event.target.value)}
              placeholder="Tìm mã yêu cầu hoặc học viên"
              value={candidateSearch}
            />
            <Button
              disabled={candidateSearch.trim().length < 2}
              isLoading={isSearching}
              onClick={() => startSearchTransition(async () => {
                const result = await searchSepayReconciliationCandidatesAction({
                  query: candidateSearch,
                  transactionId: transaction.id,
                });
                if (!result.ok) {
                  setMessage(result.message);
                  return;
                }
                setAvailableCandidates((current) => [...new Map(
                  [...current, ...result.candidates].map((candidate) => [candidate.id, candidate]),
                ).values()]);
                setMessage(result.candidates.length > 0
                  ? `Đã tìm thấy ${result.candidates.length} yêu cầu phù hợp.`
                  : "Không tìm thấy yêu cầu phù hợp với từ khóa.");
              })}
              size="lg"
              type="button"
              variant="secondary"
            >
              Tìm
            </Button>
          </div>
        ) : null}
        <Button
          disabled={hasIdentityConflict || !paymentRequestId || reason.trim().length < 3}
          isLoading={isPending}
          onClick={() => {
            if (!confirmPaymentMatch()) return;
            startTransition(() => finish(() => matchSepayHistoricalTransactionAction({
              paymentRequestId,
              reason,
              transactionId: transaction.id,
            })));
          }}
          size="lg"
        >
          Khớp và ghi nhận học phí
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={reason.trim().length < 3}
            isLoading={isPending}
            onClick={() => {
              if (!confirmTerminalResolution("Đánh dấu đã hạch toán trước đây cho")) return;
              startTransition(() => finish(() => resolveSepayHistoricalTransactionAction({
                reason,
                resolution: "already_accounted",
                transactionId: transaction.id,
              })));
            }}
            size="lg"
            variant="secondary"
          >
            Đã hạch toán trước đây
          </Button>
          <Button
            disabled={reason.trim().length < 3}
            isLoading={isPending}
            onClick={() => {
              if (!confirmTerminalResolution("Bỏ qua")) return;
              startTransition(() => finish(() => resolveSepayHistoricalTransactionAction({
                reason,
                resolution: "ignored",
                transactionId: transaction.id,
              })));
            }}
            size="lg"
            variant="danger"
          >
            Bỏ qua
          </Button>
        </div>
        <p className="text-caption text-text-muted">
          Hai lựa chọn trên kết thúc đối soát mà không tạo học phí mới. Hệ thống sẽ hỏi xác nhận trước khi thực hiện.
        </p>
        {!hasIdentityConflict && matchingCandidates.length === 0 ? <p className="text-caption text-warning">Không có yêu cầu chờ nào cùng loại và đúng số tiền. Có thể tìm theo mã yêu cầu hoặc tên học viên.</p> : null}
        {message ? <p className="text-caption text-text-muted" role="status">{message}</p> : null}
      </div>
    </details>
  );
}
