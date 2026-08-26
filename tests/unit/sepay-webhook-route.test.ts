import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  rpc: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("@/features/finance/sepay-webhook", () => ({
  parseSepayWebhookPayload: vi.fn(() => ({ accountNumber: "1900123456", code: null, content: "TTV PAY-ABC", gateway: "VCB", id: 42, referenceCode: null, transactionDate: "2026-08-31 23:00:00", transferAmount: 1_200_000, transferType: "in" })),
  toSepayTransactionTimestamp: vi.fn(() => "2026-08-31T16:00:00.000Z"),
  verifySepayWebhookSignature: vi.fn(() => true),
}));

vi.mock("@/features/finance/sepay-receiving-account-catalog", () => ({
  resolveSignedSepayReceivingAccount: harness.resolve,
}));

vi.mock("@/lib/env", () => ({
  getSepayWebhookEnv: vi.fn(() => ({ webhookSecret: "webhook-test-secret" })),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({ rpc: harness.rpc })),
}));

import { POST } from "@/app/api/webhooks/sepay/route";
import { getSepayWebhookEnv } from "@/lib/env";

describe("SePay webhook account-purpose integration", () => {
  beforeEach(() => {
    vi.mocked(getSepayWebhookEnv).mockReturnValue({ webhookSecret: "webhook-test-secret" });
    harness.resolve.mockClear();
    harness.rpc.mockClear();
    harness.resolve.mockResolvedValue({ ok: true, value: { accountDisplayName: "Account A", accountNumber: "1900123456", accountVersionId: "version-a", bankCode: "VCB", purpose: "renewal" } });
    harness.rpc.mockResolvedValue({ error: null });
  });

  it.each([
    ["renewal", "renewal"],
    ["new enrollment", "new_enrollment"],
    ["unknown", "unknown"],
  ] as const)("passes the DB catalog %s classification into the existing processor", async (_label, purpose) => {
    harness.resolve.mockResolvedValue({ ok: true, value: { accountDisplayName: purpose === "unknown" ? null : "Account", accountNumber: purpose === "unknown" ? null : "1900123456", accountVersionId: purpose === "unknown" ? null : "version", bankCode: purpose === "unknown" ? null : "VCB", purpose } });

    const response = await POST(new Request("http://localhost/api/webhooks/sepay", {
      body: "{}",
      headers: { "content-type": "application/json", "x-sepay-signature": "sha256=test", "x-sepay-timestamp": "1" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(harness.resolve).toHaveBeenCalledWith(expect.anything(), "1900123456", "2026-08-31T16:00:00.000Z");
    expect(harness.rpc).toHaveBeenCalledWith("process_sepay_webhook_transaction", expect.objectContaining({ p_account_number: "1900123456", p_account_purpose: purpose, p_transaction_date: "2026-08-31T16:00:00.000Z" }));
  });

  it("fails closed instead of processing when the catalog resolver is unavailable", async () => {
    harness.resolve.mockResolvedValue({ ok: false });

    const response = await POST(new Request("http://localhost/api/webhooks/sepay", {
      body: "{}",
      headers: { "content-type": "application/json", "x-sepay-signature": "sha256=test", "x-sepay-timestamp": "1" },
      method: "POST",
    }));

    expect(response.status).toBe(500);
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it("returns 503 when SEPAY_WEBHOOK_SECRET is not configured", async () => {
    vi.mocked(getSepayWebhookEnv).mockImplementation(() => {
      throw new Error("SePay webhook environment is not configured correctly.");
    });

    const response = await POST(new Request("http://localhost/api/webhooks/sepay", {
      body: "{}",
      headers: { "content-type": "application/json", "x-sepay-signature": "sha256=test", "x-sepay-timestamp": "1" },
      method: "POST",
    }));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ success: false });
    expect(harness.rpc).not.toHaveBeenCalled();
  });
});
