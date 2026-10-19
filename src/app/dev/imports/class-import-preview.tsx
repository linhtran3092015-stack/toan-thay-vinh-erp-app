import type { ClassImportPreviewProps } from "./imports-preview-params";

// Lane I2 replaces this body.
/** /dev/imports `view=classes` and `view=class-batch` body (design 17c); rendered inside the AppShell by ImportsPreview. */
export function ClassImportPreviewBody({ role, state, view }: ClassImportPreviewProps) {
  return (
    <p className="text-body text-text-muted" data-role={role} data-state={state} data-view={view}>
      Đang dựng bản xem trước…
    </p>
  );
}
