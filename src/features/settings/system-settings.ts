import "server-only";

import { DEFAULT_COMMENT_FOOTER, DEFAULT_COMMENT_TEMPLATE } from "@/features/parent-messages/comment-template";

export const SYSTEM_SETTING_DEFAULTS = {
  "center.display_name": "Trung tâm Toán Thầy Vinh",
  "teacher.display_name": "Toán Thầy Vinh",
  "center.contact_phone": "",
  "center.contact_email": "",
  "center.address": "",
  "coaching.default_public_link_expiry_days": 7,
  "sessions.auto_lock_after_days": 3,
  "zalo.center_account_id": "",
  "zalo.center_account_name": "",
  "zalo.absence_message_enabled": "on",
  "zalo.comment_message_enabled": "on",
  "zalo.absence_template": "{center} thông báo: {student} vắng buổi học {class} ngày {date} ({time}) không phép. Phụ huynh vui lòng phản hồi để trung tâm sắp xếp học bù.",
  "zalo.comment_template": DEFAULT_COMMENT_TEMPLATE,
  "zalo.comment_footer": DEFAULT_COMMENT_FOOTER,
} as const;

export type SystemSettingKey = keyof typeof SYSTEM_SETTING_DEFAULTS;

export type SystemSettings = {
  [K in SystemSettingKey]: (typeof SYSTEM_SETTING_DEFAULTS)[K];
};

export const SYSTEM_SETTING_KEYS = Object.keys(SYSTEM_SETTING_DEFAULTS) as SystemSettingKey[];

export function isSystemSettingKey(value: string): value is SystemSettingKey {
  return SYSTEM_SETTING_KEYS.includes(value as SystemSettingKey);
}

export function parseSystemSettings(rows: readonly { key: string; value: unknown }[] | null | undefined): SystemSettings {
  const values: SystemSettings = { ...SYSTEM_SETTING_DEFAULTS };
  for (const row of rows ?? []) {
    if (!isSystemSettingKey(row.key)) continue;
    const fallback = SYSTEM_SETTING_DEFAULTS[row.key];
    if (typeof fallback === "number" && typeof row.value === "number" && Number.isInteger(row.value)) values[row.key] = row.value as never;
    if (typeof fallback === "string" && typeof row.value === "string") values[row.key] = row.value as never;
  }
  return values;
}
