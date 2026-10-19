import type { StudentFormsPreviewProps } from "./forms-preview-params";

// Lane S/K replaces this body.
/** /dev/forms `view=student|student-edit` body (design 17a); rendered inside the AppShell by FormsPreview. */
export function StudentFormPreviewBody({ role, state, view }: StudentFormsPreviewProps) {
  return (
    <p className="text-body text-text-muted" data-role={role} data-state={state} data-view={view}>
      Đang dựng bản xem trước…
    </p>
  );
}
