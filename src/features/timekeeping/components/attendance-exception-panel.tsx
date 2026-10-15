"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAttendanceExceptionReviewsAction, decideAttendanceExceptionAction } from "@/features/timekeeping/attendance-exception-actions";
import type { AttendanceExceptionReview } from "@/features/timekeeping/attendance-exception-schemas";
import { formatVietnamDateTime } from "@/features/timekeeping/timekeeping-adjustment-utils";
import type { TimekeepingActionOverrides } from "@/features/timekeeping/timekeeping-action-overrides";

export function AttendanceExceptionPanel({ actions, canApprove, refreshKey }: {
  /** Inert replacements for the /dev/timekeeping preview; real pages pass nothing. */
  actions?: TimekeepingActionOverrides;
  canApprove: boolean;
  refreshKey: string;
}) {
  const getReviews = actions?.getAttendanceExceptionReviews ?? getAttendanceExceptionReviewsAction;
  const [reviews, setReviews] = useState<AttendanceExceptionReview[]>([]);
  const [message, setMessage] = useState("Đang tải chấm công chờ duyệt…");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void getReviews().then((result) => {
      if (!active) return;
      if (result.ok) { setReviews(result.reviews); setMessage(""); }
      else setMessage(result.message);
    }).catch(() => { if (active) setMessage("Chưa tải được chấm công chờ duyệt."); });
    return () => { active = false; };
  }, [getReviews, revision, refreshKey]);
  return <section className="grid min-w-0 gap-3 rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)] sm:p-5" aria-label="Chấm công cần xác minh">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-section-title font-semibold text-text-strong">Chấm công cần xác minh</h2>
      <Button className="max-md:h-11" type="button" variant="secondary" onClick={() => setRevision((value) => value + 1)}>Tải lại</Button>
    </div>
    <p className="text-secondary text-text-muted">Giờ công chờ duyệt hoặc bị từ chối được giữ riêng, chưa cộng vào tổng công đã xác minh. Thời điểm vào/ra gốc được giữ nguyên.</p>
    {message ? <p className="text-body text-text-muted" role="status">{message}</p> : reviews.length === 0 ? <p className="text-body text-text-muted">Không có chấm công cần xác minh.</p> : null}
    {reviews.map((review) => <ReviewCard actions={actions} key={review.id} review={review} canApprove={canApprove} onSaved={() => setRevision((value) => value + 1)} />)}
  </section>;
}

function ReviewCard({ actions, review, canApprove, onSaved }: { actions?: TimekeepingActionOverrides; review: AttendanceExceptionReview; canApprove: boolean; onSaved: () => void }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const decide = (decision: "approved" | "rejected") => startTransition(async () => {
    const result = await (actions?.decideAttendanceException ?? decideAttendanceExceptionAction)({ timeEntryId: review.id, decision, reason });
    setMessage(result.message);
    if (result.status === "success") { onSaved(); router.refresh(); }
  });
  return <article className="grid gap-1.5 rounded-md border border-border-subtle p-4 text-body text-text-default">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="font-semibold text-text-strong">{review.staff_name || "Nhân sự"}</strong>
      <Badge tone={review.status === "approved" ? "success" : review.status === "rejected" ? "danger" : "warning"}>
        {review.status === "approved" ? "Đã duyệt" : review.status === "rejected" ? "Từ chối" : "Chờ duyệt"}
      </Badge>
    </div>
    <p>Vào: {formatVietnamDateTime(review.check_in_at)} · Ra: {review.check_out_at ? formatVietnamDateTime(review.check_out_at) : "Đang làm việc"}</p>
    <p>GPS khi vào: {review.has_check_in_gps ? "Có" : "Chưa có"} · GPS khi ra: {review.has_check_out_gps ? "Có" : "Chưa có"}</p>
    {review.check_in_reason ? <p>Lý do khi vào: {review.check_in_reason}</p> : null}
    {review.check_out_reason ? <p>Lý do khi ra: {review.check_out_reason}</p> : null}
    {review.decision_reason ? <p>Quyết định: {review.decision_reason}</p> : null}
    {canApprove && review.status === "pending" ? review.entry_status === "open" ? <p>Chờ nhân sự check-out để duyệt đủ lượt vào/ra.</p> : <>
      <label className="grid gap-1">Lý do quyết định
        <textarea className="min-h-20 rounded-md border border-border-strong p-2" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} disabled={pending} />
      </label>
      <p className="text-caption text-text-muted">Không tự duyệt công của mình. Nếu giờ cần sửa, xử lý điều chỉnh công trước khi duyệt.</p>
      <div className="flex gap-2"><Button className="max-md:h-11" disabled={pending || !reason.trim()} onClick={() => decide("approved")}>Duyệt công</Button>
        <Button className="max-md:h-11" variant="secondary" disabled={pending || !reason.trim()} onClick={() => decide("rejected")}>Từ chối</Button></div>
    </> : null}
    {message ? <p role="status">{message}</p> : null}
  </article>;
}
