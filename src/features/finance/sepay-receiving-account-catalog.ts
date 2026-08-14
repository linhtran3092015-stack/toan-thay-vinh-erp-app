import "server-only";

import type { Database } from "@/types/database.generated";

export type SepayReceivingAccountPurpose = "new_enrollment" | "renewal";

export interface SepayReceivingAccountResolution {
  accountDisplayName: string | null;
  accountNumber: string | null;
  accountVersionId: string | null;
  bankCode: string | null;
  purpose: SepayReceivingAccountPurpose | "unknown";
}

type RpcClient = {
  rpc: <Name extends keyof Database["public"]["Functions"]>(
    name: Name,
    args: Database["public"]["Functions"][Name]["Args"],
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

const unknownResolution: SepayReceivingAccountResolution = {
  accountDisplayName: null,
  accountNumber: null,
  accountVersionId: null,
  bankCode: null,
  purpose: "unknown",
};

export async function resolveSignedSepayReceivingAccount(
  client: RpcClient,
  signedAccountNumber: string,
  transactionAt: string,
): Promise<{ ok: true; value: SepayReceivingAccountResolution } | { ok: false }> {
  const { data, error } = await client.rpc("resolve_sepay_receiving_account", {
    p_signed_account_number: signedAccountNumber,
    p_transaction_at: transactionAt,
  });

  if (error || !Array.isArray(data)) {
    return { ok: false };
  }

  const row = data[0] as Record<string, unknown> | undefined;
  if (!row || row.purpose === "unknown") {
    return { ok: true, value: unknownResolution };
  }

  if (
    (row.purpose !== "new_enrollment" && row.purpose !== "renewal") ||
    typeof row.account_version_id !== "string" ||
    typeof row.bank_code !== "string" ||
    typeof row.account_number !== "string" ||
    typeof row.account_display_name !== "string"
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      accountDisplayName: row.account_display_name,
      accountNumber: row.account_number,
      accountVersionId: row.account_version_id,
      bankCode: row.bank_code,
      purpose: row.purpose,
    },
  };
}
