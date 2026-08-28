import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  GraduationCap,
  LayoutDashboard,
  Settings,
  UsersRound,
  WalletCards,
} from "lucide-react";

import type { PermissionCode } from "@/lib/permissions/types";

export interface NavigationItem {
  activeMatchPaths?: readonly string[];
  available: boolean;
  badge?: string;
  href: string;
  label: string;
  permission?: PermissionCode;
}

export interface NavigationDomain {
  icon: LucideIcon;
  items: readonly NavigationItem[];
  key: string;
  label: string;
}

/**
 * This configuration remains the shell's route order and visibility source.
 * Domains only group existing routes; they do not grant access or introduce
 * parent landing pages.
 */
export const navigationDomains: readonly NavigationDomain[] = [
  {
    icon: LayoutDashboard,
    items: [
      {
        available: true,
        href: "/",
        label: "Tổng quan",
        permission: "dashboard.view",
      },
    ],
    key: "dashboard",
    label: "Tổng quan",
  },
  {
    icon: GraduationCap,
    items: [
      {
        available: true,
        href: "/students",
        label: "Học viên",
        permission: "students.view",
      },
      {
        available: true,
        href: "/classes",
        label: "Lớp học",
        permission: "classes.view",
      },
      {
        available: true,
        href: "/sessions",
        label: "Buổi học",
        permission: "sessions.view",
      },
      {
        available: true,
        href: "/learning-results",
        label: "Kết quả học tập",
        permission: "results.view",
      },
      {
        available: true,
        href: "/coaching",
        label: "Coaching",
        permission: "coaching.view",
      },
    ],
    key: "academics",
    label: "Học vụ",
  },
  {
    icon: UsersRound,
    items: [
      {
        available: true,
        href: "/crm",
        label: "CRM",
        permission: "crm.view",
      },
    ],
    key: "admissions",
    label: "Tuyển sinh",
  },
  {
    icon: WalletCards,
    items: [
      {
        available: true,
        href: "/finance",
        label: "Học phí & Công nợ",
        permission: "finance.view",
      },
      {
        available: true,
        href: "/finance/payment-requests",
        label: "Yêu cầu thanh toán",
        permission: "payments.view",
      },
      {
        available: true,
        href: "/finance/sepay",
        label: "Giao dịch SePay",
        permission: "sepay.view",
      },
      {
        available: true,
        href: "/finance/orders",
        label: "Đơn hàng",
        permission: "finance.view",
      },
      {
        available: true,
        href: "/finance/session-ledger",
        label: "Sổ cái số buổi",
        permission: "session_ledger.view",
      },
      {
        available: true,
        href: "/finance/tuition-periods",
        label: "Kỳ thu học phí",
        permission: "tuition_periods.view",
      },
      {
        available: true,
        href: "/finance/receiving-accounts",
        label: "Tài khoản nhận SePay",
        permission: "settings.sepay_receiving_accounts.manage",
      },
    ],
    key: "finance",
    label: "Tài chính",
  },
  {
    icon: BriefcaseBusiness,
    items: [
      {
        available: true,
        href: "/staff",
        label: "Nhân sự",
        permission: "staff.view",
      },
      {
        available: true,
        href: "/timekeeping",
        label: "Chấm công",
        permission: "timekeeping.view",
      },
      {
        available: true,
        href: "/payroll/dashboard",
        label: "Tổng quan lương",
        permission: "payroll.dashboard.view",
      },
      {
        available: true,
        href: "/payroll",
        label: "Bảng lương",
        permission: "payroll.view",
      },
      {
        available: true,
        href: "/advances",
        label: "Tạm ứng lương",
        permission: "advances.view",
      },
      {
        available: true,
        href: "/grading-credits",
        label: "Tín chỉ chấm bài",
        permission: "grading_credits.view",
      },
      {
        available: true,
        href: "/commissions",
        label: "Hoa hồng",
        permission: "commissions.view",
      },
    ],
    key: "people",
    label: "Nhân sự",
  },
  {
    icon: Settings,
    items: [
      {
        available: true,
        href: "/imports/students",
        label: "Import học viên",
        permission: "imports.students",
      },
      {
        available: true,
        href: "/imports/session-balances",
        label: "Import số dư buổi",
        permission: "imports.session_balances",
      },
      {
        available: true,
        href: "/imports/classes",
        label: "Import lớp & lịch học",
        permission: "imports.classes",
      },
      {
        available: true,
        href: "/imports/enrollments",
        label: "Import ghi danh",
        permission: "imports.enrollments",
      },
      {
        available: true,
        href: "/reports",
        label: "Báo cáo & Xuất dữ liệu",
        permission: "reports.view",
      },
      {
        available: true,
        href: "/settings",
        label: "Cài đặt hệ thống",
        permission: "staff.roles.view",
      },
      {
        activeMatchPaths: ["/settings/audit-logs"],
        available: true,
        href: "/audit",
        label: "Nhật ký hệ thống",
        permission: "audit.view",
      },
    ],
    key: "administration",
    label: "Quản trị",
  },
];

export interface VisibleNavigationDomain extends Omit<NavigationDomain, "items"> {
  items: readonly NavigationItem[];
}

export function getVisibleNavigationDomains(
  permissions: readonly PermissionCode[],
): readonly VisibleNavigationDomain[] {
  return navigationDomains.flatMap((domain) => {
    const items = domain.items.filter(
      (item) =>
        item.available &&
        (!item.permission || permissions.includes(item.permission)),
    );

    return items.length > 0 ? [{ ...domain, items }] : [];
  });
}

function matchesPath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavigationItemActive(
  item: NavigationItem,
  pathname: string,
): boolean {
  return getNavigationItemMatchLength(item, pathname) > 0;
}

function getNavigationItemMatchLength(
  item: NavigationItem,
  pathname: string,
): number {
  return Math.max(
    0,
    ...[item.href, ...(item.activeMatchPaths ?? [])]
      .filter((path) => matchesPath(pathname, path))
      .map((path) => path.length),
  );
}

export function getActiveNavigationDomain(
  pathname: string,
  domains: readonly VisibleNavigationDomain[],
): VisibleNavigationDomain | undefined {
  return domains
    .flatMap((domain) =>
      domain.items
        .map((item) => ({
          domain,
          matchLength: getNavigationItemMatchLength(item, pathname),
        }))
        .filter((match) => match.matchLength > 0),
    )
    .sort((left, right) => right.matchLength - left.matchLength)[0]?.domain;
}

export function getActiveNavigationItem(
  items: readonly NavigationItem[],
  pathname: string,
): NavigationItem | undefined {
  return items
    .map((item) => ({ item, matchLength: getNavigationItemMatchLength(item, pathname) }))
    .filter((match) => match.matchLength > 0)
    .sort((left, right) => right.matchLength - left.matchLength)[0]?.item;
}
