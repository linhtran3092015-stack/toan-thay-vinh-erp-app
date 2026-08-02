"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface SettingsNavigationProps {
  canViewAudit: boolean;
  canViewUsers: boolean;
}

export function SettingsNavigation({
  canViewAudit,
  canViewUsers,
}: SettingsNavigationProps) {
  const pathname = usePathname();
  const items = [
    { href: "/settings", label: "Tổng quan", visible: true },
    {
      href: "/settings/users",
      label: "Người dùng & vai trò",
      visible: canViewUsers,
    },
    {
      href: "/settings/permissions",
      label: "Ma trận quyền",
      visible: true,
    },
    {
      href: "/settings/audit-logs",
      label: "Nhật ký thay đổi",
      visible: canViewAudit,
    },
  ].filter((item) => item.visible);

  return (
    <nav
      aria-label="Điều hướng cài đặt hệ thống"
      className="overflow-x-auto border-b border-hairline"
    >
      <div className="flex min-w-max gap-1">
        {items.map((item) => {
          const isActive =
            item.href === "/settings"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-ink-muted hover:border-hairline-strong hover:text-ink",
              )}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
