import { NextResponse, type NextRequest } from "next/server";

import {
  getAllowedEmailsConfiguration,
  isEmailAllowed,
} from "@/features/auth/allowed-emails";
import { getSafeAuthRedirect } from "@/features/auth/auth-redirect";
import type { AuthErrorCode } from "@/features/auth/types";
import { isSupabaseConfigured } from "@/lib/env";
import {
  applySupabaseSessionState,
  updateSupabaseSession,
  type SupabaseSessionState,
} from "@/lib/supabase/middleware";

const LOGIN_PATH = "/login";
const PUBLIC_PATHS = new Set([
  "/auth/callback",
  "/manifest.webmanifest",
  "/api/health/supabase",
  "/api/webhooks/sepay",
]);

function isPublicPath(pathname: string, method: string): boolean {
  // Component preview routes exist only outside production builds. Only reads
  // bypass auth: a POST to /dev/* can carry any server action id.
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/dev/") && (method === "GET" || method === "HEAD")) {
    return true;
  }

  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/coaching/form/") || pathname === "/site" || /^\/site\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname);
}

function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      ({ name }) => name.startsWith("sb-") && name.includes("auth-token"),
    );
}

function createLoginRedirect(
  request: NextRequest,
  error?: AuthErrorCode,
  state?: SupabaseSessionState,
): NextResponse {
  const loginUrl = new URL(LOGIN_PATH, request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  loginUrl.searchParams.set("next", nextPath);

  if (error) {
    loginUrl.searchParams.set("error", error);
  }

  const response = NextResponse.redirect(loginUrl);
  return state ? applySupabaseSessionState(response, state) : response;
}

function createAppRedirect(
  request: NextRequest,
  state: SupabaseSessionState,
): NextResponse {
  const nextPath = getSafeAuthRedirect(
    request.nextUrl.searchParams.get("next"),
  );
  const response = NextResponse.redirect(new URL(nextPath, request.url));
  return applySupabaseSessionState(response, state);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public Coaching links are intentionally anonymous, opaque-token routes.
  // They must bypass the ERP staff session/allowed-email gate; authorization is
  // enforced exclusively by the token-bound public RPCs.
  if (isPublicPath(pathname, request.method)) {
    return NextResponse.next({ request });
  }

  if (!isSupabaseConfigured()) {
    return pathname === LOGIN_PATH
      ? NextResponse.next({ request })
      : createLoginRedirect(request, "auth_configuration_missing");
  }

  const allowedEmails = getAllowedEmailsConfiguration();

  if (!allowedEmails.configured) {
    return pathname === LOGIN_PATH
      ? NextResponse.next({ request })
      : createLoginRedirect(request, "auth_configuration_missing");
  }

  const sessionState = await updateSupabaseSession(request);
  const isAuthorized =
    isEmailAllowed(sessionState.identity?.email, allowedEmails) ||
    sessionState.appAccessAllowed;

  if (pathname === LOGIN_PATH) {
    return isAuthorized
      ? createAppRedirect(request, sessionState)
      : sessionState.response;
  }

  if (!sessionState.identity) {
    return createLoginRedirect(
      request,
      hasAuthCookie(request) ? "session_expired" : undefined,
      sessionState,
    );
  }

  if (!isAuthorized) {
    return createLoginRedirect(request, "unauthorized_email", sessionState);
  }

  return sessionState.response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
