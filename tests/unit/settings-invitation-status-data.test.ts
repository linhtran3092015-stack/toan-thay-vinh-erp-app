import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSettingsAccountInvitations } from "@/features/settings/data";

const dependencies = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from: dependencies.from })),
}));

describe("Settings invitation status transport", () => {
  beforeEach(() => {
    dependencies.from.mockReset();
    dependencies.from.mockImplementation((table: string) => {
      if (table === "account_invitations") {
        const invitationsQuery = {
          limit: vi.fn(async () => ({
            data: [{
              accepted_at: null,
              email: "owner@example.com",
              id: "invitation-1",
              invitation_reason: "Mời Owner",
              invited_at: "2026-08-01T08:00:00Z",
              revoked_at: null,
              status: "constructor",
            }],
            error: null,
          })),
          order: vi.fn(),
          select: vi.fn(),
        };
        invitationsQuery.select.mockReturnValue(invitationsQuery);
        invitationsQuery.order.mockReturnValue(invitationsQuery);
        return invitationsQuery;
      }

      return {
        select: vi.fn(async () => ({ data: [], error: null })),
      };
    });
  });

  it("preserves an unsupported stored invitation status instead of fabricating pending", async () => {
    const result = await getSettingsAccountInvitations();

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) {
      throw new Error("Expected Settings invitation data");
    }

    expect(result.invitations[0]?.status).toBe("constructor");
  });
});
