"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  previewSepayHistorySyncAction,
  syncSepayHistoryAction,
  type SepayHistorySyncActionResult,
} from "@/features/finance/sepay-history-sync-actions";

const vietnamDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

export interface SepaySyncAccountView {
  accountNumber: string;
  bankCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  id: string;
  purpose: "new_enrollment" | "renewal";
  sepayBankAccountId: string | null;
}

export interface SepaySyncRunView {
  accountVersionId: string;
  duplicateCount: number;
  dateFrom: string;
  dateTo: string;
  errorCode: string | null;
  id: string;
  recordedCount: number;
  manualReviewCount: number;
  pagesProcessed: number;
  startedAt: string;
  status: "running" | "completed" | "failed";
  syncSessionId: string;
  totalSeen: number;
}

interface SepayHistorySyncPanelProps {
  accounts: SepaySyncAccountView[];
  defaultDateFrom: string;
  defaultDateTo: string;
  recentRuns?: SepaySyncRunView[];
}

export function SepayHistorySyncPanel({
  accounts,
  defaultDateFrom,
  defaultDateTo,
  recentRuns = [],
}: SepayHistorySyncPanelProps) {
  const configuredAccounts = accounts.filter((account) => (
    account.sepayBankAccountId
    && account.effectiveFrom <= defaultDateFrom
    && (account.effectiveTo === null || account.effectiveTo >= defaultDateTo)
  ));
  const [selectedIds, setSelectedIds] = useState<string[]>(configuredAccounts.map((account) => account.id));
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [preview, setPreview] = useState<SepayHistorySyncActionResult | null>(null);
  const [result, setResult] = useState<SepayHistorySyncActionResult | null>(null);
  const [syncSessionId, setSyncSessionId] = useState<string | null>(null);
  const [finishedSessionIds, setFinishedSessionIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function clearPreview(): void {
    setPreview(null);
    setResult(null);
    setSyncSessionId(null);
  }

  function toggleAccount(id: string): void {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
    clearPreview();
  }

  const input = { accountVersionIds: selectedIds, dateFrom, dateTo };

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-base p-4" aria-labelledby="sepay-history-sync-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-strong" id="sepay-history-sync-title">Đồng bộ lịch sử SePay</h2>
          <p className="mt-1 text-secondary text-text-muted">
            Nhập giao dịch cũ ở chế độ chờ đối soát. Bước này không tự ghi học phí và không tạo đơn hàng.
          </p>
        </div>
        <Link className="text-control font-semibold text-action-primary hover:underline" href="/finance/receiving-accounts">
          Thiết lập tài khoản nhận
        </Link>
      </div>

      <fieldset className="mt-4 grid gap-2">
        <legend className="text-control font-semibold text-text-strong">Tài khoản cần đồng bộ</legend>
        {accounts.map((account) => (
          <label className="flex items-start gap-2 text-secondary" key={account.id}>
            <input
              checked={selectedIds.includes(account.id)}
              disabled={!account.sepayBankAccountId || isPending}
              onChange={() => toggleAccount(account.id)}
              type="checkbox"
            />
            <span>
              <span className="font-semibold text-text-default">
                {account.purpose === "renewal" ? "Tái phí" : "Tuyển mới"} · {account.bankCode} · {account.accountNumber}
              </span>
              <span className="block text-caption text-text-muted">
                Hiệu lực {account.effectiveFrom} → {account.effectiveTo ?? "hiện tại"}
                {!account.sepayBankAccountId ? " · Chưa có ID SePay API" : ""}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-control font-semibold text-text-strong">
          Từ ngày
          <input
            className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 font-normal"
            disabled={isPending}
            onChange={(event) => { setDateFrom(event.target.value); clearPreview(); }}
            type="date"
            value={dateFrom}
          />
        </label>
        <label className="grid gap-1 text-control font-semibold text-text-strong">
          Đến ngày
          <input
            className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 font-normal"
            disabled={isPending}
            onChange={(event) => { setDateTo(event.target.value); clearPreview(); }}
            type="date"
            value={dateTo}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={selectedIds.length === 0}
          isLoading={isPending}
          onClick={() => startTransition(async () => {
            setResult(null);
            setPreview(null);
            try {
              setPreview(await previewSepayHistorySyncAction(input));
            } catch {
              setPreview({ ok: false, message: "Không thể kết nối để xem trước. Vui lòng thử lại." });
            }
          })}
          variant="secondary"
        >
          Xem trước
        </Button>
        <Button
          disabled={!preview?.ok || selectedIds.length === 0}
          isLoading={isPending}
          onClick={() => startTransition(async () => {
            const resumableRun = recentRuns.find((run) => (
              run.status === "running"
              && !finishedSessionIds.includes(run.syncSessionId)
              && run.dateFrom === dateFrom
              && run.dateTo === dateTo
              && selectedIds.includes(run.accountVersionId)
            ));
            const sessionId = syncSessionId ?? resumableRun?.syncSessionId ?? globalThis.crypto.randomUUID();
            setSyncSessionId(sessionId);
            try {
            let syncResult = await syncSepayHistoryAction({ ...input, syncSessionId: sessionId });
            let requestsMade = 1;
            const maximumRequests = selectedIds.length * 10 + 2;
            while (syncResult.ok && syncResult.continuationRequired && requestsMade < maximumRequests) {
              syncResult = await syncSepayHistoryAction({ ...input, syncSessionId: sessionId });
              requestsMade += 1;
            }
            if (syncResult.ok && syncResult.continuationRequired) {
              syncResult = {
                message: "Đồng bộ chưa hoàn tất trong giới hạn an toàn. Tiến độ đã được lưu; hãy bấm xác nhận để tiếp tục.",
                ok: false,
                retryable: true,
              };
            }
            setResult(syncResult);
            if (syncResult.ok) {
              setPreview(null);
              setSyncSessionId(null);
              setFinishedSessionIds((current) => [...current, sessionId]);
            } else if (!syncResult.retryable) {
              setPreview(null);
              setSyncSessionId(null);
              setFinishedSessionIds((current) => [...current, sessionId]);
            }
            } catch {
              setResult({
                ok: false,
                retryable: true,
                message: "Kết nối bị gián đoạn. Hãy bấm xác nhận để tiếp tục phiên đồng bộ; hệ thống sẽ kiểm tra tiến độ đã lưu.",
              });
            }
          })}
        >
          Xác nhận nhập lịch sử
        </Button>
      </div>

      {preview ? (
        <div className={`mt-4 rounded-md border px-4 py-3 text-secondary ${preview.ok ? "border-info-border bg-info-bg text-info" : "border-danger-border bg-danger-bg text-danger"}`} role="status">
          <p>{preview.message}</p>
          {preview.ok ? <ul className="mt-2 list-disc pl-5">{preview.accounts.map((account) => <li key={account.accountVersionId}>{account.label}: {account.totalAvailable} giao dịch</li>)}</ul> : null}
        </div>
      ) : null}

      {result ? (
        <p className={`mt-4 rounded-md border px-4 py-3 text-secondary ${result.ok ? "border-success-border bg-success-bg text-success" : "border-danger-border bg-danger-bg text-danger"}`} role="status">
          {result.message}
        </p>
      ) : null}

      {recentRuns.length > 0 ? (
        <div className="mt-5 border-t border-border-subtle pt-4">
          <h3 className="text-control font-semibold text-text-strong">Các lần đồng bộ gần đây</h3>
          <ul className="mt-2 grid gap-2 text-caption text-text-muted">
            {recentRuns.map((run) => {
              const account = accounts.find((item) => item.id === run.accountVersionId);
              return (
                <li className="rounded-md border border-border-subtle px-3 py-2" key={run.id}>
                  <span className="font-semibold text-text-default">
                    {account ? `${account.purpose === "renewal" ? "Tái phí" : "Tuyển mới"} · ${account.bankCode} · ${account.accountNumber}` : "Tài khoản cũ"}
                  </span>
                  {` · ${run.dateFrom} → ${run.dateTo} · ${run.status === "completed" ? "Hoàn tất" : run.status === "failed" ? "Có lỗi / đã nhập một phần" : "Đang chạy"}`}
                  <span className="block">
                    {`Bắt đầu ${vietnamDateTimeFormatter.format(new Date(run.startedAt))} · ${run.pagesProcessed} trang · đã đọc ${run.totalSeen}, mới ${run.recordedCount}, trùng ${run.duplicateCount}, cần đối soát ${run.manualReviewCount}`}
                  </span>
                  {run.errorCode ? <span className="block text-danger">{run.errorCode}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
