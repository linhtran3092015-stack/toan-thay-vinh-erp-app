import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
    const { data, error } = await supabase.auth.getClaims();

    if (!error && data?.claims.sub) {
      return {
        response,
        identity: {
          id: data.claims.sub,
          email: data.claims.email,
        },
        cookieMutations,
        responseHeaders,
      };
    }
  } catch {
    // Invalid or expired sessions are handled by the route guard.
  }

  return {
    response,
    identity: null,
    cookieMutations,
    responseHeaders,
  };
}
