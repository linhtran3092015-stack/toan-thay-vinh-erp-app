"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GradingDataResult } from "@/features/grading-submissions/data";
import { ANSWER_KEY_TOTAL_POINTS, answerKeyTotal, formatPoints } from "@/features/session-tests/answer-key";
import { AiKeyReading } from "@/features/session-tests/components/ai-key-reading";
import { AnswerKeyEditor, type EditorOutcome } from "@/features/session-tests/components/answer-key-editor";
import { AnswerKeyView } from "@/features/session-tests/components/answer-key-view";
import { KeyWarnings } from "@/features/session-tests/components/key-warnings";
import { LessonPagesPanel } from "@/features/session-tests/components/lesson-pages-panel";
import { ReuseTestPanel } from "@/features/session-tests/components/reuse-test-panel";
import { sessionTestServerActions, type SessionTestActions } from "@/features/session-tests/components/session-test-actions";
import { TestPagesPanel } from "@/features/session-tests/components/test-pages-panel";
import { sessionTestStage, sessionTestStageLabels } from "@/features/session-tests/status";
import type { SessionTestAsset, SessionTestState } from "@/features/session-tests/types";
import { formatDateTime } from "@/lib/datetime";

// Stable identity: the pages panel resets its local order whenever this prop changes.
const NO_ASSETS: SessionTestAsset[] = [];

function statusLine(state: SessionTestState): string {
  const test = state.test;
  const stage = sessionTestStage(test);
  const closed = state.editable ? "" : " Buổi học đã khóa hoặc đã hủy nên đề chỉ để xem.";
  if (stage === "none") {
    if (!state.editable || !state.canManage) return `Chưa có đề cho buổi này.${closed}`;
    return state.sources.length > 0
      ? "Chưa có đề. Dùng đề có sẵn của buổi cùng ngày, cùng khối, hoặc tải ảnh đề rồi nhập đáp án."
      : "Chưa có đề. Tải ảnh đề rồi nhập đáp án từng câu.";
  }
  if (!test) return closed.trim();
  if (stage === "pending") {
    const total = answerKeyTotal(test.answerKey);
    return `${test.assets.length} trang ảnh · ${test.answerKey.questions.length} câu · tổng ${formatPoints(total)}/${ANSWER_KEY_TOTAL_POINTS} điểm. Chưa chốt nên AI chưa chấm bài.${closed}`;
  }
  const source = test.source ? ` · dùng lại đề của ${test.source.classCode} (${test.source.startTime.slice(0, 5)})` : "";
  const by = test.confirmedByName ? ` · chốt bởi ${test.confirmedByName}` : "";
  const at = test.confirmedAt ? ` lúc ${formatDateTime(test.confirmedAt)}` : "";
  return `Phiên bản ${test.answerKeyVersion}${by}${at}${source}.${closed}`;
}

/**
 * "Cuối giờ · Kết quả" → "Bài kiểm tra" (AI grading phase 2): the session's test photos and the
 * answer key AI will grade against. Status chưa có / chờ chốt / đã chốt; photos on the left and
 * the key on the right from large screens, one column on a phone. Grading itself is phase 3.
 */
export function SessionTestCard({
  actions = sessionTestServerActions,
  result,
}: {
  actions?: SessionTestActions;
  result: GradingDataResult<SessionTestState>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState<EditorOutcome | null>(null);

  if (!result.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bài kiểm tra</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultBanner description={result.error} title="Không tải được đề kiểm tra" tone="danger" />
        </CardContent>
      </Card>
    );
  }

  const state = result.data;
  const test = state.test;
  const stage = sessionTestStage(test);
  const stageLabel = sessionTestStageLabels[stage];
  const confirmed = stage === "confirmed";
  const canEditPages = state.canManage && state.editable;
  const canEditKey = state.editable && (confirmed ? state.canConfirm : state.canManage || state.canConfirm);
  const canReuse = state.canManage && state.canConfirm && state.editable && state.sources.length > 0;

  const done = (next: EditorOutcome & { confirmed?: boolean }) => {
    setOutcome(next);
    if (next.confirmed) setEditing(false);
    router.refresh();
  };

  const reusePanel = (
    <ReuseTestPanel
      actions={actions}
      currentVersion={test?.answerKeyVersion ?? 0}
      hasOwnPages={(test?.assets.length ?? 0) > 0}
      onDone={(next) => done({ ...next, confirmed: true })}
      sessionId={state.sessionId}
      sources={state.sources}
    />
  );

  return (
    <Card aria-labelledby="session-test-title">
      <CardHeader className="flex-col items-stretch gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle id="session-test-title">Bài kiểm tra</CardTitle>
          <Badge tone={stageLabel.tone}>{stageLabel.label}</Badge>
        </div>
        <p className="text-secondary text-text-muted">{statusLine(state)}</p>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <TestPagesPanel
          actions={actions}
          assets={test?.assets ?? NO_ASSETS}
          canEdit={canEditPages}
          sessionId={state.sessionId}
          testId={test?.id ?? null}
        />

        <div className="grid content-start gap-6">
          {outcome ? <ResultBanner title={outcome.message} tone={outcome.ok ? "success" : "error"} /> : null}

          {!confirmed && canReuse ? reusePanel : null}

          <section aria-labelledby="session-test-key-title" className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-label font-semibold text-text-strong" id="session-test-key-title">
                Đáp án
              </h3>
              {confirmed && !editing && canEditKey ? (
                <Button
                  onClick={() => {
                    setOutcome(null);
                    setEditing(true);
                  }}
                  variant="secondary"
                >
                  Sửa đáp án
                </Button>
              ) : null}
            </div>
            {canEditKey && (!confirmed || editing) ? (
              <AnswerKeyEditor
                actions={actions}
                canConfirm={state.canConfirm}
                canSaveDraft={state.canManage}
                expectedVersion={test?.answerKeyVersion ?? 0}
                initial={{
                  answerKey: test?.answerKey ?? { questions: [] },
                  markingGuide: test?.markingGuide ?? null,
                  title: test?.title ?? null,
                }}
                // A new confirmed version, or an "AI đọc đề" draft the server just wrote, starts a fresh
                // editor; draft saves and photo uploads keep the typing.
                key={`${test?.answerKeyVersion ?? 0}:${
                  test?.extraction?.status === "succeeded" && test.extraction.outcome === "applied" ? test.extraction.id : "typed"
                }`}
                mode={confirmed ? "revision" : "draft"}
                onCancel={confirmed ? () => setEditing(false) : undefined}
                onSaved={done}
                sessionId={state.sessionId}
                testId={test?.id ?? null}
              />
            ) : test ? (
              <>
                {confirmed ? <KeyWarnings canEdit={canEditKey} warnings={test.keyWarnings ?? []} /> : null}
                <AnswerKeyView answerKey={test.answerKey} markingGuide={test.markingGuide} title={test.title} />
              </>
            ) : (
              <p className="text-secondary text-text-muted">Chưa có đáp án.</p>
            )}
          </section>

          <LessonPagesPanel
            actions={actions}
            canEdit={state.canManage && state.editable}
            pages={test?.lessonPages ?? []}
            sessionId={state.sessionId}
            sources={state.lessonSources ?? []}
            testId={test?.id ?? null}
          />

          {state.canManage && state.editable && !confirmed ? (
            <AiKeyReading
              actions={actions}
              aiConfigured={state.aiConfigured}
              extraction={test?.extraction ?? null}
              hasPages={(test?.assets.length ?? 0) > 0}
              lessonPageCount={test?.lessonPages?.length ?? 0}
              onChanged={() => router.refresh()}
              testId={test?.id ?? null}
            />
          ) : null}

          {confirmed && canReuse && !editing ? (
            <details className="grid gap-3 rounded-lg border border-border-subtle p-3">
              <summary className="cursor-pointer text-secondary font-medium text-action-link">Thay bằng đề có sẵn của buổi khác</summary>
              <div className="mt-3">{reusePanel}</div>
            </details>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
