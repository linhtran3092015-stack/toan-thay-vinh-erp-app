import { LoadingNotice } from "@/components/shared/loading-state";

export default function OwnerPayrollDashboardLoading() {
  return (
    <div className="grid gap-5">
      <LoadingNotice title="Đang tải Dashboard lương" />
      <div aria-hidden="true" className="grid gap-5 motion-safe:animate-pulse">
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
          <div className="grid gap-2"><div className="h-4 w-28 rounded bg-surface-sunken" /><div className="h-8 w-72 max-w-full rounded bg-surface-sunken" /><div className="h-4 w-96 max-w-full rounded bg-surface-sunken" /></div>
          <div className="h-20 w-full rounded-lg bg-surface-sunken lg:w-[560px]" />
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => <div className={`h-40 bg-surface-base p-4 ${index === 4 ? "sm:col-span-2 xl:col-span-1" : ""}`} key={index}><div className="h-4 w-2/3 rounded bg-surface-sunken" /><div className="mt-6 h-7 w-4/5 rounded bg-surface-sunken" /><div className="mt-4 h-3 w-1/2 rounded bg-surface-sunken" /></div>)}
        </div>
        <div className="grid gap-5 xl:grid-cols-2"><div className="h-[380px] rounded-lg bg-surface-sunken" /><div className="h-[380px] rounded-lg bg-surface-sunken" /></div>
        <div className="h-[360px] rounded-lg bg-surface-sunken" />
      </div>
    </div>
  );
}
