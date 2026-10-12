import { expect, test } from "@playwright/test";

import { getE2EEnvironment, hasOperationalAuthState } from "./support/environment";

const environment = getE2EEnvironment();

test.describe("Wave 1 authenticated shell smoke", () => {
  test.skip(
    !hasOperationalAuthState(environment),
    environment.configured
      ? "An ignored non-production authentication state is required."
      : environment.reason,
  );

  test("loads the existing Students route without changing its access contract", async ({ page }) => {
    await page.goto("/students");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Học sinh" })).toBeVisible();
  });
});
