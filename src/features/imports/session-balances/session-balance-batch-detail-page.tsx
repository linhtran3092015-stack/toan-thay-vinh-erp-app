"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  approveSessionBalanceImportBatchAction,
  excludeSessionBalanceImportRowAction,
  postSessionBalanceImportBatchAction,
  reconcileSessionBalanceImportBatchAction,
} from "@/features/imports/session-balances/actions";
import type {
  SessionBalanceImportBatchDetail,
  SessionBalanceImportRowRecord,
  SessionBalanceImportRowStatus,
} from "@/features/imports/session-balances/types";

interface SessionBalanceBatchDetailPageProps {
  canApprove: boolean;
  currentUserId: string | null;
  detail: SessionBalanceImportBatchDetail;
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(d);
  } catch {
    return isoString;
  }
}

function getRowStatusTone(
  status: SessionBalanceImportRowStatus,
): "danger" | "neutral" | "success" | "warning" {
  if (status === "invalid") return "danger";
  if (status === "review") return "warning";
  if (status === "excluded") return "neutral";
  if (status === "no_change") return "neutral";
  return "success";
}

function getRowStatusLabel(status: SessionBalanceImportRowStatus): string {
  if (status === "invalid") return "Không hợp lệ";
  if (status === "review") return "Cần xem lại";
  if (status === "excluded") return "Đã loại";
  if (status === "no_change") return "Không thay đổi";
  if (status === "posted") return "Đã ghi sổ";
  return "Hợp lệ";
}

function getBatchStatusTone(
  status: string,
): "danger" | "neutral" | "success" | "warning" {
  if (status === "approved" || status === "posted") return "success";
  if (status === "awaiting_reconciliation" || status === "awaiting_approval")
    return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

function getBatchStatusLabel(status: string): string {
  if (status === "awaiting_reconciliation") return "Đang chờ đối soát";
  if (status === "awaiting_approval") return "Đang chờ phê duyệt";
  if (status === "approved") return "Đã phê duyệt";
  if (status === "posted") return "Đã ghi sổ";
  if (status === "rejected") return "Đã từ chối";
  return status;
}

export function SessionBalanceBatchDetailPage({
  canApprove,
  currentUserId,
  detail,
}: SessionBalanceBatchDetailPageProps) {
  const router = useRouter();
  const { batch, profiles, rows } = detail;

  // Action states
  const [reconcileReason, setReconcileReason] = useState("");
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  const [approveError, setApproveError] = useState<string | null>(null);

  // Post states
  const [postConfirmedCheck, setPostConfirmedCheck] = useState(false);
  const [postConfirmationText, setPostConfirmationText] = useState("");
  const [postError, setPostError] = useState<string | null>(null);

  // Exclude row states
  const [activeExcludeRowId, setActiveExcludeRowId] = useState<string | null>(
    null,
  );
  const [excludeReason, setExcludeReason] = useState("");
  const [excludeError, setExcludeError] = useState<string | null>(null);

  const [isReconciling, startReconcileTransition] = useTransition();
  const [isApproving, startApproveTransition] = useTransition();
  const [isPosting, startPostTransition] = useTransition();
  const [isExcluding, startExcludeTransition] = useTransition();

  const isCreator = currentUserId === batch.created_by;

  const creatorProfile = batch.created_by ? profiles[batch.created_by] : null;
  const reconcilerProfile = batch.reconciled_by
    ? profiles[batch.reconciled_by]
    : null;
  const approverProfile = batch.approved_by
    ? profiles[batch.approved_by]
    : null;
  const posterProfile = batch.posted_by ? profiles[batch.posted_by] : null;

  const remainingReviewCount = batch.review_count ?? 0;
  const remainingInvalidCount = batch.invalid_count ?? 0;

  // Filter rows for Post Preview
  const validRowsToPost = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.validation_status === "valid" || r.validation_status === "posted",
      ),
    [rows],
  );

  const nonPostedRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.validation_status === "excluded" ||
          r.validation_status === "no_change",
      ),
    [rows],
  );

  const totalDeltaSessionsToPost = useMemo(
    () =>
      validRowsToPost.reduce(
        (sum, r) => sum + (r.delta_sessions ?? 0),
        0,
      ),
    [validRowsToPost],
  );

  function handleExcludeRow(rowId: string): void {
    if (!excludeReason.trim()) return;

    setExcludeError(null);
    startExcludeTransition(async () => {
      const result = await excludeSessionBalanceImportRowAction({
        excludedReason: excludeReason.trim(),
        rowId,
      });

      if (!result.ok) {
        setExcludeError(result.message);
        return;
      }

      setActiveExcludeRowId(null);
      setExcludeReason("");
      router.refresh();
    });
  }

  function handleReconcile(): void {
    if (!reconcileReason.trim()) return;

    setReconcileError(null);
    startReconcileTransition(async () => {
      const result = await reconcileSessionBalanceImportBatchAction({
        batchId: batch.id,
        reason: reconcileReason.trim(),
      });

      if (!result.ok) {
        setReconcileError(result.message);
        return;
      }

      router.refresh();
    });
  }

  function handleApprove(): void {
    setApproveError(null);
    startApproveTransition(async () => {
      const result = await approveSessionBalanceImportBatchAction({
        batchId: batch.id,
      });

      if (!result.ok) {
        setApproveError(result.message);
        return;
      }

      router.refresh();
    });
  }

  function handlePost(): void {
    if (!postConfirmedCheck || postConfirmationText.trim() !== "GHI SO DU") {
      return;
    }

    setPostError(null);
    startPostTransition(async () => {
      const result = await postSessionBalanceImportBatchAction({
        batchId: batch.id,
        confirmationText: postConfirmationText.trim(),
        confirmedCheck: postConfirmedCheck,
      });

      if (!result.ok) {
        setPostError(result.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Chi tiết Batch import số dư
            </h1>
            <Badge tone={getBatchStatusTone(batch.status)}>
              {getBatchStatusLabel(batch.status)}
            </Badge>
          </div>
          <p className="text-xs font-mono text-ink-subtle mt-1">ID: {batch.id}</p>
        </div>
        <div className="flex items-center space-x-2">
          {batch.status === "posted" ? (
            <Link href="/finance/session-ledger">
              <Button variant="outline">Xem sổ buổi</Button>
            </Link>
          ) : null}
          <Link href="/imports/session-balances">
            <Button variant="outline">← Quay lại danh sách import</Button>
          </Link>
        </div>
      </div>

      {/* Thông tin batch */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-ink">
            Thông tin Batch đối soát
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-ink-subtle">File nguồn</p>
              <p className="font-medium text-ink">{batch.source_filename}</p>
            </div>
            <div>
              <p className="text-xs text-ink-subtle">SHA-256</p>
              <p className="font-mono text-xs text-ink truncate" title={batch.source_sha256}>
                {batch.source_sha256}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-subtle">Ngày hiệu lực số dư</p>
              <p className="font-medium text-ink">{batch.effective_on}</p>
            </div>
            <div>
              <p className="text-xs text-ink-subtle">Người tạo batch</p>
              <p className="font-medium text-ink">
                {creatorProfile?.full_name ?? batch.created_by ?? "Hệ thống"}{" "}
                <span className="text-xs text-ink-subtle">
                  ({formatDateTime(batch.created_at)})
                </span>
              </p>
            </div>
            {batch.reconciled_by ? (
              <div>
                <p className="text-xs text-ink-subtle">Người đối soát</p>
                <p className="font-medium text-ink">
                  {reconcilerProfile?.full_name ?? batch.reconciled_by}{" "}
                  <span className="text-xs text-ink-subtle">
                    ({formatDateTime(batch.reconciled_at)})
                  </span>
                </p>
              </div>
            ) : null}
            {batch.approved_by ? (
              <div>
                <p className="text-xs text-ink-subtle">Người phê duyệt</p>
                <p className="font-medium text-ink">
                  {approverProfile?.full_name ?? batch.approved_by}{" "}
                  <span className="text-xs text-ink-subtle">
                    ({formatDateTime(batch.approved_at)})
                  </span>
                </p>
              </div>
            ) : null}
            {batch.posted_by ? (
              <div>
                <p className="text-xs text-ink-subtle">Người post sổ</p>
                <p className="font-medium text-ink">
                  {posterProfile?.full_name ?? batch.posted_by}{" "}
                  <span className="text-xs text-ink-subtle">
                    ({formatDateTime(batch.posted_at)})
                  </span>
                </p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-hairline pt-3">
            <p className="text-xs text-ink-subtle">Lý do import / Mục đích batch</p>
            <p className="text-sm font-medium text-ink mt-0.5">{batch.reason}</p>
          </div>
        </CardContent>
      </Card>

      {/* Thống kê dòng */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
        <div className="rounded-md border border-hairline bg-surface-2 p-3 text-center">
          <p className="text-xs text-ink-subtle">Tổng dòng</p>
          <p className="text-xl font-bold text-ink">{batch.row_count ?? 0}</p>
        </div>
        <div className="rounded-md border border-success/30 bg-success/5 p-3 text-center">
          <p className="text-xs text-success">Hợp lệ</p>
          <p className="text-xl font-bold text-success">{batch.valid_count ?? 0}</p>
        </div>
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-center">
          <p className="text-xs text-warning">Cần xem lại</p>
          <p className="text-xl font-bold text-warning">{batch.review_count ?? 0}</p>
        </div>
        <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-center">
          <p className="text-xs text-danger">Không hợp lệ</p>
          <p className="text-xl font-bold text-danger">{batch.invalid_count ?? 0}</p>
        </div>
        <div className="rounded-md border border-hairline bg-surface-1 p-3 text-center">
          <p className="text-xs text-ink-subtle">Không thay đổi</p>
          <p className="text-xl font-bold text-ink-subtle">{batch.no_change_count ?? 0}</p>
        </div>
        <div className="rounded-md border border-hairline bg-surface-1 p-3 text-center">
          <p className="text-xs text-ink-subtle">Đã loại</p>
          <p className="text-xl font-bold text-ink-subtle">{batch.excluded_count ?? 0}</p>
        </div>
        <div className="rounded-md border border-success/30 bg-success/5 p-3 text-center">
          <p className="text-xs text-success">Đã ghi sổ</p>
          <p className="text-xl font-bold text-success">{batch.posted_count ?? 0}</p>
        </div>
      </div>

      {/* WORKFLOW PANELS */}

      {/* 1. Panel Đối soát (Status: awaiting_reconciliation) */}
      {batch.status === "awaiting_reconciliation" ? (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-ink">
              Bước đối soát Batch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-sm text-ink space-y-1">
              <p className="font-semibold text-warning">Hướng dẫn quy trình đối soát:</p>
              <p>• Dòng <strong>Hợp lệ</strong>: sẵn sàng tạo bút toán khi duyệt.</p>
              <p>• Dòng <strong>Không thay đổi</strong> (số dư = 0): giữ nguyên, không tạo giao dịch ledger.</p>
              <p>• Dòng <strong>Cần xem lại</strong> (số dư lẻ hoặc thiếu enrollment): phải được xử lý loại khỏi batch (Exclude) trước khi hoàn tất đối soát.</p>
              <p>• Dòng <strong>Không hợp lệ</strong> (sai/không tìm thấy mã học viên): <strong>Không thể phê duyệt batch này</strong>. Bạn phải sửa file Excel nguồn và khởi tạo batch mới.</p>
            </div>

            {remainingInvalidCount > 0 ? (
              <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger font-medium">
                ⚠️ Batch còn {remainingInvalidCount} dòng KHÔNG HỢP LỆ. Vui lòng sửa lại dữ liệu trong file Excel và khởi tạo batch mới. Batch này không thể gửi đối soát hay phê duyệt.
              </div>
            ) : null}

            {remainingReviewCount > 0 ? (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning font-medium">
                ⚠️ Batch còn {remainingReviewCount} dòng CẦN XEM LẠI. Bạn phải loại bỏ các dòng này khỏi batch (bấm nút &quot;Loại khỏi batch&quot; bên dưới bảng dòng) trước khi bấm Hoàn tất đối soát.
              </div>
            ) : null}

            <div className="border-t border-hairline pt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink" htmlFor="reconcile-reason-input">
                  Lý do hoàn tất đối soát <span className="text-danger">*</span>
                </label>
                <textarea
                  className="w-full rounded-md border border-hairline bg-surface-1 p-3 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[70px]"
                  id="reconcile-reason-input"
                  onChange={(e) => setReconcileReason(e.target.value)}
                  placeholder="Nhập ghi chú đối soát trước khi chuyển phê duyệt..."
                  value={reconcileReason}
                />
              </div>

              {reconcileError ? (
                <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                  {reconcileError}
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button
                  disabled={
                    isReconciling ||
                    remainingReviewCount > 0 ||
                    remainingInvalidCount > 0 ||
                    !reconcileReason.trim()
                  }
                  onClick={handleReconcile}
                  type="button"
                >
                  {isReconciling
                    ? "Đang hoàn tất đối soát..."
                    : "Hoàn tất đối soát -> Gửi phê duyệt"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 2. Panel Phê duyệt (Status: awaiting_approval) */}
      {batch.status === "awaiting_approval" ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-ink">
              Bước phê duyệt số dư đầu kỳ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-info/30 bg-info/5 p-4 text-sm text-ink space-y-1">
              <p className="font-semibold">Thông tin duyệt batch:</p>
              <p>• Số dòng hợp lệ sẵn sàng tạo bút toán: <strong>{batch.valid_count ?? 0}</strong> dòng.</p>
              <p>• Số dòng loại khỏi batch: <strong>{batch.excluded_count ?? 0}</strong> dòng.</p>
              <p>• Số dòng không thay đổi: <strong>{batch.no_change_count ?? 0}</strong> dòng.</p>
            </div>

            {!canApprove ? (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning font-medium">
                🔒 Tài khoản hiện tại chỉ xem thông tin read-only. Bạn không có quyền phê duyệt (`imports.session_balances.approve`).
              </div>
            ) : null}

            {isCreator ? (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning font-medium">
                ⚠️ Nguyên tắc 4 mắt (Maker/Checker): Người tạo batch không được tự phê duyệt batch của mình. Vui lòng nhờ tài khoản quản lý/chủ sở hữu khác phê duyệt.
              </div>
            ) : null}

            {approveError ? (
              <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                {approveError}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                disabled={
                  isApproving ||
                  !canApprove ||
                  isCreator ||
                  remainingReviewCount > 0 ||
                  remainingInvalidCount > 0
                }
                onClick={handleApprove}
                type="button"
              >
                {isApproving ? "Đang phê duyệt..." : "Phê duyệt batch"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 3. Panel Ghi số dư vào sổ buổi (Status: approved) */}
      {batch.status === "approved" ? (
        <Card className="border-danger/40">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-ink">
              Ghi số dư vào sổ buổi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger space-y-1">
              <p className="font-semibold">⚠️ CẢNH BÁO QUAN TRỌNG:</p>
              <p>
                Thao tác này sẽ chính thức ghi các giao dịch số dư đầu kỳ vào sổ cái số buổi (`student_session_ledger_entries`) và không thể sửa/xóa trực tiếp sau khi ghi.
              </p>
            </div>

            <div className="rounded-md border border-hairline bg-surface-2 p-4 text-sm text-ink space-y-2">
              <p className="font-semibold">Tóm tắt các thông số sẽ ghi sổ:</p>
              <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2 lg:grid-cols-3">
                <div>• Batch ID: <span className="font-mono">{batch.id}</span></div>
                <div>• Ngày hiệu lực: <strong>{batch.effective_on}</strong></div>
                <div>• Số dòng hợp lệ sẽ ghi: <strong>{batch.valid_count ?? 0} dòng</strong></div>
                <div>• Số dòng đã loại: <strong>{batch.excluded_count ?? 0} dòng</strong></div>
                <div>• Số dòng không thay đổi: <strong>{batch.no_change_count ?? 0} dòng</strong></div>
                <div>• Tổng delta_sessions dự kiến: <strong>{totalDeltaSessionsToPost > 0 ? `+${totalDeltaSessionsToPost}` : totalDeltaSessionsToPost} buổi</strong></div>
                <div>• Người tạo: <span>{creatorProfile?.full_name ?? batch.created_by ?? "—"}</span></div>
                <div>• Người đối soát: <span>{reconcilerProfile?.full_name ?? batch.reconciled_by ?? "—"}</span></div>
                <div>• Người phê duyệt: <span>{approverProfile?.full_name ?? batch.approved_by ?? "—"}</span></div>
              </div>
            </div>

            {!canApprove ? (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning font-medium">
                🔒 Tài khoản hiện tại không có quyền ghi sổ số dư (`imports.session_balances.approve`).
              </div>
            ) : null}

            <div className="border-t border-hairline pt-4 space-y-3">
              <div className="flex items-start space-x-2">
                <input
                  className="mt-1 h-4 w-4 rounded border-hairline text-primary focus:ring-primary"
                  id="post-confirmed-check"
                  onChange={(e) => setPostConfirmedCheck(e.target.checked)}
                  type="checkbox"
                  checked={postConfirmedCheck}
                />
                <label className="text-sm text-ink cursor-pointer" htmlFor="post-confirmed-check">
                  Tôi xác nhận đã kiểm tra batch đã phê duyệt và đồng ý ghi các số dư hợp lệ vào sổ buổi.
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-ink-subtle" htmlFor="post-confirmation-text-input">
                  Nhập chính xác cụm từ <strong>GHI SO DU</strong> để xác nhận:
                </label>
                <input
                  className="h-10 w-full max-w-xs rounded-md border border-hairline bg-surface-1 px-3 text-sm font-mono text-ink outline-none"
                  id="post-confirmation-text-input"
                  onChange={(e) => setPostConfirmationText(e.target.value)}
                  placeholder="GHI SO DU"
                  value={postConfirmationText}
                />
              </div>

              {postError ? (
                <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                  {postError}
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button
                  disabled={
                    isPosting ||
                    !canApprove ||
                    !postConfirmedCheck ||
                    postConfirmationText.trim() !== "GHI SO DU" ||
                    (batch.valid_count ?? 0) === 0 ||
                    (batch.posted_count ?? 0) > 0
                  }
                  onClick={handlePost}
                  type="button"
                  variant="danger"
                >
                  {isPosting ? "Đang ghi vào sổ buổi..." : "Ghi số dư vào sổ buổi"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 4. Status Posted Callout */}
      {batch.status === "posted" ? (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="pt-6 space-y-3">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-success">
                ✅ Đã ghi số dư đầu kỳ vào sổ buổi ({batch.posted_count ?? 0} bút toán đã được tạo thành công).
              </h3>
              <p className="text-sm text-ink-subtle">
                Ghi sổ hoàn tất bởi <strong>{posterProfile?.full_name ?? batch.posted_by ?? "Hệ thống"}</strong> lúc <strong>{formatDateTime(batch.posted_at)}</strong>.
              </p>
            </div>
            <div className="flex justify-end border-t border-hairline pt-3">
              <Link href="/finance/session-ledger">
                <Button variant="outline">Xem sổ buổi →</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Section Rows sẽ ghi (Valid rows to post preview) */}
      {validRowsToPost.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-ink">
              Các dòng hợp lệ được ghi sổ ({validRowsToPost.length} dòng)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-hairline">
              <table className="w-full text-left text-sm text-ink">
                <thead className="border-b border-hairline bg-surface-2 text-xs font-semibold uppercase text-ink-subtle">
                  <tr>
                    <th className="px-3 py-2 text-center w-14">Dòng</th>
                    <th className="px-3 py-2">Mã học viên</th>
                    <th className="px-3 py-2">Tên nguồn</th>
                    <th className="px-3 py-2 text-right">Số dư nguồn</th>
                    <th className="px-3 py-2 text-right">Delta buổi</th>
                    <th className="px-3 py-2 text-right">Hiện tại</th>
                    <th className="px-3 py-2 text-right">Dự kiến sau</th>
                    <th className="px-3 py-2">Ngày hiệu lực</th>
                    <th className="px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {validRowsToPost.map((row) => (
                    <tr className="hover:bg-surface-2/50" key={row.id}>
                      <td className="px-3 py-2 text-center font-mono text-ink-subtle">
                        {row.source_row_number}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium">
                        {row.student_public_code}
                      </td>
                      <td className="px-3 py-2">
                        {row.source_student_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {row.source_balance}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-success">
                        {row.delta_sessions !== null ? (row.delta_sessions > 0 ? `+${row.delta_sessions}` : row.delta_sessions) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ink-subtle">
                        {row.current_balance_before !== null
                          ? row.current_balance_before
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ink-subtle">
                        {row.expected_balance_after !== null
                          ? row.expected_balance_after
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs font-medium">
                        {batch.effective_on}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={getRowStatusTone(row.validation_status)}>
                          {getRowStatusLabel(row.validation_status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Section Rows không ghi sổ (Excluded / No Change) */}
      {nonPostedRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-ink">
              Các dòng không ghi vào sổ buổi ({nonPostedRows.length} dòng)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-hairline">
              <table className="w-full text-left text-sm text-ink">
                <thead className="border-b border-hairline bg-surface-2 text-xs font-semibold uppercase text-ink-subtle">
                  <tr>
                    <th className="px-3 py-2 text-center w-14">Dòng</th>
                    <th className="px-3 py-2">Mã học viên</th>
                    <th className="px-3 py-2">Tên nguồn</th>
                    <th className="px-3 py-2 text-right">Số dư nguồn</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Lý do / Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {nonPostedRows.map((row) => (
                    <tr className="hover:bg-surface-2/50" key={row.id}>
                      <td className="px-3 py-2 text-center font-mono text-ink-subtle">
                        {row.source_row_number}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium">
                        {row.student_public_code}
                      </td>
                      <td className="px-3 py-2">
                        {row.source_student_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {row.source_balance}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={getRowStatusTone(row.validation_status)}>
                          {getRowStatusLabel(row.validation_status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-subtle">
                        {row.validation_status === "excluded"
                          ? `Lý do loại: ${row.excluded_reason ?? "—"}`
                          : row.validation_message ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Bảng tổng hợp toàn bộ các dòng */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-ink">
            Toàn bộ danh sách dòng dữ liệu ({rows.length} dòng)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-hairline">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-hairline bg-surface-2 text-xs font-semibold uppercase text-ink-subtle">
                <tr>
                  <th className="px-3 py-2 text-center w-14">Dòng</th>
                  <th className="px-3 py-2">Mã học viên</th>
                  <th className="px-3 py-2">Tên nguồn</th>
                  <th className="px-3 py-2 text-right">Số dư nguồn</th>
                  <th className="px-3 py-2 text-right">Delta buổi</th>
                  <th className="px-3 py-2 text-right">Hiện tại</th>
                  <th className="px-3 py-2 text-right">Dự kiến sau</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Thông báo / Ghi chú</th>
                  {batch.status === "awaiting_reconciliation" ? (
                    <th className="px-3 py-2 text-center">Hành động</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((row: SessionBalanceImportRowRecord) => {
                  const tone = getRowStatusTone(row.validation_status);
                  const label = getRowStatusLabel(row.validation_status);
                  const isRowReview = row.validation_status === "review";
                  const isExcludingThisRow = activeExcludeRowId === row.id;

                  return (
                    <tr className="hover:bg-surface-2/50" key={row.id}>
                      <td className="px-3 py-2 text-center font-mono text-ink-subtle">
                        {row.source_row_number}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium">
                        {row.student_public_code}
                      </td>
                      <td className="px-3 py-2">
                        {row.source_student_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {row.source_balance}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {row.delta_sessions !== null ? row.delta_sessions : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ink-subtle">
                        {row.current_balance_before !== null
                          ? row.current_balance_before
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ink-subtle">
                        {row.expected_balance_after !== null
                          ? row.expected_balance_after
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={tone}>{label}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-subtle">
                        {row.validation_status === "excluded" ? (
                          <span className="text-ink">
                            Lý do loại: <em>{row.excluded_reason}</em>
                          </span>
                        ) : (
                          row.validation_message ?? "—"
                        )}
                      </td>

                      {batch.status === "awaiting_reconciliation" ? (
                        <td className="px-3 py-2 text-center">
                          {isRowReview ? (
                            isExcludingThisRow ? (
                              <div className="flex flex-col space-y-1.5 min-w-[220px]">
                                <input
                                  className="h-8 w-full rounded border border-hairline bg-surface-1 px-2 text-xs text-ink outline-none"
                                  onChange={(e) =>
                                    setExcludeReason(e.target.value)
                                  }
                                  placeholder="Nhập lý do loại..."
                                  value={excludeReason}
                                />
                                {excludeError ? (
                                  <p className="text-xs text-danger">
                                    {excludeError}
                                  </p>
                                ) : null}
                                <div className="flex items-center justify-end space-x-1">
                                  <Button
                                    onClick={() => {
                                      setActiveExcludeRowId(null);
                                      setExcludeReason("");
                                    }}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    Hủy
                                  </Button>
                                  <Button
                                    disabled={
                                      isExcluding || !excludeReason.trim()
                                    }
                                    onClick={() => handleExcludeRow(row.id)}
                                    size="sm"
                                    variant="danger"
                                  >
                                    Xác nhận loại
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                onClick={() => {
                                  setActiveExcludeRowId(row.id);
                                  setExcludeReason(
                                    row.validation_code ===
                                      "BALANCE_HAS_FRACTIONAL_PART"
                                      ? "Số dư nguồn có phần lẻ; sổ buổi hiện chỉ hỗ trợ số nguyên."
                                      : "Chưa có enrollment đang active.",
                                  );
                                }}
                                size="sm"
                                variant="outline"
                              >
                                Loại khỏi batch
                              </Button>
                            )
                          ) : row.validation_status === "invalid" ? (
                            <span className="text-xs font-semibold text-danger">
                              Cần tạo batch mới
                            </span>
                          ) : (
                            <span className="text-xs text-ink-subtle">—</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
