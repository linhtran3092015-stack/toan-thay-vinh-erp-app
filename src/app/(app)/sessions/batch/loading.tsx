import { LoadingNotice } from "@/components/shared/loading-state";

/** /sessions/batch while classes, schedules and existing sessions load: the workspace's geometry (header, form cards, chip grid). */
export default function BatchSessionsLoading() {
  return (
    <div className="grid min-w-0 gap-5">
      <LoadingNotice description="Lịch tuần và buổi đã có của lớp sẽ hiện khi tải xong." title="Đang tải dữ liệu tạo buổi học hàng loạt" />
      <div aria-hidden="true" className="grid gap-5 motion-safe:animate-pulse">
        <div className="grid gap-2">
          <div className="h-8 w-64 max-w-full rounded-md bg-surface-sunken" />
          <div className="h-4 w-full max-w-lg rounded-sm bg-surface-sunken" />
        </div>
        <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start">
          <div className="grid gap-5 lg:max-xl:grid-cols-2">
            {[5, 4].map((fields, card) => (
              <div className="rounded-lg border border-border-subtle bg-surface-base" key={card}>
                <div className="border-b border-border-row px-5 py-4">
                  <div className="h-5 w-48 max-w-full rounded-sm bg-surface-sunken" />
                </div>
                <div className="grid gap-4 p-5">
                  {Array.from({ length: fields }, (_, index) => (
                    <div className="grid gap-1.5" key={index}>
                      <div className="h-3.5 w-28 rounded-sm bg-surface-sunken" />
                      <div className="h-10 rounded-md bg-surface-sunken" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid content-start gap-4">
            <div className="rounded-lg border border-border-subtle bg-surface-base">
              <div className="border-b border-border-row px-5 py-4">
                <div className="h-5 w-72 max-w-full rounded-sm bg-surface-sunken" />
              </div>
              <div className="grid gap-3 p-5">
                <div className="h-4 w-80 max-w-full rounded-sm bg-surface-sunken" />
                <div className="grid grid-cols-3 gap-1.5 md:grid-cols-6">
                  {Array.from({ length: 18 }, (_, index) => (
                    <div className="h-10 rounded-sm bg-surface-sunken" key={index} />
                  ))}
                </div>
                <div className="h-3 w-96 max-w-full rounded-sm bg-surface-sunken" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <div className="h-10 w-20 rounded-md bg-surface-sunken" />
              <div className="h-10 w-56 rounded-md bg-surface-sunken" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
