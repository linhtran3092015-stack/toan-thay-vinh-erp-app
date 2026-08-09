import { afterEach, describe, expect, it } from "vitest";

import {
  assertDestructiveE2EEnvironment,
  getE2EEnvironment,
} from "../e2e/support/environment";

const environmentKeys = [
  "E2E_ALLOWED_SUPABASE_PROJECT_REF",
  "E2E_ALLOW_DESTRUCTIVE_TESTS",
  "E2E_BASE_URL",
  "E2E_ENVIRONMENT",
  "E2E_SUPABASE_PROJECT_REF",
  "E2E_SUPABASE_URL",
] as const;

const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);

function setSafeEnvironment(overrides: Partial<Record<(typeof environmentKeys)[number], string>> = {}) {
  process.env.E2E_ALLOWED_SUPABASE_PROJECT_REF = "erp-test-ref";
  process.env.E2E_BASE_URL = "https://erp-staging.example.test";
  process.env.E2E_ENVIRONMENT = "test";
  process.env.E2E_SUPABASE_PROJECT_REF = "erp-test-ref";
  process.env.E2E_SUPABASE_URL = "https://erp-test-ref.supabase.co";

  Object.assign(process.env, overrides);
}

afterEach(() => {
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("non-production Playwright environment guard", () => {
  it("does not configure authenticated browser tests when no target is supplied", () => {
    for (const key of environmentKeys) {
      delete process.env[key];
    }

    expect(getE2EEnvironment()).toMatchObject({ configured: false });
  });

  it("accepts only an explicit matching staging/test allowlist target", () => {
    setSafeEnvironment();

    expect(getE2EEnvironment()).toMatchObject({
      configured: true,
      environment: "test",
      projectRef: "erp-test-ref",
    });
  });

  it("refuses production-looking application URLs and destructive runs without an explicit opt-in", () => {
    setSafeEnvironment({ E2E_BASE_URL: "https://erp-production.example.com" });
    expect(() => getE2EEnvironment()).toThrow("production");

    setSafeEnvironment();
    expect(() => assertDestructiveE2EEnvironment(getE2EEnvironment())).toThrow(
      "E2E_ALLOW_DESTRUCTIVE_TESTS=true",
    );
  });
});
