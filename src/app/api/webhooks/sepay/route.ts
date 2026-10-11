import { NextResponse } from "next/server";

import { raiseOpsAlert } from "@/lib/ops-alerts";

import {
  parseSepayWebhookPayloadDetailed,
  toSepayTransactionTimestamp,
  verifySepayWebhookSignature,
} from "@/features/finance/sepay-webhook";
import { resolveSignedSepayReceivingAccount } from "@/features/finance/sepay-receiving-account-catalog";
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

  const detailedResult = parseSepayWebhookPayloadDetailed(rawBody);
  if (!detailedResult.ok) {
    // Never log the body: it carries payer names, account numbers and transfer content.
    console.error("SEPAY_WEBHOOK_VALIDATION_FAILED:", detailedResult.error, "bodyLength:", rawBody.length);
    return NextResponse.json(
      { error: detailedResult.error, success: false },
      { headers: { "Cache-Control": "no-store" }, status: 400 },
    );
  }

  const payload = detailedResult.data;
  const transactionTimestamp = toSepayTransactionTimestamp(payload.transactionDate);

  if (!transactionTimestamp) {
    console.error("SEPAY_WEBHOOK_INVALID_DATE:", payload.transactionDate);
    return NextResponse.json(
      { error: `Invalid transactionDate: ${payload.transactionDate}`, success: false },
      { headers: { "Cache-Control": "no-store" }, status: 400 },
    );
  }

  // Handle SePay test webhook ping (mock payload with id: 0)
  if (payload.id === 0) {
    console.log("SEPAY_TEST_WEBHOOK_PING_VERIFIED:", { id: payload.id, transactionDate: payload.transactionDate });
    return webhookResponse(true, 200);
  }

  let supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
  let accountResolution: Awaited<ReturnType<typeof resolveSignedSepayReceivingAccount>>;
  try {
    supabase = createSupabaseServiceRoleClient();
    accountResolution = await resolveSignedSepayReceivingAccount(
      supabase,
      payload.accountNumber,
      transactionTimestamp,
    );
  } catch {
    console.error("SEPAY_RECEIVING_ACCOUNT_RESOLUTION_FAILED");
    return webhookResponse(false, 500);
  }

  if (!accountResolution.ok) {
    console.error("SEPAY_RECEIVING_ACCOUNT_RESOLUTION_FAILED");
    return webhookResponse(false, 500);
  }

  const args: ProcessSepayWebhookArgs = {
    p_account_number: payload.accountNumber,
    p_account_purpose: accountResolution.value.purpose,
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
    const { error } = await supabase.rpc(
      "process_sepay_webhook_transaction",
      args,
    );

    if (error) {
      console.error("SEPAY_WEBHOOK_PROCESSING_FAILED");
      await raiseOpsAlert(supabase, {
        code: "sepay_webhook_processing_failed",
        dedupeKey: `ops.sepay_webhook_processing_failed:${payload.id}`,
        href: "/finance/sepay?queue=review",
        message: `Webhook SePay #${payload.id} (${payload.transferAmount.toLocaleString("vi-VN")} ₫) không ghi nhận được: ${error.message}. Dùng Đồng bộ lịch sử SePay để bù.`,
        title: "Webhook SePay xử lý lỗi",
      });
      return webhookResponse(false, 500);
    }
  } catch {
    console.error("SEPAY_WEBHOOK_PROCESSING_FAILED");
    await raiseOpsAlert(supabase, {
      code: "sepay_webhook_processing_failed",
      dedupeKey: `ops.sepay_webhook_processing_failed:${payload.id}`,
      href: "/finance/sepay?queue=review",
      message: `Webhook SePay #${payload.id} không ghi nhận được do lỗi kết nối cơ sở dữ liệu. Dùng Đồng bộ lịch sử SePay để bù.`,
      title: "Webhook SePay xử lý lỗi",
    });
    return webhookResponse(false, 500);
  }

  return webhookResponse(true, 200);
}
