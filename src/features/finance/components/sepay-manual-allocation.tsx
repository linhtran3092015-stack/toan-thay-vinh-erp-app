"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { allocateSepayTuitionAction, getAllocationDetailsAction, searchAllocationStudentsAction } from "../manual-allocation-actions";
import { manualAllocationSchema, type AllocationDetail, type AllocationStudent } from "../manual-allocation-schema";
import type { SepayTransactionReadModel } from "../read-models";
import type { SepayActionOverrides } from "../sepay-action-overrides";

type AllocationActions = Pick<SepayActionOverrides, "allocate" | "getAllocationDetails" | "searchAllocationStudents">;

const money = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
const inputClass = "h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control disabled:bg-disabled-bg";
type Row = { student: AllocationStudent; requestId: string; amount: string; sessions: string; bonus: string };
export function canManuallyAllocate(transaction: SepayTransactionReadModel): boolean {
  return transaction.transferType === "in" && ["unmatched", "amount_mismatch", "account_purpose_mismatch"].includes(transaction.matchStatus);
}

export function SepayManualAllocation({ transaction, canAllocate = false, actions, onOpenDialog }: {
  transaction: SepayTransactionReadModel;
  canAllocate?: boolean;
  actions?: AllocationActions;
  /**
   * Shared-dialog mode: the caller renders one SepayManualAllocationDialog for
   * the whole screen (outside breakpoint-hidden containers), so this renders
   * only the trigger.
   */
  onOpenDialog?: (transaction: SepayTransactionReadModel, trigger: HTMLElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const hasDetails = transaction.matchStatus === "split_allocated";
  if (!hasDetails && (!canAllocate || !canManuallyAllocate(transaction))) return null;
  return <>
    <Button ref={trigger} size="sm" variant="secondary" onClick={() => { if (onOpenDialog) onOpenDialog(transaction, trigger.current); else setOpen(true); }} aria-haspopup="dialog">
      {hasDetails ? "Xem phân bổ" : "Phân bổ học phí"}
    </Button>
    {!onOpenDialog && open ? <AllocationDialog actions={actions} key={transaction.id} titleId={titleId} transaction={transaction} readOnly={hasDetails} onClose={() => setOpen(false)} trigger={trigger} /> : null}
  </>;
}

/** The allocation dialog for shared-dialog callers (see SepayManualAllocation onOpenDialog). */
export function SepayManualAllocationDialog({ actions, onClose, returnFocusRef, transaction }: {
  actions?: AllocationActions;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  transaction: SepayTransactionReadModel;
}) {
  const titleId = useId();
  const fallbackRef = useRef<HTMLElement | null>(null);
  return <AllocationDialog actions={actions} key={transaction.id} titleId={titleId} transaction={transaction} readOnly={transaction.matchStatus === "split_allocated"} onClose={onClose} trigger={returnFocusRef ?? fallbackRef} />;
}

function AllocationDialog({ actions, titleId, transaction, readOnly, onClose, trigger }: {
  actions?: AllocationActions; titleId: string; transaction: SepayTransactionReadModel; readOnly: boolean; onClose: () => void;
  trigger: React.RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const allocate = actions?.allocate ?? allocateSepayTuitionAction;
  const searchStudents = actions?.searchAllocationStudents ?? searchAllocationStudentsAction;
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<AllocationStudent[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  // A ref closes the same-tick double-submit window before React renders disabled controls.
  const submitting = useRef(false);
  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const remaining = transaction.amountVnd - total;
  const payload = { transactionId: transaction.id, reason, allocations: rows.map((r) => ({
    studentId: r.student.id, paymentRequestId: r.requestId || null,
    amountVnd: Number(r.amount), sessions: Number(r.sessions), bonusSessions: Number(r.bonus),
  })) };
  const valid = manualAllocationSchema.safeParse(payload).success && remaining === 0
    && rows.every((r) => r.student.requests.length === 0 || r.requestId !== "");
  function updateRow(index: number, change: Partial<Row>) {
    setRows((current) => current.map((row, i) => i === index ? { ...row, ...change } : row));
    setError("");
  }
  async function search() {
    if (busy || query.trim().length < 2) return;
    setBusy(true); setError(""); setStudents([]); setMessage("");
    try {
      const result = await searchStudents(query);
      if (result.ok) { setStudents(result.data); setMessage(result.data.length ? `Tìm thấy ${result.data.length} học sinh. Chọn đúng mã học sinh và phụ huynh.` : "Không tìm thấy học sinh đang học có phụ huynh chính. Thử tên, mã học sinh hoặc số điện thoại khác."); }
      else setError(result.message);
    } catch { setError("Không tải được học sinh. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (submitting.current || !valid || !review) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const result = await allocate(payload);
      if (result.ok) { router.refresh(); onClose(); }
      else { setError(result.message); setReview(false); }
    } catch { setError("Chưa xác nhận được kết quả. Vui lòng tải lại giao dịch trước khi thử lại."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Dialog isOpen onClose={() => { if (!busy) onClose(); }} returnFocusRef={trigger} ariaLabelledBy={titleId} className="max-w-3xl">
    <div className="max-h-[85vh] space-y-4 overflow-y-auto p-1">
      <h2 id={titleId} className="text-section-title font-semibold">{readOnly ? "Chi tiết phân bổ học phí" : "Phân bổ học phí thủ công"}</h2>
      <div className="rounded-lg bg-surface-sunken p-3 text-secondary">
        <p className="text-lg font-semibold">{money(transaction.amountVnd)}</p>
        <p>{transaction.bankBrand} · {transaction.accountNumber} · {new Date(transaction.transactionAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
        <p className="break-all">Mã giao dịch: {transaction.bankTransactionId}</p>
        <p className="mt-1 break-words">{transaction.transferContent}</p>
      </div>
      {readOnly ? <AllocationDetails loadDetails={actions?.getAllocationDetails} transactionId={transaction.id} /> : transaction.accountPurpose === "unknown" ?
        <p role="alert">Cần xác định tài khoản nhận Tuyển mới/Tái phí trước khi phân bổ học phí.</p> : <>
        <p className="text-secondary text-text-muted">Phân bổ toàn bộ số tiền cho một hoặc nhiều học sinh. Nếu đã có yêu cầu thanh toán, hãy chọn yêu cầu đó để hoàn tất công nợ. Số buổi được ghi nhận theo ngày chuyển tiền.</p>
        {!review ? <>
          <label className="block text-label">Tìm học sinh (tên, mã hoặc SĐT phụ huynh)
            <div className="mt-1 flex gap-2">
              <input className={inputClass} value={query} disabled={busy} maxLength={100} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} />
              <Button variant="secondary" disabled={busy || query.trim().length < 2} onClick={() => void search()}>Tìm học sinh</Button>
            </div>
          </label>
          {message ? <p role="status" className="text-secondary">{message}</p> : null}
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {students.map((student) => <li key={student.id} className="flex items-center justify-between gap-2 rounded border border-border-subtle p-2">
              <div className="text-secondary"><p className="font-semibold">{student.name} · {student.birthYear} · {student.publicCode}</p><p>{student.guardianName} · {student.guardianPhone}</p></div>
              <Button size="sm" variant="secondary" disabled={busy || rows.length >= 50 || rows.some((r) => r.student.id === student.id)} onClick={() => setRows((current) => [...current, { student, requestId: "", amount: remaining > 0 ? String(remaining) : "", sessions: "", bonus: "0" }])}>Chọn {student.publicCode}</Button>
            </li>)}
          </ul>
          {rows.map((row, index) => <fieldset key={row.student.id} className="space-y-3 rounded-lg border border-border-subtle p-3" disabled={busy}>
            <legend className="px-1 font-semibold">{row.student.name} · {row.student.publicCode}</legend>
            <p className="text-secondary text-text-muted">{row.student.birthYear} · {row.student.guardianName} · {row.student.guardianPhone}</p>
            {row.student.requests.length ? <label className="block text-label">Yêu cầu thanh toán của {row.student.publicCode}
              <select className={inputClass} value={row.requestId} onChange={(e) => {
                const request = row.student.requests.find((r) => r.id === e.target.value);
                updateRow(index, { requestId: e.target.value, amount: request ? String(request.amountVnd) : "", sessions: request ? String(request.sessions) : "", bonus: request ? String(request.bonusSessions) : "0" });
              }}>
                <option value="">Chọn yêu cầu chưa thanh toán</option>
                {row.student.requests.map((request) => <option key={request.id} value={request.id} disabled={request.topupType !== (transaction.accountPurpose === "renewal" ? "renewal" : "new")}>
                  {request.code} · {money(request.amountVnd)} · {request.sessions} buổi{request.status === "partially_paid" ? " · Đã thanh toán một phần" : ""}{request.topupType !== (transaction.accountPurpose === "renewal" ? "renewal" : "new") ? " · Khác loại tài khoản nhận" : ""}
                </option>)}
              </select>
              <span className="text-caption text-text-muted">Giữ nguyên tiền và số buổi của yêu cầu. Yêu cầu đã thanh toán một phần cần xử lý riêng.</span>
            </label> : <p className="text-secondary">Chưa có yêu cầu thanh toán: nhập tiền và số buổi theo học phí đã thống nhất.</p>}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-label">Số tiền (đ) · {row.student.publicCode}<input type="number" min="1" max="1000000000000" step="1" className={inputClass} value={row.amount} disabled={busy} onChange={(e) => updateRow(index, { amount: e.target.value })} /></label>
              <label className="text-label">Số buổi mua · {row.student.publicCode}<input type="number" min="1" max="100000" step="1" className={inputClass} value={row.sessions} disabled={busy} onChange={(e) => updateRow(index, { sessions: e.target.value })} /></label>
              <label className="text-label">Số buổi tặng · {row.student.publicCode}<input type="number" min="0" max="100000" step="1" className={inputClass} value={row.bonus} disabled={busy} onChange={(e) => updateRow(index, { bonus: e.target.value })} /></label>
              {row.requestId ? <p className="sm:col-span-3 text-caption text-text-muted">Chuyển <strong>đúng</strong> số tiền → giữ số buổi theo phiếu. Chuyển <strong>nhiều hơn</strong> → phiếu thanh toán đủ, bạn quyết định tổng số buổi cộng (không ít hơn số buổi trên phiếu). Chuyển <strong>ít hơn</strong> → phiếu còn nợ phần còn lại và vẫn mở cho lần chuyển sau.</p> : null}
            </div>
            {Number(row.sessions) > 0 ? <p className="text-caption text-text-muted">Đơn giá quy đổi: {money(Math.floor(Number(row.amount) / Number(row.sessions)))}/buổi. Số tiền thu được giữ nguyên khi đơn giá có phần lẻ.</p> : null}
            <Button size="sm" variant="ghost" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>Bỏ {row.student.publicCode}</Button>
          </fieldset>)}
          <label className="block text-label">Lý do phân bổ<textarea className="mt-1 min-h-20 w-full rounded border border-border-subtle p-3" value={reason} maxLength={1000} disabled={busy} onChange={(e) => setReason(e.target.value)} placeholder="Căn cứ xác định học sinh, mức học phí và số buổi..." /></label>
        </> : <div className="space-y-3 rounded-lg border border-border-subtle p-4">
          <h3 className="font-semibold">Kiểm tra trước khi ghi nhận</h3>
          {rows.map((row) => <p key={row.student.id}>{row.student.name} ({row.student.publicCode}): <strong>{money(Number(row.amount))}</strong> → {row.sessions} buổi mua + {row.bonus} buổi tặng{row.requestId ? ` · ${row.student.requests.find((r) => r.id === row.requestId)?.code}` : " · Thu trực tiếp"}</p>)}
          <p>Lý do: {reason}</p>
          <p className="text-secondary">Xác nhận sẽ tạo khoản thu, đơn hàng và cộng số buổi cho các học sinh trên. Các yêu cầu được chọn sẽ chuyển sang đã thanh toán.</p>
        </div>}
        <div className="rounded bg-surface-sunken p-3" aria-live="polite"><p>Tổng phân bổ: <strong>{money(total)}</strong></p><p className={remaining < 0 ? "text-danger" : ""}>{remaining < 0 ? `Vượt số tiền giao dịch: ${money(-remaining)}` : `Còn chưa phân bổ: ${money(remaining)}`}</p></div>
        {error ? <p role="alert" className="text-danger">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          {review ? <Button variant="secondary" disabled={busy} onClick={() => setReview(false)}>Quay lại chỉnh sửa</Button> : null}
          <Button disabled={!valid || busy} isLoading={busy && review} onClick={() => { if (review) void submit(); else setReview(true); }}>{review ? "Xác nhận phân bổ" : "Kiểm tra phân bổ"}</Button>
        </div>
      </>}
      <Button variant="ghost" disabled={busy} onClick={onClose}>Đóng</Button>
    </div>
  </Dialog>;
}

function AllocationDetails({ loadDetails = getAllocationDetailsAction, transactionId }: { loadDetails?: typeof getAllocationDetailsAction; transactionId: string }) {
  const [details, setDetails] = useState<AllocationDetail[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    loadDetails(transactionId).then((result) => {
      if (!active) return;
      if (result.ok) setDetails(result.data); else setError(result.message);
    }).catch(() => { if (active) setError("Không tải được chi tiết phân bổ."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [loadDetails, transactionId]);
  async function load() {
    setBusy(true); setError("");
    try {
      const result = await loadDetails(transactionId);
      if (result.ok) setDetails(result.data); else setError(result.message);
    } catch { setError("Không tải được chi tiết phân bổ."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    {details === null ? (busy ? <p role="status">Đang tải chi tiết phân bổ...</p> : <Button variant="secondary" onClick={() => void load()}>Thử tải lại</Button>) : details.length === 0 ? <p>Không có chi tiết phân bổ cho giao dịch này.</p> : details.map((d, i) => <div key={i} className="rounded border border-border-subtle p-3 text-secondary">
      <p className="font-semibold">{d.student_name} · {d.student_code}</p>
      <p>{money(d.allocated_amount_vnd)} · {d.allocated_sessions} buổi mua + {d.bonus_sessions} buổi tặng</p>
      <p>{d.payment_request_code ? `Yêu cầu: ${d.payment_request_code}` : "Thu trực tiếp"}</p>
      <p>{d.allocated_by_name ?? "Nhân sự"} · {new Date(d.allocated_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
      <p>Lý do: {d.notes ?? "Không có ghi chú"}</p>
    </div>)}
    {error ? <p role="alert" className="text-danger">{error}</p> : null}
  </div>;
}
