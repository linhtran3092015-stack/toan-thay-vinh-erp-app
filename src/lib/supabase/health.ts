import {
  getSupabasePublicEnv,
  isSupabaseConfigured,
} from "@/lib/env";

const HEALTH_TIMEOUT_MS = 5_000;

export interface SupabaseHealthStatus {
  service: "supabase";
  configured: boolean;
  connected: boolean;
  message: string;
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  if (!isSupabaseConfigured()) {
    return {
      service: "supabase",
      configured: false,
      connected: false,
      message: "Supabase environment is missing or invalid",
    };
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  const healthUrl = new URL("/auth/v1/health", url);

  try {
    const response = await fetch(healthUrl, {
      cache: "no-store",
      headers: {
        apikey: publishableKey,
      },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        service: "supabase",
        configured: true,
        connected: false,
        message: "Supabase connection is unavailable",
      };
    }

    return {
      service: "supabase",
      configured: true,
      connected: true,
      message: "Supabase connection is available",
    };
  } catch {
    return {
      service: "supabase",
      configured: true,
      connected: false,
      message: "Supabase connection is unavailable",
    };
  }
}
