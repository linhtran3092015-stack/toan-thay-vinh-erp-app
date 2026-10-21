"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { controlClassName } from "@/components/ui/field";
import type { AiGradingActionResult } from "@/features/ai-grading/actions";
import { updateGradingPhrasesAction } from "@/features/ai-grading/actions";
import { PHRASE_SLOTS, type CommentPhrases, type PhraseSlot } from "@/features/ai-grading/comment";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { cn } from "@/lib/utils";

const SLOT_LABELS: Record<PhraseSlot, { help: string; title: string }> = {
  y1_correct: { help: "Ý 1 khi con đúng hết. Có câu sai thì phần mềm tự ghép câu sai, đáp án đúng và chỗ sai.", title: "Ý 1 · Đúng hết" },
  y2_correct: { help: "Ý 2 khi đúng hết: lời nhờ phụ huynh động viên.", title: "Ý 2 · Đúng hết" },
  y2_wrong: { help: "Ý 2 khi có câu sai: nhờ phụ huynh nhắc con xem lại bài.", title: "Ý 2 · Có câu sai" },
  y3_praised: { help: "Ý 3 khi được tick “Tích cực tương tác”. Câu báo cộng điểm đã đứng đầu nhận xét, không nhắc lại.", title: "Ý 3 · Tích cực" },
  y3_quiet: { help: "Ý 3 khi không được tick.", title: "Ý 3 · Còn trầm" },
  y4: { help: "Ý 4: lời chúc cuối nhận xét.", title: "Ý 4 · Lời chúc" },
};

const MAX_PER_SLOT = 20;
const MAX_CHARS = 500;

/**
 * Cài đặt → Chấm bài AI → câu mẫu nhận xét (phase 3c, owner only). Each slot keeps 1–20 phrases;
 * the draft comment picks one per student so a class does not read the same sentence. Saving
 * replaces the whole library; comments already approved do not change.
 */
export function PhraseLibraryEditor({
  canManage,
  initial,
  save = updateGradingPhrasesAction,
}: {
  canManage: boolean;
  initial: CommentPhrases;
  save?: typeof updateGradingPhrasesAction;
}) {
  const [saved, setSaved] = useState(initial);
  const [phrases, setPhrases] = useState<Record<PhraseSlot, string[]>>(() =>
    Object.fromEntries(PHRASE_SLOTS.map((slot) => [slot, [...initial[slot]]])) as Record<PhraseSlot, string[]>,
  );
  const [result, setResult] = useState<AiGradingActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = PHRASE_SLOTS.some(
    (slot) => phrases[slot].length !== saved[slot].length || phrases[slot].some((text, index) => text !== saved[slot][index]),
  );
  const problem = PHRASE_SLOTS.map((slot) => {
    const list = phrases[slot];
    if (list.length === 0) return `${SLOT_LABELS[slot].title}: cần ít nhất một câu.`;
    if (list.some((text) => text.trim() === "")) return `${SLOT_LABELS[slot].title}: có câu đang trống.`;
    if (list.some((text) => text.length > MAX_CHARS)) return `${SLOT_LABELS[slot].title}: có câu quá ${MAX_CHARS} ký tự.`;
    return null;
  }).find((message) => message !== null);

  const update = (slot: PhraseSlot, next: string[]) => {
    setPhrases((current) => ({ ...current, [slot]: next }));
    setResult(null);
  };

  const onSave = () => {
    const payload = PHRASE_SLOTS.flatMap((slot) => phrases[slot].map((text) => ({ slot, text: text.trim() })));
    startTransition(async () => {
      let outcome: AiGradingActionResult;
      try {
        outcome = await save(payload);
      } catch {
        outcome = { message: "Không thể kết nối hệ thống cài đặt.", ok: false };
      }
      setResult(outcome);
      if (outcome.ok) {
        const trimmed = Object.fromEntries(PHRASE_SLOTS.map((slot) => [slot, phrases[slot].map((text) => text.trim())])) as Record<PhraseSlot, string[]>;
        setSaved(trimmed);
        setPhrases(trimmed);
      }
    });
  };

  return (
    <SettingsCard
      description="Bản nháp nhận xét lấy một câu ở mỗi ô, xoay vòng theo học sinh. Không dùng icon/emoji, không nhắc tới camera. Trợ giảng vẫn sửa nhận xét trước khi duyệt."
      title="Câu mẫu nhận xét"
    >
      <div className="grid gap-5">
        {PHRASE_SLOTS.map((slot) => (
          <fieldset className="grid gap-2" key={slot}>
            <legend className="flex flex-wrap items-center gap-2 text-label font-semibold text-text-strong">
              {SLOT_LABELS[slot].title}
              <Badge>{phrases[slot].length} câu</Badge>
            </legend>
            <p className="text-caption text-text-muted">{SLOT_LABELS[slot].help}</p>
            {phrases[slot].map((text, index) => (
              <div className="flex items-start gap-2" key={`${slot}-${index}`}>
                <textarea
                  aria-label={`${SLOT_LABELS[slot].title}, câu ${index + 1}`}
                  className={cn(controlClassName, "min-h-16 flex-1 py-2 text-secondary")}
                  disabled={!canManage || pending}
                  maxLength={MAX_CHARS + 50}
                  onChange={(event) => update(slot, phrases[slot].map((value, position) => (position === index ? event.target.value : value)))}
                  rows={2}
                  value={text}
                />
                {canManage ? (
                  <Button
                    aria-label={`Xóa ${SLOT_LABELS[slot].title.toLowerCase()}, câu ${index + 1}`}
                    disabled={pending || phrases[slot].length <= 1}
                    onClick={() => update(slot, phrases[slot].filter((_, position) => position !== index))}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </Button>
                ) : null}
              </div>
            ))}
            {canManage && phrases[slot].length < MAX_PER_SLOT ? (
              <div>
                <Button disabled={pending} onClick={() => update(slot, [...phrases[slot], ""])} size="sm" variant="ghost">
                  <Plus aria-hidden="true" size={16} />
                  Thêm câu
                </Button>
              </div>
            ) : null}
          </fieldset>
        ))}
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={pending || !dirty || problem !== undefined}
              disabledReason={dirty ? problem : "Chưa có thay đổi"}
              isLoading={pending}
              onClick={onSave}
            >
              Lưu câu mẫu
            </Button>
            {dirty ? <span className="text-caption text-text-muted">Có thay đổi chưa lưu</span> : null}
          </div>
        ) : null}
        {result ? <ResultBanner title={result.message} tone={result.ok ? "success" : "error"} /> : null}
      </div>
    </SettingsCard>
  );
}
