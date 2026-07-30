import { NextResponse } from "next/server";

import {
  isExpectedSepayAccount,
  parseSepayWebhookPayload,
  toSepayTransactionTimestamp,
  verifySepayWebhookSignature,
} from "@/features/finance/sepay-webhook";
import { getSepayWebhookEnv } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database } from "@/types/database.generated";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProcessSepayWebhookArgs = Database["public"]["Functions"]["process_sepay_webhook_transaction"]["Args"];

function webhookResponse(success: boolean, status: number) {
  return NextResponse.json(
    { success },
    {
      headers: {
        "Cache-Control": "no-store",
      },
      status,
    },
  );
}

export async function POST(request: Request) {
  let webhookEnv: ReturnType<typeof getSepayWebhookEnv>;

  try {
    webhookEnv = getSepayWebhookEnv();
  } catch {
    return webhookResponse(false, 503);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return webhookResponse(false, 415);
  }

  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return webhookResponse(false, 400);
  }

  if (
    !rawBody ||
    !verifySepayWebhookSignature({
      rawBody,
      secret: webhookEnv.webhookSecret,
      signature: request.headers.get("x-sepay-signature"),
      timestamp: request.headers.get("x-sepay-timestamp"),
    })
  ) {
    return webhookResponse(false, 401);
  }

  const payload = parseSepayWebhookPayload(rawBody);
  const transactionTimestamp = payload
    ? toSepayTransactionTimestamp(payload.transactionDate)
    : null;

  if (!payload || !transactionTimestamp) {
    return webhookResponse(false, 400);
  }

  if (!isExpectedSepayAccount(payload.accountNumber, webhookEnv.accountNumber)) {
    return webhookResponse(false, 422);
  }

  const args: ProcessSepayWebhookArgs = {
    p_account_number: payload.accountNumber,
    p_amount_in:
      payload.transferType === "in" ? payload.transferAmount : 0,
    p_amount_out:
      payload.transferType === "out" ? payload.transferAmount : 0,
    p_body_raw: payload as unknown as ProcessSepayWebhookArgs["p_body_raw"],
    p_code: payload.code ?? "",
    p_content: payload.content,
    p_gateway: payload.gateway,
    p_reference_number: payload.referenceCode ?? undefined,
    p_sepay_id: payload.id,
    p_transaction_date: transactionTimestamp,
    p_transfer_type: payload.transferType,
  };

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.rpc(
      "process_sepay_webhook_transaction",
      args,
    );

    if (error) {
      console.error("SEPAY_WEBHOOK_PROCESSING_FAILED");
      return webhookResponse(false, 500);
    }
  } catch {
    console.error("SEPAY_WEBHOOK_PROCESSING_FAILED");
    return webhookResponse(false, 500);
  }

  return webhookResponse(true, 200);
}
