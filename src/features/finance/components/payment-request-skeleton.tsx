import { LoadingNotice } from "@/components/shared/loading-state";

export function PaymentRequestSkeleton() {
  return (
    <div className="grid gap-5">
      <LoadingNotice title="Đang tải yêu cầu thanh toán" />
      <div aria-hidden="true" className="grid gap-5 motion-safe:animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-surface-sunken" />
          <div className="h-8 w-64 rounded bg-surface-sunken" />
          <div className="h-4 w-full max-w-lg rounded bg-surface-sunken" />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="h-24 rounded-lg bg-surface-sunken" key={index} />
          ))}
        </div>
        <div className="h-40 rounded-lg bg-surface-sunken" />
        <div className="hidden h-96 rounded-lg bg-surface-sunken lg:block" />
        <div className="grid gap-3 lg:hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="h-64 rounded-lg bg-surface-sunken" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

