import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  FileInput,
  GraduationCap,
  HeartHandshake,
  House,
  Settings,
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

export type NavigationGroupPlacement = "main" | "footer";

export interface NavigationGroup {
  domains: readonly NavigationDomain[];
  key: string;
  /** Group title shown in the sidebar (12/600 subtle). Footer groups have no title. */
  label: string;
  placement: NavigationGroupPlacement;
}

const financeDomain: NavigationDomain = {
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
};

const peopleDomain: NavigationDomain = {
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
};

const careDomain: NavigationDomain = {
  icon: HeartHandshake,
  items: [
    {
      available: true,
      href: "/crm",
      label: "CRM",
      permission: "crm.view",
    },
    {
      available: true,
      href: "/student-care",
      label: "Chăm sóc học sinh",
      permission: "student_care.view",
    },
    {
      available: true,
      href: "/coaching",
      label: "Coaching",
      permission: "coaching.view",
    },
    {
      available: true,
      href: "/parent-messages",
      label: "Tin nhắn phụ huynh",
      permission: "attendance.view",
    },
  ],
  key: "care",
  label: "Chăm sóc & Tuyển sinh",
};

/**
 * Sidebar structure from the 12/10/2026 handoff (section 1b): daily entities
 * sit flat under "Việc chính", office work is grouped under "Vận hành", and
 * imports/settings sit in the sidebar footer. Routes and permission codes are
 * unchanged; only the grouping moved. Domains never grant access or introduce
 * parent landing pages. A domain with one module renders no module strip.
 */
export const navigationGroups: readonly NavigationGroup[] = [
  {
    key: "primary",
    label: "Việc chính",
    placement: "main",
    domains: [
      {
        icon: House,
        items: [
          {
            available: true,
            href: "/",
            label: "Hôm nay",
            permission: "dashboard.view",
          },
        ],
        key: "today",
        label: "Hôm nay",
      },
      {
        icon: GraduationCap,
        items: [
          {
            available: true,
            href: "/students",
            label: "Học sinh",
            permission: "students.view",
          },
        ],
        key: "students",
        label: "Học sinh",
      },
      {
        icon: BookOpen,
        items: [
          {
            available: true,
            href: "/classes",
            label: "Lớp học",
            permission: "classes.view",
          },
        ],
        key: "classes",
        label: "Lớp học",
      },
      {
        icon: CalendarDays,
        items: [
          {
            available: true,
            href: "/sessions",
            label: "Buổi học",
            permission: "sessions.view",
          },
        ],
        key: "sessions",
        label: "Buổi học",
      },
      {
        icon: ClipboardCheck,
        items: [
          {
            available: true,
            href: "/learning-results",
            label: "Kết quả học tập",
            permission: "results.view",
          },
          {
            available: true,
            href: "/ai-grading",
            label: "Chấm bài AI",
            permission: "ai_grading.view",
          },
          {
            available: true,
            href: "/grading-submissions",
            label: "Bài nộp chưa ghép",
            permission: "ai_grading.view",
          },
        ],
        key: "results",
        label: "Kết quả học tập",
      },
    ],
  },
  {
    key: "operations",
    label: "Vận hành",
    placement: "main",
    domains: [
      financeDomain,
      peopleDomain,
      careDomain,
      {
        icon: ChartColumn,
        items: [
          {
            available: true,
            href: "/reports",
            label: "Báo cáo & Xuất dữ liệu",
            permission: "reports.view",
          },
        ],
        key: "reports",
        label: "Báo cáo",
      },
    ],
  },
  {
    key: "footer",
    label: "",
    placement: "footer",
    domains: [
      {
        icon: FileInput,
        items: [
          {
            available: true,
            href: "/imports/students",
            label: "Import học sinh",
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
        ],
        key: "imports",
        label: "Nhập dữ liệu",
      },
      {
        icon: Settings,
        items: [
          {
            available: true,
            href: "/settings",
            label: "Cài đặt hệ thống",
            permission: "staff.roles.view",
          },
          {
            available: true,
            href: "/notifications",
            label: "Thông báo",
            permission: "notifications.view",
          },
          {
            activeMatchPaths: ["/settings/audit-logs"],
            available: true,
            href: "/audit",
            label: "Nhật ký hệ thống",
            permission: "audit.view",
          },
        ],
        key: "settings",
        label: "Cài đặt",
      },
    ],
  },
];

/** Flat domain list in sidebar order; backs getVisibleNavigationDomains. The shell consumes navigationGroups. */
export const navigationDomains: readonly NavigationDomain[] = navigationGroups.flatMap(
  (group) => group.domains,
);

export interface VisibleNavigationDomain extends Omit<NavigationDomain, "items"> {
  items: readonly NavigationItem[];
}

export interface VisibleNavigationGroup extends Omit<NavigationGroup, "domains"> {
  domains: readonly VisibleNavigationDomain[];
}

function filterDomains(
  domains: readonly NavigationDomain[],
  permissions: readonly PermissionCode[],
): readonly VisibleNavigationDomain[] {
  return domains.flatMap((domain) => {
    const items = domain.items.filter(
      (item) =>
        item.available &&
        (!item.permission || permissions.includes(item.permission)),
    );

    return items.length > 0 ? [{ ...domain, items }] : [];
  });
}

export function getVisibleNavigationDomains(
  permissions: readonly PermissionCode[],
): readonly VisibleNavigationDomain[] {
  return filterDomains(navigationDomains, permissions);
}

/** Groups with no permission-visible domain disappear together with their title. */
export function getVisibleNavigationGroups(
  permissions: readonly PermissionCode[],
): readonly VisibleNavigationGroup[] {
  return navigationGroups.flatMap((group) => {
    const domains = filterDomains(group.domains, permissions);

    return domains.length > 0 ? [{ ...group, domains }] : [];
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

export interface NavigationBreadcrumb {
  /** Present only when the domain holds several modules (a module strip exists). */
  domain?: { href: string; label: string };
  item?: { href: string; label: string };
}

/** Real-route breadcrumb for the topbar: domain / module. Records are added by pages. */
export function getNavigationBreadcrumb(
  pathname: string,
  domains: readonly VisibleNavigationDomain[],
): NavigationBreadcrumb {
  const domain = getActiveNavigationDomain(pathname, domains);

  if (!domain) {
    return {};
  }

  const item = getActiveNavigationItem(domain.items, pathname);

  return {
    domain:
      domain.items.length > 1
        ? { href: domain.items[0].href, label: domain.label }
        : undefined,
    item: item ? { href: item.href, label: item.label } : undefined,
  };
}
