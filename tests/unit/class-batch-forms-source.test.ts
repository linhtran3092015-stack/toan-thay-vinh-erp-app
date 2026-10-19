// Value: protects=the step 15a lane K files (class form, batch workspace and grid, their models, overrides and copy modules, the two loading files, the batch route, the /dev previews and fixtures) stay on the design tokens and the shared focus outline: no outline-none, no focus ring utilities, no legacy alias tokens, no raw hex colours, no import of the legacy student form-controls, and no nested <main>;
// fails_when=a rewritten file brings back a legacy token (text-ink, border-hairline, bg-surface-1/2, bg-canvas, shadow-card, font-display, bg-white, text-primary, bg-primary), a ring-based focus style, a raw colour, a <main>, or the shared form-controls import;
// why_new=step 15a rewrites these files (the class form had 10 legacy-token hits, the batch workspace 6);
// seam=source text of an explicit file list (never a folder walk); no_claim=rendered colours or contrast
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const files = [
  "src/features/classes/management/class-form-page.tsx",
  "src/features/classes/management/class-form-action-overrides.ts",
  "src/features/classes/management/class-form-route-copy.ts",
  "src/features/sessions/components/batch-session-create-workspace.tsx",
  "src/features/sessions/components/batch-preview-grid.tsx",
  "src/features/sessions/batch-preview-models.ts",
  "src/features/sessions/session-batch-action-overrides.ts",
  "src/features/sessions/session-batch-route-copy.ts",
  "src/app/(app)/classes/new/loading.tsx",
  "src/app/(app)/sessions/batch/loading.tsx",
  "src/app/(app)/sessions/batch/page.tsx",
  "src/app/dev/forms/class-form-preview.tsx",
  "src/app/dev/forms/batch-preview.tsx",
  "src/app/dev/forms/class-batch-fixtures.ts",
];

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("lane K sources (class form, batch sessions)", () => {
  it.each(files)("%s uses the shared focus outline, never outline-none or a focus ring", (file) => {
    expect(read(file)).not.toMatch(/outline-none|focus:ring|focus-visible:ring|focus-within:ring/);
  });

  it.each(files)("%s uses no legacy alias token and no raw colour", (file) => {
    expect(read(file)).not.toMatch(
      /\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-white|text-primary|bg-primary)\b|#[0-9a-fA-F]{3,8}\b/,
    );
  });

  it.each(files)("%s renders no <main> and does not import the legacy student form-controls", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/<main[\s>]/);
    expect(source).not.toMatch(/students\/form\/components\/form-controls/);
  });
});
