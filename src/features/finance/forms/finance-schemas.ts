import { z } from "zod";

export const createPaymentRequestSchema = z.object({
  bonusSessions: z.coerce.number().min(0, "Số buổi thưởng từ 0 trở lên.").default(0),
  calculatedUnitPriceVnd: z.coerce.number().min(0, "Đơn giá không được âm.").default(0),
  expectedAmountVnd: z.coerce
    .number()
    .min(10000, "Số tiền nạp tối thiểu là 10.000đ."),
  notes: z.string().optional().nullable(),
  purchasedSessions: z.coerce
    .number()
    .min(1, "Số buổi mua phải từ 1 buổi trở lên."),
  studentId: z.string().uuid("Vui lòng chọn học viên cần nạp tiền."),
  topupType: z.enum(["new", "renewal"]).default("new"),
});

export const allocatePaymentSchema = z.object({
  allocations: z
    .array(
      z.object({
        allocatedAmountVnd: z.coerce.number().min(10000, "Số tiền phân bổ tối thiểu 10.000đ."),
        allocatedSessions: z.coerce.number().min(1, "Số buổi phân bổ từ 1 trở lên."),
        bonusSessions: z.coerce.number().min(0).default(0),
        notes: z.string().optional().nullable(),
        studentId: z.string().uuid("Mã học viên không hợp lệ."),
        unitPriceVnd: z.coerce.number().min(0).default(0),
      }),
    )
    .min(1, "Cần phân bổ cho ít nhất 1 học viên."),
  guardianId: z.string().uuid("Vui lòng chọn phụ huynh."),
  sepayTransactionId: z.string().uuid("Giao dịch SePay không hợp lệ."),
});

export const processRefundSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Lý do hoàn phí tối thiểu 3 ký tự.")
    .max(500, "Lý do không quá 500 ký tự."),
  refundAmountVnd: z.coerce
    .number()
    .min(10000, "Số tiền hoàn phí tối thiểu 10.000đ."),
  refundSessions: z.coerce
    .number()
    .min(1, "Số buổi hoàn phí từ 1 buổi trở lên."),
  studentId: z.string().uuid("Mã học viên không hợp lệ."),
});
