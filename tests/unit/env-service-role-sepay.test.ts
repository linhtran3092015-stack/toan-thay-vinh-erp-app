import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSepayApiV2Env,
  getSepayWebhookEnv,
  getSupabaseServiceRoleEnv,
} from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

describe("Decoupled environment validation for Supabase service-role & SePay webhook", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getSupabaseServiceRoleEnv", () => {
    it("succeeds when SUPABASE_SERVICE_ROLE_KEY is present without SEPAY_WEBHOOK_SECRET", () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key-with-at-least-20-chars";
      delete process.env.SEPAY_WEBHOOK_SECRET;

      const env = getSupabaseServiceRoleEnv();
      expect(env).toEqual({
        serviceRoleKey: "mock-service-role-key-with-at-least-20-chars",
      });
    });

    it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => getSupabaseServiceRoleEnv()).toThrowError(
        "Supabase service role environment is not configured correctly.",
      );
    });

    it("throws when SUPABASE_SERVICE_ROLE_KEY is too short (<20 chars)", () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "short-key";

      expect(() => getSupabaseServiceRoleEnv()).toThrowError(
        "Supabase service role environment is not configured correctly.",
      );
    });
  });

  describe("getSepayWebhookEnv", () => {
    it("succeeds when SEPAY_WEBHOOK_SECRET is present without SUPABASE_SERVICE_ROLE_KEY", () => {
      process.env.SEPAY_WEBHOOK_SECRET = "my-sepay-secret";
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const env = getSepayWebhookEnv();
      expect(env).toEqual({
        webhookSecret: "my-sepay-secret",
      });
    });

    it("throws when SEPAY_WEBHOOK_SECRET is missing", () => {
      delete process.env.SEPAY_WEBHOOK_SECRET;

      expect(() => getSepayWebhookEnv()).toThrowError(
        "SePay webhook environment is not configured correctly.",
      );
    });

    it("throws when SEPAY_WEBHOOK_SECRET is empty string", () => {
      process.env.SEPAY_WEBHOOK_SECRET = "   ";

      expect(() => getSepayWebhookEnv()).toThrowError(
        "SePay webhook environment is not configured correctly.",
      );
    });
  });

  describe("getSepayApiV2Env", () => {
    it("keeps the API token server-side and defaults to the production v2 endpoint", () => {
      process.env.SEPAY_API_TOKEN = "sepay-api-v2-token";
      delete process.env.SEPAY_API_BASE_URL;

      expect(getSepayApiV2Env()).toEqual({
        baseUrl: "https://userapi.sepay.vn/v2",
        token: "sepay-api-v2-token",
      });
    });

    it("accepts the isolated HTTPS sandbox endpoint", () => {
      process.env.SEPAY_API_TOKEN = "sepay-api-v2-token";
      process.env.SEPAY_API_BASE_URL = "https://userapi-sandbox.sepay.vn/v2/";

      expect(getSepayApiV2Env()).toEqual({
        baseUrl: "https://userapi-sandbox.sepay.vn/v2",
        token: "sepay-api-v2-token",
      });
    });

    it("fails closed when the API token is missing", () => {
      delete process.env.SEPAY_API_TOKEN;

      expect(() => getSepayApiV2Env()).toThrowError(
        "SePay API v2 environment is not configured correctly.",
      );
    });
  });

  describe("createSupabaseServiceRoleClient", () => {
    it("creates Supabase client successfully when SEPAY_WEBHOOK_SECRET is completely absent", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key-with-at-least-20-characters";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key-with-at-least-20-chars";
      delete process.env.SEPAY_WEBHOOK_SECRET;

      const client = createSupabaseServiceRoleClient();
      expect(client).toBeDefined();
      expect(client.from).toBeTypeOf("function");
    });
  });
});
