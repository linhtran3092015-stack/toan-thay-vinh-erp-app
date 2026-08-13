import { describe, expect, it } from "vitest";

import { classifySepayReceivingAccount } from "@/features/finance/sepay-webhook";
import { getSepayWebhookEnv } from "@/lib/env";

const receivingAccounts = {
  new_enrollment: {
    accountNumber: "0100123456",
    bankCode: "MB",
    purpose: "new_enrollment" as const,
  },
  renewal: {
    accountNumber: "0123987654",
    bankCode: "VCB",
    purpose: "renewal" as const,
  },
};

describe("SePay receiving-account classification", () => {
  it("uses only the destination account and tolerates whitespace", () => {
    expect(classifySepayReceivingAccount("0100 123 456", receivingAccounts)).toBe("new_enrollment");
    expect(classifySepayReceivingAccount("0123987654", receivingAccounts)).toBe("renewal");
  });

  it("keeps an unknown account unknown instead of guessing from a payment reference", () => {
    expect(classifySepayReceivingAccount("0999999999", receivingAccounts)).toBe("unknown");
  });

  it("requires signed receiving-account data, not VietQR display-only fields", () => {
    const original = {
      newEnrollmentAccountNumber: process.env.SEPAY_NEW_ENROLLMENT_ACCOUNT_NUMBER,
      renewalAccountNumber: process.env.SEPAY_RENEWAL_ACCOUNT_NUMBER,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      webhookSecret: process.env.SEPAY_WEBHOOK_SECRET,
    };

    try {
      process.env.SEPAY_NEW_ENROLLMENT_ACCOUNT_NUMBER = "0100123456";
      process.env.SEPAY_RENEWAL_ACCOUNT_NUMBER = "0123987654";
      process.env.SEPAY_WEBHOOK_SECRET = "webhook-secret";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-service-role-key";

      expect(getSepayWebhookEnv().receivingAccounts).toEqual({
        new_enrollment: { accountNumber: "0100123456", purpose: "new_enrollment" },
        renewal: { accountNumber: "0123987654", purpose: "renewal" },
      });
    } finally {
      restoreEnvironmentVariable(
        "SEPAY_NEW_ENROLLMENT_ACCOUNT_NUMBER",
        original.newEnrollmentAccountNumber,
      );
      restoreEnvironmentVariable(
        "SEPAY_RENEWAL_ACCOUNT_NUMBER",
        original.renewalAccountNumber,
      );
      restoreEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY", original.serviceRoleKey);
      restoreEnvironmentVariable("SEPAY_WEBHOOK_SECRET", original.webhookSecret);
    }
  });
});

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
