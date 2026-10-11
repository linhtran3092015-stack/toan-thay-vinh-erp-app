"use client";

import { useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { reissueTuitionItemAction } from "@/features/tuition/actions";

export function TuitionReissueForm({ amountVnd, itemId }: { amountVnd: number; itemId: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <form
      className="mt-5 grid gap-3 border-t border-border-subtle pt-4"
      action={(formData) =>
        start(async () =>
          setMessage((await reissueTuitionItemAction(itemId, Number(formData.get("amount")), String(formData.get("reason")))).message),
        )
      }
    >
      <div>
        <h2 className="text-section-title font-semibold text-text-strong">Điều chỉnh / phát hành lại</h2>
        <p className="mt-1 text-secondary text-text-muted">
          Phiếu gốc không bị sửa. Phiếu thay thế có yêu cầu tái phí và QR mới nếu số tiền lớn hơn 0.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`reissue-amount-${itemId}`} required>Số tiền mới (₫)</Label>
          <Input defaultValue={amountVnd} id={`reissue-amount-${itemId}`} inputMode="numeric" min="0" name="amount" required step="1000" type="number" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`reissue-reason-${itemId}`} required>Lý do điều chỉnh</Label>
          <Input id={`reissue-reason-${itemId}`} name="reason" placeholder="Ví dụ: Giảm 2 buổi nghỉ có phép" required />
        </div>
      </div>
      <div>
        <Button disabled={pending} type="submit" variant="secondary">Tạo phiếu thay thế</Button>
      </div>
      {message ? <ResultBanner title={message} tone="info" /> : null}
    </form>
  );
}
