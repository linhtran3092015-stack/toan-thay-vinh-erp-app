"use client";

import { Check, Copy } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { getSessionCommentMessageAction, type CommentMessageResult } from "@/features/sessions/actions/session-comment-message-actions";

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * "Sao chép tin Zalo" on a session result with a comment: copies the parent message exactly as the
 * Zalo queue would send it. A long message is split like the queue (2–3 parts): the first part is
 * copied at once and each part gets its own copy button.
 */
export function CopyZaloMessageButton({
  load = getSessionCommentMessageAction,
  resultId,
}: {
  load?: (input: { resultId: string }) => Promise<CommentMessageResult>;
  resultId: string;
}) {
  const [parts, setParts] = useState<string[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const copyPart = async (list: string[], index: number) => {
    const ok = await writeClipboard(list[index]);
    if (ok) {
      setCopied(index);
      setError(null);
    } else {
      setError("Trình duyệt chặn sao chép. Bấm lại lần nữa.");
    }
  };

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      let result: CommentMessageResult;
      try {
        result = await load({ resultId });
      } catch {
        result = { message: "Không kết nối được máy chủ. Vui lòng thử lại.", ok: false };
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setParts(result.parts);
      await copyPart(result.parts, 0);
    });
  };

  if (parts && parts.length > 1) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1">
        {parts.map((_, index) => (
          <Button key={index} onClick={() => void copyPart(parts, index)} size="sm" type="button" variant={copied === index ? "secondary" : "ghost"}>
            {copied === index ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
            Chép phần {index + 1}/{parts.length}
          </Button>
        ))}
        {error ? <span className="text-caption text-danger" role="alert">{error}</span> : null}
      </div>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      <Button disabled={pending} isLoading={pending} onClick={onClick} size="sm" type="button" variant="ghost">
        {copied === 0 ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
        {copied === 0 ? "Đã chép tin Zalo" : "Sao chép tin Zalo"}
      </Button>
      {error ? <span className="text-caption text-danger" role="alert">{error}</span> : null}
    </span>
  );
}
