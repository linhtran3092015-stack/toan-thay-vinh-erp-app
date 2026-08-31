import { School } from "lucide-react";

import { LoadingState } from "@/components/shared/loading-state";

/** No user data or permission-dependent navigation before authentication finishes. */
export function AppShellLoading() {
  return (
    <div className="min-h-screen bg-surface-canvas text-text-strong">
      <div aria-hidden="true" className="fixed inset-y-0 left-0 hidden w-[72px] border-r border-[var(--nav-sidebar-border)] bg-[var(--nav-sidebar-bg)] md:block xl:w-[var(--sidebar-width)]">
        <div className="flex h-16 items-center gap-3 border-b border-[var(--nav-sidebar-border)] px-6 text-[var(--nav-sidebar-fg)]">
          <School className="h-5 w-5 shrink-0" />
          <span className="hidden text-sm font-semibold xl:inline">ERP vận hành</span>
        </div>
        <div className="grid gap-3 p-3 motion-safe:animate-pulse">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="h-11 rounded-md bg-[var(--nav-sidebar-hover)]" key={index} />
          ))}
        </div>
      </div>
      <div className="md:pl-[72px] xl:pl-[var(--sidebar-width)]">
        <div aria-hidden="true" className="flex h-[var(--topbar-height)] items-center justify-end gap-3 border-b border-border-subtle bg-surface-base px-4 sm:px-5 lg:px-6">
          <div className="h-8 w-8 rounded-full bg-surface-sunken motion-safe:animate-pulse" />
          <div className="h-8 w-28 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
        </div>
        <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-5 lg:px-6">
          <LoadingState description="Đang chuẩn bị không gian làm việc của bạn." rows={6} title="Đang mở hệ thống" />
        </main>
      </div>
    </div>
  );
}
