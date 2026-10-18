import { ReportsPage } from "@/features/reports/reports-page";
import type { PermissionCode } from "@/lib/permissions/types";

import type { ListsPreviewRole } from "./lists-preview";

/** Announced by the export dialog instead of submitting to the real /reports/export/sessions. */
export const REPORTS_EXPORT_PREVIEW_NOTICE = "Bản xem trước không xuất dữ liệu.";

/** "Mở danh sách buổi học" opens the sessions preview for the same role, never the real /sessions. */
function sessionListPreviewHref(role: ListsPreviewRole): string {
  return `/dev/lists?view=sessions${role === "owner" ? "" : `&role=${role}`}`;
}

/**
 * Body of /dev/lists?view=reports (the controller wraps it in AppShell): the real
 * ReportsPage with the shell's own permission codes (`getListsPreviewPermissions`),
 * so the cards always match the nav. It has no server action or router state; the
 * only way out is the export form, which `exportPreviewNotice` turns into a
 * validated no-op.
 *
 * - owner: 4 cards (1 available, 3 planned). ta: only "Danh sách buổi học".
 *   accountant: the in-frame "Chưa có báo cáo phù hợp".
 * - capped: the catalog has no row limit, so it renders like normal (the CSV
 *   cap is stated in the card and the dialog).
 * - empty: the controller drops every module view a card needs, so none is visible.
 */
export function ReportsPreviewBody({ permissions, role }: { permissions: readonly PermissionCode[]; role: ListsPreviewRole }) {
  return (
    <ReportsPage
      exportPreviewNotice={REPORTS_EXPORT_PREVIEW_NOTICE}
      permissions={permissions}
      sessionListHref={sessionListPreviewHref(role)}
    />
  );
}
