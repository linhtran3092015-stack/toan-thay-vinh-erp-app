import { z } from "zod";

export const palettePresets = { terracotta: "#B83C30", navy: "#24348B", mint: "#16794C", ocean: "#215FC7", plum: "#795096" } as const;
export type Palette = keyof typeof palettePresets;
const webUrl = z.string().trim().max(2000).refine((value) => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}, "Sử dụng địa chỉ https:// hợp lệ.");
export const imageSource = z.string().max(360000).refine((value) => !value || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value), "Chọn ảnh PNG, JPEG hoặc WebP tối đa 250 KB.");
export const brandingSchema = z.object({
  description: z.string().trim().max(1000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Mã màu gồm # và 6 ký tự hex."),
  logo: imageSource,
  favicon: imageSource,
  appPalette: z.enum(["terracotta", "navy", "mint", "ocean", "plum"]),
  rounded: z.boolean(),
}).strict();
export const blockSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(["hero", "text", "image", "contact"]),
  title: z.string().trim().max(160),
  body: z.string().trim().max(4000),
  image: imageSource,
  linkLabel: z.string().trim().max(60),
  linkUrl: webUrl,
}).strict();
export const pageSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(1, "Nhập tên trang.").max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Địa chỉ dùng chữ thường không dấu, số và dấu gạch nối.").max(80),
  inMenu: z.boolean(),
  blocks: z.array(blockSchema).min(1).max(20),
}).strict();
export const websiteSchema = z.object({
  branding: brandingSchema,
  title: z.string().trim().min(1).max(160),
  contactEmail: z.union([z.literal(""), z.email()]),
  contactPhone: z.string().trim().max(80),
  address: z.string().trim().max(500),
  font: z.enum(["modern", "classic"]),
  motion: z.enum(["none", "gentle"]),
  links: z.array(z.object({ label: z.string().trim().min(1).max(60), url: webUrl.refine(Boolean, "Nhập địa chỉ liên kết."), placement: z.enum(["header", "footer", "both"]) }).strict()).max(10),
  pages: z.array(pageSchema).min(1).max(12),
}).strict().superRefine((site, ctx) => {
  if (new Set(site.pages.map(p => p.slug)).size !== site.pages.length) ctx.addIssue({ code: "custom", message: "Địa chỉ các trang không được trùng nhau.", path: ["pages"] });
  if (new Set(site.pages.map(p => p.id)).size !== site.pages.length) ctx.addIssue({ code: "custom", message: "Mã trang bị trùng.", path: ["pages"] });
  for (const page of site.pages) {
    if (new Set(page.blocks.map(b => b.id)).size !== page.blocks.length) ctx.addIssue({ code: "custom", message: "Mã khối nội dung bị trùng.", path: ["pages"] });
  }
  if (JSON.stringify(site).length > 900000) ctx.addIssue({ code: "custom", message: "Nội dung và ảnh vượt quá dung lượng 900 KB. Hãy giảm kích thước ảnh." });
});
export type Website = z.infer<typeof websiteSchema>;
export type Branding = z.infer<typeof brandingSchema>;
export type SitePage = z.infer<typeof pageSchema>;
export type SiteBlock = z.infer<typeof blockSchema>;
export const defaultBranding: Branding = { description: "", color: "#B83C30", logo: "", favicon: "", appPalette: "terracotta", rounded: true };
export function createPage(id = "home", slug = "trang-chu"): SitePage {
  return { id, slug, title: "Trang chủ", inMenu: true, blocks: [{ id: `${id}-hero`, type: "hero", title: "Cùng con học Toán vững vàng", body: "Giới thiệu phương pháp giảng dạy và thông tin trung tâm của bạn.", image: "", linkLabel: "", linkUrl: "" }] };
}
export function createDefaultWebsite(title = "Trung tâm Toán Thầy Vinh"): Website {
  return { branding: { ...defaultBranding }, title, contactEmail: "", contactPhone: "", address: "", font: "modern", motion: "none", links: [], pages: [createPage()] };
}
/** Choose a foreground meeting contrast for arbitrary brand colors. */
export function brandForeground(hex: string): "#FFFFFF" | "#000000" {
  const values = hex.slice(1).match(/../g)?.map(v => parseInt(v, 16) / 255) ?? [0, 0, 0];
  const linear = values.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  return luminance > .179 ? "#000000" : "#FFFFFF";
}
