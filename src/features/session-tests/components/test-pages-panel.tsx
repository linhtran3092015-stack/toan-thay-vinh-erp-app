"use client";

/* eslint-disable @next/next/no-img-element -- photos come from short-lived Supabase signed URLs; the Next image optimizer cannot fetch private objects. */

import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import type { SessionTestActions } from "@/features/session-tests/components/session-test-actions";
import {
  TEST_IMAGE_ACCEPT,
  TEST_IMAGE_MAX_EDGE,
  TEST_PAGES_MAX,
  TestImageError,
  checkTestImageFile,
} from "@/features/session-tests/image-resize";
import { newTestPagePath } from "@/features/session-tests/storage";
import type { SessionTestAsset } from "@/features/session-tests/types";

type Feedback = { details?: string[]; message: string; tone: "error" | "success" | "warning" };

function feedbackOf(result: { message: string; ok: boolean }): Feedback {
  return { message: result.message, tone: result.ok ? "success" : "error" };
}

/** Ask the server for fresh signed links at most once a minute when a photo fails to load. */
const REFRESH_THROTTLE_MS = 60_000;

/**
 * "Ảnh đề": the test photos in page order. People who manage tests upload more pages (shrunk
 * in the browser first), move pages up or down and remove them; everyone else only looks.
 * Tapping a page opens the full photo in a new tab (pinch to zoom on a phone).
 */
export function TestPagesPanel({
  actions,
  assets,
  canEdit,
  sessionId,
  testId,
}: {
  actions: SessionTestActions;
  assets: SessionTestAsset[];
  canEdit: boolean;
  sessionId: string;
  testId: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastRefreshRef = useRef(0);
  const [order, setOrder] = useState(assets);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = pending || progress !== null;

  // A refresh brings new signed links and the saved order.
  const [shownAssets, setShownAssets] = useState(assets);
  if (shownAssets !== assets) {
    setShownAssets(assets);
    setOrder(assets);
  }

  const refreshExpiredLinks = () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
    lastRefreshRef.current = now;
    router.refresh();
  };

  const uploadFiles = async (files: File[]) => {
    const details: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const check = checkTestImageFile(file);
      if (check.ok) accepted.push(file);
      else details.push(`${file.name}: ${check.message}`);
    }
    const room = TEST_PAGES_MAX - order.length;
    if (accepted.length > room) {
      details.push(`Mỗi đề tối đa ${TEST_PAGES_MAX} trang, chỉ thêm ${Math.max(room, 0)} ảnh đầu.`);
      accepted.splice(Math.max(room, 0));
    }
    if (accepted.length === 0) {
      setFeedback({ details, message: "Chưa thêm được ảnh nào.", tone: "error" });
      return;
    }

    setProgress({ done: 0, total: accepted.length });
    try {
      let id = testId;
      if (!id) {
        const created = await actions.create({ sessionId });
        if (!created.ok) {
          setFeedback({ details, message: created.message, tone: "error" });
          return;
        }
        id = created.testId;
      }

      const known = new Set(order.map((asset) => asset.sha256));
      const uploaded: Array<{ height: number; mimeType: string; sha256: string; storagePath: string; width: number }> = [];
      for (const [index, file] of accepted.entries()) {
        setProgress({ done: index, total: accepted.length });
        try {
          const image = await actions.prepareImage(file);
          if (known.has(image.sha256)) {
            details.push(`${file.name}: trùng với một trang đã có, bỏ qua.`);
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
      const result = await actions.registerAssets({ assets: uploaded, testId: id });
      setFeedback({ details, message: result.message, tone: !result.ok ? "error" : details.length > 0 ? "warning" : "success" });
      router.refresh();
    } finally {
      setProgress(null);
    }
  };

  const onFilesChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Choosing the same photo again must fire change again.
    event.target.value = "";
    if (files.length === 0 || busy) return;
    setFeedback(null);
    void uploadFiles(files);
  };

  const move = (index: number, delta: -1 | 1) => {
    if (!testId || busy) return;
    const next = [...order];
    const [page] = next.splice(index, 1);
    next.splice(index + delta, 0, page);
    const previous = order;
    setOrder(next);
    setFeedback(null);
    startTransition(async () => {
      const result = await actions.reorderAssets({ assetIds: next.map((asset) => asset.id), testId });
      if (!result.ok) {
        setOrder(previous);
        setFeedback(feedbackOf(result));
        return;
      }
      router.refresh();
    });
  };

  const remove = (asset: SessionTestAsset) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await actions.removeAsset({ assetId: asset.id });
      setConfirmingRemoval(null);
      setFeedback(feedbackOf(result));
      if (result.ok) router.refresh();
    });
  };

  return (
    <section aria-labelledby="session-test-pages-title" className="grid content-start gap-3 lg:sticky lg:top-4 lg:self-start">
      <h3 className="text-label font-semibold text-text-strong" id="session-test-pages-title">
        Ảnh đề{order.length > 0 ? ` (${order.length} trang)` : ""}
      </h3>

      {order.length === 0 ? (
        <p className="text-secondary text-text-muted">Chưa có ảnh đề.</p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
          {order.map((asset, index) => {
            const pageNo = index + 1;
            return (
              <li className="grid content-start gap-2" key={asset.id}>
                {asset.url ? (
                  <a
                    className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                    href={asset.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <img
                      alt={`Trang ${pageNo} của đề`}
                      className="aspect-[3/4] w-full rounded-md border border-border-subtle bg-surface-sunken object-contain"
                      height={asset.height}
                      loading="lazy"
                      onError={refreshExpiredLinks}
                      src={asset.url}
                      width={asset.width}
                    />
                  </a>
                ) : (
                  <div className="grid aspect-[3/4] place-items-center rounded-md border border-border-subtle bg-surface-sunken p-2 text-center text-caption text-text-muted">
                    Không tải được ảnh trang {pageNo}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="text-caption font-medium text-text-default">Trang {pageNo}</span>
                  {canEdit ? (
                    <span className="flex gap-1">
                      <Button
                        aria-label={`Đưa trang ${pageNo} lên trước`}
                        disabled={busy || index === 0}
                        iconOnly
                        onClick={() => move(index, -1)}
                        size="md"
                        variant="ghost"
                      >
                        <ArrowUp aria-hidden="true" size={18} />
                      </Button>
                      <Button
                        aria-label={`Đưa trang ${pageNo} xuống sau`}
                        disabled={busy || index === order.length - 1}
                        iconOnly
                        onClick={() => move(index, 1)}
                        size="md"
                        variant="ghost"
                      >
                        <ArrowDown aria-hidden="true" size={18} />
                      </Button>
                      <Button
                        aria-label={`Bỏ trang ${pageNo}`}
                        disabled={busy}
                        iconOnly
                        onClick={() => setConfirmingRemoval(asset.id)}
                        size="md"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" size={18} />
                      </Button>
                    </span>
                  ) : null}
                </div>
                {confirmingRemoval === asset.id ? (
                  <div className="grid gap-2 rounded-md border border-danger-border bg-danger-bg p-2" role="group" aria-label={`Bỏ trang ${pageNo}`}>
                    <p className="text-caption text-danger-ink">Bỏ trang {pageNo} khỏi đề? Các trang sau dồn lên.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={pending} isLoading={pending} onClick={() => remove(asset)} size="sm" variant="danger-outline">
                        Bỏ trang
                      </Button>
                      <Button disabled={pending} onClick={() => setConfirmingRemoval(null)} size="sm" variant="ghost">
                        Giữ lại
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {canEdit ? (
        <div className="grid gap-2">
          <input
            accept={TEST_IMAGE_ACCEPT}
            aria-hidden="true"
            className="sr-only"
            data-testid="session-test-file-input"
            multiple
            onChange={onFilesChosen}
            ref={inputRef}
            tabIndex={-1}
            type="file"
          />
          <Button
            className="justify-self-start"
            disabled={busy || order.length >= TEST_PAGES_MAX}
            disabledReason={order.length >= TEST_PAGES_MAX ? `Đề đã đủ ${TEST_PAGES_MAX} trang.` : undefined}
            isLoading={progress !== null}
            onClick={() => inputRef.current?.click()}
            variant="secondary"
          >
            <ImagePlus aria-hidden="true" size={18} />
            Chụp hoặc chọn ảnh đề
          </Button>
          <p className="text-caption text-text-muted">
            JPEG, PNG, WebP hoặc GIF, chọn được nhiều ảnh một lần. Ảnh tự thu nhỏ còn cạnh dài {TEST_IMAGE_MAX_EDGE.toLocaleString("vi-VN")} px
            trước khi tải lên.
          </p>
          {progress ? (
            <p className="text-secondary text-text-default" role="status">
              Đang xử lý ảnh {Math.min(progress.done + 1, progress.total)}/{progress.total}…
            </p>
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
