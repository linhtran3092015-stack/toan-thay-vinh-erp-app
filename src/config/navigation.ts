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
        permission: "dashboard.view",
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
        available: true,
        href: "/finance",
        label: "Học phí & Công nợ",
        permission: "finance.view",
        shortLabel: "TC",
      },
      {
        available: true,
        href: "/finance/sepay",
        label: "Giao dịch SePay",
        permission: "sepay.view",
        shortLabel: "SP",
      },
      {
        available: true,
        href: "/finance/session-ledger",
        label: "Sổ cái số buổi",
        permission: "session_ledger.view",
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
        available: true,
        href: "/timekeeping",
        label: "Chấm công",
        permission: "timekeeping.view",
        shortLabel: "CC",
      },
      {
        available: true,
        href: "/payroll",
        label: "Bảng lương",
        permission: "payroll.view",
        shortLabel: "LU",
      },
      {
        available: true,
        href: "/advances",
        label: "Tạm ứng lương",
        permission: "advances.view",
        shortLabel: "TA",
      },
      {
        available: true,
        href: "/grading-credits",
        label: "Tín chỉ chấm bài",
        permission: "grading_credits.view",
        shortLabel: "TC",
      },
      {
        available: true,
        href: "/commissions",
        label: "Hoa hồng",
        permission: "commissions.view",
        shortLabel: "HH",
      },
    ],
  },
  {
    label: "Khác",
    items: [
      {
        available: true,
        href: "/coaching",
        label: "Coaching",
        permission: "coaching.view",
        shortLabel: "CO",
      },
      {
        available: true,
        href: "/reports",
        label: "Báo cáo & Xuất dữ liệu",
        permission: "reports.view",
        shortLabel: "BC",
      },
      {
        available: true,
        href: "/notifications",
        permission: "notifications.view",
        label: "Thông báo",
        shortLabel: "TB",
      },
      {
        available: true,
        href: "/audit",
        label: "Nhật ký hệ thống",
        permission: "audit.view",
        shortLabel: "NK",
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
