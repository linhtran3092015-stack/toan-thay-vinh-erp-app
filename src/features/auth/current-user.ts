import { getAllowedEmailsConfiguration, isEmailAllowed } from "@/features/auth/allowed-emails";
import type { AuthUser, CurrentAuthUserResult } from "@/features/auth/types";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getDisplayName(
  email: string,
  metadata: Record<string, unknown>,
): string {
  const candidates = [metadata.full_name, metadata.name];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return email.split("@")[0] || "Nhân sự trung tâm";
}

function getAvatarUrl(metadata: Record<string, unknown>): string | undefined {
  if (typeof metadata.avatar_url !== "string") {
    return undefined;
  }

  try {
    const url = new URL(metadata.avatar_url);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function getInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = words
    .slice(-2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();

  return initials || "TV";
}

function mapAuthUser(
  id: string,
  email: string,
  metadata: Record<string, unknown>,
): AuthUser {
  const displayName = getDisplayName(email, metadata);

  return {
    id,
    email,
    displayName,
    initials: getInitials(displayName),
    avatarUrl: getAvatarUrl(metadata),
  };
}

export async function getCurrentAuthUser(): Promise<CurrentAuthUserResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "auth_configuration_missing" };
  }

  const allowedEmails = getAllowedEmailsConfiguration();

  if (!allowedEmails.configured) {
    return { ok: false, error: "auth_configuration_missing" };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    const email = data.user?.email;

    if (error || !data.user || !email) {
      return { ok: false, error: "session_expired" };
    }

    if (!isEmailAllowed(email, allowedEmails)) {
      return { ok: false, error: "unauthorized_email" };
    }

    return {
      ok: true,
      user: mapAuthUser(data.user.id, email, data.user.user_metadata),
    };
  } catch {
    return { ok: false, error: "session_expired" };
  }
}
