import { z } from "zod";

const optionalPublicKeySchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(20).optional(),
);

const supabasePublicEnvSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z
      .string()
      .trim()
      .url("must be a valid URL")
      .refine(
        (value) => value.startsWith("https://") || value.startsWith("http://"),
        "must use http or https",
      ),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalPublicKeySchema,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalPublicKeySchema,
  })
  .superRefine((env, context) => {
    if (
      !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      !env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      context.addIssue({
        code: "custom",
        message: "a publishable key is required",
        path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
      });
    }
  });

export interface SupabasePublicEnv {
  url: string;
  publishableKey: string;
}

const supabaseServiceRoleEnvSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20),
  });

export interface SupabaseServiceRoleEnv {
  serviceRoleKey: string;
}

const sepayWebhookEnvSchema = z
  .object({
    SEPAY_WEBHOOK_SECRET: z.string().trim().min(1),
  });

export interface SepayWebhookEnv {
  webhookSecret: string;
}

// Shared HMAC secret of the Apps Script submission form (webhook + roster).
const gradingFormEnvSchema = z.object({
  GRADING_FORM_SECRET: z.string().trim().min(32),
});

export interface GradingFormEnv {
  secret: string;
}

const sepayApiV2EnvSchema = z.object({
  SEPAY_API_BASE_URL: z
    .string()
    .trim()
    .url()
    .refine((value) => value.startsWith("https://"), "must use https")
    .default("https://userapi.sepay.vn/v2"),
  SEPAY_API_TOKEN: z.string().trim().min(1),
});

export interface SepayApiV2Env {
  baseUrl: string;
  token: string;
}

function readSupabasePublicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function isSupabaseConfigured(): boolean {
  return supabasePublicEnvSchema.safeParse(readSupabasePublicEnv()).success;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const result = supabasePublicEnvSchema.safeParse(readSupabasePublicEnv());

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(
      `Supabase public environment is not configured correctly. ${details}`,
    );
  }

  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey:
      result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
}

export function getSupabaseServiceRoleEnv(): SupabaseServiceRoleEnv {
  const result = supabaseServiceRoleEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    throw new Error(
      "Supabase service role environment is not configured correctly.",
    );
  }

  return {
    serviceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function getSepayWebhookEnv(): SepayWebhookEnv {
  const result = sepayWebhookEnvSchema.safeParse({
    SEPAY_WEBHOOK_SECRET: process.env.SEPAY_WEBHOOK_SECRET,
  });

  if (!result.success) {
    throw new Error("SePay webhook environment is not configured correctly.");
  }

  return {
    webhookSecret: result.data.SEPAY_WEBHOOK_SECRET,
  };
}

export function getGradingFormEnv(): GradingFormEnv {
  const result = gradingFormEnvSchema.safeParse({
    GRADING_FORM_SECRET: process.env.GRADING_FORM_SECRET,
  });

  if (!result.success) {
    throw new Error("Grading form integration environment is not configured correctly.");
  }

  return {
    secret: result.data.GRADING_FORM_SECRET,
  };
}

export function getSepayApiV2Env(): SepayApiV2Env {
  const result = sepayApiV2EnvSchema.safeParse({
    SEPAY_API_BASE_URL:
      process.env.SEPAY_API_BASE_URL || undefined,
    SEPAY_API_TOKEN: process.env.SEPAY_API_TOKEN,
  });

  if (!result.success) {
    throw new Error("SePay API v2 environment is not configured correctly.");
  }

  return {
    baseUrl: result.data.SEPAY_API_BASE_URL.replace(/\/$/, ""),
    token: result.data.SEPAY_API_TOKEN,
  };
}

/**
 * Optional outbound alert webhook (Slack / Discord / Zalo OA / any HTTPS
 * endpoint accepting JSON). Missing means in-app alerts only.
 */
export function getAlertWebhookUrl(): string | null {
  const value = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface ZaloCrmEnv {
  ZALOCRM_API_KEY: string;
  ZALOCRM_BASE_URL: string;
}

/** ZaloCRM public API (X-Api-Key). Null when the integration is not configured. */
export function getZaloCrmEnv(): ZaloCrmEnv | null {
  const baseUrl = process.env.ZALOCRM_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.ZALOCRM_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
  } catch {
    return null;
  }
  return { ZALOCRM_API_KEY: apiKey, ZALOCRM_BASE_URL: baseUrl };
}
