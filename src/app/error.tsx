"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      actionLabel="Thử lại"
      description={error.message || "Vui lòng thử lại sau ít phút."}
      onReset={reset}
      title="Không thể tải dữ liệu"
    />
  );
}
