"use server";
import { revalidatePath } from "next/cache";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { websiteSchema } from "./schema";
import { websiteRpc } from "./data";

export async function saveWebsite(input: unknown, version: number, operation: "save" | "publish" | "unpublish") {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.manage")) return { ok: false as const, message: "Không có quyền quản lý cài đặt." };
  if (!Number.isInteger(version) || version < 0 || !["save", "publish", "unpublish"].includes(operation)) return { ok: false as const, message: "Yêu cầu không hợp lệ." };
  const parsed = websiteSchema.safeParse(input);
  if (operation === "save" && !parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Kiểm tra nội dung." };
  try {
    // Publication always snapshots the saved draft. Never publishes unsaved browser edits.
    const { data, error } = await websiteRpc("write_website_configuration", { p_draft: operation === "save" && parsed.success ? parsed.data : null, p_version: version, p_operation: operation });
    if (error || typeof data !== "number") return { ok: false as const, message: error?.message.includes("WEBSITE_CONFLICT") ? "Nội dung đã được thay đổi ở nơi khác. Tải lại trang trước khi lưu tiếp." : "Không lưu được cài đặt. Nội dung của anh vẫn được giữ trên màn hình." };
    revalidatePath("/settings/branding"); revalidatePath("/settings/website"); revalidatePath("/site", "layout"); revalidatePath("/", "layout");
    return { ok: true as const, version: data, message: operation === "save" ? "Đã lưu bản nháp." : operation === "publish" ? "Đã đăng phiên bản đã lưu." : "Đã ngừng công khai website." };
  } catch { return { ok: false as const, message: "Không thể kết nối. Hãy thử lại; nội dung chưa bị mất." }; }
}
