"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addCaseNoteAction, completeFollowUpAction } from "@/features/crm/actions/crm-actions";
import type { CrmActionOverrides } from "@/features/crm/crm-action-overrides";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";
import type { CrmCaseNoteReadModel } from "@/features/crm/read-models";
import { formatDateTime, formatIsoDate } from "@/lib/datetime";

const fieldClassName =
  "h-10 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";
const textareaClassName =
  "min-h-20 rounded-md border border-border-subtle bg-field-bg p-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";

/** Working notes with optional follow-up dates; overdue follow-ups are highlighted. */
export function CrmCaseNotesPanel({
  actions,
  canUpdate,
  crmCaseId,
  notes,
  todayIso,
}: {
  actions?: Pick<CrmActionOverrides, "addCaseNote" | "completeFollowUp">;
  canUpdate: boolean;
  crmCaseId: string;
  notes: CrmCaseNoteReadModel[];
  todayIso: string;
}) {
  const router = useRouter();
  const addCaseNote = actions?.addCaseNote ?? addCaseNoteAction;
  const completeFollowUp = actions?.completeFollowUp ?? completeFollowUpAction;
  const noteId = useId();
  const [note, setNote] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [state, setState] = useState<CrmActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();
  const noteError = state?.status === "error" ? state.fieldErrors?.note?.[0] : undefined;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    setState(null);
    startTransition(async () => {
      const outcome = await addCaseNote({ crmCaseId, followUpAt: followUpAt || null, note });
      setState(outcome);
      if (outcome.status === "success") {
        setNote("");
        setFollowUpAt("");
        router.refresh();
      }
    });
  };

  const complete = (id: string) => {
    if (isPending) return;
    setState(null);
    startTransition(async () => {
      const outcome = await completeFollowUp({ crmCaseId, noteId: id });
      setState(outcome);
      if (outcome.status === "success") router.refresh();
    });
  };

  const pendingFollowUps = notes.filter((item) => item.followUpAt && !item.followUpDoneAt);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ghi chú & hẹn theo dõi</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {canUpdate ? (
          <form className="grid gap-3 rounded-md border border-border-subtle bg-surface-sunken p-3" onSubmit={submit}>
            <div className="grid gap-1.5">
              <label className="text-label font-medium text-text-muted" htmlFor={noteId}>Ghi chú mới</label>
              <textarea
                aria-invalid={Boolean(noteError)}
                className={textareaClassName}
                disabled={isPending}
                id={noteId}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: Đã gọi, phụ huynh hẹn trả lời sau khi con thi xong."
                required
                value={note}
              />
              {noteError ? <p className="text-caption text-danger">{noteError}</p> : null}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <label className="text-label font-medium text-text-muted" htmlFor={`${noteId}-follow`}>Hẹn theo dõi (không bắt buộc)</label>
                <input className={fieldClassName} disabled={isPending} id={`${noteId}-follow`} min={todayIso} onChange={(event) => setFollowUpAt(event.target.value)} type="date" value={followUpAt} />
              </div>
              <Button disabled={isPending || note.trim().length < 2} size="sm" type="submit" variant="secondary">{isPending ? "Đang lưu…" : "Lưu ghi chú"}</Button>
            </div>
            <p className="text-caption text-text-muted">Hẹn theo dõi đến hạn sẽ được nhắc trong Thông báo vào mỗi sáng cho sale phụ trách.</p>
          </form>
        ) : null}

        {state?.status === "error" ? <ResultBanner title={state.message} tone="error" /> : null}
        {state?.status === "success" ? <ResultBanner title={state.message} tone="success" /> : null}

        {pendingFollowUps.length > 0 ? (
          <p className="text-secondary text-text-muted">{pendingFollowUps.length} hẹn theo dõi đang mở.</p>
        ) : null}

        {notes.length === 0 ? (
          <p className="text-body text-text-muted">Chưa có ghi chú nào.</p>
        ) : (
          <ul className="grid gap-2">
            {notes.map((item) => {
              const overdue = Boolean(item.followUpAt && !item.followUpDoneAt && item.followUpAt < todayIso);
              const dueToday = Boolean(item.followUpAt && !item.followUpDoneAt && item.followUpAt === todayIso);
              return (
                <li className="rounded-md border border-border-subtle bg-surface-base p-3" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-body text-text-strong">{item.note}</p>
                    {item.followUpAt ? (
                      item.followUpDoneAt ? (
                        <Badge tone="success">Đã theo dõi</Badge>
                      ) : overdue ? (
                        <Badge tone="danger">Quá hạn {formatIsoDate(item.followUpAt)}</Badge>
                      ) : dueToday ? (
                        <Badge tone="warning">Hẹn hôm nay</Badge>
                      ) : (
                        <Badge tone="info">Hẹn {formatIsoDate(item.followUpAt)}</Badge>
                      )
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-caption text-text-muted">
                    <span>{item.createdByName ?? "Không rõ"} · {formatDateTime(item.createdAt)}{item.followUpDoneByName ? ` · xong bởi ${item.followUpDoneByName}` : ""}</span>
                    {canUpdate && item.followUpAt && !item.followUpDoneAt ? (
                      <Button disabled={isPending} onClick={() => complete(item.id)} size="sm" type="button" variant="outline">Đã xử lý</Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
