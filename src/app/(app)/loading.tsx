import { LoadingState } from "@/components/shared/loading-state";

// Keep the authenticated shell interactive while any module streams its data.
export default function ModuleLoading() {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
        <div className="h-7 w-48 max-w-full rounded-md bg-surface-sunken" />
        <div className="h-3 w-80 max-w-full rounded bg-surface-sunken" />
      </div>
      <LoadingState rows={6} title="Đang tải nội dung" />
    </div>
  );
}
