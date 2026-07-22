import { z } from "zod";
import { enrollmentChecklistItems } from "./mock-form-data";
import {
  getClassById,
  getStandardFee,
  normalizeVietnamPhone,
} from "./helpers";

const statusValues = [
  "interested",
  "trial_booked",
  "trial_completed",
  "pending_enrollment_confirmation",
  "active",
  "reserved",
  "resumed",
  "waiting_class",
  "completed",
] as const;

const checklistIds = enrollmentChecklistItems.map((item) => item.id);

export const studentFormSchema = z
  .object({
    accountantTransactionConfirmed: z.boolean(),
    assistantSessionsConfirmed: z.boolean(),
    bonusSessions: z
      .number()
      .int("Số buổi tặng phải là số nguyên.")
      .min(0, "Số buổi tặng không được âm."),
    classOverrideReason: z.string().trim(),
    classSelected: z.boolean(),
    communicationGroupCreatedAt: z.string().trim(),
    communicationGroupCreatedBy: z.string().trim(),
    communicationGroupLink: z.string().trim(),
    communicationGroupName: z.string().trim(),
    communicationGroupNote: z.string().trim(),
    communicationGroupReady: z.boolean(),
    communicationGroupStatus: z.enum([
      "created",
      "not_created",
      "not_required",
      "pending",
    ]),
    currentGrade: z
      .number()
      .int("Khối phải là số nguyên.")
      .min(1, "Khối phải từ 1 đến 12.")
      .max(12, "Khối phải từ 1 đến 12."),
    currentUnitPrice: z
      .number()
      .min(0, "Mức học phí theo buổi không được âm."),
    customFeeReason: z.string().trim(),
    discountPercent: z
      .number()
      .min(0, "Ưu đãi phải từ 0 đến 100%.")
      .max(100, "Ưu đãi phải từ 0 đến 100%."),
    duplicateOverrideReason: z.string().trim(),
    expectedOfficialStartDate: z.string().trim(),
    feeArea: z.enum(["hanoi_hcm", "province"]),
    feeConfirmed: z.boolean(),
    fullName: z.string().trim().min(1, "Họ và tên học viên không được để trống."),
    guardianEmail: z.string().trim(),
    guardianFullName: z
      .string()
      .trim()
      .min(1, "Họ tên phụ huynh không được để trống."),
    guardianLinkMode: z.enum(["existing", "new"]),
    guardianNote: z.string().trim(),
    guardianPhone: z.string().trim().min(1, "Số điện thoại phụ huynh là bắt buộc."),
    guardianRelationship: z
      .string()
      .trim()
      .min(1, "Quan hệ với học sinh là bắt buộc."),
    guardianZalo: z.string().trim(),
    internalNote: z.string().trim(),
    leadSourceId: z.string().trim().min(1, "Vui lòng chọn nguồn tuyển sinh."),
    learningGoal: z.string().trim(),
    learningLevel: z.enum(["A", "B", "CLC"]),
    lifecycleStatus: z.enum(statusValues),
    mainClassId: z.string().trim(),
    modeConfirmed: z.boolean(),
    nickname: z.string().trim(),
    officialStartDateEntered: z.boolean(),
    partnerName: z.string().trim(),
    paymentReceived: z.boolean(),
    profileCreatedAt: z.string().trim(),
    provinceName: z.string().trim(),
    publicCode: z.string().trim(),
    recordedAt: z.string().trim(),
    registeredMode: z.enum(["online", "offline"]),
    saleConfirmed: z.boolean(),
    saleOwnerId: z.string().trim().min(1, "Vui lòng chọn sale phụ trách."),
    sourceConfirmed: z.boolean(),
    sourceNote: z.string().trim(),
    studentId: z.string().trim(),
    birthYear: z
      .number()
      .int("Năm sinh phải là số nguyên.")
      .min(2000, "Năm sinh chưa hợp lệ.")
      .max(2026, "Năm sinh chưa hợp lệ."),
  })
  .superRefine((values, ctx) => {
    const phone = normalizeVietnamPhone(values.guardianPhone);

    if (!phone.isValid) {
      ctx.addIssue({
        code: "custom",
        message: phone.warning ?? "Số điện thoại phụ huynh chưa hợp lệ.",
        path: ["guardianPhone"],
      });
    }

    if (values.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.guardianEmail)) {
      ctx.addIssue({
        code: "custom",
        message: "Email phụ huynh chưa đúng định dạng.",
        path: ["guardianEmail"],
      });
    }

    const selectedClass = getClassById(values.mainClassId);

    if (values.classSelected && !selectedClass) {
      ctx.addIssue({
        code: "custom",
        message: "Cần chọn lớp chính trước khi xác nhận mục này.",
        path: ["classSelected"],
      });
    }

    if (
      selectedClass &&
      selectedClass.grade !== values.currentGrade &&
      !values.classOverrideReason
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Lớp đang chọn khác khối học sinh, cần nhập lý do override.",
        path: ["classOverrideReason"],
      });
    }

    const standardFee = getStandardFee(values.registeredMode, values.feeArea);

    if (values.currentUnitPrice !== standardFee && !values.customFeeReason) {
      ctx.addIssue({
        code: "custom",
        message: "Mức học phí khác chính sách chuẩn, cần ghi chú lý do.",
        path: ["customFeeReason"],
      });
    }

    if (
      values.expectedOfficialStartDate &&
      values.profileCreatedAt &&
      values.expectedOfficialStartDate < values.profileCreatedAt
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Ngày dự kiến học chính không được trước ngày tạo hồ sơ mock.",
        path: ["expectedOfficialStartDate"],
      });
    }

    if (values.officialStartDateEntered && !values.expectedOfficialStartDate) {
      ctx.addIssue({
        code: "custom",
        message: "Cần nhập ngày dự kiến học chính trước khi xác nhận mục này.",
        path: ["officialStartDateEntered"],
      });
      ctx.addIssue({
        code: "custom",
        message: "Cần nhập ngày dự kiến học chính.",
        path: ["expectedOfficialStartDate"],
      });
    }

    if (
      values.communicationGroupReady &&
      values.communicationGroupStatus === "not_created"
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Sổ liên lạc chưa tạo thì chưa thể xác nhận mục này là sẵn sàng.",
        path: ["communicationGroupReady"],
      });
    }

    if (values.lifecycleStatus === "active") {
      const missingChecklist = checklistIds.filter((id) => !values[id]);

      if (missingChecklist.length > 0) {
        ctx.addIssue({
          code: "custom",
          message:
            "Chưa thể chọn Đang học khi checklist nhập học chưa hoàn tất.",
          path: ["lifecycleStatus"],
        });

        missingChecklist.forEach((id) => {
          ctx.addIssue({
            code: "custom",
            message: "Cần hoàn tất mục này trước khi chọn Đang học.",
            path: [id],
          });
        });
      }
    }
  });

export type StudentFormValues = z.infer<typeof studentFormSchema>;
