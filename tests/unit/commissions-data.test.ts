import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Commission reader normalization", () => {
  it("maps stored source-group and status values directly instead of coercing unknown values", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/commissions/data.ts"),
      "utf8",
    );

    expect(source).toContain("leadSourceGroup: entry.lead_source_group");
    expect(source).toContain("status: entry.accrual_status");
    expect(source).not.toContain("normalizeLeadSourceGroup");
    expect(source).not.toMatch(/status:\s*"provisional"/);
  });
});
