export interface SettingsTocAccess {
  /** `audit.view`: shows Nhật ký. */
  canViewAudit: boolean;
  /** `staff.view`: shows Người dùng. */
  canViewUsers: boolean;
}

interface SettingsTocItem {
  /** Active only on this exact path (the /settings landing), not on its children. */
  exact?: boolean;
  href: string;
  label: string;
}

interface SettingsTocGroup {
  items: SettingsTocItem[];
  label: string;
}

/** Href of the hub landing: listed first but not counted as a settings section. */
export const SETTINGS_OVERVIEW_HREF = "/settings";

/** Hub sections (design 09a). Items the person cannot open are left out, not disabled. */
export function getSettingsTocGroups({ canViewAudit, canViewUsers }: SettingsTocAccess): SettingsTocGroup[] {
  const groups: SettingsTocGroup[] = [
    {
      items: [
        // The landing needs settings.view, which the whole hub already requires.
        { exact: true, href: SETTINGS_OVERVIEW_HREF, label: "Tổng quan" },
        { href: "/settings/general", label: "Chung" },
        { href: "/settings/zalo", label: "Tin Zalo" },
        { href: "/settings/ai-grading", label: "Chấm bài AI" },
        { href: "/settings/branding", label: "Thương hiệu & giao diện" },
        { href: "/settings/website", label: "Trang web công khai" },
      ],
      label: "Trung tâm & thương hiệu",
    },
    {
      items: [
        ...(canViewUsers ? [{ href: "/settings/users", label: "Người dùng" }] : []),
        { href: "/settings/permissions", label: "Phân quyền" },
      ],
      label: "Con người & phân quyền",
    },
    {
      items: canViewAudit ? [{ href: "/audit", label: "Nhật ký" }] : [],
      label: "Hệ thống",
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}
