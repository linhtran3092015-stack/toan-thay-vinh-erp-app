export type AuthErrorCode =
  | "auth_configuration_missing"
  | "oauth_callback_failed"
  | "session_expired"
  | "signout_failed"
  | "unauthorized_email";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  avatarUrl?: string;
}

export type CurrentAuthUserResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: AuthErrorCode };
