import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Session detail roster source", () => {
  const detailDataSource = readFileSync(
    resolve(process.cwd(), "src/features/sessions/detail-data.ts"),
    "utf8",
  );

  it("loads the roster from the canonical session resolver", () => {
    expect(detailDataSource).toContain('rpc("resolve_class_session_roster"');
    expect(detailDataSource).toContain("p_class_session_id: sessionId");
  });

  it("does not restore the incorrect direct enrollment-class session join", () => {
    expect(detailDataSource).not.toMatch(
      /from\("student_enrollments"\)[\s\S]{0,300}\.eq\("class_id",\s*session\.class_id\)/,
    );
  });

  it("keeps the real enrollment identity and official enrollment class in the read model", () => {
    expect(detailDataSource).toContain("student_enrollment_id");
    expect(detailDataSource).toContain("enrollment_class_id");
    expect(detailDataSource).toContain("enrollmentClassId:");
  });
});
