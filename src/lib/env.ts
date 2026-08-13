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

const optionalSepayTextSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const sepayAccountNumberSchema = z
  .string()
  .trim()
  .min(4)
  .max(34)
  .regex(/^[A-Za-z0-9]+$/);

const sepayReceivingAccountSchema = z.object({
  accountHolder: optionalSepayTextSchema.pipe(
    z.string().max(100).regex(/^[A-Za-z0-9 .-]+$/).optional(),
  ),
  accountNumber: sepayAccountNumberSchema,
  bankCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/),
  transferPrefix: optionalSepayTextSchema.pipe(
    z.string().max(32).regex(/^[A-Za-z0-9 -]+$/).optional(),
  ),
});

const sepayReceivingAccountsEnvSchema = z
  .object({
    newEnrollment: sepayReceivingAccountSchema,
    renewal: sepayReceivingAccountSchema,
  })
  .superRefine((accounts, context) => {
    if (
      normalizeSepayAccountNumber(accounts.newEnrollment.accountNumber) ===
      normalizeSepayAccountNumber(accounts.renewal.accountNumber)
    ) {
      context.addIssue({
        code: "custom",
        message: "new-enrollment and renewal receiving accounts must be distinct",
        path: ["renewal", "accountNumber"],
      });
    }
  });

const sepayWebhookEnvSchema = z
  .object({
    newEnrollmentAccountNumber: sepayAccountNumberSchema,
    renewalAccountNumber: sepayAccountNumberSchema,
    SEPAY_WEBHOOK_SECRET: z.string().trim().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20),
  })
  .superRefine((accounts, context) => {
    if (
      normalizeSepayAccountNumber(accounts.newEnrollmentAccountNumber) ===
      normalizeSepayAccountNumber(accounts.renewalAccountNumber)
    ) {
      context.addIssue({
        code: "custom",
        message: "new-enrollment and renewal receiving accounts must be distinct",
        path: ["renewalAccountNumber"],
      });
    }
  });

export interface SepayWebhookEnv {
  receivingAccounts: Record<SepayReceivingAccountPurpose, SepayReceivingAccount>;
  serviceRoleKey: string;
  webhookSecret: string;
}

export type SepayReceivingAccountPurpose = "new_enrollment" | "renewal";

export interface SepayReceivingAccount {
  accountNumber: string;
  purpose: SepayReceivingAccountPurpose;
}

export interface SepayPaymentEnv {
  accountHolder?: string;
  accountNumber: string;
  bankCode: string;
  purpose: SepayReceivingAccountPurpose;
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
    newEnrollmentAccountNumber: process.env.SEPAY_NEW_ENROLLMENT_ACCOUNT_NUMBER,
    renewalAccountNumber: process.env.SEPAY_RENEWAL_ACCOUNT_NUMBER,
    SEPAY_WEBHOOK_SECRET: process.env.SEPAY_WEBHOOK_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    throw new Error("SePay webhook environment is not configured correctly.");
  }

  return {
    receivingAccounts: {
      new_enrollment: {
        accountNumber: result.data.newEnrollmentAccountNumber,
        purpose: "new_enrollment",
      },
      renewal: {
        accountNumber: result.data.renewalAccountNumber,
        purpose: "renewal",
      },
    },
    serviceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
    webhookSecret: result.data.SEPAY_WEBHOOK_SECRET,
  };
}

export function getSepayPaymentEnv(
  purpose: SepayReceivingAccountPurpose,
): SepayPaymentEnv {
  const result = sepayReceivingAccountsEnvSchema.safeParse({
    newEnrollment: readSepayReceivingAccountEnv("NEW_ENROLLMENT"),
    renewal: readSepayReceivingAccountEnv("RENEWAL"),
  });

  if (!result.success) {
    throw new Error("SePay payment environment is not configured correctly.");
  }

  const account = purpose === "new_enrollment"
    ? result.data.newEnrollment
    : result.data.renewal;

  return { ...account, purpose };
}

export function isSepayPaymentConfigured(): boolean {
  try {
    getSepayPaymentEnv("new_enrollment");
    getSepayPaymentEnv("renewal");
    return true;
  } catch {
    return false;
  }
}

function readSepayReceivingAccountEnv(
  prefix: "NEW_ENROLLMENT" | "RENEWAL",
) {
  return {
    accountHolder: process.env[`SEPAY_${prefix}_ACCOUNT_HOLDER`],
    accountNumber: process.env[`SEPAY_${prefix}_ACCOUNT_NUMBER`],
    bankCode: process.env[`SEPAY_${prefix}_BANK_CODE`],
    transferPrefix: process.env[`SEPAY_${prefix}_TRANSFER_PREFIX`],
  };
}

function normalizeSepayAccountNumber(value: string): string {
  return value.replace(/\s+/g, "");
}
