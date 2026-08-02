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

const sepayWebhookEnvSchema = z.object({
  SEPAY_ACCOUNT_NUMBER: z.string().trim().min(1),
  SEPAY_WEBHOOK_SECRET: z.string().trim().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20),
});

const optionalSepayTextSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const sepayPaymentEnvSchema = z.object({
  SEPAY_ACCOUNT_HOLDER: optionalSepayTextSchema.pipe(
    z.string().max(100).regex(/^[A-Za-z0-9 .-]+$/).optional(),
  ),
  SEPAY_ACCOUNT_NUMBER: z
    .string()
    .trim()
    .min(4)
    .max(34)
    .regex(/^[A-Za-z0-9]+$/),
  SEPAY_BANK_CODE: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/),
  SEPAY_TRANSFER_PREFIX: optionalSepayTextSchema.pipe(
    z.string().max(32).regex(/^[A-Za-z0-9 -]+$/).optional(),
  ),
});

export interface SepayWebhookEnv {
  accountNumber: string;
  serviceRoleKey: string;
  webhookSecret: string;
}

export interface SepayPaymentEnv {
  accountHolder?: string;
  accountNumber: string;
  bankCode: string;
  transferPrefix?: string;
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

export function getSepayWebhookEnv(): SepayWebhookEnv {
  const result = sepayWebhookEnvSchema.safeParse({
    SEPAY_ACCOUNT_NUMBER: process.env.SEPAY_ACCOUNT_NUMBER,
    SEPAY_WEBHOOK_SECRET: process.env.SEPAY_WEBHOOK_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    throw new Error("SePay webhook environment is not configured correctly.");
  }

  return {
    accountNumber: result.data.SEPAY_ACCOUNT_NUMBER,
    serviceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
    webhookSecret: result.data.SEPAY_WEBHOOK_SECRET,
  };
}

export function getSepayPaymentEnv(): SepayPaymentEnv {
  const result = sepayPaymentEnvSchema.safeParse({
    SEPAY_ACCOUNT_HOLDER: process.env.SEPAY_ACCOUNT_HOLDER,
    SEPAY_ACCOUNT_NUMBER: process.env.SEPAY_ACCOUNT_NUMBER,
    SEPAY_BANK_CODE: process.env.SEPAY_BANK_CODE,
    SEPAY_TRANSFER_PREFIX: process.env.SEPAY_TRANSFER_PREFIX,
  });

  if (!result.success) {
    throw new Error("SePay payment environment is not configured correctly.");
  }

  return {
    accountHolder: result.data.SEPAY_ACCOUNT_HOLDER,
    accountNumber: result.data.SEPAY_ACCOUNT_NUMBER,
    bankCode: result.data.SEPAY_BANK_CODE,
    transferPrefix: result.data.SEPAY_TRANSFER_PREFIX,
  };
}

export function isSepayPaymentConfigured(): boolean {
  try {
    getSepayPaymentEnv();
    return true;
  } catch {
    return false;
  }
}
