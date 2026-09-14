import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getAllowedEmailsConfiguration, isEmailAllowed } from "@/features/auth/allowed-emails";
import { getSupabasePublicEnv } from "@/lib/env";

interface SessionCookieMutation {
  name: string;
  value: string;
  options: CookieOptions;
}

export interface VerifiedAuthIdentity {
  id: string;
  email?: string;
}

export interface SupabaseSessionState {
  appAccessAllowed: boolean;
  response: NextResponse;
  identity: VerifiedAuthIdentity | null;
  cookieMutations: SessionCookieMutation[];
  responseHeaders: Record<string, string>;
}

export function applySupabaseSessionState(
  response: NextResponse,
  state: SupabaseSessionState,
): NextResponse {
  state.cookieMutations.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  Object.entries(state.responseHeaders).forEach(([name, value]) => {
    response.headers.set(name, value);
  });

  return response;
}

export async function updateSupabaseSession(
  request: NextRequest,
): Promise<SupabaseSessionState> {
  let response = NextResponse.next({ request });
  let cookieMutations: SessionCookieMutation[] = [];
  let responseHeaders: Record<string, string> = {};
  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookieMutations = cookiesToSet;
        responseHeaders = headers;

        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  try {
    // getClaims() reads the JWT from cookies (no network call).
    // The setAll handler above writes refreshed tokens back to the response
    // so the browser always gets an up-to-date cookie.
    const { data, error } = await supabase.auth.getClaims();

    if (!error && data?.claims.sub) {
      const email = data.claims.email;

      // Optimisation: skip the `has_permission` RPC when the email is already
      // in the AUTH_ALLOWED_EMAILS whitelist. The whitelist is an env-var
      // set, so this check is purely in-memory (no network round-trip).
      // Only call the DB when the email is NOT in the whitelist (i.e. a
      // Supabase-RBAC-only user). This saves 150–300 ms per navigation for
      // whitelist users.
      const allowedEmails = getAllowedEmailsConfiguration();
      if (isEmailAllowed(email, allowedEmails)) {
        return {
          appAccessAllowed: true,
          response,
          identity: { id: data.claims.sub, email },
          cookieMutations,
          responseHeaders,
        };
      }

      const { data: appAccessAllowed, error: accessError } =
        await supabase.rpc("has_permission", {
          required_permission: "app.access",
        });

      return {
        appAccessAllowed: !accessError && appAccessAllowed === true,
        response,
        identity: {
          id: data.claims.sub,
          email,
        },
        cookieMutations,
        responseHeaders,
      };
    }
  } catch {
    // Invalid or expired sessions are handled by the route guard.
  }

  return {
    appAccessAllowed: false,
    response,
    identity: null,
    cookieMutations,
    responseHeaders,
  };
}
