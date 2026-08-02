import type { SepayPaymentEnv } from "@/lib/env";

interface VietQrPaymentInput {
  amountVnd: number;
  transferCode: string;
}

export interface VietQrPaymentDetails {
  accountHolder?: string;
  accountNumber: string;
  bankCode: string;
  imageUrl: string;
  transferDescription: string;
}

export function buildVietQrPaymentDetails(
  config: SepayPaymentEnv,
  input: VietQrPaymentInput,
): VietQrPaymentDetails {
  if (!Number.isSafeInteger(input.amountVnd) || input.amountVnd <= 0) {
    throw new Error("VietQR amount must be a positive integer.");
  }

  const transferCode = input.transferCode.trim();
  if (!transferCode) {
    throw new Error("VietQR transfer code is required.");
  }

  const transferDescription = [config.transferPrefix, transferCode]
    .filter(Boolean)
    .join(" ");
  const imageUrl = new URL("https://vietqr.app/img");
  imageUrl.searchParams.set("acc", config.accountNumber);
  imageUrl.searchParams.set("bank", config.bankCode);
  imageUrl.searchParams.set("amount", String(input.amountVnd));
  imageUrl.searchParams.set("des", transferDescription);
  imageUrl.searchParams.set("template", "compact");
  imageUrl.searchParams.set("showinfo", "true");

  if (config.accountHolder) {
    imageUrl.searchParams.set("holder", config.accountHolder);
  }

  return {
    accountHolder: config.accountHolder,
    accountNumber: config.accountNumber,
    bankCode: config.bankCode,
    imageUrl: imageUrl.toString(),
    transferDescription,
  };
}

