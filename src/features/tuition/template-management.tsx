"use client";

import { useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { publishTuitionTemplateAction } from "@/features/tuition/actions";

export function TuitionTemplateManagement({
  current,
}: {
  current: { content: Record<string, unknown>; version: number } | null;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const content = current?.content ?? {};

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5">
      <h2 className="text-section-title font-semibold text-text-strong">Mẫu Phiếu học phí</h2>
      <p className="mt-1 text-secondary text-text-muted">
        Phiên bản hiện tại: {current?.version ?? "mặc định"}. Chỉ lưu trường hiển thị an toàn, không nhận HTML/JavaScript.
      </p>
      <form
        className="mt-4 grid gap-3 md:grid-cols-2"
        action={(formData) =>
          start(async () =>
            setMessage(
              (
                await publishTuitionTemplateAction({
                  announcement: String(formData.get("announcement")),
                  centerDisplayName: String(formData.get("center")),
                  footer: String(formData.get("footer")),
                  reason: String(formData.get("reason")),
                  title: String(formData.get("title")),
                })
              ).message,
            ),
          )
        }
      >
        <div className="grid gap-1.5">
          <Label htmlFor="template-center" required>Trung tâm</Label>
          <Input defaultValue={String(content.center_display_name ?? "")} id="template-center" name="center" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="template-title" required>Tiêu đề</Label>
          <Input defaultValue={String(content.title ?? "")} id="template-title" name="title" required />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="template-announcement">Thông báo</Label>
          <Textarea defaultValue={String(content.announcement ?? "")} id="template-announcement" name="announcement" />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="template-footer" required>Chân trang</Label>
          <Textarea defaultValue={String(content.footer ?? "")} id="template-footer" name="footer" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="template-reason" required>Lý do xuất bản</Label>
          <Input id="template-reason" name="reason" placeholder="Ví dụ: Cập nhật số điện thoại liên hệ" required />
        </div>
        <div className="flex items-end">
          <Button disabled={pending} type="submit">Xuất bản phiên bản mới</Button>
        </div>
      </form>
      {message ? <div className="mt-3"><ResultBanner title={message} tone="info" /></div> : null}
    </section>
  );
}
