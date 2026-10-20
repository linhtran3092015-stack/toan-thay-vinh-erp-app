"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ANSWER_KEY_LIMITS } from "@/features/session-tests/answer-key";
import { AnswerKeyView } from "@/features/session-tests/components/answer-key-view";
import type { EditorOutcome } from "@/features/session-tests/components/answer-key-editor";
import type { SessionTestActions } from "@/features/session-tests/components/session-test-actions";
import type { SessionTestSource } from "@/features/session-tests/types";

function hhmm(time: string): string {
  return time.slice(0, 5);
}

/**
 * "Dùng đề có sẵn": confirmed tests of other sessions on the same date and grade (one test =
 * one date + one grade). Using one copies its key (and its photos when this session has none)
 * and confirms it here in one step. Replacing a key this session already confirmed needs a reason.
 */
export function ReuseTestPanel({
  actions,
  currentVersion,
  hasOwnPages,
  onDone,
  sessionId,
  sources,
}: {
  actions: SessionTestActions;
  /** answer_key_version of this session's test; 0 when nothing is confirmed yet. */
  currentVersion: number;
  hasOwnPages: boolean;
  onDone: (outcome: EditorOutcome) => void;
  sessionId: string;
  sources: SessionTestSource[];
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ message: string; testId: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const replacing = currentVersion > 0;
  const reasonMissing = replacing && reason.trim() === "";
  const reasonTooLong = reason.trim().length > ANSWER_KEY_LIMITS.reasonLength;

  const use = (source: SessionTestSource) => {
    if (pending || reasonMissing || reasonTooLong) return;
    setError(null);
    setPendingId(source.testId);
    startTransition(async () => {
      const result = await actions.copy({
        expectedVersion: currentVersion,
        reason: replacing ? reason.trim() : null,
        sessionId,
        sourceTestId: source.testId,
      });
      setPendingId(null);
      if (!result.ok) {
        setError({ message: result.message, testId: source.testId });
        return;
      }
      onDone(result);
    });
  };

  return (
    <section aria-labelledby="session-test-reuse-title" className="grid gap-3">
      <div className="grid gap-1">
        <h3 className="text-label font-semibold text-text-strong" id="session-test-reuse-title">
          Dùng đề có sẵn
        </h3>
        <p className="text-caption text-text-muted">
          Đề đã chốt của buổi khác cùng ngày, cùng khối. Dùng đề sẽ chép đáp án{hasOwnPages ? "" : " và ảnh đề"} rồi chốt luôn cho buổi
          này; sửa đề gốc sau đó không tự cập nhật buổi này.
        </p>
      </div>

      {replacing ? (
        <Field
          error={reasonTooLong ? `Tối đa ${ANSWER_KEY_LIMITS.reasonLength} ký tự.` : null}
          hint="Buổi này đã chốt đáp án; dùng đề khác sẽ tạo phiên bản mới."
          label="Lý do thay đáp án đang dùng"
          required
        >
          {(props) => <Input {...props} onChange={(event) => setReason(event.target.value)} value={reason} />}
        </Field>
      ) : null}

      <ul className="grid gap-3">
        {sources.map((source) => (
          <li className="grid gap-2 rounded-lg border border-border-subtle p-3" key={source.testId}>
            <p className="text-secondary text-text-strong">
              <span className="font-semibold">{source.classCode}</span> · {hhmm(source.startTime)}–{hhmm(source.endTime)}
              {source.title ? ` · ${source.title}` : ""}
            </p>
            <p className="text-caption text-text-muted">
              {source.answerKey.questions.length} câu · {source.pageCount} trang ảnh · phiên bản {source.answerKeyVersion}
              {source.confirmedByName ? ` · chốt bởi ${source.confirmedByName}` : ""}
            </p>
            <details className="text-secondary">
              <summary className="cursor-pointer font-medium text-action-link">Xem đáp án</summary>
              <div className="mt-2">
                <AnswerKeyView answerKey={source.answerKey} markingGuide={source.markingGuide} title={null} />
              </div>
            </details>
            <Button
              className="justify-self-start"
              disabled={pending || reasonMissing || reasonTooLong}
              disabledReason={reasonMissing ? "Nhập lý do thay đáp án đang dùng." : undefined}
              isLoading={pendingId === source.testId}
              onClick={() => use(source)}
              variant="secondary"
            >
              Dùng đề {source.classCode}
            </Button>
            {error?.testId === source.testId ? (
              <p className="text-caption text-danger" role="alert">
                {error.message}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
