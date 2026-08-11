import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

export const APPROVED_STAGING_REF = "kdscaoudnxekytfvqotf";
export const KNOWN_DEV_REF = "tsihernwjunagrmvdqyb";
export const EXPECTED_HOSTNAME = `${APPROVED_STAGING_REF}.supabase.co`;

/**
 * Pure validation logic for staging preflight target verification.
 */
export function validateStagingTarget(inputs) {
  const { targetEnv, linkedRef, gitBranch = "", gitStatus = "" } = inputs;
  const normalizedEnv = (targetEnv || "").trim().toLowerCase();

  const isStagingEnv = normalizedEnv === "staging";
  const refPresent = Boolean(linkedRef && linkedRef.trim());
  const isApprovedStaging = linkedRef === APPROVED_STAGING_REF;
  const isNotDev = linkedRef !== KNOWN_DEV_REF;
  const derivedHostname = refPresent ? `${linkedRef}.supabase.co` : "";
  const hostnameMatches = derivedHostname === EXPECTED_HOSTNAME;

  const passed =
    isStagingEnv &&
    refPresent &&
    isApprovedStaging &&
    isNotDev &&
    hostnameMatches;

  const reasons = [
    !isStagingEnv && "Target environment is not explicitly 'staging'",
    !refPresent && "No local linked project reference found",
    !isNotDev && `Linked project reference is the DEV reference (${KNOWN_DEV_REF})`,
    !isApprovedStaging && `Linked project reference (${linkedRef}) does not match approved staging reference (${APPROVED_STAGING_REF})`,
    !hostnameMatches && `Derived hostname (${derivedHostname}) does not match expected staging hostname (${EXPECTED_HOSTNAME})`,
  ].filter((item) => typeof item === "string");

  return {
    passed,
    targetEnv: normalizedEnv || "unspecified",
    actualLinkedRef: linkedRef || "none",
    expectedStagingRef: APPROVED_STAGING_REF,
    knownDevRef: KNOWN_DEV_REF,
    expectedHostname: EXPECTED_HOSTNAME,
    derivedHostname,
    gitBranch,
    gitStatus: gitStatus.trim() === "" ? "clean" : "dirty",
    reasons,
  };
}

/**
 * Reads local Supabase metadata from filesystem without network calls or mutating state.
 */
export function readLocalLinkedRef() {
  const linkedJsonPath = resolve(process.cwd(), "supabase/.temp/linked-project.json");
  if (existsSync(linkedJsonPath)) {
    try {
      const data = JSON.parse(readFileSync(linkedJsonPath, "utf8"));
      if (data && typeof data.ref === "string") {
        return data.ref.trim();
      }
    } catch {
      // Fallback to project-ref file if JSON parse fails
    }
  }

  const projectRefPath = resolve(process.cwd(), "supabase/.temp/project-ref");
  if (existsSync(projectRefPath)) {
    return readFileSync(projectRefPath, "utf8").trim();
  }

  return "";
}

function getGitBranch() {
  try {
    return execSync("git branch --show-current", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function getGitStatus() {
  try {
    return execSync("git status --short", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function runPreflightCLI(args = process.argv.slice(2)) {
  const isTestSynthetic =
    args.includes("--test-synthetic") || Boolean(process.env.STAGING_PREFLIGHT_TEST_MOCK_REF);

  const targetEnv = process.env.TARGET_ENV || "staging";
  const linkedRef = isTestSynthetic
    ? process.env.STAGING_PREFLIGHT_TEST_MOCK_REF || APPROVED_STAGING_REF
    : readLocalLinkedRef();

  const gitBranch = getGitBranch();
  const gitStatus = getGitStatus();

  const result = validateStagingTarget({
    targetEnv,
    linkedRef,
    gitBranch,
    gitStatus,
  });

  console.log("==========================================");
  console.log("STAGING TARGET PREFLIGHT VERIFICATION");
  console.log("==========================================");
  console.log(`Environment:          ${result.targetEnv.toUpperCase()}`);
  console.log(`Current branch:       ${result.gitBranch}`);
  console.log(`Git worktree:         ${result.gitStatus}`);
  console.log(`Expected staging ref: ${result.expectedStagingRef}`);
  console.log(`Actual linked ref:    ${result.actualLinkedRef}`);
  console.log(`Expected hostname:    ${result.expectedHostname}`);
  if (isTestSynthetic) {
    console.log("Mode:                 SYNTHETIC TEST VALIDATION");
  }
  console.log("------------------------------------------");

  if (result.passed) {
    console.log("Verdict:               PASS");
    console.log("==========================================");
    return 0;
  } else {
    console.log("Verdict:               NO-GO — STAGING TARGET NOT VERIFIED");
    console.log("Reasons:");
    for (const reason of result.reasons) {
      console.log(` - ${reason}`);
    }
    console.log("==========================================");
    return 1;
  }
}

// Execute CLI if run directly via Node
if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = runPreflightCLI();
  process.exit(exitCode);
}
