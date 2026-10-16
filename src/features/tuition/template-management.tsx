"use client";

import { QrCode } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { publishTuitionTemplateAction, type TuitionActionResult } from "@/features/tuition/actions";
import { FeeNoticeA5 } from "@/features/tuition/fee-notice-a5";
import { buildSampleFeeNoticeModel } from "@/features/tuition/fee-notice-model";
import {
  formatTemplatePublishedAt,
  formatTemplatePublishedOn,
  formatTemplateUsage,
  getNextTemplateVersion,
  getTemplatePublishBlockedReason,
  normalizeTemplateFormValues,
  TEMPLATE_FIELD_LIMITS,
  toTemplateContent,
  TUITION_NOTICE_TEMPLATE_CODE,
  type TuitionTemplateFormValues,
  type TuitionTemplateUsage,
  type TuitionTemplateVersion,
} from "@/features/tuition/receipt-template-models";

const UNCERTAIN_RESULT = "Không rõ phiên bản mẫu đã được xuất bản chưa; tải lại trang để kiểm tra trước khi thử lại.";
const EMPTY_VALUES: TuitionTemplateFormValues = { announcement: "", centerDisplayName: "", footer: "", title: "" };

export interface TuitionTemplateManagementProps {
  /** Newest first by `published_at`: the first one is the version the next lock snapshots. */
  versions: readonly TuitionTemplateVersion[];
  /** Periods on the current version; null hides the usage line (periods not read or not readable). */
  usage: TuitionTemplateUsage | null;
  /** Inert stand-in for previews; defaults to the real server action. */
  publishAction?: typeof publishTuitionTemplateAction;
}

/**
 * Mẫu Phiếu học phí (design 15b, left column + live A5 preview): the header
 * owns the page's one primary ("Xuất bản phiên bản v{n+1}", disabled with a
 * visible reason), the form edits the four text fields the server action
 * stores, the history lists every version, and the preview prints the form's
 * values on a sample student.
 *
 * Not built from the design: the "Hiển thị mã QR VietQR" toggle (the action
 * always stores `show_qr: true` and no screen reads it) and period codes
 * ("KT-2610": periods are named). After a publish the editor remounts from the
 * new current version; the result state lives here, so it survives the
 * remount, and the remounted editor renders the banner again and moves focus
 * to it so a keyboard or screen-reader user lands on the outcome instead of
 * the top of the page.
 */
export function TuitionTemplateManagement({ publishAction = publishTuitionTemplateAction, usage, versions }: TuitionTemplateManagementProps) {
  const [result, setResult] = useState<TuitionActionResult | null>(null);
  const current = versions[0] ?? null;

  return (
    <TemplateEditor
      current={current}
      key={current?.version ?? 0}
      onResult={setResult}
      publishAction={publishAction}
      result={result}
      usage={usage}
      versions={versions}
    />
  );
}

interface TemplateEditorProps {
  current: TuitionTemplateVersion | null;
  onResult: (result: TuitionActionResult | null) => void;
  publishAction: typeof publishTuitionTemplateAction;
  result: TuitionActionResult | null;
  usage: TuitionTemplateUsage | null;
  versions: readonly TuitionTemplateVersion[];
}

function TemplateEditor({ current, onResult, publishAction, result, usage, versions }: TemplateEditorProps) {
  const formId = useId();
  const historyTitleId = useId();
  const previewTitleId = useId();
  const [values, setValues] = useState<TuitionTemplateFormValues>(() => current?.content ?? EMPTY_VALUES);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const nextVersion = getNextTemplateVersion(versions);
  const blockedReason = getTemplatePublishBlockedReason(values, reason, current);
  const sample = useMemo(() => buildSampleFeeNoticeModel(toTemplateContent(values)), [values]);
  const resultRef = useRef<HTMLDivElement>(null);

  // A new version remounts this editor (key), which drops focus to the body; the
  // result outlives the remount, so focus its banner when one arrives or is
  // already there on mount.
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const update = (key: keyof TuitionTemplateFormValues) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || blockedReason) return;
    const content = normalizeTemplateFormValues(values);
    const publishReason = reason.trim();
    start(async () => {
      onResult(null);
      try {
        onResult(await publishAction({ ...content, reason: publishReason }));
      } catch {
        onResult({ message: UNCERTAIN_RESULT, status: "error" });
      }
    });
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader
        actions={
          <Button
            className="max-md:h-11"
            disabled={blockedReason !== null}
            disabledReason={blockedReason ?? undefined}
            form={formId}
            isLoading={pending}
            type="submit"
          >
            {`Xuất bản phiên bản v${nextVersion}`}
          </Button>
        }
        context={
          current ? <Badge tone="success">{`v${current.version} đang dùng`}</Badge> : <Badge tone="neutral">Chưa có phiên bản</Badge>
        }
        title="Mẫu Phiếu học phí"
      >
        <div className="mt-1 grid gap-0.5 text-secondary text-text-muted">
          <p className="break-words">
            {current
              ? `${TUITION_NOTICE_TEMPLATE_CODE} · xuất bản ${formatTemplatePublishedAt(current.publishedAt)} bởi ${current.publisherName}`
              : `${TUITION_NOTICE_TEMPLATE_CODE} · chưa xuất bản phiên bản nào; kỳ thu chỉ khóa được khi đã có mẫu.`}
          </p>
          {current && usage ? <p className="break-words">{formatTemplateUsage(usage, current.version)}</p> : null}
          <p className="mt-1.5 text-text-default">
            {`Xuất bản tạo v${nextVersion}. Kỳ thu khóa sau đó dùng phiên bản mới nhất; kỳ đã khóa giữ nguyên phiếu đã tạo.`}
          </p>
        </div>
      </PageHeader>

      {result ? (
        <div
          className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          ref={resultRef}
          tabIndex={-1}
        >
          <ResultBanner title={result.message} tone={result.status === "success" ? "success" : "error"} />
        </div>
      ) : null}

      {/* Container queries, not viewport breakpoints: the sidebar eats ~290px, so only the content width says whether form + A5 preview fit side by side. */}
      <div className="@container min-w-0">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 @min-[1100px]:grid-cols-[minmax(0,1fr)_520px]">
          <div className="@container grid min-w-0 gap-4">
            <form
              aria-label="Nội dung mẫu Phiếu học phí"
              className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-4 rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)] @min-[560px]:grid-cols-2 md:p-5"
              id={formId}
              onSubmit={submit}
            >
              <Field hint="{PERIOD_NAME} được thay bằng tên kỳ thu" label="Tiêu đề phiếu" required>
                {(control) => (
                  <Input {...control} maxLength={TEMPLATE_FIELD_LIMITS.title} name="title" onChange={update("title")} required value={values.title} />
                )}
              </Field>
              <Field label="Tên trung tâm hiển thị" required>
                {(control) => (
                  <Input
                    {...control}
                    maxLength={TEMPLATE_FIELD_LIMITS.centerDisplayName}
                    name="centerDisplayName"
                    onChange={update("centerDisplayName")}
                    required
                    value={values.centerDisplayName}
                  />
                )}
              </Field>
              <Field className="@min-[560px]:col-span-2" label="Đoạn thông báo">
                {(control) => (
                  <Textarea
                    {...control}
                    maxLength={TEMPLATE_FIELD_LIMITS.announcement}
                    name="announcement"
                    onChange={update("announcement")}
                    rows={3}
                    value={values.announcement}
                  />
                )}
              </Field>
              {/* A textarea, not the design's input: the sheet prints line breaks and an input would drop them from a stored footer. */}
              <Field className="@min-[560px]:col-span-2" hint="Ghi số điện thoại liên hệ ở đây — phiếu không tự lấy số trung tâm." label="Chân trang" required>
                {(control) => (
                  <Textarea
                    {...control}
                    maxLength={TEMPLATE_FIELD_LIMITS.footer}
                    name="footer"
                    onChange={update("footer")}
                    required
                    rows={2}
                    value={values.footer}
                  />
                )}
              </Field>
              <p className="flex items-start gap-2 text-secondary text-text-default @min-[560px]:mt-6 @min-[560px]:self-start">
                <QrCode aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                Mã QR VietQR luôn in trên phiếu cần thanh toán.
              </p>
              <Field label="Lý do xuất bản" required>
                {(control) => (
                  <Input
                    {...control}
                    maxLength={TEMPLATE_FIELD_LIMITS.reason}
                    name="reason"
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="VD: đổi số điện thoại liên hệ"
                    required
                    value={reason}
                  />
                )}
              </Field>
            </form>

            <section
              aria-labelledby={historyTitleId}
              className="overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]"
            >
              <h2 className="border-b border-border-row px-4 py-3 text-body font-semibold text-text-strong" id={historyTitleId}>
                Lịch sử phiên bản
              </h2>
              {versions.length === 0 ? (
                <p className="px-4 py-3 text-secondary text-text-muted">Chưa có phiên bản nào được xuất bản.</p>
              ) : (
                <ol className="divide-y divide-border-row">
                  {versions.map((version, index) => (
                    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 px-4 py-2.5 text-secondary" key={version.id}>
                      <span className="font-semibold tabular-nums text-text-strong">{`v${version.version}`}</span>
                      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="min-w-0 break-words text-text-default">{version.reason}</span>
                        {index === 0 ? <Badge tone="success">Đang dùng</Badge> : null}
                      </span>
                      {/* Date and publisher on their own line so a long reason keeps the full width. */}
                      <span className="col-start-2 tabular-nums text-text-muted">
                        {`${formatTemplatePublishedOn(version.publishedAt)} · ${version.publisherName}`}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <section aria-labelledby={previewTitleId} className="grid min-w-0 justify-items-center gap-3">
            <div className="w-full max-w-[520px]">
              <h2 className="text-body font-semibold text-text-strong" id={previewTitleId}>
                Xem trước (dữ liệu mẫu)
              </h2>
              <p className="text-secondary text-text-muted">
                Bố cục in A5 theo nội dung đang nhập. Học sinh, số tiền, tài khoản và mã chuyển khoản là dữ liệu mẫu; phiếu thật lấy từ snapshot lúc khóa kỳ.
              </p>
            </div>
            <FeeNoticeA5 ariaLabel="Phiếu học phí mẫu" headingLevel={3} model={sample} printable={false} />
          </section>
        </div>
      </div>
    </div>
  );
}
