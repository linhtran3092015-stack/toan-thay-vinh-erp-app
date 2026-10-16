// Value: protects=the pure rules behind the Mẫu Phiếu học phí page (design 15b): publisher wording (display name, "Hệ thống" for the seeded v1, "người khác (không xem được tên)" when RLS hides the profile), the usage line (locked periods by name on the current version only, at most 3 named + "và n kỳ khác", drafts without a pinned version counted as taking the latest), Vietnam-time publish stamps, the next version number, stored-key ↔ form-value mapping, and the order of the publish button's disabled reasons;
// fails_when=a hidden publisher reads as "Hệ thống" (or the reverse), periods on older versions or pinned drafts are counted, a fourth period is named, timestamps render in UTC, a non-text content key leaks into a field, whitespace-only edits count as a change, or "Nhập lý do" shows before a blank required field;
// why_new=receipt-template-models.ts is new (step 13);
// seam=none; no_claim=does not prove the PostgREST embed returns these shapes (the route test feeds them through the loader)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  formatTemplatePublishedAt,
  formatTemplatePublishedOn,
  formatTemplateUsage,
  getNextTemplateVersion,
  getTemplatePublishBlockedReason,
  getTemplatePublisherName,
  normalizeTemplateFormValues,
  readTemplateFormValues,
  summarizeTemplateUsage,
  toTemplateContent,
  toTuitionTemplateVersions,
  TUITION_NOTICE_TEMPLATE_CODE,
  type TuitionTemplatePeriodRow,
} from "@/features/tuition/receipt-template-models";

const values = { announcement: "Kính gửi quý phụ huynh.", centerDisplayName: "Trung tâm Toán Thầy Vinh", footer: "Liên hệ 0988 123 456", title: "PHIẾU HỌC PHÍ" };

describe("template publisher", () => {
  it("names the publisher, the system for the seeded version, and says when the name is hidden", () => {
    expect(getTemplatePublisherName({ published_by: "u1", publisher: { display_name: "Nguyễn Thu Hằng" } })).toBe("Nguyễn Thu Hằng");
    expect(getTemplatePublisherName({ published_by: "u1", publisher: [{ display_name: "Nguyễn Thu Hằng" }] })).toBe("Nguyễn Thu Hằng");
    expect(getTemplatePublisherName({ published_by: null, publisher: null })).toBe("Hệ thống");
    expect(getTemplatePublisherName({ published_by: "u2", publisher: null })).toBe("người khác (không xem được tên)");
    expect(getTemplatePublisherName({ published_by: "u2", publisher: { display_name: "  " } })).toBe("người khác (không xem được tên)");
  });

  it("maps rows to view models in read order with form values from the stored keys", () => {
    const [latest, seed] = toTuitionTemplateVersions([
      {
        content: { announcement: "A", center_display_name: "C", footer: "F", show_qr: true, title: "T" },
        id: "v2",
        published_at: "2026-09-25T03:12:00Z",
        published_by: "u1",
        publisher: { display_name: "Hằng" },
        reason: "Đổi chân trang",
        version_number: 2,
      },
      { content: { title: 5, footer: null }, id: "v1", published_at: "2026-07-30T01:00:00Z", published_by: null, publisher: null, reason: "Khởi tạo", version_number: 1 },
    ]);
    expect(latest).toEqual({
      content: { announcement: "A", centerDisplayName: "C", footer: "F", title: "T" },
      id: "v2",
      publishedAt: "2026-09-25T03:12:00Z",
      publisherName: "Hằng",
      reason: "Đổi chân trang",
      version: 2,
    });
    expect(seed.content).toEqual({ announcement: "", centerDisplayName: "", footer: "", title: "" });
    expect(seed.publisherName).toBe("Hệ thống");
    expect(readTemplateFormValues(null)).toEqual({ announcement: "", centerDisplayName: "", footer: "", title: "" });
    expect(readTemplateFormValues(["x"])).toEqual({ announcement: "", centerDisplayName: "", footer: "", title: "" });
    expect(toTemplateContent(values)).toEqual({
      announcement: values.announcement,
      center_display_name: values.centerDisplayName,
      footer: values.footer,
      title: values.title,
    });
  });

  it("numbers the next version after the highest one, v1 when none exists", () => {
    expect(getNextTemplateVersion([{ version: 3 }, { version: 2 }, { version: 1 }])).toBe(4);
    expect(getNextTemplateVersion([{ version: 1 }, { version: 5 }])).toBe(6);
    expect(getNextTemplateVersion([])).toBe(1);
  });

  it("stamps publishes in Vietnam time", () => {
    expect(formatTemplatePublishedAt("2026-09-25T03:12:00Z")).toBe("25/09/2026 10:12");
    expect(formatTemplatePublishedAt("2026-09-24T18:30:00Z")).toBe("25/09/2026 01:30");
    expect(formatTemplatePublishedOn("2026-09-24T18:30:00Z")).toBe("25/09/2026");
    expect(formatTemplatePublishedAt("not a date")).toBe("not a date");
  });
});

describe("template usage", () => {
  const period = (id: string, status: string, versionId: string | null): TuitionTemplatePeriodRow => ({
    id,
    name: `Kỳ ${id}`,
    receipt_template_version_id: versionId,
    status,
  });

  it("counts locked periods on the current version by name and drafts that will take the latest", () => {
    const usage = summarizeTemplateUsage(
      [
        period("11", "draft", null),
        period("12", "draft", "v2"), // pinned to a version: not "the latest"
        period("10", "locked", "v3"),
        period("09", "locked", "v2"),
      ],
      "v3",
    );
    expect(usage).toEqual({ draftCount: 1, lockedPeriodNames: ["Kỳ 10"] });
    expect(formatTemplateUsage(usage, 3)).toBe("Kỳ đã khóa dùng v3: Kỳ 10 · 1 kỳ nháp sẽ dùng phiên bản mới nhất khi khóa");
  });

  it("names at most three locked periods", () => {
    const usage = summarizeTemplateUsage(["10", "09", "08", "07", "06"].map((id) => period(id, "locked", "v3")), "v3");
    expect(formatTemplateUsage(usage, 3)).toBe("Kỳ đã khóa dùng v3: Kỳ 10, Kỳ 09, Kỳ 08 và 2 kỳ khác");
  });

  it("says when no period uses the version and names nothing without a current version", () => {
    expect(formatTemplateUsage(summarizeTemplateUsage([period("09", "locked", "v2")], "v3"), 3)).toBe("Chưa có kỳ thu nào dùng v3.");
    expect(summarizeTemplateUsage([period("09", "locked", null), period("11", "draft", null)], null)).toEqual({ draftCount: 1, lockedPeriodNames: [] });
  });
});

describe("publish blocked reason", () => {
  const current = { content: values, version: 3 };

  it("blocks an unchanged template first, ignoring whitespace at the ends", () => {
    expect(getTemplatePublishBlockedReason(values, "", current)).toBe("Chưa có thay đổi so với v3.");
    expect(getTemplatePublishBlockedReason({ ...values, footer: ` ${values.footer}  ` }, "Lý do", current)).toBe("Chưa có thay đổi so với v3.");
  });

  it("then asks for the required fields, then the reason", () => {
    expect(getTemplatePublishBlockedReason({ ...values, footer: "  " }, "", current)).toBe("Điền tiêu đề, tên trung tâm và chân trang.");
    expect(getTemplatePublishBlockedReason({ ...values, title: "" }, "Lý do", current)).toBe("Điền tiêu đề, tên trung tâm và chân trang.");
    expect(getTemplatePublishBlockedReason({ ...values, footer: "Liên hệ cô Hằng" }, "   ", current)).toBe("Nhập lý do xuất bản.");
    expect(getTemplatePublishBlockedReason({ ...values, footer: "Liên hệ cô Hằng" }, "Đổi số", current)).toBeNull();
  });

  it("allows the announcement to stay blank and treats everything as new without a current version", () => {
    expect(getTemplatePublishBlockedReason({ ...values, announcement: "" }, "Khởi tạo", null)).toBeNull();
    expect(getTemplatePublishBlockedReason({ announcement: "", centerDisplayName: "", footer: "", title: "" }, "", null)).toBe(
      "Điền tiêu đề, tên trung tâm và chân trang.",
    );
  });

  it("normalizes only the ends, keeping line breaks inside", () => {
    expect(normalizeTemplateFormValues({ ...values, announcement: "  Dòng 1\nDòng 2 \n" }).announcement).toBe("Dòng 1\nDòng 2");
  });
});

// Value: protects=the template code shown in the page header is the code the publish action really stores: TUITION_NOTICE_TEMPLATE_CODE equals the literal `publishTuitionTemplateAction` sends as `p_code` (the "use server" actions module cannot export the constant, so the two are tied by reading the source);
// fails_when=the action's `p_code` literal or the header constant is renamed on its own, so the page names a template the publish RPC never writes;
// why_new=receipt-template-models.ts duplicates the action's literal by design (a "use server" file may only export async functions);
// seam=none, reads src/features/tuition/actions.ts as text; no_claim=does not prove the RPC accepts the code or that the action publishes at all (the component test injects the action)
describe("template code", () => {
  it("is the code the publish action sends to the RPC", () => {
    const actions = readFileSync(join(process.cwd(), "src/features/tuition/actions.ts"), "utf8");
    expect(TUITION_NOTICE_TEMPLATE_CODE).toBe("TUITION_NOTICE_DEFAULT");
    expect(actions).toMatch(/p_code:\s*"TUITION_NOTICE_DEFAULT"/);
  });
});
