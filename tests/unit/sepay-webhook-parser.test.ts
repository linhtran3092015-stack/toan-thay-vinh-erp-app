import { describe, expect, it } from "vitest";

import {
  parseSepayWebhookPayloadDetailed,
  toSepayTransactionTimestamp,
} from "@/features/finance/sepay-webhook";

describe("parseSepayWebhookPayloadDetailed", () => {
  it("parses valid standard SePay payload successfully", () => {
    const raw = JSON.stringify({
      accountNumber: "0123456789",
      code: "TT123",
      content: "Chuyen tien hoc phi",
      gateway: "Vietcombank",
      id: 12345,
      referenceCode: "REF123",
      transactionDate: "2026-09-07 15:30:00",
      transferAmount: 500000,
      transferType: "in",
    });

    const result = parseSepayWebhookPayloadDetailed(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(12345);
      expect(result.data.accountNumber).toBe("0123456789");
      expect(result.data.transferAmount).toBe(500000);
      expect(result.data.transferType).toBe("in");
    }
  });

  it("accepts SePay test webhook ping payload with id 0", () => {
    const raw = JSON.stringify({
      accountNumber: "1234567890",
      content: "Test webhook SePay",
      gateway: "VCB",
      id: 0,
      transactionDate: "2026-09-07 17:00:00",
      transferAmount: 0,
      transferType: "in",
    });

    const result = parseSepayWebhookPayloadDetailed(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(0);
      expect(result.data.transferAmount).toBe(0);
    }
  });

  it("handles string coercions and credit/debit aliases", () => {
    const raw = JSON.stringify({
      accountNumber: 987654321,
      description: "Fallback description when content empty",
      id: "999",
      transactionDate: "2026-09-07T10:00:00Z",
      transferAmount: "250000",
      transferType: "credit",
    });

    const result = parseSepayWebhookPayloadDetailed(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(999);
      expect(result.data.accountNumber).toBe("987654321");
      expect(result.data.content).toBe("Fallback description when content empty");
      expect(result.data.transferAmount).toBe(250000);
      expect(result.data.transferType).toBe("in");
    }
  });

  it("returns detailed error when required fields are missing", () => {
    const raw = JSON.stringify({
      content: "Missing accountNumber and transactionDate",
      id: 1,
    });

    const result = parseSepayWebhookPayloadDetailed(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("accountNumber");
      expect(result.error).toContain("transactionDate");
    }
  });

  it("returns error on invalid JSON", () => {
    const result = parseSepayWebhookPayloadDetailed("invalid-json{");
    expect(result.ok).toBe(false);
  });
});

describe("toSepayTransactionTimestamp", () => {
  it("converts Vietnam local time string to ISO string", () => {
    const iso = toSepayTransactionTimestamp("2026-09-07 17:00:00");
    expect(iso).toBe("2026-09-07T10:00:00.000Z");
  });

  it("accepts ISO string with timezone offset", () => {
    const iso = toSepayTransactionTimestamp("2026-09-07T17:00:00+07:00");
    expect(iso).toBe("2026-09-07T10:00:00.000Z");
  });

  it("accepts UTC ISO string with Z", () => {
    const iso = toSepayTransactionTimestamp("2026-09-07T10:00:00Z");
    expect(iso).toBe("2026-09-07T10:00:00.000Z");
  });

  it("returns null on invalid date strings", () => {
    expect(toSepayTransactionTimestamp("")).toBe(null);
    expect(toSepayTransactionTimestamp("not-a-date")).toBe(null);
  });
});
