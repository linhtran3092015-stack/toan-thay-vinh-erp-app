import { BrandMark } from "@/components/layout/sidebar";
import { LoadingState } from "@/components/shared/loading-state";

/** No user data or permission-dependent navigation before authentication finishes. */
export function AppShellLoading() {
  return (
    <div className="min-h-screen bg-surface-canvas text-text-strong">
      <div aria-hidden="true" className="fixed inset-y-0 left-0 hidden w-[var(--rail-w)] border-r border-[var(--nav-sidebar-border)] bg-[var(--nav-sidebar-bg)] md:block xl:w-[var(--sidebar-w)]">
        <div className="flex h-16 items-center gap-2.5 border-b border-[var(--nav-sidebar-border)] px-4 max-xl:justify-center max-xl:px-0">
          <BrandMark />
          <span className="hidden text-[15px] font-bold leading-5 xl:inline">ERP vận hành</span>
        </div>
        <div className="grid gap-1 p-2 motion-safe:animate-pulse max-xl:justify-items-center max-xl:px-3">
          <div className="mb-1 mt-2 hidden h-3 w-16 rounded-sm bg-surface-sunken xl:block" />
          {Array.from({ length: 5 }, (_, index) => (
            <div className="h-11 rounded-md bg-[var(--nav-sidebar-hover)] max-xl:w-12" key={index} />
          ))}
          <div className="mb-1 mt-3 hidden h-3 w-16 rounded-sm bg-surface-sunken xl:block" />
          {Array.from({ length: 4 }, (_, index) => (
            <div className="h-11 rounded-md bg-[var(--nav-sidebar-hover)] max-xl:w-12" key={`ops-${index}`} />
          ))}
        </div>
      </div>
      <div className="md:pl-[var(--rail-w)] xl:pl-[var(--sidebar-w)]">
        <div aria-hidden="true" className="flex h-[var(--topbar-h)] items-center gap-3 border-b border-border-subtle bg-surface-base px-4 md:px-5 lg:px-6">
          <div className="h-4 w-40 rounded-sm bg-surface-sunken motion-safe:animate-pulse" />
          <div className="ml-auto h-10 w-10 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
          <div className="h-10 w-10 rounded-md bg-surface-sunken motion-safe:animate-pulse lg:w-40" />
        </div>
        <main className="mx-auto max-w-[1600px] px-4 py-4 md:px-5 md:py-5 lg:p-6">
          <LoadingState description="Đang chuẩn bị không gian làm việc của bạn." rows={6} title="Đang mở hệ thống" />
        </main>
      </div>
    </div>
  );
}
