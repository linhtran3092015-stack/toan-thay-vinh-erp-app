import { beforeEach, describe, expect, it, vi } from "vitest";
import { brandForeground, createDefaultWebsite, websiteSchema } from "@/features/website/schema";
const mocks = vi.hoisted(() => ({ permissions: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/permissions/database-permissions", () => ({ getCachedDatabasePermissions: mocks.permissions }));
vi.mock("@/features/website/data", () => ({ websiteRpc: mocks.rpc }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveWebsite } from "@/features/website/actions";

describe("public website content boundaries", () => {
  it("accepts defaults but rejects internal data, unsafe links and duplicate routes", () => {
    const site = createDefaultWebsite();
    expect(websiteSchema.safeParse(site).success).toBe(true);
    expect(websiteSchema.safeParse({ ...site, students: [] }).success).toBe(false);
    for (const url of ["javascript:alert(1)", "http://example.com", "https://user:pass@example.com"]) {
      expect(websiteSchema.safeParse({ ...site, links: [{ label: "Link", url, placement: "both" }] }).success).toBe(false);
    }
    expect(websiteSchema.safeParse({ ...site, pages: [site.pages[0], { ...site.pages[0], id: "second" }] }).success).toBe(false);
    site.pages[0].blocks.push({ ...site.pages[0].blocks[0] });
    expect(websiteSchema.safeParse(site).success).toBe(false);
  });
  it("rejects SVG and external image sources", () => {
    const site = createDefaultWebsite();
    for (const logo of ["data:image/svg+xml;base64,abcd", "https://example.com/track.png"]) {
      expect(websiteSchema.safeParse({ ...site, branding: { ...site.branding, logo } }).success).toBe(false);
    }
  });
  it("chooses legible foregrounds", () => {
    expect(brandForeground("#FFFFFF")).toBe("#000000");
    expect(brandForeground("#B83C30")).toBe("#FFFFFF");
    expect(brandForeground("#000000")).toBe("#FFFFFF");
  });
});
describe("website settings actions", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.permissions.mockResolvedValue({ ok: true, permissions: ["settings.manage"] }); mocks.rpc.mockResolvedValue({ data: 3, error: null }); });
  it("denies a viewer without calling the write RPC", async () => {
    mocks.permissions.mockResolvedValue({ ok: true, permissions: ["settings.view"] });
    expect((await saveWebsite(createDefaultWebsite(), 2, "save")).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("publishes only the stored draft, with an optimistic version", async () => {
    expect((await saveWebsite(createDefaultWebsite(), 2, "publish")).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("write_website_configuration", { p_draft: null, p_version: 2, p_operation: "publish" });
  });
  it("rejects invalid content before writes", async () => {
    expect((await saveWebsite({}, 2, "save")).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports conflicts without revalidation", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "WEBSITE_CONFLICT" } });
    const result = await saveWebsite(createDefaultWebsite(), 2, "save");
    expect(result.ok).toBe(false); expect(result.message).toContain("Tải lại");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
