"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function OwnerPayrollDashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid gap-4">
      <ErrorState description="Không thể tải dữ liệu lương. Vui lòng thử lại." title="Không tải được Dashboard lương" />
      <button className="mx-auto min-h-11 rounded-md bg-action-primary px-4 text-control font-semibold text-text-on-primary hover:bg-action-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" onClick={reset} type="button">Thử lại</button>
    </div>
  );
}
