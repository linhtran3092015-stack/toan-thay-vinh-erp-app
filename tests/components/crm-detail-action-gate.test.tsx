import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CrmCaseDetailPage from "@/app/(app)/crm/[caseId]/page";

const data = vi.hoisted(() => ({ getCrmCaseDetail: vi.fn(), getSaleOwners: vi.fn() }));
const permissions = vi.hoisted(() => ({ getCachedDatabasePermissions: vi.fn() }));

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

    expect(screen.getByText("Đã nhập học")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xem hồ sơ học viên/ })).toHaveAttribute("href", "/students/student-1");
    expect(screen.queryByRole("button", { name: /Xác nhận chuyển đổi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /chuyển thành học viên/i })).not.toBeInTheDocument();
  });
});
