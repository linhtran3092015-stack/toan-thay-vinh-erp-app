import { LoadingNotice } from "@/components/shared/loading-state";

/** /classes/new while the permissions and open academic years load: the form's own geometry (header, two section cards, action row). */
export default function CreateClassLoading() {
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-5xl gap-5">
      <LoadingNotice description="Biểu mẫu sẽ hiện khi danh sách năm học đang mở tải xong." title="Đang tải biểu mẫu tạo lớp" />
      <div aria-hidden="true" className="grid gap-5 motion-safe:animate-pulse">
        <div className="grid gap-2">
          <div className="h-8 w-40 rounded-md bg-surface-sunken" />
          <div className="h-4 w-full max-w-md rounded-sm bg-surface-sunken" />
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-base">
          <div className="border-b border-border-row px-5 py-4">
            <div className="h-5 w-32 rounded-sm bg-surface-sunken" />
          </div>
          <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-6">
            {["sm:col-span-2 lg:col-span-4", "lg:col-span-2", "lg:col-span-3", "lg:col-span-1", "lg:col-span-2", "lg:col-span-3", "lg:col-span-3"].map(
              (span, index) => (
                <div className={`grid gap-1.5 ${span}`} key={index}>
                  <div className="h-3.5 w-20 rounded-sm bg-surface-sunken" />
                  <div className="h-10 rounded-md bg-surface-sunken" />
                </div>
              ),
            )}
            <div className="grid gap-1.5 sm:col-span-2 lg:col-span-6">
              <div className="h-3.5 w-28 rounded-sm bg-surface-sunken" />
              <div className="h-10 rounded-md bg-surface-sunken" />
            </div>
            <div className="grid gap-1.5 sm:col-span-2 lg:col-span-6">
              <div className="h-3.5 w-16 rounded-sm bg-surface-sunken" />
              <div className="h-28 rounded-md bg-surface-sunken" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-base">
          <div className="border-b border-border-row px-5 py-4">
            <div className="h-5 w-24 rounded-sm bg-surface-sunken" />
          </div>
          <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="h-11 rounded-md bg-surface-sunken" key={index} />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <div className="h-10 w-20 rounded-md bg-surface-sunken" />
          <div className="h-10 w-36 rounded-md bg-surface-sunken" />
        </div>
      </div>
    </div>
  );
}
