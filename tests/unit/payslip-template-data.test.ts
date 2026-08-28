import { describe, expect, it, vi } from "vitest";

import {
  archiveTemplateResult,
  cloneTemplateResult,
  createPayslipTemplateDraftVersionResult,
  publishTemplateVersionResult,
  saveDraftConfigurationResult,
  setDefaultTemplateResult,
} from "@/features/payroll/payslip-template/data";
import { DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG } from "@/features/payroll/payslip-template/schema";

// Mock dependencies
vi.mock("@/features/auth/current-user", () => ({
  getCurrentAuthUser: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { getCurrentAuthUser } from "@/features/auth/current-user";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("Payslip Template Server Data Layer", () => {
  it("rejects operations when user is not authenticated", async () => {
    vi.mocked(getCurrentAuthUser).mockResolvedValueOnce({
      error: "session_expired",
      ok: false,
    });

    const result = await createPayslipTemplateDraftVersionResult("template-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("NOT_AUTHENTICATED");
    }
  });

  it("rejects operations when user lacks payroll.template.manage permission", async () => {
    vi.mocked(getCurrentAuthUser).mockResolvedValueOnce({
      ok: true,
      user: { email: "user@toanthayvinh.edu.vn", id: "user-1" } as any,
    });

    vi.mocked(getCachedDatabasePermissions).mockResolvedValueOnce({
      ok: true,
      permissions: ["app.access"], // Missing payroll.template.manage
    });

    const result = await saveDraftConfigurationResult(
      "template-1",
      1,
      DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("PERMISSION_DENIED");
    }
  });

  it("blocks modifying a published version", async () => {
    vi.mocked(getCurrentAuthUser).mockResolvedValueOnce({
      ok: true,
      user: { email: "admin@toanthayvinh.edu.vn", id: "admin-1" } as any,
    });

    vi.mocked(getCachedDatabasePermissions).mockResolvedValueOnce({
      ok: true,
      permissions: ["app.access", "payroll.template.manage"],
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { status: "published" }, // Published version!
          error: null,
        }),
        select: vi.fn().mockReturnThis(),
      }),
    };

    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      mockSupabase as any,
    );

    const result = await saveDraftConfigurationResult(
      "template-1",
      1,
      DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("CANNOT_MODIFY_PUBLISHED_VERSION");
    }
  });

  it("blocks archiving the default template", async () => {
    vi.mocked(getCurrentAuthUser).mockResolvedValueOnce({
      ok: true,
      user: { email: "admin@toanthayvinh.edu.vn", id: "admin-1" } as any,
    });

    vi.mocked(getCachedDatabasePermissions).mockResolvedValueOnce({
      ok: true,
      permissions: ["app.access", "payroll.template.manage"],
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { is_default: true }, // Default template!
          error: null,
        }),
        select: vi.fn().mockReturnThis(),
      }),
    };

    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      mockSupabase as any,
    );

    const result = await archiveTemplateResult("template-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("CANNOT_ARCHIVE_DEFAULT_TEMPLATE");
    }
  });
});
