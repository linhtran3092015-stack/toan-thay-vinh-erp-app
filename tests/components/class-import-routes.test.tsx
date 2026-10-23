// Value: protects=the two class & schedule import routes keep their gates while the pages are redesigned: /imports/classes shows the permission-load error, the imports.classes denial, or ClassScheduleImportPage with no props (real actions, real batch links); /imports/classes/[batchId] checks imports.classes before loading anything, loads the batch by the route's id, answers notFound() when the loader returns null (unknown id or read error), and hands the detail to ClassScheduleBatchDetailPage with nothing else (real commit action, real back link); both loading.tsx files show the import skeleton with a status notice;
// fails_when=a route renders the page without imports.classes, loads the batch before the gate, swallows a missing batch instead of notFound, passes preview overrides (actions, /dev hrefs) or drops the detail, or a loading file stops announcing itself;
// why_new=no test rendered either import route (step 15 map §0 finding 2) and step 15b adds the loading files;
// seam=getCachedDatabasePermissions, the batch loader and both page components are mocked at their module boundaries; next/navigation notFound throws a marker; the returned elements' types and props are inspected;
// no_claim=does not prove the server actions re-check imports.classes (they call has_permission themselves) or what the pages render
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BatchLoading from "@/app/(app)/imports/classes/[batchId]/loading";
import ClassScheduleBatchDetailRoute from "@/app/(app)/imports/classes/[batchId]/page";
import ImportLoading from "@/app/(app)/imports/classes/loading";
import ClassScheduleImportRoute from "@/app/(app)/imports/classes/page";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";

const dependencies = vi.hoisted(() => ({
  ClassScheduleBatchDetailPage: vi.fn(() => null),
  ClassScheduleImportPage: vi.fn(() => null),
  getCachedDatabasePermissions: vi.fn(),
  getClassScheduleImportBatchDetail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: dependencies.getCachedDatabasePermissions,
}));
vi.mock("@/features/imports/classes/queries", () => ({
  getClassScheduleImportBatchDetail: dependencies.getClassScheduleImportBatchDetail,
}));
vi.mock("@/features/imports/classes/class-schedule-import-page", () => ({
  ClassScheduleImportPage: dependencies.ClassScheduleImportPage,
}));
vi.mock("@/features/imports/classes/class-schedule-batch-detail-page", () => ({
  ClassScheduleBatchDetailPage: dependencies.ClassScheduleBatchDetailPage,
}));

const BATCH_ID = "b7c40000-0000-4000-8000-000000000001";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type AnyElement = ReactElement<Record<string, unknown>>;

describe("/imports/classes route", () => {
  it("shows the permission-load error when permissions cannot be read", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: false });
    const element = (await ClassScheduleImportRoute()) as AnyElement;

    expect(element.type).toBe(ErrorState);
    expect(element.props.description).toBe("Hệ thống chưa tải được quyền import lớp & lịch học từ cơ sở dữ liệu.");
  });

  it("denies without imports.classes, even with every class permission", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({
      ok: true,
      permissions: ["app.access", "classes.view", "classes.create", "classes.manage_schedule", "imports.students"],
    });
    const element = (await ClassScheduleImportRoute()) as AnyElement;

    expect(element.type).toBe(PermissionDeniedState);
    expect(element.props.title).toBe("Không có quyền import lớp & lịch học");
    expect(String(element.props.description)).toContain("nhập dữ liệu lớp học");
  });

  it("renders the wizard with no props (real actions and batch links) for imports.classes", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["app.access", "imports.classes"] });
    const element = (await ClassScheduleImportRoute()) as AnyElement;

    expect(element.type).toBe(dependencies.ClassScheduleImportPage);
    expect(element.props).toEqual({});
  });
});

describe("/imports/classes/[batchId] route", () => {
  async function renderRoute(batchId = BATCH_ID) {
    return (await ClassScheduleBatchDetailRoute({ params: Promise.resolve({ batchId }) })) as AnyElement;
  }

  it("shows the permission-load error and loads nothing", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: false });
    const element = await renderRoute();

    expect(element.type).toBe(ErrorState);
    expect(dependencies.getClassScheduleImportBatchDetail).not.toHaveBeenCalled();
  });

  it("denies without imports.classes before loading the batch", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["app.access", "classes.view", "classes.create"] });
    const element = await renderRoute();

    expect(element.type).toBe(PermissionDeniedState);
    expect(element.props.title).toBe("Không có quyền truy cập");
    expect(element.props.description).toBe("Tài khoản hiện tại không có quyền xem chi tiết batch import lớp học & lịch học.");
    expect(dependencies.getClassScheduleImportBatchDetail).not.toHaveBeenCalled();
  });

  it("answers notFound when the loader finds no batch (unknown id or read error)", async () => {
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["imports.classes"] });
    dependencies.getClassScheduleImportBatchDetail.mockResolvedValue(null);

    await expect(renderRoute("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(dependencies.getClassScheduleImportBatchDetail).toHaveBeenCalledWith("not-a-uuid");
  });

  it("hands the loaded detail, and only it, to the batch page", async () => {
    const detail = { batch: { id: BATCH_ID, status: "ready_to_commit" }, classRows: [], scheduleRows: [] };
    dependencies.getCachedDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["imports.classes"] });
    dependencies.getClassScheduleImportBatchDetail.mockResolvedValue(detail);
    const element = await renderRoute();

    expect(dependencies.getClassScheduleImportBatchDetail).toHaveBeenCalledWith(BATCH_ID);
    expect(element.type).toBe(dependencies.ClassScheduleBatchDetailPage);
    expect(element.props).toEqual({ detail });
  });
});

describe("class import loading files", () => {
  it.each([
    { Loading: ImportLoading, title: "Đang mở trang nhập lớp & lịch học" },
    { Loading: BatchLoading, title: "Đang tải lô nhập lớp & lịch học" },
  ])("announces '$title' over the wizard skeleton", ({ Loading, title }) => {
    const { container } = render(<Loading />);

    expect(screen.getByRole("status")).toHaveTextContent(title);
    // Five grey step cells, none claimed current.
    expect(container.querySelector("[aria-current]")).toBeNull();
    expect(container.querySelectorAll('[aria-hidden="true"] .rounded-full')).toHaveLength(5);
  });
});
