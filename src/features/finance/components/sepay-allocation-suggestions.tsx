"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AllocationSuggestion,
  AllocationSuggestionCandidate,
} from "@/features/finance/allocation-suggestions-data";
import { allocateSepayTuitionAction } from "@/features/finance/manual-allocation-actions";
import type { SepayActionOverrides } from "@/features/finance/sepay-action-overrides";

const DEFAULT_REASON = "Khớp theo nội dung chuyển khoản (gợi ý tự động, kế toán xác nhận)";

const reasonLabels: Record<string, string> = {
  birth_year: "năm sinh",
  guardian_phone: "SĐT phụ huynh",
  student_code: "mã học sinh",
  student_name: "tên học sinh",
  student_nickname: "tên gọi khác",
};

const inputClassName =
  "min-h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

interface RowState {
  candidateId: string;
  /** Detail layout: the second confirmation step is open for this row. */
  confirming: boolean;
  error: string | null;
  sessions: string;
  status: "idle" | "pending" | "done";
}

function initialRowState(suggestion: AllocationSuggestion): RowState {
  const best = suggestion.candidates[0];
  return {
    candidateId: best?.studentId ?? "",
    confirming: false,
    error: null,
    sessions: best?.suggestedSessions ? String(best.suggestedSessions) : "",
    status: "idle",
  };
}

export function SepayAllocationSuggestions({
  actions,
  confirmDisabledReason = null,
  layout = "panel",
  onPendingChange,
  suggestions,
}: {
  /** Replacement for the allocation server action (dev preview only). */
  actions?: Pick<SepayActionOverrides, "allocate">;
  /** Detail layout: confirming is blocked (e.g. the row was selected automatically); shown as text. */
  confirmDisabledReason?: string | null;
  /** Detail layout: reports an allocation in flight so the caller can hold the selection. */
  onPendingChange?: (pending: boolean) => void;
  /**
   * `panel`: every pending suggestion with the bulk confirm (Tất cả giao dịch).
   * `detail`: the selected transaction's suggestion inside the review detail
   * pane; no bulk confirm, so its row confirm stays the pane's one primary.
   */
  layout?: "detail" | "panel";
  suggestions: readonly AllocationSuggestion[];
}) {
  const router = useRouter();
  const allocate = actions?.allocate ?? allocateSepayTuitionAction;
  const isDetail = layout === "detail";
  const reasonId = useId();
  const titleId = useId();
  // Unique per instance: the review workspace can show the same suggestion in the detail pane and on a phone card.
  const sessionsIdPrefix = useId();
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(suggestions.map((s) => [s.transactionId, initialRowState(s)])),
  );
  const [isBulkPending, startBulk] = useTransition();
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  const pending = suggestions.filter((s) => rows[s.transactionId]?.status !== "done");
  const highConfidenceReady = pending.filter((s) => {
    const row = rows[s.transactionId];
    const candidate = s.candidates.find((c) => c.studentId === row?.candidateId);
    return candidate?.confidence === "high" && Number(row?.sessions) >= 1;
  });

  const updateRow = (transactionId: string, change: Partial<RowState>): void => {
    setRows((current) => ({
      ...current,
      [transactionId]: { ...current[transactionId], ...change },
    }));
  };

  const validateRow = (suggestion: AllocationSuggestion) => {
    const row = rows[suggestion.transactionId];
    const candidate = suggestion.candidates.find((c) => c.studentId === row?.candidateId);
    const sessions = Number(row?.sessions);

    if (!candidate) {
      updateRow(suggestion.transactionId, { error: "Chọn học sinh trước khi xác nhận." });
      return null;
    }
    if (!Number.isInteger(sessions) || sessions < 1) {
      updateRow(suggestion.transactionId, { error: "Nhập số buổi cộng cho học sinh (số nguyên ≥ 1)." });
      return null;
    }
    return { candidate, sessions };
  };

  const confirmOne = async (suggestion: AllocationSuggestion): Promise<boolean> => {
    const valid = validateRow(suggestion);
    if (!valid) return false;
    const { candidate, sessions } = valid;

    updateRow(suggestion.transactionId, { confirming: false, error: null, status: "pending" });
    onPendingChange?.(true);
    let result: Awaited<ReturnType<typeof allocate>>;
    try {
      result = await allocate({
        allocations: [
          {
            amountVnd: suggestion.amountVnd,
            bonusSessions: 0,
            paymentRequestId: candidate.pendingRequestId,
            sessions,
            studentId: candidate.studentId,
          },
        ],
        reason,
        transactionId: suggestion.transactionId,
      });
    } catch {
      result = { message: "Chưa xác nhận được kết quả. Vui lòng tải lại giao dịch trước khi thử lại.", ok: false };
    } finally {
      onPendingChange?.(false);
    }

    if (!result.ok) {
      updateRow(suggestion.transactionId, { error: result.message, status: "idle" });
      return false;
    }

    updateRow(suggestion.transactionId, { error: null, status: "done" });
    return true;
  };

  const confirmHighConfidence = (): void => {
    startBulk(async () => {
      let done = 0;
      let failed = 0;
      // Sequential on purpose: each allocation locks its transaction row.
      for (const suggestion of highConfidenceReady) {
        const ok = await confirmOne(suggestion);
        if (ok) done += 1;
        else failed += 1;
      }
      setBulkSummary(
        failed === 0
          ? `Đã phân bổ ${done} giao dịch.`
          : `Đã phân bổ ${done} giao dịch, ${failed} giao dịch lỗi (xem từng dòng).`,
      );
      router.refresh();
    });
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
            {isDetail ? "Gợi ý khớp" : "Gợi ý khớp giao dịch chưa phân bổ"}
          </h2>
          <p className="mt-1 text-secondary text-text-muted">
            {isDetail ? (
              "Học sinh có thể là người chuyển, tìm theo tên, năm sinh, mã học sinh hoặc số điện thoại phụ huynh trong nội dung chuyển khoản. Kiểm tra, sửa số buổi nếu cần rồi xác nhận."
            ) : (
              <>
                Hệ thống đọc nội dung chuyển khoản và tìm học sinh theo tên, năm sinh, mã học sinh hoặc số điện thoại phụ huynh.
                Kế toán kiểm tra, sửa số buổi nếu cần rồi xác nhận từng dòng. {pending.length} giao dịch đang chờ.
              </>
            )}
          </p>
        </div>
        {isDetail ? null : (
          <Button
            disabled={highConfidenceReady.length === 0 || isBulkPending}
            isLoading={isBulkPending}
            onClick={confirmHighConfidence}
            type="button"
          >
            Xác nhận {highConfidenceReady.length} dòng tin cậy cao
          </Button>
        )}
      </div>

      <div className="mt-4">
        <label className="text-label font-medium text-text-strong" htmlFor={reasonId}>
          Lý do đối soát (ghi vào mọi dòng xác nhận)
        </label>
        <input
          className={`${inputClassName} mt-1`}
          id={reasonId}
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </div>

      {bulkSummary ? (
        <p className="mt-3 text-secondary text-text-default" role="status">
          {bulkSummary}
        </p>
      ) : null}

      {isDetail && confirmDisabledReason ? (
        <p className="mt-3 text-secondary text-text-muted">{confirmDisabledReason}</p>
      ) : null}

      <ul className="mt-4 divide-y divide-border-subtle">
        {/* Detail keeps a confirmed row as a result line until the refreshed queue drops it. */}
        {(isDetail ? suggestions : pending).map((suggestion) => {
          const row = rows[suggestion.transactionId];
          const candidate = suggestion.candidates.find((c) => c.studentId === row?.candidateId);
          const isRowPending = row?.status === "pending";
          if (row?.status === "done") {
            return (
              <li className="py-4" key={suggestion.transactionId}>
                <p className="rounded-md border border-success-border bg-success-bg px-3 py-2 text-secondary text-success-ink" role="status">
                  Đã phân bổ {formatVnd(suggestion.amountVnd)} cho {candidate?.studentName ?? "học sinh đã chọn"}.
                </p>
              </li>
            );
          }
          return (
            <li
              className={isDetail
                ? "grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-start"
                : "grid gap-3 py-4 lg:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_120px_auto] lg:items-start"}
              key={suggestion.transactionId}
            >
              {/* The detail pane already shows amount, time and transfer content above. */}
              {isDetail ? null : (
                <>
                  <div>
                    <p className="text-label font-semibold text-text-strong tabular-nums">{formatVnd(suggestion.amountVnd)}</p>
                    <p className="text-caption text-text-muted">
                      {formatDate(suggestion.transactionAt)} · {suggestion.accountPurpose === "renewal" ? "Gia hạn" : "Tuyển mới"}
                    </p>
                  </div>

                  <p className="break-words text-secondary text-text-default" title={suggestion.transferContent}>
                    {suggestion.transferContent || "(không có nội dung)"}
                  </p>
                </>
              )}

              <div className="min-w-0">
                {suggestion.candidates.length > 1 ? (
                  <select
                    aria-label="Chọn học sinh"
                    className={inputClassName}
                    disabled={isRowPending}
                    onChange={(event) => {
                      const next = suggestion.candidates.find((c) => c.studentId === event.target.value);
                      updateRow(suggestion.transactionId, {
                        candidateId: event.target.value,
                        confirming: false,
                        sessions: next?.suggestedSessions ? String(next.suggestedSessions) : "",
                      });
                    }}
                    value={row?.candidateId ?? ""}
                  >
                    {suggestion.candidates.map((c) => (
                      <option key={c.studentId} value={c.studentId}>
                        {candidateLabel(c)}
                      </option>
                    ))}
                  </select>
                ) : candidate ? (
                  <p className="text-secondary font-medium text-text-strong">{candidateLabel(candidate)}</p>
                ) : null}
                {candidate ? (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-text-muted">
                    <Badge tone={candidate.confidence === "high" ? "success" : "warning"}>
                      {candidate.confidence === "high" ? "Tin cậy cao" : "Cần kiểm tra"}
                    </Badge>
                    <span>Khớp: {candidate.matchReasons.map((r) => reasonLabels[r] ?? r).join(", ")}</span>
                    <span>· PH {candidate.guardianName} ({candidate.guardianPhone})</span>
                    {candidate.unitPriceVnd ? <span>· Đơn giá {formatVnd(candidate.unitPriceVnd)}/buổi</span> : <span>· Chưa có đơn giá</span>}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="sr-only" htmlFor={`${sessionsIdPrefix}-${suggestion.transactionId}`}>
                  Số buổi cộng
                </label>
                <input
                  className={inputClassName}
                  disabled={isRowPending}
                  id={`${sessionsIdPrefix}-${suggestion.transactionId}`}
                  inputMode="numeric"
                  min={1}
                  onChange={(event) => updateRow(suggestion.transactionId, { confirming: false, sessions: event.target.value })}
                  placeholder="Số buổi"
                  type="number"
                  value={row?.sessions ?? ""}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Button
                  aria-expanded={isDetail ? Boolean(row?.confirming) : undefined}
                  disabled={isBulkPending || (isDetail && (Boolean(row?.confirming) || Boolean(confirmDisabledReason)))}
                  isLoading={isRowPending}
                  onClick={() => {
                    if (isDetail) {
                      // Two steps in the detail pane: the first click only opens the confirmation,
                      // so a repeated click in the same spot can never write.
                      if (validateRow(suggestion)) updateRow(suggestion.transactionId, { confirming: true, error: null });
                      return;
                    }
                    void confirmOne(suggestion).then((ok) => {
                      if (ok) router.refresh();
                    });
                  }}
                  size="sm"
                  type="button"
                  variant={candidate?.confidence === "high" && !row?.confirming ? "primary" : "secondary"}
                >
                  Xác nhận
                </Button>
                {row?.error ? (
                  <p className="text-caption text-danger" role="alert">
                    {row.error}
                  </p>
                ) : null}
              </div>

              {isDetail && row?.confirming && candidate && !confirmDisabledReason ? (
                <div className="grid gap-2 rounded-md border border-border-strong bg-surface-sunken p-3 sm:col-span-3">
                  <p className="text-secondary text-text-default">
                    Ghi nhận {formatVnd(suggestion.amountVnd)} cho {candidate.studentName} ({candidate.studentCode}), cộng {row.sessions} buổi.
                    Hệ thống tạo khoản thu và đơn hàng cho giao dịch này.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      isLoading={isRowPending}
                      onClick={() => {
                        void confirmOne(suggestion).then((ok) => {
                          if (ok) router.refresh();
                        });
                      }}
                      size="sm"
                      type="button"
                    >
                      Ghi nhận cho {candidate.studentName}
                    </Button>
                    <Button
                      disabled={isRowPending}
                      onClick={() => updateRow(suggestion.transactionId, { confirming: false })}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function candidateLabel(candidate: AllocationSuggestionCandidate): string {
  return `${candidate.studentName} (${candidate.birthYear}, lớp ${candidate.currentGrade}) · ${candidate.studentCode}`;
}
