"use client";

import { AppShell } from "@/components/layout/app-shell";
import type { AuthUser } from "@/features/auth/types";

import { BatchPreviewBody } from "./batch-preview";
import { ClassFormPreviewBody } from "./class-form-preview";
import { FORMS_PREVIEW_PATHNAMES, getFormsPreviewPermissions, type FormsPreviewParams, type FormsPreviewRole } from "./forms-preview-params";
import { StudentFormPreviewBody } from "./student-form-preview";

// Fixed shell users, one per preview role.
const previewShellUsers: Record<FormsPreviewRole, AuthUser> = {
  owner: { displayName: "Nguyễn Văn Vinh", email: "vinh@example.com", id: "dev-user", initials: "NV" },
  ta: { displayName: "Trần Thu Hà", email: "ha@example.com", id: "dev-ta", initials: "TH" },
  viewer: { displayName: "Lê Minh Châu", email: "chau@example.com", id: "dev-viewer", initials: "LC" },
};

/**
 * /dev/forms (design 17a, 17b): the shell on the real route of the view
 * (`previewPathname`), with the role's permission codes, around the lane's
 * page body. Bodies render only the page content and own their fixtures and
 * action stubs.
 */
export function FormsPreview(params: FormsPreviewParams) {
  const permissions = getFormsPreviewPermissions(params.role);

  return (
    <AppShell
      authUser={previewShellUsers[params.role]}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname={FORMS_PREVIEW_PATHNAMES[params.view]}
      unreadNotificationCount={3}
    >
      <FormsPreviewBody {...params} />
    </AppShell>
  );
}

function FormsPreviewBody(params: FormsPreviewParams) {
  switch (params.view) {
    case "batch":
      return <BatchPreviewBody role={params.role} state={params.state} view={params.view} />;
    case "class":
    case "class-edit":
      return <ClassFormPreviewBody role={params.role} state={params.state} view={params.view} />;
    default:
      return <StudentFormPreviewBody role={params.role} state={params.state} view={params.view} />;
  }
}
