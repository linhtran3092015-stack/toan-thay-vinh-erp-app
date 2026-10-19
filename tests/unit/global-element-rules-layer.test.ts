import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type CssRule = { selector: string; body: string; atRules: string[] };

// Every style rule in the sheet with the at-rules around it (comments dropped).
function styleRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const stack: string[] = [];
  let buffer = "";
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (char === "{") {
      // Drop statements such as `@import "tailwindcss";` that precede the prelude.
      stack.push(buffer.slice(buffer.lastIndexOf(";") + 1).trim());
      buffer = "";
    } else if (char === "}") {
      const prelude = stack.pop() ?? "";
      if (!prelude.startsWith("@")) {
        rules.push({ selector: prelude.replace(/\s+/g, ""), body: buffer, atRules: stack.filter((entry) => entry.startsWith("@")) });
      }
      buffer = "";
    } else {
      buffer += char;
    }
  }
  return rules;
}

const rules = styleRules(readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8"));

function rulesSetting(selector: string, property: string) {
  return rules.filter((rule) => rule.selector === selector && new RegExp(`(^|[\\s;])${property}\\s*:`).test(rule.body));
}

// Value: protects=`tracking-*` on headings, `font-mono` on inputs/textareas and `transition-*`/`duration-*` on controls apply; unlayered, these element defaults beat every layered Tailwind utility whatever its specificity (the dashboard's uppercase "Hoạt động học vụ & vận hành" label lost its wide tracking, Zalo template textareas lost their monospace);
// fails_when=one of the three element defaults moves back out of `@layer base`, or the reduced-motion kill switch moves into a layer or loses `!important` (a layered utility would then animate for reduced-motion users);
// why_new=v0.26.0.4 layered these rules; seam=none (reads globals.css as text); no_claim=does not compute styles in a browser (jsdom has no Tailwind cascade); the /dev computed-style diff in the PR covers that
describe("globals.css element defaults", () => {
  it.each([
    ["h1,h2,h3", "letter-spacing"],
    ['button,a,input,select,textarea,[role="tab"]', "transition"],
    ["button,input,select,textarea", "font-family"],
  ])("keeps `%s { %s }` inside @layer base so utilities win", (selector, property) => {
    const matches = rulesSetting(selector, property);
    expect(matches).toHaveLength(1);
    expect(matches[0].atRules).toEqual(["@layer base"]);
  });

  it("keeps the reduced-motion kill switch unlayered and important so it beats transition utilities", () => {
    const killSwitch = rulesSetting("*,*::before,*::after", "transition").filter((rule) => rule.atRules.some((entry) => /prefers-reduced-motion:\s*reduce/.test(entry)));
    expect(killSwitch).toHaveLength(1);
    expect(killSwitch[0].atRules.some((entry) => entry.startsWith("@layer"))).toBe(false);
    expect(killSwitch[0].body).toMatch(/transition:\s*none\s*!important/);
  });
});
