"use client";

import { useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import {
  createSepayReceivingAccountVersionAction,
  retireSepayReceivingAccountVersionAction,
  setSepayReceivingAccountApiIdentityAction,
} from "@/features/finance/sepay-receiving-account-actions";
import { formatIsoDate } from "@/lib/datetime";

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

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5">
        <h2 className="text-section-title font-semibold text-text-strong">Thêm phiên bản tài khoản nhận</h2>
        <p className="mt-1 text-secondary text-text-muted">
          Danh mục này xác định riêng tài khoản Tuyển mới và Tái phí. ID tài khoản SePay API dùng để đồng bộ đúng nguồn; API key
          và webhook secret vẫn không hiển thị trên giao diện.
        </p>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          action={(formData) =>
            startTransition(async () =>
              setMessage(
                (
                  await createSepayReceivingAccountVersionAction({
                    accountDisplayName: String(formData.get("accountDisplayName") ?? ""),
                    accountNumber: String(formData.get("accountNumber") ?? ""),
                    bankCode: String(formData.get("bankCode") ?? ""),
                    effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
                    purpose: String(formData.get("purpose")) === "renewal" ? "renewal" : "new_enrollment",
                    reason: String(formData.get("reason") ?? ""),
                    sepayBankAccountId: String(formData.get("sepayBankAccountId") ?? ""),
                  })
                ).message,
              ),
            )
          }
        >
          <div className="grid gap-1.5">
            <Label htmlFor="receiving-purpose" required>Mục đích</Label>
            <Select defaultValue="new_enrollment" id="receiving-purpose" name="purpose">
              <option value="new_enrollment">Tuyển mới</option>
              <option value="renewal">Tái phí</option>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="receiving-bank" required>Ngân hàng</Label>
            <Input id="receiving-bank" name="bankCode" placeholder="VCB" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="receiving-number" required>Số tài khoản nhận</Label>
            <Input id="receiving-number" inputMode="numeric" name="accountNumber" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="receiving-display" required>Tên hiển thị / chủ tài khoản</Label>
            <Input id="receiving-display" name="accountDisplayName" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="receiving-from" required>Hiệu lực từ</Label>
            <Input id="receiving-from" name="effectiveFrom" required type="date" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="receiving-sepay-id">ID tài khoản SePay API</Label>
            <Input id="receiving-sepay-id" name="sepayBankAccountId" placeholder="UUID trong SePay (có thể bổ sung sau)" />
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="receiving-reason" required>Lý do</Label>
            <Input id="receiving-reason" name="reason" placeholder="Ví dụ: Đổi tài khoản nhận tái phí từ tháng 11" required />
          </div>
          <div className="md:col-span-2">
            <Button disabled={isPending} type="submit">Lưu phiên bản</Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5">
        <h2 className="text-section-title font-semibold text-text-strong">Lịch sử tài khoản nhận</h2>
        {versions.length === 0 ? <p className="mt-2 text-secondary text-text-muted">Chưa có tài khoản nhận nào.</p> : null}
        <ul className="mt-3 grid gap-3">
          {versions.map((version) => (
            <li className="rounded-md border border-border-subtle bg-surface-sunken p-3 sm:p-4" key={version.id}>
              <p className="font-semibold text-text-strong">
                {version.purpose === "renewal" ? "Tái phí" : "Tuyển mới"} · {version.bankCode} · {version.accountNumber}
              </p>
              <p className="text-secondary text-text-muted">
                {version.accountDisplayName} · {formatIsoDate(version.effectiveFrom)} → {version.effectiveTo ? formatIsoDate(version.effectiveTo) : "đang hiệu lực"}
              </p>
              <p className="mt-1 break-all text-secondary text-text-muted">ID SePay API: {version.sepayBankAccountId ?? "Chưa thiết lập"}</p>

              <form
                className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end"
                action={(formData) =>
                  startTransition(async () =>
                    setMessage(
                      (
                        await setSepayReceivingAccountApiIdentityAction(
                          version.id,
                          String(formData.get("sepayBankAccountId") ?? ""),
                          String(formData.get("apiIdentityReason") ?? ""),
                        )
                      ).message,
                    ),
                  )
                }
              >
                <Input
                  aria-label={`ID SePay API ${version.accountNumber}`}
                  defaultValue={version.sepayBankAccountId ?? ""}
                  name="sepayBankAccountId"
                  placeholder="UUID tài khoản SePay"
                  required
                />
                <Input aria-label={`Lý do thay đổi ID SePay ${version.accountNumber}`} name="apiIdentityReason" placeholder="Lý do thiết lập / thay đổi" required />
                <Button disabled={isPending} type="submit" variant="secondary">
                  {version.sepayBankAccountId ? "Thay đổi ID SePay API" : "Gắn ID SePay API"}
                </Button>
              </form>
              {version.sepayBankAccountId ? (
                <p className="mt-2 text-caption text-warning">Chỉ thay đổi khi đã đối chiếu đúng tài khoản trên SePay. Mọi thay đổi đều được lưu nhật ký.</p>
              ) : null}

              {!version.effectiveTo ? (
                <form
                  className="mt-3 grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-end"
                  action={(formData) =>
                    startTransition(async () =>
                      setMessage(
                        (
                          await retireSepayReceivingAccountVersionAction(
                            version.id,
                            String(formData.get("effectiveTo") ?? ""),
                            String(formData.get("reason") ?? ""),
                          )
                        ).message,
                      ),
                    )
                  }
                >
                  <Input aria-label={`Kết thúc hiệu lực ${version.accountNumber}`} name="effectiveTo" required type="date" />
                  <Input aria-label={`Lý do kết thúc ${version.accountNumber}`} name="reason" placeholder="Lý do kết thúc" required />
                  <Button disabled={isPending} type="submit" variant="danger">Kết thúc hiệu lực</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {message ? <ResultBanner title={message} tone="info" /> : null}
    </div>
  );
}
