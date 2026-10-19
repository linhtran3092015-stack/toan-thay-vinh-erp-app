import type { BatchFormsPreviewProps } from "./forms-preview-params";

// Lane S/K replaces this body.
/** /dev/forms `view=batch` body (design 17b, right); rendered inside the AppShell by FormsPreview. */
export function BatchPreviewBody({ role, state, view }: BatchFormsPreviewProps) {
  return (
    <p className="text-body text-text-muted" data-role={role} data-state={state} data-view={view}>
      Đang dựng bản xem trước…
    </p>
  );
}
