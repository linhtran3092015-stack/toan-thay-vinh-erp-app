import { z } from "zod";

export const createCrmCaseSchema = z.object({
  birthYear: z.coerce
    .number()
    .min(2000, "Năm sinh từ năm 2000 trở lên.")
    .max(2025, "Năm sinh không hợp lệ."),
  discountNotes: z.string().optional().nullable(),
  expectedGrade: z.coerce
    .number()
    .min(1, "Khối từ 1 đến 12.")
    .max(12, "Khối từ 1 đến 12."),
  expectedLevel: z.enum(["A", "B", "CLC"]).optional().nullable(),
  expectedMode: z.enum(["online", "offline", "hybrid"]).optional().nullable(),
  expectedTuitionFeeVnd: z.coerce.number().optional().nullable(),
  fullName: z
    .string()
    .trim()
    .min(2, "Họ tên phải có ít nhất 2 ký tự.")
    .max(100, "Họ tên không vượt quá 100 ký tự."),
  guardianFullName: z
    .string()
    .trim()
    .min(2, "Họ tên phụ huynh có ít nhất 2 ký tự.")
    .max(100, "Họ tên phụ huynh không vượt quá 100 ký tự."),
  guardianPhone: z
    .string()
    .trim()
    .min(9, "Số điện thoại có ít nhất 9 chữ số.")
    .max(15, "Số điện thoại không vượt quá 15 chữ số."),
  leadSourceCode: z.string().min(1, "Vui lòng chọn nguồn lead."),
  notes: z.string().optional().nullable(),
  provinceCity: z.string().optional().nullable(),
  saleOwnerId: z.string().uuid("Mã sale owner không hợp lệ.").optional().nullable(),
});

export const transferLeadSchema = z.object({
  crmCaseId: z.string().uuid("Mã case CRM không hợp lệ."),
  newSaleOwnerId: z.string().uuid("Mã sale owner mới không hợp lệ."),
  reason: z
    .string()
    .trim()
    .min(3, "Lý do chuyển giao có ít nhất 3 ký tự.")
    .max(500, "Lý do không vượt quá 500 ký tự."),
});

export const bookTrialSchema = z.object({
  classSessionId: z.string().uuid().optional().nullable(),
  crmCaseId: z.string().uuid("Mã case CRM không hợp lệ."),
  learningMode: z.enum(["online", "offline"]),
  saleNotes: z.string().optional().nullable(),
  trialDate: z.string().min(1, "Vui lòng chọn ngày học thử."),
});

export const convertStudentSchema = z.object({
  checklistItems: z.object({
    item10CommunicationGroupReady: z.boolean(),
    item1PaymentReceived: z.boolean(),
    item2SourceConfirmed: z.boolean(),
    item3SaleConfirmed: z.boolean(),
    item4ClassSelected: z.boolean(),
    item5ModeConfirmed: z.boolean(),
    item6FeeConfirmed: z.boolean(),
    item7AssistantSessionsConfirmed: z.boolean(),
    item8AccountantTransactionConfirmed: z.boolean(),
    item9OfficialStartDateEntered: z.boolean(),
  }),
  classId: z.string().uuid("Vui lòng chọn lớp học chính thức."),
  crmCaseId: z.string().uuid("Mã case CRM không hợp lệ."),
  officialStartDate: z.string().min(1, "Vui lòng chọn ngày học chính thức."),
  registeredMode: z.enum(["online", "offline", "hybrid"]),
});
