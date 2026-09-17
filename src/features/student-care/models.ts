import { z } from "zod";

export const careCommandSchema = z.object({
  op: z.enum(["configure", "claim", "assign", "assign_student", "contact", "schedule", "complete", "cancel", "coaching", "create_followup"]),
  request_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  coaching_id: z.string().uuid().optional(),
  contact_event_id: z.string().uuid().optional(),
  version: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
  success: z.boolean().optional(),
  note: z.string().trim().max(4000).optional(),
  contact_at: z.string().datetime({ offset: true }).optional(),
  next_followup_at: z.string().datetime({ offset: true }).optional(),
  recipient: z.enum(["guardian", "student", "both"]).optional(),
  channel: z.enum(["phone", "zalo", "in_person", "other"]).optional(),
  strengths: z.string().trim().max(4000).optional(),
  difficulties: z.string().trim().max(4000).optional(),
  plan: z.string().trim().max(4000).optional(),
  outcome: z.string().trim().max(4000).optional(),
});
export type CareCommand = z.infer<typeof careCommandSchema>;
export const evidenceSchema = z.record(z.string(), z.array(z.object({
  session_id: z.string(), session_date: z.string(), start_time: z.string(), class_name: z.string(),
  attendance_status: z.string().nullable(), test_score: z.number().nullable(),
})));
const taskSchema = z.object({
  id: z.string(), student_id: z.string(), kind: z.enum(["alert", "monthly", "followup"]),
  period_month: z.string().nullable(), status: z.enum(["open", "in_progress", "following_up", "completed", "cancelled"]),
  owner_id: z.string().nullable(), evidence: z.record(z.string(), z.unknown()), evidence_current: z.boolean(),
  detected_at: z.string(), claim_due_at: z.string().nullable(), contact_due_at: z.string().nullable(),
  first_contact_at: z.string().nullable(), next_followup_at: z.string().nullable(), due_at: z.string().nullable(),
  completed_at: z.string().nullable(), outcome: z.string().nullable(), version: z.number(),
});
const assigneeSchema = z.object({ id: z.string(), name: z.string().nullable(), open_tasks: z.number().optional() });
export const dashboardSchema = z.object({
  rows: z.array(taskSchema.extend({full_name:z.string(),public_code:z.string(),lifecycle_status:z.string(),owner_name:z.string().nullable(),overdue:z.boolean().nullable()})),
  total:z.number(),page:z.number(),month:z.string(),
  settings:z.object({enabled:z.boolean(),last_success_at:z.string().nullable(),last_reconcile_at:z.string().nullable(),last_error:z.string().nullable()}),
  queue:z.object({pending:z.number(),failed:z.number()}),
  summary:z.object({open_alerts:z.number(),unassigned:z.number(),monthly_total:z.number(),monthly_completed:z.number(),monthly_cancelled:z.number(),monthly_on_time:z.number(),overdue:z.number()}),
  assignees:z.array(assigneeSchema),
});
export const detailSchema = z.object({
  task:taskSchema,
  student:z.object({id:z.string(),full_name:z.string(),public_code:z.string(),lifecycle_status:z.string()}),
  events:z.array(z.object({id:z.string(),task_id:z.string().nullable(),event_type:z.string(),payload:z.record(z.string(),z.unknown()),occurred_at:z.string(),actor_name:z.string().nullable()})),
  contacts:z.array(z.object({id:z.string(),contact_at:z.string(),note:z.string()})),
  coaching:z.array(z.object({id:z.string(),campaign_name:z.string()})),
  available_coaching:z.array(z.object({id:z.string(),campaign_name:z.string()})),
  assignment:z.object({owner_id:z.string()}).nullable(),
  assignees:z.array(assigneeSchema),
});
export const studentsSchema=z.object({rows:z.array(z.object({id:z.string(),full_name:z.string(),public_code:z.string(),lifecycle_status:z.string(),owner_id:z.string().nullable(),owner_name:z.string().nullable()})),total:z.number()});
export type CareDashboard=z.infer<typeof dashboardSchema>;
export type CareDetail=z.infer<typeof detailSchema>;
export type CareStudents=z.infer<typeof studentsSchema>;
export const careKindLabels={alert:"Cảnh báo sớm",monthly:"Coaching tháng",followup:"Theo dõi tiếp"};
export const careStatusLabels={open:"Chưa bắt đầu",in_progress:"Đang xử lý",following_up:"Đang theo dõi",completed:"Đã hoàn thành",cancelled:"Ngoại lệ / Đã hủy"};
export const careRuleLabels:Record<string,string>={absence_streak:"Vắng 2 buổi liên tiếp",absence_month:"Vắng từ 3 buổi trong tháng",low_test_streak:"Hai bài có điểm gần nhất dưới 6"};
export function careTime(value:string|null) {
  if(!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(value));
}
export function careIsStale(lastSuccess:string|null, now=Date.now()) {
  return !lastSuccess || now-new Date(lastSuccess).getTime()>5*60_000;
}
export const careFilterSchema=z.object({
  page:z.coerce.number().int().min(1).max(100000).catch(1),
  month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/).optional().catch(undefined),
  kind:z.enum(["alert","monthly","followup"]).optional().catch(undefined),
  status:z.enum(["open","in_progress","following_up","completed","cancelled","unassigned"]).optional().catch(undefined),
  search:z.string().max(160).optional(),student_id:z.string().uuid().optional().catch(undefined),
  mine:z.enum(["true","false"]).optional().catch(undefined),overdue:z.enum(["true","false"]).optional().catch(undefined),
});
