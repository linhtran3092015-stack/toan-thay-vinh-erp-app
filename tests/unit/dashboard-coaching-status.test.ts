import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getCoachingRecordsDashboardResult: vi.fn(),
}));

vi.mock("@/features/coaching/data", () => ({
  getCoachingRecordsDashboardResult:
    dependencies.getCoachingRecordsDashboardResult,
}));

import { getRoleAwareDashboardReadModel } from "@/features/dashboard/data";

function entry(currentStatus: string) {
  return {
    assistantOwnerDisplayName: "Cô Mai",
    assistantOwnerId: "staff-1",
    campaignName: "Theo dõi tháng 8",
    currentStatus,
    id: `coaching-${currentStatus}`,
    latestEventAt: null,
    latestOutcome: null,
    openedAt: "2026-08-01T08:00:00Z",
    priority: "high" as const,
    reason: "Theo dõi tiến độ",
    reviewAt: null,
    studentFullName: "Nguyễn An",
    studentId: "student-1",
    studentPublicCode: "HV-001",
  };
}

describe("Global dashboard Coaching lifecycle buckets", () => {
  beforeEach(() => {
    dependencies.getCoachingRecordsDashboardResult.mockReset();
  });

  it("does not count an unsupported raw status as an active high-priority record", async () => {
    dependencies.getCoachingRecordsDashboardResult.mockResolvedValue({
      data: [entry("open"), entry("in_progress"), entry("closed"), entry("constructor")],
      ok: true,
    });

    const dashboard = await getRoleAwareDashboardReadModel(["coaching.view"]);

    expect(dashboard.coaching).toEqual({
      data: {
        closedCount: 1,
        highPriorityCount: 2,
        inProgressCount: 1,
        openCount: 1,
        recordCount: 4,
      },
      status: "ready",
    });
  });
});
