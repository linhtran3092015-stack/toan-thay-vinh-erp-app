import { defineConfig } from "@playwright/test";

import { getE2EEnvironment, hasOperationalAuthState } from "./tests/e2e/support/environment";

const environment = getE2EEnvironment();
const storageState = environment.configured && hasOperationalAuthState(environment)
  ? environment.authStatePath
  : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  use: {
    baseURL: environment.configured ? environment.baseURL : undefined,
    screenshot: "only-on-failure",
    storageState,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 960 } } },
    { name: "tablet", use: { viewport: { width: 1024, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
