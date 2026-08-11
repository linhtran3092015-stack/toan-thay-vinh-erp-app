import { describe, expect, it } from "vitest";
import {
  APPROVED_STAGING_REF,
  KNOWN_DEV_REF,
  validateStagingTarget,
} from "../../scripts/verify-staging-target.mjs";

describe("validateStagingTarget pure preflight logic", () => {
  it("rejects DEV project reference", () => {
    const result = validateStagingTarget({
      targetEnv: "staging",
      linkedRef: KNOWN_DEV_REF,
      gitBranch: "ops/staging-rollout",
      gitStatus: "",
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain(
      `Linked project reference is the DEV reference (${KNOWN_DEV_REF})`,
    );
  });

  it("rejects unknown or arbitrary project references", () => {
    const result = validateStagingTarget({
      targetEnv: "staging",
      linkedRef: "arbitrary-unknown-ref",
      gitBranch: "ops/staging-rollout",
      gitStatus: "",
    });

    expect(result.passed).toBe(false);
    expect(
      result.reasons.some((r: string) =>
        r.includes("does not match approved staging reference"),
      ),
    ).toBe(true);
  });

  it("rejects non-staging target environment", () => {
    const result = validateStagingTarget({
      targetEnv: "production",
      linkedRef: APPROVED_STAGING_REF,
      gitBranch: "ops/staging-rollout",
      gitStatus: "",
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain("Target environment is not explicitly 'staging'");
  });

  it("passes when target is staging and linked ref matches approved staging ref", () => {
    const result = validateStagingTarget({
      targetEnv: "staging",
      linkedRef: APPROVED_STAGING_REF,
      gitBranch: "ops/staging-rollout",
      gitStatus: "",
    });

    expect(result.passed).toBe(true);
    expect(result.actualLinkedRef).toBe(APPROVED_STAGING_REF);
    expect(result.reasons).toHaveLength(0);
  });
});
