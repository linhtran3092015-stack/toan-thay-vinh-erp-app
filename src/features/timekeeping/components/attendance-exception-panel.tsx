"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAttendanceExceptionReviewsAction, decideAttendanceExceptionAction } from "@/features/timekeeping/attendance-exception-actions";
import type { AttendanceExceptionReview } from "@/features/timekeeping/attendance-exception-schemas";
import { formatVietnamDateTime } from "@/features/timekeeping/timekeeping-adjustment-utils";

export function AttendanceExceptionPanel({ canApprove, refreshKey }: { canApprove: boolean; refreshKey: string }) {
  const [reviews, setReviews] = useState<AttendanceExceptionReview[]>([]);
  const [message, setMessage] = useState("Đang tải chấm công chờ duyệt…");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void getAttendanceExceptionReviewsAction().then((result) => {
      if (!active) return;
      if (result.ok) { setReviews(result.reviews); setMessage(""); }
      else setMessage(result.message);
    }).catch(() => { if (active) setMessage("Chưa tải được chấm công chờ duyệt."); });
    return () => { active = false; };
  }, [revision, refreshKey]);
  return <section className="grid gap-4 rounded-lg border border-border-subtle bg-surface-base p-4" aria-label="Chấm công cần xác minh">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-section-title font-semibold">Chấm công cần xác minh</h2>
      <Button type="button" variant="outline" onClick={() => setRevision((value) => value + 1)}>Tải lại</Button>
    </div>
    <p className="text-secondary text-text-muted">Giờ công chờ duyệt hoặc bị từ chối được giữ riêng, chưa cộng vào tổng công đã xác minh. Thời điểm vào/ra gốc được giữ nguyên.</p>
    {message ? <p role="status">{message}</p> : reviews.length === 0 ? <p>Không có chấm công cần xác minh.</p> : null}
    {reviews.map((review) => <ReviewCard key={review.id} review={review} canApprove={canApprove} onSaved={() => setRevision((value) => value + 1)} />)}
  </section>;
}

function ReviewCard({ review, canApprove, onSaved }: { review: AttendanceExceptionReview; canApprove: boolean; onSaved: () => void }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const decide = (decision: "approved" | "rejected") => startTransition(async () => {
    const result = await decideAttendanceExceptionAction({ timeEntryId: review.id, decision, reason });
    setMessage(result.message);
    if (result.status === "success") { onSaved(); router.refresh(); }
  });
  return <article className="grid gap-2 rounded-md border border-border-subtle p-4">
    <div className="flex flex-wrap justify-between gap-2"><strong>{review.staff_name || "Nhân sự"}</strong>
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
        <textarea className="min-h-20 rounded border border-border-subtle p-2" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} disabled={pending} />
      </label>
      <p className="text-caption text-text-muted">Không tự duyệt công của mình. Nếu giờ cần sửa, xử lý điều chỉnh công trước khi duyệt.</p>
      <div className="flex gap-2"><Button disabled={pending || !reason.trim()} onClick={() => decide("approved")}>Duyệt công</Button>
        <Button variant="outline" disabled={pending || !reason.trim()} onClick={() => decide("rejected")}>Từ chối</Button></div>
    </> : null}
    {message ? <p role="status">{message}</p> : null}
  </article>;
}
