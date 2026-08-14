import { describe, expect, it, vi } from "vitest";

import { resolveSignedSepayReceivingAccount } from "@/features/finance/sepay-receiving-account-catalog";

describe("SePay receiving-account classification", () => {
  it("uses the DB catalog for the signed account even when legacy ENV differs", async () => {
    process.env.SEPAY_RENEWAL_ACCOUNT_NUMBER = "ENV-ACCOUNT-MUST-NOT-DECIDE";
    const rpc = vi.fn().mockResolvedValue({
      data: [{ account_display_name: "Account A", account_number: "1900123456", account_version_id: "version-a", bank_code: "VCB", purpose: "renewal" }],
      error: null,
    });

    const result = await resolveSignedSepayReceivingAccount({ rpc } as never, "1900 123 456", "2026-08-31T16:00:00.000Z");

    expect(result).toEqual({ ok: true, value: { accountDisplayName: "Account A", accountNumber: "1900123456", accountVersionId: "version-a", bankCode: "VCB", purpose: "renewal" } });
    expect(rpc).toHaveBeenCalledWith("resolve_sepay_receiving_account", {
      p_signed_account_number: "1900 123 456",
      p_transaction_at: "2026-08-31T16:00:00.000Z",
    });
  });

  it("preserves unknown-account safety and never guesses from transfer content", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ account_display_name: null, account_number: null, account_version_id: null, bank_code: null, purpose: "unknown" }], error: null });
    await expect(resolveSignedSepayReceivingAccount({ rpc } as never, "0999999999", "2026-09-02T01:00:00.000Z")).resolves.toEqual({ ok: true, value: { accountDisplayName: null, accountNumber: null, accountVersionId: null, bankCode: null, purpose: "unknown" } });
  });

  it("fails closed when catalog resolution is unavailable", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    await expect(resolveSignedSepayReceivingAccount({ rpc } as never, "1900123456", "2026-08-31T16:00:00.000Z")).resolves.toEqual({ ok: false });
  });
});
