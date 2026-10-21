"use client";

import { AppShell } from "@/components/layout/app-shell";

import { BalanceImportPreviewBody } from "./balance-import-preview";
import { ClassImportPreviewBody } from "./class-import-preview";
import { EnrollmentImportPreviewBody } from "./enrollments-preview";
import {
  getImportsPreviewPermissions,
  IMPORTS_PREVIEW_PATHNAMES,
  IMPORTS_PREVIEW_USERS,
  type ImportsPreviewParams,
} from "./imports-preview-params";
import { StudentImportPreviewBody } from "./students-preview";

/**
 * /dev/imports (design 17c): the shell on the real route of the view
 * (`previewPathname`), with the role's permission codes, around the lane's
 * page body. Bodies render only the page content and own their fixtures and
 * action stubs.
 */
export function ImportsPreview(params: ImportsPreviewParams) {
  return (
    <AppShell
      authUser={IMPORTS_PREVIEW_USERS[params.role]}
      centerDisplayName="Toán Thầy Vinh"
      permissions={getImportsPreviewPermissions(params.role)}
      previewPathname={IMPORTS_PREVIEW_PATHNAMES[params.view]}
      unreadNotificationCount={3}
    >
      <ImportsPreviewBody {...params} />
    </AppShell>
  );
}

function ImportsPreviewBody(params: ImportsPreviewParams) {
  switch (params.view) {
    case "enrollments":
      return <EnrollmentImportPreviewBody role={params.role} state={params.state} view={params.view} />;
    case "classes":
      return <ClassImportPreviewBody role={params.role} state={params.state} view={params.view} />;
    case "class-batch":
      return <ClassImportPreviewBody role={params.role} state={params.state} view={params.view} />;
    case "balances":
      return <BalanceImportPreviewBody role={params.role} state={params.state} view={params.view} />;
    case "balance-batch":
      return <BalanceImportPreviewBody role={params.role} state={params.state} view={params.view} />;
    default:
      return <StudentImportPreviewBody role={params.role} state={params.state} view={params.view} />;
  }
}
