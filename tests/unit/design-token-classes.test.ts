import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Class names that look like design tokens but have no definition in
// globals.css (or that collide with another token). They render nothing,
// so a regression here silently breaks hierarchy or status colours.
const retiredClassNames = [
  "text-warning-text",
  "text-success-text",
  "text-danger-text",
  "text-kpi",
  "text-card-title",
  "text-text-primary",
  "text-text-secondary",
  "text-subtitle",
  "border-border-default",
  "border-neutral-border-x",
  // `--color-secondary` was removed from @theme so `text-secondary` is the
  // 13px type role; colour variants of it must not come back.
  "ring-secondary",
  "border-secondary",
  "bg-secondary",
];

// `text-section` alone is undefined; only `text-section-title` exists.
const bareSectionPattern = /\btext-section\b(?!-title)/;

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
    } else if (/\.(tsx?|css)$/.test(entry) && !entry.endsWith(".generated.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("design token class names", () => {
  const files = listSourceFiles(join(process.cwd(), "src"));

  it("does not use retired or undefined token classes", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const name of retiredClassNames) {
        if (new RegExp(`\\b${name}\\b`).test(source)) {
          offenders.push(`${file}: ${name}`);
        }
      }
      if (bareSectionPattern.test(source)) {
        offenders.push(`${file}: text-section`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps text-secondary a type token (no --color-secondary in @theme)", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const themeBlock = css.slice(css.indexOf("@theme inline {"));
    const themeEnd = themeBlock.indexOf("\n}\n");
    const theme = themeBlock.slice(0, themeEnd);
    expect(theme).not.toMatch(/--color-secondary\s*:/);
    expect(theme).toMatch(/--text-secondary\s*:/);
  });
});
