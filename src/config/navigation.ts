import type { PermissionCode } from "@/types/domain";

export interface NavigationItem {
  href: string;
  label: string;
  shortLabel: string;
  permission: PermissionCode;
  badge?: string;
}

export interface NavigationSection {
  label?: string;
  items: NavigationItem[];
}

export const navigationSections: NavigationSection[] = [
  {
    items: [
      {
        href: "/",
        label: "Tổng quan",
        shortLabel: "TQ",
        permission: "dashboard.view",
      },
    ],
  },
  {
    label: "Học vụ",
    items: [
      {
        href: "/students",
        label: "Học viên",
        shortLabel: "HV",
        permission: "students.view",
      },
      {
        href: "/classes",
        label: "Lớp học & Lịch học",
        shortLabel: "LH",
        permission: "classes.view",
      },
      {
        href: "/sessions",
        label: "Buổi học",
        shortLabel: "BH",
        permission: "sessions.view",
      },
      {
        href: "/attendance",
        label: "Điểm danh",
        shortLabel: "DD",
        permission: "attendance.view",
      },
      {
        href: "/learning-results",
        label: "Kết quả học tập",
        shortLabel: "KQ",
        permission: "results.view",
      },
    ],
  },
  {
    label: "Tài chính",
    items: [
      {
        href: "/finance",
        label: "Học phí & Công nợ",
        shortLabel: "TC",
        permission: "finance.view",
      },
      {
        href: "/finance/sepay",
        label: "Giao dịch SePay",
        shortLabel: "SP",
        permission: "sepay.view",
      },
      {
        href: "/finance/session-ledger",
        label: "Sổ cái số buổi",
        shortLabel: "SC",
        permission: "session_ledger.view",
      },
    ],
  },
  {
    label: "Tuyển sinh & CRM",
    items: [
      {
        href: "/crm",
        label: "CRM & Tuyển sinh",
        shortLabel: "CRM",
        permission: "crm.view",
      },
    ],
  },
  {
    label: "Nhân sự",
    items: [
      {
        href: "/staff",
        label: "Nhân sự",
        shortLabel: "NS",
        permission: "staff.view",
      },
      {
        href: "/timekeeping",
        label: "Chấm công",
        shortLabel: "CC",
        permission: "timekeeping.view",
      },
      {
        href: "/payroll",
        label: "Lương & Tạm ứng",
        shortLabel: "LU",
        permission: "payroll.view",
      },
      {
        href: "/commissions",
        label: "Hoa hồng",
        shortLabel: "HH",
        permission: "commissions.view",
      },
    ],
  },
  {
    label: "Khác",
    items: [
      {
        href: "/coaching",
        label: "Coaching",
        shortLabel: "CO",
        permission: "coaching.view",
      },
      {
        href: "/reports",
        label: "Báo cáo & Dashboard",
        shortLabel: "BC",
        permission: "reports.view",
      },
      {
        href: "/notifications",
        label: "Thông báo",
        shortLabel: "TB",
        permission: "notifications.view",
        badge: "12",
      },
      {
        href: "/settings",
        label: "Cài đặt hệ thống",
        shortLabel: "CD",
        permission: "settings.view",
      },
    ],
  },
];
