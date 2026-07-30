import type { PermissionCode } from "@/lib/permissions/types";

export type ReportAvailability =
  | "available"
  | "planned";

export interface ReportCatalogItem {
  availability: ReportAvailability;
  description: string;
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
    exportHref: "/reports/export/sessions",
    id: "sessions.directory",
    requiredPermission: "sessions.view",
    scopeNote:
      "Xuất tối đa 300 buổi gần nhất. Có thể lọc theo khoảng ngày.",
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
