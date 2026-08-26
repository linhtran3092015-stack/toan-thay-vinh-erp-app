import { describe, expect, it } from "vitest";
import {
  configureStaffPayrollCompensationSchema,
  createStaffGradeAssignmentSchema,
  createStaffPayrollTaskVersionSchema,
  createStaffRateVersionSchema,
  decideStaffBankAccountChangeSchema,
  submitStaffBankAccountChangeSchema,
  updateStaffProfileSchema,
} from "@/features/staff/staff-management-schemas";

describe("Staff Management Schemas", () => {
  const validUuid = "12345678-1234-4234-8234-123456789012";

  describe("updateStaffProfileSchema", () => {
    it("validates active profile without leftAt", () => {
      expect(
        updateStaffProfileSchema.safeParse({
          displayName: "Nguyễn Văn A",
          employeeCode: "EMP-01",
          employmentStatus: "active",
          joinedAt: "2026-01-01",
          leftAt: "",
          phone: "0912345678",
          reason: "Cập nhật thông tin",
          staffId: validUuid,
        }).success,
      ).toBe(true);
    });

    it("requires leftAt when inactive and rejects leftAt before joinedAt", () => {
      // Inactive without leftAt must fail
      expect(
        updateStaffProfileSchema.safeParse({
          displayName: "Nguyễn Văn A",
          employeeCode: "EMP-01",
          employmentStatus: "inactive",
          joinedAt: "2026-01-01",
          leftAt: "",
          phone: "0912345678",
          reason: "Nghỉ việc",
          staffId: validUuid,
        }).success,
      ).toBe(false);

      // Inactive with leftAt < joinedAt must fail
      expect(
        updateStaffProfileSchema.safeParse({
          displayName: "Nguyễn Văn A",
          employeeCode: "EMP-01",
          employmentStatus: "inactive",
          joinedAt: "2026-05-01",
          leftAt: "2026-01-01",
          phone: "0912345678",
          reason: "Nghỉ việc",
          staffId: validUuid,
        }).success,
      ).toBe(false);

      // Inactive with valid leftAt >= joinedAt must succeed
      expect(
        updateStaffProfileSchema.safeParse({
          displayName: "Nguyễn Văn A",
          employeeCode: "EMP-01",
          employmentStatus: "inactive",
          joinedAt: "2026-01-01",
          leftAt: "2026-05-01",
          phone: "0912345678",
          reason: "Nghỉ việc",
          staffId: validUuid,
        }).success,
      ).toBe(true);
    });
  });

  describe("configureStaffPayrollCompensationSchema & createStaffRateVersionSchema", () => {
    it("validates rate version and compensation configuration", () => {
      expect(
        createStaffRateVersionSchema.safeParse({
          effectiveFrom: "2026-07-01",
          note: "Mức lương chuẩn",
          offlineDailyRateVnd: 300000,
          reason: "Cập nhật định kỳ",
          staffId: validUuid,
        }).success,
      ).toBe(true);

      expect(
        configureStaffPayrollCompensationSchema.safeParse({
          effectiveFrom: "2026-07-01",
          note: "Trợ lý vận hành",
          offlineDailyRateVnd: 300000,
          positionCode: "operations_assistant",
          reason: "Bổ nhiệm vị trí",
          staffId: validUuid,
        }).success,
      ).toBe(true);

      expect(
        configureStaffPayrollCompensationSchema.safeParse({
          effectiveFrom: "2026-07-01",
          note: "Invalid position",
          offlineDailyRateVnd: 300000,
          positionCode: "invalid_role",
          reason: "Test",
          staffId: validUuid,
        }).success,
      ).toBe(false);
    });
  });

  describe("createStaffGradeAssignmentSchema & createStaffPayrollTaskVersionSchema", () => {
    it("validates grade assignment range", () => {
      expect(
        createStaffGradeAssignmentSchema.safeParse({
          effectiveFrom: "2026-07-01",
          effectiveTo: "2026-07-15",
          grade: 10,
          reason: "Phụ trách khối 10 kỳ 1",
          staffId: validUuid,
        }).success,
      ).toBe(true);

      // effectiveTo < effectiveFrom must fail
      expect(
        createStaffGradeAssignmentSchema.safeParse({
          effectiveFrom: "2026-07-15",
          effectiveTo: "2026-07-01",
          grade: 10,
          reason: "Lỗi ngày",
          staffId: validUuid,
        }).success,
      ).toBe(false);
    });

    it("validates staff payroll task versions", () => {
      expect(
        createStaffPayrollTaskVersionSchema.safeParse({
          effectiveFrom: "2026-07-01",
          isEnabled: true,
          reason: "Giao nhiệm vụ trực tin nhắn",
          staffId: validUuid,
          taskCode: "center_renewal_duty",
        }).success,
      ).toBe(true);
    });
  });

  describe("submitStaffBankAccountChangeSchema & decideStaffBankAccountChangeSchema", () => {
    it("validates bank account change request and decision", () => {
      expect(
        submitStaffBankAccountChangeSchema.safeParse({
          accountHolderName: "NGUYEN VAN A",
          accountNumber: "0123456789",
          bankName: "Techcombank",
          effectiveFrom: "2026-07-01",
          reason: "Thay đổi tài khoản nhận lương",
          staffId: validUuid,
        }).success,
      ).toBe(true);

      expect(
        decideStaffBankAccountChangeSchema.safeParse({
          decision: "approved",
          requestId: validUuid,
          reviewNote: "Đã xác minh chính chủ",
          staffId: validUuid,
        }).success,
      ).toBe(true);
    });
  });
});
