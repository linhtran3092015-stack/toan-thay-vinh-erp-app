import { describe, expect, it } from "vitest";

import {
  executeBulkStudentStatusInputSchema,
  previewBulkStudentStatusInputSchema,
} from "@/features/students/bulk-status-types";

describe("Bulk Student Status Transition Schemas & Validation", () => {
  describe("previewBulkStudentStatusInputSchema", () => {
    it("accepts valid source status without studentIds", () => {
      const result = previewBulkStudentStatusInputSchema.safeParse({
        sourceStatus: "interested",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sourceStatus).toBe("interested");
      }
    });

    it("accepts valid source status with studentIds array", () => {
      const result = previewBulkStudentStatusInputSchema.safeParse({
        sourceStatus: "interested",
        studentIds: [
          "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid source status string", () => {
      const result = previewBulkStudentStatusInputSchema.safeParse({
        sourceStatus: "non_existent_status",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("executeBulkStudentStatusInputSchema", () => {
    it("accepts valid execute input with differing source and target status", () => {
      const result = executeBulkStudentStatusInputSchema.safeParse({
        expectedCount: 15,
        reason: "Chuyển học sinh sau học thử",
        sourceStatus: "interested",
        targetStatus: "active",
      });
      expect(result.success).toBe(true);
    });

    it("rejects execute input when targetStatus equals sourceStatus", () => {
      const result = executeBulkStudentStatusInputSchema.safeParse({
        expectedCount: 10,
        sourceStatus: "active",
        targetStatus: "active",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          "Trạng thái đích phải khác trạng thái nguồn",
        );
      }
    });

    it("rejects negative expectedCount", () => {
      const result = executeBulkStudentStatusInputSchema.safeParse({
        expectedCount: -1,
        sourceStatus: "interested",
        targetStatus: "active",
      });
      expect(result.success).toBe(false);
    });
  });
});
