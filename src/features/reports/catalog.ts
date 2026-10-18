import { formatNumber } from "@/lib/format";
import type { PermissionCode } from "@/lib/permissions/types";

/**
 * Rows the session CSV export reads (`limit` of the export route's query), newest
 * `session_date` first; anything older in the range is cut silently.
 * Supabase caps a single response at 1000 rows (supabase/config.toml max_rows);
 * one page is ample for a date-bounded CSV while staying within that cap.
 * Lives here, not in the route: a route file may only export its handlers, and
 * the reports page and the export dialog must name the same number.
 */
export const SESSION_EXPORT_LIMIT = 1000;

export type ReportAvailability =
  | "available"
  | "planned";

export interface ReportCatalogItem {
  availability: ReportAvailability;
  description: string;
  /** Extra note on what the export's columns depend on (shown under "Cần quyền"). */
  exportColumnNote?: string;
  exportHref?: string;
  id: string;
  requiredPermission: PermissionCode;
  scopeNote: string;
  title: string;
}

export const REPORT_CATALOG = [
  {
    availability: "available",
    description:
      "Danh sách vận hành các buổi học trong phạm vi dữ liệu tài khoản được phép xem.",
    exportColumnNote:
      "Cột điểm danh và kết quả chỉ có khi tài khoản có quyền xem điểm danh / kết quả.",
    exportHref: "/reports/export/sessions",
    id: "sessions.directory",
    requiredPermission: "sessions.view",
    scopeNote:
      `Xuất tối đa ${formatNumber(SESSION_EXPORT_LIMIT)} buổi có ngày mới nhất. Có thể lọc theo khoảng ngày.`,
    title: "Danh sách buổi học",
  },
  {
    availability: "planned",
    description:
      "Danh sách học viên với bộ cột an toàn được duyệt riêng cho báo cáo.",
    id: "students.directory",
    requiredPermission: "students.view",
    scopeNote:
      "Chưa xuất dữ liệu phụ huynh hoặc thông tin nội bộ.",
    title: "Danh sách học viên",
  },
  {
    availability: "planned",
    description:
      "Danh sách lead tuyển sinh theo phạm vi CRM mà tài khoản được phép xem.",
    id: "crm.leads",
    requiredPermission: "crm.view",
    scopeNote:
      "Chưa xuất ghi chú nội bộ hoặc thông tin ngoài CRM directory.",
    title: "Lead tuyển sinh",
  },
  {
    availability: "planned",
    description:
      "Danh sách nhân sự với bộ cột vận hành không bao gồm dữ liệu lương.",
    id: "staff.directory",
    requiredPermission: "staff.view",
    scopeNote:
      "Không xuất mức lương, lịch sử đơn giá hoặc dữ liệu tài khoản.",
    title: "Danh sách nhân sự",
  },
] satisfies readonly ReportCatalogItem[];
