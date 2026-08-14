export interface VietQrPaymentDetails {
  accountHolder?: string;
  accountNumber: string;
  bankCode: string;
  imageUrl: string;
  transferDescription: string;
}

export interface LockedVietQrPaymentContract {
  accountDisplayName: string;
  accountNumber: string;
  amountVnd: number;
  bankCode: string;
  transferCode: string;
}

export function buildLockedVietQrPaymentDetails(contract: LockedVietQrPaymentContract): VietQrPaymentDetails {
  if (!Number.isSafeInteger(contract.amountVnd) || contract.amountVnd <= 0 || !contract.accountNumber.trim() || !contract.bankCode.trim() || !contract.transferCode.trim()) throw new Error("Locked VietQR payment contract is invalid.");
  const imageUrl = new URL("https://vietqr.app/img");
  imageUrl.searchParams.set("acc", contract.accountNumber);
  imageUrl.searchParams.set("bank", contract.bankCode);
  imageUrl.searchParams.set("amount", String(contract.amountVnd));
  imageUrl.searchParams.set("des", contract.transferCode);
  imageUrl.searchParams.set("template", "compact");
  imageUrl.searchParams.set("showinfo", "true");
  imageUrl.searchParams.set("holder", contract.accountDisplayName);
  return { accountHolder: contract.accountDisplayName, accountNumber: contract.accountNumber, bankCode: contract.bankCode, imageUrl: imageUrl.toString(), transferDescription: contract.transferCode };
}
