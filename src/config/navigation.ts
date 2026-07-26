import type { PermissionCode } from "@/lib/permissions/types";

export interface NavigationItem {
  available: boolean;
  badge?: string;
  href: string;
  label: string;
  permission?: PermissionCode;
  shortLabel: string;
}

export interface NavigationSection {
  label?: string;
  items: NavigationItem[];
}

export const navigationSections: NavigationSection[] = [
  {
    items: [
      {
        available: true,
        href: "/",
        label: "Tổng quan",
        permission: "app.access",
        shortLabel: "TQ",
      },
    ],
  },
  {
    label: "Học vụ",
    items: [
      {
        available: true,
        href: "/students",
        label: "Học viên",
        permission: "students.view",
        shortLabel: "HV",
      },
      {
        available: true,
        href: "/classes",
        label: "Lớp học & Lịch học",
        permission: "classes.view",
        shortLabel: "LH",
      },
      {
        available: true,
        href: "/sessions",
        label: "Buổi học",
        permission: "sessions.view",
        shortLabel: "BH",
      },
      {
        available: false,
        href: "/attendance",
        label: "Điểm danh",
        shortLabel: "DD",
      },
      {
        available: false,
        href: "/learning-results",
        label: "Kết quả học tập",
        shortLabel: "KQ",
      },
    ],
  },
  {
    label: "Tài chính",
    items: [
      {
        available: false,
        href: "/finance",
        label: "Học phí & Công nợ",
        shortLabel: "TC",
      },
      {
        available: false,
        href: "/finance/sepay",
        label: "Giao dịch SePay",
        shortLabel: "SP",
      },
      {
        available: false,
        href: "/finance/session-ledger",
        label: "Sổ cái số buổi",
        shortLabel: "SC",
      },
    ],
  },
  {
    label: "Tuyển sinh & CRM",
    items: [
      {
        available: true,
        href: "/crm",
        label: "CRM & Tuyển sinh",
        permission: "crm.view",
        shortLabel: "CRM",
      },
    ],
  },
  {
    label: "Nhân sự",
    items: [
      {
        available: true,
        href: "/staff",
        label: "Nhân sự",
        permission: "staff.view",
        shortLabel: "NS",
      },
      {
        available: false,
        href: "/timekeeping",
        label: "Chấm công",
        shortLabel: "CC",
      },
      {
        available: false,
        href: "/payroll",
        label: "Lương & Tạm ứng",
        shortLabel: "LU",
      },
      {
        available: false,
        href: "/commissions",
        label: "Hoa hồng",
        shortLabel: "HH",
      },
    ],
  },
  {
    label: "Khác",
    items: [
      {
        available: false,
        href: "/coaching",
        label: "Coaching",
        shortLabel: "CO",
      },
      {
        available: false,
        href: "/reports",
        label: "Báo cáo & Dashboard",
        shortLabel: "BC",
      },
      {
        available: false,
        badge: "12",
        href: "/notifications",
        label: "Thông báo",
        shortLabel: "TB",
      },
      {
        available: false,
        href: "/settings",
        label: "Cài đặt hệ thống",
        shortLabel: "CD",
      },
    ],
  },
];
