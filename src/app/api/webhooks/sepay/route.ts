import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Authorization Token if configured
    const authHeader = request.headers.get("authorization");
    const secret = process.env.SEPAY_WEBHOOK_SECRET;

    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid webhook secret token" },
        { status: 401 },
      );
    }

    // 2. Parse SePay Webhook Body Payload
    const body = await request.json();

    const sepayId = body.id ? Number(body.id) : null;
    const gateway = body.gateway || "UNKNOWN";
    const transactionDate = body.transactionDate || body.transaction_date || new Date().toISOString();
    const accountNumber = body.accountNumber || body.account_number || "";
    const code = body.code || "";
    const content = body.content || body.description || "";
    const transferType = body.transferType || body.transfer_type || "in";
    const amountIn = body.transferAmount ? Number(body.transferAmount) : body.amount_in ? Number(body.amount_in) : 0;
    const amountOut = body.amount_out ? Number(body.amount_out) : 0;
    const referenceNumber = body.referenceCode || body.reference_number || null;

    if (!sepayId) {
      return NextResponse.json(
        { error: "Missing required field: id (SePay transaction ID)" },
        { status: 400 },
      );
    }

    // 3. Call RPC function process_sepay_webhook_transaction
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("process_sepay_webhook_transaction", {
      p_account_number: accountNumber,
      p_amount_in: amountIn,
      p_amount_out: amountOut,
      p_body_raw: body,
      p_code: code,
      p_content: content,
      p_gateway: gateway,
      p_reference_number: referenceNumber,
      p_sepay_id: sepayId,
      p_transaction_date: transactionDate,
      p_transfer_type: transferType,
    });

    if (error) {
      return NextResponse.json(
        { error: `Database RPC error: ${error.message}`, success: false },
        { status: 500 },
      );
    }

    return NextResponse.json({
      result: data,
      success: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook processing exception: ${message}`, success: false },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "SePay Webhook Endpoint is active.",
    service: "Toan Thay Vinh ERP Finance",
    status: "ok",
  });
}
