import "server-only";

import { z } from "zod";

interface AllowedEmailsConfiguration {
  configured: boolean;
  emails: ReadonlySet<string>;
}

const emailSchema = z.string().trim().email();

export function getAllowedEmailsConfiguration(): AllowedEmailsConfiguration {
  const rawValue = process.env.AUTH_ALLOWED_EMAILS;

  if (!rawValue?.trim()) {
    return { configured: false, emails: new Set() };
  }

  const candidates = rawValue.split(",").map((email) => email.trim());
  const emails = new Set<string>();

  for (const candidate of candidates) {
    const result = emailSchema.safeParse(candidate);

    if (!result.success) {
      return { configured: false, emails: new Set() };
    }

    emails.add(result.data.toLowerCase());
  }

  return { configured: emails.size > 0, emails };
}

export function isEmailAllowed(
  email: string | null | undefined,
  configuration = getAllowedEmailsConfiguration(),
): boolean {
  return Boolean(
    configuration.configured &&
      email &&
      configuration.emails.has(email.trim().toLowerCase()),
  );
}
