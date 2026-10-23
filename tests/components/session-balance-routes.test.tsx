// Value: protects=the two session-balance import routes' gates and wiring: a permission load failure shows the error state and a person with neither imports.session_balances nor .approve gets the denial, both before any batch is read; the list route hands the page the newest batches, canApprove from .approve, canImport from imports.session_balances and the signed-in user's id (null without a user); the batch route reads the batch by its id, answers notFound for a missing batch, and hands the page canApprove, canReconcile (imports.session_balances) and the user id;
// fails_when=a gate is dropped or keyed off the wrong code, data is read before the gate, the approve-only person can run the wizard or reconcile (canImport / canReconcile true), the maker gets canApprove, the user id stops reaching the four-eyes check, or a missing batch renders instead of 404;
// why_new=step 15b threads canImport / canReconcile through these routes; no route test existed for them;
// seam=permissions, the Supabase server client (auth.getUser), the queries and both page components are mocked at module boundaries; next/navigation notFound throws a marker; returned elements are inspected, not rendered;
// no_claim=does not prove the pages' presentation (page and workflow tests), the RLS of the queries or the server actions' own permission checks
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SessionBalanceBatchDetailRoute from "@/app/(app)/imports/session-balances/[batchId]/page";
import SessionBalanceImportRoute from "@/app/(app)/imports/session-balances/page";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";

const deps = vi.hoisted(() => ({
  getCachedDatabasePermissions: vi.fn(),
  getSessionBalanceImportBatchDetail: vi.fn(),
  getUser: vi.fn(),
  listSessionBalanceImportBatches: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  SessionBalanceBatchDetailPage: vi.fn(() => null),
  SessionBalanceImportPage: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({ notFound: deps.notFound }));
vi.mock("@/lib/permissions/database-permissions", () => ({ getCachedDatabasePermissions: deps.getCachedDatabasePermissions }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser: deps.getUser } })),
}));
vi.mock("@/features/imports/session-balances/queries", () => ({
  getSessionBalanceImportBatchDetail: deps.getSessionBalanceImportBatchDetail,
  listSessionBalanceImportBatches: deps.listSessionBalanceImportBatches,
}));
vi.mock("@/features/imports/session-balances/session-balance-import-page", () => ({
  SessionBalanceImportPage: deps.SessionBalanceImportPage,
}));
vi.mock("@/features/imports/session-balances/session-balance-batch-detail-page", () => ({
  SessionBalanceBatchDetailPage: deps.SessionBalanceBatchDetailPage,
}));

afterEach(() => {
  vi.clearAllMocks();
});

const batches = [{ id: "batch-1" }, { id: "batch-2" }];
const detail = { batch: { id: "batch-1" }, profiles: {}, rows: [] };

function signedIn(id: string | null) {
  deps.getUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

function permissions(codes: string[] | null) {
  deps.getCachedDatabasePermissions.mockResolvedValue(codes ? { ok: true, permissions: codes } : { ok: false });
}

async function listRoute() {
  return (await SessionBalanceImportRoute()) as ReactElement<Record<string, unknown>>;
}

async function batchRoute(batchId = "batch-1") {
  return (await SessionBalanceBatchDetailRoute({ params: Promise.resolve({ batchId }) })) as ReactElement<Record<string, unknown>>;
}

describe("/imports/session-balances route", () => {
  it("shows the error state when permissions cannot be loaded, before reading anything", async () => {
    permissions(null);
    const element = await listRoute();
    expect(element.type).toBe(ErrorState);
    expect(element.props).toMatchObject({ title: "Không tải được quyền truy cập" });
    expect(deps.listSessionBalanceImportBatches).not.toHaveBeenCalled();
    expect(deps.getUser).not.toHaveBeenCalled();
  });

  it("denies a person with neither import code, before reading anything", async () => {
    permissions(["app.access", "imports.students", "imports.classes"]);
    const element = await listRoute();
    expect(element.type).toBe(PermissionDeniedState);
    expect(element.props).toEqual({
      description: "Tài khoản hiện tại không có quyền xem hoặc duyệt import số dư buổi.",
      title: "Không có quyền truy cập",
    });
    expect(deps.listSessionBalanceImportBatches).not.toHaveBeenCalled();
  });

  it.each([
    { canApprove: false, canImport: true, codes: ["app.access", "imports.session_balances"], label: "maker" },
    { canApprove: true, canImport: false, codes: ["app.access", "imports.session_balances.approve"], label: "approver only" },
    { canApprove: true, canImport: true, codes: ["imports.session_balances", "imports.session_balances.approve"], label: "both" },
  ])("hands the page the batches, the user and the $label flags", async ({ canApprove, canImport, codes }) => {
    permissions(codes);
    signedIn("user-1");
    deps.listSessionBalanceImportBatches.mockResolvedValue(batches);

    const element = await listRoute();
    expect(element.type).toBe(deps.SessionBalanceImportPage);
    expect(element.props).toEqual({ batches, canApprove, canImport, currentUserId: "user-1" });
  });

  it("passes a null user id when nobody is signed in", async () => {
    permissions(["imports.session_balances"]);
    signedIn(null);
    deps.listSessionBalanceImportBatches.mockResolvedValue([]);
    expect((await listRoute()).props).toMatchObject({ currentUserId: null });
  });
});

describe("/imports/session-balances/[batchId] route", () => {
  it("shows the error state when permissions cannot be loaded, before reading the batch", async () => {
    permissions(null);
    const element = await batchRoute();
    expect(element.type).toBe(ErrorState);
    expect(deps.getSessionBalanceImportBatchDetail).not.toHaveBeenCalled();
  });

  it("denies a person with neither import code, before reading the batch", async () => {
    permissions(["app.access"]);
    const element = await batchRoute();
    expect(element.type).toBe(PermissionDeniedState);
    expect(element.props).toEqual({
      description: "Tài khoản hiện tại không có quyền xem chi tiết batch import số dư.",
      title: "Không có quyền truy cập",
    });
    expect(deps.getSessionBalanceImportBatchDetail).not.toHaveBeenCalled();
  });

  it("answers notFound for a batch that cannot be read", async () => {
    permissions(["imports.session_balances"]);
    deps.getSessionBalanceImportBatchDetail.mockResolvedValue(null);
    await expect(batchRoute("missing-id")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(deps.getSessionBalanceImportBatchDetail).toHaveBeenCalledWith("missing-id");
    expect(deps.SessionBalanceBatchDetailPage).not.toHaveBeenCalled();
  });

  it.each([
    { canApprove: false, canReconcile: true, codes: ["imports.session_balances"], label: "maker" },
    { canApprove: true, canReconcile: false, codes: ["imports.session_balances.approve"], label: "approver only" },
    { canApprove: true, canReconcile: true, codes: ["imports.session_balances", "imports.session_balances.approve"], label: "both" },
  ])("hands the page the batch, the user and the $label flags", async ({ canApprove, canReconcile, codes }) => {
    permissions(codes);
    signedIn("user-2");
    deps.getSessionBalanceImportBatchDetail.mockResolvedValue(detail);

    const element = await batchRoute("batch-1");
    expect(deps.getSessionBalanceImportBatchDetail).toHaveBeenCalledWith("batch-1");
    expect(element.type).toBe(deps.SessionBalanceBatchDetailPage);
    expect(element.props).toEqual({ canApprove, canReconcile, currentUserId: "user-2", detail });
  });
});
