import type { ClassFormsPreviewProps } from "./forms-preview-params";

// Lane S/K replaces this body.
/** /dev/forms `view=class|class-edit` body (design 17b, left); rendered inside the AppShell by FormsPreview. */
export function ClassFormPreviewBody({ role, state, view }: ClassFormsPreviewProps) {
  return (
    <p className="text-body text-text-muted" data-role={role} data-state={state} data-view={view}>
      Đang dựng bản xem trước…
    </p>
  );
}
