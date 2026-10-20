// Value: protects=/sessions/batch keeps its gates and copy (permission load error, sessions.manage then classes.view denials word for word as the /dev preview shows them, loader error, no active class) and hands the workspace the loader's data unchanged, the requested classId, the session-directory query, the selected class as `key` (a class switch remounts the workspace) and the Vietnam business date as `today` (not the UTC date);
// fails_when=a gate is reordered/dropped or its copy drifts from session-batch-route-copy.ts, the key goes missing (state of the previous class carries over), `today` is computed in UTC or not passed, the classId fallback changes, or the loader is called for another class;
// why_new=step 15a adds `key` and `today` to the route (B6) and the preview reuses its denials; no route test existed;
// seam=getCachedDatabasePermissions, getBatchSessionCreationContext and the workspace are mocked at module boundaries; the returned element's type/key/props are inspected; the clock is faked; no_claim=the loader's queries (batch-data.ts) or that the workspace honours the props (batch-session-creation.test.tsx)
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BatchSessionsLoading from "@/app/(app)/sessions/batch/loading";
import BatchSessionsRoute from "@/app/(app)/sessions/batch/page";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { BatchSessionCreateWorkspace } from "@/features/sessions/components/batch-session-create-workspace";
import { BATCH_CLASSES_VIEW_DENIED, BATCH_SESSIONS_MANAGE_DENIED } from "@/features/sessions/session-batch-route-copy";

const dependencies = vi.hoisted(() => ({
  BatchSessionCreateWorkspace: vi.fn(() => null),
  getBatchSessionCreationContext: vi.fn(),
  getCachedDatabasePermissions: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/sessions/batch-data", () => ({
  getBatchSessionCreationContext: dependencies.getBatchSessionCreationContext,
}));
vi.mock("@/features/sessions/components/batch-session-create-workspace", () => ({
  BatchSessionCreateWorkspace: dependencies.BatchSessionCreateWorkspace,
}));

type WorkspaceElement = ReactElement<ComponentProps<typeof BatchSessionCreateWorkspace>>;

const classes = [
  { academicYearId: "ay", code: "6B1", defaultLearningMode: "offline", grade: 6, id: "cls-6b1", level: "B", name: "Toán 6B" },
  { academicYearId: "ay", code: "9A2", defaultLearningMode: "hybrid", grade: 9, id: "cls-9a2", level: "A", name: "Toán 9A2" },
];
const data = {
  classes,
  existingSessionCount: 12,
  existingSessions: [{ endTime: "19:30:00", scheduleTemplateId: "tpl", sessionDate: "2026-10-13", startTime: "17:30:00" }],
  schedules: [{ classId: "cls-9a2", id: "tpl" }],
};

async function renderRoute(
  params: Record<string, string | string[] | undefined>,
  options: { context?: unknown; permissions?: string[] | null } = {},
) {
  const permissions = options.permissions === undefined ? ["sessions.manage", "classes.view"] : options.permissions;
  dependencies.getCachedDatabasePermissions.mockResolvedValue(permissions === null ? { ok: false } : { ok: true, permissions });
  dependencies.getBatchSessionCreationContext.mockResolvedValue(options.context ?? { data: { ...data, targetClassId: "cls-9a2" }, ok: true });
  return (await BatchSessionsRoute({ searchParams: Promise.resolve(params) })) as ReactElement<Record<string, unknown>>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("/sessions/batch route", () => {
  it("renders the workspace keyed by the selected class with the Vietnam business date", async () => {
    vi.useFakeTimers();
    // 18:30 UTC on 19/10 is already 01:30 on 20/10 in Vietnam.
    vi.setSystemTime(new Date("2026-10-19T18:30:00.000Z"));

    const element = (await renderRoute({ classId: "cls-9a2", from: "2026-10-01", status: "cancelled", unknown: "x" })) as unknown as WorkspaceElement;

    expect(element.type).toBe(dependencies.BatchSessionCreateWorkspace);
    expect(element.key).toBe("cls-9a2");
    expect(element.props).toEqual({
      classes,
      directoryQuery: "status=cancelled&from=2026-10-01",
      existingSessionCount: 12,
      existingSessions: data.existingSessions,
      schedules: data.schedules,
      selectedClassId: "cls-9a2",
      today: "2026-10-20",
    });
    expect(dependencies.getBatchSessionCreationContext).toHaveBeenCalledWith("cls-9a2");
  });

  it("falls back to the first class when the loader resolves none, and ignores an array classId", async () => {
    const element = (await renderRoute(
      { classId: ["cls-9a2", "cls-6b1"] },
      { context: { data: { ...data, targetClassId: null }, ok: true } },
    )) as unknown as WorkspaceElement;

    expect(dependencies.getBatchSessionCreationContext).toHaveBeenCalledWith(undefined);
    expect(element.key).toBe("cls-6b1");
    expect(element.props.selectedClassId).toBe("cls-6b1");
    expect(element.props.directoryQuery).toBe("");
  });

  it("keeps its gates in order with the preview's copy", async () => {
    const loadError = await renderRoute({}, { permissions: null });
    expect(loadError.type).toBe(ErrorState);
    expect(loadError.props).toEqual({
      description: "Hệ thống chưa tải được quyền tạo buổi học hàng loạt.",
      title: "Không tải được quyền truy cập",
    });

    // Without sessions.manage the first denial wins even without classes.view.
    const noManage = await renderRoute({}, { permissions: [] });
    expect(noManage.type).toBe(PermissionDeniedState);
    expect(noManage.props).toEqual(BATCH_SESSIONS_MANAGE_DENIED);

    const noClassesView = await renderRoute({}, { permissions: ["sessions.manage"] });
    expect(noClassesView.type).toBe(PermissionDeniedState);
    expect(noClassesView.props).toEqual(BATCH_CLASSES_VIEW_DENIED);
    expect(dependencies.getBatchSessionCreationContext).not.toHaveBeenCalled();
  });

  it("states loader errors and the no-active-class case in the frame", async () => {
    const loaderError = await renderRoute({}, { context: { error: "Không thể tải lịch học cố định của lớp.", ok: false } });
    expect(loaderError.type).toBe(ErrorState);
    expect(loaderError.props).toEqual({
      description: "Không thể tải lịch học cố định của lớp.",
      title: "Không tải được dữ liệu tạo buổi học hàng loạt",
    });

    const noClasses = await renderRoute({}, { context: { data: { ...data, classes: [], targetClassId: null }, ok: true } });
    expect(noClasses.type).toBe(ErrorState);
    expect(noClasses.props).toEqual({
      description: "Hiện tại không có lớp học nào đang hoạt động (active) để tạo buổi học.",
      title: "Chưa có lớp học hoạt động",
    });
  });

  // Value (extension, review T2 of step 15a): protects=/sessions/batch's loading file announces "Đang tải dữ liệu tạo buổi học hàng loạt" as its only status, and its pulsing skeleton (form cards and chip grid) is hidden from assistive tech;
  // fails_when=the LoadingNotice is dropped or renamed, a second status appears, or the skeleton loses aria-hidden;
  // why_new=the loading file was added in step 15a without a test; seam=none; no_claim=the skeleton's geometry matching the workspace
  it("its loading state announces one status and hides the pulsing skeleton", () => {
    const { container } = render(<BatchSessionsLoading />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải dữ liệu tạo buổi học hàng loạt");
    const skeleton = container.querySelector('[class*="animate-pulse"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton!.closest('[role="status"]')).toBeNull();
  });
});
