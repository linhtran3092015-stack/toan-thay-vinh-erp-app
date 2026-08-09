import { existsSync } from "node:fs";
import { resolve } from "node:path";

type E2EEnvironment =
  | {
      configured: false;
      reason: string;
    }
  | {
      authStatePath: string;
      baseURL: string;
      configured: true;
      environment: "staging" | "test";
      projectRef: string;
      supabaseURL: string;
    };

function readRequired(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

/**
 * This guard deliberately permits only explicit staging/test configuration.
 * Missing configuration skips authenticated tests; partial or unsafe
 * configuration fails before a browser can mutate a target.
 */
export function getE2EEnvironment(): E2EEnvironment {
  const baseURL = readRequired("E2E_BASE_URL");
  const supabaseURL = readRequired("E2E_SUPABASE_URL");
  const projectRef = readRequired("E2E_SUPABASE_PROJECT_REF");
  const allowedProjectRef = readRequired("E2E_ALLOWED_SUPABASE_PROJECT_REF");
  const environment = readRequired("E2E_ENVIRONMENT");
  const supplied = [baseURL, supabaseURL, projectRef, allowedProjectRef, environment].filter(Boolean);

  if (supplied.length === 0) {
    return {
      configured: false,
      reason: "E2E staging/test target is not configured.",
    };
  }

  if (!baseURL || !supabaseURL || !projectRef || !allowedProjectRef || !environment) {
    throw new Error("Incomplete E2E target configuration. Refusing to run browser tests.");
  }

  if (environment !== "staging" && environment !== "test") {
    throw new Error("E2E_ENVIRONMENT must be staging or test. Refusing to run browser tests.");
  }

  if (projectRef !== allowedProjectRef) {
    throw new Error("Configured Supabase project is not the explicit non-production allowlist target.");
  }

  const applicationURL = new URL(baseURL);
  const supabaseTargetURL = new URL(supabaseURL);
  const productionTerms = ["production", "prod"];

  if (productionTerms.some((term) => applicationURL.hostname.toLowerCase().includes(term))) {
    throw new Error("Configured application URL appears to be production. Refusing to run browser tests.");
  }

  if (supabaseTargetURL.hostname !== `${projectRef}.supabase.co`) {
    throw new Error("Configured Supabase URL does not match the allowlisted non-production project.");
  }

  return {
    authStatePath: resolve(
      readRequired("E2E_AUTH_STATE_PATH") ?? "playwright/.auth/operational.json",
    ),
    baseURL: applicationURL.toString(),
    configured: true,
    environment,
    projectRef,
    supabaseURL: supabaseTargetURL.toString(),
  };
}

export function hasOperationalAuthState(environment: E2EEnvironment): boolean {
  return environment.configured && existsSync(environment.authStatePath);
}

export function assertDestructiveE2EEnvironment(environment: E2EEnvironment): void {
  if (!environment.configured) {
    throw new Error("Destructive E2E tests require an explicit non-production target.");
  }

  if (process.env.E2E_ALLOW_DESTRUCTIVE_TESTS !== "true") {
    throw new Error("Destructive E2E tests require E2E_ALLOW_DESTRUCTIVE_TESTS=true.");
  }
}
