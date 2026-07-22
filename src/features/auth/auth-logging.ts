type AuthLogCategory =
  | "callback_exchange"
  | "callback_identity"
  | "configuration"
  | "signout";

export function logAuthError(category: AuthLogCategory, path: string): void {
  console.error("[auth]", { category, path });
}
