import { LoadingState } from "@/components/shared/loading-state";

export function StudentFormSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-4">
      <div className="h-8 w-64 animate-pulse rounded-md bg-neutral-bg" />
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className="h-11 animate-pulse rounded-md bg-neutral-bg"
            key={index}
          />
        ))}
      </div>
      <LoadingState rows={6} title="Đang tải form học viên" />
    </div>
  );
}
