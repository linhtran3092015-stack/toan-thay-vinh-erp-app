import { describe, expect, it } from "vitest";

import {
  getCrmDirectoryHref,
  getCrmDirectoryQuery,
  resetCrmDirectoryFilters,
  serializeCrmDirectoryFilterChange,
} from "@/features/crm/crm-directory-url-state";

describe("CRM directory URL state", () => {
  it("keeps only safe CRM-owned filters for a detail return", () => {
    const query = getCrmDirectoryQuery(new URLSearchParams("search=An&status=trial_booked&source=mma_zalo&sale=sale-1&grade=5&theme=dark&unsafe=javascript%3Aalert(1)"));
    expect(query).toBe("search=An&status=trial_booked&grade=5&source=mma_zalo&sale=sale-1");
    expect(getCrmDirectoryHref(new URLSearchParams(query))).toBe(`/crm?${query}`);
  });

  it("preserves unrelated query state while composing rapid filter updates", () => {
    const first = serializeCrmDirectoryFilterChange(new URLSearchParams("theme=dark"), "status", "interested");
    const second = serializeCrmDirectoryFilterChange(first, "source", "mma_fanpage");
    expect(second.toString()).toBe("theme=dark&status=interested&source=mma_fanpage");
  });

  it("removes only CRM-owned keys when filters reset", () => {
    expect(resetCrmDirectoryFilters(new URLSearchParams("search=An&source=mma_zalo&theme=dark")).toString()).toBe("theme=dark");
  });

  it("does not carry invalid CRM values into the safe return query", () => {
    expect(getCrmDirectoryQuery(new URLSearchParams("status=unknown&grade=99&search=&source=&sale="))).toBe("");
  });
});
