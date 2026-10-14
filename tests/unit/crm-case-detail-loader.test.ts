// Value: protects=getCrmCaseDetail carries crm_cases.status_changed_at, crm_trial_bookings.result_recorded_at and crm_lead_assignment_history.previous_sale_owner_id into the read model, so the lead page's lifecycle rail dates "Đã học thử" from the recorded attendance and the current step from the status change; missing values become null, not undefined;
// fails_when=either column is dropped or misnamed in the mapping, so the rail silently loses those dates (deriveCrmLifecycle falls back to null) while every view test keeps passing on hand-built read models;
// why_new=step 10 adds both fields to getCrmCaseDetail and no test calls that loader (crm-detail-view and crm-detail-action-gate use fixture read models; crm-directory-counts covers only the list loaders);
// seam=createSupabaseServerClient is replaced by a per-table fixture client answering the loader's select/eq/order/maybeSingle/rpc chain; no_claim=does not prove the select("*") returns these columns from a real database (columns read from the 2026-10-13 phase2b migration)
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveCrmLifecycle } from "@/features/crm/crm-presentation";
import { getCrmCaseDetail } from "@/features/crm/data";

type Fixture = { data: unknown; error: { message: string } | null };

let tables: Record<string, Fixture> = {};

function table(name: string) {
  const result = () => Promise.resolve(tables[name] ?? { data: null, error: null });
  const query = {
    eq: () => query,
    maybeSingle: result,
    order: result,
    select: () => query,
  };
  return query;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: (name: string) => table(name),
    rpc: async () => ({ data: [], error: null }),
  })),
}));

const caseRow = {
  birth_year: 2011,
  created_at: "2026-10-01T03:00:00Z",
  discount_notes: null,
  drop_reason: null,
  dropped_at: null,
  expected_grade: 10,
  expected_level: "CLC",
  expected_mode: "offline",
  expected_official_start_date: null,
  expected_tuition_fee_vnd: null,
  full_name: "Phạm Đức Anh",
  guardian_full_name: "Phạm Văn Hùng",
  guardian_id: null,
  guardian_phone: "0934556677",
  guardian_relationship: "Bố",
  id: "case-1",
  lead_source: { code: "referral_parent", name: "SB F1" },
  nickname: null,
  notes: null,
  province_city: "Hà Nội",
  public_code: "LD-2610-0029",
  sale_owner: { display_name: "Hoàng Minh Khôi" },
  sale_owner_id: "sale-1",
  status: "pending_enrollment_confirmation",
  // After CRM_STATUS_TRACKING_SINCE, so the rail trusts it on this pre-migration lead.
  status_changed_at: "2026-10-16T08:00:00Z",
  student_id: "student-1",
};

const attendedTrial = {
  class_session_id: null,
  created_at: "2026-10-02T04:00:00Z",
  id: "trial-1",
  learning_mode: "offline",
  result_recorded_at: "2026-10-05T14:00:00Z",
  sale_notes: null,
  status: "attended",
  teacher_feedback: "Nền tảng đại số tốt.",
  trial_date: "2026-10-05",
};

beforeEach(() => {
  tables = {
    crm_cases: { data: caseRow, error: null },
    crm_lead_assignment_history: { data: [], error: null },
    crm_trial_bookings: { data: [attendedTrial], error: null },
    student_enrollment_checklists: { data: null, error: null },
  };
});

describe("CRM case detail loader", () => {
  it("maps the status change and trial result times that date the lifecycle rail", async () => {
    const detail = await getCrmCaseDetail("case-1");

    expect(detail).toMatchObject({
      status: "pending_enrollment_confirmation",
      statusChangedAt: "2026-10-16T08:00:00Z",
      trialBookings: [{ id: "trial-1", resultRecordedAt: "2026-10-05T14:00:00Z", status: "attended" }],
    });
    expect(deriveCrmLifecycle(detail!).map((step) => [step.key, step.state, step.date])).toEqual([
      ["interested", "done", "2026-10-01T03:00:00Z"],
      ["trial_booked", "done", "2026-10-02T04:00:00Z"],
      ["trial_completed", "done", "2026-10-05T14:00:00Z"],
      ["pending_enrollment_confirmation", "current", "2026-10-16T08:00:00Z"],
      ["converted", "upcoming", null],
    ]);
  });

  it("turns a missing status change or result time into null", async () => {
    tables.crm_cases = { data: { ...caseRow, status_changed_at: undefined }, error: null };
    tables.crm_trial_bookings = { data: [{ ...attendedTrial, result_recorded_at: undefined, status: "scheduled" }], error: null };

    const detail = await getCrmCaseDetail("case-1");

    expect(detail?.statusChangedAt).toBeNull();
    expect(detail?.trialBookings[0].resultRecordedAt).toBeNull();
  });

  it("maps the previous sale id so a transfer stays a transfer when RLS hides that sale's name", async () => {
    tables.crm_lead_assignment_history = {
      data: [
        { assigner: null, assignment_method: "manual_transfer", created_at: "2026-10-02T03:00:00Z", id: "h-2", new_sale: { display_name: "Hoàng Minh Khôi" }, prev_sale: null, previous_sale_owner_id: "sale-2", reason: "Lead khối 10" },
        { assigner: null, assignment_method: "auto_round_robin", created_at: "2026-10-01T03:00:00Z", id: "h-1", new_sale: { display_name: "Đặng Phương Thảo" }, prev_sale: null, previous_sale_owner_id: null, reason: "Chia đều" },
      ],
      error: null,
    };

    const detail = await getCrmCaseDetail("case-1");

    expect(detail?.assignmentHistory.map((entry) => [entry.id, entry.previousSaleOwnerId, entry.previousSaleOwnerName])).toEqual([
      ["h-2", "sale-2", null],
      ["h-1", null, null],
    ]);
  });

  // Value (extension, fix pass 3, H3): protects=a lead whose sale owner's name profiles RLS hides (no staff.view) reads "Sale khác (không xem được tên)", not "Chưa phân công", and a hidden new owner in the history reads "Sale mới (không xem được tên)"; "Chưa phân công" stays for a null owner id;
  // fails_when=the loader falls back to "Chưa phân công"/"Chưa rõ" whenever the embedded name is null, so an assigned lead looks unassigned;
  // why_new=H3; seam=as above; no_claim=does not prove which roles RLS hides names from
  it("labels a set sale owner whose name is hidden instead of calling the lead unassigned", async () => {
    tables.crm_cases = { data: { ...caseRow, sale_owner: null }, error: null };
    tables.crm_lead_assignment_history = {
      data: [{ assigner: null, assignment_method: "manual_transfer", created_at: "2026-10-02T03:00:00Z", id: "h-2", new_sale: null, prev_sale: null, previous_sale_owner_id: "sale-2", reason: null }],
      error: null,
    };

    const detail = await getCrmCaseDetail("case-1");

    expect(detail?.saleOwnerId).toBe("sale-1");
    expect(detail?.saleOwnerName).toBe("Sale khác (không xem được tên)");
    expect(detail?.assignmentHistory[0].newSaleOwnerName).toBe("Sale mới (không xem được tên)");

    tables.crm_cases = { data: { ...caseRow, sale_owner: null, sale_owner_id: null }, error: null };
    expect((await getCrmCaseDetail("case-1"))?.saleOwnerName).toBe("Chưa phân công");
  });
});
