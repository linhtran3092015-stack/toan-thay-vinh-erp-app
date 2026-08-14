/* eslint-disable @next/next/no-img-element -- the payment provider supplies a print-stable QR URL. */
import { notFound } from "next/navigation";

import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { buildLockedVietQrPaymentDetails } from "@/features/finance/vietqr";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TuitionReissueForm } from "@/features/tuition/reissue-form";

interface FeeNoticePageProps { params: Promise<{ itemId: string; periodId: string }> }

export default async function FeeNoticePage({ params }: FeeNoticePageProps) {
  const { itemId, periodId } = await params;
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("tuition_periods.view")) return <PermissionDeniedState title="Không có quyền xem Phiếu học phí" description="Tài khoản hiện tại không có quyền tuition_periods.view." />;
  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase.from("tuition_collection_items").select("id, payable_amount_vnd, payable_sessions, opening_balance_sessions, credit_offset_sessions, debit_carry_sessions, status, student_snapshot, source_snapshot, receipt_template_snapshot, payment_contract_snapshot, payment_request_id, period_id, receipt_template_version_id, reissued_from_item_id, created_at").eq("id", itemId).eq("period_id", periodId).maybeSingle();
  if (!item) notFound();
  const [{ data: period }, { data: lines }, { data: replacements }] = await Promise.all([
    supabase.from("tuition_collection_periods").select("name, due_on").eq("id", periodId).maybeSingle(),
    supabase.from("tuition_collection_item_lines").select("line_kind, unit_price_vnd, session_count, payable_session_count, amount_vnd").eq("item_id", itemId).order("session_date"),
    supabase.from("tuition_collection_items").select("id,created_at").eq("reissued_from_item_id",item.id),
  ]);
  const student = item.student_snapshot as { full_name?: string; public_code?: string };
  const source = item.source_snapshot as { name?: string; code?: string };
  const groupedRates = new Map<number, { amount: number; sessions: number }>();
  for (const line of lines ?? []) { const rate = Number(line.unit_price_vnd); const current = groupedRates.get(rate) ?? { amount: 0, sessions: 0 }; current.amount += Number(line.amount_vnd); current.sessions += Number(line.payable_session_count); groupedRates.set(rate, current); }
  let qrImageUrl: string | null = null;
  let accountHolder: string | null = null;
  const payment = item.payment_contract_snapshot as { account_display_name?: string; account_number?: string; amount_vnd?: number; bank_code?: string; transfer_code?: string };
  const template = item.receipt_template_snapshot as { announcement?: string; center_display_name?: string; footer?: string; title?: string };
  const title = (template.title || "HỌC PHÍ {PERIOD_NAME}").replace("{PERIOD_NAME}", period?.name ?? "Kỳ thu học phí");
  const canAdjust = permissions.permissions.includes("tuition_periods.adjust");
  if (payment.transfer_code && Number(item.payable_amount_vnd) > 0) {
    try { const qr = buildLockedVietQrPaymentDetails({ accountDisplayName: payment.account_display_name ?? "", accountNumber: payment.account_number ?? "", amountVnd: Number(payment.amount_vnd), bankCode: payment.bank_code ?? "", transferCode: payment.transfer_code }); qrImageUrl = qr.imageUrl; accountHolder = qr.accountHolder ?? null; } catch { /* A malformed historic contract is intentionally not replaced from current settings. */ }
  }
  return <main className="fee-notice mx-auto w-full max-w-[210mm] bg-white p-5 text-slate-950 print:p-[12mm]" aria-label="Phiếu học phí"><header className="border-b-2 border-slate-900 pb-4 text-center"><p className="text-sm font-semibold">{template.center_display_name || "Trung tâm Toán Thầy Vinh"}</p><h1 className="mt-2 text-2xl font-bold">{title}</h1><p className="mt-1 text-sm">{period?.name ?? "Kỳ thu học phí"}</p></header>{item.reissued_from_item_id?<p className="mt-3 font-semibold text-amber-800">BẢN THAY THẾ HIỆN HÀNH</p>:replacements?.length?<p className="mt-3 font-semibold text-slate-700">BẢN GỐC · Đã có {replacements.length} bản thay thế</p>:<p className="mt-3 font-semibold">BẢN GỐC</p>}{template.announcement?<p className="mt-4 rounded border border-slate-300 p-3 text-sm">{template.announcement}</p>:null}<section className="mt-5 grid gap-3 rounded border border-slate-300 p-4 sm:grid-cols-2"><Info label="Học viên" value={student.full_name ?? "—"} /><Info label="Mã học viên" value={student.public_code ?? "—"} /><Info label="Nguồn học viên" value={source.name ?? source.code ?? "—"} /><Info label="Số buổi cần thanh toán" value={`${item.payable_sessions} buổi`} /><Info label="Số dư đầu kỳ" value={`${item.opening_balance_sessions} buổi`} /><Info label="Mẫu phiếu đã khóa" value={item.receipt_template_version_id ?? "—"} /></section><section className="mt-5"><h2 className="font-bold">Chi tiết học phí</h2><div className="mt-2 divide-y divide-slate-200 rounded border border-slate-300">{Array.from(groupedRates.entries()).map(([rate, value]) => <div className="flex items-center justify-between gap-4 p-3" key={rate}><span>{value.sessions} buổi × {formatVnd(rate)}</span><strong>{formatVnd(value.amount)}</strong></div>)}</div>{item.credit_offset_sessions > 0 ? <p className="mt-2 text-sm text-slate-600">Đã bù trừ số dư dương: {item.credit_offset_sessions} buổi.</p> : null}{item.debit_carry_sessions > 0 ? <p className="mt-2 text-sm text-slate-600">Bao gồm số dư âm đầu kỳ: {item.debit_carry_sessions} buổi.</p> : null}</section><section className="mt-6 rounded border-2 border-slate-900 p-5 text-center"><p className="text-sm font-bold">TỔNG CẦN THANH TOÁN</p><p className="mt-2 text-3xl font-black">{formatVnd(Number(item.payable_amount_vnd))}</p>{item.status === "no_payment" ? <p className="mt-4 font-semibold">Không cần thanh toán</p> : qrImageUrl ? <><img alt="Mã QR thanh toán tái phí" className="mx-auto mt-4 h-48 w-48" src={qrImageUrl} /><p className="mt-3 font-semibold">Quét QR để thanh toán</p><p className="mt-1 text-sm">Tài khoản nhận: {accountHolder}</p><p className="mt-3 text-sm">Nội dung chuyển khoản</p><p className="font-mono font-bold">{payment.transfer_code}</p><p className="mt-3 text-xs text-slate-600">QR đã điền sẵn đúng tài khoản Tái phí, số tiền và nội dung. Vui lòng kiểm tra lại trước khi xác nhận.</p></> : <p className="mt-4 text-sm text-red-700">Hợp đồng thanh toán snapshot không đầy đủ; không hiển thị QR thay thế.</p>}{period?.due_on ? <p className="mt-4 text-sm">Hạn thanh toán: <strong>{period.due_on}</strong></p> : null}</section>{canAdjust && !(replacements?.length) ? <TuitionReissueForm amountVnd={Number(item.payable_amount_vnd)} itemId={item.id}/> : null}<footer className="mt-6 text-center text-xs text-slate-600">{template.footer || "Phiếu được tạo từ snapshot đã khóa. Thay đổi đơn giá về sau không làm thay đổi phiếu này."}</footer></main>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-600">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function formatVnd(value: number): string { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value); }
