"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { controlClassName, Field } from "@/components/ui/field";
import { setSessionMessageContactAction } from "@/features/parent-messages/actions";
import type { SessionMessageContactState } from "@/features/parent-messages/data";

/**
 * "Cuối giờ · Kết quả": the supervisor name and grading phone printed at the
 * end of this session's Zalo comment messages. Empty fields start from this
 * TA's last entry; until saved, Gửi stays locked in the parent message queue.
 */
export function SessionMessageContactCard({
  canEdit,
  contact,
  sessionId,
}: {
  canEdit: boolean;
  contact: SessionMessageContactState;
  sessionId: string;
}) {
  const router = useRouter();
  const start = contact.saved ?? contact.suggestion;
  const [supervisorName, setSupervisorName] = useState(start?.supervisorName ?? "");
  const [phone, setPhone] = useState(start?.phone ?? "");
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const unchanged = contact.saved !== null && supervisorName.trim() === contact.saved.supervisorName && phone.trim() === contact.saved.phone;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await setSessionMessageContactAction({ phone, sessionId, supervisorName });
      setFeedback(result);
      if (result.ok) router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trợ giảng giám thị trên tin Zalo</CardTitle>
        <p className="text-secondary text-text-muted">
          Tên và SĐT thắc mắc bài chấm in ở cuối tin nhận xét gửi phụ huynh. Chưa lưu thì tin nhận xét của buổi này chưa gửi được.
        </p>
      </CardHeader>
      <CardContent>
        {canEdit ? (
          <form className="grid gap-3" onSubmit={onSubmit}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
              <Field label="Trợ giảng giám thị" required>
                {(props) => (
                  <input
                    autoComplete="name"
                    className={controlClassName}
                    disabled={pending}
                    maxLength={120}
                    onChange={(event) => setSupervisorName(event.target.value)}
                    required
                    value={supervisorName}
                    {...props}
                  />
                )}
              </Field>
              <Field label="SĐT thắc mắc bài chấm" required>
                {(props) => (
                  <input
                    autoComplete="tel"
                    className={controlClassName}
                    disabled={pending}
                    inputMode="tel"
                    maxLength={30}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    type="tel"
                    value={phone}
                    {...props}
                  />
                )}
              </Field>
              <Button disabled={pending || unchanged || supervisorName.trim() === "" || phone.trim() === ""} isLoading={pending} type="submit">
                {contact.saved ? "Lưu thay đổi" : "Lưu cho buổi này"}
              </Button>
            </div>
            {!contact.saved && contact.suggestion ? (
              <p className="text-caption text-text-muted">Điền sẵn theo lần bạn điền gần nhất. Bấm lưu để dùng cho buổi này.</p>
            ) : null}
            {feedback ? <ResultBanner title={feedback.message} tone={feedback.ok ? "success" : "danger"} /> : null}
          </form>
        ) : contact.saved ? (
          <p className="text-body text-text-strong">
            {contact.saved.supervisorName} · {contact.saved.phone}
          </p>
        ) : (
          <p className="text-secondary text-text-muted">Chưa điền.</p>
        )}
      </CardContent>
    </Card>
  );
}
