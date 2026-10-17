"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { StickySaveBar } from "@/components/patterns/sticky-save-bar";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { controlClassName, Field } from "@/components/ui/field";
import {
  COMMENT_FOOTER_MAX_CHARS,
  COMMENT_TEMPLATE_MAX_CHARS,
  COMMENT_TEMPLATE_VARIABLES,
  formatMessageScore,
  NOTEBOOK_NOT_SUBMITTED_TEXT,
  planMessageParts,
  rankLabelForScore,
  renderCommentMessage,
  type RankBand,
} from "@/features/parent-messages/comment-template";
import { formatCharCount, MessagePartsPreview, MessageSplitSummary } from "@/features/parent-messages/components/message-parts-preview";
import type { SettingsActionState } from "@/features/settings/action-types";
import { updateZaloCommentTemplateAction } from "@/features/settings/actions";
import { useLeaveGuard, useSaveInFlightGuard } from "@/features/settings/components/leave-guard";
import { SettingsCard } from "@/features/settings/components/settings-card";
import type { SettingsActionOverrides } from "@/features/settings/settings-action-overrides";
import { cn } from "@/lib/utils";

const TEMPLATE_LABEL = "Mẫu tin nhận xét";
const FOOTER_LABEL = "Thông tin cuối ({footer})";

/** Sample answer and solution: AI grading fills these from phase 3; the preview shows how long messages split. */
const SAMPLE_ANSWER = [
  "Câu 1: 3/4 + 1/2 = 5/4",
  "Câu 2: x = 7",
  "Câu 3: Diện tích hình chữ nhật là 12 × 8 = 96 (cm²)",
  "Câu 4: 2x + 5 = 19 nên 2x = 14, x = 7",
  "Câu 5: Số học sinh nữ là 36 × 5/9 = 20 (học sinh)",
].join("\n");

const SAMPLE_SOLUTION = Array.from({ length: 5 }, (_, index) =>
  [
    `Câu ${index + 1} (2 điểm):`,
    "Bước 1: Đọc kỹ đề, xác định đại lượng đã biết và đại lượng cần tìm.",
    "Bước 2: Viết phép tính hoặc phương trình tương ứng, chú ý đơn vị đo.",
    "Bước 3: Tính toán cẩn thận từng bước, kiểm tra lại kết quả bằng phép tính ngược.",
    "Bước 4: Kết luận và ghi đáp số đầy đủ đơn vị.",
  ].join("\n"),
).join("\n\n");

const SAMPLE_COMMENT =
  "Hôm nay con tập trung và làm bài khá cẩn thận. Con làm đúng các câu tính toán, còn câu có lời văn con cần đọc kỹ đề hơn trước khi đặt phép tính. Ở nhà con luyện thêm dạng bài tìm phân số của một số. Thầy cô mong con giữ tinh thần học tập này ở các buổi sau.";

interface SampleOptions {
  hasAnswer: boolean;
  hasNotebook: boolean;
  hasSupervisor: boolean;
  notebookNotSubmitted: boolean;
  hasTest: boolean;
}

function sampleVars(centerName: string, bands: readonly RankBand[], options: SampleOptions): Record<string, string> {
  const testScore = options.hasTest ? 8 : null;
  return {
    answer_text: options.hasAnswer ? SAMPLE_ANSWER : "",
    center: centerName,
    class: "8A1 (Lớp 8 nâng cao)",
    comment: SAMPLE_COMMENT,
    date: "17/10/2026",
    grading_contact_phone: options.hasSupervisor ? "0912 345 678" : "",
    notebook_score: options.hasNotebook ? formatMessageScore(9) : options.notebookNotSubmitted ? NOTEBOOK_NOT_SUBMITTED_TEXT : "",
    rank: rankLabelForScore(testScore, bands),
    scores: "",
    solution: options.hasAnswer ? SAMPLE_SOLUTION : "",
    student: "Anh",
    student_full_name: "Nguyễn Minh Anh",
    supervisor_name: options.hasSupervisor ? "Cô Nguyễn Thu Hà" : "",
    test_score: formatMessageScore(testScore),
    time: "18:00-19:30",
  };
}

function lf(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

/**
 * Cài đặt → Tin Zalo (AI grading plan §4.10): the owner edits the comment
 * template and footer; the preview renders the real message from a sample
 * student with the same renderer the queue uses (TypeScript copy of the SQL)
 * and shows how many Zalo messages it becomes. People without settings.manage
 * see it read-only.
 */
export function ZaloMessageSettings({
  actions,
  bands,
  canManage,
  centerName,
  initialDraft,
  initialFooter,
  initialTemplate,
}: {
  actions?: Pick<SettingsActionOverrides, "updateZaloCommentTemplate">;
  bands: readonly RankBand[];
  canManage: boolean;
  centerName: string;
  /** Dev previews only: start with these unsaved edits on top of the saved values. */
  initialDraft?: { footer?: string; template?: string };
  initialFooter: string;
  initialTemplate: string;
}) {
  const updateTemplate = actions?.updateZaloCommentTemplate ?? updateZaloCommentTemplateAction;
  const [saved, setSaved] = useState(() => ({ footer: lf(initialFooter), template: lf(initialTemplate) }));
  const [template, setTemplate] = useState(() => initialDraft?.template ?? saved.template);
  const [footer, setFooter] = useState(() => initialDraft?.footer ?? saved.footer);
  const [options, setOptions] = useState<SampleOptions>({
    hasAnswer: false,
    hasNotebook: true,
    hasSupervisor: true,
    hasTest: true,
    notebookNotSubmitted: false,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changed = [template !== saved.template ? TEMPLATE_LABEL : null, footer !== saved.footer ? FOOTER_LABEL : null].filter(
    (label): label is string => label !== null,
  );
  const preview = useMemo(() => renderCommentMessage(template, footer, sampleVars(centerName, bands, options)), [bands, centerName, footer, options, template]);
  const plan = useMemo(() => planMessageParts(preview), [preview]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitted = { footer, template };
    setMessage("");
    setError(null);
    startTransition(async () => {
      let result: SettingsActionState;
      try {
        result = await updateTemplate(submitted);
      } catch {
        result = { message: "Không thể kết nối hệ thống cài đặt.", status: "error" };
      }
      if (result.status === "success") {
        // The database trims blank edges; compare against what was stored.
        setSaved({ footer: submitted.footer.trim(), template: submitted.template.trim() });
        if (submitted.template !== submitted.template.trim()) setTemplate(submitted.template.trim());
        if (submitted.footer !== submitted.footer.trim()) setFooter(submitted.footer.trim());
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    });
  };

  const onCancel = () => {
    if (pending) return;
    setTemplate(saved.template);
    setFooter(saved.footer);
    setError(null);
    setMessage("");
  };
  useLeaveGuard(canManage && changed.length > 0 && !pending, onCancel);
  useSaveInFlightGuard(pending);

  // A notebook either has a score or was not handed in, never both.
  const toggle = (key: keyof SampleOptions) =>
    setOptions((current) => {
      const next = { ...current, [key]: !current[key] };
      if (key === "hasNotebook" && next.hasNotebook) next.notebookNotSubmitted = false;
      if (key === "notebookNotSubmitted" && next.notebookNotSubmitted) next.hasNotebook = false;
      return next;
    });

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      {!canManage ? (
        <p className="flex flex-wrap items-center gap-2 text-secondary text-text-muted">
          <Badge>Chỉ đọc</Badge>
          Chỉ chủ trung tâm (quyền settings.manage) sửa được mẫu tin.
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <SettingsCard
            description="Dùng cho tin nhận xét cuối buổi của mọi buổi, kể cả buổi nhập điểm tay. Mục không có dữ liệu tự ẩn cùng nhãn. Trợ giảng vẫn sửa được từng tin trước khi gửi."
            title="Mẫu tin nhận xét cuối buổi"
          >
            <div className="grid gap-4">
              <Field hint={`${formatCharCount(template.length)}/${formatCharCount(COMMENT_TEMPLATE_MAX_CHARS)} ký tự`} label={TEMPLATE_LABEL} required>
                {(props) => (
                  <textarea
                    className={cn(controlClassName, "py-2 font-mono text-secondary")}
                    maxLength={COMMENT_TEMPLATE_MAX_CHARS}
                    name="template"
                    rows={18}
                    onChange={(event) => {
                      setTemplate(event.target.value);
                      setMessage("");
                    }}
                    readOnly={!canManage}
                    required
                    value={template}
                    {...props}
                  />
                )}
              </Field>
              <Field
                hint={`${formatCharCount(footer.length)}/${formatCharCount(COMMENT_FOOTER_MAX_CHARS)} ký tự. Dùng {supervisor_name} và {grading_contact_phone} cho trợ giảng giám thị; trợ giảng điền theo buổi.`}
                label={FOOTER_LABEL}
              >
                {(props) => (
                  <textarea
                    className={cn(controlClassName, "py-2 font-mono text-secondary")}
                    maxLength={COMMENT_FOOTER_MAX_CHARS}
                    name="footer"
                    rows={11}
                    onChange={(event) => {
                      setFooter(event.target.value);
                      setMessage("");
                    }}
                    readOnly={!canManage}
                    value={footer}
                    {...props}
                  />
                )}
              </Field>
            </div>
        </SettingsCard>

        <SettingsCard
          className="xl:sticky xl:top-4 xl:self-start"
          description="Tin dựng từ một học sinh mẫu bằng đúng cách hàng chờ dựng tin. Bật/tắt dữ liệu để xem mục nào tự ẩn."
          title="Xem trước"
        >
          <div className="grid gap-3">
            <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
              <legend className="sr-only">Dữ liệu của học sinh mẫu</legend>
              <PreviewToggle checked={options.hasTest} onChange={() => toggle("hasTest")}>Có điểm luyện tập</PreviewToggle>
              <PreviewToggle checked={options.hasNotebook} onChange={() => toggle("hasNotebook")}>Có điểm vở</PreviewToggle>
              <PreviewToggle checked={options.notebookNotSubmitted} onChange={() => toggle("notebookNotSubmitted")}>Học sinh chưa nộp vở</PreviewToggle>
              <PreviewToggle checked={options.hasSupervisor} onChange={() => toggle("hasSupervisor")}>Đã điền trợ giảng giám thị</PreviewToggle>
              <PreviewToggle checked={options.hasAnswer} onChange={() => toggle("hasAnswer")}>Có bài làm và bài chữa (chấm AI)</PreviewToggle>
            </fieldset>
            <MessageSplitSummary maxChars={6000} parts={plan.parts} text={preview} />
            {!plan.ok ? <ResultBanner description={plan.reason} title="Tin này không gửi được" tone="danger" /> : null}
            <MessagePartsPreview parts={plan.parts} />
          </div>
        </SettingsCard>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SettingsCard title="Ô dữ liệu và quy tắc ẩn">
          <div className="grid gap-4 text-secondary text-text-default">
            <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[max-content_minmax(0,1fr)]">
              {COMMENT_TEMPLATE_VARIABLES.map((variable) => (
                <div className="contents" key={variable.key}>
                  <dt className="font-mono text-text-strong">{`{${variable.key}}`}</dt>
                  <dd className="text-text-muted">{variable.label}</dd>
                </div>
              ))}
            </dl>
            <ul className="grid list-disc gap-1 pl-5 text-text-muted">
              <li>Dòng có ô dữ liệu mà mọi ô đều trống thì ẩn.</li>
              <li>Dòng nhãn kết thúc bằng dấu hai chấm (ví dụ “- Bài làm của học sinh:”) ẩn cùng dòng dữ liệu ngay dưới nó.</li>
              <li>Trong một dòng, phần cách nhau bằng “ - ” mà ô dữ liệu trống thì ẩn (ví dụ buổi không có bài kiểm tra: dòng Kết quả chỉ còn điểm vở).</li>
              <li>Tin dài hơn 2.000 ký tự tách thành 2–3 tin gửi liền nhau, cắt ở chỗ chuyển mục; cần hơn 3 tin thì không gửi được.</li>
            </ul>
          </div>
        </SettingsCard>

        <SettingsCard description="Xếp theo khoảng điểm luyện tập cuối buổi (sau cộng điểm)." title="Thang xếp hạng">
          <RankBandList bands={bands} />
        </SettingsCard>
      </div>

      {canManage ? (
        <StickySaveBar
          changedLabels={changed}
          dirtyCount={changed.length}
          error={error ? <ResultBanner description={error} title="Chưa lưu được mẫu tin." tone="danger" /> : null}
          isSaving={pending}
          onCancel={onCancel}
          saveDisabled={template.trim() === ""}
          saveDisabledReason="Mẫu tin không được để trống."
          saveLabel="Lưu mẫu tin"
          saveType="submit"
          savingLabel="Đang lưu…"
          statusMessage={message}
        />
      ) : null}
    </form>
  );
}

function PreviewToggle({ checked, children, onChange }: { checked: boolean; children: ReactNode; onChange: () => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-secondary text-text-strong md:min-h-8">
      <input checked={checked} className="h-4 w-4 shrink-0 accent-[var(--action-primary)]" onChange={onChange} type="checkbox" />
      {children}
    </label>
  );
}

function RankBandList({ bands }: { bands: readonly RankBand[] }) {
  if (bands.length === 0) return <p className="text-secondary text-text-muted">Chưa có thang xếp hạng.</p>;
  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
  return (
    <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[max-content_minmax(0,1fr)]">
      {sorted.map((band, index) => {
        const next = sorted[index + 1];
        const range = next ? `${formatMessageScore(band.minScore)} – dưới ${formatMessageScore(next.minScore)}` : `từ ${formatMessageScore(band.minScore)}`;
        return (
          <div className="contents" key={band.minScore}>
            <dt className="text-secondary text-text-muted">{range}</dt>
            <dd className="text-secondary font-semibold text-text-strong">{band.label}</dd>
          </div>
        );
      })}
    </dl>
  );
}
