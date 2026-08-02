import { NextResponse, type NextRequest } from "next/server";

import {
  getAllowedEmailsConfiguration,
  isEmailAllowed,
} from "@/features/auth/allowed-emails";
import { logAuthError } from "@/features/auth/auth-logging";
import { getSafeAuthRedirect } from "@/features/auth/auth-redirect";
import type { AuthErrorCode } from "@/features/auth/types";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function createFailureRedirect(
  request: NextRequest,
  error: AuthErrorCode,
): NextResponse {
  const loginUrl = new URL("/login", request.url);
  const nextPath = getSafeAuthRedirect(
    request.nextUrl.searchParams.get("next"),
  );

  loginUrl.searchParams.set("error", error);

  if (nextPath !== "/") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    logAuthError("configuration", request.nextUrl.pathname);
    return createFailureRedirect(request, "auth_configuration_missing");
  }

  const allowedEmails = getAllowedEmailsConfiguration();

  if (!allowedEmails.configured) {
    logAuthError("configuration", request.nextUrl.pathname);
    return createFailureRedirect(request, "auth_configuration_missing");
  }

  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");

  if (!code || providerError) {
    logAuthError("callback_exchange", request.nextUrl.pathname);
    return createFailureRedirect(request, "oauth_callback_failed");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      logAuthError("callback_exchange", request.nextUrl.pathname);
      return createFailureRedirect(request, "oauth_callback_failed");
    }

    const { data, error: userError } = await supabase.auth.getUser();
    const email = data.user?.email;

    if (userError || !data.user || !email) {
      await supabase.auth.signOut();
      logAuthError("callback_identity", request.nextUrl.pathname);
      return createFailureRedirect(request, "oauth_callback_failed");
    }

    if (!isEmailAllowed(email, allowedEmails)) {
      const { data: existingAccess, error: accessError } =
        await supabase.rpc("has_permission", {
          required_permission: "app.access",
        });

      let databaseAccessAllowed = !accessError && existingAccess === true;

      if (!databaseAccessAllowed) {
        const { data: invitationAccepted, error: invitationError } =
          await supabase.rpc("accept_my_account_invitation");

        databaseAccessAllowed =
          !invitationError && invitationAccepted === true;
      }

      if (!databaseAccessAllowed) {
        await supabase.auth.signOut();
        return createFailureRedirect(request, "unauthorized_email");
      }
    }

    const nextPath = getSafeAuthRedirect(
      request.nextUrl.searchParams.get("next"),
    );
    return NextResponse.redirect(new URL(nextPath, request.url));
  } catch {
    logAuthError("callback_exchange", request.nextUrl.pathname);
    return createFailureRedirect(request, "oauth_callback_failed");
  }
}
