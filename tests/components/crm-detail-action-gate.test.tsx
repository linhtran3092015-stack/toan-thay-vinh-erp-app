// Value: protects=a converted CRM case shows "Đã nhập học" beside its title, links to the student profile and never mounts a second "Xác nhận chuyển đổi" affordance or its dialog;
// fails_when=the detail page offers conversion again on a converted case, drops the student link, or stops labelling the status next to the title;
// why_new=step 10 adds a lifecycle rail whose last step is also "Đã nhập học", so the status assertion is scoped to the title block (assertion changed deliberately, not weakened);
// seam=permissions and CRM loaders are mocked; the page-level supabase mock only answers from().select().eq().order(); no_claim=does not cover other statuses (crm-detail-view.test.tsx does)
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CrmCaseDetailPage from "@/app/(app)/crm/[caseId]/page";

const data = vi.hoisted(() => ({ getCrmCaseDetail: vi.fn(), getSaleOwners: vi.fn() }));
const permissions = vi.hoisted(() => ({ getCachedDatabasePermissions: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/features/crm/data", () => data);
vi.mock("@/lib/permissions/database-permissions", () => permissions);
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: [] }) }),
      }),
    }),
  })),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CRM detail converted-case action gate", () => {
  it("does not mount a second conversion affordance for a converted case", async () => {
    permissions.getCachedDatabasePermissions.mockResolvedValue({
      ok: true,
      permissions: ["crm.view", "students.confirm_official"],
    });
    data.getSaleOwners.mockResolvedValue([]);
    data.getCrmCaseDetail.mockResolvedValue({
      assignmentHistory: [],
      caseNotes: [],
      dropReason: null,
      droppedAt: null,
      birthYear: 2015,
      checklist: null,
      createdAt: "2026-08-10T00:00:00Z",
      discountNotes: null,
      expectedGrade: 5,
      expectedLevel: "CLC",
      expectedMode: "offline",
      expectedOfficialStartDate: null,
      expectedTuitionFeeVnd: null,
      fullName: "Nguyễn Minh An",
      guardianFullName: "Nguyễn Thị Mai",
      guardianId: null,
      guardianPhone: "0900000000",
      guardianRelationship: "mother",
      id: "case-1",
      leadSourceCode: "mma_fanpage",
      leadSourceName: "MMA Fanpage Facebook",
      nickname: null,
      notes: null,
      provinceCity: "Hà Nội",
      publicCode: "CRM-001",
      saleOwnerId: "sale-1",
      saleOwnerName: "Lê Hương",
      status: "converted",
      studentId: "student-1",
      trialBookings: [],
    });

    render(await CrmCaseDetailPage({
      params: Promise.resolve({ caseId: "case-1" }),
      searchParams: Promise.resolve({ source: "mma_fanpage" }),
    }));

    const title = screen.getByRole("heading", { level: 1, name: "Nguyễn Minh An" });
    expect(within(title.parentElement!).getByText("Đã nhập học")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xem hồ sơ học viên/ })).toHaveAttribute("href", "/students/student-1");
    expect(screen.queryByRole("button", { name: /Xác nhận chuyển đổi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /chuyển thành học viên/i })).not.toBeInTheDocument();
    // Value (extension, coverage pass 2): protects=the lead page's "Lead tuyển sinh" back link returns to the list with the CRM filters it was opened with;
    // fails_when=the page stops passing getCrmDirectoryHref(searchParams) to the view, or the view hard-codes "/crm" (pre-redesign page kept the filters);
    // why_new=crm-detail-view passes directoryHref as a prop and never checks the link; seam=none beyond this file's mocks; no_claim=does not re-check unsafe-key filtering (crm-directory-url-state covers it)
    expect(screen.getByRole("link", { name: "Lead tuyển sinh" })).toHaveAttribute("href", "/crm?source=mma_fanpage");
  });
});
