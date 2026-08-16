import { describe, expect, it } from "vitest";

import { parseSystemSettings, SYSTEM_SETTING_DEFAULTS } from "@/features/settings/system-settings";

describe("system settings typed registry", () => {
  it("uses safe defaults for missing or unknown rows", () => {
    expect(parseSystemSettings([{ key: "unknown.key", value: "ignored" }])).toEqual(SYSTEM_SETTING_DEFAULTS);
  });

  it("accepts only the expected scalar type for each known key", () => {
    const settings = parseSystemSettings([
      { key: "center.display_name", value: "Trung tâm mới" },
      { key: "coaching.default_public_link_expiry_days", value: 14 },
      { key: "teacher.display_name", value: 123 },
    ]);
    expect(settings["center.display_name"]).toBe("Trung tâm mới");
    expect(settings["coaching.default_public_link_expiry_days"]).toBe(14);
    expect(settings["teacher.display_name"]).toBe(SYSTEM_SETTING_DEFAULTS["teacher.display_name"]);
  });
});
