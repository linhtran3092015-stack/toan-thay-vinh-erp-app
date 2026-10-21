"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { approveGreenSubmissionsAction, type BulkApproveResult } from "@/features/grading-submissions/review-approval-actions";

/** "Duyệt N bài xanh": approves every green paper of the session with its draft comment. */
export function ApproveGreenButton({
  action = approveGreenSubmissionsAction,
  count,
  sessionId,
}: {
  action?: typeof approveGreenSubmissionsAction;
  count: number;
  sessionId: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<BulkApproveResult | null>(null);
  const [pending, startTransition] = useTransition();
  if (count === 0 && !result) return null;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={pending || count === 0}
          isLoading={pending}
          onClick={() =>
            startTransition(async () => {
              let outcome: BulkApproveResult;
              try {
                outcome = await action({ sessionId });
              } catch {
                outcome = { approved: 0, failed: 0, message: "Không kết nối được máy chủ. Vui lòng thử lại.", ok: false, skipped: 0 };
              }
              setResult(outcome);
              if (outcome.approved > 0) router.refresh();
            })
          }
          variant="secondary"
        >
          Duyệt {count} bài xanh
        </Button>
        <span className="text-caption text-text-muted">Dùng kết quả AI, tick tích cực đã chọn và nhận xét soạn sẵn. Bài vàng, đỏ duyệt từng bài.</span>
      </div>
      {result ? <ResultBanner title={result.message} tone={result.ok ? "success" : "error"} /> : null}
    </div>
  );
}
