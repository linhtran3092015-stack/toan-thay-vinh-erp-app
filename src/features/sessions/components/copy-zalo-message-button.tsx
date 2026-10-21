"use client";

import { Check, Copy } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { getSessionCommentMessageAction, type CommentMessageResult } from "@/features/sessions/actions/session-comment-message-actions";

/**
 * "Sao chép tin Zalo" on a session result with a comment: one click copies the whole parent
 * message exactly as the Zalo queue renders it, ready to paste into Zalo.
 */
export function CopyZaloMessageButton({
  load = getSessionCommentMessageAction,
  resultId,
}: {
  load?: (input: { resultId: string }) => Promise<CommentMessageResult>;
  resultId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    setError(null);
    setCopied(false);
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
      try {
        await navigator.clipboard.writeText(result.text);
        setCopied(true);
      } catch {
        setError("Trình duyệt chặn sao chép. Bấm lại lần nữa.");
      }
    });
  };

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      <Button disabled={pending} isLoading={pending} onClick={onClick} size="sm" type="button" variant="ghost">
        {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
        {copied ? "Đã chép tin Zalo" : "Sao chép tin Zalo"}
      </Button>
      {error ? <span className="text-caption text-danger" role="alert">{error}</span> : null}
    </span>
  );
}
