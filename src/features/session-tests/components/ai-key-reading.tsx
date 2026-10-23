"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { AutoRefresh } from "@/components/shared/auto-refresh";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import type { EditorOutcome } from "@/features/session-tests/components/answer-key-editor";
import type { SessionTestActions } from "@/features/session-tests/components/session-test-actions";
import { AI_KEY_MISSING_MESSAGE, extractionStatusLabels } from "@/features/session-tests/status";
import type { SessionTestExtraction } from "@/features/session-tests/types";
import { formatDateTime } from "@/lib/datetime";

const outcomeMessages: Record<string, string> = {
  applied: "Bản nháp AI đã điền vào ô đáp án bên dưới. Trợ giảng kiểm tra từng câu (nhất là các chỗ AI ghi chú) rồi bấm chốt.",
  draft_changed: "AI đọc xong nhưng bản nháp đã được sửa sau khi yêu cầu, nên ERP giữ bản đang có, không ghi đè.",
  invalid_key: "AI trả bản nháp không dùng được. Nhập đáp án tay hoặc bấm AI đọc đề lần nữa.",
  key_confirmed: "Đáp án đã được chốt trước khi AI đọc xong, nên bản AI không được dùng.",
};

/**
 * "AI đọc đề": queues a key-reading run (the key model in Cài đặt → Chấm bài AI, Opus 5.5 by
 * default) over the test photos. Disabled with its reason while no Claude API key is configured,
 * or before the first photo. The proposal lands in the editor for a teaching assistant to check
 * and confirm; AI never confirms. While a run is queued or running the page refreshes itself.
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
      <AutoRefresh active={active} />
      {extraction && extraction.status !== "cancelled" ? (
        <p className="text-secondary text-text-default" role="status">
          {extractionStatusLabels[extraction.status]} · yêu cầu lúc {formatDateTime(extraction.createdAt)}
        </p>
      ) : null}
      {extraction?.status === "succeeded" && extraction.outcome && outcomeMessages[extraction.outcome] ? (
        <p className="text-caption text-text-muted">{outcomeMessages[extraction.outcome]}</p>
      ) : null}
      {extraction?.status === "succeeded" && (extraction.warnings?.length ?? 0) > 0 ? (
        <div className="grid gap-1 rounded-md border border-warning-border bg-warning-bg p-2">
          <p className="text-caption font-semibold text-text-strong">AI ghi chú chỗ chưa chắc ({extraction.warnings!.length})</p>
          <ul className="list-disc pl-5 text-caption text-text-default">
            {extraction.warnings!.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
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
