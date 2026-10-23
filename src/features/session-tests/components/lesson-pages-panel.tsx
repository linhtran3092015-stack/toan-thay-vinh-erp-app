"use client";

/* eslint-disable @next/next/no-img-element -- slides come from short-lived Supabase signed URLs; the Next image optimizer cannot fetch private objects. */

import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import type { SessionTestActions } from "@/features/session-tests/components/session-test-actions";
import { TEST_IMAGE_ACCEPT, TestImageError, checkTestImageFile } from "@/features/session-tests/image-resize";
import { newTestPagePath } from "@/features/session-tests/storage";
import type { SessionTestAsset, SessionTestLessonSource } from "@/features/session-tests/types";
import { formatTime } from "@/lib/datetime";

/** Same limit as the database (session_test_lesson_pages_page_check). */
export const LESSON_PAGES_MAX = 10;

type Feedback = { details?: string[]; message: string; tone: "error" | "success" | "warning" };

function dayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

/**
 * "Ảnh bài giảng": the teacher's end-of-lesson slides. AI reads them with the test so the key,
 * the worked solutions sent to parents and the comments follow the teacher's methods. Slides of a
 * same-grade session within 6 days can be reused without uploading them again.
 */
export function LessonPagesPanel({
  actions,
  canEdit,
  pages,
  sessionId,
  sources,
  testId,
}: {
  actions: SessionTestActions;
  canEdit: boolean;
  pages: SessionTestAsset[];
  sessionId: string;
  sources: SessionTestLessonSource[];
  testId: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = pending || progress !== null;
  const { copyLessonPages, registerLessonPages, removeLessonPage } = actions;
  const editable = canEdit && Boolean(copyLessonPages && registerLessonPages && removeLessonPage);

  if (!editable && pages.length === 0) return null;

  const ensureTestId = async (details: string[] = []): Promise<string | null> => {
    if (testId) return testId;
    const created = await actions.create({ sessionId });
    if (!created.ok) {
      setFeedback({ details, message: created.message, tone: "error" });
      return null;
    }
    return created.testId;
  };

  const uploadFiles = async (files: File[]) => {
    if (!registerLessonPages) return;
    const details: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const check = checkTestImageFile(file);
      if (check.ok) accepted.push(file);
      else details.push(`${file.name}: ${check.message}`);
    }
    const room = LESSON_PAGES_MAX - pages.length;
    if (accepted.length > room) {
      details.push(`Mỗi buổi tối đa ${LESSON_PAGES_MAX} ảnh bài giảng, chỉ thêm ${Math.max(room, 0)} ảnh đầu.`);
      accepted.splice(Math.max(room, 0));
    }
    if (accepted.length === 0) {
      setFeedback({ details, message: "Chưa thêm được ảnh nào.", tone: "error" });
      return;
    }

    setProgress({ done: 0, total: accepted.length });
    try {
      const id = await ensureTestId(details);
      if (!id) return;
      const known = new Set(pages.map((page) => page.sha256));
      const uploaded: Array<{ height: number; mimeType: string; sha256: string; storagePath: string; width: number }> = [];
      for (const [index, file] of accepted.entries()) {
        setProgress({ done: index, total: accepted.length });
        try {
          const image = await actions.prepareImage(file);
          if (known.has(image.sha256)) {
            details.push(`${file.name}: trùng với một ảnh đã có, bỏ qua.`);
            continue;
          }
          known.add(image.sha256);
          const storagePath = newTestPagePath(id);
          const upload = await actions.uploadPage(storagePath, image);
          if (!upload.ok) {
            details.push(`${file.name}: ${upload.message}`);
            continue;
          }
          uploaded.push({ height: image.height, mimeType: image.mimeType, sha256: image.sha256, storagePath, width: image.width });
        } catch (error) {
          details.push(`${file.name}: ${error instanceof TestImageError ? error.message : "Không xử lý được ảnh."}`);
        }
      }
      if (uploaded.length === 0) {
        setFeedback({ details, message: "Chưa thêm được ảnh nào.", tone: "error" });
        router.refresh();
        return;
      }
      const result = await registerLessonPages({ pages: uploaded, testId: id });
      setFeedback({ details, message: result.message, tone: !result.ok ? "error" : details.length > 0 ? "warning" : "success" });
      router.refresh();
    } finally {
      setProgress(null);
    }
  };

  const onFilesChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || busy) return;
    setFeedback(null);
    void uploadFiles(files);
  };

  const reuse = (source: SessionTestLessonSource) => {
    if (!copyLessonPages) return;
    setFeedback(null);
    startTransition(async () => {
      const id = await ensureTestId();
      if (!id) return;
      const result = await copyLessonPages({ sourceTestId: source.testId, testId: id });
      setFeedback({ message: result.message, tone: result.ok ? "success" : "error" });
      if (result.ok) router.refresh();
    });
  };

  const remove = (page: SessionTestAsset) => {
    if (!removeLessonPage) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await removeLessonPage({ pageId: page.id });
      setConfirmingRemoval(null);
      setFeedback({ message: result.message, tone: result.ok ? "success" : "error" });
      if (result.ok) router.refresh();
    });
  };

  const reusable = sources.filter((source) => source.testId !== testId);

  return (
    <section aria-labelledby="session-test-lesson-title" className="grid gap-3">
      <h3 className="text-label font-semibold text-text-strong" id="session-test-lesson-title">
        Ảnh bài giảng{pages.length > 0 ? ` (${pages.length} ảnh)` : ""}
      </h3>
      <p className="text-caption text-text-muted">
        Slide cuối buổi của thầy. AI đọc đề kèm slide để đáp án, lời giải gửi phụ huynh và nhận xét theo đúng dạng bài, phương pháp thầy dạy.
        Tải slide trước khi bấm &ldquo;AI đọc đề&rdquo;; slide dài thì cắt mỗi phần một ảnh để chữ đủ rõ.
      </p>

      {pages.length > 0 ? (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pages.map((page, index) => (
            <li className="grid content-start gap-2" key={page.id}>
              {page.url ? (
                <a
                  className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                  href={page.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <img
                    alt={`Ảnh bài giảng ${index + 1}`}
                    className="aspect-[3/4] w-full rounded-md border border-border-subtle bg-surface-sunken object-contain"
                    height={page.height}
                    loading="lazy"
                    src={page.url}
                    width={page.width}
                  />
                </a>
              ) : (
                <div className="grid aspect-[3/4] place-items-center rounded-md border border-border-subtle bg-surface-sunken p-2 text-center text-caption text-text-muted">
                  Không tải được ảnh {index + 1}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption font-medium text-text-default">Ảnh {index + 1}</span>
                {editable ? (
                  <Button
                    aria-label={`Bỏ ảnh bài giảng ${index + 1}`}
                    disabled={busy}
                    iconOnly
                    onClick={() => setConfirmingRemoval(page.id)}
                    size="md"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </Button>
                ) : null}
              </div>
              {confirmingRemoval === page.id ? (
                <div aria-label={`Bỏ ảnh bài giảng ${index + 1}`} className="grid gap-2 rounded-md border border-danger-border bg-danger-bg p-2" role="group">
                  <p className="text-caption text-danger-ink">Bỏ ảnh {index + 1} khỏi bài giảng?</p>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={pending} isLoading={pending} onClick={() => remove(page)} size="sm" variant="danger-outline">
                      Bỏ ảnh
                    </Button>
                    <Button disabled={pending} onClick={() => setConfirmingRemoval(null)} size="sm" variant="ghost">
                      Giữ lại
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary text-text-muted">Chưa có ảnh bài giảng. Không bắt buộc: không có slide thì AI tự giải theo cách thông thường.</p>
      )}

      {editable ? (
        <div className="grid gap-2">
          <input
            accept={TEST_IMAGE_ACCEPT}
            aria-hidden="true"
            className="sr-only"
            data-testid="session-test-lesson-input"
            multiple
            onChange={onFilesChosen}
            ref={inputRef}
            tabIndex={-1}
            type="file"
          />
          <Button
            className="justify-self-start"
            disabled={busy || pages.length >= LESSON_PAGES_MAX}
            disabledReason={pages.length >= LESSON_PAGES_MAX ? `Đã đủ ${LESSON_PAGES_MAX} ảnh bài giảng.` : undefined}
            isLoading={progress !== null}
            onClick={() => inputRef.current?.click()}
            variant="secondary"
          >
            <ImagePlus aria-hidden="true" size={18} />
            Tải ảnh bài giảng
          </Button>
          {progress ? (
            <p className="text-secondary text-text-default" role="status">
              Đang xử lý ảnh {Math.min(progress.done + 1, progress.total)}/{progress.total}…
            </p>
          ) : null}
          {reusable.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-caption font-medium text-text-default">Dùng slide của buổi khác cùng khối trong tuần:</p>
              <ul className="grid gap-2">
                {reusable.map((source) => (
                  <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle p-2" key={source.testId}>
                    <span className="text-secondary text-text-default">
                      {source.classCode} · {dayLabel(source.sessionDate)} {formatTime(source.startTime)} · {source.pageCount} ảnh
                    </span>
                    <Button disabled={busy} onClick={() => reuse(source)} size="sm" variant="secondary">
                      Dùng slide này
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {feedback ? (
        <ResultBanner title={feedback.message} tone={feedback.tone}>
          {feedback.details && feedback.details.length > 0 ? (
            <ul className="mt-1 grid gap-1">
              {feedback.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </ResultBanner>
      ) : null}
    </section>
  );
}
