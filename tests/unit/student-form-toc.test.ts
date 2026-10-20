// Value: protects=the student form's table-of-contents model (design 17a): sections Hồ sơ · Phụ huynh chính · (Xác nhận tiếp tục lưu only while an exact duplicate is shown) · Lý do thao tác with stable ids, each status "{n} lỗi" (danger) over the required-field state in words, "đủ" (success) or "thiếu {m}" (muted), led by "{filled}/{total}" when the section also has optional fields, over "tùy chọn" (no required field); blank strings and a cleared number (NaN) are not filled; the save-bar field names follow page order and the mode ("Lý do tạo/cập nhật hồ sơ");
// fails_when=a section id or order changes (anchors and the scroll-spy break), an error stops winning over the count, a whitespace-only value counts as filled, the success tone appears with a required field still empty, "complete" is told by the tone alone (no "đủ"/"thiếu" words, DESIGN hard rule 2), the confirmation item shows without a duplicate, or labels come back in errors-object (schema) order instead of page order;
// why_new=step 15a adds the long-form TOC to /students/new and /students/[id]/edit; the status logic is pure so it is pinned here, the component test covers the wiring;
// seam=none (pure functions); no_claim=does not prove the rendered TOC, the DOM order of the controls or RHF's error timing (student-profile-form.test.tsx)
import { describe, expect, it } from "vitest";

import {
  getStudentFormFieldLabel,
  getStudentFormSectionStatus,
  getStudentFormTocItems,
  isStudentFormValueFilled,
  sortStudentFormFields,
  STUDENT_FORM_FIELD_ORDER,
  STUDENT_FORM_SECTIONS,
} from "@/features/students/form/student-form-toc";
import { getStudentProfileFormDefaults } from "@/features/students/form/student-profile-form-helpers";
import type { StudentProfileFormValues } from "@/features/students/form/student-profile-form-schema";

const none = new Set<string>();

describe("student form TOC model", () => {
  it("keeps the section ids, titles and field order of the page", () => {
    expect(STUDENT_FORM_SECTIONS.map((section) => [section.id, section.title])).toEqual([
      ["ho-so", "Hồ sơ"],
      ["phu-huynh", "Phụ huynh chính"],
      ["xac-nhan", "Xác nhận tiếp tục lưu"],
      ["ly-do", "Lý do thao tác"],
    ]);
    expect(STUDENT_FORM_FIELD_ORDER).toEqual([
      "fullName",
      "nickname",
      "birthYear",
      "currentGrade",
      "learningLevel",
      "registeredMode",
      "provinceName",
      "learningGoal",
      "internalNote",
      "guardianFullName",
      "guardianRelationship",
      "guardianPhone",
      "guardianZalo",
      "guardianEmail",
      "guardianNote",
      "duplicateOverrideReason",
      "reason",
    ]);
  });

  it("counts filled fields over all fields of the section until every required one is filled", () => {
    const defaults = getStudentProfileFormDefaults("create");
    const [hoSo, phuHuynh, , lyDo] = STUDENT_FORM_SECTIONS;

    // Create defaults prefill birth year, grade, level and mode; the name is still empty.
    expect(getStudentFormSectionStatus(hoSo, defaults, none)).toEqual({ status: "4/9 · thiếu 1", tone: "muted" });
    expect(getStudentFormSectionStatus(hoSo, { ...defaults, fullName: "Nguyễn Gia Hân" }, none)).toEqual({
      status: "5/9 · đủ",
      tone: "success",
    });
    expect(getStudentFormSectionStatus(phuHuynh, defaults, none)).toEqual({ status: "0/6 · thiếu 3", tone: "muted" });
    expect(
      getStudentFormSectionStatus(
        phuHuynh,
        { ...defaults, guardianFullName: "Đỗ Thị Lan", guardianPhone: "0987654321", guardianZalo: "0987654321" },
        none,
      ),
    ).toEqual({ status: "3/6 · thiếu 1", tone: "muted" });
    expect(
      getStudentFormSectionStatus(
        phuHuynh,
        { ...defaults, guardianFullName: "Đỗ Thị Lan", guardianPhone: "0987654321", guardianRelationship: "Mẹ" },
        none,
      ),
    ).toEqual({ status: "3/6 · đủ", tone: "success" });
    // Required fields only: the words alone ("1/1" / "0/1" would repeat them).
    expect(getStudentFormSectionStatus(lyDo, { reason: "Tư vấn" }, none)).toEqual({ status: "đủ", tone: "success" });
    expect(getStudentFormSectionStatus(lyDo, { reason: "  " }, none)).toEqual({ status: "thiếu 1", tone: "muted" });
  });

  it("says in words whether the required fields are complete; the tone only repeats it", () => {
    const defaults = getStudentProfileFormDefaults("create");
    // Every section of the page, "xac-nhan" included, as "id: status (tone)"; the words decide, the tone repeats them.
    const statuses = (values: Partial<StudentProfileFormValues>) =>
      STUDENT_FORM_SECTIONS.map((section) => {
        const { status, tone } = getStudentFormSectionStatus(section, values, none);
        return `${section.id}: ${status} (${tone})`;
      });

    expect(statuses(defaults)).toEqual([
      "ho-so: 4/9 · thiếu 1 (muted)",
      "phu-huynh: 0/6 · thiếu 3 (muted)",
      "xac-nhan: thiếu 1 (muted)",
      "ly-do: thiếu 1 (muted)",
    ]);
    expect(statuses({ ...defaults, fullName: "An" })).toEqual([
      "ho-so: 5/9 · đủ (success)",
      "phu-huynh: 0/6 · thiếu 3 (muted)",
      "xac-nhan: thiếu 1 (muted)",
      "ly-do: thiếu 1 (muted)",
    ]);
    expect(statuses({ ...defaults, guardianFullName: "Lan", guardianPhone: "0987654321" })).toEqual([
      "ho-so: 4/9 · thiếu 1 (muted)",
      "phu-huynh: 2/6 · thiếu 1 (muted)",
      "xac-nhan: thiếu 1 (muted)",
      "ly-do: thiếu 1 (muted)",
    ]);
    expect(
      statuses({ ...defaults, fullName: "An", guardianFullName: "Lan", guardianPhone: "0987654321", guardianRelationship: "Mẹ", reason: "x" }),
    ).toEqual(["ho-so: 5/9 · đủ (success)", "phu-huynh: 3/6 · đủ (success)", "xac-nhan: thiếu 1 (muted)", "ly-do: đủ (success)"]);
    expect(statuses({ ...defaults, duplicateOverrideReason: "x" })).toEqual([
      "ho-so: 4/9 · thiếu 1 (muted)",
      "phu-huynh: 0/6 · thiếu 3 (muted)",
      "xac-nhan: đủ (success)",
      "ly-do: thiếu 1 (muted)",
    ]);
  });

  it("shows the error count first, and 'tùy chọn' for a section without required fields", () => {
    const [hoSo, phuHuynh] = STUDENT_FORM_SECTIONS;
    const filled = { ...getStudentProfileFormDefaults("create"), fullName: "An", guardianPhone: "0905 123 45" };

    expect(getStudentFormSectionStatus(phuHuynh, filled, new Set(["guardianPhone"]))).toEqual({ status: "1 lỗi", tone: "danger" });
    expect(getStudentFormSectionStatus(hoSo, filled, new Set(["fullName", "birthYear", "reason"]))).toEqual({
      status: "2 lỗi",
      tone: "danger",
    });
    expect(getStudentFormSectionStatus({ fields: ["nickname", "learningGoal"], required: [] }, filled, none)).toEqual({
      status: "tùy chọn",
      tone: "muted",
    });
  });

  it("does not count blank text or a cleared number as filled", () => {
    expect(isStudentFormValueFilled("  ")).toBe(false);
    expect(isStudentFormValueFilled("")).toBe(false);
    expect(isStudentFormValueFilled(Number.NaN)).toBe(false);
    expect(isStudentFormValueFilled(undefined)).toBe(false);
    expect(isStudentFormValueFilled(0)).toBe(true);
    expect(isStudentFormValueFilled("A")).toBe(true);
  });

  it("lists the confirmation section only while an exact duplicate is shown", () => {
    const values = getStudentProfileFormDefaults("create");
    const hidden = getStudentFormTocItems({ errorFields: none, showDuplicateConfirmation: false, values });
    expect(hidden.map((item) => item.id)).toEqual(["ho-so", "phu-huynh", "ly-do"]);
    expect(hidden.map((item) => item.label)).toEqual(["Hồ sơ", "Phụ huynh chính", "Lý do thao tác"]);

    const shown = getStudentFormTocItems({
      errorFields: new Set(["duplicateOverrideReason"]),
      showDuplicateConfirmation: true,
      values,
    });
    expect(shown.map((item) => item.id)).toEqual(["ho-so", "phu-huynh", "xac-nhan", "ly-do"]);
    expect(shown[2]).toEqual({ id: "xac-nhan", label: "Xác nhận tiếp tục lưu", status: "1 lỗi", tone: "danger" });
    expect(shown[3]).toEqual({ id: "ly-do", label: "Lý do thao tác", status: "thiếu 1", tone: "muted" });
  });

  it("names fields for the save bar in page order and by mode", () => {
    // Object.keys(errors) follows the schema (alphabetical): birthYear before fullName, guardianEmail before guardianPhone.
    expect(sortStudentFormFields(["reason", "guardianPhone", "birthYear", "guardianEmail", "fullName", "root", "studentId"])).toEqual([
      "fullName",
      "birthYear",
      "guardianPhone",
      "guardianEmail",
      "reason",
      "studentId",
    ]);
    expect(getStudentFormFieldLabel("guardianPhone", "create")).toBe("Số điện thoại phụ huynh");
    expect(getStudentFormFieldLabel("guardianRelationship", "edit")).toBe("Quan hệ với học viên");
    expect(getStudentFormFieldLabel("reason", "create")).toBe("Lý do tạo hồ sơ");
    expect(getStudentFormFieldLabel("reason", "edit")).toBe("Lý do cập nhật hồ sơ");
  });
});
