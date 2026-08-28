import { describe, expect, it } from "vitest";

import { TEMPLATE_PRESETS } from "@/features/payroll/payslip-template/preset-configs";
import {
  DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
  parsePayslipTemplateConfiguration,
  sanitizePlainText,
} from "@/features/payroll/payslip-template/schema";

describe("Payslip Template Schema & Sanitization", () => {
  it("sanitizes HTML tags and scripts from text inputs", () => {
    const dirty = '<script>alert("hack")</script>Trung Tâm <b>Toán Thầy Vinh</b>';
    const clean = sanitizePlainText(dirty);
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("<b>");
    expect(clean).toContain("Trung Tâm Toán Thầy Vinh");
  });

  it("truncates long text according to max length", () => {
    const longText = "A".repeat(600);
    const clean = sanitizePlainText(longText, 100);
    expect(clean.length).toBe(100);
  });

  it("successfully parses default standard configuration", () => {
    const parsed = parsePayslipTemplateConfiguration(
      DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
    );
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.page.size).toBe("A4");
    expect(parsed.branding.primaryColor).toBe("#1e3a8a");
    expect(parsed.sections.length).toBeGreaterThan(5);
  });

  it("falls back to standard configuration when parsing invalid or malformed data", () => {
    const invalidData = {
      branding: {
        primaryColor: "not-a-hex-color",
      },
      sections: [],
    };

    const parsed = parsePayslipTemplateConfiguration(invalidData);
    expect(parsed).toEqual(DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG);
  });

  it("validates all built-in template presets", () => {
    expect(TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const preset of TEMPLATE_PRESETS) {
      const parsed = parsePayslipTemplateConfiguration(preset.configuration);
      expect(parsed.page.size).toBe("A4");
      expect(parsed.sections.length).toBeGreaterThan(0);
      expect(parsed.branding.fontFamily).toBeDefined();
    }
  });

  it("enforces font family whitelist", () => {
    const configWithInvalidFont = {
      ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
      branding: {
        ...DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG.branding,
        fontFamily: "Comic Sans MS", // Not allowed
      },
    };

    const parsed = parsePayslipTemplateConfiguration(configWithInvalidFont);
    // Invalid font causes fallback to default standard config which uses 'Be Vietnam Pro'
    expect(parsed.branding.fontFamily).toBe("Be Vietnam Pro");
  });
});
