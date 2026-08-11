import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Salary Advance reader normalization", () => {
  it("maps the stored advance status directly instead of fabricating requested", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/advances/data.ts"),
      "utf8",
    );

    expect(source).toContain("status: entry.advance_status");
    expect(source).not.toContain("normalizeStatus");
    expect(source).not.toMatch(/return\s+"requested"/);
  });
});
