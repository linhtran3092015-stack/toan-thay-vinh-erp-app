import { LoadingNotice } from "@/components/shared/loading-state";

/**
 * /students/new skeleton in the form's own geometry (design 17a): header,
 * table of contents (a 240px card at lg+, a row of anchors below) and two
 * section cards, so the page does not jump when the form arrives.
 */
export default function NewStudentLoading() {
  return (
    <div className="grid min-w-0 gap-5">
      <LoadingNotice title="Đang tải form học sinh" />
      <div aria-hidden="true" className="grid min-w-0 gap-5 motion-safe:animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded bg-surface-sunken" />
          <div className="h-4 w-full max-w-md rounded bg-surface-sunken" />
        </div>
        <div className="grid min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
          <div className="flex gap-1 overflow-hidden lg:flex-col lg:gap-0.5 lg:rounded-lg lg:border lg:border-border-subtle lg:bg-surface-base lg:p-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="h-11 w-32 shrink-0 rounded-md bg-surface-sunken lg:h-10 lg:w-full" key={index} />
            ))}
          </div>
          <div className="grid min-w-0 gap-5">
            {[6, 4].map((fields, card) => (
              <div className="rounded-lg border border-border-subtle bg-surface-base" key={card}>
                <div className="border-b border-border-row px-5 py-4">
                  <div className="h-5 w-40 rounded bg-surface-sunken" />
                </div>
                <div className="grid gap-x-6 gap-y-4 p-5 md:grid-cols-2">
                  {Array.from({ length: fields }, (_, index) => (
                    <div className="space-y-2" key={index}>
                      <div className="h-3 w-24 rounded bg-surface-sunken" />
                      <div className="h-11 rounded-md bg-surface-sunken md:h-10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
