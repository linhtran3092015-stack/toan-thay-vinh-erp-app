import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Next's build can pass while the POST action loader rejects a value export
// at runtime (E352). Check the real action modules, without mocking exports.
describe("timekeeping server action boundary", () => {
  const root = resolve(process.cwd(), "src/features/timekeeping");
  for (const filename of readdirSync(root).filter((name) => name.endsWith("-actions.ts"))) {
    it(`${filename} exports only async functions at runtime`, () => {
      const source = ts.createSourceFile(filename, readFileSync(resolve(root, filename), "utf8"), ts.ScriptTarget.Latest, true);
      for (const statement of source.statements) {
        if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
        const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
        if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
        expect(ts.isFunctionDeclaration(statement), statement.getText(source)).toBe(true);
        expect(modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)).toBe(true);
      }
    });
  }
});
