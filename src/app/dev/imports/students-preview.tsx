import type { StudentImportPreviewProps } from "./imports-preview-params";

// Lane I1 replaces this body.
/** /dev/imports `view=students` body (design 17c); rendered inside the AppShell by ImportsPreview. */
export function StudentImportPreviewBody({ role, state, view }: StudentImportPreviewProps) {
  return (
    <p className="text-body text-text-muted" data-role={role} data-state={state} data-view={view}>
      Đang dựng bản xem trước…
    </p>
  );
}
