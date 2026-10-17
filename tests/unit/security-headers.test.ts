// Value: protects=the CSP lets the account menu load Google sign-in avatars (lh3.googleusercontent.com) as images
// while that host gets no script, style, connect or frame access, and the other security headers stay on every route;
// fails_when=the avatar host drops out of img-src (the browser blocks the <img> and logs a CSP error), leaks into
// another directive, or a header disappears;
// seam=imports next.config.ts and calls its headers(); no_claim=does not prove the browser enforces the policy
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

async function getHeaders(): Promise<Map<string, string>> {
  const routes = await nextConfig.headers!();
  expect(routes).toHaveLength(1);
  expect(routes[0].source).toBe("/(.*)");
  return new Map(routes[0].headers.map((header) => [header.key, header.value]));
}

function getDirectives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

describe("security headers", () => {
  it("allows Google profile avatars for images only", async () => {
    const directives = getDirectives((await getHeaders()).get("Content-Security-Policy") ?? "");

    expect(directives.get("img-src")).toEqual(
      expect.arrayContaining(["'self'", "data:", "blob:", "https://vietqr.app", "https://lh3.googleusercontent.com"]),
    );
    for (const [name, sources] of directives) {
      if (name === "img-src") continue;
      expect(sources.join(" "), name).not.toContain("googleusercontent.com");
    }
    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
    expect(directives.get("object-src")).toEqual(["'none'"]);
  });

  it("keeps the other security headers on every route", async () => {
    const headers = await getHeaders();

    expect(headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });
});
