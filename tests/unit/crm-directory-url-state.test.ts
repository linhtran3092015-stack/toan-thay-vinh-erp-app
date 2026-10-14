import { describe, expect, it } from "vitest";

import {
  getCrmDirectoryGrade,
  getCrmDirectoryHref,
  getCrmDirectoryQuery,
  getCrmOwnedSearchParamValues,
  resetCrmDirectoryFilters,
  sanitizeCrmSearchTerm,
  serializeCrmDirectoryFilterChange,
} from "@/features/crm/crm-directory-url-state";

describe("CRM directory URL state", () => {
  it("keeps only safe CRM-owned filters for a detail return", () => {
    const sale = "5a1e0000-0000-4000-8000-000000000001";
    const query = getCrmDirectoryQuery(new URLSearchParams(`search=An&status=trial_booked&source=mma_zalo&sale=${sale}&grade=5&theme=dark&unsafe=javascript%3Aalert(1)`));
    expect(query).toBe(`search=An&status=trial_booked&grade=5&source=mma_zalo&sale=${sale}`);
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

  // Value (fix pass 3, H1/H2): protects=one rule per param shared by the loaders and the query string: `sale` must be a profile id (as the loaders require), `grade` a whole grade 1–12, and a search over 160 characters is cut to 160 in both the loader values and the return query instead of filtering the list but vanishing from detail links;
  // fails_when=the query string keeps a non-id sale or a fractional grade the loaders ignore, or a long search is dropped from the query while the loaders still filter by it;
  // why_new=H1/H2; seam=none; no_claim=none beyond protects
  it("applies the loaders' sale, grade and search rules to the query string", () => {
    expect(getCrmDirectoryQuery(new URLSearchParams("sale=sale-1&grade=1.5"))).toBe("");
    for (const grade of ["abc", "1.5", "13", "0", "05"]) expect(getCrmDirectoryGrade(grade)).toBeNull();
    expect(getCrmDirectoryGrade("12")).toBe(12);

    const long = "a".repeat(200);
    const values = getCrmOwnedSearchParamValues({ search: long });
    expect(values.search).toBe("a".repeat(160));
    expect(getCrmDirectoryQuery(new URLSearchParams({ search: long }))).toBe(`search=${"a".repeat(160)}`);
  });

  // Value: protects=a search that sanitises to nothing for the PostgREST `.or()` list (e.g. `?search=()`) filters nothing in the loader and is dropped from the directory query, so the list does not read as filtered; a search with real text keeps its raw value;
  // fails_when=getCrmDirectoryQuery checks only trim() (a punctuation-only search survives and the empty state says "Không có lead phù hợp"), or the sanitiser drifts from the one the loader uses;
  // why_new=step 10 fix pass 4 (P4); seam=none; no_claim=does not run the loader (data.ts imports this same sanitiser)
  it("drops a search that is empty after sanitising and keeps one with text", () => {
    expect(sanitizeCrmSearchTerm(" Nguyễn (Hân),  \"0905\" ")).toBe("Nguyễn Hân 0905");
    expect(sanitizeCrmSearchTerm("(),\"\\")).toBe("");
    expect(getCrmDirectoryQuery(new URLSearchParams("search=()&status=interested"))).toBe("status=interested");
    expect(getCrmDirectoryQuery(new URLSearchParams("search=%2C%20%22"))).toBe("");
    expect(getCrmDirectoryQuery(new URLSearchParams({ search: "Nguyễn (Hân)" }))).toBe(new URLSearchParams({ search: "Nguyễn (Hân)" }).toString());
  });
});
