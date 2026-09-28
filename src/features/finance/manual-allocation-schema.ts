import { z } from "zod";

export const manualAllocationSchema = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().trim().min(3, "Nhập lý do đối soát ít nhất 3 ký tự.").max(1000),
  allocations: z.array(z.object({
    studentId: z.string().uuid(),
    paymentRequestId: z.string().uuid().nullable(),
    amountVnd: z.number().int().min(1).max(1_000_000_000_000),
    sessions: z.number().int().min(1).max(100_000),
    bonusSessions: z.number().int().min(0).max(100_000),
  })).min(1).max(50).superRefine((rows, ctx) => {
    if (new Set(rows.map((r) => r.studentId)).size !== rows.length) {
      ctx.addIssue({ code: "custom", message: "Mỗi học sinh chỉ xuất hiện một lần trong giao dịch." });
    }
    if (rows.some((r) => r.amountVnd < r.sessions)) {
      ctx.addIssue({ code: "custom", message: "Số tiền không đủ để quy đổi đơn giá mỗi buổi." });
    }
  }),
});
export type ManualAllocationInput = z.infer<typeof manualAllocationSchema>;
export const allocationRequestSchema = z.object({
  id: z.string().uuid(), code: z.string(), amountVnd: z.number(), sessions: z.number(),
  bonusSessions: z.number(), topupType: z.enum(["new", "renewal"]), status: z.enum(["pending", "partially_paid"]),
});
export interface AllocationStudent {
  id: string; name: string; publicCode: string; birthYear: number;
  guardianName: string; guardianPhone: string;
  requests: z.infer<typeof allocationRequestSchema>[];
}
export interface AllocationDetail {
  student_name: string; student_code: string; allocated_amount_vnd: number; allocated_sessions: number;
  bonus_sessions: number; unit_price_vnd: number; notes: string | null; allocated_at: string;
  allocated_by_name: string | null; payment_request_code: string | null;
}
