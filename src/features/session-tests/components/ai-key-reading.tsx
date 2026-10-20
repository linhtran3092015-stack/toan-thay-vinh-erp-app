"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import type { EditorOutcome } from "@/features/session-tests/components/answer-key-editor";
import type { SessionTestActions } from "@/features/session-tests/components/session-test-actions";
import { AI_KEY_MISSING_MESSAGE, extractionStatusLabels } from "@/features/session-tests/status";
import type { SessionTestExtraction } from "@/features/session-tests/types";
import { formatDateTime } from "@/lib/datetime";

/**
 * "AI đọc đề": queues a key-reading run (Claude Opus 5.5) over the test photos. Disabled with
 * its reason while no Claude API key is configured, or before the first photo. The proposal
 * lands in the editor for a teaching assistant to check and confirm; AI never confirms.
 */
export function AiKeyReading({
  actions,
  aiConfigured,
  extraction,
  hasPages,
  onChanged,
  testId,
}: {
  actions: SessionTestActions;
  aiConfigured: boolean;
  extraction: SessionTestExtraction | null;
  hasPages: boolean;
  onChanged: () => void;
  testId: string | null;
}) {
  const [feedback, setFeedback] = useState<EditorOutcome | null>(null);
  const [pending, startTransition] = useTransition();
  const active = extraction !== null && (extraction.status === "queued" || extraction.status === "running");
  const blockedReason = !aiConfigured
    ? AI_KEY_MISSING_MESSAGE
    : !hasPages || !testId
      ? "Tải ít nhất một trang ảnh đề trước."
      : active
        ? "Đề này đang chờ AI đọc."
        : undefined;

  const run = (call: (input: { testId: string }) => Promise<EditorOutcome>) => {
    if (!testId || pending) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await call({ testId });
      setFeedback(result);
      if (result.ok) onChanged();
    });
  };

  return (
    <section aria-labelledby="session-test-ai-title" className="grid gap-2">
      <h3 className="text-label font-semibold text-text-strong" id="session-test-ai-title">
        AI đọc đề
      </h3>
      <p className="text-caption text-text-muted">
        AI đọc ảnh đề, đề xuất đáp án và lời giải từng câu. Trợ giảng vẫn kiểm tra, sửa và bấm chốt; AI không tự chốt.
      </p>
      {extraction && extraction.status !== "cancelled" ? (
        <p className="text-secondary text-text-default" role="status">
          {extractionStatusLabels[extraction.status]} · yêu cầu lúc {formatDateTime(extraction.createdAt)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-start gap-2">
        <Button
          disabled={pending || blockedReason !== undefined}
          disabledReason={blockedReason}
          isLoading={pending && !active}
          onClick={() => run(actions.requestExtraction)}
          variant="secondary"
        >
          <Sparkles aria-hidden="true" size={18} />
          AI đọc đề
        </Button>
        {extraction?.status === "queued" ? (
          <Button disabled={pending} onClick={() => run(actions.cancelExtraction)} variant="ghost">
            Hủy lượt đọc
          </Button>
        ) : null}
      </div>
      {feedback ? <ResultBanner title={feedback.message} tone={feedback.ok ? "success" : "error"} /> : null}
    </section>
  );
}
