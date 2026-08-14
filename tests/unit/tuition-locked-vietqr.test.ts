import { describe, expect, it } from "vitest";
import { buildLockedVietQrPaymentDetails } from "@/features/finance/vietqr";

describe("locked tuition VietQR contract", () => {
  it("encodes only the locked destination, amount and canonical transfer reference", () => {
    const first = buildLockedVietQrPaymentDetails({ accountDisplayName: "Tai khoan A", accountNumber: "1900123456", amountVnd: 1_200_000, bankCode: "VCB", transferCode: "TTV PAY-A8K39P" });
    const url = new URL(first.imageUrl);
    expect(url.searchParams.get("bank")).toBe("VCB"); expect(url.searchParams.get("acc")).toBe("1900123456"); expect(url.searchParams.get("amount")).toBe("1200000"); expect(url.searchParams.get("des")).toBe("TTV PAY-A8K39P");
    const later = buildLockedVietQrPaymentDetails({ accountDisplayName: "Tai khoan B", accountNumber: "999999", amountVnd: 1_200_000, bankCode: "ACB", transferCode: "TTV PAY-NEW" });
    expect(new URL(first.imageUrl).searchParams.get("acc")).toBe("1900123456"); expect(new URL(later.imageUrl).searchParams.get("acc")).toBe("999999");
  });
});
