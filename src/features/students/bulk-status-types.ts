import { z } from "zod";

export const studentLifecycleStatusSchema = z.enum([
  "active",
  "completed",
  "interested",
  "pending_enrollment_confirmation",
  "reserved",
  "resumed",
  "trial_booked",
  "trial_completed",
  "waiting_class",
  "withdrawn",
]);

/**
 * Only pre-enrollment statuses can be changed in bulk; enrollment-bound
 * statuses (active, resumed, reserved, withdrawn, completed) go through the
 * enrollment workflow so class history stays in sync.
 */
export const bulkTransitionStatuses = [
  "interested",
  "trial_booked",
  "trial_completed",
  "pending_enrollment_confirmation",
  "waiting_class",
] as const;

export const previewBulkStudentStatusInputSchema = z.object({
  sourceStatus: studentLifecycleStatusSchema,
  studentIds: z.array(z.string().uuid()).optional(),
});

export type PreviewBulkStudentStatusInput = z.infer<
  typeof previewBulkStudentStatusInputSchema
>;

export const executeBulkStudentStatusInputSchema = z
  .object({
    expectedCount: z.number().int().min(0),
    reason: z.string().trim().max(500).optional(),
    sourceStatus: studentLifecycleStatusSchema,
    studentIds: z.array(z.string().uuid()).optional(),
    targetStatus: studentLifecycleStatusSchema,
  })
  .refine((data) => data.sourceStatus !== data.targetStatus, {
    message: "Trạng thái đích phải khác trạng thái nguồn.",
    path: ["targetStatus"],
  });

export type ExecuteBulkStudentStatusInput = z.infer<
  typeof executeBulkStudentStatusInputSchema
>;

export type BulkStudentStatusActionResult<T> =
  | { data: T; ok: true }
  | { code: string; message: string; ok: false };
