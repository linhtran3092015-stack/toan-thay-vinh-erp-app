"use client";

import { useState, useTransition } from "react";

import {
  createSepayReceivingAccountVersionAction,
  retireSepayReceivingAccountVersionAction,
  setSepayReceivingAccountApiIdentityAction,
} from "@/features/finance/sepay-receiving-account-actions";

export interface ReceivingAccountVersionView {
  accountDisplayName: string;
  accountNumber: string;
  bankCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  id: string;
  purpose: "new_enrollment" | "renewal";
  sepayBankAccountId: string | null;
}

export function SepayReceivingAccountManagement({ versions }: { versions: ReceivingAccountVersionView[] }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return <div className="grid gap-5">
    <section className="rounded-lg border border-border-subtle bg-surface-base p-4">
      <h2 className="font-semibold text-text-strong">Thêm phiên bản tài khoản nhận</h2>
      <p className="mt-1 text-secondary text-text-muted">Danh mục này xác định riêng tài khoản Tuyển mới và Tái phí. ID tài khoản SePay API dùng để đồng bộ đúng nguồn; API key và webhook secret vẫn không hiển thị trên giao diện.</p>
      <form className="mt-4 grid gap-3 md:grid-cols-2" action={(formData) => startTransition(async () => setMessage((await createSepayReceivingAccountVersionAction({ accountDisplayName: String(formData.get("accountDisplayName") ?? ""), accountNumber: String(formData.get("accountNumber") ?? ""), bankCode: String(formData.get("bankCode") ?? ""), effectiveFrom: String(formData.get("effectiveFrom") ?? ""), purpose: String(formData.get("purpose")) === "renewal" ? "renewal" : "new_enrollment", reason: String(formData.get("reason") ?? ""), sepayBankAccountId: String(formData.get("sepayBankAccountId") ?? "") })).message))}>
        <label>Mục đích<select defaultValue="new_enrollment" name="purpose"><option value="new_enrollment">Tuyển mới</option><option value="renewal">Tái phí</option></select></label>
        <label>Ngân hàng<input name="bankCode" placeholder="VCB" required /></label>
        <label>Số tài khoản nhận<input name="accountNumber" required /></label>
        <label>Tên hiển thị / chủ tài khoản<input name="accountDisplayName" required /></label>
        <label>Hiệu lực từ<input name="effectiveFrom" required type="date" /></label>
        <label>ID tài khoản SePay API<input name="sepayBankAccountId" placeholder="UUID trong SePay (có thể bổ sung sau)" /></label>
        <label>Lý do<input name="reason" required /></label>
        <div className="md:col-span-2"><button disabled={isPending} type="submit">Lưu phiên bản</button></div>
      </form>
    </section>
    <section className="rounded-lg border border-border-subtle bg-surface-base p-4">
      <h2 className="font-semibold text-text-strong">Lịch sử tài khoản nhận</h2>
      <ul className="mt-3 grid gap-3">{versions.map((version) => <li className="rounded border border-border-subtle p-3" key={version.id}><p className="font-semibold">{version.purpose === "renewal" ? "Tái phí" : "Tuyển mới"} · {version.bankCode} · {version.accountNumber}</p><p className="text-sm text-text-muted">{version.accountDisplayName} · {version.effectiveFrom} → {version.effectiveTo ?? "đang hiệu lực"}</p><p className="mt-1 break-all text-sm text-text-muted">ID SePay API: {version.sepayBankAccountId ?? "Chưa thiết lập"}</p><form className="mt-3 grid gap-2 md:grid-cols-3" action={(formData) => startTransition(async () => setMessage((await setSepayReceivingAccountApiIdentityAction(version.id, String(formData.get("sepayBankAccountId") ?? ""), String(formData.get("apiIdentityReason") ?? ""))).message))}><input aria-label={`ID SePay API ${version.accountNumber}`} defaultValue={version.sepayBankAccountId ?? ""} name="sepayBankAccountId" placeholder="UUID tài khoản SePay" required /><input aria-label={`Lý do thay đổi ID SePay ${version.accountNumber}`} name="apiIdentityReason" placeholder="Lý do thiết lập / thay đổi" required /><button disabled={isPending} type="submit">{version.sepayBankAccountId ? "Thay đổi ID SePay API" : "Gắn ID SePay API"}</button></form>{version.sepayBankAccountId ? <p className="mt-2 text-caption text-warning">Chỉ thay đổi khi đã đối chiếu đúng tài khoản trên SePay. Mọi thay đổi đều được lưu nhật ký.</p> : null}{!version.effectiveTo ? <form className="mt-3 flex flex-wrap gap-2" action={(formData) => startTransition(async () => setMessage((await retireSepayReceivingAccountVersionAction(version.id, String(formData.get("effectiveTo") ?? ""), String(formData.get("reason") ?? ""))).message))}><input aria-label={`Kết thúc hiệu lực ${version.accountNumber}`} name="effectiveTo" required type="date" /><input aria-label={`Lý do kết thúc ${version.accountNumber}`} name="reason" placeholder="Lý do kết thúc" required /><button disabled={isPending} type="submit">Kết thúc hiệu lực</button></form> : null}</li>)}</ul>
    </section>
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
