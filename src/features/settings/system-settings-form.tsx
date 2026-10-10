"use client";

import { useState, useTransition } from "react";

import { updateSystemSettingsAction } from "@/features/settings/actions";
import type { SystemSettings } from "@/features/settings/system-settings";

export function SystemSettingsForm({ initialValues }: { initialValues: SystemSettings }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="grid gap-5" action={(formData) => startTransition(async () => {
    const result = await updateSystemSettingsAction({
      address: String(formData.get("address") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      contactPhone: String(formData.get("contactPhone") ?? ""),
      defaultPublicLinkExpiryDays: Number(formData.get("defaultPublicLinkExpiryDays")),
      displayName: String(formData.get("displayName") ?? ""),
      teacherDisplayName: String(formData.get("teacherDisplayName") ?? ""),
    });
    setMessage(result.message);
  })}>
    <section className="rounded-lg border border-hairline bg-surface-1 p-5 shadow-card">
      <h2 className="text-section-title font-semibold text-ink">Thông tin trung tâm</h2>
      <p className="mt-1 text-sm text-ink-muted">Thông tin hiển thị an toàn. Phiếu học phí đã khóa vẫn dùng mẫu phiên bản đã snapshot.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field defaultValue={initialValues["center.display_name"]} label="Tên hiển thị trung tâm" name="displayName" required />
        <Field defaultValue={initialValues["teacher.display_name"]} label="Tên giáo viên / thương hiệu" name="teacherDisplayName" required />
        <Field defaultValue={initialValues["center.contact_phone"]} label="Số điện thoại liên hệ" name="contactPhone" />
        <Field defaultValue={initialValues["center.contact_email"]} label="Email liên hệ" name="contactEmail" type="email" />
        <label className="grid gap-1 text-sm md:col-span-2"><span className="font-medium">Địa chỉ</span><textarea className="min-h-20 rounded-md border border-hairline bg-surface-base p-2" defaultValue={initialValues["center.address"]} name="address" /></label>
      </div>
    </section>
    <section className="rounded-lg border border-hairline bg-surface-1 p-5 shadow-card">
      <h2 className="text-section-title font-semibold text-ink">Coaching</h2>
      <p className="mt-1 text-sm text-ink-muted">Chỉ là giá trị gợi ý khi phát hành liên kết mới; không thay đổi liên kết đã phát hành.</p>
      <label className="mt-4 grid max-w-sm gap-1 text-sm"><span className="font-medium">Thời hạn liên kết mặc định (ngày)</span><input className="rounded-md border border-hairline bg-surface-base p-2" defaultValue={initialValues["coaching.default_public_link_expiry_days"]} min={1} max={90} name="defaultPublicLinkExpiryDays" required type="number" /></label>
    </section>
    <div className="flex items-center gap-3"><button className="rounded-md bg-primary px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Đang lưu…" : "Lưu cài đặt"}</button>{message ? <p role="status" className="text-sm text-ink-muted">{message}</p> : null}</div>
  </form>;
}

function Field({ defaultValue, label, name, required, type = "text" }: { defaultValue: string; label: string; name: string; required?: boolean; type?: string }) {
  return <label className="grid gap-1 text-sm"><span className="font-medium">{label}</span><input className="rounded-md border border-hairline bg-surface-base p-2" defaultValue={defaultValue} name={name} required={required} type={type} /></label>;
}
