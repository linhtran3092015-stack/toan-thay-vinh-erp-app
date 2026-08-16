"use client";

import { useState, useTransition } from "react";

import {
  issueCoachingPublicLinkAction,
  revokeCoachingPublicLinkAction,
} from "@/features/coaching/actions/coaching-form-actions";
import type {
  CoachingFormSummary,
  CoachingPublicLinkSummary,
} from "@/features/coaching/coaching-form-data";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

interface CoachingPublicLinkPanelProps {
  coachingRecordId: string;
  forms: CoachingFormSummary[];
  links?: CoachingPublicLinkSummary[];
}

function statusLabel(status: CoachingPublicLinkSummary["status"]) {
  if (status === "active") return "Đang hoạt động";
  if (status === "submitted") return "Đã gửi";
  return "Đã thu hồi";
}

export function CoachingPublicLinkPanel({
  coachingRecordId,
  forms,
  links = [],
}: CoachingPublicLinkPanelProps) {
  const published = forms.filter((form) => form.versionStatus === "published");
  const [versionId, setVersionId] = useState(published[0]?.versionId ?? "");
  const [expiresAt, setExpiresAt] = useState(() => {
    const date = new Date(Date.now() + 7 * 86_400_000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  });
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  if (!published.length) {
    return (
      <section className="rounded-lg border border-hairline bg-surface-1 p-5">
        <h2 className="font-semibold text-ink">Gửi Phiếu Coaching</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Cần xuất bản ít nhất một biểu mẫu trước khi tạo liên kết.
        </p>
      </section>
    );
  }

  function issueLink() {
    const expiry = new Date(expiresAt);
    if (!expiresAt || Number.isNaN(expiry.getTime())) {
      setMessage("Cần chọn thời hạn cho liên kết.");
      return;
    }
    startTransition(async () => {
      const result = await issueCoachingPublicLinkAction({
        coachingRecordId,
        expiresAt: expiry.toISOString(),
        formVersionId: versionId,
      });
      setMessage(result.message);
      if (result.linkUrl) setLink(`${window.location.origin}${result.linkUrl}`);
    });
  }

  function revokeLink(linkId: string) {
    const reason = reasons[linkId]?.trim() ?? "";
    if (!reason) {
      setMessage("Cần nêu lý do thu hồi liên kết.");
      return;
    }
    startTransition(async () => {
      const result = await revokeCoachingPublicLinkAction({
        coachingRecordId,
        linkId,
        reason,
      });
      setMessage(result.message);
    });
  }

  return (
    <section className="rounded-lg border border-hairline bg-surface-1 p-5 shadow-card">
      <h2 className="font-semibold text-ink">Gửi Phiếu Coaching</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Liên kết chỉ dùng một lần, có thời hạn và gắn với học viên của phiếu này.
      </p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">
          Phiên bản biểu mẫu
          <select
            aria-label="Phiên bản biểu mẫu"
            className="rounded-md border border-hairline p-2"
            value={versionId}
            onChange={(event) => setVersionId(event.target.value)}
          >
            {published.map((form) => (
              <option key={form.versionId} value={form.versionId}>
                {form.name} · v{form.versionNumber}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Hết hạn lúc
          <input
            className="rounded-md border border-hairline p-2"
            required
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </label>
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
          disabled={pending}
          onClick={issueLink}
          type="button"
        >
          Tạo liên kết
        </button>
        {link ? (
          <div className="rounded-md bg-surface-2 p-3">
            <p className="break-all text-sm text-ink">{link}</p>
            <button
              className="mt-2 text-sm font-semibold text-primary"
              onClick={() => navigator.clipboard.writeText(link)}
              type="button"
            >
              Sao chép liên kết
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <h3 className="font-semibold text-ink">Lịch sử liên kết</h3>
        {links.length ? (
          <ul className="mt-3 divide-y divide-hairline rounded-md border border-hairline">
            {links.map((item) => (
              <li className="grid gap-2 p-3 text-sm" key={item.id}>
                <p className="font-medium">
                  {item.formName} · v{item.versionNumber} · {statusLabel(item.status)}
                </p>
                <p className="text-ink-muted">
                  Hết hạn: {dateFormatter.format(new Date(item.expiresAt))}
                </p>
                {item.status === "active" ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      aria-label={`Lý do thu hồi ${item.id}`}
                      className="min-w-0 flex-1 rounded-md border border-hairline p-2"
                      placeholder="Lý do thu hồi"
                      value={reasons[item.id] ?? ""}
                      onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                    <button
                      className="rounded-md border border-danger px-3 py-2 font-semibold text-danger"
                      disabled={pending}
                      onClick={() => revokeLink(item.id)}
                      type="button"
                    >
                      Thu hồi
                    </button>
                  </div>
                ) : item.revokeReason ? (
                  <p className="text-ink-muted">Lý do thu hồi: {item.revokeReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">Chưa phát hành liên kết nào.</p>
        )}
      </div>

      {message ? <p className="mt-3 text-sm text-ink-muted" role="status">{message}</p> : null}
    </section>
  );
}
