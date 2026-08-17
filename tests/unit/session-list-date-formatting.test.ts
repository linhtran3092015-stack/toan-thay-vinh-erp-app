import { describe, expect, it } from "vitest";

import { formatDate } from "@/features/sessions/session-list-page";

describe("Session list date formatting determinism", () => {
  it("formats ISO calendar date strings deterministically for Vietnamese display", () => {
    expect(formatDate("2026-08-10")).toBe("Thứ 2, 10/08/2026");
    expect(formatDate("2026-08-09")).toBe("CN, 09/08/2026");
    expect(formatDate("2026-08-15")).toBe("Thứ 7, 15/08/2026");
  });

  it("produces identical output regardless of environment ICU locale differences", () => {
    const formatted = formatDate("2026-08-17");
    expect(formatted).toBe("Thứ 2, 17/08/2026");
  });
});
