import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: vi.fn(() => false) }));
vi.mock("@/features/auth/allowed-emails", () => ({
  getAllowedEmailsConfiguration: vi.fn(),
  isEmailAllowed: vi.fn(),
}));
vi.mock("@/lib/supabase/middleware", () => ({
  applySupabaseSessionState: vi.fn(),
  updateSupabaseSession: vi.fn(),
}));

import { proxy } from "@/proxy";

describe("public Coaching route access", () => {
  it("allows opaque public form links before staff authentication/configuration checks", async () => {
    const response = await proxy(new NextRequest("http://localhost:3001/coaching/form/a-token"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not accidentally make the authenticated Coaching route public", async () => {
    const response = await proxy(new NextRequest("http://localhost:3001/coaching/forms"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});
