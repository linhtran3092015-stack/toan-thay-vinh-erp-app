"use client";

import { ErrorState } from "@/components/shared/error-state";

// Lives inside the (app) route group so an error keeps the sidebar and topbar
// instead of replacing the whole shell. Raw error text is never shown.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      actionLabel="Thử lại"
      description={
        error.digest
          ? `Vui lòng thử lại sau ít phút. Mã sự cố: ${error.digest}`
          : "Vui lòng thử lại sau ít phút."
      }
      onReset={reset}
      title="Không thể tải trang"
    />
  );
}
